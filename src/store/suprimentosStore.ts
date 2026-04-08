import { create } from 'zustand'
import type {
  PurchaseOrder,
  GoodsReceipt,
  Invoice,
  ThreeWayMatch,
  MatchException,
  DemandForecast,
  MatchStatus,
  Discrepancy,
  Requisition,
  RequisitionStatus,
  FrameworkAgreement,
  DepositoVirtual,
  ItemEstoque,
  MovimentacaoEstoque,
  ReservaMaterial,
  LeadTimeRecord,
} from '@/types'
import {
  mockPurchaseOrders,
  mockGoodsReceipts,
  mockInvoices,
  mockMatches,
  mockExceptions,
  mockForecasts,
  mockRequisitions,
  mockFrameworkAgreements,
  mockDepositos,
  mockEstoqueItens,
  mockMovimentacoes,
  mockLeadTimeRecords,
  mockReservas,
} from '@/data/mockSuprimentos'

// ─── Three-Way Match algorithm ────────────────────────────────────────────────

const TOLERANCE = 0.02 // 2%

function runThreeWayMatch(
  po: PurchaseOrder,
  receipt?: GoodsReceipt,
  invoice?: Invoice,
): Omit<ThreeWayMatch, 'id' | 'poId'> {
  if (!receipt && !invoice) {
    return { status: 'pending', discrepancies: [] }
  }

  const discrepancies: Discrepancy[] = []

  for (const poItem of po.items) {
    const rcItem = receipt?.items.find((i) => i.poItemId === poItem.id)
    const nfItem = invoice?.items.find((i) => i.poItemId === poItem.id)

    // Quantity check: RC vs OC
    if (rcItem) {
      const diff = rcItem.receivedQty - poItem.quantity
      const pct  = diff / poItem.quantity
      if (Math.abs(pct) > TOLERANCE) {
        discrepancies.push({
          itemId:        poItem.id,
          field:         'quantity',
          poValue:       poItem.quantity,
          receivedValue: rcItem.receivedQty,
          delta:         diff,
          deltaPercent:  parseFloat((pct * 100).toFixed(1)),
        })
      }
    } else if (receipt) {
      discrepancies.push({
        itemId:      poItem.id,
        field:       'missing',
        poValue:     poItem.quantity,
        delta:       -poItem.quantity,
        deltaPercent: -100,
      })
    }

    // Price check: NF vs OC
    if (nfItem) {
      const diff = nfItem.unitPrice - poItem.unitPrice
      const pct  = diff / poItem.unitPrice
      if (Math.abs(pct) > TOLERANCE) {
        discrepancies.push({
          itemId:        poItem.id,
          field:         'price',
          poValue:       poItem.unitPrice,
          invoicedValue: nfItem.unitPrice,
          delta:         diff,
          deltaPercent:  parseFloat((pct * 100).toFixed(1)),
        })
      }
    }
  }

  let status: MatchStatus
  if (discrepancies.length === 0) {
    status = 'matched'
  } else if (discrepancies.some((d) => Math.abs(d.deltaPercent) > 5)) {
    status = 'discrepancy'
  } else {
    status = 'partial'
  }

  return { status, discrepancies, matchedAt: new Date().toISOString() }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface WhatIfResult {
  resultado: 'viavel' | 'inviavel' | 'alerta'
  mensagem: string
  itensInsuficientes: {
    itemId: string
    descricao: string
    qtdDisponivel: number
    qtdNecessaria: number
    deficit: number
    fornecedor?: string
    leadTimeDias?: number
  }[]
}

// ─── Cadastro leve de fornecedores ─────────────────────────────────────────
// Histórico: o sistema antigo guardava `supplier` como string crua dentro de PO.
// Para alimentar o módulo de Suprimentos com lista oficial de fornecedores
// (importável via XLSX/CSV), criamos uma entidade `Supplier` separada.
// Os POs continuam a referenciar pelo nome — backward compatible.
export interface Supplier {
  id:           string   // 's-' + crypto.randomUUID().slice(0, 8)
  cnpj:         string
  name:         string
  category:     string
  contactName:  string
  phone:        string
  email:        string
  paymentTerms: string
  createdAt:    string   // ISO
}

interface SuprimentosState {
  purchaseOrders:     PurchaseOrder[]
  receipts:           GoodsReceipt[]
  invoices:           Invoice[]
  matches:            ThreeWayMatch[]
  exceptions:         MatchException[]
  forecasts:          DemandForecast[]
  requisitions:       Requisition[]
  frameworkAgreements: FrameworkAgreement[]
  suppliers:          Supplier[]

  // Estoque Inteligente
  depositos:           DepositoVirtual[]
  estoqueItens:        ItemEstoque[]
  movimentacoes:       MovimentacaoEstoque[]
  reservas:            ReservaMaterial[]
  leadTimeRecords:     LeadTimeRecord[]
  selectedDepositoId:  string | null

  // CRUD — POs
  addPO:    (po: PurchaseOrder) => void
  updatePO: (id: string, patch: Partial<PurchaseOrder>) => void
  deletePO: (id: string) => void

  // CRUD — Suppliers (cadastro de fornecedores)
  addSupplier:    (s: Omit<Supplier, 'id' | 'createdAt'>) => void
  updateSupplier: (id: string, patch: Partial<Omit<Supplier, 'id' | 'createdAt'>>) => void
  removeSupplier: (id: string) => void

  // Receipts + Invoices
  addReceipt: (receipt: GoodsReceipt) => void
  addInvoice: (invoice: Invoice)       => void

  // Match
  runMatch: (poId: string) => void

  // Exceptions
  addException:    (ex: MatchException) => void
  updateException: (id: string, patch: Partial<MatchException>) => void

  // Forecasts
  addForecast:    (forecast: Omit<DemandForecast, 'id'>) => void
  updateForecast: (id: string, status: DemandForecast['status']) => void

  // Requisitions
  addRequisition:           (req: Requisition)                  => void
  advanceRequisitionStatus: (id: string)                        => void
  updateRequisition:        (id: string, patch: Partial<Omit<Requisition, 'id' | 'code'>>) => void

  // Framework Agreements
  updateFrameworkAgreement: (id: string, patch: Partial<FrameworkAgreement>) => void
  addFrameworkAgreement:    (fa: Omit<FrameworkAgreement, 'id'>) => void

  // Estoque actions
  setSelectedDeposito:  (id: string | null) => void
  addItemEstoque:       (item: Omit<ItemEstoque, 'id'>) => void
  updateItemEstoque:    (id: string, patch: Partial<ItemEstoque>) => void
  removeItemEstoque:    (id: string) => void
  addMovimentacao:      (mov: Omit<MovimentacaoEstoque, 'id'>) => void
  addReserva:           (r: Omit<ReservaMaterial, 'id' | 'criadoEm'>) => void
  updateReserva:        (id: string, patch: Partial<ReservaMaterial>) => void
  consumirMaterial:     (itemId: string, qty: number, opts?: { lpsActivityId?: string; observacoes?: string }) => void
  calcSemaforo:         (depositoId: string, lpsActivityId: string, semana: number) => 'verde' | 'amarelo' | 'vermelho'
  runWhatIf:            (params: { activityId: string; semanaOriginal: number; semanaSimulada: number; depositoId: string }) => WhatIfResult

  // Demo mode
  loadDemoData: () => void
  clearData: () => void
}

const REQUISITION_FLOW: RequisitionStatus[] = [
  'submitted',
  'parsing',
  'ontology_matched',
  'proposals',
  'ordered',
]

export const useSuprimentosStore = create<SuprimentosState>((set, get) => ({
  purchaseOrders:      mockPurchaseOrders,
  receipts:            mockGoodsReceipts,
  invoices:            mockInvoices,
  matches:             mockMatches,
  exceptions:          mockExceptions,
  forecasts:           mockForecasts,
  requisitions:        mockRequisitions,
  frameworkAgreements: mockFrameworkAgreements,

  // Estoque initial state
  depositos:          mockDepositos,
  estoqueItens:       mockEstoqueItens,
  movimentacoes:      mockMovimentacoes,
  reservas:           mockReservas,
  leadTimeRecords:    mockLeadTimeRecords,
  selectedDepositoId: mockDepositos[0]?.id ?? null,

  // Suppliers — começa vazio; importável via Excel/CSV no SuprimentosHeader
  suppliers:          [],

  addSupplier: (s) =>
    set((state) => ({
      suppliers: [
        ...state.suppliers,
        {
          ...s,
          id: 's-' + crypto.randomUUID().slice(0, 8),
          createdAt: new Date().toISOString(),
        },
      ],
    })),

  updateSupplier: (id, patch) =>
    set((state) => ({
      suppliers: state.suppliers.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),

  removeSupplier: (id) =>
    set((state) => ({
      suppliers: state.suppliers.filter((s) => s.id !== id),
    })),

  addPO: (po) =>
    set((s) => ({ purchaseOrders: [...s.purchaseOrders, po] })),

  updatePO: (id, patch) =>
    set((s) => ({
      purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  deletePO: (id) =>
    set((s) => ({ purchaseOrders: s.purchaseOrders.filter((p) => p.id !== id) })),

  addReceipt: (receipt) => {
    set((s) => ({ receipts: [...s.receipts, receipt] }))
    get().runMatch(receipt.poId)
  },

  addInvoice: (invoice) => {
    set((s) => ({ invoices: [...s.invoices, invoice] }))
    get().runMatch(invoice.poId)
  },

  runMatch: (poId) => {
    const { purchaseOrders, receipts, invoices, matches } = get()
    const po      = purchaseOrders.find((p) => p.id === poId)
    if (!po) return

    const receipt = receipts.find((r) => r.poId === poId)
    const invoice = invoices.find((i) => i.poId === poId)
    const result  = runThreeWayMatch(po, receipt, invoice)

    const existing = matches.find((m) => m.poId === poId)
    if (existing) {
      set((s) => ({
        matches: s.matches.map((m) =>
          m.poId === poId ? { ...m, ...result } : m
        ),
      }))
    } else {
      const newMatch: ThreeWayMatch = {
        id:        `twm-${Date.now()}`,
        poId,
        receiptId: receipt?.id,
        invoiceId: invoice?.id,
        ...result,
      }
      set((s) => ({ matches: [...s.matches, newMatch] }))
    }
  },

  addException: (ex) =>
    set((s) => ({ exceptions: [...s.exceptions, ex] })),

  updateException: (id, patch) =>
    set((s) => ({
      exceptions: s.exceptions.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  addForecast: (forecast) =>
    set((s) => ({
      forecasts: [...s.forecasts, { ...forecast, id: crypto.randomUUID() }],
    })),

  updateForecast: (id, status) =>
    set((s) => ({
      forecasts: s.forecasts.map((f) => (f.id === id ? { ...f, status } : f)),
    })),

  addRequisition: (req) =>
    set((s) => ({ requisitions: [...s.requisitions, req] })),

  advanceRequisitionStatus: (id) =>
    set((s) => ({
      requisitions: s.requisitions.map((r) => {
        if (r.id !== id) return r
        const idx  = REQUISITION_FLOW.indexOf(r.status)
        const next = REQUISITION_FLOW[idx + 1]
        return next ? { ...r, status: next } : r
      }),
    })),

  updateRequisition: (id, patch) =>
    set((s) => ({
      requisitions: s.requisitions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  updateFrameworkAgreement: (id, patch) =>
    set((s) => ({
      frameworkAgreements: s.frameworkAgreements.map((fa) => (fa.id === id ? { ...fa, ...patch } : fa)),
    })),

  addFrameworkAgreement: (fa) =>
    set((s) => ({
      frameworkAgreements: [...s.frameworkAgreements, { ...fa, id: crypto.randomUUID() }],
    })),

  // ─── Estoque actions ────────────────────────────────────────────────────────

  setSelectedDeposito: (id) => set({ selectedDepositoId: id }),

  addItemEstoque: (item) =>
    set((s) => ({
      estoqueItens: [...s.estoqueItens, { ...item, id: crypto.randomUUID() }],
    })),

  updateItemEstoque: (id, patch) =>
    set((s) => ({
      estoqueItens: s.estoqueItens.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })),

  removeItemEstoque: (id) =>
    set((s) => ({
      estoqueItens: s.estoqueItens.filter((i) => i.id !== id),
    })),

  addMovimentacao: (mov) =>
    set((s) => ({
      movimentacoes: [...s.movimentacoes, { ...mov, id: crypto.randomUUID() }],
    })),

  addReserva: (r) =>
    set((s) => ({
      reservas: [...s.reservas, { ...r, id: crypto.randomUUID(), criadoEm: new Date().toISOString() }],
    })),

  updateReserva: (id, patch) =>
    set((s) => ({
      reservas: s.reservas.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  consumirMaterial: (itemId, qty, opts) => {
    const { estoqueItens } = get()
    const item = estoqueItens.find((i) => i.id === itemId)
    if (!item) return

    const newQtd = Math.max(0, item.qtdDisponivel - qty)
    set((s) => ({
      estoqueItens: s.estoqueItens.map((i) =>
        i.id === itemId ? { ...i, qtdDisponivel: newQtd } : i
      ),
      movimentacoes: [
        ...s.movimentacoes,
        {
          id: crypto.randomUUID(),
          itemId,
          depositoId: item.depositoId,
          tipo: 'saida' as const,
          quantidade: qty,
          dataMovimento: new Date().toISOString().slice(0, 10),
          lpsActivityId: opts?.lpsActivityId,
          observacoes: opts?.observacoes,
        },
      ],
    }))
  },

  calcSemaforo: (depositoId, lpsActivityId, semana) => {
    const { reservas, estoqueItens } = get()
    const res = reservas.filter(
      (r) => r.depositoId === depositoId && r.lpsActivityId === lpsActivityId && r.semana === semana
    )
    if (res.length === 0) return 'verde'

    let hasRed = false
    let hasYellow = false
    for (const r of res) {
      const item = estoqueItens.find((i) => i.id === r.itemId)
      const avail = item?.qtdDisponivel ?? 0
      const transit = item?.qtdTransito ?? 0
      if (avail >= r.qtdNecessaria) continue
      if (transit > 0) { hasYellow = true } else { hasRed = true }
    }
    if (hasRed) return 'vermelho'
    if (hasYellow) return 'amarelo'
    return 'verde'
  },

  runWhatIf: ({ activityId, semanaSimulada, depositoId }) => {
    const { reservas, estoqueItens, leadTimeRecords } = get()
    const actReservas = reservas.filter(
      (r) => r.lpsActivityId === activityId && r.depositoId === depositoId
    )
    const simReservas = actReservas.map((r) => ({ ...r, semana: semanaSimulada }))

    const insuff: WhatIfResult['itensInsuficientes'] = []
    for (const r of simReservas) {
      const item = estoqueItens.find((i) => i.id === r.itemId)
      if (!item) continue
      if (item.qtdDisponivel >= r.qtdNecessaria) continue
      const lt = leadTimeRecords.find((l) => l.fornecedor === item.fornecedorPrincipal)
      insuff.push({
        itemId:         item.id,
        descricao:      item.descricao,
        qtdDisponivel:  item.qtdDisponivel,
        qtdNecessaria:  r.qtdNecessaria,
        deficit:        r.qtdNecessaria - item.qtdDisponivel,
        fornecedor:     item.fornecedorPrincipal,
        leadTimeDias:   lt?.leadTimeDias,
      })
    }

    if (insuff.length === 0) {
      return { resultado: 'viavel', mensagem: 'Cenário viável: todos os materiais disponíveis.', itensInsuficientes: [] }
    }

    const temTransito = insuff.some((i) => {
      const item = estoqueItens.find((e) => e.id === i.itemId)
      return (item?.qtdTransito ?? 0) > 0
    })

    if (temTransito) {
      return {
        resultado: 'alerta',
        mensagem: `Alerta: ${insuff.length} item(ns) com estoque insuficiente, mas NFs em trânsito podem cobrir a necessidade.`,
        itensInsuficientes: insuff,
      }
    }

    return {
      resultado: 'inviavel',
      mensagem: `Cenário inviável: ${insuff.length} item(ns) em ruptura sem pedidos em andamento.`,
      itensInsuficientes: insuff,
    }
  },

  loadDemoData: () =>
    set({
      purchaseOrders:      mockPurchaseOrders,
      receipts:            mockGoodsReceipts,
      invoices:            mockInvoices,
      matches:             mockMatches,
      exceptions:          mockExceptions,
      forecasts:           mockForecasts,
      requisitions:        mockRequisitions,
      frameworkAgreements: mockFrameworkAgreements,
      depositos:           mockDepositos,
      estoqueItens:        mockEstoqueItens,
      movimentacoes:       mockMovimentacoes,
      reservas:            mockReservas,
      leadTimeRecords:     mockLeadTimeRecords,
    }),

  clearData: () =>
    set({
      purchaseOrders:      [],
      receipts:            [],
      invoices:            [],
      matches:             [],
      exceptions:          [],
      forecasts:           [],
      requisitions:        [],
      frameworkAgreements: [],
      depositos:           [],
      estoqueItens:        [],
      movimentacoes:       [],
      reservas:            [],
      leadTimeRecords:     [],
      suppliers:           [],
    }),
}))
