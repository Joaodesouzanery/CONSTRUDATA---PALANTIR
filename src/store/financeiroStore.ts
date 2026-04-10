import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FinanceiroTab, FinanceiroEntry } from '@/types'

interface FinanceiroState {
  activeTab: FinanceiroTab
  setActiveTab: (tab: FinanceiroTab) => void

  entries: FinanceiroEntry[]
  addEntry: (e: FinanceiroEntry) => void
  updateEntry: (id: string, patch: Partial<FinanceiroEntry>) => void
  removeEntry: (id: string) => void

  getEntradas: () => FinanceiroEntry[]
  getSaidas: () => FinanceiroEntry[]
  getTotalEntradas: () => number
  getTotalSaidas: () => number
  getSaldo: () => number
  getMonthlyData: () => { month: string; entradas: number; saidas: number; saldo: number }[]
}

export const useFinanceiroStore = create<FinanceiroState>()(
  persist(
    (set, get) => ({
      activeTab: 'visao-geral',
      setActiveTab: (tab) => set({ activeTab: tab }),

      entries: [],
      addEntry: (e) => set((s) => ({ entries: [...s.entries, e] })),
      updateEntry: (id, patch) => set((s) => ({ entries: s.entries.map((e) => e.id === id ? { ...e, ...patch } : e) })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      getEntradas: () => get().entries.filter((e) => e.tipo === 'entrada'),
      getSaidas: () => get().entries.filter((e) => e.tipo === 'saida'),
      getTotalEntradas: () => get().entries.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0),
      getTotalSaidas: () => get().entries.filter((e) => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0),
      getSaldo: () => {
        const ent = get().entries
        return ent.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + e.valor, 0) - ent.filter((e) => e.tipo === 'saida').reduce((s, e) => s + e.valor, 0)
      },

      getMonthlyData: () => {
        const entries = get().entries
        const map = new Map<string, { entradas: number; saidas: number }>()
        for (const e of entries) {
          const month = e.data.slice(0, 7) // yyyy-MM
          if (!map.has(month)) map.set(month, { entradas: 0, saidas: 0 })
          const m = map.get(month)!
          if (e.tipo === 'entrada') m.entradas += e.valor
          else m.saidas += e.valor
        }
        let acc = 0
        return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, { entradas, saidas }]) => {
          acc += entradas - saidas
          return { month, entradas, saidas, saldo: acc }
        })
      },
    }),
    { name: 'cdata-financeiro', version: 1 },
  ),
)
