import { create } from 'zustand'
import type { CriterioMedicao } from '@/types'

interface CriteriosState {
  criterios: CriterioMedicao[]
  pdfBase64: string | null
  pdfFileName: string | null

  importCriterios: (items: Omit<CriterioMedicao, 'id'>[]) => void
  setPdf: (base64: string, fileName: string) => void
  removeCriterio: (id: string) => void
  getCriterioByNPreco: (nPreco: string) => CriterioMedicao | undefined
  clearAll: () => void
}

export const useCriteriosStore = create<CriteriosState>((set, get) => ({
  criterios: [],
  pdfBase64: null,
  pdfFileName: null,

  importCriterios: (items) => {
    const existing = get().criterios
    const existingCodes = new Set(existing.map((c) => c.nPreco))

    const newCriterios: CriterioMedicao[] = items
      .filter((item) => !existingCodes.has(item.nPreco))
      .map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      }))

    set({ criterios: [...existing, ...newCriterios] })
  },

  setPdf: (base64, fileName) => set({ pdfBase64: base64, pdfFileName: fileName }),

  removeCriterio: (id) =>
    set((state) => ({
      criterios: state.criterios.filter((c) => c.id !== id),
    })),

  getCriterioByNPreco: (nPreco) => {
    return get().criterios.find((c) => c.nPreco === nPreco)
  },

  clearAll: () => set({ criterios: [], pdfBase64: null, pdfFileName: null }),
}))
