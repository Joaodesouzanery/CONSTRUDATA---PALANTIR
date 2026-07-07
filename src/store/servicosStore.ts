/**
 * servicosStore — catálogo de Serviços por organização (nome, unidade, rendimento, custo).
 * Tabela: servicos (colunas id/organization_id + payload jsonb). Padrão de sync espelhado
 * de planoExecucaoStore (makeOp/flushQueue/pullTable + guarda pendingTables + ensureTenantScope).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { getTenantMarker } from '@/lib/tenantCache'
import type { Servico } from '@/types'

function servicoToRow(s: Servico, orgId: string, userId: string) {
  return {
    id:              s.id,
    organization_id: orgId,
    nome:            s.nome ?? null,
    unidade:         s.unidade ?? null,
    payload:         s as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

interface ServicosState {
  servicos: Servico[]
  activeOrgId: string | null

  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  addServico:    (initial?: Partial<Servico>) => string
  updateServico: (id: string, patch: Partial<Omit<Servico, 'id'>>) => void
  removeServico: (id: string) => void

  ensureTenantScope: (organizationId: string) => void
  clearData: () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useServicosStore = create<ServicosState>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))
      const enqueueUpdate = (id: string) => {
        const target = get().servicos.find((x) => x.id === id)
        if (!target) return
        const { orgId, userId } = ctxAuth()
        const row = servicoToRow(target, orgId, userId)
        const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'organization_id', 'created_by'].includes(k)))
        enqueue(makeOp({ entity: 'servico', type: 'update', recordId: id, patch, table: 'servicos' }))
        void get().flush()
      }
      return {
        servicos: [],
        activeOrgId: null,
        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        addServico: (initial) => {
          const id = crypto.randomUUID()
          const servico: Servico = {
            id,
            nome: initial?.nome ?? '',
            unidade: initial?.unidade ?? 'm²',
            rendimento: initial?.rendimento ?? 0,
            rendimentoBase: initial?.rendimentoBase ?? 'equipe',
            custoDiaPessoa: initial?.custoDiaPessoa ?? 0,
            ordem: initial?.ordem,
          }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            servicos: [...s.servicos, servico],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'servico', type: 'insert', recordId: id, row: servicoToRow(servico, orgId, userId), table: 'servicos' })],
          }))
          void get().flush()
          return id
        },

        updateServico: (id, patch) => {
          set((s) => ({ servicos: s.servicos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
          enqueueUpdate(id)
        },

        removeServico: (id) => {
          // Soft-delete: marca deleted_at (o pull filtra deleted_at IS NULL).
          set((s) => ({ servicos: s.servicos.filter((x) => x.id !== id) }))
          set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'servico', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'servicos' })] }))
          void get().flush()
        },

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

        clearData: () => set({ servicos: [], pendingSync: [], syncError: null }),

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
          const pendingTables = new Set(get().pendingSync.map((op) => op.table))
          const rows = pendingTables.has('servicos') ? null : await pullTable<{ payload: Servico }>('servicos')
          if (rows) set({ servicos: rows.map((r) => r.payload) })
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-servicos',
      partialize: (s) => ({
        servicos:     s.servicos,
        activeOrgId:  s.activeOrgId,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useServicosStore.getState().flush()
  })
}
