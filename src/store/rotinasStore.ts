/**
 * rotinasStore.ts — as rotinas da empresa, e o que foi feito em cada ciclo.
 *
 * ─── O QUE ISTO SUBSTITUI ─────────────────────────────────────────────────────────────────────
 * `userRoutineStore` guarda ATALHOS de módulo fixados, por usuário, com preset por cargo. Não tem
 * tarefa, não tem responsável e não tem feito/não feito — e a RLS dele é por usuário, então
 * ninguém da empresa vê a rotina de ninguém. Este store é a outra coisa: a lista de tarefas
 * recorrentes da EMPRESA, visível para todos, com marcação simples.
 *
 * Os dois convivem: os atalhos continuam úteis para navegar, e ficam onde estão.
 *
 * ─── UMA EXECUÇÃO POR CICLO ───────────────────────────────────────────────────────────────────
 * A chave é `(rotina_id, periodo)`, onde `periodo` é a etiqueta do ciclo (`2026-W34`). O id da
 * execução é DERIVADO dessa chave, de forma determinística: dois cliques, ou duas abas abertas,
 * produzem o mesmo id e o `upsert onConflict:'id'` resolve. Sem isso, o índice único do banco
 * recusaria a segunda linha e a operação ficaria presa na fila para sempre.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { seededUuidLegado } from '@/lib/seededId'
import { hojeLocalISO } from '@/lib/utils'
import { cicloDe, type FrequenciaRotina } from '@/features/minha-rotina/utils/cicloRotina'

export interface Rotina {
  id: string
  titulo: string
  descricao?: string
  /** Caminho do módulo onde a tarefa é feita ('/app/rdo'). Vira atalho na tela. */
  modulo?: string
  frequencia: FrequenciaRotina
  /** Nome de quem é a tarefa. Texto, não usuário — a empresa opera com uma conta só. */
  responsavel?: string
  ordem: number
  ativa: boolean
  /**
   * Quando a rotina passou a existir, em ISO.
   *
   * É o PISO para contar atraso: sem ele, uma rotina cadastrada ontem apareceria "atrasada há 5
   * anos", porque a varredura para trás não teria onde parar. Vem da coluna `created_at`, que a
   * tabela já tem — nenhuma migração nova.
   */
  criadaEm?: string
}

export interface RotinaExecucao {
  id: string
  rotinaId: string
  /** A etiqueta do ciclo: '2026-08-20' | '2026-W34' | '2026-08-Q1' | '2026-08'. */
  periodo: string
  feita: boolean
  marcadaEm: string
  observacao?: string
}

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

function rotinaToRow(r: Rotina, orgId: string, userId: string) {
  return {
    id: r.id,
    organization_id: orgId,
    titulo: r.titulo,
    descricao: r.descricao ?? null,
    modulo: r.modulo ?? null,
    frequencia: r.frequencia,
    responsavel: r.responsavel ?? null,
    ordem: r.ordem,
    ativa: r.ativa,
    payload: {} as Record<string, unknown>,
    created_by: userId,
  }
}

function execucaoToRow(e: RotinaExecucao, orgId: string, userId: string) {
  return {
    id: e.id,
    organization_id: orgId,
    rotina_id: e.rotinaId,
    periodo: e.periodo,
    feita: e.feita,
    marcada_em: e.marcadaEm,
    observacao: e.observacao ?? null,
    created_by: userId,
  }
}

/**
 * O id da execução sai da chave de negócio.
 *
 * Marcar a mesma rotina no mesmo ciclo duas vezes tem de produzir a MESMA linha — senão o índice
 * único do banco recusa a segunda e a op fica presa. É o mesmo truque que o RDO usa para os
 * lançamentos financeiros.
 */
export function idDaExecucao(rotinaId: string, periodo: string): string {
  return seededUuidLegado(`rotina-exec:${rotinaId}:${periodo}`)
}

interface RotinasState {
  activeOrgId: string | null
  rotinas: Rotina[]
  execucoes: RotinaExecucao[]

  pendingSync: PendingOp[]
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  syncError: string | null

  ensureTenantScope: (organizationId: string) => void
  addRotina: (r: Omit<Rotina, 'id' | 'ordem'> & { ordem?: number }) => string
  updateRotina: (id: string, patch: Partial<Omit<Rotina, 'id'>>) => void
  removeRotina: (id: string) => void
  /** Marca ou desmarca a rotina no ciclo corrente (ou no ciclo informado). */
  alternarFeita: (rotinaId: string, periodo?: string, observacao?: string) => void
  /** true se a rotina está feita naquele ciclo. */
  estaFeita: (rotinaId: string, periodo: string) => boolean
  semear: (modelo: Omit<Rotina, 'id'>[]) => number

  clearData: () => void
  flush: () => Promise<void>
  pull: () => Promise<void>
}

export const useRotinasStore = create<RotinasState>()(
  persist(
    (set, get) => ({
      activeOrgId: null,
      rotinas: [],
      execucoes: [],
      pendingSync: [],
      syncStatus: 'idle',
      lastSyncedAt: null,
      syncError: null,

      ensureTenantScope: (organizationId) => {
        if (!organizationId) return
        if (get().activeOrgId === organizationId) return
        // Troca de empresa zera tudo: rotina de uma empresa não pode vazar para outra.
        set({ activeOrgId: organizationId, rotinas: [], execucoes: [], pendingSync: [], syncError: null })
      },

      addRotina: (r) => {
        const id = crypto.randomUUID()
        const { orgId, userId } = ctxAuth()
        const ordem = r.ordem ?? (
          Math.max(0, ...get().rotinas.filter((x) => x.frequencia === r.frequencia).map((x) => x.ordem)) + 10
        )
        // `criadaEm` local agora; o servidor grava o `created_at` dele no insert. Os dois batem
        // porque a rotina é criada e enviada no mesmo instante — e o local é o que vale enquanto a
        // operação ainda não subiu.
        const nova: Rotina = { ...r, id, ordem, ativa: r.ativa ?? true, criadaEm: r.criadaEm ?? new Date().toISOString() }
        set((s) => ({
          rotinas: [...s.rotinas, nova],
          pendingSync: [...s.pendingSync, makeOp({ entity: 'rotina', type: 'insert', recordId: id, row: rotinaToRow(nova, orgId, userId), table: 'rotinas' })],
        }))
        void get().flush()
        return id
      },

      updateRotina: (id, patch) => {
        const { orgId, userId } = ctxAuth()
        set((s) => {
          const rotinas = s.rotinas.map((r) => (r.id === id ? { ...r, ...patch } : r))
          const alvo = rotinas.find((r) => r.id === id)
          if (!alvo) return { rotinas }
          const row = rotinaToRow(alvo, orgId, userId)
          const p = Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'organization_id', 'created_by'].includes(k)))
          return {
            rotinas,
            pendingSync: [...s.pendingSync, makeOp({ entity: 'rotina', type: 'update', recordId: id, patch: p, table: 'rotinas' })],
          }
        })
        void get().flush()
      },

      removeRotina: (id) => {
        set((s) => ({
          rotinas: s.rotinas.filter((r) => r.id !== id),
          // As execuções ficam: são o histórico do que a equipe fez, e apagá-las junto
          // reescreveria o passado por causa de uma tarefa que deixou de existir hoje.
          pendingSync: [...s.pendingSync, makeOp({ entity: 'rotina', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'rotinas' })],
        }))
        void get().flush()
      },

      alternarFeita: (rotinaId, periodo, observacao) => {
        const rotina = get().rotinas.find((r) => r.id === rotinaId)
        if (!rotina) return
        const ciclo = periodo ?? cicloDe(rotina.frequencia, hojeLocalISO())
        const id = idDaExecucao(rotinaId, ciclo)
        const atual = get().execucoes.find((e) => e.id === id)
        const feita = !(atual?.feita ?? false)
        const { orgId, userId } = ctxAuth()
        const registro: RotinaExecucao = {
          id, rotinaId, periodo: ciclo, feita,
          marcadaEm: new Date().toISOString(),
          observacao: observacao ?? atual?.observacao,
        }
        set((s) => ({
          execucoes: atual
            ? s.execucoes.map((e) => (e.id === id ? registro : e))
            : [...s.execucoes, registro],
          // Sempre insert: o id é determinístico e o flush manda como `upsert onConflict:'id'`,
          // então desmarcar e remarcar não empilha operações conflitantes.
          pendingSync: [...s.pendingSync, makeOp({ entity: 'rotina_execucao', type: 'insert', recordId: id, row: execucaoToRow(registro, orgId, userId), table: 'rotina_execucoes' })],
        }))
        void get().flush()
      },

      estaFeita: (rotinaId, periodo) =>
        get().execucoes.some((e) => e.rotinaId === rotinaId && e.periodo === periodo && e.feita),

      semear: (modelo) => {
        // Não duplica o que já existe: casa por título + frequência, que é como a pessoa
        // reconhece a tarefa. Rodar a semente duas vezes não cria trinta linhas repetidas.
        const existentes = new Set(get().rotinas.map((r) => `${r.frequencia}|${r.titulo.trim().toLowerCase()}`))
        const novas = modelo.filter((m) => !existentes.has(`${m.frequencia}|${m.titulo.trim().toLowerCase()}`))
        for (const m of novas) get().addRotina(m)
        return novas.length
      },

      clearData: () => set({ activeOrgId: null, rotinas: [], execucoes: [], pendingSync: [], syncError: null }),

      flush: async () => {
        const queue = get().pendingSync
        if (queue.length === 0) return
        if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
        if (!useAuth.getState().profile) { set({ syncStatus: 'unauth' }); return }
        set({ syncStatus: 'syncing', syncError: null })
        const result = await flushQueue(queue)
        set((s) => ({
          pendingSync: s.pendingSync
            .filter((p) => !result.completed.includes(p.id))
            .map((p) => (result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p)),
          syncStatus: result.lastError ? 'error' : 'idle',
          lastSyncedAt: new Date().toISOString(),
          syncError: result.lastError ?? null,
        }))
      },

      pull: async () => {
        const rs = await pullTable<Record<string, unknown>>('rotinas')
        const es = await pullTable<Record<string, unknown>>('rotina_execucoes')
        set((s) => ({
          rotinas: mergePull(
            rs?.map((r) => ({
              id: r.id as string,
              titulo: (r.titulo as string) ?? '',
              descricao: (r.descricao as string | null) ?? undefined,
              modulo: (r.modulo as string | null) ?? undefined,
              frequencia: (r.frequencia as FrequenciaRotina) ?? 'diaria',
              responsavel: (r.responsavel as string | null) ?? undefined,
              ordem: Number(r.ordem ?? 0),
              ativa: r.ativa !== false,
              criadaEm: (r.created_at as string | null) ?? undefined,
            })) ?? null,
            s.rotinas, s.pendingSync, 'rotinas',
          ),
        }))
        set((s) => ({
          execucoes: mergePull(
            es?.map((e) => ({
              id: e.id as string,
              rotinaId: e.rotina_id as string,
              periodo: (e.periodo as string) ?? '',
              feita: e.feita !== false,
              marcadaEm: (e.marcada_em as string) ?? new Date().toISOString(),
              observacao: (e.observacao as string | null) ?? undefined,
            })) ?? null,
            s.execucoes, s.pendingSync, 'rotina_execucoes',
          ),
        }))
        set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
      },
    }),
    {
      name: 'cdata-rotinas',
      partialize: (s) => ({
        activeOrgId: s.activeOrgId,
        rotinas: s.rotinas,
        execucoes: s.execucoes,
        pendingSync: s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void useRotinasStore.getState().flush() })
}
