import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { getTenantMarker } from '@/lib/tenantCache'
import { useActiveObraStore } from '@/store/activeObraStore'
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
  WorkerAssessment,
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
import { custoDiaWorker, matchWorkerByName } from '@/features/mao-de-obra/utils/custoMaoObra'

/** UUID determinístico (hash cyrb128 → forma de uuid; o tipo uuid do Postgres aceita).
 *  Mesmo (rdoId, workerId) → mesmo id → upsert substitui em vez de duplicar, inclusive
 *  entre dispositivos (espelha o seededUuid do feed RDO→Financeiro). */
function seededUuid(seed: string): string {
  let h1 = 0x9e3779b9, h2 = 0x243f6a88, h3 = 0xb7e15162, h4 = 0xdeadbeef
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
    h3 = Math.imul(h3 ^ c, 3812015801)
    h4 = Math.imul(h4 ^ c, 2246822519)
  }
  const hx = (n: number) => (n >>> 0).toString(16).padStart(8, '0')
  const r = hx(h1) + hx(h2) + hx(h3) + hx(h4)
  return `${r.slice(0, 8)}-${r.slice(8, 12)}-${r.slice(12, 16)}-${r.slice(16, 20)}-${r.slice(20, 32)}`
}
const rdoTimecardId = (rdoId: string, workerId: string) => seededUuid(`rdo-tc:${rdoId}:${workerId}`)

/** Dados mínimos que a ponte RDO → timecards precisa (evita acoplar rdoStore). */
export interface RdoLaborBridgeInput {
  id: string
  date: string
  siteId?: string | null
  employeeNames: string[]
  totalHoras: number
  activityLabel?: string
  diasMes?: number
}

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
  | 'produtividade'
  | 'funcionarios'
  | 'escala'
  | 'postos'
  | 'cmo'
  | 'faltas'
  | 'avaliacoes'
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
  assessments:    WorkerAssessment[]
  cltSettings:    CLTSettings
  activeTab:      MaoDeObraTab
  payrollHistory: PayrollMonth[]

  // Worker CRUD
  addWorker:    (worker: Omit<Worker, 'id'>) => void
  updateWorker: (id: string, updates: Partial<Omit<Worker, 'id'>>) => void
  removeWorker: (id: string) => void

  // Crew CRUD
  addCrew:    (crew: Omit<LaborCrew, 'id'>) => void
  updateCrew: (id: string, updates: Partial<Omit<LaborCrew, 'id'>>) => void
  removeCrew: (id: string) => void

  // Timecard actions
  addTimecard:     (entry: Omit<TimecardEntry, 'id'>) => void
  importTimecards: (entries: Array<Omit<TimecardEntry, 'id'>>) => void
  syncRdoToTimecards: (rdo: RdoLaborBridgeInput) => void
  removeRdoTimecards: (rdoId: string) => void

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

  // Assessments (ficha de avaliação)
  addAssessment:    (assessment: Omit<WorkerAssessment, 'id' | 'createdAt'>) => string
  updateAssessment: (id: string, updates: Partial<Omit<WorkerAssessment, 'id'>>) => void
  removeAssessment: (id: string) => void

  // CLT settings
  updateCLTSettings: (settings: Partial<CLTSettings>) => void

  // Payroll
  generatePayroll: (month: string) => void

  // Tenant scope (isolamento por organização)
  activeOrgId: string | null
  ensureTenantScope: (organizationId: string) => void

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
    crew_id:         w.crewId || null,
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
    worker_id:       t.workerId || null,
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
    worker_id:       sh.workerId || null,
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
    worker_id:       a.workerId || null,
    date:            a.date,
    type:            a.type ?? null,
    status:          a.status ?? 'open',
    payload:         a as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function assessmentToRow(a: WorkerAssessment, orgId: string, userId: string) {
  return {
    id:              a.id,
    organization_id: orgId,
    worker_id:       a.workerId || null,
    payload:         a as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
// clt_settings: 1 linha por organização (id = organization_id), upsert idempotente.
function cltSettingsToRow(settings: CLTSettings, orgId: string, userId: string) {
  return {
    id:              orgId,
    organization_id: orgId,
    payload:         settings as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

function list<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : []
}

function normalizeWorker(worker: Worker): Worker {
  return {
    ...worker,
    id: worker.id || crypto.randomUUID(),
    name: worker.name || 'Colaborador sem nome',
    role: worker.role || 'Sem funcao',
    cpfMasked: worker.cpfMasked || '***.***.***-**',
    crewId: worker.crewId || '',
    status: ['active', 'inactive', 'suspended', 'pending_approval'].includes(worker.status) ? worker.status : 'active',
    certifications: list(worker.certifications),
    hourlyRate: typeof worker.hourlyRate === 'number' ? worker.hourlyRate : 0,
  }
}

function normalizeCrew(crew: LaborCrew): LaborCrew {
  return {
    ...crew,
    id: crew.id || crypto.randomUUID(),
    name: crew.name || 'Equipe sem nome',
    foreman: crew.foreman || '',
    specialty: crew.specialty || '',
    workerIds: list(crew.workerIds),
    projectRef: crew.projectRef || '',
  }
}

function normalizeMaoState(persisted: Partial<MaoDeObraState>, current: MaoDeObraState): MaoDeObraState {
  return {
    ...current,
    ...persisted,
    workers:        list(persisted.workers).map(normalizeWorker),
    crews:          list(persisted.crews).map(normalizeCrew),
    timecards:      list(persisted.timecards),
    progress:       list(persisted.progress).length ? list(persisted.progress) : current.progress,
    occurrences:    list(persisted.occurrences).length ? list(persisted.occurrences) : current.occurrences,
    riskAreas:      list(persisted.riskAreas).length ? list(persisted.riskAreas) : current.riskAreas,
    suggestions:    list(persisted.suggestions).length ? list(persisted.suggestions) : current.suggestions,
    shifts:         list(persisted.shifts),
    violations:     list(persisted.violations),
    workPosts:      list(persisted.workPosts).length ? list(persisted.workPosts) : current.workPosts,
    absences:       list(persisted.absences),
    assessments:    list(persisted.assessments),
    cltSettings:    persisted.cltSettings ?? current.cltSettings,
    payrollHistory: list(persisted.payrollHistory),
    pendingSync:    list(persisted.pendingSync),
  }
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
  // Listas iniciam vazias — só são populadas por dados reais ou por loadDemoData().
  // Antes começavam com mock e vazavam dados demo fora do modo demo (Escalonamento →
  // Sugestões e RH Financeiro mostravam dados fictícios). cltSettings permanece como
  // configuração padrão real (parâmetros CLT), não é dado fake.
  workers:     [],
  crews:       [],
  timecards:   [],
  progress:    [],
  occurrences: [],
  riskAreas:   [],
  suggestions: [],

  shifts:         [],
  violations:     [],
  workPosts:      [],
  absences:       [],
  assessments:    [],
  cltSettings:    MOCK_CLT_SETTINGS,
  activeTab:      'dashboard',
  payrollHistory: [],
  activeOrgId:    null,

  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  // ── Navigation ──────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Worker CRUD ─────────────────────────────────────────────────────────────

  addWorker: (worker) => {
    const id = crypto.randomUUID()
    // Respeita a escolha explícita de obra do form: '' = geral (sem obra, aparece em todas);
    // id = aquela obra. Só cai na obra ativa quando o caller NÃO informa siteId (undefined).
    const site = worker.siteId === undefined
      ? (useActiveObraStore.getState().activeObraId ?? undefined)
      : (worker.siteId || undefined)
    const newWorker: Worker = { ...worker, id, siteId: site }
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

  removeWorker: (id) => {
    // Soft-delete (DELETE bloqueado por RLS): marca deleted_at; o pull filtra deleted_at IS NULL.
    set((s) => ({ workers: s.workers.filter((w) => w.id !== id) }))
    set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'worker', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'workers' })] }))
    void get().flush()
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

  removeCrew: (id) => {
    set((s) => ({
      crews: s.crews.filter((c) => c.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'labor_crew', type: 'delete', recordId: id, table: 'labor_crews', approvalActionType: 'delete_labor_crew' })],
    }))
    void get().flush()
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

  // Ponte RDO → apontamentos: gera 1 timecard por funcionário presente (casado por nome),
  // com horas rateadas por cabeça e custo/dia. Idempotente por sourceRdoId (re-finalizar
  // um RDO substitui os apontamentos daquele RDO, sem duplicar). unit:'h'/reportedQty:0
  // para NÃO dobrar o m² que a RUP já lê direto do Compizzo.
  syncRdoToTimecards: (rdo) => {
    const { orgId, userId } = ctxAuth()
    const workers = get().workers
    const present = rdo.employeeNames
      .map((name) => matchWorkerByName(name, workers))
      .filter((w): w is Worker => Boolean(w))
    const headcount = rdo.employeeNames.length || present.length || 1
    const horasPorCabeca = rdo.totalHoras > 0 ? rdo.totalHoras / headcount : 0
    const deletedAt = new Date().toISOString()

    set((s) => {
      // Id DETERMINÍSTICO por (rdo, worker): re-finalizar em outro device faz o insert
      // virar upsert da MESMA linha (não duplica custo de M.O. entre dispositivos).
      const novos: TimecardEntry[] = present.map((w) => ({
        id: rdoTimecardId(rdo.id, w.id),
        workerId: w.id,
        date: rdo.date,
        hoursWorked: horasPorCabeca,
        projectRef: rdo.activityLabel ?? '',
        phaseRef: '',
        activityDescription: rdo.activityLabel ?? 'RDO',
        reportedQty: 0,
        unit: 'h',
        sourceRdoId: rdo.id,
        siteId: w.siteId ?? rdo.siteId ?? null,
        laborCostBRL: custoDiaWorker(w, { diasMes: rdo.diasMes }),
      }))
      const novosIds = new Set(novos.map((t) => t.id))
      // Só soft-deleta os que SAÍRAM do RDO (id não regerado). Os que continuam são
      // sobrescritos pelo upsert — nunca delete+insert do MESMO id no mesmo tick.
      const stale = s.timecards.filter((t) => t.sourceRdoId === rdo.id && !novosIds.has(t.id))
      const kept = s.timecards.filter((t) => t.sourceRdoId !== rdo.id)
      return {
        timecards: [...kept, ...novos],
        pendingSync: [
          ...s.pendingSync,
          ...stale.map((t) => makeOp({ entity: 'timecard', type: 'update', recordId: t.id, patch: { deleted_at: deletedAt }, table: 'timecards' })),
          // deleted_at: null explícito → o upsert ressuscita a linha se um device antigo a soft-deletou.
          ...novos.map((t) => makeOp({ entity: 'timecard', type: 'insert', recordId: t.id, row: { ...timecardToRow(t, orgId, userId), deleted_at: null }, table: 'timecards' })),
        ],
      }
    })
    void get().flush()
  },

  // Limpa os apontamentos gerados por um RDO que deixou de existir (exclusão aprovada) —
  // chamado pelo reconcile do pull do rdoStore. Idempotente.
  removeRdoTimecards: (rdoId) => {
    const alvo = get().timecards.filter((t) => t.sourceRdoId === rdoId)
    if (alvo.length === 0) return
    const deletedAt = new Date().toISOString()
    set((s) => ({
      timecards: s.timecards.filter((t) => t.sourceRdoId !== rdoId),
      pendingSync: [
        ...s.pendingSync,
        ...alvo.map((t) => makeOp({ entity: 'timecard', type: 'update', recordId: t.id, patch: { deleted_at: deletedAt }, table: 'timecards' })),
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
      const cert = list(worker.certifications).find((c) => c.type === required)
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

  assignSubstitute: (absenceId, substituteWorkerId) => {
    set((s) => ({
      absences: s.absences.map((a) =>
        a.id === absenceId ? { ...a, substituteWorkerId, status: 'covered' as const } : a
      ),
    }))
    const target = get().absences.find((a) => a.id === absenceId)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = absenceToRow(target, orgId, userId)
      const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'organization_id', 'created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'worker_absence', type: 'update', recordId: absenceId, patch, table: 'worker_absences' })] }))
      void get().flush()
    }
  },

  resolveAbsence: (absenceId) => {
    set((s) => ({
      absences: s.absences.map((a) =>
        a.id === absenceId ? { ...a, status: 'covered' as const } : a
      ),
    }))
    const target = get().absences.find((a) => a.id === absenceId)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = absenceToRow(target, orgId, userId)
      const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'organization_id', 'created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'worker_absence', type: 'update', recordId: absenceId, patch, table: 'worker_absences' })] }))
      void get().flush()
    }
  },

  // ── Assessments (ficha de avaliação) ─────────────────────────────────────────

  addAssessment: (assessment) => {
    const id = crypto.randomUUID()
    const newAssessment: WorkerAssessment = { ...assessment, id, createdAt: new Date().toISOString() }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      assessments: [...s.assessments, newAssessment],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'worker_assessment', type: 'insert', recordId: id, row: assessmentToRow(newAssessment, orgId, userId), table: 'worker_assessments' })],
    }))
    void get().flush()
    return id
  },

  updateAssessment: (id, updates) => {
    set((s) => ({ assessments: s.assessments.map((a) => (a.id === id ? { ...a, ...updates } : a)) }))
    const target = get().assessments.find((a) => a.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = assessmentToRow(target, orgId, userId)
      const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'worker_assessment', type: 'update', recordId: id, patch, table: 'worker_assessments' })] }))
      void get().flush()
    }
  },

  // Exclusão é soft delete via UPDATE de deleted_at (DELETE é bloqueado por RLS).
  removeAssessment: (id) => {
    set((s) => ({ assessments: s.assessments.filter((a) => a.id !== id) }))
    set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'worker_assessment', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'worker_assessments' })] }))
    void get().flush()
  },

  // ── CLT Settings ─────────────────────────────────────────────────────────────

  updateCLTSettings: (settings) => {
    set((s) => ({ cltSettings: { ...s.cltSettings, ...settings } }))
    const { orgId, userId } = ctxAuth()
    if (orgId === 'pending') return   // sem org real ainda: fica local; sincroniza na próxima edição logada
    set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'clt_settings', type: 'insert', recordId: orgId, row: cltSettingsToRow(get().cltSettings, orgId, userId), table: 'clt_settings' })] }))
    void get().flush()
  },

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

  // Carimba o store na organização ativa, isolando empresas. Na primeira vez
  // (activeOrgId nulo, pós-migração) confia no dado local só se o marcador de
  // tenant bate com a org atual; caso contrário limpa para não misturar dados.
  ensureTenantScope: (organizationId) => {
    if (!organizationId) return
    const cur = get().activeOrgId
    if (cur === organizationId) return
    if (cur == null) {
      const marker = getTenantMarker()
      if (marker && marker !== organizationId) get().clearData()
      set({ activeOrgId: organizationId })
      return
    }
    get().clearData()
    set({ activeOrgId: organizationId })
  },

  clearData: () =>
    set({
      workers:     [],
      crews:       [],
      timecards:   [],
      progress:    [],
      occurrences: [],
      riskAreas:   [],
      suggestions: [],
      shifts:         [],
      violations:     [],
      workPosts:      [],
      absences:       [],
      assessments:    [],
      payrollHistory: [],
      cltSettings:    MOCK_CLT_SETTINGS,
      activeOrgId:    null,
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
    // Sempre puxa cada tabela e MESCLA com mergePull: preserva os registros com op
    // pendente (local não-sincronizado) e atualiza o resto com o servidor — assim uma
    // op presa nunca mais congela a tabela inteira e o local não diverge em silêncio.
    const ws = await pullTable<{ payload: Worker }>('workers')
    const cs = await pullTable<{ payload: LaborCrew }>('labor_crews')
    const ts = await pullTable<{ payload: TimecardEntry }>('timecards')
    const ss = await pullTable<{ payload: Shift }>('shifts')
    const as_ = await pullTable<{ payload: WorkerAbsence }>('worker_absences')
    const asmt = await pullTable<{ payload: WorkerAssessment }>('worker_assessments')
    const clt = await pullTable<{ payload: CLTSettings }>('clt_settings')
    set((s) => ({
      workers:     mergePull(ws?.map((r) => normalizeWorker(r.payload)) ?? null, s.workers, s.pendingSync, 'workers'),
      crews:       mergePull(cs?.map((r) => normalizeCrew(r.payload)) ?? null, s.crews, s.pendingSync, 'labor_crews'),
      timecards:   mergePull(ts?.map((r) => r.payload) ?? null, s.timecards, s.pendingSync, 'timecards'),
      shifts:      mergePull(ss?.map((r) => r.payload) ?? null, s.shifts, s.pendingSync, 'shifts'),
      absences:    mergePull(as_?.map((r) => r.payload) ?? null, s.absences, s.pendingSync, 'worker_absences'),
      assessments: mergePull(asmt?.map((r) => r.payload) ?? null, s.assessments, s.pendingSync, 'worker_assessments'),
    }))
    // clt_settings é singleton (1 linha por org, id = organization_id) e o estado local
    // cltSettings é um único objeto sem `id` de topo — não é array de { id }, então
    // mergePull não se aplica; preserva o merge existente.
    if (clt?.[0]) set({ cltSettings: { ...get().cltSettings, ...clt[0].payload } })
    set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
  },
    }),
    {
      name: 'cdata-mao-de-obra',
      version: 3,
      // v1: workPosts deixou de iniciar com MOCK_WORK_POSTS.
      // v2: remove TODO resquício de dado demo persistido fora do modo demo
      //     (mocks usam ids curtos tipo 'w-1'; dados reais usam UUID). Listas
      //     derivadas (sugestões/violações) são recomputáveis e zeram.
      // v3: adiciona assessments (ficha de avaliação) — default lista vazia.
      migrate: (persisted, fromVersion) => {
        const state = (persisted ?? {}) as Partial<MaoDeObraState>
        if (fromVersion < 1) state.workPosts = []
        if (fromVersion < 2) {
          const isUuid = (id: unknown) =>
            typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
          const keepReal = <T extends { id?: unknown }>(arr: T[] | undefined) =>
            Array.isArray(arr) ? arr.filter((item) => isUuid(item?.id)) : []
          state.workers     = keepReal(state.workers)
          state.crews       = keepReal(state.crews)
          state.timecards   = keepReal(state.timecards)
          state.progress    = keepReal(state.progress)
          state.occurrences = keepReal(state.occurrences)
          state.riskAreas   = keepReal(state.riskAreas)
          state.shifts      = keepReal(state.shifts)
          state.workPosts   = keepReal(state.workPosts)
          state.absences    = keepReal(state.absences)
          state.suggestions = []
          state.violations  = []
        }
        if (fromVersion < 3) state.assessments = list(state.assessments)
        return state as MaoDeObraState
      },
      partialize: (s) => ({
        activeOrgId:    s.activeOrgId,
        workers:        s.workers,
        crews:          s.crews,
        timecards:      s.timecards,
        shifts:         s.shifts,
        absences:       s.absences,
        assessments:    s.assessments,
        workPosts:      s.workPosts,
        cltSettings:    s.cltSettings,
        payrollHistory: s.payrollHistory,
        pendingSync:    s.pendingSync,
        lastSyncedAt:   s.lastSyncedAt,
      }),
      merge: (persisted, current) =>
        normalizeMaoState((persisted ?? {}) as Partial<MaoDeObraState>, current as MaoDeObraState),
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
    (w) => list(w.certifications).every((c) => c.status === 'valid' || c.status === 'expiring')
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
    for (const cert of list(w.certifications)) {
      const expiry = new Date(cert.expiryDate)
      if (expiry >= now && expiry <= cutoff) {
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000)
        results.push({ worker: w, certType: cert.type, daysLeft, expiryDate: cert.expiryDate })
      }
    }
  }

  return results.sort((a, b) => a.daysLeft - b.daysLeft)
}
