import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useActiveObraStore } from '@/store/activeObraStore'
import { flushQueue, mergePull, makeOp, changedColumns, type PendingOp } from '@/lib/storeSync'
import { predialDemoAssets, predialDemoPlans, predialDemoWorkOrders } from '@/data/mockPredial'
import { isNonProductionDataMode } from '@/lib/runtimeMode'

export type MaintenanceStatus = 'pendente' | 'em_processo' | 'em_verificacao' | 'concluida' | 'cancelada'
export type MaintenancePriority = 'baixa' | 'media' | 'alta' | 'critica'
/** Nível de impacto/urgência para a matriz de priorização de chamados. */
export type ImpactoUrgencia = 'baixa' | 'media' | 'alta'
export type MaintenanceFrequency = 'unica' | 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
export type MaintenanceAssetStatus = 'active' | 'idle' | 'maintenance' | 'alert' | 'offline'

/** Seção/nota navegável dentro de um manual (troubleshooting, código de peça, etc.). */
export interface MaintenanceManualSection {
  id: string
  titulo: string
  texto: string
}

/** Manual/documento técnico anexado a um ativo (repositório do Workbench Predial). */
export interface MaintenanceManual {
  id: string
  nome: string
  url?: string
  tags?: string[]
  secoes?: MaintenanceManualSection[]
}

/** Sistema predial do ativo (Inventário / DNA do prédio). */
export type MaintenanceAssetSistema = 'HVAC' | 'Elétrico' | 'Hidráulico' | 'Incêndio' | 'Elevadores' | 'Outros'
export const SISTEMAS_ATIVO: MaintenanceAssetSistema[] = ['HVAC', 'Elétrico', 'Hidráulico', 'Incêndio', 'Elevadores', 'Outros']

/** Documento anexo do ativo (manual, ART, nota) — arquivo no bucket `predial-ativos`. */
export interface MaintenanceAssetAnexo {
  path: string
  nome: string
  tipo?: 'manual' | 'art' | 'nota' | 'outro'
  uploadedAt: string
}

export interface MaintenanceAsset {
  id: string
  code: string
  name: string
  type: string
  status: MaintenanceAssetStatus
  criticality: MaintenancePriority
  responsible: string
  location: string
  qrCode: string
  projectId: string | null
  constructionSiteId: string | null
  manuais?: MaintenanceManual[]      // repositório de manuais (payload jsonb, sem migração)
  replacementCostBRL?: number        // custo de reposição p/ análise de CapEx (payload jsonb)
  modelo?: string                    // metadados opcionais p/ CapEx/Workbench
  serial?: string
  // ─── Inventário de Ativos (DNA do prédio) — todos no payload jsonb, sem migração ───
  fabricante?: string
  sistema?: MaintenanceAssetSistema
  areaAtendida?: string              // ambiente/área que o ativo atende
  dataInstalacao?: string            // yyyy-MM-dd
  garantiaAte?: string               // yyyy-MM-dd (vencimento da garantia)
  vidaUtilAnosNBR?: number           // vida útil de referência (NBR) — alimenta o CapEx
  fotoPlaquetaPath?: string          // foto da plaqueta no bucket `predial-ativos`
  anexos?: MaintenanceAssetAnexo[]   // manuais/ART/notas anexados (bucket `predial-ativos`)
  createdAt: string
  updatedAt: string
}

export interface MaintenancePlan {
  id: string
  code: string
  title: string
  description: string
  frequency: MaintenanceFrequency
  priority: MaintenancePriority
  estimatedDurationMinutes: number
  checklist: string[]
  nextDueDate: string
  active: boolean
  assetIds: string[]
  projectId: string | null
  constructionSiteId: string | null
  createdAt: string
  updatedAt: string
}

export interface MaintenanceWorkOrder {
  id: string
  code: string
  title: string
  description: string
  status: MaintenanceStatus
  priority: MaintenancePriority
  severity: MaintenancePriority
  impacto?: ImpactoUrgencia    // matriz impacto×urgência (payload jsonb, sem migração)
  urgencia?: ImpactoUrgencia
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
  estimatedCost: number
  actualCost: number
  checklist: string[]
  evidence: string[]
  pmbok: {
    scope?: string
    risk?: string
    lessonsLearned?: string
  }
  leanLps: {
    createLookahead?: boolean
    restriction?: string
  }
  assetIds: string[]
  planId: string | null
  projectId: string | null
  constructionSiteId: string | null
  createdAt: string
  updatedAt: string
}

export interface MaintenanceMonitoringPoint {
  id: string
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
  assetId: string | null
  projectId: string | null
  constructionSiteId: string | null
  createdAt: string
  updatedAt: string
}

interface ManutencoesState {
  activeOrgId: string | null
  assets: MaintenanceAsset[]
  plans: MaintenancePlan[]
  workOrders: MaintenanceWorkOrder[]
  monitoringPoints: MaintenanceMonitoringPoint[]
  pendingSync: PendingOp[]
  syncStatus: 'idle' | 'syncing' | 'offline' | 'unauth' | 'error'
  syncError: string | null
  lastSyncedAt: string | null
  selectedAssetId: string | null
  ensureTenantScope: (organizationId: string) => void
  clearData: () => void
  loadDemoData: () => void
  flush: () => Promise<void>
  pull: () => Promise<void>
  addAsset: (payload: Partial<MaintenanceAsset>) => Promise<string | null>
  updateAsset: (id: string, patch: Partial<MaintenanceAsset>) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  addPlan: (payload: Partial<MaintenancePlan>) => Promise<string | null>
  updatePlan: (id: string, patch: Partial<MaintenancePlan>) => Promise<void>
  deletePlan: (id: string) => Promise<void>
  generateWorkOrderFromPlan: (planId: string) => Promise<string | null>
  generateDuePreventivas: (obraId?: string | null) => Promise<number>
  addWorkOrder: (payload: Partial<MaintenanceWorkOrder>) => Promise<string | null>
  updateWorkOrder: (id: string, patch: Partial<MaintenanceWorkOrder>) => Promise<void>
  deleteWorkOrder: (id: string) => Promise<void>
  addMonitoringPoint: (payload: Partial<MaintenanceMonitoringPoint>) => Promise<string | null>
  updateMonitoringPoint: (id: string, patch: Partial<MaintenanceMonitoringPoint>) => Promise<void>
  deleteMonitoringPoint: (id: string) => Promise<void>
  setSelectedAssetId: (id: string | null) => void
}

type EquipmentRow = {
  id: string
  code: string | null
  name: string | null
  type: string | null
  status: MaintenanceAssetStatus | string | null
  project_id: string | null
  site_name?: string | null
  construction_site_id?: string | null
  criticality?: MaintenancePriority | string | null
  responsible?: string | null
  location?: string | null
  qr_code?: string | null
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type PlanRow = {
  id: string
  project_id: string | null
  construction_site_id: string | null
  code: string | null
  title: string
  description: string | null
  frequency: MaintenanceFrequency
  priority: MaintenancePriority
  estimated_duration_minutes: number
  checklist: unknown
  next_due_date: string | null
  active: boolean
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type WorkOrderRow = {
  id: string
  project_id: string | null
  construction_site_id: string | null
  plan_id: string | null
  code: string | null
  title: string
  description: string | null
  status: MaintenanceStatus
  priority: MaintenancePriority
  severity: MaintenancePriority
  planned: boolean
  progress: number
  scheduled_date: string | null
  due_date: string | null
  started_at: string | null
  completed_at: string | null
  assignee: string | null
  requester: string | null
  estimated_duration_minutes: number
  actual_duration_minutes: number | null
  estimated_cost: number
  actual_cost: number
  checklist: unknown
  evidence: unknown
  pmbok: Record<string, unknown> | null
  lean_lps: Record<string, unknown> | null
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type MonitoringPointRow = {
  id: string
  project_id: string | null
  construction_site_id: string | null
  asset_id: string | null
  code: string | null
  location_part: string | null
  description: string
  device_state: string | null
  enabled: boolean
  serial_number: string | null
  is_counter: boolean
  unit: string | null
  last_reading_date: string | null
  last_reading_value: string | null
  min_value: number | null
  max_value: number | null
  notes: string | null
  payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

const today = () => new Date().toISOString().slice(0, 10)

function getContext() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? null, userId: user?.id ?? null }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asPriority(value: unknown): MaintenancePriority {
  return value === 'baixa' || value === 'alta' || value === 'critica' ? value : 'media'
}

function asSistema(v: unknown): MaintenanceAssetSistema | undefined {
  return typeof v === 'string' && (SISTEMAS_ATIVO as string[]).includes(v) ? (v as MaintenanceAssetSistema) : undefined
}

function asAsset(row: EquipmentRow): MaintenanceAsset {
  const payload = row.payload ?? {}
  const pstr = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined)
  const pnum = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  return {
    id: row.id,
    code: row.code ?? String(payload.code ?? ''),
    name: row.name ?? String(payload.name ?? 'Ativo sem nome'),
    type: row.type ?? String(payload.type ?? 'Sem tipo'),
    status: (row.status as MaintenanceAssetStatus) ?? 'idle',
    criticality: asPriority(row.criticality ?? payload.criticality),
    responsible: row.responsible ?? String(payload.responsible ?? ''),
    location: row.location ?? String(payload.location ?? row.site_name ?? ''),
    qrCode: row.qr_code ?? String(payload.qrCode ?? ''),
    projectId: row.project_id,
    constructionSiteId: row.construction_site_id ?? null,
    // Metadados que vivem SÓ no payload jsonb (sem colunas dedicadas): restaurar no pull,
    // senão se perdem ao recarregar/trocar de device (valia p/ manuais/CapEx e agora p/ o DNA).
    manuais: Array.isArray(payload.manuais) ? (payload.manuais as MaintenanceManual[]) : undefined,
    replacementCostBRL: pnum(payload.replacementCostBRL),
    modelo: pstr(payload.modelo),
    serial: pstr(payload.serial),
    fabricante: pstr(payload.fabricante),
    sistema: asSistema(payload.sistema),
    areaAtendida: pstr(payload.areaAtendida),
    dataInstalacao: pstr(payload.dataInstalacao),
    garantiaAte: pstr(payload.garantiaAte),
    vidaUtilAnosNBR: pnum(payload.vidaUtilAnosNBR),
    fotoPlaquetaPath: pstr(payload.fotoPlaquetaPath),
    anexos: Array.isArray(payload.anexos) ? (payload.anexos as MaintenanceAssetAnexo[]) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function asPlan(row: PlanRow, assetIds: string[]): MaintenancePlan {
  return {
    id: row.id,
    code: row.code ?? '',
    title: row.title,
    description: row.description ?? '',
    frequency: row.frequency,
    priority: row.priority,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    checklist: asStringArray(row.checklist),
    nextDueDate: row.next_due_date ?? '',
    active: row.active,
    // Payload é a fonte autoritativa dos vínculos p/ linhas novas (o insert enfileira assetIds no payload);
    // a tabela de link (param) fica como fallback p/ linhas legadas sem assetIds no payload.
    assetIds: Array.isArray(row.payload?.assetIds) ? (row.payload!.assetIds as string[]) : assetIds,
    projectId: row.project_id,
    constructionSiteId: row.construction_site_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function asWorkOrder(row: WorkOrderRow, assetIds: string[]): MaintenanceWorkOrder {
  const payload = row.payload ?? {}
  const iu = (v: unknown): ImpactoUrgencia | undefined => (v === 'baixa' || v === 'media' || v === 'alta' ? v : undefined)
  return {
    id: row.id,
    code: row.code ?? '',
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    priority: row.priority,
    severity: row.severity,
    impacto: iu(payload.impacto),
    urgencia: iu(payload.urgencia),
    planned: row.planned,
    progress: row.progress,
    scheduledDate: row.scheduled_date ?? '',
    dueDate: row.due_date ?? '',
    startedAt: row.started_at,
    completedAt: row.completed_at,
    assignee: row.assignee ?? '',
    requester: row.requester ?? '',
    estimatedDurationMinutes: row.estimated_duration_minutes,
    actualDurationMinutes: row.actual_duration_minutes,
    estimatedCost: Number(row.estimated_cost ?? 0),
    actualCost: Number(row.actual_cost ?? 0),
    checklist: asStringArray(row.checklist),
    evidence: asStringArray(row.evidence),
    pmbok: row.pmbok ?? {},
    leanLps: row.lean_lps ?? {},
    // Payload autoritativo p/ os vínculos de linhas novas; tabela de link (param) como fallback legado.
    assetIds: Array.isArray(payload.assetIds) ? (payload.assetIds as string[]) : assetIds,
    planId: row.plan_id,
    projectId: row.project_id,
    constructionSiteId: row.construction_site_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function asMonitoringPoint(row: MonitoringPointRow): MaintenanceMonitoringPoint {
  const payload = row.payload ?? {}
  return {
    id: row.id,
    code: row.code ?? String(payload.code ?? ''),
    locationPart: row.location_part ?? String(payload.locationPart ?? ''),
    description: row.description,
    deviceState: row.device_state ?? String(payload.deviceState ?? '--'),
    enabled: row.enabled,
    serialNumber: row.serial_number ?? String(payload.serialNumber ?? ''),
    isCounter: row.is_counter,
    unit: row.unit ?? String(payload.unit ?? ''),
    lastReadingDate: row.last_reading_date ?? '',
    lastReadingValue: row.last_reading_value ?? '',
    minValue: row.min_value,
    maxValue: row.max_value,
    notes: row.notes ?? String(payload.notes ?? ''),
    assetId: row.asset_id,
    projectId: row.project_id,
    constructionSiteId: row.construction_site_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function compactPayload(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

// ─── Row builders (snake_case) — compartilhados pelo op de insert e pelo diff (changedColumns)
//     do update. Incluem id/organization_id/created_by (que changedColumns ignora), garantindo
//     que prevRow e nextRow do update tenham a MESMA forma do row de insert. ───
function assetRow(item: MaintenanceAsset, orgId: string, userId: string): Record<string, unknown> {
  return {
    id: item.id,
    organization_id: orgId,
    project_id: item.projectId,
    construction_site_id: item.constructionSiteId,
    code: item.code,
    name: item.name,
    type: item.type,
    status: item.status,
    criticality: item.criticality,
    responsible: item.responsible || null,
    location: item.location || null,
    qr_code: item.qrCode || null,
    payload: compactPayload(item as unknown as Record<string, unknown>),
    created_by: userId,
  }
}

function planRow(item: MaintenancePlan, orgId: string, userId: string): Record<string, unknown> {
  return {
    id: item.id,
    organization_id: orgId,
    project_id: item.projectId,
    construction_site_id: item.constructionSiteId,
    code: item.code,
    title: item.title,
    description: item.description || null,
    frequency: item.frequency,
    priority: item.priority,
    estimated_duration_minutes: item.estimatedDurationMinutes,
    checklist: item.checklist,
    next_due_date: item.nextDueDate || null,
    active: item.active,
    payload: compactPayload(item as unknown as Record<string, unknown>),
    created_by: userId,
  }
}

function workOrderRow(item: MaintenanceWorkOrder, orgId: string, userId: string): Record<string, unknown> {
  return {
    id: item.id,
    organization_id: orgId,
    project_id: item.projectId,
    construction_site_id: item.constructionSiteId,
    plan_id: item.planId,
    code: item.code,
    title: item.title,
    description: item.description || null,
    status: item.status,
    priority: item.priority,
    severity: item.severity,
    planned: item.planned,
    progress: item.progress,
    scheduled_date: item.scheduledDate || null,
    due_date: item.dueDate || null,
    started_at: item.startedAt,
    completed_at: item.completedAt,
    assignee: item.assignee || null,
    requester: item.requester || null,
    estimated_duration_minutes: item.estimatedDurationMinutes,
    actual_duration_minutes: item.actualDurationMinutes,
    estimated_cost: item.estimatedCost,
    actual_cost: item.actualCost,
    checklist: item.checklist,
    evidence: item.evidence,
    pmbok: item.pmbok,
    lean_lps: item.leanLps,
    payload: compactPayload(item as unknown as Record<string, unknown>),
    created_by: userId,
  }
}

function monitoringPointRow(item: MaintenanceMonitoringPoint, orgId: string, userId: string): Record<string, unknown> {
  return {
    id: item.id,
    organization_id: orgId,
    project_id: item.projectId,
    construction_site_id: item.constructionSiteId,
    asset_id: item.assetId,
    code: item.code,
    location_part: item.locationPart || null,
    description: item.description,
    device_state: item.deviceState || null,
    enabled: item.enabled,
    serial_number: item.serialNumber || null,
    is_counter: item.isCounter,
    unit: item.unit || null,
    last_reading_date: item.lastReadingDate || null,
    last_reading_value: item.lastReadingValue || null,
    min_value: item.minValue,
    max_value: item.maxValue,
    notes: item.notes || null,
    payload: compactPayload(item as unknown as Record<string, unknown>),
    created_by: userId,
  }
}

const FREQ_STEP: Record<MaintenanceFrequency, { months?: number; days?: number }> = {
  unica: {}, diaria: { days: 1 }, semanal: { days: 7 }, quinzenal: { days: 14 },
  mensal: { months: 1 }, bimestral: { months: 2 }, trimestral: { months: 3 },
  semestral: { months: 6 }, anual: { months: 12 },
}

/** Avança uma data de vencimento pela frequência até cair estritamente DEPOIS de hoje
 * (evita backlog: gera uma OS por plano e reprograma para a próxima ocorrência futura). */
function advanceDueDate(fromISO: string, freq: MaintenanceFrequency, todayISO: string): string {
  const step = FREQ_STEP[freq]
  if (!step.months && !step.days) return fromISO   // 'unica' não avança
  const limit = new Date(todayISO + 'T12:00:00')
  let d = new Date((fromISO || todayISO) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) d = new Date(todayISO + 'T12:00:00')   // data corrompida → parte de hoje
  let guard = 0
  do {
    if (step.months) d.setMonth(d.getMonth() + step.months)
    if (step.days) d.setDate(d.getDate() + step.days)
    guard++
  } while (d <= limit && guard < 100_000)   // backstop: 100k passos cobre até diário muito atrasado
  return d.toISOString().slice(0, 10)
}

// Best-effort e NÃO-bloqueante: os vínculos autoritativos viajam no payload da entidade (assetIds),
// então falha aqui (ex.: FK enquanto a entidade ainda não subiu) não perde dado — o pull reconcilia
// via o fallback de payload em asPlan/asWorkOrder. Chame como `void replaceLinks(...).catch(...)`.
async function replaceLinks(table: 'maintenance_plan_assets' | 'maintenance_work_order_assets', ownerColumn: 'plan_id' | 'work_order_id', ownerId: string, assetIds: string[]) {
  if (isNonProductionDataMode()) return   // modo demo: nunca escreve no banco real
  const { orgId, userId } = getContext()
  if (!orgId || !userId) return
  await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq(ownerColumn, ownerId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  const rows = assetIds.map((assetId) => ({
    organization_id: orgId,
    [ownerColumn]: ownerId,
    asset_id: assetId,
    created_by: userId,
  }))
  if (rows.length > 0) {
    const { error } = await supabase.from(table).insert(rows as never)
    if (error) throw error
  }
}

export const useManutencoesStore = create<ManutencoesState>()(
  persist(
    (set, get) => ({
      activeOrgId: null,
      assets: [],
      plans: [],
      workOrders: [],
      monitoringPoints: [],
      pendingSync: [],
      syncStatus: 'idle',
      syncError: null,
      lastSyncedAt: null,
      selectedAssetId: null,

      ensureTenantScope: (organizationId) => {
        if (!organizationId || get().activeOrgId === organizationId) return
        set({
          activeOrgId: organizationId,
          assets: [],
          plans: [],
          workOrders: [],
          monitoringPoints: [],
          pendingSync: [],
          syncStatus: 'idle',
          syncError: null,
          lastSyncedAt: null,
          selectedAssetId: null,
        })
      },

      clearData: () => set({
        activeOrgId: null,
        assets: [],
        plans: [],
        workOrders: [],
        monitoringPoints: [],
        pendingSync: [],
        syncStatus: 'idle',
        syncError: null,
        selectedAssetId: null,
      }),

      // Demo isolado: seed do "Residencial Modelo" (só em modo demo). pendingSync vazio → nunca
      // sincroniza (o sync já é no-op em demo); o real fica preservado no snapshot do appModeStore.
      loadDemoData: () => {
        const assets = predialDemoAssets()
        set({
          assets,
          plans: predialDemoPlans(assets),
          workOrders: predialDemoWorkOrders(assets),
          monitoringPoints: [],
          pendingSync: [],
          syncStatus: 'idle',
          syncError: null,
        })
      },

      setSelectedAssetId: (id) => set({ selectedAssetId: id }),

      flush: async () => {
        const queue = get().pendingSync
        if (queue.length === 0) return
        set({ syncStatus: 'syncing', syncError: null })
        const res = await flushQueue(queue)
        set((s) => {
          const remaining = s.pendingSync.filter((op) => !res.completed.includes(op.id))
          const offline = typeof navigator !== 'undefined' && !navigator.onLine
          return {
            pendingSync: remaining,
            syncStatus: res.errored.length ? 'error' : offline && remaining.length ? 'offline' : 'idle',
            syncError: res.lastError ?? null,
          }
        })
      },

      pull: async () => {
        if (isNonProductionDataMode()) return   // modo demo: não puxa dado real (não mistura com o mock)
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        get().ensureTenantScope(orgId)
        if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
        // Tenta drenar pendências antes de puxar (reenvia o que ficou de uma sessão offline).
        if (get().pendingSync.length) await get().flush()

        // Não zera o estado antes de buscar: se a busca falhar, mantém o local (evita perda).
        // Os arrays são substituídos só no caminho de sucesso, mais abaixo.
        set({ syncStatus: 'syncing', syncError: null })
        // Snapshot das pendências ANTES do fetch: se uma escrita local for enfileirada e drenada
        // enquanto os selects (que podem levar até 20s) estão em voo, o servidor volta sem a linha nova.
        // Preservar esses ids no merge evita a linha sumir da tela nessa janela (a próxima pull reconcilia).
        const pendingSnapshot = get().pendingSync
        const [assetsResult, plansResult, planAssetsResult, ordersResult, orderAssetsResult, monitoringResult] = await Promise.all([
          supabase.from('equipamentos').select('*').eq('organization_id', orgId).is('deleted_at', null).order('created_at', { ascending: false }),
          supabase.from('maintenance_plans').select('*').eq('organization_id', orgId).is('deleted_at', null).order('created_at', { ascending: false }),
          supabase.from('maintenance_plan_assets').select('*').eq('organization_id', orgId).is('deleted_at', null),
          supabase.from('maintenance_work_orders').select('*').eq('organization_id', orgId).is('deleted_at', null).order('created_at', { ascending: false }),
          supabase.from('maintenance_work_order_assets').select('*').eq('organization_id', orgId).is('deleted_at', null),
          supabase.from('maintenance_monitoring_points').select('*').eq('organization_id', orgId).is('deleted_at', null).order('created_at', { ascending: false }),
        ])

        const firstError = assetsResult.error ?? plansResult.error ?? planAssetsResult.error ?? ordersResult.error ?? orderAssetsResult.error ?? monitoringResult.error
        if (firstError) {
          set({ syncStatus: 'error', syncError: firstError.message })
          return
        }

        const planLinks = new Map<string, string[]>()
        for (const row of (planAssetsResult.data ?? []) as { plan_id: string; asset_id: string }[]) {
          planLinks.set(row.plan_id, [...(planLinks.get(row.plan_id) ?? []), row.asset_id])
        }

        const orderLinks = new Map<string, string[]>()
        for (const row of (orderAssetsResult.data ?? []) as { work_order_id: string; asset_id: string }[]) {
          orderLinks.set(row.work_order_id, [...(orderLinks.get(row.work_order_id) ?? []), row.asset_id])
        }

        const serverAssets = ((assetsResult.data ?? []) as EquipmentRow[]).map(asAsset)
        const serverPlans = ((plansResult.data ?? []) as PlanRow[]).map((row) => asPlan(row, planLinks.get(row.id) ?? []))
        const serverOrders = ((ordersResult.data ?? []) as WorkOrderRow[]).map((row) => asWorkOrder(row, orderLinks.get(row.id) ?? []))
        const serverMonitoring = ((monitoringResult.data ?? []) as MonitoringPointRow[]).map(asMonitoringPoint)

        set((s) => {
          // mergePull NÃO apaga registros com op pendente (ainda não confirmados no servidor).
          const pending = [...s.pendingSync, ...pendingSnapshot]
          return {
            assets: mergePull(serverAssets, s.assets, pending, 'equipamentos'),
            plans: mergePull(serverPlans, s.plans, pending, 'maintenance_plans'),
            workOrders: mergePull(serverOrders, s.workOrders, pending, 'maintenance_work_orders'),
            monitoringPoints: mergePull(serverMonitoring, s.monitoringPoints, pending, 'maintenance_monitoring_points'),
            syncStatus: s.pendingSync.length ? s.syncStatus : 'idle',
            syncError: null,
            lastSyncedAt: new Date().toISOString(),
          }
        })
      },

      addAsset: async (payload) => {
        const { orgId, userId } = getContext()
        if (!orgId || !userId) { set({ syncStatus: 'unauth' }); return null }
        get().ensureTenantScope(orgId)
        const id = payload.id ?? crypto.randomUUID()
        const now = new Date().toISOString()
        const item: MaintenanceAsset = {
          id,
          code: payload.code ?? `ATV-${String(get().assets.length + 1).padStart(3, '0')}`,
          name: payload.name ?? 'Ativo sem nome',
          type: payload.type ?? 'Geral',
          status: payload.status ?? 'idle',
          criticality: payload.criticality ?? 'media',
          responsible: payload.responsible ?? '',
          location: payload.location ?? '',
          qrCode: payload.qrCode ?? '',
          projectId: payload.projectId ?? null,
          constructionSiteId: payload.constructionSiteId ?? useActiveObraStore.getState().activeObraId ?? null,
          // Metadados do payload jsonb (Workbench/CapEx + Inventário/DNA): sem isto, CRIAR um ativo
          // descartava esses campos (só o UPDATE preservava via {...current}). compactPayload dropa os undefined.
          manuais: payload.manuais,
          replacementCostBRL: payload.replacementCostBRL,
          modelo: payload.modelo,
          serial: payload.serial,
          fabricante: payload.fabricante,
          sistema: payload.sistema,
          areaAtendida: payload.areaAtendida,
          dataInstalacao: payload.dataInstalacao,
          garantiaAte: payload.garantiaAte,
          vidaUtilAnosNBR: payload.vidaUtilAnosNBR,
          fotoPlaquetaPath: payload.fotoPlaquetaPath,
          anexos: payload.anexos,
          createdAt: now,
          updatedAt: now,
        }
        // Otimista: estado local + enfileira o insert. O dado já está salvo no aparelho.
        set((s) => ({
          assets: [item, ...s.assets.filter((asset) => asset.id !== id)],
          pendingSync: [...s.pendingSync, makeOp({ entity: 'asset', type: 'insert', recordId: id, row: assetRow(item, orgId, userId), table: 'equipamentos' })],
        }))
        void get().flush()
        return id
      },

      updateAsset: async (id, patch) => {
        const current = get().assets.find((asset) => asset.id === id)
        if (!current) return
        const { orgId, userId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
        const changed = changedColumns(assetRow(current, orgId, userId ?? ''), assetRow(next, orgId, userId ?? ''))
        set((s) => ({
          assets: s.assets.map((asset) => asset.id === id ? next : asset),
          pendingSync: Object.keys(changed).length
            ? [...s.pendingSync, makeOp({ entity: 'asset', type: 'update', recordId: id, patch: changed, table: 'equipamentos' })]
            : s.pendingSync,
        }))
        void get().flush()
      },

      deleteAsset: async (id) => {
        // Soft-delete otimista: remove local (+ limpa vínculos locais) e enfileira update de deleted_at.
        set((s) => ({
          assets: s.assets.filter((asset) => asset.id !== id),
          plans: s.plans.map((plan) => ({ ...plan, assetIds: plan.assetIds.filter((assetId) => assetId !== id) })),
          workOrders: s.workOrders.map((order) => ({ ...order, assetIds: order.assetIds.filter((assetId) => assetId !== id) })),
          selectedAssetId: s.selectedAssetId === id ? null : s.selectedAssetId,
          pendingSync: [...s.pendingSync, makeOp({ entity: 'asset', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'equipamentos' })],
        }))
        void get().flush()
      },

      addPlan: async (payload) => {
        const { orgId, userId } = getContext()
        if (!orgId || !userId) { set({ syncStatus: 'unauth' }); return null }
        get().ensureTenantScope(orgId)
        const id = payload.id ?? crypto.randomUUID()
        const now = new Date().toISOString()
        const item: MaintenancePlan = {
          id,
          code: payload.code ?? `PLN-${String(get().plans.length + 1).padStart(3, '0')}`,
          title: payload.title ?? 'Plano de manutenção',
          description: payload.description ?? '',
          frequency: payload.frequency ?? 'mensal',
          priority: payload.priority ?? 'media',
          estimatedDurationMinutes: payload.estimatedDurationMinutes ?? 60,
          checklist: payload.checklist ?? [],
          nextDueDate: payload.nextDueDate ?? today(),
          active: payload.active ?? true,
          assetIds: payload.assetIds ?? [],
          projectId: payload.projectId ?? null,
          constructionSiteId: payload.constructionSiteId ?? useActiveObraStore.getState().activeObraId ?? null,
          createdAt: now,
          updatedAt: now,
        }
        // Otimista: estado local + enfileira o insert (assetIds viajam no payload do row).
        set((s) => ({
          plans: [item, ...s.plans.filter((plan) => plan.id !== id)],
          pendingSync: [...s.pendingSync, makeOp({ entity: 'plan', type: 'insert', recordId: id, row: planRow(item, orgId, userId), table: 'maintenance_plans' })],
        }))
        // Vínculos best-effort/não-bloqueante (payload já é autoritativo): falha não trava o local.
        void replaceLinks('maintenance_plan_assets', 'plan_id', id, item.assetIds).catch(() => undefined)
        void get().flush()
        return id
      },

      updatePlan: async (id, patch) => {
        const current = get().plans.find((plan) => plan.id === id)
        if (!current) return
        const { orgId, userId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
        const changed = changedColumns(planRow(current, orgId, userId ?? ''), planRow(next, orgId, userId ?? ''))
        set((s) => ({
          plans: s.plans.map((plan) => plan.id === id ? next : plan),
          pendingSync: Object.keys(changed).length
            ? [...s.pendingSync, makeOp({ entity: 'plan', type: 'update', recordId: id, patch: changed, table: 'maintenance_plans' })]
            : s.pendingSync,
        }))
        void replaceLinks('maintenance_plan_assets', 'plan_id', id, next.assetIds).catch(() => undefined)
        void get().flush()
      },

      deletePlan: async (id) => {
        set((s) => ({
          plans: s.plans.filter((plan) => plan.id !== id),
          pendingSync: [...s.pendingSync, makeOp({ entity: 'plan', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'maintenance_plans' })],
        }))
        void get().flush()
      },

      generateWorkOrderFromPlan: async (planId) => {
        const plan = get().plans.find((item) => item.id === planId)
        if (!plan) return null
        return get().addWorkOrder({
          planId: plan.id,
          code: `OS-${String(get().workOrders.length + 1).padStart(4, '0')}`,
          title: plan.title,
          description: plan.description,
          priority: plan.priority,
          severity: plan.priority,
          planned: true,
          scheduledDate: plan.nextDueDate || today(),
          dueDate: plan.nextDueDate || today(),
          estimatedDurationMinutes: plan.estimatedDurationMinutes,
          checklist: plan.checklist,
          assetIds: plan.assetIds,
          projectId: plan.projectId,
          constructionSiteId: plan.constructionSiteId,
        })
      },

      // Varre planos ativos com vencimento <= hoje, abre 1 OS por plano e reprograma o
      // próximo vencimento (auto-avanço) — o "gerador de preventivas por calendário".
      generateDuePreventivas: async (obraId) => {
        const hojeStr = today()
        // Escopo pela obra ativa (igual ao inObra da UI): senão o botão contaria só a obra
        // mas geraria OS de TODAS as obras. obraId nulo/ausente = todas (nenhum filtro).
        const due = get().plans.filter((p) =>
          (!obraId || (p.constructionSiteId ?? null) === obraId) &&
          p.active && p.frequency !== 'unica' && !!p.nextDueDate && p.nextDueDate <= hojeStr)
        let count = 0
        for (const plan of due) {
          const id = await get().generateWorkOrderFromPlan(plan.id)
          if (!id) continue
          count++
          await get().updatePlan(plan.id, { nextDueDate: advanceDueDate(plan.nextDueDate, plan.frequency, hojeStr) })
        }
        return count
      },

      addWorkOrder: async (payload) => {
        const { orgId, userId } = getContext()
        if (!orgId || !userId) { set({ syncStatus: 'unauth' }); return null }
        get().ensureTenantScope(orgId)
        const id = payload.id ?? crypto.randomUUID()
        const now = new Date().toISOString()
        const item: MaintenanceWorkOrder = {
          id,
          code: payload.code ?? `OS-${String(get().workOrders.length + 1).padStart(4, '0')}`,
          title: payload.title ?? 'Ordem de serviço',
          description: payload.description ?? '',
          status: payload.status ?? 'pendente',
          priority: payload.priority ?? 'media',
          severity: payload.severity ?? 'media',
          impacto: payload.impacto,      // matriz impacto×urgência (payload jsonb)
          urgencia: payload.urgencia,
          planned: payload.planned ?? true,
          progress: payload.progress ?? 0,
          scheduledDate: payload.scheduledDate ?? today(),
          dueDate: payload.dueDate ?? payload.scheduledDate ?? today(),
          startedAt: payload.startedAt ?? null,
          completedAt: payload.completedAt ?? null,
          assignee: payload.assignee ?? '',
          requester: payload.requester ?? '',
          estimatedDurationMinutes: payload.estimatedDurationMinutes ?? 60,
          actualDurationMinutes: payload.actualDurationMinutes ?? null,
          estimatedCost: payload.estimatedCost ?? 0,
          actualCost: payload.actualCost ?? 0,
          checklist: payload.checklist ?? [],
          evidence: payload.evidence ?? [],
          pmbok: payload.pmbok ?? {},
          leanLps: payload.leanLps ?? {},
          assetIds: payload.assetIds ?? [],
          planId: payload.planId ?? null,
          projectId: payload.projectId ?? null,
          constructionSiteId: payload.constructionSiteId ?? useActiveObraStore.getState().activeObraId ?? null,
          createdAt: now,
          updatedAt: now,
        }
        // Otimista: estado local + enfileira o insert (assetIds viajam no payload do row).
        set((s) => ({
          workOrders: [item, ...s.workOrders.filter((order) => order.id !== id)],
          pendingSync: [...s.pendingSync, makeOp({ entity: 'workOrder', type: 'insert', recordId: id, row: workOrderRow(item, orgId, userId), table: 'maintenance_work_orders' })],
        }))
        void replaceLinks('maintenance_work_order_assets', 'work_order_id', id, item.assetIds).catch(() => undefined)
        void get().flush()
        return id
      },

      updateWorkOrder: async (id, patch) => {
        const current = get().workOrders.find((order) => order.id === id)
        if (!current) return
        const { orgId, userId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const next: MaintenanceWorkOrder = { ...current, ...patch, updatedAt: new Date().toISOString() }
        if (patch.status === 'concluida' && !next.completedAt) next.completedAt = new Date().toISOString()
        if (patch.status === 'em_processo' && !next.startedAt) next.startedAt = new Date().toISOString()
        const changed = changedColumns(workOrderRow(current, orgId, userId ?? ''), workOrderRow(next, orgId, userId ?? ''))
        set((s) => ({
          workOrders: s.workOrders.map((order) => order.id === id ? next : order),
          pendingSync: Object.keys(changed).length
            ? [...s.pendingSync, makeOp({ entity: 'workOrder', type: 'update', recordId: id, patch: changed, table: 'maintenance_work_orders' })]
            : s.pendingSync,
        }))
        void replaceLinks('maintenance_work_order_assets', 'work_order_id', id, next.assetIds).catch(() => undefined)
        void get().flush()
      },

      deleteWorkOrder: async (id) => {
        set((s) => ({
          workOrders: s.workOrders.filter((order) => order.id !== id),
          pendingSync: [...s.pendingSync, makeOp({ entity: 'workOrder', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'maintenance_work_orders' })],
        }))
        void get().flush()
      },

      addMonitoringPoint: async (payload) => {
        const { orgId, userId } = getContext()
        if (!orgId || !userId) { set({ syncStatus: 'unauth' }); return null }
        get().ensureTenantScope(orgId)
        const id = payload.id ?? crypto.randomUUID()
        const now = new Date().toISOString()
        const item: MaintenanceMonitoringPoint = {
          id,
          code: payload.code ?? `MON-${String(get().monitoringPoints.length + 1).padStart(3, '0')}`,
          locationPart: payload.locationPart ?? '',
          description: payload.description ?? 'Novo sensor / medidor',
          deviceState: payload.deviceState ?? '--',
          enabled: payload.enabled ?? true,
          serialNumber: payload.serialNumber ?? '',
          isCounter: payload.isCounter ?? false,
          unit: payload.unit ?? '',
          lastReadingDate: payload.lastReadingDate ?? '',
          lastReadingValue: payload.lastReadingValue ?? '',
          minValue: payload.minValue ?? null,
          maxValue: payload.maxValue ?? null,
          notes: payload.notes ?? '',
          assetId: payload.assetId ?? null,
          projectId: payload.projectId ?? null,
          constructionSiteId: payload.constructionSiteId ?? useActiveObraStore.getState().activeObraId ?? null,
          createdAt: now,
          updatedAt: now,
        }
        // Otimista: estado local + enfileira o insert. O dado já está salvo no aparelho.
        set((s) => ({
          monitoringPoints: [item, ...s.monitoringPoints.filter((point) => point.id !== id)],
          pendingSync: [...s.pendingSync, makeOp({ entity: 'monitoringPoint', type: 'insert', recordId: id, row: monitoringPointRow(item, orgId, userId), table: 'maintenance_monitoring_points' })],
        }))
        void get().flush()
        return id
      },

      updateMonitoringPoint: async (id, patch) => {
        const current = get().monitoringPoints.find((point) => point.id === id)
        if (!current) return
        const { orgId, userId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
        const changed = changedColumns(monitoringPointRow(current, orgId, userId ?? ''), monitoringPointRow(next, orgId, userId ?? ''))
        set((s) => ({
          monitoringPoints: s.monitoringPoints.map((point) => point.id === id ? next : point),
          pendingSync: Object.keys(changed).length
            ? [...s.pendingSync, makeOp({ entity: 'monitoringPoint', type: 'update', recordId: id, patch: changed, table: 'maintenance_monitoring_points' })]
            : s.pendingSync,
        }))
        void get().flush()
      },

      deleteMonitoringPoint: async (id) => {
        set((s) => ({
          monitoringPoints: s.monitoringPoints.filter((point) => point.id !== id),
          pendingSync: [...s.pendingSync, makeOp({ entity: 'monitoringPoint', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'maintenance_monitoring_points' })],
        }))
        void get().flush()
      },
    }),
    {
      name: 'cdata-manutencoes',
      partialize: (state) => ({
        activeOrgId: state.activeOrgId,
        assets: state.assets,
        plans: state.plans,
        workOrders: state.workOrders,
        monitoringPoints: state.monitoringPoints,
        pendingSync: state.pendingSync,   // a fila sobrevive ao reload (não perde escrita offline)
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
)

// Reenvia a fila ao reconectar (escritas feitas offline sobem sozinhas).
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void useManutencoesStore.getState().flush() })
}
