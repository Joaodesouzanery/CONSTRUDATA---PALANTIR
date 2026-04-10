/**
 * quantitativosStore.ts — Zustand store for the Quantitativos e Orçamento module.
 *
 * Security:
 *  - All IDs via crypto.randomUUID()
 *  - PDF/Excel parsing: text extraction only, no eval
 *  - Cross-store reads are lazy and read-only
 *  - No dangerouslySetInnerHTML
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type {
  QuantTab, CostBaseSource,
  OrcamentoItem, OrcamentoBudget, CustomBaseEntry,
} from '@/types'
import {
  MOCK_CURRENT_ITEMS,
  MOCK_BUDGETS,
  MOCK_CUSTOM_BASE,
} from '@/data/mockQuantitativos'

// ─── Mappers ──────────────────────────────────────────────────────────────────
function budgetToRow(b: OrcamentoBudget, orgId: string, userId: string) {
  return {
    id:              b.id,
    organization_id: orgId,
    project_id:      (b as { projectId?: string }).projectId ?? null,
    name:            b.name,
    cost_base:       b.costBase,
    bdi_global:      b.bdiGlobal,
    total_brl:       b.totalBRL,
    reference_date:  b.referenceDate,
    payload:         b as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function customBaseToRow(e: CustomBaseEntry, orgId: string, userId: string) {
  return {
    id:              e.id,
    organization_id: orgId,
    code:            e.code,
    description:     e.description ?? null,
    unit:            e.unit ?? null,
    unit_cost:       e.unitCost ?? null,
    category:        e.category ?? null,
    payload:         e as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

// ─── State interface ──────────────────────────────────────────────────────────

interface QuantitativosState {
  activeTab:    QuantTab
  costBase:     CostBaseSource
  currentItems: OrcamentoItem[]
  bdiGlobal:    number
  customBase:   CustomBaseEntry[]
  savedBudgets: OrcamentoBudget[]

  // Navigation
  setActiveTab(tab: QuantTab): void
  setCostBase(base: CostBaseSource): void

  // Items CRUD
  addItem(item: Omit<OrcamentoItem, 'id' | 'totalCost'>): void
  addItems(items: Omit<OrcamentoItem, 'id' | 'totalCost'>[]): void
  updateItem(id: string, updates: Partial<OrcamentoItem>): void
  removeItem(id: string): void
  resetItems(): void

  // Wizard "Criar Orçamento do Zero"
  createBlankBudget(input: {
    costBase:            CostBaseSource
    bdiGlobal:           number
    obraType:            'saneamento' | 'edificacao' | 'pavimentacao' | 'geral'
    includeStarterItems: boolean
  }): void

  // Cross-module import (lazy, read-only)
  importFromPreConstrucao(): Promise<void>
  importFromSuprimentos(): Promise<void>

  // Custom base management
  importCustomBase(entries: Omit<CustomBaseEntry, 'id'>[]): void
  addCustomEntry(entry: Omit<CustomBaseEntry, 'id'>): void
  removeCustomEntry(id: string): void

  // Budget history
  saveBudget(name: string, description?: string): void
  loadBudget(id: string): void
  deleteBudget(id: string): void

  // BDI
  setBdiGlobal(pct: number): void

  // Recalculate all item totals with the current bdiGlobal
  calculateBudget(): void

  loadDemoData(): void
  clearData(): void

  // Sync (Sprint 4)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function calcTotal(item: Omit<OrcamentoItem, 'id' | 'totalCost'>): number {
  return item.quantity * item.unitCost * (1 + item.bdi / 100)
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useQuantitativosStore = create<QuantitativosState>()(
  persist(
    (set, get) => ({
  activeTab:    'composicao',
  costBase:     'sinapi',
  currentItems: [],
  bdiGlobal:    25,
  customBase:   [],
  savedBudgets: [],

  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  // ── Navigation ────────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),
  setCostBase:  (base) => set({ costBase: base }),

  // ── Items CRUD ────────────────────────────────────────────────────────────────

  addItem: (item) =>
    set((s) => ({
      currentItems: [
        ...s.currentItems,
        { ...item, id: crypto.randomUUID(), totalCost: calcTotal(item) },
      ],
    })),

  addItems: (items) =>
    set((s) => ({
      currentItems: [
        ...s.currentItems,
        ...items.map((item) => ({ ...item, id: crypto.randomUUID(), totalCost: calcTotal(item) })),
      ],
    })),

  updateItem: (id, updates) =>
    set((s) => ({
      currentItems: s.currentItems.map((it) => {
        if (it.id !== id) return it
        const merged = { ...it, ...updates }
        merged.totalCost = merged.quantity * merged.unitCost * (1 + merged.bdi / 100)
        return merged
      }),
    })),

  removeItem: (id) =>
    set((s) => ({ currentItems: s.currentItems.filter((it) => it.id !== id) })),

  resetItems: () => set({ currentItems: [] }),

  /**
   * Cria um orçamento limpo a partir do wizard.
   * - Limpa currentItems
   * - Seta costBase e bdiGlobal
   * - Opcionalmente popula 5 itens placeholder do tipo de obra (qty=0, cost=0)
   *   para o usuário só preencher os números.
   */
  createBlankBudget: ({ costBase, bdiGlobal, obraType, includeStarterItems }) => {
    const starterItems: Omit<OrcamentoItem, 'id' | 'totalCost'>[] = []
    if (includeStarterItems) {
      const STARTER_TEMPLATES: Record<typeof obraType, Omit<OrcamentoItem, 'id' | 'totalCost'>[]> = {
        saneamento: [
          { code: 'SINAPI-93358', description: 'Escavação mecanizada de vala (até 1.5m, solo de 1ª categoria)', unit: 'm³', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Escavação',     source: costBase },
          { code: 'SINAPI-89714', description: 'Tubo PVC PBA, JEI, DN 200mm, para rede de água',                  unit: 'm',  quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Tubulação',    source: costBase },
          { code: 'SINAPI-93382', description: 'Reaterro mecanizado de vala com compactação',                     unit: 'm³', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Reaterro',     source: costBase },
          { code: 'SINAPI-74166', description: 'Poço de visita em concreto pré-moldado (DN 1000mm)',              unit: 'un', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'PV',           source: costBase },
          { code: 'SINAPI-95995', description: 'Recomposição de pavimento asfáltico (CBUQ, 5cm)',                 unit: 'm²', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Pavimentação', source: costBase },
        ],
        edificacao: [
          { code: 'SINAPI-92775', description: 'Concreto FCK 25 MPa usinado bombeado',                            unit: 'm³', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Concreto',     source: costBase },
          { code: 'SINAPI-92778', description: 'Aço CA-50 8.0mm corte, dobra e montagem',                         unit: 'kg', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Armação',      source: costBase },
          { code: 'SINAPI-87496', description: 'Alvenaria de bloco cerâmico furado 14x19x39cm',                   unit: 'm²', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Alvenaria',    source: costBase },
          { code: 'SINAPI-87905', description: 'Reboco/emboço para parede interna',                               unit: 'm²', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Revestimento', source: costBase },
          { code: 'SINAPI-88489', description: 'Pintura latex PVA, 2 demãos',                                     unit: 'm²', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Acabamento',   source: costBase },
        ],
        pavimentacao: [
          { code: 'SINAPI-72947', description: 'Regularização e compactação de subleito',                         unit: 'm²', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Subleito',     source: costBase },
          { code: 'SINAPI-95878', description: 'Sub-base de brita graduada simples (BGS), 15cm',                  unit: 'm³', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Sub-base',     source: costBase },
          { code: 'SINAPI-95995', description: 'Concreto betuminoso usinado a quente (CBUQ), 5cm',                unit: 'm²', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Capa',         source: costBase },
          { code: 'SINAPI-94275', description: 'Meio-fio pré-moldado de concreto (15x30cm)',                      unit: 'm',  quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Meio-fio',     source: costBase },
          { code: 'SINAPI-94322', description: 'Sinalização horizontal de pavimento — tinta acrílica',            unit: 'm²', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Sinalização',  source: costBase },
        ],
        geral: [
          { code: 'NOVO-001', description: 'Item 1 — descrever',  unit: 'un', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Geral', source: costBase },
          { code: 'NOVO-002', description: 'Item 2 — descrever',  unit: 'un', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Geral', source: costBase },
          { code: 'NOVO-003', description: 'Item 3 — descrever',  unit: 'un', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Geral', source: costBase },
          { code: 'NOVO-004', description: 'Item 4 — descrever',  unit: 'un', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Geral', source: costBase },
          { code: 'NOVO-005', description: 'Item 5 — descrever',  unit: 'un', quantity: 0, unitCost: 0, bdi: bdiGlobal, category: 'Geral', source: costBase },
        ],
      }
      starterItems.push(...STARTER_TEMPLATES[obraType])
    }

    set({
      currentItems: starterItems.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        totalCost: calcTotal(item),
      })),
      costBase,
      bdiGlobal,
      activeTab: 'composicao',
    })
  },

  // ── Cross-module import ───────────────────────────────────────────────────────

  importFromPreConstrucao: async () => {
    try {
      const { usePreConstrucaoStore } = await import('./preConstrucaoStore')
      const state = usePreConstrucaoStore.getState() as {
        takeoffItems: { id: string; description: string; normalizedQuantity?: number; quantity: number; normalizedUnit?: string; unit: string }[]
        costMatches: { takeoffItemId: string; code: string; description: string; unit: string; unitCost: number; selected: boolean; source: string }[]
        customBase: { code: string; description: string; unit: string; unitCost: number; category: string }[]
      }

      const bdi = get().bdiGlobal
      const selectedMatches = (state.costMatches ?? []).filter((m) => m.selected)

      const newItems: OrcamentoItem[] = selectedMatches.map((m) => {
        const takeoff = (state.takeoffItems ?? []).find((t) => t.id === m.takeoffItemId)
        const qty = takeoff?.normalizedQuantity ?? takeoff?.quantity ?? 1
        const totalCost = qty * m.unitCost * (1 + bdi / 100)
        return {
          id:          crypto.randomUUID(),
          code:        m.code,
          description: m.description,
          unit:        m.unit,
          quantity:    qty,
          unitCost:    m.unitCost,
          bdi,
          totalCost,
          category:    'Pré-Construção',
          source:      (m.source as CostBaseSource) ?? 'sinapi',
        }
      })

      if (newItems.length > 0) {
        set((s) => ({ currentItems: [...s.currentItems, ...newItems] }))
      }
    } catch {
      // silently ignore if preConstrucaoStore not available
    }
  },

  importFromSuprimentos: async () => {
    try {
      const { useSuprimentosStore } = await import('./suprimentosStore')
      const state = useSuprimentosStore.getState() as {
        purchaseOrders: { items: { id: string; description: string; quantity: number; unit: string; unitPrice: number }[] }[]
      }

      const bdi = get().bdiGlobal
      const allItems = (state.purchaseOrders ?? []).flatMap((po) => po.items ?? [])

      const newItems: OrcamentoItem[] = allItems.map((poi) => {
        const totalCost = poi.quantity * poi.unitPrice * (1 + bdi / 100)
        return {
          id:          crypto.randomUUID(),
          code:        `PO-${poi.id.slice(0, 6).toUpperCase()}`,
          description: poi.description,
          unit:        poi.unit,
          quantity:    poi.quantity,
          unitCost:    poi.unitPrice,
          bdi,
          totalCost,
          category:    'Suprimentos',
          source:      'manual' as CostBaseSource,
        }
      })

      if (newItems.length > 0) {
        set((s) => ({ currentItems: [...s.currentItems, ...newItems] }))
      }
    } catch {
      // silently ignore
    }
  },

  // ── Custom base ───────────────────────────────────────────────────────────────

  importCustomBase: (entries) => {
    const { orgId, userId } = ctxAuth()
    const withIds: CustomBaseEntry[] = entries.map((e) => ({ ...e, id: crypto.randomUUID() }))
    set((s) => ({
      customBase:  [...s.customBase, ...withIds],
      pendingSync: [
        ...s.pendingSync,
        ...withIds.map((e) => makeOp({ entity: 'custom_base', type: 'insert', recordId: e.id, row: customBaseToRow(e, orgId, userId), table: 'quantitativos_custom_base' })),
      ],
    }))
    void get().flush()
  },

  addCustomEntry: (entry) => {
    const id = crypto.randomUUID()
    const newEntry: CustomBaseEntry = { ...entry, id }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      customBase:  [...s.customBase, newEntry],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'custom_base', type: 'insert', recordId: id, row: customBaseToRow(newEntry, orgId, userId), table: 'quantitativos_custom_base' })],
    }))
    void get().flush()
  },

  removeCustomEntry: (id) => {
    set((s) => ({
      customBase:  s.customBase.filter((e) => e.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'custom_base', type: 'delete', recordId: id, table: 'quantitativos_custom_base', approvalActionType: 'delete_quantitativo_custom_base' })],
    }))
    void get().flush()
  },

  // ── Budget history ────────────────────────────────────────────────────────────

  saveBudget: (name, description) => {
    const { currentItems, costBase, bdiGlobal } = get()
    const now = new Date().toISOString()
    const totalBRL = currentItems.reduce((s, i) => s + i.totalCost, 0)
    const budget: OrcamentoBudget = {
      id:            crypto.randomUUID(),
      name,
      description,
      costBase,
      items:         currentItems.map((i) => ({ ...i })),
      bdiGlobal,
      totalBRL,
      referenceDate: new Date().toISOString().slice(0, 7),
      createdAt:     now,
      updatedAt:     now,
    }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      savedBudgets: [budget, ...s.savedBudgets],
      pendingSync:  [...s.pendingSync, makeOp({ entity: 'budget', type: 'insert', recordId: budget.id, row: budgetToRow(budget, orgId, userId), table: 'quantitativos_budgets' })],
    }))
    void get().flush()
  },

  loadBudget: (id) => {
    const budget = get().savedBudgets.find((b) => b.id === id)
    if (!budget) return
    set({
      currentItems: budget.items.map((i) => ({ ...i })),
      costBase:     budget.costBase,
      bdiGlobal:    budget.bdiGlobal,
    })
  },

  deleteBudget: (id) => {
    set((s) => ({
      savedBudgets: s.savedBudgets.filter((b) => b.id !== id),
      pendingSync:  [...s.pendingSync, makeOp({ entity: 'budget', type: 'delete', recordId: id, table: 'quantitativos_budgets', approvalActionType: 'delete_quantitativo_budget' })],
    }))
    void get().flush()
  },

  // ── BDI ──────────────────────────────────────────────────────────────────────

  setBdiGlobal: (pct) => set({ bdiGlobal: Math.max(0, Math.min(100, pct)) }),

  calculateBudget: () =>
    set((s) => ({
      currentItems: s.currentItems.map((it) => ({
        ...it,
        totalCost: it.quantity * it.unitCost * (1 + s.bdiGlobal / 100),
      })),
    })),

  // ── Demo / Clear ─────────────────────────────────────────────────────────────

  loadDemoData: () =>
    set({
      currentItems: MOCK_CURRENT_ITEMS.map((i) => ({ ...i })),
      savedBudgets: MOCK_BUDGETS,
      customBase:   MOCK_CUSTOM_BASE,
      costBase:     'sinapi',
      bdiGlobal:    25,
    }),

  clearData: () =>
    set({
      currentItems: [],
      savedBudgets: [],
      customBase:   [],
      bdiGlobal:    25,
      pendingSync:  [],
      syncError:    null,
    }),

  flush: async () => {
    const queue = get().pendingSync
    if (queue.length === 0) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
    const { profile } = useAuth.getState()
    if (!profile) { set({ syncStatus: 'unauth' }); return }
    set({ syncStatus: 'syncing', syncError: null })
    const result = await flushQueue(queue)
    set((s) => ({
      pendingSync: s.pendingSync
        .filter((p) => !result.completed.includes(p.id))
        .map((p) => result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p),
      syncStatus:   result.lastError ? 'error' : 'idle',
      lastSyncedAt: new Date().toISOString(),
      syncError:    result.lastError ?? null,
    }))
  },

  pull: async () => {
    const budgets = await pullTable<{ payload: OrcamentoBudget }>('quantitativos_budgets')
    const cb      = await pullTable<{ payload: CustomBaseEntry }>('quantitativos_custom_base')
    if (budgets) set({ savedBudgets: budgets.map((r) => r.payload) })
    if (cb)      set({ customBase:   cb.map((r) => r.payload) })
    set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
  },
    }),
    {
      name: 'cdata-quantitativos',
      partialize: (s) => ({
        currentItems: s.currentItems,
        savedBudgets: s.savedBudgets,
        customBase:   s.customBase,
        costBase:     s.costBase,
        bdiGlobal:    s.bdiGlobal,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useQuantitativosStore.getState().flush()
  })
}
