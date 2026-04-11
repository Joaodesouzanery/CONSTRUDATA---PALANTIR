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

      loadDemoData: () => set({
        entries: [
          { id: 'fin-1', descricao: 'Medição #1 — Esgoto', tipo: 'entrada', valor: 285000, data: '2026-01-15', categoria: 'Medição', observacao: 'Boletim 01/2026' },
          { id: 'fin-2', descricao: 'Medição #2 — Água', tipo: 'entrada', valor: 142000, data: '2026-02-15', categoria: 'Medição', observacao: 'Boletim 02/2026' },
          { id: 'fin-3', descricao: 'Medição #3 — Esgoto + Água', tipo: 'entrada', valor: 398000, data: '2026-03-15', categoria: 'Medição', observacao: 'Boletim 03/2026' },
          { id: 'fin-4', descricao: 'Mão de Obra — Jan', tipo: 'saida', valor: 95000, data: '2026-01-30', categoria: 'Mão de Obra', observacao: 'Folha janeiro' },
          { id: 'fin-5', descricao: 'Mão de Obra — Fev', tipo: 'saida', valor: 98000, data: '2026-02-28', categoria: 'Mão de Obra', observacao: 'Folha fevereiro' },
          { id: 'fin-6', descricao: 'Mão de Obra — Mar', tipo: 'saida', valor: 102000, data: '2026-03-30', categoria: 'Mão de Obra', observacao: 'Folha março' },
          { id: 'fin-7', descricao: 'Materiais — Tubos PVC', tipo: 'saida', valor: 67000, data: '2026-01-20', categoria: 'Materiais', observacao: 'OC-001' },
          { id: 'fin-8', descricao: 'Materiais — PEAD + Conexões', tipo: 'saida', valor: 43000, data: '2026-02-10', categoria: 'Materiais', observacao: 'OC-002' },
          { id: 'fin-9', descricao: 'Equipamentos — Aluguel escavadeira', tipo: 'saida', valor: 32000, data: '2026-01-05', categoria: 'Equipamentos', observacao: 'Contrato mensal' },
          { id: 'fin-10', descricao: 'Equipamentos — Combustível', tipo: 'saida', valor: 18500, data: '2026-02-25', categoria: 'Equipamentos', observacao: '' },
        ] as FinanceiroEntry[],
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
