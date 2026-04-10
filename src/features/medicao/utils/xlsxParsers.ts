/**
 * xlsxParsers.ts — XLSX/CSV import helpers for Módulo de Medição.
 *
 * Uses the `xlsx` library (already in dependencies).
 * Each parser returns { data, errors } for preview-before-commit flow.
 */
import * as XLSX from 'xlsx'
import type { ItemContrato, SubempreteiroItem, Fornecedor } from '@/store/medicaoBillingStore'

// ─── Generic helpers ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>

/** Reads all rows from the first worksheet of a WorkBook. */
function getRows(wb: XLSX.WorkBook): Row[] {
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const ws = wb.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: '' })
}

/** Normalise a header key: lower case, no accents, trim. */
function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
}

/**
 * Finds the first column whose normalised header matches any of the given
 * keywords (substring match).
 */
function findCol(row: Row, keywords: string[]): string | undefined {
  return Object.keys(row).find((k) => keywords.some((kw) => norm(k).includes(kw)))
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  const s = String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

/** Read a WorkBook from a File object. */
export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer()
  return XLSX.read(buf, { type: 'array' })
}

// ─── Sabesp planilha parser ───────────────────────────────────────────────────

export interface SabespParseResult {
  itens:  Omit<ItemContrato, 'id'>[]
  errors: string[]
}

/**
 * Parses a Sabesp measurement spreadsheet.
 *
 * Expected columns (flexible header matching):
 *   Nº Preço | Descrição | Un | Qtd Contrato | Qtd Medida | Vl. Unitário | Grupo
 */
export function parseSabespSheet(wb: XLSX.WorkBook): SabespParseResult {
  const rows  = getRows(wb)
  const itens: Omit<ItemContrato, 'id'>[] = []
  const errors: string[] = []

  if (rows.length === 0) {
    errors.push('Planilha vazia ou sem dados reconhecíveis.')
    return { itens, errors }
  }

  // Detect column keys from the first data row
  const sample = rows[0]
  const colNPreco        = findCol(sample, ['n preco', 'npreco', 'n°', 'item', 'codigo', 'cod'])
  const colDescricao     = findCol(sample, ['descricao', 'descr', 'servico', 'servico', 'especificacao'])
  const colUnidade       = findCol(sample, ['un', 'unidade'])
  const colQtdContrato   = findCol(sample, ['qtd contrato', 'qtd contr', 'quantidade contrato', 'qtde contrato'])
  const colQtdMedida     = findCol(sample, ['qtd medida', 'qtd med', 'quantidade medida', 'qtde medida', 'qtd period', 'qtde'])
  const colValorUnitario = findCol(sample, ['vl unit', 'valor unit', 'preco unit', 'v unit', 'preço unitario'])
  const colGrupo         = findCol(sample, ['grupo'])

  if (!colNPreco && !colDescricao) {
    errors.push('Não foi possível detectar as colunas. Certifique-se de que a planilha tem os cabeçalhos: Nº Preço, Descrição, Un, Qtd Medida, Vl. Unitário.')
    return { itens, errors }
  }

  let currentGrupo: '01' | '02' | '03' = '02'

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Detect grupo from explicit column or row value hints
    if (colGrupo) {
      const g = toStr(row[colGrupo])
      if (g === '01' || g === '1') currentGrupo = '01'
      else if (g === '02' || g === '2') currentGrupo = '02'
      else if (g === '03' || g === '3') currentGrupo = '03'
    } else {
      // Heuristic: look for group headers in any cell
      const rowStr = Object.values(row).map(toStr).join(' ').toLowerCase()
      if (rowStr.includes('canteiro') || rowStr.includes('grupo 01') || rowStr.includes('grupo 1')) currentGrupo = '01'
      else if (rowStr.includes('esgoto') || rowStr.includes('grupo 02') || rowStr.includes('grupo 2')) currentGrupo = '02'
      else if (rowStr.includes('agua') || rowStr.includes('grupo 03') || rowStr.includes('grupo 3')) currentGrupo = '03'
    }

    const nPreco = colNPreco ? toStr(row[colNPreco]) : ''
    const descricao = colDescricao ? toStr(row[colDescricao]) : ''

    // Skip rows that look like headers or empty rows
    if (!nPreco && !descricao) continue
    if (norm(nPreco).includes('n preco') || norm(nPreco).includes('item')) continue
    if (norm(descricao).includes('descri')) continue

    itens.push({
      nPreco,
      descricao,
      unidade:       colUnidade ? toStr(row[colUnidade]) || 'M' : 'M',
      grupo:         currentGrupo,
      qtdContrato:   colQtdContrato   ? toNum(row[colQtdContrato])   : 0,
      qtdMedida:     colQtdMedida     ? toNum(row[colQtdMedida])     : 0,
      valorUnitario: colValorUnitario ? toNum(row[colValorUnitario]) : 0,
    })
  }

  if (itens.length === 0) {
    errors.push('Nenhum item de contrato foi encontrado na planilha.')
  }

  return { itens, errors }
}

// ─── Subempreiteiro sheet parser ──────────────────────────────────────────────

export interface SubempreiteiroParseResult {
  nome:     string
  nucleo:   string
  periodo:  string
  itens:    SubempreteiroItem[]
  totals:   { totalMedido: number; totalAprovado: number; retencao: number }
  errors:   string[]
}

/**
 * Parses a subcontractor measurement sheet (e.g., VIALTA planilha de medição).
 *
 * Looks for a header row with: Nº Preço | Descrição | Un | Qtd | Vl. Unit
 * Company name / period may be in the first few rows as metadata.
 */
export function parseSubempreiteiroSheet(wb: XLSX.WorkBook): SubempreiteiroParseResult {
  const sheetName = wb.SheetNames[0]
  const result: SubempreiteiroParseResult = {
    nome: sheetName ?? 'Subempreiteiro',
    nucleo: '',
    periodo: '',
    itens: [],
    totals: { totalMedido: 0, totalAprovado: 0, retencao: 0 },
    errors: [],
  }

  const ws = sheetName ? wb.Sheets[sheetName] : null
  if (!ws) { result.errors.push('Planilha vazia.'); return result }

  // Read as raw 2D array to detect metadata rows before the header
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

  // Find the header row (first row containing 'descri' or 'servico')
  let headerIdx = -1
  for (let i = 0; i < Math.min(raw.length, 15); i++) {
    const rowStr = raw[i].map(toStr).join(' ').toLowerCase()
    if (rowStr.includes('descri') || rowStr.includes('n preco') || rowStr.includes('servico')) {
      headerIdx = i
      break
    }
    // Try to extract nome / periodo from metadata rows
    const cells = raw[i].map(toStr).filter(Boolean)
    if (cells.some((c) => /vialta|wert|consorcio|subempreit/i.test(c))) {
      result.nome = cells.find((c) => /vialta|wert|consorcio|subempreit/i.test(c)) ?? result.nome
    }
    if (cells.some((c) => /jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez/i.test(c))) {
      result.periodo = cells.find((c) => /jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez/i.test(c)) ?? ''
    }
    if (cells.some((c) => /nucleo|paulo|santos|mogi|taubate|sorocaba|campinas|bauru/i.test(c))) {
      result.nucleo = cells.find((c) => /nucleo|paulo|santos|mogi|taubate|sorocaba|campinas|bauru/i.test(c)) ?? ''
    }
  }

  if (headerIdx === -1) {
    // Fall back to sheet_to_json with auto headers
    const rows = getRows(wb)
    const sample = rows[0] ?? {}
    const colNPreco  = findCol(sample, ['n preco', 'npreco', 'item', 'codigo'])
    const colDesc    = findCol(sample, ['descricao', 'servico', 'especificacao'])
    const colUn      = findCol(sample, ['un', 'unidade'])
    const colQtd     = findCol(sample, ['qtd', 'quantidade', 'qtde'])
    const colVlUnit  = findCol(sample, ['vl unit', 'valor unit', 'preco unit'])

    for (const row of rows) {
      const nPreco = colNPreco ? toStr(row[colNPreco]) : ''
      const descricao = colDesc ? toStr(row[colDesc]) : ''
      if (!nPreco && !descricao) continue
      result.itens.push({
        nPreco,
        descricao,
        unidade: colUn ? toStr(row[colUn]) || 'M' : 'M',
        qtd: colQtd ? toNum(row[colQtd]) : 0,
        valorUnitario: colVlUnit ? toNum(row[colVlUnit]) : 0,
      })
    }
  } else {
    const headers = raw[headerIdx].map(toStr)
    const idxNPreco  = headers.findIndex((h) => /n[\s.]?pre/i.test(h) || /item/i.test(h) || /cod/i.test(h))
    const idxDesc    = headers.findIndex((h) => /descri/i.test(h) || /servico/i.test(h))
    const idxUn      = headers.findIndex((h) => /^un/i.test(h))
    const idxQtd     = headers.findIndex((h) => /^qtd/i.test(h) || /quant/i.test(h))
    const idxVlUnit  = headers.findIndex((h) => /vl.*unit/i.test(h) || /valor.*unit/i.test(h) || /prec.*unit/i.test(h))
    const idxTotal   = headers.findIndex((h) => /^total/i.test(h) && !/aprovado|retencao/i.test(h))
    const idxAprovado = headers.findIndex((h) => /aprovado/i.test(h))
    const idxRetencao = headers.findIndex((h) => /retenc/i.test(h) || /reten/i.test(h))

    for (let i = headerIdx + 1; i < raw.length; i++) {
      const cells = raw[i]
      const nPreco    = idxNPreco  >= 0 ? toStr(cells[idxNPreco])  : ''
      const descricao = idxDesc    >= 0 ? toStr(cells[idxDesc])    : ''
      const unidade   = idxUn      >= 0 ? toStr(cells[idxUn]) || 'M' : 'M'
      const qtd       = idxQtd     >= 0 ? toNum(cells[idxQtd])    : 0
      const vlUnit    = idxVlUnit  >= 0 ? toNum(cells[idxVlUnit])  : 0

      // Detect summary rows
      const rowStr = cells.map(toStr).join(' ').toLowerCase()
      if (idxTotal >= 0 && /^total/i.test(toStr(cells[idxTotal]))) {
        result.totals.totalMedido = toNum(cells[idxTotal + 1] ?? cells[idxTotal])
      }
      if (idxAprovado >= 0) result.totals.totalAprovado = toNum(cells[idxAprovado])
      if (idxRetencao >= 0) result.totals.retencao = toNum(cells[idxRetencao])
      if (rowStr.includes('total') && rowStr.includes('aprovado')) continue
      if (!nPreco && !descricao) continue

      result.itens.push({ nPreco, descricao, unidade, qtd, valorUnitario: vlUnit })
    }
  }

  // Auto-compute totalMedido if not found in sheet
  if (result.totals.totalMedido === 0 && result.itens.length > 0) {
    result.totals.totalMedido = result.itens.reduce((s, it) => s + it.qtd * it.valorUnitario, 0)
  }
  if (result.totals.totalAprovado === 0) {
    result.totals.totalAprovado = result.totals.totalMedido
  }

  if (result.itens.length === 0) {
    result.errors.push('Nenhum item de medição encontrado. Verifique os cabeçalhos da planilha.')
  }

  return result
}

// ─── Fornecedor sheet parser ──────────────────────────────────────────────────

export interface FornecedorParseResult {
  list:   Omit<Fornecedor, 'id'>[]
  errors: string[]
}

/**
 * Parses a suppliers spreadsheet.
 *
 * Expected columns: Nome/Empresa | Período | Descrição | Valor Aprovado
 * Also handles single-supplier sheets (metadata in first rows).
 */
export function parseFornecedorSheet(wb: XLSX.WorkBook, defaultPeriodo = ''): FornecedorParseResult {
  const rows   = getRows(wb)
  const result: FornecedorParseResult = { list: [], errors: [] }

  if (rows.length === 0) {
    result.errors.push('Planilha vazia.')
    return result
  }

  const sample = rows[0]
  const colNome     = findCol(sample, ['nome', 'empresa', 'fornecedor', 'razao'])
  const colPeriodo  = findCol(sample, ['periodo', 'mes', 'competencia'])
  const colDesc     = findCol(sample, ['descricao', 'descr', 'servico', 'objeto'])
  const colValor    = findCol(sample, ['valor', 'aprovado', 'total'])

  if (!colNome && !colValor) {
    // Single-supplier sheet — treat entire sheet as one fornecedor
    const sheetName = wb.SheetNames[0] ?? 'Fornecedor'
    const raw: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' }) as unknown[][]
    let nome = sheetName
    let valor = 0
    let periodo = defaultPeriodo
    let descricao = ''
    for (const row of raw) {
      const cells = row.map(toStr)
      const rowStr = cells.join(' ')
      if (!nome && cells.some((c) => /wert|fornecedor|empresa|ambiental/i.test(c))) {
        nome = cells.find((c) => /wert|fornecedor|empresa|ambiental/i.test(c)) ?? nome
      }
      if (!periodo && cells.some((c) => /jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez/i.test(c))) {
        periodo = cells.find((c) => /jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez/i.test(c)) ?? periodo
      }
      const numMatch = rowStr.match(/[\d]{1,3}([.,]\d{3})*([.,]\d{2})/)
      if (numMatch) {
        const candidate = toNum(numMatch[0])
        if (candidate > valor) valor = candidate
      }
      if (descricao.length < 200 && rowStr.length > 5 && !/R\$/.test(rowStr)) {
        descricao += (descricao ? ' ' : '') + rowStr.substring(0, 80)
      }
    }
    result.list.push({ nome, periodo, descricao: descricao.trim(), valorAprovado: valor })
    return result
  }

  for (const row of rows) {
    const nome = colNome ? toStr(row[colNome]) : ''
    if (!nome) continue
    result.list.push({
      nome,
      periodo:       colPeriodo ? toStr(row[colPeriodo]) || defaultPeriodo : defaultPeriodo,
      descricao:     colDesc    ? toStr(row[colDesc])    : '',
      valorAprovado: colValor   ? toNum(row[colValor])   : 0,
    })
  }

  if (result.list.length === 0) {
    result.errors.push('Nenhum fornecedor encontrado na planilha.')
  }

  return result
}
