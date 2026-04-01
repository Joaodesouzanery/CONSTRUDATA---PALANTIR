/**
 * medicaoStore.ts — Zustand store for the Medição module.
 */
import { create } from 'zustand'
import type { MedicaoTab, MedicaoServico, BoletimMedicao } from '@/types'
import { useQuantitativosStore } from '@/store/quantitativosStore'

interface MedicaoState {
  activeTab: MedicaoTab
  boletins: BoletimMedicao[]
  activeBmId: string | null

  setActiveTab: (tab: MedicaoTab) => void
  addBoletim: (bm: Omit<BoletimMedicao, 'id' | 'numero' | 'createdAt'>) => void
  updateBoletim: (id: string, patch: Partial<BoletimMedicao>) => void
  removeBoletim: (id: string) => void
  setActiveBm: (id: string | null) => void
  importFromQuantitativos: () => MedicaoServico[]
  loadDemoData: () => void
  clearData: () => void
}

export const useMedicaoStore = create<MedicaoState>((set, _get) => ({
  activeTab: 'servicos',
  boletins: [],
  activeBmId: null,

  setActiveTab: (tab) => set({ activeTab: tab }),

  addBoletim: (bm) =>
    set((s) => ({
      boletins: [
        ...s.boletins,
        {
          ...bm,
          id: crypto.randomUUID(),
          numero: s.boletins.length + 1,
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  updateBoletim: (id, patch) =>
    set((s) => ({
      boletins: s.boletins.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })),

  removeBoletim: (id) =>
    set((s) => ({
      boletins: s.boletins.filter((b) => b.id !== id),
      activeBmId: s.activeBmId === id ? null : s.activeBmId,
    })),

  setActiveBm: (id) => set({ activeBmId: id }),

  importFromQuantitativos: () => {
    const { currentItems } = useQuantitativosStore.getState()
    return currentItems.map((item) => ({
      id: crypto.randomUUID(),
      codigo: item.code,
      descricao: item.description,
      unidade: item.unit,
      qtdContratada: item.quantity,
      qtdMedidaAcumulada: 0,
      qtdMesAtual: 0,
      valorUnitario: item.unitCost,
      valorTotal: 0,
    }))
  },

  loadDemoData: () => {
    const demoItens: MedicaoServico[] = [
      { id: crypto.randomUUID(), codigo: 'SER-001', descricao: 'Escavação Mecânica', unidade: 'm³', qtdContratada: 2400, qtdMedidaAcumulada: 960, qtdMesAtual: 320, valorUnitario: 45.00, valorTotal: 14400 },
      { id: crypto.randomUUID(), codigo: 'SER-002', descricao: 'Assentamento de Tubos DN 200', unidade: 'm', qtdContratada: 1800, qtdMedidaAcumulada: 720, qtdMesAtual: 240, valorUnitario: 120.00, valorTotal: 28800 },
      { id: crypto.randomUUID(), codigo: 'SER-003', descricao: 'Reaterro Compactado', unidade: 'm³', qtdContratada: 2000, qtdMedidaAcumulada: 800, qtdMesAtual: 280, valorUnitario: 38.50, valorTotal: 10780 },
      { id: crypto.randomUUID(), codigo: 'SER-004', descricao: 'Ligação Domiciliar', unidade: 'un', qtdContratada: 120, qtdMedidaAcumulada: 45, qtdMesAtual: 15, valorUnitario: 850.00, valorTotal: 12750 },
      { id: crypto.randomUUID(), codigo: 'SER-005', descricao: 'Poço de Visita', unidade: 'un', qtdContratada: 28, qtdMedidaAcumulada: 10, qtdMesAtual: 4, valorUnitario: 3200.00, valorTotal: 12800 },
      { id: crypto.randomUUID(), codigo: 'SER-006', descricao: 'Pavimentação CBUQ', unidade: 'm²', qtdContratada: 3500, qtdMedidaAcumulada: 1100, qtdMesAtual: 420, valorUnitario: 95.00, valorTotal: 39900 },
    ]

    const bm1: BoletimMedicao = {
      id: crypto.randomUUID(),
      numero: 1,
      obra: 'Morro do Tetéu',
      periodoInicio: '2026-03-01',
      periodoFim: '2026-03-31',
      dataEmissao: '2026-04-01',
      itens: demoItens.map((i) => ({ ...i, qtdMesAtual: Math.round(i.qtdMedidaAcumulada * 0.4) })),
      valorTotal: demoItens.reduce((s, i) => s + i.valorTotal * 0.4, 0),
      status: 'emitido',
      observacoes: 'Primeiro boletim de medição referente ao mês de março/2026.',
      createdAt: new Date().toISOString(),
    }

    set({ boletins: [bm1], activeBmId: bm1.id })
  },

  clearData: () => set({ boletins: [], activeBmId: null }),
}))
