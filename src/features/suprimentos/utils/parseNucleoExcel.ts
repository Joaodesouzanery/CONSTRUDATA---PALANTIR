/**
 * parseNucleoExcel.ts — Excel/CSV parsing utilities for Resumo por Núcleo import.
 */
import * as XLSX from 'xlsx'
import type { NucleoResumo } from '@/types'

const COLUMN_HINTS: Record<string, string[]> = {
  nucleo:           ['nucleo', 'núcleo', 'nome', 'nome do nucleo', 'nucleus'],
  tipo:             ['tipo', 'type', 'categoria', 'tipo de obra'],
  trechosTotal:     ['trechos total', 'trechos', 'total trechos', 'qtd trechos'],
  trechosExecutados:['trechos executados', 'executados', 'trechos exec'],
  trechosPendentes: ['trechos pendentes', 'pendentes'],
  metrosTotal:      ['metros total', 'metros', 'extensao', 'extensão total'],
  metrosExecutados: ['metros executados', 'metros exec', 'extensao executada'],
  metrosPendentes:  ['metros pendentes', 'metros pend'],
  progressoPct:     ['progresso', '% progresso', 'percentual', 'avanco', 'avanço'],
  ruas:             ['ruas', 'logradouros', 'vias', 'rua', 'endereço'],
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

export interface NucleoExcelPreview {
  headers: string[]
  rows: string[][]
  raw: unknown[][]
}

/** Read an Excel/CSV file and return headers + raw rows for preview. */
export function previewNucleoExcel(file: File): Promise<NucleoExcelPreview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb   = XLSX.read(data, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })

        if (raw.length === 0) {
          resolve({ headers: [], rows: [], raw: [] })
          return
        }

        // First row as headers
        const headers = (raw[0] as unknown[]).map((v) => String(v ?? '').trim())
        const dataRows = raw.slice(1)
        const rows = dataRows.slice(0, 20).map((row) =>
          (row as unknown[]).map((cell) => String(cell ?? ''))
        )

        resolve({ headers, rows, raw: dataRows })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsBinaryString(file)
  })
}

/** Auto-suggest column mapping from Excel headers to NucleoResumo fields. */
export function autoSuggestNucleoMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {}
  for (const [field, hints] of Object.entries(COLUMN_HINTS)) {
    for (let i = 0; i < headers.length; i++) {
      const n = normalize(headers[i])
      if (hints.some((h) => n.includes(h) || h.includes(n))) {
        mapping[field] = i
        break
      }
    }
  }
  return mapping
}

/** Parse full Excel sheet using provided column mapping, returning NucleoResumo items without id. */
export function parseNucleoSheet(
  file: File,
  mapping: Record<string, number>,
  headerRow: number,
): Promise<Omit<NucleoResumo, 'id'>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const wb   = XLSX.read(data, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const allRows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })

        // Skip rows before and including the header row
        const dataRows = allRows.slice(headerRow + 1)

        const str = (row: unknown[], field: string): string => {
          const idx = mapping[field]
          return idx != null ? String(row[idx] ?? '').trim() : ''
        }

        const num = (row: unknown[], field: string): number => {
          const raw = str(row, field).replace(',', '.')
          const v = parseFloat(raw)
          return isNaN(v) ? 0 : v
        }

        const items: Omit<NucleoResumo, 'id'>[] = []

        for (const row of dataRows) {
          const r = row as unknown[]
          const nucleo = str(r, 'nucleo')
          if (!nucleo) continue

          const trechosTotal     = num(r, 'trechosTotal')
          const trechosExecutados = num(r, 'trechosExecutados')
          const trechosPendentes = mapping['trechosPendentes'] != null
            ? num(r, 'trechosPendentes')
            : trechosTotal - trechosExecutados

          const metrosTotal      = num(r, 'metrosTotal')
          const metrosExecutados = num(r, 'metrosExecutados')
          const metrosPendentes  = mapping['metrosPendentes'] != null
            ? num(r, 'metrosPendentes')
            : metrosTotal - metrosExecutados

          const progressoPct = mapping['progressoPct'] != null
            ? num(r, 'progressoPct')
            : metrosTotal > 0
              ? parseFloat(((metrosExecutados / metrosTotal) * 100).toFixed(1))
              : 0

          items.push({
            nucleo,
            tipo:              str(r, 'tipo') || '—',
            trechosTotal,
            trechosExecutados,
            trechosPendentes,
            metrosTotal,
            metrosExecutados,
            metrosPendentes,
            progressoPct,
            ruas:              str(r, 'ruas') || '—',
          })
        }

        resolve(items)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsBinaryString(file)
  })
}
