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
 * Parses a Sabesp measurement spreadsheet using positional column detection.
 *
 * Actual Sabesp file column order:
 *   Col 0: Item (e.g. "02010101")
 *   Col 1: Descrição
 *   Col 2: N. Preço (e.g. "420009")
 *   Col 3: Unid.
 *   Col 4: Quant. (contrato)
 *   Col 5: P. Unit.
 *   Col 6+: period measurement columns (JANEIRO - MED. XX > Quant. | Valor)
 *
 * Grupo is detected from the Item code prefix: "01" → Canteiros, "02" → Esgoto, "03" → Água.
 * Group header rows (those without a numeric N. Preço in col 2) are skipped.
 */
export function parseSabespSheet(wb: XLSX.WorkBook): SabespParseResult {
  const itens: Omit<ItemContrato, 'id'>[] = []
  const errors: string[] = []

  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    errors.push('Planilha vazia.')
    return { itens, errors }
  }

  const ws = wb.Sheets[sheetName]
  // Use raw: false so numbers formatted as strings (e.g. "13.205,59") are preserved
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][]

  if (raw.length === 0) {
    errors.push('Planilha vazia ou sem dados reconhecíveis.')
    return { itens, errors }
  }

  // ── Find header row ────────────────────────────────────────────────────────
  // Look for a row that contains "N. Preço" / "N.Preço" / "N Preço" / "Nº Preço"
  // in any cell, OR has "Item" in col 0 and "Descrição" in col 1.
  let headerRowIdx = -1
  for (let i = 0; i < Math.min(raw.length, 20); i++) {
    const cells = raw[i].map(toStr)
    const rowStr = cells.join(' ')
    // Match merged header cells that contain "preço" and "n" pattern
    if (/n[\s.]?\s*pre/i.test(rowStr) || /n[º°]?\s*pre/i.test(rowStr)) {
      headerRowIdx = i
      break
    }
    // Fallback: "Item" in col 0 and "escri" in col 1
    if (/^item$/i.test(cells[0]) && /escri/i.test(cells[1])) {
      headerRowIdx = i
      break
    }
  }

  // ── Determine column indices ───────────────────────────────────────────────
  // If we found a header row, try to locate columns by header text.
  // If not found, fall back to fixed positional layout (0=Item, 1=Descr, 2=NPreco, 3=Un, 4=Quant, 5=PUnit).
  let iItem = 0, iDescr = 1, iNPreco = 2, iUnid = 3, iQtdContr = 4, iPUnit = 5
  let iQtdMedida = -1  // period qty column — detected by header text

  if (headerRowIdx >= 0) {
    const headers = raw[headerRowIdx].map(toStr)
    headers.forEach((h, idx) => {
      const n = norm(h)
      if (/^item$/.test(n) && iItem === 0) iItem = idx
      else if (/descri|servico/.test(n) && iDescr === 1) iDescr = idx
      else if (/n[\s.]?pre|n[º°]pre/.test(n)) iNPreco = idx
      else if (/^un(id)?$/.test(n) && iUnid === 3) iUnid = idx
      else if (/quant|qtd/.test(n) && iQtdContr === 4) iQtdContr = idx
      else if (/p[\s.]?\s*unit|prec.*unit|vl.*unit/.test(n) && iPUnit === 5) iPUnit = idx
    })
    // Period measurement column: look for "quant" after "MED" header
    for (let ci = iPUnit + 1; ci < headers.length; ci++) {
      if (/quant|qtd/i.test(headers[ci])) {
        iQtdMedida = ci
        break
      }
    }
  }

  // ── Parse data rows ────────────────────────────────────────────────────────
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0
  let currentGrupo: '01' | '02' | '03' = '02'

  for (let i = startRow; i < raw.length; i++) {
    const row = raw[i]
    const item    = toStr(row[iItem])
    const nPreco  = toStr(row[iNPreco])
    const descricao = toStr(row[iDescr])

    // Skip completely empty rows
    if (!item && !nPreco && !descricao) continue

    // Detect grupo from Item code prefix (e.g. "01000000" → '01')
    const grupoPfx = item.replace(/\s/g, '').slice(0, 2)
    if (grupoPfx === '01') currentGrupo = '01'
    else if (grupoPfx === '02') currentGrupo = '02'
    else if (grupoPfx === '03') currentGrupo = '03'
    else {
      // Fallback heuristic from description
      const rowStr = [item, descricao].join(' ').toLowerCase()
      if (rowStr.includes('canteiro') || rowStr.includes('plano de gestao')) currentGrupo = '01'
      else if (rowStr.includes('esgoto')) currentGrupo = '02'
      else if (rowStr.includes('agua') || rowStr.includes('água')) currentGrupo = '03'
    }

    // Skip group header rows: N. Preço column is empty or non-numeric
    if (!nPreco || !/^\d+$/.test(nPreco.replace(/\s/g, ''))) continue

    // Skip header/label rows that appear in the data section
    if (norm(nPreco).includes('n preco') || norm(nPreco).includes('preco')) continue

    const unidade = toStr(row[iUnid]) || 'M'
    const qtdContrato   = toNum(row[iQtdContr])
    const valorUnitario = toNum(row[iPUnit])
    const qtdMedida     = iQtdMedida >= 0 ? toNum(row[iQtdMedida]) : 0

    if (!descricao && !nPreco) continue

    itens.push({ nPreco: nPreco.trim(), descricao: descricao.trim(), unidade, grupo: currentGrupo, qtdContrato, qtdMedida, valorUnitario })
  }

  if (itens.length === 0) {
    errors.push('Nenhum item de contrato foi encontrado. Verifique se a planilha é a Planilha de Medição Sabesp com colunas: Item | Descrição | N. Preço | Unid. | Quant. | P. Unit.')
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
