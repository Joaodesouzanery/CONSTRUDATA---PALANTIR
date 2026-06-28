import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useActiveObraStore } from '@/store/activeObraStore'

export type MaintenanceStatus = 'pendente' | 'em_processo' | 'em_verificacao' | 'concluida' | 'cancelada'
export type MaintenancePriority = 'baixa' | 'media' | 'alta' | 'critica'
export type MaintenanceFrequency = 'unica' | 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'
export type MaintenanceAssetStatus = 'active' | 'idle' | 'maintenance' | 'alert' | 'offline'

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
  syncStatus: 'idle' | 'syncing' | 'offline' | 'unauth' | 'error'
  syncError: string | null
  lastSyncedAt: string | null
  selectedAssetId: string | null
  ensureTenantScope: (organizationId: string) => void
  clearData: () => void
  pull: () => Promise<void>
  addAsset: (payload: Partial<MaintenanceAsset>) => Promise<string | null>
  updateAsset: (id: string, patch: Partial<MaintenanceAsset>) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  addPlan: (payload: Partial<MaintenancePlan>) => Promise<string | null>
  updatePlan: (id: string, patch: Partial<MaintenancePlan>) => Promise<void>
  deletePlan: (id: string) => Promise<void>
  generateWorkOrderFromPlan: (planId: string) => Promise<string | null>
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

function asAsset(row: EquipmentRow): MaintenanceAsset {
  const payload = row.payload ?? {}
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
    assetIds,
    projectId: row.project_id,
    constructionSiteId: row.construction_site_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function asWorkOrder(row: WorkOrderRow, assetIds: string[]): MaintenanceWorkOrder {
  return {
    id: row.id,
    code: row.code ?? '',
    title: row.title,
    description: row.description ?? '',
    status: row.status,
    priority: row.priority,
    severity: row.severity,
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
    assetIds,
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

async function replaceLinks(table: 'maintenance_plan_assets' | 'maintenance_work_order_assets', ownerColumn: 'plan_id' | 'work_order_id', ownerId: string, assetIds: string[]) {
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
        syncStatus: 'idle',
        syncError: null,
        selectedAssetId: null,
      }),

      setSelectedAssetId: (id) => set({ selectedAssetId: id }),

      pull: async () => {
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        get().ensureTenantScope(orgId)
        if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }

        set({ syncStatus: 'syncing', syncError: null, assets: [], plans: [], workOrders: [], monitoringPoints: [], selectedAssetId: null })
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

        set({
          assets: ((assetsResult.data ?? []) as EquipmentRow[]).map(asAsset),
          plans: ((plansResult.data ?? []) as PlanRow[]).map((row) => asPlan(row, planLinks.get(row.id) ?? [])),
          workOrders: ((ordersResult.data ?? []) as WorkOrderRow[]).map((row) => asWorkOrder(row, orderLinks.get(row.id) ?? [])),
          monitoringPoints: ((monitoringResult.data ?? []) as MonitoringPointRow[]).map(asMonitoringPoint),
          syncStatus: 'idle',
          syncError: null,
          lastSyncedAt: new Date().toISOString(),
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
          createdAt: now,
          updatedAt: now,
        }
        const row = {
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
        const { error } = await supabase.from('equipamentos').upsert(row as never, { onConflict: 'id' })
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return null }
        set((s) => ({ assets: [item, ...s.assets.filter((asset) => asset.id !== id)] }))
        return id
      },

      updateAsset: async (id, patch) => {
        const current = get().assets.find((asset) => asset.id === id)
        if (!current) return
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const updateRow = {
          project_id: next.projectId,
          construction_site_id: next.constructionSiteId,
          code: next.code,
          name: next.name,
          type: next.type,
          status: next.status,
          criticality: next.criticality,
          responsible: next.responsible || null,
          location: next.location || null,
          qr_code: next.qrCode || null,
          payload: compactPayload(next as unknown as Record<string, unknown>),
        }
        const { error } = await supabase.from('equipamentos').update(updateRow as never).eq('id', id).eq('organization_id', orgId).select('id')
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        set((s) => ({ assets: s.assets.map((asset) => asset.id === id ? next : asset) }))
      },

      deleteAsset: async (id) => {
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const { error } = await supabase.from('equipamentos').update({ deleted_at: new Date().toISOString() } as never).eq('id', id).eq('organization_id', orgId).select('id')
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        set((s) => ({
          assets: s.assets.filter((asset) => asset.id !== id),
          plans: s.plans.map((plan) => ({ ...plan, assetIds: plan.assetIds.filter((assetId) => assetId !== id) })),
          workOrders: s.workOrders.map((order) => ({ ...order, assetIds: order.assetIds.filter((assetId) => assetId !== id) })),
          selectedAssetId: s.selectedAssetId === id ? null : s.selectedAssetId,
        }))
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
        const row = {
          id,
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
        const { error } = await supabase.from('maintenance_plans').upsert(row as never, { onConflict: 'id' })
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return null }
        await replaceLinks('maintenance_plan_assets', 'plan_id', id, item.assetIds)
        set((s) => ({ plans: [item, ...s.plans.filter((plan) => plan.id !== id)] }))
        return id
      },

      updatePlan: async (id, patch) => {
        const current = get().plans.find((plan) => plan.id === id)
        if (!current) return
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const row = {
          project_id: next.projectId,
          construction_site_id: next.constructionSiteId,
          code: next.code,
          title: next.title,
          description: next.description || null,
          frequency: next.frequency,
          priority: next.priority,
          estimated_duration_minutes: next.estimatedDurationMinutes,
          checklist: next.checklist,
          next_due_date: next.nextDueDate || null,
          active: next.active,
          payload: compactPayload(next as unknown as Record<string, unknown>),
        }
        const { error } = await supabase.from('maintenance_plans').update(row as never).eq('id', id).eq('organization_id', orgId).select('id')
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        await replaceLinks('maintenance_plan_assets', 'plan_id', id, next.assetIds)
        set((s) => ({ plans: s.plans.map((plan) => plan.id === id ? next : plan) }))
      },

      deletePlan: async (id) => {
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const { error } = await supabase.from('maintenance_plans').update({ deleted_at: new Date().toISOString() } as never).eq('id', id).eq('organization_id', orgId).select('id')
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        set((s) => ({ plans: s.plans.filter((plan) => plan.id !== id) }))
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
        const row = {
          id,
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
        const { error } = await supabase.from('maintenance_work_orders').upsert(row as never, { onConflict: 'id' })
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return null }
        await replaceLinks('maintenance_work_order_assets', 'work_order_id', id, item.assetIds)
        set((s) => ({ workOrders: [item, ...s.workOrders.filter((order) => order.id !== id)] }))
        return id
      },

      updateWorkOrder: async (id, patch) => {
        const current = get().workOrders.find((order) => order.id === id)
        if (!current) return
        const next: MaintenanceWorkOrder = { ...current, ...patch, updatedAt: new Date().toISOString() }
        if (patch.status === 'concluida' && !next.completedAt) next.completedAt = new Date().toISOString()
        if (patch.status === 'em_processo' && !next.startedAt) next.startedAt = new Date().toISOString()
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const row = {
          project_id: next.projectId,
          construction_site_id: next.constructionSiteId,
          plan_id: next.planId,
          code: next.code,
          title: next.title,
          description: next.description || null,
          status: next.status,
          priority: next.priority,
          severity: next.severity,
          planned: next.planned,
          progress: next.progress,
          scheduled_date: next.scheduledDate || null,
          due_date: next.dueDate || null,
          started_at: next.startedAt,
          completed_at: next.completedAt,
          assignee: next.assignee || null,
          requester: next.requester || null,
          estimated_duration_minutes: next.estimatedDurationMinutes,
          actual_duration_minutes: next.actualDurationMinutes,
          estimated_cost: next.estimatedCost,
          actual_cost: next.actualCost,
          checklist: next.checklist,
          evidence: next.evidence,
          pmbok: next.pmbok,
          lean_lps: next.leanLps,
          payload: compactPayload(next as unknown as Record<string, unknown>),
        }
        const { error } = await supabase.from('maintenance_work_orders').update(row as never).eq('id', id).eq('organization_id', orgId).select('id')
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        await replaceLinks('maintenance_work_order_assets', 'work_order_id', id, next.assetIds)
        set((s) => ({ workOrders: s.workOrders.map((order) => order.id === id ? next : order) }))
      },

      deleteWorkOrder: async (id) => {
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const { error } = await supabase.from('maintenance_work_orders').update({ deleted_at: new Date().toISOString() } as never).eq('id', id).eq('organization_id', orgId).select('id')
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        set((s) => ({ workOrders: s.workOrders.filter((order) => order.id !== id) }))
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
        const row = {
          id,
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
        const { error } = await supabase.from('maintenance_monitoring_points').upsert(row as never, { onConflict: 'id' })
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return null }
        set((s) => ({ monitoringPoints: [item, ...s.monitoringPoints.filter((point) => point.id !== id)] }))
        return id
      },

      updateMonitoringPoint: async (id, patch) => {
        const current = get().monitoringPoints.find((point) => point.id === id)
        if (!current) return
        const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const row = {
          project_id: next.projectId,
          construction_site_id: next.constructionSiteId,
          asset_id: next.assetId,
          code: next.code,
          location_part: next.locationPart || null,
          description: next.description,
          device_state: next.deviceState || null,
          enabled: next.enabled,
          serial_number: next.serialNumber || null,
          is_counter: next.isCounter,
          unit: next.unit || null,
          last_reading_date: next.lastReadingDate || null,
          last_reading_value: next.lastReadingValue || null,
          min_value: next.minValue,
          max_value: next.maxValue,
          notes: next.notes || null,
          payload: compactPayload(next as unknown as Record<string, unknown>),
        }
        const { error } = await supabase.from('maintenance_monitoring_points').update(row as never).eq('id', id).eq('organization_id', orgId).select('id')
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        set((s) => ({ monitoringPoints: s.monitoringPoints.map((point) => point.id === id ? next : point) }))
      },

      deleteMonitoringPoint: async (id) => {
        const { orgId } = getContext()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        const { error } = await supabase.from('maintenance_monitoring_points').update({ deleted_at: new Date().toISOString() } as never).eq('id', id).eq('organization_id', orgId).select('id')
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        set((s) => ({ monitoringPoints: s.monitoringPoints.filter((point) => point.id !== id) }))
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
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useManutencoesStore.getState().pull()
  })
}
