import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, type PendingOp, type SyncStatus } from '@/lib/storeSync'

export type ContractorStatus = 'active' | 'inactive'
export type RdoContractorLinkType = 'regular' | 'sabesp'
export type MeasurementAdjustmentKind = 'extra' | 'discount' | 'manual_adjustment'
export type ContractorInvoiceStatus = 'pendente' | 'enviada' | 'aprovada' | 'paga' | 'glosada'
export type MeasurementSourceKind = 'rdo' | 'rdo_sabesp' | 'spreadsheet' | 'manual' | 'suprimentos' | 'quality_return'
export type MeasurementQualityStatus = 'clear' | 'pending_quality' | 'blocked_by_nc' | 'released' | 'glosa_review'

export interface Contractor {
  id: string
  organization_id?: string
  created_by?: string
  name: string
  legal_name?: string | null
  cnpj?: string | null
  status: ContractorStatus
  notes?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  _syncError?: string | null
}

export interface ContractorForeman {
  id: string
  organization_id?: string
  contractor_id: string
  created_by?: string
  name: string
  normalized_name: string
  phone?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  _syncError?: string | null
}

export interface RdoContractorLink {
  id: string
  organization_id?: string
  created_by?: string
  rdo_id: string
  rdo_type: RdoContractorLinkType
  contractor_id?: string | null
  foreman_name?: string | null
  normalized_foreman_name?: string | null
  source: 'auto' | 'manual'
  created_at: string
  updated_at: string
  _syncError?: string | null
}

export interface MeasurementAdjustment {
  id: string
  organization_id?: string
  created_by?: string
  contractor_id?: string | null
  nucleo?: string | null
  kind: MeasurementAdjustmentKind
  description: string
  unit?: string | null
  quantity: number
  unit_price: number
  amount: number
  source_id?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  _syncError?: string | null
}

export interface MeasurementSource {
  id: string
  organization_id?: string
  created_by?: string
  measurement_id?: string | null
  rdo_id?: string | null
  rdo_type?: RdoContractorLinkType | null
  contractor_id?: string | null
  nucleo?: string | null
  local?: string | null
  street?: string | null
  service_order?: string | null
  n_preco?: string | null
  source_workbook_name?: string | null
  source_sheet?: string | null
  source_row?: number | null
  parse_confidence?: number | null
  import_warnings?: string[] | null
  blocking_issues?: string[] | null
  evidence_url?: string | null
  source_kind: MeasurementSourceKind
  source_uid?: string | null
  source_date?: string | null
  service_code?: string | null
  service_description: string
  unit?: string | null
  quantity: number
  amount: number
  origin_label: string
  quality_status: MeasurementQualityStatus
  quality_nc_id?: string | null
  quality_note?: string | null
  source_payload?: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface ContractorInvoice {
  id: string
  organization_id?: string
  created_by?: string
  contractor_id: string
  nucleo?: string | null
  invoice_number?: string | null
  amount: number
  status: ContractorInvoiceStatus
  issue_date?: string | null
  payment_date?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  _syncError?: string | null
}

export interface ContractorInvoiceEvent {
  id: string
  organization_id?: string
  invoice_id: string
  created_by?: string
  status: ContractorInvoiceStatus
  amount?: number | null
  event_date: string
  note?: string | null
  created_at: string
  _syncError?: string | null
}

interface ContractorState {
  contractors: Contractor[]
  foremen: ContractorForeman[]
  rdoLinks: RdoContractorLink[]
  measurementSources: MeasurementSource[]
  adjustments: MeasurementAdjustment[]
  invoices: ContractorInvoice[]
  invoiceEvents: ContractorInvoiceEvent[]
  loading: boolean
  syncError: string | null
  pendingSync: PendingOp[]
  syncStatus: SyncStatus

  load: () => Promise<void>
  pull: () => Promise<void>
  flush: () => Promise<void>
  clearData: () => void
  addContractor: (input: Pick<Contractor, 'name'> & Partial<Contractor>) => Promise<string>
  updateContractor: (id: string, patch: Partial<Omit<Contractor, 'id'>>) => Promise<void>
  removeContractor: (id: string) => Promise<void>
  addForeman: (input: Pick<ContractorForeman, 'contractor_id' | 'name'> & Partial<ContractorForeman>) => Promise<string>
  updateForeman: (id: string, patch: Partial<Omit<ContractorForeman, 'id'>>) => Promise<void>
  removeForeman: (id: string) => Promise<void>
  linkRdo: (input: Pick<RdoContractorLink, 'rdo_id' | 'rdo_type'> & Partial<RdoContractorLink>) => Promise<string>
  resolveContractorByForeman: (name?: string | null) => Contractor | null
  resolveRdoContractor: (input: { rdoId: string; rdoType: RdoContractorLinkType; foremanName?: string | null }) => Contractor | null
  addAdjustment: (input: Omit<MeasurementAdjustment, 'id' | 'created_at' | 'updated_at'>) => Promise<string>
  updateAdjustment: (id: string, patch: Partial<Omit<MeasurementAdjustment, 'id'>>) => Promise<void>
  removeAdjustment: (id: string) => Promise<void>
  addInvoice: (input: Omit<ContractorInvoice, 'id' | 'created_at' | 'updated_at'>) => Promise<string>
  updateInvoice: (id: string, patch: Partial<Omit<ContractorInvoice, 'id'>>) => Promise<void>
  removeInvoice: (id: string) => Promise<void>
  addInvoiceEvent: (input: Omit<ContractorInvoiceEvent, 'id' | 'created_at'>) => Promise<string>
}

const nowIso = () => new Date().toISOString()
const id = () => crypto.randomUUID()

export function normalizeForemanName(value?: string | null) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function stripPrivate<T extends Record<string, unknown>>(row: T) {
  const clean = { ...row }
  delete clean._syncError
  // Reinjetados pelo flushQueue.fixOrg com o usuário/org ATUAL — senão o upsert de
  // uma linha puxada (created_by = autor original) bate na RLS INSERT WITH CHECK.
  delete clean.created_by
  delete clean.organization_id
  return clean
}

// Local-first: enfileira a escrita/soft-delete e sobe via flush() (não grava
// direto), pra não perder o que foi feito offline e contar no indicador de sync.
let enqueueContractorWrite: ((table: string, row: Record<string, unknown>) => void) | null = null
let enqueueContractorDelete: ((table: string, id: string) => void) | null = null

async function tryUpsert(table: string, row: object) {
  enqueueContractorWrite?.(table, stripPrivate(row as Record<string, unknown>))
  return row   // otimista — o flush confirma no servidor e retenta se falhar
}

async function trySoftDelete(table: string, idValue: string) {
  enqueueContractorDelete?.(table, idValue)
}

export const useContractorStore = create<ContractorState>()(
  persist(
    (set, get) => ({
      contractors: [],
      foremen: [],
      rdoLinks: [],
      measurementSources: [],
      adjustments: [],
      invoices: [],
      invoiceEvents: [],
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
        const { profile } = useAuth.getState()
        if (!profile) return
        set({ loading: true, syncError: null })
        try {
          const [
            contractors,
            foremen,
            rdoLinks,
            measurementSources,
            adjustments,
            invoices,
            invoiceEvents,
          ] = await Promise.all([
            supabase.from('contractors').select('*').eq('organization_id', profile.organization_id).is('deleted_at', null).order('name'),
            supabase.from('contractor_foremen').select('*').eq('organization_id', profile.organization_id).is('deleted_at', null).order('name'),
            supabase.from('rdo_contractor_links').select('*').eq('organization_id', profile.organization_id),
            supabase.from('measurement_sources').select('*').eq('organization_id', profile.organization_id).is('deleted_at', null).order('source_date', { ascending: false }),
            supabase.from('measurement_adjustments').select('*').eq('organization_id', profile.organization_id).is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('contractor_invoices').select('*').eq('organization_id', profile.organization_id).is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('contractor_invoice_events').select('*').eq('organization_id', profile.organization_id).order('created_at', { ascending: false }),
          ])

          const firstError = contractors.error || foremen.error || rdoLinks.error || measurementSources.error || adjustments.error || invoices.error || invoiceEvents.error
          if (firstError) throw firstError

          // Preserva registros locais que não subiram (upsert falhou, marcado com _syncError).
          const prev = get()
          const keepUnsynced = <T extends { id: string; _syncError?: string | null }>(fetched: T[], local: T[]): T[] => {
            const ids = new Set(fetched.map((i) => i.id))
            return [...fetched, ...local.filter((i) => i._syncError && !ids.has(i.id))]
          }
          // Não sobrescreve tabela com escrita local ainda não sincronizada (fila).
          const pend = new Set(prev.pendingSync.map((op) => op.table))
          const guard = <T extends { id: string; _syncError?: string | null }>(table: string, fetched: T[], local: T[]): T[] =>
            pend.has(table) ? local : keepUnsynced(fetched, local)
          set({
            contractors: guard('contractors', (contractors.data ?? []) as typeof prev.contractors, prev.contractors),
            foremen: guard('contractor_foremen', (foremen.data ?? []) as typeof prev.foremen, prev.foremen),
            rdoLinks: pend.has('rdo_contractor_links') ? prev.rdoLinks : (rdoLinks.data ?? []),
            measurementSources: guard('measurement_sources', (measurementSources.data ?? []) as typeof prev.measurementSources, prev.measurementSources),
            adjustments: guard('measurement_adjustments', (adjustments.data ?? []) as typeof prev.adjustments, prev.adjustments),
            invoices: guard('contractor_invoices', (invoices.data ?? []) as typeof prev.invoices, prev.invoices),
            invoiceEvents: pend.has('contractor_invoice_events') ? prev.invoiceEvents : (invoiceEvents.data ?? []),
            loading: false,
            syncError: null,
          })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Falha ao carregar empreiteiros.'
          console.warn('[contractors] usando cache local', error)
          set({ loading: false, syncError: message })
        }
      },

      clearData: () => set({
        contractors: [],
        foremen: [],
        rdoLinks: [],
        measurementSources: [],
        adjustments: [],
        invoices: [],
        invoiceEvents: [],
        loading: false,
        syncError: null,
        pendingSync: [],
        syncStatus: 'idle',
      }),

      addContractor: async (input) => {
        const row: Contractor = {
          id: input.id ?? id(),
          name: input.name.trim(),
          legal_name: input.legal_name ?? null,
          cnpj: input.cnpj ?? null,
          status: input.status ?? 'active',
          notes: input.notes ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        set((state) => ({ contractors: [...state.contractors, row] }))
        try {
          const saved = await tryUpsert('contractors', row)
          if (saved) set((state) => ({ contractors: state.contractors.map((item) => item.id === row.id ? saved as Contractor : item) }))
        } catch (error) {
          set((state) => ({ contractors: state.contractors.map((item) => item.id === row.id ? { ...item, _syncError: String((error as Error).message) } : item), syncError: String((error as Error).message) }))
        }
        return row.id
      },

      updateContractor: async (idValue, patch) => {
        const updated_at = nowIso()
        set((state) => ({ contractors: state.contractors.map((item) => item.id === idValue ? { ...item, ...patch, updated_at } : item) }))
        const row = get().contractors.find((item) => item.id === idValue)
        if (!row) return
        try {
          const saved = await tryUpsert('contractors', row)
          if (saved) set((state) => ({ contractors: state.contractors.map((item) => item.id === idValue ? saved as Contractor : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      removeContractor: async (idValue) => {
        const deleted_at = nowIso()
        // Cascata: soft-delete dos foremen também precisa subir (senão voltam ativos no pull).
        const foremanIds = get().foremen.filter((f) => f.contractor_id === idValue && !f.deleted_at).map((f) => f.id)
        set((state) => ({
          contractors: state.contractors.map((item) => item.id === idValue ? { ...item, deleted_at } : item),
          foremen: state.foremen.map((item) => item.contractor_id === idValue ? { ...item, deleted_at } : item),
        }))
        await trySoftDelete('contractors', idValue)
        for (const fid of foremanIds) await trySoftDelete('contractor_foremen', fid)
      },


      addForeman: async (input) => {
        const row: ContractorForeman = {
          id: input.id ?? id(),
          contractor_id: input.contractor_id,
          name: input.name.trim(),
          normalized_name: normalizeForemanName(input.name),
          phone: input.phone ?? null,
          notes: input.notes ?? null,
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        set((state) => ({ foremen: [...state.foremen.filter((item) => item.normalized_name !== row.normalized_name), row] }))
        try {
          const saved = await tryUpsert('contractor_foremen', row)
          if (saved) set((state) => ({ foremen: state.foremen.map((item) => item.id === row.id ? saved as ContractorForeman : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
        return row.id
      },

      updateForeman: async (idValue, patch) => {
        const normalizedPatch = patch.name ? { ...patch, normalized_name: normalizeForemanName(patch.name) } : patch
        set((state) => ({ foremen: state.foremen.map((item) => item.id === idValue ? { ...item, ...normalizedPatch, updated_at: nowIso() } : item) }))
        const row = get().foremen.find((item) => item.id === idValue)
        if (!row) return
        try {
          const saved = await tryUpsert('contractor_foremen', row)
          if (saved) set((state) => ({ foremen: state.foremen.map((item) => item.id === idValue ? saved as ContractorForeman : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      removeForeman: async (idValue) => {
        set((state) => ({ foremen: state.foremen.map((item) => item.id === idValue ? { ...item, deleted_at: nowIso() } : item) }))
        try {
          await trySoftDelete('contractor_foremen', idValue)
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      linkRdo: async (input) => {
        const row: RdoContractorLink = {
          id: input.id ?? id(),
          rdo_id: input.rdo_id,
          rdo_type: input.rdo_type,
          contractor_id: input.contractor_id ?? null,
          foreman_name: input.foreman_name ?? null,
          normalized_foreman_name: normalizeForemanName(input.foreman_name),
          source: input.source ?? 'manual',
          created_at: nowIso(),
          updated_at: nowIso(),
        }
        set((state) => ({
          rdoLinks: [
            ...state.rdoLinks.filter((item) => !(item.rdo_id === row.rdo_id && item.rdo_type === row.rdo_type)),
            row,
          ],
        }))
        try {
          const saved = await tryUpsert('rdo_contractor_links', row)
          if (saved) set((state) => ({ rdoLinks: state.rdoLinks.map((item) => item.id === row.id ? saved as RdoContractorLink : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
        return row.id
      },

      resolveContractorByForeman: (name) => {
        const normalized = normalizeForemanName(name)
        if (!normalized) return null
        const foreman = get().foremen.find((item) => !item.deleted_at && item.normalized_name === normalized)
        if (!foreman) return null
        return get().contractors.find((item) => item.id === foreman.contractor_id && !item.deleted_at) ?? null
      },

      resolveRdoContractor: ({ rdoId, rdoType, foremanName }) => {
        const link = get().rdoLinks.find((item) => item.rdo_id === rdoId && item.rdo_type === rdoType)
        if (link?.contractor_id) {
          return get().contractors.find((item) => item.id === link.contractor_id && !item.deleted_at) ?? null
        }
        return get().resolveContractorByForeman(foremanName)
      },

      addAdjustment: async (input) => {
        const row: MeasurementAdjustment = { ...input, id: id(), created_at: nowIso(), updated_at: nowIso() }
        set((state) => ({ adjustments: [row, ...state.adjustments] }))
        try {
          const saved = await tryUpsert('measurement_adjustments', row)
          if (saved) set((state) => ({ adjustments: state.adjustments.map((item) => item.id === row.id ? saved as MeasurementAdjustment : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
        return row.id
      },

      updateAdjustment: async (idValue, patch) => {
        set((state) => ({ adjustments: state.adjustments.map((item) => item.id === idValue ? { ...item, ...patch, updated_at: nowIso() } : item) }))
        const row = get().adjustments.find((item) => item.id === idValue)
        if (!row) return
        try {
          const saved = await tryUpsert('measurement_adjustments', row)
          if (saved) set((state) => ({ adjustments: state.adjustments.map((item) => item.id === idValue ? saved as MeasurementAdjustment : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      removeAdjustment: async (idValue) => {
        set((state) => ({ adjustments: state.adjustments.map((item) => item.id === idValue ? { ...item, deleted_at: nowIso() } : item) }))
        try {
          await trySoftDelete('measurement_adjustments', idValue)
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      addInvoice: async (input) => {
        const row: ContractorInvoice = { ...input, id: id(), status: input.status ?? 'pendente', created_at: nowIso(), updated_at: nowIso() }
        set((state) => ({ invoices: [row, ...state.invoices] }))
        try {
          const saved = await tryUpsert('contractor_invoices', row)
          if (saved) set((state) => ({ invoices: state.invoices.map((item) => item.id === row.id ? saved as ContractorInvoice : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
        void get().addInvoiceEvent({
          invoice_id: row.id,
          status: row.status,
          amount: row.amount,
          event_date: row.issue_date || new Date().toISOString().slice(0, 10),
          note: 'Nota criada',
        })
        return row.id
      },

      updateInvoice: async (idValue, patch) => {
        const previous = get().invoices.find((item) => item.id === idValue)
        set((state) => ({ invoices: state.invoices.map((item) => item.id === idValue ? { ...item, ...patch, updated_at: nowIso() } : item) }))
        const row = get().invoices.find((item) => item.id === idValue)
        if (!row) return
        if (patch.status && previous?.status !== patch.status) {
          void get().addInvoiceEvent({
            invoice_id: idValue,
            status: patch.status,
            amount: row.amount,
            event_date: row.payment_date || new Date().toISOString().slice(0, 10),
            note: patch.notes || `Status alterado para ${patch.status}`,
          })
        }
        try {
          const saved = await tryUpsert('contractor_invoices', row)
          if (saved) set((state) => ({ invoices: state.invoices.map((item) => item.id === idValue ? saved as ContractorInvoice : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      removeInvoice: async (idValue) => {
        set((state) => ({ invoices: state.invoices.map((item) => item.id === idValue ? { ...item, deleted_at: nowIso() } : item) }))
        try {
          await trySoftDelete('contractor_invoices', idValue)
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
      },

      addInvoiceEvent: async (input) => {
        const row: ContractorInvoiceEvent = { ...input, id: id(), created_at: nowIso() }
        set((state) => ({ invoiceEvents: [row, ...state.invoiceEvents] }))
        try {
          const saved = await tryUpsert('contractor_invoice_events', row)
          if (saved) set((state) => ({ invoiceEvents: state.invoiceEvents.map((item) => item.id === row.id ? saved as ContractorInvoiceEvent : item) }))
        } catch (error) {
          set({ syncError: String((error as Error).message) })
        }
        return row.id
      },
    }),
    {
      name: 'cdata-contractors',
      partialize: (state) => ({
        contractors: state.contractors,
        foremen: state.foremen,
        rdoLinks: state.rdoLinks,
        measurementSources: state.measurementSources,
        adjustments: state.adjustments,
        invoices: state.invoices,
        invoiceEvents: state.invoiceEvents,
        pendingSync: state.pendingSync,
      }),
    },
  ),
)

// Liga a fila do store aos helpers de escrita/soft-delete (local-first).
enqueueContractorWrite = (table, row) => {
  useContractorStore.setState((s) => ({
    pendingSync: [...s.pendingSync, makeOp({ entity: table, type: 'insert', recordId: String(row.id ?? ''), row, table })],
  }))
  void useContractorStore.getState().flush()
}
enqueueContractorDelete = (table, id) => {
  useContractorStore.setState((s) => ({
    pendingSync: [...s.pendingSync, makeOp({ entity: table, type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table })],
  }))
  void useContractorStore.getState().flush()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Sequencial: flush antes do load (senão o load descarta a op recém-enviada).
    void (async () => {
      await useContractorStore.getState().flush()
      await useContractorStore.getState().load()
    })()
  })
}
