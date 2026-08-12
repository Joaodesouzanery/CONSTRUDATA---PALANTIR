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
import { flushQueue, makeFlushSerializer, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { hojeLocalISO } from '@/lib/utils'
import type { FinanceiroTitulo, FinanceiroEntry, EntradaCategoria, SaidaCategoria, TituloTipo, TituloAnexo } from '@/types'

/** Entrada do cadastro de um boleto (a aba "Boletos" cria N títulos-parcela a partir disto). */
export interface BoletoInput {
  tipo?: TituloTipo                 // default 'pagar'
  descricao: string
  parceiro: string                  // beneficiário (pagar) / pagador (receber)
  obraId?: string
  categoria?: EntradaCategoria | SaidaCategoria
  anexos?: TituloAnexo[]            // fotos do boleto (compartilhadas pelo carnê)
  notas?: string
  // Cada parcela tem sua PRÓPRIA linha digitável (é assim que o carnê é emitido).
  parcelas: Array<{ vencimento: string; valor: number; alertaDias?: number; codigoBoleto?: string }>
}
/** Campos compartilhados por todas as parcelas (editáveis em lote). `codigoBoleto` NÃO entra
 *  aqui de propósito: é por parcela — em lote, editar a descrição apagaria os códigos. */
export type BoletoPatch = Partial<Pick<FinanceiroTitulo, 'tipo' | 'descricao' | 'parceiro' | 'obraId' | 'categoria' | 'anexos' | 'notas'>>

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
  /** Insere/atualiza títulos com id próprio (idempotente por id) — ex.: cobranças de rateio. */
  upsertTitulos: (titulos: FinanceiroTitulo[]) => void
  /** Boletos (aba "Boletos"): cada boleto = N títulos-parcela agrupados por `boletoId`. */
  addBoleto:    (input: BoletoInput) => void
  /** `codigos` (opcional): linha digitável nova por id de parcela — vai na MESMA escrita
   *  do patch compartilhado, para o salvar do modal não enfileirar duas ops por parcela. */
  updateBoleto: (boletoId: string, patch: BoletoPatch, codigos?: Record<string, string>) => void
  /** Altera a linha digitável de UMA parcela (cada parcela do carnê tem a sua). */
  setParcelaCodigo: (tituloId: string, codigo: string) => void
  removeBoleto: (boletoId: string) => void
  /** Soft-delete em lote por id (só remove os que existem). */
  removeTitulos: (ids: string[]) => void
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

/**
 * Patch de "nova linha digitável" para uma parcela.
 *
 * `numeroDoc` espelha o código (é o que aparece e é buscado em *Pagamentos*), mas só enquanto
 * ninguém o tiver editado à mão por lá: se alguém trocou por "NF-8841", mudar o código do boleto
 * não pode apagar esse número — nem, via re-sync, a referência do lançamento já baixado.
 */
function codigoPatch(t: FinanceiroTitulo, codigo: string): Partial<FinanceiroTitulo> {
  const limpo = codigo.replace(/\D/g, '') || undefined
  const espelhando = !t.numeroDoc || t.numeroDoc === (t.codigoBoleto ?? '')
  return espelhando ? { codigoBoleto: limpo, numeroDoc: limpo } : { codigoBoleto: limpo }
}

/** Campos do título que definem o lançamento gerado na baixa. */
const ENTRY_FIELDS = ['valor', 'categoria', 'descricao', 'obraId', 'numeroDoc', 'tipo'] as const

/**
 * Mantém o lançamento gerado na baixa em sincronia com o título JÁ atualizado.
 * Só reflete os campos que definem o lançamento — assim a própria baixa não se re-dispara.
 */
function resyncEntry(t: FinanceiroTitulo, patch: Partial<FinanceiroTitulo>) {
  if (t.status !== 'pago' || !t.entryId) return
  if (!ENTRY_FIELDS.some((k) => k in patch)) return
  useFinanceiroStore.getState().updateEntry(t.entryId, {
    tipo: t.tipo === 'pagar' ? 'saida' : 'entrada',
    descricao: t.descricao,
    valor: t.valor,
    categoria: baixaCategoria(t),
    referencia: t.numeroDoc,
    obraId: t.obraId,
  })
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
  const boletoId = crypto.randomUUID()
  // Cada parcela do carnê tem a SUA linha digitável (guardada só com dígitos).
  const cod1 = '10499819863500010004602003903701315560000036700'
  const cod2 = '10499819863500010004602003903891715840000036700'
  return [
    // Boleto de exemplo (2 parcelas) — aparece na aba "Boletos".
    mk({ id: crypto.randomUUID(), tipo: 'pagar', descricao: 'Tintas Unitintas — pedido 027', parceiro: 'Unitintas Comércio de Tintas', valor: 367, vencimento: plus(24), numeroDoc: cod1, categoria: 'materiais', parcelaNum: 1, parcelaDe: 2, boletoId, codigoBoleto: cod1, alertaDias: 7, status: 'pendente' }),
    mk({ id: crypto.randomUUID(), tipo: 'pagar', descricao: 'Tintas Unitintas — pedido 027', parceiro: 'Unitintas Comércio de Tintas', valor: 367, vencimento: plus(52), numeroDoc: cod2, categoria: 'materiais', parcelaNum: 2, parcelaDe: 2, boletoId, codigoBoleto: cod2, alertaDias: 7, status: 'pendente' }),
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
      const serializarFlush = makeFlushSerializer()

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
            resyncEntry(target, patch)
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

        // Upsert idempotente por id — local replace-or-add + insert op (que é upsert
        // onConflict id no servidor). Usado p/ cobranças de rateio (ids aleatórios novos).
        upsertTitulos: (titulos) => {
          if (titulos.length === 0) return
          const ids = new Set(titulos.map((t) => t.id))
          set((s) => ({
            titulos: [...titulos, ...s.titulos.filter((t) => !ids.has(t.id))],
            pendingSync: [...s.pendingSync, ...titulos.map(enqueueInsert)],
          }))
          void get().flush()
        },

        // ── Boletos ──────────────────────────────────────────────────────
        // Um boleto vira N títulos-parcela (um por vencimento) compartilhando boletoId/anexos.
        // A linha digitável é POR PARCELA. A "baixa" por parcela reusa baixarTitulo (lança no
        // Fluxo/DRE). Sem tabela nova: os campos vivem no payload jsonb.
        addBoleto: (input) => {
          if (input.parcelas.length === 0) return
          const boletoId = crypto.randomUUID()
          const de = input.parcelas.length
          get().addTitulos(input.parcelas.map((p, i) => ({
            tipo: input.tipo ?? 'pagar',
            descricao: input.descricao,
            parceiro: input.parceiro,
            valor: p.valor,
            vencimento: p.vencimento,
            obraId: input.obraId,
            numeroDoc: p.codigoBoleto,   // espelha o código DESTA parcela no nº do documento (busca em Pagamentos)
            categoria: input.categoria,
            parcelaNum: i + 1,
            parcelaDe: de,
            boletoId,
            codigoBoleto: p.codigoBoleto,
            anexos: input.anexos,
            alertaDias: p.alertaDias,
            notas: input.notas,
          })))
        },

        updateBoleto: (boletoId, patch, codigos) => {
          // `patch` é só o que é compartilhado — o código NUNCA entra nele (senão editar a
          // descrição sobrescreveria a linha digitável de todas as parcelas). O código vem
          // separado por id em `codigos` e é fundido aqui.
          //
          // Tudo num ÚNICO `set` e um só `flush`. Chamar `updateTitulo` num laço parecia
          // equivalente, mas cada chamada dispara um flush, e cada flush leva um snapshot
          // MAIOR da fila: 12 parcelas viravam 78 requisições para a mesma gravação.
          const alvos = get().titulos.filter((x) => x.boletoId === boletoId)
          if (alvos.length === 0) return
          // `codigoPatch` precisa ver o título ANTERIOR (é assim que sabe se `numeroDoc`
          // ainda espelha o código ou foi editado à mão em Pagamentos).
          const patches = new Map(alvos.map((t) => {
            const novo = codigos?.[t.id]
            return [t.id, novo === undefined ? patch : { ...patch, ...codigoPatch(t, novo) }] as const
          }))
          const atualizados = alvos.map((t) => ({ ...t, ...patches.get(t.id)! }))
          const porId = new Map(atualizados.map((t) => [t.id, t]))
          set((s) => ({
            titulos:     s.titulos.map((t) => porId.get(t.id) ?? t),
            pendingSync: [...s.pendingSync, ...atualizados.map(enqueueUpdate)],
          }))
          for (const t of atualizados) resyncEntry(t, patches.get(t.id)!)
          void get().flush()
        },

        /** Linha digitável de UMA parcela (edição rápida no card). */
        setParcelaCodigo: (tituloId, codigo) => {
          const t = get().titulos.find((x) => x.id === tituloId)
          if (t) get().updateTitulo(tituloId, codigoPatch(t, codigo))
        },

        removeBoleto: (boletoId) => {
          get().removeTitulos(get().titulos.filter((t) => t.boletoId === boletoId).map((t) => t.id))
        },

        removeTitulos: (ids) => {
          if (ids.length === 0) return
          const idset = new Set(ids)
          const present = get().titulos.filter((t) => idset.has(t.id))
          const nowIso = new Date().toISOString()
          // Remove também lançamentos de baixa vinculados (se houver, entre os presentes).
          for (const t of present) if (t.entryId) useFinanceiroStore.getState().removeEntry(t.entryId)
          set((s) => ({
            titulos: s.titulos.filter((t) => !idset.has(t.id)),
            // Enfileira soft-delete para TODOS os ids pedidos (0 linhas no servidor é
            // idempotente/inócuo) — garante apagar as cobranças mesmo que o título ainda
            // não tenha sido puxado neste dispositivo (senão ficaria órfão no servidor).
            pendingSync: [...s.pendingSync, ...ids.map((id) => makeOp({ entity: 'financeiro_titulo', type: 'update', recordId: id, patch: { deleted_at: nowIso, updated_at: nowIso }, table: TABLE }))],
          }))
          void get().flush()
        },

        baixarTitulo: (id, opts) => {
          const t = get().titulos.find((x) => x.id === id)
          if (!t || t.status === 'pago') return
          // Data LOCAL: com toISOString (UTC), uma baixa às 22h do dia 31 caía no mês
          // seguinte — e é essa data que define a competência do lançamento na DRE.
          const dataPagamento = opts?.dataPagamento ?? hojeLocalISO()
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
          // respectObra: a baixa reflete a obra do TÍTULO (inclusive "sem obra") —
          // não deve herdar a obra ativa do contexto.
          useFinanceiroStore.getState().addEntry(entry, { respectObra: true })
          get().updateTitulo(id, { status: 'pago', dataPagamento, entryId })
        },

        desfazerBaixa: (id) => {
          const t = get().titulos.find((x) => x.id === id)
          if (!t) return
          if (t.entryId) useFinanceiroStore.getState().removeEntry(t.entryId)
          get().updateTitulo(id, { status: 'pendente', dataPagamento: undefined, entryId: undefined })
        },

        loadDemoData: () => set({ titulos: buildDemo(), pendingSync: [] }),
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
          const rows = await pullTable<{ payload: FinanceiroTitulo }>(TABLE)
          set((s) => ({
            titulos: mergePull(rows?.map((r) => r.payload) ?? null, s.titulos, s.pendingSync, TABLE),
            // O pull roda logo depois do flush e agora roda SEMPRE (inclusive com fila cheia).
            // Zerar o status aqui apagaria o diagnóstico do flush que acabou de falhar — e é
            // justamente com op presa que o usuário precisa ver o motivo. Mantém enquanto sobrar fila.
            syncStatus:   s.pendingSync.length > 0 && (s.syncStatus === 'error' || s.syncStatus === 'offline') ? s.syncStatus : 'idle',
            lastSyncedAt: new Date().toISOString(),
          }))
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
