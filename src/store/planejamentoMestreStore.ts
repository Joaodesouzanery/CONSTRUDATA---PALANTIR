/**
 * planejamentoMestreStore.ts — Zustand store for Planejamento Mestre module.
 *
 * Sprint 3: migrado para Supabase via storeSync helper.
 * Tabelas: master_activities, master_baselines, lookahead_derived_activities,
 * programacao_diaria. Padrão: payload jsonb completo.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type {
  PlanejamentoMestreTab, MasterActivity, MasterBaseline,
  LookaheadDerivedActivity, WhatIfAdjustment, ProgramacaoDiaria,
} from '@/types'
import {
  computeMasterSCurve, applyWhatIfAdjustments, deriveLookahead,
  getProjectDateRange, type MasterSCurvePoint,
} from '@/features/planejamento-mestre/utils/masterEngine'

// ─── Mappers ──────────────────────────────────────────────────────────────────
function masterActivityToRow(a: MasterActivity, orgId: string, userId: string) {
  return {
    id:              a.id,
    organization_id: orgId,
    wbs_code:        a.wbsCode ?? null,
    name:            a.name ?? null,
    parent_id:       a.parentId ?? null,
    level:           a.level ?? null,
    planned_start:   a.plannedStart ?? null,
    planned_end:     a.plannedEnd ?? null,
    status:          a.status ?? 'not_started',
    payload:         a as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function masterBaselineToRow(b: MasterBaseline, orgId: string, userId: string) {
  return {
    id:              b.id,
    organization_id: orgId,
    name:            b.name,
    payload:         b as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function lookaheadToRow(d: LookaheadDerivedActivity, orgId: string, userId: string) {
  return {
    id:                 d.id,
    organization_id:    orgId,
    master_activity_id: (d as { masterActivityId?: string }).masterActivityId ?? null,
    week_iso:           (d as { weekIso?: string }).weekIso ?? null,
    status:             (d as { status?: string }).status ?? null,
    payload:            d as unknown as Record<string, unknown>,
    created_by:         userId,
  }
}

interface PlanejamentoMestreState {
  activeTab: PlanejamentoMestreTab
  activities: MasterActivity[]
  baselines: MasterBaseline[]
  activeBaselineId: string | null
  lookaheadWeeks: number
  derivedActivities: LookaheadDerivedActivity[]
  whatIfAdjustments: WhatIfAdjustment[]
  originalSCurve: MasterSCurvePoint[]
  simulatedSCurve: MasterSCurvePoint[]
  programacaoSemanal: Record<string, Record<string, ProgramacaoDiaria>>

  setActiveTab: (tab: PlanejamentoMestreTab) => void

  addActivity: (activity: Omit<MasterActivity, 'id'>) => void
  updateActivity: (id: string, patch: Partial<MasterActivity>) => void
  removeActivity: (id: string) => void

  createBlankProject: (input: {
    projectName: string
    networkType?: 'agua' | 'esgoto' | 'civil' | 'geral'
    startDate: string
    endDate:   string
    fronts:    string[]
    includeServices: boolean
  }) => void

  saveBaseline: (name: string) => void
  loadBaseline: (id: string) => void
  removeBaseline: (id: string) => void

  setLookaheadWeeks: (weeks: number) => void
  deriveFromMaster: () => void
  updateDerivedActivity: (id: string, patch: Partial<LookaheadDerivedActivity>) => void

  addWhatIfAdjustment: (adj: WhatIfAdjustment) => void
  removeWhatIfAdjustment: (activityId: string) => void
  clearWhatIfAdjustments: () => void
  runWhatIfSimulation: () => void

  setProgramacaoDiaria: (activityId: string, date: string, data: ProgramacaoDiaria) => void

  loadDemoData: () => void
  clearData: () => void

  // Sync (Sprint 3)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const usePlanejamentoMestreStore = create<PlanejamentoMestreState>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))
      const ctx = () => {
        const { profile, user } = useAuth.getState()
        return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
      }
      return {
        activeTab: 'macro',
        activities: [],
        baselines: [],
        activeBaselineId: null,
        lookaheadWeeks: 6,
        derivedActivities: [],
        whatIfAdjustments: [],
        originalSCurve: [],
        simulatedSCurve: [],
        programacaoSemanal: {},

        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        setActiveTab: (tab) => set({ activeTab: tab }),

        addActivity: (activity) => {
          const id = crypto.randomUUID()
          const newActivity: MasterActivity = { ...activity, id }
          set((s) => ({ activities: [...s.activities, newActivity] }))
          const { orgId, userId } = ctx()
          enqueue(makeOp({ entity: 'master_activity', type: 'insert', recordId: id, row: masterActivityToRow(newActivity, orgId, userId), table: 'master_activities' }))
          void get().flush()
        },

        updateActivity: (id, patch) => {
          set((s) => ({ activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
          const target = get().activities.find((a) => a.id === id)
          if (target) {
            const { orgId, userId } = ctx()
            const row = masterActivityToRow(target, orgId, userId)
            const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'master_activity', type: 'update', recordId: id, patch: updatePatch, table: 'master_activities' }))
            void get().flush()
          }
        },

        removeActivity: (id) => {
          set((s) => ({ activities: s.activities.filter((a) => a.id !== id) }))
          enqueue(makeOp({ entity: 'master_activity', type: 'delete', recordId: id, table: 'master_activities', approvalActionType: 'delete_master_activity' }))
          void get().flush()
        },

        createBlankProject: ({ projectName, networkType, startDate, endDate, fronts, includeServices }) => {
          const start = new Date(startDate)
          const end = new Date(endDate)
          const totalMs = Math.max(1, end.getTime() - start.getTime())
          const totalDays = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24)))
          const newActivities: MasterActivity[] = []
          const rootId = crypto.randomUUID()
          newActivities.push({
            id: rootId, wbsCode: '1', name: projectName, parentId: null, level: 0,
            plannedStart: startDate, plannedEnd: endDate, trendStart: startDate, trendEnd: endDate,
            durationDays: totalDays, percentComplete: 0, status: 'not_started', isMilestone: false,
            weight: 100, networkType,
          })
          const frontCount = Math.max(1, fronts.length)
          const daysPerFront = Math.max(1, Math.floor(totalDays / frontCount))
          const weightPerFront = Math.round(100 / frontCount)
          fronts.forEach((frontName, idx) => {
            const frontId = crypto.randomUUID()
            const frontStart = new Date(start)
            frontStart.setDate(frontStart.getDate() + idx * daysPerFront)
            const frontEnd = new Date(frontStart)
            frontEnd.setDate(frontEnd.getDate() + daysPerFront)
            const frontStartStr = frontStart.toISOString().slice(0, 10)
            const frontEndStr = frontEnd.toISOString().slice(0, 10)
            newActivities.push({
              id: frontId, wbsCode: `1.${idx + 1}`, name: frontName || `Frente ${idx + 1}`,
              parentId: rootId, level: 1,
              plannedStart: frontStartStr, plannedEnd: frontEndStr,
              trendStart: frontStartStr, trendEnd: frontEndStr,
              durationDays: daysPerFront, percentComplete: 0, status: 'not_started',
              isMilestone: false, weight: weightPerFront, networkType,
            })
            if (includeServices) {
              newActivities.push({
                id: crypto.randomUUID(), wbsCode: `1.${idx + 1}.1`, name: 'Principais Serviços',
                parentId: frontId, level: 2,
                plannedStart: frontStartStr, plannedEnd: frontEndStr,
                trendStart: frontStartStr, trendEnd: frontEndStr,
                durationDays: daysPerFront, percentComplete: 0, status: 'not_started',
                isMilestone: false, weight: weightPerFront, networkType,
              })
            }
          })
          set({
            activities: newActivities, baselines: [], activeBaselineId: null,
            derivedActivities: [], whatIfAdjustments: [],
            originalSCurve: [], simulatedSCurve: [], programacaoSemanal: {},
          })
          // Enfileira insert para todas as novas atividades
          const { orgId, userId } = ctx()
          for (const a of newActivities) {
            enqueue(makeOp({ entity: 'master_activity', type: 'insert', recordId: a.id, row: masterActivityToRow(a, orgId, userId), table: 'master_activities' }))
          }
          void get().flush()
        },

        saveBaseline: (name) => {
          const baseline: MasterBaseline = {
            id: crypto.randomUUID(), name,
            createdAt: new Date().toISOString(),
            activities: structuredClone(get().activities),
          }
          set((s) => ({ baselines: [...s.baselines, baseline] }))
          const { orgId, userId } = ctx()
          enqueue(makeOp({ entity: 'master_baseline', type: 'insert', recordId: baseline.id, row: masterBaselineToRow(baseline, orgId, userId), table: 'master_baselines' }))
          void get().flush()
        },

        loadBaseline: (id) =>
          set((s) => {
            const bl = s.baselines.find((b) => b.id === id)
            if (!bl) return {}
            return { activities: structuredClone(bl.activities), activeBaselineId: id }
          }),

        removeBaseline: (id) => {
          set((s) => ({
            baselines: s.baselines.filter((b) => b.id !== id),
            activeBaselineId: s.activeBaselineId === id ? null : s.activeBaselineId,
          }))
          enqueue(makeOp({ entity: 'master_baseline', type: 'delete', recordId: id, table: 'master_baselines', approvalActionType: 'delete_master_baseline' }))
          void get().flush()
        },

        setLookaheadWeeks: (weeks) => set({ lookaheadWeeks: weeks }),

        updateDerivedActivity: (id, patch) => {
          set((s) => ({ derivedActivities: s.derivedActivities.map((d) => (d.id === id ? { ...d, ...patch } : d)) }))
          const target = get().derivedActivities.find((d) => d.id === id)
          if (target) {
            const { orgId, userId } = ctx()
            const row = lookaheadToRow(target, orgId, userId)
            const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'lookahead', type: 'update', recordId: id, patch: updatePatch, table: 'lookahead_derived_activities' }))
            void get().flush()
          }
        },

        deriveFromMaster: () => {
          const { activities, lookaheadWeeks } = get()
          const today = new Date().toISOString().slice(0, 10)
          const derived = deriveLookahead(activities, today, lookaheadWeeks)
          set({ derivedActivities: derived })
        },

        addWhatIfAdjustment: (adj) =>
          set((s) => {
            const existing = s.whatIfAdjustments.filter((a) => a.activityId !== adj.activityId)
            return { whatIfAdjustments: [...existing, adj] }
          }),

        removeWhatIfAdjustment: (activityId) =>
          set((s) => ({ whatIfAdjustments: s.whatIfAdjustments.filter((a) => a.activityId !== activityId) })),

        clearWhatIfAdjustments: () => set({ whatIfAdjustments: [], simulatedSCurve: [] }),

        setProgramacaoDiaria: (activityId, date, data) =>
          set((s) => ({
            programacaoSemanal: {
              ...s.programacaoSemanal,
              [activityId]: { ...(s.programacaoSemanal[activityId] ?? {}), [date]: data },
            },
          })),

        runWhatIfSimulation: () => {
          const { activities, whatIfAdjustments } = get()
          const { start, end } = getProjectDateRange(activities)
          const original = computeMasterSCurve(activities, start, end)
          const adjusted = applyWhatIfAdjustments(activities, whatIfAdjustments)
          const { end: adjEnd } = getProjectDateRange(adjusted)
          const farEnd = adjEnd > end ? adjEnd : end
          const simulated = computeMasterSCurve(adjusted, start, farEnd)
          const extOriginal = farEnd > end ? computeMasterSCurve(activities, start, farEnd) : original
          set({ originalSCurve: extOriginal, simulatedSCurve: simulated })
        },

        loadDemoData: () => {
          import('@/data/mockPlanejamentoMestre').then((m) => {
            const { start, end } = getProjectDateRange(m.MOCK_MASTER_ACTIVITIES)
            const scurve = computeMasterSCurve(m.MOCK_MASTER_ACTIVITIES, start, end)
            set({
              activities: structuredClone(m.MOCK_MASTER_ACTIVITIES),
              baselines: [structuredClone(m.MOCK_MASTER_BASELINE)],
              activeBaselineId: m.MOCK_MASTER_BASELINE.id,
              derivedActivities: structuredClone(m.MOCK_DERIVED_ACTIVITIES),
              originalSCurve: scurve,
              simulatedSCurve: [],
              whatIfAdjustments: [],
            })
          })
        },

        clearData: () =>
          set({
            activities: [], baselines: [], activeBaselineId: null,
            derivedActivities: [], whatIfAdjustments: [],
            originalSCurve: [], simulatedSCurve: [], programacaoSemanal: {},
            pendingSync: [], syncError: null,
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
          const acts = await pullTable<{ payload: MasterActivity }>('master_activities')
          const bls  = await pullTable<{ payload: MasterBaseline }>('master_baselines')
          const lds  = await pullTable<{ payload: LookaheadDerivedActivity }>('lookahead_derived_activities')
          if (acts) set({ activities: acts.map((r) => r.payload) })
          if (bls)  set({ baselines: bls.map((r) => r.payload) })
          if (lds)  set({ derivedActivities: lds.map((r) => r.payload) })
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-planejamento-mestre',
      partialize: (s) => ({
        activities:        s.activities,
        baselines:         s.baselines,
        activeBaselineId:  s.activeBaselineId,
        lookaheadWeeks:    s.lookaheadWeeks,
        derivedActivities: s.derivedActivities,
        programacaoSemanal: s.programacaoSemanal,
        pendingSync:       s.pendingSync,
        lastSyncedAt:      s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void usePlanejamentoMestreStore.getState().flush()
  })
}
