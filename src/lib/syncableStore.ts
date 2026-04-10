/**
 * syncableStore.ts — Factory genérico de Zustand store com sync
 * local-first ↔ Supabase.
 *
 * Padrão "local-first":
 *   1. Toda mutação aplica imediatamente em memória + localStorage (optimistic)
 *   2. A operação é enfileirada em pendingSync[]
 *   3. Quando online, a fila é drenada para o Supabase
 *   4. Pull periódico (30s) traz mudanças remotas + Realtime push
 *
 * Conflict resolution v1: last-write-wins por updated_at.
 * v2: CRDT.
 *
 * Uso:
 *   const useFvsStore = createSyncableStore<FVS>({
 *     name: 'cdata-fvs',
 *     table: 'fvs',
 *     mapToRow: (fvs) => ({ ...fvs, payload: { items: fvs.items, problems: fvs.problems } }),
 *     mapFromRow: (row) => ({ ...row, items: row.payload.items, problems: row.payload.problems }),
 *   })
 */
import { create, type StateCreator } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from './supabase'
import { useAuth } from './auth'

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

export interface PendingOp<T> {
  id:        string                 // uuid local da operação
  type:      'insert' | 'update' | 'delete'
  recordId:  string                 // id do registro
  payload?:  Partial<T>             // dados para insert/update
  createdAt: string
  retries:   number
}

export interface SyncableState<T extends { id: string; updated_at?: string }> {
  items:         T[]
  pendingSync:   PendingOp<T>[]
  lastSyncedAt:  string | null
  syncStatus:    SyncStatus
  error:         string | null

  // CRUD otimista
  add:    (item: T)                       => void
  update: (id: string, patch: Partial<T>) => void
  remove: (id: string)                    => void

  // Sync
  flush:  () => Promise<void>
  pull:   () => Promise<void>
  reset:  () => void
}

interface CreateSyncableStoreOpts<T, Row> {
  name:        string                                   // chave do localStorage
  table:       string                                   // nome da tabela no Supabase
  mapToRow:    (item: T, orgId: string, userId: string) => Row
  mapFromRow:  (row: Row) => T
  /** Se true, DELETE pede aprovação via RPC request_action em vez de DELETE direto. */
  deleteRequiresApproval?: boolean
  approvalActionType?:     string                       // ex.: 'delete_fvs'
}

export function createSyncableStore<
  T extends { id: string; updated_at?: string },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Row extends Record<string, any> = any,
>(opts: CreateSyncableStoreOpts<T, Row>) {
  const {
    name,
    table,
    mapToRow,
    mapFromRow,
    deleteRequiresApproval = false,
    approvalActionType,
  } = opts

  const initializer: StateCreator<SyncableState<T>> = (set, get) => ({
    items:        [],
    pendingSync:  [],
    lastSyncedAt: null,
    syncStatus:   'idle',
    error:        null,

    add: (item) => {
      set((s) => ({
        items: [...s.items, item],
        pendingSync: [
          ...s.pendingSync,
          { id: crypto.randomUUID(), type: 'insert', recordId: item.id, payload: item, createdAt: new Date().toISOString(), retries: 0 },
        ],
      }))
      void get().flush()
    },

    update: (id, patch) => {
      set((s) => ({
        items: s.items.map((it) => (it.id === id ? { ...it, ...patch, updated_at: new Date().toISOString() } as T : it)),
        pendingSync: [
          ...s.pendingSync,
          { id: crypto.randomUUID(), type: 'update', recordId: id, payload: patch, createdAt: new Date().toISOString(), retries: 0 },
        ],
      }))
      void get().flush()
    },

    remove: (id) => {
      set((s) => ({
        items: s.items.filter((it) => it.id !== id),
        pendingSync: [
          ...s.pendingSync,
          { id: crypto.randomUUID(), type: 'delete', recordId: id, createdAt: new Date().toISOString(), retries: 0 },
        ],
      }))
      void get().flush()
    },

    flush: async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        set({ syncStatus: 'offline' })
        return
      }
      const profile = useAuth.getState().profile
      const user    = useAuth.getState().user
      if (!profile || !user) {
        // Não autenticado: mantém na fila local até logar
        return
      }

      const queue = get().pendingSync
      if (queue.length === 0) return

      set({ syncStatus: 'syncing', error: null })

      const completed: string[] = []

      for (const op of queue) {
        try {
          if (op.type === 'insert' && op.payload) {
            const row = mapToRow(op.payload as T, profile.organization_id, user.id)
            const { error } = await supabase.from(table).insert(row as never)
            if (error) throw error
          }

          if (op.type === 'update' && op.payload) {
            const row = mapToRow({ ...op.payload, id: op.recordId } as T, profile.organization_id, user.id)
            // Remove organization_id e created_by do update (imutáveis)
            const { organization_id: _o, created_by: _c, id: _i, ...rest } = row
            void _o; void _c; void _i
            const { error } = await supabase.from(table).update(rest as never).eq('id', op.recordId)
            if (error) throw error
          }

          if (op.type === 'delete') {
            if (deleteRequiresApproval && approvalActionType) {
              const { error } = await supabase.rpc('request_action', {
                p_action_type:  approvalActionType,
                p_target_table: table,
                p_target_id:    op.recordId,
                p_payload:      {},
              })
              if (error) throw error
              // Re-adiciona na lista local (delete só efetiva após aprovação)
              const pulled = await supabase.from(table).select('*').eq('id', op.recordId).maybeSingle()
              if (pulled.data) {
                const row = pulled.data as unknown as Row
                set((s) => ({ items: [...s.items.filter((i) => i.id !== op.recordId), mapFromRow(row)] }))
              }
            } else {
              const { error } = await supabase.from(table).delete().eq('id', op.recordId)
              if (error) throw error
            }
          }

          completed.push(op.id)
        } catch (err) {
          console.warn(`[sync:${table}] op failed`, op, err)
          // Marca retry; após 5 tentativas, drop e seta error
          const updated = { ...op, retries: op.retries + 1 }
          if (updated.retries >= 5) {
            completed.push(op.id) // dá up
            set({ error: err instanceof Error ? err.message : String(err) })
          } else {
            set((s) => ({
              pendingSync: s.pendingSync.map((p) => (p.id === op.id ? updated : p)),
            }))
          }
        }
      }

      set((s) => ({
        pendingSync:  s.pendingSync.filter((p) => !completed.includes(p.id)),
        syncStatus:   s.error ? 'error' : 'idle',
        lastSyncedAt: new Date().toISOString(),
      }))
    },

    pull: async () => {
      const profile = useAuth.getState().profile
      if (!profile) return
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        set({ syncStatus: 'offline' })
        return
      }
      set({ syncStatus: 'syncing' })
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        set({ syncStatus: 'error', error: error.message })
        return
      }

      const items = (data as Row[] | null)?.map(mapFromRow) ?? []
      set({ items, syncStatus: 'idle', lastSyncedAt: new Date().toISOString(), error: null })
    },

    reset: () => set({ items: [], pendingSync: [], lastSyncedAt: null, syncStatus: 'idle', error: null }),
  })

  const useStore = create<SyncableState<T>>()(
    persist(initializer, {
      name,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items:        state.items,
        pendingSync:  state.pendingSync,
        lastSyncedAt: state.lastSyncedAt,
      }),
    }),
  )

  // Auto-flush quando voltar online
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      void useStore.getState().flush()
    })
    // Pull periódico
    setInterval(() => {
      const auth = useAuth.getState()
      if (auth.session && !document.hidden) {
        void useStore.getState().pull()
      }
    }, 30_000)
  }

  return useStore
}
