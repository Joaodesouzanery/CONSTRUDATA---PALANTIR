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
  loadDemoData: () => void
  clearData: () => void
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

      loadDemoData: () => set({
        entries: [
          { id: 'fin-1', descricao: 'Medição #1 — Esgoto', tipo: 'entrada' as const, valor: 285000, data: '2026-01-15', categoria: 'medicao' as const, referencia: 'BOL-01', createdAt: '2026-01-15' },
          { id: 'fin-2', descricao: 'Medição #2 — Água', tipo: 'entrada' as const, valor: 142000, data: '2026-02-15', categoria: 'medicao' as const, referencia: 'BOL-02', createdAt: '2026-02-15' },
          { id: 'fin-3', descricao: 'Medição #3', tipo: 'entrada' as const, valor: 398000, data: '2026-03-15', categoria: 'medicao' as const, referencia: 'BOL-03', createdAt: '2026-03-15' },
          { id: 'fin-4', descricao: 'M.O. — Jan', tipo: 'saida' as const, valor: 95000, data: '2026-01-30', categoria: 'mao_de_obra' as const, createdAt: '2026-01-30' },
          { id: 'fin-5', descricao: 'M.O. — Fev', tipo: 'saida' as const, valor: 98000, data: '2026-02-28', categoria: 'mao_de_obra' as const, createdAt: '2026-02-28' },
          { id: 'fin-6', descricao: 'M.O. — Mar', tipo: 'saida' as const, valor: 102000, data: '2026-03-30', categoria: 'mao_de_obra' as const, createdAt: '2026-03-30' },
          { id: 'fin-7', descricao: 'Tubos PVC', tipo: 'saida' as const, valor: 67000, data: '2026-01-20', categoria: 'materiais' as const, referencia: 'OC-001', createdAt: '2026-01-20' },
          { id: 'fin-8', descricao: 'PEAD', tipo: 'saida' as const, valor: 43000, data: '2026-02-10', categoria: 'materiais' as const, referencia: 'OC-002', createdAt: '2026-02-10' },
          { id: 'fin-9', descricao: 'Aluguel escavadeira', tipo: 'saida' as const, valor: 32000, data: '2026-01-05', categoria: 'equipamentos' as const, createdAt: '2026-01-05' },
          { id: 'fin-10', descricao: 'Combustível', tipo: 'saida' as const, valor: 18500, data: '2026-02-25', categoria: 'equipamentos' as const, createdAt: '2026-02-25' },
        ],
      }),

      clearData: () => set({ entries: [] }),

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
