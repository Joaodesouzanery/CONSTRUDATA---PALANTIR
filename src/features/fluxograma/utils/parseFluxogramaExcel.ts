import * as XLSX from 'xlsx'
import type { FluxoNode, FluxoEdge, FluxoNodeType, FluxoNodeStatus } from '@/types'

// ─── Column hints for auto-mapping ──────────────────────────────────────────

const COLUMN_HINTS: Record<string, string[]> = {
  etapa: ['etapa', 'nome', 'atividade', 'tarefa', 'name', 'label', 'descricao', 'descrição'],
  tipo: ['tipo', 'type', 'categoria'],
  status: ['status', 'situacao', 'situação', 'estado'],
  responsavel: ['responsavel', 'responsável', 'resp', 'encarregado', 'equipe'],
  dependencia: ['dependencia', 'dependência', 'depende de', 'predecessor', 'anterior', 'pre-requisito', 'pré-requisito', 'após'],
  dataInicio: ['data inicio', 'data início', 'inicio', 'início', 'start'],
  dataFim: ['data fim', 'fim', 'end', 'termino', 'término', 'conclusao'],
  progresso: ['progresso', '% progresso', 'avanço', 'avanco', 'percentual', '%'],
  descricao: ['descricao detalhada', 'descricao', 'descrição', 'observacao', 'observação', 'obs', 'detalhe'],
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
}

// ─── Status / Type mapping helpers ──────────────────────────────────────────

const STATUS_MAP: Record<string, FluxoNodeStatus> = {
  concluido: 'concluido',
  concluído: 'concluido',
  finalizado: 'concluido',
  done: 'concluido',
  '100%': 'concluido',
  'em andamento': 'em_andamento',
  'em execução': 'em_andamento',
  'em execucao': 'em_andamento',
  'in progress': 'em_andamento',
  executando: 'em_andamento',
  pendente: 'pendente',
  'não iniciado': 'pendente',
  'nao iniciado': 'pendente',
  'a fazer': 'pendente',
  todo: 'pendente',
  bloqueado: 'bloqueado',
  impedido: 'bloqueado',
  blocked: 'bloqueado',
  parado: 'bloqueado',
}

const TYPE_MAP: Record<string, FluxoNodeType> = {
  etapa: 'etapa',
  atividade: 'etapa',
  tarefa: 'etapa',
  task: 'etapa',
  decisao: 'decisao',
  'decisão': 'decisao',
  'aprovação': 'decisao',
  aprovacao: 'decisao',
  gate: 'decisao',
  marco: 'marco',
  milestone: 'marco',
  entrega: 'marco',
  inicio: 'inicio',
  'início': 'inicio',
  start: 'inicio',
  fim: 'fim',
  end: 'fim',
  'conclusão': 'fim',
  conclusao: 'fim',
}

function parseStatus(raw: string | undefined): FluxoNodeStatus {
  if (!raw) return 'pendente'
  const n = normalize(raw)
  for (const [key, val] of Object.entries(STATUS_MAP)) {
    if (normalize(key) === n) return val
  }
  // Partial match
  for (const [key, val] of Object.entries(STATUS_MAP)) {
    if (n.includes(normalize(key)) || normalize(key).includes(n)) return val
  }
  return 'pendente'
}

function parseType(raw: string | undefined): FluxoNodeType {
  if (!raw) return 'etapa'
  const n = normalize(raw)
  for (const [key, val] of Object.entries(TYPE_MAP)) {
    if (normalize(key) === n) return val
  }
  for (const [key, val] of Object.entries(TYPE_MAP)) {
    if (n.includes(normalize(key)) || normalize(key).includes(n)) return val
  }
  return 'etapa'
}

function parseProgress(raw: string | number | undefined): number | undefined {
  if (raw == null) return undefined
  const s = String(raw).replace('%', '').trim()
  const v = parseFloat(s)
  if (isNaN(v)) return undefined
  return Math.min(100, Math.max(0, Math.round(v)))
}

function parseDate(raw: string | number | undefined): string | undefined {
  if (raw == null || raw === '') return undefined
  // XLSX serial number
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw)
    if (d) {
      const yyyy = String(d.y).padStart(4, '0')
      const mm = String(d.m).padStart(2, '0')
      const dd = String(d.d).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
  }
  const s = String(raw).trim()
  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  // Try dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return s
}

// ─── Read workbook from file ────────────────────────────────────────────────

function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        resolve(wb)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
    reader.readAsArrayBuffer(file)
  })
}

// ─── Detect header row ──────────────────────────────────────────────────────

function detectHeaderRow(rows: (string | number | undefined)[][]): number {
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const row = rows[i]
    if (!row) continue
    const filled = row.filter((c) => c != null && String(c).trim() !== '').length
    if (filled < 2) continue
    // Check if any cell looks like a known header
    for (const cell of row) {
      if (cell == null) continue
      const n = normalize(String(cell))
      for (const hints of Object.values(COLUMN_HINTS)) {
        if (hints.some((h) => normalize(h) === n || n.includes(normalize(h)))) {
          return i
        }
      }
    }
  }
  return 0
}

// ─── Preview ────────────────────────────────────────────────────────────────

export async function previewFluxogramaExcel(
  file: File,
): Promise<{ headers: string[]; rows: string[][]; headerRow: number }> {
  const wb = await readWorkbook(file)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
  })

  const headerRow = detectHeaderRow(raw)
  const headers = (raw[headerRow] ?? []).map((c) => String(c ?? '').trim())
  const dataRows = raw.slice(headerRow + 1, headerRow + 31).map((r) =>
    (r ?? []).map((c) => String(c ?? ''))
  )

  return { headers, rows: dataRows, headerRow }
}

// ─── Auto-suggest mapping ───────────────────────────────────────────────────

export function autoSuggestFluxogramaMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {}
  const used = new Set<number>()

  for (const [field, hints] of Object.entries(COLUMN_HINTS)) {
    let bestIdx = -1
    let bestScore = 0

    for (let i = 0; i < headers.length; i++) {
      if (used.has(i)) continue
      const h = normalize(headers[i])
      if (!h) continue

      for (const hint of hints) {
        const nh = normalize(hint)
        let score = 0
        if (h === nh) score = 100
        else if (h.includes(nh)) score = 80
        else if (nh.includes(h)) score = 60

        if (score > bestScore) {
          bestScore = score
          bestIdx = i
        }
      }
    }

    if (bestIdx >= 0 && bestScore >= 60) {
      mapping[field] = bestIdx
      used.add(bestIdx)
    }
  }

  return mapping
}

// ─── Parse sheet into nodes + edge hints ────────────────────────────────────

export interface FluxoEdgeHint {
  fromLabel: string
  toLabel: string
  type: FluxoEdge['type']
  label?: string
}

export async function parseFluxogramaSheet(
  file: File,
  mapping: Record<string, number>,
  headerRow: number,
): Promise<{ nodes: Omit<FluxoNode, 'id'>[]; edgeHints: FluxoEdgeHint[] }> {
  const wb = await readWorkbook(file)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
  })

  const dataRows = raw.slice(headerRow + 1)
  const nodes: Omit<FluxoNode, 'id'>[] = []
  const edgeHints: FluxoEdgeHint[] = []

  const cell = (row: (string | number | undefined)[], field: string): string | number | undefined => {
    const idx = mapping[field]
    if (idx == null || idx < 0) return undefined
    return row[idx]
  }

  // Track labels to detect dependencies
  const labels: string[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue

    const label = String(cell(row, 'etapa') ?? '').trim()
    if (!label) continue

    const y = 60 + nodes.length * 200
    const x = 400

    const node: Omit<FluxoNode, 'id'> = {
      label,
      type: parseType(cell(row, 'tipo') as string | undefined),
      status: parseStatus(cell(row, 'status') as string | undefined),
      x,
      y,
      responsavel: cell(row, 'responsavel') ? String(cell(row, 'responsavel')).trim() : undefined,
      dataInicio: parseDate(cell(row, 'dataInicio') as string | number | undefined),
      dataFim: parseDate(cell(row, 'dataFim') as string | number | undefined),
      progressoPct: parseProgress(cell(row, 'progresso') as string | number | undefined),
      description: cell(row, 'descricao') ? String(cell(row, 'descricao')).trim() : undefined,
    }

    nodes.push(node)
    labels.push(label)

    // Parse dependencies
    const depRaw = cell(row, 'dependencia')
    if (depRaw != null) {
      const depStr = String(depRaw).trim()
      if (depStr) {
        const deps = depStr.split(/[,;]/).map((d) => d.trim()).filter(Boolean)
        for (const dep of deps) {
          edgeHints.push({
            fromLabel: dep,
            toLabel: label,
            type: 'sequencia',
          })
        }
      }
    }
  }

  // Auto-assign inicio/fim types
  const toLabels = new Set(edgeHints.map((e) => e.toLabel))
  const fromLabels = new Set(edgeHints.map((e) => e.fromLabel))

  for (const node of nodes) {
    if (!toLabels.has(node.label) && node.type === 'etapa') {
      // Nothing points to this node => could be inicio
      if (nodes.indexOf(node) === 0) {
        node.type = 'inicio'
      }
    }
    if (!fromLabels.has(node.label) && node.type === 'etapa') {
      // This node doesn't point to anything => could be fim
      if (nodes.indexOf(node) === nodes.length - 1) {
        node.type = 'fim'
      }
    }
  }

  // Auto-layout: offset nodes with multiple outgoing edges
  const outgoingCount = new Map<string, number>()
  for (const hint of edgeHints) {
    outgoingCount.set(hint.fromLabel, (outgoingCount.get(hint.fromLabel) ?? 0) + 1)
  }

  // Offset alternative branches to the right
  let altIdx = 0
  for (let i = 0; i < nodes.length; i++) {
    const lbl = labels[i]
    // Check if this node is a non-first target of a multi-output source
    const incomingHints = edgeHints.filter((h) => h.toLabel === lbl)
    for (const hint of incomingHints) {
      const oc = outgoingCount.get(hint.fromLabel) ?? 0
      if (oc > 1) {
        // Check if this is not the first outgoing from that source
        const siblingsTo = edgeHints
          .filter((h) => h.fromLabel === hint.fromLabel)
          .map((h) => h.toLabel)
        const sibIdx = siblingsTo.indexOf(lbl)
        if (sibIdx > 0) {
          nodes[i].x = 400 + 300 * sibIdx
          altIdx++
        }
      }
    }
  }

  return { nodes, edgeHints }
}

// ─── Export current fluxograma as Excel ─────────────────────────────────────

export function exportFluxogramaExcel(nodes: FluxoNode[], edges: FluxoEdge[]): void {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  const rows = nodes.map((node) => {
    // Find edges pointing TO this node
    const incoming = edges
      .filter((e) => e.to === node.id)
      .map((e) => nodeMap.get(e.from)?.label ?? '')
      .filter(Boolean)

    return {
      Etapa: node.label,
      Tipo: node.type,
      Status: node.status,
      'Responsavel': node.responsavel ?? '',
      'Depende De': incoming.join(', '),
      'Inicio': node.dataInicio ?? '',
      Fim: node.dataFim ?? '',
      'Progresso (%)': node.progressoPct ?? 0,
      'Descricao': node.description ?? '',
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, 'Fluxograma')
  XLSX.writeFile(wb, 'Fluxograma_Obra.xlsx')
}

// ─── Export empty template ──────────────────────────────────────────────────

export function exportFluxogramaTemplate(): void {
  const example = [
    {
      Etapa: 'Ex: Mobilizacao',
      Tipo: 'etapa',
      Status: 'pendente',
      'Responsavel': 'Ex: Eng. Silva',
      'Depende De': '',
      'Inicio': '2026-01-01',
      Fim: '2026-01-10',
      'Progresso (%)': 0,
      'Descricao': 'Descricao da etapa',
    },
    {
      Etapa: 'Ex: Escavacao',
      Tipo: 'etapa',
      Status: 'em_andamento',
      'Responsavel': 'Ex: Op. Oliveira',
      'Depende De': 'Ex: Mobilizacao',
      'Inicio': '2026-01-11',
      Fim: '',
      'Progresso (%)': 30,
      'Descricao': '',
    },
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(example)
  XLSX.utils.book_append_sheet(wb, ws, 'Modelo')
  XLSX.writeFile(wb, 'Modelo_Fluxograma.xlsx')
}
