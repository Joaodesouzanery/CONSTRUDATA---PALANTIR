/**
 * Importar a composição do contrato — de uma planilha ou colando do Excel.
 *
 * ─── POR QUE NÃO O `ImportModal` GENÉRICO ─────────────────────────────────────
 * Ele casa cabeçalho por igualdade exata contra uma lista de apelidos e **não tem tela de
 * mapeamento**: ou os nomes batem, ou o arquivo inteiro é rejeitado. Pior, o config de orçamento
 * exige as colunas "Código" e "Categoria", que a proposta do cliente não tem — nenhuma linha
 * entraria. A máquina certa é a do Suprimentos (`parseExcelEstoque.ts`), que pontua o cabeçalho e
 * deixa o usuário corrigir o que ficou errado. É ela que este módulo reaproveita.
 *
 * ─── O FORMATO REAL ───────────────────────────────────────────────────────────
 * A proposta Compizzo/Concrecor tem ITEM · DESCRIÇÃO · UN · QTD · Mão de obra · TOTAL, 20 linhas,
 * fechando R$ 183.624,55 de mão de obra + R$ 180.030,00 de material = R$ 363.654,55. Tem linha em
 * `vb` (Frete Previsto, qtd 1,00) e em `un` (lombadas). O contrato da SUPERA é o outro extremo:
 * 4 linhas só de mão de obra e uma de material.
 *
 * Ler tabela de dentro de PDF ficou de fora de propósito: o texto sai embaralhado e o resultado
 * erra número sem avisar, que é o pior tipo de erro num contrato.
 */
import { parseLocaleNumber } from '@/lib/numberFormat'
import { classificarUnidade, ROTULO_UNIDADE, UNIDADE_VERBA } from '@/lib/unidadesMedida'
import type { ObraContratoServico, ObraItemCategoria } from '@/types'

/** Campos que uma coluna da planilha pode alimentar. */
export type CampoComposicao =
  | 'ignorar' | 'ordem' | 'descricao' | 'unidade' | 'qtdContrato'
  | 'valorUnitario' | 'valorMaterialUnit' | 'total' | 'categoria'

export const ROTULO_CAMPO: Record<CampoComposicao, string> = {
  ignorar:           '— ignorar —',
  ordem:             'Item (nº)',
  descricao:         'Descrição',
  unidade:           'Unidade',
  qtdContrato:       'Quantidade',
  valorUnitario:     'Preço de mão de obra',
  valorMaterialUnit: 'Preço de material',
  total:             'Total da linha',
  categoria:         'Categoria',
}

/**
 * Dicas por campo, na mesma lógica de pontuação do `autoSuggestField` do Suprimentos.
 * Sem acento e em minúscula — a normalização tira os dois.
 */
const DICAS: Record<Exclude<CampoComposicao, 'ignorar'>, string[]> = {
  ordem:             ['item', 'no', 'n', 'ordem', 'seq', 'sequencia'],
  descricao:         ['descricao', 'servico', 'discriminacao', 'especificacao', 'atividade'],
  unidade:           ['un', 'und', 'unid', 'unidade', 'medida'],
  qtdContrato:       ['qtd', 'quant', 'quantidade', 'qtde', 'metragem', 'area'],
  valorUnitario:     ['mao de obra', 'mao-de-obra', 'maodeobra', 'mo', 'servico unitario',
                      'preco unitario', 'valor unitario', 'unitario', 'preco'],
  valorMaterialUnit: ['material', 'materiais', 'insumo', 'insumos', 'material unitario'],
  total:             ['total', 'valor total', 'subtotal', 'montante'],
  categoria:         ['categoria', 'tipo', 'natureza', 'grupo'],
}

function normalizar(s: string): string {
  return s.normalize('NFD')
    // Escapado, e não literal: os sinais combinantes são invisíveis no editor e já foram
    // corrompidos duas vezes neste projeto (diffEstoque.ts, modeloCompizzo.ts).
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** A dica aparece delimitada por não-alfanumérico? Evita "mo" casar dentro de "montante". */
function contemPalavraInteira(texto: string, dica: string): boolean {
  const escapada = dica.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escapada}([^a-z0-9]|$)`, 'i').test(texto)
}

/**
 * Adivinha para qual campo um cabeçalho aponta.
 *
 * Mesma escada de pontuação do Suprimentos — igualdade exata ganha de palavra inteira, que ganha
 * de "a dica contém o cabeçalho" — e o empate é desfeito pelo tamanho da dica. É isso que faz
 * "Preço de material" ir para `valorMaterialUnit` em vez de `valorUnitario`, e "Mão de obra"
 * ir para `valorUnitario` em vez de casar com "obra" em outro lugar.
 */
export function sugerirCampo(cabecalho: string): CampoComposicao {
  const n = normalizar(cabecalho)
  if (!n) return 'ignorar'
  let melhor: CampoComposicao = 'ignorar'
  let nota = 0
  for (const [campo, dicas] of Object.entries(DICAS) as [Exclude<CampoComposicao, 'ignorar'>, string[]][]) {
    for (const d of dicas) {
      let n2 = 0
      if (n === d) n2 = 1000 + d.length
      else if (contemPalavraInteira(n, d)) n2 = 100 + d.length
      else if (d.includes(n)) n2 = 50 + n.length
      if (n2 > nota) { nota = n2; melhor = campo }
    }
  }
  return melhor
}

export interface ConflitoDeColuna { campo: CampoComposicao; cabecalhos: string[] }

/** Duas colunas apontando para o mesmo campo — o usuário precisa desempatar. */
export function detectarConflitos(mapa: Record<string, CampoComposicao>): ConflitoDeColuna[] {
  const porCampo = new Map<CampoComposicao, string[]>()
  for (const [cab, campo] of Object.entries(mapa)) {
    if (campo === 'ignorar') continue
    porCampo.set(campo, [...(porCampo.get(campo) ?? []), cab])
  }
  return [...porCampo.entries()]
    .filter(([, cabs]) => cabs.length > 1)
    .map(([campo, cabecalhos]) => ({ campo, cabecalhos }))
}

export interface TabelaColada { headers: string[]; rows: Record<string, string>[] }

/**
 * Lê uma tabela colada do Excel (TSV — é o que o Excel põe na área de transferência).
 *
 * Não existia nada disso no projeto: zero `onPaste`, zero `clipboardData`, zero `split('\t')`.
 * Aceita também CSV com `;`, que é o que o Excel em português salva.
 */
export function lerTabelaColada(texto: string): TabelaColada {
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '')
  if (linhas.length === 0) return { headers: [], rows: [] }

  // Escolhe o separador pelo que mais aparece na primeira linha.
  const sep = (linhas[0].match(/\t/g)?.length ?? 0) >= (linhas[0].match(/;/g)?.length ?? 0) ? '\t' : ';'
  const partir = (l: string) => l.split(sep).map((c) => c.trim())

  const brutos = partir(linhas[0])
  // Cabeçalho vazio recebe um nome, senão duas colunas sem título viraram a mesma chave.
  const headers = brutos.map((h, i) => h || `coluna ${i + 1}`)
  const rows = linhas.slice(1).map((l) => {
    const cels = partir(l)
    return Object.fromEntries(headers.map((h, i) => [h, cels[i] ?? '']))
  })
  return { headers, rows }
}

function categoriaDeTexto(v: string): ObraItemCategoria | undefined {
  const n = normalizar(v)
  if (!n) return undefined
  if (/material|insumo/.test(n)) return 'material'
  if (/frete|transporte/.test(n)) return 'frete'
  if (/equipa|maquina|locacao/.test(n)) return 'equipamento'
  if (/servico|mao de obra|execucao/.test(n)) return 'servico'
  return undefined
}

/** Normaliza o texto da unidade para o vocabulário do sistema. */
function unidadeDeTexto(v: string): string {
  const bruto = (v ?? '').trim()
  if (!bruto) return 'm²'
  const tipo = classificarUnidade(bruto)
  if (tipo === 'verba') return UNIDADE_VERBA
  if (tipo === 'outra') return bruto.toLowerCase()   // 'un', 'kg', 'h'… preserva o que veio
  return ROTULO_UNIDADE[tipo]                        // 'm²' | 'm' canônicos
}

export interface LinhaImportada extends Omit<ObraContratoServico, 'id'> {
  /** Aviso para a tela de conferência — não impede importar. */
  aviso?: string
}

/**
 * Converte as linhas cruas em itens do contrato.
 *
 * A coluna TOTAL, quando mapeada, **não é gravada** — ela serve de conferência: se
 * `qtd × preços` não bater com o total declarado da linha, a linha entra com um aviso. É o mesmo
 * princípio do selo de conferência do contrato: o que está escrito manda, e a diferença aparece.
 *
 * Linha sem descrição é descartada em silêncio: planilha real tem linha de subtotal e linha em
 * branco no meio, e elas não são itens.
 */
export function aplicarMapeamento(
  rows: Record<string, string>[],
  mapa: Record<string, CampoComposicao>,
): LinhaImportada[] {
  const colunaDe = (campo: CampoComposicao): string | undefined =>
    Object.entries(mapa).find(([, c]) => c === campo)?.[0]

  const cDesc  = colunaDe('descricao')
  const cOrdem = colunaDe('ordem')
  const cUn    = colunaDe('unidade')
  const cQtd   = colunaDe('qtdContrato')
  const cMo    = colunaDe('valorUnitario')
  const cMat   = colunaDe('valorMaterialUnit')
  const cTotal = colunaDe('total')
  const cCat   = colunaDe('categoria')

  const out: LinhaImportada[] = []
  rows.forEach((r, i) => {
    const descricao = (cDesc ? r[cDesc] : '').trim()
    if (!descricao) return

    const unidade = unidadeDeTexto(cUn ? r[cUn] : '')
    const ehVb = unidade === UNIDADE_VERBA
    // Verba não tem metragem: a quantidade fica em 1 para `qtd × preço` devolver o valor fechado.
    const qtdContrato = ehVb ? 1 : (cQtd ? parseLocaleNumber(r[cQtd]) : 0) || 0
    const valorUnitario     = (cMo  ? parseLocaleNumber(r[cMo])  : 0) || 0
    const valorMaterialUnit = (cMat ? parseLocaleNumber(r[cMat]) : 0) || 0
    const categoria = cCat ? categoriaDeTexto(r[cCat]) : undefined

    let aviso: string | undefined
    if (cTotal) {
      const declarado = parseLocaleNumber(r[cTotal]) || 0
      const calculado = qtdContrato * (valorUnitario + valorMaterialUnit)
      // 1 centavo por linha é arredondamento de planilha, não erro de digitação.
      if (declarado > 0 && Math.abs(declarado - calculado) > 0.01) {
        aviso = `o total da planilha diz ${declarado.toFixed(2)} e a conta dá ${calculado.toFixed(2)}`
      }
    }

    out.push({
      descricao,
      unidade,
      qtdContrato,
      valorUnitario,
      ...(valorMaterialUnit > 0 ? { valorMaterialUnit } : {}),
      ordem: (cOrdem ? parseLocaleNumber(r[cOrdem]) : 0) || i + 1,
      ...(categoria ? { categoria } : {}),
      ...(aviso ? { aviso } : {}),
    })
  })
  return out
}

/** Mapeamento inicial sugerido para um conjunto de cabeçalhos. */
export function mapearAutomatico(headers: string[]): Record<string, CampoComposicao> {
  return Object.fromEntries(headers.map((h) => [h, sugerirCampo(h)]))
}
