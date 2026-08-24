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
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { getTenantMarker } from '@/lib/tenantCache'
import { attachBlobSync } from '@/lib/blobSync'
import { useActiveObraStore } from '@/store/activeObraStore'

// Sincroniza o slice local-only (contrato/núcleos/programação) via app_state.
let pullMestreBlob: (() => Promise<void>) | null = null
import type {
  PlanejamentoMestreTab, MasterActivity, MasterBaseline,
  LookaheadDerivedActivity, WhatIfAdjustment, ProgramacaoDiaria,
  PlanningContract, PlanningNucleus, PlanningAuditEntry,
} from '@/types'
import {
  computeMasterSCurve, applyWhatIfAdjustments, deriveLookahead,
  getProjectDateRange, type MasterSCurvePoint,
} from '@/features/planejamento-mestre/utils/masterEngine'
import { eventBus } from '@/lib/eventBus'

// Guarda anti-eco: quando o Mestre aplica mudanças vindas de um evento (Execução),
// não reemite master_activity.delayed, evitando loop de integração.
let suppressMasterEmit = false
function applyMasterFromEvent(fn: () => void) {
  suppressMasterEmit = true
  try { fn() } finally { suppressMasterEmit = false }
}

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

function calcTaktDays(startDate: string, endDate: string, nucleusCount: number) {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000))
  return Math.max(1, Math.round(days / Math.max(1, nucleusCount)))
}

function serviceToNetworkType(serviceType?: PlanningNucleus['serviceType']): MasterActivity['networkType'] {
  if (serviceType === 'agua' || serviceType === 'esgoto') return serviceType
  if (serviceType === 'drenagem' || serviceType === 'infraestrutura' || serviceType === 'edificacao') return 'civil'
  return 'geral'
}

function makeAudit(action: PlanningAuditEntry['action'], summary: string, payload?: Record<string, unknown>): PlanningAuditEntry {
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), action, summary, payload }
}

interface PlanejamentoMestreState {
  activeTab: PlanejamentoMestreTab
  activities: MasterActivity[]
  baselines: MasterBaseline[]
  activeBaselineId: string | null
  contract: PlanningContract | null
  nuclei: PlanningNucleus[]
  auditLog: PlanningAuditEntry[]
  lookaheadWeeks: number
  derivedActivities: LookaheadDerivedActivity[]
  whatIfAdjustments: WhatIfAdjustment[]
  originalSCurve: MasterSCurvePoint[]
  simulatedSCurve: MasterSCurvePoint[]
  programacaoSemanal: Record<string, Record<string, ProgramacaoDiaria>>

  setActiveTab: (tab: PlanejamentoMestreTab) => void

  addActivity: (activity: Omit<MasterActivity, 'id'>) => string
  updateActivity: (id: string, patch: Partial<MasterActivity>) => void
  removeActivity: (id: string) => void
  /** Carimba obraId nas atividades sem obra (legadas) — retorna quantas foram atualizadas. */
  backfillObraId: (obraId: string) => number

  createBlankProject: (input: {
    projectName: string
    networkType?: 'agua' | 'esgoto' | 'civil' | 'geral'
    startDate: string
    endDate:   string
    fronts:    string[]
    includeServices: boolean
  }) => void
  createGuidedPlan: (input: {
    contract: Omit<PlanningContract, 'theoreticalTaktDays'>
    nuclei: Array<Omit<PlanningNucleus, 'id' | 'budgetBRL'>>
    activities: Array<Omit<MasterActivity, 'id'>>
  }) => void
  addNucleus: (nucleus: Omit<PlanningNucleus, 'id' | 'budgetBRL'>) => void
  updateNucleus: (id: string, patch: Partial<PlanningNucleus>) => void

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

  // Tenant scope (isolamento por organização)
  activeOrgId: string | null
  ensureTenantScope: (organizationId: string) => void

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
        contract: null,
        nuclei: [],
        auditLog: [],
        lookaheadWeeks: 6,
        derivedActivities: [],
        whatIfAdjustments: [],
        originalSCurve: [],
        simulatedSCurve: [],
        programacaoSemanal: {},
        activeOrgId: null,

        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        setActiveTab: (tab) => set({ activeTab: tab }),

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

        addActivity: (activity) => {
          const id = crypto.randomUUID()
          // Carimba a obra ativa quando não veio no payload (Planejamento ↔ Torre).
          const obraId = activity.obraId ?? useActiveObraStore.getState().activeObraId ?? null
          const newActivity: MasterActivity = { ...activity, id, obraId }
          set((s) => ({ activities: [...s.activities, newActivity] }))
          const { orgId, userId } = ctx()
          enqueue(makeOp({ entity: 'master_activity', type: 'insert', recordId: id, row: masterActivityToRow(newActivity, orgId, userId), table: 'master_activities' }))
          void get().flush()
          return id
        },

        updateActivity: (id, patch) => {
          const prev = get().activities.find((a) => a.id === id)
          set((s) => ({ activities: s.activities.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
          const target = get().activities.find((a) => a.id === id)
          if (target) {
            const { orgId, userId } = ctx()
            const row = masterActivityToRow(target, orgId, userId)
            const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'master_activity', type: 'update', recordId: id, patch: updatePatch, table: 'master_activities' }))
            void get().flush()
            // Integração 2b: mover uma atividade ligada à Execução reflete no plano de origem.
            if (!suppressMasterEmit && target.sourceExecucaoId && prev
              && (prev.plannedStart !== target.plannedStart || prev.plannedEnd !== target.plannedEnd)) {
              const delayDays = Math.round((new Date(`${target.plannedStart}T00:00:00`).getTime() - new Date(`${prev.plannedStart}T00:00:00`).getTime()) / 86400000)
              eventBus.emit({ type: 'master_activity.delayed', activityId: id, projectId: null, delayDays })
            }
          }
        },

        removeActivity: (id) => {
          set((s) => ({ activities: s.activities.filter((a) => a.id !== id) }))
          // Era `type: 'delete'` com `approvalActionType`: o RPC `request_action` apenas cria um
          // pedido em `pending_actions` e não apaga a linha. A atividade voltava no pull seguinte,
          // reaparecendo na WBS do cronograma mestre e puxando de novo o lookahead derivado dela.
          // Com uma conta só para a empresa não existe segundo aprovador (o RPC de aprovação
          // proíbe quem pediu), então o pedido ficava parado para sempre. A RLS aceita o soft
          // delete direto (`master_activities_update_role`, os mesmos papéis do updateActivity).
          enqueue(makeOp({ entity: 'master_activity', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'master_activities' }))
          void get().flush()
        },

        backfillObraId: (obraId) => {
          const semObra = get().activities.filter((a) => !a.obraId)
          if (semObra.length === 0) return 0
          set((s) => ({ activities: s.activities.map((a) => (a.obraId ? a : { ...a, obraId })) }))
          const { orgId, userId } = ctx()
          for (const a of semObra) {
            const row = masterActivityToRow({ ...a, obraId }, orgId, userId)
            const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
            enqueue(makeOp({ entity: 'master_activity', type: 'update', recordId: a.id, patch: updatePatch, table: 'master_activities' }))
          }
          void get().flush()
          return semObra.length
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
            weight: 100, plannedProgressPct: 100, networkType: networkType ?? 'geral',
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
              isMilestone: false, weight: weightPerFront, plannedProgressPct: weightPerFront, networkType: networkType ?? 'geral',
            })
            if (includeServices) {
              newActivities.push({
                id: crypto.randomUUID(), wbsCode: `1.${idx + 1}.1`, name: 'Principais Serviços',
                parentId: frontId, level: 2,
                plannedStart: frontStartStr, plannedEnd: frontEndStr,
                trendStart: frontStartStr, trendEnd: frontEndStr,
                durationDays: daysPerFront, percentComplete: 0, status: 'not_started',
                isMilestone: false, weight: weightPerFront, plannedProgressPct: weightPerFront, networkType: networkType ?? 'geral',
              })
            }
          })
          // Carimba a obra ativa em todas as atividades criadas pelo wizard.
          const obraIdBlank = useActiveObraStore.getState().activeObraId ?? null
          newActivities.forEach((a) => { a.obraId = obraIdBlank })
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

        createGuidedPlan: ({ contract: contractInput, nuclei: nucleusInput, activities: activityInput }) => {
          const contract: PlanningContract = {
            ...contractInput,
            theoreticalTaktDays: calcTaktDays(contractInput.startDate, contractInput.endDate, contractInput.nucleusCount),
          }
          const nuclei: PlanningNucleus[] = nucleusInput.map((n) => ({
            ...n,
            id: crypto.randomUUID(),
            budgetBRL: Math.round(contract.bacTotal * (n.bacWeightPct / 100)),
          }))
          const rootId = crypto.randomUUID()
          const root: MasterActivity = {
            id: rootId,
            wbsCode: '1',
            name: contract.contractName,
            parentId: null,
            level: 0,
            plannedStart: contract.startDate,
            plannedEnd: contract.endDate,
            trendStart: contract.startDate,
            trendEnd: contract.endDate,
            durationDays: Math.max(1, Math.ceil((new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) / 86_400_000)),
            percentComplete: 0,
            status: 'not_started',
            isMilestone: false,
            weight: 100,
            plannedProgressPct: 100,
            networkType: 'geral',
            baselineStart: contract.startDate,
            baselineEnd: contract.endDate,
          }
          const frontActivities = nuclei.map((n, idx): MasterActivity => ({
            id: crypto.randomUUID(),
            wbsCode: `1.${idx + 1}`,
            name: `${n.name} - ${n.serviceType}`,
            parentId: rootId,
            level: 1,
            plannedStart: contract.startDate,
            plannedEnd: contract.endDate,
            trendStart: contract.startDate,
            trendEnd: contract.endDate,
            durationDays: root.durationDays,
            percentComplete: 0,
            status: 'not_started',
            isMilestone: false,
            weight: n.bacWeightPct,
            plannedProgressPct: n.bacWeightPct,
            networkType: serviceToNetworkType(n.serviceType),
            nucleo: n.name,
            nucleusId: n.id,
            financialWeightPct: n.bacWeightPct,
            physicalProgressPct: 0,
            financialProgressPct: 0,
            estimatedHH: 0,
            equipmentDemand: { headcount: 8, retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 },
            baselineStart: contract.startDate,
            baselineEnd: contract.endDate,
          }))
          const byNucleus = new Map(nuclei.map((n) => [n.id, n]))
          const activities: MasterActivity[] = [
            root,
            ...frontActivities,
            ...activityInput.map((a, idx): MasterActivity => {
              const nucleusId = a.nucleusId ?? nuclei[idx % Math.max(1, nuclei.length)]?.id
              const nucleus = nucleusId ? byNucleus.get(nucleusId) : undefined
              const parent = frontActivities.find((f) => f.nucleusId === nucleusId) ?? frontActivities[0]
              const plannedStart = a.plannedStart || contract.startDate
              const plannedEnd = a.plannedEnd || contract.endDate
              return {
                ...a,
                id: crypto.randomUUID(),
                wbsCode: a.wbsCode || `${parent?.wbsCode ?? '1.1'}.${idx + 1}`,
                name: a.name || `Atividade ${idx + 1}`,
                parentId: a.parentId ?? parent?.id ?? rootId,
                level: a.level ?? 2,
                plannedStart,
                plannedEnd,
                trendStart: a.trendStart || plannedStart,
                trendEnd: a.trendEnd || plannedEnd,
                durationDays: a.durationDays || Math.max(1, Math.ceil((new Date(plannedEnd).getTime() - new Date(plannedStart).getTime()) / 86_400_000)),
                percentComplete: a.percentComplete ?? 0,
                status: a.status ?? 'not_started',
                isMilestone: a.isMilestone ?? false,
                networkType: a.networkType ?? serviceToNetworkType(nucleus?.serviceType),
                nucleo: a.nucleo ?? nucleus?.name,
                nucleusId,
                financialWeightPct: a.financialWeightPct ?? (activityInput.length > 0 ? 100 / activityInput.length : 0),
                plannedProgressPct: a.plannedProgressPct ?? a.financialWeightPct ?? (activityInput.length > 0 ? 100 / activityInput.length : 0),
                physicalProgressPct: a.physicalProgressPct ?? a.percentComplete ?? 0,
                financialProgressPct: a.financialProgressPct ?? a.percentComplete ?? 0,
                estimatedHH: a.estimatedHH ?? 40,
                equipmentDemand: a.equipmentDemand ?? { headcount: 6, retroescavadeira: 1, compactador: 1, caminhaoBasculante: 1 },
                baselineStart: plannedStart,
                baselineEnd: plannedEnd,
              }
            }),
          ]
          // Carimba a obra ativa em todas as atividades e frentes (núcleos) do plano guiado.
          const obraIdGuided = useActiveObraStore.getState().activeObraId ?? null
          activities.forEach((a) => { a.obraId = obraIdGuided })
          nuclei.forEach((n) => { n.obraId = obraIdGuided })
          const baseline: MasterBaseline = {
            id: crypto.randomUUID(),
            name: 'Rev.0',
            createdAt: new Date().toISOString(),
            activities: structuredClone(activities),
          }
          set({
            activeTab: 'macro',
            contract,
            nuclei,
            activities,
            baselines: [baseline],
            activeBaselineId: baseline.id,
            derivedActivities: deriveLookahead(activities, contract.startDate, 6),
            originalSCurve: computeMasterSCurve(activities, contract.startDate, contract.endDate),
            simulatedSCurve: [],
            auditLog: [
              makeAudit('wizard_generated', `Planejamento "${contract.contractName}" criado com ${nuclei.length} núcleo(s).`),
              makeAudit('baseline_created', 'Baseline Rev.0 criado automaticamente.'),
            ],
          })
          const { orgId, userId } = ctx()
          for (const a of activities) {
            enqueue(makeOp({ entity: 'master_activity', type: 'insert', recordId: a.id, row: masterActivityToRow(a, orgId, userId), table: 'master_activities' }))
          }
          enqueue(makeOp({ entity: 'master_baseline', type: 'insert', recordId: baseline.id, row: masterBaselineToRow(baseline, orgId, userId), table: 'master_baselines' }))
          void get().flush()
        },

        addNucleus: (nucleus) => {
          const contract = get().contract
          const bac = contract?.bacTotal ?? 0
          const newNucleus: PlanningNucleus = {
            ...nucleus,
            id: crypto.randomUUID(),
            budgetBRL: Math.round(bac * (nucleus.bacWeightPct / 100)),
            obraId: nucleus.obraId ?? useActiveObraStore.getState().activeObraId ?? null,
          }
          set((s) => ({
            nuclei: [...s.nuclei, newNucleus],
            contract: s.contract ? {
              ...s.contract,
              nucleusCount: s.nuclei.length + 1,
              theoreticalTaktDays: calcTaktDays(s.contract.startDate, s.contract.endDate, s.nuclei.length + 1),
            } : s.contract,
            auditLog: [...s.auditLog, makeAudit('nucleus_added', `Núcleo ${newNucleus.name} adicionado.`, { nucleusId: newNucleus.id })],
          }))
        },

        updateNucleus: (id, patch) => {
          set((s) => ({ nuclei: s.nuclei.map((n) => (n.id === id ? { ...n, ...patch } : n)) }))
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
          // Este é o único dos quatro casos de aprovação que era exclusão DE VERDADE. Vira soft
          // delete, como o resto do app. Depende da migração 20260824130000: hoje
          // `master_baselines` tem UPDATE bloqueado (`USING (false)`, 0020:293) porque a linha de
          // base foi modelada como imutável — e com isso apagar só era possível pelo RPC de
          // aprovação, que ninguém consegue aprovar. A migração permite exatamente um update:
          // preencher `deleted_at`. O conteúdo da linha de base segue imutável.
          enqueue(makeOp({ entity: 'master_baseline', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'master_baselines' }))
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
          const { activities, lookaheadWeeks, derivedActivities: prev } = get()
          const today = new Date().toISOString().slice(0, 10)
          const derived = deriveLookahead(activities, today, lookaheadWeeks)
          // Preserva status/observações já editados no Médio Prazo ao re-derivar
          // (cascata automática não destrói o trabalho manual). Chave estável:
          // atividade-mestre + semana ISO.
          const prevByKey = new Map(prev.map((d) => [`${d.masterActivityId}__${d.weekIso}`, d]))
          const merged = derived.map((d) => {
            const old = prevByKey.get(`${d.masterActivityId}__${d.weekIso}`)
            return old ? { ...d, status: old.status, notes: old.notes, percentComplete: old.percentComplete } : d
          })
          set({ derivedActivities: merged })
          // Persistir o lookahead derivado (antes só ficava no localStorage). Id estável
          // `derived-<masterId>` → upsert idempotente; enfileira só o delta (novo/alterado).
          const prevById = new Map(prev.map((d) => [d.id, d]))
          const { orgId, userId } = ctx()
          let any = false
          for (const d of merged) {
            const old = prevById.get(d.id)
            if (old && JSON.stringify(old) === JSON.stringify(d)) continue
            any = true
            enqueue(makeOp({ entity: 'lookahead', type: 'insert', recordId: d.id, row: lookaheadToRow(d, orgId, userId), table: 'lookahead_derived_activities' }))
          }
          if (any) void get().flush()
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
              contract: null,
              nuclei: [],
              auditLog: [],
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
            contract: null, nuclei: [], auditLog: [],
            derivedActivities: [], whatIfAdjustments: [],
            originalSCurve: [], simulatedSCurve: [], programacaoSemanal: {},
            activeOrgId: null, pendingSync: [], syncError: null,
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
          set((s) => ({ activities: mergePull(acts?.map((r) => r.payload) ?? null, s.activities, s.pendingSync, 'master_activities') }))
          set((s) => ({ baselines: mergePull(bls?.map((r) => r.payload) ?? null, s.baselines, s.pendingSync, 'master_baselines') }))
          set((s) => ({ derivedActivities: mergePull(lds?.map((r) => r.payload) ?? null, s.derivedActivities, s.pendingSync, 'lookahead_derived_activities') }))
          if (pullMestreBlob) await pullMestreBlob()   // contrato/núcleos/programação (app_state)
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-planejamento-mestre',
      partialize: (s) => ({
        activeOrgId:       s.activeOrgId,
        activities:        s.activities,
        baselines:         s.baselines,
        activeBaselineId:  s.activeBaselineId,
        contract:          s.contract,
        nuclei:            s.nuclei,
        auditLog:          s.auditLog,
        lookaheadWeeks:    s.lookaheadWeeks,
        derivedActivities: s.derivedActivities,
        programacaoSemanal: s.programacaoSemanal,
        pendingSync:       s.pendingSync,
        lastSyncedAt:      s.lastSyncedAt,
      }),
    },
  ),
)

// Liga contrato/núcleos/programação (local-only) ao app_state (sincroniza por empresa).
pullMestreBlob = attachBlobSync(usePlanejamentoMestreStore, {
  key: 'planejamento-mestre-meta',
  getSlice: (s) => ({ contract: s.contract, nuclei: s.nuclei, programacaoSemanal: s.programacaoSemanal, auditLog: s.auditLog }),
  applySlice: (b) => usePlanejamentoMestreStore.setState(b as Partial<ReturnType<typeof usePlanejamentoMestreStore.getState>>),
}).pullInto

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void usePlanejamentoMestreStore.getState().flush()
  })

  // Tempo real cross-usuário: mudança do Mestre em outro navegador → re-pull.
  eventBus.on('realtime.row_changed', (e) => {
    if (e.table === 'master_activities' || e.table === 'lookahead_derived_activities') {
      void usePlanejamentoMestreStore.getState().pull()
    }
  })

  // Integração: um plano de Execução vira atividades no cronograma Mestre (uma por atividade).
  void import('@/lib/eventBus').then(({ eventBus }) => {
    eventBus.on('planning.activity_imported', (e) => {
      void import('@/store/planoExecucaoStore').then(({ usePlanoExecucaoStore }) => {
        const plano = usePlanoExecucaoStore.getState().planos.find((p) => p.id === e.activityId)
        if (!plano || !plano.atividades?.length || !plano.periodoInicio || !plano.periodoFim) return
        const dur = Math.max(1, Math.round((new Date(`${plano.periodoFim}T00:00:00`).getTime() - new Date(`${plano.periodoInicio}T00:00:00`).getTime()) / 86400000) + 1)
        const store = usePlanejamentoMestreStore.getState()
        let added = false
        applyMasterFromEvent(() => {
          for (const a of plano.atividades!) {
            const key = `${plano.id}:${a.id}`
            const match = usePlanejamentoMestreStore.getState().activities.find((m) => m.sourceExecucaoId === key)
            const fields = {
              wbsCode: 'EXE', name: a.nome || plano.servico || 'Serviço', parentId: null, level: 0,
              plannedStart: plano.periodoInicio, plannedEnd: plano.periodoFim,
              trendStart: plano.periodoInicio, trendEnd: plano.periodoFim,
              durationDays: dur, percentComplete: 0, status: 'not_started' as const, isMilestone: false,
              networkType: 'civil' as const, sourceExecucaoId: key, obraId: plano.siteId ?? null,
            }
            if (match) {
              if (match.name !== fields.name || match.plannedStart !== fields.plannedStart || match.plannedEnd !== fields.plannedEnd) store.updateActivity(match.id, fields)
            } else { store.addActivity(fields); added = true }
          }
        })
        if (added) usePlanejamentoMestreStore.getState().deriveFromMaster()
      })
    })
  })
}
