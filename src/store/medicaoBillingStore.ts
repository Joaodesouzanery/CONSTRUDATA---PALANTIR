/**
 * medicaoBillingStore.ts — Financial billing workflow for Sabesp contract measurement.
 *
 * Implements a 6-step boletim de medição flow:
 *   1. Planilha Sabesp (contract items)
 *   2. Critérios de Medição (reference lookup)
 *   3. Subempreiteiros (subcontractor sheets)
 *   4. Fornecedores (supplier billing)
 *   5. Conferência (auto-computed cross-check)
 *   6. Medição Final (summary + PDF export)
 *
 * Persists to localStorage key 'cdata-medicao-billing'.
 * TODO: Add Supabase sync to table `medicao_boletins`.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BillingStep = 1 | 2 | 3 | 4 | 5 | 6

export interface ItemContrato {
  id:             string
  nPreco:         string   // e.g. "420009"
  descricao:      string   // e.g. "Assentamento rede esgoto PVC DN150"
  unidade:        string   // "M"
  grupo:          string   // "01" | "02" | "03"
  qtdContrato:    number
  qtdMedida:      number   // medição do período
  valorUnitario:  number
}

export interface SubempreteiroItem {
  nPreco:        string
  descricao:     string
  unidade:       string
  qtd:           number
  valorUnitario: number
}

export interface Subempreiteiro {
  id:             string
  nome:           string   // "VIALTA"
  nucleo:         string   // "São Manuel"
  periodo:        string   // "fev/26"
  itens:          SubempreteiroItem[]
  totalMedido:    number
  totalAprovado:  number
  retencao:       number
}

export interface Fornecedor {
  id:             string
  nome:           string   // "WERT AMBIENTAL"
  periodo:        string   // "fev/26"
  descricao:      string
  valorAprovado:  number
}

export interface ConferenciaItem {
  nPreco:               string
  descricao:            string
  unidade:              string
  qtdSabesp:            number
  qtdSubempreiteiros:   number
  diferenca:            number
  status:               'ok' | 'divergencia' | 'pendente'
  observacao:           string
}

export interface MedicaoFinal {
  totalContratoValor:      number
  totalMedidoPeriodo:      number
  totalAcumulado:          number
  totalSubempreiteiros:    number
  totalFornecedores:       number
  saldoContratante:        number
  geradoEm:                string
}

export interface MedicaoBoletim {
  id:              string
  periodo:         string   // "fev/26"
  contrato:        string   // "11481051"
  consorcio:       string   // "SE LIGA NA REDE - SANTOS"
  status:          'rascunho' | 'em_conferencia' | 'finalizado'
  itensContrato:   ItemContrato[]
  subempreiteiros: Subempreiteiro[]
  fornecedores:    Fornecedor[]
  conferencia:     ConferenciaItem[]
  medicaoFinal?:   MedicaoFinal
  createdAt:       string
  updatedAt:       string
}

// ─── Store state ──────────────────────────────────────────────────────────────

interface MedicaoBillingState {
  activeStep:     BillingStep
  boletins:       MedicaoBoletim[]
  activeBoletimId: string | null

  // Navigation
  setActiveStep: (step: BillingStep) => void

  // Boletim CRUD
  createBoletim: (periodo: string, contrato: string, consorcio: string) => string
  setActiveBoletim: (id: string) => void
  removeBoletim: (id: string) => void
  getActiveBoletim: () => MedicaoBoletim | null

  // Step 1 — Itens Contrato
  addItemContrato: (item: Omit<ItemContrato, 'id'>) => void
  updateItemContrato: (id: string, patch: Partial<Omit<ItemContrato, 'id'>>) => void
  removeItemContrato: (id: string) => void

  // Step 3 — Subempreiteiros
  addSubempreiteiro: (sub: Omit<Subempreiteiro, 'id'>) => void
  updateSubempreiteiro: (id: string, patch: Partial<Omit<Subempreiteiro, 'id'>>) => void
  removeSubempreiteiro: (id: string) => void

  // Step 4 — Fornecedores
  addFornecedor: (f: Omit<Fornecedor, 'id'>) => void
  updateFornecedor: (id: string, patch: Partial<Omit<Fornecedor, 'id'>>) => void
  removeFornecedor: (id: string) => void

  // Step 5 — Conferência (auto-computed + overrides)
  computeConferencia: () => void
  updateConferenciaObservacao: (nPreco: string, observacao: string) => void

  // Step 6 — Medição Final
  computeMedicaoFinal: () => void
  setBoletimStatus: (status: MedicaoBoletim['status']) => void

  // Bulk import (XLSX)
  importItensContrato: (items: Omit<ItemContrato, 'id'>[], replace?: boolean) => void
  importSubempreiteiroItems: (subId: string, items: Omit<SubempreteiroItem, never>[], totals: { totalMedido: number; totalAprovado: number; retencao: number }) => void
  importFornecedores: (list: Omit<Fornecedor, 'id'>[], replace?: boolean) => void

  loadDemoData: () => void
  clearData: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMedicaoBillingStore = create<MedicaoBillingState>()(
  persist(
    (set, get) => ({
      activeStep:      1,
      boletins:        [],
      activeBoletimId: null,

      setActiveStep: (step) => set({ activeStep: step }),

      getActiveBoletim: () => {
        const { boletins, activeBoletimId } = get()
        return boletins.find((b) => b.id === activeBoletimId) ?? null
      },

      createBoletim: (periodo, contrato, consorcio) => {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const boletim: MedicaoBoletim = {
          id,
          periodo,
          contrato,
          consorcio,
          status:          'rascunho',
          itensContrato:   [],
          subempreiteiros: [],
          fornecedores:    [],
          conferencia:     [],
          createdAt:       now,
          updatedAt:       now,
        }
        set((s) => ({
          boletins:        [...s.boletins, boletim],
          activeBoletimId: id,
          activeStep:      1,
        }))
        return id
      },

      setActiveBoletim: (id) => set({ activeBoletimId: id, activeStep: 1 }),

      removeBoletim: (id) =>
        set((s) => ({
          boletins:        s.boletins.filter((b) => b.id !== id),
          activeBoletimId: s.activeBoletimId === id ? null : s.activeBoletimId,
        })),

      // ── Step 1 ────────────────────────────────────────────────────────────────

      addItemContrato: (item) =>
        set((s) => {
          const boletim = s.boletins.find((b) => b.id === s.activeBoletimId)
          if (!boletim) return s
          const newItem: ItemContrato = { ...item, id: crypto.randomUUID() }
          return {
            boletins: s.boletins.map((b) =>
              b.id === s.activeBoletimId
                ? { ...b, itensContrato: [...b.itensContrato, newItem], updatedAt: new Date().toISOString() }
                : b
            ),
          }
        }),

      updateItemContrato: (id, patch) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? {
                  ...b,
                  itensContrato: b.itensContrato.map((i) => (i.id === id ? { ...i, ...patch } : i)),
                  updatedAt: new Date().toISOString(),
                }
              : b
          ),
        })),

      removeItemContrato: (id) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? { ...b, itensContrato: b.itensContrato.filter((i) => i.id !== id), updatedAt: new Date().toISOString() }
              : b
          ),
        })),

      // ── Step 3 ────────────────────────────────────────────────────────────────

      addSubempreiteiro: (sub) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? { ...b, subempreiteiros: [...b.subempreiteiros, { ...sub, id: crypto.randomUUID() }], updatedAt: new Date().toISOString() }
              : b
          ),
        })),

      updateSubempreiteiro: (id, patch) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? {
                  ...b,
                  subempreiteiros: b.subempreiteiros.map((sub) => (sub.id === id ? { ...sub, ...patch } : sub)),
                  updatedAt: new Date().toISOString(),
                }
              : b
          ),
        })),

      removeSubempreiteiro: (id) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? { ...b, subempreiteiros: b.subempreiteiros.filter((sub) => sub.id !== id), updatedAt: new Date().toISOString() }
              : b
          ),
        })),

      // ── Step 4 ────────────────────────────────────────────────────────────────

      addFornecedor: (f) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? { ...b, fornecedores: [...b.fornecedores, { ...f, id: crypto.randomUUID() }], updatedAt: new Date().toISOString() }
              : b
          ),
        })),

      updateFornecedor: (id, patch) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? {
                  ...b,
                  fornecedores: b.fornecedores.map((f) => (f.id === id ? { ...f, ...patch } : f)),
                  updatedAt: new Date().toISOString(),
                }
              : b
          ),
        })),

      removeFornecedor: (id) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? { ...b, fornecedores: b.fornecedores.filter((f) => f.id !== id), updatedAt: new Date().toISOString() }
              : b
          ),
        })),

      // ── Step 5 ────────────────────────────────────────────────────────────────

      computeConferencia: () =>
        set((s) => {
          const boletim = s.boletins.find((b) => b.id === s.activeBoletimId)
          if (!boletim) return s

          // Build map: nPreco → total qty from all subempreiteiros
          const subQtyMap = new Map<string, number>()
          for (const sub of boletim.subempreiteiros) {
            for (const item of sub.itens) {
              subQtyMap.set(item.nPreco, (subQtyMap.get(item.nPreco) ?? 0) + item.qtd)
            }
          }

          // Previous observacoes to preserve manual edits
          const prevObsMap = new Map(boletim.conferencia.map((c) => [c.nPreco, c.observacao]))

          const conferencia: ConferenciaItem[] = boletim.itensContrato.map((item) => {
            const qtdSub = subQtyMap.get(item.nPreco) ?? 0
            const diferenca = item.qtdMedida - qtdSub
            return {
              nPreco:             item.nPreco,
              descricao:          item.descricao,
              unidade:            item.unidade,
              qtdSabesp:          item.qtdMedida,
              qtdSubempreiteiros: qtdSub,
              diferenca,
              status:             Math.abs(diferenca) < 0.001 ? 'ok' : diferenca !== 0 ? 'divergencia' : 'pendente',
              observacao:         prevObsMap.get(item.nPreco) ?? '',
            }
          })

          return {
            boletins: s.boletins.map((b) =>
              b.id === s.activeBoletimId
                ? { ...b, conferencia, status: 'em_conferencia', updatedAt: new Date().toISOString() }
                : b
            ),
          }
        }),

      updateConferenciaObservacao: (nPreco, observacao) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? {
                  ...b,
                  conferencia: b.conferencia.map((c) => (c.nPreco === nPreco ? { ...c, observacao } : c)),
                  updatedAt: new Date().toISOString(),
                }
              : b
          ),
        })),

      // ── Step 6 ────────────────────────────────────────────────────────────────

      computeMedicaoFinal: () =>
        set((s) => {
          const boletim = s.boletins.find((b) => b.id === s.activeBoletimId)
          if (!boletim) return s

          const totalMedidoPeriodo = boletim.itensContrato.reduce(
            (acc, i) => acc + i.qtdMedida * i.valorUnitario,
            0
          )
          const totalContratoValor = boletim.itensContrato.reduce(
            (acc, i) => acc + i.qtdContrato * i.valorUnitario,
            0
          )
          const totalSubempreiteiros = boletim.subempreiteiros.reduce((acc, sub) => acc + sub.totalAprovado, 0)
          const totalFornecedores    = boletim.fornecedores.reduce((acc, f) => acc + f.valorAprovado, 0)

          const medicaoFinal: MedicaoFinal = {
            totalContratoValor,
            totalMedidoPeriodo,
            totalAcumulado:       totalMedidoPeriodo,  // simplified: no historical data yet
            totalSubempreiteiros,
            totalFornecedores,
            saldoContratante:     totalMedidoPeriodo - totalSubempreiteiros - totalFornecedores,
            geradoEm:             new Date().toISOString(),
          }

          return {
            boletins: s.boletins.map((b) =>
              b.id === s.activeBoletimId
                ? { ...b, medicaoFinal, status: 'finalizado', updatedAt: new Date().toISOString() }
                : b
            ),
          }
        }),

      setBoletimStatus: (status) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId ? { ...b, status, updatedAt: new Date().toISOString() } : b
          ),
        })),

      // ── Bulk import ───────────────────────────────────────────────────────────

      importItensContrato: (items, replace = true) =>
        set((s) => ({
          boletins: s.boletins.map((b) => {
            if (b.id !== s.activeBoletimId) return b
            const existing = replace ? [] : b.itensContrato
            const newItems: ItemContrato[] = items.map((i) => ({ ...i, id: crypto.randomUUID() }))
            return { ...b, itensContrato: [...existing, ...newItems], updatedAt: new Date().toISOString() }
          }),
        })),

      importSubempreiteiroItems: (subId, items, totals) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id !== s.activeBoletimId ? b : {
              ...b,
              subempreiteiros: b.subempreiteiros.map((sub) =>
                sub.id !== subId ? sub : { ...sub, ...totals, itens: items, updatedAt: new Date().toISOString() }
              ),
              updatedAt: new Date().toISOString(),
            }
          ),
        })),

      importFornecedores: (list, replace = false) =>
        set((s) => ({
          boletins: s.boletins.map((b) => {
            if (b.id !== s.activeBoletimId) return b
            const existing = replace ? [] : b.fornecedores
            const newItems: Fornecedor[] = list.map((f) => ({ ...f, id: crypto.randomUUID() }))
            return { ...b, fornecedores: [...existing, ...newItems], updatedAt: new Date().toISOString() }
          }),
        })),

      loadDemoData: () => {
        const demoId = 'bol-demo-1'
        set({
          boletins: [{
            id: demoId,
            periodo: 'mar/26',
            contrato: '11481051',
            consorcio: 'SE LIGA NA REDE - SANTOS',
            status: 'rascunho' as const,
            itensContrato: [
              { id: 'it-1', nPreco: '05.01.001', descricao: 'Escavação mecânica vala', unidade: 'm³', qtdContrato: 1200, qtdMedida: 850, valorUnitario: 32.50, grupo: '02' },
              { id: 'it-2', nPreco: '05.02.003', descricao: 'Tubo PVC JEI DN 200mm', unidade: 'm', qtdContrato: 2500, qtdMedida: 1800, valorUnitario: 78.40, grupo: '02' },
              { id: 'it-3', nPreco: '05.03.001', descricao: 'Poço de Visita D=1.20m', unidade: 'un', qtdContrato: 45, qtdMedida: 32, valorUnitario: 3250.00, grupo: '02' },
              { id: 'it-4', nPreco: '06.01.001', descricao: 'Rede água DN 110mm PEAD', unidade: 'm', qtdContrato: 1800, qtdMedida: 1200, valorUnitario: 45.60, grupo: '03' },
              { id: 'it-5', nPreco: '01.01.001', descricao: 'Canteiro de serviço', unidade: 'mês', qtdContrato: 12, qtdMedida: 3, valorUnitario: 18500.00, grupo: '01' },
            ],
            subempreiteiros: [],
            fornecedores: [],
            conferencia: [],
            createdAt: '2026-03-01T00:00:00Z',
            updatedAt: '2026-03-31T00:00:00Z',
          }],
          activeBoletimId: demoId,
          activeStep: 1,
        })
      },

      clearData: () => set({ boletins: [], activeBoletimId: null, activeStep: 1 }),
    }),
    {
      name: 'cdata-medicao-billing',
      version: 1,
    }
  )
)
