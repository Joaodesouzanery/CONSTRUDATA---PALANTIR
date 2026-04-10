/**
 * planejamentoStore.ts — Zustand store for the Planejamento module.
 *
 * Security:
 *  - All IDs via crypto.randomUUID()
 *  - No external calls, no localStorage
 *  - Input mutations set isScheduleDirty; runSchedule() clears it
 *  - Platform imports are read-only (never mutate source stores)
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  PlanTrecho,
  PlanTeam,
  PlanProductivityTable,
  PlanScheduleConfig,
  PlanHoliday,
  GanttRow,
  SCurvePoint,
  HistogramPoint,
  AbcItem,
  ServiceNote,
  PlanScenario,
  TechnicalRule,
} from '@/types'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import {
  MOCK_TRECHOS,
  MOCK_TEAMS,
  MOCK_PRODUCTIVITY,
  MOCK_SCHEDULE_CONFIG,
  MOCK_HOLIDAYS,
  MOCK_NOTES,
  MOCK_BASE_SCENARIO,
} from '@/data/mockPlanejamento'
import { generateSchedule } from '@/features/planejamento/utils/scheduleEngine'
import {
  computeAbcCurve,
  computeSCurve,
  computeHistogram,
} from '@/features/planejamento/utils/analysisEngine'

// ─── Tab type ─────────────────────────────────────────────────────────────────

export type PlanejamentoTab =
  | 'config'
  | 'trechos'
  | 'gantt'
  | 'scurve'
  | 'abc'
  | 'histogram'
  | 'daily'
  | 'notes'
  | 'scenarios'

// ─── State interface ──────────────────────────────────────────────────────────

interface PlanejamentoState {
  // Navigation
  activeTab: PlanejamentoTab

  // Plan identity
  planName: string

  // Inputs (mutations set isScheduleDirty)
  trechos:           PlanTrecho[]
  teams:             PlanTeam[]
  productivityTable: PlanProductivityTable
  scheduleConfig:    PlanScheduleConfig
  holidays:          PlanHoliday[]

  // Computed (set by runSchedule)
  ganttRows:        GanttRow[]
  workDays:         string[]
  totalCostBRL:     number
  totalMeters:      number
  projectEndDate:   string | null
  isScheduleDirty:  boolean
  scurvePoints:     SCurvePoint[]
  histogramPoints:  HistogramPoint[]
  abcItems:         AbcItem[]

  // Notes + Scenarios
  notes:     ServiceNote[]
  scenarios: PlanScenario[]

  // Technical Rules
  technicalRules: TechnicalRule[]

  // Project budget
  projectBudget: number

  // Sync state
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  // ── Actions ──────────────────────────────────────────────────────────────────

  setActiveTab: (tab: PlanejamentoTab) => void
  setPlanName: (name: string) => void
  setProjectBudget: (budget: number) => void
  initBlankPlan: (nome: string) => void

  // Trechos
  addTrecho:    (t: Omit<PlanTrecho, 'id'>) => void
  updateTrecho: (id: string, updates: Partial<Omit<PlanTrecho, 'id'>>) => void
  removeTrecho: (id: string) => void
  reorderTrechos: (trechos: PlanTrecho[]) => void
  importTrechosFromPlatform: () => void

  // Teams
  addTeam:    (t: Omit<PlanTeam, 'id'>) => void
  updateTeam: (id: string, updates: Partial<Omit<PlanTeam, 'id'>>) => void
  removeTeam: (id: string) => void

  // Productivity
  setProductivityTable: (p: PlanProductivityTable) => void

  // Schedule config
  setScheduleConfig: (c: PlanScheduleConfig) => void

  // Holidays
  addHoliday:    (h: PlanHoliday) => void
  removeHoliday: (date: string) => void

  // Schedule execution
  runSchedule: () => void

  // Notes
  addNote:    (n: Omit<ServiceNote, 'id' | 'createdAt'>) => void
  updateNote: (id: string, updates: Partial<Omit<ServiceNote, 'id'>>) => void
  removeNote: (id: string) => void

  // Scenarios
  saveScenario:   (name: string, description?: string) => void
  loadScenario:   (id: string) => void
  renameScenario: (id: string, name: string, description?: string) => void
  removeScenario: (id: string) => void

  // Technical Rules
  addTechnicalRule:    (rule: Omit<TechnicalRule, 'id'>) => void
  updateTechnicalRule: (id: string, updates: Partial<Omit<TechnicalRule, 'id'>>) => void
  removeTechnicalRule: (id: string) => void

  // RDO sync — receives execution data from RDO module
  syncExecutionFromRdo: (entries: Array<{ trechoCode: string; executedMeters: number; date: string }>) => void

  // Demo / clear
  loadDemoData: () => void
  clearData:    () => void

  // Sync
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

// ─── Mappers para Supabase ───────────────────────────────────────────────────
function trechoToRow(t: PlanTrecho, orgId: string, userId: string) {
  return {
    id:                  t.id,
    organization_id:     orgId,
    code:                t.code,
    description:         t.description,
    length_m:            t.lengthM,
    depth_m:             t.depthM,
    diameter_mm:         t.diameterMm,
    soil_type:           t.soilType,
    requires_shoring:    t.requiresShoring,
    unit_cost_brl:       t.unitCostBRL ?? null,
    notes:               t.notes ?? null,
    assigned_team_index: t.assignedTeamIndex ?? null,
    planned_start_date:  t.plannedStartDate ?? null,
    planned_end_date:    t.plannedEndDate ?? null,
    abc_zone:            t.abcZone ?? null,
    executed_meters:     t.executedMeters ?? 0,
    execution_status:    t.executionStatus ?? 'not_started',
    last_rdo_date:       t.lastRdoDate ?? null,
    payload:             {},
    created_by:          userId,
  }
}

function teamToRow(t: PlanTeam, orgId: string, userId: string) {
  return {
    id:                       t.id,
    organization_id:          orgId,
    name:                     t.name,
    foreman_count:            t.foremanCount,
    worker_count:             t.workerCount,
    helper_count:             t.helperCount,
    operator_count:           t.operatorCount,
    retroescavadeira:         t.retroescavadeira,
    compactador:              t.compactador,
    caminhao_basculante:      t.caminhaoBasculante,
    labor_hourly_rate_brl:    t.laborHourlyRateBRL,
    equipment_daily_rate_brl: t.equipmentDailyRateBRL,
    max_manual_excav_depth_m: t.maxManualExcavDepthM,
    payload:                  {},
    created_by:               userId,
  }
}

function holidayToRow(h: PlanHoliday & { id?: string }, orgId: string, userId: string) {
  return {
    id:              h.id ?? crypto.randomUUID(),
    organization_id: orgId,
    date:            h.date,
    description:     h.description,
    recurring:       false,
    created_by:      userId,
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlanejamentoStore = create<PlanejamentoState>()(
  persist(
    (set, get) => ({
  activeTab: 'config',
  planName: '',

  trechos:           [],
  teams:             [],
  productivityTable: MOCK_PRODUCTIVITY,
  scheduleConfig:    MOCK_SCHEDULE_CONFIG,
  holidays:          [],

  pendingSync:  [] as PendingOp[],
  syncStatus:   'idle' as SyncStatus,
  lastSyncedAt: null as string | null,
  syncError:    null as string | null,

  ganttRows:       [],
  workDays:        [],
  totalCostBRL:    0,
  totalMeters:     0,
  projectEndDate:  null,
  isScheduleDirty: true,
  scurvePoints:    [],
  histogramPoints: [],
  abcItems:        [],

  notes:     [],
  scenarios: [],

  technicalRules: [
    { id: crypto.randomUUID(), name: 'Solo Rochoso — penalidade', condition: "soilType === 'rocky'", productivityMultiplier: 0.6, costMultiplier: 1.4 },
    { id: crypto.randomUUID(), name: 'Escoramento — restrição', condition: 'requiresShoring === true', productivityMultiplier: 0.75, costMultiplier: 1.25 },
  ],

  projectBudget: 0,

  // ── Navigation ────────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),
  setPlanName: (name) => set({ planName: name }),
  setProjectBudget: (budget) => set({ projectBudget: Math.max(0, budget) }),

  initBlankPlan: (nome) => set({
    planName:        nome,
    trechos:         [],
    teams:           [],
    ganttRows:       [],
    workDays:        [],
    totalCostBRL:    0,
    totalMeters:     0,
    projectEndDate:  null,
    isScheduleDirty: false,
    scurvePoints:    [],
    histogramPoints: [],
    abcItems:        [],
    notes:           [],
    activeTab:       'trechos',
    productivityTable: MOCK_PRODUCTIVITY,
    scheduleConfig:    MOCK_SCHEDULE_CONFIG,
    holidays:          [],
  }),

  // ── Trechos ───────────────────────────────────────────────────────────────────

  addTrecho: (t) => {
    const newT: PlanTrecho = { ...t, id: crypto.randomUUID() }
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    set((s) => ({
      trechos: [...s.trechos, newT],
      isScheduleDirty: true,
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'trecho', type: 'insert', recordId: newT.id, row: trechoToRow(newT, orgId, userId), table: 'plan_trechos' }),
      ],
    }))
    void get().flush()
  },

  updateTrecho: (id, updates) => {
    set((s) => {
      const updated = s.trechos.map((t) => t.id === id ? { ...t, ...updates } : t)
      const target  = updated.find((t) => t.id === id)
      const { profile, user } = useAuth.getState()
      const orgId  = profile?.organization_id ?? 'pending'
      const userId = user?.id ?? 'pending'
      const row    = target ? trechoToRow(target, orgId, userId) : undefined
      const patch  = row ? Object.fromEntries(Object.entries(row).filter(([k]) =>
        !['id','organization_id','created_by'].includes(k))) : undefined
      return {
        trechos: updated,
        isScheduleDirty: true,
        pendingSync: [
          ...s.pendingSync,
          makeOp({ entity: 'trecho', type: 'update', recordId: id, patch, table: 'plan_trechos' }),
        ],
      }
    })
    void get().flush()
  },

  removeTrecho: (id) => {
    set((s) => ({
      trechos: s.trechos.filter((t) => t.id !== id),
      isScheduleDirty: true,
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'trecho', type: 'delete', recordId: id, table: 'plan_trechos', approvalActionType: 'delete_plan_trecho' }),
      ],
    }))
    void get().flush()
  },

  reorderTrechos: (trechos) => set({ trechos, isScheduleDirty: true }),

  importTrechosFromPlatform: () => {
    // Lazy import to avoid circular dependency — fire-and-forget
    import('./preConstrucaoStore')
      .then(({ usePreConstrucaoStore }) => {
        type TakeoffItem = {
          id: string
          description: string
          unit: string
          quantity: number
          unitCost?: number
        }
        const state = usePreConstrucaoStore.getState() as { takeoffItems: TakeoffItem[] }
        const items: TakeoffItem[] = state.takeoffItems ?? []
        const mlItems = items.filter((item) => item.unit === 'ml' || item.unit === 'm')
        if (mlItems.length === 0) return

        const newTrechos: PlanTrecho[] = mlItems.map((item, idx) => ({
          id: crypto.randomUUID(),
          code: `T${String(idx + 1).padStart(2, '0')}`,
          description: item.description,
          lengthM: Math.max(1, item.quantity),
          depthM: 1.5,
          diameterMm: 200,
          soilType: 'normal' as const,
          requiresShoring: false,
          unitCostBRL: item.unitCost,
        }))

        set((s) => ({
          trechos: [...s.trechos, ...newTrechos],
          isScheduleDirty: true,
        }))
      })
      .catch(() => {
        // preConstrucaoStore not available — silently ignore
      })
  },

  // ── Teams ─────────────────────────────────────────────────────────────────────

  addTeam: (t) => {
    const newT: PlanTeam = { ...t, id: crypto.randomUUID() }
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    set((s) => ({
      teams: [...s.teams, newT],
      isScheduleDirty: true,
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'team', type: 'insert', recordId: newT.id, row: teamToRow(newT, orgId, userId), table: 'plan_teams' }),
      ],
    }))
    void get().flush()
  },

  updateTeam: (id, updates) => {
    set((s) => {
      const updated = s.teams.map((t) => t.id === id ? { ...t, ...updates } : t)
      const target  = updated.find((t) => t.id === id)
      const { profile, user } = useAuth.getState()
      const orgId  = profile?.organization_id ?? 'pending'
      const userId = user?.id ?? 'pending'
      const row    = target ? teamToRow(target, orgId, userId) : undefined
      const patch  = row ? Object.fromEntries(Object.entries(row).filter(([k]) =>
        !['id','organization_id','created_by'].includes(k))) : undefined
      return {
        teams: updated,
        isScheduleDirty: true,
        pendingSync: [
          ...s.pendingSync,
          makeOp({ entity: 'team', type: 'update', recordId: id, patch, table: 'plan_teams' }),
        ],
      }
    })
    void get().flush()
  },

  removeTeam: (id) => {
    set((s) => ({
      teams: s.teams.filter((t) => t.id !== id),
      isScheduleDirty: true,
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'team', type: 'delete', recordId: id, table: 'plan_teams' }),
      ],
    }))
    void get().flush()
  },

  // ── Productivity ──────────────────────────────────────────────────────────────

  setProductivityTable: (p) => set({ productivityTable: p, isScheduleDirty: true }),

  // ── Schedule Config ───────────────────────────────────────────────────────────

  setScheduleConfig: (c) => set({ scheduleConfig: c, isScheduleDirty: true }),

  // ── Holidays ──────────────────────────────────────────────────────────────────

  addHoliday: (h) => {
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    const row    = holidayToRow(h, orgId, userId)
    set((s) => ({
      holidays: [...s.holidays.filter((x) => x.date !== h.date), h]
        .sort((a, b) => a.date.localeCompare(b.date)),
      isScheduleDirty: true,
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'holiday', type: 'insert', recordId: row.id, row, table: 'plan_holidays' }),
      ],
    }))
    void get().flush()
  },

  removeHoliday: (date) => {
    set((s) => ({
      holidays: s.holidays.filter((h) => h.date !== date),
      isScheduleDirty: true,
    }))
    // Para holidays usamos DELETE direto (não crítico)
    void get().flush()
  },

  // ── Schedule Execution ────────────────────────────────────────────────────────

  runSchedule: () => {
    const { trechos, teams, productivityTable, scheduleConfig, holidays } = get()
    const result = generateSchedule(trechos, teams, productivityTable, scheduleConfig, holidays)

    const abcItems = computeAbcCurve(result.ganttRows)
    const scurvePoints = computeSCurve(
      result.ganttRows,
      result.workDays,
      result.totalMeters,
      result.totalCostBRL,
    )
    const histogramPoints = computeHistogram(
      result.ganttRows,
      result.workDays,
      teams,
      scheduleConfig,
    )

    // Update trecho-level derived fields
    const updatedTrechos = trechos.map((t) => {
      const row = result.ganttRows.find((r) => r.trecho.id === t.id)
      const abcItem = abcItems.find((a) => a.trecho.id === t.id)
      if (!row) return t
      return {
        ...t,
        assignedTeamIndex: row.teamIndex,
        plannedStartDate: row.startDate,
        plannedEndDate: row.endDate,
        abcZone: abcItem?.zone,
      }
    })

    set({
      ganttRows:       result.ganttRows,
      workDays:        result.workDays,
      totalCostBRL:    result.totalCostBRL,
      totalMeters:     result.totalMeters,
      projectEndDate:  result.projectEndDate,
      isScheduleDirty: false,
      scurvePoints,
      histogramPoints,
      abcItems,
      trechos:         updatedTrechos,
    })
  },

  // ── Notes ─────────────────────────────────────────────────────────────────────

  addNote: (n) =>
    set((s) => ({
      notes: [
        ...s.notes,
        { ...n, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ],
    })),

  updateNote: (id, updates) =>
    set((s) => ({
      notes: s.notes.map((n) => n.id === id ? { ...n, ...updates } : n),
    })),

  removeNote: (id) =>
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  // ── Scenarios ─────────────────────────────────────────────────────────────────

  saveScenario: (name, description) => {
    const { trechos, teams, productivityTable, scheduleConfig, holidays } = get()
    const now = new Date().toISOString()
    const scenario: PlanScenario = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      trechos:           structuredClone(trechos),
      teams:             structuredClone(teams),
      productivityTable: structuredClone(productivityTable),
      scheduleConfig:    structuredClone(scheduleConfig),
      holidays:          structuredClone(holidays),
    }
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    const row = {
      id:              scenario.id,
      organization_id: orgId,
      name:            scenario.name,
      description:     scenario.description ?? null,
      is_baseline:     false,
      payload:         {
        trechos: scenario.trechos,
        teams: scenario.teams,
        productivityTable: scenario.productivityTable,
        scheduleConfig: scenario.scheduleConfig,
        holidays: scenario.holidays,
      },
      created_by:      userId,
    }
    set((s) => ({
      scenarios: [...s.scenarios, scenario],
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'scenario', type: 'insert', recordId: scenario.id, row, table: 'plan_scenarios' }),
      ],
    }))
    void get().flush()
  },

  loadScenario: (id) => {
    const scenario = get().scenarios.find((s) => s.id === id)
    if (!scenario) return
    set({
      trechos:           structuredClone(scenario.trechos),
      teams:             structuredClone(scenario.teams),
      productivityTable: structuredClone(scenario.productivityTable),
      scheduleConfig:    structuredClone(scenario.scheduleConfig),
      holidays:          structuredClone(scenario.holidays),
      isScheduleDirty:   true,
    })
  },

  renameScenario: (id, name, description) =>
    set((s) => ({
      scenarios: s.scenarios.map((sc) =>
        sc.id === id
          ? { ...sc, name, description, updatedAt: new Date().toISOString() }
          : sc,
      ),
    })),

  removeScenario: (id) => {
    set((s) => ({
      scenarios: s.scenarios.filter((sc) => sc.id !== id),
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'scenario', type: 'delete', recordId: id, table: 'plan_scenarios', approvalActionType: 'delete_plan_scenario' }),
      ],
    }))
    void get().flush()
  },

  // ── Technical Rules ───────────────────────────────────────────────────────────

  addTechnicalRule: (rule) =>
    set((s) => ({ technicalRules: [...s.technicalRules, { ...rule, id: crypto.randomUUID() }] })),

  updateTechnicalRule: (id, updates) =>
    set((s) => ({ technicalRules: s.technicalRules.map((r) => r.id === id ? { ...r, ...updates } : r) })),

  removeTechnicalRule: (id) =>
    set((s) => ({ technicalRules: s.technicalRules.filter((r) => r.id !== id) })),

  // ── RDO Sync ──────────────────────────────────────────────────────────────────

  syncExecutionFromRdo: (entries) =>
    set((s) => ({
      trechos: s.trechos.map((t) => {
        const match = entries.find((e) => e.trechoCode === t.code)
        if (!match) return t
        const status: 'not_started' | 'in_progress' | 'completed' =
          match.executedMeters === 0 ? 'not_started'
          : match.executedMeters >= t.lengthM ? 'completed'
          : 'in_progress'
        return {
          ...t,
          executedMeters: match.executedMeters,
          executionStatus: status,
          lastRdoDate: match.date,
        }
      }),
    })),

  // ── Demo / Clear ──────────────────────────────────────────────────────────────

  loadDemoData: () =>
    set({
      trechos:           MOCK_TRECHOS,
      teams:             MOCK_TEAMS,
      productivityTable: MOCK_PRODUCTIVITY,
      scheduleConfig:    MOCK_SCHEDULE_CONFIG,
      holidays:          MOCK_HOLIDAYS,
      notes:             MOCK_NOTES,
      scenarios:         [MOCK_BASE_SCENARIO],
      ganttRows:         [],
      workDays:          [],
      totalCostBRL:      0,
      totalMeters:       0,
      projectEndDate:    null,
      isScheduleDirty:   true,
      scurvePoints:      [],
      histogramPoints:   [],
      abcItems:          [],
    }),

  clearData: () =>
    set({
      trechos:           [],
      teams:             [],
      productivityTable: MOCK_PRODUCTIVITY,
      scheduleConfig:    MOCK_SCHEDULE_CONFIG,
      holidays:          [],
      notes:             [],
      scenarios:         [],
      ganttRows:         [],
      workDays:          [],
      totalCostBRL:      0,
      totalMeters:       0,
      projectEndDate:    null,
      isScheduleDirty:   false,
      scurvePoints:      [],
      histogramPoints:   [],
      abcItems:          [],
      projectBudget:     0,
      pendingSync:       [],
      syncError:         null,
    }),

  // ── Sync ────────────────────────────────────────────────────────────────────
  flush: async () => {
    const queue = get().pendingSync
    if (queue.length === 0) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ syncStatus: 'offline' }); return
    }
    const { profile } = useAuth.getState()
    if (!profile) { set({ syncStatus: 'unauth' }); return }

    set({ syncStatus: 'syncing', syncError: null })
    const result = await flushQueue(queue)
    set((s) => ({
      pendingSync: s.pendingSync
        .filter((p) => !result.completed.includes(p.id))
        .map((p) => result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p),
      syncStatus:   result.lastError ? 'error' : 'idle',
      lastSyncedAt: new Date().toISOString(),
      syncError:    result.lastError ?? null,
    }))
  },

  pull: async () => {
    const trechos = await pullTable<Record<string, unknown>>('plan_trechos')
    const teams   = await pullTable<Record<string, unknown>>('plan_teams')
    const hols    = await pullTable<Record<string, unknown>>('plan_holidays', { column: 'date', ascending: true })
    if (trechos) {
      set({
        trechos: trechos.map((r) => ({
          id:                r.id as string,
          code:              r.code as string,
          description:       r.description as string,
          lengthM:           Number(r.length_m ?? 0),
          depthM:            Number(r.depth_m ?? 0),
          diameterMm:        Number(r.diameter_mm ?? 0),
          soilType:          (r.soil_type as PlanTrecho['soilType']) ?? 'normal',
          requiresShoring:   Boolean(r.requires_shoring),
          unitCostBRL:       r.unit_cost_brl != null ? Number(r.unit_cost_brl) : undefined,
          notes:             (r.notes as string | null) ?? undefined,
          assignedTeamIndex: r.assigned_team_index != null ? Number(r.assigned_team_index) : undefined,
          plannedStartDate:  (r.planned_start_date as string | null) ?? undefined,
          plannedEndDate:    (r.planned_end_date as string | null) ?? undefined,
          abcZone:           (r.abc_zone as PlanTrecho['abcZone']) ?? undefined,
          executedMeters:    r.executed_meters != null ? Number(r.executed_meters) : 0,
          executionStatus:   (r.execution_status as PlanTrecho['executionStatus']) ?? 'not_started',
          lastRdoDate:       (r.last_rdo_date as string | null) ?? undefined,
        })),
      })
    }
    if (teams) {
      set({
        teams: teams.map((r) => ({
          id:                    r.id as string,
          name:                  r.name as string,
          foremanCount:          Number(r.foreman_count ?? 0),
          workerCount:           Number(r.worker_count ?? 0),
          helperCount:           Number(r.helper_count ?? 0),
          operatorCount:         Number(r.operator_count ?? 0),
          retroescavadeira:      Number(r.retroescavadeira ?? 0),
          compactador:           Number(r.compactador ?? 0),
          caminhaoBasculante:    Number(r.caminhao_basculante ?? 0),
          laborHourlyRateBRL:    Number(r.labor_hourly_rate_brl ?? 0),
          equipmentDailyRateBRL: Number(r.equipment_daily_rate_brl ?? 0),
          maxManualExcavDepthM:  Number(r.max_manual_excav_depth_m ?? 1.5),
        })),
      })
    }
    if (hols) {
      set({
        holidays: hols.map((r) => ({
          date: r.date as string,
          description: r.description as string,
        })),
      })
    }
    set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
  },
    }),
    {
      name: 'cdata-planejamento',
      partialize: (s) => ({
        trechos:        s.trechos,
        teams:          s.teams,
        holidays:       s.holidays,
        scenarios:      s.scenarios,
        notes:          s.notes,
        technicalRules: s.technicalRules,
        projectBudget:  s.projectBudget,
        pendingSync:    s.pendingSync,
        lastSyncedAt:   s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void usePlanejamentoStore.getState().flush()
  })

  // Cross-module listeners (Sprint Ontologia Unificada)
  // Quando RDO é fechado, re-pull dos trechos para refletir executedMeters
  // que o trigger SQL atualizou no servidor.
  void import('@/lib/eventBus').then(({ eventBus }) => {
    eventBus.on('rdo.closed', () => {
      void usePlanejamentoStore.getState().pull()
    })
    // Re-pull também quando Realtime avisar que plan_trechos mudou em outro cliente
    eventBus.on('realtime.row_changed', (e) => {
      if (e.table === 'plan_trechos') {
        void usePlanejamentoStore.getState().pull()
      }
    })
  })
}
