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
  lastError?: string
}

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
export async function flushQueue(queue: PendingOp[]): Promise<FlushResult> {
  const result: FlushResult = { completed: [], errored: [] }

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

  for (const op of queue) {
    try {
      if (op.type === 'insert' && op.row) {
        // Recupera ops enfileiradas antes do perfil carregar: o row pode ter sido
        // carimbado com organization_id 'pending'. Reescreve para a organização
        // ativa no momento do flush (que já é conhecida aqui).
        const row =
          op.row.organization_id === 'pending' || op.row.organization_id == null
            ? { ...op.row, organization_id: activeOrgId }
            : op.row
        const { data, error } = await supabase
          .from(op.table)
          .upsert(row as never, { onConflict: 'id' })
          .select('id')
        if (error) throw error
        assertAffectedRows(op.table, op, data)
      } else if (op.type === 'update' && op.patch) {
        const softDeleteRpc = softDeleteRpcFor(op)
        const { data, error } = softDeleteRpc
          ? await supabase.rpc(softDeleteRpc, { p_id: op.recordId })
          : await supabase
            .from(op.table)
            .update(op.patch as never)
            .eq('id', op.recordId)
            .eq('organization_id', profile.organization_id)
            .select('id')
        if (error) throw error
        assertAffectedRows(op.table, op, data)
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
          const { data, error } = await supabase
            .from(op.table)
            .delete()
            .eq('id', op.recordId)
            .eq('organization_id', profile.organization_id)
            .select('id')
          if (error) throw error
          assertAffectedRows(op.table, op, data)
        }
      }
      result.completed.push(op.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[sync:${op.table}] op ${op.type} failed`, op, msg)
      result.lastError = msg
      result.errored.push(op.id)
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
