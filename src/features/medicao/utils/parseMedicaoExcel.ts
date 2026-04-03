/**
 * parseMedicaoExcel.ts — Excel/CSV parsing utilities for Medição (Billing/Measurement) import.
 * Handles Sabesp spreadsheets with:
 *   - Multi-row headers (title row + column headers row)
 *   - Brazilian number format (1.234.567,89)
 *   - Monthly column groups (JANEIRO, FEVEREIRO, ... + ACUMULADO)
 *   - Category/total row filtering
 */
import * as XLSX from 'xlsx'
import type { MedicaoItem, MedicaoMensal } from '@/types'

// ─── Column mapping hints for auto-detection ─────────────────────────────────

const COLUMN_HINTS: Record<string, string[]> = {
  item: ['item', 'código', 'codigo', 'cod', '#'],
  nPreco: ['n. preco', 'n. preço', 'n.preco', 'n.preço', 'npreco', 'npreço', 'código preço', 'cod preço', 'cod preco', 'n. preco'],
  descricao: ['descrição', 'descricao', 'serviço', 'servico', 'atividade'],
  unidade: ['un', 'und', 'unidade', 'unit', 'unid'],
  qtdContratada: ['qtd contratada', 'quantidade contratada', 'contratada', 'quant'],
  qtdMedida: ['qtd medida', 'quantidade medida', 'medida', 'qtd período', 'qtd periodo'],
  qtdAcumulada: ['acumulada', 'qtd acumulada', 'acumulado'],
  precoUnitario: ['preço unitário', 'preco unitario', 'p. unit', 'p.unit', 'pu', 'p.u.', 'valor unitário', 'valor unitario'],
  valorMedido: ['valor medido', 'valor', 'total', 'valor total'],
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse a Brazilian-format number string.
 * "5.381.388,60" → 5381388.60
 * "1,00" → 1.00
 * "13.205,59" → 13205.59
 */
function parseBRNumber(s: string): number {
  const cleaned = s.trim().replace(/\s/g, '').replace(/R\$\s*/gi, '').replace(/\./g, '').replace(',', '.')
  const v = parseFloat(cleaned)
  return isNaN(v) ? 0 : v
}

// ─── Smart header row detection ──────────────────────────────────────────────

/**
 * Find the row that contains actual column headers by scoring each of the
 * first 5 rows against known column hint patterns.
 */
function findHeaderRow(raw: string[][]): number {
  const allHints = Object.values(COLUMN_HINTS).flat()
  let bestRow = 0
  let bestScore = 0

  for (let r = 0; r < Math.min(raw.length, 6); r++) {
    let score = 0
    for (const cell of raw[r]) {
      const n = normalize(String(cell))
      if (n.length < 1) continue
      if (allHints.some((h) => n.includes(h) || h.includes(n))) score++
    }
    if (score > bestScore) {
      bestScore = score
      bestRow = r
    }
  }
  return bestRow
}

// ─── Preview ─────────────────────────────────────────────────────────────────

/**
 * Read an Excel/CSV file and return headers, preview rows, the detected
 * header row index, and the complete raw data (for monthly detection).
 */
export function previewExcel(
  file: File,
): Promise<{ headers: string[]; rows: string[][]; headerRow: number; raw: string[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          raw: false,
        })

        if (raw.length === 0) {
          resolve({ headers: [], rows: [], headerRow: 0, raw: [] })
          return
        }

        const headerRow = findHeaderRow(raw)
        const headers = raw[headerRow].map(String)
        const rows = raw.slice(headerRow + 1, headerRow + 31).map((row) => row.map(String))
        resolve({ headers, rows, headerRow, raw: raw.map((r) => r.map(String)) })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsBinaryString(file)
  })
}

/**
 * Given an array of header strings, auto-suggest a mapping: field name -> column index.
 * Returns -1 for fields that could not be matched.
 */
export function autoSuggestMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {}

  for (const [field, hints] of Object.entries(COLUMN_HINTS)) {
    let bestIdx = -1
    for (let i = 0; i < headers.length; i++) {
      const nh = normalize(headers[i])
      if (hints.some((h) => nh.includes(h) || h.includes(nh))) {
        bestIdx = i
        break
      }
    }
    mapping[field] = bestIdx
  }

  return mapping
}

// ─── Monthly column detection ────────────────────────────────────────────────

const MONTH_PATTERNS = [
  { regex: /jan(?:eiro)?/i, base: 'Jan', idx: 1 },
  { regex: /fev(?:ereiro)?/i, base: 'Fev', idx: 2 },
  { regex: /mar(?:[çc]o)?/i, base: 'Mar', idx: 3 },
  { regex: /abr(?:il)?/i, base: 'Abr', idx: 4 },
  { regex: /mai(?:o)?/i, base: 'Mai', idx: 5 },
  { regex: /jun(?:ho)?/i, base: 'Jun', idx: 6 },
  { regex: /jul(?:ho)?/i, base: 'Jul', idx: 7 },
  { regex: /ago(?:sto)?/i, base: 'Ago', idx: 8 },
  { regex: /set(?:embro)?/i, base: 'Set', idx: 9 },
  { regex: /out(?:ubro)?/i, base: 'Out', idx: 10 },
  { regex: /nov(?:embro)?/i, base: 'Nov', idx: 11 },
  { regex: /dez(?:embro)?/i, base: 'Dez', idx: 12 },
]

const MONTHLY_SUB_HINTS: Record<string, string[]> = {
  quantidade: ['quantidade', 'qtd', 'quant'],
  valor: ['valor', 'val'],
  saldoAcumulado: ['saldo acumulado', 'saldo acum', 'acumulado', 'saldo'],
  executado: ['executado', 'exec'],
  saldoExecutado: ['saldo executado', 'saldo exec'],
}

export interface MonthlyColumnGroup {
  mes: string
  label: string
  columns: {
    quantidade: number
    valor: number
    saldoAcumulado: number
    executado: number
    saldoExecutado: number
  }
}

/**
 * Detect monthly column groups by scanning BOTH the title rows (above headers)
 * and the header row itself.
 *
 * Strategy:
 * 1. Scan rows 0..headerRow-1 for month names → get the column position where each month starts
 * 2. Scan the header row for sub-column names (Quant., Valor, Saldo, Exec) after each month start
 * 3. Also detect "ACUMULADO" as a special group
 */
export function detectMonthlyColumns(
  raw: string[][],
  headerRow: number,
): MonthlyColumnGroup[] {
  const groups: MonthlyColumnGroup[] = []
  const headerCells = (raw[headerRow] || []).map(String)

  // Step 1: Find month names in title rows OR header row
  interface MonthHit { col: number; monthIdx: number; base: string; yearStr: string }
  const monthHits: MonthHit[] = []

  // Scan all rows from 0 to headerRow (inclusive) for month patterns
  for (let r = 0; r <= headerRow; r++) {
    const row = raw[r] || []
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c]).trim()
      if (!cell) continue

      for (const mp of MONTH_PATTERNS) {
        if (mp.regex.test(cell)) {
          // Extract year from the same cell if present (e.g., "JANEIRO - MED. 08")
          const yearMatch = cell.match(/\b(20\d{2})\b/) || cell.match(/\b(\d{2})\b/)
          const yearStr = yearMatch
            ? (yearMatch[1].length === 2 ? `20${yearMatch[1]}` : yearMatch[1])
            : String(new Date().getFullYear())

          // Avoid duplicates for same column
          if (!monthHits.some((h) => Math.abs(h.col - c) < 3 && h.monthIdx === mp.idx)) {
            monthHits.push({ col: c, monthIdx: mp.idx, base: mp.base, yearStr })
          }
          break
        }
      }
    }
  }

  // Also detect "ACUMULADO" group
  let acumuladoCol = -1
  for (let r = 0; r <= headerRow; r++) {
    const row = raw[r] || []
    for (let c = 0; c < row.length; c++) {
      if (normalize(String(row[c])).includes('acumulado')) {
        acumuladoCol = c
        break
      }
    }
    if (acumuladoCol >= 0) break
  }

  // Sort month hits by column position
  monthHits.sort((a, b) => a.col - b.col)

  // Step 2: For each month hit, scan header row for sub-columns
  for (let mi = 0; mi < monthHits.length; mi++) {
    const hit = monthHits[mi]
    const nextStart = monthHits[mi + 1]?.col ?? (acumuladoCol >= 0 ? acumuladoCol : headerCells.length)
    const endCol = Math.min(nextStart, hit.col + 10)

    const cols = { quantidade: -1, valor: -1, saldoAcumulado: -1, executado: -1, saldoExecutado: -1 }
    let assignedCount = 0

    for (let c = hit.col; c < endCol; c++) {
      const sub = normalize(headerCells[c] || '')
      if (!sub) continue

      for (const [field, hints] of Object.entries(MONTHLY_SUB_HINTS)) {
        const k = field as keyof typeof cols
        if (cols[k] >= 0) continue // Already assigned
        if (hints.some((h) => sub.includes(h) || h.includes(sub))) {
          cols[k] = c
          assignedCount++
          break
        }
      }
    }

    if (assignedCount > 0) {
      const mes = `${hit.yearStr}-${String(hit.monthIdx).padStart(2, '0')}`
      groups.push({ mes, label: `${hit.base}/${hit.yearStr.slice(-2)}`, columns: cols })
    }
  }

  // Step 3: Handle "ACUMULADO" as a special group
  if (acumuladoCol >= 0) {
    const endCol = Math.min(headerCells.length, acumuladoCol + 10)
    const cols = { quantidade: -1, valor: -1, saldoAcumulado: -1, executado: -1, saldoExecutado: -1 }
    let assignedCount = 0

    for (let c = acumuladoCol; c < endCol; c++) {
      const sub = normalize(headerCells[c] || '')
      if (!sub) continue

      for (const [field, hints] of Object.entries(MONTHLY_SUB_HINTS)) {
        const k = field as keyof typeof cols
        if (cols[k] >= 0) continue
        if (hints.some((h) => sub.includes(h) || h.includes(sub))) {
          cols[k] = c
          assignedCount++
          break
        }
      }
    }

    if (assignedCount > 0) {
      groups.push({ mes: 'acumulado', label: 'Acumulado', columns: cols })
    }
  }

  return groups
}

// ─── Row filtering helper ────────────────────────────────────────────────────

function isDataRow(
  row: string[],
  str: (row: string[], field: string) => string,
  num: (row: string[], field: string) => number,
): boolean {
  const desc = str(row, 'descricao').trim()
  if (!desc) return false

  // Skip total/subtotal rows
  const descNorm = normalize(desc)
  if (
    descNorm.includes('total do grupo') ||
    descNorm.includes('total da frente') ||
    descNorm.includes('subtotal') ||
    descNorm.includes('sub-total') ||
    (descNorm.startsWith('total') && !descNorm.startsWith('totaliza'))
  ) {
    return false
  }

  // Skip category headers: rows with description but NO numeric values
  const hasValue =
    num(row, 'qtdContratada') !== 0 ||
    num(row, 'precoUnitario') !== 0 ||
    num(row, 'valorMedido') !== 0
  if (!hasValue) return false

  return true
}

// ─── Main parsing functions ──────────────────────────────────────────────────

/**
 * Parse a full Excel/CSV file using the given column mapping.
 * headerRow indicates which row contains column headers (detected by findHeaderRow).
 * Data rows start at headerRow + 1.
 */
export function parseMedicaoSheet(
  file: File,
  mapping: Record<string, number>,
  headerRow = 0,
): Promise<Omit<MedicaoItem, 'id'>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          raw: false,
        })

        if (raw.length <= headerRow + 1) {
          resolve([])
          return
        }

        const dataRows = raw.slice(headerRow + 1)

        const str = (row: string[], field: string): string => {
          const idx = mapping[field]
          if (idx == null || idx < 0 || idx >= row.length) return ''
          return String(row[idx]).trim()
        }

        const num = (row: string[], field: string): number => {
          return parseBRNumber(str(row, field))
        }

        const items: Omit<MedicaoItem, 'id'>[] = dataRows
          .filter((row) => isDataRow(row, str, num))
          .map((row) => {
            const qtdMedida = num(row, 'qtdMedida')
            const precoUnitario = num(row, 'precoUnitario')
            const valorMedidoRaw = num(row, 'valorMedido')
            const valorMedido = valorMedidoRaw > 0 ? valorMedidoRaw : qtdMedida * precoUnitario
            const nPrecoVal = str(row, 'nPreco')

            return {
              item: str(row, 'item') || '—',
              descricao: str(row, 'descricao') || '—',
              nPreco: nPrecoVal || undefined,
              unidade: str(row, 'unidade') || 'un',
              qtdContratada: num(row, 'qtdContratada'),
              qtdMedida,
              qtdAcumulada: num(row, 'qtdAcumulada'),
              precoUnitario,
              valorMedido: parseFloat(valorMedido.toFixed(2)),
            }
          })

        resolve(items)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsBinaryString(file)
  })
}

/**
 * Parse Excel with monthly column support.
 * headerRow indicates which row contains column headers.
 */
export function parseMedicaoSheetWithMonthly(
  file: File,
  mapping: Record<string, number>,
  monthlyGroups: MonthlyColumnGroup[],
  headerRow = 0,
): Promise<Omit<MedicaoItem, 'id'>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw: string[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          raw: false,
        })

        if (raw.length <= headerRow + 1) {
          resolve([])
          return
        }

        const dataRows = raw.slice(headerRow + 1)

        const str = (row: string[], field: string): string => {
          const idx = mapping[field]
          if (idx == null || idx < 0 || idx >= row.length) return ''
          return String(row[idx]).trim()
        }

        const num = (row: string[], field: string): number => {
          return parseBRNumber(str(row, field))
        }

        const numAt = (row: string[], colIdx: number): number => {
          if (colIdx < 0 || colIdx >= row.length) return 0
          return parseBRNumber(String(row[colIdx]))
        }

        const items: Omit<MedicaoItem, 'id'>[] = dataRows
          .filter((row) => isDataRow(row, str, num))
          .map((row) => {
            const qtdMedida = num(row, 'qtdMedida')
            const precoUnitario = num(row, 'precoUnitario')
            const valorMedidoRaw = num(row, 'valorMedido')
            const valorMedido = valorMedidoRaw > 0 ? valorMedidoRaw : qtdMedida * precoUnitario
            const nPrecoVal = str(row, 'nPreco')

            // Parse monthly data
            const meses: MedicaoMensal[] = monthlyGroups
              .map((mg) => ({
                mes: mg.mes,
                quantidade: numAt(row, mg.columns.quantidade),
                valor: numAt(row, mg.columns.valor),
                saldoAcumulado: numAt(row, mg.columns.saldoAcumulado),
                executado: numAt(row, mg.columns.executado),
                saldoExecutado: numAt(row, mg.columns.saldoExecutado),
              }))
              .filter((m) => m.quantidade > 0 || m.valor > 0 || m.executado > 0)

            return {
              item: str(row, 'item') || '—',
              descricao: str(row, 'descricao') || '—',
              nPreco: nPrecoVal || undefined,
              unidade: str(row, 'unidade') || 'un',
              qtdContratada: num(row, 'qtdContratada'),
              qtdMedida,
              qtdAcumulada: num(row, 'qtdAcumulada'),
              precoUnitario,
              valorMedido: parseFloat(valorMedido.toFixed(2)),
              meses: meses.length > 0 ? meses : undefined,
            }
          })

        resolve(items)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsBinaryString(file)
  })
}
