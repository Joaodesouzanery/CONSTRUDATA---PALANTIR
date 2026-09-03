/**
 * Extrair o valor de um cupom fiscal a partir do TEXTO que o OCR devolveu.
 *
 * ─── ESTE ARQUIVO É PURO, E ISSO É O PONTO ────────────────────────────────────
 * Ele recebe **linhas de texto**, não imagem. Quem chama o tesseract é o
 * `ocrCupom.ts`, fino e impuro. Assim toda a lógica que decide qual número é o
 * total — que é onde os erros caros moram — roda no `node:test`, com transcrições
 * reais de OCR como fixture, sem navegador e sem baixar nada.
 *
 * ─── A PREMISSA: O OCR VAI ERRAR ──────────────────────────────────────────────
 * Em papel térmico o acerto por caractere fica em torno de 60%. O desenho aqui
 * assume isso o tempo todo:
 *
 *   · um mapa de confusões conserta o que é conserto óbvio (`O`→`0`, `S`→`5`);
 *   · a forma exigida é ESTRITA — sem separador decimal com dois dígitos, recusa;
 *   · fora da faixa de sanidade, recusa;
 *   · e a saída sempre carrega o trecho CRU, para a tela mostrar o que a máquina
 *     viu. Quando a pessoa enxerga `R$ 47,9O`, ela corrige em dois segundos; se o
 *     campo só mostrasse `47.90`, ela confiaria cego.
 *
 * Recusar é a funcionalidade. Ler `4790` e propor R$ 47,90 é o palpite que põe um
 * erro de 100× dentro da DRE.
 */

/** Normaliza como o resto do Financeiro: sem acento, maiúscula, espaço colapsado. */
function normalizar(t: string): string {
  return (t ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export type ConfiancaLeitura = 'alta' | 'media' | 'baixa' | 'nao-li'

export interface ValorProposto {
  valor: number | null
  /** O trecho cru de onde o número saiu. Vai para a tela. */
  bruto: string
  /** Qual rótulo ancorou a leitura. `null` quando foi o recurso do maior valor. */
  ancora: string | null
  confianca: ConfiancaLeitura
  avisos: string[]
}

export interface ItemLidoDoCupom {
  descricao: string
  valor: number
  bruto: string
}

/**
 * O que o OCR confunde em papel térmico, e o conserto.
 *
 * ⚠️ Aplicado **só dentro do candidato numérico**, nunca no texto inteiro — senão
 * "SOLDA" viraria "50LDA" e a busca por âncora quebraria.
 */
const CONFUSOES: Record<string, string> = {
  O: '0', o: '0', D: '0', Q: '0',
  l: '1', I: '1', i: '1', '|': '1', '!': '1',
  S: '5', s: '5',
  B: '8',
  G: '6', b: '6',
  Z: '2', z: '2',
  T: '7',
  g: '9', q: '9',
  A: '4',
}

export function normalizarDigitosDeOcr(bruto: string): string {
  return (bruto ?? '').replace(/[OoDQlIi|!SsBGbZzTgqA]/g, (c) => CONFUSOES[c] ?? c)
}

/**
 * A chave de comparacao das ancoras, tolerante ao OCR.
 *
 * ⚠️ O OCR confunde nos DOIS sentidos: ele transforma `0` em `O`, e tambem `O` em
 * `0`. Procurar a ancora "VALOR A PAGAR" no texto cru falha em "VAL0R A PA6AR" —
 * que foi exatamente o que apareceu no primeiro cupom de teste. Aqui os pares
 * confundiveis viram um simbolo so nos dois lados da comparacao.
 */
const PARES_CONFUNDIVEIS: Record<string, string> = {
  '0': 'O', 'O': 'O',
  '1': 'I', 'I': 'I', 'L': 'I',
  '5': 'S', 'S': 'S',
  '6': 'G', 'G': 'G',
  '8': 'B', 'B': 'B',
  '2': 'Z', 'Z': 'Z',
  '4': 'A', 'A': 'A',
}

function chaveDeAncora(t: string): string {
  return t.replace(/[015682O4ISGBZLA]/g, (c) => PARES_CONFUNDIVEIS[c] ?? c)
}

/** Abaixo disto não é despesa; acima, o OCR fundiu dois números. */
const VALOR_MINIMO = 0.01
const VALOR_MAXIMO = 100_000

/**
 * Um número em reais, na forma ESTRITA.
 *
 * ⚠️ Exige separador decimal seguido de **exatamente dois** dígitos. Um cupom
 * sempre imprime centavos; um "número" sem eles quase nunca é dinheiro — é a
 * contagem de itens, o número da nota, ou dois campos que se colaram.
 */
function interpretar(limpo: string): number | null {
  // Milhar com ponto, espaço ou nada; decimal com vírgula ou ponto, dois dígitos.
  const m = /(\d{1,3}(?:[.\s]\d{3})+|\d+)([,.])(\d{2})(?!\d)/.exec(limpo)
  if (!m) return null
  const [, inteiro, separador, centavos] = m

  // Vírgula é o separador decimal em pt-BR. Ponto só vale como decimal quando não
  // há vírgula nenhuma no candidato — senão "1.234,50" viraria 1.23.
  if (separador === '.' && limpo.includes(',')) return null

  const n = Number(`${inteiro.replace(/[.\s]/g, '')}.${centavos}`)
  return Number.isFinite(n) ? n : null
}

/**
 * Um token é candidato a valor quando tem dígito de verdade e nenhuma letra que
 * NÃO esteja no mapa de confusões.
 *
 * ⚠️ É esta guarda que impede o desastre silencioso: sem ela, "REFEICAO 35,00"
 * vira "REFE1C40 35,00" (I→1, A→4, O→0) e o parser lê **R$ 4.035,00** no lugar
 * de R$ 35,00. O mapa de confusões só pode tocar no candidato numérico, nunca no
 * texto inteiro — e esta função é o que faz essa regra valer de fato.
 */
function ehCandidatoNumerico(token: string): boolean {
  const t = token.replace(/^R\$/i, '')
  if (!/\d/.test(t)) return false
  return !/[^\d.,\sOoDQlIi|!SsBGbZzTgqA-]/.test(t)
}

export function valorBRLDeTexto(bruto: string): number | null {
  const texto = (bruto ?? '').replace(/R\$/gi, ' ')

  // 1º passo: só com dígitos de verdade. Cobre o caso normal e "1 234,50".
  const direto = interpretar(texto.replace(/[^\d.,\s]/g, ''))
  if (direto !== null) return direto

  // 2º passo: consertar confusões, token a token, e só onde é seguro.
  for (const token of texto.split(/\s+/)) {
    if (!ehCandidatoNumerico(token)) continue
    const v = interpretar(normalizarDigitosDeOcr(token).replace(/[^\d.,]/g, ''))
    if (v !== null) return v
  }
  return null
}

const dentroDaFaixa = (n: number) => n >= VALOR_MINIMO && n <= VALOR_MAXIMO

/**
 * Os rótulos que precedem o total, do mais confiável para o menos.
 *
 * "TOTAL" sozinho é o mais fraco de propósito: ele casa com meia dúzia de linhas
 * do cupom, e por isso é a última tentativa.
 */
const ANCORAS = [
  'VALOR A PAGAR',
  'VALOR TOTAL R$',
  'VALOR TOTAL',
  'TOTAL A PAGAR',
  'VALOR DA NOTA',
  'TOTAL R$',
  'TOTAL',
]

/**
 * ⚠️ **As anti-âncoras, e por que elas existem.**
 *
 * `TRIBUTOS` / `LEI 12.741` é de longe a resposta errada mais comum de um OCR em
 * cupom brasileiro: por lei essa linha é impressa logo abaixo do total, tem
 * formato idêntico, e no cupom de referência ela diz R$ 10,65 num total de
 * R$ 35,00 — um erro de 70% que passaria sem ninguém notar.
 *
 * `TOTAL DE ITENS` é a segunda: é uma CONTAGEM ("3"), e sem a exigência de
 * centavos viraria R$ 3,00.
 */
const ANTI_ANCORAS = [
  'TRIBUTO', 'LEI 12.741', 'LEI 12741', 'VALOR APROX', 'FONTE: IBPT', 'IBPT',
  'TOTAL DE ITENS', 'QTD TOTAL', 'QTDE TOTAL', 'ITENS',
  'TROCO', 'DINHEIRO', 'VALOR PAGO', 'VALOR RECEBIDO',
  'DESCONTO', 'ACRESCIMO', 'ACRESCIMOS', 'DESCONTOS',
  'FORMA DE PAGAMENTO', 'CARTAO', 'PIX',
]

const ehAntiAncora = (linha: string) =>
  ANTI_ANCORAS.some((a) => chaveDeAncora(linha).includes(chaveDeAncora(a)))

/**
 * Acha o total do cupom nas linhas do OCR.
 *
 * A busca é: para cada âncora, na ordem de confiança, procurar um número **na
 * mesma linha** à direita dela e, se não houver, **na linha seguinte**. Só depois
 * de esgotar todas as âncoras é que o recurso do maior valor entra — e ele chega
 * na tela com confiança `baixa` e o campo SUGERIDO, não preenchido.
 */
export function acharValorTotal(linhas: string[]): ValorProposto {
  const normalizadas = linhas.map(normalizar)

  for (const ancora of ANCORAS) {
    for (let i = 0; i < normalizadas.length; i++) {
      const linha = normalizadas[i]
      const pos = chaveDeAncora(linha).indexOf(chaveDeAncora(ancora))
      if (pos === -1) continue
      if (ehAntiAncora(linha)) continue

      // Mesma linha, à direita do rótulo.
      const depois = linha.slice(pos + ancora.length)
      const naMesma = valorBRLDeTexto(depois)
      if (naMesma !== null && dentroDaFaixa(naMesma)) {
        return { valor: naMesma, bruto: linhas[i].trim(), ancora, confianca: 'media', avisos: [] }
      }
      if (naMesma !== null) {
        return {
          valor: null, bruto: linhas[i].trim(), ancora, confianca: 'nao-li',
          avisos: [`Li "${naMesma.toLocaleString('pt-BR')}" depois de "${ancora}", que é alto demais para um cupom — provavelmente dois números se juntaram.`],
        }
      }

      // Linha seguinte, quando o rótulo ficou sozinho.
      const seguinte = normalizadas[i + 1]
      if (seguinte && !ehAntiAncora(seguinte)) {
        const abaixo = valorBRLDeTexto(seguinte)
        if (abaixo !== null && dentroDaFaixa(abaixo)) {
          return { valor: abaixo, bruto: linhas[i + 1].trim(), ancora, confianca: 'media', avisos: [] }
        }
      }
    }
  }

  // ── Recurso: o maior valor com centavos do cupom ──────────────────────────
  // Costuma acertar, e por isso existe; mas chega rotulado como o palpite que é.
  let melhor: { valor: number; bruto: string } | null = null
  for (let i = 0; i < normalizadas.length; i++) {
    if (ehAntiAncora(normalizadas[i])) continue
    const v = valorBRLDeTexto(normalizadas[i])
    if (v === null || !dentroDaFaixa(v)) continue
    if (!melhor || v > melhor.valor) melhor = { valor: v, bruto: linhas[i].trim() }
  }
  if (melhor) {
    return {
      valor: melhor.valor, bruto: melhor.bruto, ancora: null, confianca: 'baixa',
      avisos: ['Não achei o rótulo do total. Este é o maior valor com centavos do cupom — confira.'],
    }
  }

  return {
    valor: null, bruto: '', ancora: null, confianca: 'nao-li',
    avisos: ['Não consegui ler nenhum valor nesta foto. Digite o valor.'],
  }
}

/**
 * Os itens, quando dá.
 *
 * ⚠️ **O total NUNCA é derivado dos itens.** Se a soma discordar, quem vale é o
 * total: é ele que vai para a DRE. A lista de itens serve para conferir e para o
 * painel, e é marcada "conferir" quando não fecha.
 */
export function acharItens(linhas: string[]): ItemLidoDoCupom[] {
  const itens: ItemLidoDoCupom[] = []
  for (const linha of linhas) {
    const norm = normalizar(linha)
    if (!norm || ehAntiAncora(norm)) continue
    if (ANCORAS.some((a) => chaveDeAncora(norm).includes(chaveDeAncora(a)))) continue
    const valor = valorBRLDeTexto(norm)
    if (valor === null || !dentroDaFaixa(valor)) continue
    // A descrição é o que vem antes do primeiro dígito da linha.
    const descricao = linha.replace(/\s+/g, ' ').trim().split(/\s+\d/)[0].trim()
    if (descricao.length < 2) continue
    itens.push({ descricao, valor, bruto: linha.trim() })
  }
  return itens
}

/** Confere a proposta contra ela mesma: soma dos itens ≈ total. */
export function conferirSomaDosItens(
  total: number | null,
  itens: ItemLidoDoCupom[],
): { bate: boolean; soma: number } | null {
  if (total === null || itens.length === 0) return null
  const soma = itens.reduce((s, i) => s + i.valor, 0)
  return { bate: Math.abs(soma - total) <= 0.02, soma: Math.round(soma * 100) / 100 }
}

/** A data de emissão impressa, quando aparece. A chave sempre manda sobre ela. */
export function acharDataEmissao(linhas: string[]): string | null {
  for (const linha of linhas) {
    const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(linha)
    if (!m) continue
    const [, d, mes, ano] = m
    const dia = Number(d), mm = Number(mes)
    if (dia < 1 || dia > 31 || mm < 1 || mm > 12) continue
    return `${ano}-${mes}-${d}`
  }
  return null
}

/** Os tributos da Lei 12.741 — o número que ninguém olha e todo cupom imprime. */
export function acharTributos(linhas: string[]): number | null {
  for (const linha of linhas) {
    const norm = normalizar(linha)
    if (!norm.includes('TRIBUTO')) continue
    const v = valorBRLDeTexto(norm)
    if (v !== null && dentroDaFaixa(v)) return v
  }
  return null
}
