import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { podeEscreverMaoDeObra } from '@/lib/roles'
import { flushQueue, makeOp, mergePull, pullTable, changedColumns, type PendingOp, type SyncStatus } from '@/lib/storeSync'
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
import { seededUuidLegado } from '@/lib/seededId'

/** UUID determinístico (hash cyrb128 → forma de uuid; o tipo uuid do Postgres aceita).
 *  Mesmo (rdoId, workerId) → mesmo id → upsert substitui em vez de duplicar, inclusive
 *  entre dispositivos (espelha o seededUuid do feed RDO→Financeiro). */
const rdoTimecardId = (rdoId: string, workerId: string) => seededUuidLegado(`rdo-tc:${rdoId}:${workerId}`)

/** Dados mínimos que a ponte RDO → timecards precisa (evita acoplar rdoStore). */
export interface RdoLaborBridgeInput {
  id: string
  date: string
  siteId?: string | null
  employeeNames: string[]
  totalHoras: number
  activityLabel?: string
  diasMes?: number
  /**
   * Apontamento explícito por trabalhador, quando o RDO tem essa informação.
   *
   * O RDO padrão registra horas POR LINHA de mão de obra (`workforceRows`); o Compizzo registra
   * um total do dia e divide pelo efetivo. Sem este campo, o caminho do RDO padrão precisava de
   * uma segunda rota — que existia, com id aleatório e sem `sourceRdoId`, e por isso duplicava a
   * cada re-save e nunca era reconciliada. Com ele, os dois formatos usam a MESMA ponte
   * idempotente.
   */
  entradas?: { workerId: string; horas: number; descricao?: string; observacao?: string }[]
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
  /** Escala e Postos são a MESMA aba desde 25/08/2026 — demanda (posto) e oferta (turno). */
  | 'escala'
  /** @deprecated Virou parte de 'escala'. Mantido só para redirecionar quem tinha isto salvo. */
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
  /** Já subiu para o servidor o que existia só no navegador? Ver a subida única no `pull`. */
  workPostsMigrados: boolean
  occurrencesMigradas: boolean
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
  updateTimecard: (id: string, updates: Partial<Omit<TimecardEntry, 'id'>>) => void
  removeTimecard: (id: string) => void
  syncRdoToTimecards: (rdo: RdoLaborBridgeInput) => void
  removeRdoTimecards: (rdoId: string) => void

  // Progress & occurrences
  addProgress:   (entry: Omit<PhysicalProgress, 'id'>) => void
  addOccurrence: (occ: Omit<LaborOccurrence, 'id'>) => void
  updateOccurrence: (id: string, updates: Partial<Omit<LaborOccurrence, 'id'>>) => void
  removeOccurrence: (id: string) => void

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
  updateAbsence:     (id: string, patch: Partial<WorkerAbsence>) => void
  removeAbsence:     (id: string) => void
  /** Devolve `false` quando não havia turno naquele dia — nada a descontar. */
  marcarTurnoAusente: (workerId: string, date: string, ausente: boolean) => boolean
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
    // `siteId` NÃO vira coluna: a tabela `shifts` não tem `construction_site_id`, e o turno
    // inteiro já é serializado em `payload` jsonb — o campo viaja de graça, sem migração.
    payload:         sh as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
/** Obra do turno: a informada, senão a do trabalhador, senão a obra ativa na barra lateral. */
function resolverObraDoTurno(sh: Partial<Shift>, estado: { workers: Worker[] }): string | null {
  if (sh.siteId !== undefined) return sh.siteId ?? null
  const doTrabalhador = estado.workers.find((w) => w.id === sh.workerId)?.siteId
  if (doTrabalhador) return doTrabalhador
  return useActiveObraStore.getState().activeObraId
}

function workPostToRow(wp: WorkPost, orgId: string, userId: string) {
  return { id: wp.id, organization_id: orgId, payload: wp as unknown as Record<string, unknown>, created_by: userId }
}
function occurrenceToRow(o: LaborOccurrence, orgId: string, userId: string) {
  return { id: o.id, organization_id: orgId, payload: o as unknown as Record<string, unknown>, created_by: userId }
}
function absenceToRow(a: WorkerAbsence, orgId: string, userId: string) {
  return {
    id:              a.id,
    organization_id: orgId,
    worker_id:       a.workerId || null,
    date:            a.date,
    type:            a.type ?? null,
    status:          a.status ?? 'open',
    // A coluna existe desde a migração de escopo por obra e nunca era preenchida — por isso todo
    // indicador de falta somava todas as obras.
    site_id:         a.siteId ?? null,
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

/**
 * `merge` do persist: o que vale é SEMPRE o que está persistido, nunca o que está em memória.
 *
 * ── POR QUE ISTO É REGRA DURA ─────────────────────────────────────────────────────────────────
 * Cinco campos usavam o fallback `list(persisted.x).length ? persisted.x : current.x`, e ele
 * vazava dado de demonstração. O motivo é que `current` NÃO é o estado inicial na hora que
 * importa: ao DESLIGAR o Modo Demo, `restoreUserData` (appModeStore.ts) devolve o localStorage e
 * chama `persist.rehydrate()`, e aí o zustand passa como `current` o estado VIVO — que naquele
 * instante ainda é o que o `loadDemoData()` colocou. Numa organização real vazia o persistido é
 * `[]`, o fallback via lista vazia e devolvia os mocks: 4 postos, 4 ocorrências, 14 progressos,
 * 3 áreas de risco e 3 sugestões continuavam na tela com o Modo Demo DESLIGADO.
 *
 * Pior desde a migration 20260817140000: com `work_posts` e `labor_occurrences` existindo no
 * servidor, o `pull()` seguinte enxerga esses mocks como "dado local que nunca subiu" e os grava
 * no banco do cliente. Antes da migration o vazamento parava no navegador porque não havia
 * tabela; agora ele tem caminho até o Supabase.
 *
 * Nada se perde ao tirar o fallback: no carregamento normal da página `current` é o estado
 * inicial, que já tem esses cinco campos vazios. `progress`, `riskAreas` e `suggestions` nem
 * estão no `partialize` — são derivados/efêmeros e o fallback só os mantinha vivos vindos do demo.
 */
function normalizeMaoState(persisted: Partial<MaoDeObraState>, current: MaoDeObraState): MaoDeObraState {
  return {
    ...current,
    ...persisted,
    workers:        list(persisted.workers).map(normalizeWorker),
    crews:          list(persisted.crews).map(normalizeCrew),
    timecards:      list(persisted.timecards),
    progress:       list(persisted.progress),
    occurrences:    list(persisted.occurrences),
    riskAreas:      list(persisted.riskAreas),
    suggestions:    list(persisted.suggestions),
    shifts:         list(persisted.shifts),
    violations:     list(persisted.violations),
    workPosts:      list(persisted.workPosts),
    absences:       list(persisted.absences),
    assessments:    list(persisted.assessments),
    cltSettings:    persisted.cltSettings ?? current.cltSettings,
    payrollHistory: list(persisted.payrollHistory),
    // Sem preservar as flags, a subida única do que era local rodaria a cada recarga.
    workPostsMigrados:   persisted.workPostsMigrados ?? current.workPostsMigrados,
    occurrencesMigradas: persisted.occurrencesMigradas ?? current.occurrencesMigradas,
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
  workPostsMigrados: false,
  occurrencesMigradas: false,
  activeOrgId:    null,

  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  // ── Navigation ──────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Worker CRUD ─────────────────────────────────────────────────────────────

  addWorker: (worker) => {
    // Gate espelhando a policy da tabela: papel fora da lista não passa no WITH CHECK e a
    // escrita otimista viraria op presa para sempre (o usuário acha que salvou).
    if (!podeEscreverMaoDeObra().pode) return ''
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
    if (!podeEscreverMaoDeObra().pode) return
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
    // Sem o gate, o funcionário sumia da tela DESTE navegador, a op era recusada pelo servidor e
    // ele continuava existindo para todo mundo — a mesma divergência silenciosa das faltas.
    if (!podeEscreverMaoDeObra().pode) return
    // Soft-delete (DELETE bloqueado por RLS): marca deleted_at; o pull filtra deleted_at IS NULL.
    set((s) => ({ workers: s.workers.filter((w) => w.id !== id) }))
    set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'worker', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'workers' })] }))
    void get().flush()
  },

  // ── Crew CRUD ───────────────────────────────────────────────────────────────

  addCrew: (crew) => {
    // `labor_crews_insert_with_role` exige papel de escrita: sem o gate, a equipe aparecia no
    // grid, era escolhida no RDO e na escala, e nunca existia no banco.
    if (!podeEscreverMaoDeObra().pode) return
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
    if (!podeEscreverMaoDeObra().pode) return
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
    if (!podeEscreverMaoDeObra().pode) return
    set((s) => ({
      crews: s.crews.filter((c) => c.id !== id),
      // Era `type: 'delete'` com `approvalActionType`, que chama o RPC `request_action`: aquilo
      // CRIA UM PEDIDO e não apaga nada. A op saía da fila como concluída, e a equipe voltava no
      // pull seguinte. Numa empresa que usa uma conta só, não havia um segundo aprovador para
      // destravar — excluir equipe era impossível. A RLS aceita o soft delete direto
      // (`labor_crews_update_role`), que é o caminho que remove* das outras tabelas já usa.
      pendingSync: [...s.pendingSync, makeOp({ entity: 'labor_crew', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'labor_crews' })],
    }))
    void get().flush()
  },

  // ── Timecards ───────────────────────────────────────────────────────────────

  addTimecard: (entry) => {
    // Gate espelhando a policy da tabela: papel fora da lista não passa no WITH CHECK e a
    // escrita otimista viraria op presa para sempre (o usuário acha que salvou).
    if (!podeEscreverMaoDeObra().pode) return ''
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
    if (!podeEscreverMaoDeObra().pode) return
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

  /**
   * Corrigir e apagar apontamento.
   *
   * Não existiam. Um apontamento lançado com 80 horas em vez de 8 ficava lá para sempre,
   * envenenando a RUP, o custo por atividade e o progresso físico — a única saída era pedir para
   * alguém mexer no banco. A RLS de `timecards` já aceitava os dois caminhos (`timecards_update_role`);
   * era só a tela que não tinha por onde.
   *
   * O apontamento que veio do RDO (`sourceRdoId`) é editável do mesmo jeito, mas vale saber que
   * re-finalizar aquele RDO reescreve o registro — a ponte é idempotente por `sourceRdoId`.
   */
  updateTimecard: (id, updates) => {
    if (!podeEscreverMaoDeObra().pode) return
    set((s) => ({ timecards: s.timecards.map((t) => (t.id === id ? { ...t, ...updates } : t)) }))
    const target = get().timecards.find((t) => t.id === id)
    if (!target) return
    const { orgId, userId } = ctxAuth()
    const row = timecardToRow(target, orgId, userId)
    const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
    set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'timecard', type: 'update', recordId: id, patch, table: 'timecards' })] }))
    void get().flush()
  },

  removeTimecard: (id) => {
    if (!podeEscreverMaoDeObra().pode) return
    // Soft delete: a policy de DELETE é `using(false)` em todas as tabelas do módulo.
    set((s) => ({
      timecards: s.timecards.filter((t) => t.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'timecard', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'timecards' })],
    }))
    void get().flush()
  },

  // Ponte RDO → apontamentos: gera 1 timecard por funcionário presente (casado por nome),
  // com horas rateadas por cabeça e custo/dia. Idempotente por sourceRdoId (re-finalizar
  // um RDO substitui os apontamentos daquele RDO, sem duplicar). unit:'h'/reportedQty:0
  // para NÃO dobrar o m² que a RUP já lê direto do Compizzo.
  syncRdoToTimecards: (rdo) => {
    // ─── O CASO QUE ATRAVESSA MÓDULOS ─────────────────────────────────────────
    // Esta ponte roda quando o RDO é FINALIZADO, dentro do `rdoStore`. E as duas listas de papéis
    // não são a mesma: `qualidade` pode finalizar RDO (`ROLES_RDO_WRITE`) mas não pode escrever em
    // `timecards` (`ROLES_MAO_DE_OBRA_WRITE`). Sem gate, o RDO finalizava com sucesso e cada
    // apontamento gerado voltava 42501 — as horas nunca chegavam à folha, e a fila entupia.
    //
    // Voltar calado seria trocar um problema por outro: quem finalizou acharia que a ponte rodou.
    // Então avisa, e o aviso aparece no indicador de sincronização.
    if (!podeEscreverMaoDeObra().pode) {
      set({
        syncError: 'O RDO foi finalizado, mas as horas não foram lançadas nos apontamentos: '
          + 'este acesso não tem permissão para escrever em Mão de Obra. Peça a alguém com papel de '
          + 'engenheiro, planejador, gerente ou diretor para reabrir e finalizar o RDO.',
      })
      return
    }
    const { orgId, userId } = ctxAuth()
    const workers = get().workers
    const porId = new Map(workers.map((w) => [w.id, w]))
    const deletedAt = new Date().toISOString()

    // Duas origens possíveis, um só resultado: linhas explícitas (RDO padrão, horas por linha)
    // ou o total do dia dividido pelo efetivo presente (Compizzo).
    const linhas: { worker: Worker; horas: number; descricao?: string }[] = rdo.entradas?.length
      ? rdo.entradas
          .flatMap((e) => {
            const w = porId.get(e.workerId)
            return w && e.horas > 0 ? [{ worker: w, horas: e.horas, descricao: e.descricao }] : []
          })
      : (() => {
          const present = rdo.employeeNames
            .map((name) => matchWorkerByName(name, workers))
            .filter((w): w is Worker => Boolean(w))
          const headcount = rdo.employeeNames.length || present.length || 1
          const horasPorCabeca = rdo.totalHoras > 0 ? rdo.totalHoras / headcount : 0
          return present.map((w) => ({ worker: w, horas: horasPorCabeca }))
        })()

    set((s) => {
      // Id DETERMINÍSTICO por (rdo, worker): re-finalizar em outro device faz o insert
      // virar upsert da MESMA linha (não duplica custo de M.O. entre dispositivos).
      // Um trabalhador que apareça em duas linhas do RDO tem as horas SOMADAS, senão a segunda
      // linha sobrescreveria a primeira no mesmo id.
      const agregado = new Map<string, { worker: Worker; horas: number; descricao?: string }>()
      for (const l of linhas) {
        const atual = agregado.get(l.worker.id)
        if (atual) atual.horas += l.horas
        else agregado.set(l.worker.id, { ...l })
      }
      const novos: TimecardEntry[] = [...agregado.values()].map(({ worker: w, horas, descricao }) => ({
        id: rdoTimecardId(rdo.id, w.id),
        workerId: w.id,
        date: rdo.date,
        hoursWorked: horas,
        projectRef: rdo.activityLabel ?? '',
        phaseRef: '',
        activityDescription: descricao || rdo.activityLabel || 'RDO',
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
    // Mesma ponte, sentido inverso (reabrir ou excluir o RDO). Mesmo motivo do gate acima.
    if (!podeEscreverMaoDeObra().pode) return
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

  // Ocorrência era o pior caso de perda: gravava num pedaço do estado que nem estava no
  // `partialize`. O registro aparecia na lista e sumia no primeiro F5.
  addOccurrence: (occ) => {
    // Gate espelha a policy de INSERT/UPDATE de labor_occurrences: papel fora da lista não passa
    // no WITH CHECK e a escrita otimista viraria op presa para sempre (o usuário acha que
    // salvou e o dado nunca chega). Mesmo padrão de `rdoStore.addRdo`.
    if (!podeEscreverMaoDeObra().pode) return
    const { orgId, userId } = ctxAuth()
    const nova = { ...occ, id: crypto.randomUUID() } as LaborOccurrence
    set((s) => ({
      occurrences: [...s.occurrences, nova],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'labor_occurrence', type: 'insert', recordId: nova.id, row: occurrenceToRow(nova, orgId, userId), table: 'labor_occurrences' })],
    }))
    void get().flush()
  },

  /**
   * Corrigir e apagar ocorrência.
   *
   * Mesma lacuna dos apontamentos: dava para registrar, nunca para desfazer. Uma advertência
   * lançada no funcionário errado ficava no histórico dele para sempre — e histórico de ocorrência
   * é o tipo de registro que pesa numa demissão.
   */
  updateOccurrence: (id, updates) => {
    if (!podeEscreverMaoDeObra().pode) return
    const atual = get().occurrences.find((o) => o.id === id)
    if (!atual) return
    const atualizada = { ...atual, ...updates } as LaborOccurrence
    const { orgId, userId } = ctxAuth()
    const row = occurrenceToRow(atualizada, orgId, userId)
    const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
    set((s) => ({
      occurrences: s.occurrences.map((o) => (o.id === id ? atualizada : o)),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'labor_occurrence', type: 'update', recordId: id, patch, table: 'labor_occurrences' })],
    }))
    void get().flush()
  },

  removeOccurrence: (id) => {
    if (!podeEscreverMaoDeObra().pode) return
    set((s) => ({
      occurrences: s.occurrences.filter((o) => o.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'labor_occurrence', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'labor_occurrences' })],
    }))
    void get().flush()
  },

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

  // Carimba a obra no turno, na criação. Sem isso o vínculo é o `worker.siteId` ATUAL, e
  // transferir alguém de obra reescreve o passado: as horas de julho migram para a obra nova.
  // Quem informa `siteId` explicitamente manda; senão herda do trabalhador, senão a obra ativa.
  addShift: (shift) => {
    // Gate espelhando a policy da tabela: papel fora da lista não passa no WITH CHECK e a
    // escrita otimista viraria op presa para sempre (o usuário acha que salvou).
    if (!podeEscreverMaoDeObra().pode) return ''
    const id = crypto.randomUUID()
    const newShift: Shift = { ...shift, id, siteId: resolverObraDoTurno(shift, get()) }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      shifts: [...s.shifts, newShift],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'shift', type: 'insert', recordId: id, row: shiftToRow(newShift, orgId, userId), table: 'shifts' })],
    }))
    void get().flush()
    return id
  },

  updateShift: (id, updates) => {
    if (!podeEscreverMaoDeObra().pode) return
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
    if (!podeEscreverMaoDeObra().pode) return
    set((s) => ({
      shifts: s.shifts.filter((sh) => sh.id !== id),
      // Mesma correção de `removeCrew`: o caminho de aprovação não apagava nada e o turno
      // reaparecia no pull. `shifts_update_role` aceita o soft delete direto.
      pendingSync: [...s.pendingSync, makeOp({ entity: 'shift', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'shifts' })],
    }))
    void get().flush()
  },

  bulkAddShifts: (newShifts) => {
    if (!podeEscreverMaoDeObra().pode) return
    const { orgId, userId } = ctxAuth()
    const estado = get()
    const withIds: Shift[] = newShifts.map((sh) => ({ ...sh, id: crypto.randomUUID(), siteId: resolverObraDoTurno(sh, estado) }))
    set((s) => ({
      shifts: [...s.shifts, ...withIds],
      pendingSync: [
        ...s.pendingSync,
        ...withIds.map((sh) => makeOp({ entity: 'shift', type: 'insert', recordId: sh.id, row: shiftToRow(sh, orgId, userId), table: 'shifts' })),
      ],
    }))
    void get().flush()
  },

  /**
   * Gera a escala do mês e **envia para o servidor**.
   *
   * Antes, três defeitos empilhados faziam os ~600 turnos gerados sumirem:
   *
   *  1. Nada era enfileirado em `pendingSync`, então nada subia.
   *  2. Como não havia op pendente para `shifts`, o `pull()` seguinte considerava o servidor a
   *     verdade e **substituía o array local inteiro**. Bastava sair do módulo e voltar.
   *  3. O id era `sh-3f2a1b9c`, que não é uuid — a coluna do Postgres é `uuid`. Se alguém
   *     editasse um turno gerado antes do pull, o update casava zero linhas e a operação ficava
   *     presa em retry infinito na fila.
   *
   * O padrão certo já existia ao lado, em `bulkAddShifts`. Os turnos substituídos também viram
   * soft delete: antes eles sumiam só localmente e voltavam no pull seguinte.
   */
  generateSchedule: (month) => {
    if (!podeEscreverMaoDeObra().pode) return
    const { workers, workPosts, cltSettings } = get()
    const { orgId, userId } = ctxAuth()
    const estadoAtual = get()

    // Dias que JÁ têm um turno não-'scheduled' para aquela pessoa: falta, feriado, atestado.
    //
    // Sem isto o gerador punha um turno novo por cima. O dia 10 ficava com dois turnos — o
    // 'absent' e um 'scheduled' — e a folha, que conta dias trabalhados pela quantidade de turnos
    // pagáveis, voltava a PAGAR o dia. O desconto da falta sumia sem ninguém ter apagado nada, e
    // a falta continuava aparecendo na tela, então não havia como desconfiar.
    const jaDecididos = new Set(
      estadoAtual.shifts
        .filter((sh) => sh.date.startsWith(month) && sh.status !== 'scheduled')
        .map((sh) => `${sh.workerId}|${sh.date}`),
    )

    const gerados: Shift[] = autoGenerateSchedule(workers, workPosts, month, cltSettings)
      .filter((sh) => !jaDecididos.has(`${sh.workerId}|${sh.date}`))
      .map((sh) => ({ ...sh, id: crypto.randomUUID(), siteId: resolverObraDoTurno(sh, estadoAtual) }))

    set((s) => {
      const substituidos = s.shifts.filter((sh) => sh.date.startsWith(month) && sh.status === 'scheduled')
      return {
        shifts: [...s.shifts.filter((sh) => !sh.date.startsWith(month) || sh.status !== 'scheduled'), ...gerados],
        pendingSync: [
          ...s.pendingSync,
          ...substituidos.map((sh) => makeOp({ entity: 'shift', type: 'update', recordId: sh.id, patch: { deleted_at: new Date().toISOString() }, table: 'shifts' })),
          ...gerados.map((sh) => makeOp({ entity: 'shift', type: 'insert', recordId: sh.id, row: shiftToRow(sh, orgId, userId), table: 'shifts' })),
        ],
      }
    })
    void get().flush()
    get().revalidateCLT()
  },

  // ── CLT Validation ──────────────────────────────────────────────────────────

  revalidateCLT: () => {
    const { workers, shifts, cltSettings } = get()
    const violations = runAllCLTChecks(workers, shifts, cltSettings)
    set({ violations })
  },

  // ── Work Posts ──────────────────────────────────────────────────────────────

  // Postos de trabalho passam a ir para o servidor. Antes ficavam só no navegador: o engenheiro
  // cadastrava trinta, trocava de máquina, e encontrava a aba vazia — e como eles alimentam a
  // geração automática de escala, perder os postos era perder a escala junto.
  // O id vira uuid de verdade: `wp-3f2a1b9c` não entra numa coluna `uuid` do Postgres.
  addWorkPost: (post) => {
    // Gate espelha a policy de INSERT/UPDATE de work_posts: papel fora da lista não passa
    // no WITH CHECK e a escrita otimista viraria op presa para sempre (o usuário acha que
    // salvou e o dado nunca chega). Mesmo padrão de `rdoStore.addRdo`.
    if (!podeEscreverMaoDeObra().pode) return
    const { orgId, userId } = ctxAuth()
    const novo: WorkPost = { ...post, id: crypto.randomUUID() }
    set((s) => ({
      workPosts: [...s.workPosts, novo],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'work_post', type: 'insert', recordId: novo.id, row: workPostToRow(novo, orgId, userId), table: 'work_posts' })],
    }))
    void get().flush()
  },

  updateWorkPost: (id, updates) => {
    // Gate espelha a policy de INSERT/UPDATE de work_posts: papel fora da lista não passa
    // no WITH CHECK e a escrita otimista viraria op presa para sempre (o usuário acha que
    // salvou e o dado nunca chega). Mesmo padrão de `rdoStore.addRdo`.
    if (!podeEscreverMaoDeObra().pode) return
    const atual = get().workPosts.find((p) => p.id === id)
    if (!atual) return
    const atualizado = { ...atual, ...updates }
    set((s) => ({
      workPosts: s.workPosts.map((p) => (p.id === id ? atualizado : p)),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'work_post', type: 'update', recordId: id, patch: { payload: atualizado as unknown as Record<string, unknown> }, table: 'work_posts' })],
    }))
    void get().flush()
  },

  removeWorkPost: (id) => {
    // Gate espelha a policy de INSERT/UPDATE de work_posts: papel fora da lista não passa
    // no WITH CHECK e a escrita otimista viraria op presa para sempre (o usuário acha que
    // salvou e o dado nunca chega). Mesmo padrão de `rdoStore.addRdo`.
    if (!podeEscreverMaoDeObra().pode) return
    set((s) => ({
      workPosts: s.workPosts.filter((p) => p.id !== id),
      // Soft delete, como no resto do projeto: a policy de DELETE é `using(false)`.
      pendingSync: [...s.pendingSync, makeOp({ entity: 'work_post', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'work_posts' })],
    }))
    void get().flush()
  },

  // ── Absences ────────────────────────────────────────────────────────────────

  /**
   * Registra a falta — e DESCONTA o dia.
   *
   * ─── O DEFEITO QUE ISTO FECHA ───────────────────────────────────────────────────────────────
   * A falta era gravada na lista de ausências e não tocava no turno. Mas a folha
   * (`payrollEngine`) e o CMO só olham `shift.status === 'absent'`. Consequência: você registrava
   * a falta na aba certa, via "registrado com sucesso", e o dia continuava PAGO — `absentDays` do
   * holerite ficava zero. As duas telas existiam e não se falavam.
   *
   * Agora registrar a falta marca o turno daquele dia como `absent`, que é exatamente o que a
   * folha já sabe ler. Não invento caminho novo: ligo os dois que já existem.
   *
   * Se não houver turno no dia, a falta é registrada mesmo assim e `turnoMarcado` volta `false` —
   * cabe à tela dizer que não houve o que descontar, em vez de fingir que descontou.
   */
  registerAbsence: (absence) => {
    // Gate espelhando a policy de `worker_absences`: papel fora da lista não passa no WITH CHECK,
    // e a escrita otimista viraria op presa para sempre.
    if (!podeEscreverMaoDeObra().pode) return ''

    // Duas faltas do mesmo trabalhador no mesmo dia dobram a penalização na avaliação e o
    // desconto no CMO. A segunda é ignorada, devolvendo o id da que já existe.
    const jaExiste = get().absences.find((a) => a.workerId === absence.workerId && a.date === absence.date)
    if (jaExiste) return jaExiste.id

    const id = crypto.randomUUID()
    const { orgId, userId } = ctxAuth()
    const siteId = absence.siteId
      ?? get().workers.find((w) => w.id === absence.workerId)?.siteId
      ?? useActiveObraStore.getState().activeObraId
      ?? null
    const newAbsence: WorkerAbsence = { ...absence, siteId, id, registeredAt: new Date().toISOString() }

    set((s) => ({
      absences: [...s.absences, newAbsence],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'worker_absence', type: 'insert', recordId: id, row: absenceToRow(newAbsence, orgId, userId), table: 'worker_absences' })],
    }))
    get().marcarTurnoAusente(absence.workerId, absence.date, true)
    void get().flush()
    return id
  },

  /**
   * Marca (ou desmarca) o turno do dia como ausente — a ponte entre a aba Faltas e a folha.
   *
   * Devolve `true` se havia turno para marcar. Sem turno no dia não há o que descontar: a falta
   * fica registrada para histórico e avaliação, e a tela avisa.
   */
  marcarTurnoAusente: (workerId, date, ausente) => {
    if (!podeEscreverMaoDeObra().pode) return false
    const alvos = get().shifts.filter((sh) => sh.workerId === workerId && sh.date === date)
    if (alvos.length === 0) return false
    set((s) => ({
      shifts: s.shifts.map((sh) =>
        sh.workerId === workerId && sh.date === date
          ? { ...sh, status: ausente ? 'absent' as const : 'scheduled' as const }
          : sh,
      ),
      pendingSync: [
        ...s.pendingSync,
        ...alvos.map((sh) => makeOp({
          entity: 'shift', type: 'update', recordId: sh.id,
          patch: { payload: { ...sh, status: ausente ? 'absent' : 'scheduled' } as unknown as Record<string, unknown> },
          table: 'shifts',
        })),
      ],
    }))
    get().revalidateCLT()
    return true
  },

  /** Corrige uma falta lançada errado. Não existia — o erro era permanente. */
  updateAbsence: (id, patch) => {
    const atual = get().absences.find((a) => a.id === id)
    if (!atual) return
    if (!podeEscreverMaoDeObra().pode) return
    const proximo: WorkerAbsence = { ...atual, ...patch }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      absences: s.absences.map((a) => (a.id === id ? proximo : a)),
      pendingSync: [...s.pendingSync, makeOp({
        entity: 'worker_absence', type: 'update', recordId: id,
        patch: changedColumns(absenceToRow(atual, orgId, userId), absenceToRow(proximo, orgId, userId)),
        table: 'worker_absences',
      })],
    }))
    // Mudou de pessoa ou de dia: o turno antigo volta ao normal e o novo é marcado.
    if (patch.workerId !== undefined || patch.date !== undefined) {
      get().marcarTurnoAusente(atual.workerId, atual.date, false)
      get().marcarTurnoAusente(proximo.workerId, proximo.date, true)
    }
    void get().flush()
  },

  /** Apaga uma falta e DESFAZ o desconto. Também não existia. */
  removeAbsence: (id) => {
    const alvo = get().absences.find((a) => a.id === id)
    if (!alvo) return
    if (!podeEscreverMaoDeObra().pode) return
    set((s) => ({
      absences: s.absences.filter((a) => a.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'worker_absence', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'worker_absences' })],
    }))
    get().marcarTurnoAusente(alvo.workerId, alvo.date, false)
    void get().flush()
  },

  assignSubstitute: (absenceId, substituteWorkerId) => {
    // Sem este gate, papel sem escrita criava op presa para sempre — o botão "Resolver" dizia
    // que resolveu e o servidor rejeitava em silêncio.
    if (!podeEscreverMaoDeObra().pode) return
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
    // Sem este gate, papel sem escrita criava op presa para sempre — o botão "Resolver" dizia
    // que resolveu e o servidor rejeitava em silêncio.
    if (!podeEscreverMaoDeObra().pode) return
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
    // Gate espelhando a policy de `worker_assessments`: papel fora da lista não passa no WITH
    // CHECK e a escrita otimista viraria op presa para sempre.
    if (!podeEscreverMaoDeObra().pode) return ''
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
    if (!podeEscreverMaoDeObra().pode) return
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
    if (!podeEscreverMaoDeObra().pode) return
    set((s) => ({ assessments: s.assessments.filter((a) => a.id !== id) }))
    set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'worker_assessment', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'worker_assessments' })] }))
    void get().flush()
  },

  // ── CLT Settings ─────────────────────────────────────────────────────────────

  updateCLTSettings: (settings) => {
    // SEM gate de papel, e isso é deliberado: as policies de `clt_settings`
    // (`20260704120000_clt_settings.sql`) exigem só `organization_id = user_org()`, sem `has_role`.
    // Um gate aqui seria mais rígido que o servidor e esconderia a tela de quem tem direito a ela.
    // A regra deste projeto é: o gate espelha a RLS — nem mais, nem menos.
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
    const wps = await pullTable<{ payload: WorkPost }>('work_posts')
    const occ = await pullTable<{ payload: LaborOccurrence }>('labor_occurrences')

    // ── Subida única do que já existia só no navegador ─────────────────────────────
    //
    // Postos e ocorrências viveram tempo em localStorage sem tabela no servidor. Assim que a
    // migration 20260817140000 é aplicada, o servidor responde uma lista VAZIA — e `mergePull`,
    // sem op pendente, trataria isso como "o servidor não tem nada" e apagaria o que está aqui.
    // Seria trocar uma perda de dado por outra, no exato momento da correção.
    //
    // Então, na primeira vez que a tabela responde, o que é local vira operação de insert. As
    // ops entram ANTES do mergePull abaixo, para os ids ficarem protegidos na mesma passagem.
    // Ids antigos no formato `wp-3f2a1b9c` são reemitidos como uuid — a coluna não aceitaria.
    const { orgId, userId } = ctxAuth()
    const ehUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    if (orgId && (wps || occ)) {
      const st = get()
      const postosASubir = wps && !st.workPostsMigrados ? st.workPosts : []
      const ocorrASubir  = occ && !st.occurrencesMigradas ? st.occurrences : []
      if (postosASubir.length > 0 || ocorrASubir.length > 0) {
        const postosComId = postosASubir.map((wp) => (ehUuid(wp.id) ? wp : { ...wp, id: crypto.randomUUID() }))
        const ocorrComId  = ocorrASubir.map((o) => (ehUuid(o.id) ? o : { ...o, id: crypto.randomUUID() }))
        set((cur) => ({
          workPosts:   postosComId.length ? postosComId : cur.workPosts,
          occurrences: ocorrComId.length ? ocorrComId : cur.occurrences,
          pendingSync: [
            ...cur.pendingSync,
            ...postosComId.map((wp) => makeOp({ entity: 'work_post', type: 'insert', recordId: wp.id, row: workPostToRow(wp, orgId, userId), table: 'work_posts' })),
            ...ocorrComId.map((o) => makeOp({ entity: 'labor_occurrence', type: 'insert', recordId: o.id, row: occurrenceToRow(o, orgId, userId), table: 'labor_occurrences' })),
          ],
        }))
        console.info(`[mao-de-obra] subindo ${postosComId.length} posto(s) e ${ocorrComId.length} ocorrência(s) que só existiam neste navegador`)
      }
      if (wps) set({ workPostsMigrados: true })
      if (occ) set({ occurrencesMigradas: true })
    }
    set((s) => ({
      workers:     mergePull(ws?.map((r) => normalizeWorker(r.payload)) ?? null, s.workers, s.pendingSync, 'workers'),
      crews:       mergePull(cs?.map((r) => normalizeCrew(r.payload)) ?? null, s.crews, s.pendingSync, 'labor_crews'),
      timecards:   mergePull(ts?.map((r) => r.payload) ?? null, s.timecards, s.pendingSync, 'timecards'),
      shifts:      mergePull(ss?.map((r) => r.payload) ?? null, s.shifts, s.pendingSync, 'shifts'),
      absences:    mergePull(as_?.map((r) => r.payload) ?? null, s.absences, s.pendingSync, 'worker_absences'),
      assessments: mergePull(asmt?.map((r) => r.payload) ?? null, s.assessments, s.pendingSync, 'worker_assessments'),
      // Tabelas novas (migration 20260817140000). Enquanto ela não for aplicada, `pullTable`
      // devolve null e o `mergePull` preserva o que está local — nada se perde no meio-termo.
      workPosts:   mergePull(wps?.map((r) => r.payload) ?? null, s.workPosts, s.pendingSync, 'work_posts'),
      occurrences: mergePull(occ?.map((r) => r.payload) ?? null, s.occurrences, s.pendingSync, 'labor_occurrences'),
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
        // Faltava aqui: a ocorrência aparecia na lista e sumia no primeiro F5.
        occurrences:    s.occurrences,
        workPostsMigrados:   s.workPostsMigrados,
        occurrencesMigradas: s.occurrencesMigradas,
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
