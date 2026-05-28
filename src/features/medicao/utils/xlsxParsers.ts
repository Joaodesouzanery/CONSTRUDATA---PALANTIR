/**
 * xlsxParsers.ts — XLSX/CSV import helpers for Módulo de Medição.
 *
 * Uses the `xlsx` library (already in dependencies).
 * Each parser returns { data, errors } for preview-before-commit flow.
 */
import * as XLSX from 'xlsx'
import type {
  ItemContrato,
  SubempreteiroItem,
  SubempreiteiroParametroMensal,
  SubempreiteiroDescontoMensal,
  SubempreiteiroRhMensal,
  SubempreiteiroNotaFiscal,
  SubempreiteiroParametroFinanceiro,
  SubempreiteiroRetencaoDetalhada,
  SubempreiteiroRetencaoMensal,
  SubempreiteiroDetalhadoMensal,
  SubempreiteiroCustoLancamento,
  Fornecedor,
  MedicaoAnchorTotal,
  MedicaoSourceTotals,
  MedicaoValidation,
} from '@/store/medicaoBillingStore'
import { normalizeNPreco } from '@/lib/medicaoCodeMap'
import { getAllCriterios } from '../data/criterios'

// ─── Generic helpers ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>

function withSabespCode<T extends { nPreco: string; nPrecoSabesp?: string }>(item: T): T {
  const original = String(item.nPreco ?? '').trim()
  const linked = normalizeNPreco(item.nPrecoSabesp || original)
  return { ...item, nPreco: original, nPrecoSabesp: linked || original }
}

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

/**
 * Converts a value to a number, handling both Brazilian (1.234,56)
 * and English (1234.56) decimal formats, as well as R$ currency strings.
 *
 * Robust cleaning: strips "R$", currency symbols, spaces, and non-numeric
 * characters (except .,- for decimal/negative). Handles Sabesp PDF formats
 * where values may contain embedded formatting.
 */
function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const s = String(v ?? '').trim()
  // Remove currency symbols (R$, $), parentheses, spaces, and stray chars
  const clean = s
    .replace(/R\$\s?/g, '')
    .replace(/\$/g, '')
    .replace(/[()]/g, '')
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
  if (!clean || clean === '-' || clean === ',' || clean === '.') return 0
  // Brazilian format: both . and , present — . is thousands separator, , is decimal
  if (clean.includes(',') && clean.includes('.')) {
    const lastDot   = clean.lastIndexOf('.')
    const lastComma = clean.lastIndexOf(',')
    if (lastComma > lastDot) {
      // pt-BR: 1.234,56 → remove dots, replace comma
      return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
    } else {
      // en: 1,234.56 → remove commas
      return parseFloat(clean.replace(/,/g, '')) || 0
    }
  }
  // Only comma — decimal separator (Brazilian without thousands)
  if (clean.includes(',') && !clean.includes('.')) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(clean)) return parseFloat(clean.replace(/,/g, '')) || 0
    return parseFloat(clean.replace(',', '.')) || 0
  }
  return parseFloat(clean) || 0
}

function toStr(v: unknown): string {
  return String(v ?? '').trim()
}

function excelSerialToIso(value: number) {
  if (!Number.isFinite(value) || value < 20000 || value > 80000) return ''
  const date = new Date((value - 25569) * 86400000)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function displayCell(value: unknown): string {
  if (typeof value === 'number') return excelSerialToIso(value) || String(value)
  return toStr(value)
}

function collectWorkbookFormulaIssues(wb: XLSX.WorkBook) {
  const issues: string[] = []
  const errorPattern = /#(VALUE|REF|DIV\/0|N\/A|NAME|NUM|NULL)!?/i
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const ref = ws?.['!ref']
    if (!ws || !ref) continue
    const range = XLSX.utils.decode_range(ref)
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const addr = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = ws[addr] as XLSX.CellObject | undefined
        if (!cell) continue
        const displayed = String(cell.w ?? cell.v ?? '').trim()
        if (cell.t === 'e' || errorPattern.test(displayed)) {
          issues.push(`${sheetName}!${addr}: erro de formula ${displayed || '#ERROR'}`)
        }
      }
    }
  }
  return issues
}

function rowValue(row: Row, patterns: RegExp[], fallbackKeys: string[] = []) {
  for (const key of fallbackKeys) {
    if (row[key] != null && toStr(row[key])) return row[key]
  }
  const found = Object.keys(row).find((key) => patterns.some((pattern) => pattern.test(norm(key))))
  return found ? row[found] : ''
}

function supplierBlockingIssues(input: {
  fornecedor?: string
  nucleo?: string
  periodo?: string
  precoUnitario?: number
  quantidade?: number
  valor?: number
  medicaoItens?: Array<{ pendencias?: string[] }>
  memoriaItens?: unknown[]
  valorTotalMedicaoNf?: number
  valorAprovado?: number
}) {
  const issues = [
    !input.fornecedor ? 'Sem fornecedor/subcontratado' : '',
    !input.periodo ? 'Sem periodo/competencia' : '',
    input.nucleo === '' ? 'Sem nucleo' : '',
    input.precoUnitario != null && input.precoUnitario <= 0 ? 'Sem preco unitario' : '',
    input.quantidade != null && input.quantidade <= 0 ? 'Sem quantidade' : '',
    input.valor != null && input.valor <= 0 ? 'Sem valor de medicao' : '',
    input.medicaoItens && input.medicaoItens.length === 0 ? 'Sem linhas de boletim' : '',
    input.memoriaItens && input.memoriaItens.length === 0 ? 'Sem memoria MC' : '',
    input.valorAprovado != null && input.valorTotalMedicaoNf != null && Math.abs(input.valorAprovado - input.valorTotalMedicaoNf) > 1 ? 'Divergencia entre aprovado e valor NF' : '',
    ...(input.medicaoItens ?? []).flatMap((item) => item.pendencias ?? []),
  ].filter(Boolean)
  return Array.from(new Set(issues))
}

function parseConfidenceFromIssues(totalChecks: number, issueCount: number) {
  if (totalChecks <= 0) return 0
  return Math.max(0, Math.round(((totalChecks - issueCount) / totalChecks) * 100))
}

function normUnit(v: unknown): string {
  return toStr(v)
    .toUpperCase()
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/\s+/g, '')
    .replace(/^UNID\.?$/, 'UN')
    .replace(/^UNIDADE$/, 'UN')
}

/** Read a WorkBook from a File object. */
export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer()
  return XLSX.read(buf, { type: 'array' })
}

const MONTH_ALIASES: Record<string, string> = {
  jan: 'jan',
  january: 'jan',
  janeiro: 'jan',
  feb: 'fev',
  fev: 'fev',
  february: 'fev',
  fevereiro: 'fev',
  mar: 'mar',
  march: 'mar',
  marco: 'mar',
  março: 'mar',
  apr: 'abr',
  abr: 'abr',
  april: 'abr',
  abril: 'abr',
  may: 'mai',
  mai: 'mai',
  maio: 'mai',
  jun: 'jun',
  june: 'jun',
  junho: 'jun',
  jul: 'jul',
  july: 'jul',
  julho: 'jul',
  aug: 'ago',
  ago: 'ago',
  august: 'ago',
  agosto: 'ago',
  sep: 'set',
  set: 'set',
  september: 'set',
  setembro: 'set',
  oct: 'out',
  out: 'out',
  october: 'out',
  outubro: 'out',
  nov: 'nov',
  november: 'nov',
  novembro: 'nov',
  dec: 'dez',
  dez: 'dez',
  december: 'dez',
  dezembro: 'dez',
}

function normalizePeriodoLabel(value: string): string {
  const normalized = norm(value)
  const monthMatch = normalized.match(/\b(jan|janeiro|feb|fev|fevereiro|mar|marco|abr|abril|apr|mai|maio|may|jun|junho|jul|julho|ago|agosto|aug|set|setembro|sep|out|outubro|oct|nov|novembro|dez|dezembro|dec)\b/)
  const yearMatch = normalized.match(/\b(\d{2,4})\b/)
  const month = monthMatch ? MONTH_ALIASES[monthMatch[1]] ?? monthMatch[1] : ''
  const year = yearMatch ? yearMatch[1].slice(-2) : ''
  if (month && year) return `${month}/${year}`
  if (month) return month
  return ''
}

function samePeriodoMonth(a: string, b: string) {
  const left = normalizePeriodoLabel(a).split('/')[0]
  const right = normalizePeriodoLabel(b).split('/')[0]
  return Boolean(left && right && left === right)
}

function firstReasonableMoney(cells: string[], startIndex = 0) {
  for (let i = startIndex; i < cells.length; i += 1) {
    const cell = cells[i]
    if (!cell.trim()) continue
    if (/[a-zA-ZÀ-ÿ]/.test(cell) && !/R\$|\d+[.,]\d{2}/.test(cell)) continue
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(cell)) continue
    const value = toNum(cell)
    if (Math.abs(value) > 0 && Math.abs(value) < 100_000_000_000) return value
  }
  return 0
}

function findLabelValue(cells: string[], labels: RegExp[]) {
  const idx = cells.findIndex((cell) => labels.some((label) => label.test(norm(cell))))
  if (idx < 0) return ''
  return cells.slice(idx + 1).find((cell) => cell.trim()) ?? ''
}

// ─── Sabesp planilha parser ───────────────────────────────────────────────────

export interface SabespParseResult {
  itens:    Omit<ItemContrato, 'id'>[]
  errors:   string[]
  warnings: string[]
  sourceTotals?: MedicaoSourceTotals
  anchors?: MedicaoAnchorTotal[]
  validations?: MedicaoValidation[]
  extras?: Omit<ItemContrato, 'id'>[]
}

/**
 * Parses a Sabesp measurement spreadsheet.
 *
 * Handles both simple and merged-cell Sabesp formats.
 * Scans cells directly (not just row strings) to find the data header,
 * since merged cells may appear empty in sheet_to_json output.
 *
 * Typical Sabesp column layout after the header:
 *   Item | Descrição | N. Preço | Unid. | Quant.(contrato) | P. Unit. | [period cols...]
 *
 * Grupo detected from Item code prefix: "01" → Canteiros, "02" → Esgoto, "03" → Água.
 */
export function parseSabespSheet(wb: XLSX.WorkBook): SabespParseResult {
  const itens: Omit<ItemContrato, 'id'>[] = []
  const errors: string[] = []
  const warnings: string[] = []

  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    errors.push('Planilha vazia.')
    return { itens, errors, warnings }
  }

  const ws = wb.Sheets[sheetName]

  // ── Read as 2D array (raw: false for formatted strings) ───────────────────
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][]

  if (raw.length === 0) {
    errors.push('Planilha vazia ou sem dados reconhecíveis.')
    return { itens, errors, warnings }
  }

  // ── Build a flat cell map from raw address access for merged-cell detection ─
  // XLSX represents merged cells: the anchor cell has the value, others are empty.
  // We scan all cells in first 30 rows to find "N. Preço" anywhere.
  const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null
  const cellValues: Map<string, string> = new Map()
  if (range) {
    for (let r = range.s.r; r <= Math.min(range.e.r, 30); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = ws[addr]
        if (cell && cell.v != null) {
          cellValues.set(addr, toStr(cell.v))
        }
      }
    }
  }

  // ── Find header row ────────────────────────────────────────────────────────
  // Strategy 1: find a cell containing "n. preço" / "npreço" / "n preço" / "n°preço"
  // in the first 30 rows (handles merged headers).
  let headerRowIdx = -1

  // Check 2D array rows first (works for most files)
  for (let i = 0; i < Math.min(raw.length, 30); i++) {
    const cells = raw[i].map(toStr)
    const rowStr = cells.join('|')
    if (
      /n[\s.°º]*pre/i.test(rowStr) ||
      /n[º°]?\s*pre/i.test(rowStr) ||
      (/^item$/i.test(cells[0] ?? '') && /descri/i.test(cells[1] ?? ''))
    ) {
      headerRowIdx = i
      break
    }
  }

  // Strategy 2: scan individual cells (catches merged-cell headers)
  if (headerRowIdx === -1 && range) {
    outer: for (let r = range.s.r; r <= Math.min(range.e.r, 30); r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const val = cellValues.get(XLSX.utils.encode_cell({ r, c })) ?? ''
        if (/n[\s.°º]*pre/i.test(val) || /n[º°]\s*pre/i.test(val)) {
          headerRowIdx = r
          break outer
        }
      }
    }
  }

  // Strategy 3: find first row where col 2 is a pure numeric string → data starts there
  // (no header detected, use pure positional)
  if (headerRowIdx === -1) {
    for (let i = 0; i < Math.min(raw.length, 30); i++) {
      const col2 = toStr(raw[i][2])
      if (/^\d{4,}$/.test(col2.replace(/\s/g, ''))) {
        headerRowIdx = i - 1  // treat row before as header
        break
      }
    }
  }

  // ── Determine column indices ───────────────────────────────────────────────
  let iItem = 0, iDescr = 1, iNPreco = 2, iUnid = 3, iQtdContr = 4, iPUnit = 5
  let iQtdMedida = -1
  let iQtdAnterior = -1
  let iQtdAcumulada = -1
  let iContratoTotal = -1
  let iValorMedida = -1
  let iValorAcumulado = -1
  let iSaldoValor = -1

  if (headerRowIdx >= 0 && headerRowIdx < raw.length) {
    const headers = raw[headerRowIdx].map(toStr)
    const quantCols: number[] = []
    const saldoCols: number[] = []
    headers.forEach((h, idx) => {
      const n = norm(h)
      if (/^item$/.test(n)) iItem = idx
      else if (/descri|servico/.test(n) && idx <= 3) iDescr = idx
      else if (/n[\s.]?pre|n[º°]pre|numero.*pre/.test(n)) iNPreco = idx
      else if (/^un(id)?$/.test(n) || n === 'un') iUnid = idx
      else if (/^(quant|qtd|quantidade)$/.test(n) && idx <= 6 && iQtdContr === 4) iQtdContr = idx
      else if (/p[\s.]?\s*unit|prec.*unit|vl.*unit|valor.*unit/.test(n) && idx <= 7) iPUnit = idx
      else if (/^total$|valor\s*total/.test(n) && idx > iPUnit && iContratoTotal === -1) iContratoTotal = idx
      else if (/anterior/.test(n)) iQtdAnterior = idx
      else if (/acum|acumulad/.test(n) && iQtdAnterior === -1) iQtdAnterior = idx
      if (idx > iPUnit && /quant|qtd/.test(n)) quantCols.push(idx)
      if (idx > iPUnit && /valor/.test(n) && iValorMedida === -1) iValorMedida = idx
      if (idx > iPUnit && /executado/.test(n)) iValorAcumulado = idx
      if (idx > iPUnit && /saldo/.test(n)) saldoCols.push(idx)
    })
    iQtdMedida = quantCols[0] ?? iQtdMedida
    iQtdAcumulada = quantCols[1] ?? -1
    iSaldoValor = saldoCols[saldoCols.length - 1] ?? -1
    // Look for period measurement Quant. column after P.Unit
    if (iQtdMedida === -1) {
      for (let ci = iPUnit + 1; ci < headers.length; ci++) {
        const hn = norm(headers[ci])
        if (/quant|qtd/.test(hn)) {
          iQtdMedida = ci
          break
        }
      }
    }
    // Also scan the row ABOVE headerRowIdx for period labels like "MED. 08"
    // (the quant column is often under a merged "MED.XX" header)
    if (iQtdMedida === -1 && headerRowIdx > 0) {
      const above = raw[headerRowIdx - 1].map(toStr)
      for (let ci = iPUnit + 1; ci < above.length; ci++) {
        if (/med/i.test(above[ci])) {
          // Found measurement period column block — quant is first sub-column
          iQtdMedida = ci
          break
        }
      }
    }
  }

  // ── Parse data rows ────────────────────────────────────────────────────────
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0
  let currentGrupo: '01' | '02' | '03' = '02'
  let inExtras = false
  const anchors: MedicaoAnchorTotal[] = []

  const hasFinancialTotals = (row: unknown[]) =>
    [iContratoTotal, iValorMedida, iValorAcumulado, iSaldoValor].some((idx) => idx >= 0 && toNum(row[idx]) > 0)

  const makeAnchor = (row: unknown[], rowIndex: number, label: string): MedicaoAnchorTotal => ({
    label,
    rowIndex,
    grupo: currentGrupo,
    totalContrato: iContratoTotal >= 0 ? toNum(row[iContratoTotal]) || undefined : undefined,
    totalPeriodo: iValorMedida >= 0 ? toNum(row[iValorMedida]) || undefined : undefined,
    totalAcumulado: iValorAcumulado >= 0 ? toNum(row[iValorAcumulado]) || undefined : undefined,
    saldo: iSaldoValor >= 0 ? toNum(row[iSaldoValor]) || undefined : undefined,
  })

  for (let i = startRow; i < raw.length; i++) {
    const row = raw[i]
    // Skip rows that are completely empty or contain only whitespace
    if (!row || row.every((cell) => !toStr(cell))) continue

    const item    = toStr(row[iItem])
    const nPreco  = toStr(row[iNPreco])
    const descricao = toStr(row[iDescr])
    const fullRowJoined = row.map(toStr).join(' ')

    // Skip summary rows, but rows after "Total da Planilha" are extras/aditivos.
    if (/total\s+da\s+planilha/i.test(fullRowJoined)) {
      anchors.push(makeAnchor(row, i, 'Total da Planilha'))
      inExtras = true
      continue
    }
    if (/total\s+do\s+grupo/i.test(fullRowJoined)) {
      anchors.push(makeAnchor(row, i, 'Total do Grupo'))
      continue
    }
    if (/total\s+da\s+frente/i.test(fullRowJoined)) {
      anchors.push(makeAnchor(row, i, 'Total da Frente'))
      continue
    }
    if (/total\s*(do|da|geral)/i.test(fullRowJoined)) {
      anchors.push(makeAnchor(row, i, 'Total'))
      continue
    }
    if (inExtras && !item && !nPreco && !descricao && hasFinancialTotals(row)) {
      anchors.push(makeAnchor(row, i, 'Total Geral com Extras'))
      continue
    }

    // Skip CRITÉRIO lines (measurement criteria text, not data rows)
    const rowJoined = [item, nPreco, descricao].join(' ')
    if (/crit[eé]rio/i.test(rowJoined) && !/^\d{4,}$/.test(nPreco.replace(/\s/g, ''))) continue

    // Skip completely empty rows (Item, NPreco, and Descricao all empty)
    if (!item && !nPreco && !descricao) continue

    // Detect grupo from Item code prefix
    // Handle both 7-digit (CSV: 1010101) and 8-digit (PDF: 01010101) formats
    const cleanItem = item.replace(/\D/g, '')
    // Normalize to 8 digits by padding with leading zero if 7 digits
    const normalizedItem = cleanItem.length === 7 ? '0' + cleanItem : cleanItem
    const grupoPfx = normalizedItem.slice(0, 2)
    if (!inExtras && grupoPfx === '01') currentGrupo = '01'
    else if (!inExtras && grupoPfx === '02') currentGrupo = '02'
    else if (!inExtras && grupoPfx === '03') currentGrupo = '03'
    else if (!inExtras) {
      // Heuristic from description
      const rowStr = [item, descricao].join(' ').toLowerCase()
      if (/canteiro|plano de gestao|pcmat|pcmso/.test(rowStr)) currentGrupo = '01'
      else if (/esgoto|esgotamento|coleta|rede coletora/.test(rowStr)) currentGrupo = '02'
      else if (/agua|abastecimento|adutora|rede de distribui/.test(rowStr)) currentGrupo = '03'
    }

    // Try to extract N. Preço from description if the NPreço column is empty
    // (handles PDF format where "MANUTENÇÃO DO CANTEIRO 500101" has code embedded)
    let nPrecoClean = nPreco.replace(/\s/g, '')
    let cleanDescricao = descricao

    if (!nPrecoClean || !/^\d{3,}$/.test(nPrecoClean)) {
      // Try to extract numeric code from end of description (3-6 digits)
      const codeMatch = descricao.match(/\b(\d{3,6})\s*$/)
      if (codeMatch) {
        nPrecoClean = codeMatch[1]
        cleanDescricao = descricao.replace(/\s*\d{3,6}\s*$/, '').trim()
      }
    }

    // Check if row has numeric data (quantity or unit price) — accept items
    // even without standard N. Preço (e.g., "TRANSPORTE DE RESIDUOS" with short codes)
    const hasNumericData = toNum(row[iQtdContr]) > 0 || toNum(row[iPUnit]) > 0

    // If no N. Preço and no numeric data, it's a group header — skip
    if ((!nPrecoClean || !/^\d+$/.test(nPrecoClean)) && !hasNumericData) continue

    // Generate temporary ID for items without standard N. Preço
    if (!nPrecoClean || !/^\d+$/.test(nPrecoClean)) {
      if (hasNumericData && cleanDescricao) {
        // Accept the item with a generated code: "EXT-" + row index
        nPrecoClean = `EXT${String(i).padStart(4, '0')}`
      } else {
        continue
      }
    }

    // Skip rows that look like repeated column headers
    if (norm(nPrecoClean).includes('preco') || norm(nPrecoClean).includes('n preco')) continue

    // Validate unit exists
    const unidadeRaw = toStr(row[iUnid])
    const unidade = unidadeRaw || 'M'

    const qtdContrato   = toNum(row[iQtdContr])
    const valorUnitario = toNum(row[iPUnit])
    const qtdMedida     = iQtdMedida >= 0 ? toNum(row[iQtdMedida]) : 0
    const qtdAcumulada  = iQtdAcumulada >= 0 ? toNum(row[iQtdAcumulada]) : 0
    const qtdAnterior   = qtdAcumulada > 0
      ? Math.max(0, qtdAcumulada - qtdMedida)
      : iQtdAnterior >= 0 ? toNum(row[iQtdAnterior]) : 0

    if (!cleanDescricao && !nPrecoClean) continue

    itens.push({
      itemEAP:      normalizedItem || item,
      nPreco:       nPrecoClean,
      descricao:    cleanDescricao || '—',
      unidade,
      grupo:        inExtras || nPrecoClean.startsWith('EXT') ? 'EX' : currentGrupo,
      qtdContrato,
      qtdAnterior,
      qtdMedida,
      valorUnitario,
    })
  }

  if (itens.length === 0) {
    errors.push(
      'Nenhum item de contrato foi encontrado. ' +
      'Verifique se a planilha é a Planilha de Medição Sabesp com colunas: Item | Descrição | N. Preço | Unid. | Quant. | P. Unit.'
    )
  }

  // ── Rounding validation (Regra dos Centavos) ──────────────────────────────
  // Check if calculated totals match expected values within ±R$0.01 tolerance
  for (const it of itens) {
    if (it.qtdMedida > 0 && it.valorUnitario > 0) {
      const computed = it.qtdMedida * it.valorUnitario
      // Round to 2 decimals (Sabesp standard)
      const rounded = Math.round(computed * 100) / 100
      if (Math.abs(computed - rounded) > 0.005) {
        warnings.push(
          `Arredondamento: item ${it.nPreco} — valor calculado R$ ${computed.toFixed(4)} será arredondado para R$ ${rounded.toFixed(2)}`
        )
      }
    }
  }

  // Validate N. Preço against the criteria catalog, including PDF/manual imports.
  const catalogo = getAllCriterios()
  const catalogoMap = new Map(catalogo.map(c => [c.nPreco, c]))
  const catalogoSet = new Set(catalogo.map(c => c.nPreco))
  const naoEncontrados = itens.filter(it => !it.nPreco.startsWith('EXT') && !catalogoSet.has(it.nPreco))
  if (naoEncontrados.length > 0) {
    const sample = naoEncontrados.slice(0, 20).map(it => it.nPreco).join(', ')
    warnings.push(
      `${naoEncontrados.length} N. Preço não encontrado(s) no catálogo de critérios: ${sample}${naoEncontrados.length > 20 ? '...' : ''}. ` +
      'Verifique se os códigos estão corretos ou adicione os critérios manualmente.'
    )
  }

  const unidadesDivergentes = itens
    .filter(it => !it.nPreco.startsWith('EXT'))
    .map((it) => ({ item: it, criterio: catalogoMap.get(it.nPreco) }))
    .filter(({ item, criterio }) => criterio && normUnit(item.unidade) && normUnit(criterio.unidade) && normUnit(item.unidade) !== normUnit(criterio.unidade))

  if (unidadesDivergentes.length > 0) {
    const sample = unidadesDivergentes
      .slice(0, 10)
      .map(({ item, criterio }) => `${item.nPreco} (${item.unidade} x ${criterio?.unidade})`)
      .join(', ')
    warnings.push(
      `${unidadesDivergentes.length} item(ns) com unidade diferente do critério de medição: ${sample}${unidadesDivergentes.length > 10 ? '...' : ''}.`
    )
  }

  // Validate overrun: items where accumulated > contract
  const estourados = itens.filter(it => (it.qtdAnterior + it.qtdMedida) > it.qtdContrato && it.qtdContrato > 0)
  if (estourados.length > 0) {
    warnings.push(
      `${estourados.length} item(ns) com medição superior ao contrato (requer Aditivo): ${estourados.map(it => `${it.nPreco} (${((it.qtdAnterior + it.qtdMedida) / it.qtdContrato * 100).toFixed(0)}%)`).join(', ')}`
    )
  }

  // Check for duplicate N. Preço entries (skip generated EXT codes)
  const seen = new Set<string>()
  for (const it of itens) {
    if (it.nPreco.startsWith('EXT')) continue
    if (seen.has(it.nPreco)) {
      warnings.push(`N. Preço duplicado: ${it.nPreco} aparece mais de uma vez na planilha.`)
    }
    seen.add(it.nPreco)
  }

  const sourceTotals = {
    totalContrato: 0,
    totalPeriodo: 0,
    totalAcumulado: 0,
    saldo: 0,
  }
  for (let i = startRow; i < raw.length; i++) {
    const row = raw[i] ?? []
    if (iContratoTotal >= 0) sourceTotals.totalContrato = Math.max(sourceTotals.totalContrato, toNum(row[iContratoTotal]))
    if (iValorMedida >= 0) sourceTotals.totalPeriodo = Math.max(sourceTotals.totalPeriodo, toNum(row[iValorMedida]))
    if (iValorAcumulado >= 0) sourceTotals.totalAcumulado = Math.max(sourceTotals.totalAcumulado, toNum(row[iValorAcumulado]))
    if (iSaldoValor >= 0) sourceTotals.saldo = Math.max(sourceTotals.saldo, toNum(row[iSaldoValor]))
  }
  const finalTotalAnchor = [...anchors].reverse().find((anchor) => /total geral com extras/i.test(anchor.label))
  const totalPlanilhaAnchor = [...anchors].reverse().find((anchor) => /total da planilha/i.test(anchor.label))
  const preferredTotalsAnchor = finalTotalAnchor ?? (inExtras ? undefined : totalPlanilhaAnchor)
  if (preferredTotalsAnchor) {
    sourceTotals.totalContrato = preferredTotalsAnchor.totalContrato || sourceTotals.totalContrato
    sourceTotals.totalPeriodo = preferredTotalsAnchor.totalPeriodo || sourceTotals.totalPeriodo
    sourceTotals.totalAcumulado = preferredTotalsAnchor.totalAcumulado || sourceTotals.totalAcumulado
    sourceTotals.saldo = preferredTotalsAnchor.saldo || sourceTotals.saldo
  }

  const importedChecks = [
    ['Total contratado', sourceTotals.totalContrato, itens.reduce((s, it) => s + it.qtdContrato * it.valorUnitario, 0)],
    ['Total periodo', sourceTotals.totalPeriodo, itens.reduce((s, it) => s + it.qtdMedida * it.valorUnitario, 0)],
    ['Total acumulado', sourceTotals.totalAcumulado, itens.reduce((s, it) => s + (it.qtdAnterior + it.qtdMedida) * it.valorUnitario, 0)],
    ['Saldo', sourceTotals.saldo, itens.reduce((s, it) => s + (it.qtdContrato - it.qtdAnterior - it.qtdMedida) * it.valorUnitario, 0)],
  ] as const
  const validations: MedicaoValidation[] = importedChecks
    .filter(([, source]) => source > 0)
    .map(([label, source, calculated]) => ({
      label,
      source,
      calculated,
      diff: source - calculated,
      ok: Math.abs(source - calculated) <= 10,
    }))
  for (const [label, source, imported] of importedChecks) {
    if (source > 0 && Math.abs(source - imported) > 10) {
      warnings.push(
        `Alerta de consistencia (${label}): arquivo R$ ${source.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` +
        `, importado R$ ${imported.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`
      )
    }
  }

  // Flag items with generated IDs (no standard N. Preço)
  const extItems = itens.filter(it => it.nPreco.startsWith('EXT'))
  if (extItems.length > 0) {
    warnings.push(
      `${extItems.length} item(ns) importado(s) sem código N. Preço padrão: ${extItems.map(it => it.descricao).join(', ')}. ` +
      'Códigos temporários (EXT) foram gerados. Edite manualmente se necessário.'
    )
  }

  return {
    itens,
    errors,
    warnings,
    sourceTotals: {
      totalContrato: sourceTotals.totalContrato || undefined,
      totalPeriodo: sourceTotals.totalPeriodo || undefined,
      totalAcumulado: sourceTotals.totalAcumulado || undefined,
      saldo: sourceTotals.saldo || undefined,
    },
    anchors,
    validations,
    extras: itens.filter((item) => item.grupo === 'EX'),
  }
}

// ─── Subempreiteiro sheet parser ──────────────────────────────────────────────

export interface SubempreiteiroParseResult {
  nome:     string
  nucleo:   string
  periodo:  string
  itens:    SubempreteiroItem[]
  totals:   { totalMedido: number; totalAprovado: number; retencao: number }
  parametros?: SubempreiteiroParametroMensal[]
  descontos?: SubempreiteiroDescontoMensal[]
  rh?: SubempreiteiroRhMensal[]
  agregados?: SubempreiteiroCustoLancamento[]
  materiaisFerramentas?: SubempreiteiroCustoLancamento[]
  materiaisEpi?: SubempreiteiroCustoLancamento[]
  maquinas?: SubempreiteiroCustoLancamento[]
  servicos?: SubempreiteiroCustoLancamento[]
  veiculos?: SubempreiteiroCustoLancamento[]
  combustivel?: SubempreiteiroCustoLancamento[]
  abastecimentoComboio?: SubempreiteiroCustoLancamento[]
  locEquipamentos?: SubempreiteiroCustoLancamento[]
  epis?: SubempreiteiroCustoLancamento[]
  parametrosFinanceiros?: SubempreiteiroParametroFinanceiro[]
  retencaoDetalhada?: SubempreiteiroRetencaoDetalhada[]
  detalhadoMensal?: SubempreiteiroDetalhadoMensal[]
  nfs?: SubempreiteiroNotaFiscal[]
  retencoes?: SubempreiteiroRetencaoMensal[]
  warnings?: string[]
  errors:   string[]
}

function readRawWorksheet(wb: XLSX.WorkBook, sheetName: string): string[][] {
  const ws = wb.Sheets[sheetName]
  if (!ws) return []
  return (XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][])
    .map((row) => row.map(displayCell))
}

function isMetadataNoise(value: string) {
  const n = norm(value)
  if (!n) return true
  if (normalizePeriodoLabel(value)) return true
  if (/^\d+$/.test(n)) return true
  if (/resumo|fechamento|boletim|controle|medicao/.test(n)) return true
  return /^(obra|nucleo|contrato|referencia|mes|empreiteiro|fornecedor|periodo|data|revisao|responsavel|slrn|slnr|resumo|fechamento|boletim|medicao|parametros?)$/.test(n)
}

function pickCompanyCandidate(cells: string[]) {
  return cells.find((cell) => {
    const value = cell.trim()
    if (value.length < 3) return false
    if (isMetadataNoise(value)) return false
    if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value)) return false
    return /[A-Za-zÀ-ÿ]/.test(value)
  }) ?? ''
}

function pickNucleoCandidate(cells: string[]) {
  return cells.find((cell) => /sao|são|manuel|teteu|morro/i.test(cell) && !/obra|nucleo|núcleo/i.test(norm(cell))) ?? ''
}

function findHeaderRow(raw: string[][], match: (rowNorm: string) => boolean, limit = 80) {
  for (let i = 0; i < Math.min(raw.length, limit); i += 1) {
    const rowNorm = norm(raw[i].join(' '))
    if (match(rowNorm)) return i
  }
  return -1
}

function findHeaderCol(headers: string[], matchers: RegExp[]) {
  return headers.findIndex((h) => matchers.some((re) => re.test(norm(h))))
}

function findMonthPair(periodRow: string[], headers: string[], periodo: string) {
  if (!periodo) return { qtd: -1, total: -1 }
  const periodoNorm = normalizePeriodoLabel(periodo)
  const monthToken = periodoNorm.split('/')[0]
  for (let i = 0; i < periodRow.length; i += 1) {
    const periodCell = norm(periodRow[i])
    if (!samePeriodoMonth(periodRow[i], periodo) && !(monthToken && periodCell.includes(monthToken))) continue
    const qtd = headers.slice(i, i + 3).findIndex((h) => /qntd|qtd|quant/i.test(norm(h)))
    const total = headers.slice(i, i + 4).findIndex((h) => /preco total|valor|total/i.test(norm(h)))
    if (qtd >= 0 && total >= 0) return { qtd: i + qtd, total: i + total }
  }
  return { qtd: -1, total: -1 }
}

function normalizeSheetPriority(name: string) {
  const n = norm(name)
  if (n === 'medicao') return 0
  if (/medicao/.test(n) && !/resumo|desconto|retencao/.test(n)) return 1
  if (/itens retencao/.test(n)) return 2
  if (/resumo|nfs|parametro|desconto|material|memoria/.test(n)) return 20
  return 8
}

function formatQty(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function formatMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function parseSubempreiteiroSheet(wb: XLSX.WorkBook): SubempreiteiroParseResult {
  const parsed = parseSubempreiteiroSheetOptimized(wb)
  appendSubempreiteiroDetailedTabs(wb, parsed)
  if (parsed.itens.length > 0) return parsed
  const legacy = parseSubempreiteiroSheetLegacy(wb)
  appendSubempreiteiroDetailedTabs(wb, legacy)
  return legacy.itens.length > 0 ? legacy : parsed
}

function makeLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function getSheetByNorm(wb: XLSX.WorkBook, matcher: RegExp) {
  const name = wb.SheetNames.find((sheet) => matcher.test(norm(sheet)))
  return name ? readRawWorksheet(wb, name) : []
}

function getSheetNamesByNorm(wb: XLSX.WorkBook, matcher: RegExp) {
  return wb.SheetNames.filter((sheet) => matcher.test(norm(sheet)))
}

function nucleoFromSheetName(sheetName: string, fallback = '') {
  const n = norm(sheetName)
  if (/\b(s m|sao manuel|s manuel)\b/.test(n)) return 'SAO MANUEL'
  if (/\b(j c|joao carlos|j carlos)\b/.test(n)) return 'JOAO CARLOS'
  return fallback
}

function subMeasurementSheetNames(wb: XLSX.WorkBook) {
  const names = wb.SheetNames.filter((name) => {
    const n = norm(name)
    if (/resumo|fechamento|desconto|retencao|reten|nfs|nota|parametro|memoria|^mc$|material|epi|rh/.test(n)) return false
    return /^medicao(\s|$)/.test(n) || /detalhado|controle.*medicao|medicao.*empreiteiro/.test(n)
  })
  const splitNames = names.filter((name) => {
    const n = norm(name)
    return /\b(s m|j c|sao manuel|joao carlos)\b/.test(n)
  })
  return splitNames.length > 0 ? splitNames : names
}

function cellDateOrText(value: string) {
  return value.trim()
}

function appendSubempreiteiroDetailedTabs(wb: XLSX.WorkBook, result: SubempreiteiroParseResult) {
  result.warnings = Array.from(new Set([...(result.warnings ?? []), ...collectWorkbookFormulaIssues(wb)]))
  result.parametros = parseSubParametros(wb, result)
  result.descontos = parseSubDescontos(wb)
  result.rh = parseSubRh(wb)
  result.agregados = parseSubCostSheet(wb, /^agregados$/)
  result.materiaisFerramentas = parseSubCostSheet(wb, /materiais.*ferramentas|mat.*ferram/)
  result.materiaisEpi = parseSubCostSheet(wb, /mat.*e.*epis?|mat.*epis?|materiais.*epis?/)
  result.maquinas = parseSubCostSheet(wb, /^maquinas$/)
  result.servicos = parseSubCostSheet(wb, /^servicos$/)
  result.veiculos = parseSubCostSheet(wb, /^veiculos$/)
  result.combustivel = parseSubCostSheet(wb, /^combustivel$/)
  result.abastecimentoComboio = parseSubCostSheet(wb, /abast.*comboio/)
  result.locEquipamentos = parseSubCostSheet(wb, /loc.*equipamentos/)
  result.epis = parseSubCostSheet(wb, /^epi$/)
  result.nfs = parseSubNfs(wb)
  result.parametrosFinanceiros = parseSubParametrosFinanceiros(wb, result)
  result.retencaoDetalhada = parseSubRetencaoDetalhada(wb, result.periodo)
  result.detalhadoMensal = parseSubDetalhadoMensal(wb, result.periodo)
  const retentionItems = parseSubItensRetencao(wb, result.periodo)
  if (retentionItems.length > 0) {
    const retentionKeys = new Map(retentionItems.map((item) => [norm(`${item.nPreco}|${item.descricao}|${item.mes ?? ''}`), item]))
    result.itens = result.itens.map((item) => {
      const found = retentionKeys.get(norm(`${item.nPreco}|${item.descricao}|${item.mes ?? result.periodo}`))
        ?? retentionKeys.get(norm(`${item.nPreco}|${item.descricao}|`))
      return found ? { ...item, retencaoObservacao: found.retencaoObservacao, retencaoPercentual: found.retencaoPercentual } : item
    })
  }
  result.retencoes = buildSubRetencoes(result)
}

function parseSubCostSheet(wb: XLSX.WorkBook, sheetMatcher: RegExp): SubempreiteiroCustoLancamento[] {
  const rows: SubempreiteiroCustoLancamento[] = []
  const sheetNames = getSheetNamesByNorm(wb, sheetMatcher)
  for (const sheetName of sheetNames) {
  const raw = readRawWorksheet(wb, sheetName)
  if (raw.length < 2) continue
  const headerIdx = findHeaderRow(raw, (row) => /data|descricao|item|valor|total|qtde|qtd|quantidade/.test(row), 20)
  if (headerIdx < 0) continue
  const headers = raw[headerIdx] ?? []
  const idx = (patterns: RegExp[]) => findHeaderCol(headers, patterns)
  const iData = idx([/^data/, /emissao/])
  const iDesc = idx([/descri/, /material/, /item/, /maquina/, /servico/, /veiculo/])
  const iQtd = idx([/^qtd/, /qtde/, /quantidade/, /litros/, /dias/])
  const iUnit = idx([/valor.*unit/, /vl.*unit/, /custo.*unit/, /unit$/])
  const iTotal = idx([/valor.*total/, /vl.*total/, /^total$/, /valor final/])
  const iFornecedor = idx([/fornecedor/, /empresa/, /locadora/, /dono/])
  const iNf = idx([/^nf$/, /nfs/, /nota/])
  const iPlaca = idx([/placa/, /modelo/])
  const iOperador = idx([/operador/, /motorista/, /nome/])
  rows.push(...raw.slice(headerIdx + 1).map((row, offset) => {
    const descricao = iDesc >= 0 ? row[iDesc] : row.find((cell) => /[^\d\s.,;:/\\-]/.test(cell)) ?? ''
    const quantidade = iQtd >= 0 ? toNum(row[iQtd]) : 1
    const valorTotal = iTotal >= 0 ? toNum(row[iTotal]) : 0
    const valorUnitario = iUnit >= 0 ? toNum(row[iUnit]) : quantidade > 0 ? valorTotal / quantidade : valorTotal
    const total = valorTotal || quantidade * valorUnitario
    if (!descricao || /total|descricao|material|item/.test(norm(descricao)) || total === 0) return null
    return {
      id: makeLocalId('custo'),
      mes: '',
      data: iData >= 0 ? cellDateOrText(row[iData]) : '',
      descricao,
      quantidade,
      valorUnitario,
      valorTotal: total,
      fornecedor: iFornecedor >= 0 ? row[iFornecedor] : '',
      nf: iNf >= 0 ? row[iNf] : '',
      placa: iPlaca >= 0 ? row[iPlaca] : '',
      operador: iOperador >= 0 ? row[iOperador] : '',
      sourceSheet: sheetName,
      sourceRow: headerIdx + offset + 2,
      origem: 'Importação XLSX' as const,
      status: 'em_revisao' as const,
    }
  }).filter(Boolean) as SubempreiteiroCustoLancamento[])
  }
  return rows
}

function parseSubParametros(wb: XLSX.WorkBook, base: SubempreiteiroParseResult): SubempreiteiroParametroMensal[] {
  const raw = getSheetByNorm(wb, /^parametros?$/)
  if (raw.length === 0) return []
  const months = new Set<number>()
  for (let r = 0; r < Math.min(raw.length, 12); r += 1) {
    for (let c = 0; c < (raw[r]?.length ?? 0); c += 1) {
      if (normalizePeriodoLabel(raw[r][c])) months.add(c)
    }
  }
  return Array.from(months).map((col) => ({
    id: makeLocalId('param'),
    mes: normalizePeriodoLabel(raw[0]?.[col] ?? '') || base.periodo,
    empreiteiro: raw[1]?.[col] || base.nome,
    nucleo: raw[2]?.[col] || base.nucleo,
    contrato: raw[3]?.[col] || '',
    engenheiro: raw[4]?.[col] || '',
    gerenteProducao: raw[5]?.[col] || '',
    revisao: raw[6]?.[col] || '',
    data: cellDateOrText(raw[7]?.[col] || ''),
    status: (/prev/i.test(raw[8]?.[col] || '') ? 'previa' : 'fechado') as 'previa' | 'fechado',
  })).filter((item) => item.mes || item.empreiteiro || item.nucleo)
}

function parseSubParametrosFinanceiros(wb: XLSX.WorkBook, base: SubempreiteiroParseResult): SubempreiteiroParametroFinanceiro[] {
  const raw = getSheetByNorm(wb, /parametros?|fechamento|resumo/)
  if (raw.length === 0) return []
  const rows: SubempreiteiroParametroFinanceiro[] = []
  let mes = base.periodo
  for (const row of raw) {
    const label = row.find((cell) => /[a-z]/.test(norm(cell))) ?? ''
    const labelNorm = norm(label)
    const monthCandidate = row.map(normalizePeriodoLabel).find(Boolean)
    if (monthCandidate) mes = monthCandidate
    if (!label || /descricao|valor|fornecedor|status|data/.test(labelNorm)) continue
    if (!/medicao|desconto|taxa|adiantamento|fechamento|ajuste|locacao|retencao|liberacao|saldo/.test(labelNorm)) continue
    const valueCell = row.slice(1).find((cell) => toNum(cell) !== 0 || /#error/i.test(cell))
    const tipo: SubempreiteiroParametroFinanceiro['tipo'] = /medicao aprovada/.test(labelNorm)
      ? 'aprovada'
      : /^medicao/.test(labelNorm)
        ? 'medicao'
        : /desconto|taxa|locacao/.test(labelNorm)
          ? 'desconto'
          : /adiantamento/.test(labelNorm)
            ? 'adiantamento'
            : /retencao/.test(labelNorm)
              ? 'retencao'
              : /liberacao|nf/.test(labelNorm)
                ? 'nf'
                : /saldo/.test(labelNorm)
                  ? 'saldo'
                  : /fechamento/.test(labelNorm)
                    ? 'fechamento'
                    : 'ajuste'
    rows.push({
      id: makeLocalId('paramfin'),
      mes,
      descricao: label,
      valor: /#error/i.test(valueCell ?? '') ? 0 : toNum(valueCell),
      tipo,
      origem: 'Importação XLSX',
    })
  }
  return rows
}

function parseSubDescontos(wb: XLSX.WorkBook): SubempreiteiroDescontoMensal[] {
  const raw = getSheetByNorm(wb, /^descontos$/)
  if (raw.length === 0) return []
  const headerIdx = findHeaderRow(raw, (row) => /^mes rh agregados/.test(row) || (/mes/.test(row) && /agregados/.test(row)), 10)
  if (headerIdx < 0) return []
  return raw.slice(headerIdx + 1).map((row) => {
    const mes = normalizePeriodoLabel(row[0]) || row[0]
    if (!mes) return null
    const values = row.slice(1, 12).map(toNum)
    const total = values.reduce((sum, value) => sum + value, 0)
    if (total === 0) return null
    return {
      id: makeLocalId('desc'),
      mes,
      rh: values[0] ?? 0,
      agregados: values[1] ?? 0,
      materiaisFerramentas: values[2] ?? 0,
      materiaisEpi: values[3] ?? 0,
      maquinas: values[4] ?? 0,
      servicos: values[5] ?? 0,
      veiculos: values[6] ?? 0,
      combustivel: values[7] ?? 0,
      abastecimentoComboio: values[8] ?? 0,
      locEquipamentos: values[9] ?? 0,
      epi: values[10] ?? 0,
      total,
      origem: 'Importação XLSX' as const,
    }
  }).filter(Boolean) as SubempreiteiroDescontoMensal[]
}

function parseSubRh(wb: XLSX.WorkBook): SubempreiteiroRhMensal[] {
  const raw = getSheetByNorm(wb, /^rh$/)
  if (raw.length < 3) return []
  const monthRow = raw[1] ?? []
  const monthCols = monthRow.map((value, col) => ({ col, mes: normalizePeriodoLabel(value) || value })).filter((item) => item.col > 0 && item.mes)
  const rowByLabel = (pattern: RegExp) => raw.find((row) => pattern.test(norm(row[0] ?? ''))) ?? []
  const clt = rowByLabel(/funcionarios clt/)
  const pj = rowByLabel(/funcionarios pj/)
  const adiantamento = rowByLabel(/adiantamento/)
  const folha = rowByLabel(/folha salarial/)
  const folhaPj = rowByLabel(/folha pj/)
  const inss = rowByLabel(/inss/)
  return monthCols.map(({ col, mes }) => {
    const total = [adiantamento, folha, folhaPj, inss].reduce((sum, row) => sum + toNum(row[col]), 0)
    return {
      id: makeLocalId('rh'),
      mes,
      funcionariosClt: toNum(clt[col]),
      funcionariosPj: toNum(pj[col]),
      adiantamento: toNum(adiantamento[col]),
      folhaSalarial: toNum(folha[col]),
      folhaPj: toNum(folhaPj[col]),
      inss: toNum(inss[col]),
      total,
      origem: 'Importação XLSX' as const,
    }
  }).filter((item) => item.total > 0 || item.funcionariosClt > 0 || item.funcionariosPj > 0)
}

function parseSubNfs(wb: XLSX.WorkBook): SubempreiteiroNotaFiscal[] {
  const rows: SubempreiteiroNotaFiscal[] = []
  for (const sheetName of getSheetNamesByNorm(wb, /^(nfs|nfs pg|notas fiscais|nf)(\s|$)/)) {
  const raw = readRawWorksheet(wb, sheetName)
  if (raw.length < 2) continue
  rows.push(...raw.slice(1).map((row, offset) => {
    const valorNf = toNum(row[4])
    const numero = row[1]?.trim()
    if (!numero && valorNf <= 0) return null
    const statusNorm = norm(row[9])
    const status = statusNorm.includes('glos') ? 'GLOSADA'
      : statusNorm.includes('apro') ? 'APROVADA'
        : statusNorm.includes('paga') ? 'PAGA'
          : statusNorm.includes('pend') ? 'PENDENTE'
            : 'ENVIADA'
    return {
      id: makeLocalId('nf'),
      numero: numero || '',
      fornecedor: row[2] || '',
      observacao: row[3] || '',
      valorNf,
      valorPago: toNum(row[5]),
      dataEmissao: cellDateOrText(row[6] || ''),
      vencimento: cellDateOrText(row[7] || ''),
      competencia: normalizePeriodoLabel(row[8]) || row[8] || '',
      status,
      dataPagamento: cellDateOrText(row[10] || ''),
      sourceSheet: sheetName,
      sourceRow: offset + 2,
      origem: 'Importação XLSX' as const,
    }
  }).filter(Boolean) as SubempreiteiroNotaFiscal[])
  }
  return rows
}

function parseRetentionPercent(text: string) {
  const match = text.match(/(\d+(?:[,.]\d+)?)\s*%/)
  return match ? toNum(match[1]) : undefined
}

function parseSubItensRetencao(wb: XLSX.WorkBook, defaultPeriodo: string): SubempreteiroItem[] {
  const raw = getSheetByNorm(wb, /^itens retencao$/)
  if (raw.length === 0) return []
  const headerIdx = findHeaderRow(raw, (row) => /descricao.*servico/.test(row) && /qntd|qtd/.test(row), 20)
  if (headerIdx < 0) return []
  const periodRow = raw[Math.max(0, headerIdx - 1)] ?? []
  const headers = raw[headerIdx] ?? []
  const pairs: Array<{ qtd: number; total: number; mes: string }> = []
  for (let col = 0; col < headers.length; col += 1) {
    if (!/qntd|qtd|quant/.test(norm(headers[col]))) continue
    const total = headers.slice(col, col + 3).findIndex((h) => /preco total|valor|total/.test(norm(h)))
    pairs.push({ qtd: col, total: total >= 0 ? col + total : col + 1, mes: normalizePeriodoLabel(periodRow[col]) || defaultPeriodo })
  }
  const items: SubempreteiroItem[] = []
  for (let rowIndex = headerIdx + 1; rowIndex < raw.length; rowIndex += 1) {
    const row = raw[rowIndex]
    const descricao = row[1] || ''
    const nPreco = row[2] || row[0] || ''
    if (!descricao || /total|descricao/.test(norm(descricao))) continue
    const obs = row.find((cell) => /retencao|reten/.test(norm(cell))) ?? ''
    for (const pair of pairs) {
      const qtd = toNum(row[pair.qtd])
      const total = toNum(row[pair.total])
      if (qtd <= 0 && total <= 0) continue
      items.push(withSabespCode({
        id: makeLocalId('retitem'),
        nPreco,
        nPrecoSabesp: nPreco,
        descricao,
        unidade: row[3] || 'UN',
        qtd,
        valorUnitario: qtd > 0 ? total / qtd : 0,
        mes: pair.mes,
        origem: 'Importação XLSX',
        retencaoObservacao: obs || 'Item com retenção',
        retencaoPercentual: parseRetentionPercent(obs),
      }))
    }
  }
  return items
}

function parseSubRetencaoDetalhada(wb: XLSX.WorkBook, defaultPeriodo: string): SubempreiteiroRetencaoDetalhada[] {
  const raw = getSheetByNorm(wb, /retencao|reten|itens retencao/)
  if (raw.length === 0) return []
  const headerIdx = findHeaderRow(raw, (row) => /descricao.*servico/.test(row) && /n.*preco|preco/.test(row), 30)
  if (headerIdx < 0) return []
  const headers = raw[headerIdx] ?? []
  const idx = (patterns: RegExp[]) => findHeaderCol(headers, patterns)
  const iItem = idx([/^item$/, /^cod/])
  const iDesc = idx([/descri/, /servico/])
  const iNPreco = idx([/n.*preco/])
  const iUn = idx([/^unid?$/, /^und$/])
  const iQtd = idx([/qntd|qtd|quant/])
  const iTotal = idx([/preco.*total|valor.*total|total/])
  const iObs = idx([/observ/])
  const periodRow = raw[Math.max(0, headerIdx - 1)] ?? []
  const mes = periodRow.map(normalizePeriodoLabel).find(Boolean) || defaultPeriodo
  return raw.slice(headerIdx + 1).map((row) => {
    const descricao = iDesc >= 0 ? row[iDesc] : ''
    if (!descricao || /total|descricao/.test(norm(descricao))) return null
    const qtd = iQtd >= 0 ? toNum(row[iQtd]) : 0
    const precoTotal = iTotal >= 0 ? toNum(row[iTotal]) : 0
    const obs = iObs >= 0 ? row[iObs] : row.find((cell) => /retencao|reten/.test(norm(cell))) ?? ''
    return {
      id: makeLocalId('retdet'),
      mes,
      item: iItem >= 0 ? row[iItem] : '',
      descricao,
      nPreco: iNPreco >= 0 ? row[iNPreco] : '',
      unidade: iUn >= 0 ? row[iUn] || 'UN' : 'UN',
      qtd,
      precoTotal,
      fisicoMes: qtd,
      fisicoAcumulado: qtd,
      financeiroMes: precoTotal,
      financeiroAcumulado: precoTotal,
      percentualFisico: 0,
      percentualFinanceiro: 0,
      retencaoPercentual: parseRetentionPercent(obs),
      observacoes: obs,
      origem: 'Importação XLSX' as const,
    }
  }).filter(Boolean) as SubempreiteiroRetencaoDetalhada[]
}

function parseSubDetalhadoMensal(wb: XLSX.WorkBook, defaultPeriodo: string): SubempreiteiroDetalhadoMensal[] {
  const rows: SubempreiteiroDetalhadoMensal[] = []
  const sheetNames = getSheetNamesByNorm(wb, /detalhado|controle.*medicao|medicao.*empreiteiro|^medicao(\s|$)/)
  for (const sheetName of sheetNames) {
  const raw = readRawWorksheet(wb, sheetName)
  if (raw.length === 0) continue
  const headerIdx = findHeaderRow(raw, (row) => /descricao.*servico/.test(row) && /qtd|quant|preco/.test(row), 35)
  if (headerIdx < 0) continue
  const headers = raw[headerIdx] ?? []
  const idx = (patterns: RegExp[]) => findHeaderCol(headers, patterns)
  const iItem = idx([/^item$/, /^cod/])
  const iDesc = idx([/descri/, /servico/])
  const iNPreco = idx([/n.*preco/])
  const iUn = idx([/^unid?$/, /^und$/])
  const iQtdContrato = idx([/qtd.*contratada/, /contratada/])
  const iUnit = idx([/preco.*unit/, /valor.*unit/])
  const iTotal = idx([/preco.*total.*empreiteiro/, /total.*empreiteiro/])
  const iQtdMes = idx([/qntd|qtd|quant/])
  const iTotalMes = idx([/preco total\d*$/, /valor.*total/, /^total$/])
  const iObs = idx([/observ/])
  const periodRow = raw[Math.max(0, headerIdx - 1)] ?? []
  const mes = periodRow.map(normalizePeriodoLabel).find(Boolean) || defaultPeriodo
  rows.push(...raw.slice(headerIdx + 1).map((row, offset) => {
    const descricao = iDesc >= 0 ? row[iDesc] : ''
    if (!descricao || /total|descricao/.test(norm(descricao))) return null
    const qtdContratada = iQtdContrato >= 0 ? toNum(row[iQtdContrato]) : 0
    const precoUnitario = iUnit >= 0 ? toNum(row[iUnit]) : 0
    const qtdMes = iQtdMes >= 0 ? toNum(row[iQtdMes]) : 0
    const precoTotalMes = iTotalMes >= 0 ? toNum(row[iTotalMes]) : qtdMes * precoUnitario
    const precoTotal = iTotal >= 0 ? toNum(row[iTotal]) : qtdContratada * precoUnitario
    return {
      id: makeLocalId('det'),
      mes,
      item: iItem >= 0 ? row[iItem] : '',
      descricao,
      nPreco: iNPreco >= 0 ? row[iNPreco] : '',
      unidade: iUn >= 0 ? row[iUn] || 'UN' : 'UN',
      qtdContratada,
      precoUnitario,
      precoTotal,
      qtdMes,
      precoTotalMes,
      fisicoMes: qtdMes,
      fisicoAcumulado: qtdMes,
      financeiroMes: precoTotalMes,
      financeiroAcumulado: precoTotalMes,
      percentualFisico: 0,
      percentualFinanceiro: 0,
      observacoes: iObs >= 0 ? row[iObs] : '',
      sourceSheet: sheetName,
      sourceRow: headerIdx + offset + 2,
      origem: 'Importação XLSX' as const,
      status: 'em_revisao' as const,
    }
  }).filter(Boolean) as SubempreiteiroDetalhadoMensal[])
  }
  return rows
}

function buildSubRetencoes(result: SubempreiteiroParseResult): SubempreiteiroRetencaoMensal[] {
  const months = new Set<string>([
    result.periodo,
    ...(result.parametros ?? []).map((item) => item.mes),
    ...(result.itens ?? []).map((item) => item.mes ?? ''),
  ].filter(Boolean))
  let saldo = 0
  return Array.from(months).sort().map((mes) => {
    const retidoPorItem = result.itens
      .filter((item) => (item.mes || result.periodo) === mes && (item.retencaoPercentual || item.retencaoObservacao))
      .reduce((sum, item) => {
        const percent = item.retencaoPercentual ?? 0
        return sum + (percent > 0 ? item.qtd * item.valorUnitario * (percent / 100) : 0)
      }, 0)
    const valorRetido = mes === result.periodo && result.totals.retencao > 0 ? result.totals.retencao : retidoPorItem
    const valorLiberado = (result.nfs ?? []).filter((nf) => normalizePeriodoLabel(nf.competencia) === mes).reduce((sum, nf) => sum + nf.valorPago, 0)
    const saldoAnterior = saldo
    const saldoFinal = saldoAnterior + valorRetido - valorLiberado
    saldo = saldoFinal
    return {
      id: makeLocalId('ret'),
      mes,
      valorRetido,
      valorLiberado,
      saldoAnterior,
      saldoFinal,
      observacao: 'Saldo calculado pela medição, retenção explícita e liberação de NF.',
      origem: 'Importação XLSX' as const,
    }
  })
}

function parseSubempreiteiroSheetOptimized(wb: XLSX.WorkBook): SubempreiteiroParseResult {
  const result: SubempreiteiroParseResult = {
    nome:   'Subempreiteiro',
    nucleo: '',
    periodo: '',
    itens:  [],
    totals: { totalMedido: 0, totalAprovado: 0, retencao: 0 },
    warnings: collectWorkbookFormulaIssues(wb),
    errors: [],
  }

  const sheets = wb.SheetNames.map((name) => ({ name, raw: readRawWorksheet(wb, name) }))

  for (const { name, raw } of sheets) {
    const summaryLike = /resumo|fechamento/.test(norm(name))
    for (let i = 0; i < Math.min(raw.length, 35); i += 1) {
      const cells = raw[i].filter(Boolean)
      if (cells.length === 0) continue
      const rowNorm = norm(cells.join(' '))

      const labeledName = findLabelValue(cells, [/empreiteiro/, /subempreiteiro/, /contratada/])
      if (!result.nome || result.nome === 'Subempreiteiro') {
        result.nome = labeledName || pickCompanyCandidate(cells) || result.nome
      }

      const labeledNucleo = findLabelValue(cells, [/obra.*nucleo/, /^nucleo$/, /nucleo/])
      if (!result.nucleo) result.nucleo = labeledNucleo || pickNucleoCandidate(cells)

      if (!result.periodo) {
        const periodo = cells.map(normalizePeriodoLabel).find(Boolean)
        if (periodo) result.periodo = periodo
      }

      if (summaryLike && /medicao\s+aprovada/.test(rowNorm)) {
        result.totals.totalAprovado = Math.abs(firstReasonableMoney(cells))
      } else if (summaryLike && (/^retencao\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/.test(rowNorm) || /^retencao$/.test(rowNorm))) {
        result.totals.retencao = Math.abs(firstReasonableMoney(cells))
      } else if (summaryLike && /^medicao\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/.test(rowNorm)) {
        result.periodo = normalizePeriodoLabel(cells.join(' ')) || result.periodo
        result.totals.totalMedido = Math.abs(firstReasonableMoney(cells))
      }
    }
  }

  const measurementNames = subMeasurementSheetNames(wb)
  const candidateNames = new Set(measurementNames.length > 0 ? measurementNames : wb.SheetNames)
  const candidates = sheets
    .filter(({ raw }) => raw.length > 0)
    .filter(({ name }) => candidateNames.has(name))
    .sort((a, b) => normalizeSheetPriority(a.name) - normalizeSheetPriority(b.name))

  for (const { name, raw } of candidates) {
    const headerIdx = findHeaderRow(raw, (rowNorm) => /n\s*preco|n preco|descricao do servico/.test(rowNorm) && /qntd|qtd|quant/.test(rowNorm))
    if (headerIdx < 0) continue

    const periodRow = raw[Math.max(0, headerIdx - 1)] ?? []
    const headers = raw[headerIdx] ?? []
    const monthCols = findMonthPair(periodRow, headers, result.periodo)

    const idxNPrecoExact = findHeaderCol(headers, [/n\s*preco/, /^n preco$/, /n\.?\s*preco/])
    const idxNPreco = idxNPrecoExact >= 0 ? idxNPrecoExact : findHeaderCol(headers, [/^item$/, /^cod/])
    const idxDesc = findHeaderCol(headers, [/descricao.*servico/, /^descricao$/, /servico/])
    const idxUn = findHeaderCol(headers, [/^unid$/, /^un$/, /^und$/])
    const idxVlUnit = findHeaderCol(headers, [/preco unit/, /valor unit/, /^p unit/])
    const idxQtdMesAtual = findHeaderCol(headers, [/mes atual.*fisico/])
    const idxValorMesAtual = findHeaderCol(headers, [/mes atual.*financeiro/])

    const idxQtd = monthCols.qtd >= 0 ? monthCols.qtd : idxQtdMesAtual
    const idxTotal = monthCols.total >= 0 ? monthCols.total : idxValorMesAtual
    if (idxDesc < 0 || idxQtd < 0 || idxTotal < 0) continue

    const items: SubempreteiroItem[] = []
    const sheetNucleo = nucleoFromSheetName(name, result.nucleo)
    for (let i = headerIdx + 1; i < raw.length; i += 1) {
      const cells = raw[i]
      const rowNorm = norm(cells.join(' '))
      if (!rowNorm) continue
      if (/^(total|subtotal|retencao|observacao|assinatura)/.test(rowNorm)) continue

      const descricao = idxDesc >= 0 ? cells[idxDesc].trim() : ''
      const nPreco = idxNPreco >= 0 ? cells[idxNPreco].trim() : ''
      const qtd = toNum(cells[idxQtd])
      const totalVal = toNum(cells[idxTotal])
      if ((!descricao && !nPreco) || qtd <= 0 || totalVal <= 0) continue
      if (/descricao|servico|total|subtotal/.test(norm(descricao))) continue

      const valorUnitarioPlanilha = idxVlUnit >= 0 ? toNum(cells[idxVlUnit]) : 0
      const valorUnitario = valorUnitarioPlanilha > 0 ? valorUnitarioPlanilha : totalVal / qtd
      items.push(withSabespCode({
        nPreco,
        nPrecoSabesp: nPreco,
        descricao,
        unidade: idxUn >= 0 ? cells[idxUn].trim() || 'UN' : 'UN',
        qtd,
        valorUnitario,
        mes: result.periodo,
        nucleo: sheetNucleo,
        sourceKey: `${name}:${i + 1}`,
      }))
    }

    if (items.length > 0) {
      result.itens.push(...items)
    }
  }

  if (!result.periodo) {
    const allRows = sheets.flatMap((sheet) => sheet.raw.slice(0, 40))
    result.periodo = allRows.flatMap((row) => row.map(normalizePeriodoLabel)).find(Boolean) ?? ''
  }
  if (!result.nucleo) result.nucleo = 'Nao informado'
  if (!result.nome || result.nome === 'Subempreiteiro') result.nome = wb.SheetNames[0] ?? 'Subempreiteiro'
  if (result.totals.totalMedido === 0 && result.itens.length > 0) {
    result.totals.totalMedido = result.itens.reduce((sum, item) => sum + item.qtd * item.valorUnitario, 0)
  }
  if (result.totals.totalAprovado === 0) result.totals.totalAprovado = result.totals.totalMedido

  if (result.itens.length === 0) {
    result.errors.push('Nenhum item de medicao de subempreiteiro encontrado nas abas detalhadas.')
  }
  return result
}

/**
 * Parses a subcontractor measurement sheet (e.g., VIALTA medição).
 *
 * Strategy:
 * 1. Extract company metadata from the first ~10 rows (name, period, nucleo)
 * 2. Find the data header row by scanning for rows with "descri" or "quant" or "unit"
 * 3. Parse items below the header
 * 4. Auto-compute totals if not present in the sheet
 *
 * Handles multiple sheets by returning the combined result.
 */
function parseSubempreiteiroSheetLegacy(wb: XLSX.WorkBook): SubempreiteiroParseResult {
  const result: SubempreiteiroParseResult = {
    nome:   wb.SheetNames[0] ?? 'Subempreiteiro',
    nucleo: '',
    periodo: '',
    itens:  [],
    totals: { totalMedido: 0, totalAprovado: 0, retencao: 0 },
    warnings: collectWorkbookFormulaIssues(wb),
    errors: [],
  }

  // Try all sheets, use first that has items
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as unknown[][]
    if (raw.length === 0) continue

    // ── Extract metadata from first 12 rows ──────────────────────────────────
    for (let i = 0; i < Math.min(raw.length, 12); i++) {
      const cells = raw[i].map(toStr).filter(Boolean)
      if (cells.length === 0) continue
      const rowStr = cells.join(' ')

      // Period: look for month/year patterns like "fev/26", "FEVEREIRO/2026", "MED. 08", "02/2026"
      if (!result.periodo) {
        const periodMatch = rowStr.match(
          /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*[\s/.-]*(\d{2,4})/i
        ) || rowStr.match(/\b(0[1-9]|1[0-2])\/(\d{4})\b/)
          || rowStr.match(/\bmed[\s.]*(\d+)\b/i)
        if (periodMatch) result.periodo = periodMatch[0].trim()
      }

      // Nucleo: look for city/region names or "nucleo" keyword
      if (!result.nucleo) {
        const nuMatch = rowStr.match(/n[uú]cleo[:\s]+([A-Za-zÀ-ÿ\s]+)/i)
        if (nuMatch) result.nucleo = nuMatch[1].trim().split(/\s+/).slice(0, 2).join(' ')
      }

      // Company name: first non-empty row that looks like a company/header (not all numbers)
      if (result.nome === wb.SheetNames[0] && cells.length >= 1 && !/^\d/.test(cells[0])) {
        // A likely title row: non-numeric first cell, row has few items (not a data row)
        if (cells.length <= 4 && cells[0].length > 3) {
          result.nome = cells[0]
        }
      }
    }

    // ── Extract financial summary values (SLNR FECHAMENTO format) ────────────
    for (let i = 0; i < raw.length; i++) {
      const cells = raw[i].map(toStr)
      const rowStr = cells.join(' ').toLowerCase()
      // Look for key-value pairs like "Medição fev/26 | 398.835,64"
      if (/medi[çc][aã]o\s*aprovada/i.test(rowStr)) {
        for (const c of cells) { const v = toNum(c); if (v > 0 && v < 100_000_000_000) { result.totals.totalAprovado = v; break } }
      }
      if (/reten[çc][aã]o\s*(fev|mar|abr|jan|mai|jun|jul|ago|set|out|nov|dez)/i.test(rowStr)) {
        for (const c of cells) { const v = toNum(c); if (v > 0 && v < 100_000_000_000) { result.totals.retencao = v; break } }
      }
      if (/^medi[çc][aã]o\s*(fev|mar|abr|jan|mai|jun|jul|ago|set|out|nov|dez)/i.test(rowStr.trim()) && result.totals.totalMedido === 0) {
        for (const c of cells) { const v = toNum(c); if (v > 0 && v < 100_000_000_000) { result.totals.totalMedido = v; break } }
      }
    }

    // ── Find header row ────────────────────────────────────────────────────────
    let headerIdx = -1
    for (let i = 0; i < Math.min(raw.length, 20); i++) {
      const rowStr = raw[i].map(toStr).join(' ').toLowerCase()
      if (
        (rowStr.includes('descri') || rowStr.includes('servico') || rowStr.includes('especif')) &&
        (rowStr.includes('unit') || rowStr.includes('qtd') || rowStr.includes('quant') || rowStr.includes('valor'))
      ) {
        headerIdx = i
        break
      }
      // Also match rows with "n. preço" or "item" as first column signal
      if (/n[\s.]?pre/i.test(rowStr) && /descri/i.test(rowStr)) {
        headerIdx = i
        break
      }
    }

    // ── Parse using detected header ────────────────────────────────────────────
    if (headerIdx >= 0) {
      const headers = raw[headerIdx].map(toStr)
      const idx = (matchers: RegExp[]): number =>
        headers.findIndex((h) => matchers.some((re) => re.test(norm(h))))

      const idxNPrecoExact = idx([/n[\s.]?pre/])
      const idxNPreco = idxNPrecoExact >= 0 ? idxNPrecoExact : idx([/^item$/, /^cod/])
      const idxDesc     = idx([/descri/, /servico/, /especif/])
      const idxUn       = idx([/^un(id)?$/, /^und$/, /^medida$/])
      const idxQtd      = idx([/^qtd/, /^quant/, /quantidade/])
      const idxVlUnit   = idx([/vl.*unit/, /valor.*unit/, /prec.*unit/, /p[\s.]?unit/])
      const idxTotal    = idx([/^total$/, /vl.*total/, /valor.*total/])
      const idxAprovado = idx([/aprovado/])
      const idxRetencao = idx([/retenc/, /reten/])

      const sheetItens: SubempreteiroItem[] = []

      for (let i = headerIdx + 1; i < raw.length; i++) {
        const cells = raw[i]
        const rowStr = cells.map(toStr).join(' ').toLowerCase()

        // Detect totals rows
        if (/total\s*(medido|aprovado|geral)?/.test(rowStr)) {
          if (idxTotal >= 0) {
            const tv = toNum(cells[idxTotal])
            if (tv > 0) result.totals.totalMedido = tv
          }
          if (idxAprovado >= 0) {
            const av = toNum(cells[idxAprovado])
            if (av > 0) result.totals.totalAprovado = av
          }
          if (idxRetencao >= 0) {
            const rv = toNum(cells[idxRetencao])
            if (rv > 0) result.totals.retencao = rv
          }
          continue
        }

        const nPreco    = idxNPreco  >= 0 ? toStr(cells[idxNPreco])  : ''
        const descricao = idxDesc    >= 0 ? toStr(cells[idxDesc])    : ''
        const unidade   = idxUn      >= 0 ? toStr(cells[idxUn]) || 'M' : 'M'
        let   qtd       = idxQtd     >= 0 ? toNum(cells[idxQtd])    : 0
        let   vlUnit    = idxVlUnit  >= 0 ? toNum(cells[idxVlUnit])  : 0
        const totalVal  = idxTotal   >= 0 ? toNum(cells[idxTotal])   : 0

        if (!descricao && !nPreco) continue
        // Skip rows that are sub-headers or summary rows
        if (norm(descricao).includes('descri') || norm(descricao).includes('total')) continue

        // For financial summary items (Adiantamento, Retenção, etc.):
        // If qty is 0 but total column has a value, treat as global value
        if (qtd === 0 && vlUnit === 0 && totalVal !== 0) {
          qtd = 1
          vlUnit = totalVal
        }
        // Also handle: if qty > 0 but vlUnit is 0 and total exists, derive vlUnit
        if (qtd > 0 && vlUnit === 0 && totalVal !== 0) {
          vlUnit = totalVal / qtd
        }

        sheetItens.push(withSabespCode({ nPreco, nPrecoSabesp: nPreco, descricao, unidade, qtd, valorUnitario: vlUnit }))
      }

      if (sheetItens.length > 0) {
        result.itens = sheetItens
        break  // Found a valid sheet with items
      }
    } else {
      // Fallback: use sheet_to_json with auto headers
      const rows = getRows(wb)
      if (rows.length > 0) {
        const sample = rows[0] ?? {}
        const colNPreco = findCol(sample, ['n preco', 'npreco', 'item', 'codigo', 'cod'])
        const colDesc   = findCol(sample, ['descricao', 'descr', 'servico', 'especificacao'])
        const colUn     = findCol(sample, ['un', 'unidade', 'und'])
        const colQtd    = findCol(sample, ['qtd', 'quantidade', 'quant', 'qtde'])
        const colVlUnit = findCol(sample, ['vl unit', 'valor unit', 'preco unit', 'p unit'])

        for (const row of rows) {
          const nPreco = colNPreco ? toStr(row[colNPreco]) : ''
          const descricao = colDesc ? toStr(row[colDesc]) : ''
          if (!nPreco && !descricao) continue
          result.itens.push(withSabespCode({
            nPreco,
            nPrecoSabesp: nPreco,
            descricao,
            unidade: colUn ? toStr(row[colUn]) || 'M' : 'M',
            qtd: colQtd ? toNum(row[colQtd]) : 0,
            valorUnitario: colVlUnit ? toNum(row[colVlUnit]) : 0,
          }))
        }
        if (result.itens.length > 0) break
      }
    }
  }

  // ── Auto-compute totals if not found in sheet ──────────────────────────────
  if (result.totals.totalMedido === 0 && result.itens.length > 0) {
    result.totals.totalMedido = result.itens.reduce((s, it) => s + it.qtd * it.valorUnitario, 0)
  }
  if (result.totals.totalAprovado === 0) {
    result.totals.totalAprovado = result.totals.totalMedido
  }

  if (result.itens.length === 0) {
    result.errors.push(
      'Nenhum item de medição encontrado. ' +
      'Verifique se a planilha possui colunas como: Nº Preço | Descrição | Un | Qtd | Vl. Unit.'
    )
  }

  return result
}

// ─── Fornecedor sheet parser ──────────────────────────────────────────────────

export interface FornecedorParseResult {
  list:   Omit<Fornecedor, 'id'>[]
  errors: string[]
}

function withFornecedorWorkbookWarnings(result: FornecedorParseResult, warnings: string[]) {
  if (warnings.length === 0) return result
  return {
    ...result,
    list: result.list.map((fornecedor) => ({
      ...fornecedor,
      importWarnings: Array.from(new Set([...(fornecedor.importWarnings ?? []), ...warnings])),
      status: 'pendente' as const,
    })),
  }
}

function newLocalId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function findAdjacentLabelValue(cells: string[], label: RegExp) {
  const idx = cells.findIndex((cell) => label.test(norm(cell)))
  if (idx < 0) return ''
  return cells.slice(idx + 1).find((cell) => cell.trim()) ?? ''
}

function parseSupplierResumo(wb: XLSX.WorkBook, defaultPeriodo: string) {
  const resumoName = wb.SheetNames.find((name) => /resumo/i.test(name))
  const raw = resumoName ? readRawWorksheet(wb, resumoName) : []
  const meta: Partial<Omit<Fornecedor, 'id'>> = { periodo: defaultPeriodo }
  const totals = {
    valorAprovado: 0,
    totalDescontos: 0,
    adiantamento: 0,
    fechamentoAnterior: 0,
    relatorio: 0,
    valorTotalMedicaoNf: 0,
  }

  for (const row of raw) {
    const cells = row.map(toStr)
    const rowNorm = norm(cells.join(' '))
    const mes = findAdjacentLabelValue(cells, /mes.*referencia/)
    const empresa = findAdjacentLabelValue(cells, /empresa|fornecedor|contratada/)
    const obraNucleo = findAdjacentLabelValue(cells, /obra.*nucleo|nucleo/)
    const contrato = findAdjacentLabelValue(cells, /contrato/)
    const medicao = findAdjacentLabelValue(cells, /^medicao/)
    const periodo = findAdjacentLabelValue(cells, /periodo/)
    const responsavel = findAdjacentLabelValue(cells, /responsavel/)
    const setor = findAdjacentLabelValue(cells, /setor/)
    const revisao = findAdjacentLabelValue(cells, /revisao/)
    const data = findAdjacentLabelValue(cells, /^data$/)

    if (mes) meta.mesReferencia = normalizePeriodoLabel(mes) || mes
    if (empresa) {
      meta.nome = empresa
      meta.empresa = empresa
    }
    if (obraNucleo) meta.obraNucleo = obraNucleo
    if (contrato) meta.contrato = contrato
    if (medicao) meta.medicao = medicao
    if (periodo) meta.periodo = periodo
    if (responsavel) meta.responsavel = responsavel
    if (setor) meta.setor = setor
    if (revisao) meta.numeroRevisao = revisao
    if (data) meta.data = data

    const value = Math.abs(firstReasonableMoney(cells, 1))
    if (/trabalhos.*executados.*aprovados/.test(rowNorm)) totals.valorAprovado = value
    if (/total.*descontos/.test(rowNorm)) totals.totalDescontos = value
    if (/adiantamento/.test(rowNorm)) totals.adiantamento = value
    if (/fechamento.*anterior/.test(rowNorm)) totals.fechamentoAnterior = value
    if (/relatorio/.test(rowNorm)) totals.relatorio = value
    if (/valor.*total.*medicao.*nf|valor.*nf/.test(rowNorm)) totals.valorTotalMedicaoNf = value
  }

  const competencia = meta.mesReferencia || normalizePeriodoLabel(String(meta.periodo ?? '')) || defaultPeriodo
  return {
    ...meta,
    periodo: meta.periodo || competencia || defaultPeriodo,
    mesReferencia: competencia || defaultPeriodo,
    valorAprovado: totals.valorAprovado,
    totalDescontos: totals.totalDescontos,
    adiantamento: totals.adiantamento,
    fechamentoAnterior: totals.fechamentoAnterior,
    relatorio: totals.relatorio,
    valorTotalMedicaoNf: totals.valorTotalMedicaoNf,
  }
}

function parseFornecedorBoletimLines(wb: XLSX.WorkBook): NonNullable<Fornecedor['medicaoItens']> {
  const lines: NonNullable<Fornecedor['medicaoItens']> = []
  const detailNames = wb.SheetNames.filter((name) => !/resumo|^mc$|planilha|controle|cadastro|calendario|lista|base/i.test(name))

  for (const sheetName of detailNames) {
    const raw = readRawWorksheet(wb, sheetName)
    const headerIdx = findHeaderRow(raw, (rowNorm) => /item/.test(rowNorm) && /descricao/.test(rowNorm) && /empreiteiro/.test(rowNorm) && /nucleo/.test(rowNorm), 30)
    if (headerIdx < 0) continue

    for (let i = headerIdx + 1; i < raw.length; i += 1) {
      const row = raw[i]
      const rowNorm = norm(row.join(' '))
      if (!rowNorm || /unitario|anterior|acumulado|subtotal|observacoes|valor da medicao|total/.test(rowNorm)) continue
      const item = toStr(row[0])
      const descricao = toStr(row[1])
      const empreiteiro = toStr(row[2])
      const nucleo = toStr(row[3])
      const periodo = toStr(row[4])
      const unidade = toStr(row[5])
      const precoUnitario = toNum(row[6])
      const quantidadeAnterior = toNum(row[7])
      const quantidadeMes = toNum(row[8]) || (precoUnitario > 0 ? toNum(row[11]) / precoUnitario : 0)
      const quantidadeAcumulada = toNum(row[9])
      const valorAnterior = toNum(row[10])
      const valorMes = toNum(row[11]) || quantidadeMes * precoUnitario
      const valorAcumulado = toNum(row[12])
      if (!descricao || /descricao|locacao|caminhao|maquina|servico/.test(norm(item)) && !empreiteiro && !nucleo && precoUnitario <= 0) continue
      if (precoUnitario <= 0 && valorMes <= 0 && quantidadeMes <= 0) continue
      const pendencias = [
        !empreiteiro ? 'Sem empreiteiro' : '',
        !nucleo ? 'Sem nucleo' : '',
        !periodo ? 'Sem periodo' : '',
        precoUnitario <= 0 ? 'Sem preco unitario' : '',
        quantidadeMes <= 0 ? 'Sem quantidade no mes' : '',
      ].filter(Boolean)
      const blockingIssues = supplierBlockingIssues({
        fornecedor: empreiteiro,
        nucleo,
        periodo,
        precoUnitario,
        quantidade: quantidadeMes,
        valor: valorMes,
      })
      lines.push({
        id: newLocalId('forn-line'),
        item,
        descricao,
        empreiteiro,
        nucleo,
        periodo,
        unidade,
        precoUnitario,
        noMes: valorMes,
        total: valorMes,
        quantidadeAnterior,
        quantidadeMes,
        quantidadeAcumulada,
        valorAnterior,
        valorMes,
        valorAcumulado,
        origem: 'Boletim',
        pendencias,
        blockingIssues,
        sourceSheet: sheetName,
        sourceRow: i + 1,
      })
    }
    if (lines.length > 0) break
  }
  return lines
}

function parseFornecedorMemoryLines(wb: XLSX.WorkBook): NonNullable<Fornecedor['memoriaItens']> {
  const rows: NonNullable<Fornecedor['memoriaItens']> = []
  const mcNames = wb.SheetNames.filter((name) => /^mc$/i.test(name) || /^memoria/i.test(name))
  for (const sheetName of mcNames) {
    const raw = readRawWorksheet(wb, sheetName)
    const headerIdx = findHeaderRow(raw, (rowNorm) => /descricao/.test(rowNorm) && (/qntd|quantidade|valor/.test(rowNorm)), 25)
    if (headerIdx < 0) continue
    const header = raw[headerIdx].map(norm)
    const idx = (patterns: RegExp[], fallback: number) => {
      const found = header.findIndex((cell) => patterns.some((pattern) => pattern.test(cell)))
      return found >= 0 ? found : fallback
    }
    const iItem = idx([/^item$/], 0)
    const iDesc = idx([/descricao/], 1)
    const iNumero = idx([/numero/], 2)
    const iPlaca = idx([/placa|modelo/], 2)
    const iEmp = idx([/empreiteiro/], 2)
    const iNucleo = idx([/nucleo/], 3)
    const iInicio = idx([/inicio/], 4)
    const iTermino = idx([/termino/], 5)
    const iDias = idx([/total.*dias/], 6)
    const iUnid = idx([/unid/], 7)
    const iQtd = idx([/qntd|quantidade/], 8)
    const iValor = idx([/valor.*unit|valor$/], 9)
    const iFinal = idx([/valor.*final|total/], 10)

    for (let i = headerIdx + 1; i < raw.length; i += 1) {
      const row = raw[i]
      const rowNorm = norm(row.join(' '))
      if (!rowNorm || /empreiteiro|valor final|subtotal|total geral/.test(rowNorm)) continue
      const descricao = toStr(row[iDesc])
      const valorFinal = toNum(row[iFinal])
      const quantidade = toNum(row[iQtd])
      if (!descricao || (valorFinal <= 0 && quantidade <= 0)) continue
      rows.push({
        id: newLocalId('forn-mem'),
        item: toStr(row[iItem]),
        descricao,
        numero: toStr(row[iNumero]),
        placaModelo: toStr(row[iPlaca]),
        empreiteiro: toStr(row[iEmp]),
        nucleo: toStr(row[iNucleo]),
        dataInicio: toStr(row[iInicio]),
        dataTermino: toStr(row[iTermino]),
        totalDias: toNum(row[iDias]),
        unidade: toStr(row[iUnid]),
        quantidade,
        valorUnitario: toNum(row[iValor]),
        valorFinal,
        origem: sheetName,
        sourceSheet: sheetName,
        sourceRow: i + 1,
        blockingIssues: supplierBlockingIssues({
          fornecedor: toStr(row[iEmp]),
          nucleo: toStr(row[iNucleo]),
          precoUnitario: toNum(row[iValor]),
          quantidade,
          valor: valorFinal,
        }),
      })
    }
  }
  return rows
}

function parseSupplierControlWorkbook(wb: XLSX.WorkBook, defaultPeriodo = ''): FornecedorParseResult {
  const result: FornecedorParseResult = { list: [], errors: [] }
  const controlName = wb.SheetNames.find((name) => /controle.*medi/i.test(name))
  const monthlyName = wb.SheetNames.find((name) => /controle mensal/i.test(name))
  if (!controlName && !monthlyName) return result

  const bySupplier = new Map<string, Omit<Fornecedor, 'id'>>()
  const ensure = (name: string, periodo: string) => {
    const key = `${norm(name)}|${periodo || defaultPeriodo}`
    const current = bySupplier.get(key)
    if (current) return current
    const row: Omit<Fornecedor, 'id'> = {
      nome: name,
      empresa: name,
      periodo: periodo || defaultPeriodo,
      mesReferencia: periodo || defaultPeriodo,
      descricao: 'Medição importada do controle geral de subcontratados.',
      valorAprovado: 0,
      valorTotalMedicaoNf: 0,
      medicaoItens: [],
      controleLinhas: [],
      etapasAprovacao: parseApprovalStages(wb),
      servicosBase: parseBaseServices(wb),
      sourceSheets: wb.SheetNames,
      status: 'pendente',
      importWarnings: [],
    }
    bySupplier.set(key, row)
    return row
  }

  if (controlName) {
    const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[controlName], { defval: '' })
    for (const row of rows) {
      const subcontratado = toStr(row['Subcontratado'])
      if (!subcontratado) continue
      const periodo = toStr(row['Mês Referência']) || defaultPeriodo
      const fornecedor = ensure(subcontratado, periodo)
      const valor = toNum(row['Valor Medição (R$)'])
      fornecedor.valorAprovado = (fornecedor.valorAprovado || 0) + valor
      fornecedor.valorTotalMedicaoNf = (fornecedor.valorTotalMedicaoNf || 0) + valor
      fornecedor.descricao = toStr(row['Serviço']) || fornecedor.descricao
      fornecedor.obraNucleo = toStr(row['Núcleo']) || fornecedor.obraNucleo
      fornecedor.status = norm(row['Status']).includes('aprov') ? 'aprovado' : 'pendente'
      fornecedor.controleLinhas = [
        ...(fornecedor.controleLinhas ?? []),
        {
          id: newLocalId('forn-ctrl'),
          nucleo: toStr(row['Núcleo']),
          empreiteiro: toStr(row['Empreiteiro']),
          subcontratado,
          servico: toStr(row['Serviço']),
          mesReferencia: periodo,
          valorMedicao: valor,
          dataEntregaMedicao: toStr(row['Data Entrega Medição']),
          engenheiroValidou: toStr(row['Engenheiro Validou']),
          coordenacao: toStr(row['Coordenação']),
          gerencia: toStr(row['Gerência']),
          status: toStr(row['Status']),
          dataLimitePagamento: toStr(row['Data Limite P/ Pagamento']),
          diasEmAberto: toNum(row['Dias em Aberto']),
          observacoes: toStr(row['Observações']),
        },
      ]
      fornecedor.medicaoItens = [
        ...(fornecedor.medicaoItens ?? []),
        {
          id: newLocalId('forn-line'),
          item: String((fornecedor.medicaoItens?.length ?? 0) + 1),
          descricao: toStr(row['Serviço']) || 'Medição de fornecedor',
          empreiteiro: toStr(row['Empreiteiro']),
          nucleo: toStr(row['Núcleo']),
          periodo,
          unidade: 'VB',
          precoUnitario: valor,
          noMes: valor,
          total: valor,
          valorMes: valor,
          valorAcumulado: valor,
          origem: 'Controle',
        },
      ]
    }
  }

  if (monthlyName && bySupplier.size === 0) {
    const raw = readRawWorksheet(wb, monthlyName)
    const header = raw.find((row) => row.some((cell) => /competencia/i.test(cell))) ?? []
    const monthLabels = header.slice(2)
    for (const row of raw.slice(2)) {
      const name = toStr(row[0])
      const service = toStr(row[1])
      if (!name || /fornecedor/i.test(name)) continue
      monthLabels.forEach((month, index) => {
        const value = toNum(row[index + 2])
        if (value <= 0) return
        const fornecedor = ensure(name, toStr(month))
        fornecedor.descricao = service || fornecedor.descricao
        fornecedor.valorAprovado = (fornecedor.valorAprovado || 0) + value
        fornecedor.valorTotalMedicaoNf = (fornecedor.valorTotalMedicaoNf || 0) + value
      })
    }
  }

  result.list = Array.from(bySupplier.values())
  return result
}

function parseSupplierControlWorkbookV2(wb: XLSX.WorkBook, defaultPeriodo = ''): FornecedorParseResult {
  const result: FornecedorParseResult = { list: [], errors: [] }
  const controlName = wb.SheetNames.find((name) => /controle.*medi/i.test(name))
  if (!controlName) return parseSupplierControlWorkbook(wb, defaultPeriodo)

  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[controlName], { defval: '' })
  const bySupplier = new Map<string, Omit<Fornecedor, 'id'>>()
  const ensure = (name: string, periodo: string) => {
    const key = `${norm(name)}|${periodo || defaultPeriodo}`
    const current = bySupplier.get(key)
    if (current) return current
    const row: Omit<Fornecedor, 'id'> = {
      nome: name,
      empresa: name,
      periodo: periodo || defaultPeriodo,
      mesReferencia: periodo || defaultPeriodo,
      descricao: 'Medicao importada do controle geral de subcontratados.',
      valorAprovado: 0,
      valorTotalMedicaoNf: 0,
      medicaoItens: [],
      controleLinhas: [],
      etapasAprovacao: parseApprovalStages(wb),
      servicosBase: parseBaseServices(wb),
      sourceSheet: controlName,
      sourceSheets: wb.SheetNames,
      status: 'pendente',
      importWarnings: [],
      blockingIssues: [],
      parseConfidence: 100,
    }
    bySupplier.set(key, row)
    return row
  }

  rows.forEach((row, index) => {
    const subcontratado = toStr(rowValue(row, [/subcontratado/, /fornecedor/, /empresa/], ['Subcontratado']))
    if (!subcontratado) return
    const rawPeriodo = toStr(rowValue(row, [/mes.*referencia/, /competencia/, /periodo/], ['Mês Referência', 'MÃªs ReferÃªncia']))
    const periodo = normalizePeriodoLabel(rawPeriodo) || rawPeriodo || defaultPeriodo
    const valor = toNum(rowValue(row, [/valor.*medicao/, /valor/], ['Valor Medição (R$)', 'Valor MediÃ§Ã£o (R$)']))
    const nucleo = toStr(rowValue(row, [/nucleo/], ['Núcleo', 'NÃºcleo']))
    const empreiteiro = toStr(rowValue(row, [/empreiteiro/], ['Empreiteiro']))
    const servico = toStr(rowValue(row, [/servico/], ['Serviço', 'ServiÃ§o']))
    const status = toStr(rowValue(row, [/status/], ['Status']))
    const fornecedor = ensure(subcontratado, periodo)
    const rowIssues = supplierBlockingIssues({ fornecedor: subcontratado, nucleo, periodo, valor })

    fornecedor.valorAprovado = (fornecedor.valorAprovado || 0) + valor
    fornecedor.valorTotalMedicaoNf = (fornecedor.valorTotalMedicaoNf || 0) + valor
    fornecedor.descricao = servico || fornecedor.descricao
    fornecedor.obraNucleo = nucleo || fornecedor.obraNucleo
    fornecedor.status = norm(status).includes('aprov') ? 'aprovado' : 'pendente'
    fornecedor.blockingIssues = Array.from(new Set([...(fornecedor.blockingIssues ?? []), ...rowIssues]))
    fornecedor.parseConfidence = parseConfidenceFromIssues(5, fornecedor.blockingIssues.length)

    fornecedor.controleLinhas = [
      ...(fornecedor.controleLinhas ?? []),
      {
        id: newLocalId('forn-ctrl'),
        nucleo,
        empreiteiro,
        subcontratado,
        servico,
        mesReferencia: periodo,
        valorMedicao: valor,
        dataEntregaMedicao: toStr(rowValue(row, [/data.*entrega/], ['Data Entrega Medição', 'Data Entrega MediÃ§Ã£o'])),
        engenheiroValidou: toStr(rowValue(row, [/engenheiro.*validou/], ['Engenheiro Validou'])),
        coordenacao: toStr(rowValue(row, [/coordenacao/], ['Coordenação', 'CoordenaÃ§Ã£o'])),
        gerencia: toStr(rowValue(row, [/gerencia/], ['Gerência', 'GerÃªncia'])),
        status,
        dataLimitePagamento: toStr(rowValue(row, [/data.*limite/], ['Data Limite P/ Pagamento'])),
        diasEmAberto: toNum(rowValue(row, [/dias.*aberto/], ['Dias em Aberto'])),
        observacoes: toStr(rowValue(row, [/observacoes/], ['Observações', 'ObservaÃ§Ãµes'])),
        sourceSheet: controlName,
        sourceRow: index + 2,
        blockingIssues: rowIssues,
      },
    ]

    fornecedor.medicaoItens = [
      ...(fornecedor.medicaoItens ?? []),
      {
        id: newLocalId('forn-line'),
        item: String((fornecedor.medicaoItens?.length ?? 0) + 1),
        descricao: servico || 'Medicao de fornecedor',
        empreiteiro,
        nucleo,
        periodo,
        unidade: 'VB',
        precoUnitario: valor,
        noMes: valor,
        total: valor,
        valorMes: valor,
        valorAcumulado: valor,
        origem: 'Controle',
        sourceSheet: controlName,
        sourceRow: index + 2,
        blockingIssues: rowIssues,
        pendencias: rowIssues,
      },
    ]
  })

  result.list = Array.from(bySupplier.values()).map((fornecedor) => ({
    ...fornecedor,
    importWarnings: [
      ...(fornecedor.importWarnings ?? []),
      ...((fornecedor.blockingIssues ?? []).length ? [`Rascunho conferivel: ${(fornecedor.blockingIssues ?? []).join('; ')}`] : []),
    ],
  }))
  return result.list.length > 0 ? result : parseSupplierControlWorkbook(wb, defaultPeriodo)
}

function parseApprovalStages(wb: XLSX.WorkBook): Fornecedor['etapasAprovacao'] {
  const sheetName = wb.SheetNames.find((name) => /calendario|calendário/i.test(name))
  if (!sheetName) return []
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheetName], { defval: '' })
  return rows.map((row) => ({
    id: newLocalId('forn-stage'),
    etapa: toStr(row['Etapa']),
    responsavel: toStr(row['Responsável']),
    prazoLimite: toStr(row['Prazo limite (dia do mês)']),
    descricao: toStr(row['O que precisa ser enviado/validado']),
    status: 'pendente' as const,
  })).filter((row) => row.etapa)
}

function parseBaseServices(wb: XLSX.WorkBook): Fornecedor['servicosBase'] {
  const sheetName = wb.SheetNames.find((name) => /base.*serv/i.test(name))
  if (!sheetName) return []
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheetName], { defval: '' })
  return rows.map((row) => ({
    id: newLocalId('forn-base'),
    nome: toStr(row['NOME'] || row['Nome']),
    descricao: toStr(row['DESCRIÇÃO'] || row['Descrição']),
  })).filter((row) => row.nome || row.descricao)
}

function fornecedorDetailPriority(name: string) {
  const n = norm(name)
  if (/^wert/.test(n)) return 0
  if (/planilha/.test(n)) return 1
  if (/resumo/.test(n)) return 8
  return 4
}

function parseFornecedorDetailDescription(wb: XLSX.WorkBook) {
  const groups = new Map<string, { descricao: string; unidade: string; qtd: number; total: number }>()
  const sheets = wb.SheetNames
    .map((name) => ({ name, raw: readRawWorksheet(wb, name) }))
    .sort((a, b) => fornecedorDetailPriority(a.name) - fornecedorDetailPriority(b.name))

  for (const { name, raw } of sheets) {
    const headerIdx = findHeaderRow(raw, (rowNorm) => /descricao.*servicos|descricao dos servicos/.test(rowNorm) && /quantidades|valores/.test(rowNorm), 40)
    if (headerIdx < 0) continue
    const wertLayout = /^wert/.test(norm(name))

    for (let i = headerIdx + 1; i < raw.length; i += 1) {
      const cells = raw[i]
      const rowNorm = norm(cells.join(' '))
      if (!rowNorm || /subtotal|valor da medicao|total/.test(rowNorm)) continue

      const desc = (wertLayout ? cells[1] : cells[2] || cells[1] || '').trim()
      const unidade = (wertLayout ? cells[5] : cells[4] || cells[5] || '').trim()
      const qtd = wertLayout ? toNum(cells[8]) : toNum(cells[6])
      const total = wertLayout ? toNum(cells[11]) : toNum(cells[7])
      if (!desc || !unidade || qtd <= 0 || total <= 0) continue
      if (/item|descricao|empreiteiro|nucleo|periodo/.test(norm(desc))) continue

      const key = `${norm(desc)}|${norm(unidade)}`
      const current = groups.get(key)
      if (current) {
        current.qtd += qtd
        current.total += total
      } else {
        groups.set(key, { descricao: desc, unidade, qtd, total })
      }
    }

    if (groups.size > 0) break
  }

  return Array.from(groups.values())
    .map((item) => `${item.descricao}: ${formatQty(item.qtd)} ${item.unidade} (${formatMoney(item.total)})`)
    .join('; ')
}

export function parseFornecedorSheet(wb: XLSX.WorkBook, defaultPeriodo = ''): FornecedorParseResult {
  const workbookWarnings = collectWorkbookFormulaIssues(wb)
  const control = parseSupplierControlWorkbookV2(wb, defaultPeriodo)
  if (control.list.length > 0) return withFornecedorWorkbookWarnings(control, workbookWarnings)

  const parsed = parseFornecedorSheetOptimized(wb, defaultPeriodo)
  if (parsed.list.length > 0) return withFornecedorWorkbookWarnings(parsed, workbookWarnings)
  return withFornecedorWorkbookWarnings(parseFornecedorSheetLegacy(wb, defaultPeriodo), workbookWarnings)
}

function parseFornecedorSheetOptimized(wb: XLSX.WorkBook, defaultPeriodo = ''): FornecedorParseResult {
  const result: FornecedorParseResult = { list: [], errors: [] }
  const sheets = wb.SheetNames.map((name) => ({ name, raw: readRawWorksheet(wb, name) }))
  if (sheets.every((sheet) => sheet.raw.length === 0)) {
    result.errors.push('Planilha vazia.')
    return result
  }

  const resumo = parseSupplierResumo(wb, defaultPeriodo)
  let nome = resumo.nome ?? ''
  let periodo = resumo.mesReferencia || resumo.periodo || defaultPeriodo
  let valorAprovado = resumo.valorAprovado ?? 0

  for (const { raw } of sheets) {
    for (let i = 0; i < Math.min(raw.length, 45); i += 1) {
      const cells = raw[i].filter(Boolean)
      if (cells.length === 0) continue
      const rowNorm = norm(cells.join(' '))

      const labeledName = findLabelValue(cells, [/fornecedor/, /contratada/, /empresa/])
      if (!nome) {
        const company = cells.find((cell) => /ltda|ambiental|consultoria|gerenciamento|wert/i.test(cell) && !normalizePeriodoLabel(cell))
        nome = labeledName || company || nome
      }

      if (!periodo || periodo === defaultPeriodo) {
        const rowPeriodo = cells.map(normalizePeriodoLabel).find(Boolean)
        if (rowPeriodo && (rowPeriodo.includes('/') || !periodo)) periodo = rowPeriodo
      }

      if (/trabalhos executados aprovados|valor medicao|valor da medicao|valor nf|relatorio/.test(rowNorm)) {
        const value = Math.abs(firstReasonableMoney(cells))
        if (value > 0) valorAprovado = valorAprovado > 0 ? Math.max(valorAprovado, value) : value
        const rowPeriodo = cells.map(normalizePeriodoLabel).find(Boolean)
        if (rowPeriodo && (rowPeriodo.includes('/') || !periodo || periodo === defaultPeriodo)) periodo = rowPeriodo
      }
    }
  }

  const medicaoItens = parseFornecedorBoletimLines(wb)
  const memoriaItens = parseFornecedorMemoryLines(wb)
  const descricao = parseFornecedorDetailDescription(wb)
  if (!nome) nome = wb.SheetNames.find((name) => !/resumo|planilha/i.test(name)) ?? wb.SheetNames[0] ?? 'Fornecedor'

  const boletimTotal = medicaoItens.reduce((sum, item) => sum + (Number(item.valorMes ?? item.total) || 0), 0)
  const memoriaTotal = memoriaItens.reduce((sum, item) => sum + (Number(item.valorFinal) || 0), 0)
  if (valorAprovado <= 0) valorAprovado = boletimTotal || memoriaTotal

  if (valorAprovado <= 0) return result
  const totalDescontos = resumo.totalDescontos ?? 0
  const adiantamento = resumo.adiantamento ?? 0
  const fechamentoAnterior = resumo.fechamentoAnterior ?? 0
  const relatorio = resumo.relatorio ?? 0
  const valorTotalMedicaoNf = (resumo.valorTotalMedicaoNf ?? 0) > 0
    ? resumo.valorTotalMedicaoNf ?? 0
    : valorAprovado - totalDescontos - adiantamento + fechamentoAnterior + relatorio
  const importWarnings = [
    medicaoItens.length === 0 ? 'Nenhuma linha de boletim MEDICAO foi identificada.' : '',
    memoriaItens.length === 0 ? 'Nenhuma aba MC/memoria foi identificada.' : '',
    ...medicaoItens.flatMap((item) => item.pendencias ?? []).map((msg) => `Linha ${msg}`),
  ].filter(Boolean)
  const blockingIssues = supplierBlockingIssues({
    fornecedor: nome,
    nucleo: resumo.obraNucleo ?? '',
    periodo: periodo || defaultPeriodo,
    medicaoItens,
    memoriaItens,
    valorAprovado,
    valorTotalMedicaoNf,
  })

  result.list.push({
    ...resumo,
    nome,
    periodo: periodo || defaultPeriodo,
    descricao: descricao || 'Medição de fornecedor importada da planilha.',
    valorAprovado,
    empresa: resumo.empresa || nome,
    totalDescontos,
    adiantamento,
    fechamentoAnterior,
    relatorio,
    valorTotalMedicaoNf,
    medicaoItens,
    memoriaItens,
    etapasAprovacao: parseApprovalStages(wb),
    servicosBase: parseBaseServices(wb),
    sourceSheet: resumo.sourceSheet ?? wb.SheetNames[0],
    sourceSheets: wb.SheetNames,
    importWarnings: [
      ...importWarnings,
      ...(blockingIssues.length ? [`Rascunho conferivel: ${blockingIssues.join('; ')}`] : []),
    ],
    blockingIssues,
    parseConfidence: parseConfidenceFromIssues(7, blockingIssues.length),
    status: importWarnings.length > 0 || blockingIssues.length > 0 ? 'pendente' : 'aprovado',
    pacoteMedicao: {
      fornecedor: nome,
      competencia: resumo.mesReferencia || periodo || defaultPeriodo,
      contrato: resumo.contrato,
      obraNucleo: resumo.obraNucleo,
      medicao: resumo.medicao,
      responsavel: resumo.responsavel,
      setor: resumo.setor,
      revisao: resumo.numeroRevisao,
      data: resumo.data,
      totalAprovado: valorAprovado,
      totalDescontos,
      adiantamento,
      fechamentoAnterior,
      relatorio,
      valorTotalMedicaoNf,
      status: importWarnings.length > 0 ? 'pendente' : 'aprovado',
      origem: 'importado',
    },
  })
  return result
}

/**
 * Parses a suppliers spreadsheet.
 *
 * Handles two formats:
 * A) Multi-supplier table: Nome | Período | Descrição | Valor Aprovado (one row per supplier)
 * B) Single-supplier sheet: Metadata in first rows, total value somewhere in the sheet
 *
 * For format B, scans for a "TOTAL" labeled row to find the approved amount.
 */
function parseFornecedorSheetLegacy(wb: XLSX.WorkBook, defaultPeriodo = ''): FornecedorParseResult {
  const rows   = getRows(wb)
  const result: FornecedorParseResult = { list: [], errors: [] }

  if (rows.length === 0) {
    result.errors.push('Planilha vazia.')
    return result
  }

  const sample = rows[0]
  const colNome    = findCol(sample, ['nome', 'empresa', 'fornecedor', 'razao'])
  const colPeriodo = findCol(sample, ['periodo', 'mes', 'competencia', 'referencia'])
  const colDesc    = findCol(sample, ['descricao', 'descr', 'servico', 'objeto'])
  const colValor   = findCol(sample, ['valor', 'aprovado', 'total', 'vl aprovado'])

  if (!colNome && !colValor) {
    // ── Format B: single-supplier sheet ────────────────────────────────────
    const sheetName = wb.SheetNames[0] ?? 'Fornecedor'
    const raw: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false }) as unknown[][]

    let nome      = sheetName
    let valor     = 0
    let periodo   = defaultPeriodo
    let descricao = ''

    for (let i = 0; i < raw.length; i++) {
      const cells = raw[i].map(toStr)
      const rowStr = cells.join(' ')

      // Extract nome from first non-empty rows that look like a title
      if (nome === sheetName && cells.some((c) => c.length > 3 && !/^\d/.test(c))) {
        const candidate = cells.find((c) => c.length > 3 && !/^\d/.test(c))
        if (candidate) nome = candidate
      }

      // Extract period
      if (!periodo || periodo === defaultPeriodo) {
        const pMatch = rowStr.match(
          /\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*[\s/.-]*(\d{2,4})/i
        ) || rowStr.match(/\b(0[1-9]|1[0-2])\/(\d{4})\b/)
        if (pMatch) periodo = pMatch[0].trim()
      }

      // Look for specific financial labels and extract value from adjacent cell
      const financialLabels = [
        /trabalhos\s*executados\s*aprovados/i,
        /valor\s*medi[çc][aã]o/i,
        /^total$/i,
        /valor\s*(?:nf|nota)/i,
        /fechamento\s*m[eê]s/i,
      ]
      for (const label of financialLabels) {
        const labelIdx = cells.findIndex((c) => label.test(c.trim()))
        if (labelIdx >= 0 && valor === 0) {
          for (let j = labelIdx + 1; j < cells.length; j++) {
            const cellStr = cells[j]
            // Skip cells that look like dates (contain /)
            if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(cellStr)) continue
            const v = toNum(cellStr)
            // Sanity check: reject values over R$ 100 billion (clearly a parsing error)
            if (v > 0 && v < 100_000_000_000) { valor = v; break }
          }
        }
      }

      // Accumulate description from informative rows (skip numeric-only rows and dates)
      if (descricao.length < 300 && rowStr.length > 5 && !/^[\d.,\s/]+$/.test(rowStr)) {
        descricao += (descricao ? ' ' : '') + rowStr.substring(0, 100)
      }
    }

    // If still no total found, use the largest REASONABLE monetary value in the sheet
    if (valor === 0) {
      for (const row of raw) {
        for (const cell of row) {
          const cellStr = toStr(cell)
          // Skip dates
          if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(cellStr)) continue
          const v = toNum(cell)
          // Only accept values under R$ 100 billion
          if (v > valor && v < 100_000_000_000) valor = v
        }
      }
    }

    result.list.push({ nome, periodo, descricao: descricao.trim().substring(0, 500), valorAprovado: valor })
    return result
  }

  // ── Format A: multi-supplier table ──────────────────────────────────────────
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
