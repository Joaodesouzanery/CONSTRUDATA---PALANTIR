/**
 * diasSemProducaoStore — "não teve produção hoje", por obra e por dia.
 *
 * ─── POR QUE ISTO NÃO É UM RDO ────────────────────────────────────────────────────────────────
 * O painel de alertas cobra um RDO por obra em todo dia útil. Mas obra para: chove, a área não é
 * liberada, falta material. Sem um jeito de justificar, o gestor aprende a ignorar o alerta
 * vermelho — e alerta que se ignora não vale nada.
 *
 * A tentação é gravar um RDO com `semProducao: true` e reusar tudo que já existe. Esse
 * experimento JÁ FOI FEITO neste código e falhou: `status: 'rascunho'` é exatamente um RDO
 * fantasma com flag, tem predicado pronto (`isRdoFinalized`), e é honrado em TRÊS lugares — os
 * outros ~20 consumidores contam rascunho, inclusive hoje em produção. Um invariante de 1 bit que
 * o projeto não sustenta em 20 consumidores não vai sustentar o segundo. Fora que o trigger
 * `trg_assign_rdo_number` queimaria um número sequencial de RDO, e o torna imutável no UPDATE:
 * num contrato fiscalizado, "RDO nº 47 = não teve produção" é irreversível.
 *
 * Daí a tabela separada, com nome deliberadamente longe de "rdo" para ninguém dar `join` nela nos
 * agregados de RDO daqui a seis meses.
 *
 * Local-first no padrão do projeto (molde: `laudosStore`): escrita otimista + `pendingSync` +
 * `flush()` com retry. Tabela `public.obra_dias_sem_producao`.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { flushQueue, mergePull, makeOp, changedColumns, type PendingOp } from '@/lib/storeSync'
import { seededUuidLegado } from '@/lib/seededId'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import { canWriteRdo } from '@/lib/roles'

const TABLE = 'obra_dias_sem_producao'

/** As causas que uma obra realmente para. "outros" abre o campo de texto. */
export const MOTIVOS_SEM_PRODUCAO = [
  { id: 'chuva',            label: 'Chuva' },
  { id: 'area_nao_liberada', label: 'Área não liberada' },
  { id: 'falta_material',   label: 'Falta de material' },
  { id: 'equipamento',      label: 'Equipamento parado' },
  { id: 'sem_efetivo',      label: 'Sem efetivo' },
  { id: 'feriado',          label: 'Feriado / ponto facultativo' },
  { id: 'outros',           label: 'Outro' },
] as const

export type MotivoSemProducao = (typeof MOTIVOS_SEM_PRODUCAO)[number]['id']

export const rotuloMotivo = (id: string): string =>
  MOTIVOS_SEM_PRODUCAO.find((m) => m.id === id)?.label ?? id

export interface DiaSemProducao {
  id: string
  siteId: string
  /** yyyy-MM-dd no fuso LOCAL — nunca `toISOString()`. */
  data: string
  categoria: MotivoSemProducao
  /** Texto livre; obrigatório quando a categoria é "outros". */
  motivo?: string
  registradoPor?: string
  createdAt: string
  updatedAt: string
}

type Row = {
  id: string
  organization_id: string
  site_id: string
  data: string
  payload: { categoria?: MotivoSemProducao; motivo?: string; registradoPor?: string } | null
  created_at: string
  updated_at: string
}

/**
 * Id DETERMINÍSTICO a partir de obra + dia.
 *
 * Com id aleatório, dois aparelhos offline marcando a mesma obra no mesmo dia gerariam dois ids,
 * o segundo colidiria com o índice único (23505) e a operação ficaria presa na fila para sempre —
 * o `flush` deste projeto não tem teto de tentativas. Com id derivado, os dois produzem a MESMA
 * linha e o upsert resolve sozinho.
 */
export const idDiaSemProducao = (siteId: string, data: string): string =>
  seededUuidLegado(`sem-prod:${siteId}:${data}`)

function contexto() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? null, userId: user?.id ?? null, nome: profile?.full_name ?? null }
}

const asDia = (row: Row): DiaSemProducao => ({
  id: row.id,
  siteId: row.site_id,
  data: row.data,
  categoria: row.payload?.categoria ?? 'outros',
  motivo: row.payload?.motivo,
  registradoPor: row.payload?.registradoPor,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const linha = (d: DiaSemProducao, orgId: string, userId: string): Record<string, unknown> => ({
  id: d.id,
  organization_id: orgId,
  site_id: d.siteId,
  data: d.data,
  payload: { categoria: d.categoria, motivo: d.motivo, registradoPor: d.registradoPor },
  created_by: userId,
})

interface Estado {
  activeOrgId: string | null
  dias: DiaSemProducao[]
  pendingSync: PendingOp[]
  syncStatus: 'idle' | 'syncing' | 'offline' | 'unauth' | 'error'
  syncError: string | null
  lastSyncedAt: string | null
  ensureTenantScope: (organizationId: string) => void
  clearData: () => void
  loadDemoData: () => void
  flush: () => Promise<void>
  pull: () => Promise<void>
  marcar: (entrada: { siteId: string; data: string; categoria: MotivoSemProducao; motivo?: string }) => string | null
  desmarcar: (id: string) => void
}

export const useDiasSemProducaoStore = create<Estado>()(
  persist(
    (set, get) => ({
      activeOrgId: null,
      dias: [],
      pendingSync: [],
      syncStatus: 'idle',
      syncError: null,
      lastSyncedAt: null,

      ensureTenantScope: (organizationId) => {
        if (!organizationId || get().activeOrgId === organizationId) return
        set({ activeOrgId: organizationId, dias: [], pendingSync: [], syncStatus: 'idle', syncError: null, lastSyncedAt: null })
      },

      clearData: () => set({ activeOrgId: null, dias: [], pendingSync: [], syncStatus: 'idle', syncError: null }),

      // Sem dado de demonstração: o painel mostra "sem RDO hoje" nas obras demo, que é a
      // situação real de quem acabou de ligar o Demo. Inventar justificativa fingiria organização.
      loadDemoData: () => set({ dias: [], pendingSync: [], syncStatus: 'idle', syncError: null }),

      flush: async () => {
        const queue = get().pendingSync
        if (queue.length === 0) return
        set({ syncStatus: 'syncing', syncError: null })
        const res = await flushQueue(queue)
        set((s) => {
          const restante = s.pendingSync.filter((op) => !res.completed.includes(op.id))
          const offline = typeof navigator !== 'undefined' && !navigator.onLine
          return {
            pendingSync: restante,
            syncStatus: res.lastError ? 'error' : offline && restante.length ? 'offline' : 'idle',
            syncError: res.lastError ?? null,
          }
        })
      },

      pull: async () => {
        if (isNonProductionDataMode()) return
        const { orgId } = contexto()
        if (!orgId) { set({ syncStatus: 'unauth' }); return }
        get().ensureTenantScope(orgId)
        if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
        if (get().pendingSync.length) await get().flush()
        set({ syncStatus: 'syncing', syncError: null })
        const pendentesAntes = get().pendingSync
        const { data, error } = await supabase
          .from(TABLE)
          .select('*')
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .order('data', { ascending: false })
        if (error) { set({ syncStatus: 'error', syncError: error.message }); return }
        const servidor = ((data ?? []) as Row[]).map(asDia)
        set((s) => ({
          dias: mergePull(servidor, s.dias, [...s.pendingSync, ...pendentesAntes], TABLE),
          syncStatus: s.pendingSync.length ? s.syncStatus : 'idle',
          syncError: null,
          lastSyncedAt: new Date().toISOString(),
        }))
      },

      marcar: ({ siteId, data, categoria, motivo }) => {
        const { orgId, userId, nome } = contexto()
        if (!orgId || !userId) { set({ syncStatus: 'unauth' }); return null }
        // Gate espelhando a policy: papel fora da lista não passa no WITH CHECK, e a escrita
        // otimista viraria op presa para sempre.
        if (!canWriteRdo(useAuth.getState().profile?.role)) return null
        get().ensureTenantScope(orgId)

        const agora = new Date().toISOString()
        const id = idDiaSemProducao(siteId, data)
        const anterior = get().dias.find((d) => d.id === id)
        const item: DiaSemProducao = {
          id, siteId, data, categoria, motivo,
          registradoPor: nome ?? undefined,
          createdAt: anterior?.createdAt ?? agora,
          updatedAt: agora,
        }
        set((s) => ({
          dias: [item, ...s.dias.filter((d) => d.id !== id)],
          pendingSync: [
            ...s.pendingSync,
            anterior
              // Já existia: só o que mudou vai no patch, para não sobrescrever campo que outro
              // usuário alterou (o anti-clobber que o storeSync oferece).
              ? makeOp({ entity: 'dia_sem_producao', type: 'update', recordId: id,
                         patch: changedColumns(linha(anterior, orgId, userId), linha(item, orgId, userId)), table: TABLE })
              : makeOp({ entity: 'dia_sem_producao', type: 'insert', recordId: id,
                         row: linha(item, orgId, userId), table: TABLE }),
          ],
        }))
        void get().flush()
        return id
      },

      desmarcar: (id) => {
        if (!canWriteRdo(useAuth.getState().profile?.role)) return
        set((s) => ({
          dias: s.dias.filter((d) => d.id !== id),
          // Soft delete. A policy de UPDATE desta tabela NÃO filtra `deleted_at is null`
          // justamente para que remarcar o mesmo dia depois volte a funcionar.
          pendingSync: [...s.pendingSync, makeOp({ entity: 'dia_sem_producao', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: TABLE })],
        }))
        void get().flush()
      },
    }),
    {
      name: 'cdata-dias-sem-producao',
      partialize: (s) => ({
        activeOrgId: s.activeOrgId,
        dias: s.dias,
        pendingSync: s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void useDiasSemProducaoStore.getState().flush() })
}
