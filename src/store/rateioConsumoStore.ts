/**
 * rateioConsumoStore.ts — "Rateio de Consumo" do módulo Predial (adaptação de domínio
 * do submeter-billback: rateio de fatura de água/energia entre unidades/obras).
 * Local-first tenant-synced (padrão payload jsonb do financeiroTitulosStore) contra a
 * tabela rateio_consumo. Aprovar pode gerar cobranças (títulos a receber) no Financeiro,
 * e desfazer as remove.
 *
 * A cobrança tem id DERIVADO de (organização, rateio, unidade, geração) — ver seededId. O
 * guard por `cobrancaTituloIds` só protege o dispositivo que gerou; sem id derivado, quem
 * ainda não tinha puxado emitia o conjunto inteiro de novo e o condomínio recebia a cobrança
 * em dobro. A `geração` existe porque o título é apagado por soft-delete e a policy de update
 * proíbe reviver a linha: desfazer avança a geração, e a emissão seguinte usa ids novos.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { useFinanceiroTitulosStore } from '@/store/financeiroTitulosStore'
import { seededId } from '@/lib/seededId'
import type { RateioConsumo, RateioStatus, FinanceiroTitulo } from '@/types'

const TABLE = 'rateio_consumo'

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}
function toRow(r: RateioConsumo, orgId: string, userId: string) {
  return { id: r.id, organization_id: orgId, payload: r as unknown as Record<string, unknown>, created_by: userId }
}

/**
 * Rateio da fatura entre os itens (id → valor em R$), com alocação de MAIOR RESTO:
 * cada item recebe o piso em centavos e os centavos restantes vão aos maiores
 * fracionários → Σ dos valores == valorTotalFatura EXATAMENTE (sem residual de
 * arredondamento). Base = leitura/área/proporção (a fórmula é a mesma).
 */
export function rateioValores(r: Pick<RateioConsumo, 'valorTotalFatura' | 'itens'>): Record<string, number> {
  const totalBase = r.itens.reduce((s, it) => s + (Number(it.base) || 0), 0)
  if (totalBase <= 0) return Object.fromEntries(r.itens.map((it) => [it.id, 0]))
  const totalCents = Math.round(r.valorTotalFatura * 100)
  const parts = r.itens.map((it) => {
    const exact = (totalCents * (Number(it.base) || 0)) / totalBase
    const cents = Math.floor(exact)
    return { id: it.id, cents, frac: exact - cents }
  })
  let resto = totalCents - parts.reduce((s, p) => s + p.cents, 0)
  // Distribui os centavos restantes aos maiores fracionários (mutação por referência).
  for (const p of [...parts].sort((a, b) => b.frac - a.frac)) { if (resto <= 0) break; p.cents += 1; resto-- }
  return Object.fromEntries(parts.map((p) => [p.id, p.cents / 100]))
}

interface RateioConsumoState {
  rateios: RateioConsumo[]

  addRateio: (r: Omit<RateioConsumo, 'id' | 'createdAt' | 'status'> & { status?: RateioStatus }) => void
  updateRateio: (id: string, patch: Partial<RateioConsumo>) => void
  removeRateio: (id: string) => void
  setStatus: (id: string, status: RateioStatus) => void
  /** Gera títulos a receber (um por item com valor > 0) no Financeiro e aprova. Idempotente. */
  gerarCobrancas: (id: string) => void
  /** Remove as cobranças geradas e volta para "revisar". */
  desfazerCobrancas: (id: string) => void

  loadDemoData: () => void
  clearData: () => void

  activeOrgId:  string | null
  ensureTenantScope: (organizationId: string) => void
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

function buildDemo(): RateioConsumo[] {
  const now = new Date().toISOString()
  const periodo = now.slice(0, 7)
  const mk = (r: Omit<RateioConsumo, 'createdAt'>): RateioConsumo => ({ ...r, createdAt: now })
  return [
    mk({ id: crypto.randomUUID(), periodo, tipo: 'agua', descricao: 'Fatura de água — condomínio', fornecedor: 'SABESP', valorTotalFatura: 12_400, base: 'leitura', status: 'revisar', itens: [
      { id: crypto.randomUUID(), unidade: 'Bloco A', base: 320 },
      { id: crypto.randomUUID(), unidade: 'Bloco B', base: 280 },
      { id: crypto.randomUUID(), unidade: 'Área comum', base: 140 },
    ] }),
    mk({ id: crypto.randomUUID(), periodo, tipo: 'energia', descricao: 'Energia — canteiro', fornecedor: 'Enel', valorTotalFatura: 8_900, base: 'proporcao', status: 'processando', itens: [
      { id: crypto.randomUUID(), unidade: 'Obra Norte', base: 60 },
      { id: crypto.randomUUID(), unidade: 'Obra Sul', base: 40 },
    ] }),
  ]
}

export const useRateioConsumoStore = create<RateioConsumoState>()(
  persist(
    (set, get) => {
      const enqueueInsert = (r: RateioConsumo) => {
        const { orgId, userId } = ctxAuth()
        return makeOp({ entity: 'rateio_consumo', type: 'insert', recordId: r.id, row: toRow(r, orgId, userId), table: TABLE })
      }
      const enqueueUpdate = (r: RateioConsumo) =>
        makeOp({ entity: 'rateio_consumo', type: 'update', recordId: r.id, patch: { payload: r as unknown as Record<string, unknown>, updated_at: new Date().toISOString() }, table: TABLE })

      return {
        rateios: [],

        addRateio: (input) => {
          const r: RateioConsumo = { ...input, id: crypto.randomUUID(), status: input.status ?? 'processando', createdAt: new Date().toISOString() }
          set((s) => ({ rateios: [r, ...s.rateios], pendingSync: [...s.pendingSync, enqueueInsert(r)] }))
          void get().flush()
        },

        updateRateio: (id, patch) => {
          set((s) => ({ rateios: s.rateios.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
          const target = get().rateios.find((r) => r.id === id)
          if (target) { set((s) => ({ pendingSync: [...s.pendingSync, enqueueUpdate(target)] })); void get().flush() }
        },

        removeRateio: (id) => {
          // Remove cobranças geradas antes de excluir o rateio (não deixa título órfão).
          const r = get().rateios.find((x) => x.id === id)
          if (r?.cobrancaTituloIds?.length) useFinanceiroTitulosStore.getState().removeTitulos(r.cobrancaTituloIds)
          const nowIso = new Date().toISOString()
          set((s) => ({
            rateios: s.rateios.filter((x) => x.id !== id),
            pendingSync: [...s.pendingSync, makeOp({ entity: 'rateio_consumo', type: 'update', recordId: id, patch: { deleted_at: nowIso, updated_at: nowIso }, table: TABLE })],
          }))
          void get().flush()
        },

        setStatus: (id, status) => get().updateRateio(id, { status }),

        gerarCobrancas: (id) => {
          const r = get().rateios.find((x) => x.id === id)
          if (!r || (r.cobrancaTituloIds?.length ?? 0) > 0) return   // guard: já geradas (idempotente por dispositivo)
          const nowIso = new Date().toISOString()
          // Vencimento = dia 10 do mês SEGUINTE ao período (fatura vence no mês seguinte).
          const [py, pm] = r.periodo.split('-').map(Number)
          const vencimento = `${pm === 12 ? py + 1 : py}-${String(pm === 12 ? 1 : pm + 1).padStart(2, '0')}-10`
          const vals = rateioValores(r)
          // Id DERIVADO de (organização, rateio, unidade, geração), não sorteado. O guard acima
          // só vale por dispositivo: quem não puxou ainda gerava o conjunto inteiro de novo, com
          // ids diferentes — o condomínio recebia DUAS cobranças por unidade e os títulos do
          // primeiro viravam órfãos (o `cobrancaTituloIds` é sobrescrito por inteiro). Derivado,
          // os dois lados chegam ao mesmo id e o upsert regrava a mesma linha.
          // A geração entra na semente porque o título é apagado por soft-delete: sem ela,
          // desfazer e gerar de novo tentaria reviver uma linha com `deleted_at`, que a policy
          // de update proíbe.
          const geracao = r.cobrancaGeracao ?? 0
          const { orgId } = ctxAuth()
          const titulos: FinanceiroTitulo[] = r.itens
            .filter((it) => (vals[it.id] ?? 0) > 0)
            .map((it) => ({
              id: seededId(orgId, 'rateio-cobranca', r.id, it.id, String(geracao)),
              tipo: 'receber',
              descricao: `Rateio ${r.tipo === 'agua' ? 'água' : 'energia'} ${r.periodo} — ${it.unidade}`,
              parceiro: it.unidade,
              valor: vals[it.id],
              vencimento,
              obraId: it.obraId,
              categoria: 'outro',
              referencia: `Rateio ${r.id.slice(0, 8)}`,
              status: 'pendente',
              createdAt: nowIso,
            }))
          if (titulos.length === 0) return
          useFinanceiroTitulosStore.getState().upsertTitulos(titulos)
          get().updateRateio(id, { cobrancaTituloIds: titulos.map((t) => t.id), status: 'aprovado' })
        },

        desfazerCobrancas: (id) => {
          const r = get().rateios.find((x) => x.id === id)
          if (!r?.cobrancaTituloIds?.length) return
          useFinanceiroTitulosStore.getState().removeTitulos(r.cobrancaTituloIds)
          // Avança a geração: a próxima emissão precisa de ids novos, porque estes ficaram
          // soft-deletados e a policy de update não deixa revivê-los.
          get().updateRateio(id, {
            cobrancaTituloIds: undefined,
            cobrancaGeracao: (r.cobrancaGeracao ?? 0) + 1,
            status: 'revisar',
          })
        },

        loadDemoData: () => set({ rateios: buildDemo() }),
        clearData: () => set({ rateios: [], pendingSync: [], syncError: null }),

        activeOrgId: null,
        ensureTenantScope: (organizationId) => {
          const current = get().activeOrgId
          if (current === organizationId) return
          set({ activeOrgId: organizationId, ...(current === null ? {} : { rateios: [], pendingSync: [] }) })
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
          // Sempre puxa e MESCLA: preserva os rateios com op pendente (ainda não
          // sincronizados) e atualiza o resto com o servidor — nunca congela a tabela.
          const rows = await pullTable<{ payload: RateioConsumo }>(TABLE)
          set((s) => ({ rateios: mergePull(rows?.map((r) => r.payload) ?? null, s.rateios, s.pendingSync, TABLE) }))
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-rateio-consumo',
      partialize: (s) => ({ rateios: s.rateios, activeOrgId: s.activeOrgId, pendingSync: s.pendingSync, lastSyncedAt: s.lastSyncedAt }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void useRateioConsumoStore.getState().flush() })
}
