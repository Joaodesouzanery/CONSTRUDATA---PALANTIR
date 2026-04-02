/**
 * exportMedicaoExcel.ts — Export a MedicaoSheet to an XLSX workbook with two sheets:
 *   1. "Medição" — all items with standard columns
 *   2. "Resumo"  — totals and summary info
 */
import * as XLSX from 'xlsx'
import type { MedicaoSheet } from '@/types'

export function exportMedicaoExcel(sheet: MedicaoSheet): void {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Medição (all items) ──────────────────────────────────────────

  const headers = [
    'Item',
    'Descrição',
    'UN',
    'Qtd Contratada',
    'Qtd Medida',
    'Acumulada',
    'PU (R$)',
    'Valor Medido (R$)',
  ]

  const rows = sheet.items.map((it) => [
    it.item,
    it.descricao,
    it.unidade,
    it.qtdContratada,
    it.qtdMedida,
    it.qtdAcumulada,
    it.precoUnitario,
    it.valorMedido,
  ])

  // Total row
  const totalQtdMedida = sheet.items.reduce((sum, it) => sum + it.qtdMedida, 0)
  const totalValorMedido = sheet.items.reduce((sum, it) => sum + it.valorMedido, 0)

  rows.push([])
  rows.push([
    '',
    'TOTAL',
    '',
    '',
    totalQtdMedida,
    '',
    '',
    totalValorMedido,
  ])

  const wsData = [headers, ...rows]
  const wsMedicao = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  wsMedicao['!cols'] = [
    { wch: 8 },   // Item
    { wch: 45 },  // Descrição
    { wch: 6 },   // UN
    { wch: 16 },  // Qtd Contratada
    { wch: 14 },  // Qtd Medida
    { wch: 14 },  // Acumulada
    { wch: 14 },  // PU
    { wch: 18 },  // Valor Medido
  ]

  XLSX.utils.book_append_sheet(wb, wsMedicao, 'Medição')

  // ── Sheet 2: Resumo ──────────────────────────────────────────────────────

  const resumoData = [
    ['Resumo da Medição'],
    [],
    ['Título', sheet.titulo],
    ['Referência', sheet.referencia],
    ['Tipo', sheet.tipo],
    ['Contrato', sheet.contrato || '—'],
    ['Fornecedor', sheet.fornecedor || '—'],
    ['Subempreiteiro', sheet.subempreiteiro || '—'],
    [],
    ['Total de Itens', sheet.items.length],
    ['Valor Total (R$)', totalValorMedido],
    [],
    ['Criado em', sheet.createdAt],
    ['Atualizado em', sheet.updatedAt],
  ]

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData)

  wsResumo['!cols'] = [
    { wch: 20 },
    { wch: 40 },
  ]

  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

  // ── Download ──────────────────────────────────────────────────────────────

  const sanitizedTitle = sheet.titulo
    .replace(/[^a-zA-Z0-9À-ú\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60)

  XLSX.writeFile(wb, `${sanitizedTitle}.xlsx`)
}
