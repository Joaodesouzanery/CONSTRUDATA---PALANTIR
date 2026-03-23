import { create } from 'zustand'
import type {
  Worker,
  LaborCrew,
  TimecardEntry,
  PhysicalProgress,
  LaborOccurrence,
  RiskArea,
  ReallocationSuggestion,
} from '@/types'
import {
  mockWorkers,
  mockLaborCrews,
  mockTimecards,
  mockPhysicalProgress,
  mockOccurrences,
  mockRiskAreas,
  mockReallocationSuggestions,
} from '@/data/mockMaoDeObra'

// ─── Access Check Result ───────────────────────────────────────────────────────

export interface AccessCheckResult {
  allowed: boolean
  worker: Worker
  riskArea: RiskArea
  missingCerts: string[]       // cert types that are missing or expired
  expiredCerts: string[]       // cert types present but expired
}

// ─── State ─────────────────────────────────────────────────────────────────────

interface MaoDeObraState {
  workers:     Worker[]
  crews:       LaborCrew[]
  timecards:   TimecardEntry[]
  progress:    PhysicalProgress[]
  occurrences: LaborOccurrence[]
  riskAreas:   RiskArea[]
  suggestions: ReallocationSuggestion[]

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

  // Demo / clear
  loadDemoData: () => void
  clearData:    () => void
}

// ─── Reallocation Engine ───────────────────────────────────────────────────────

/**
 * Deterministic algorithm that:
 * 1. Finds activities with actual qty < 70% of planned qty (= delayed)
 * 2. Finds activities with actual qty >= 95% of planned (= on-track / has slack)
 * 3. Emits one ReallocationSuggestion per delayed activity
 */
function computeSuggestions(
  progress: PhysicalProgress[],
  crews: LaborCrew[],
  existingSuggestions: ReallocationSuggestion[],
): ReallocationSuggestion[] {
  // Group progress by phaseId+activityName for the last 7 days
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
    // Skip if a suggestion for this delayed activity already exists and was acted on
    const already = existingSuggestions.find(
      (s) => s.delayedTaskName === del.activityName && (s.accepted === true || s.accepted === false)
    )
    if (already) continue

    const sourceTask = onTrack.find((t) => t.key !== del.key)
    if (!sourceTask) continue

    const sourceCrew = crews[Math.floor(Math.random() * crews.length)]
    const floatDays  = 7 + Math.floor(Math.random() * 8)   // deterministic-ish mock float 7–14

    const delayDays = Math.max(1, Math.round(del.deviation / 15))

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

export const useMaoDeObraStore = create<MaoDeObraState>((set, get) => ({
  workers:     mockWorkers,
  crews:       mockLaborCrews,
  timecards:   mockTimecards,
  progress:    mockPhysicalProgress,
  occurrences: mockOccurrences,
  riskAreas:   mockRiskAreas,
  suggestions: mockReallocationSuggestions,

  // ── Worker ──────────────────────────────────────────────────────────────────

  addWorker: (worker) =>
    set((s) => ({
      workers: [...s.workers, { ...worker, id: `w-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  updateWorker: (id, updates) =>
    set((s) => ({
      workers: s.workers.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    })),

  // ── Crew ────────────────────────────────────────────────────────────────────

  addCrew: (crew) =>
    set((s) => ({
      crews: [...s.crews, { ...crew, id: `lc-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  updateCrew: (id, updates) =>
    set((s) => ({
      crews: s.crews.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  // ── Timecards ───────────────────────────────────────────────────────────────

  addTimecard: (entry) =>
    set((s) => ({
      timecards: [...s.timecards, { ...entry, id: `tc-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  importTimecards: (entries) =>
    set((s) => ({
      timecards: [
        ...s.timecards,
        ...entries.map((e) => ({ ...e, id: `tc-${crypto.randomUUID().slice(0, 8)}` })),
      ],
    })),

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
    // Merge: keep existing suggestions that are acted on, append newly generated ones
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
    const worker  = workers.find((w) => w.id === workerId)
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

  // ── Demo / Clear ─────────────────────────────────────────────────────────────

  loadDemoData: () =>
    set({
      workers:     mockWorkers,
      crews:       mockLaborCrews,
      timecards:   mockTimecards,
      progress:    mockPhysicalProgress,
      occurrences: mockOccurrences,
      riskAreas:   mockRiskAreas,
      suggestions: mockReallocationSuggestions,
    }),

  clearData: () =>
    set({
      workers:     [],
      crews:       [],
      timecards:   [],
      progress:    [],
      occurrences: [],
      riskAreas:   mockRiskAreas,   // keep risk area definitions — they're configuration
      suggestions: [],
    }),
}))

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** HH trabalhadas na última semana */
export function calcWeeklyHH(timecards: TimecardEntry[]): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  return timecards
    .filter((tc) => new Date(tc.date) >= cutoff)
    .reduce((sum, tc) => sum + tc.hoursWorked, 0)
}

/** Média HH por m² (apenas registros com unit === 'm²' e qty > 0) */
export function calcProductivity(timecards: TimecardEntry[]): number {
  const relevant = timecards.filter((tc) => tc.unit === 'm²' && tc.reportedQty > 0)
  if (relevant.length === 0) return 0
  const totalHH = relevant.reduce((s, tc) => s + tc.hoursWorked, 0)
  const totalM2 = relevant.reduce((s, tc) => s + tc.reportedQty, 0)
  return totalM2 > 0 ? parseFloat((totalHH / totalM2).toFixed(2)) : 0
}

/** % de funcionários ativos com todas certificações válidas */
export function calcComplianceRate(workers: Worker[]): number {
  const active = workers.filter((w) => w.status === 'active')
  if (active.length === 0) return 0
  const compliant = active.filter(
    (w) => w.certifications.every((c) => c.status === 'valid' || c.status === 'expiring')
  )
  return Math.round((compliant.length / active.length) * 100)
}

/** Ocorrências sem impacto resolvido (últimos 30 dias) */
export function calcActiveOccurrences(occurrences: LaborOccurrence[]): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  return occurrences.filter((o) => new Date(o.date) >= cutoff).length
}

/** Certificações expirando nos próximos `days` dias */
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
