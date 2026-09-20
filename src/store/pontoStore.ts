/**
 * pontoStore — as batidas de ponto.
 *
 * Store próprio, e não mais uma coleção dentro do `maoDeObraStore`, por um motivo concreto:
 *
 * ⚠️ **Todas as escritas do `maoDeObraStore` passam por `podeEscreverMaoDeObra()`** — e o
 * `colaborador`, que é quem bate o ponto, NÃO está nessa lista (e não pode estar: ela libera
 * cadastro de funcionário, folha, escala). Se a batida morasse lá, o funcionário clicaria e
 * `addTimecard`/`addShift` retornariam sem gravar **nem localmente**. Aqui a lista de papéis é
 * própria e espelha a policy `ponto_insert`.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { flushQueue, makeFlushSerializer, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { useAuth } from '@/lib/auth'
import { podeEscrever } from '@/lib/roles'
import { getTenantMarker } from '@/lib/tenantCache'
import { hojeLocalISO } from '@/lib/utils'
import { batidaParaRow, dataDaJornada, jornadaAberta, montarAjuste, montarBatida, type DadosDaBatida } from '@/features/ponto/batida'
import type { RegistroDePonto, TipoDeBatida } from '@/types'
import type { UserRole } from '@/types/database'

/**
 * Quem pode registrar ponto. Espelho da policy `ponto_insert` (`20260918150000`).
 *
 * ⚠️ `colaborador` está aqui e em NENHUMA outra lista `ROLES_*` do projeto — é a única escrita
 * dele no sistema inteiro.
 */
export const ROLES_PONTO_REGISTRAR: readonly UserRole[] =
  ['colaborador', 'planejador', 'engenheiro', 'gerente', 'diretor', 'owner']

/** Quem vê o ponto dos OUTROS, ajusta e exporta. Espelho de `ponto_update_gestor`. */
export const ROLES_PONTO_GERIR: readonly UserRole[] =
  ['planejador', 'engenheiro', 'gerente', 'diretor', 'owner']

export const podeRegistrarPonto = () => podeEscrever(ROLES_PONTO_REGISTRAR)
export const podeGerirPonto     = () => podeEscrever(ROLES_PONTO_GERIR)

interface Estado {
  activeOrgId: string | null
  registros: RegistroDePonto[]

  pendingSync: PendingOp[]
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  syncError: string | null

  registrar: (dados: DadosDaBatida) => string
  ajustar: (dados: Parameters<typeof montarAjuste>[0]) => string

  ensureTenantScope: (organizationId: string) => void
  clearData: () => void
  flush: () => Promise<void>
  pull: () => Promise<void>
}

/**
 * Quantos dias de batida ficam no aparelho. Cobre o mês corrente e os dois anteriores, que é o que
 * o espelho e a conferência da folha alcançam; mais do que isso o `pull` traz do servidor.
 */
const DIAS_NA_MEMORIA = 100

function limiteDaMemoria(): string {
  const d = new Date()
  d.setDate(d.getDate() - DIAS_NA_MEMORIA)
  return d.toISOString().slice(0, 10)
}

function ctx() {
  const { profile, user } = useAuth.getState()
  return {
    orgId: profile?.organization_id ?? 'pending',
    userId: user?.id ?? 'pending',
    nome: profile?.full_name || profile?.email || 'alguém',
  }
}

interface RowLida {
  id: string
  worker_id: string
  auth_user_id: string
  site_id: string | null
  tipo: string
  data: string
  momento_dispositivo: string
  momento_servidor: string | null
  divergencia_relogio_s: number | null
  nsr: number | null
  origem: string
  payload: Partial<RegistroDePonto> | null
}

export const usePontoStore = create<Estado>()(
  persist(
    (set, get) => {
      const serializarFlush = makeFlushSerializer()
      return {
        activeOrgId: null,
        registros: [],
        pendingSync: [],
        syncStatus: 'idle',
        lastSyncedAt: null,
        syncError: null,

        registrar: (dados) => {
          // ⚠️ Recusa SÓ quando o papel é conhecido E insuficiente.
          //
          // O gate existe para não enfileirar escrita que a RLS vai negar com 42501 (classe
          // bloqueante). Mas `podeEscrever` também devolve `pode: false` quando NÃO SABE — sem
          // membership carregada, ou com a membership sintética que o `auth.ts` fabrica quando a
          // consulta falha. Sem rede, é exatamente esse o estado. Recusar aí mataria a batida
          // offline, que é metade da razão de o módulo existir: a pessoa toca o botão, some tudo,
          // e ela só descobre no fim do mês.
          //
          // É a mesma regra da cerca virtual, e pelo mesmo motivo: não saber onde a pessoa está é
          // diferente de saber que ela está fora. Aqui, não saber o papel é diferente de saber que
          // o papel não pode. No primeiro caso registra e deixa o servidor julgar.
          const permissao = podeRegistrarPonto()
          if (!permissao.pode && permissao.motivo === 'papel_insuficiente') {
            set({ syncError: permissao.explicacao ?? 'O seu perfil não tem permissão para registrar ponto.' })
            return ''
          }
          const { orgId, userId } = ctx()
          const agora = new Date().toISOString()
          // ⚠️ O dia da batida é o dia da JORNADA, não o dia civil de agora. Quem entrou às 22h e
          // sai às 6h continua na jornada de ontem — é assim que se conta adicional noturno e
          // interjornada, e é o que impede o mesmo turno de aparecer partido em dois dias pela
          // metade. A conta mora aqui, e não na tela, porque é o store que tem os registros.
          const aberta = jornadaAberta(
            get().registros.filter((r) => r.workerId === dados.workerId), agora)
          // ⚠️ A conta logada, carimbada aqui e agora — nunca o que a tela mandou.
          const registro = montarBatida(dados, {
            authUserId: userId,
            id: crypto.randomUUID(),
            agora,
            data: dataDaJornada(aberta, hojeLocalISO()),
          })
          set((s) => ({
            registros: [registro, ...s.registros],
            pendingSync: [...s.pendingSync, makeOp({
              entity: 'ponto_registro', type: 'insert', recordId: registro.id,
              row: batidaParaRow(registro, orgId, userId), table: 'ponto_registros',
            })],
            // Limpa o erro anterior: sem rede o `flush` sai cedo sem tocar neste campo, e a recusa
            // de uma batida velha ficaria na tela por cima de uma que acabou de ser aceita.
            syncError: null,
          }))
          // ⚠️ `pull` logo depois do `flush`: o NSR e a hora do servidor são atribuídos NO INSERT,
          // e o upsert do `storeSync` devolve só `id`. Sem esta segunda ida, o número sequencial
          // exigido pela Portaria 671 só apareceria na próxima vez que a tela fosse aberta.
          void get().flush().then(() => get().pull())
          return registro.id
        },

        ajustar: (dados) => {
          if (!podeGerirPonto().pode) {
            set({ syncError: 'Só um gestor pode ajustar batida de ponto.' })
            return ''
          }
          const { orgId, userId, nome } = ctx()
          // ⚠️ Ajuste é uma batida NOVA, marcada — nunca a edição da original.
          const registro = montarAjuste(dados, {
            id: crypto.randomUUID(),
            agora: new Date().toISOString(),
            ajustadoPor: nome,
          })
          set((s) => ({
            registros: [registro, ...s.registros],
            pendingSync: [...s.pendingSync, makeOp({
              entity: 'ponto_registro', type: 'insert', recordId: registro.id,
              row: batidaParaRow(registro, orgId, userId), table: 'ponto_registros',
            })],
          }))
          void get().flush()
          return registro.id
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

        // ⚠️ `pendingSync` NÃO é zerado: batida feita offline não pode morrer numa troca de
        // empresa. O `flushQueue` estaciona op de outra organização sozinho.
        clearData: () => set({ registros: [], activeOrgId: null, syncError: null }),

        flush: async () => serializarFlush(async () => {
          const fila = get().pendingSync
          if (fila.length === 0) return
          if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
          if (!useAuth.getState().profile) { set({ syncStatus: 'unauth' }); return }
          set({ syncStatus: 'syncing', syncError: null })
          const r = await flushQueue(fila)
          set((s) => ({
            pendingSync: s.pendingSync
              .filter((p) => !r.completed.includes(p.id))
              .map((p) => (r.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p)),
            syncStatus: r.lastError ? 'error' : 'idle',
            lastSyncedAt: new Date().toISOString(),
            syncError: r.lastError ?? null,
          }))
        }, () => get().pendingSync.length),

        pull: async () => {
          // ⚠️ Ordena por `nsr`, não por `data`. O `pullTable` pagina de 1000 em 1000 com `.range()` e UMA
          // só cláusula de ordenação: numa coluna `date`, as dezenas de batidas do mesmo dia empatam, o
          // Postgres não promete ordem estável entre páginas, e linha repete numa página enquanto outra
          // some. `nsr` é único por organização e monotônico — desempate de graça.
          const rows = await pullTable<RowLida>('ponto_registros', { column: 'nsr', ascending: false })
          if (!rows) return
          const doServidor: RegistroDePonto[] = rows.map((r) => ({
            ...(r.payload ?? {}),
            id: r.id,
            workerId: r.worker_id,
            authUserId: r.auth_user_id,
            siteId: r.site_id,
            tipo: r.tipo as TipoDeBatida,
            data: r.data,
            momentoDispositivo: r.momento_dispositivo,
            // Estes dois só existem depois que o servidor os atribuiu.
            momentoServidor: r.momento_servidor ?? undefined,
            divergenciaRelogioS: r.divergencia_relogio_s ?? undefined,
            nsr: r.nsr ?? undefined,
            origem: r.origem === 'ajuste' ? 'ajuste' : 'app',
            createdAt: r.payload?.createdAt ?? r.momento_dispositivo,
          }))
          set((s) => ({
            registros: mergePull(doServidor, s.registros, s.pendingSync, 'ponto_registros'),
            syncStatus: 'idle',
            lastSyncedAt: new Date().toISOString(),
          }))
        },
      }
    },
    {
      name: 'cdata-ponto',
      version: 1,
      // `version` sem `migrate` faz o zustand DESCARTAR o estado inteiro, inclusive a fila.
      migrate: (persisted) => (persisted ?? {}) as never,
      // ⚠️ O que vai para o `localStorage` tem JANELA. Um gestor puxa a empresa inteira: 50
      // pessoas × 4 batidas × 250 dias é 50 mil registros por ano, e o `localStorage` tem ~5 MB.
      // Estourar a cota faz o `setItem` do zustand LANÇAR de dentro do `set()` — ou seja, de
      // dentro do `registrar()` — e aí a batida não entra nem na memória nem na fila.
      //
      // ⚠️ A fila NUNCA é cortada, e registro com op pendente fica sempre: o que ainda não subiu
      // não existe em lugar nenhum além daqui. O histórico antigo vem do servidor pelo `pull`.
      partialize: (s) => {
        const pendentes = new Set(s.pendingSync.map((op) => String(op.recordId)))
        return {
          activeOrgId: s.activeOrgId,
          registros: s.registros.filter((r) => pendentes.has(r.id) || r.data >= limiteDaMemoria()),
          pendingSync: s.pendingSync,
          lastSyncedAt: s.lastSyncedAt,
        }
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  // Batida feita sem rede sobe sozinha quando ela volta.
  window.addEventListener('online', () => { void usePontoStore.getState().flush() })
}
