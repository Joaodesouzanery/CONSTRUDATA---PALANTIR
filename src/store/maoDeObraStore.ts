import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type {
  Worker,
  LaborCrew,
  TimecardEntry,
  PhysicalProgress,
  LaborOccurrence,
  RiskArea,
  ReallocationSuggestion,
  Shift,
  CLTViolation,
  WorkPost,
  WorkerAbsence,
  CLTSettings,
  PayrollMonth,
} from '@/types'
import {
  mockWorkers,
  mockLaborCrews,
  mockTimecards,
  mockPhysicalProgress,
  mockOccurrences,
  mockRiskAreas,
  mockReallocationSuggestions,
  MOCK_SHIFTS,
  MOCK_WORK_POSTS,
  MOCK_ABSENCES,
  MOCK_CLT_SETTINGS,
} from '@/data/mockMaoDeObra'
import {
  runAllCLTChecks,
  autoGenerateSchedule,
} from '@/features/mao-de-obra/utils/cltEngine'
import { generateMonthPayroll } from '@/features/mao-de-obra/utils/payrollEngine'

// ─── Access Check Result ───────────────────────────────────────────────────────

export interface AccessCheckResult {
  allowed: boolean
  worker: Worker
  riskArea: RiskArea
  missingCerts: string[]
  expiredCerts: string[]
}

// ─── Tab type ──────────────────────────────────────────────────────────────────

export type MaoDeObraTab =
  | 'dashboard'
  | 'funcionarios'
  | 'escala'
  | 'postos'
  | 'cmo'
  | 'faltas'
  | 'folha'
  | 'rh-financeiro'
  | 'ausencias'
  | 'apontamentos'
  | 'escalamento'
  | 'seguranca'

// ─── State ─────────────────────────────────────────────────────────────────────

interface MaoDeObraState {
  workers:     Worker[]
  crews:       LaborCrew[]
  timecards:   TimecardEntry[]
  progress:    PhysicalProgress[]
  occurrences: LaborOccurrence[]
  riskAreas:   RiskArea[]
  suggestions: ReallocationSuggestion[]

  // New HR state
  shifts:         Shift[]
  violations:     CLTViolation[]
  workPosts:      WorkPost[]
  absences:       WorkerAbsence[]
  cltSettings:    CLTSettings
  activeTab:      MaoDeObraTab
  payrollHistory: PayrollMonth[]

  // Worker CRUD
  addWorker:    (worker: Omit<Worker, 'id'>) => void
  updateWorker: (id: string, updates: Partial<Omit<Worker, 'id'>>) => void

  // Crew CRUD
  addCrew:    (crew: Omit<LaborCrew, 'id'>) => void
  updateCrew: (id: string, updates: Partial<Omit<LaborCrew, 'id'>>) => void

  // Timecard actions
  addTimecard:     (entry: Omit<TimecardEntry, 'id'>) => void
  importTimecards: (entries: Array<Omit<TimecardEntry, 'id'>>) => void

  // Progress & occurrences
  addProgress:   (entry: Omit<PhysicalProgress, 'id'>) => void
  addOccurrence: (occ: Omit<LaborOccurrence, 'id'>) => void

  // Reallocation engine
  runReallocationEngine: () => void
  acceptSuggestion:      (id: string) => void
  dismissSuggestion:     (id: string) => void

  // Safety — access check (pure computation, no state mutation)
  checkAccess: (workerId: string, riskAreaId: string) => AccessCheckResult | null

  // ── New HR actions ──────────────────────────────────────────────────────────

  // Navigation
  setActiveTab: (tab: MaoDeObraTab) => void

  // Shifts
  addShift:       (shift: Omit<Shift, 'id'>) => string
  updateShift:    (id: string, updates: Partial<Omit<Shift, 'id'>>) => void
  removeShift:    (id: string) => void
  bulkAddShifts:  (shifts: Omit<Shift, 'id'>[]) => void
  generateSchedule: (month: string) => void

  // CLT validation
  revalidateCLT: () => void

  // Work posts
  addWorkPost:    (post: Omit<WorkPost, 'id'>) => void
  updateWorkPost: (id: string, updates: Partial<Omit<WorkPost, 'id'>>) => void
  removeWorkPost: (id: string) => void

  // Absences
  registerAbsence:   (absence: Omit<WorkerAbsence, 'id' | 'registeredAt'>) => string
  assignSubstitute:  (absenceId: string, substituteWorkerId: string) => void
  resolveAbsence:    (absenceId: string) => void

  // CLT settings
  updateCLTSettings: (settings: Partial<CLTSettings>) => void

  // Payroll
  generatePayroll: (month: string) => void

  // Demo / clear
  loadDemoData: () => void
  clearData:    () => void

  // Sync (Sprint 3)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

// ─── Mappers para Supabase ────────────────────────────────────────────────────
function workerToRow(w: Worker, orgId: string, userId: string) {
  return {
    id:              w.id,
    organization_id: orgId,
    name:            w.name,
    role:            w.role ?? null,
    status:          w.status ?? 'active',
    crew_id:         w.crewId ?? null,
    payload:         w as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function crewToRow(c: LaborCrew, orgId: string, userId: string) {
  return {
    id:              c.id,
    organization_id: orgId,
    name:            c.name,
    payload:         c as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function timecardToRow(t: TimecardEntry, orgId: string, userId: string) {
  return {
    id:              t.id,
    organization_id: orgId,
    worker_id:       t.workerId ?? null,
    date:            t.date,
    hours_worked:    t.hoursWorked ?? null,
    payload:         t as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function shiftToRow(sh: Shift, orgId: string, userId: string) {
  return {
    id:              sh.id,
    organization_id: orgId,
    worker_id:       sh.workerId ?? null,
    date:            sh.date,
    type:            sh.type ?? null,
    status:          sh.status ?? 'scheduled',
    payload:         sh as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function absenceToRow(a: WorkerAbsence, orgId: string, userId: string) {
  return {
    id:              a.id,
    organization_id: orgId,
    worker_id:       a.workerId ?? null,
    date:            a.date,
    type:            a.type ?? null,
    status:          a.status ?? 'open',
    payload:         a as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

// ─── Reallocation Engine ───────────────────────────────────────────────────────

function computeSuggestions(
  progress: PhysicalProgress[],
  crews: LaborCrew[],
  existingSuggestions: ReallocationSuggestion[],
): ReallocationSuggestion[] {
  const activityMap = new Map<string, { planned: number; reported: number; unit: string; activityName: string }>()

  for (const p of progress) {
    const key = `${p.phaseId}|${p.activityName}`
    const existing = activityMap.get(key)
    if (existing) {
      existing.planned  += p.plannedQty
      existing.reported += p.reportedQty
    } else {
      activityMap.set(key, {
        planned:      p.plannedQty,
        reported:     p.reportedQty,
        unit:         p.unit,
        activityName: p.activityName,
      })
    }
  }

  const delayed: Array<{ key: string; activityName: string; deviation: number; unit: string }> = []
  const onTrack: Array<{ key: string; activityName: string }> = []

  for (const [key, val] of activityMap.entries()) {
    if (val.planned === 0) continue
    const ratio = val.reported / val.planned
    if (ratio < 0.70) {
      delayed.push({ key, activityName: val.activityName, deviation: Math.round((1 - ratio) * 100), unit: val.unit })
    } else if (ratio >= 0.95) {
      onTrack.push({ key, activityName: val.activityName })
    }
  }

  const suggestions: ReallocationSuggestion[] = []

  for (const del of delayed) {
    const already = existingSuggestions.find(
      (s) => s.delayedTaskName === del.activityName && (s.accepted === true || s.accepted === false)
    )
    if (already) continue

    const sourceTask = onTrack.find((t) => t.key !== del.key)
    if (!sourceTask) continue

    const sourceCrew = crews[Math.floor(Math.random() * crews.length)]
    const floatDays  = 7 + Math.floor(Math.random() * 8)
    const delayDays  = Math.max(1, Math.round(del.deviation / 15))

    suggestions.push({
      id:               `rs-gen-${del.key.replace(/[^a-z0-9]/gi, '-')}`,
      delayedTaskId:    del.key,
      delayedTaskName:  del.activityName,
      delayDays,
      sourceCrew:       sourceCrew?.name ?? 'Equipe Disponível',
      sourceTaskId:     sourceTask.key,
      sourceTaskName:   sourceTask.activityName,
      sourceTaskFloat:  floatDays,
      reason:           `"${sourceTask.activityName}" tem folga de ${floatDays} dias — realocar equipe para reforçar "${del.activityName}" (${del.deviation}% abaixo do planejado, ~${delayDays}d de atraso estimado).`,
      accepted:         undefined,
    })
  }

  return suggestions
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useMaoDeObraStore = create<MaoDeObraState>()(
  persist(
    (set, get) => ({
  workers:     [],
  crews:       [],
  timecards:   [],
  progress:    mockPhysicalProgress,
  occurrences: mockOccurrences,
  riskAreas:   mockRiskAreas,
  suggestions: mockReallocationSuggestions,

  shifts:         [],
  violations:     [],
  workPosts:      MOCK_WORK_POSTS,
  absences:       [],
  cltSettings:    MOCK_CLT_SETTINGS,
  activeTab:      'dashboard',
  payrollHistory: [],

  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  // ── Navigation ──────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Worker CRUD ─────────────────────────────────────────────────────────────

  addWorker: (worker) => {
    const id = crypto.randomUUID()
    const newWorker: Worker = { ...worker, id }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      workers: [...s.workers, newWorker],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'worker', type: 'insert', recordId: id, row: workerToRow(newWorker, orgId, userId), table: 'workers' })],
    }))
    void get().flush()
  },

  updateWorker: (id, updates) => {
    set((s) => ({ workers: s.workers.map((w) => (w.id === id ? { ...w, ...updates } : w)) }))
    const target = get().workers.find((w) => w.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = workerToRow(target, orgId, userId)
      const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'worker', type: 'update', recordId: id, patch, table: 'workers' })] }))
      void get().flush()
    }
  },

  // ── Crew CRUD ───────────────────────────────────────────────────────────────

  addCrew: (crew) => {
    const id = crypto.randomUUID()
    const newCrew: LaborCrew = { ...crew, id }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      crews: [...s.crews, newCrew],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'labor_crew', type: 'insert', recordId: id, row: crewToRow(newCrew, orgId, userId), table: 'labor_crews' })],
    }))
    void get().flush()
  },

  updateCrew: (id, updates) => {
    set((s) => ({ crews: s.crews.map((c) => (c.id === id ? { ...c, ...updates } : c)) }))
    const target = get().crews.find((c) => c.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = crewToRow(target, orgId, userId)
      const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'labor_crew', type: 'update', recordId: id, patch, table: 'labor_crews' })] }))
      void get().flush()
    }
  },

  // ── Timecards ───────────────────────────────────────────────────────────────

  addTimecard: (entry) => {
    const id = crypto.randomUUID()
    const newEntry: TimecardEntry = { ...entry, id }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      timecards: [...s.timecards, newEntry],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'timecard', type: 'insert', recordId: id, row: timecardToRow(newEntry, orgId, userId), table: 'timecards' })],
    }))
    void get().flush()
  },

  importTimecards: (entries) => {
    const { orgId, userId } = ctxAuth()
    const withIds = entries.map((e) => ({ ...e, id: crypto.randomUUID() }))
    set((s) => ({
      timecards: [...s.timecards, ...withIds],
      pendingSync: [
        ...s.pendingSync,
        ...withIds.map((t) => makeOp({ entity: 'timecard', type: 'insert', recordId: t.id, row: timecardToRow(t, orgId, userId), table: 'timecards' })),
      ],
    }))
    void get().flush()
  },

  // ── Progress & Occurrences ───────────────────────────────────────────────────

  addProgress: (entry) =>
    set((s) => ({
      progress: [...s.progress, { ...entry, id: `pp-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  addOccurrence: (occ) =>
    set((s) => ({
      occurrences: [...s.occurrences, { ...occ, id: `occ-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  // ── Reallocation Engine ──────────────────────────────────────────────────────

  runReallocationEngine: () => {
    const { progress, crews, suggestions } = get()
    const generated = computeSuggestions(progress, crews, suggestions)
    const acted = suggestions.filter((s) => s.accepted === true || s.accepted === false)
    set({ suggestions: [...acted, ...generated] })
  },

  acceptSuggestion: (id) =>
    set((s) => ({
      suggestions: s.suggestions.map((sg) =>
        sg.id === id ? { ...sg, accepted: true } : sg
      ),
    })),

  dismissSuggestion: (id) =>
    set((s) => ({
      suggestions: s.suggestions.map((sg) =>
        sg.id === id ? { ...sg, accepted: false } : sg
      ),
    })),

  // ── Safety — Access Check ────────────────────────────────────────────────────

  checkAccess: (workerId, riskAreaId) => {
    const { workers, riskAreas } = get()
    const worker   = workers.find((w) => w.id === workerId)
    const riskArea = riskAreas.find((r) => r.id === riskAreaId)
    if (!worker || !riskArea) return null

    const missingCerts: string[] = []
    const expiredCerts: string[] = []

    for (const required of riskArea.requiredCertTypes) {
      const cert = worker.certifications.find((c) => c.type === required)
      if (!cert) {
        missingCerts.push(required)
      } else if (cert.status === 'expired') {
        expiredCerts.push(required)
      }
    }

    return {
      allowed:      worker.status === 'active' && missingCerts.length === 0 && expiredCerts.length === 0,
      worker,
      riskArea,
      missingCerts,
      expiredCerts,
    }
  },

  // ── Shifts ──────────────────────────────────────────────────────────────────

  addShift: (shift) => {
    const id = crypto.randomUUID()
    const newShift: Shift = { ...shift, id }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      shifts: [...s.shifts, newShift],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'shift', type: 'insert', recordId: id, row: shiftToRow(newShift, orgId, userId), table: 'shifts' })],
    }))
    void get().flush()
    return id
  },

  updateShift: (id, updates) => {
    set((s) => ({ shifts: s.shifts.map((sh) => (sh.id === id ? { ...sh, ...updates } : sh)) }))
    const target = get().shifts.find((sh) => sh.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = shiftToRow(target, orgId, userId)
      const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'shift', type: 'update', recordId: id, patch, table: 'shifts' })] }))
      void get().flush()
    }
  },

  removeShift: (id) => {
    set((s) => ({
      shifts: s.shifts.filter((sh) => sh.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'shift', type: 'delete', recordId: id, table: 'shifts', approvalActionType: 'delete_shift' })],
    }))
    void get().flush()
  },

  bulkAddShifts: (newShifts) => {
    const { orgId, userId } = ctxAuth()
    const withIds: Shift[] = newShifts.map((sh) => ({ ...sh, id: crypto.randomUUID() }))
    set((s) => ({
      shifts: [...s.shifts, ...withIds],
      pendingSync: [
        ...s.pendingSync,
        ...withIds.map((sh) => makeOp({ entity: 'shift', type: 'insert', recordId: sh.id, row: shiftToRow(sh, orgId, userId), table: 'shifts' })),
      ],
    }))
    void get().flush()
  },

  generateSchedule: (month) => {
    const { workers, workPosts, cltSettings } = get()
    const generated = autoGenerateSchedule(workers, workPosts, month, cltSettings)
    // Replace existing scheduled (not confirmed) shifts for the month
    set((s) => ({
      shifts: [
        ...s.shifts.filter((sh) => !sh.date.startsWith(month) || sh.status !== 'scheduled'),
        ...generated.map((sh) => ({ ...sh, id: `sh-${crypto.randomUUID().slice(0, 8)}` })),
      ],
    }))
    // Re-run CLT validation
    get().revalidateCLT()
  },

  // ── CLT Validation ──────────────────────────────────────────────────────────

  revalidateCLT: () => {
    const { workers, shifts, cltSettings } = get()
    const violations = runAllCLTChecks(workers, shifts, cltSettings)
    set({ violations })
  },

  // ── Work Posts ──────────────────────────────────────────────────────────────

  addWorkPost: (post) =>
    set((s) => ({
      workPosts: [...s.workPosts, { ...post, id: `wp-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  updateWorkPost: (id, updates) =>
    set((s) => ({
      workPosts: s.workPosts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  removeWorkPost: (id) =>
    set((s) => ({ workPosts: s.workPosts.filter((p) => p.id !== id) })),

  // ── Absences ────────────────────────────────────────────────────────────────

  registerAbsence: (absence) => {
    const id = crypto.randomUUID()
    const newAbsence: WorkerAbsence = { ...absence, id, registeredAt: new Date().toISOString() }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      absences: [...s.absences, newAbsence],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'worker_absence', type: 'insert', recordId: id, row: absenceToRow(newAbsence, orgId, userId), table: 'worker_absences' })],
    }))
    void get().flush()
    return id
  },

  assignSubstitute: (absenceId, substituteWorkerId) =>
    set((s) => ({
      absences: s.absences.map((a) =>
        a.id === absenceId ? { ...a, substituteWorkerId, status: 'covered' as const } : a
      ),
    })),

  resolveAbsence: (absenceId) =>
    set((s) => ({
      absences: s.absences.map((a) =>
        a.id === absenceId ? { ...a, status: 'covered' as const } : a
      ),
    })),

  // ── CLT Settings ─────────────────────────────────────────────────────────────

  updateCLTSettings: (settings) =>
    set((s) => ({ cltSettings: { ...s.cltSettings, ...settings } })),

  // ── Payroll ──────────────────────────────────────────────────────────────────

  generatePayroll: (month) => {
    const { workers, shifts, cltSettings, payrollHistory } = get()
    const result = generateMonthPayroll(workers, shifts, cltSettings, month)
    // Replace existing entry for this month, or append
    const existing = payrollHistory.findIndex((p) => p.month === month)
    const updated  = existing >= 0
      ? payrollHistory.map((p, i) => i === existing ? result : p)
      : [...payrollHistory, result]
    set({ payrollHistory: updated })
  },

  // ── Demo / Clear ─────────────────────────────────────────────────────────────

  loadDemoData: () => {
    const violations = runAllCLTChecks(mockWorkers, MOCK_SHIFTS, MOCK_CLT_SETTINGS)
    set({
      workers:     mockWorkers,
      crews:       mockLaborCrews,
      timecards:   mockTimecards,
      progress:    mockPhysicalProgress,
      occurrences: mockOccurrences,
      riskAreas:   mockRiskAreas,
      suggestions: mockReallocationSuggestions,
      shifts:      MOCK_SHIFTS,
      violations,
      workPosts:   MOCK_WORK_POSTS,
      absences:    MOCK_ABSENCES,
      cltSettings: MOCK_CLT_SETTINGS,
    })
  },

  clearData: () =>
    set({
      workers:     [],
      crews:       [],
      timecards:   [],
      progress:    [],
      occurrences: [],
      riskAreas:   mockRiskAreas,
      suggestions: [],
      shifts:         [],
      violations:     [],
      workPosts:      [],
      absences:       [],
      payrollHistory: [],
      pendingSync:    [],
      syncError:      null,
    }),

  flush: async () => {
    const queue = get().pendingSync
    if (queue.length === 0) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
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
    const ws = await pullTable<{ payload: Worker }>('workers')
    const cs = await pullTable<{ payload: LaborCrew }>('labor_crews')
    const ts = await pullTable<{ payload: TimecardEntry }>('timecards')
    const ss = await pullTable<{ payload: Shift }>('shifts')
    const as_ = await pullTable<{ payload: WorkerAbsence }>('worker_absences')
    if (ws)  set({ workers:   ws.map((r) => r.payload) })
    if (cs)  set({ crews:     cs.map((r) => r.payload) })
    if (ts)  set({ timecards: ts.map((r) => r.payload) })
    if (ss)  set({ shifts:    ss.map((r) => r.payload) })
    if (as_) set({ absences:  as_.map((r) => r.payload) })
    set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
  },
    }),
    {
      name: 'cdata-mao-de-obra',
      partialize: (s) => ({
        workers:        s.workers,
        crews:          s.crews,
        timecards:      s.timecards,
        shifts:         s.shifts,
        absences:       s.absences,
        workPosts:      s.workPosts,
        cltSettings:    s.cltSettings,
        payrollHistory: s.payrollHistory,
        pendingSync:    s.pendingSync,
        lastSyncedAt:   s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useMaoDeObraStore.getState().flush()
  })
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

export function calcWeeklyHH(timecards: TimecardEntry[]): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  return timecards
    .filter((tc) => new Date(tc.date) >= cutoff)
    .reduce((sum, tc) => sum + tc.hoursWorked, 0)
}

export function calcProductivity(timecards: TimecardEntry[]): number {
  const relevant = timecards.filter((tc) => tc.unit === 'm²' && tc.reportedQty > 0)
  if (relevant.length === 0) return 0
  const totalHH = relevant.reduce((s, tc) => s + tc.hoursWorked, 0)
  const totalM2 = relevant.reduce((s, tc) => s + tc.reportedQty, 0)
  return totalM2 > 0 ? parseFloat((totalHH / totalM2).toFixed(2)) : 0
}

export function calcComplianceRate(workers: Worker[]): number {
  const active = workers.filter((w) => w.status === 'active')
  if (active.length === 0) return 0
  const compliant = active.filter(
    (w) => w.certifications.every((c) => c.status === 'valid' || c.status === 'expiring')
  )
  return Math.round((compliant.length / active.length) * 100)
}

export function calcActiveOccurrences(occurrences: LaborOccurrence[]): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  return occurrences.filter((o) => new Date(o.date) >= cutoff).length
}

export function getCertExpiringSoon(
  workers: Worker[],
  days = 30,
): Array<{ worker: Worker; certType: string; daysLeft: number; expiryDate: string }> {
  const now    = new Date()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + days)

  const results: Array<{ worker: Worker; certType: string; daysLeft: number; expiryDate: string }> = []

  for (const w of workers) {
    for (const cert of w.certifications) {
      const expiry = new Date(cert.expiryDate)
      if (expiry >= now && expiry <= cutoff) {
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000)
        results.push({ worker: w, certType: cert.type, daysLeft, expiryDate: cert.expiryDate })
      }
    }
  }

  return results.sort((a, b) => a.daysLeft - b.daysLeft)
}
