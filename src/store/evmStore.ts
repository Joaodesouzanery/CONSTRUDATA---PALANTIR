/**
 * evmStore.ts — Zustand store for EVM (Earned Value Management) module.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type {
  EvmTab, WorkPackage, CostAccountEntry, WeightedMeasurement,
  EvmMetrics, SCurveMultiPoint, CostPillar, CostBreakdown,
  EacScenarios, PillarDeviation, StockAlert,
} from '@/types'

// ─── Mappers ──────────────────────────────────────────────────────────────────
function workPackageToRow(wp: WorkPackage, orgId: string, userId: string) {
  return {
    id:               wp.id,
    organization_id:  orgId,
    project_id:       (wp as { projectId?: string }).projectId ?? null,
    code:             (wp as { code?: string }).code ?? null,
    name:             wp.name ?? null,
    total_budget_brl: (wp as { totalBudgetBRL?: number }).totalBudgetBRL ?? null,
    is_template:      (wp as { isTemplate?: boolean }).isTemplate ?? false,
    payload:          wp as unknown as Record<string, unknown>,
    created_by:       userId,
  }
}
function costAccountToRow(ca: CostAccountEntry, orgId: string, userId: string) {
  return {
    id:              ca.id,
    organization_id: orgId,
    work_package_id: (ca as { workPackageId?: string }).workPackageId ?? null,
    activity_id:     (ca as { activityId?: string }).activityId ?? null,
    pillar:          ca.pillar,
    total_cost_brl:  ca.totalCostBRL,
    payload:         ca as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function measurementToRow(m: WeightedMeasurement, orgId: string, userId: string) {
  return {
    id:              m.id,
    organization_id: orgId,
    work_package_id: (m as { workPackageId?: string }).workPackageId ?? null,
    activity_id:     (m as { activityId?: string }).activityId ?? null,
    composite_score: m.compositeScore,
    payload:         m as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

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

  // Sync (Sprint 6)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

const EMPTY_METRICS: EvmMetrics = {
  BAC: 0, PV: 0, EV: 0, AC: 0,
  CPI: 0, SPI: 0, CV: 0, SV: 0,
  EAC: 0, ETC: 0, VAC: 0, TCPI: 0,
  costBreakdown: { material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0 },
  eacScenarios: { optimistic: 0, trend: 0, pessimistic: 0 },
  pillarDeviations: [],
  stockAlerts: [],
  healthStatus: 'blue' as const,
}

const PILLAR_LABELS: Record<CostPillar, string> = {
  material: 'Material',
  equipamento: 'Equipamento',
  mao_de_obra: 'Mao de Obra',
  impostos_indiretos: 'Impostos Indiretos',
}

function computeCompositeScore(m: Omit<WeightedMeasurement, 'id' | 'compositeScore'>): number {
  return (
    m.financialWeight * 0.3 +
    m.durationWeight * 0.25 +
    m.economicWeight * 0.3 +
    m.specificWeight * 0.15
  )
}

export const useEvmStore = create<EvmState>()(
  persist(
    (set, get) => ({
  activeTab: 'dashboard',
  workPackages: [],
  costAccounts: [],
  measurements: [],
  evmMetrics: { ...EMPTY_METRICS },
  sCurveData: [],

  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Work Package CRUD ──────────────────────────────────────────────

  addWorkPackage: (wp) => {
    const id = crypto.randomUUID()
    const newWp: WorkPackage = { ...wp, id, createdAt: new Date().toISOString() }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      workPackages: [...s.workPackages, newWp],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_wp', type: 'insert', recordId: id, row: workPackageToRow(newWp, orgId, userId), table: 'evm_work_packages' })],
    }))
    void get().flush()
  },

  updateWorkPackage: (id, patch) => {
    set((s) => ({ workPackages: s.workPackages.map((wp) => (wp.id === id ? { ...wp, ...patch } : wp)) }))
    const target = get().workPackages.find((wp) => wp.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = workPackageToRow(target, orgId, userId)
      const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_wp', type: 'update', recordId: id, patch: updatePatch, table: 'evm_work_packages' })] }))
      void get().flush()
    }
  },

  removeWorkPackage: (id) => {
    set((s) => ({
      workPackages: s.workPackages.filter((wp) => wp.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_wp', type: 'delete', recordId: id, table: 'evm_work_packages', approvalActionType: 'delete_evm_work_package' })],
    }))
    void get().flush()
  },

  // ── Cost Account CRUD ──────────────────────────────────────────────

  addCostAccount: (entry) => {
    const id = crypto.randomUUID()
    const newCa: CostAccountEntry = { ...entry, id, totalCostBRL: entry.unitCostBRL * entry.quantity }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      costAccounts: [...s.costAccounts, newCa],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_ca', type: 'insert', recordId: id, row: costAccountToRow(newCa, orgId, userId), table: 'evm_cost_accounts' })],
    }))
    void get().flush()
  },

  updateCostAccount: (id, patch) => {
    set((s) => ({
      costAccounts: s.costAccounts.map((ca) => {
        if (ca.id !== id) return ca
        const updated = { ...ca, ...patch }
        updated.totalCostBRL = updated.unitCostBRL * updated.quantity
        return updated
      }),
    }))
    const target = get().costAccounts.find((ca) => ca.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = costAccountToRow(target, orgId, userId)
      const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_ca', type: 'update', recordId: id, patch: updatePatch, table: 'evm_cost_accounts' })] }))
      void get().flush()
    }
  },

  removeCostAccount: (id) => {
    set((s) => ({
      costAccounts: s.costAccounts.filter((ca) => ca.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_ca', type: 'delete', recordId: id, table: 'evm_cost_accounts', approvalActionType: 'delete_evm_cost_account' })],
    }))
    void get().flush()
  },

  // ── Measurement CRUD ───────────────────────────────────────────────

  addMeasurement: (m) => {
    const id = crypto.randomUUID()
    const newM: WeightedMeasurement = { ...m, id, compositeScore: computeCompositeScore(m) }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      measurements: [...s.measurements, newM],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_meas', type: 'insert', recordId: id, row: measurementToRow(newM, orgId, userId), table: 'evm_measurements' })],
    }))
    void get().flush()
  },

  updateMeasurement: (id, patch) => {
    set((s) => ({
      measurements: s.measurements.map((m) => {
        if (m.id !== id) return m
        const updated = { ...m, ...patch }
        updated.compositeScore = computeCompositeScore(updated)
        return updated
      }),
    }))
    const target = get().measurements.find((m) => m.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = measurementToRow(target, orgId, userId)
      const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_meas', type: 'update', recordId: id, patch: updatePatch, table: 'evm_measurements' })] }))
      void get().flush()
    }
  },

  removeMeasurement: (id) => {
    set((s) => ({
      measurements: s.measurements.filter((m) => m.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_meas', type: 'delete', recordId: id, table: 'evm_measurements', approvalActionType: 'delete_evm_measurement' })],
    }))
    void get().flush()
  },

  // ── Recalculate ────────────────────────────────────────────────────

  recalculateMetrics: () => {
    const { costAccounts, evmMetrics } = get()

    // Compute BAC from cost accounts
    const BAC = costAccounts.reduce((sum, ca) => sum + ca.totalCostBRL, 0)

    if (BAC === 0) {
      set({ evmMetrics: { ...EMPTY_METRICS } })
      return
    }

    // Compute AC broken down by pillar
    const pillars: CostPillar[] = ['material', 'equipamento', 'mao_de_obra', 'impostos_indiretos']
    const costBreakdown: CostBreakdown = { material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0 }

    for (const ca of costAccounts) {
      costBreakdown[ca.pillar] += ca.totalCostBRL
    }

    const AC = costBreakdown.material + costBreakdown.equipamento + costBreakdown.mao_de_obra + costBreakdown.impostos_indiretos

    // Scale PV/EV proportionally to the new BAC
    const oldBAC = evmMetrics.BAC || 1
    const scale = BAC / oldBAC
    const PV = evmMetrics.PV * scale
    const EV = evmMetrics.EV * scale

    // Core EVM indices
    const CPI = AC !== 0 ? EV / AC : 0
    const SPI = PV !== 0 ? EV / PV : 0
    const CV = EV - AC
    const SV = EV - PV
    const EAC = CPI !== 0 ? BAC / CPI : 0
    const ETC = EAC - AC
    const VAC = BAC - EAC
    const TCPI = (BAC - AC) !== 0 ? (BAC - EV) / (BAC - AC) : 0

    // Pillar deviations: for each pillar, compare budgeted vs actual
    const budgetedByPillar: Record<CostPillar, number> = { material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0 }
    for (const ca of costAccounts) {
      budgetedByPillar[ca.pillar] += ca.totalCostBRL
    }

    const totalDeviation = pillars.reduce((sum, p) => sum + Math.abs(costBreakdown[p] - budgetedByPillar[p]), 0)

    const pillarDeviations: PillarDeviation[] = pillars.map((p) => {
      const budgeted = budgetedByPillar[p]
      const actual = costBreakdown[p]
      const deviation = actual - budgeted
      const deviationPct = totalDeviation !== 0 ? Math.abs(deviation) / totalDeviation : 0
      return {
        pillar: p,
        label: PILLAR_LABELS[p],
        budgeted,
        actual,
        deviation,
        deviationPct,
      }
    })

    // EAC scenarios
    const eacScenarios: EacScenarios = {
      optimistic: BAC,
      trend: CPI !== 0 ? BAC / CPI : 0,
      pessimistic: CPI !== 0 ? (BAC / CPI) * 1.15 : 0,
    }

    // Health status
    let healthStatus: 'blue' | 'yellow' | 'red'
    if (CPI >= 1 && SPI >= 1) {
      healthStatus = 'blue'
    } else if (SPI < 1 && CPI >= 1) {
      healthStatus = 'yellow'
    } else {
      healthStatus = 'red'
    }

    // Stock alerts — lazy import from suprimentosStore
    import('./suprimentosStore').then(({ useSuprimentosStore }) => {
      const { estoqueItens } = useSuprimentosStore.getState()
      const stockAlerts: StockAlert[] = []

      for (const item of estoqueItens) {
        if (item.qtdDisponivel > item.estoqueMinimo * 2) {
          const qtdComprada = item.qtdDisponivel + item.qtdReservada
          const qtdInstalada = item.qtdReservada
          const qtdImobilizada = item.qtdDisponivel - item.estoqueMinimo
          const custoImobilizado = qtdImobilizada * (item.custoUnitario ?? 0)
          stockAlerts.push({
            itemId: item.id,
            description: item.descricao,
            qtdComprada,
            qtdInstalada,
            qtdImobilizada,
            custoImobilizado,
          })
        }
      }

      set({
        evmMetrics: {
          BAC, PV, EV, AC, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI,
          costBreakdown,
          eacScenarios,
          pillarDeviations,
          stockAlerts,
          healthStatus,
        },
      })
    }).catch(() => {
      // If suprimentos store is unavailable, set metrics without stock alerts
      set({
        evmMetrics: {
          BAC, PV, EV, AC, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI,
          costBreakdown,
          eacScenarios,
          pillarDeviations,
          stockAlerts: [],
          healthStatus,
        },
      })
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
      pendingSync: [],
      syncError: null,
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
    const wps  = await pullTable<{ payload: WorkPackage }>('evm_work_packages')
    const cas  = await pullTable<{ payload: CostAccountEntry }>('evm_cost_accounts')
    const ms   = await pullTable<{ payload: WeightedMeasurement }>('evm_measurements')
    if (wps) set({ workPackages: wps.map((r) => r.payload) })
    if (cas) set({ costAccounts: cas.map((r) => r.payload) })
    if (ms)  set({ measurements: ms.map((r) => r.payload) })
    set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
    // Recomputa metrics localmente após pull
    get().recalculateMetrics()
  },
    }),
    {
      name: 'cdata-evm',
      partialize: (s) => ({
        workPackages: s.workPackages,
        costAccounts: s.costAccounts,
        measurements: s.measurements,
        sCurveData:   s.sCurveData,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useEvmStore.getState().flush()
  })

  // Cross-module listeners (Sprint Ontologia Unificada)
  // Quando uma PO é fechada, o trigger SQL insere automaticamente um cost_account.
  // Re-pull aqui para refletir o novo AC no painel EVM.
  void import('@/lib/eventBus').then(({ eventBus }) => {
    eventBus.on('po.closed', () => {
      void useEvmStore.getState().pull().then(() => {
        useEvmStore.getState().recalculateMetrics()
      })
    })
    eventBus.on('realtime.row_changed', (e) => {
      if (e.table === 'evm_cost_accounts' || e.table === 'evm_work_packages') {
        void useEvmStore.getState().pull().then(() => {
          useEvmStore.getState().recalculateMetrics()
        })
      }
    })
  })
}
