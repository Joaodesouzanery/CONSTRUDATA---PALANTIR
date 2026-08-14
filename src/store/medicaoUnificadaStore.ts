import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { eventBus } from '@/lib/eventBus'
import { buildOperationalKey, validateOperationalKey } from '@/lib/operationalKey'
import { flushQueue, makeOp, mergePull, type PendingOp, type SyncStatus } from '@/lib/storeSync'

export type UnifiedSourceKind =
  | 'rdo'
  | 'rdo_sabesp'
  | 'spreadsheet'
  | 'manual'
  | 'manual_entry'
  | 'engineering_adjustment'
  | 'financial_adjustment'
  | 'suprimentos'
  | 'quality_return'

export type UnifiedReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'glossed' | 'blocked'
export type UnifiedMemoryStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'blocked'
export type UnifiedFinancialStatus = 'draft' | 'pending_review' | 'approved' | 'paid' | 'glossed' | 'blocked'
export type UnifiedPeriodStatus = 'draft' | 'in_review' | 'closed' | 'canceled'

export type UnifiedFinancialType =
  | 'retention'
  | 'discount'
  | 'rh'
  | 'machine'
  | 'vehicle'
  | 'fuel'
  | 'material'
  | 'epi'
  | 'third_party_service'
  | 'invoice'
  | 'advance'
  | 'previous_closing'
  | 'other'
  | 'manual_adjustment'

export interface UnifiedMeasurementPeriod {
  id: string
  organization_id?: string
  project_id?: string | null
  created_by?: string
  period_label: string
  starts_on?: string | null
  ends_on?: string | null
  contract_no?: string | null
  status: UnifiedPeriodStatus
  closed_at?: string | null
  closed_by?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  _syncError?: string | null
}

export interface UnifiedMeasurementContractItem {
  id: string
  organization_id?: string
  project_id?: string | null
  period_id?: string | null
  created_by?: string
  item_code?: string | null
  n_preco?: string | null
  description: string
  unit?: string | null
  contracted_quantity: number
  previous_quantity: number
  unit_price: number
  retention_percent: number
  retention_rule?: string | null
  measurement_rule?: string | null
  source_payload?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  _syncError?: string | null
}

export interface UnifiedMeasurementSource {
  id: string
  organization_id?: string
  created_by?: string
  measurement_id?: string | null
  project_id?: string | null
  period_id?: string | null
  rdo_id?: string | null
  rdo_type?: 'regular' | 'sabesp' | null
  contractor_id?: string | null
  supplier_id?: string | null
  contract_item_id?: string | null
  nucleo?: string | null
  local?: string | null
  street?: string | null
  contract_no?: string | null
  service_order?: string | null
  n_preco?: string | null
  source_workbook_name?: string | null
  source_sheet?: string | null
  source_row?: number | null
  parse_confidence?: number | null
  import_warnings?: string[] | null
  blocking_issues?: string[] | null
  source_kind: UnifiedSourceKind
  source_uid?: string | null
  source_date?: string | null
  service_code?: string | null
  service_description: string
  unit?: string | null
  quantity: number
  unit_price?: number
  amount: number
  origin_label: string
  quality_status?: 'clear' | 'pending_quality' | 'blocked_by_nc' | 'released' | 'glosa_review'
  quality_nc_id?: string | null
  quality_note?: string | null
  status?: UnifiedReviewStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  review_note?: string | null
  manual_reason?: string | null
  evidence_url?: string | null
  source_payload?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  _syncError?: string | null
}

export interface UnifiedMeasurementMemoryLine {
  id: string
  organization_id?: string
  project_id?: string | null
  period_id?: string | null
  source_id?: string | null
  created_by?: string
  rdo_id?: string | null
  rdo_type?: 'regular' | 'sabesp' | null
  contractor_id?: string | null
  supplier_id?: string | null
  contract_item_id?: string | null
  n_preco?: string | null
  service_description: string
  unit?: string | null
  quantity: number
  unit_price: number
  nucleo?: string | null
  location_text?: string | null
  street?: string | null
  number?: string | null
  service_order?: string | null
  croqui?: string | null
  trecho_inicial?: string | null
  trecho_final?: string | null
  pv_pi_estaca_inicial?: string | null
  pv_pi_estaca_final?: string | null
  derivation_type?: string | null
  intra_executada?: boolean | null
  evidence_url?: string | null
  manual_reason?: string | null
  review_status: UnifiedMemoryStatus
  reviewed_by?: string | null
  reviewed_at?: string | null
  notes?: string | null
  source_payload?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  _syncError?: string | null
}

export interface UnifiedMeasurementFinancialEntry {
  id: string
  organization_id?: string
  project_id?: string | null
  period_id?: string | null
  source_id?: string | null
  contractor_id?: string | null
  supplier_id?: string | null
  created_by?: string
  nucleo?: string | null
  entry_type: UnifiedFinancialType
  description: string
  amount: number
  competence?: string | null
  invoice_number?: string | null
  status: UnifiedFinancialStatus
  manual_reason?: string | null
  evidence_url?: string | null
  payload?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  _syncError?: string | null
}

interface UnifiedMeasurementState {
  periods: UnifiedMeasurementPeriod[]
  activePeriodId: string | null
  sources: UnifiedMeasurementSource[]
  memoryLines: UnifiedMeasurementMemoryLine[]
  contractItems: UnifiedMeasurementContractItem[]
  financialEntries: UnifiedMeasurementFinancialEntry[]
  loading: boolean
  syncError: string | null
  pendingSync: PendingOp[]
  syncStatus: SyncStatus

  load: () => Promise<void>
  pull: () => Promise<void>
  flush: () => Promise<void>
  clearData: () => void
  setActivePeriod: (periodId: string | null) => void
  createPeriod: (input: Partial<UnifiedMeasurementPeriod> & Pick<UnifiedMeasurementPeriod, 'period_label'>) => Promise<string>
  updatePeriod: (id: string, patch: Partial<UnifiedMeasurementPeriod>) => Promise<void>
  addManualSource: (input: Partial<UnifiedMeasurementSource> & Pick<UnifiedMeasurementSource, 'service_description'>) => Promise<string>
  updateSource: (id: string, patch: Partial<UnifiedMeasurementSource>) => Promise<void>
  reviewSource: (id: string, status: UnifiedReviewStatus, note?: string) => Promise<void>
  addContractItem: (input: Partial<UnifiedMeasurementContractItem> & Pick<UnifiedMeasurementContractItem, 'description'>) => Promise<string>
  addMemoryLine: (input: Partial<UnifiedMeasurementMemoryLine> & Pick<UnifiedMeasurementMemoryLine, 'service_description'>) => Promise<string>
  updateMemoryLine: (id: string, patch: Partial<UnifiedMeasurementMemoryLine>) => Promise<void>
  reviewMemoryLine: (id: string, status: UnifiedMemoryStatus, note?: string) => Promise<void>
  generateMemoryFromSource: (sourceId: string) => Promise<string | null>
  addFinancialEntry: (input: Partial<UnifiedMeasurementFinancialEntry> & Pick<UnifiedMeasurementFinancialEntry, 'entry_type' | 'description' | 'amount'>) => Promise<string>
  updateFinancialEntry: (id: string, patch: Partial<UnifiedMeasurementFinancialEntry>) => Promise<void>
  reviewFinancialEntry: (id: string, status: UnifiedFinancialStatus, note?: string) => Promise<void>
}

const nowIso = () => new Date().toISOString()
const today = () => new Date().toISOString().slice(0, 10)
const id = () => crypto.randomUUID()
const num = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0

function cleanRow<T extends Record<string, unknown>>(row: T) {
  const copy = { ...row }
  delete copy._syncError
  // created_by/organization_id são reinjetados pelo flushQueue.fixOrg com o
  // usuário/org ATUAL. Deixá-los aqui (com o autor original de uma linha puxada)
  // faria o upsert bater na RLS INSERT WITH CHECK (created_by = auth.uid()).
  delete copy.created_by
  delete copy.organization_id
  return copy
}

async function safeSelect<T>(table: string, fallback: T[]): Promise<{ data: T[]; error: string | null }> {
  const { profile } = useAuth.getState()
  if (!profile) return { data: fallback, error: null }
  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('organization_id', profile.organization_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) return { data: fallback, error: error.message }
  return { data: (data ?? []) as T[], error: null }
}

// Local-first: em vez de gravar direto no Supabase (o que perdia escrita offline
// e ficava invisível no indicador de sync), enfileira a linha e sobe via flush().
let enqueueMedicaoWrite: ((table: string, row: Record<string, unknown>) => void) | null = null

async function tryUpsert<T>(table: string, row: T): Promise<T | null> {
  enqueueMedicaoWrite?.(table, cleanRow(row as Record<string, unknown>))
  return row   // otimista — o flush confirma no servidor e retenta se falhar
}

function sourcePayloadText(payload: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = payload?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  const service = payload?.service
  if (service && typeof service === 'object') {
    for (const key of keys) {
      const value = (service as Record<string, unknown>)[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
  }
  return ''
}

function buildMemoryLineFromSource(source: UnifiedMeasurementSource): UnifiedMeasurementMemoryLine {
  const payload = source.source_payload ?? {}
  const unitPrice = num(source.unit_price)
  const nPreco = source.n_preco || source.service_code || sourcePayloadText(payload, ['n_preco', 'nPreco', 'numero_preco', 'codigo'])
  const location = source.local || sourcePayloadText(payload, ['rua_beco', 'local', 'location_text', 'criadouro', 'criadouro_outro'])
  const evidence = source.evidence_url || sourcePayloadText(payload, ['planilha_foto_path', 'foto_url', 'document_url'])

  return {
    id: id(),
    period_id: source.period_id ?? null,
    source_id: source.id,
    rdo_id: source.rdo_id ?? null,
    rdo_type: source.rdo_type ?? null,
    contractor_id: source.contractor_id ?? null,
    supplier_id: source.supplier_id ?? null,
    contract_item_id: source.contract_item_id ?? null,
    n_preco: nPreco || null,
    service_description: source.service_description,
    unit: source.unit ?? null,
    quantity: num(source.quantity),
    unit_price: unitPrice,
    nucleo: source.nucleo ?? null,
    location_text: location || null,
    street: source.street || sourcePayloadText(payload, ['rua', 'street']) || null,
    number: sourcePayloadText(payload, ['numero', 'number']) || null,
    service_order: source.service_order || sourcePayloadText(payload, ['nota_servico', 'service_order', 'service_order_no']) || null,
    croqui: sourcePayloadText(payload, ['croqui']) || null,
    trecho_inicial: sourcePayloadText(payload, ['trecho_inicial', 'inicio']) || null,
    trecho_final: sourcePayloadText(payload, ['trecho_final', 'fim']) || null,
    evidence_url: evidence || null,
    manual_reason: null,
    review_status: 'pending_review',
    notes: source.status === 'approved' ? 'Gerada a partir de fonte aprovada.' : 'Gerada a partir de fonte aguardando revisao.',
    source_payload: payload,
    created_at: nowIso(),
    updated_at: nowIso(),
  }
}

function operationalKeyFromSource(source: UnifiedMeasurementSource) {
  return buildOperationalKey({
    contractNo: source.contract_no,
    projectId: source.project_id,
    nucleo: source.nucleo,
    local: source.local || source.street,
    serviceCode: source.service_code,
    nPreco: source.n_preco,
    period: source.source_date?.slice(0, 7),
  })
}

export const useMedicaoUnificadaStore = create<UnifiedMeasurementState>()(
  persist(
    (set, get) => ({
      periods: [],
      activePeriodId: null,
      sources: [],
      memoryLines: [],
      contractItems: [],
      financialEntries: [],
      loading: false,
      syncError: null,
      pendingSync: [],
      syncStatus: 'idle',

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
          syncError:    result.lastError ?? null,
        }))
      },

      pull: async () => { await get().load() },

      load: async () => {
        set({ loading: true, syncError: null })
        const state = get()
        const [periods, sources, memoryLines, contractItems, financialEntries] = await Promise.all([
          safeSelect<UnifiedMeasurementPeriod>('measurement_periods', state.periods),
          safeSelect<UnifiedMeasurementSource>('measurement_sources', state.sources),
          safeSelect<UnifiedMeasurementMemoryLine>('measurement_memory_lines', state.memoryLines),
          safeSelect<UnifiedMeasurementContractItem>('measurement_contract_items', state.contractItems),
          safeSelect<UnifiedMeasurementFinancialEntry>('measurement_financial_entries', state.financialEntries),
        ])
        const syncError = [periods.error, sources.error, memoryLines.error, contractItems.error, financialEntries.error].filter(Boolean).join(' | ') || null
        // Fase 5 (anti "congelamento"): em vez de pular a tabela inteira quando há
        // QUALQUER op pendente, mescla com mergePull — server para os registros já
        // sincronizados, local para os que ainda têm op pendente. Assim uma op presa
        // nunca mais congela o resto da tabela nem apaga dado local não-sincronizado.
        // Relê o estado APÓS o fetch: uma escrita enfileirada durante a rede não
        // pode ser descartada (base de merge tem que ser o estado fresco).
        const fresh = get()
        const nextPeriods = mergePull(periods.data, fresh.periods, fresh.pendingSync, 'measurement_periods')
        set({
          periods: nextPeriods,
          sources: mergePull(sources.data.map((source) => ({ ...source, status: source.status ?? 'pending_review' })), fresh.sources, fresh.pendingSync, 'measurement_sources'),
          memoryLines: mergePull(memoryLines.data, fresh.memoryLines, fresh.pendingSync, 'measurement_memory_lines'),
          contractItems: mergePull(contractItems.data, fresh.contractItems, fresh.pendingSync, 'measurement_contract_items'),
          financialEntries: mergePull(financialEntries.data, fresh.financialEntries, fresh.pendingSync, 'measurement_financial_entries'),
          activePeriodId: fresh.activePeriodId && nextPeriods.some((period) => period.id === fresh.activePeriodId)
            ? fresh.activePeriodId
            : nextPeriods[0]?.id ?? fresh.activePeriodId,
          loading: false,
          syncError,
        })
      },

      clearData: () => set({
        periods: [],
        activePeriodId: null,
        sources: [],
        memoryLines: [],
        contractItems: [],
        financialEntries: [],
        loading: false,
        syncError: null,
        pendingSync: [],
        syncStatus: 'idle',
      }),

      setActivePeriod: (periodId) => set({ activePeriodId: periodId }),

      createPeriod: async (input) => {
        const row: UnifiedMeasurementPeriod = {
          id: input.id ?? id(),
          period_label: input.period_label.trim(),
          starts_on: input.starts_on ?? null,
          ends_on: input.ends_on ?? null,
          contract_no: input.contract_no ?? null,
          status: input.status ?? 'draft',
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        set((state) => ({ periods: [row, ...state.periods], activePeriodId: row.id }))
        try {
          const saved = await tryUpsert('measurement_periods', row)
          if (saved) set((state) => ({ periods: state.periods.map((item) => item.id === row.id ? saved as UnifiedMeasurementPeriod : item) }))
        } catch (error) {
          set((state) => ({ syncError: String((error as Error).message), periods: state.periods.map((item) => item.id === row.id ? { ...item, _syncError: String((error as Error).message) } : item) }))
        }
        return row.id
      },

      updatePeriod: async (idValue, patch) => {
        set((state) => ({ periods: state.periods.map((item) => item.id === idValue ? { ...item, ...patch, updated_at: nowIso() } : item) }))
        const row = get().periods.find((item) => item.id === idValue)
        if (!row) return
        try {
          const saved = await tryUpsert('measurement_periods', row)
          if (saved) set((state) => ({ periods: state.periods.map((item) => item.id === idValue ? saved as UnifiedMeasurementPeriod : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      addManualSource: async (input) => {
        const quantity = num(input.quantity)
        const unitPrice = num(input.unit_price)
        const row: UnifiedMeasurementSource = {
          id: input.id ?? id(),
          period_id: input.period_id ?? get().activePeriodId,
          project_id: input.project_id ?? null,
          contractor_id: input.contractor_id ?? null,
          supplier_id: input.supplier_id ?? null,
          contract_item_id: input.contract_item_id ?? null,
          nucleo: input.nucleo ?? null,
          local: input.local ?? null,
          street: input.street ?? null,
          contract_no: input.contract_no ?? null,
          service_order: input.service_order ?? null,
          n_preco: input.n_preco ?? input.service_code ?? null,
          source_workbook_name: input.source_workbook_name ?? null,
          source_sheet: input.source_sheet ?? null,
          source_row: input.source_row ?? null,
          parse_confidence: input.parse_confidence ?? null,
          import_warnings: input.import_warnings ?? null,
          blocking_issues: input.blocking_issues ?? validateOperationalKey(buildOperationalKey({
            contractNo: input.contract_no,
            projectId: input.project_id,
            nucleo: input.nucleo,
            local: input.local ?? input.street,
            serviceCode: input.service_code,
            nPreco: input.n_preco ?? input.service_code,
            period: input.source_date?.slice(0, 7),
          })),
          source_kind: input.source_kind ?? 'manual_entry',
          source_date: input.source_date ?? today(),
          service_code: input.service_code ?? null,
          service_description: input.service_description.trim(),
          unit: input.unit ?? null,
          quantity,
          unit_price: unitPrice,
          amount: input.amount ?? quantity * unitPrice,
          origin_label: input.origin_label ?? 'Lancamento manual',
          quality_status: input.quality_status ?? 'clear',
          status: input.status ?? 'pending_review',
          manual_reason: input.manual_reason ?? null,
          evidence_url: input.evidence_url ?? null,
          source_payload: input.source_payload ?? {},
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        // Filtra o id antes de inserir: com o id derivado da linha da planilha
        // (unifiedImportPromotion.ts), reimportar o mesmo arquivo traz os MESMOS ids. Sem o
        // filtro o servidor ficava com uma linha (upsert) e a tela com duas — a dedupe valia
        // só metade. Mesmo padrão de financeiroStore.ts.
        set((state) => ({ sources: [row, ...state.sources.filter((item) => item.id !== row.id)] }))
        const operationalKey = operationalKeyFromSource(row)
        eventBus.emit({
          type: 'measurement.draft_created',
          sourceId: row.id,
          projectId: row.project_id,
          operationalKey,
        })
        if (row.blocking_issues?.length) {
          eventBus.emit({
            type: 'measurement.blocked',
            sourceId: row.id,
            projectId: row.project_id,
            blockingIssues: row.blocking_issues,
            operationalKey,
          })
        }
        try {
          const saved = await tryUpsert('measurement_sources', row)
          if (saved) set((state) => ({ sources: state.sources.map((item) => item.id === row.id ? saved as UnifiedMeasurementSource : item) }))
        } catch (error) {
          set((state) => ({ syncError: String((error as Error).message), sources: state.sources.map((item) => item.id === row.id ? { ...item, _syncError: String((error as Error).message) } : item) }))
        }
        return row.id
      },

      updateSource: async (idValue, patch) => {
        set((state) => ({ sources: state.sources.map((item) => item.id === idValue ? { ...item, ...patch, updated_at: nowIso() } : item) }))
        const row = get().sources.find((item) => item.id === idValue)
        if (!row) return
        try {
          const saved = await tryUpsert('measurement_sources', row)
          if (saved) set((state) => ({ sources: state.sources.map((item) => item.id === idValue ? saved as UnifiedMeasurementSource : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      reviewSource: async (idValue, status, note) => {
        const { user } = useAuth.getState()
        await get().updateSource(idValue, { status, review_note: note ?? null, reviewed_by: user?.id ?? null, reviewed_at: nowIso() })
        const source = get().sources.find((item) => item.id === idValue)
        if (source && status === 'approved') {
          eventBus.emit({
            type: 'measurement.approved',
            sourceId: source.id,
            projectId: source.project_id,
            quantity: source.quantity,
            amount: source.amount,
            operationalKey: operationalKeyFromSource(source),
          })
        }
      },

      addContractItem: async (input) => {
        const row: UnifiedMeasurementContractItem = {
          id: input.id ?? id(),
          period_id: input.period_id ?? get().activePeriodId,
          item_code: input.item_code ?? null,
          n_preco: input.n_preco ?? null,
          description: input.description.trim(),
          unit: input.unit ?? null,
          contracted_quantity: num(input.contracted_quantity),
          previous_quantity: num(input.previous_quantity),
          unit_price: num(input.unit_price),
          retention_percent: num(input.retention_percent),
          retention_rule: input.retention_rule ?? null,
          measurement_rule: input.measurement_rule ?? null,
          source_payload: input.source_payload ?? {},
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        set((state) => ({ contractItems: [row, ...state.contractItems] }))
        try {
          const saved = await tryUpsert('measurement_contract_items', row)
          if (saved) set((state) => ({ contractItems: state.contractItems.map((item) => item.id === row.id ? saved as UnifiedMeasurementContractItem : item) }))
        } catch (error) {
          set((state) => ({ syncError: String((error as Error).message), contractItems: state.contractItems.map((item) => item.id === row.id ? { ...item, _syncError: String((error as Error).message) } : item) }))
        }
        return row.id
      },

      addMemoryLine: async (input) => {
        const row: UnifiedMeasurementMemoryLine = {
          id: input.id ?? id(),
          period_id: input.period_id ?? get().activePeriodId,
          source_id: input.source_id ?? null,
          rdo_id: input.rdo_id ?? null,
          rdo_type: input.rdo_type ?? null,
          contractor_id: input.contractor_id ?? null,
          supplier_id: input.supplier_id ?? null,
          contract_item_id: input.contract_item_id ?? null,
          n_preco: input.n_preco ?? null,
          service_description: input.service_description.trim(),
          unit: input.unit ?? null,
          quantity: num(input.quantity),
          unit_price: num(input.unit_price),
          nucleo: input.nucleo ?? null,
          location_text: input.location_text ?? null,
          street: input.street ?? null,
          number: input.number ?? null,
          service_order: input.service_order ?? null,
          croqui: input.croqui ?? null,
          trecho_inicial: input.trecho_inicial ?? null,
          trecho_final: input.trecho_final ?? null,
          evidence_url: input.evidence_url ?? null,
          manual_reason: input.manual_reason ?? null,
          review_status: input.review_status ?? 'pending_review',
          notes: input.notes ?? null,
          source_payload: input.source_payload ?? {},
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        set((state) => ({ memoryLines: [row, ...state.memoryLines.filter((item) => item.id !== row.id)] }))
        try {
          const saved = await tryUpsert('measurement_memory_lines', row)
          if (saved) set((state) => ({ memoryLines: state.memoryLines.map((item) => item.id === row.id ? saved as UnifiedMeasurementMemoryLine : item) }))
        } catch (error) {
          set((state) => ({ syncError: String((error as Error).message), memoryLines: state.memoryLines.map((item) => item.id === row.id ? { ...item, _syncError: String((error as Error).message) } : item) }))
        }
        return row.id
      },

      updateMemoryLine: async (idValue, patch) => {
        set((state) => ({ memoryLines: state.memoryLines.map((item) => item.id === idValue ? { ...item, ...patch, updated_at: nowIso() } : item) }))
        const row = get().memoryLines.find((item) => item.id === idValue)
        if (!row) return
        try {
          const saved = await tryUpsert('measurement_memory_lines', row)
          if (saved) set((state) => ({ memoryLines: state.memoryLines.map((item) => item.id === idValue ? saved as UnifiedMeasurementMemoryLine : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      reviewMemoryLine: async (idValue, status, note) => {
        const { user } = useAuth.getState()
        await get().updateMemoryLine(idValue, { review_status: status, notes: note ?? null, reviewed_by: user?.id ?? null, reviewed_at: nowIso() })
      },

      generateMemoryFromSource: async (sourceId) => {
        const source = get().sources.find((item) => item.id === sourceId)
        if (!source) return null
        const existing = get().memoryLines.find((line) => line.source_id === sourceId && !line.deleted_at)
        if (existing) return existing.id
        const row = buildMemoryLineFromSource(source)
        return get().addMemoryLine(row)
      },

      addFinancialEntry: async (input) => {
        const row: UnifiedMeasurementFinancialEntry = {
          id: input.id ?? id(),
          period_id: input.period_id ?? get().activePeriodId,
          source_id: input.source_id ?? null,
          contractor_id: input.contractor_id ?? null,
          supplier_id: input.supplier_id ?? null,
          nucleo: input.nucleo ?? null,
          entry_type: input.entry_type,
          description: input.description.trim(),
          amount: num(input.amount),
          competence: input.competence ?? null,
          invoice_number: input.invoice_number ?? null,
          status: input.status ?? 'pending_review',
          manual_reason: input.manual_reason ?? null,
          evidence_url: input.evidence_url ?? null,
          payload: input.payload ?? {},
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        set((state) => ({ financialEntries: [row, ...state.financialEntries.filter((item) => item.id !== row.id)] }))
        try {
          const saved = await tryUpsert('measurement_financial_entries', row)
          if (saved) set((state) => ({ financialEntries: state.financialEntries.map((item) => item.id === row.id ? saved as UnifiedMeasurementFinancialEntry : item) }))
        } catch (error) {
          set((state) => ({ syncError: String((error as Error).message), financialEntries: state.financialEntries.map((item) => item.id === row.id ? { ...item, _syncError: String((error as Error).message) } : item) }))
        }
        return row.id
      },

      updateFinancialEntry: async (idValue, patch) => {
        set((state) => ({ financialEntries: state.financialEntries.map((item) => item.id === idValue ? { ...item, ...patch, updated_at: nowIso() } : item) }))
        const row = get().financialEntries.find((item) => item.id === idValue)
        if (!row) return
        try {
          const saved = await tryUpsert('measurement_financial_entries', row)
          if (saved) set((state) => ({ financialEntries: state.financialEntries.map((item) => item.id === idValue ? saved as UnifiedMeasurementFinancialEntry : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      reviewFinancialEntry: async (idValue, status, note) => {
        await get().updateFinancialEntry(idValue, { status, manual_reason: note ?? get().financialEntries.find((entry) => entry.id === idValue)?.manual_reason })
      },
    }),
    {
      name: 'cdata-medicao-unificada',
      partialize: (state) => ({
        periods: state.periods,
        activePeriodId: state.activePeriodId,
        sources: state.sources,
        memoryLines: state.memoryLines,
        contractItems: state.contractItems,
        financialEntries: state.financialEntries,
        pendingSync: state.pendingSync,
      }),
    },
  ),
)

// Liga a fila do store ao tryUpsert (local-first): cada escrita vira uma op.
enqueueMedicaoWrite = (table, row) => {
  useMedicaoUnificadaStore.setState((s) => ({
    pendingSync: [...s.pendingSync, makeOp({ entity: table, type: 'insert', recordId: String(row.id ?? ''), row, table })],
  }))
  void useMedicaoUnificadaStore.getState().flush()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Sequencial: sobe a fila ANTES de recarregar, senão o load lê um snapshot
    // sem a op recém-enviada e a descarta (o flush já limpou a op).
    void (async () => {
      await useMedicaoUnificadaStore.getState().flush()
      await useMedicaoUnificadaStore.getState().load()
    })()
  })

  void import('@/lib/eventBus').then(({ eventBus }) => {
    eventBus.on('rdo.finalized', () => {
      void useMedicaoUnificadaStore.getState().load()
    })
    eventBus.on('quality.blocked', () => {
      void useMedicaoUnificadaStore.getState().load()
    })
    eventBus.on('quality.released', () => {
      void useMedicaoUnificadaStore.getState().load()
    })
    eventBus.on('supply.receipt_approved', () => {
      void useMedicaoUnificadaStore.getState().load()
    })
    eventBus.on('supply.invoice_approved', () => {
      void useMedicaoUnificadaStore.getState().load()
    })
    eventBus.on('realtime.row_changed', (event) => {
      if (
        event.table === 'measurement_sources'
        || event.table === 'measurement_periods'
        || event.table === 'measurement_memory_lines'
        || event.table === 'measurement_financial_entries'
        || event.table === 'measurement_contract_items'
        || event.table === 'rdo'
        || event.table === 'rdo_sabesp'
        || event.table === 'goods_receipts'
        || event.table === 'invoices'
        || event.table === 'quality_non_conformities'
      ) {
        void useMedicaoUnificadaStore.getState().load()
      }
    })
  })
}
