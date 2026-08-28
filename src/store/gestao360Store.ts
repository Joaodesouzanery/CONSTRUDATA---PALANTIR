/**
 * Gestão de Projeto 360 — Sprint 6: migrado para Supabase via storeSync.
 *
 * Tabelas: change_orders, change_order_photos.
 * Photos: binário no Supabase Storage bucket project-documents/ prefix change-orders/.
 * DELETE de ordem de mudança é soft delete direto (`deleted_at`). Passava por aprovação, que só
 * abria um pedido e não apagava nada — a OM voltava no pull seguinte.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { uploadFile, removeFile } from '@/lib/storage'
import type { ChangeOrder, ChangeOrderPhoto, ChangeOrderStatus, ChangeOrderType } from '@/types'
import { MOCK_CHANGE_ORDERS } from '@/data/mockGestao360'
import { periodoDe, type Periodo } from '@/lib/periodo'
import { hojeLocalISO } from '@/lib/utils'

/**
 * As abas do módulo.
 *
 * `relatorio360` saiu: aquela aba era permanentemente vazia — nenhuma tela do app cria um
 * `DailyReport`, então ela só sabia mostrar "Nenhum relatório encontrado para esta data". No lugar
 * dela entrou `gestao-a-vista`, que é o quadro que o gestor de obra realmente usa.
 */
export type Gestao360Tab = 'dashboard' | 'daily-report' | 'jobacosting' | 'changeorders' | 'gestao-a-vista'

// ─── Mappers ──────────────────────────────────────────────────────────────────
function changeOrderToRow(co: ChangeOrder, orgId: string, userId: string) {
  return {
    id:              co.id,
    organization_id: orgId,
    project_id:      co.projectId ?? null,
    project_code:    co.projectCode ?? null,
    title:           co.title ?? null,
    type:            co.type ?? null,
    status:          co.status ?? 'draft',
    impact_cost_brl: co.impactCostBRL ?? null,
    impact_days:     co.impactDays ?? null,
    submitted_at:    co.submittedAt ?? null,
    payload:         co as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

interface Gestao360State {
  activeOrgId: string | null
  changeOrders:      ChangeOrder[]
  selectedProjectId: string | null
  activeTab:         Gestao360Tab
  /**
   * O período que a reunião está olhando.
   *
   * Fica no store, e não no componente, porque as abas trocam de tela: escolher a quinzena no
   * Radar e voltar para o Custo em Tempo Real com o mês corrente seria trocar o assunto no meio
   * da reunião. Persiste junto do resto (ver `partialize`).
   */
  periodo:           Periodo

  // Sync
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  ensureTenantScope: (organizationId: string) => void
  selectProject: (id: string | null) => void
  setActiveTab:  (tab: Gestao360Tab) => void
  setPeriodo:    (p: Periodo) => void

  addChangeOrder: (co: {
    projectId: string
    projectCode: string
    title: string
    type: ChangeOrderType
    description: string
    impactCostBRL: number
    impactDays: number
    submittedBy: string
    linkedModule?: string
    linkedEntityId?: string
  }) => string

  submitChangeOrder:  (id: string) => void
  reviewChangeOrder:  (id: string, decision: 'approved' | 'rejected', reviewer: string, notes: string) => void
  /** Faz upload do file pro Storage e enfileira insert em change_order_photos. */
  uploadPhoto:        (orderId: string, file: File, label?: string) => Promise<void>
  /** Versão legada/manual: aceita um photo já com base64/path. */
  addPhoto:           (orderId: string, photo: Omit<ChangeOrderPhoto, 'id'>) => void
  deleteChangeOrder:  (id: string) => void

  loadDemoData: () => void
  clearData:    () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useGestao360Store = create<Gestao360State>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))
      const enqueueCoUpdate = (id: string) => {
        const target = get().changeOrders.find((co) => co.id === id)
        if (!target) return
        const { orgId, userId } = ctxAuth()
        const row = changeOrderToRow(target, orgId, userId)
        const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
        enqueue(makeOp({ entity: 'co', type: 'update', recordId: id, patch, table: 'change_orders' }))
        void get().flush()
      }
      return {
        activeOrgId:       null,
        changeOrders:      [],
        selectedProjectId: null,
        activeTab:         'dashboard',
        // A semana corrente é o padrão: é o ciclo da reunião de obra.
        periodo:           periodoDe('semana'),
        pendingSync:       [],
        syncStatus:        'idle',
        lastSyncedAt:      null,
        syncError:         null,

        ensureTenantScope: (organizationId) => {
          if (!organizationId || get().activeOrgId === organizationId) return
          set({
            activeOrgId: organizationId,
            changeOrders: [],
            selectedProjectId: null,
            pendingSync: [],
            syncStatus: 'idle',
            syncError: null,
          })
        },

        selectProject: (id) => set({ selectedProjectId: id }),
        setPeriodo:    (p) => set({ periodo: p }),
        setActiveTab:  (tab) => set({ activeTab: tab }),

        addChangeOrder: (payload) => {
          const id = crypto.randomUUID()
          const now = new Date().toISOString()
          const co: ChangeOrder = {
            ...payload,
            id,
            status: 'draft' as ChangeOrderStatus,
            photos: [],
            submittedAt: now,
          }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            changeOrders: [co, ...s.changeOrders],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'co', type: 'insert', recordId: id, row: changeOrderToRow(co, orgId, userId), table: 'change_orders' })],
          }))
          void get().flush()
          return id
        },

        submitChangeOrder: (id) => {
          set((s) => ({
            changeOrders: s.changeOrders.map((co) =>
              co.id === id ? { ...co, status: 'submitted' } : co
            ),
          }))
          enqueueCoUpdate(id)
        },

        reviewChangeOrder: (id, decision, reviewer, notes) => {
          const now = new Date().toISOString()
          set((s) => ({
            changeOrders: s.changeOrders.map((co) =>
              co.id === id
                ? { ...co, status: decision, reviewedBy: reviewer, reviewedAt: now, reviewNotes: notes }
                : co
            ),
          }))
          enqueueCoUpdate(id)
        },

        uploadPhoto: async (orderId, file, label) => {
          const result = await uploadFile('project-documents', file, `change-orders/${orderId}`)
          if (!result) return
          const photoId = crypto.randomUUID()
          const photoMeta: ChangeOrderPhoto = {
            id:         photoId,
            base64:     '',  // some — substituído por storage_path
            label:      label ?? file.name,
            capturedAt: new Date().toISOString(),
          }
          // anexa storagePath via cast
          ;(photoMeta as unknown as { storagePath: string }).storagePath = result.path

          const { orgId, userId } = ctxAuth()
          set((s) => ({
            changeOrders: s.changeOrders.map((co) =>
              co.id === orderId ? { ...co, photos: [...co.photos, photoMeta] } : co
            ),
            pendingSync: [
              ...s.pendingSync,
              makeOp({
                entity: 'co_photo',
                type:   'insert',
                recordId: photoId,
                row: {
                  id:              photoId,
                  organization_id: orgId,
                  change_order_id: orderId,
                  storage_path:    result.path,
                  payload:         { label: photoMeta.label, capturedAt: photoMeta.capturedAt },
                  created_by:      userId,
                },
                table: 'change_order_photos',
              }),
            ],
          }))
          void get().flush()
        },

        addPhoto: (orderId, photo) => {
          // Versão legada: só adiciona local. Sem sync (use uploadPhoto para sync real).
          const photoWithId: ChangeOrderPhoto = { ...photo, id: crypto.randomUUID() }
          set((s) => ({
            changeOrders: s.changeOrders.map((co) =>
              co.id === orderId ? { ...co, photos: [...co.photos, photoWithId] } : co
            ),
          }))
        },

        deleteChangeOrder: (id) => {
          // Limpa fotos do Storage best-effort
          const target = get().changeOrders.find((co) => co.id === id)
          if (target) {
            for (const p of target.photos) {
              const sp = (p as unknown as { storagePath?: string }).storagePath
              if (sp) void removeFile('project-documents', sp)
            }
          }
          set((s) => ({
            changeOrders: s.changeOrders.filter((co) => co.id !== id),
            // Era `type: 'delete'` com `approvalActionType`, que chama o RPC `request_action`:
            // aquilo só CRIA UM PEDIDO em `pending_actions` e não apaga nada. A op saía da fila
            // como concluída e o change order voltava no pull seguinte — reaparecia na lista e o
            // impacto de custo/prazo dele voltava a somar no Gestão 360. Numa empresa que usa uma
            // conta só não há segundo aprovador (`approve_pending_action` proíbe autoaprovação),
            // então excluir era impossível. A RLS aceita o soft delete direto (`co_update_role`).
            pendingSync: [...s.pendingSync, makeOp({ entity: 'co', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'change_orders' })],
          }))
          void get().flush()
        },

        loadDemoData: () => {
          import('./projetosStore').then(({ useProjetosStore }) => {
            const projects = useProjetosStore.getState().projects
            const firstId  = projects[0]?.id ?? null
            set({ changeOrders: MOCK_CHANGE_ORDERS, selectedProjectId: firstId })
          })
        },

        clearData: () => set({ activeOrgId: null, changeOrders: [], selectedProjectId: null, pendingSync: [], syncError: null }),

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
          const { profile } = useAuth.getState()
          if (!profile) {
            set({ syncStatus: 'unauth' })
            return
          }
          get().ensureTenantScope(profile.organization_id)
          // mergePull: puxa sempre e MESCLA — atualiza os change_orders sem op pendente
          // com o servidor e preserva os COM op pendente (local não-sincronizado).
          const rows = await pullTable<{ payload: ChangeOrder }>('change_orders')
          set((s) => ({ changeOrders: mergePull(rows?.map((r) => r.payload) ?? null, s.changeOrders, s.pendingSync, 'change_orders') }))
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-gestao-360',
      partialize: (s) => ({
        activeOrgId:       s.activeOrgId,
        changeOrders:      s.changeOrders,
        selectedProjectId: s.selectedProjectId,
        periodo:           s.periodo,
        pendingSync:       s.pendingSync,
        lastSyncedAt:      s.lastSyncedAt,
      }),

      /**
       * Período salvo que já venceu volta a ser o de agora.
       *
       * Guardar o período é certo — trocar de aba não pode trocar o assunto no meio da reunião. Mas
       * ele era reidratado cru: na segunda-feira seguinte a tela abria na SEMANA PASSADA, com o
       * rótulo correto e o número errado para quem esperava "esta semana". O rótulo certo é o pior
       * dos dois mundos: não parece defeito, parece que a obra não produziu.
       *
       * Um período de granularidade fixa (semana, quinzena, mês, trimestre) que já terminou é
       * recalculado para o ciclo corrente. O intervalo LIVRE é preservado: ali a data foi escolhida
       * à mão, e mexer nela seria desfazer o que a pessoa pediu.
       */
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Gestao360State>
        const salvo = p.periodo
        const venceu = salvo && salvo.tipo !== 'livre' && salvo.ate < hojeLocalISO()
        return {
          ...current,
          ...p,
          periodo: venceu ? periodoDe(salvo.tipo) : (salvo ?? current.periodo),
        }
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useGestao360Store.getState().flush()
  })
}
