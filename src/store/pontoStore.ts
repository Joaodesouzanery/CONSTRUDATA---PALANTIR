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
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { podeEscrever } from '@/lib/roles'
import { getTenantMarker } from '@/lib/tenantCache'
import { hojeLocalISO } from '@/lib/utils'
import { batidaParaRow, dataDaJornada, jornadaAberta, montarAjuste, montarBatida, type DadosDaBatida } from '@/features/ponto/batida'
import type { RegistroDePonto, TipoDeBatida, Worker } from '@/types'
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

/**
 * O cadastro do titular desta conta — o mínimo para a tela saber de quem é a batida.
 *
 * ⚠️ Campos nomeados, nunca o `Worker` inteiro. A RLS já recorta `workers` para a própria linha,
 * mas o `localStorage` de um celular de canteiro não é lugar para `grossSalary` nem `hourlyRate`
 * viajarem sem necessidade — e a regra da casa é que o cliente peça só o que usa.
 */
export interface MeuCadastro {
  workerId: string
  nome: string
  siteId: string | null
  /** A jornada contratual — é dela que sai o previsto do banco de horas. */
  scheduleType?: string
  admissionDate?: string
  matricula?: string
}

/** A obra, com o que a cerca precisa. Sem o `payload`: o contrato fica no servidor. */
export interface ObraDoPonto {
  id: string
  nome: string
  lat: number | null
  lng: number | null
  /** `raioPontoM` da obra, quando ela define o seu. `null` = usa o padrão da empresa. */
  raioM: number | null
}

/**
 * Por que não há cadastro — e é metade do conserto.
 *
 * ⚠️ A tela tratava QUALQUER ausência como "o gestor não fez o vínculo", inclusive "ainda estou
 * carregando" e "estou sem rede". Acusar o gestor de não ter feito um vínculo que ele fez é trocar
 * um defeito por outro: a pessoa liga para o escritório, e lá está tudo certo.
 */
export type MotivoSemCadastro = 'carregando' | 'sem-rede' | 'sem-vinculo' | 'erro'

interface Estado {
  activeOrgId: string | null
  registros: RegistroDePonto[]

  /**
   * O cadastro e a obra do titular, buscados pelo próprio store.
   *
   * ⚠️ **Existem porque o `colaborador` sincroniza UM store só.** `defsDoPapel`
   * (`appModeStore.ts:337`) recorta a lista para `['ponto']` — de propósito, para o celular do
   * canteiro não baixar a empresa inteira. Só que `PontoPage` procurava a pessoa dentro de
   * `useMaoDeObraStore.workers` e a obra dentro de `useTorreStore.sites`, que aquele recorte não
   * baixa: `eu` ficava `undefined` e a tela acusava "sua conta não está ligada a um cadastro",
   * **com o vínculo perfeitamente feito no banco**. Para gerente e diretor funcionava, porque
   * esses sincronizam tudo — foi por isso que passou sem ninguém ver.
   *
   * ⚠️ E moram AQUI, não dentro do componente: depois de um F5 sem sinal — o cenário do canteiro —
   * um estado de componente se perde e a cerca voltaria a `obra-sem-coordenada`.
   */
  meuCadastro: MeuCadastro | null
  minhaObra: ObraDoPonto | null
  /** As obras da empresa, projetadas. Serve à conferência da cerca pelo gestor. */
  obrasDaEmpresa: ObraDoPonto[]
  motivoSemCadastro: MotivoSemCadastro | null

  pendingSync: PendingOp[]
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  syncError: string | null

  registrar: (dados: DadosDaBatida) => string
  ajustar: (dados: Parameters<typeof montarAjuste>[0]) => string
  puxarMeuContexto: () => Promise<void>

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
        meuCadastro: null,
        minhaObra: null,
        obrasDaEmpresa: [],
        motivoSemCadastro: 'carregando',
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

        /**
         * Busca o cadastro do titular e as obras — as duas coisas que a tela precisa e que o
         * recorte de sincronização do `colaborador` não traz.
         *
         * ⚠️ **Duas consultas nomeadas, e não ligar `mao-de-obra`/`torre` no `defsDoPapel`.**
         * Ligar os dois stores faz 12 requisições por login num aparelho de canteiro, das quais
         * 10 voltam vazias pela RLS — e, pior, passa a depender SÓ dela. O próprio
         * `docs/APLICAR_MIGRACOES.md` avisa que a varredura de `20260918160000` é um retrato:
         * **tabela criada depois nasce liberada**. Uma tabela nova de folha, e o celular do
         * canteiro volta a baixar salário. Duas consultas nomeadas não têm esse risco.
         *
         * ⚠️ O filtro por `authUserId` é repetido aqui de propósito, mesmo com a policy restritiva
         * já garantindo a mesma coisa. Defesa em profundidade: no dia em que a varredura da cerca
         * ficar desatualizada, este `.eq` continua devolvendo uma linha só.
         */
        puxarMeuContexto: async () => {
          const { user, profile } = useAuth.getState()
          const orgId = profile?.organization_id
          if (!user?.id || !orgId) { set({ motivoSemCadastro: 'carregando' }); return }
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            // ⚠️ Sem rede NÃO limpa o que já está guardado: é exatamente o caso em que o cadastro
            // persistido é a única coisa que deixa a pessoa bater o ponto.
            set((s) => ({ motivoSemCadastro: s.meuCadastro ? null : 'sem-rede' }))
            return
          }

          try {
            const [{ data: eu, error: erroWorker }, { data: obras, error: erroObras }] = await Promise.all([
              supabase.from('workers')
                .select('id,name,payload')
                .eq('organization_id', orgId)
                .eq('payload->>authUserId', user.id)
                .is('deleted_at', null)
                .limit(1)
                .maybeSingle(),
              // ⚠️ SEM `payload`. Ele carrega contrato, orçamento, medições e riscos de cada obra;
              // a cerca precisa de quatro campos. `raioPontoM` vem por caminho de json, só ele.
              supabase.from('construction_sites')
                .select('id,name,lat,lng,raioPontoM:payload->>raioPontoM')
                .eq('organization_id', orgId)
                .is('deleted_at', null),
            ])
            if (erroWorker || erroObras) { set({ motivoSemCadastro: 'erro' }); return }

            const lista: ObraDoPonto[] = (obras ?? []).map((o) => {
              const r = Number((o as { raioPontoM?: string | null }).raioPontoM)
              return {
                id: String(o.id),
                nome: String(o.name ?? ''),
                lat: o.lat == null ? null : Number(o.lat),
                lng: o.lng == null ? null : Number(o.lng),
                raioM: Number.isFinite(r) && r > 0 ? r : null,
              }
            })

            if (!eu) {
              set({ meuCadastro: null, minhaObra: null, obrasDaEmpresa: lista, motivoSemCadastro: 'sem-vinculo' })
              return
            }

            const pl = (eu.payload ?? {}) as Partial<Worker>
            const cadastro: MeuCadastro = {
              workerId: String(eu.id),
              nome: String(eu.name ?? pl.name ?? ''),
              siteId: pl.siteId ?? null,
              scheduleType: pl.scheduleType,
              admissionDate: pl.admissionDate,
              matricula: pl.registrationNumber,
            }
            set({
              meuCadastro: cadastro,
              minhaObra: lista.find((o) => o.id === cadastro.siteId) ?? null,
              obrasDaEmpresa: lista,
              motivoSemCadastro: null,
            })
          } catch {
            set({ motivoSemCadastro: 'erro' })
          }
        },

        // ⚠️ `pendingSync` NÃO é zerado: batida feita offline não pode morrer numa troca de
        // empresa. O `flushQueue` estaciona op de outra organização sozinho.
        //
        // ⚠️ Mas o CADASTRO é zerado, e tem de ser: ele é de outra empresa. Note a tensão com o
        // `partialize`, que o guarda de propósito — as duas regras são certas e falam de momentos
        // diferentes (trocar de empresa × recarregar a página sem sinal).
        clearData: () => set({
          registros: [], activeOrgId: null, syncError: null,
          meuCadastro: null, minhaObra: null, obrasDaEmpresa: [], motivoSemCadastro: 'carregando',
        }),

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
          // O contexto vem junto: é a mesma viagem, e sem ele a tela não sabe de quem é a batida.
          await get().puxarMeuContexto()
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
          // ⚠️ O cadastro e a obra ficam guardados. Sem isto, abrir a tela sem sinal — o canteiro —
          // perderia o vínculo e a cerca cairia em `obra-sem-coordenada`. São ~200 bytes.
          meuCadastro: s.meuCadastro,
          minhaObra: s.minhaObra,
          obrasDaEmpresa: s.obrasDaEmpresa,
        }
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  // Batida feita sem rede sobe sozinha quando ela volta.
  window.addEventListener('online', () => { void usePontoStore.getState().flush() })
}
