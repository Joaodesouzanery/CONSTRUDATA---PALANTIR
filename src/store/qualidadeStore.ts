/**
 * qualidadeStore.ts — Zustand store for the Qualidade / FVS module.
 *
 * v1 (Sprint 1): local-first com sync para Supabase.
 *   - Mutações são otimistas: aplicam local imediatamente + enfileiram pra Supabase
 *   - localStorage funciona como cache offline (chave 'cdata-qualidade')
 *   - Quando online + autenticado, drena a fila de pendentes
 *   - DELETE de FVS dispara request_action('delete_fvs', ...) — vira pending_action
 *
 * A API pública (addFvs/updateFvs/removeFvs/fvss/setActiveTab/loadDemoData/clearData)
 * é a mesma da v0 — componentes existentes continuam funcionando sem mudança.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FVS, FvsTab, FvsItem, FvsProblemAction, QualityNonConformity } from '@/types'
import { MOCK_FVSS } from '@/data/mockQualidade'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { eventBus } from '@/lib/eventBus'

/**
 * Emite evento `fvs.nc_opened` quando uma NC é registrada num FVS.
 * Compara com a versão anterior (se houver) e só emite para NCs realmente NOVAS
 * (ncRequired passou de false→true OU ncNumber foi atribuído).
 */
function emitNcEventsIfAny(after: FVS, before?: FVS) {
  const wasNc = !!(before?.ncRequired && before?.ncNumber)
  const isNc  = !!(after.ncRequired && after.ncNumber)
  if (isNc && !wasNc) {
    eventBus.emit({
      type: 'fvs.nc_opened',
      fvsId: after.id,
      projectId: (after as { projectId?: string | null }).projectId ?? null,
      ncNumber: after.ncNumber,
      description: after.problems?.[0]?.description ?? undefined,
    })
  }
}

// ─── Mapeamento FVS (camelCase) ↔ Row (snake_case) ──────────────────────────
interface FvsRow {
  id:                  string
  organization_id:     string
  number:              number
  document_code:       string
  revision:            string
  identification_no:   string | null
  contract_no:         string
  date:                string
  nc_required:         boolean
  nc_number:           string | null
  responsible_leader:  string | null
  weld_tracking_no:    string | null
  welder_signature:    string | null
  quality_signature:   string | null
  logo_id:             string | null
  payload:             { items: FvsItem[]; problems: FvsProblemAction[]; fotos?: string[] }
  closed:              boolean
  created_by:          string
  created_at:          string
  updated_at:          string
  deleted_at:          string | null
}

interface QualityNcRow {
  id:              string
  organization_id: string
  number:          number
  nc_number:       string
  date:            string
  location:        string | null
  status:          QualityNonConformity['status']
  payload:         Omit<QualityNonConformity, 'id' | 'number' | 'createdAt' | 'updatedAt'>
  created_by:      string
  created_at:      string
  updated_at:      string
  deleted_at:      string | null
}

function rowToFvs(row: FvsRow): FVS {
  return {
    id:                row.id,
    number:            row.number,
    documentCode:      row.document_code,
    revision:          row.revision,
    identificationNo:  row.identification_no ?? '',
    contractNo:        row.contract_no,
    date:              row.date,
    items:             row.payload?.items    ?? [],
    problems:          row.payload?.problems ?? [],
    fotos:             row.payload?.fotos    ?? [],
    ncRequired:        row.nc_required,
    ncNumber:          row.nc_number ?? '',
    responsibleLeader: row.responsible_leader ?? '',
    weldTrackingNo:    row.weld_tracking_no ?? '',
    welderSignature:   row.welder_signature  ?? '',
    qualitySignature:  row.quality_signature ?? '',
    logoId:            row.logo_id ?? undefined,
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  }
}

function fvsToRow(
  fvs: FVS,
  orgId: string,
  userId: string,
): Omit<FvsRow, 'created_at' | 'updated_at' | 'deleted_at'> {
  return {
    id:                 fvs.id,
    organization_id:    orgId,
    number:             fvs.number,
    document_code:      fvs.documentCode,
    revision:           fvs.revision,
    identification_no:  fvs.identificationNo || null,
    contract_no:        fvs.contractNo,
    date:               fvs.date,
    nc_required:        fvs.ncRequired,
    nc_number:          fvs.ncNumber || null,
    responsible_leader: fvs.responsibleLeader || null,
    weld_tracking_no:   fvs.weldTrackingNo || null,
    welder_signature:   fvs.welderSignature || null,
    quality_signature:  fvs.qualitySignature || null,
    logo_id:            fvs.logoId ?? null,
    payload:            { items: fvs.items, problems: fvs.problems, fotos: fvs.fotos ?? [] },
    closed:             false,
    created_by:         userId,
  }
}

function rowToQualityNc(row: QualityNcRow): QualityNonConformity {
  const payload = row.payload ?? ({} as QualityNcRow['payload'])
  return {
    ...payload,
    id:        row.id,
    number:    row.number,
    ncNumber:  payload.ncNumber || row.nc_number || '',
    date:      payload.date || row.date,
    location:  payload.location || row.location || '',
    status:    payload.status || row.status || 'aberta',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function qualityNcToRow(
  nc: QualityNonConformity,
  orgId: string,
  userId: string,
): Omit<QualityNcRow, 'created_at' | 'updated_at' | 'deleted_at'> {
  const payload = { ...nc } as Record<string, unknown>
  delete payload.id
  delete payload.number
  delete payload.createdAt
  delete payload.updatedAt

  return {
    id:              nc.id,
    organization_id: orgId,
    number:          nc.number,
    nc_number:       nc.ncNumber,
    date:            nc.date,
    location:        nc.location || null,
    status:          nc.status,
    payload:         payload as QualityNcRow['payload'],
    created_by:      userId,
  }
}

// ─── Tipos do store ──────────────────────────────────────────────────────────
type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'unauth'

interface PendingOp {
  id:        string
  entity?:   'fvs' | 'quality_nc'
  type:      'insert' | 'update' | 'delete'
  recordId:  string
  payload?:  Partial<FVS> | Partial<QualityNonConformity>
  retries:   number
}

interface QualidadeState {
  activeTab:    FvsTab
  fvss:         FVS[]
  nonConformities: QualityNonConformity[]
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  setActiveTab: (tab: FvsTab) => void

  addFvs:    (fvs: Omit<FVS, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => void
  updateFvs: (id: string, updates: Partial<FVS>) => void
  removeFvs: (id: string) => void
  addNonConformity:    (nc: Omit<QualityNonConformity, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => void
  updateNonConformity: (id: string, updates: Partial<QualityNonConformity>) => void
  removeNonConformity: (id: string) => void

  loadDemoData: () => void
  clearData:    () => void

  // Sync
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

// ─── Store ───────────────────────────────────────────────────────────────────
export const useQualidadeStore = create<QualidadeState>()(
  persist(
    (set, get) => ({
      activeTab:    'dashboard',
      fvss:         [],
      nonConformities: [],
      pendingSync:  [],
      syncStatus:   'idle',
      lastSyncedAt: null,
      syncError:    null,

      setActiveTab: (tab) => set({ activeTab: tab }),

      addFvs: (fvs) => {
        const now = new Date().toISOString()
        const nextNumber = get().fvss.length > 0
          ? Math.max(...get().fvss.map((f) => f.number)) + 1
          : 1
        const newFvs: FVS = {
          ...fvs,
          id:        crypto.randomUUID(),
          number:    nextNumber,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({
          fvss: [...s.fvss, newFvs],
          pendingSync: [
            ...s.pendingSync,
            { id: crypto.randomUUID(), entity: 'fvs', type: 'insert', recordId: newFvs.id, payload: newFvs, retries: 0 },
          ],
        }))
        // Domain events: emite uma vez por NC nova
        emitNcEventsIfAny(newFvs)
        void get().flush()
      },

      updateFvs: (id, updates) => {
        const beforeFvs = get().fvss.find((f) => f.id === id)
        set((s) => ({
          fvss: s.fvss.map((f) =>
            f.id === id ? { ...f, ...updates, updatedAt: new Date().toISOString() } : f,
          ),
          pendingSync: [
            ...s.pendingSync,
            { id: crypto.randomUUID(), entity: 'fvs', type: 'update', recordId: id, payload: updates, retries: 0 },
          ],
        }))
        // Detecta novas NCs em comparação com o estado anterior
        const afterFvs = get().fvss.find((f) => f.id === id)
        if (afterFvs) emitNcEventsIfAny(afterFvs, beforeFvs)
        void get().flush()
      },

      removeFvs: (id) => {
        // Otimista: remove da UI imediatamente. Se a aprovação for negada,
        // o pull() vai re-trazer o registro do servidor.
        set((s) => ({
          fvss: s.fvss.filter((f) => f.id !== id),
          pendingSync: [
            ...s.pendingSync,
            { id: crypto.randomUUID(), entity: 'fvs', type: 'delete', recordId: id, retries: 0 },
          ],
        }))
        void get().flush()
      },

      addNonConformity: (nc) => {
        const now = new Date().toISOString()
        const nextNumber = get().nonConformities.length > 0
          ? Math.max(...get().nonConformities.map((item) => item.number)) + 1
          : 1
        const newNc: QualityNonConformity = {
          ...nc,
          id:        crypto.randomUUID(),
          number:    nextNumber,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({
          nonConformities: [...s.nonConformities, newNc],
          pendingSync: [
            ...s.pendingSync,
            { id: crypto.randomUUID(), entity: 'quality_nc', type: 'insert', recordId: newNc.id, payload: newNc, retries: 0 },
          ],
        }))
        void get().flush()
      },

      updateNonConformity: (id, updates) => {
        set((s) => ({
          nonConformities: s.nonConformities.map((nc) =>
            nc.id === id ? { ...nc, ...updates, updatedAt: new Date().toISOString() } : nc,
          ),
          pendingSync: [
            ...s.pendingSync,
            { id: crypto.randomUUID(), entity: 'quality_nc', type: 'update', recordId: id, payload: updates, retries: 0 },
          ],
        }))
        void get().flush()
      },

      removeNonConformity: (id) => {
        set((s) => ({
          nonConformities: s.nonConformities.filter((nc) => nc.id !== id),
          pendingSync: [
            ...s.pendingSync,
            { id: crypto.randomUUID(), entity: 'quality_nc', type: 'delete', recordId: id, retries: 0 },
          ],
        }))
        void get().flush()
      },

      loadDemoData: () => set({ fvss: MOCK_FVSS }),
      clearData:    () => set({ fvss: [], nonConformities: [], pendingSync: [], syncError: null }),

      // ─── Sync ────────────────────────────────────────────────────────────
      flush: async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          set({ syncStatus: 'offline' })
          return
        }
        const { profile, user } = useAuth.getState()
        if (!profile || !user) {
          set({ syncStatus: 'unauth' })
          return
        }

        const queue = get().pendingSync
        if (queue.length === 0) {
          set({ syncStatus: 'idle' })
          return
        }

        set({ syncStatus: 'syncing', syncError: null })
        const completed: string[] = []

        for (const op of queue) {
          try {
            const entity = op.entity ?? 'fvs'

            if (entity === 'quality_nc') {
              if (op.type === 'insert' && op.payload) {
                const row = qualityNcToRow(op.payload as QualityNonConformity, profile.organization_id, user.id)
                const { error } = await supabase.from('quality_non_conformities').insert(row as never)
                if (error) throw error
              }

              if (op.type === 'update') {
                const fullNc = get().nonConformities.find((nc) => nc.id === op.recordId)
                if (fullNc) {
                  const row = qualityNcToRow(fullNc, profile.organization_id, user.id)
                  const patch = {
                    nc_number: row.nc_number,
                    date:      row.date,
                    location:  row.location,
                    status:    row.status,
                    payload:   row.payload,
                  }
                  const { error } = await supabase
                    .from('quality_non_conformities')
                    .update(patch as never)
                    .eq('id', op.recordId)
                  if (error) throw error
                }
              }

              if (op.type === 'delete') {
                const { error } = await supabase
                  .from('quality_non_conformities')
                  .update({ deleted_at: new Date().toISOString() } as never)
                  .eq('id', op.recordId)
                if (error) throw error
              }

              completed.push(op.id)
              continue
            }

            if (op.type === 'insert' && op.payload) {
              const row = fvsToRow(op.payload as FVS, profile.organization_id, user.id)
              const { error } = await supabase.from('fvs').insert(row as never)
              if (error) throw error
            }

            if (op.type === 'update' && op.payload) {
              // Para update, mandamos só os campos que mudaram (mapeados para snake_case)
              const partial = op.payload as Partial<FVS>
              const rowPatch: Record<string, unknown> = {}
              if (partial.documentCode      !== undefined) rowPatch.document_code      = partial.documentCode
              if (partial.revision          !== undefined) rowPatch.revision           = partial.revision
              if (partial.identificationNo  !== undefined) rowPatch.identification_no  = partial.identificationNo || null
              if (partial.contractNo        !== undefined) rowPatch.contract_no        = partial.contractNo
              if (partial.date              !== undefined) rowPatch.date               = partial.date
              if (partial.ncRequired        !== undefined) rowPatch.nc_required        = partial.ncRequired
              if (partial.ncNumber          !== undefined) rowPatch.nc_number          = partial.ncNumber || null
              if (partial.responsibleLeader !== undefined) rowPatch.responsible_leader = partial.responsibleLeader || null
              if (partial.weldTrackingNo    !== undefined) rowPatch.weld_tracking_no   = partial.weldTrackingNo || null
              if (partial.welderSignature   !== undefined) rowPatch.welder_signature   = partial.welderSignature || null
              if (partial.qualitySignature  !== undefined) rowPatch.quality_signature  = partial.qualitySignature || null
              if (partial.logoId            !== undefined) rowPatch.logo_id            = partial.logoId ?? null
              if (partial.items || partial.problems || partial.fotos) {
                const fullFvs = get().fvss.find((f) => f.id === op.recordId)
                if (fullFvs) {
                  rowPatch.payload = { items: fullFvs.items, problems: fullFvs.problems, fotos: fullFvs.fotos ?? [] }
                }
              }
              const { error } = await supabase.from('fvs').update(rowPatch as never).eq('id', op.recordId)
              if (error) throw error
            }

            if (op.type === 'delete') {
              // DELETE de FVS sempre passa por aprovação
              const { error } = await supabase.rpc('request_action', {
                p_action_type:  'delete_fvs',
                p_target_table: 'fvs',
                p_target_id:    op.recordId,
                p_payload:      {},
              })
              if (error) throw error
            }

            completed.push(op.id)
          } catch (err) {
            console.warn('[qualidade:sync] op failed', op, err)
            const updated = { ...op, retries: op.retries + 1 }
            if (updated.retries >= 5) {
              completed.push(op.id)
              set({ syncError: err instanceof Error ? err.message : String(err) })
            } else {
              set((s) => ({
                pendingSync: s.pendingSync.map((p) => (p.id === op.id ? updated : p)),
              }))
            }
          }
        }

        set((s) => ({
          pendingSync:  s.pendingSync.filter((p) => !completed.includes(p.id)),
          syncStatus:   s.syncError ? 'error' : 'idle',
          lastSyncedAt: new Date().toISOString(),
        }))
      },

      pull: async () => {
        const { profile } = useAuth.getState()
        if (!profile) return
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          set({ syncStatus: 'offline' })
          return
        }
        set({ syncStatus: 'syncing' })
        const { data, error } = await supabase
          .from('fvs')
          .select('*')
          .order('number', { ascending: false })

        if (error) {
          set({ syncStatus: 'error', syncError: error.message })
          return
        }
        const items = (data as unknown as FvsRow[] | null)?.map(rowToFvs) ?? []

        const { data: ncData, error: ncError } = await supabase
          .from('quality_non_conformities')
          .select('*')
          .is('deleted_at', null)
          .order('date', { ascending: false })

        if (ncError) {
          console.warn('[qualidade:sync] quality_non_conformities pull skipped', ncError)
        }

        const nonConformities = ncError
          ? get().nonConformities
          : ((ncData as unknown as QualityNcRow[] | null)?.map(rowToQualityNc) ?? [])

        set({
          fvss: items,
          nonConformities,
          syncStatus: 'idle',
          lastSyncedAt: new Date().toISOString(),
          syncError: null,
        })
      },
    }),
    {
      name: 'cdata-qualidade',
      partialize: (state) => ({
        fvss:            state.fvss,
        nonConformities: state.nonConformities,
        pendingSync:     state.pendingSync,
        lastSyncedAt:    state.lastSyncedAt,
      }),
    },
  ),
)

// Auto-flush quando voltar online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useQualidadeStore.getState().flush()
  })
}
