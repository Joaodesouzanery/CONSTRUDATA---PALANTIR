/**
 * fcpStore — os planos de Fluxo de Caixa Projetado.
 *
 * Tabela `fcp_planos` (id/organization_id/obra_id/nome/status + payload jsonb), no padrão de sync
 * do `servicosStore`.
 *
 * ⚠️ **Só as ENTRADAS são gravadas.** Premissas e produção realizada moram no payload; tudo que o
 * motor calcula — semanal, mensal, econômico, viabilidade, capital — é derivado na hora. Guardar
 * número calculado é convite para ele envelhecer e discordar da própria conta.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeFlushSerializer, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { getTenantMarker } from '@/lib/tenantCache'
import type { PremissasFcp } from '@/features/financeiro/utils/fcp/tipos'
import type { PrecoDoContrato } from '@/features/financeiro/utils/fcp/importarFcp'
import type { PrecosConfirmados } from '@/features/financeiro/utils/fcp/precosConfirmados'

/** rascunho → enviado → aprovado. A tela trava a edição a partir de 'aprovado'. */
export type StatusDoPlano = 'rascunho' | 'enviado' | 'aprovado'

export interface PlanoFcp {
  id: string
  nome: string
  obraId?: string
  status: StatusDoPlano
  premissas: PremissasFcp
  /** Produção lançada por cidade e por semana. Semana sem lançamento usa o previsto. */
  realizado: Record<string, Record<number, number | undefined>>
  /**
   * A tabela de preços do contrato, por cidade, como veio da planilha.
   *
   * Fica guardada porque é referência que a equipe consulta — e porque os itens transcritos de
   * foto vêm marcados "conferir", e essa marca não pode se perder na importação.
   */
  precos?: Record<string, PrecoDoContrato[]>
  /**
   * Confirmações dos preços "a conferir", por chave composta — À PARTE dos preços, porque a
   * reimportação sobrescreve `precos` inteiro. Ver `precosConfirmados.ts`. Vive no `payload jsonb`:
   * campo novo, sem migração.
   */
  precosConfirmados?: PrecosConfirmados
  criadoEm: string
  /**
   * Com que versão do motor este plano foi calculado. Ausente = 1 (antes de a versão existir).
   *
   * Não muda a conta: a projeção é sempre recalculada com o motor de agora. Existe para a tela
   * poder dizer que o número mudou desde a aprovação — ver `VERSAO_DO_MOTOR`.
   */
  versaoDoMotor?: number
  /** Quem enviou e quem aprovou — o log tem o resto, isto é o que a tela mostra. */
  enviadoPor?: string
  enviadoEm?: string
  aprovadoPor?: string
  aprovadoEm?: string
}

function planoToRow(p: PlanoFcp, orgId: string, userId: string) {
  return {
    id:              p.id,
    organization_id: orgId,
    obra_id:         p.obraId ?? null,
    nome:            p.nome ?? '',
    status:          p.status,
    payload:         p as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

interface FcpState {
  planos: PlanoFcp[]
  activeOrgId: string | null

  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  addPlano:    (plano: PlanoFcp) => void
  updatePlano: (id: string, patch: Partial<Omit<PlanoFcp, 'id'>>) => void
  removePlano: (id: string) => void
  /** Lança a produção de uma semana. É a única escrita frequente. */
  lancarProducao: (planoId: string, cidadeId: string, semana: number, valor: number | undefined) => void

  ensureTenantScope: (organizationId: string) => void
  loadDemoData: () => void
  clearData: () => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

export const useFcpStore = create<FcpState>()(
  persist(
    (set, get) => {
      // ⚠️ Uma drenagem por vez. Lançar produção semana a semana dispara um `flush` por lançamento,
      // e sem isto eles rodavam concorrentes sobre a MESMA fila: o `set` do primeiro a terminar
      // reescrevia `pendingSync` a partir de um retrato já velho, ressuscitando op já enviada e
      // perdendo op recém-enfileirada. É o mesmo serializador que o `financeiroStore` usa.
      const serializarFlush = makeFlushSerializer()
      const enqueueUpdate = (id: string) => {
        const alvo = get().planos.find((x) => x.id === id)
        if (!alvo) return
        const { orgId, userId } = ctxAuth()
        const row = planoToRow(alvo, orgId, userId)
        const patch = Object.fromEntries(
          Object.entries(row).filter(([k]) => !['id', 'organization_id', 'created_by'].includes(k)),
        )
        set((s) => ({
          pendingSync: [...s.pendingSync, makeOp({ entity: 'fcp-plano', type: 'update', recordId: id, patch, table: 'fcp_planos' })],
        }))
        void get().flush()
      }

      return {
        planos: [],
        activeOrgId: null,
        pendingSync:  [],
        syncStatus:   'idle',
        lastSyncedAt: null,
        syncError:    null,

        addPlano: (plano) => {
          const { orgId, userId } = ctxAuth()
          set((s) => ({
            // Upsert por id: reimportar a mesma planilha atualiza o plano em vez de criar outro.
            planos: [...s.planos.filter((x) => x.id !== plano.id), plano],
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fcp-plano', type: 'insert', recordId: plano.id, row: planoToRow(plano, orgId, userId), table: 'fcp_planos' })],
          }))
          void get().flush()
        },

        updatePlano: (id, patch) => {
          set((s) => ({ planos: s.planos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
          enqueueUpdate(id)
        },

        removePlano: (id) => {
          // Soft delete: o pull filtra `deleted_at IS NULL`.
          set((s) => ({ planos: s.planos.filter((x) => x.id !== id) }))
          set((s) => ({
            pendingSync: [...s.pendingSync, makeOp({ entity: 'fcp-plano', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'fcp_planos' })],
          }))
          void get().flush()
        },

        lancarProducao: (planoId, cidadeId, semana, valor) => {
          set((s) => ({
            planos: s.planos.map((p) => {
              if (p.id !== planoId) return p
              const daCidade = { ...(p.realizado[cidadeId] ?? {}) }
              // `undefined` apaga o lançamento — a semana volta a usar o previsto, e é o que
              // desfazer um número digitado errado tem de fazer.
              if (valor === undefined || !Number.isFinite(valor)) delete daCidade[semana]
              else daCidade[semana] = valor
              return { ...p, realizado: { ...p.realizado, [cidadeId]: daCidade } }
            }),
          }))
          enqueueUpdate(planoId)
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

        // ⚠️ Modo Demonstração: nasce VAZIO de propósito. Um plano de fluxo de caixa inventado
        // seria um número de capital falso na tela da diretoria — o pior tipo de dado de demo.
        loadDemoData: () => set({ planos: [] }),

        clearData: () => set({ planos: [], pendingSync: [], syncError: null }),

        flush: async () => serializarFlush(async () => {
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
        }, () => get().pendingSync.length),

        pull: async () => {
          const rows = await pullTable<{ payload: PlanoFcp }>('fcp_planos')
          set((s) => ({ planos: mergePull(rows?.map((r) => r.payload) ?? null, s.planos, s.pendingSync, 'fcp_planos') }))
          set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
        },
      }
    },
    {
      name: 'cdata-fcp',
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
    void useFcpStore.getState().flush()
  })
}
