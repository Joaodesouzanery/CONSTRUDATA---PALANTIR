/**
 * qualidadeStore.ts — Zustand store for the Qualidade / FVS module.
 *
 * Persistência: localStorage (zustand persist) — FVSs sobrevivem a reload.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FVS, FvsTab } from '@/types'
import { MOCK_FVSS } from '@/data/mockQualidade'

interface QualidadeState {
  activeTab: FvsTab
  fvss:      FVS[]

  setActiveTab: (tab: FvsTab) => void

  addFvs:    (fvs: Omit<FVS, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => void
  updateFvs: (id: string, updates: Partial<FVS>) => void
  removeFvs: (id: string) => void

  loadDemoData: () => void
  clearData:    () => void
}

export const useQualidadeStore = create<QualidadeState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'cdata-qualidade',
      // Persiste apenas as FVSs, não a aba ativa
      partialize: (state) => ({ fvss: state.fvss }),
    },
  ),
)
