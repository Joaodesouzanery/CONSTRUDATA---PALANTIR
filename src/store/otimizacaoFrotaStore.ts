import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type {
  RoutingRecommendation,
  PredictiveHealth,
  BuyLeaseAnalysis,
  RoutingPriority,
  HealthRisk,
} from '@/types'

// ─── Mappers (Sprint 5) ───────────────────────────────────────────────────────
function routingToRow(r: RoutingRecommendation, orgId: string, userId: string) {
  return {
    id:              r.id,
    organization_id: orgId,
    equipment_id:    r.equipmentId,
    priority:        r.priority,
    accepted:        r.accepted ?? null,
    payload:         r as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function healthToRow(h: PredictiveHealth, orgId: string, userId: string) {
  return {
    id:              crypto.randomUUID(),  // PredictiveHealth não tem id próprio; gera no envio
    organization_id: orgId,
    equipment_id:    h.equipmentId,
    risk_level:      h.riskLevel,
    health_score:    h.healthScore,
    payload:         h as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function buyLeaseToRow(b: BuyLeaseAnalysis, orgId: string, userId: string) {
  return {
    id:              b.id,
    organization_id: orgId,
    equipment_type:  b.equipmentType,
    recommendation:  b.recommendation,
    payload:         b as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}
import {
  mockRoutingRecs,
  mockHealthScores,
  mockBuyLeaseAnalyses,
} from '@/data/mockOtimizacaoFrota'

// ─── Haversine distance ────────────────────────────────────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) ** 2
  return parseFloat((R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1))
}

// ─── Health score engine ───────────────────────────────────────────────────────

export function computeHealthScore(
  lastMaintenanceDate: string,
  nextMaintenanceDate: string | null | undefined,
  criticalAlerts: number,
  warningAlerts: number,
  yearManufactured: number,
): number {
  let score = 100

  const now = Date.now()
  const daysSinceLastMaint = (now - new Date(lastMaintenanceDate).getTime()) / 86_400_000
  score -= Math.min(30, daysSinceLastMaint / 3)

  if (nextMaintenanceDate) {
    const daysOverdue = (now - new Date(nextMaintenanceDate).getTime()) / 86_400_000
    if (daysOverdue > 0) score -= Math.min(25, daysOverdue * 2)
  }

  score -= criticalAlerts * 20
  score -= warningAlerts * 10

  const age = new Date().getFullYear() - yearManufactured
  score -= Math.min(16, age * 1.6)

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function healthRiskFromScore(score: number): HealthRisk {
  if (score < 30) return 'critical'
  if (score < 50) return 'high'
  if (score < 70) return 'medium'
  return 'low'
}

export function failureWindowFromScore(score: number): string {
  if (score < 30) return '7–15 dias'
  if (score < 50) return '15–30 dias'
  if (score < 70) return '30–60 dias'
  return '60+ dias'
}

// ─── Buy vs Lease engine ───────────────────────────────────────────────────────

export function computeBreakEven(
  purchasePrice: number,
  annualRentalCost: number,
  annualMaintenanceCost: number,
): number {
  const monthlySaving = (annualRentalCost - annualMaintenanceCost) / 12
  if (monthlySaving <= 0) return 999
  return Math.round(purchasePrice / monthlySaving)
}

// ─── State ─────────────────────────────────────────────────────────────────────

interface OtimizacaoFrotaState {
  routingRecs:      RoutingRecommendation[]
  healthScores:     PredictiveHealth[]
  buyLeaseAnalyses: BuyLeaseAnalysis[]

  // Routing
  runRoutingEngine:  () => void
  acceptRouting:     (id: string) => void
  dismissRouting:    (id: string) => void

  // Health
  runHealthEngine:   () => void
  addHealthScore:    (data: { name: string; code: string; lastMaint: string; nextMaint?: string; year: number; criticalAlerts: number; warningAlerts: number; repairCost: number }) => void
  deleteHealthScore: (equipmentId: string) => void

  // Buy vs Lease
  runBuyLeaseEngine:    () => void
  addBuyLeaseAnalysis:    (data: Omit<BuyLeaseAnalysis, 'id'>) => void
  updateBuyLeaseAnalysis: (id: string, data: Partial<BuyLeaseAnalysis>) => void
  deleteBuyLeaseAnalysis: (id: string) => void

  // Demo / clear
  loadDemoData: () => void
  clearData:    () => void

  // Sync (Sprint 5)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useOtimizacaoFrotaStore = create<OtimizacaoFrotaState>()(
  persist(
    (set, get) => ({
  routingRecs:      [],
  healthScores:     [],
  buyLeaseAnalyses: [],

  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  // ── Routing ─────────────────────────────────────────────────────────────────

  runRoutingEngine: () => {
    // Lazily import stores to avoid circular deps
    import('./equipamentosStore').then(({ useEquipamentosStore }) => {
      import('./torreDeControleStore').then(({ useTorreStore }) => {
        const equipment = useEquipamentosStore.getState().equipamentos
        const sites     = useTorreStore.getState().sites

        const idleEquip = equipment.filter(
          (e) => e.status === 'idle' && e.lat !== null && e.lng !== null
        )
        const activeSites = sites.filter(
          (s) => s.status === 'active' && s.lat !== null && s.lng !== null
        )

        if (idleEquip.length === 0 || activeSites.length === 0) return

        const generated: RoutingRecommendation[] = []
        const usedEquipIds = new Set<string>()

        for (const eq of idleEquip) {
          if (usedEquipIds.has(eq.id)) continue

          // Find nearest active site that is different from current site
          let bestSite = activeSites
            .filter((s) => s.name !== eq.siteName)
            .sort((a, b) =>
              haversineKm(eq.lat!, eq.lng!, a.lat!, a.lng!) -
              haversineKm(eq.lat!, eq.lng!, b.lat!, b.lng!)
            )[0]

          if (!bestSite) continue

          const distKm = haversineKm(eq.lat!, eq.lng!, bestSite.lat!, bestSite.lng!)
          if (distKm > 100) continue  // too far — skip

          // Estimate utilisation gain: idle equipment loses ~5% util per idle day, capped 20-65%
          const gainPct = Math.min(65, Math.max(20, Math.round(distKm < 10 ? 55 : distKm < 30 ? 38 : 24)))

          const priority: RoutingPriority =
            gainPct >= 50 ? 'critical' :
            gainPct >= 35 ? 'high' :
            'medium'

          const suggestedDate = new Date()
          suggestedDate.setDate(suggestedDate.getDate() + (priority === 'critical' ? 3 : priority === 'high' ? 7 : 21))

          const existing = get().routingRecs.find(
            (r) => r.equipmentId === eq.id && (r.accepted === true || r.accepted === false)
          )
          if (existing) continue

          generated.push({
            id:                 `rr-gen-${eq.id}-${bestSite.id}`,
            equipmentId:        eq.id,
            equipmentCode:      eq.code,
            equipmentName:      eq.name,
            equipmentType:      eq.type,
            fromSiteId:         eq.siteName ?? 'unknown',
            fromSiteName:       eq.siteName ?? 'Localização atual',
            fromLat:            eq.lat,
            fromLng:            eq.lng,
            toSiteId:           bestSite.id,
            toSiteName:         bestSite.name,
            toLat:              bestSite.lat,
            toLng:              bestSite.lng,
            reason:             `${eq.name} está ocioso em "${eq.siteName ?? 'sem obra definida'}". ${bestSite.name} é o canteiro ativo mais próximo (${distKm}km) com alta demanda de mão mecânica.`,
            utilizationGainPct: gainPct,
            estimatedDistanceKm: distKm,
            suggestedDate:      suggestedDate.toISOString().slice(0, 10),
            priority,
            accepted:           undefined,
          })

          usedEquipIds.add(eq.id)
        }

        const acted = get().routingRecs.filter(
          (r) => r.accepted === true || r.accepted === false
        )
        set({ routingRecs: [...acted, ...generated] })
      })
    })
  },

  acceptRouting: (id) => {
    set((s) => ({ routingRecs: s.routingRecs.map((r) => (r.id === id ? { ...r, accepted: true } : r)) }))
    const target = get().routingRecs.find((r) => r.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = routingToRow(target, orgId, userId)
      const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'otrr', type: 'update', recordId: id, patch, table: 'otimizacao_routing_recommendations' })] }))
      void get().flush()
    }
  },

  dismissRouting: (id) => {
    set((s) => ({ routingRecs: s.routingRecs.map((r) => (r.id === id ? { ...r, accepted: false } : r)) }))
    const target = get().routingRecs.find((r) => r.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = routingToRow(target, orgId, userId)
      const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'otrr', type: 'update', recordId: id, patch, table: 'otimizacao_routing_recommendations' })] }))
      void get().flush()
    }
  },

  // ── Health ───────────────────────────────────────────────────────────────────

  runHealthEngine: () => {
    import('./equipamentosStore').then(({ useEquipamentosStore }) => {
      import('./gestaoEquipamentosStore').then(({ useGestaoEquipamentosStore }) => {
        const equipment = useEquipamentosStore.getState().equipamentos
        const orders    = useGestaoEquipamentosStore.getState().orders

        const scores: PredictiveHealth[] = equipment.map((eq) => {
          const completedOrders = orders
            .filter((o) => o.equipmentId === eq.id && o.status === 'completed')
            .sort((a, b) => (b.completedDate ?? '').localeCompare(a.completedDate ?? ''))

          const lastMaintDate = completedOrders[0]?.completedDate ?? eq.lastMaintenance

          const criticalAlerts = eq.alerts.filter((a) => !a.acknowledged && a.severity === 'critical').length
          const warningAlerts  = eq.alerts.filter((a) => !a.acknowledged && a.severity === 'warning').length

          const score = computeHealthScore(
            lastMaintDate,
            eq.nextMaintenance,
            criticalAlerts,
            warningAlerts,
            eq.year,
          )

          const riskLevel = healthRiskFromScore(score)

          const factors: string[] = []
          const daysSinceMaint = Math.round((Date.now() - new Date(lastMaintDate).getTime()) / 86_400_000)
          factors.push(`Última manutenção: ${daysSinceMaint} dias atrás`)
          if (eq.nextMaintenance) {
            const daysOverdue = Math.round((Date.now() - new Date(eq.nextMaintenance).getTime()) / 86_400_000)
            if (daysOverdue > 0) factors.push(`Manutenção vencida há ${daysOverdue} dias`)
          }
          if (criticalAlerts > 0) factors.push(`${criticalAlerts} alerta(s) crítico(s) ativo(s)`)
          if (warningAlerts > 0)  factors.push(`${warningAlerts} alerta(s) de aviso ativo(s)`)
          const age = new Date().getFullYear() - eq.year
          factors.push(`${age} anos de uso`)

          const recMap: Record<HealthRisk, string> = {
            critical: 'PARAR OPERAÇÃO — executar revisão completa imediata',
            high:     'Agendar manutenção corretiva com urgência nos próximos 7 dias',
            medium:   'Inspecionar pontos críticos na próxima semana',
            low:      'Manutenção preventiva no próximo ciclo programado',
          }

          return {
            equipmentId:            eq.id,
            equipmentCode:          eq.code,
            equipmentName:          eq.name,
            healthScore:            score,
            riskLevel,
            predictedFailureWindow: failureWindowFromScore(score),
            mainFactors:            factors,
            recommendedAction:      recMap[riskLevel],
            estimatedDowntimeDays:  riskLevel === 'critical' ? 15 : riskLevel === 'high' ? 8 : riskLevel === 'medium' ? 3 : 1,
            estimatedRepairCostBRL: riskLevel === 'critical' ? 40000 : riskLevel === 'high' ? 18000 : riskLevel === 'medium' ? 7000 : 2500,
          }
        })

        set({ healthScores: scores })
      })
    })
  },

  // ── Health CRUD ──────────────────────────────────────────────────────────────

  addHealthScore: (data) => {
    const score = computeHealthScore(data.lastMaint, data.nextMaint, data.criticalAlerts, data.warningAlerts, data.year)
    const riskLevel = healthRiskFromScore(score)
    const h: PredictiveHealth = {
      equipmentId:            crypto.randomUUID(),
      equipmentCode:          data.code,
      equipmentName:          data.name,
      healthScore:            score,
      riskLevel,
      predictedFailureWindow: failureWindowFromScore(score),
      mainFactors:            [`${new Date().getFullYear() - data.year} anos de uso`, `${data.criticalAlerts} alertas críticos`, `${data.warningAlerts} alertas de aviso`],
      recommendedAction:      ({ critical: 'PARAR — revisão imediata', high: 'Manutenção urgente em 7 dias', medium: 'Inspeção na próxima semana', low: 'Preventiva no próximo ciclo' } as Record<HealthRisk, string>)[riskLevel],
      estimatedDowntimeDays:  ({ critical: 15, high: 8, medium: 3, low: 1 } as Record<HealthRisk, number>)[riskLevel],
      estimatedRepairCostBRL: data.repairCost,
    }
    set((s) => ({ healthScores: [...s.healthScores, h] }))
  },

  deleteHealthScore: (equipmentId) => {
    set((s) => ({ healthScores: s.healthScores.filter((h) => h.equipmentId !== equipmentId) }))
    set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'oths', type: 'delete', recordId: equipmentId, table: 'otimizacao_health_scores', approvalActionType: 'delete_otimizacao_health' })] }))
    void get().flush()
  },

  // ── Buy vs Lease ─────────────────────────────────────────────────────────────

  runBuyLeaseEngine: () => {
    import('./projetosStore').then(({ useProjetosStore }) => {
      const projects = useProjetosStore.getState().projects

      // Aggregate equipment budget lines across all projects to estimate demand
      const equipBudget = projects.reduce((sum, p) => {
        const line = p.budgetLines.find((b) => b.type === 'equipment')
        return sum + (line?.projected ?? 0)
      }, 0)

      // Scale projectedUsageDays proportionally to total equipment budget
      // (deterministic: just multiply existing analyses by a scaling factor)
      const scaleFactor = equipBudget > 0 ? Math.min(1.5, equipBudget / 2_000_000) : 1

      const updated = get().buyLeaseAnalyses.map((bl) => {
        const projDays = Math.round(bl.projectedUsageDays * scaleFactor)
        const annualRent = bl.monthlyRentalCostBRL * 12
        const annualOwn  = Math.round(
          (bl.purchasePriceBRL - bl.residualValueBRL) / 120 * 12 +
          bl.annualMaintenanceCostBRL
        )
        const breakEven = computeBreakEven(bl.purchasePriceBRL, annualRent, bl.annualMaintenanceCostBRL)
        const rec: import('@/types').BuyLeaseRec =
          projDays >= 180 ? 'buy' : projDays <= 60 ? 'lease' : 'neutral'

        return {
          ...bl,
          projectedUsageDays:     projDays,
          annualRentalCostBRL:    annualRent,
          annualOwnershipCostBRL: annualOwn,
          breakEvenMonths:        breakEven,
          recommendation:         rec,
        }
      })

      set({ buyLeaseAnalyses: updated })
    })
  },

  // ── Buy vs Lease CRUD ────────────────────────────────────────────────────────

  addBuyLeaseAnalysis: (data) => {
    const newAnalysis: BuyLeaseAnalysis = {
      ...data,
      id: crypto.randomUUID(),
      annualRentalCostBRL: data.monthlyRentalCostBRL * 12,
      annualOwnershipCostBRL: Math.round((data.purchasePriceBRL - data.residualValueBRL) / 120 * 12 + data.annualMaintenanceCostBRL),
      breakEvenMonths: computeBreakEven(data.purchasePriceBRL, data.monthlyRentalCostBRL * 12, data.annualMaintenanceCostBRL),
      recommendation: data.projectedUsageDays >= 180 ? 'buy' : data.projectedUsageDays <= 60 ? 'lease' : 'neutral',
      reasoning: `Análise baseada em ${data.projectedUsageDays} dias projetados de uso.`,
    }
    set((s) => ({ buyLeaseAnalyses: [...s.buyLeaseAnalyses, newAnalysis] }))
  },

  updateBuyLeaseAnalysis: (id, data) =>
    set((s) => ({
      buyLeaseAnalyses: s.buyLeaseAnalyses.map((a) => {
        if (a.id !== id) return a
        const updated = { ...a, ...data }
        const annualRent = updated.monthlyRentalCostBRL * 12
        const annualOwn = Math.round((updated.purchasePriceBRL - updated.residualValueBRL) / 120 * 12 + updated.annualMaintenanceCostBRL)
        return {
          ...updated,
          annualRentalCostBRL: annualRent,
          annualOwnershipCostBRL: annualOwn,
          breakEvenMonths: computeBreakEven(updated.purchasePriceBRL, annualRent, updated.annualMaintenanceCostBRL),
          recommendation: updated.projectedUsageDays >= 180 ? 'buy' : updated.projectedUsageDays <= 60 ? 'lease' : 'neutral',
        }
      }),
    })),

  deleteBuyLeaseAnalysis: (id) => {
    set((s) => ({ buyLeaseAnalyses: s.buyLeaseAnalyses.filter((a) => a.id !== id) }))
    set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'otbl', type: 'delete', recordId: id, table: 'otimizacao_buy_lease_analyses', approvalActionType: 'delete_otimizacao_buy_lease' })] }))
    void get().flush()
  },

  // ── Demo / Clear ─────────────────────────────────────────────────────────────

  loadDemoData: () =>
    set({
      routingRecs:      mockRoutingRecs,
      healthScores:     mockHealthScores,
      buyLeaseAnalyses: mockBuyLeaseAnalyses,
    }),

  clearData: () =>
    set({
      routingRecs:      [],
      healthScores:     [],
      buyLeaseAnalyses: [],
      pendingSync:      [],
      syncError:        null,
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
    const rr = await pullTable<{ payload: RoutingRecommendation }>('otimizacao_routing_recommendations')
    const hs = await pullTable<{ payload: PredictiveHealth }>('otimizacao_health_scores')
    const bl = await pullTable<{ payload: BuyLeaseAnalysis }>('otimizacao_buy_lease_analyses')
    if (rr) set({ routingRecs:      rr.map((r) => r.payload) })
    if (hs) set({ healthScores:     hs.map((r) => r.payload) })
    if (bl) set({ buyLeaseAnalyses: bl.map((r) => r.payload) })
    set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
  },
    }),
    {
      name: 'cdata-otimizacao-frota',
      partialize: (s) => ({
        routingRecs:      s.routingRecs,
        healthScores:     s.healthScores,
        buyLeaseAnalyses: s.buyLeaseAnalyses,
        pendingSync:      s.pendingSync,
        lastSyncedAt:     s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useOtimizacaoFrotaStore.getState().flush()
  })
}

// Mantém referência aos mappers de health/buyLease (poderão ser usados quando
// runRoutingEngine/runHealthEngine virarem persist após cada execução).
void healthToRow
void buyLeaseToRow

// ─── Derived helpers ──────────────────────────────────────────────────────────

export function calcFleetUtilizationRate(
  routingRecs: RoutingRecommendation[],
  totalEquipment: number,
): number {
  if (totalEquipment === 0) return 0
  const idleCount = routingRecs.filter((r) => r.accepted === undefined).length
  return Math.round(((totalEquipment - idleCount) / totalEquipment) * 100)
}

export function calcProjectedMonthlySavings(
  routingRecs: RoutingRecommendation[],
  buyLeaseAnalyses: BuyLeaseAnalysis[],
): number {
  // Routing: accepted relocations save avg R$4.800/month in avoided rentals
  const routingSavings = routingRecs
    .filter((r) => r.accepted === true)
    .length * 4800

  // Buy/Lease: accepted "buy" decisions save the delta, "lease" decisions save ownership cost
  const blSavings = buyLeaseAnalyses.reduce((sum, bl) => {
    if (bl.recommendation === 'buy') {
      return sum + Math.max(0, (bl.annualRentalCostBRL - bl.annualOwnershipCostBRL) / 12)
    }
    if (bl.recommendation === 'lease') {
      return sum + Math.max(0, (bl.annualOwnershipCostBRL - bl.annualRentalCostBRL) / 12)
    }
    return sum
  }, 0)

  return Math.round(routingSavings + blSavings)
}
