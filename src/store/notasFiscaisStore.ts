/**
 * notasFiscaisStore — a aba "Nota Fiscal" do Financeiro.
 *
 * Local-first sincronizado (padrão payload jsonb) contra `financeiro_notas`.
 *
 * ─── POR QUE TABELA PRÓPRIA, E NÃO `financeiro_titulos` ───────────────────────
 * Um cupom fiscal não é um título: não tem vencimento, já nasce pago, e o
 * `PagamentosPanel` lista TODOS os títulos sem filtro — centenas de cupons de
 * restaurante entrariam na tela de Pagamentos e nos KPIs de "a vencer" e
 * "vencidas". A nota também tem ciclo próprio (arquivada → lançada), que
 * `status: pendente|pago|cancelado` não modela.
 *
 * ─── A IDENTIDADE É A CHAVE DE ACESSO ─────────────────────────────────────────
 * `id = seededId(orgId, 'nota-fiscal', chave44)`. Como o insert da fila vira
 * upsert por id, a mesma foto importada em dois celulares chega ao MESMO id e o
 * segundo upsert regrava a mesma linha. Não há índice único separado sobre a
 * chave: seria um segundo jeito de receber um 23505 sobre o mesmo fato.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import {
  flushQueue, makeFlushSerializer, makeOp, mergePull, pullTable,
  type PendingOp, type SyncStatus,
} from '@/lib/storeSync'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { hojeLocalISO } from '@/lib/utils'
import { podeEscreverTitulos } from '@/lib/roles'
import { lancamentoDaNota } from '@/features/financeiro/utils/notaFiscalConferencia'
import type { NotaFiscal } from '@/types'

const TABLE = 'financeiro_notas'

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

/**
 * As colunas promovidas existem para filtrar e agrupar no servidor sem abrir o
 * jsonb. O `payload` continua sendo a fonte — quem lê, lê dele.
 */
function notaToRow(n: NotaFiscal, orgId: string, userId: string) {
  return {
    id:              n.id,
    organization_id: orgId,
    obra_id:         n.obraId ?? null,
    chave_acesso:    n.chaveAcesso,
    cnpj_emitente:   n.cnpjEmitente,
    competencia:     n.competencia,
    status:          n.status,
    payload:         n as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}

interface NotasFiscaisState {
  notas: NotaFiscal[]

  /** Grava (ou regrava) uma nota. Upsert por id — reimportar substitui, não duplica. */
  salvarNota: (nota: NotaFiscal) => void
  salvarNotas: (notas: NotaFiscal[]) => void
  atualizarNota: (id: string, patch: Partial<NotaFiscal>) => void
  removerNota: (id: string) => void

  /** Gera a saída no Financeiro. Só quando a pessoa manda — nunca automático. */
  lancarNoFinanceiro: (id: string) => void
  desfazerLancamento: (id: string) => void

  loadDemoData: () => void
  clearData: () => void

  activeOrgId: string | null
  ensureTenantScope: (organizationId: string) => void
  pendingSync: PendingOp[]
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  syncError: string | null
  flush: () => Promise<void>
  pull: () => Promise<void>
}

const serializarFlush = makeFlushSerializer()

/**
 * Notas de exemplo — três fornecedores, para a sugestão por CNPJ se demonstrar.
 *
 * ⚠️ Sem `fotoPath`: nota de demonstração apontando para um caminho de bucket
 * vira imagem quebrada, porque o upload é bloqueado em Demonstração.
 */
function buildDemo(): NotaFiscal[] {
  const base: Array<[string, string, NotaFiscal['categoria'], string, number, string]> = [
    ['53260855737356000102650020000021871005967012', 'Restaurante Hora Extra', 'administrativo', 'alimentacao', 35, '2026-08-31'],
    ['53260811222333000181650010000004120012345678', 'Posto Central', 'equipamentos', 'combustivel', 412.9, '2026-08-28'],
    ['53260844555666000199650010000001880098765432', 'Tintas Sul', 'materiais', 'tinta', 1880, '2026-08-20'],
    ['53260844555666000199650010000002310011223344', 'Tintas Sul', 'materiais', 'tinta', 231.4, '2026-08-12'],
    ['53260811222333000181650010000005070055667788', 'Posto Central', 'equipamentos', 'combustivel', 507.2, '2026-08-05'],
  ]
  return base.map(([chave, emitente, categoria, etiqueta, valor, data], i) => ({
    id: `demo-nota-${i + 1}`,
    chaveAcesso: chave,
    cnpjEmitente: chave.slice(6, 20),
    modelo: '65',
    numero: String(Number(chave.slice(25, 34))),
    serie: String(Number(chave.slice(22, 25))),
    uf: 'DF',
    competencia: '2026-08',
    emitente,
    dataEmissao: data,
    valor,
    valorOrigem: 'manual' as const,
    categoria,
    etiqueta,
    categoriaConfirmadaEm: `${data}T12:00:00.000Z`,
    status: 'arquivada' as const,
    createdAt: `${data}T12:00:00.000Z`,
  }))
}

export const useNotasFiscaisStore = create<NotasFiscaisState>()(
  persist(
    (set, get) => {
      const enfileirarUpsert = (nota: NotaFiscal) => {
        const { orgId, userId } = ctxAuth()
        return makeOp({
          entity: 'nota_fiscal', type: 'insert', recordId: nota.id,
          row: notaToRow(nota, orgId, userId), table: TABLE,
        })
      }

      return {
        notas: [],

        salvarNota: (nota) => {
          if (!podeEscreverTitulos()) return
          get().salvarNotas([nota])
        },

        salvarNotas: (novas) => {
          if (!podeEscreverTitulos() || !novas.length) return
          set((s) => {
            const porId = new Map(s.notas.map((n) => [n.id, n]))
            for (const n of novas) porId.set(n.id, n)
            return {
              notas: [...porId.values()],
              // Um flush só para o lote inteiro: chamar `salvarNota` num laço faria
              // cada chamada levar um snapshot MAIOR da fila — 12 notas viravam
              // 78 requisições para a mesma gravação (o defeito que o boleto teve).
              pendingSync: [...s.pendingSync, ...novas.map(enfileirarUpsert)],
            }
          })
          void get().flush()
        },

        atualizarNota: (id, patch) => {
          if (!podeEscreverTitulos()) return
          const atual = get().notas.find((n) => n.id === id)
          if (!atual) return
          const atualizada = { ...atual, ...patch }
          set((s) => ({
            notas: s.notas.map((n) => (n.id === id ? atualizada : n)),
            pendingSync: [...s.pendingSync, enfileirarUpsert(atualizada)],
          }))
          void get().flush()
        },

        /** Soft delete: nunca `delete`, sempre `deleted_at`. */
        removerNota: (id) => {
          if (!podeEscreverTitulos()) return
          const alvo = get().notas.find((n) => n.id === id)
          // Apagar a nota tem de apagar junto o lançamento que ela gerou, senão a
          // despesa fica órfã na DRE sem nada que explique de onde veio.
          if (alvo?.entryId) useFinanceiroStore.getState().removeEntry(alvo.entryId)
          const agora = new Date().toISOString()
          set((s) => ({
            notas: s.notas.filter((n) => n.id !== id),
            pendingSync: [...s.pendingSync, makeOp({
              entity: 'nota_fiscal', type: 'update', recordId: id,
              patch: { deleted_at: agora, updated_at: agora }, table: TABLE,
            })],
          }))
          void get().flush()
        },

        lancarNoFinanceiro: (id) => {
          if (!podeEscreverTitulos()) return
          const nota = get().notas.find((n) => n.id === id)
          if (!nota || nota.status === 'lancada') return
          const { orgId, userId } = ctxAuth()
          const entry = lancamentoDaNota(nota, orgId, hojeLocalISO())
          // `respectObra: true`: o lançamento reflete a obra da NOTA, inclusive
          // "sem obra" — não deve herdar a obra ativa do contexto da tela.
          useFinanceiroStore.getState().addEntry(entry, { respectObra: true })
          get().atualizarNota(id, {
            status: 'lancada',
            entryId: entry.id,
            lancadaEm: new Date().toISOString(),
            lancadaPor: userId,
          })
        },

        desfazerLancamento: (id) => {
          if (!podeEscreverTitulos()) return
          const nota = get().notas.find((n) => n.id === id)
          if (!nota || nota.status !== 'lancada') return
          if (nota.entryId) useFinanceiroStore.getState().removeEntry(nota.entryId)
          get().atualizarNota(id, {
            status: 'arquivada',
            entryId: undefined,
            lancadaEm: undefined,
            lancadaPor: undefined,
          })
        },

        loadDemoData: () => set({ notas: buildDemo() }),
        clearData: () => set({ notas: [], pendingSync: [] }),

        // ── Sync ─────────────────────────────────────────────────────────
        activeOrgId: null,
        ensureTenantScope: (organizationId) => {
          const current = get().activeOrgId
          if (current === organizationId) return
          set({
            activeOrgId: organizationId,
            ...(current === null ? {} : { notas: [], pendingSync: [] }),
          })
        },

        pendingSync: [],
        syncStatus: 'idle',
        lastSyncedAt: null,
        syncError: null,

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
              .map((p) => (result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p)),
            syncStatus:   result.lastError ? 'error' : 'idle',
            lastSyncedAt: new Date().toISOString(),
            syncError:    result.lastError ?? null,
          }))
        }, () => get().pendingSync.length),

        pull: async () => {
          const rows = await pullTable<{ payload: NotaFiscal }>(TABLE)
          set((s) => ({
            notas: mergePull(rows?.map((r) => r.payload) ?? null, s.notas, s.pendingSync, TABLE),
            syncStatus: s.pendingSync.length > 0 && (s.syncStatus === 'error' || s.syncStatus === 'offline') ? s.syncStatus : 'idle',
            lastSyncedAt: new Date().toISOString(),
          }))
        },
      }
    },
    {
      name: 'cdata-notas-fiscais',
      partialize: (s) => ({
        notas:        s.notas,
        activeOrgId:  s.activeOrgId,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useNotasFiscaisStore.getState().flush()
  })
}
