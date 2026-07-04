/**
 * planoExecucaoStore — "Planejamento de Execução" (modo Compizzo).
 * Tabela: plano_execucao (colunas do cabeçalho + payload jsonb com cronograma/equipe/bonificação/condições).
 * Padrão de sync espelhado de gestao360Store (makeOp/flushQueue/pullTable + guarda pendingTables).
 * DELETE crítico via approval (delete_plano_execucao).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { useActiveObraStore } from '@/store/activeObraStore'
import { getTenantMarker } from '@/lib/tenantCache'
import type { PlanoExecucao } from '@/types'
import { faturamento } from '@/features/planejamento/utils/planoExecucao'

export const CONDICOES_PADRAO = [
  '• Horas Extras: Caso exista a necessidade de executar horas extras, o valor diário será descontado do valor total da bonificação, e o valor do VA + VT será pago no mês seguinte, no pagamento mensal no último dia útil do mês.',
  '• Não bater a meta: Será descontado o valor de Vale Alimentação e Vale Transporte do valor do bônus, sem afetar o salário.',
  '• Faltas: Serão descontadas no contracheque e o valor diário da tarefa será distribuído para a equipe presente.',
].join('\n')

// ─── Mapper ─────────────────────────────────────────────────────────────────
function planoToRow(p: PlanoExecucao, orgId: string, userId: string) {
  return {
    id:                   p.id,
    organization_id:      orgId,
    site_id:              p.siteId ?? null,
    periodo_inicio:       p.periodoInicio || null,
    periodo_fim:          p.periodoFim || null,
    area_m2:              p.areaM2 ?? 0,
    servico:              p.servico ?? null,
    preco_m2:             p.precoM2 ?? 0,
    faturamento_previsto: faturamento(p),
    status:               p.status ?? 'rascunho',
    payload:              p as unknown as Record<string, unknown>,
    created_by:           userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

interface PlanoExecucaoState {
  planos: PlanoExecucao[]
  editingId: string | null
  activeOrgId: string | null

  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  setEditing: (id: string | null) => void
  addPlano:    (initial?: Partial<PlanoExecucao>) => string
  updatePlano: (id: string, patch: Partial<Omit<PlanoExecucao, 'id'>>) => void
  duplicatePlano: (id: string) => string | null
  removePlano: (id: string) => void

  ensureTenantScope: (organizationId: string) => void
  clearData: () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const usePlanoExecucaoStore = create<PlanoExecucaoState>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))
      const enqueueUpdate = (id: string) => {
        const target = get().planos.find((p) => p.id === id)
        if (!target) return
        const { orgId, userId } = ctxAuth()
        const row = planoToRow(target, orgId, userId)
        const patch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'organization_id', 'created_by'].includes(k)))
        enqueue(makeOp({ entity: 'plano_execucao', type: 'update', recordId: id, patch, table: 'plano_execucao' }))
        void get().flush()
      }
      return {
        planos: [],
        editingId: null,
        activeOrgId: null,
        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        setEditing: (id) => set({ editingId: id }),

        addPlano: (initial) => {
          const id = crypto.randomUUID()
          const now = new Date().toISOString()
          const plano: PlanoExecucao = {
            id,
            siteId: initial?.siteId ?? useActiveObraStore.getState().activeObraId ?? null,
            obraNome: initial?.obraNome ?? '',
            periodoInicio: initial?.periodoInicio ?? '',
            periodoFim: initial?.periodoFim ?? '',
            areaM2: initial?.areaM2 ?? 0,
            servico: initial?.servico ?? 'Piso Epóxi + Demarcação',
            precoM2: initial?.precoM2 ?? 0,
            precoConfirmado: initial?.precoConfirmado ?? true,
            faturamentoOverride: initial?.faturamentoOverride ?? null,
            status: initial?.status ?? 'rascunho',
            cronograma: initial?.cronograma ?? [],
            equipe: initial?.equipe ?? [],
            bonificacao: initial?.bonificacao ?? [],
            condicoes: initial?.condicoes ?? CONDICOES_PADRAO,
            observacoes: initial?.observacoes ?? '',
            createdAt: now,
            updatedAt: now,
          }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            planos: [plano, ...s.planos],
            editingId: id,
            pendingSync: [...s.pendingSync, makeOp({ entity: 'plano_execucao', type: 'insert', recordId: id, row: planoToRow(plano, orgId, userId), table: 'plano_execucao' })],
          }))
          void get().flush()
          return id
        },

        updatePlano: (id, patch) => {
          set((s) => ({
            planos: s.planos.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)),
          }))
          enqueueUpdate(id)
        },

        duplicatePlano: (id) => {
          const src = get().planos.find((p) => p.id === id)
          if (!src) return null
          const newId = crypto.randomUUID()
          const now = new Date().toISOString()
          const copy: PlanoExecucao = {
            ...src,
            id: newId,
            obraNome: `${src.obraNome} (cópia)`,
            status: 'rascunho',
            createdAt: now,
            updatedAt: now,
          }
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            planos: [copy, ...s.planos],
            editingId: newId,
            pendingSync: [...s.pendingSync, makeOp({ entity: 'plano_execucao', type: 'insert', recordId: newId, row: planoToRow(copy, orgId, userId), table: 'plano_execucao' })],
          }))
          void get().flush()
          return newId
        },

        removePlano: (id) => {
          // Soft-delete: marca deleted_at (o pull filtra deleted_at IS NULL). Sem perda de dado.
          set((s) => ({
            planos: s.planos.filter((p) => p.id !== id),
            editingId: s.editingId === id ? null : s.editingId,
            pendingSync: [...s.pendingSync, makeOp({ entity: 'plano_execucao', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'plano_execucao' })],
          }))
          void get().flush()
        },

        // Isolamento multi-tenant: troca de organização limpa o local antes de re-pull.
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

        clearData: () => set({ planos: [], editingId: null, pendingSync: [], syncError: null }),

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
          // guarda anti-perda: se há op pendente para 'plano_execucao', não sobrescreve o local
          const rows = pendingTables.has('plano_execucao') ? null : await pullTable<{ payload: PlanoExecucao }>('plano_execucao')
          if (rows) set({ planos: rows.map((r) => r.payload) })
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-plano-execucao',
      partialize: (s) => ({
        planos:       s.planos,
        activeOrgId:  s.activeOrgId,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void usePlanoExecucaoStore.getState().flush()
  })
}
