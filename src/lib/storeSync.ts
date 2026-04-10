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
 * Quando push falha, retry up to 5x; depois drop e marca syncError.
 */
import { supabase } from './supabase'
import { useAuth } from './auth'

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
  completed:  string[]   // ids das ops drenadas (sucesso ou drop)
  errored:    string[]   // ids que falharam mas continuam na fila
  lastError?: string
}

/**
 * Drena uma fila de pending ops contra o Supabase.
 * Retorna quais ops foram completadas (remover da fila) e quais erraram
 * (incrementar retry, manter na fila se < 5 retries).
 */
export async function flushQueue(queue: PendingOp[]): Promise<FlushResult> {
  const result: FlushResult = { completed: [], errored: [] }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return result
  }

  const { profile, user } = useAuth.getState()
  if (!profile || !user) {
    return result
  }

  for (const op of queue) {
    try {
      if (op.type === 'insert' && op.row) {
        const { error } = await supabase.from(op.table).insert(op.row as never)
        if (error) throw error
      } else if (op.type === 'update' && op.patch) {
        const { error } = await supabase
          .from(op.table)
          .update(op.patch as never)
          .eq('id', op.recordId)
        if (error) throw error
      } else if (op.type === 'delete') {
        if (op.approvalActionType) {
          const { error } = await supabase.rpc('request_action', {
            p_action_type:  op.approvalActionType,
            p_target_table: op.table,
            p_target_id:    op.recordId,
            p_payload:      {},
          } as never)
          if (error) throw error
        } else {
          const { error } = await supabase.from(op.table).delete().eq('id', op.recordId)
          if (error) throw error
        }
      }
      result.completed.push(op.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[sync:${op.table}] op ${op.type} failed`, op, msg)
      result.lastError = msg
      if (op.retries >= 4) {
        // Drop após 5 tentativas (drop = considera completed pra remover da fila)
        result.completed.push(op.id)
      } else {
        result.errored.push(op.id)
      }
    }
  }

  return result
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
 * Pull genérico — busca todas as linhas da tabela (filtradas por RLS) e
 * devolve o array. O store decide como mapear pra suas entidades em memória.
 */
export async function pullTable<TRow = unknown>(
  table: string,
  orderBy: { column: string; ascending?: boolean } = { column: 'created_at', ascending: false },
): Promise<TRow[] | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null
  const { profile } = useAuth.getState()
  if (!profile) return null

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order(orderBy.column, { ascending: orderBy.ascending ?? false })

  if (error) {
    console.warn(`[sync:${table}] pull failed`, error)
    return null
  }
  return (data ?? []) as TRow[]
}
