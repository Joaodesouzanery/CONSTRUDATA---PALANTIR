/**
 * financeiroTitulosStore.ts — Contas a pagar / a receber ("Pagamentos e
 * Cobranças") do módulo Financeiro. Local-first tenant-synced (padrão
 * payload jsonb do manejoFinanceiroStore) contra a tabela financeiro_titulos.
 *
 * A "baixa" de um título gera um FinanceiroEntry no financeiroStore
 * (saída p/ 'pagar', entrada p/ 'receber') — assim o realizado do Fluxo/DRE
 * reflete o pagamento sem duplicar dados.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { useFinanceiroStore } from '@/store/financeiroStore'
import type { FinanceiroTitulo, FinanceiroEntry, EntradaCategoria, SaidaCategoria } from '@/types'

const TABLE = 'financeiro_titulos'

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

function tituloToRow(t: FinanceiroTitulo, orgId: string, userId: string) {
  return {
    id:              t.id,
    organization_id: orgId,
    payload:         t as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}

/** Categoria default do lançamento gerado na baixa, por tipo. */
function baixaCategoria(t: FinanceiroTitulo): EntradaCategoria | SaidaCategoria {
  if (t.categoria) return t.categoria
  return t.tipo === 'receber' ? 'medicao' : 'outro'
}

interface FinanceiroTitulosState {
  titulos: FinanceiroTitulo[]

  addTitulo:  (t: Omit<FinanceiroTitulo, 'id' | 'createdAt' | 'status'> & { status?: FinanceiroTitulo['status'] }) => void
  addTitulos: (list: Array<Omit<FinanceiroTitulo, 'id' | 'createdAt' | 'status'> & { status?: FinanceiroTitulo['status'] }>) => void
  updateTitulo: (id: string, patch: Partial<FinanceiroTitulo>) => void
  removeTitulo: (id: string) => void
  /** Marca como pago e gera o lançamento correspondente no Financeiro. */
  baixarTitulo: (id: string, opts?: { dataPagamento?: string }) => void
  /** Desfaz a baixa: remove o lançamento gerado e volta a pendente. */
  desfazerBaixa: (id: string) => void

  loadDemoData: () => void
  clearData: () => void

  // Sync
  activeOrgId:  string | null
  ensureTenantScope: (organizationId: string) => void
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

function buildDemo(): FinanceiroTitulo[] {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const plus = (days: number) => {
    const d = new Date(today + 'T00:00:00')
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }
  const mk = (t: Omit<FinanceiroTitulo, 'createdAt'>): FinanceiroTitulo => ({ ...t, createdAt: now })
  return [
    mk({ id: crypto.randomUUID(), tipo: 'receber', descricao: 'Medição #4 — Esgoto', parceiro: 'SABESP', valor: 412_000, vencimento: plus(8), emissao: plus(-6), numeroDoc: 'MED-04', categoria: 'medicao', status: 'pendente' }),
    mk({ id: crypto.randomUUID(), tipo: 'receber', descricao: 'Reajuste contratual 2026', parceiro: 'SABESP', valor: 96_500, vencimento: plus(22), numeroDoc: 'REAJ-01', categoria: 'reajuste', status: 'pendente' }),
    mk({ id: crypto.randomUUID(), tipo: 'pagar', descricao: 'Tubos PEAD DN200 — parcela 2/3', parceiro: 'Tigre Tubos', valor: 58_900, vencimento: plus(-3), emissao: plus(-33), numeroDoc: 'NF-8841', categoria: 'materiais', parcelaNum: 2, parcelaDe: 3, status: 'pendente' }),
    mk({ id: crypto.randomUUID(), tipo: 'pagar', descricao: 'Locação escavadeira — mensal', parceiro: 'Locabras', valor: 32_000, vencimento: plus(5), numeroDoc: 'NF-2231', categoria: 'equipamentos', status: 'pendente' }),
    mk({ id: crypto.randomUUID(), tipo: 'pagar', descricao: 'Folha subempreiteiro — frente rede', parceiro: 'Construrede ME', valor: 128_400, vencimento: plus(2), categoria: 'subempreiteiros', status: 'pendente' }),
    mk({ id: crypto.randomUUID(), tipo: 'pagar', descricao: 'Energia canteiro avançado', parceiro: 'Enel', valor: 7_850, vencimento: plus(-12), numeroDoc: 'FAT-0091', categoria: 'administrativo', status: 'pendente' }),
  ]
}

export const useFinanceiroTitulosStore = create<FinanceiroTitulosState>()(
  persist(
    (set, get) => {
      const enqueueInsert = (t: FinanceiroTitulo) => {
        const { orgId, userId } = ctxAuth()
        return makeOp({ entity: 'financeiro_titulo', type: 'insert', recordId: t.id, row: tituloToRow(t, orgId, userId), table: TABLE })
      }
      const enqueueUpdate = (t: FinanceiroTitulo) =>
        makeOp({ entity: 'financeiro_titulo', type: 'update', recordId: t.id, patch: { payload: t as unknown as Record<string, unknown>, updated_at: new Date().toISOString() }, table: TABLE })

      return {
        titulos: [],

        addTitulo: (input) => {
          const t: FinanceiroTitulo = { ...input, id: crypto.randomUUID(), status: input.status ?? 'pendente', createdAt: new Date().toISOString() }
          set((s) => ({ titulos: [t, ...s.titulos], pendingSync: [...s.pendingSync, enqueueInsert(t)] }))
          void get().flush()
        },

        addTitulos: (list) => {
          if (list.length === 0) return
          const nowIso = new Date().toISOString()
          const novos: FinanceiroTitulo[] = list.map((input) => ({ ...input, id: crypto.randomUUID(), status: input.status ?? 'pendente', createdAt: nowIso }))
          set((s) => ({ titulos: [...novos, ...s.titulos], pendingSync: [...s.pendingSync, ...novos.map(enqueueInsert)] }))
          void get().flush()
        },

        updateTitulo: (id, patch) => {
          set((s) => ({ titulos: s.titulos.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))
          const target = get().titulos.find((t) => t.id === id)
          if (target) {
            set((s) => ({ pendingSync: [...s.pendingSync, enqueueUpdate(target)] }))
            // Mantém o lançamento gerado na baixa em sincronia com o título.
            // Só reflete campos que definem o lançamento (evita disparar na própria baixa).
            const ENTRY_FIELDS = ['valor', 'categoria', 'descricao', 'obraId', 'numeroDoc', 'tipo'] as const
            if (target.status === 'pago' && target.entryId && ENTRY_FIELDS.some((k) => k in patch)) {
              useFinanceiroStore.getState().updateEntry(target.entryId, {
                tipo: target.tipo === 'pagar' ? 'saida' : 'entrada',
                descricao: target.descricao,
                valor: target.valor,
                categoria: baixaCategoria(target),
                referencia: target.numeroDoc,
                obraId: target.obraId,
              })
            }
            void get().flush()
          }
        },

        removeTitulo: (id) => {
          // Se o título já foi baixado, remove também o lançamento gerado (senão
          // fica um movimento "fantasma" somando no Fluxo/DRE sem título de origem).
          const alvo = get().titulos.find((t) => t.id === id)
          if (alvo?.entryId) useFinanceiroStore.getState().removeEntry(alvo.entryId)
          // Soft-delete: update de deleted_at (flushQueue trata sem .select()).
          const nowIso = new Date().toISOString()
          set((s) => ({
            titulos: s.titulos.filter((t) => t.id !== id),
            pendingSync: [...s.pendingSync, makeOp({ entity: 'financeiro_titulo', type: 'update', recordId: id, patch: { deleted_at: nowIso, updated_at: nowIso }, table: TABLE })],
          }))
          void get().flush()
        },

        baixarTitulo: (id, opts) => {
          const t = get().titulos.find((x) => x.id === id)
          if (!t || t.status === 'pago') return
          const dataPagamento = opts?.dataPagamento ?? new Date().toISOString().slice(0, 10)
          const entryId = crypto.randomUUID()
          const entry: FinanceiroEntry = {
            id: entryId,
            tipo: t.tipo === 'pagar' ? 'saida' : 'entrada',
            descricao: t.descricao,
            valor: t.valor,
            data: dataPagamento,
            categoria: baixaCategoria(t),
            referencia: t.numeroDoc,
            obraId: t.obraId,
            createdAt: new Date().toISOString(),
          }
          useFinanceiroStore.getState().addEntry(entry)
          get().updateTitulo(id, { status: 'pago', dataPagamento, entryId })
        },

        desfazerBaixa: (id) => {
          const t = get().titulos.find((x) => x.id === id)
          if (!t) return
          if (t.entryId) useFinanceiroStore.getState().removeEntry(t.entryId)
          get().updateTitulo(id, { status: 'pendente', dataPagamento: undefined, entryId: undefined })
        },

        loadDemoData: () => set({ titulos: buildDemo() }),
        clearData: () => set({ titulos: [], pendingSync: [], syncError: null }),

        // ── Sync ─────────────────────────────────────────────────────────
        activeOrgId: null,
        ensureTenantScope: (organizationId) => {
          const current = get().activeOrgId
          if (current === organizationId) return
          set({
            activeOrgId: organizationId,
            ...(current === null ? {} : { titulos: [], pendingSync: [] }),
          })
        },

        pendingSync: [],
        syncStatus: 'idle',
        lastSyncedAt: null,
        syncError: null,

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
              .map((p) => (result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p)),
            syncStatus:   result.lastError ? 'error' : 'idle',
            lastSyncedAt: new Date().toISOString(),
            syncError:    result.lastError ?? null,
          }))
        },

        pull: async () => {
          const pendingTables = new Set(get().pendingSync.map((op) => op.table))
          if (pendingTables.has(TABLE)) { set({ syncStatus: 'idle' }); return }
          const rows = await pullTable<{ payload: FinanceiroTitulo }>(TABLE)
          if (rows) set({ titulos: rows.map((r) => r.payload) })
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-financeiro-titulos',
      partialize: (s) => ({
        titulos:      s.titulos,
        activeOrgId:  s.activeOrgId,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useFinanceiroTitulosStore.getState().flush()
  })
}
