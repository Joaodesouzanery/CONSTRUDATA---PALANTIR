import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type {
  EconomyBaseline,
  EconomyEvent,
  EconomyReport,
  EconomyValuationRule,
  LpsActivity,
} from '@/types'
import { useEvmStore } from './evmStore'
import { useGestaoEquipamentosStore } from './gestaoEquipamentosStore'
import { useContractorStore } from './contractorStore'
import { useLpsStore } from './lpsStore'
import { useMedicaoUnificadaStore } from './medicaoUnificadaStore'
import { useRdoStore } from './rdoStore'
import { useSuprimentosStore } from './suprimentosStore'
import { generateAllSubempreiteiroMeasurements } from '@/features/medicao/utils/measurementGeneration'
import {
  defaultEconomyBaseline,
  defaultEconomyRules,
  generateEconomyEvents,
  monthPeriod,
  summarizeEconomy,
  todayIso,
} from '@/features/economia/utils/economiaEngine'

interface EconomiaState {
  baselines: EconomyBaseline[]
  events: EconomyEvent[]
  reports: EconomyReport[]
  rules: EconomyValuationRule[]
  selectedPeriod: string
  selectedProjectId: string | null
  lastScanAt: string | null

  pendingSync: PendingOp[]
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  syncError: string | null

  setSelectedPeriod: (period: string) => void
  setSelectedProject: (projectId: string | null) => void
  addBaseline: (baseline?: Partial<EconomyBaseline>) => EconomyBaseline
  updateBaseline: (id: string, patch: Partial<EconomyBaseline>) => void
  updateRule: (id: string, patch: Partial<EconomyValuationRule>) => void
  scanEvents: () => void
  addManualEvent: (event: Omit<EconomyEvent, 'id' | 'stableKey' | 'sourceModule' | 'sourceId' | 'createdAt' | 'updatedAt'>) => void
  updateEvent: (id: string, patch: Partial<EconomyEvent>) => void
  validateEvent: (id: string) => void
  dismissEvent: (id: string) => void
  generateMonthlyReport: (period?: string, projectId?: string | null) => EconomyReport
  markReportSent: (id: string) => void
  loadDemoData: () => void
  clearData: () => void
  flush: () => Promise<void>
  pull: () => Promise<void>
}

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

function baselineToRow(baseline: EconomyBaseline, orgId: string, userId: string) {
  return {
    id: baseline.id,
    organization_id: orgId,
    project_id: baseline.projectId,
    project_name: baseline.projectName,
    period: baseline.period,
    captured_at: baseline.capturedAt,
    ppc_percent: baseline.ppcPercent,
    material_deviation_percent: baseline.materialDeviationPercent,
    platform_monthly_fee_brl: baseline.platformMonthlyFeeBRL,
    payload: baseline as unknown as Record<string, unknown>,
    created_by: userId,
  }
}

function eventToRow(event: EconomyEvent, orgId: string, userId: string) {
  return {
    id: event.id,
    organization_id: orgId,
    project_id: event.projectId,
    project_name: event.projectName,
    period: event.period,
    source_module: event.sourceModule,
    source_id: event.sourceId,
    category: event.category,
    status: event.status,
    impact_brl: event.impactBRL,
    stable_key: event.stableKey,
    event_date: event.date,
    payload: event as unknown as Record<string, unknown>,
    created_by: userId,
  }
}

function reportToRow(report: EconomyReport, orgId: string, userId: string) {
  return {
    id: report.id,
    organization_id: orgId,
    project_id: report.projectId,
    project_name: report.projectName,
    period: report.period,
    baseline_id: report.baselineId,
    status: report.status,
    avoided_loss_brl: report.avoidedLossBRL,
    roi_percent: report.roiPercent,
    payload: report as unknown as Record<string, unknown>,
    created_by: userId,
  }
}

function ruleToRow(rule: EconomyValuationRule, orgId: string, userId: string) {
  return {
    id: rule.id,
    organization_id: orgId,
    category: rule.category,
    label: rule.label,
    formula: rule.formula,
    enabled: rule.enabled,
    payload: rule as unknown as Record<string, unknown>,
    created_by: userId,
  }
}

function enqueueUpdate(
  entity: string,
  table: string,
  recordId: string,
  row: Record<string, unknown>,
): PendingOp {
  const patch = Object.fromEntries(Object.entries(row).filter(([key]) => !['id', 'organization_id', 'created_by'].includes(key)))
  return makeOp({ entity, type: 'update', recordId, patch, table })
}

export const useEconomiaStore = create<EconomiaState>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((state) => ({ pendingSync: [...state.pendingSync, op] }))
      return {
        baselines: [],
        events: [],
        reports: [],
        rules: defaultEconomyRules(),
        selectedPeriod: monthPeriod(),
        selectedProjectId: null,
        lastScanAt: null,
        pendingSync: [],
        syncStatus: 'idle',
        lastSyncedAt: null,
        syncError: null,

        setSelectedPeriod: (period) => set({ selectedPeriod: period }),
        setSelectedProject: (projectId) => set({ selectedProjectId: projectId }),

        addBaseline: (patch = {}) => {
          const now = new Date().toISOString()
          const baseline: EconomyBaseline = {
            ...defaultEconomyBaseline(),
            ...patch,
            id: patch.id ?? crypto.randomUUID(),
            createdAt: patch.createdAt ?? now,
            updatedAt: now,
          }
          const { orgId, userId } = ctxAuth()
          set((state) => ({ baselines: [...state.baselines, baseline] }))
          enqueue(makeOp({ entity: 'economy_baseline', type: 'insert', recordId: baseline.id, row: baselineToRow(baseline, orgId, userId), table: 'economy_baselines' }))
          void get().flush()
          return baseline
        },

        updateBaseline: (id, patch) => {
          set((state) => ({
            baselines: state.baselines.map((baseline) => baseline.id === id ? { ...baseline, ...patch, updatedAt: new Date().toISOString() } : baseline),
          }))
          const target = get().baselines.find((baseline) => baseline.id === id)
          if (!target) return
          const { orgId, userId } = ctxAuth()
          enqueue(enqueueUpdate('economy_baseline', 'economy_baselines', id, baselineToRow(target, orgId, userId)))
          void get().flush()
        },

        updateRule: (id, patch) => {
          set((state) => ({
            rules: state.rules.map((rule) => rule.id === id ? { ...rule, ...patch, updatedAt: new Date().toISOString() } : rule),
          }))
          const target = get().rules.find((rule) => rule.id === id)
          if (!target) return
          const { orgId, userId } = ctxAuth()
          const existsInQueue = get().pendingSync.some((op) => op.recordId === id && op.table === 'economy_valuation_rules')
          enqueue(
            existsInQueue
              ? enqueueUpdate('economy_rule', 'economy_valuation_rules', id, ruleToRow(target, orgId, userId))
              : makeOp({ entity: 'economy_rule', type: 'insert', recordId: id, row: ruleToRow(target, orgId, userId), table: 'economy_valuation_rules' }),
          )
          void get().flush()
        },

        scanEvents: () => {
          const sups = useSuprimentosStore.getState()
          const lps = useLpsStore.getState()
          const rdo = useRdoStore.getState()
          const eq = useGestaoEquipamentosStore.getState()
          const evm = useEvmStore.getState()
          const medicao = useMedicaoUnificadaStore.getState()
          const contractors = useContractorStore.getState().contractors
          const current = get().events
          const baseline = get().baselines.length ? get().baselines : [defaultEconomyBaseline()]
          const activePeriod = medicao.periods.find((period) => period.id === medicao.activePeriodId) ?? medicao.periods[0] ?? null
          const activePeriodId = activePeriod?.id
          const periodSources = medicao.sources.filter((source) => !activePeriodId || !source.period_id || source.period_id === activePeriodId)
          const periodMemoryLines = medicao.memoryLines.filter((line) => !activePeriodId || !line.period_id || line.period_id === activePeriodId)
          const periodContractItems = medicao.contractItems.filter((item) => !activePeriodId || !item.period_id || item.period_id === activePeriodId)
          const periodFinancialEntries = medicao.financialEntries.filter((entry) => !activePeriodId || !entry.period_id || entry.period_id === activePeriodId)
          const generatedMeasurements = generateAllSubempreiteiroMeasurements({
            period: activePeriod,
            contractors,
            sources: periodSources,
            memoryLines: periodMemoryLines,
            contractItems: periodContractItems,
            financialEntries: periodFinancialEntries,
          })
          // Reusa o id do evento já existente com a MESMA stableKey (ver .map abaixo).
          const eventIdByStableKey = new Map(current.map((event) => [event.stableKey, event.id]))
          const generated = generateEconomyEvents({
            baselines: baseline,
            existingEvents: current,
            rules: get().rules,
            purchaseOrders: sups.purchaseOrders,
            matches: sups.matches,
            forecasts: sups.forecasts,
            estoqueItens: sups.estoqueItens,
            lpsActivities: lps.activities,
            lpsRestrictions: lps.restrictions,
            rdos: rdo.rdos,
            maintenanceOrders: eq.orders,
            generatedMeasurements,
            evmMetrics: evm.evmMetrics,
          }).map((event) => ({
            // Re-scan não gera id novo p/ stableKey existente → evita 23505 em
            // economy_events_stable_key_unique (que travava a fila). stableKey nova → id novo.
            ...event,
            id: eventIdByStableKey.get(event.stableKey) ?? event.id,
          }))
          const generatedKeys = new Set(generated.map((event) => event.stableKey))
          const manualEvents = current.filter((event) => event.sourceModule === 'manual' && !generatedKeys.has(event.stableKey))
          const newEvents = generated.filter((event) => !current.some((existing) => existing.id === event.id))
          const { orgId, userId } = ctxAuth()
          set({ events: [...generated, ...manualEvents], lastScanAt: new Date().toISOString() })
          if (newEvents.length) {
            set((state) => ({
              pendingSync: [
                ...state.pendingSync,
                ...newEvents.map((event) => makeOp({ entity: 'economy_event', type: 'insert', recordId: event.id, row: eventToRow(event, orgId, userId), table: 'economy_events' })),
              ],
            }))
            void get().flush()
          }
        },

        addManualEvent: (draft) => {
          const now = new Date().toISOString()
          const event: EconomyEvent = {
            ...draft,
            id: crypto.randomUUID(),
            stableKey: `manual:${crypto.randomUUID()}:${draft.category}:${draft.period}`,
            sourceModule: 'manual',
            sourceId: 'manual',
            createdAt: now,
            updatedAt: now,
          }
          const { orgId, userId } = ctxAuth()
          set((state) => ({ events: [event, ...state.events] }))
          enqueue(makeOp({ entity: 'economy_event', type: 'insert', recordId: event.id, row: eventToRow(event, orgId, userId), table: 'economy_events' }))
          void get().flush()
        },

        updateEvent: (id, patch) => {
          set((state) => ({
            events: state.events.map((event) => event.id === id ? { ...event, ...patch, updatedAt: new Date().toISOString() } : event),
          }))
          const target = get().events.find((event) => event.id === id)
          if (!target) return
          const { orgId, userId } = ctxAuth()
          enqueue(enqueueUpdate('economy_event', 'economy_events', id, eventToRow(target, orgId, userId)))
          void get().flush()
        },

        validateEvent: (id) => get().updateEvent(id, { status: 'validated', validatedAt: new Date().toISOString() }),
        dismissEvent: (id) => get().updateEvent(id, { status: 'dismissed' }),

        generateMonthlyReport: (period = get().selectedPeriod, projectId = get().selectedProjectId) => {
          const summary = summarizeEconomy(get().events, get().baselines, period, projectId ?? undefined)
          const baseline = summary.baseline
          const ppcAfter = latestPpc(useLpsStore.getState().activities) || Math.max(baseline?.ppcPercent ?? 0, 78)
          const materialAfter = baseline?.targetMaterialDeviationPercent ?? 3
          const report: EconomyReport = {
            id: crypto.randomUUID(),
            period,
            projectId: projectId ?? null,
            projectName: baseline?.projectName ?? 'Carteira de obras',
            baselineId: baseline?.id ?? null,
            eventIds: summary.events.map((event) => event.id),
            detectedEvents: summary.detectedEvents,
            avoidedLossBRL: summary.avoidedLossBRL,
            platformFeeBRL: summary.platformFeeBRL,
            roiPercent: summary.roiPercent,
            ppcBefore: baseline?.ppcPercent ?? 0,
            ppcAfter,
            materialDeviationBefore: baseline?.materialDeviationPercent ?? 0,
            materialDeviationAfter: materialAfter,
            materialSavingsBRL: Math.max(0, ((baseline?.materialDeviationPercent ?? 0) - materialAfter) / 100) * (baseline?.materialMonthlyBudgetBRL ?? 0),
            status: 'draft',
            generatedAt: new Date().toISOString(),
          }
          const { orgId, userId } = ctxAuth()
          set((state) => ({ reports: [report, ...state.reports] }))
          enqueue(makeOp({ entity: 'economy_report', type: 'insert', recordId: report.id, row: reportToRow(report, orgId, userId), table: 'economy_reports' }))
          void get().flush()
          return report
        },

        markReportSent: (id) => {
          set((state) => ({
            reports: state.reports.map((report) => report.id === id ? { ...report, status: 'sent', sentAt: new Date().toISOString() } : report),
            events: state.events.map((event) =>
              state.reports.find((report) => report.id === id)?.eventIds.includes(event.id)
                ? { ...event, status: event.status === 'dismissed' ? event.status : 'reported', reportedAt: new Date().toISOString() }
                : event,
            ),
          }))
          const target = get().reports.find((report) => report.id === id)
          if (!target) return
          const { orgId, userId } = ctxAuth()
          enqueue(enqueueUpdate('economy_report', 'economy_reports', id, reportToRow(target, orgId, userId)))
          void get().flush()
        },

        loadDemoData: () => {
          const baseline = defaultEconomyBaseline('Construtora media - 8 obras')
          set({
            baselines: [baseline],
            rules: defaultEconomyRules(),
            reports: [],
            events: seedEvents(baseline),
            selectedPeriod: monthPeriod(),
            selectedProjectId: null,
            lastScanAt: new Date().toISOString(),
          })
        },

        clearData: () => set({
          baselines: [],
          events: [],
          reports: [],
          rules: defaultEconomyRules(),
          pendingSync: [],
          lastScanAt: null,
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
          set((state) => ({
            pendingSync: state.pendingSync
              .filter((op) => !result.completed.includes(op.id))
              .map((op) => result.errored.includes(op.id) ? { ...op, retries: op.retries + 1 } : op),
            syncStatus: result.lastError ? 'error' : 'idle',
            lastSyncedAt: new Date().toISOString(),
            syncError: result.lastError ?? null,
          }))
        },

        pull: async () => {
          // Fase 5: puxa SEMPRE cada tabela e mescla com mergePull (preserva registros
          // com op pendente, atualiza o resto com o servidor). Nada mais congela a tabela.
          const [baselines, events, reports, rules] = await Promise.all([
            pullTable<{ payload: EconomyBaseline }>('economy_baselines'),
            pullTable<{ payload: EconomyEvent }>('economy_events', { column: 'event_date', ascending: false }),
            pullTable<{ payload: EconomyReport }>('economy_reports', { column: 'created_at', ascending: false }),
            pullTable<{ payload: EconomyValuationRule }>('economy_valuation_rules'),
          ])
          set((s) => ({
            baselines: mergePull(baselines?.map((row) => row.payload) ?? null, s.baselines, s.pendingSync, 'economy_baselines'),
            events: mergePull(events?.map((row) => row.payload) ?? null, s.events, s.pendingSync, 'economy_events'),
            reports: mergePull(reports?.map((row) => row.payload) ?? null, s.reports, s.pendingSync, 'economy_reports'),
            // Server vazio nunca apaga as regras default locais (mantém o guard `?.length`).
            rules: mergePull(rules?.length ? rules.map((row) => row.payload) : null, s.rules, s.pendingSync, 'economy_valuation_rules'),
          }))
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-economia',
      partialize: (state) => ({
        baselines: state.baselines,
        events: state.events,
        reports: state.reports,
        rules: state.rules,
        selectedPeriod: state.selectedPeriod,
        selectedProjectId: state.selectedProjectId,
        lastScanAt: state.lastScanAt,
        pendingSync: state.pendingSync,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useEconomiaStore.getState().flush()
  })

  void import('@/lib/eventBus').then(({ eventBus }) => {
    eventBus.on('realtime.row_changed', (event) => {
      if (
        event.table === 'economy_baselines' ||
        event.table === 'economy_events' ||
        event.table === 'economy_reports' ||
        event.table === 'economy_valuation_rules'
      ) {
        void useEconomiaStore.getState().pull()
      }
    })
  })
}

function latestPpc(activities: LpsActivity[]): number {
  const weeks = new Map<string, { planned: number; completed: number }>()
  for (const activity of activities) {
    if (!activity.planned) continue
    const row = weeks.get(activity.week) ?? { planned: 0, completed: 0 }
    row.planned += 1
    if (activity.completed) row.completed += 1
    weeks.set(activity.week, row)
  }
  const latest = Array.from(weeks.entries()).sort(([a], [b]) => b.localeCompare(a))[0]?.[1]
  return latest && latest.planned > 0 ? Math.round((latest.completed / latest.planned) * 100) : 0
}

function seedEvents(baseline: EconomyBaseline): EconomyEvent[] {
  const now = new Date().toISOString()
  const period = monthPeriod()
  const base = {
    projectId: null,
    projectName: baseline.projectName,
    date: todayIso(),
    period,
    status: 'validated' as const,
    confidence: 'medium' as const,
    createdAt: now,
    updatedAt: now,
  }
  const rows: Array<Pick<EconomyEvent, 'sourceModule' | 'sourceId' | 'category' | 'title' | 'description' | 'impactBRL' | 'formula' | 'assumptions' | 'evidence'> & { confidence?: EconomyEvent['confidence'] }> = [
    {
      sourceModule: 'suprimentos',
      sourceId: 'demo-material',
      category: 'material_waste',
      title: 'Divergencia de material detectada',
      description: 'Consumo real acima do previsto em cimento, alerta gerado antes da compra emergencial.',
      impactBRL: 4200,
      formula: '(desvioAntes - desvioAtualOuMeta) * orcamentoMensalMaterial',
      assumptions: { desvioAntes: 8, desvioAtualOuMeta: 6.6, orcamentoMensalMaterial: 300000 },
      evidence: [{ label: 'Modulo', value: 'Suprimentos' }],
      confidence: 'high',
    },
    {
      sourceModule: 'lps',
      sourceId: 'demo-restriction',
      category: 'restriction_removed',
      title: 'Restricao de producao identificada via LPS',
      description: 'Tarefa da semana bloqueada por falta de insumo, compra realizada a tempo.',
      impactBRL: 6400,
      formula: 'probabilidadeImpacto * custoDiaParada * diasEvitados',
      assumptions: { probabilidadeImpacto: 0.5, custoDiaParada: 12800, diasEvitados: 1 },
      evidence: [{ label: 'Modulo', value: 'LPS' }],
    },
    {
      sourceModule: 'rdo',
      sourceId: 'demo-equipment',
      category: 'equipment_idle',
      title: 'Equipamento ocioso registrado no RDO',
      description: 'Betoneira sem uso por 3 dias, remanejada antes do custo se acumular.',
      impactBRL: 2100,
      formula: 'diasOciososEvitados * custoDiarioEquipamento',
      assumptions: { diasOciososEvitados: 3, custoDiarioEquipamento: 700 },
      evidence: [{ label: 'Modulo', value: 'RDO' }],
    },
    {
      sourceModule: 'manual',
      sourceId: 'demo-management-hours',
      category: 'management_hours',
      title: 'Horas de gestao recuperadas',
      description: 'Consolidacao mensal substituida por relatorio automatico revisado.',
      impactBRL: 5000,
      formula: '(horasBaseline - horasAtuais) * custoHoraGestor * 4.33',
      assumptions: { horasBaseline: 10, horasAtuais: 0.4, custoHoraGestor: 120 },
      evidence: [{ label: 'Baseline', value: '10h/sem' }],
    },
  ]
  return rows.map((row) => ({
    ...base,
    ...row,
    id: crypto.randomUUID(),
    stableKey: `${row.sourceModule}:${row.sourceId}:${row.category}:${period}`,
    confidence: row.confidence ?? base.confidence,
  }))
}
