/**
 * parseMedicaoExcel.ts — Excel/CSV parsing utilities for Medição (Billing/Measurement) import.
 * Reuses the xlsx library already present in package.json.
 */
import * as XLSX from 'xlsx'
import type { MedicaoItem, MedicaoMensal } from '@/types'

// Column mapping hints for auto-detection
const COLUMN_HINTS: Record<string, string[]> = {
  item: ['item', 'código', 'cod', '#'],
  nPreco: ['n. preco', 'n. preço', 'n.preco', 'n.preço', 'npreco', 'npreço', 'código preço', 'cod preço', 'cod preco'],
  descricao: ['descrição', 'descricao', 'serviço', 'servico', 'atividade'],
  unidade: ['un', 'und', 'unidade', 'unit'],
  qtdContratada: ['qtd contratada', 'quantidade contratada', 'contratada'],
  qtdMedida: ['qtd medida', 'quantidade medida', 'medida', 'qtd período', 'qtd periodo'],
  qtdAcumulada: ['acumulada', 'qtd acumulada', 'acumulado'],
  precoUnitario: ['preço unitário', 'preco unitario', 'pu', 'p.u.', 'valor unitário'],
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
 * Read an Excel/CSV file and return raw headers + first 30 rows as string arrays.
 */
export function previewExcel(file: File): Promise<{ headers: string[]; rows: string[][] }> {
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
          resolve({ headers: [], rows: [] })
          return
        }

        const headers = raw[0].map(String)
        const rows = raw.slice(1, 31).map((row) => row.map(String))
        resolve({ headers, rows })
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

/**
 * Month name patterns for detecting monthly column groups.
 */
const MONTH_PATTERNS = [
  { regex: /jan(?:eiro)?[\s/.-]*(\d{2,4})?/i, base: 'Jan' },
  { regex: /fev(?:ereiro)?[\s/.-]*(\d{2,4})?/i, base: 'Fev' },
  { regex: /mar(?:ço|co)?[\s/.-]*(\d{2,4})?/i, base: 'Mar' },
  { regex: /abr(?:il)?[\s/.-]*(\d{2,4})?/i, base: 'Abr' },
  { regex: /mai(?:o)?[\s/.-]*(\d{2,4})?/i, base: 'Mai' },
  { regex: /jun(?:ho)?[\s/.-]*(\d{2,4})?/i, base: 'Jun' },
  { regex: /jul(?:ho)?[\s/.-]*(\d{2,4})?/i, base: 'Jul' },
  { regex: /ago(?:sto)?[\s/.-]*(\d{2,4})?/i, base: 'Ago' },
  { regex: /set(?:embro)?[\s/.-]*(\d{2,4})?/i, base: 'Set' },
  { regex: /out(?:ubro)?[\s/.-]*(\d{2,4})?/i, base: 'Out' },
  { regex: /nov(?:embro)?[\s/.-]*(\d{2,4})?/i, base: 'Nov' },
  { regex: /dez(?:embro)?[\s/.-]*(\d{2,4})?/i, base: 'Dez' },
]

const MONTHLY_SUB_HINTS: Record<string, string[]> = {
  quantidade: ['quantidade', 'qtd', 'quant'],
  valor: ['valor', 'val'],
  saldoAcumulado: ['saldo acumulado', 'saldo acum', 'acumulado'],
  executado: ['executado', 'exec'],
  saldoExecutado: ['saldo executado', 'saldo exec'],
}

export interface MonthlyColumnGroup {
  mes: string  // e.g. "2026-01"
  label: string // e.g. "Jan/26"
  columns: {
    quantidade: number
    valor: number
    saldoAcumulado: number
    executado: number
    saldoExecutado: number
  }
}

/**
 * Detect monthly column groups in headers.
 * Looks for month names followed by sub-columns (Quantidade, Valor, Saldo, etc.)
 */
export function detectMonthlyColumns(headers: string[]): MonthlyColumnGroup[] {
  const groups: MonthlyColumnGroup[] = []

  for (let i = 0; i < headers.length; i++) {
    for (const mp of MONTH_PATTERNS) {
      const match = mp.regex.exec(headers[i])
      if (!match) continue

      const yearStr = match[1] || new Date().getFullYear().toString().slice(-2)
      const year = yearStr.length === 2 ? `20${yearStr}` : yearStr
      const monthIdx = MONTH_PATTERNS.indexOf(mp)
      const mes = `${year}-${String(monthIdx + 1).padStart(2, '0')}`
      const label = `${mp.base}/${yearStr}`

      // Look for sub-columns after the month header
      // They could be in the same column (merged header) or adjacent columns
      const cols = { quantidade: -1, valor: -1, saldoAcumulado: -1, executado: -1, saldoExecutado: -1 }

      // Check next 5-6 columns for sub-column patterns
      for (let j = i; j < Math.min(i + 7, headers.length); j++) {
        const sub = normalize(headers[j])
        for (const [field, hints] of Object.entries(MONTHLY_SUB_HINTS)) {
          if (hints.some(h => sub.includes(h))) {
            cols[field as keyof typeof cols] = j
          }
        }
      }

      // Only add if at least quantidade or valor was found
      if (cols.quantidade >= 0 || cols.valor >= 0) {
        groups.push({ mes, label, columns: cols })
      }
      break
    }
  }

  return groups
}

/**
 * Parse a full Excel/CSV file using the given column mapping (field -> column index).
 * Returns an array of MedicaoItem shapes without the `id` field (caller assigns IDs).
 */
export function parseMedicaoSheet(
  file: File,
  mapping: Record<string, number>,
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

        if (raw.length <= 1) {
          resolve([])
          return
        }

        const dataRows = raw.slice(1)

        const str = (row: string[], field: string): string => {
          const idx = mapping[field]
          if (idx == null || idx < 0 || idx >= row.length) return ''
          return String(row[idx]).trim()
        }

        const num = (row: string[], field: string): number => {
          const v = str(row, field).replace(/\./g, '').replace(',', '.')
          const parsed = parseFloat(v)
          return isNaN(parsed) ? 0 : parsed
        }

        const items: Omit<MedicaoItem, 'id'>[] = dataRows
          .filter((row) => {
            const desc = str(row, 'descricao')
            return desc !== ''
          })
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
 */
export function parseMedicaoSheetWithMonthly(
  file: File,
  mapping: Record<string, number>,
  monthlyGroups: MonthlyColumnGroup[],
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

        if (raw.length <= 1) {
          resolve([])
          return
        }

        const dataRows = raw.slice(1)

        const str = (row: string[], field: string): string => {
          const idx = mapping[field]
          if (idx == null || idx < 0 || idx >= row.length) return ''
          return String(row[idx]).trim()
        }

        const num = (row: string[], field: string): number => {
          const v = str(row, field).replace(/\./g, '').replace(',', '.')
          const parsed = parseFloat(v)
          return isNaN(parsed) ? 0 : parsed
        }

        const numAt = (row: string[], colIdx: number): number => {
          if (colIdx < 0 || colIdx >= row.length) return 0
          const v = String(row[colIdx]).trim().replace(/\./g, '').replace(',', '.')
          const parsed = parseFloat(v)
          return isNaN(parsed) ? 0 : parsed
        }

        const items: Omit<MedicaoItem, 'id'>[] = dataRows
          .filter((row) => str(row, 'descricao') !== '')
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
