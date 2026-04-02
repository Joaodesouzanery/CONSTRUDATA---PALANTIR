/**
 * evmStore.ts — Zustand store for EVM (Earned Value Management) module.
 */
import { create } from 'zustand'
import type {
  EvmTab, WorkPackage, CostAccountEntry, WeightedMeasurement,
  EvmMetrics, SCurveMultiPoint,
} from '@/types'

interface EvmState {
  activeTab: EvmTab
  workPackages: WorkPackage[]
  costAccounts: CostAccountEntry[]
  measurements: WeightedMeasurement[]
  evmMetrics: EvmMetrics
  sCurveData: SCurveMultiPoint[]

  setActiveTab: (tab: EvmTab) => void

  // Work Package CRUD
  addWorkPackage: (wp: Omit<WorkPackage, 'id' | 'createdAt'>) => void
  updateWorkPackage: (id: string, patch: Partial<WorkPackage>) => void
  removeWorkPackage: (id: string) => void

  // Cost Account CRUD
  addCostAccount: (entry: Omit<CostAccountEntry, 'id' | 'totalCostBRL'>) => void
  updateCostAccount: (id: string, patch: Partial<CostAccountEntry>) => void
  removeCostAccount: (id: string) => void

  // Measurement CRUD
  addMeasurement: (m: Omit<WeightedMeasurement, 'id' | 'compositeScore'>) => void
  updateMeasurement: (id: string, patch: Partial<WeightedMeasurement>) => void
  removeMeasurement: (id: string) => void

  // Recalculate
  recalculateMetrics: () => void

  // Data management
  loadDemoData: () => void
  clearData: () => void
}

const EMPTY_METRICS: EvmMetrics = {
  BAC: 0, PV: 0, EV: 0, AC: 0,
  CPI: 0, SPI: 0, CV: 0, SV: 0,
  EAC: 0, ETC: 0, VAC: 0, TCPI: 0,
}

function computeCompositeScore(m: Omit<WeightedMeasurement, 'id' | 'compositeScore'>): number {
  return (
    m.financialWeight * 0.3 +
    m.durationWeight * 0.25 +
    m.economicWeight * 0.3 +
    m.specificWeight * 0.15
  )
}

export const useEvmStore = create<EvmState>((set, get) => ({
  activeTab: 'dashboard',
  workPackages: [],
  costAccounts: [],
  measurements: [],
  evmMetrics: { ...EMPTY_METRICS },
  sCurveData: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Work Package CRUD ──────────────────────────────────────────────

  addWorkPackage: (wp) =>
    set((s) => ({
      workPackages: [
        ...s.workPackages,
        { ...wp, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ],
    })),

  updateWorkPackage: (id, patch) =>
    set((s) => ({
      workPackages: s.workPackages.map((wp) => (wp.id === id ? { ...wp, ...patch } : wp)),
    })),

  removeWorkPackage: (id) =>
    set((s) => ({
      workPackages: s.workPackages.filter((wp) => wp.id !== id),
    })),

  // ── Cost Account CRUD ──────────────────────────────────────────────

  addCostAccount: (entry) =>
    set((s) => ({
      costAccounts: [
        ...s.costAccounts,
        {
          ...entry,
          id: crypto.randomUUID(),
          totalCostBRL: entry.unitCostBRL * entry.quantity,
        },
      ],
    })),

  updateCostAccount: (id, patch) =>
    set((s) => ({
      costAccounts: s.costAccounts.map((ca) => {
        if (ca.id !== id) return ca
        const updated = { ...ca, ...patch }
        updated.totalCostBRL = updated.unitCostBRL * updated.quantity
        return updated
      }),
    })),

  removeCostAccount: (id) =>
    set((s) => ({
      costAccounts: s.costAccounts.filter((ca) => ca.id !== id),
    })),

  // ── Measurement CRUD ───────────────────────────────────────────────

  addMeasurement: (m) =>
    set((s) => ({
      measurements: [
        ...s.measurements,
        { ...m, id: crypto.randomUUID(), compositeScore: computeCompositeScore(m) },
      ],
    })),

  updateMeasurement: (id, patch) =>
    set((s) => ({
      measurements: s.measurements.map((m) => {
        if (m.id !== id) return m
        const updated = { ...m, ...patch }
        updated.compositeScore = computeCompositeScore(updated)
        return updated
      }),
    })),

  removeMeasurement: (id) =>
    set((s) => ({
      measurements: s.measurements.filter((m) => m.id !== id),
    })),

  // ── Recalculate ────────────────────────────────────────────────────

  recalculateMetrics: () => {
    const { costAccounts, evmMetrics } = get()

    const BAC = costAccounts.reduce((sum, ca) => sum + ca.totalCostBRL, 0)

    if (BAC === 0) {
      set({ evmMetrics: { ...EMPTY_METRICS } })
      return
    }

    // Scale PV/EV/AC proportionally to the new BAC
    const oldBAC = evmMetrics.BAC || 1
    const scale = BAC / oldBAC
    const PV = evmMetrics.PV * scale
    const EV = evmMetrics.EV * scale
    const AC = evmMetrics.AC * scale

    const CPI = AC !== 0 ? EV / AC : 0
    const SPI = PV !== 0 ? EV / PV : 0
    const CV = EV - AC
    const SV = EV - PV
    const EAC = CPI !== 0 ? BAC / CPI : 0
    const ETC = EAC - AC
    const VAC = BAC - EAC
    const TCPI = (BAC - AC) !== 0 ? (BAC - EV) / (BAC - AC) : 0

    set({
      evmMetrics: { BAC, PV, EV, AC, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI },
    })
  },

  // ── Data management ────────────────────────────────────────────────

  loadDemoData: () => {
    import('@/data/mockEvm').then((m) => {
      set({
        workPackages: structuredClone(m.MOCK_WORK_PACKAGES),
        costAccounts: structuredClone(m.MOCK_COST_ACCOUNTS),
        measurements: structuredClone(m.MOCK_MEASUREMENTS),
        evmMetrics: structuredClone(m.MOCK_EVM_METRICS),
        sCurveData: structuredClone(m.MOCK_SCURVE_DATA),
      })
    })
  },

  clearData: () =>
    set({
      workPackages: [],
      costAccounts: [],
      measurements: [],
      evmMetrics: { ...EMPTY_METRICS },
      sCurveData: [],
    }),
}))
