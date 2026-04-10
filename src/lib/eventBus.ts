/**
 * eventBus.ts — Pub/sub interno tipado para domain events cross-module.
 *
 * Camada 1 da ontologia unificada (Sprint pós-6). Stores publicam eventos
 * quando algo importante acontece (ex: rdo.closed) e outros stores escutam
 * para reagir (re-pull, recompute, etc.).
 *
 * Não substitui Zustand — é complementar. Não tem estado próprio, só pub/sub.
 *
 * Uso:
 *   import { eventBus } from '@/lib/eventBus'
 *
 *   // Publicar
 *   eventBus.emit({ type: 'rdo.closed', rdoId: '...', projectId: '...', date: '2026-04-09' })
 *
 *   // Escutar (retorna unsubscribe)
 *   const off = eventBus.on('rdo.closed', (e) => { void store.pull() })
 *   off()  // remove handler
 */

// ─── Tipos de evento ──────────────────────────────────────────────────────────

export type DomainEvent =
  // RDO closed → planejamento atualiza %
  | { type: 'rdo.closed';            rdoId: string;       projectId?: string | null; date: string }
  // Purchase order fechada → EVM AC
  | { type: 'po.closed';             poId: string;        projectId?: string | null; totalBrl: number }
  // Purchase order recebida (goods receipt) → estoque disponível
  | { type: 'po.received';           poId: string;        projectId?: string | null }
  // FVS NC aberta → LPS bloqueia restrição
  | { type: 'fvs.nc_opened';         fvsId: string;       projectId?: string | null; ncNumber: string; description?: string }
  // FVS NC resolvida → LPS libera restrição
  | { type: 'fvs.nc_resolved';       fvsId: string;       ncNumber: string }
  // Worker absent → Planejamento alerta produtividade
  | { type: 'worker.absent';         workerId: string;    projectId?: string | null; date: string }
  // Equipment alocado a projeto
  | { type: 'equipment.allocated';   equipmentId: string; projectId: string }
  // Atividade master atrasou → propagação de delay
  | { type: 'master_activity.delayed'; activityId: string; projectId?: string | null; delayDays: number }
  // Project criado/alterado
  | { type: 'project.created';       projectId: string }
  | { type: 'project.updated';       projectId: string }
  // Tabela genérica atualizada via Supabase Realtime — proxy de baixo nível
  | { type: 'realtime.row_changed';  table: string;       rowId?: string;            organizationId?: string; payload?: Record<string, unknown> }

export type DomainEventType = DomainEvent['type']

type EventOf<T extends DomainEventType> = Extract<DomainEvent, { type: T }>
type Handler<T extends DomainEventType> = (event: EventOf<T>) => void

// ─── Implementação ────────────────────────────────────────────────────────────

type AnyHandler = (event: DomainEvent) => void

class EventBus {
  private listeners = new Map<DomainEventType, Set<AnyHandler>>()

  /** Publica um evento síncrono — todos os handlers rodam em sequência. */
  emit(event: DomainEvent): void {
    const handlers = this.listeners.get(event.type)
    if (!handlers || handlers.size === 0) return
    for (const h of handlers) {
      try {
        h(event)
      } catch (err) {
        console.warn(`[eventBus] handler for ${event.type} threw`, err)
      }
    }
  }

  /** Inscreve handler para um tipo de evento. Retorna função de unsubscribe. */
  on<T extends DomainEventType>(type: T, handler: Handler<T>): () => void {
    let set = this.listeners.get(type)
    if (!set) {
      set = new Set()
      this.listeners.set(type, set)
    }
    const wrapped = handler as unknown as AnyHandler
    set.add(wrapped)
    return () => {
      set!.delete(wrapped)
    }
  }

  /** Remove handler explicitamente (alternativa à closure de unsubscribe). */
  off<T extends DomainEventType>(type: T, handler: Handler<T>): void {
    this.listeners.get(type)?.delete(handler as unknown as AnyHandler)
  }

  /** Limpa TODOS os handlers — usar com cuidado, geralmente só em testes. */
  clear(): void {
    this.listeners.clear()
  }

  /** Retorna número de handlers ativos por tipo (debug). */
  count(type?: DomainEventType): number {
    if (type) return this.listeners.get(type)?.size ?? 0
    let total = 0
    for (const set of this.listeners.values()) total += set.size
    return total
  }
}

export const eventBus = new EventBus()

// Exposição em window para debug no console do browser
if (typeof window !== 'undefined') {
  ;(window as unknown as { __eventBus?: EventBus }).__eventBus = eventBus
}
