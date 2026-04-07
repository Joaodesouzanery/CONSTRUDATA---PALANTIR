/**
 * planejamentoMestreStore.ts — Zustand store for Planejamento Mestre module.
 */
import { create } from 'zustand'
import type {
  PlanejamentoMestreTab, MasterActivity, MasterBaseline,
  LookaheadDerivedActivity, WhatIfAdjustment, ProgramacaoDiaria,
} from '@/types'
import {
  computeMasterSCurve, applyWhatIfAdjustments, deriveLookahead,
  getProjectDateRange, type MasterSCurvePoint,
} from '@/features/planejamento-mestre/utils/masterEngine'

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

  // Navigation
  setActiveTab: (tab: PlanejamentoMestreTab) => void

  // Activity CRUD
  addActivity: (activity: Omit<MasterActivity, 'id'>) => void
  updateActivity: (id: string, patch: Partial<MasterActivity>) => void
  removeActivity: (id: string) => void

  // Wizard "Criar Cronograma do Zero"
  createBlankProject: (input: {
    projectName: string
    networkType?: 'agua' | 'esgoto' | 'civil' | 'geral'
    startDate: string                // yyyy-MM-dd
    endDate:   string                // yyyy-MM-dd
    fronts:    string[]              // nomes das frentes/comunidades (Level 1)
    includeServices: boolean         // gera "Principais Serviços" (Level 2) sob cada frente
  }) => void

  // Baselines
  saveBaseline: (name: string) => void
  loadBaseline: (id: string) => void
  removeBaseline: (id: string) => void

  // Look-ahead
  setLookaheadWeeks: (weeks: number) => void
  deriveFromMaster: () => void
  updateDerivedActivity: (id: string, patch: Partial<LookaheadDerivedActivity>) => void

  // What-if
  addWhatIfAdjustment: (adj: WhatIfAdjustment) => void
  removeWhatIfAdjustment: (activityId: string) => void
  clearWhatIfAdjustments: () => void
  runWhatIfSimulation: () => void

  // Weekly programming
  setProgramacaoDiaria: (activityId: string, date: string, data: ProgramacaoDiaria) => void

  // Data
  loadDemoData: () => void
  clearData: () => void
}

export const usePlanejamentoMestreStore = create<PlanejamentoMestreState>((set, get) => ({
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

  setActiveTab: (tab) => set({ activeTab: tab }),

  addActivity: (activity) =>
    set((s) => ({
      activities: [...s.activities, { ...activity, id: crypto.randomUUID() }],
    })),

  updateActivity: (id, patch) =>
    set((s) => ({
      activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  removeActivity: (id) =>
    set((s) => ({
      activities: s.activities.filter((a) => a.id !== id),
    })),

  /**
   * Cria um cronograma macro do zero a partir de inputs mínimos do wizard.
   * Limpa qualquer atividade existente e gera uma estrutura WBS de 2-3 níveis:
   *   1                    Projeto (Level 0)
   *   1.1, 1.2, ...        Frentes/comunidades (Level 1)
   *   1.1.1, 1.2.1, ...    "Principais Serviços" (Level 2, opcional)
   *
   * Datas de cada frente são distribuídas igualmente entre startDate e endDate.
   */
  createBlankProject: ({ projectName, networkType, startDate, endDate, fronts, includeServices }) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalMs = Math.max(1, end.getTime() - start.getTime())
    const totalDays = Math.max(1, Math.round(totalMs / (1000 * 60 * 60 * 24)))

    const newActivities: MasterActivity[] = []

    // ── Level 0: Projeto raiz
    const rootId = crypto.randomUUID()
    newActivities.push({
      id:               rootId,
      wbsCode:          '1',
      name:             projectName,
      parentId:         null,
      level:            0,
      plannedStart:     startDate,
      plannedEnd:       endDate,
      trendStart:       startDate,
      trendEnd:         endDate,
      durationDays:     totalDays,
      percentComplete:  0,
      status:           'not_started',
      isMilestone:      false,
      weight:           100,
      networkType,
    })

    // ── Level 1: frentes/comunidades
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
        id:               frontId,
        wbsCode:          `1.${idx + 1}`,
        name:             frontName || `Frente ${idx + 1}`,
        parentId:         rootId,
        level:            1,
        plannedStart:     frontStartStr,
        plannedEnd:       frontEndStr,
        trendStart:       frontStartStr,
        trendEnd:         frontEndStr,
        durationDays:     daysPerFront,
        percentComplete:  0,
        status:           'not_started',
        isMilestone:      false,
        weight:           weightPerFront,
        networkType,
      })

      // ── Level 2 (opcional): Principais Serviços
      if (includeServices) {
        newActivities.push({
          id:               crypto.randomUUID(),
          wbsCode:          `1.${idx + 1}.1`,
          name:             'Principais Serviços',
          parentId:         frontId,
          level:            2,
          plannedStart:     frontStartStr,
          plannedEnd:       frontEndStr,
          trendStart:       frontStartStr,
          trendEnd:         frontEndStr,
          durationDays:     daysPerFront,
          percentComplete:  0,
          status:           'not_started',
          isMilestone:      false,
          weight:           weightPerFront,
          networkType,
        })
      }
    })

    set({
      activities:        newActivities,
      baselines:         [],
      activeBaselineId:  null,
      derivedActivities: [],
      whatIfAdjustments: [],
      originalSCurve:    [],
      simulatedSCurve:   [],
      programacaoSemanal: {},
    })
  },

  saveBaseline: (name) =>
    set((s) => ({
      baselines: [
        ...s.baselines,
        {
          id: crypto.randomUUID(),
          name,
          createdAt: new Date().toISOString(),
          activities: structuredClone(s.activities),
        },
      ],
    })),

  loadBaseline: (id) =>
    set((s) => {
      const bl = s.baselines.find((b) => b.id === id)
      if (!bl) return {}
      return {
        activities: structuredClone(bl.activities),
        activeBaselineId: id,
      }
    }),

  removeBaseline: (id) =>
    set((s) => ({
      baselines: s.baselines.filter((b) => b.id !== id),
      activeBaselineId: s.activeBaselineId === id ? null : s.activeBaselineId,
    })),

  setLookaheadWeeks: (weeks) => set({ lookaheadWeeks: weeks }),

  updateDerivedActivity: (id, patch) =>
    set((s) => ({
      derivedActivities: s.derivedActivities.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),

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
    set((s) => ({
      whatIfAdjustments: s.whatIfAdjustments.filter((a) => a.activityId !== activityId),
    })),

  clearWhatIfAdjustments: () => set({ whatIfAdjustments: [], simulatedSCurve: [] }),

  setProgramacaoDiaria: (activityId, date, data) =>
    set((s) => ({
      programacaoSemanal: {
        ...s.programacaoSemanal,
        [activityId]: {
          ...(s.programacaoSemanal[activityId] ?? {}),
          [date]: data,
        },
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

    // Extend original to match simulated length if needed
    const extOriginal = farEnd > end
      ? computeMasterSCurve(activities, start, farEnd)
      : original

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
      activities: [],
      baselines: [],
      activeBaselineId: null,
      derivedActivities: [],
      whatIfAdjustments: [],
      originalSCurve: [],
      simulatedSCurve: [],
      programacaoSemanal: {},
    }),
}))
