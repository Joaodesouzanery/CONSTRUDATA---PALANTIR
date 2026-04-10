/**
 * medicaoStore.ts — Zustand store for the Medição (Consolidado) module.
 *
 * Manages consolidated construction segments (trechos) tracking
 * executado × projetado × cadastro across nucleos.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  MedicaoTab,
  ConsolidatedSegment,
  NucleoSummary,
  SegmentStatus,
  SegmentTipo,
} from '@/types'

// ─── State ───────────────────────────────────────────────────────────────────

interface MedicaoState {
  activeTab:  MedicaoTab
  setActiveTab: (tab: MedicaoTab) => void

  segments: ConsolidatedSegment[]
  addSegments: (items: ConsolidatedSegment[]) => void
  addSegment: (item: ConsolidatedSegment) => void
  updateSegment: (id: string, patch: Partial<ConsolidatedSegment>) => void
  updateSegmentStatus: (id: string, status: SegmentStatus, dataExec?: string) => void
  removeSegment: (id: string) => void
  clearSegments: () => void

  // Derived selectors
  getNucleoSummaries: () => NucleoSummary[]
  getGlobalKpis: () => { totalExec: number; totalPend: number; totalCad: number; kmExec: number; kmPend: number; kmCad: number; pctExec: number }
  getFilteredSegments: (filters: { nucleo?: string; tipo?: SegmentTipo; status?: SegmentStatus; rua?: string }) => ConsolidatedSegment[]
  getNucleos: () => string[]
  getRuas: (nucleo?: string) => string[]
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useMedicaoStore = create<MedicaoState>()(
  persist(
    (set, get) => ({
      activeTab: 'consolidado',
      setActiveTab: (tab) => set({ activeTab: tab }),

      segments: [],

      addSegments: (items) =>
        set((s) => {
          const existingIds = new Set(s.segments.map((seg) => seg.id))
          const newItems = items.filter((i) => !existingIds.has(i.id))
          return { segments: [...s.segments, ...newItems] }
        }),

      addSegment: (item) => set((s) => ({ segments: [...s.segments, item] })),

      updateSegment: (id, patch) =>
        set((s) => ({
          segments: s.segments.map((seg) => (seg.id === id ? { ...seg, ...patch } : seg)),
        })),

      updateSegmentStatus: (id, status, dataExec) =>
        set((s) => ({
          segments: s.segments.map((seg) =>
            seg.id === id ? { ...seg, status, dataExec: dataExec ?? seg.dataExec } : seg,
          ),
        })),

      removeSegment: (id) => set((s) => ({ segments: s.segments.filter((seg) => seg.id !== id) })),

      clearSegments: () => set({ segments: [] }),

      // ── Derived ────────────────────────────────────────────────────────

      getNucleos: () => {
        const nucleos = new Set(get().segments.map((s) => s.nucleo))
        return [...nucleos].sort()
      },

      getRuas: (nucleo?: string) => {
        const segs = nucleo
          ? get().segments.filter((s) => s.nucleo === nucleo)
          : get().segments
        const ruas = new Set(segs.map((s) => s.rua))
        return [...ruas].sort()
      },

      getFilteredSegments: (filters) => {
        let segs = get().segments
        if (filters.nucleo) segs = segs.filter((s) => s.nucleo === filters.nucleo)
        if (filters.tipo) segs = segs.filter((s) => s.tipo === filters.tipo)
        if (filters.status) segs = segs.filter((s) => s.status === filters.status)
        if (filters.rua) segs = segs.filter((s) => s.rua === filters.rua)
        return segs
      },

      getNucleoSummaries: (): NucleoSummary[] => {
        const segments = get().segments
        const map = new Map<string, ConsolidatedSegment[]>()

        for (const seg of segments) {
          const key = `${seg.nucleo}|${seg.tipo}`
          if (!map.has(key)) map.set(key, [])
          map.get(key)!.push(seg)
        }

        const summaries: NucleoSummary[] = []
        for (const [key, segs] of map) {
          const [nucleo, tipo] = key.split('|')
          const obra = segs.filter((s) => s.status !== 'CADASTRO')
          const cad = segs.filter((s) => s.status === 'CADASTRO')
          const exec = segs.filter((s) => s.status === 'EXECUTADO')
          const pend = segs.filter((s) => s.status === 'PENDENTE')

          const sum = (arr: ConsolidatedSegment[]) => arr.reduce((s, seg) => s + (seg.extM || 0), 0) / 1000
          const kmObra = sum(obra)
          const kmExec = sum(exec)
          const kmPend = sum(pend)
          const kmCad = sum(cad)

          summaries.push({
            nucleo,
            tipo: tipo as SegmentTipo,
            trTotal: segs.length,
            trObra: obra.length,
            trCad: cad.length,
            trExec: exec.length,
            trPend: pend.length,
            kmObra: Math.round(kmObra * 10) / 10,
            kmExec: Math.round(kmExec * 10) / 10,
            kmPend: Math.round(kmPend * 10) / 10,
            kmCad: Math.round(kmCad * 10) / 10,
            pctExec: obra.length > 0 ? Math.round((exec.length / obra.length) * 100) : 0,
          })
        }

        return summaries.sort((a, b) => a.nucleo.localeCompare(b.nucleo))
      },

      getGlobalKpis: () => {
        const segments = get().segments
        const exec = segments.filter((s) => s.status === 'EXECUTADO')
        const pend = segments.filter((s) => s.status === 'PENDENTE')
        const cad = segments.filter((s) => s.status === 'CADASTRO')

        const sum = (arr: ConsolidatedSegment[]) => arr.reduce((s, seg) => s + (seg.extM || 0), 0)

        const kmExec = sum(exec)
        const kmPend = sum(pend)
        const kmCad = sum(cad)
        const kmObra = kmExec + kmPend

        return {
          totalExec: exec.length,
          totalPend: pend.length,
          totalCad: cad.length,
          kmExec: Math.round(kmExec) / 1000,
          kmPend: Math.round(kmPend) / 1000,
          kmCad: Math.round(kmCad) / 1000,
          pctExec: kmObra > 0 ? Math.round((kmExec / kmObra) * 1000) / 10 : 0,
        }
      },
    }),
    {
      name: 'cdata-medicao',
      version: 3,
    },
  ),
)
