import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeFlushSerializer, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { getTenantMarker } from '@/lib/tenantCache'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { custoDiaWorker, matchWorkerByName } from '@/features/mao-de-obra/utils/custoMaoObra'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { seededUuidLegado } from '@/lib/seededId'
import type { FinanceiroTab, FinanceiroEntry, Distribuicao, DreConfig, RDO } from '@/types'

export const DEFAULT_DRE_CONFIG: DreConfig = { deducaoPct: 0, mapping: {} }

/**
 * UUID determinístico a partir de uma semente (hash cyrb128 → formato uuid válido,
 * não é UUIDv4 "real", mas o tipo `uuid` do Postgres aceita). Serve para o feed
 * RDO→Financeiro: o mesmo (rdoId, categoria) gera SEMPRE o mesmo id → o upsert
 * substitui em vez de duplicar (idempotente inclusive entre dispositivos, sem
 * depender de ter puxado os lançamentos antes).
 */
const rdoEntryId = (rdoId: string, cat: 'materiais' | 'mao_de_obra') => seededUuidLegado(`rdo-fin:${rdoId}:${cat}`)

function moneyValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const text = String(value ?? '').trim()
  if (!text) return 0
  const clean = text
    .replace(/R\$\s?/g, '')
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
  if (!clean || clean === '-' || clean === ',' || clean === '.') return 0
  if (clean.includes(',') && clean.includes('.')) {
    return clean.lastIndexOf(',') > clean.lastIndexOf('.')
      ? parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
      : parseFloat(clean.replace(/,/g, '')) || 0
  }
  if (clean.includes(',')) return parseFloat(clean.replace(',', '.')) || 0
  return parseFloat(clean) || 0
}

// ─── Mappers Supabase ─────────────────────────────────────────────────────────
function ctx() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}
function entryToRow(e: FinanceiroEntry, orgId: string, userId: string) {
  return {
    id: e.id, organization_id: orgId, tipo: e.tipo, descricao: e.descricao,
    valor: e.valor, data: e.data, categoria: e.categoria,
    referencia: e.referencia ?? null, obra_id: e.obraId ?? null,
    payload: e as unknown as Record<string, unknown>, created_by: userId,
  }
}
function distToRow(d: Distribuicao, orgId: string, userId: string) {
  return {
    id: d.id, organization_id: orgId, obra_id: d.obraId ?? null,
    titulo: d.titulo, orcamento: d.orcamento,
    payload: d as unknown as Record<string, unknown>, created_by: userId,
  }
}

interface FinanceiroState {
  activeTab: FinanceiroTab
  setActiveTab: (tab: FinanceiroTab) => void

  entries: FinanceiroEntry[]
  /**
   * Adiciona um lançamento. Por padrão, se `obraId` não vier, herda a obra ativa
   * (conveniência do formulário manual). Passe `{ respectObra: true }` para usar
   * exatamente o `obraId` informado — inclusive `undefined` (ex.: baixa de título
   * explicitamente "sem obra" não deve ser carimbada com a obra ativa).
   */
  addEntry: (e: FinanceiroEntry, opts?: { respectObra?: boolean }) => void
  updateEntry: (id: string, patch: Partial<FinanceiroEntry>) => void
  removeEntry: (id: string) => void

  // Ponte RDO → Financeiro (custos realizados), idempotente por sourceRdoId.
  syncRdoToFinanceiro: (rdo: RDO) => void
  removeRdoEntries: (rdoId: string) => void

  // Distribuição de orçamento (por obra)
  distribuicoes: Distribuicao[]
  upsertDistribuicao: (d: Distribuicao) => void
  removeDistribuicao: (id: string) => void

  // Config da DRE simplificada (persistida localmente, sem migração)
  dreConfig: DreConfig
  setDreConfig: (patch: Partial<DreConfig>) => void

  getEntradas: () => FinanceiroEntry[]
  getSaidas: () => FinanceiroEntry[]
  getTotalEntradas: () => number
  getTotalSaidas: () => number
  getSaldo: () => number
  getMonthlyData: () => { month: string; entradas: number; saidas: number; saldo: number }[]
  loadDemoData: () => void
  clearData: () => void

  // Tenant scope + sync
  activeOrgId: string | null
  ensureTenantScope: (organizationId: string) => void
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useFinanceiroStore = create<FinanceiroState>()(
  persist(
    (set, get) => {
      const enqueue = (op: PendingOp) => set((s) => ({ pendingSync: [...s.pendingSync, op] }))
      const serializarFlush = makeFlushSerializer()
      return {
        activeTab: 'visao-geral',
        setActiveTab: (tab) => set({ activeTab: tab }),

        entries: [],
        addEntry: (e0, opts) => {
          // Default: vincula o lançamento à obra ativa, se o form não informou.
          // Com respectObra, usa o obraId como veio (inclusive undefined).
          const e = {
            ...e0,
            obraId: opts?.respectObra ? e0.obraId : (e0.obraId ?? useActiveObraStore.getState().activeObraId ?? undefined),
          }
          // Upsert por id local: ids aleatórios nunca colidem (comportamento idêntico);
          // ids determinísticos (feed do RDO) substituem em vez de duplicar.
          set((s) => ({ entries: [...s.entries.filter((x) => x.id !== e.id), e] }))
          const { orgId, userId } = ctx()
          enqueue(makeOp({ entity: 'financeiro_entry', type: 'insert', recordId: e.id, row: entryToRow(e, orgId, userId), table: 'financeiro_entries' }))
          void get().flush()
        },
        updateEntry: (id, patch) => {
          set((s) => ({ entries: s.entries.map((e) => e.id === id ? { ...e, ...patch } : e) }))
          const target = get().entries.find((e) => e.id === id)
          if (target) {
            const { orgId, userId } = ctx()
            const row = entryToRow(target, orgId, userId)
            const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'organization_id', 'created_by'].includes(k)))
            enqueue(makeOp({ entity: 'financeiro_entry', type: 'update', recordId: id, patch: updatePatch, table: 'financeiro_entries' }))
            void get().flush()
          }
        },
        removeEntry: (id) => {
          set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
          enqueue(makeOp({ entity: 'financeiro_entry', type: 'delete', recordId: id, table: 'financeiro_entries' }))
          void get().flush()
        },

        // Remove os lançamentos (materiais + mão de obra) gerados por um RDO.
        // Só apaga o que existe localmente (evita enfileirar delete-fantasma para
        // registros que nunca foram lançados — ex.: rascunho ou RDO sem custo).
        removeRdoEntries: (rdoId) => {
          const has = (id: string) => get().entries.some((e) => e.id === id)
          const matId = rdoEntryId(rdoId, 'materiais')
          const moId = rdoEntryId(rdoId, 'mao_de_obra')
          if (has(matId)) get().removeEntry(matId)
          if (has(moId)) get().removeEntry(moId)
        },

        // Ponte RDO → Financeiro: ao finalizar um RDO, lança os CUSTOS realizados
        // (materiais + mão de obra). Idempotente por id determinístico (re-finalizar/
        // editar SUBSTITUI via upsert; rascunho/exclusão REMOVE). Receita fica na
        // Medição/Execução (não duplica aqui). Por categoria é add XOR remove — nunca
        // delete+insert do mesmo id no mesmo tick (não colide com o coalescing).
        syncRdoToFinanceiro: (rdo) => {
          const finalizado = rdo.status !== 'rascunho'
          const nowIso = new Date().toISOString()
          const base = { data: rdo.date, obraId: rdo.siteId ?? undefined, referencia: `RDO #${rdo.number}`, sourceRdoId: rdo.id }

          // Materiais. ATENÇÃO: o RDO Compizzo grava a MESMA lista de materiais em
          // `rdo.materials` E `rdo.compizzo.materiais` — usar só uma fonte (senão dobra).
          // Compizzo → compizzo.materiais (qtd×custoUnitário); regular → rdo.materials.
          const materiais = rdo.compizzo
            ? (rdo.compizzo.materiais ?? []).reduce((s, m) => s + (parseLocaleNumber(m.quantidade) * (m.custoUnitario ?? 0)), 0)
            : (rdo.materials ?? []).reduce((s, m) => s + (m.totalCostBRL ?? ((Number(m.quantity) || 0) * (m.unitCostBRL ?? 0))), 0)
          const matId = rdoEntryId(rdo.id, 'materiais')
          if (finalizado && materiais > 0) {
            get().addEntry({ id: matId, tipo: 'saida', descricao: `Materiais — RDO #${rdo.number}`, valor: materiais, categoria: 'materiais', createdAt: nowIso, ...base }, { respectObra: true })
          } else if (get().entries.some((e) => e.id === matId)) {
            get().removeEntry(matId)
          }

          // Mão de obra: custo/dia por funcionário presente (mesma base dos apontamentos).
          const workers = useMaoDeObraStore.getState().workers
          const mo = (rdo.manpower?.employeeNames ?? []).reduce((s, name) => {
            const w = matchWorkerByName(name, workers)
            return s + (w ? custoDiaWorker(w) : 0)
          }, 0)
          const moId = rdoEntryId(rdo.id, 'mao_de_obra')
          if (finalizado && mo > 0) {
            get().addEntry({ id: moId, tipo: 'saida', descricao: `Mão de obra — RDO #${rdo.number}`, valor: mo, categoria: 'mao_de_obra', createdAt: nowIso, ...base }, { respectObra: true })
          } else if (get().entries.some((e) => e.id === moId)) {
            get().removeEntry(moId)
          }
        },

        distribuicoes: [],
        upsertDistribuicao: (d) => {
          const exists = get().distribuicoes.some((x) => x.id === d.id)
          set((s) => ({
            distribuicoes: exists
              ? s.distribuicoes.map((x) => x.id === d.id ? d : x)
              : [...s.distribuicoes, d],
          }))
          const { orgId, userId } = ctx()
          enqueue(makeOp({ entity: 'financeiro_distribuicao', type: 'insert', recordId: d.id, row: distToRow(d, orgId, userId), table: 'financeiro_distribuicoes' }))
          void get().flush()
        },
        removeDistribuicao: (id) => {
          set((s) => ({ distribuicoes: s.distribuicoes.filter((d) => d.id !== id) }))
          enqueue(makeOp({ entity: 'financeiro_distribuicao', type: 'delete', recordId: id, table: 'financeiro_distribuicoes' }))
          void get().flush()
        },

        dreConfig: DEFAULT_DRE_CONFIG,
        setDreConfig: (patch) => set((s) => ({ dreConfig: { ...s.dreConfig, ...patch } })),

        getEntradas: () => get().entries.filter((e) => e.tipo === 'entrada'),
        getSaidas: () => get().entries.filter((e) => e.tipo === 'saida'),
        getTotalEntradas: () => get().entries.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + moneyValue(e.valor), 0),
        getTotalSaidas: () => get().entries.filter((e) => e.tipo === 'saida').reduce((s, e) => s + moneyValue(e.valor), 0),
        getSaldo: () => {
          const ent = get().entries
          return ent.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + moneyValue(e.valor), 0) - ent.filter((e) => e.tipo === 'saida').reduce((s, e) => s + moneyValue(e.valor), 0)
        },

        loadDemoData: () => set({
          entries: [
            { id: 'fin-1', descricao: 'Medição #1 — Esgoto', tipo: 'entrada' as const, valor: 285000, data: '2026-01-15', categoria: 'medicao' as const, referencia: 'BOL-01', createdAt: '2026-01-15' },
            { id: 'fin-2', descricao: 'Medição #2 — Água', tipo: 'entrada' as const, valor: 142000, data: '2026-02-15', categoria: 'medicao' as const, referencia: 'BOL-02', createdAt: '2026-02-15' },
            { id: 'fin-3', descricao: 'Medição #3', tipo: 'entrada' as const, valor: 398000, data: '2026-03-15', categoria: 'medicao' as const, referencia: 'BOL-03', createdAt: '2026-03-15' },
            { id: 'fin-4', descricao: 'M.O. — Jan', tipo: 'saida' as const, valor: 95000, data: '2026-01-30', categoria: 'mao_de_obra' as const, createdAt: '2026-01-30' },
            { id: 'fin-5', descricao: 'M.O. — Fev', tipo: 'saida' as const, valor: 98000, data: '2026-02-28', categoria: 'mao_de_obra' as const, createdAt: '2026-02-28' },
            { id: 'fin-6', descricao: 'M.O. — Mar', tipo: 'saida' as const, valor: 102000, data: '2026-03-30', categoria: 'mao_de_obra' as const, createdAt: '2026-03-30' },
            { id: 'fin-7', descricao: 'Tubos PVC', tipo: 'saida' as const, valor: 67000, data: '2026-01-20', categoria: 'materiais' as const, referencia: 'OC-001', createdAt: '2026-01-20' },
            { id: 'fin-8', descricao: 'PEAD', tipo: 'saida' as const, valor: 43000, data: '2026-02-10', categoria: 'materiais' as const, referencia: 'OC-002', createdAt: '2026-02-10' },
            { id: 'fin-9', descricao: 'Aluguel escavadeira', tipo: 'saida' as const, valor: 32000, data: '2026-01-05', categoria: 'equipamentos' as const, createdAt: '2026-01-05' },
            { id: 'fin-10', descricao: 'Combustível', tipo: 'saida' as const, valor: 18500, data: '2026-02-25', categoria: 'equipamentos' as const, createdAt: '2026-02-25' },
          ],
          // Demo não sincroniza: zera a fila (ids demo não-uuid nunca podem virar ops reais).
          pendingSync: [],
        }),

        clearData: () => set({ entries: [], distribuicoes: [], dreConfig: DEFAULT_DRE_CONFIG, activeOrgId: null, pendingSync: [], syncError: null }),

        getMonthlyData: () => {
          const entries = get().entries
          const map = new Map<string, { entradas: number; saidas: number }>()
          for (const e of entries) {
            const month = e.data.slice(0, 7) // yyyy-MM
            if (!map.has(month)) map.set(month, { entradas: 0, saidas: 0 })
            const m = map.get(month)!
            if (e.tipo === 'entrada') m.entradas += moneyValue(e.valor)
            else m.saidas += moneyValue(e.valor)
          }
          let acc = 0
          return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, { entradas, saidas }]) => {
            acc += entradas - saidas
            return { month, entradas, saidas, saldo: acc }
          })
        },

        // ── Tenant scope + sync ──────────────────────────────────────────────
        activeOrgId: null,
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

        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        // Serializado: uma drenagem por vez (ver makeFlushSerializer). Baixar N parcelas de um
        // carnê gera N updateEntry seguidos; sem isso, cada um relançava a fila inteira.
        flush: async () => serializarFlush(async () => {
          const queue = get().pendingSync
          if (queue.length === 0) return
          if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
          const { profile } = useAuth.getState()
          if (!profile) { set({ syncStatus: 'unauth' }); return }
          set({ syncStatus: 'syncing', syncError: null })
          let result: Awaited<ReturnType<typeof flushQueue>>
          // Sem este catch, uma exceção inesperada deixaria syncStatus preso em 'syncing'.
          try { result = await flushQueue(queue) }
          catch (e) { set({ syncStatus: 'error', syncError: e instanceof Error ? e.message : 'Falha ao sincronizar.' }); return }
          set((s) => ({
            pendingSync: s.pendingSync
              .filter((p) => !result.completed.includes(p.id))
              .map((p) => result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p),
            syncStatus:   result.lastError ? 'error' : 'idle',
            lastSyncedAt: new Date().toISOString(),
            syncError:    result.lastError ?? null,
          }))
        }, () => get().pendingSync.length),

        pull: async () => {
          // Puxa cada tabela e MESCLA com o local via mergePull: registros com op
          // pendente ficam com a versão local (não-sincronizada) e o resto vem do
          // servidor — evita "congelar" a tabela inteira quando UMA op fica presa.
          const es = await pullTable<{ payload: FinanceiroEntry }>('financeiro_entries')
          const ds = await pullTable<{ payload: Distribuicao }>('financeiro_distribuicoes')
          set((s) => ({ entries: mergePull(es?.map((r) => r.payload) ?? null, s.entries, s.pendingSync, 'financeiro_entries') }))
          set((s) => ({ distribuicoes: mergePull(ds?.map((r) => r.payload) ?? null, s.distribuicoes, s.pendingSync, 'financeiro_distribuicoes') }))
          // Preserva o diagnóstico do flush enquanto sobrar op na fila: o pull vem logo depois
          // dele e agora roda sempre, então um 'idle' cego esconderia a op presa.
          set((s) => ({
            syncStatus:   s.pendingSync.length > 0 && (s.syncStatus === 'error' || s.syncStatus === 'offline') ? s.syncStatus : 'idle',
            lastSyncedAt: new Date().toISOString(),
          }))
        },
      }
    },
    {
      name: 'cdata-financeiro',
      version: 2,
      partialize: (s) => ({
        activeOrgId:   s.activeOrgId,
        entries:       s.entries,
        distribuicoes: s.distribuicoes,
        dreConfig:     s.dreConfig,
        pendingSync:   s.pendingSync,
        lastSyncedAt:  s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useFinanceiroStore.getState().flush()
  })
}
