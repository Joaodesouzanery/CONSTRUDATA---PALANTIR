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
} from '@/types'
import {
  mockPurchaseOrders,
  mockGoodsReceipts,
  mockInvoices,
  mockMatches,
  mockExceptions,
  mockForecasts,
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

interface SuprimentosState {
  purchaseOrders: PurchaseOrder[]
  receipts:       GoodsReceipt[]
  invoices:       Invoice[]
  matches:        ThreeWayMatch[]
  exceptions:     MatchException[]
  forecasts:      DemandForecast[]

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
  updateForecast: (id: string, status: DemandForecast['status']) => void
}

export const useSuprimentosStore = create<SuprimentosState>((set, get) => ({
  purchaseOrders: mockPurchaseOrders,
  receipts:       mockGoodsReceipts,
  invoices:       mockInvoices,
  matches:        mockMatches,
  exceptions:     mockExceptions,
  forecasts:      mockForecasts,

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

  updateForecast: (id, status) =>
    set((s) => ({
      forecasts: s.forecasts.map((f) => (f.id === id ? { ...f, status } : f)),
    })),
}))
