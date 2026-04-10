/**
 * equipamentosStore.ts — Sprint 5: migrado para Supabase via storeSync.
 * Tabela: equipamentos. Alerts ficam no payload jsonb.
 * DELETE crítico via approval (delete_equipamento).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type { EquipmentAlert, EquipmentProfile } from '@/types'
import { mockEquipamentos } from '@/data/mockEquipamentos'

// ─── Mappers ──────────────────────────────────────────────────────────────────
function equipToRow(e: EquipmentProfile, orgId: string, userId: string) {
  return {
    id:              e.id,
    organization_id: orgId,
    project_id:      (e as { projectId?: string }).projectId ?? null,
    code:            e.code ?? null,
    name:            e.name ?? null,
    type:            e.type ?? null,
    status:          e.status ?? 'idle',
    lat:             (e as { lat?: number | null }).lat ?? null,
    lng:             (e as { lng?: number | null }).lng ?? null,
    site_name:       (e as { siteName?: string }).siteName ?? null,
    payload:         e as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

interface EquipamentosState {
  equipamentos: EquipmentProfile[]
  selectedId: string | null
  editingId: string | null

  // Sync
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  addEquipamento: (eq: Omit<EquipmentProfile, 'id' | 'alerts'>) => void
  updateEquipamento: (id: string, updates: Partial<Omit<EquipmentProfile, 'id' | 'alerts'>>) => void
  deleteEquipamento: (id: string) => void
  updateLocation: (id: string, lat: number, lng: number) => void
  acknowledgeAlert: (equipmentId: string, alertId: string) => void
  addAlert: (equipmentId: string, alert: Omit<EquipmentAlert, 'id' | 'equipmentId' | 'timestamp' | 'acknowledged'>) => void
  selectEquipamento: (id: string | null) => void
  setEditing: (id: string | null) => void
  loadDemoData: () => void
  clearData: () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useEquipamentosStore = create<EquipamentosState>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))
      const enqueueUpdateOf = (id: string) => {
        const target = get().equipamentos.find((e) => e.id === id)
        if (!target) return
        const { orgId, userId } = ctxAuth()
        const row = equipToRow(target, orgId, userId)
        const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
        enqueue(makeOp({ entity: 'equipamento', type: 'update', recordId: id, patch, table: 'equipamentos' }))
        void get().flush()
      }
      return {
        equipamentos: [],
        selectedId: null,
        editingId: null,
        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        addEquipamento: (eq) => {
          const id = crypto.randomUUID()
          const newEq: EquipmentProfile = { ...eq, id, alerts: [] }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            equipamentos: [...s.equipamentos, newEq],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'equipamento', type: 'insert', recordId: id, row: equipToRow(newEq, orgId, userId), table: 'equipamentos' })],
          }))
          void get().flush()
        },

        updateEquipamento: (id, updates) => {
          set((s) => ({ equipamentos: s.equipamentos.map((e) => (e.id === id ? { ...e, ...updates } : e)) }))
          enqueueUpdateOf(id)
        },

        deleteEquipamento: (id) => {
          set((s) => ({
            equipamentos: s.equipamentos.filter((e) => e.id !== id),
            selectedId: s.selectedId === id ? null : s.selectedId,
            editingId:  s.editingId === id ? null : s.editingId,
            pendingSync: [...s.pendingSync, makeOp({ entity: 'equipamento', type: 'delete', recordId: id, table: 'equipamentos', approvalActionType: 'delete_equipamento' })],
          }))
          void get().flush()
        },

        updateLocation: (id, lat, lng) => {
          set((s) => ({ equipamentos: s.equipamentos.map((e) => (e.id === id ? { ...e, lat, lng } : e)) }))
          enqueueUpdateOf(id)
        },

        acknowledgeAlert: (equipmentId, alertId) => {
          set((s) => ({
            equipamentos: s.equipamentos.map((e) =>
              e.id !== equipmentId ? e : {
                ...e,
                alerts: e.alerts.map((a) => a.id === alertId ? { ...a, acknowledged: true } : a),
              }
            ),
          }))
          enqueueUpdateOf(equipmentId)
        },

        addAlert: (equipmentId, alert) => {
          set((s) => ({
            equipamentos: s.equipamentos.map((e) =>
              e.id !== equipmentId ? e : {
                ...e,
                alerts: [...e.alerts, { ...alert, id: crypto.randomUUID(), equipmentId, timestamp: new Date().toISOString(), acknowledged: false }],
              }
            ),
          }))
          enqueueUpdateOf(equipmentId)
        },

        selectEquipamento: (id) => set({ selectedId: id }),
        setEditing: (id) => set({ editingId: id }),

        loadDemoData: () => set({ equipamentos: mockEquipamentos }),
        clearData: () => set({ equipamentos: [], selectedId: null, pendingSync: [], syncError: null }),

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
          const rows = await pullTable<{ payload: EquipmentProfile }>('equipamentos')
          if (rows) set({ equipamentos: rows.map((r) => r.payload) })
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-equipamentos',
      partialize: (s) => ({
        equipamentos: s.equipamentos,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useEquipamentosStore.getState().flush()
  })
}
