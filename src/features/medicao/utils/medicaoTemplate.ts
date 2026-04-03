/**
 * medicaoTemplate.ts — Standardized Template utilities for Medição.
 * Provides export of empty/populated templates and normalization of imported data.
 */
import * as XLSX from 'xlsx'
import type { MedicaoItem } from '@/types'

/** Standard Medição template columns — the canonical format */
export const TEMPLATE_COLUMNS = [
  { key: 'item', label: 'Item', width: 10 },
  { key: 'nPreco', label: 'N. Preço', width: 12 },
  { key: 'descricao', label: 'Descrição do Serviço', width: 45 },
  { key: 'unidade', label: 'UN', width: 8 },
  { key: 'qtdContratada', label: 'Qtd Contratada', width: 15 },
  { key: 'qtdMedida', label: 'Qtd Medida Período', width: 18 },
  { key: 'qtdAcumulada', label: 'Qtd Acumulada', width: 15 },
  { key: 'precoUnitario', label: 'Preço Unitário (R$)', width: 18 },
  { key: 'valorMedido', label: 'Valor Medido (R$)', width: 18 },
  { key: 'observacao', label: 'Observação', width: 30 },
] as const

/** Export an empty template .xlsx file for users to fill in */
export function exportEmptyTemplate(): void {
  const wb = XLSX.utils.book_new()

  // Main sheet with header row
  const headers = TEMPLATE_COLUMNS.map((c) => c.label)
  const wsData = [headers]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = TEMPLATE_COLUMNS.map((c) => ({ wch: c.width }))

  XLSX.utils.book_append_sheet(wb, ws, 'Medição')

  // Instructions sheet
  const instrucoes = [
    ['INSTRUÇÕES — Modelo Padrão de Medição'],
    [],
    ['Este modelo segue o formato padronizado para importação no sistema.'],
    ['Preencha os dados na aba "Medição" seguindo as orientações abaixo:'],
    [],
    ['Coluna', 'Descrição', 'Obrigatório', 'Exemplo'],
    ['Item', 'Código ou número sequencial do item', 'Sim', '1.1'],
    ['N. Preço', 'Código do preço no critério de medição', 'Não', 'CP-001'],
    ['Descrição do Serviço', 'Descrição detalhada do serviço', 'Sim', 'Escavação mecanizada'],
    ['UN', 'Unidade de medida (m, m², m³, un, vb, etc.)', 'Sim', 'm³'],
    ['Qtd Contratada', 'Quantidade prevista no contrato', 'Sim', '1500'],
    ['Qtd Medida Período', 'Quantidade medida no período atual', 'Sim', '200'],
    ['Qtd Acumulada', 'Quantidade acumulada de todas as medições', 'Não', '800'],
    ['Preço Unitário (R$)', 'Valor unitário em Reais', 'Sim', '45.50'],
    ['Valor Medido (R$)', 'Valor total medido (Qtd Medida x PU). Calculado automaticamente se deixado vazio.', 'Não', '9100.00'],
    ['Observação', 'Comentários ou notas adicionais', 'Não', 'Concluído parcialmente'],
    [],
    ['DICAS:'],
    ['- Use formato numérico brasileiro (1.234,56) ou americano (1,234.56). Ambos são aceitos.'],
    ['- Linhas de total ou subtotal serão ignoradas automaticamente.'],
    ['- O sistema detecta automaticamente a linha de cabeçalho.'],
    ['- Ao importar, utilize a opção "Normalizar para template padrão" para ajustes automáticos.'],
  ]

  const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes)
  wsInstr['!cols'] = [{ wch: 25 }, { wch: 60 }, { wch: 14 }, { wch: 25 }]

  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instruções')

  XLSX.writeFile(wb, 'Modelo_Medicao_Padrao.xlsx')
}

/** Export existing MedicaoItems as a standardized .xlsx file */
export function exportAsTemplate(items: MedicaoItem[], titulo: string): void {
  const wb = XLSX.utils.book_new()

  const headers = TEMPLATE_COLUMNS.map((c) => c.label)

  const rows = items.map((it) => [
    it.item,
    it.nPreco || '',
    it.descricao,
    it.unidade,
    it.qtdContratada,
    it.qtdMedida,
    it.qtdAcumulada,
    it.precoUnitario,
    it.valorMedido,
    it.observacao || '',
  ])

  // Total row
  const totalValor = items.reduce((sum, it) => sum + it.valorMedido, 0)
  rows.push([])
  rows.push(['', '', 'TOTAL', '', '', '', '', '', totalValor, ''])

  const wsData = [headers, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = TEMPLATE_COLUMNS.map((c) => ({ wch: c.width }))

  XLSX.utils.book_append_sheet(wb, ws, 'Medição')

  const sanitizedTitle = titulo
    .replace(/[^a-zA-Z0-9À-ú\s-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60)

  XLSX.writeFile(wb, `${sanitizedTitle}_Padronizado.xlsx`)
}

/**
 * Normalize imported items: take raw parsed items and ensure they conform
 * to the standard template format. Fill missing fields with defaults.
 */
export function normalizeToTemplate(
  rawItems: Omit<MedicaoItem, 'id'>[],
): { normalized: Omit<MedicaoItem, 'id'>[]; warnings: string[] } {
  const warnings: string[] = []
  const normalized = rawItems.map((item, idx) => {
    const norm = { ...item }
    // Ensure item code exists
    if (!norm.item || norm.item === '—') {
      norm.item = String(idx + 1)
      warnings.push(`Linha ${idx + 1}: Item sem código, atribuído "${norm.item}"`)
    }
    // Ensure description exists
    if (!norm.descricao || norm.descricao === '—') {
      warnings.push(`Linha ${idx + 1}: Sem descrição`)
    }
    // Recalculate valorMedido if zero but has qty and price
    if (norm.valorMedido === 0 && norm.qtdMedida > 0 && norm.precoUnitario > 0) {
      norm.valorMedido = parseFloat((norm.qtdMedida * norm.precoUnitario).toFixed(2))
      warnings.push(`Linha ${idx + 1}: Valor recalculado = ${norm.valorMedido}`)
    }
    return norm
  })
  return { normalized, warnings }
}
