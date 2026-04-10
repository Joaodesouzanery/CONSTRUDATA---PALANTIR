import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { eventBus } from '@/lib/eventBus'
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

  // Bulk import from Consolidado / Resumo planilhas
  importConsolidado: (items: import('@/features/suprimentos/utils/parseSuprimentosConsolidado').ConsolidadoItem[], target: 'po' | 'estoque') => void

  // Demo mode
  loadDemoData: () => void
  clearData: () => void

  // Sync (Sprint 2)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

// ─── Mappers para Supabase ───────────────────────────────────────────────────
function poToRow(po: PurchaseOrder, orgId: string, userId: string) {
  return {
    id:                po.id,
    organization_id:   orgId,
    code:              po.code,
    supplier:          po.supplier,
    responsible:       po.responsible || null,
    issued_date:       po.issuedDate,
    expected_delivery: po.expectedDelivery || null,
    project_ref:       po.projectRef ?? null,
    status:            po.status,
    total_brl:         po.items.reduce((s, i) => s + i.totalPrice, 0),
    payload:           { items: po.items },
    created_by:        userId,
  }
}

function receiptToRow(r: GoodsReceipt, orgId: string, userId: string) {
  return {
    id:              r.id,
    organization_id: orgId,
    po_id:           r.poId || null,
    code:            r.code,
    received_date:   r.receivedDate,
    received_by:     r.receivedBy || null,
    payload:         { items: r.items },
    created_by:      userId,
  }
}

function invoiceToRow(inv: Invoice, orgId: string, userId: string) {
  return {
    id:              inv.id,
    organization_id: orgId,
    po_id:           inv.poId || null,
    number:          inv.number,
    supplier:        inv.supplier,
    issue_date:      inv.issueDate,
    due_date:        inv.dueDate || null,
    total_amount:    inv.totalAmount,
    status:          inv.status,
    payload:         { items: inv.items },
    created_by:      userId,
  }
}

function supplierToRow(s: Supplier, orgId: string, userId: string) {
  return {
    id:              s.id,
    organization_id: orgId,
    cnpj:            s.cnpj || null,
    name:            s.name,
    category:        s.category || null,
    contact_name:    s.contactName || null,
    phone:           s.phone || null,
    email:           s.email || null,
    payment_terms:   s.paymentTerms || null,
    payload:         {},
    created_by:      userId,
  }
}

const REQUISITION_FLOW: RequisitionStatus[] = [
  'submitted',
  'parsing',
  'ontology_matched',
  'proposals',
  'ordered',
]

export const useSuprimentosStore = create<SuprimentosState>()(
  persist(
    (set, get) => ({
  purchaseOrders:      [],
  receipts:            [],
  invoices:            [],
  matches:             [],
  exceptions:          [],
  forecasts:           [],
  requisitions:        [],
  frameworkAgreements: [],

  // Estoque initial state
  depositos:          [],
  estoqueItens:       [],
  movimentacoes:      [],
  reservas:           [],
  leadTimeRecords:    [],
  selectedDepositoId: null,

  // Sync (Sprint 2)
  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  // Suppliers — começa vazio; importável via Excel/CSV no SuprimentosHeader
  suppliers:          [],

  addSupplier: (s) => {
    const newS: Supplier = {
      ...s,
      id: 's-' + crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
    }
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    set((state) => ({
      suppliers: [...state.suppliers, newS],
      pendingSync: [
        ...state.pendingSync,
        makeOp({ entity: 'supplier', type: 'insert', recordId: newS.id, row: supplierToRow(newS, orgId, userId), table: 'suppliers' }),
      ],
    }))
    void get().flush()
  },

  updateSupplier: (id, patch) => {
    set((state) => {
      const updated = state.suppliers.map((s) => (s.id === id ? { ...s, ...patch } : s))
      const target  = updated.find((s) => s.id === id)
      const { profile, user } = useAuth.getState()
      const orgId  = profile?.organization_id ?? 'pending'
      const userId = user?.id ?? 'pending'
      const row    = target ? supplierToRow(target, orgId, userId) : undefined
      const updatePatch = row ? Object.fromEntries(Object.entries(row).filter(([k]) =>
        !['id','organization_id','created_by'].includes(k))) : undefined
      return {
        suppliers: updated,
        pendingSync: [
          ...state.pendingSync,
          makeOp({ entity: 'supplier', type: 'update', recordId: id, patch: updatePatch, table: 'suppliers' }),
        ],
      }
    })
    void get().flush()
  },

  removeSupplier: (id) => {
    set((state) => ({
      suppliers: state.suppliers.filter((s) => s.id !== id),
      pendingSync: [
        ...state.pendingSync,
        makeOp({ entity: 'supplier', type: 'delete', recordId: id, table: 'suppliers' }),
      ],
    }))
    void get().flush()
  },

  addPO: (po) => {
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    set((s) => ({
      purchaseOrders: [...s.purchaseOrders, po],
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'po', type: 'insert', recordId: po.id, row: poToRow(po, orgId, userId), table: 'purchase_orders' }),
      ],
    }))
    void get().flush()
  },

  updatePO: (id, patch) => {
    const before = get().purchaseOrders.find((p) => p.id === id)
    const wasClosed = before?.status === 'closed'

    set((s) => {
      const updated = s.purchaseOrders.map((p) => (p.id === id ? { ...p, ...patch } : p))
      const target  = updated.find((p) => p.id === id)
      const { profile, user } = useAuth.getState()
      const orgId  = profile?.organization_id ?? 'pending'
      const userId = user?.id ?? 'pending'
      const row    = target ? poToRow(target, orgId, userId) : undefined
      const updatePatch = row ? Object.fromEntries(Object.entries(row).filter(([k]) =>
        !['id','organization_id','created_by'].includes(k))) : undefined
      // PO já fechada (closed) precisa de aprovação para UPDATE
      const isLocked = target?.status === 'closed'
      return {
        purchaseOrders: updated,
        pendingSync: [
          ...s.pendingSync,
          isLocked && !wasClosed
            ? makeOp({ entity: 'po', type: 'update', recordId: id, patch: updatePatch, table: 'purchase_orders' })
            : isLocked
            ? makeOp({ entity: 'po', type: 'delete', recordId: id, table: 'purchase_orders', approvalActionType: 'update_po_approved' })
            : makeOp({ entity: 'po', type: 'update', recordId: id, patch: updatePatch, table: 'purchase_orders' }),
        ],
      }
    })

    // Detecta transição para 'closed' e emite domain event
    const after = get().purchaseOrders.find((p) => p.id === id)
    if (after?.status === 'closed' && !wasClosed) {
      eventBus.emit({
        type: 'po.closed',
        poId: id,
        projectId: (after as { projectId?: string }).projectId ?? null,
        totalBrl: after.items?.reduce((s, i) => s + i.totalPrice, 0) ?? 0,
      })
    }

    void get().flush()
  },

  deletePO: (id) => {
    set((s) => ({
      purchaseOrders: s.purchaseOrders.filter((p) => p.id !== id),
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'po', type: 'delete', recordId: id, table: 'purchase_orders', approvalActionType: 'delete_po' }),
      ],
    }))
    void get().flush()
  },

  addReceipt: (receipt) => {
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    set((s) => ({
      receipts: [...s.receipts, receipt],
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'receipt', type: 'insert', recordId: receipt.id, row: receiptToRow(receipt, orgId, userId), table: 'goods_receipts' }),
      ],
    }))
    get().runMatch(receipt.poId)
    void get().flush()
  },

  addInvoice: (invoice) => {
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    set((s) => ({
      invoices: [...s.invoices, invoice],
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'invoice', type: 'insert', recordId: invoice.id, row: invoiceToRow(invoice, orgId, userId), table: 'invoices' }),
      ],
    }))
    get().runMatch(invoice.poId)
    void get().flush()
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

  importConsolidado: (items, target) => {
    const now = new Date().toISOString().slice(0, 10)
    if (target === 'po') {
      // Create one PO per item that has a saldo > 0 (still needs to be ordered)
      const newPOs: PurchaseOrder[] = items
        .filter((it) => it.saldo > 0 || it.qtdTotal > 0)
        .map((it) => ({
          id:               'po-' + crypto.randomUUID().slice(0, 8),
          code:             'OC-' + it.codigo.slice(0, 6).toUpperCase().replace(/\s/g, ''),
          supplier:         it.fornecedor || '—',
          responsible:      '',
          issuedDate:       now,
          expectedDelivery: '',
          status:           'open' as const,
          items: [{
            id:           'poi-' + crypto.randomUUID().slice(0, 8),
            poItemId:     '',
            description:  it.descricao,
            unit:         it.unidade,
            quantity:     it.saldo > 0 ? it.saldo : it.qtdTotal,
            unitPrice:    it.valorUnitario,
            totalPrice:   (it.saldo > 0 ? it.saldo : it.qtdTotal) * it.valorUnitario,
          }],
        }))
      set((s) => ({ purchaseOrders: [...s.purchaseOrders, ...newPOs] }))
    } else {
      // Create or update estoque items
      const newEstoque = items.map((it) => ({
        id:                  'ie-' + crypto.randomUUID().slice(0, 8),
        depositoId:          get().selectedDepositoId ?? get().depositos[0]?.id ?? 'dep-default',
        descricao:           it.descricao,
        unidade:             it.unidade,
        qtdDisponivel:       it.qtdTotal - it.qtdPedida,
        qtdReservada:        0,
        qtdTransito:         it.qtdPedida,
        estoqueMinimo:       0,
        custoUnitario:       it.valorUnitario || undefined,
        categoria:           undefined as string | undefined,
        fornecedorPrincipal: it.fornecedor || undefined,
      }))
      set((s) => ({ estoqueItens: [...s.estoqueItens, ...newEstoque] }))
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
      pendingSync:         [],
      syncError:           null,
    }),

  // ── Sync ────────────────────────────────────────────────────────────────────
  flush: async () => {
    const queue = get().pendingSync
    if (queue.length === 0) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      set({ syncStatus: 'offline' }); return
    }
    const { profile } = useAuth.getState()
    if (!profile) { set({ syncStatus: 'unauth' }); return }

    set({ syncStatus: 'syncing', syncError: null })
    const result = await flushQueue(queue)
    set((s) => ({
      pendingSync: s.pendingSync
        .filter((p) => !result.completed.includes(p.id))
        .map((p) => result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p),
      syncStatus:   result.lastError ? 'error' : 'idle',
      lastSyncedAt: new Date().toISOString(),
      syncError:    result.lastError ?? null,
    }))
  },

  pull: async () => {
    const pos       = await pullTable<Record<string, unknown>>('purchase_orders')
    const receipts  = await pullTable<Record<string, unknown>>('goods_receipts')
    const invoices  = await pullTable<Record<string, unknown>>('invoices')
    const suppliers = await pullTable<Record<string, unknown>>('suppliers')

    if (pos) {
      set({
        purchaseOrders: pos.map((r) => ({
          id:               r.id as string,
          code:             r.code as string,
          supplier:         r.supplier as string,
          responsible:      (r.responsible as string | null) ?? '',
          issuedDate:       r.issued_date as string,
          expectedDelivery: (r.expected_delivery as string | null) ?? '',
          items:            ((r.payload as { items?: PurchaseOrder['items'] })?.items) ?? [],
          status:           r.status as PurchaseOrder['status'],
          projectRef:       (r.project_ref as string | null) ?? undefined,
        })),
      })
    }
    if (receipts) {
      set({
        receipts: receipts.map((r) => ({
          id:           r.id as string,
          poId:         (r.po_id as string | null) ?? '',
          code:         r.code as string,
          receivedDate: r.received_date as string,
          receivedBy:   (r.received_by as string | null) ?? '',
          items:        ((r.payload as { items?: GoodsReceipt['items'] })?.items) ?? [],
        })),
      })
    }
    if (invoices) {
      set({
        invoices: invoices.map((r) => ({
          id:          r.id as string,
          poId:        (r.po_id as string | null) ?? '',
          number:      r.number as string,
          supplier:    r.supplier as string,
          issueDate:   r.issue_date as string,
          dueDate:     (r.due_date as string | null) ?? '',
          totalAmount: Number(r.total_amount ?? 0),
          status:      r.status as Invoice['status'],
          items:       ((r.payload as { items?: Invoice['items'] })?.items) ?? [],
        })),
      })
    }
    if (suppliers) {
      set({
        suppliers: suppliers.map((r) => ({
          id:           r.id as string,
          cnpj:         (r.cnpj as string | null) ?? '',
          name:         r.name as string,
          category:     (r.category as string | null) ?? '',
          contactName:  (r.contact_name as string | null) ?? '',
          phone:        (r.phone as string | null) ?? '',
          email:        (r.email as string | null) ?? '',
          paymentTerms: (r.payment_terms as string | null) ?? '',
          createdAt:    r.created_at as string,
        })),
      })
    }
    set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
  },
    }),
    {
      name: 'cdata-suprimentos',
      partialize: (s) => ({
        purchaseOrders: s.purchaseOrders,
        receipts:       s.receipts,
        invoices:       s.invoices,
        matches:        s.matches,
        suppliers:      s.suppliers,
        pendingSync:    s.pendingSync,
        lastSyncedAt:   s.lastSyncedAt,
        // Estoque continua só local-cache até Sprint 3
        estoqueItens:   s.estoqueItens,
        movimentacoes:  s.movimentacoes,
        reservas:       s.reservas,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useSuprimentosStore.getState().flush()
  })
}
