import { create } from 'zustand'
import type {
  MedicaoTab,
  MedicaoSheet,
  MedicaoItem,
  ConferenciaResult,
} from '@/types'
import {
  MOCK_MEDICAO_SHEETS,
  MOCK_CONFERENCIA_RESULTS,
} from '@/data/mockMedicao'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeTotal(items: MedicaoItem[]): number {
  return parseFloat(items.reduce((sum, it) => sum + it.valorMedido, 0).toFixed(2))
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function now(): string {
  return new Date().toISOString()
}

// ─── Store interface ─────────────────────────────────────────────────────────

interface MedicaoState {
  activeTab: MedicaoTab
  sheets: MedicaoSheet[]
  conferenciaResults: ConferenciaResult[]

  setActiveTab: (tab: MedicaoTab) => void

  addSheet: (sheet: Omit<MedicaoSheet, 'id' | 'createdAt' | 'updatedAt' | 'totalBRL'>) => string
  updateSheet: (id: string, patch: Partial<MedicaoSheet>) => void
  removeSheet: (id: string) => void

  addItem: (sheetId: string, item: Omit<MedicaoItem, 'id' | 'valorMedido'>) => void
  updateItem: (sheetId: string, itemId: string, patch: Partial<MedicaoItem>) => void
  removeItem: (sheetId: string, itemId: string) => void

  importItems: (sheetId: string, items: Omit<MedicaoItem, 'id'>[]) => void

  runConferencia: (contratoSheetId: string, previsaoSheetId: string) => void
  clearConferenciaResults: () => void

  loadDemoData: () => void
  clearData: () => void
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useMedicaoStore = create<MedicaoState>((set, get) => ({
  activeTab: 'sabesp',
  sheets: [],
  conferenciaResults: [],

  // ── Tab ──────────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Sheets ───────────────────────────────────────────────────────────────

  addSheet: (sheet) => {
    const id = crypto.randomUUID()
    const totalBRL = computeTotal(sheet.items)
    const timestamp = now()

    set((state) => ({
      sheets: [
        ...state.sheets,
        {
          ...sheet,
          id,
          totalBRL,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    }))

    return id
  },

  updateSheet: (id, patch) =>
    set((state) => ({
      sheets: state.sheets.map((s) => {
        if (s.id !== id) return s
        const updated = { ...s, ...patch, updatedAt: now() }
        updated.totalBRL = computeTotal(updated.items)
        return updated
      }),
    })),

  removeSheet: (id) =>
    set((state) => ({
      sheets: state.sheets.filter((s) => s.id !== id),
    })),

  // ── Items ────────────────────────────────────────────────────────────────

  addItem: (sheetId, item) =>
    set((state) => ({
      sheets: state.sheets.map((s) => {
        if (s.id !== sheetId) return s
        const valorMedido = parseFloat((item.qtdMedida * item.precoUnitario).toFixed(2))
        const newItem: MedicaoItem = {
          ...item,
          id: crypto.randomUUID(),
          valorMedido,
        }
        const items = [...s.items, newItem]
        return { ...s, items, totalBRL: computeTotal(items), updatedAt: now() }
      }),
    })),

  updateItem: (sheetId, itemId, patch) =>
    set((state) => ({
      sheets: state.sheets.map((s) => {
        if (s.id !== sheetId) return s
        const items = s.items.map((it) => {
          if (it.id !== itemId) return it
          const updated = { ...it, ...patch }
          // Recalculate valorMedido if qty or price changed
          if ('qtdMedida' in patch || 'precoUnitario' in patch) {
            updated.valorMedido = parseFloat(
              (updated.qtdMedida * updated.precoUnitario).toFixed(2),
            )
          }
          return updated
        })
        return { ...s, items, totalBRL: computeTotal(items), updatedAt: now() }
      }),
    })),

  removeItem: (sheetId, itemId) =>
    set((state) => ({
      sheets: state.sheets.map((s) => {
        if (s.id !== sheetId) return s
        const items = s.items.filter((it) => it.id !== itemId)
        return { ...s, items, totalBRL: computeTotal(items), updatedAt: now() }
      }),
    })),

  // ── Import ───────────────────────────────────────────────────────────────

  importItems: (sheetId, items) =>
    set((state) => ({
      sheets: state.sheets.map((s) => {
        if (s.id !== sheetId) return s
        const newItems: MedicaoItem[] = items.map((it) => ({
          ...it,
          id: crypto.randomUUID(),
        }))
        const allItems = [...s.items, ...newItems]
        return { ...s, items: allItems, totalBRL: computeTotal(allItems), updatedAt: now() }
      }),
    })),

  // ── Conferência ──────────────────────────────────────────────────────────

  runConferencia: (contratoSheetId, previsaoSheetId) => {
    const { sheets } = get()
    const contratoSheet = sheets.find((s) => s.id === contratoSheetId)
    const previsaoSheet = sheets.find((s) => s.id === previsaoSheetId)

    if (!contratoSheet || !previsaoSheet) return

    const results: ConferenciaResult[] = []
    const matchedPrevisao = new Set<string>()

    for (const ci of contratoSheet.items) {
      const normC = normalize(ci.descricao)

      // Find best match by description similarity
      let bestMatch: MedicaoItem | null = null
      for (const pi of previsaoSheet.items) {
        const normP = normalize(pi.descricao)
        if (normC.includes(normP) || normP.includes(normC)) {
          bestMatch = pi
          break
        }
      }

      if (bestMatch) {
        matchedPrevisao.add(bestMatch.id)
        const diferenca = parseFloat((ci.valorMedido - bestMatch.valorMedido).toFixed(2))
        const diferencaPct =
          bestMatch.valorMedido !== 0
            ? parseFloat(((diferenca / bestMatch.valorMedido) * 100).toFixed(1))
            : 0

        results.push({
          itemContrato: ci.descricao,
          itemPrevisao: bestMatch.descricao,
          matchStatus: Math.abs(diferencaPct) <= 5 ? 'matched' : 'divergent',
          valorContrato: ci.valorMedido,
          valorPrevisao: bestMatch.valorMedido,
          diferenca,
          diferencaPct,
        })
      } else {
        results.push({
          itemContrato: ci.descricao,
          itemPrevisao: '—',
          matchStatus: 'missing_previsao',
          valorContrato: ci.valorMedido,
          valorPrevisao: 0,
          diferenca: ci.valorMedido,
          diferencaPct: 100,
        })
      }
    }

    // Items in previsao not matched to contrato
    for (const pi of previsaoSheet.items) {
      if (!matchedPrevisao.has(pi.id)) {
        results.push({
          itemContrato: '—',
          itemPrevisao: pi.descricao,
          matchStatus: 'missing_contrato',
          valorContrato: 0,
          valorPrevisao: pi.valorMedido,
          diferenca: -pi.valorMedido,
          diferencaPct: -100,
        })
      }
    }

    set({ conferenciaResults: results })
  },

  clearConferenciaResults: () => set({ conferenciaResults: [] }),

  // ── Demo / Clear ─────────────────────────────────────────────────────────

  loadDemoData: () =>
    set({
      sheets: MOCK_MEDICAO_SHEETS,
      conferenciaResults: MOCK_CONFERENCIA_RESULTS,
    }),

  clearData: () =>
    set({
      sheets: [],
      conferenciaResults: [],
      activeTab: 'sabesp',
    }),
}))
