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
  NucleoResumo,
  ClassificacaoABCXYZ,
  KanbanCard,
  SlottingSugestao,
  AlertaFEFO,
  KitAtividade,
} from '@/types'
import { calcularABCXYZ, calcularKanban, calcularSlotting, calcularFEFO, type ItemComValidade } from '@/lib/fluxoProducao'
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

interface SuprimentosState {
  purchaseOrders:     PurchaseOrder[]
  receipts:           GoodsReceipt[]
  invoices:           Invoice[]
  matches:            ThreeWayMatch[]
  exceptions:         MatchException[]
  forecasts:          DemandForecast[]
  requisitions:       Requisition[]
  frameworkAgreements: FrameworkAgreement[]

  // Estoque Inteligente
  depositos:           DepositoVirtual[]
  estoqueItens:        ItemEstoque[]
  movimentacoes:       MovimentacaoEstoque[]
  reservas:            ReservaMaterial[]
  leadTimeRecords:     LeadTimeRecord[]
  selectedDepositoId:  string | null

  // Resumo por Núcleo
  nucleoResumos:       NucleoResumo[]

  // Fluxo de Produção
  abcxyzClassification: ClassificacaoABCXYZ[]
  kanbanCards:           KanbanCard[]
  slottingSugestoes:     SlottingSugestao[]
  alertasFEFO:           AlertaFEFO[]
  kitsAtividade:         KitAtividade[]
  itensComValidade:      ItemComValidade[]

  // CRUD — POs
  addPO:    (po: PurchaseOrder) => void
  updatePO: (id: string, patch: Partial<PurchaseOrder>) => void
  deletePO: (id: string) => void

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

  // Núcleo Resumo actions
  importNucleoResumos:  (items: Omit<NucleoResumo, 'id'>[]) => void
  addNucleoResumo:      (item: Omit<NucleoResumo, 'id'>) => void
  updateNucleoResumo:   (id: string, patch: Partial<NucleoResumo>) => void
  removeNucleoResumo:   (id: string) => void

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

  // Fluxo de Produção actions
  recalcularFluxoProducao: () => void
  addKit: (kit: Omit<KitAtividade, 'id' | 'criadoEm'>) => void
  updateKitStatus: (id: string, status: KitAtividade['status']) => void
  addItemValidade: (item: ItemComValidade) => void
  updateKanbanStatus: (id: string, status: KanbanCard['status']) => void

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

  // Resumo por Núcleo
  nucleoResumos: [],

  // Fluxo de Produção
  abcxyzClassification: [],
  kanbanCards: [],
  slottingSugestoes: [],
  alertasFEFO: [],
  kitsAtividade: [],
  itensComValidade: [],

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

  // ─── Núcleo Resumo actions ───────────────────────────────────────────────────

  importNucleoResumos: (items) =>
    set((s) => ({
      nucleoResumos: [
        ...s.nucleoResumos,
        ...items.map((item) => ({ ...item, id: crypto.randomUUID() })),
      ],
    })),

  addNucleoResumo: (item) =>
    set((s) => ({
      nucleoResumos: [...s.nucleoResumos, { ...item, id: crypto.randomUUID() }],
    })),

  updateNucleoResumo: (id, patch) =>
    set((s) => ({
      nucleoResumos: s.nucleoResumos.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    })),

  removeNucleoResumo: (id) =>
    set((s) => ({
      nucleoResumos: s.nucleoResumos.filter((n) => n.id !== id),
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

  // ─── Fluxo de Produção actions ──────────────────────────────────────────────

  recalcularFluxoProducao: () => {
    const { estoqueItens, movimentacoes, leadTimeRecords, reservas, itensComValidade } = get()
    const abcxyzClassification = calcularABCXYZ(estoqueItens, movimentacoes)
    const kanbanCards = calcularKanban(estoqueItens, movimentacoes, leadTimeRecords)
    const slottingSugestoes = calcularSlotting(estoqueItens, reservas, Math.ceil(Date.now() / (7 * 86400000)))
    const alertasFEFO = calcularFEFO(itensComValidade)
    set({ abcxyzClassification, kanbanCards, slottingSugestoes, alertasFEFO })
  },

  addKit: (kit) =>
    set((s) => ({
      kitsAtividade: [...s.kitsAtividade, { ...kit, id: crypto.randomUUID(), criadoEm: new Date().toISOString() }],
    })),

  updateKitStatus: (id, status) =>
    set((s) => ({
      kitsAtividade: s.kitsAtividade.map((k) => (k.id === id ? { ...k, status } : k)),
    })),

  addItemValidade: (item) =>
    set((s) => ({ itensComValidade: [...s.itensComValidade, item] })),

  updateKanbanStatus: (id, status) =>
    set((s) => ({
      kanbanCards: s.kanbanCards.map((k) => (k.id === id ? { ...k, status } : k)),
    })),

  loadDemoData: () => {
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
      // Fluxo de Produção - FEFO demo data
      itensComValidade: [
        { itemId: 'fefo-1', descricao: 'Cimento CP-II 50kg', lote: 'L-2026-001', dataValidade: '2026-04-08', qtdDisponivel: 120 },
        { itemId: 'fefo-2', descricao: 'Argamassa Polimérica 25kg', lote: 'L-2026-014', dataValidade: '2026-04-15', qtdDisponivel: 45 },
        { itemId: 'fefo-3', descricao: 'Selante PU Vedação', lote: 'L-2025-089', dataValidade: '2026-04-01', qtdDisponivel: 30 },
        { itemId: 'fefo-4', descricao: 'Primer Asfáltico 18L', lote: 'L-2026-022', dataValidade: '2026-06-30', qtdDisponivel: 18 },
        { itemId: 'fefo-5', descricao: 'Adesivo Epóxi Estrutural', lote: 'L-2025-102', dataValidade: '2026-05-10', qtdDisponivel: 25 },
        { itemId: 'fefo-6', descricao: 'Cal Hidratada 20kg', lote: 'L-2026-005', dataValidade: '2027-01-15', qtdDisponivel: 200 },
      ],
      abcxyzClassification: [],
      kanbanCards: [],
      slottingSugestoes: [],
      alertasFEFO: [],
      kitsAtividade: [
        {
          id: 'kit-demo-1',
          atividadeLps: 'LPS-ACT-001',
          descricaoAtividade: 'Assentamento Rede PEAD DN110 - R. Guaicurus',
          semana: 15,
          itens: [
            { itemId: 'est-001', descricao: 'Tubo PEAD DN110 PN10', qtdNecessaria: 120, unidade: 'm' },
            { itemId: 'est-003', descricao: 'Brita nº 1', qtdNecessaria: 8, unidade: 't' },
          ],
          status: 'preparando',
          criadoEm: '2026-03-28T10:00:00Z',
        },
        {
          id: 'kit-demo-2',
          atividadeLps: 'LPS-ACT-003',
          descricaoAtividade: 'Instalação Hidrômetros - Vila Mariana',
          semana: 14,
          itens: [
            { itemId: 'est-005', descricao: 'Hidrômetro Multijato 3/4"', qtdNecessaria: 40, unidade: 'un' },
            { itemId: 'est-006', descricao: 'Selim PEAD 110x32mm', qtdNecessaria: 40, unidade: 'un' },
          ],
          status: 'pronto',
          criadoEm: '2026-03-25T14:30:00Z',
        },
        {
          id: 'kit-demo-3',
          atividadeLps: 'LPS-ACT-005',
          descricaoAtividade: 'Travessia Av. Rebouças - Coletor DN300',
          semana: 13,
          itens: [
            { itemId: 'est-002', descricao: 'Tubo PVC Esgoto DN300', qtdNecessaria: 24, unidade: 'm' },
            { itemId: 'est-004', descricao: 'Cimento CP-II 50kg', qtdNecessaria: 30, unidade: 'sc' },
          ],
          status: 'entregue',
          criadoEm: '2026-03-20T08:00:00Z',
        },
      ],
      nucleoResumos: [
        {
          id: 'nr-demo-1', nucleo: 'Núcleo Lapa', tipo: 'Rede de Água',
          trechosTotal: 42, trechosExecutados: 31, trechosPendentes: 11,
          metrosTotal: 3780, metrosExecutados: 2790, metrosPendentes: 990,
          progressoPct: 73.8, ruas: 'R. Guaicurus, R. Catão, Al. Barros',
        },
        {
          id: 'nr-demo-2', nucleo: 'Núcleo Pinheiros', tipo: 'Coletor Tronco',
          trechosTotal: 28, trechosExecutados: 28, trechosPendentes: 0,
          metrosTotal: 2100, metrosExecutados: 2100, metrosPendentes: 0,
          progressoPct: 100, ruas: 'R. Butantan, R. Pio XI, Av. Rebouças',
        },
        {
          id: 'nr-demo-3', nucleo: 'Núcleo Vila Mariana', tipo: 'Ligações Domiciliares',
          trechosTotal: 65, trechosExecutados: 18, trechosPendentes: 47,
          metrosTotal: 1950, metrosExecutados: 540, metrosPendentes: 1410,
          progressoPct: 27.7, ruas: 'R. Domingos de Morais, R. Vergueiro, R. Sena Madureira',
        },
        {
          id: 'nr-demo-4', nucleo: 'Núcleo Santana', tipo: 'Rede de Esgoto',
          trechosTotal: 36, trechosExecutados: 22, trechosPendentes: 14,
          metrosTotal: 4320, metrosExecutados: 2640, metrosPendentes: 1680,
          progressoPct: 61.1, ruas: 'Av. Cruzeiro do Sul, R. Voluntários da Pátria',
        },
      ],
    })
    get().recalcularFluxoProducao()
  },

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
      nucleoResumos:       [],
      abcxyzClassification: [],
      kanbanCards:          [],
      slottingSugestoes:    [],
      alertasFEFO:         [],
      kitsAtividade:       [],
      itensComValidade:    [],
    }),
}))
