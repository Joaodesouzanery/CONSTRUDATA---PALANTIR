import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth, canWrite } from '@/lib/auth'
import { podeEscreverSuprimentos } from '@/lib/roles'
import { flushQueue, makeOp, mergePull, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import { eventBus } from '@/lib/eventBus'
import { useActiveObraStore } from '@/store/activeObraStore'
import { buildOperationalKey } from '@/lib/operationalKey'
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
import type { ResumoNucleo, ConsolidadoTrecho, MaterialNucleo } from '@/data/mockPlanilhasConsolidadas'
import {
  createManualItem,
  createManualNucleo,
  baixarEstoqueItem,
  createManualRua,
  createSuprimentosOrdem,
  gerarRequisicoesSuprimentos,
  type GerarRequisicoesResult,
  importSuprimentosPlanilhas,
  loadSuprimentosPlanilhas,
  removeManualItem,
  removeManualNucleo,
  removeManualRua,
  updateManualItem,
  updateManualNucleo,
  updateManualRua,
  type ManualItemInput,
  type ManualItemUpdateInput,
  type ManualNucleoInput,
  type ManualNucleoUpdateInput,
  type ManualRuaInput,
  type ManualRuaUpdateInput,
  type SuprimentosOperacionalItem,
  type SuprimentosOrdem,
} from '@/features/suprimentos/utils/suprimentosPlanilhasSupabase'
import { isDemoModeEnabled } from '@/lib/runtimeMode'
import { hojeLocalISO, horaLocalHHMM } from '@/lib/utils'

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

export type SupplyChainNodeType = 'cliente' | 'centro_distribuicao' | 'planta' | 'fornecedor'
export type SupplyChainAlertStatus = 'aberto' | 'em_analise' | 'mitigado' | 'resolvido'
export type SupplyChainAlertPriority = 'crítica' | 'alta' | 'média' | 'baixa'
export type SupplyChainRiskType = 'atraso_fornecedor' | 'falha_producao' | 'ruptura_estoque' | 'logistica' | 'custo' | 'qualidade'

export interface SupplyChainNode {
  id: string
  tipo: SupplyChainNodeType
  nome: string
  material: string
  cidade: string
  latitude: number
  longitude: number
  status: 'normal' | 'atenção' | 'crítico'
  otif: number
  usoMensal: number
  capacidade: number
  leadTimeDias: number
  contato: string
  observacoes: string
}

export interface SupplyChainAlert {
  id: string
  titulo: string
  status: SupplyChainAlertStatus
  prioridade: SupplyChainAlertPriority
  tipoRisco: SupplyChainRiskType
  planta: string
  fornecedor: string
  visaoGeral: string
  criadoEm: string
}

export interface SupplyChainPlan {
  id: string
  nome: string
  processo: 'S&OE' | 'S&OP'
  status: 'monitorando' | 'em_execucao' | 'concluido'
  gatilho: string
  solucao: string
  aderenciaPlano: number
  impactoOtif: number
  resiliencia: number
  atualizadoEm: string
}

const mockSupplyChainNodes: SupplyChainNode[] = [
  { id: 'scn-for-1', tipo: 'fornecedor', nome: 'TIGRE', material: 'Tubos PVC', cidade: 'Joinville/SC', latitude: -26.3044, longitude: -48.8487, status: 'normal', otif: 94, usoMensal: 6200, capacidade: 12000, leadTimeDias: 5, contato: 'suprimentos@tigre.example', observacoes: 'Fornecedor estratégico de tubulação.' },
  { id: 'scn-for-2', tipo: 'fornecedor', nome: 'AMANCO', material: 'PEAD e conexões', cidade: 'São Paulo/SP', latitude: -23.5505, longitude: -46.6333, status: 'atenção', otif: 87, usoMensal: 4300, capacidade: 9000, leadTimeDias: 8, contato: 'operacoes@amanco.example', observacoes: 'Monitorar pedidos com PEAD DN63.' },
  { id: 'scn-plant-1', tipo: 'planta', nome: 'Planta Atlântico Norte', material: 'Pré-montagem hidráulica', cidade: 'Santos/SP', latitude: -23.9608, longitude: -46.3336, status: 'normal', otif: 92, usoMensal: 3100, capacidade: 7000, leadTimeDias: 2, contato: 'planejamento@atlantico.example', observacoes: 'Unidade produtiva de kits.' },
  { id: 'scn-cd-1', tipo: 'centro_distribuicao', nome: 'CD Baixada', material: 'Materiais de saneamento', cidade: 'Cubatão/SP', latitude: -23.895, longitude: -46.4253, status: 'normal', otif: 91, usoMensal: 8400, capacidade: 15000, leadTimeDias: 1, contato: 'cd.baixada@example', observacoes: 'Hub para frentes litorâneas.' },
  { id: 'scn-cli-1', tipo: 'cliente', nome: 'Obra Morro do Tetéu', material: 'Tubos, conexões e hidrômetros', cidade: 'São Vicente/SP', latitude: -23.9631, longitude: -46.3919, status: 'atenção', otif: 84, usoMensal: 2100, capacidade: 3200, leadTimeDias: 1, contato: 'obra.teteu@example', observacoes: 'Frente com risco de ruptura em TSI 63x20.' },
]

const mockSupplyChainAlerts: SupplyChainAlert[] = [
  { id: 'sca-1', titulo: 'Atraso previsto em PEAD DN63', status: 'aberto', prioridade: 'alta', tipoRisco: 'atraso_fornecedor', planta: 'Planta Atlântico Norte', fornecedor: 'AMANCO', visaoGeral: 'Lead time subiu para 8 dias e pode impactar ligações da próxima semana.', criadoEm: '2026-04-28T09:00:00Z' },
  { id: 'sca-2', titulo: 'Ruptura de TSI 63x20 na frente leste', status: 'em_analise', prioridade: 'crítica', tipoRisco: 'ruptura_estoque', planta: 'CD Baixada', fornecedor: 'AMANCO', visaoGeral: 'Estoque disponível abaixo da reserva planejada para execução quase em tempo real.', criadoEm: '2026-04-28T11:30:00Z' },
  { id: 'sca-3', titulo: 'Custo de atendimento acima do previsto', status: 'mitigado', prioridade: 'média', tipoRisco: 'custo', planta: 'CD Baixada', fornecedor: 'TIGRE', visaoGeral: 'Roteirização alternativa reduz frete por SKU em 6%.', criadoEm: '2026-04-27T15:10:00Z' },
]

const mockSupplyChainPlans: SupplyChainPlan[] = [
  { id: 'scp-1', nome: 'Replanejamento autônomo PEAD DN63', processo: 'S&OE', status: 'em_execucao', gatilho: 'Atraso do fornecedor AMANCO acima de 48h', solucao: 'Realocar 30 unidades do CD Baixada para Morro do Tetéu e priorizar entrega parcial.', aderenciaPlano: 88, impactoOtif: 4, resiliencia: 91, atualizadoEm: '2026-04-28T12:00:00Z' },
  { id: 'scp-2', nome: 'Ciclo mensal de demanda de saneamento', processo: 'S&OP', status: 'monitorando', gatilho: 'Aumento de consumo mensal em conexões hidráulicas', solucao: 'Ajustar plano agregado com estoque mínimo por frente e contratos guarda-chuva.', aderenciaPlano: 93, impactoOtif: 3, resiliencia: 89, atualizadoEm: '2026-04-27T17:00:00Z' },
]

/**
 * A ficha de retirada de material — os campos do formulário de papel do almoxarifado.
 *
 * Todos opcionais: a baixa continua funcionando sem eles (o RDO consome material sem passar por
 * ficha nenhuma). Preenchidos, respondem "quem retirou, quanto e quando".
 */
export interface FichaRetirada {
  lpsActivityId?: string
  observacoes?: string
  /** Quem LEVOU o material. */
  retiradoPor?: string
  /** Quem entregou. */
  entreguePor?: string
  /** "HH:mm" — o relógio de quem registra, não o do servidor (que roda em UTC). */
  hora?: string
  /** "yyyy-MM-dd" local. */
  data?: string
  /** A obra que recebeu. Vence a obra do item: o central atende várias frentes. */
  siteId?: string | null
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

  // Planilhas Consolidadas (importadas via XLSX)
  planilhaResumo:      ResumoNucleo[]
  planilhaTrechos:     ConsolidadoTrecho[]
  planilhaMateriais:   MaterialNucleo[]
  planilhaItensOperacionais: SuprimentosOperacionalItem[]
  planilhaOrdens:      SuprimentosOrdem[]
  planilhaMetadata:    { dataRef: string; contrato: string } | null

  // Cadeia de Suprimentos
  supplyChainNodes:  SupplyChainNode[]
  supplyChainAlerts: SupplyChainAlert[]
  supplyChainPlans:  SupplyChainPlan[]

  // CRUD — POs
  addPO:    (po: PurchaseOrder) => void
  updatePO: (id: string, patch: Partial<PurchaseOrder>) => void
  deletePO: (id: string) => void

  // CRUD — Suppliers (cadastro de fornecedores)
  addSupplier:    (s: Omit<Supplier, 'id' | 'createdAt'>) => void
  updateSupplier: (id: string, patch: Partial<Omit<Supplier, 'id' | 'createdAt'>>) => void
  removeSupplier: (id: string) => void

  // Cadeia de Suprimentos CRUD
  addSupplyChainNode:    (node: Omit<SupplyChainNode, 'id'>) => void
  updateSupplyChainNode: (id: string, patch: Partial<SupplyChainNode>) => void
  removeSupplyChainNode: (id: string) => void
  addSupplyChainAlert:    (alert: Omit<SupplyChainAlert, 'id' | 'criadoEm'> & { criadoEm?: string }) => void
  updateSupplyChainAlert: (id: string, patch: Partial<SupplyChainAlert>) => void
  removeSupplyChainAlert: (id: string) => void
  addSupplyChainPlan:    (plan: Omit<SupplyChainPlan, 'id' | 'atualizadoEm'> & { atualizadoEm?: string }) => void
  updateSupplyChainPlan: (id: string, patch: Partial<SupplyChainPlan>) => void
  removeSupplyChainPlan: (id: string) => void

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
  addDeposito:         (deposito: Omit<DepositoVirtual, 'id' | 'ativo'> & { ativo?: boolean }) => string
  updateDeposito:      (id: string, patch: Partial<Omit<DepositoVirtual, 'id'>>) => void
  removeDeposito:      (id: string) => void
  setSelectedDeposito:  (id: string | null) => void
  addItemEstoque:       (item: Omit<ItemEstoque, 'id'>) => string
  updateItemEstoque:    (id: string, patch: Partial<ItemEstoque>) => void
  removeItemEstoque:    (id: string) => void
  addMovimentacao:      (mov: Omit<MovimentacaoEstoque, 'id'>) => void
  addReserva:           (r: Omit<ReservaMaterial, 'id' | 'criadoEm'>) => void
  updateReserva:        (id: string, patch: Partial<ReservaMaterial>) => void
  consumirMaterial:     (itemId: string, qty: number, opts?: FichaRetirada) => void
  calcSemaforo:         (depositoId: string, lpsActivityId: string, semana: number) => 'verde' | 'amarelo' | 'vermelho'
  runWhatIf:            (params: { activityId: string; semanaOriginal: number; semanaSimulada: number; depositoId: string }) => WhatIfResult

  // Bulk import from Consolidado / Resumo planilhas
  importConsolidado: (items: import('@/features/suprimentos/utils/parseSuprimentosConsolidado').ConsolidadoItem[], target: 'po' | 'estoque') => void

  // Planilhas Consolidadas import
  importPlanilhaResumo:    (rows: ResumoNucleo[]) => void
  importPlanilhaTrechos:   (rows: ConsolidadoTrecho[]) => void
  importPlanilhaMateriais: (rows: MaterialNucleo[]) => void
  importPlanilhasSupabase: (payload: { resumo?: ResumoNucleo[]; trechos?: ConsolidadoTrecho[]; materiais?: MaterialNucleo[] }) => Promise<void>
  pullPlanilhasSupabase:   () => Promise<void>
  addManualNucleo:         (input: ManualNucleoInput) => Promise<void>
  updateManualNucleo:      (input: ManualNucleoUpdateInput) => Promise<void>
  removeManualNucleo:      (id: string) => Promise<void>
  addManualRua:            (input: ManualRuaInput) => Promise<void>
  updateManualRua:         (input: ManualRuaUpdateInput) => Promise<void>
  removeManualRua:         (id: string) => Promise<void>
  addManualItem:           (input: ManualItemInput) => Promise<void>
  updateManualItem:        (input: ManualItemUpdateInput) => Promise<void>
  removeManualItem:        (id: string) => Promise<void>
  createOrdemSuprimentos:  (itemIds: string[]) => Promise<void>
  gerarRequisicoesDoPlanejado: (budgetId: string) => Promise<GerarRequisicoesResult>
  setPlanilhaMetadata:     (meta: { dataRef: string; contrato: string }) => void
  clearPlanilhas:          () => void

  // Demo mode
  loadDemoData: () => void
  clearData: () => void
  sanitizeDemoData: () => void
  activeOrgId: string | null
  ensureTenantScope: (organizationId: string) => void

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

function depositoToRow(deposito: DepositoVirtual, orgId: string, userId: string) {
  return {
    id:              deposito.id,
    organization_id: orgId,
    frente:          deposito.frente,
    descricao:       deposito.descricao ?? null,
    ativo:           deposito.ativo,
    site_id:         deposito.siteId ?? null,
    created_by:      userId,
  }
}

function estoqueItemToRow(item: ItemEstoque, orgId: string, userId: string) {
  return {
    id:                   item.id,
    organization_id:      orgId,
    deposito_id:          item.depositoId || null,
    descricao:            item.descricao,
    unidade:              item.unidade || null,
    qtd_disponivel:       item.qtdDisponivel,
    qtd_reservada:        item.qtdReservada,
    qtd_transito:         item.qtdTransito,
    estoque_minimo:       item.estoqueMinimo,
    custo_unitario:       item.custoUnitario ?? null,
    lps_activity_id:      item.lpsActivityId ?? null,
    categoria:            item.categoria ?? null,
    fornecedor_principal: item.fornecedorPrincipal ?? null,
    site_id:              item.siteId ?? null,
    qtd_por_embalagem:    item.qtdPorEmbalagem ?? null,
    unidade_embalagem:    item.unidadeEmbalagem ?? null,
    // Campos flexíveis (código próprio, data do último pedido…) — coluna jsonb, sem migração por campo.
    metadata: {
      ...(item.codigoReferencia ? { codigoReferencia: item.codigoReferencia } : {}),
      ...(item.dataUltimoPedido ? { dataUltimoPedido: item.dataUltimoPedido } : {}),
      ...(item.linkProduto ? { linkProduto: item.linkProduto } : {}),
      ...(item.realizarPedido ? { realizarPedido: true } : {}),
    },
    created_by:           userId,
  }
}

function movimentacaoToRow(mov: MovimentacaoEstoque, orgId: string, userId: string) {
  return {
    id:              mov.id,
    organization_id: orgId,
    item_id:         mov.itemId,
    deposito_id:     mov.depositoId || null,
    tipo:            mov.tipo,
    quantidade:      mov.quantidade,
    data_movimento:  mov.dataMovimento,
    data_compra:     mov.dataCompra ?? null,
    fornecedor:      mov.fornecedor ?? null,
    nf:              mov.nf ?? null,
    lead_time_dias:  mov.leadTimeDias ?? null,
    lps_activity_id: mov.lpsActivityId ?? null,
    site_id:         mov.siteId ?? null,
    observacoes:     mov.observacoes ?? null,
    retirado_por:    mov.retiradoPor ?? null,
    entregue_por:    mov.entreguePor ?? null,
    hora_movimento:  mov.horaMovimento ?? null,
    custo_unitario:  mov.custoUnitario ?? null,
    created_by:      userId,
  }
}

function currentSyncContext() {
  const { profile, user } = useAuth.getState()
  return {
    orgId:  profile?.organization_id ?? 'pending',
    userId: user?.id ?? 'pending',
  }
}

const demoIds = {
  purchaseOrders:      new Set(mockPurchaseOrders.map((item) => item.id)),
  receipts:            new Set(mockGoodsReceipts.map((item) => item.id)),
  invoices:            new Set(mockInvoices.map((item) => item.id)),
  matches:             new Set(mockMatches.map((item) => item.id)),
  exceptions:          new Set(mockExceptions.map((item) => item.id)),
  forecasts:           new Set(mockForecasts.map((item) => item.id)),
  requisitions:        new Set(mockRequisitions.map((item) => item.id)),
  frameworkAgreements: new Set(mockFrameworkAgreements.map((item) => item.id)),
  depositos:           new Set(mockDepositos.map((item) => item.id)),
  estoqueItens:        new Set(mockEstoqueItens.map((item) => item.id)),
  movimentacoes:       new Set(mockMovimentacoes.map((item) => item.id)),
  reservas:            new Set(mockReservas.map((item) => item.id)),
  leadTimeRecords:     new Set(mockLeadTimeRecords.map((item) => item.id)),
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

  // Planilhas Consolidadas — começa vazio; populado via importação XLSX
  planilhaResumo:    [],
  planilhaTrechos:   [],
  planilhaMateriais: [],
  planilhaItensOperacionais: [],
  planilhaOrdens:    [],
  planilhaMetadata:  null,

  supplyChainNodes:  [],
  supplyChainAlerts: [],
  supplyChainPlans:  [],

  activeOrgId: null,

  // Sync (Sprint 2)
  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  // Suppliers — começa vazio; importável via Excel/CSV no SuprimentosHeader
  suppliers:          [],

  addSupplyChainNode: (node) =>
    set((s) => ({
      supplyChainNodes: [...s.supplyChainNodes, { ...node, id: 'scn-' + crypto.randomUUID().slice(0, 8) }],
    })),

  updateSupplyChainNode: (id, patch) =>
    set((s) => ({
      supplyChainNodes: s.supplyChainNodes.map((node) => node.id === id ? { ...node, ...patch } : node),
    })),

  removeSupplyChainNode: (id) =>
    set((s) => ({ supplyChainNodes: s.supplyChainNodes.filter((node) => node.id !== id) })),

  addSupplyChainAlert: (alert) =>
    set((s) => ({
      supplyChainAlerts: [...s.supplyChainAlerts, { ...alert, id: 'sca-' + crypto.randomUUID().slice(0, 8), criadoEm: alert.criadoEm ?? new Date().toISOString() }],
    })),

  updateSupplyChainAlert: (id, patch) =>
    set((s) => ({
      supplyChainAlerts: s.supplyChainAlerts.map((alert) => alert.id === id ? { ...alert, ...patch } : alert),
    })),

  removeSupplyChainAlert: (id) =>
    set((s) => ({ supplyChainAlerts: s.supplyChainAlerts.filter((alert) => alert.id !== id) })),

  addSupplyChainPlan: (plan) =>
    set((s) => ({
      supplyChainPlans: [...s.supplyChainPlans, { ...plan, id: 'scp-' + crypto.randomUUID().slice(0, 8), atualizadoEm: plan.atualizadoEm ?? new Date().toISOString() }],
    })),

  updateSupplyChainPlan: (id, patch) =>
    set((s) => ({
      supplyChainPlans: s.supplyChainPlans.map((plan) => plan.id === id ? { ...plan, ...patch, atualizadoEm: new Date().toISOString() } : plan),
    })),

  removeSupplyChainPlan: (id) =>
    set((s) => ({ supplyChainPlans: s.supplyChainPlans.filter((plan) => plan.id !== id) })),

  addSupplier: (s) => {
    if (!canWrite()) return   // visualizador é somente-leitura
    // CNPJ é único por org (suppliers_unique_cnpj_per_org). Se já há um fornecedor local com o
    // mesmo CNPJ, reusa o id (upsert atualiza) em vez de inserir outro → evita 23505 preso.
    const cnpjKey = (s.cnpj || '').trim()
    const dup = cnpjKey ? get().suppliers.find((x) => (x.cnpj || '').trim() === cnpjKey) : undefined
    const newS: Supplier = {
      ...s,
      id: dup?.id ?? ('s-' + crypto.randomUUID().slice(0, 8)),
      createdAt: dup?.createdAt ?? new Date().toISOString(),
    }
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    set((state) => ({
      suppliers: dup ? state.suppliers.map((x) => (x.id === newS.id ? newS : x)) : [...state.suppliers, newS],
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
    if (!canWrite()) return   // visualizador é somente-leitura
    // code é único por org (po_unique_code_per_org). POs diferentes com o mesmo code (ex.:
    // requisições cujo código trunca igual) colidiriam (23505, trava a fila) — sufixa para
    // manter único (NÃO mescla — são pedidos distintos).
    const codeTaken = !!po.code && get().purchaseOrders.some((x) => x.id !== po.id && x.code === po.code)
    const poFixed = codeTaken ? { ...po, code: `${po.code}-${po.id.slice(0, 4)}` } : po
    const { profile, user } = useAuth.getState()
    const orgId  = profile?.organization_id ?? 'pending'
    const userId = user?.id ?? 'pending'
    set((s) => ({
      purchaseOrders: [...s.purchaseOrders, poFixed],
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'po', type: 'insert', recordId: poFixed.id, row: poToRow(poFixed, orgId, userId), table: 'purchase_orders' }),
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
      // Era `type: 'delete'` com `approvalActionType: 'delete_po'`, que chama o RPC
      // `request_action`: aquilo só ENFILEIRA um pedido em `pending_actions` e não apaga a OC.
      // A op saía da fila como concluída e a OC voltava no pull seguinte — reaparecendo na
      // conciliação, no 3-way match e no total comprometido com o fornecedor. E como
      // `approve_pending_action` proíbe quem pediu de aprovar, numa empresa que usa uma conta
      // só nunca havia um segundo aprovador: excluir OC era impossível. O soft delete direto
      // faz exatamente o que a aprovação faria (`delete_po` = `SET deleted_at = now()`), e a
      // RLS aceita pelo `po_update_role`.
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'po', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'purchase_orders' }),
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
    eventBus.emit({
      type: 'supply.receipt_approved',
      receiptId: receipt.id,
      poId: receipt.poId,
      operationalKey: buildOperationalKey({
        period: receipt.receivedDate?.slice(0, 7),
      }),
    })
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
    eventBus.emit({
      type: 'supply.invoice_approved',
      invoiceId: invoice.id,
      poId: invoice.poId,
      amount: invoice.totalAmount,
      operationalKey: buildOperationalKey({
        period: invoice.issueDate?.slice(0, 7),
      }),
    })
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
      forecasts: [...s.forecasts, { ...forecast, id: crypto.randomUUID(), siteId: forecast.siteId ?? useActiveObraStore.getState().activeObraId ?? null }],
    })),

  updateForecast: (id, status) =>
    set((s) => ({
      forecasts: s.forecasts.map((f) => (f.id === id ? { ...f, status } : f)),
    })),

  addRequisition: (req) =>
    set((s) => ({ requisitions: [...s.requisitions, { ...req, siteId: req.siteId ?? useActiveObraStore.getState().activeObraId ?? null }] })),

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

  addDeposito: (deposito) => {
    // `sup_dep_insert_with_role` — mesma lista do item de estoque.
    if (!podeEscreverSuprimentos().pode) return ''
    const id = crypto.randomUUID()
    const row = { ...deposito, id, ativo: deposito.ativo ?? true, siteId: deposito.siteId ?? useActiveObraStore.getState().activeObraId ?? null }
    const { orgId, userId } = currentSyncContext()
    set((s) => ({
      depositos: [...s.depositos, row],
      selectedDepositoId: id,
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'estoque_deposito', type: 'insert', recordId: id, row: depositoToRow(row, orgId, userId), table: 'suprimentos_depositos' }),
      ],
    }))
    void get().flush()
    return id
  },

  updateDeposito: (id, patch) => {
    const { orgId, userId } = currentSyncContext()
    set((s) => {
      const updated = s.depositos.map((d) => (d.id === id ? { ...d, ...patch } : d))
      const target = updated.find((d) => d.id === id)
      const row = target ? depositoToRow(target, orgId, userId) : undefined
      const updatePatch = row ? Object.fromEntries(Object.entries(row).filter(([k]) =>
        !['id', 'organization_id', 'created_by'].includes(k))) : undefined
      return {
        depositos: updated,
        pendingSync: [
          ...s.pendingSync,
          makeOp({ entity: 'estoque_deposito', type: 'update', recordId: id, patch: updatePatch, table: 'suprimentos_depositos' }),
        ],
      }
    })
    void get().flush()
  },

  removeDeposito: (id) => {
    const deletedAt = new Date().toISOString()
    set((s) => {
      const remainingItems = s.estoqueItens.filter((item) => item.depositoId !== id)
      const removedItemIds = s.estoqueItens.filter((item) => item.depositoId === id).map((item) => item.id)
      const removedItemSet = new Set(removedItemIds)
      return {
        depositos: s.depositos.filter((d) => d.id !== id),
        selectedDepositoId: s.selectedDepositoId === id ? null : s.selectedDepositoId,
        estoqueItens: remainingItems,
        movimentacoes: s.movimentacoes.filter((mov) => !removedItemSet.has(mov.itemId)),
        pendingSync: [
          ...s.pendingSync,
          makeOp({ entity: 'estoque_deposito', type: 'update', recordId: id, patch: { deleted_at: deletedAt }, table: 'suprimentos_depositos' }),
          ...removedItemIds.map((itemId) =>
            makeOp({ entity: 'estoque_item', type: 'update', recordId: itemId, patch: { deleted_at: deletedAt }, table: 'suprimentos_estoque_itens' }),
          ),
        ],
      }
    })
    void get().flush()
  },

  setSelectedDeposito: (id) => set({ selectedDepositoId: id }),

  addItemEstoque: (item) => {
    // `sup_est_itens_insert_with_role` exige comprador/engenheiro/gerente/diretor/owner. Sem este
    // gate, importar a planilha com outro papel mostrava "23 itens criados" na tela e cada insert
    // voltava 42501 — a fila estacionava depois de cinco tentativas, e o único botão oferecido
    // apagaria o trabalho. Repare que a lista NÃO é a mesma de Mão de Obra.
    if (!podeEscreverSuprimentos().pode) return ''
    const id = crypto.randomUUID()
    const { orgId, userId } = currentSyncContext()
    let depositoId = item.depositoId
    let depositoRow: DepositoVirtual | null = null
    if (!depositoId || depositoId === 'dep-default') {
      depositoId = crypto.randomUUID()
      depositoRow = { id: depositoId, frente: 'Almoxarifado Central', descricao: 'Depósito padrão criado automaticamente', ativo: true, siteId: useActiveObraStore.getState().activeObraId ?? null }
    }
    const row: ItemEstoque = { ...item, id, depositoId, unidade: item.unidade ?? '', siteId: item.siteId ?? useActiveObraStore.getState().activeObraId ?? null }
    set((s) => ({
      depositos: depositoRow ? [...s.depositos, depositoRow] : s.depositos,
      selectedDepositoId: s.selectedDepositoId ?? depositoId,
      estoqueItens: [...s.estoqueItens, row],
      pendingSync: [
        ...s.pendingSync,
        ...(depositoRow ? [makeOp({ entity: 'estoque_deposito', type: 'insert', recordId: depositoRow.id, row: depositoToRow(depositoRow, orgId, userId), table: 'suprimentos_depositos' })] : []),
        makeOp({ entity: 'estoque_item', type: 'insert', recordId: id, row: estoqueItemToRow(row, orgId, userId), table: 'suprimentos_estoque_itens' }),
      ],
    }))
    void get().flush()
    return id
  },

  updateItemEstoque: (id, patch) => {
    const { orgId, userId } = currentSyncContext()
    set((s) => {
      const updated = s.estoqueItens.map((i) => (i.id === id ? { ...i, ...patch } : i))
      const target = updated.find((i) => i.id === id)
      const row = target ? estoqueItemToRow(target, orgId, userId) : undefined
      const updatePatch = row ? Object.fromEntries(Object.entries(row).filter(([k]) =>
        !['id', 'organization_id', 'created_by'].includes(k))) : undefined
      return {
        estoqueItens: updated,
        pendingSync: [
          ...s.pendingSync,
          makeOp({ entity: 'estoque_item', type: 'update', recordId: id, patch: updatePatch, table: 'suprimentos_estoque_itens' }),
        ],
      }
    })
    void get().flush()
  },

  removeItemEstoque: (id) => {
    set((s) => ({
      estoqueItens: s.estoqueItens.filter((i) => i.id !== id),
      movimentacoes: s.movimentacoes.filter((mov) => mov.itemId !== id),
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'estoque_item', type: 'update', recordId: id, patch: { deleted_at: new Date().toISOString() }, table: 'suprimentos_estoque_itens' }),
      ],
    }))
    void get().flush()
  },

  addMovimentacao: (mov) => {
    // `sup_est_mov_insert_with_role`. As demais mutações de estoque (update de item, de depósito e
    // os soft deletes) NÃO ganham gate de propósito: a policy de UPDATE pede só a organização, e
    // um gate mais rígido que a RLS esconderia botão de quem o servidor aceita.
    if (!podeEscreverSuprimentos().pode) return
    const id = crypto.randomUUID()
    const row = { ...mov, id, siteId: mov.siteId ?? useActiveObraStore.getState().activeObraId ?? null }
    const { orgId, userId } = currentSyncContext()
    set((s) => ({
      movimentacoes: [...s.movimentacoes, row],
      pendingSync: [
        ...s.pendingSync,
        makeOp({ entity: 'estoque_movimentacao', type: 'insert', recordId: id, row: movimentacaoToRow(row, orgId, userId), table: 'suprimentos_estoque_movimentacoes' }),
      ],
    }))
    void get().flush()
  },

  addReserva: (r) =>
    set((s) => ({
      reservas: [...s.reservas, { ...r, id: crypto.randomUUID(), criadoEm: new Date().toISOString(), siteId: r.siteId ?? useActiveObraStore.getState().activeObraId ?? null }],
    })),

  updateReserva: (id, patch) =>
    set((s) => ({
      reservas: s.reservas.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  consumirMaterial: (itemId, qty, opts) => {
    // Espelha a checagem que a RPC `baixar_estoque_item` passou a fazer
    // (`20260824120000_baixar_estoque_confere_papel.sql`). Sem o gate aqui, a tela desceria o saldo
    // na hora e o servidor recusaria depois — e o `catch` do reverte devolveria a quantidade, o que
    // pisca na tela sem explicar nada.
    if (!podeEscreverSuprimentos().pode) return
    const { estoqueItens } = get()
    const item = estoqueItens.find((i) => i.id === itemId)
    if (!item) return

    // A obra da ficha vence a do item: o material pode estar no almoxarifado central e sair para
    // uma obra específica, que é justamente o que a ficha de papel registra.
    const siteId = opts?.siteId ?? item.siteId ?? useActiveObraStore.getState().activeObraId ?? null
    const prevQtd = item.qtdDisponivel
    const data = opts?.data ?? hojeLocalISO()
    const hora = opts?.hora ?? horaLocalHHMM()
    const mov: MovimentacaoEstoque = {
      id: crypto.randomUUID(),
      itemId,
      depositoId: item.depositoId,
      siteId,
      tipo: 'saida',
      quantidade: qty,
      // Era `toISOString().slice(0,10)`, ou seja, a data em UTC: uma retirada às 21h30 no Brasil
      // era registrada no dia seguinte.
      dataMovimento: data,
      horaMovimento: hora,
      lpsActivityId: opts?.lpsActivityId,
      observacoes: opts?.observacoes,
      retiradoPor: opts?.retiradoPor,
      entreguePor: opts?.entreguePor,
      // Congelado agora: mudar o preço do item depois não pode reescrever o valor desta saída.
      custoUnitario: item.custoUnitario,
    }
    // Update otimista (UI instantânea). Sem clamp em 0 — saldo negativo é alerta de inventário.
    set((s) => ({
      estoqueItens: s.estoqueItens.map((i) =>
        i.id === itemId ? { ...i, qtdDisponivel: prevQtd - qty } : i
      ),
      movimentacoes: [...s.movimentacoes, mov],
    }))
    // Baixa ATÔMICA no servidor (qtd_disponivel = qtd_disponivel - qty), evita last-write-wins
    // entre usuários concorrentes. Reconcilia com o saldo autoritativo; reverte se falhar.
    void (async () => {
      try {
        const novoQtd = await baixarEstoqueItem(itemId, qty, {
          lpsActivityId: opts?.lpsActivityId,
          observacoes: opts?.observacoes,
          siteId,
          retiradoPor: opts?.retiradoPor,
          entreguePor: opts?.entreguePor,
          hora,
          data,
        })
        set((s) => ({
          estoqueItens: s.estoqueItens.map((i) =>
            i.id === itemId ? { ...i, qtdDisponivel: novoQtd } : i
          ),
          syncError: null,
        }))
      } catch (e) {
        // Reverte por DELTA (soma a qty de volta), não por snapshot: assim, se houver
        // outra baixa concorrente do mesmo item, o revert desfaz só esta sem clobrar a outra.
        set((s) => ({
          estoqueItens: s.estoqueItens.map((i) =>
            i.id === itemId ? { ...i, qtdDisponivel: i.qtdDisponivel + qty } : i
          ),
          movimentacoes: s.movimentacoes.filter((m) => m.id !== mov.id),
          syncError: e instanceof Error ? e.message : 'Falha ao baixar estoque',
        }))
      }
    })()
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

  // ── Planilhas Consolidadas ──────────────────────────────────────────────────
  importPlanilhaResumo:    (rows) => set({ planilhaResumo: rows }),
  importPlanilhaTrechos:   (rows) => set({ planilhaTrechos: rows }),
  importPlanilhaMateriais: (rows) => set({ planilhaMateriais: rows }),
  importPlanilhasSupabase: async (payload) => {
    set({ syncStatus: 'syncing', syncError: null })
    try {
      const loaded = await importSuprimentosPlanilhas(payload)
      set({
        planilhaResumo: loaded.resumo,
        planilhaTrechos: loaded.trechos,
        planilhaMateriais: loaded.materiais,
        planilhaItensOperacionais: loaded.operacional,
        planilhaOrdens: loaded.ordens,
        planilhaMetadata: { dataRef: new Date().toISOString().slice(0, 10), contrato: '' },
        syncStatus: 'idle',
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao importar planilhas de Suprimentos.'
      set({ syncStatus: 'error', syncError: message })
      throw err
    }
  },
  pullPlanilhasSupabase: async () => {
    const orgId = useAuth.getState().profile?.organization_id
    if (orgId) get().ensureTenantScope(orgId)
    set({
      planilhaResumo: [],
      planilhaTrechos: [],
      planilhaMateriais: [],
      planilhaItensOperacionais: [],
      planilhaOrdens: [],
      planilhaMetadata: null,
    })
    try {
      const loaded = await loadSuprimentosPlanilhas()
      set({
        planilhaResumo: loaded.resumo,
        planilhaTrechos: loaded.trechos,
        planilhaMateriais: loaded.materiais,
        planilhaItensOperacionais: loaded.operacional,
        planilhaOrdens: loaded.ordens,
        syncStatus: 'idle',
        lastSyncedAt: new Date().toISOString(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao carregar planilhas de Suprimentos.'
      set({ syncStatus: 'error', syncError: message })
      throw err
    }
  },
  addManualNucleo: async (input) => {
    await createManualNucleo(input)
    await get().pullPlanilhasSupabase()
  },
  updateManualNucleo: async (input) => {
    await updateManualNucleo(input)
    await get().pullPlanilhasSupabase()
  },
  removeManualNucleo: async (id) => {
    await removeManualNucleo(id)
    await get().pullPlanilhasSupabase()
  },
  addManualRua: async (input) => {
    await createManualRua(input)
    await get().pullPlanilhasSupabase()
  },
  updateManualRua: async (input) => {
    await updateManualRua(input)
    await get().pullPlanilhasSupabase()
  },
  removeManualRua: async (id) => {
    await removeManualRua(id)
    await get().pullPlanilhasSupabase()
  },
  addManualItem: async (input) => {
    const loaded = await createManualItem(input)
    set({
      planilhaResumo: loaded.resumo,
      planilhaTrechos: loaded.trechos,
      planilhaMateriais: loaded.materiais,
      planilhaItensOperacionais: loaded.operacional,
      planilhaOrdens: loaded.ordens,
      lastSyncedAt: new Date().toISOString(),
    })
  },
  updateManualItem: async (input) => {
    const loaded = await updateManualItem(input)
    set({
      planilhaResumo: loaded.resumo,
      planilhaTrechos: loaded.trechos,
      planilhaMateriais: loaded.materiais,
      planilhaItensOperacionais: loaded.operacional,
      planilhaOrdens: loaded.ordens,
      lastSyncedAt: new Date().toISOString(),
    })
  },
  removeManualItem: async (id) => {
    const loaded = await removeManualItem(id)
    set({
      planilhaResumo: loaded.resumo,
      planilhaTrechos: loaded.trechos,
      planilhaMateriais: loaded.materiais,
      planilhaItensOperacionais: loaded.operacional,
      planilhaOrdens: loaded.ordens,
      lastSyncedAt: new Date().toISOString(),
    })
  },
  createOrdemSuprimentos: async (itemIds) => {
    const loaded = await createSuprimentosOrdem(itemIds)
    set({
      planilhaResumo: loaded.resumo,
      planilhaTrechos: loaded.trechos,
      planilhaMateriais: loaded.materiais,
      planilhaItensOperacionais: loaded.operacional,
      planilhaOrdens: loaded.ordens,
      lastSyncedAt: new Date().toISOString(),
    })
  },
  gerarRequisicoesDoPlanejado: async (budgetId) => {
    const { result, snapshot } = await gerarRequisicoesSuprimentos(budgetId)
    set({
      planilhaResumo: snapshot.resumo,
      planilhaTrechos: snapshot.trechos,
      planilhaMateriais: snapshot.materiais,
      planilhaItensOperacionais: snapshot.operacional,
      planilhaOrdens: snapshot.ordens,
      lastSyncedAt: new Date().toISOString(),
    })
    return result
  },
  setPlanilhaMetadata:     (meta) => set({ planilhaMetadata: meta }),
  clearPlanilhas: () => set({
    planilhaResumo: [], planilhaTrechos: [], planilhaMateriais: [], planilhaItensOperacionais: [], planilhaOrdens: [], planilhaMetadata: null,
  }),

  importConsolidado: (items, target) => {
    const now = new Date().toISOString().slice(0, 10)
    if (target === 'po') {
      // Create one PO per item that has a saldo > 0 (still needs to be ordered)
      const newPOs: PurchaseOrder[] = items
        .filter((it) => it.saldo > 0 || it.qtdTotal > 0)
        .map((it) => ({
          id:               crypto.randomUUID(),
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
      for (const item of newEstoque) get().addItemEstoque(item)
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
      supplyChainNodes:    mockSupplyChainNodes,
      supplyChainAlerts:   mockSupplyChainAlerts,
      supplyChainPlans:    mockSupplyChainPlans,
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
      planilhaResumo:      [],
      planilhaTrechos:     [],
      planilhaMateriais:   [],
      planilhaItensOperacionais: [],
      planilhaOrdens:      [],
      planilhaMetadata:    null,
      supplyChainNodes:    [],
      supplyChainAlerts:   [],
      supplyChainPlans:    [],
      pendingSync:         [],
      activeOrgId:         null,
      syncError:           null,
    }),

  ensureTenantScope: (organizationId) => {
    if (!organizationId || get().activeOrgId === organizationId) return
    set({
      activeOrgId:          organizationId,
      purchaseOrders:       [],
      receipts:             [],
      invoices:             [],
      matches:              [],
      exceptions:           [],
      forecasts:            [],
      requisitions:         [],
      frameworkAgreements:  [],
      suppliers:            [],
      depositos:            [],
      estoqueItens:         [],
      movimentacoes:        [],
      reservas:             [],
      leadTimeRecords:      [],
      selectedDepositoId:   null,
      planilhaResumo:       [],
      planilhaTrechos:      [],
      planilhaMateriais:    [],
      planilhaItensOperacionais: [],
      planilhaOrdens:       [],
      planilhaMetadata:     null,
      supplyChainNodes:     [],
      supplyChainAlerts:    [],
      supplyChainPlans:     [],
      pendingSync:          [],
      syncStatus:           'idle',
      lastSyncedAt:         null,
      syncError:            null,
    })
  },

  sanitizeDemoData: () => {
    if (isDemoModeEnabled()) return
    set((s) => ({
      purchaseOrders:      s.purchaseOrders.filter((item) => !demoIds.purchaseOrders.has(item.id)),
      receipts:            s.receipts.filter((item) => !demoIds.receipts.has(item.id)),
      invoices:            s.invoices.filter((item) => !demoIds.invoices.has(item.id)),
      matches:             s.matches.filter((item) => !demoIds.matches.has(item.id)),
      exceptions:          s.exceptions.filter((item) => !demoIds.exceptions.has(item.id)),
      forecasts:           s.forecasts.filter((item) => !demoIds.forecasts.has(item.id)),
      requisitions:        s.requisitions.filter((item) => !demoIds.requisitions.has(item.id)),
      frameworkAgreements: s.frameworkAgreements.filter((item) => !demoIds.frameworkAgreements.has(item.id)),
      depositos:           s.depositos.filter((item) => !demoIds.depositos.has(item.id)),
      estoqueItens:        s.estoqueItens.filter((item) => !demoIds.estoqueItens.has(item.id)),
      movimentacoes:       s.movimentacoes.filter((item) => !demoIds.movimentacoes.has(item.id)),
      reservas:            s.reservas.filter((item) => !demoIds.reservas.has(item.id)),
      leadTimeRecords:     s.leadTimeRecords.filter((item) => !demoIds.leadTimeRecords.has(item.id)),
      supplyChainNodes:    [],
      supplyChainAlerts:   [],
      supplyChainPlans:    [],
      selectedDepositoId:  s.selectedDepositoId && demoIds.depositos.has(s.selectedDepositoId) ? null : s.selectedDepositoId,
    }))
  },

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
    const orgId = useAuth.getState().profile?.organization_id
    if (!orgId) {
      set({ syncStatus: 'unauth' })
      return
    }
    get().ensureTenantScope(orgId)
    // Não zera as listas antes de puxar (evita sumiço de dado local se o pull
    // falhar/voltar vazio) e não sobrescreve tabela com op pendente — defesa
    // por-tabela, igual aos demais stores. Cada `if (x) set(...)` abaixo só
    // atualiza a lista quando o pull daquela tabela retornou dados.
    // Fase 5 (mergePull): sempre puxa; o merge preserva os registros com op pendente e
    // atualiza o resto com o servidor. Os filtros pendingDeleted* abaixo continuam para o
    // caso CROSS-tabela (excluir um depósito esconde seus itens/movimentações).
    const pos          = await pullTable<Record<string, unknown>>('purchase_orders')
    const receipts     = await pullTable<Record<string, unknown>>('goods_receipts')
    const invoices     = await pullTable<Record<string, unknown>>('invoices')
    const suppliers    = await pullTable<Record<string, unknown>>('suppliers')
    const depositos    = await pullTable<Record<string, unknown>>('suprimentos_depositos', { column: 'frente', ascending: true })
    const estoqueItens = await pullTable<Record<string, unknown>>('suprimentos_estoque_itens', { column: 'descricao', ascending: true })
    const movimentos   = await pullTable<Record<string, unknown>>('suprimentos_estoque_movimentacoes')
    const pendingDeleteIds = (table: string) => new Set(
      get().pendingSync
        .filter((op) =>
          op.table === table
          && (op.type === 'delete' || (op.type === 'update' && Boolean(op.patch?.deleted_at)))
        )
        .map((op) => op.recordId),
    )
    const pendingDeletedDepositos = pendingDeleteIds('suprimentos_depositos')
    const pendingDeletedItens = pendingDeleteIds('suprimentos_estoque_itens')

    if (pos) {
      set((s) => ({
        purchaseOrders: mergePull(pos.map((r) => ({
          id:               r.id as string,
          code:             r.code as string,
          supplier:         r.supplier as string,
          responsible:      (r.responsible as string | null) ?? '',
          issuedDate:       r.issued_date as string,
          expectedDelivery: (r.expected_delivery as string | null) ?? '',
          items:            ((r.payload as { items?: PurchaseOrder['items'] })?.items) ?? [],
          status:           r.status as PurchaseOrder['status'],
          projectRef:       (r.project_ref as string | null) ?? undefined,
        })), s.purchaseOrders, s.pendingSync, 'purchase_orders'),
      }))
    }
    if (receipts) {
      set((s) => ({
        receipts: mergePull(receipts.map((r) => ({
          id:           r.id as string,
          poId:         (r.po_id as string | null) ?? '',
          code:         r.code as string,
          receivedDate: r.received_date as string,
          receivedBy:   (r.received_by as string | null) ?? '',
          items:        ((r.payload as { items?: GoodsReceipt['items'] })?.items) ?? [],
        })), s.receipts, s.pendingSync, 'goods_receipts'),
      }))
    }
    if (invoices) {
      set((s) => ({
        invoices: mergePull(invoices.map((r) => ({
          id:          r.id as string,
          poId:        (r.po_id as string | null) ?? '',
          number:      r.number as string,
          supplier:    r.supplier as string,
          issueDate:   r.issue_date as string,
          dueDate:     (r.due_date as string | null) ?? '',
          totalAmount: Number(r.total_amount ?? 0),
          status:      r.status as Invoice['status'],
          items:       ((r.payload as { items?: Invoice['items'] })?.items) ?? [],
        })), s.invoices, s.pendingSync, 'invoices'),
      }))
    }
    if (suppliers) {
      set((s) => ({
        suppliers: mergePull(suppliers.map((r) => ({
          id:           r.id as string,
          cnpj:         (r.cnpj as string | null) ?? '',
          name:         r.name as string,
          category:     (r.category as string | null) ?? '',
          contactName:  (r.contact_name as string | null) ?? '',
          phone:        (r.phone as string | null) ?? '',
          email:        (r.email as string | null) ?? '',
          paymentTerms: (r.payment_terms as string | null) ?? '',
          createdAt:    r.created_at as string,
        })), s.suppliers, s.pendingSync, 'suppliers'),
      }))
    }
    if (depositos) {
      set((s) => ({
        depositos: mergePull(depositos.filter((r) => !pendingDeletedDepositos.has(r.id as string)).map((r) => ({
          id:        r.id as string,
          frente:    r.frente as string,
          descricao: (r.descricao as string | null) ?? undefined,
          ativo:     Boolean(r.ativo ?? true),
          siteId:    (r.site_id as string | null) ?? null,
        })), s.depositos, s.pendingSync, 'suprimentos_depositos'),
      }))
    }
    if (estoqueItens) {
      set((s) => ({
        estoqueItens: mergePull(estoqueItens
          .filter((r) => !pendingDeletedItens.has(r.id as string))
          .filter((r) => !pendingDeletedDepositos.has((r.deposito_id as string | null) ?? ''))
          .map((r) => ({
          id:                  r.id as string,
          depositoId:          (r.deposito_id as string | null) ?? '',
          descricao:           r.descricao as string,
          unidade:             (r.unidade as string | null) ?? '',
          qtdDisponivel:       Number(r.qtd_disponivel ?? 0),
          qtdReservada:        Number(r.qtd_reservada ?? 0),
          qtdTransito:         Number(r.qtd_transito ?? 0),
          estoqueMinimo:       Number(r.estoque_minimo ?? 0),
          custoUnitario:       r.custo_unitario == null ? undefined : Number(r.custo_unitario),
          lpsActivityId:       (r.lps_activity_id as string | null) ?? undefined,
          categoria:           (r.categoria as string | null) ?? undefined,
          fornecedorPrincipal: (r.fornecedor_principal as string | null) ?? undefined,
          siteId:              (r.site_id as string | null) ?? null,
          qtdPorEmbalagem:     r.qtd_por_embalagem == null ? undefined : Number(r.qtd_por_embalagem),
          unidadeEmbalagem:    (r.unidade_embalagem as string | null) ?? undefined,
          codigoReferencia:    ((r.metadata as Record<string, unknown> | null)?.codigoReferencia as string | undefined) || undefined,
          dataUltimoPedido:    ((r.metadata as Record<string, unknown> | null)?.dataUltimoPedido as string | undefined) || undefined,
          linkProduto:         ((r.metadata as Record<string, unknown> | null)?.linkProduto as string | undefined) || undefined,
          realizarPedido:      ((r.metadata as Record<string, unknown> | null)?.realizarPedido as boolean | undefined) || undefined,
        })), s.estoqueItens, s.pendingSync, 'suprimentos_estoque_itens'),
      }))
    }
    if (movimentos) {
      set((s) => ({
        movimentacoes: mergePull(movimentos
          .filter((r) => !pendingDeletedItens.has(r.item_id as string))
          .filter((r) => !pendingDeletedDepositos.has((r.deposito_id as string | null) ?? ''))
          .map((r) => ({
          id:             r.id as string,
          itemId:         r.item_id as string,
          depositoId:     (r.deposito_id as string | null) ?? '',
          tipo:           r.tipo as MovimentacaoEstoque['tipo'],
          quantidade:     Number(r.quantidade ?? 0),
          dataMovimento:  r.data_movimento as string,
          dataCompra:     (r.data_compra as string | null) ?? undefined,
          fornecedor:     (r.fornecedor as string | null) ?? undefined,
          nf:             (r.nf as string | null) ?? undefined,
          leadTimeDias:   r.lead_time_dias == null ? undefined : Number(r.lead_time_dias),
          lpsActivityId:  (r.lps_activity_id as string | null) ?? undefined,
          observacoes:    (r.observacoes as string | null) ?? undefined,
          siteId:         (r.site_id as string | null) ?? null,
          retiradoPor:    (r.retirado_por as string | null) ?? undefined,
          entreguePor:    (r.entregue_por as string | null) ?? undefined,
          // O Postgres devolve `time` como "HH:MM:SS"; a tela mostra "HH:MM".
          horaMovimento:  ((r.hora_movimento as string | null) ?? undefined)?.slice(0, 5),
          custoUnitario:  r.custo_unitario == null ? undefined : Number(r.custo_unitario),
        })), s.movimentacoes, s.pendingSync, 'suprimentos_estoque_movimentacoes'),
      }))
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
        frameworkAgreements: s.frameworkAgreements,
        suppliers:      s.suppliers,
        pendingSync:    s.pendingSync,
        lastSyncedAt:   s.lastSyncedAt,
        // Estoque continua só local-cache até Sprint 3
        // Planilhas Consolidadas persisted
        planilhaResumo:    s.planilhaResumo,
        planilhaTrechos:   s.planilhaTrechos,
        planilhaMateriais: s.planilhaMateriais,
        planilhaItensOperacionais: s.planilhaItensOperacionais,
        planilhaOrdens:    s.planilhaOrdens,
        planilhaMetadata:  s.planilhaMetadata,
        activeOrgId:       s.activeOrgId,
      }),
      version: 2,
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted
        const state = persisted as Partial<SuprimentosState>
        delete state.depositos
        delete state.selectedDepositoId
        delete state.estoqueItens
        delete state.movimentacoes
        delete state.reservas
        delete state.leadTimeRecords
        delete state.supplyChainNodes
        delete state.supplyChainAlerts
        delete state.supplyChainPlans
        return state
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useSuprimentosStore.getState().flush()
  })
}

// Quando um RDO é finalizado, o trigger server-side (trg_rdo_to_estoque) baixa o
// estoque. Recarrega para refletir os novos saldos/movimentações na UI.
eventBus.on('rdo.finalized', () => {
  void useSuprimentosStore.getState().pull()
})

// Tempo real cross-usuário: item/movimentação/depósito alterado em outro navegador → re-pull.
eventBus.on('realtime.row_changed', (e) => {
  if (e.table === 'suprimentos_estoque_itens' || e.table === 'suprimentos_estoque_movimentacoes' || e.table === 'suprimentos_depositos') {
    void useSuprimentosStore.getState().pull()
  }
})
