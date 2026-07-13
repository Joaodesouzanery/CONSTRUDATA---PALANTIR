/**
 * realtime.ts — Wrapper de Supabase Realtime channels (Camada 3 da ontologia).
 *
 * Inscreve um channel global por organização que escuta INSERT/UPDATE/DELETE
 * nas tabelas críticas (RDO, plan_trechos, purchase_orders, fvs, lps_*, EVM,
 * project_dashboard_view). Cada evento Supabase vira um domain event no
 * eventBus interno do cliente — fechando o loop:
 *
 *   Cliente A: insere RDO
 *     ↓
 *   Trigger SQL atualiza plan_trechos.payload.executedMeters (sprint 0035)
 *     ↓
 *   Supabase Realtime emite UPDATE plan_trechos
 *     ↓
 *   Cliente B (e A) recebem o evento
 *     ↓
 *   eventBus.emit({ type: 'realtime.row_changed', table: 'plan_trechos', ... })
 *     ↓
 *   planejamentoStore escutava esse tipo → re-pull
 *     ↓
 *   UI atualiza sozinha
 *
 * Pré-requisito: habilitar Realtime nas tabelas no Supabase Dashboard
 * (Settings → Realtime → adicionar tabelas críticas).
 */
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { eventBus } from './eventBus'

/** Tabelas que escutamos via Realtime. Lista enxuta — não escutar tabelas pesadas (BIM segments, photos). */
const WATCHED_TABLES = [
  'rdo',
  'plan_trechos',
  'master_activities',
  'plano_execucao',
  'lookahead_derived_activities',
  'purchase_orders',
  'goods_receipts',
  'invoices',
  'suprimentos_estoque_itens',
  'suprimentos_estoque_movimentacoes',
  'suprimentos_depositos',
  'fvs',
  'lps_restrictions',
  'lps_activities',
  'measurement_sources',
  'measurement_periods',
  'measurement_memory_lines',
  'measurement_financial_entries',
  'measurement_contract_items',
  'evm_work_packages',
  'evm_cost_accounts',
  'projects',
  'project_documents',
  'economy_baselines',
  'economy_events',
  'economy_reports',
  'economy_valuation_rules',
  'workers',
  'worker_absences',
  'shifts',
] as const

let activeChannel: RealtimeChannel | null = null
let activeOrgId: string | null = null

/* ── Coalescer de eventos (2b) ───────────────────────────────────────────────
   Sem isto, uma operação em lote (ex.: importar 500 linhas) emite 500 eventos
   `realtime.row_changed` e cada store inscrito re-puxa a tabela inteira 500×.
   Aqui juntamos as tabelas alteradas numa janela curta e emitimos UMA vez por
   tabela — os subscribers re-puxam no máximo 1× por tabela por janela.
   O atraso (~350ms) é imperceptível para sincronização entre clientes. */
const COALESCE_MS = 350
let coalesceBuffer = new Map<string, string | undefined>() // tabela -> último rowId
let coalesceTimer: ReturnType<typeof setTimeout> | null = null

function resetCoalesce() {
  if (coalesceTimer) {
    clearTimeout(coalesceTimer)
    coalesceTimer = null
  }
  coalesceBuffer = new Map()
}

function scheduleCoalescedEmit(organizationId: string) {
  if (coalesceTimer) return
  coalesceTimer = setTimeout(() => {
    coalesceTimer = null
    const buffered = coalesceBuffer
    coalesceBuffer = new Map()
    for (const [table, rowId] of buffered) {
      eventBus.emit({ type: 'realtime.row_changed', table, rowId, organizationId })
    }
  }, COALESCE_MS)
}

/**
 * Inscreve um channel global para a organização. Idempotente: se já existe
 * um channel para essa org, retorna o mesmo. Se a org muda, fecha o anterior.
 */
export function subscribeOrgRealtime(organizationId: string): RealtimeChannel | null {
  if (typeof window === 'undefined') return null

  // Mesma org → reutiliza
  if (activeChannel && activeOrgId === organizationId) {
    return activeChannel
  }

  // Org mudou → encerra o anterior
  if (activeChannel) {
    void activeChannel.unsubscribe()
    activeChannel = null
    activeOrgId = null
    resetCoalesce()
  }

  // Cria channel novo
  const channel = supabase.channel(`org-changes:${organizationId}`)

  // Inscreve para cada tabela watched, filtrando por organization_id
  for (const table of WATCHED_TABLES) {
    channel.on(
      'postgres_changes' as never,
      {
        event:  '*',
        schema: 'public',
        table,
        filter: `organization_id=eq.${organizationId}`,
      } as never,
      ((payload: { eventType: string; new?: { id?: string }; old?: { id?: string }; table: string }) => {
        const rowId = (payload.new?.id ?? payload.old?.id) as string | undefined
        // Coalesce: registra a tabela alterada e agenda uma única emissão por janela.
        coalesceBuffer.set(payload.table, rowId)
        scheduleCoalescedEmit(organizationId)
      }) as never,
    )
  }

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.info(`[realtime] subscribed to org ${organizationId}`)
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      console.warn(`[realtime] channel error for org ${organizationId}: ${status}`)
    }
  })

  activeChannel = channel
  activeOrgId = organizationId
  return channel
}

/** Desinscreve o channel atual (chamar no logout). */
export function unsubscribeOrgRealtime(): void {
  if (activeChannel) {
    void activeChannel.unsubscribe()
    activeChannel = null
    activeOrgId = null
    resetCoalesce()
    console.info('[realtime] unsubscribed')
  }
}

/** Helper: retorna se há channel ativo (debug). */
export function isRealtimeActive(): boolean {
  return activeChannel !== null
}
