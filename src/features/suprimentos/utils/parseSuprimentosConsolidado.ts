/**
 * parseSuprimentosConsolidado.ts — Parser for "Consolidado" and "Resumo" supply chain planilhas.
 *
 * Handles two common formats:
 *   A) Consolidado: código | descrição | unidade | qtd total | qtd pedida | saldo | valor unitário | fornecedor
 *   B) Resumo: material | status | qtd necessária | qtd pedida | saldo | fornecedor | prazo
 *
 * Returns a preview + detected column mapping for user confirmation before import.
 */
import * as XLSX from 'xlsx'

export interface ConsolidadoItem {
  codigo:       string
  descricao:    string
  unidade:      string
  qtdTotal:     number
  qtdPedida:    number
  saldo:        number
  valorUnitario: number
  fornecedor:   string
  status:       'pendente' | 'parcial' | 'atendido'
}

export interface ConsolidadoPreview {
  headers:      string[]
  rows:         Record<string, string>[]   // first 15 rows
  suggestedMap: Record<string, string>     // excelHeader → fieldName
  errors:       string[]
}

export interface ConsolidadoParseResult {
  items:  ConsolidadoItem[]
  errors: string[]
}

// Field hints for auto-mapping
const FIELD_HINTS: Record<string, string[]> = {
  codigo:        ['codigo', 'cod', 'item', 'ref', 'referencia', 'n preco', 'npreco'],
  descricao:     ['descricao', 'descr', 'material', 'produto', 'servico', 'especificacao', 'nome'],
  unidade:       ['unidade', 'un', 'und', 'medida'],
  qtdTotal:      ['qtd total', 'quantidade total', 'total qtd', 'qtd necessaria', 'qtd prevista', 'previsto', 'total'],
  qtdPedida:     ['qtd pedida', 'pedido', 'quantidade pedida', 'oc', 'solicitado', 'comprado'],
  saldo:         ['saldo', 'pendente', 'faltante', 'a pedir', 'diferenca', 'balance'],
  valorUnitario: ['valor unit', 'vl unit', 'preco unit', 'custo unit', 'p unit', 'preco', 'custo'],
  fornecedor:    ['fornecedor', 'supplier', 'fabricante', 'marca', 'vendor'],
  status:        ['status', 'situacao', 'situação', 'andamento'],
}

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function autoSuggest(header: string): string {
  const n = normalize(header)
  for (const [field, hints] of Object.entries(FIELD_HINTS)) {
    if (hints.some((h) => n.includes(h) || h.includes(n))) return field
  }
  return 'ignorar'
}

function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  const s = String(v ?? '').trim().replace(/R\$\s?/g, '').replace(/\s/g, '')
  if (!s) return 0
  if (s.includes(',') && s.includes('.')) {
    const lastDot   = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    if (lastComma > lastDot) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
    return parseFloat(s.replace(/,/g, '')) || 0
  }
  if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(',', '.')) || 0
  return parseFloat(s) || 0
}

function inferStatus(item: ConsolidadoItem, rawStatus: string): ConsolidadoItem['status'] {
  const s = rawStatus.toLowerCase()
  if (/atend|conclu|ok|entregue|total/.test(s)) return 'atendido'
  if (/parcial|andamento|process|parcialm/.test(s)) return 'parcial'
  if (/pend|falt|aberto|aguard/.test(s)) return 'pendente'
  // Infer from quantities
  if (item.saldo <= 0 && item.qtdTotal > 0) return 'atendido'
  if (item.qtdPedida > 0 && item.saldo > 0) return 'parcial'
  return 'pendente'
}

/** Read a WorkBook from a File. */
export async function readConsolidadoWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer()
  return XLSX.read(buf, { type: 'array' })
}

/** Parse the file and return a preview for column-mapping UI. */
export function previewConsolidado(wb: XLSX.WorkBook): ConsolidadoPreview {
  const errors: string[] = []
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    return { headers: [], rows: [], suggestedMap: {}, errors: ['Planilha vazia.'] }
  }

  const ws = wb.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })

  if (raw.length === 0) {
    return { headers: [], rows: [], suggestedMap: {}, errors: ['Nenhum dado encontrado.'] }
  }

  const headers = Object.keys(raw[0])
  const rows = raw.slice(0, 15).map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)]))
  )
  const suggestedMap: Record<string, string> = {}
  for (const h of headers) {
    suggestedMap[h] = autoSuggest(h)
  }

  return { headers, rows, suggestedMap, errors }
}

/** Apply a column mapping and produce ConsolidadoItems. */
export function applyConsolidadoMapping(
  wb: XLSX.WorkBook,
  mapping: Record<string, string>,  // excelHeader → fieldName
): ConsolidadoParseResult {
  const errors: string[] = []
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { items: [], errors: ['Planilha vazia.'] }

  const ws = wb.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false })

  // Invert mapping
  const inv: Record<string, string> = {}
  for (const [header, field] of Object.entries(mapping)) {
    if (field !== 'ignorar') inv[field] = header
  }

  const str = (row: Record<string, unknown>, field: string) =>
    inv[field] ? String(row[inv[field]] ?? '').trim() : ''
  const num = (row: Record<string, unknown>, field: string) =>
    inv[field] ? toNum(row[inv[field]]) : 0

  const items: ConsolidadoItem[] = []

  for (const row of rows) {
    const descricao = str(row, 'descricao')
    const codigo    = str(row, 'codigo')
    if (!descricao && !codigo) continue

    const rawStatus = str(row, 'status')
    const partial: ConsolidadoItem = {
      codigo:        codigo || '—',
      descricao:     descricao || '—',
      unidade:       str(row, 'unidade') || 'un',
      qtdTotal:      num(row, 'qtdTotal'),
      qtdPedida:     num(row, 'qtdPedida'),
      saldo:         num(row, 'saldo'),
      valorUnitario: num(row, 'valorUnitario'),
      fornecedor:    str(row, 'fornecedor'),
      status:        'pendente',
    }

    // Auto-compute saldo if not provided
    if (!inv['saldo'] && partial.qtdTotal > 0) {
      partial.saldo = Math.max(0, partial.qtdTotal - partial.qtdPedida)
    }

    partial.status = inferStatus(partial, rawStatus)
    items.push(partial)
  }

  if (items.length === 0) {
    errors.push('Nenhum item válido encontrado com o mapeamento informado.')
  }

  return { items, errors }
}
