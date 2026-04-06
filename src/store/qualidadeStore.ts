/**
 * qualidadeStore.ts — Zustand store for the Qualidade / FVS module.
 *
 * Mirrors the rdoStore.ts pattern:
 *  - All IDs via crypto.randomUUID()
 *  - In-memory state hydrated from mock data
 *  - CRUD: addFvs, updateFvs, removeFvs
 */
import { create } from 'zustand'
import type { FVS, FvsTab } from '@/types'
import { MOCK_FVSS } from '@/data/mockQualidade'

interface QualidadeState {
  activeTab: FvsTab
  fvss:      FVS[]

  // ── Navigation ─────────────────────────────────────────────────────────────
  setActiveTab: (tab: FvsTab) => void

  // ── FVS CRUD ───────────────────────────────────────────────────────────────
  addFvs:    (fvs: Omit<FVS, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => void
  updateFvs: (id: string, updates: Partial<FVS>) => void
  removeFvs: (id: string) => void

  // ── Demo / Clear ───────────────────────────────────────────────────────────
  loadDemoData: () => void
  clearData:    () => void
}

export const useQualidadeStore = create<QualidadeState>((set) => ({
  activeTab: 'dashboard',
  fvss:      MOCK_FVSS,

  setActiveTab: (tab) => set({ activeTab: tab }),

  addFvs: (fvs) =>
    set((s) => {
      const now = new Date().toISOString()
      const nextNumber = s.fvss.length > 0
        ? Math.max(...s.fvss.map((f) => f.number)) + 1
        : 1
      return {
        fvss: [
          ...s.fvss,
          { ...fvs, id: crypto.randomUUID(), number: nextNumber, createdAt: now, updatedAt: now },
        ],
      }
    }),

  updateFvs: (id, updates) =>
    set((s) => ({
      fvss: s.fvss.map((f) =>
        f.id === id
          ? { ...f, ...updates, updatedAt: new Date().toISOString() }
          : f,
      ),
    })),

  removeFvs: (id) =>
    set((s) => ({ fvss: s.fvss.filter((f) => f.id !== id) })),

  loadDemoData: () => set({ fvss: MOCK_FVSS }),

  clearData:    () => set({ fvss: [] }),
}))
