/**
 * gestaoEquipamentosStore.ts — Sprint 5: migrado para Supabase via storeSync.
 * Tabela: equipamentos_manutencoes.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type { MaintenanceOrder, WorkOrderStatus } from '@/types'
import { mockMaintenanceOrders } from '@/data/mockGestaoEquipamentos'

function orderToRow(o: MaintenanceOrder, orgId: string, userId: string) {
  return {
    id:              o.id,
    organization_id: orgId,
    project_id:      null as string | null,
    equipment_id:    (o as { equipmentId?: string }).equipmentId ?? null,
    type:            (o as { type?: string }).type ?? null,
    status:          o.status ?? 'scheduled',
    scheduled_date:  (o as { scheduledDate?: string }).scheduledDate ?? null,
    payload:         o as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

interface GestaoState {
  orders: MaintenanceOrder[]
  editingOrderId: string | null

  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  addOrder:    (payload: Omit<MaintenanceOrder, 'id'>) => void
  updateOrder: (id: string, patch: Partial<MaintenanceOrder>) => void
  deleteOrder: (id: string) => void
  setEditingOrder: (id: string | null) => void
  loadDemoData: () => void
  clearData: () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useGestaoEquipamentosStore = create<GestaoState>()(
  persist(
    (set, get) => ({
      orders: [],
      editingOrderId: null,
      pendingSync:  [],
      syncStatus:   'idle',
      lastSyncedAt: null,
      syncError:    null,

      addOrder: (payload) => {
        const id = crypto.randomUUID()
        const newOrder: MaintenanceOrder = { id, ...payload }
        const { orgId, userId } = ctxAuth()
        set((s) => ({
          orders: [...s.orders, newOrder],
          pendingSync: [...s.pendingSync, makeOp({ entity: 'eq_manutencao', type: 'insert', recordId: id, row: orderToRow(newOrder, orgId, userId), table: 'equipamentos_manutencoes' })],
        }))
        void get().flush()
      },

      updateOrder: (id, patch) => {
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }))
        const target = get().orders.find((o) => o.id === id)
        if (target) {
          const { orgId, userId } = ctxAuth()
          const row = orderToRow(target, orgId, userId)
          const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
          set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'eq_manutencao', type: 'update', recordId: id, patch: updatePatch, table: 'equipamentos_manutencoes' })] }))
          void get().flush()
        }
      },

      deleteOrder: (id) => {
        set((s) => ({
          orders: s.orders.filter((o) => o.id !== id),
          pendingSync: [...s.pendingSync, makeOp({ entity: 'eq_manutencao', type: 'delete', recordId: id, table: 'equipamentos_manutencoes', approvalActionType: 'delete_equipamento_manutencao' })],
        }))
        void get().flush()
      },

      setEditingOrder: (id) => set({ editingOrderId: id }),

      loadDemoData: () => set({ orders: mockMaintenanceOrders }),
      clearData: () => set({ orders: [], pendingSync: [], syncError: null }),

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
        const rows = await pullTable<{ payload: MaintenanceOrder }>('equipamentos_manutencoes')
        if (rows) set({ orders: rows.map((r) => r.payload) })
        set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
      },
    }),
    {
      name: 'cdata-gestao-equipamentos',
      partialize: (s) => ({
        orders:       s.orders,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useGestaoEquipamentosStore.getState().flush()
  })
}

export function filterByStatus(orders: MaintenanceOrder[], status: WorkOrderStatus | 'all') {
  return status === 'all' ? orders : orders.filter((o) => o.status === status)
}
