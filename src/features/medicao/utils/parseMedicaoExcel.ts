/**
 * parseMedicaoExcel.ts — Excel/CSV parsing utilities for Medição (Billing/Measurement) import.
 * Reuses the xlsx library already present in package.json.
 */
import * as XLSX from 'xlsx'
import type { MedicaoItem } from '@/types'

// Column mapping hints for auto-detection
const COLUMN_HINTS: Record<string, string[]> = {
  item: ['item', 'código', 'cod', '#'],
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

            return {
              item: str(row, 'item') || '—',
              descricao: str(row, 'descricao') || '—',
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
