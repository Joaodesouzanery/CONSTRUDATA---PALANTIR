import * as XLSX from 'xlsx'

export type FracttalTowerKey = 'A' | 'B'

export interface FracttalAssetDraft {
  towerKey: FracttalTowerKey
  code: string
  name: string
  type: string
  status: 'active' | 'idle' | 'maintenance' | 'alert' | 'offline'
  criticality: 'baixa' | 'media' | 'alta' | 'critica'
  location: string
  qrCode: string
}

export interface FracttalPlanDraft {
  sourceKey: string
  code: string
  title: string
  description: string
  frequency: 'unica' | 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
  priority: 'baixa' | 'media' | 'alta' | 'critica'
  estimatedDurationMinutes: number
  checklist: string[]
  nextDueDate: string
  towerKey: FracttalTowerKey | null
}

export interface FracttalMonitoringDraft {
  sourceKey: string
  code: string
  locationPart: string
  description: string
  deviceState: string
  enabled: boolean
  serialNumber: string
  isCounter: boolean
  unit: string
  lastReadingDate: string
  lastReadingValue: string
  minValue: number | null
  maxValue: number | null
  notes: string
  towerKey: FracttalTowerKey | null
}

export interface FracttalWorkOrderDraft {
  sourceKey: string
  code: string
  title: string
  description: string
  status: 'pendente' | 'em_processo' | 'em_verificacao' | 'concluida' | 'cancelada'
  priority: 'baixa' | 'media' | 'alta' | 'critica'
  severity: 'baixa' | 'media' | 'alta' | 'critica'
  planned: boolean
  progress: number
  scheduledDate: string
  dueDate: string
  startedAt: string | null
  completedAt: string | null
  assignee: string
  requester: string
  estimatedDurationMinutes: number
  actualDurationMinutes: number | null
  checklist: string[]
  evidence: string[]
  planCode: string | null
  towerKey: FracttalTowerKey | null
}

export interface FracttalImportDraft {
  sourceFiles: string[]
  assets: FracttalAssetDraft[]
  plans: FracttalPlanDraft[]
  monitoringPoints: FracttalMonitoringDraft[]
  workOrders: FracttalWorkOrderDraft[]
}

type Row = Record<string, unknown>

const VALORE_LOCATION = '// JLL/ General Alencastro/ Valore/'
const VALORE_ADDRESS = 'SEPS Q 702/902 Conj. B Bloco A, Brasilia, DF, Brasil, CEP 70390-025'

export function emptyFracttalDraft(): FracttalImportDraft {
  return {
    sourceFiles: [],
    assets: [],
    plans: [],
    monitoringPoints: [],
    workOrders: [],
  }
}

export function mergeFracttalDrafts(current: FracttalImportDraft, next: FracttalImportDraft | null): FracttalImportDraft {
  if (!next) return current
  return {
    sourceFiles: unique([...current.sourceFiles, ...next.sourceFiles]),
    assets: uniqueBy([...current.assets, ...next.assets], (item) => item.code),
    plans: uniqueBy([...current.plans, ...next.plans], (item) => item.sourceKey),
    monitoringPoints: uniqueBy([...current.monitoringPoints, ...next.monitoringPoints], (item) => item.sourceKey),
    workOrders: uniqueBy([...current.workOrders, ...next.workOrders], (item) => item.sourceKey),
  }
}

export function hasFracttalData(draft: FracttalImportDraft) {
  return draft.assets.length + draft.plans.length + draft.monitoringPoints.length + draft.workOrders.length > 0
}

export function buildFracttalSummary(draft: FracttalImportDraft) {
  const planKeys = duplicates(draft.plans.map((item) => item.code || item.title))
  const monitoringKeys = duplicates(draft.monitoringPoints.map((item) => item.sourceKey))
  const orderKeys = duplicates(draft.workOrders.map((item) => item.code))
  return {
    counts: {
      assets: draft.assets.length,
      plans: draft.plans.length,
      monitoring: draft.monitoringPoints.length,
      orders: draft.workOrders.filter((item) => !item.code.startsWith('PEND-')).length,
      workOrders: draft.workOrders.length,
      pendingTasks: draft.workOrders.filter((item) => item.code.startsWith('PEND-')).length,
    },
    duplicates: [...planKeys, ...monitoringKeys, ...orderKeys],
  }
}

export function parseFracttalWorkbook(fileName: string, workbook: XLSX.WorkBook): FracttalImportDraft | null {
  const rows = workbookRows(workbook)
  if (rows.length === 0) return null

  const normalizedName = normalize(fileName)
  const headers = Object.keys(rows[0] ?? {}).map(normalize).join(' ')
  const isFracttal = normalizedName.includes('export_')
    || headers.includes('localizacao ou parte de')
    || headers.includes('oss id')
    || headers.includes('plano de tarefas')

  if (!isFracttal) return null

  const draft = emptyFracttalDraft()
  draft.sourceFiles.push(fileName)
  draft.assets = baseValoreAssets()

  if (normalizedName.includes('monitoramento') || headers.includes('descricao sensor')) {
    draft.monitoringPoints = parseMonitoring(rows)
  } else if (normalizedName.includes('plano_tarefas') || headers.includes('tarefas associadas')) {
    draft.plans = parsePlans(rows)
  } else if (normalizedName.includes('ordens_de_servico') || headers.includes('oss id')) {
    draft.workOrders = parseWorkOrders(rows)
  } else if (normalizedName.includes('tarefas_pendentes') || headers.includes('data calculada')) {
    draft.workOrders = parsePendingTasks(rows)
  }

  return hasFracttalData(draft) ? draft : null
}

function workbookRows(workbook: XLSX.WorkBook): Row[] {
  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    return XLSX.utils.sheet_to_json<Row>(sheet, { defval: '', raw: false })
  })
}

function baseValoreAssets(): FracttalAssetDraft[] {
  return [
    {
      towerKey: 'A',
      code: 'VAL-GNR-TOA',
      name: 'Torre A',
      type: 'Torre Comercial',
      status: 'active',
      criticality: 'media',
      location: `${VALORE_LOCATION} Torre A/ ${VALORE_ADDRESS}`,
      qrCode: '',
    },
    {
      towerKey: 'B',
      code: 'VAL-GNR-TOB',
      name: 'Torre B',
      type: 'Torre Comercial',
      status: 'active',
      criticality: 'media',
      location: `${VALORE_LOCATION} Torre B/ ${VALORE_ADDRESS}`,
      qrCode: '',
    },
  ]
}

function parsePlans(rows: Row[]): FracttalPlanDraft[] {
  return rows.map((row, index) => {
    const title = text(row, 'Descricao', 'Descrição')
    if (!title) return null
    const location = text(row, 'Limitar o acesso a este local')
    const towerKey = detectTower(`${title} ${location}`)
    return {
      sourceKey: `plan:${normalize(title)}:${normalize(location)}`,
      code: `PLN-${slug(title).slice(0, 24) || String(index + 1).padStart(3, '0')}`,
      title,
      description: `Plano Fracttal. Tarefas associadas: ${text(row, 'Tarefas associadas') || '0'}. Ativos ligados: ${text(row, 'Ativos ligados') || '0'}. Local: ${location || VALORE_LOCATION}`,
      frequency: frequencyFromText(title),
      priority: 'media',
      estimatedDurationMinutes: 10,
      checklist: [title],
      nextDueDate: '',
      towerKey,
    }
  }).filter(Boolean) as FracttalPlanDraft[]
}

function parseMonitoring(rows: Row[]): FracttalMonitoringDraft[] {
  return rows.map((row, index) => {
    const locationPart = text(row, 'Localizacao ou parte de', 'Localização ou parte de')
    const description = text(row, 'Descricao Sensor / Medidor', 'Descrição Sensor / Medidor')
    if (!locationPart && !description) return null
    const extractedCode = extractCode(locationPart)
    return {
      sourceKey: `monitor:${normalize(locationPart)}:${normalize(description)}`,
      code: extractedCode ? `MON-${extractedCode}` : `MON-${String(index + 1).padStart(3, '0')}`,
      locationPart,
      description: description || 'Monitoramento Fracttal',
      deviceState: text(row, 'Estado do dispositivo') || '--',
      enabled: yesNo(text(row, 'Habilitado')),
      serialNumber: text(row, 'Numero de serie', 'Número de série'),
      isCounter: yesNo(text(row, 'E um Contador / Acumulador', 'É um Contador / Acumulador')),
      unit: text(row, 'Unidade'),
      lastReadingDate: dateOnly(text(row, 'Ultima Data', 'Última Data')),
      lastReadingValue: text(row, 'Ultima leitura', 'Última leitura'),
      minValue: null,
      maxValue: null,
      notes: `Importado de monitoramento Fracttal. is_monitored: ${text(row, 'is_monitored') || 'Nao informado'}.`,
      towerKey: detectTower(locationPart),
    }
  }).filter(Boolean) as FracttalMonitoringDraft[]
}

function parseWorkOrders(rows: Row[]): FracttalWorkOrderDraft[] {
  return rows.map((row, index) => {
    const osId = text(row, 'OSs ID')
    const title = text(row, 'Tarefa')
    if (!osId && !title) return null
    const location = text(row, 'Localizacao ou parte de', 'Localização ou parte de')
    const notes = text(row, 'Tarefa -> Observacao', 'Tarefa -> Observação', 'Ordem de Servico -> Observacao', 'Ordem de Serviço -> Observação')
    const priority = priorityFromText(text(row, 'Tarefa -> Criticidade'))
    const planCode = text(row, 'Plano de tarefas') || null
    return {
      sourceKey: `order:${osId || index}:${normalize(title)}:${normalize(location)}`,
      code: osId ? `OS-${osId}` : `OS-FRACTTAL-${String(index + 1).padStart(3, '0')}`,
      title: title || `Ordem Fracttal ${osId}`,
      description: compactLines([
        notes,
        `Ativo Fracttal: ${text(row, 'Ativo')}`,
        `Codigo Fracttal: ${text(row, 'Código', 'Codigo')}`,
        `Local: ${location}`,
        `Tipo de tarefa: ${text(row, 'Tipo de tarefa')}`,
      ]),
      status: statusFromText(text(row, 'Status')),
      priority,
      severity: priority,
      planned: normalize(text(row, 'Ativador')).includes('programada'),
      progress: statusFromText(text(row, 'Status')) === 'concluida' ? 100 : 50,
      scheduledDate: dateOnly(text(row, 'Data Programada', 'Data Calculada')),
      dueDate: dateOnly(text(row, 'Data Programada', 'Data Calculada')),
      startedAt: isoOrNull(text(row, 'Data inicial')),
      completedAt: isoOrNull(text(row, 'Data final', 'Data de finalizacao da OS', 'Data de finalização da OS')),
      assignee: text(row, 'Responsavel', 'Responsável'),
      requester: text(row, 'Criado por'),
      estimatedDurationMinutes: minutesFromDuration(text(row, 'Tarefa -> Duracao estimada', 'Tarefa -> Duração estimada')) || 10,
      actualDurationMinutes: minutesFromDuration(text(row, 'Tempo de execucao', 'Tempo de execução')),
      checklist: unique([title, planCode].filter(Boolean) as string[]),
      evidence: unique([`OS Fracttal ${osId}`, text(row, 'Qualificacao de OSs', 'Qualificação de OSs')]),
      planCode,
      towerKey: detectTower(`${text(row, 'Codigo', 'Código')} ${text(row, 'Ativo')} ${location}`),
    }
  }).filter(Boolean) as FracttalWorkOrderDraft[]
}

function parsePendingTasks(rows: Row[]): FracttalWorkOrderDraft[] {
  return rows.map((row, index) => {
    const code = text(row, 'Codigo', 'Código')
    const title = text(row, 'Tarefa')
    if (!code && !title) return null
    const location = text(row, 'Localizacao ou parte de', 'Localização ou parte de')
    const priority = priorityFromText(text(row, 'Tarefa -> Criticidade'))
    const planCode = text(row, 'Plano de tarefas') || null
    return {
      sourceKey: `pending:${normalize(code)}:${normalize(title)}:${normalize(location)}`,
      code: code ? `PEND-${code}` : `PEND-FRACTTAL-${String(index + 1).padStart(3, '0')}`,
      title: title || `Tarefa pendente ${index + 1}`,
      description: compactLines([
        text(row, 'Tarefa -> Observacao', 'Tarefa -> Observação'),
        `Ativo Fracttal: ${text(row, 'Ativo')}`,
        `Local: ${location}`,
        `Ativador: ${text(row, 'Ativador')}`,
      ]),
      status: 'pendente',
      priority,
      severity: priority,
      planned: true,
      progress: 0,
      scheduledDate: dateOnly(text(row, 'Data Programada', 'Data Calculada')),
      dueDate: dateOnly(text(row, 'Data Programada', 'Data Calculada')),
      startedAt: null,
      completedAt: null,
      assignee: '',
      requester: '',
      estimatedDurationMinutes: minutesFromDuration(text(row, 'Duracao estimada', 'Duração estimada')) || 10,
      actualDurationMinutes: null,
      checklist: unique([title, planCode].filter(Boolean) as string[]),
      evidence: unique([`Tarefa pendente Fracttal ${code}`]),
      planCode,
      towerKey: detectTower(`${code} ${text(row, 'Ativo')} ${location}`),
    }
  }).filter(Boolean) as FracttalWorkOrderDraft[]
}

function detectTower(value: string): FracttalTowerKey | null {
  const normalized = normalize(value)
  if (normalized.includes('val-gnr-toa') || normalized.includes('torre a')) return 'A'
  if (normalized.includes('val-gnr-tob') || normalized.includes('torre b')) return 'B'
  return null
}

function statusFromText(value: string): FracttalWorkOrderDraft['status'] {
  const normalized = normalize(value)
  if (normalized.includes('cancel')) return 'cancelada'
  if (normalized.includes('conclu') || normalized.includes('finaliz')) return 'concluida'
  if (normalized.includes('verific')) return 'em_verificacao'
  if (normalized.includes('process') || normalized.includes('execu')) return 'em_processo'
  return 'pendente'
}

function priorityFromText(value: string): FracttalWorkOrderDraft['priority'] {
  const normalized = normalize(value)
  if (normalized.includes('crit') || normalized === '5' || normalized === '4') return 'critica'
  if (normalized.includes('alto') || normalized.includes('alta') || normalized === '3') return 'alta'
  if (normalized.includes('baixo') || normalized.includes('baixa') || normalized === '1') return 'baixa'
  return 'media'
}

function frequencyFromText(value: string): FracttalPlanDraft['frequency'] {
  const normalized = normalize(value)
  if (normalized.includes('diar')) return 'diaria'
  if (normalized.includes('seman')) return 'semanal'
  if (normalized.includes('quinzen')) return 'quinzenal'
  if (normalized.includes('bimestr')) return 'bimestral'
  if (normalized.includes('trimestr')) return 'trimestral'
  if (normalized.includes('semestr')) return 'semestral'
  if (normalized.includes('anual')) return 'anual'
  if (normalized.includes('mensal') || normalized.includes('mes')) return 'mensal'
  return 'mensal'
}

function minutesFromDuration(value: string): number | null {
  const match = value.match(/(\d{1,2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function isoOrNull(value: string): string | null {
  if (!value || value === '--') return null
  const normalized = value.replace(' ', 'T')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function dateOnly(value: string): string {
  if (!value || value === '--') return ''
  const match = value.match(/\d{4}-\d{2}-\d{2}/)
  if (match) return match[0]
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function yesNo(value: string) {
  return normalize(value).startsWith('sim') || normalize(value) === 'true'
}

function text(row: Row, ...keys: string[]) {
  for (const key of keys) {
    const wanted = normalize(key)
    const found = Object.keys(row).find((candidate) => normalize(candidate) === wanted)
    if (found) return String(row[found] ?? '').trim()
  }
  return ''
}

function extractCode(value: string) {
  return value.match(/\{\s*([^}]+?)\s*\}/)?.[1]?.trim() ?? ''
}

function compactLines(lines: Array<string | null | undefined>) {
  return unique(lines).join('\n')
}

function slug(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase()
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function unique(items: Array<string | undefined | null>) {
  return Array.from(new Set(items.map((item) => item?.trim()).filter(Boolean) as string[]))
}

function uniqueBy<T>(items: T[], keyFor: (item: T) => string) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyFor(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function duplicates(items: string[]) {
  const counts = new Map<string, number>()
  for (const item of items.filter(Boolean)) counts.set(item, (counts.get(item) ?? 0) + 1)
  return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([item]) => item)
}
