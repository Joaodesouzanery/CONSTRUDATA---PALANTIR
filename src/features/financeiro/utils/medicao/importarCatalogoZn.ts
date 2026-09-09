/**
 * Lê a planilha de medição do contrato e monta o catálogo.
 *
 * ─── ESCRITO CONTRA O ARQUIVO REAL ────────────────────────────────────────────
 * `Base_Medicao_60pct_ZN.xlsx`, 7 abas. Tudo que este arquivo assume foi MEDIDO nele, não
 * suposto — e o que foi medido está anotado no lugar em que a regra mora. Duas coisas que um
 * parser escrito "pela descrição" teria errado:
 *
 *  - o fator está em **I2**, não em H2. H2 é o rótulo ("FATOR:"), I2 é o valor — e a nota 1 da
 *    própria planilha diz "célula H2", ou seja, o documento está errado sobre si mesmo. Por isso
 *    se procura o RÓTULO e se lê a primeira célula não vazia à direita, como `acharPremissa` já
 *    faz no FCP;
 *  - o nome da aba é `'BASE MEDIÇÃO  '`, com dois espaços no fim. Casar por igualdade não acha.
 *
 * ─── O QUE ESTE ARQUIVO NÃO DECIDE ────────────────────────────────────────────
 * ⚠️ Ele não conserta a planilha. Duas divergências reais foram medidas no arquivo e viram
 * AVISO, nunca correção automática:
 *
 *  1. **A coluna de Sakura nunca é faturada.** Todas as 284 linhas calculam
 *     `ROUND(H × F, 2)` — só Boi Malhado. Sakura tem quantidade lançada em 2 linhas,
 *     R$ 245.850,00, que não entram no total de R$ 3.264.706,87. Pode ser esquecimento da
 *     fórmula ou decisão de não faturar ainda; quem responde é quem fecha a medição.
 *  2. **Uma linha tem quantidade e valor zero** pelo mesmo motivo (a célula de Boi Malhado
 *     está vazia).
 */
import type {
  CatalogoDoContrato, FlagDoServico, PrecoRegional, RegiaoDoContrato, ServicoDoCatalogo,
} from '@/types'
import type { Celula, Matriz } from '../controleDeCaixaPlanilha'
import { normalizarTexto, lerValor } from '../controleDeCaixaPlanilha'
import { idsDoCatalogo } from './catalogoContrato'

export type AbasDaMedicao = Record<string, Matriz>

const texto = (c: Celula): string => (c == null ? '' : String(c).replace(/\s+/g, ' ').trim())
const numero = (c: Celula): number | null => {
  if (typeof c === 'number' && Number.isFinite(c)) return c
  const v = lerValor(c)
  return v == null || !Number.isFinite(v) ? null : v
}

/** Acha a aba pelo começo do nome normalizado. ⚠️ `'BASE MEDIÇÃO  '` tem espaços no fim. */
export function acharAba(abas: AbasDaMedicao, prefixo: string): Matriz | undefined {
  const alvo = normalizarTexto(prefixo)
  const nome = Object.keys(abas).find((n) => normalizarTexto(n).startsWith(alvo))
  return nome ? abas[nome] : undefined
}

/**
 * O valor de um rótulo: primeira célula não vazia à direita dele.
 * Vale para o FATOR e evita depender da coluna, que a própria planilha documenta errado.
 */
export function valorDoRotulo(m: Matriz, rotulo: string, ateLinha = 12): Celula | null {
  const alvo = normalizarTexto(rotulo)
  for (let i = 0; i < Math.min(m.length, ateLinha); i++) {
    const linha = m[i] ?? []
    for (let c = 0; c < linha.length; c++) {
      if (!normalizarTexto(linha[c]).startsWith(alvo)) continue
      for (let d = c + 1; d < linha.length; d++) if (linha[d] != null && texto(linha[d]) !== '') return linha[d]
    }
  }
  return null
}

/** `'01-Pirituba'` → `{ codigo: '01', nome: 'Pirituba' }`. Sem hífen, o próprio texto vira nome. */
function lerRegiao(cabecalho: string): RegiaoDoContrato | null {
  const t = texto(cabecalho)
  if (!t) return null
  const m = /^(\d{1,2})\s*[-–—]\s*(.+)$/.exec(t)
  if (m) return { codigo: m[1].padStart(2, '0'), nome: m[2].trim() }
  return null
}

/** A célula de código vazia ou com travessão significa "não existe nesta região". */
const semCodigo = (c: Celula): boolean => {
  const t = texto(c)
  return t === '' || /^[-–—]+$/.test(t)
}

interface CabecalhoDeCodigos { linha: number; colDescricao: number; colUn: number; colPreco: number; regioes: Array<{ col: number; regiao: RegiaoDoContrato }> }

/** Acha o cabeçalho da aba CÓDIGOS POR REGIÃO e as colunas de região. */
function cabecalhoDeCodigos(m: Matriz): CabecalhoDeCodigos | null {
  for (let i = 0; i < Math.min(m.length, 12); i++) {
    const linha = m[i] ?? []
    const idx = (alvo: string) => linha.findIndex((c) => normalizarTexto(c).startsWith(alvo))
    const colDescricao = idx('DESCRICAO')
    const colUn = idx('UN')
    const colPreco = linha.findIndex((c) => normalizarTexto(c).startsWith('PRECO'))
    if (colDescricao < 0 || colUn < 0 || colPreco < 0) continue
    const regioes: Array<{ col: number; regiao: RegiaoDoContrato }> = []
    for (let c = colPreco + 1; c < linha.length; c++) {
      const r = lerRegiao(texto(linha[c]))
      if (r) regioes.push({ col: c, regiao: r })
    }
    if (regioes.length > 0) return { linha: i, colDescricao, colUn, colPreco, regioes }
  }
  return null
}

/** Linha de seção da BASE: só o rótulo preenchido, sem código nem preço. */
function ehSecao(linha: Celula[]): boolean {
  return texto(linha[0]) !== '' && texto(linha[1]) === '' && numero(linha[4]) == null
}

export type ParteDoContrato = 'contrato' | 'apostilamento'

interface DaBase { categoria?: string; parte: ParteDoContrato; codigoBase?: string }

/**
 * Percorre a BASE MEDIÇÃO guardando categoria (a última seção vista) e parte (contrato até o
 * `SUBTOTAL – CONTRATO`, apostilamento depois). A chave é `descrição|unidade#ocorrência`, como
 * em `chaveDeConteudo` — descrição repetida é fato conhecido nesta planilha.
 */
function lerBase(m: Matriz | undefined): { porChave: Map<string, DaBase>; subtotais: Record<ParteDoContrato, number | null>; total: number | null } {
  const porChave = new Map<string, DaBase>()
  const subtotais: Record<ParteDoContrato, number | null> = { contrato: null, apostilamento: null }
  let total: number | null = null
  if (!m) return { porChave, subtotais, total }

  let categoria: string | undefined
  let parte: ParteDoContrato = 'contrato'
  const vistos = new Map<string, number>()

  for (const linha of m) {
    if (!linha) continue
    const rotulo = normalizarTexto(linha[0])
    if (ehSecao(linha)) {
      if (rotulo.startsWith('SUBTOTAL')) {
        const v = numero(linha[linha.length - 1]) ?? numero(linha[8])
        if (rotulo.includes('APOSTILAMENTO')) subtotais.apostilamento = v
        else if (rotulo.includes('CONTRATO')) { subtotais.contrato = v; parte = 'apostilamento' }
        continue
      }
      if (rotulo.startsWith('VALOR TOTAL')) { total = numero(linha[linha.length - 1]) ?? numero(linha[8]); continue }
      if (rotulo.startsWith('PARTE')) { if (/2/.test(rotulo)) parte = 'apostilamento'; continue }
      if (rotulo.startsWith('BASE DE MEDICAO')) continue
      categoria = texto(linha[0])
      continue
    }
    const descricao = texto(linha[2])
    const unidade = texto(linha[3])
    if (!descricao || numero(linha[4]) == null) continue
    const base = `${normalizarTexto(descricao)}|${normalizarTexto(unidade)}`
    const n = vistos.get(base) ?? 0
    vistos.set(base, n + 1)
    porChave.set(`${base}#${n}`, { categoria, parte, codigoBase: texto(linha[1]) })
  }
  return { porChave, subtotais, total }
}

// ─── Quantidades medidas, por obra ────────────────────────────────────────────

export interface QuantidadeMedida {
  servicoCatalogoId: string
  /** A obra como o cabeçalho da planilha a nomeia ('SAKURA', 'BOI MALHADO'). */
  obra: string
  quantidade: number
}

export interface LeituraDasQuantidades {
  quantidades: QuantidadeMedida[]
  /** As obras encontradas nas colunas "QTD. MEDIDA <OBRA>", na ordem. */
  obras: string[]
  problemas: string[]
  /** O que a planilha declara na coluna VALOR MEDIÇÃO, por obra — para conferir contra o motor. */
  valorDeclarado: number
}

/**
 * Lê as quantidades medidas da BASE MEDIÇÃO.
 *
 * As obras são descobertas pelo CABEÇALHO (`QTD. MEDIDA SAKURA`, `QTD. MEDIDA BOI MALHADO`) —
 * não são lista fixa no código, senão uma obra nova exigiria recompilar.
 *
 * ⚠️ O casamento com o catálogo usa `descrição|unidade#ocorrência`, a mesma chave da categoria.
 * Medido no arquivo real: casa 284 de 284.
 */
export function lerQuantidadesZn(abas: AbasDaMedicao, catalogo: CatalogoDoContrato): LeituraDasQuantidades {
  const problemas: string[] = []
  const base = acharAba(abas, 'BASE MEDICAO')
  if (!base) return { quantidades: [], obras: [], problemas: ['Não achei a aba "BASE MEDIÇÃO" — sem ela não há quantidade.'], valorDeclarado: 0 }

  // Cabeçalho: a linha que tem DESCRIÇÃO DO SERVIÇO. As colunas "QTD. MEDIDA X" vêm depois.
  let iCab = -1
  for (let i = 0; i < Math.min(base.length, 12); i++) {
    if ((base[i] ?? []).some((c) => normalizarTexto(c).startsWith('DESCRICAO DO SERVICO'))) { iCab = i; break }
  }
  if (iCab < 0) return { quantidades: [], obras: [], problemas: ['Não achei o cabeçalho da BASE MEDIÇÃO.'], valorDeclarado: 0 }

  const colunasDeObra: Array<{ col: number; obra: string }> = []
  let colValor = -1
  ;(base[iCab] ?? []).forEach((c, col) => {
    const t = normalizarTexto(c)
    if (t.startsWith('QTD. MEDIDA') || t.startsWith('QTD MEDIDA')) {
      colunasDeObra.push({ col, obra: texto(c).replace(/^QTD\.?\s*MEDIDA\s*/i, '').trim() })
    } else if (t.startsWith('VALOR MEDICAO')) colValor = col
  })
  if (colunasDeObra.length === 0) problemas.push('Nenhuma coluna "QTD. MEDIDA <obra>" na BASE MEDIÇÃO.')

  // O catálogo, indexado pela mesma chave que o casou com a BASE.
  const porChave = new Map<string, string>()
  const vistosCat = new Map<string, number>()
  for (const sv of catalogo.servicos) {
    const b = `${normalizarTexto(sv.descricao)}|${normalizarTexto(sv.unidade)}`
    const n = vistosCat.get(b) ?? 0
    vistosCat.set(b, n + 1)
    porChave.set(`${b}#${n}`, sv.id)
  }

  const quantidades: QuantidadeMedida[] = []
  const vistos = new Map<string, number>()
  let valorDeclarado = 0
  let semCasar = 0

  for (const linha of base) {
    if (!linha || ehSecao(linha)) continue
    const descricao = texto(linha[2])
    const unidade = texto(linha[3])
    if (!descricao || numero(linha[4]) == null) continue
    const b = `${normalizarTexto(descricao)}|${normalizarTexto(unidade)}`
    const n = vistos.get(b) ?? 0
    vistos.set(b, n + 1)
    const id = porChave.get(`${b}#${n}`)
    if (colValor >= 0) valorDeclarado += numero(linha[colValor]) ?? 0
    if (!id) { semCasar++; continue }
    for (const { col, obra } of colunasDeObra) {
      const q = numero(linha[col])
      if (q == null || q === 0) continue     // ⚠️ vazio e zero não são medição
      quantidades.push({ servicoCatalogoId: id, obra, quantidade: q })
    }
  }
  if (semCasar > 0) problemas.push(`${semCasar} linha(s) da BASE não casaram com nenhum serviço do catálogo.`)

  return { quantidades, obras: colunasDeObra.map((c) => c.obra), problemas, valorDeclarado: Math.round(valorDeclarado * 100) / 100 }
}

interface Divergencia { codigo: string; descricao: string; unidade: string; precoProprio: number | null; precoDemais: number | null }

/** Lê uma das tabelas de divergência da aba NOTAS. `tituloComeca` casa "TABELA A" / "TABELA B". */
function lerTabelaDeDivergencia(m: Matriz | undefined, tituloComeca: string): Divergencia[] {
  if (!m) return []
  const inicio = m.findIndex((l) => normalizarTexto(l?.[0]).startsWith(normalizarTexto(tituloComeca)))
  if (inicio < 0) return []
  const out: Divergencia[] = []
  // +2: a linha seguinte ao título é o cabeçalho de colunas.
  for (let i = inicio + 2; i < m.length; i++) {
    const linha = m[i] ?? []
    const codigo = texto(linha[0])
    if (!codigo) break                       // linha vazia encerra a tabela
    if (normalizarTexto(codigo).startsWith('TABELA')) break
    if (!/^\d/.test(codigo)) continue
    out.push({
      codigo,
      descricao: texto(linha[1]),
      unidade: texto(linha[2]),
      precoProprio: numero(linha[3]),
      // Na Tabela A a coluna 4 é o preço 60% e a 5 o das demais; na B a 4 já é o das demais.
      precoDemais: numero(linha[5]) ?? numero(linha[4]),
    })
  }
  return out
}

export interface ResumoDoCatalogo {
  servicos: number
  porParte: Record<ParteDoContrato, number>
  porFlag: Record<string, number>
  regioes: number
  /** O que a planilha DECLARA no rodapé — para a conferência bater contra o que o motor soma. */
  subtotaisDeclarados: Record<ParteDoContrato, number | null>
  totalDeclarado: number | null
}

export interface LeituraDoCatalogo {
  catalogo: CatalogoDoContrato
  /** ⚠️ Nunca vazio por descarte silencioso: o que não deu para ler aparece aqui. */
  problemas: string[]
  resumo: ResumoDoCatalogo
}

export interface OpcoesDaLeitura {
  numeroContrato?: string
  orgId?: string | null
  consorcio?: string
}

/**
 * Monta o catálogo a partir das abas.
 *
 * A espinha é a aba CÓDIGOS POR REGIÃO — é a única que tem o código de cada serviço em cada
 * região. A BASE MEDIÇÃO entra para dar categoria e separar contrato de apostilamento; as duas
 * tabelas da aba NOTAS entram para marcar as exceções.
 */
export function lerCatalogoZn(abas: AbasDaMedicao, opcoes: OpcoesDaLeitura = {}): LeituraDoCatalogo {
  const problemas: string[] = []
  const base = acharAba(abas, 'BASE MEDICAO')
  const codigos = acharAba(abas, 'CODIGOS POR REGIAO')
  const notas = acharAba(abas, 'NOTAS E DIVERGENCIAS')

  if (!base) problemas.push('Não achei a aba "BASE MEDIÇÃO" — sem ela, os serviços ficam sem categoria.')
  if (!notas) problemas.push('Não achei a aba "NOTAS E DIVERGÊNCIAS" — as exceções de preço não serão marcadas.')

  const fatorLido = numero(base ? valorDoRotulo(base, 'FATOR') : null)
  const fatorPadrao = fatorLido != null && fatorLido > 0 && fatorLido <= 1 ? fatorLido : 0.6
  if (fatorLido == null) problemas.push('Não achei o fator de repasse na BASE MEDIÇÃO; assumindo 60%. Confira antes de medir.')

  const cab = codigos ? cabecalhoDeCodigos(codigos) : null
  if (!cab) {
    problemas.push('Não achei o cabeçalho da aba "CÓDIGOS POR REGIÃO" (esperava DESCRIÇÃO, UN, PREÇO e as colunas de região).')
    return {
      catalogo: { numeroContrato: opcoes.numeroContrato ?? '', fatorPadrao, regioes: [], servicos: [] },
      problemas,
      resumo: { servicos: 0, porParte: { contrato: 0, apostilamento: 0 }, porFlag: {}, regioes: 0, subtotaisDeclarados: { contrato: null, apostilamento: null }, totalDeclarado: null },
    }
  }

  const daBase = lerBase(base)
  const tabelaA = lerTabelaDeDivergencia(notas, 'TABELA A')
  const tabelaB = lerTabelaDeDivergencia(notas, 'TABELA B')
  const porCodigoA = new Map(tabelaA.map((d) => [d.codigo, d]))
  const codigosB = new Set(tabelaB.map((d) => d.codigo))

  // ── 1ª passada: as linhas cruas ────────────────────────────────────────────
  const crus: Array<{ descricao: string; unidade: string; precoZn: number; porRegiao: Record<string, PrecoRegional> }> = []
  for (let i = cab.linha + 1; i < codigos!.length; i++) {
    const linha = codigos![i] ?? []
    const descricao = texto(linha[cab.colDescricao])
    const precoZn = numero(linha[cab.colPreco])
    if (!descricao || precoZn == null) continue
    const porRegiao: Record<string, PrecoRegional> = {}
    for (const { col, regiao } of cab.regioes) {
      const codigo = texto(linha[col])
      if (semCodigo(codigo)) continue
      const divergente = porCodigoA.get(codigo)
      porRegiao[regiao.codigo] = divergente?.precoProprio != null
        ? { codigo, precoOverride: divergente.precoProprio }
        : { codigo }
    }
    crus.push({ descricao, unidade: texto(linha[cab.colUn]), precoZn, porRegiao })
  }

  // ── Descrição repetida com preço diferente: a planilha avisa que o SAP trunca em 40 ───
  const precosPorTexto = new Map<string, Set<number>>()
  for (const c of crus) {
    const k = `${normalizarTexto(c.descricao)}|${normalizarTexto(c.unidade)}`
    if (!precosPorTexto.has(k)) precosPorTexto.set(k, new Set())
    precosPorTexto.get(k)!.add(Math.round(c.precoZn * 100))
  }

  // ── 2ª passada: ids estáveis e as flags ────────────────────────────────────
  const ids = idsDoCatalogo(opcoes.orgId, opcoes.numeroContrato ?? '', crus)
  const ocorrencia = new Map<string, number>()
  const porParte: Record<ParteDoContrato, number> = { contrato: 0, apostilamento: 0 }
  const porFlag: Record<string, number> = {}

  const servicos: ServicoDoCatalogo[] = crus.map((c, i) => {
    const chaveTexto = `${normalizarTexto(c.descricao)}|${normalizarTexto(c.unidade)}`
    const n = ocorrencia.get(chaveTexto) ?? 0
    ocorrencia.set(chaveTexto, n + 1)
    const info = daBase.porChave.get(`${chaveTexto}#${n}`)
    const parte = info?.parte ?? 'contrato'
    porParte[parte]++

    const temBlocoDeslocado = Object.values(c.porRegiao).some((p) => codigosB.has(p.codigo))
    const temPrecoProprio = Object.values(c.porRegiao).some((p) => p.precoOverride != null)
    const textoAmbiguo = (precosPorTexto.get(chaveTexto)?.size ?? 0) > 1

    let flag: FlagDoServico = 'ok'
    let motivoFlag: string | undefined
    // ⚠️ A ordem é a da gravidade. O bloco deslocado é erro de LEITURA do PDF — o preço pode
    // estar simplesmente errado — então ele manda sobre os outros dois.
    if (temBlocoDeslocado) {
      flag = 'bloco_deslocado_pdf'
      motivoFlag = 'O bloco desta região veio com numeração e descrição deslocadas no PDF do apostilamento. Confira com a fiscalização antes de medir.'
    } else if (textoAmbiguo) {
      flag = 'descricao_truncada_ambigua'
      motivoFlag = 'A descrição vem truncada em 40 caracteres pelo SAP e aparece com mais de um preço — podem ser serviços diferentes com o mesmo texto.'
    } else if (temPrecoProprio) {
      flag = 'preco_regional_divergente'
      motivoFlag = 'Uma região tem preço próprio para este item, diferente das demais. Confirme qual usar.'
    }
    if (flag !== 'ok') porFlag[flag] = (porFlag[flag] ?? 0) + 1

    return {
      id: ids[i],
      descricao: c.descricao,
      unidade: c.unidade,
      precoZn: c.precoZn,
      categoria: info?.categoria,
      // ⚠️ `null` de propósito: a quantidade contratada vem da planilha de balanceamento, que não
      // faz parte deste arquivo. Zero seria uma afirmação que ninguém fez.
      qtdContratada: null,
      flag,
      motivoFlag,
      // Só o bloco deslocado BARRA a medição: ali o preço pode estar errado. Preço regional
      // próprio e descrição ambígua são avisos — o valor em si não está em dúvida.
      bloqueadoParaMedicao: flag === 'bloco_deslocado_pdf',
      porRegiao: c.porRegiao,
    }
  })

  if (servicos.length === 0) problemas.push('A aba "CÓDIGOS POR REGIÃO" não trouxe nenhum serviço legível.')

  return {
    catalogo: {
      numeroContrato: opcoes.numeroContrato ?? '',
      consorcio: opcoes.consorcio,
      fatorPadrao,
      regioes: cab.regioes.map((r) => r.regiao),
      servicos,
    },
    problemas,
    resumo: {
      servicos: servicos.length,
      porParte,
      porFlag,
      regioes: cab.regioes.length,
      subtotaisDeclarados: daBase.subtotais,
      totalDeclarado: daBase.total,
    },
  }
}
