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
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { isNonProductionDataMode } from '@/lib/runtimeMode'
import { normalizeNPreco } from '@/lib/medicaoCodeMap'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type BillingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export interface ItemContrato {
  id:             string
  itemEAP:        string   // e.g. "01010101" — hierarquia da obra (EAP)
  nPreco:         string   // e.g. "420009"
  descricao:      string   // e.g. "Assentamento rede esgoto PVC DN150"
  unidade:        string   // "M"
  grupo:          string   // "01" | "02" | "03"
  qtdContrato:    number
  qtdAnterior:   number   // medido em períodos anteriores (NÃO inclui período atual)
  qtdMedida:      number   // medição do período
  valorUnitario:  number
  // COMPUTADOS:
  // qtdAcumulada = qtdAnterior + qtdMedida
  // totalPeriodo = qtdMedida * valorUnitario
  // saldoFinanceiro = (qtdContrato - qtdAnterior - qtdMedida) * valorUnitario
}

export interface MedicaoSourceTotals {
  totalContrato?: number
  totalPeriodo?: number
  totalAcumulado?: number
  saldo?: number
}

export interface MedicaoAnchorTotal {
  label: string
  rowIndex: number
  grupo?: string
  totalContrato?: number
  totalPeriodo?: number
  totalAcumulado?: number
  saldo?: number
}

export interface MedicaoValidation {
  label: string
  source: number
  calculated: number
  diff: number
  ok: boolean
}

export interface PlanilhaBaseMedicao {
  enabled: boolean
  savedAt: string
  sourceName?: string
  itensSnapshot: ItemContrato[]
  sourceTotals?: MedicaoSourceTotals
  anchors?: MedicaoAnchorTotal[]
  validations?: MedicaoValidation[]
}

export interface SubempreteiroItem {
  id?:            string
  nPreco:        string
  nPrecoSabesp:  string   // vínculo com N. Preço da Sabesp para cross-reference
  descricao:     string
  unidade:       string
  qtd:           number
  valorUnitario: number
  mes?:          string
  origem?:       'Manual' | 'RDO Sabesp' | 'Importação XLSX'
  sourceKey?:    string
  rdoId?:        string
  serviceId?:    string
  contractorId?: string | null
  nucleo?:       string
  retencaoPercentual?: number
  retencaoObservacao?: string
}

export interface SubempreiteiroParametroMensal {
  id: string
  mes: string
  descricao?: string
  valor?: number
  medicaoAprovada?: number
  valorMaisDescontos?: number
  empreiteiro: string
  nucleo: string
  contrato: string
  engenheiro: string
  gerenteProducao: string
  revisao: string
  data: string
  status: 'previa' | 'fechado'
}

export interface SubempreiteiroDescontoMensal {
  id: string
  mes: string
  rh: number
  agregados: number
  materiaisFerramentas: number
  materiaisEpi: number
  maquinas: number
  servicos: number
  veiculos: number
  combustivel: number
  abastecimentoComboio: number
  locEquipamentos: number
  epi: number
  total: number
  origem?: 'Manual' | 'Importação XLSX'
}

export interface SubempreiteiroRhMensal {
  id: string
  mes: string
  funcionariosClt: number
  funcionariosPj: number
  adiantamento: number
  folhaSalarial: number
  folhaPj: number
  inss: number
  total: number
  origem?: 'Manual' | 'Importação XLSX'
}

export interface SubempreiteiroNotaFiscal {
  id: string
  numero: string
  fornecedor: string
  observacao: string
  valorNf: number
  valorPago: number
  dataEmissao: string
  vencimento: string
  competencia: string
  status: 'PAGA' | 'PENDENTE' | 'ENVIADA' | 'APROVADA' | 'GLOSADA'
  dataPagamento: string
  origem?: 'Manual' | 'Importação XLSX'
}

export interface SubempreiteiroRetencaoMensal {
  id: string
  mes: string
  valorRetido: number
  valorLiberado: number
  saldoAnterior: number
  saldoFinal: number
  observacao: string
  origem?: 'Manual' | 'RDO Sabesp' | 'Importação XLSX'
}

export interface SubempreiteiroParametroFinanceiro {
  id: string
  mes: string
  descricao: string
  valor: number
  tipo: 'medicao' | 'aprovada' | 'desconto' | 'adiantamento' | 'fechamento' | 'ajuste' | 'retencao' | 'nf' | 'saldo'
  origem?: 'Manual' | 'RDO Sabesp' | 'Importação XLSX' | 'Calculado'
}

export interface SubempreiteiroRetencaoDetalhada {
  id: string
  mes: string
  item: string
  descricao: string
  nPreco: string
  unidade: string
  qtd: number
  precoTotal: number
  fisicoAnterior?: number
  fisicoMes?: number
  fisicoAcumulado?: number
  financeiroAnterior?: number
  financeiroMes?: number
  financeiroAcumulado?: number
  percentualFisico?: number
  percentualFinanceiro?: number
  retencaoPercentual?: number
  observacoes?: string
  origem?: 'Manual' | 'RDO Sabesp' | 'Importação XLSX'
}

export interface SubempreiteiroDetalhadoMensal {
  id: string
  mes: string
  item: string
  descricao: string
  nPreco: string
  unidade: string
  qtdContratada: number
  precoUnitario: number
  precoTotal: number
  qtdMes: number
  precoTotalMes: number
  fisicoAnterior?: number
  fisicoMes?: number
  fisicoAcumulado?: number
  financeiroAnterior?: number
  financeiroMes?: number
  financeiroAcumulado?: number
  percentualFisico?: number
  percentualFinanceiro?: number
  observacoes?: string
  origem?: 'Manual' | 'RDO Sabesp' | 'Importação XLSX'
  status?: 'rascunho' | 'em_revisao' | 'aprovado' | 'glosado' | 'bloqueado'
  rdoId?: string
}

export interface SubempreiteiroMemoriaLinha {
  id: string
  mes: string
  rdoId?: string
  nPreco: string
  descricao: string
  unidade: string
  qtd: number
  nucleo: string
  ruaBeco?: string
  numero?: string
  data?: string
  trechoInicial?: string
  trechoFinal?: string
  notaServico?: string
  croqui?: string
  origem?: 'Manual' | 'RDO Sabesp' | 'Importação XLSX' | 'Importação XLSX'
  status?: 'rascunho' | 'em_revisao' | 'aprovado' | 'glosado' | 'bloqueado'
  evidencia?: string
}

export interface SubempreiteiroCustoLancamento {
  id: string
  mes: string
  data?: string
  descricao: string
  item?: string
  unidade?: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  fornecedor?: string
  nf?: string
  placa?: string
  operador?: string
  origem?: 'Manual' | 'Importação XLSX' | 'Importação XLSX' | 'RDO Sabesp'
  status?: 'rascunho' | 'em_revisao' | 'aprovado' | 'glosado' | 'bloqueado'
  rdoId?: string
  nPreco?: string
  nucleo?: string
  evidencia?: string
}

export interface Subempreiteiro {
  id:             string
  nome:           string   // "VIALTA"
  nucleo:         string   // "São Manuel"
  periodo:        string   // "fev/26"
  contractorId?:  string | null
  itens:          SubempreteiroItem[]
  memoria?:       SubempreiteiroMemoriaLinha[]
  parametros?:    SubempreiteiroParametroMensal[]
  descontos?:     SubempreiteiroDescontoMensal[]
  rh?:            SubempreiteiroRhMensal[]
  agregados?:     SubempreiteiroCustoLancamento[]
  materiaisFerramentas?: SubempreiteiroCustoLancamento[]
  materiaisEpi?:  SubempreiteiroCustoLancamento[]
  maquinas?:      SubempreiteiroCustoLancamento[]
  servicos?:      SubempreiteiroCustoLancamento[]
  veiculos?:      SubempreiteiroCustoLancamento[]
  combustivel?:   SubempreiteiroCustoLancamento[]
  abastecimentoComboio?: SubempreiteiroCustoLancamento[]
  locEquipamentos?: SubempreiteiroCustoLancamento[]
  epis?:          SubempreiteiroCustoLancamento[]
  retencaoItens?: SubempreteiroItem[]
  parametrosFinanceiros?: SubempreiteiroParametroFinanceiro[]
  retencaoDetalhada?: SubempreiteiroRetencaoDetalhada[]
  detalhadoMensal?: SubempreiteiroDetalhadoMensal[]
  nfs?:           SubempreiteiroNotaFiscal[]
  retencoes?:     SubempreiteiroRetencaoMensal[]
  sourceWorkbookName?: string
  sourceSheet?: string
  sourceRow?: number
  parseConfidence?: number
  blockingIssues?: string[]
  importWarnings?: string[]
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
  supplierId?: string | null
  mesReferencia?: string
  obraNucleo?: string
  medicao?: string
  responsavel?: string
  numeroRevisao?: string
  empresa?: string
  contrato?: string
  setor?: string
  data?: string
  totalDescontos?: number
  adiantamento?: number
  fechamentoAnterior?: number
  relatorio?: number
  valorTotalMedicaoNf?: number
  medicaoItens?: FornecedorMedicaoItem[]
  pacoteMedicao?: SupplierMeasurementPackage
  memoriaItens?: SupplierMeasurementMemoryLine[]
  controleLinhas?: SupplierMeasurementControlRow[]
  etapasAprovacao?: SupplierMeasurementApprovalStage[]
  servicosBase?: SupplierBaseService[]
  sourceWorkbookName?: string
  sourceSheet?: string
  sourceRow?: number
  sourceSheets?: string[]
  importWarnings?: string[]
  parseConfidence?: number
  blockingIssues?: string[]
  status?: SupplierMeasurementStatus
}

export type SupplierMeasurementStatus = 'rascunho' | 'pendente' | 'aprovado' | 'glosado' | 'pago'

export interface FornecedorMedicaoItem {
  id: string
  item: string
  descricao: string
  periodo: string
  unidade: string
  precoUnitario: number
  noMes: number
  total: number
  empreiteiro?: string
  nucleo?: string
  quantidadeAnterior?: number
  quantidadeMes?: number
  quantidadeAcumulada?: number
  valorAnterior?: number
  valorMes?: number
  valorAcumulado?: number
  origem?: 'Resumo' | 'Boletim' | 'MC' | 'Controle' | 'Manual'
  pendencias?: string[]
  sourceSheet?: string
  sourceRow?: number
  blockingIssues?: string[]
}

export interface SupplierMeasurementPackage {
  fornecedor: string
  competencia: string
  contrato?: string
  obraNucleo?: string
  medicao?: string
  responsavel?: string
  setor?: string
  revisao?: string
  data?: string
  totalAprovado: number
  totalDescontos: number
  adiantamento: number
  fechamentoAnterior: number
  relatorio: number
  valorTotalMedicaoNf: number
  status: SupplierMeasurementStatus
  origem: 'importado' | 'manual' | 'gerado'
}

export interface SupplierMeasurementLine extends FornecedorMedicaoItem {
  fornecedor?: string
}

export interface SupplierMeasurementMemoryLine {
  id: string
  item?: string
  descricao: string
  numero?: string
  placaModelo?: string
  empreiteiro?: string
  nucleo?: string
  dataInicio?: string
  dataTermino?: string
  totalDias?: number
  unidade?: string
  quantidade: number
  valorUnitario: number
  valorFinal: number
  periodo?: string
  origem?: string
  sourceSheet?: string
  sourceRow?: number
  blockingIssues?: string[]
}

export interface SupplierMeasurementControlRow {
  id: string
  nucleo?: string
  empreiteiro?: string
  subcontratado: string
  servico?: string
  mesReferencia?: string
  valorMedicao: number
  dataEntregaMedicao?: string
  engenheiroValidou?: string
  coordenacao?: string
  gerencia?: string
  status?: string
  dataLimitePagamento?: string
  diasEmAberto?: number
  observacoes?: string
  sourceSheet?: string
  sourceRow?: number
  blockingIssues?: string[]
}

export interface SupplierMeasurementApprovalStage {
  id: string
  etapa: string
  responsavel: string
  prazoLimite: string
  descricao: string
  status?: 'pendente' | 'aprovado' | 'atrasado'
}

export interface SupplierBaseService {
  id: string
  nome: string
  descricao: string
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
  saldoContrato?:          number
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
  planilhaBase?:   PlanilhaBaseMedicao
  subempreiteiros: Subempreiteiro[]
  fornecedores:    Fornecedor[]
  conferencia:     ConferenciaItem[]
  medicaoFinal?:   MedicaoFinal
  createdAt:       string
  updatedAt:       string
  originBoletimId?: string | null
  originPeriodo?:   string | null
  createdFromPrevious?: boolean
  _syncError?:     string | null
}

interface MeasurementBillingBoletimRow {
  id: string
  organization_id?: string
  environment?: 'production' | 'homologation' | 'demo'
  created_by?: string
  periodo: string
  contrato?: string | null
  consorcio?: string | null
  status: MedicaoBoletim['status']
  payload: MedicaoBoletim
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export function getItensBaseCalculoFromBoletim(boletim?: MedicaoBoletim | null): ItemContrato[] {
  if (!boletim) return []
  return boletim.planilhaBase?.enabled && boletim.planilhaBase.itensSnapshot?.length
    ? boletim.planilhaBase.itensSnapshot
    : boletim.itensContrato
}

function makeSubItem(item: SubempreteiroItem): SubempreteiroItem {
  const linkedCode = normalizeNPreco(item.nPrecoSabesp || item.nPreco)
  return { ...item, id: item.id ?? crypto.randomUUID(), nPrecoSabesp: linkedCode || item.nPrecoSabesp || item.nPreco }
}

function sumSubItems(items: SubempreteiroItem[]) {
  return items.reduce((sum, item) => sum + item.qtd * item.valorUnitario, 0)
}

function normalizeSubKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function createRetentionBalance(retencoes: SubempreiteiroRetencaoMensal[] = []) {
  let saldo = 0
  return [...retencoes]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((item) => {
      const saldoAnterior = item.saldoAnterior || saldo
      const saldoFinal = saldoAnterior + item.valorRetido - item.valorLiberado
      saldo = saldoFinal
      return { ...item, saldoAnterior, saldoFinal }
    })
}

function detectEnvironment(): 'production' | 'homologation' | 'demo' {
  const { profile, memberships } = useAuth.getState()
  const active = memberships.find((item) => item.organization_id === profile?.organization_id)
  if (active?.organization?.environment) return active.organization.environment
  const label = `${active?.organization?.name ?? ''} ${active?.organization?.slug ?? ''}`.toLowerCase()
  if (label.includes('homolog') || label.includes('homologacao')) return 'homologation'
  if (label.includes('demo')) return 'demo'
  return 'production'
}

function stripBoletimPrivate(boletim: MedicaoBoletim): MedicaoBoletim {
  const { _syncError, ...clean } = boletim
  void _syncError
  return clean
}

function hasCriticalMeasurementBlock(boletim: MedicaoBoletim) {
  const blockedMemories = boletim.subempreiteiros.flatMap((sub) => sub.memoria ?? []).filter((line) => line.status === 'bloqueado' || line.status === 'glosado')
  const blockedItems = boletim.subempreiteiros.flatMap((sub) => sub.itens ?? []).filter((item) => item.retencaoObservacao?.toLowerCase().includes('bloque'))
  return blockedMemories.length + blockedItems.length
}

async function upsertBoletimRemote(boletim: MedicaoBoletim) {
  const { profile, user } = useAuth.getState()
  if (!profile?.organization_id || !user?.id) return null
  const clean = stripBoletimPrivate(boletim)
  const row = {
    id: clean.id,
    organization_id: profile.organization_id,
    environment: detectEnvironment(),
    created_by: user.id,
    periodo: clean.periodo,
    contrato: clean.contrato,
    consorcio: clean.consorcio,
    status: clean.status,
    payload: clean,
  }
  const { data, error } = await supabase
    .from('measurement_billing_boletins')
    .upsert(row)
    .select('*')
    .single()
  if (error) throw error
  return data as MeasurementBillingBoletimRow
}

function ensureSubArrays(sub: Subempreiteiro): Subempreiteiro {
  const itens = (sub.itens ?? []).map(makeSubItem)
  const memoria = (sub.memoria ?? []).length
    ? sub.memoria ?? []
    : itens.map((item) => ({
        id: crypto.randomUUID(),
        mes: item.mes ?? sub.periodo,
        rdoId: item.rdoId,
        nPreco: item.nPrecoSabesp || item.nPreco,
        descricao: item.descricao,
        unidade: item.unidade,
        qtd: item.qtd,
        nucleo: item.nucleo ?? sub.nucleo,
        origem: item.origem,
        status: item.origem === 'RDO Sabesp' ? 'em_revisao' : 'rascunho',
      } satisfies SubempreiteiroMemoriaLinha))
  return {
    ...sub,
    contractorId: sub.contractorId ?? null,
    itens,
    memoria,
    parametros: sub.parametros ?? [],
    descontos: sub.descontos ?? [],
    rh: sub.rh ?? [],
    agregados: sub.agregados ?? [],
    materiaisFerramentas: sub.materiaisFerramentas ?? [],
    materiaisEpi: sub.materiaisEpi ?? [],
    maquinas: sub.maquinas ?? [],
    servicos: sub.servicos ?? [],
    veiculos: sub.veiculos ?? [],
    combustivel: sub.combustivel ?? [],
    abastecimentoComboio: sub.abastecimentoComboio ?? [],
    locEquipamentos: sub.locEquipamentos ?? [],
    epis: sub.epis ?? [],
    retencaoItens: (sub.retencaoItens ?? []).map(makeSubItem),
    parametrosFinanceiros: sub.parametrosFinanceiros ?? [],
    retencaoDetalhada: sub.retencaoDetalhada ?? [],
    detalhadoMensal: sub.detalhadoMensal ?? [],
    nfs: sub.nfs ?? [],
    retencoes: createRetentionBalance(sub.retencoes ?? []),
    totalMedido: sub.totalMedido || sumSubItems(itens),
  }
}

// ─── Store state ──────────────────────────────────────────────────────────────

interface MedicaoBillingState {
  activeStep:     BillingStep
  boletins:       MedicaoBoletim[]
  activeBoletimId: string | null

  // Navigation
  setActiveStep: (step: BillingStep) => void

  // Boletim CRUD
  loadRemote: () => Promise<void>
  syncActiveBoletim: () => Promise<void>
  flush: () => Promise<void>   // reenvia boletins com erro de sync (offline/erro) — retry idempotente
  createBoletim: (periodo: string, contrato: string, consorcio: string) => string
  createNextBoletimFromBoletim: (sourceId: string, nextPeriodo: string) => string | null
  setActiveBoletim: (id: string) => void
  removeBoletim: (id: string) => void
  getActiveBoletim: () => MedicaoBoletim | null
  getItensBaseCalculo: (boletim?: MedicaoBoletim | null) => ItemContrato[]

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
  fecharBoletim: () => void  // Transfers Acumulado → Anterior, zeros qtdMedida, sets status finalizado

  // Bulk import (XLSX)
  importItensContrato: (
    items: Omit<ItemContrato, 'id'>[],
    replace?: boolean,
    meta?: { sourceName?: string; sourceTotals?: MedicaoSourceTotals; anchors?: MedicaoAnchorTotal[]; validations?: MedicaoValidation[] },
  ) => void
  savePlanilhaBase: (meta?: { sourceName?: string; sourceTotals?: MedicaoSourceTotals; anchors?: MedicaoAnchorTotal[]; validations?: MedicaoValidation[] }) => void
  setPlanilhaBaseEnabled: (enabled: boolean) => void
  importSubempreiteiroItems: (subId: string, items: Omit<SubempreteiroItem, never>[], totals: { totalMedido: number; totalAprovado: number; retencao: number }) => void
  importSubempreiteiroDetalhado: (subId: string, data: Partial<Pick<Subempreiteiro, 'itens' | 'memoria' | 'parametros' | 'parametrosFinanceiros' | 'descontos' | 'rh' | 'agregados' | 'materiaisFerramentas' | 'materiaisEpi' | 'maquinas' | 'servicos' | 'veiculos' | 'combustivel' | 'abastecimentoComboio' | 'locEquipamentos' | 'epis' | 'retencaoItens' | 'retencaoDetalhada' | 'detalhadoMensal' | 'nfs' | 'retencoes' | 'totalMedido' | 'totalAprovado' | 'retencao' | 'nome' | 'nucleo' | 'periodo'>>) => void
  syncRdoSabespSubempreiteiros: (items: Array<{
    contractorId: string
    contractorName: string
    nucleo: string
    periodo: string
    rdoId: string
    rdoDate: string
    serviceId: string
    nPreco: string
    descricao: string
    unidade: string
    qtd: number
    ruaBeco?: string
    evidencia?: string
    evidenceMissing?: boolean
    qualityBlocked?: boolean
  }>) => void
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

      getItensBaseCalculo: (boletimArg) => {
        const boletim = boletimArg ?? get().getActiveBoletim()
        return getItensBaseCalculoFromBoletim(boletim)
      },

      loadRemote: async () => {
        if (isNonProductionDataMode()) return
        const { profile } = useAuth.getState()
        if (!profile?.organization_id) return
        const { data, error } = await supabase
          .from('measurement_billing_boletins')
          .select('*')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
        if (error) {
          console.warn('[medicao-billing] usando cache local', error)
          return
        }
        const remoteBoletins = ((data ?? []) as MeasurementBillingBoletimRow[])
          .map((row) => ({ ...row.payload, _syncError: null }))
          .map((boletim) => ({
            ...boletim,
            subempreiteiros: (boletim.subempreiteiros ?? []).map(ensureSubArrays),
          }))
        if (remoteBoletins.length === 0) return
        set((state) => {
          const byId = new Map(state.boletins.map((item) => [item.id, item]))
          for (const boletim of remoteBoletins) {
            const local = byId.get(boletim.id)
            // Não sobrescreve um boletim local com edição NÃO-sincronizada (o servidor tem a versão
            // antiga); o flush()/retry envia a versão local depois. Evita perder a edição offline.
            if (local && local._syncError != null) continue
            byId.set(boletim.id, boletim)
          }
          const boletins = Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          return {
            boletins,
            activeBoletimId: state.activeBoletimId && boletins.some((item) => item.id === state.activeBoletimId)
              ? state.activeBoletimId
              : boletins[0]?.id ?? state.activeBoletimId,
          }
        })
      },

      syncActiveBoletim: async () => {
        const boletim = get().getActiveBoletim()
        if (!boletim) return
        try {
          await upsertBoletimRemote(boletim)
          set((state) => ({ boletins: state.boletins.map((item) => item.id === boletim.id ? { ...item, _syncError: null } : item) }))
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          set((state) => ({ boletins: state.boletins.map((item) => item.id === boletim.id ? { ...item, _syncError: message } : item) }))
        }
      },

      // Reenvia TODOS os boletins que ficaram com erro de sync (criados/editados offline). Chamado
      // pelo listener 'online' e por flushAllTenantStores() antes de trocar de org/logout — assim
      // um boletim (dado financeiro) não-sincronizado não é destruído no clear. Retry idempotente.
      flush: async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return
        const pend = get().boletins.filter((b) => b._syncError != null)
        for (const boletim of pend) {
          try {
            await upsertBoletimRemote(boletim)
            set((state) => ({ boletins: state.boletins.map((item) => item.id === boletim.id ? { ...item, _syncError: null } : item) }))
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            set((state) => ({ boletins: state.boletins.map((item) => item.id === boletim.id ? { ...item, _syncError: message } : item) }))
          }
        }
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
        void upsertBoletimRemote(boletim).catch((e) => {
          // Não engolir a falha em silêncio (perda invisível): registra o erro no
          // próprio boletim (_syncError, que a UI mostra e é limpo em novo sucesso).
          const msg = e instanceof Error ? e.message : String(e)
          console.error('[medicaoBilling] falha ao salvar boletim', msg)
          set((s) => ({ boletins: s.boletins.map((b) => (b.id === boletim.id ? { ...b, _syncError: msg } : b)) }))
        })
        return id
      },

      createNextBoletimFromBoletim: (sourceId, nextPeriodo) => {
        const source = get().boletins.find((item) => item.id === sourceId)
        if (!source || !nextPeriodo.trim()) return null

        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        const baseItems = getItensBaseCalculoFromBoletim(source).map((item) => ({
          ...item,
          id: crypto.randomUUID(),
          qtdAnterior: (Number(item.qtdAnterior) || 0) + (Number(item.qtdMedida) || 0),
          qtdMedida: 0,
        }))

        const boletim: MedicaoBoletim = {
          id,
          periodo: nextPeriodo.trim(),
          contrato: source.contrato,
          consorcio: source.consorcio,
          status: 'rascunho',
          itensContrato: baseItems,
          planilhaBase: source.planilhaBase
            ? {
                ...source.planilhaBase,
                enabled: true,
                savedAt: now,
                sourceName: `${source.planilhaBase.sourceName ?? 'Base contratual'} -> ${nextPeriodo.trim()}`,
                itensSnapshot: baseItems.map((item) => ({ ...item })),
                sourceTotals: undefined,
                anchors: undefined,
                validations: undefined,
              }
            : undefined,
          subempreiteiros: [],
          fornecedores: [],
          conferencia: [],
          createdAt: now,
          updatedAt: now,
          originBoletimId: source.id,
          originPeriodo: source.periodo,
          createdFromPrevious: true,
        }

        set((s) => ({
          boletins: [...s.boletins, boletim],
          activeBoletimId: id,
          activeStep: 1,
        }))
        void upsertBoletimRemote(boletim).catch((e) => {
          // Não engolir a falha em silêncio (perda invisível): registra o erro no
          // próprio boletim (_syncError, que a UI mostra e é limpo em novo sucesso).
          const msg = e instanceof Error ? e.message : String(e)
          console.error('[medicaoBilling] falha ao salvar boletim', msg)
          set((s) => ({ boletins: s.boletins.map((b) => (b.id === boletim.id ? { ...b, _syncError: msg } : b)) }))
        })
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

      addSubempreiteiro: (sub) => {
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? { ...b, subempreiteiros: [...b.subempreiteiros, ensureSubArrays({ ...sub, id: crypto.randomUUID() })], updatedAt: new Date().toISOString() }
              : b
          ),
        }))
        void get().syncActiveBoletim()
      },

      updateSubempreiteiro: (id, patch) => {
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
        }))
        void get().syncActiveBoletim()
      },

      removeSubempreiteiro: (id) => {
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id === s.activeBoletimId
              ? { ...b, subempreiteiros: b.subempreiteiros.filter((sub) => sub.id !== id), updatedAt: new Date().toISOString() }
              : b
          ),
        }))
        void get().syncActiveBoletim()
      },

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
          // Uses nPrecoSabesp (link to Sabesp item) when available, falls back to nPreco
          const subQtyMap = new Map<string, number>()
          for (const sub of boletim.subempreiteiros) {
            for (const item of sub.itens) {
              const key = normalizeNPreco(item.nPrecoSabesp || item.nPreco)
              subQtyMap.set(key, (subQtyMap.get(key) ?? 0) + item.qtd)
            }
          }

          // Previous observacoes to preserve manual edits
          const prevObsMap = new Map(boletim.conferencia.map((c) => [c.nPreco, c.observacao]))

          const itensBase = get().getItensBaseCalculo(boletim)
          const conferencia: ConferenciaItem[] = itensBase.map((item) => {
            const qtdSub = subQtyMap.get(normalizeNPreco(item.nPreco)) ?? 0
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
          const criticalBlocks = hasCriticalMeasurementBlock(boletim)
          if (criticalBlocks > 0) {
            throw new Error(`Fechamento bloqueado: ${criticalBlocks} item(ns) glosado(s) ou bloqueado(s) pela qualidade.`)
          }

          const itensBase = get().getItensBaseCalculo(boletim)
          const sourceTotals = boletim.planilhaBase?.sourceTotals
          const calculatedTotalMedidoPeriodo = itensBase.reduce(
            (acc, i) => acc + i.qtdMedida * i.valorUnitario,
            0
          )
          const calculatedTotalContratoValor = itensBase.reduce(
            (acc, i) => acc + i.qtdContrato * i.valorUnitario,
            0
          )
          const totalSubempreiteiros = boletim.subempreiteiros.reduce((acc, sub) => acc + sub.totalAprovado, 0)
          const totalFornecedores    = boletim.fornecedores.reduce((acc, f) => acc + f.valorAprovado, 0)

          const calculatedTotalAcumulado = itensBase.reduce(
            (acc, i) => acc + (i.qtdAnterior + i.qtdMedida) * i.valorUnitario,
            0
          )
          const totalContratoValor = sourceTotals?.totalContrato ?? calculatedTotalContratoValor
          const totalMedidoPeriodo = sourceTotals?.totalPeriodo ?? calculatedTotalMedidoPeriodo
          const totalAcumulado = sourceTotals?.totalAcumulado ?? calculatedTotalAcumulado
          const saldoContrato = sourceTotals?.saldo ?? (totalContratoValor - totalAcumulado)

          const medicaoFinal: MedicaoFinal = {
            totalContratoValor,
            totalMedidoPeriodo,
            totalAcumulado,
            saldoContrato,
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

      fecharBoletim: () =>
        set((s) => {
          const boletim = s.boletins.find((b) => b.id === s.activeBoletimId)
          if (!boletim) return s
          const criticalBlocks = hasCriticalMeasurementBlock(boletim)
          if (criticalBlocks > 0) {
            throw new Error(`Fechamento bloqueado: ${criticalBlocks} item(ns) glosado(s) ou bloqueado(s) pela qualidade.`)
          }
          return {
            boletins: s.boletins.map((b) =>
              b.id !== s.activeBoletimId ? b : {
                ...b,
                itensContrato: b.itensContrato.map((i) => ({
                  ...i,
                  qtdAnterior: i.qtdAnterior + i.qtdMedida,
                  qtdMedida: 0,
                })),
                status: 'finalizado' as const,
                updatedAt: new Date().toISOString(),
              }
            ),
          }
        }),

      // ── Bulk import ───────────────────────────────────────────────────────────

      importItensContrato: (items, replace = true, meta) =>
        set((s) => ({
          boletins: s.boletins.map((b) => {
            if (b.id !== s.activeBoletimId) return b
            const existing = replace ? [] : b.itensContrato
            const newItems: ItemContrato[] = items.map((i) => ({ ...i, id: crypto.randomUUID() }))
            const itensContrato = [...existing, ...newItems]
            return {
              ...b,
              itensContrato,
              planilhaBase: replace && meta
                ? {
                    enabled: false,
                    savedAt: new Date().toISOString(),
                    sourceName: meta.sourceName,
                    itensSnapshot: itensContrato.map((item) => ({ ...item })),
                    sourceTotals: meta.sourceTotals,
                    anchors: meta.anchors,
                    validations: meta.validations,
                  }
                : replace ? undefined : b.planilhaBase,
              updatedAt: new Date().toISOString(),
            }
          }),
        })),

      savePlanilhaBase: (meta) =>
        set((s) => ({
          boletins: s.boletins.map((b) => {
            if (b.id !== s.activeBoletimId) return b
            const snapshot: ItemContrato[] = b.itensContrato.map((item) => ({ ...item }))
            return {
              ...b,
              planilhaBase: {
                enabled: true,
                savedAt: new Date().toISOString(),
                sourceName: meta?.sourceName ?? b.planilhaBase?.sourceName,
                itensSnapshot: snapshot,
                sourceTotals: meta?.sourceTotals ?? b.planilhaBase?.sourceTotals,
                anchors: meta?.anchors ?? b.planilhaBase?.anchors,
                validations: meta?.validations ?? b.planilhaBase?.validations,
              },
              updatedAt: new Date().toISOString(),
            }
          }),
        })),

      setPlanilhaBaseEnabled: (enabled) =>
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id !== s.activeBoletimId || !b.planilhaBase
              ? b
              : {
                  ...b,
                  planilhaBase: { ...b.planilhaBase, enabled },
                  updatedAt: new Date().toISOString(),
                }
          ),
        })),

      importSubempreiteiroItems: (subId, items, totals) => {
        set((s) => ({
          boletins: s.boletins.map((b) =>
            b.id !== s.activeBoletimId ? b : {
              ...b,
              subempreiteiros: b.subempreiteiros.map((sub) =>
                sub.id !== subId ? sub : ensureSubArrays({ ...sub, ...totals, itens: items.map((item) => ({ ...item, origem: item.origem ?? 'Importação XLSX' })) })
              ),
              updatedAt: new Date().toISOString(),
            }
          ),
        }))
        void get().syncActiveBoletim()
      },

      importSubempreiteiroDetalhado: (subId, data) => {
        set((s) => ({
          boletins: s.boletins.map((b) => {
            if (b.id !== s.activeBoletimId) return b
            return {
              ...b,
              subempreiteiros: b.subempreiteiros.map((sub) => {
                if (sub.id !== subId) return sub
                const nextItens = data.itens
                  ? [
                      ...sub.itens.filter((item) => item.origem !== 'Importação XLSX'),
                      ...data.itens.map((item) => makeSubItem({ ...item, origem: item.origem ?? 'Importação XLSX' })),
                    ]
                  : sub.itens
                const retencoes = createRetentionBalance(data.retencoes ?? sub.retencoes ?? [])
                return ensureSubArrays({
                  ...sub,
                  ...data,
                  itens: nextItens,
                  memoria: data.memoria ?? sub.memoria ?? [],
                  parametros: data.parametros ?? sub.parametros ?? [],
                  descontos: data.descontos ?? sub.descontos ?? [],
                  rh: data.rh ?? sub.rh ?? [],
                  agregados: data.agregados ?? sub.agregados ?? [],
                  materiaisFerramentas: data.materiaisFerramentas ?? sub.materiaisFerramentas ?? [],
                  materiaisEpi: data.materiaisEpi ?? sub.materiaisEpi ?? [],
                  maquinas: data.maquinas ?? sub.maquinas ?? [],
                  servicos: data.servicos ?? sub.servicos ?? [],
                  veiculos: data.veiculos ?? sub.veiculos ?? [],
                  combustivel: data.combustivel ?? sub.combustivel ?? [],
                  abastecimentoComboio: data.abastecimentoComboio ?? sub.abastecimentoComboio ?? [],
                  locEquipamentos: data.locEquipamentos ?? sub.locEquipamentos ?? [],
                  epis: data.epis ?? sub.epis ?? [],
                  retencaoItens: data.retencaoItens ?? sub.retencaoItens ?? [],
                  parametrosFinanceiros: data.parametrosFinanceiros ?? sub.parametrosFinanceiros ?? [],
                  retencaoDetalhada: data.retencaoDetalhada ?? sub.retencaoDetalhada ?? [],
                  detalhadoMensal: data.detalhadoMensal ?? sub.detalhadoMensal ?? [],
                  nfs: data.nfs ?? sub.nfs ?? [],
                  retencoes,
                  totalMedido: data.totalMedido ?? sumSubItems(nextItens),
                  totalAprovado: data.totalAprovado ?? sub.totalAprovado,
                  retencao: data.retencao ?? sub.retencao,
                })
              }),
              updatedAt: new Date().toISOString(),
            }
          }),
        }))
        void get().syncActiveBoletim()
      },

      syncRdoSabespSubempreiteiros: (items) => {
        set((s) => {
          if (!s.activeBoletimId || items.length === 0) return s
          const incomingRdoIds = new Set(items.map((item) => item.rdoId))
          const bySub = new Map<string, typeof items>()
          for (const item of items) {
            const key = [
              normalizeSubKey(item.contractorId),
              normalizeSubKey(item.nucleo),
              normalizeSubKey(item.periodo),
            ].join('|')
            bySub.set(key, [...(bySub.get(key) ?? []), item])
          }

          return {
            boletins: s.boletins.map((b) => {
              if (b.id !== s.activeBoletimId) return b
              let subs = b.subempreiteiros.map((sub) => ensureSubArrays({
                ...sub,
                itens: sub.itens.filter((item) => !(item.origem === 'RDO Sabesp' && item.rdoId && incomingRdoIds.has(item.rdoId))),
              }))

              for (const group of bySub.values()) {
                const first = group[0]
                const keyMatch = (sub: Subempreiteiro) =>
                  normalizeSubKey(sub.contractorId ?? '') === normalizeSubKey(first.contractorId)
                  && normalizeSubKey(sub.nucleo) === normalizeSubKey(first.nucleo)
                  && normalizeSubKey(sub.periodo) === normalizeSubKey(first.periodo)
                let existing = subs.find(keyMatch)
                if (!existing) {
                  existing = ensureSubArrays({
                    id: crypto.randomUUID(),
                    contractorId: first.contractorId,
                    nome: first.contractorName,
                    nucleo: first.nucleo,
                    periodo: first.periodo,
                    itens: [],
                    totalMedido: 0,
                    totalAprovado: 0,
                    retencao: 0,
                  })
                  subs = [...subs, existing]
                }

                const rdoItems: SubempreteiroItem[] = group.map((item) => makeSubItem({
                  nPreco: item.nPreco,
                  nPrecoSabesp: item.nPreco,
                  descricao: item.descricao,
                  unidade: item.unidade,
                  qtd: item.qtd,
                  valorUnitario: 0,
                  mes: item.periodo,
                  origem: 'RDO Sabesp',
                  sourceKey: `${item.rdoId}|${item.serviceId}|${item.contractorId}|${item.nucleo}`,
                  rdoId: item.rdoId,
                  serviceId: item.serviceId,
                  contractorId: item.contractorId,
                  nucleo: item.nucleo,
                  retencaoObservacao: item.qualityBlocked ? 'Bloqueado pela qualidade no RDO' : undefined,
                }))
                const rdoMemory: SubempreiteiroMemoriaLinha[] = group.map((item) => ({
                  id: crypto.randomUUID(),
                  mes: item.periodo,
                  rdoId: item.rdoId,
                  nPreco: item.nPreco,
                  descricao: item.descricao,
                  unidade: item.unidade,
                  qtd: item.qtd,
                  nucleo: item.nucleo,
                  ruaBeco: item.ruaBeco,
                  evidencia: item.evidenceMissing ? 'Sem evidencia (opcional)' : item.evidencia,
                  origem: 'RDO Sabesp',
                  status: item.qualityBlocked ? 'bloqueado' : item.nPreco ? 'em_revisao' : 'rascunho',
                }))
                const rdoDetalhado: SubempreiteiroDetalhadoMensal[] = group.map((item) => ({
                  id: crypto.randomUUID(),
                  mes: item.periodo,
                  item: item.serviceId,
                  descricao: item.descricao,
                  nPreco: item.nPreco,
                  unidade: item.unidade,
                  qtdContratada: item.qtd,
                  precoUnitario: 0,
                  precoTotal: 0,
                  qtdMes: item.qtd,
                  precoTotalMes: 0,
                  fisicoMes: item.qtd,
                  fisicoAcumulado: item.qtd,
                  financeiroMes: 0,
                  financeiroAcumulado: 0,
                  percentualFisico: 0,
                  percentualFinanceiro: 0,
                  observacoes: item.qualityBlocked ? 'Bloqueado pela qualidade no RDO' : '',
                  origem: 'RDO Sabesp',
                  status: item.qualityBlocked ? 'bloqueado' : item.nPreco ? 'em_revisao' : 'rascunho',
                  rdoId: item.rdoId,
                }))

                subs = subs.map((sub) => {
                  if (sub.id !== existing?.id) return sub
                  const nextItens = [...sub.itens, ...rdoItems]
                  const currentMemory = (sub.memoria ?? []).filter((line) => !(line.origem === 'RDO Sabesp' && line.rdoId && incomingRdoIds.has(line.rdoId)))
                  const currentDetalhado = (sub.detalhadoMensal ?? []).filter((line) => !(line.origem === 'RDO Sabesp' && line.rdoId && incomingRdoIds.has(line.rdoId)))
                  const totalMedido = sumSubItems(nextItens)
                  const wasAutoApproved = sub.totalAprovado === 0 || Math.abs(sub.totalAprovado - sub.totalMedido) < 0.01
                  return ensureSubArrays({
                    ...sub,
                    itens: nextItens,
                    memoria: [...currentMemory, ...rdoMemory],
                    detalhadoMensal: [...currentDetalhado, ...rdoDetalhado],
                    totalMedido,
                    totalAprovado: wasAutoApproved ? totalMedido : sub.totalAprovado,
                  })
                })
              }

              return { ...b, subempreiteiros: subs, updatedAt: new Date().toISOString() }
            }),
          }
        })
        void get().syncActiveBoletim()
      },

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
              { id: 'it-1', itemEAP: '02010101', nPreco: '05.01.001', descricao: 'Escavação mecânica vala', unidade: 'm³', qtdContrato: 1200, qtdAnterior: 200, qtdMedida: 850, valorUnitario: 32.50, grupo: '02' },
              { id: 'it-2', itemEAP: '02010201', nPreco: '05.02.003', descricao: 'Tubo PVC JEI DN 200mm', unidade: 'm', qtdContrato: 2500, qtdAnterior: 500, qtdMedida: 1800, valorUnitario: 78.40, grupo: '02' },
              { id: 'it-3', itemEAP: '02010301', nPreco: '05.03.001', descricao: 'Poço de Visita D=1.20m', unidade: 'un', qtdContrato: 45, qtdAnterior: 8, qtdMedida: 32, valorUnitario: 3250.00, grupo: '02' },
              { id: 'it-4', itemEAP: '03010101', nPreco: '06.01.001', descricao: 'Rede água DN 110mm PEAD', unidade: 'm', qtdContrato: 1800, qtdAnterior: 300, qtdMedida: 1200, valorUnitario: 45.60, grupo: '03' },
              { id: 'it-5', itemEAP: '01010101', nPreco: '01.01.001', descricao: 'Canteiro de serviço', unidade: 'mês', qtdContrato: 12, qtdAnterior: 6, qtdMedida: 3, valorUnitario: 18500.00, grupo: '01' },
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
      version: 6,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>
        const boletins = (state.boletins ?? []) as Record<string, unknown>[]
        if (version < 2) {
          for (const boletim of boletins) {
            const itens = (boletim.itensContrato ?? []) as Record<string, unknown>[]
            for (const item of itens) {
              item.itemEAP = item.itemEAP ?? ''
              item.qtdAnterior = item.qtdAnterior ?? (item as Record<string, unknown>).qtdAcumulada ?? 0
            }
            const subs = (boletim.subempreiteiros ?? []) as Record<string, unknown>[]
            for (const sub of subs) {
              const subItens = (sub.itens ?? []) as Record<string, unknown>[]
              for (const it of subItens) {
                it.nPrecoSabesp = it.nPrecoSabesp ?? ''
              }
            }
          }
        }
        if (version < 3) {
          // Renomear qtdAcumulada → qtdAnterior
          for (const boletim of boletins) {
            const itens = (boletim.itensContrato ?? []) as Record<string, unknown>[]
            for (const item of itens) {
              if ('qtdAcumulada' in item) {
                item.qtdAnterior = item.qtdAcumulada
                delete item.qtdAcumulada
              }
              item.qtdAnterior = item.qtdAnterior ?? 0
            }
          }
        }
        if (version < 4) {
          for (const boletim of boletins) {
            if (!boletim.planilhaBase) continue
            const base = boletim.planilhaBase as Record<string, unknown>
            base.enabled = Boolean(base.enabled)
            base.itensSnapshot = Array.isArray(base.itensSnapshot) ? base.itensSnapshot : []
          }
        }
        if (version < 5) {
          for (const boletim of boletins) {
            const subs = (boletim.subempreiteiros ?? []) as Record<string, unknown>[]
            for (const sub of subs) {
              sub.contractorId = sub.contractorId ?? null
              sub.parametros = Array.isArray(sub.parametros) ? sub.parametros : []
              sub.descontos = Array.isArray(sub.descontos) ? sub.descontos : []
              sub.rh = Array.isArray(sub.rh) ? sub.rh : []
              sub.nfs = Array.isArray(sub.nfs) ? sub.nfs : []
              sub.retencoes = Array.isArray(sub.retencoes) ? sub.retencoes : []
              const subItens = (sub.itens ?? []) as Record<string, unknown>[]
              for (const item of subItens) {
                item.id = item.id ?? crypto.randomUUID()
                item.origem = item.origem ?? 'Manual'
              }
            }
          }
        }
        if (version < 6) {
          for (const boletim of boletins) {
            const subs = (boletim.subempreiteiros ?? []) as Record<string, unknown>[]
            for (const sub of subs) {
              sub.memoria = Array.isArray(sub.memoria) ? sub.memoria : []
              sub.agregados = Array.isArray(sub.agregados) ? sub.agregados : []
              sub.materiaisFerramentas = Array.isArray(sub.materiaisFerramentas) ? sub.materiaisFerramentas : []
              sub.materiaisEpi = Array.isArray(sub.materiaisEpi) ? sub.materiaisEpi : []
              sub.maquinas = Array.isArray(sub.maquinas) ? sub.maquinas : []
              sub.servicos = Array.isArray(sub.servicos) ? sub.servicos : []
              sub.veiculos = Array.isArray(sub.veiculos) ? sub.veiculos : []
              sub.combustivel = Array.isArray(sub.combustivel) ? sub.combustivel : []
              sub.abastecimentoComboio = Array.isArray(sub.abastecimentoComboio) ? sub.abastecimentoComboio : []
              sub.locEquipamentos = Array.isArray(sub.locEquipamentos) ? sub.locEquipamentos : []
              sub.epis = Array.isArray(sub.epis) ? sub.epis : []
            }
          }
        }
        return state as unknown as MedicaoBillingState
      },
    }
  )
)

// Reenvia boletins não-sincronizados ao reconectar (não perde dado financeiro feito offline).
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void useMedicaoBillingStore.getState().flush() })
}
