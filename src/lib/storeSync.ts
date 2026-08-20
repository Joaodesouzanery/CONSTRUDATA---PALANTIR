/**
 * storeSync.ts — Helper compartilhado para stores Zustand local-first.
 *
 * Padrão usado por qualidadeStore (v1) e estendido aqui para os stores
 * multi-entidade do Sprint 2 (RDO/Planejamento/Suprimentos).
 *
 * Cada store mantém sua própria fila de pending ops, mas o `flushQueue()`
 * abaixo despacha cada op para o handler correto baseado em `entity`.
 *
 * Conflict resolution v1: last-write-wins por updated_at do servidor.
 * Quando push falha, a operação fica na fila e syncError mostra o motivo.
 */
import { supabase } from './supabase'
import { useAuth } from './auth'
import { isNonProductionDataMode } from './runtimeMode'
import { withTimeout } from './withTimeout'

/**
 * Teto de tempo por requisição de sync. Numa rede de canteiro ruim, uma
 * requisição pode travar indefinidamente — sem isto o status ficava preso em
 * "sincronizando" para sempre (o "rodando azul"). No estouro, aborta o fetch,
 * a op volta pra fila (retry) e o status vira 'error' (dado seguro no aparelho).
 */
const SYNC_TIMEOUT_MS = 20_000

/** Roda uma query do Supabase com AbortController + timeout de segurança. */
async function withAbort<T>(fn: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const controller = new AbortController()
  const timer = (typeof window !== 'undefined' ? window.setTimeout : setTimeout)(
    () => controller.abort(),
    SYNC_TIMEOUT_MS,
  ) as unknown as number
  try {
    return await withTimeout(
      fn(controller.signal),
      SYNC_TIMEOUT_MS + 2_000,
      'Tempo esgotado ao sincronizar. Salvo no aparelho — vamos reenviar.',
    )
  } finally {
    ;(typeof window !== 'undefined' ? window.clearTimeout : clearTimeout)(timer)
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'unauth' | 'error'

export interface PendingOp<TEntity extends string = string> {
  id:        string
  entity:    TEntity
  type:      'insert' | 'update' | 'delete'
  recordId:  string
  /**
   * Para insert/update: o row já mapeado snake_case pronto pra mandar.
   * O store calcula isso na hora de enfileirar (assim quando flush rodar
   * usa exatamente o mapeamento que o usuário viu).
   */
  row?:      Record<string, unknown>
  /**
   * Patch parcial — apenas campos que mudaram. Para update.
   */
  patch?:    Record<string, unknown>
  /**
   * Para delete via aprovação: action_type a chamar no request_action RPC.
   * Se undefined, usa DELETE direto (que vai falhar pelo RLS na maioria
   * dos casos — então sempre defina para entities que precisam de aprovação).
   */
  approvalActionType?: string
  /** Tabela alvo no Supabase. */
  table:     string
  retries:   number
  createdAt: string
}

export interface FlushResult {
  completed:  string[]   // ids das ops drenadas com sucesso confirmado
  errored:    string[]   // ids que falharam mas continuam na fila
  /**
   * Ids que já falharam vezes demais e NÃO foram reenviados nesta rodada.
   *
   * Sem isto, uma op barrada pela RLS voltava para a fila e era reenviada em todo mount de
   * módulo, todo login e todo clique em "Tentar novamente" — para sempre, sem backoff, sempre
   * com o mesmo resultado. O `retries` era incrementado pelos stores e **nunca lido por
   * ninguém**. Agora elas param de girar em falso e passam a ser mostradas ao usuário.
   */
  esgotadas:  string[]
  lastError?: string
}

/**
 * Depois disto a op para de ser reenviada sozinha.
 *
 * Cinco é o mesmo teto do store legado `syncableStore`, que já tinha essa proteção — os stores
 * novos ficaram sem. Não é um número mágico: é alto o bastante para atravessar uma queda de rede
 * ou um deploy, e baixo o bastante para o usuário ser avisado no mesmo dia.
 */
export const MAX_TENTATIVAS_SYNC = 5

function rowCount(data: unknown): number {
  return Array.isArray(data) ? data.length : data ? 1 : 0
}

function assertAffectedRows(table: string, op: PendingOp, data: unknown) {
  if (rowCount(data) > 0) return
  throw new Error(`Nenhuma linha confirmada em ${table} para ${op.type} ${op.recordId}. Verifique RLS, organização ativa ou se o registro ainda existe.`)
}

function softDeleteRpcFor(op: PendingOp): 'soft_delete_suprimentos_deposito' | 'soft_delete_suprimentos_estoque_item' | null {
  if (op.type !== 'update' || !op.patch?.deleted_at) return null
  if (op.table === 'suprimentos_depositos') return 'soft_delete_suprimentos_deposito'
  if (op.table === 'suprimentos_estoque_itens') return 'soft_delete_suprimentos_estoque_item'
  return null
}

/**
 * Drena uma fila de pending ops contra o Supabase.
 * Retorna quais ops foram completadas (remover da fila) e quais erraram
 * (incrementar retry e manter na fila para nova tentativa).
 */
export async function flushQueue(queueEntrada: PendingOp[]): Promise<FlushResult> {
  let queue = queueEntrada
  const result: FlushResult = { completed: [], errored: [], esgotadas: [] }

  if (isNonProductionDataMode()) {
    return result
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return result
  }

  const { profile, user } = useAuth.getState()
  if (!profile || !user) {
    return result
  }

  const activeOrgId = profile.organization_id
  const activeUserId = user.id

  // Ops que já falharam vezes demais saem da rodada. Elas CONTINUAM na fila (o dado não é
  // jogado fora), mas param de ser reenviadas sozinhas: uma op barrada por RLS falharia de novo,
  // e reenviar em todo mount de módulo só gera ruído no servidor e um erro eterno na tela.
  const esgotadas = queue.filter((op) => op.retries >= MAX_TENTATIVAS_SYNC)
  if (esgotadas.length) {
    result.esgotadas = esgotadas.map((op) => op.id)
    queue = queue.filter((op) => op.retries < MAX_TENTATIVAS_SYNC)
    if (queue.length === 0) return result
  }

  // Coage colunas terminadas em `_id` com string vazia para null: '' nunca é um uuid
  // válido e o Postgres rejeitaria o insert/update ("invalid input syntax for type uuid"),
  // deixando a op presa em pendingSync. Defesa geral (ex.: funcionário sem equipe → crew_id '').
  const sanitizeIds = (obj: Record<string, unknown>) => {
    let out = obj
    for (const k of Object.keys(obj)) {
      if (k.endsWith('_id') && obj[k] === '') {
        if (out === obj) out = { ...obj }
        out[k] = null
      }
    }
    return out
  }

  // Recupera ops enfileiradas antes do perfil/usuário carregar (organization_id/created_by
  // 'pending') e sanitiza colunas *_id vazias. Sem reparar created_by, a RLS
  // `created_by = auth.uid()` rejeita o insert e a op fica presa para sempre.
  const fixOrg = (row: Record<string, unknown>) => {
    const patch: Record<string, unknown> = {}
    if (row.organization_id === 'pending' || row.organization_id == null) patch.organization_id = activeOrgId
    // `created_by` é reparado em TRÊS casos, não só no 'pending':
    //
    //  - 'pending' ou nulo: op enfileirada antes de o perfil carregar;
    //  - **uuid de OUTRO usuário**: a fila mora no localStorage e a limpeza de cache é por
    //    ORGANIZAÇÃO, nunca por usuário. Alguém cria registros, sai, outra pessoa entra na mesma
    //    empresa no mesmo navegador — e a fila da primeira é drenada com a sessão da segunda.
    //    A RLS exige `created_by = auth.uid()`, então o insert é rejeitado e a op fica presa
    //    PARA SEMPRE. Antes deste reparo, esse dado nunca chegava ao servidor.
    //
    // Atribuir a autoria a quem está sincronizando é uma imprecisão pequena e assumida; a
    // alternativa é perder o registro, que é pior. Quem de fato criou continua no payload.
    if (row.created_by === 'pending' || row.created_by == null || row.created_by !== activeUserId) {
      patch.created_by = activeUserId
    }
    const out = Object.keys(patch).length ? { ...row, ...patch } : row
    return sanitizeIds(out)
  }

  const markOk = (op: PendingOp) => result.completed.push(op.id)
  // Erros do Supabase são objetos simples ({message,details,hint,code}), não Error —
  // String() neles daria "[object Object]". Extrai sempre uma mensagem legível.
  const errMessage = (e: unknown): string => {
    if (e instanceof Error) return e.message
    if (Array.isArray(e)) return e.map(errMessage).filter(Boolean).join(' | ') || 'Erro'
    if (e && typeof e === 'object') {
      const o = e as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown; error?: unknown }
      const parts = [o.message, o.details, o.hint].filter(Boolean).map(String)
      if (parts.length) return parts.join(' — ')
      if (o.error != null) return errMessage(o.error)   // wrappers { error: {...} }
      if (o.code) return `Erro ${String(o.code)}`
      try { return JSON.stringify(e) } catch { return 'Erro desconhecido' }
    }
    return String(e)
  }
  const markErr = (op: PendingOp, err: unknown) => {
    const msg = errMessage(err)
    console.warn(`[sync:${op.table}] op ${op.type} failed`, op, msg)
    result.lastError = msg
    result.errored.push(op.id)
  }

  // Executa UMA op (insert/update/delete) — lança em falha. Comportamento idêntico
  // ao anterior; é o caminho per-op usado tanto direto quanto no fallback do lote.
  async function applyOp(op: PendingOp) {
    if (op.type === 'insert' && op.row) {
      const { data, error } = await withAbort((signal) => supabase
        .from(op.table)
        .upsert(fixOrg(op.row as Record<string, unknown>) as never, { onConflict: 'id' })
        .select('id')
        .abortSignal(signal))
      if (error) throw error
      assertAffectedRows(op.table, op, data)
    } else if (op.type === 'update' && op.patch) {
      const softDeleteRpc = softDeleteRpcFor(op)
      // Soft-delete via UPDATE deleted_at: o RETURNING é filtrado pela RLS de SELECT
      // (deleted_at IS NULL) e volta 0 linhas MESMO no sucesso → não dá pra usar
      // .select()/assertAffectedRows (a op ficaria presa "para sempre", e o retry
      // após já-deletado casaria 0 linhas de novo). Confia só no erro; idempotente.
      const isSoftDelete = !softDeleteRpc && op.patch.deleted_at != null
      if (softDeleteRpc) {
        const { error } = await withAbort((signal) => supabase.rpc(softDeleteRpc, { p_id: op.recordId }).abortSignal(signal))
        if (error) throw error
      } else if (isSoftDelete) {
        const { error } = await withAbort((signal) => supabase
          .from(op.table)
          .update(sanitizeIds(op.patch as Record<string, unknown>) as never)
          .eq('id', op.recordId)
          .eq('organization_id', activeOrgId)
          .abortSignal(signal))
        if (error) throw error

        // CONFERE se apagou de verdade.
        //
        // Sem erro NÃO significa sucesso aqui: quando a policy de UPDATE tem `deleted_at is null`
        // ou gate de papel no USING, a linha simplesmente não casa — o Postgres devolve "0 linhas
        // atualizadas", sem erro nenhum. O registro sumia da tela, o servidor continuava
        // intacto, e ele REAPARECIA no próximo pull. Nenhum aviso em lugar nenhum.
        //
        // A verificação é barata e só roda no caminho de exclusão: a policy de SELECT filtra
        // `deleted_at is null`, então uma linha que continua VISÍVEL depois do update é prova de
        // que o update não pegou. Linha invisível = apagada (ou já não existia), que é sucesso.
        const { data: aindaVisivel } = await withAbort((signal) => supabase
          .from(op.table)
          .select('id')
          .eq('id', op.recordId)
          .eq('organization_id', activeOrgId)
          .abortSignal(signal))
        if (rowCount(aindaVisivel) > 0) {
          throw new Error(
            `A exclusão em ${op.table} não foi aceita pelo servidor: o registro continua lá. `
            + 'Normalmente é permissão — o seu papel não autoriza esta exclusão.',
          )
        }
      } else {
        const { data, error } = await withAbort((signal) => supabase
          .from(op.table)
          .update(sanitizeIds(op.patch as Record<string, unknown>) as never)
          .eq('id', op.recordId)
          .eq('organization_id', activeOrgId)
          .select('id')
          .abortSignal(signal))
        if (error) throw error
        assertAffectedRows(op.table, op, data)
      }
    } else if (op.type === 'delete') {
      if (op.approvalActionType) {
        const { error } = await withAbort((signal) => supabase.rpc('request_action', {
          p_action_type:  op.approvalActionType,
          p_target_table: op.table,
          p_target_id:    op.recordId,
          p_payload:      {},
        } as never).abortSignal(signal))
        if (error) throw error
      } else {
        // DELETE é idempotente: 0 linhas afetadas significa que o registro já não
        // existe (ex.: apagado em outro dispositivo) — isso é SUCESSO, não erro.
        // Não usa assertAffectedRows porque prenderia a op para sempre (todo retry
        // voltaria a casar 0 linhas) e, pior, bloquearia o pull da tabela (o guard
        // de pendingTables), deixando os dados obsoletos. Erros reais (RLS que
        // levanta exceção, rede) ainda vêm em `error` e disparam retry. Um delete
        // barrado por RLS que filtra silenciosamente (0 linhas) é reconciliado no
        // próximo pull, que traz a linha de volta — sem op presa.
        const { error } = await withAbort((signal) => supabase
          .from(op.table)
          .delete()
          .eq('id', op.recordId)
          .eq('organization_id', activeOrgId)
          .abortSignal(signal))
        if (error) throw error
      }
    }
  }

  // Coalescing create+delete SENSÍVEL À ORDEM: quando um registro tem insert/update
  // E exclusão acumulados na fila, a ÚLTIMA op decide o estado final:
  //  - termina em EXCLUSÃO (create→delete) → cancela os inserts/updates e roda só a
  //    exclusão (idempotente) → evita ressuscitar a linha.
  //  - termina em INSERT/UPDATE (delete→recria; ex.: rascunho→finaliza de novo com id
  //    determinístico) → cancela as exclusões e roda o insert/update final → evita
  //    perder um lançamento válido.
  // Cobre exclusão hard (type 'delete') e soft (update com deleted_at).
  const opKey = (o: PendingOp) => `${o.table}::${o.recordId}`
  const isDeleteIntent = (o: PendingOp) => o.type === 'delete' || (o.type === 'update' && o.patch?.deleted_at != null)
  const lastOp = new Map<string, PendingOp>()
  const hasDelete = new Set<string>()
  const hasNonDelete = new Set<string>()
  for (const op of queue) {
    const k = opKey(op)
    lastOp.set(k, op)   // sobrescreve → sobra a última op do registro (ordem da fila)
    if (isDeleteIntent(op)) hasDelete.add(k); else hasNonDelete.add(k)
  }
  const mixedKeys = new Set([...hasDelete].filter((k) => hasNonDelete.has(k)))
  const active: PendingOp[] = []
  for (const op of queue) {
    const k = opKey(op)
    if (!mixedKeys.has(k)) { active.push(op); continue }
    const last = lastOp.get(k)!
    // Termina em INSERT (upsert = linha completa) ou EXCLUSÃO → basta a ÚLTIMA op
    // (evita mandar duas linhas com o mesmo id no mesmo upsert). Se terminar em
    // UPDATE parcial (raro), preserva os inserts/updates na ordem e cancela só as
    // exclusões, para o update não rodar sobre linha inexistente.
    if (last.type === 'insert' || isDeleteIntent(last)) {
      if (op === last) active.push(op)
      else result.completed.push(op.id)
    } else {
      if (!isDeleteIntent(op)) active.push(op)
      else result.completed.push(op.id)
    }
  }

  // Despacha a fila preservando a ordem. Inserts CONSECUTIVOS na mesma tabela
  // viram UM upsert em lote (menos round-trips); se o lote falhar, cai pro
  // per-op para isolar a linha ruim e preservar o rastreio completed/errored.
  let i = 0
  while (i < active.length) {
    const op = active[i]
    if (op.type === 'insert' && op.row) {
      const group: PendingOp[] = []
      let j = i
      while (j < active.length && active[j].type === 'insert' && active[j].row && active[j].table === op.table) {
        group.push(active[j])
        j++
      }
      if (group.length === 1) {
        try { await applyOp(group[0]); markOk(group[0]) } catch (e) { markErr(group[0], e) }
      } else {
        try {
          const rows = group.map((g) => fixOrg(g.row as Record<string, unknown>))
          const { data, error } = await withAbort((signal) => supabase
            .from(op.table)
            .upsert(rows as never, { onConflict: 'id' })
            .select('id')
            .abortSignal(signal))
          if (error) throw error
          if (rowCount(data) < rows.length) {
            throw new Error(`Lote em ${op.table}: ${rowCount(data)}/${rows.length} confirmadas.`)
          }
          group.forEach(markOk)
        } catch {
          for (const g of group) {
            try { await applyOp(g); markOk(g) } catch (e) { markErr(g, e) }
          }
        }
      }
      i = j
    } else {
      try { await applyOp(op); markOk(op) } catch (e) { markErr(op, e) }
      i++
    }
  }

  return result
}

/**
 * Patch de campo (anti-clobber, Tier 1c): retorna só as colunas que mudaram
 * entre o row anterior e o novo (ambos mapeados pelo mesmo *ToRow do store).
 * Assim um update toca apenas o que o usuário mexeu — duas pessoas editando
 * campos diferentes do mesmo registro não sobrescrevem uma à outra.
 * Ignora id/organization_id/created_by; compara via JSON (cobre colunas jsonb).
 */
export function changedColumns(
  prevRow: Record<string, unknown>,
  nextRow: Record<string, unknown>,
): Record<string, unknown> {
  const skip = new Set(['id', 'organization_id', 'created_by'])
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(nextRow)) {
    if (skip.has(k)) continue
    if (JSON.stringify(prevRow[k]) !== JSON.stringify(v)) out[k] = v
  }
  return out
}

/**
 * Serializador de `flush` — uma drenagem por vez, por store.
 *
 * Sem isto, N chamadas seguidas de `flush` (ex.: um laço que grava 12 parcelas de um carnê)
 * tiram N snapshots da MESMA fila e reenviam as mesmas ops: N(N+1)/2 requisições para uma
 * gravação só, e a primeira op mandada N vezes. Em rede de canteiro isso estoura o timeout
 * e realimenta a fila.
 *
 * Quem chega durante uma drenagem não é descartado: marca `rerun` e recebe a mesma promessa;
 * ao terminar, se ainda houver fila, drena de novo. Nunca rejeita — o estado de erro é
 * responsabilidade do `drain` de cada store (que o expõe em `syncStatus`/`syncError`).
 *
 * Uso: `const serializar = makeFlushSerializer()` no corpo da fábrica do store, e
 * `flush: async () => serializar(async () => { ...corpo... }, () => get().pendingSync.length)`.
 */
export function makeFlushSerializer() {
  let inFlight: Promise<void> | null = null
  let rerun = false
  return function serializar(drain: () => Promise<void>, pendentes: () => number): Promise<void> {
    if (inFlight) { rerun = true; return inFlight }
    inFlight = (async () => {
      try {
        do { rerun = false; await drain() } while (rerun && pendentes() > 0)
      } catch { /* o drain já registra o erro no estado do store */ }
      finally { inFlight = null }
    })()
    return inFlight
  }
}

/**
 * Helper para construir uma PendingOp consistente.
 */
export function makeOp(opts: Omit<PendingOp, 'id' | 'retries' | 'createdAt'>): PendingOp {
  return {
    ...opts,
    id:        crypto.randomUUID(),
    retries:   0,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Merge do pull que PRESERVA os registros com op pendente (Fase 5 — anti "congelamento").
 * O padrão antigo (`pendingTables.has(T) ? null : pull`) pulava a tabela INTEIRA quando havia
 * QUALQUER op pendente — então uma op presa congelava o pull daquela tabela para sempre e o
 * estado local divergia em silêncio. Aqui, em vez de pular tudo, atualizamos com o servidor
 * os registros SEM op pendente e MANTEMOS os COM op pendente (não-sincronizados) do local.
 *  - serverItems null/undefined (offline/erro/non-prod) → mantém o local inteiro.
 *  - nada pendente na tabela → server é a verdade.
 * Assim, uma op presa nunca mais congela o resto da tabela, e nenhum dado local não-sincronizado
 * é apagado por um pull.
 */
export function mergePull<T extends { id?: string }>(
  serverItems: T[] | null | undefined,
  localItems: T[],
  pendingSync: PendingOp[],
  table: string,
): T[] {
  if (!serverItems) return localItems
  const pendingIds = new Set(pendingSync.filter((o) => o.table === table).map((o) => o.recordId))
  if (pendingIds.size === 0) return serverItems
  return [
    ...serverItems.filter((x) => x.id == null || !pendingIds.has(x.id)),
    ...localItems.filter((x) => x.id != null && pendingIds.has(x.id)),
  ]
}

/**
 * Pull genérico — busca todas as linhas da tabela (filtradas por RLS) e
 * devolve o array. O store decide como mapear pra suas entidades em memória.
 */
export async function pullTable<TRow = unknown>(
  table: string,
  orderBy: { column: string; ascending?: boolean; activeOnly?: boolean } = { column: 'created_at', ascending: false, activeOnly: true },
): Promise<TRow[] | null> {
  if (isNonProductionDataMode()) return null
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  const { profile } = useAuth.getState()
  if (!profile) return null

  const activeOnly = orderBy.activeOnly ?? true
  let query = supabase
    .from(table)
    .select('*')
    .eq('organization_id', profile.organization_id)
  if (activeOnly) query = query.is('deleted_at', null)

  const { data, error } = await query.order(orderBy.column, { ascending: orderBy.ascending ?? false })

  if (error) {
    const message = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase()
    if (activeOnly && message.includes('deleted_at')) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from(table)
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order(orderBy.column, { ascending: orderBy.ascending ?? false })
      if (!fallbackError) return (fallbackData ?? []) as TRow[]
    }
    console.warn(`[sync:${table}] pull failed`, error)
    return null
  }
  return (data ?? []) as TRow[]
}
