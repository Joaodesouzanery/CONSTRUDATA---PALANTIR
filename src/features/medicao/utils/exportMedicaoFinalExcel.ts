/**
 * exportMedicaoFinalExcel.ts — Export a consolidated Medição Final workbook
 * containing a summary sheet plus one detail sheet per type (Sabesp, Critério,
 * Subempreiteiros, Fornecedores). Only sheets with data are created.
 */
import * as XLSX from 'xlsx'
import type { MedicaoSheet } from '@/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  sabesp: 'Sabesp',
  criterio: 'Critério',
  subempreiteiro: 'Subempreiteiro',
  fornecedor: 'Fornecedor',
}

function formatDate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ── Detail sheet builder (shared by all types) ──────────────────────────────

function buildDetailSheet(
  sheets: MedicaoSheet[],
  extraColumn?: { header: string; accessor: (sheet: MedicaoSheet) => string },
): XLSX.WorkSheet {
  const baseHeaders = [
    'Planilha',
    'Item',
    'N. Preço',
    'Descrição',
    'UN',
    'Qtd Contratada',
    'Qtd Medida',
    'Acumulada',
    'PU (R$)',
    'Valor (R$)',
  ]

  const headers = extraColumn
    ? [extraColumn.header, ...baseHeaders]
    : baseHeaders

  const rows: unknown[][] = []

  for (const sheet of sheets) {
    for (const it of sheet.items) {
      const baseRow = [
        sheet.titulo,
        it.item,
        it.nPreco ?? '',
        it.descricao,
        it.unidade,
        it.qtdContratada,
        it.qtdMedida,
        it.qtdAcumulada,
        it.precoUnitario,
        it.valorMedido,
      ]

      rows.push(
        extraColumn
          ? [extraColumn.accessor(sheet), ...baseRow]
          : baseRow,
      )
    }
  }

  // Total row
  const totalValor = sheets.reduce((sum, sh) => sum + sh.totalBRL, 0)
  const emptyCount = headers.length - 2 // all columns except last two
  const totalRow: unknown[] = Array(emptyCount).fill('')
  totalRow.push('TOTAL', totalValor)
  rows.push([]) // blank separator
  rows.push(totalRow)

  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  if (extraColumn) {
    ws['!cols'] = [
      { wch: 22 }, // extra column
      { wch: 30 }, // Planilha
      { wch: 8 },  // Item
      { wch: 10 }, // N. Preço
      { wch: 45 }, // Descrição
      { wch: 6 },  // UN
      { wch: 16 }, // Qtd Contratada
      { wch: 14 }, // Qtd Medida
      { wch: 14 }, // Acumulada
      { wch: 14 }, // PU
      { wch: 18 }, // Valor
    ]
  } else {
    ws['!cols'] = [
      { wch: 30 }, // Planilha
      { wch: 8 },  // Item
      { wch: 10 }, // N. Preço
      { wch: 45 }, // Descrição
      { wch: 6 },  // UN
      { wch: 16 }, // Qtd Contratada
      { wch: 14 }, // Qtd Medida
      { wch: 14 }, // Acumulada
      { wch: 14 }, // PU
      { wch: 18 }, // Valor
    ]
  }

  return ws
}

// ── Main export function ────────────────────────────────────────────────────

export function exportMedicaoFinalExcel(sheets: MedicaoSheet[]): void {
  const wb = XLSX.utils.book_new()

  // ── 1. Resumo Geral ────────────────────────────────────────────────────────

  const resumoHeaders = ['Planilha', 'Tipo', 'Referência', 'Itens', 'Valor Total (R$)']

  const resumoRows: unknown[][] = sheets.map((sh) => [
    sh.titulo,
    TYPE_LABELS[sh.tipo] ?? sh.tipo,
    sh.referencia,
    sh.items.length,
    sh.totalBRL,
  ])

  // Blank row
  resumoRows.push([])

  // Subtotals per type
  const typeOrder = ['sabesp', 'criterio', 'subempreiteiro', 'fornecedor'] as const
  for (const tipo of typeOrder) {
    const matching = sheets.filter((s) => s.tipo === tipo)
    if (matching.length === 0) continue
    const subtotal = matching.reduce((sum, s) => sum + s.totalBRL, 0)
    resumoRows.push([
      `Subtotal ${TYPE_LABELS[tipo]}`,
      '',
      '',
      matching.reduce((sum, s) => sum + s.items.length, 0),
      subtotal,
    ])
  }

  // Grand total
  const grandTotal = sheets.reduce((sum, s) => sum + s.totalBRL, 0)
  resumoRows.push([])
  resumoRows.push(['TOTAL GERAL', '', '', sheets.reduce((n, s) => n + s.items.length, 0), grandTotal])

  const wsResumo = XLSX.utils.aoa_to_sheet([resumoHeaders, ...resumoRows])
  wsResumo['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 12 },
    { wch: 8 },
    { wch: 18 },
  ]

  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral')

  // ── 2. Sabesp ──────────────────────────────────────────────────────────────

  const sabespSheets = sheets.filter((s) => s.tipo === 'sabesp')
  if (sabespSheets.length > 0) {
    const ws = buildDetailSheet(sabespSheets)
    XLSX.utils.book_append_sheet(wb, ws, 'Sabesp')
  }

  // ── 3. Critérios ───────────────────────────────────────────────────────────

  const criterioSheets = sheets.filter((s) => s.tipo === 'criterio')
  if (criterioSheets.length > 0) {
    const ws = buildDetailSheet(criterioSheets)
    XLSX.utils.book_append_sheet(wb, ws, 'Critérios')
  }

  // ── 4. Subempreiteiros ─────────────────────────────────────────────────────

  const subSheets = sheets.filter((s) => s.tipo === 'subempreiteiro')
  if (subSheets.length > 0) {
    const ws = buildDetailSheet(subSheets, {
      header: 'Subempreiteiro',
      accessor: (sh) => sh.subempreiteiro ?? '',
    })
    XLSX.utils.book_append_sheet(wb, ws, 'Subempreiteiros')
  }

  // ── 5. Fornecedores ────────────────────────────────────────────────────────

  const fornSheets = sheets.filter((s) => s.tipo === 'fornecedor')
  if (fornSheets.length > 0) {
    const ws = buildDetailSheet(fornSheets, {
      header: 'Fornecedor',
      accessor: (sh) => sh.fornecedor ?? '',
    })
    XLSX.utils.book_append_sheet(wb, ws, 'Fornecedores')
  }

  // ── Download ───────────────────────────────────────────────────────────────

  XLSX.writeFile(wb, `Medicao_Final_${formatDate()}.xlsx`)
}
