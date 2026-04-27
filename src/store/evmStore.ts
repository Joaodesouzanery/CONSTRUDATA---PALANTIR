/**
 * evmStore.ts — Zustand store for EVM (Earned Value Management) module.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'
import type {
  EvmTab, WorkPackage, CostAccountEntry, WeightedMeasurement,
  EvmMetrics, SCurveMultiPoint, CostPillar, CostBreakdown,
  EacScenarios, PillarDeviation, StockAlert,
  ContratoFinanceiro, NucleoFinanceiro, FinanceiroWorkPackage,
  MeasurementTemplate,
} from '@/types'

// ─── Mappers ──────────────────────────────────────────────────────────────────
function workPackageToRow(wp: WorkPackage, orgId: string, userId: string) {
  return {
    id:               wp.id,
    organization_id:  orgId,
    project_id:       (wp as { projectId?: string }).projectId ?? null,
    code:             (wp as { code?: string }).code ?? null,
    name:             wp.name ?? null,
    total_budget_brl: (wp as { totalBudgetBRL?: number }).totalBudgetBRL ?? null,
    is_template:      (wp as { isTemplate?: boolean }).isTemplate ?? false,
    payload:          wp as unknown as Record<string, unknown>,
    created_by:       userId,
  }
}
function costAccountToRow(ca: CostAccountEntry, orgId: string, userId: string) {
  return {
    id:              ca.id,
    organization_id: orgId,
    work_package_id: (ca as { workPackageId?: string }).workPackageId ?? null,
    activity_id:     (ca as { activityId?: string }).activityId ?? null,
    pillar:          ca.pillar,
    total_cost_brl:  ca.totalCostBRL,
    payload:         ca as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function measurementToRow(m: WeightedMeasurement, orgId: string, userId: string) {
  return {
    id:              m.id,
    organization_id: orgId,
    work_package_id: (m as { workPackageId?: string }).workPackageId ?? null,
    activity_id:     (m as { activityId?: string }).activityId ?? null,
    composite_score: m.compositeScore,
    payload:         m as unknown as Record<string, unknown>,
    created_by:      userId,
  }
}
function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

interface EvmState {
  activeTab: EvmTab
  workPackages: WorkPackage[]
  costAccounts: CostAccountEntry[]
  measurements: WeightedMeasurement[]
  evmMetrics: EvmMetrics
  sCurveData: SCurveMultiPoint[]
  contrato: ContratoFinanceiro | null
  nucleos: NucleoFinanceiro[]
  selectedNucleoId: string | null
  measurementTemplates: MeasurementTemplate[]
  diagnosticNotes: string[]

  setActiveTab: (tab: EvmTab) => void
  setSelectedNucleo: (id: string | null) => void
  addNucleoFinanceiro: (nome: string) => void
  updateNucleoFinanceiro: (id: string, patch: Partial<Pick<NucleoFinanceiro, 'nome' | 'codigo' | 'descricao' | 'bacAlocado' | 'bacPercentual' | 'cor' | 'ativo'>>) => void
  removeNucleoFinanceiro: (id: string) => void
  applyMeasurementTemplate: (templateId: string, nucleoId?: string) => void
  diagnoseSpi: (nucleoId?: string) => void

  // Work Package CRUD
  addWorkPackage: (wp: Omit<WorkPackage, 'id' | 'createdAt'>) => void
  updateWorkPackage: (id: string, patch: Partial<WorkPackage>) => void
  removeWorkPackage: (id: string) => void

  // Cost Account CRUD
  addCostAccount: (entry: Omit<CostAccountEntry, 'id' | 'totalCostBRL'>) => void
  updateCostAccount: (id: string, patch: Partial<CostAccountEntry>) => void
  removeCostAccount: (id: string) => void

  // Measurement CRUD
  addMeasurement: (m: Omit<WeightedMeasurement, 'id' | 'compositeScore'>) => void
  updateMeasurement: (id: string, patch: Partial<WeightedMeasurement>) => void
  removeMeasurement: (id: string) => void

  // Recalculate
  recalculateMetrics: () => void

  // Data management
  loadDemoData: () => void
  clearData: () => void

  // Sync (Sprint 6)
  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

const EMPTY_METRICS: EvmMetrics = {
  BAC: 0, PV: 0, EV: 0, AC: 0,
  CPI: 0, SPI: 0, CV: 0, SV: 0,
  EAC: 0, ETC: 0, VAC: 0, TCPI: 0,
  costBreakdown: { material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0 },
  eacScenarios: { optimistic: 0, trend: 0, pessimistic: 0 },
  pillarDeviations: [],
  stockAlerts: [],
  healthStatus: 'blue' as const,
}

const PILLAR_LABELS: Record<CostPillar, string> = {
  material: 'Material',
  equipamento: 'Equipamento',
  mao_de_obra: 'Mao de Obra',
  impostos_indiretos: 'Impostos Indiretos',
}

function computeCompositeScore(m: Omit<WeightedMeasurement, 'id' | 'compositeScore'>): number {
  return (
    m.financialWeight * 0.3 +
    m.durationWeight * 0.25 +
    m.economicWeight * 0.3 +
    m.specificWeight * 0.15
  )
}

function computeWpScore(wp: Pick<FinanceiroWorkPackage, 'pesoFinanceiro' | 'pesoDuracao' | 'pesoEconomico' | 'pesoEspecifico'>) {
  return wp.pesoFinanceiro * 0.3 + wp.pesoDuracao * 0.25 + wp.pesoEconomico * 0.3 + wp.pesoEspecifico * 0.15
}

function makeWorkPackageFinanceiro(input: Omit<FinanceiroWorkPackage, 'scoreComposto' | 'evReconhecido'>): FinanceiroWorkPackage {
  const scoreComposto = computeWpScore(input)
  const evReconhecido = input.bacWP * (input.progFisico / 100) * input.pesoFinanceiro
  return { ...input, scoreComposto, evReconhecido }
}

function makeNucleoFinanceiro(input: {
  id: string
  codigo: string
  nome: string
  contratoId: string
  bacAlocado: number
  bacPercentual: number
  cor: string
}): NucleoFinanceiro {
  return {
    ...input,
    descricao: `${input.nome} - controle financeiro por núcleo`,
    ativo: true,
    planoContas: {
      nucleoId: input.id,
      material: [],
      maoDeObra: [],
      equipamentos: [],
      subcontrato: [],
      overhead: [],
      totalOrcado: input.bacAlocado,
    },
    workPackages: [
      makeWorkPackageFinanceiro({
        id: `${input.id}-wp-esc`,
        nucleoId: input.id,
        wbsRef: `${input.codigo}.1`,
        descricao: 'Escavacao e assentamento',
        bacWP: input.bacAlocado * 0.35,
        pesoFinanceiro: 0.25,
        pesoDuracao: 0.3,
        pesoEconomico: 0.3,
        pesoEspecifico: 0.15,
        progFisico: 52,
      }),
      makeWorkPackageFinanceiro({
        id: `${input.id}-wp-reat`,
        nucleoId: input.id,
        wbsRef: `${input.codigo}.2`,
        descricao: 'Reaterro e recomposicao',
        bacWP: input.bacAlocado * 0.28,
        pesoFinanceiro: 0.3,
        pesoDuracao: 0.25,
        pesoEconomico: 0.25,
        pesoEspecifico: 0.2,
        progFisico: 38,
      }),
      makeWorkPackageFinanceiro({
        id: `${input.id}-wp-teste`,
        nucleoId: input.id,
        wbsRef: `${input.codigo}.3`,
        descricao: 'Teste, limpeza e entrega',
        bacWP: input.bacAlocado * 0.18,
        pesoFinanceiro: 0.2,
        pesoDuracao: 0.2,
        pesoEconomico: 0.25,
        pesoEspecifico: 0.35,
        progFisico: 24,
      }),
    ],
    entradas: [
      {
        id: `${input.id}-ent-1`,
        nucleoId: input.id,
        tipo: 'medicao',
        descricao: `Medicao ${input.codigo}`,
        valor: input.bacAlocado * 0.18,
        data: '2026-04-20',
        status: 'aprovado',
      },
    ],
    saidas: [
      {
        id: `${input.id}-sai-1`,
        nucleoId: input.id,
        categoria: 'material',
        descricao: `Materiais ${input.codigo}`,
        fornecedor: 'Fornecedor local',
        valor: input.bacAlocado * 0.12,
        data: '2026-04-10',
        status: 'pago',
      },
      {
        id: `${input.id}-sai-2`,
        nucleoId: input.id,
        categoria: 'equipamentos',
        descricao: `Equipamentos ${input.codigo}`,
        fornecedor: 'Locadora',
        valor: input.bacAlocado * 0.08,
        data: '2026-04-14',
        status: 'pendente',
      },
    ],
    evm: [
      {
        nucleoId: input.id,
        periodo: '2026-04',
        pv: input.bacAlocado * 0.3,
        ev: input.bacAlocado * 0.24,
        ac: input.bacAlocado * 0.27,
        cpi: 0.89,
        spi: 0.8,
        cv: input.bacAlocado * -0.03,
        sv: input.bacAlocado * -0.06,
        eacFormula: input.bacAlocado / 0.89,
        eacOtimista: input.bacAlocado / 0.96,
        eacPessimista: input.bacAlocado / 0.76,
        vac: input.bacAlocado - input.bacAlocado / 0.89,
        tcpi: 1.1,
        ppcSemana: [0.72, 0.68, 0.75, 0.7],
        ppcMedio: 0.71,
      },
    ],
  }
}

function buildMeasurementTemplates(): MeasurementTemplate[] {
  return [
    {
      id: 'tpl-saneamento',
      nome: 'Template Saneamento',
      tipologia: 'saneamento',
      pesos: [
        { descricao: 'Mobilizacao e sinalizacao', pesoFinanceiro: 0.1, pesoDuracao: 0.15, pesoEconomico: 0.1, pesoEspecifico: 0.2 },
        { descricao: 'Escavacao', pesoFinanceiro: 0.25, pesoDuracao: 0.3, pesoEconomico: 0.25, pesoEspecifico: 0.15 },
        { descricao: 'Assentamento de rede', pesoFinanceiro: 0.3, pesoDuracao: 0.25, pesoEconomico: 0.3, pesoEspecifico: 0.25 },
        { descricao: 'Reaterro e recomposicao', pesoFinanceiro: 0.25, pesoDuracao: 0.2, pesoEconomico: 0.25, pesoEspecifico: 0.25 },
        { descricao: 'Teste e entrega', pesoFinanceiro: 0.1, pesoDuracao: 0.1, pesoEconomico: 0.1, pesoEspecifico: 0.15 },
      ],
    },
    {
      id: 'tpl-edificacao',
      nome: 'Template Edificacao',
      tipologia: 'edificacao',
      pesos: [
        { descricao: 'Fundacao', pesoFinanceiro: 0.22, pesoDuracao: 0.22, pesoEconomico: 0.24, pesoEspecifico: 0.18 },
        { descricao: 'Estrutura', pesoFinanceiro: 0.28, pesoDuracao: 0.3, pesoEconomico: 0.26, pesoEspecifico: 0.22 },
        { descricao: 'Instalacoes', pesoFinanceiro: 0.18, pesoDuracao: 0.2, pesoEconomico: 0.2, pesoEspecifico: 0.24 },
        { descricao: 'Acabamento', pesoFinanceiro: 0.24, pesoDuracao: 0.2, pesoEconomico: 0.22, pesoEspecifico: 0.24 },
      ],
    },
  ]
}

function computeFinancialPortfolio(nucleos: NucleoFinanceiro[], onlyIds?: string[]): EvmMetrics {
  const selected = onlyIds ? nucleos.filter((n) => onlyIds.includes(n.id)) : nucleos
  if (selected.length === 0) return { ...EMPTY_METRICS }
  const BAC = selected.reduce((sum, n) => sum + n.bacAlocado, 0)
  const latestPeriods = selected.flatMap((n) => n.evm.slice(-1))
  const PV = latestPeriods.reduce((sum, p) => sum + p.pv, 0)
  const EV = selected.reduce((sum, n) => sum + n.workPackages.reduce((wpSum, wp) => wpSum + wp.evReconhecido, 0), 0)
  const AC = selected.reduce((sum, n) => sum + n.saidas.reduce((saidaSum, saida) => saidaSum + saida.valor, 0), 0)
  const CPI = AC > 0 ? EV / AC : 0
  const SPI = PV > 0 ? EV / PV : 0
  const CV = EV - AC
  const SV = EV - PV
  const ppcValues = latestPeriods.flatMap((p) => p.ppcSemana)
  const ppcAverage = ppcValues.length > 0 ? ppcValues.reduce((sum, p) => sum + p, 0) / ppcValues.length : 0.8
  const idc = Math.max(0.35, (CPI || 0.8) * Math.max(0.5, ppcAverage))
  const EAC = BAC / idc
  const ETC = EAC - AC
  const VAC = BAC - EAC
  const TCPI = BAC - AC !== 0 ? (BAC - EV) / (BAC - AC) : 0
  return {
    BAC, PV, EV, AC, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI,
    costBreakdown: { material: AC * 0.45, equipamento: AC * 0.25, mao_de_obra: AC * 0.25, impostos_indiretos: AC * 0.05 },
    eacScenarios: { optimistic: BAC / Math.max(0.6, idc * 1.12), trend: EAC, pessimistic: BAC / Math.max(0.35, idc * 0.86) },
    pillarDeviations: [],
    stockAlerts: [],
    healthStatus: CPI >= 1 && SPI >= 1 ? 'blue' : CPI < 0.9 || SPI < 0.9 ? 'red' : 'yellow',
  }
}

function buildDemoFinancialModel() {
  const contrato: ContratoFinanceiro = {
    id: 'contrato-atlantico-demo',
    numero: 'CTR-ATL-2026',
    descricao: 'Contrato Atlantico - Saneamento Integrado',
    contratante: 'Sabesp',
    dataInicio: '2026-01-05',
    dataFim: '2026-12-20',
    bac: 4_891_304,
  }
  const names = ['Morro do Teteu', 'Vila dos Criadores', 'São Manuel', 'Núcleo Norte', 'Núcleo Sul', 'Interligações']
  const colors = ['#f97316', '#22c55e', '#38bdf8', '#a78bfa', '#f59e0b', '#ef4444']
  const nucleos = names.map((nome, idx) => makeNucleoFinanceiro({
    id: `nucleo-fin-${idx + 1}`,
    codigo: `N${idx + 1}`,
    nome,
    contratoId: contrato.id,
    bacAlocado: contrato.bac / names.length,
    bacPercentual: 100 / names.length,
    cor: colors[idx],
  }))
  return { contrato, nucleos }
}

export const useEvmStore = create<EvmState>()(
  persist(
    (set, get) => ({
  activeTab: 'dashboard',
  workPackages: [],
  costAccounts: [],
  measurements: [],
  evmMetrics: { ...EMPTY_METRICS },
  sCurveData: [],
  contrato: null,
  nucleos: [],
  selectedNucleoId: null,
  measurementTemplates: buildMeasurementTemplates(),
  diagnosticNotes: [],

  pendingSync:  [],
  syncStatus:   'idle',
  lastSyncedAt: null,
  syncError:    null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedNucleo: (id) => set({ selectedNucleoId: id }),

  addNucleoFinanceiro: (nome) => {
    const contrato = get().contrato
    const id = `nuc-${crypto.randomUUID().slice(0, 8)}`
    const novo = makeNucleoFinanceiro({
      id,
      codigo: `N${get().nucleos.length + 1}`,
      nome,
      contratoId: contrato?.id ?? 'contrato-local',
      bacAlocado: Math.max(1, (contrato?.bac ?? 0) * 0.1),
      bacPercentual: 10,
      cor: '#f97316',
    })
    set((s) => ({ nucleos: [...s.nucleos, novo], selectedNucleoId: novo.id }))
    get().recalculateMetrics()
  },

  updateNucleoFinanceiro: (id, patch) => {
    set((s) => ({
      nucleos: s.nucleos.map((n) => {
        if (n.id !== id) return n
        const bacAlocado = patch.bacAlocado ?? n.bacAlocado
        return {
          ...n,
          ...patch,
          bacAlocado,
          planoContas: {
            ...n.planoContas,
            totalOrcado: bacAlocado,
          },
        }
      }),
    }))
    get().recalculateMetrics()
  },

  removeNucleoFinanceiro: (id) => {
    set((s) => {
      const remaining = s.nucleos.filter((n) => n.id !== id)
      return {
        nucleos: remaining,
        selectedNucleoId: s.selectedNucleoId === id ? null : s.selectedNucleoId,
        diagnosticNotes: [],
      }
    })
    get().recalculateMetrics()
  },

  applyMeasurementTemplate: (templateId, nucleoId) => {
    const template = get().measurementTemplates.find((t) => t.id === templateId)
    const targetId = nucleoId ?? get().selectedNucleoId ?? get().nucleos[0]?.id
    if (!template || !targetId) return
    set((s) => ({
      nucleos: s.nucleos.map((n) => {
        if (n.id !== targetId) return n
        const baseBudget = n.bacAlocado / Math.max(1, template.pesos.length)
        return {
          ...n,
          workPackages: template.pesos.map((p, idx) => makeWorkPackageFinanceiro({
            id: `${n.id}-tpl-${idx + 1}`,
            nucleoId: n.id,
            wbsRef: `${n.codigo}.${idx + 1}`,
            descricao: p.descricao,
            bacWP: baseBudget,
            pesoFinanceiro: p.pesoFinanceiro,
            pesoDuracao: p.pesoDuracao,
            pesoEconomico: p.pesoEconomico,
            pesoEspecifico: p.pesoEspecifico,
            progFisico: idx === 0 ? 80 : idx === 1 ? 55 : 25,
          })),
        }
      }),
    }))
    get().recalculateMetrics()
  },

  diagnoseSpi: (nucleoId) => {
    const targetId = nucleoId ?? get().selectedNucleoId
    const metrics = computeFinancialPortfolio(get().nucleos, targetId ? [targetId] : undefined)
    const notes: string[] = []
    if (metrics.SPI < 1) notes.push(`SPI ${metrics.SPI.toFixed(2)}: EV menor que PV, indicando atraso fisico-financeiro no periodo.`)
    if (metrics.CPI < 1) notes.push(`CPI ${metrics.CPI.toFixed(2)}: custo real acima do valor agregado reconhecido.`)
    const selected = targetId ? get().nucleos.filter((n) => n.id === targetId) : get().nucleos
    const lowPpc = selected.flatMap((n) => n.evm).filter((p) => p.ppcMedio < 0.8)
    if (lowPpc.length > 0) notes.push(`PPC medio abaixo de 80% em ${lowPpc.length} periodo(s), reduzindo o EV operacional.`)
    const criticalWp = selected.flatMap((n) => n.workPackages).filter((wp) => wp.progFisico < 50 && wp.pesoFinanceiro >= 0.25)
    if (criticalWp.length > 0) notes.push(`Work packages criticos com baixo progresso: ${criticalWp.slice(0, 3).map((wp) => wp.descricao).join(', ')}.`)
    if (notes.length === 0) notes.push('Nenhum desvio local relevante encontrado nos dados atuais.')
    set({ diagnosticNotes: notes })
  },

  // ── Work Package CRUD ──────────────────────────────────────────────

  addWorkPackage: (wp) => {
    const id = crypto.randomUUID()
    const newWp: WorkPackage = { ...wp, id, createdAt: new Date().toISOString() }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      workPackages: [...s.workPackages, newWp],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_wp', type: 'insert', recordId: id, row: workPackageToRow(newWp, orgId, userId), table: 'evm_work_packages' })],
    }))
    void get().flush()
  },

  updateWorkPackage: (id, patch) => {
    set((s) => ({ workPackages: s.workPackages.map((wp) => (wp.id === id ? { ...wp, ...patch } : wp)) }))
    const target = get().workPackages.find((wp) => wp.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = workPackageToRow(target, orgId, userId)
      const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_wp', type: 'update', recordId: id, patch: updatePatch, table: 'evm_work_packages' })] }))
      void get().flush()
    }
  },

  removeWorkPackage: (id) => {
    set((s) => ({
      workPackages: s.workPackages.filter((wp) => wp.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_wp', type: 'delete', recordId: id, table: 'evm_work_packages', approvalActionType: 'delete_evm_work_package' })],
    }))
    void get().flush()
  },

  // ── Cost Account CRUD ──────────────────────────────────────────────

  addCostAccount: (entry) => {
    const id = crypto.randomUUID()
    const newCa: CostAccountEntry = { ...entry, id, totalCostBRL: entry.unitCostBRL * entry.quantity }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      costAccounts: [...s.costAccounts, newCa],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_ca', type: 'insert', recordId: id, row: costAccountToRow(newCa, orgId, userId), table: 'evm_cost_accounts' })],
    }))
    void get().flush()
  },

  updateCostAccount: (id, patch) => {
    set((s) => ({
      costAccounts: s.costAccounts.map((ca) => {
        if (ca.id !== id) return ca
        const updated = { ...ca, ...patch }
        updated.totalCostBRL = updated.unitCostBRL * updated.quantity
        return updated
      }),
    }))
    const target = get().costAccounts.find((ca) => ca.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = costAccountToRow(target, orgId, userId)
      const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_ca', type: 'update', recordId: id, patch: updatePatch, table: 'evm_cost_accounts' })] }))
      void get().flush()
    }
  },

  removeCostAccount: (id) => {
    set((s) => ({
      costAccounts: s.costAccounts.filter((ca) => ca.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_ca', type: 'delete', recordId: id, table: 'evm_cost_accounts', approvalActionType: 'delete_evm_cost_account' })],
    }))
    void get().flush()
  },

  // ── Measurement CRUD ───────────────────────────────────────────────

  addMeasurement: (m) => {
    const id = crypto.randomUUID()
    const newM: WeightedMeasurement = { ...m, id, compositeScore: computeCompositeScore(m) }
    const { orgId, userId } = ctxAuth()
    set((s) => ({
      measurements: [...s.measurements, newM],
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_meas', type: 'insert', recordId: id, row: measurementToRow(newM, orgId, userId), table: 'evm_measurements' })],
    }))
    void get().flush()
  },

  updateMeasurement: (id, patch) => {
    set((s) => ({
      measurements: s.measurements.map((m) => {
        if (m.id !== id) return m
        const updated = { ...m, ...patch }
        updated.compositeScore = computeCompositeScore(updated)
        return updated
      }),
    }))
    const target = get().measurements.find((m) => m.id === id)
    if (target) {
      const { orgId, userId } = ctxAuth()
      const row = measurementToRow(target, orgId, userId)
      const updatePatch = Object.fromEntries(Object.entries(row).filter(([k]) => !['id','organization_id','created_by'].includes(k)))
      set((s) => ({ pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_meas', type: 'update', recordId: id, patch: updatePatch, table: 'evm_measurements' })] }))
      void get().flush()
    }
  },

  removeMeasurement: (id) => {
    set((s) => ({
      measurements: s.measurements.filter((m) => m.id !== id),
      pendingSync: [...s.pendingSync, makeOp({ entity: 'evm_meas', type: 'delete', recordId: id, table: 'evm_measurements', approvalActionType: 'delete_evm_measurement' })],
    }))
    void get().flush()
  },

  // ── Recalculate ────────────────────────────────────────────────────

  recalculateMetrics: () => {
    const financialNucleos = get().nucleos
    if (financialNucleos.length > 0) {
      set({ evmMetrics: computeFinancialPortfolio(financialNucleos) })
      return
    }

    const { costAccounts, evmMetrics } = get()

    // Compute BAC from cost accounts
    const BAC = costAccounts.reduce((sum, ca) => sum + ca.totalCostBRL, 0)

    if (BAC === 0) {
      set({ evmMetrics: { ...EMPTY_METRICS } })
      return
    }

    // Compute AC broken down by pillar
    const pillars: CostPillar[] = ['material', 'equipamento', 'mao_de_obra', 'impostos_indiretos']
    const costBreakdown: CostBreakdown = { material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0 }

    for (const ca of costAccounts) {
      costBreakdown[ca.pillar] += ca.totalCostBRL
    }

    const AC = costBreakdown.material + costBreakdown.equipamento + costBreakdown.mao_de_obra + costBreakdown.impostos_indiretos

    // Scale PV/EV proportionally to the new BAC
    const oldBAC = evmMetrics.BAC || 1
    const scale = BAC / oldBAC
    const PV = evmMetrics.PV * scale
    const EV = evmMetrics.EV * scale

    // Core EVM indices
    const CPI = AC !== 0 ? EV / AC : 0
    const SPI = PV !== 0 ? EV / PV : 0
    const CV = EV - AC
    const SV = EV - PV
    const EAC = CPI !== 0 ? BAC / CPI : 0
    const ETC = EAC - AC
    const VAC = BAC - EAC
    const TCPI = (BAC - AC) !== 0 ? (BAC - EV) / (BAC - AC) : 0

    // Pillar deviations: for each pillar, compare budgeted vs actual
    const budgetedByPillar: Record<CostPillar, number> = { material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0 }
    for (const ca of costAccounts) {
      budgetedByPillar[ca.pillar] += ca.totalCostBRL
    }

    const totalDeviation = pillars.reduce((sum, p) => sum + Math.abs(costBreakdown[p] - budgetedByPillar[p]), 0)

    const pillarDeviations: PillarDeviation[] = pillars.map((p) => {
      const budgeted = budgetedByPillar[p]
      const actual = costBreakdown[p]
      const deviation = actual - budgeted
      const deviationPct = totalDeviation !== 0 ? Math.abs(deviation) / totalDeviation : 0
      return {
        pillar: p,
        label: PILLAR_LABELS[p],
        budgeted,
        actual,
        deviation,
        deviationPct,
      }
    })

    // EAC scenarios
    const eacScenarios: EacScenarios = {
      optimistic: BAC,
      trend: CPI !== 0 ? BAC / CPI : 0,
      pessimistic: CPI !== 0 ? (BAC / CPI) * 1.15 : 0,
    }

    // Health status
    let healthStatus: 'blue' | 'yellow' | 'red'
    if (CPI >= 1 && SPI >= 1) {
      healthStatus = 'blue'
    } else if (SPI < 1 && CPI >= 1) {
      healthStatus = 'yellow'
    } else {
      healthStatus = 'red'
    }

    // Stock alerts — lazy import from suprimentosStore
    import('./suprimentosStore').then(({ useSuprimentosStore }) => {
      const { estoqueItens } = useSuprimentosStore.getState()
      const stockAlerts: StockAlert[] = []

      for (const item of estoqueItens) {
        if (item.qtdDisponivel > item.estoqueMinimo * 2) {
          const qtdComprada = item.qtdDisponivel + item.qtdReservada
          const qtdInstalada = item.qtdReservada
          const qtdImobilizada = item.qtdDisponivel - item.estoqueMinimo
          const custoImobilizado = qtdImobilizada * (item.custoUnitario ?? 0)
          stockAlerts.push({
            itemId: item.id,
            description: item.descricao,
            qtdComprada,
            qtdInstalada,
            qtdImobilizada,
            custoImobilizado,
          })
        }
      }

      set({
        evmMetrics: {
          BAC, PV, EV, AC, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI,
          costBreakdown,
          eacScenarios,
          pillarDeviations,
          stockAlerts,
          healthStatus,
        },
      })
    }).catch(() => {
      // If suprimentos store is unavailable, set metrics without stock alerts
      set({
        evmMetrics: {
          BAC, PV, EV, AC, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI,
          costBreakdown,
          eacScenarios,
          pillarDeviations,
          stockAlerts: [],
          healthStatus,
        },
      })
    })
  },

  // ── Data management ────────────────────────────────────────────────

  loadDemoData: () => {
    import('@/data/mockEvm').then((m) => {
      const financial = buildDemoFinancialModel()
      set({
        workPackages: structuredClone(m.MOCK_WORK_PACKAGES),
        costAccounts: structuredClone(m.MOCK_COST_ACCOUNTS),
        measurements: structuredClone(m.MOCK_MEASUREMENTS),
        evmMetrics: computeFinancialPortfolio(financial.nucleos),
        sCurveData: structuredClone(m.MOCK_SCURVE_DATA),
        contrato: financial.contrato,
        nucleos: financial.nucleos,
        selectedNucleoId: financial.nucleos[0]?.id ?? null,
        measurementTemplates: buildMeasurementTemplates(),
        diagnosticNotes: [],
      })
    })
  },

  clearData: () =>
    set({
      workPackages: [],
      costAccounts: [],
      measurements: [],
      evmMetrics: { ...EMPTY_METRICS },
      sCurveData: [],
      contrato: null,
      nucleos: [],
      selectedNucleoId: null,
      diagnosticNotes: [],
      pendingSync: [],
      syncError: null,
    }),

  flush: async () => {
    const queue = get().pendingSync
    if (queue.length === 0) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
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
    const wps  = await pullTable<{ payload: WorkPackage }>('evm_work_packages')
    const cas  = await pullTable<{ payload: CostAccountEntry }>('evm_cost_accounts')
    const ms   = await pullTable<{ payload: WeightedMeasurement }>('evm_measurements')
    if (wps) set({ workPackages: wps.map((r) => r.payload) })
    if (cas) set({ costAccounts: cas.map((r) => r.payload) })
    if (ms)  set({ measurements: ms.map((r) => r.payload) })
    set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
    // Recomputa metrics localmente após pull
    get().recalculateMetrics()
  },
    }),
    {
      name: 'cdata-evm',
      partialize: (s) => ({
        workPackages: s.workPackages,
        costAccounts: s.costAccounts,
        measurements: s.measurements,
        sCurveData:   s.sCurveData,
        contrato:     s.contrato,
        nucleos:      s.nucleos,
        selectedNucleoId: s.selectedNucleoId,
        measurementTemplates: s.measurementTemplates,
        diagnosticNotes: s.diagnosticNotes,
        pendingSync:  s.pendingSync,
        lastSyncedAt: s.lastSyncedAt,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useEvmStore.getState().flush()
  })

  // Cross-module listeners (Sprint Ontologia Unificada)
  // Quando uma PO é fechada, o trigger SQL insere automaticamente um cost_account.
  // Re-pull aqui para refletir o novo AC no painel EVM.
  void import('@/lib/eventBus').then(({ eventBus }) => {
    eventBus.on('po.closed', () => {
      void useEvmStore.getState().pull().then(() => {
        useEvmStore.getState().recalculateMetrics()
      })
    })
    eventBus.on('realtime.row_changed', (e) => {
      if (e.table === 'evm_cost_accounts' || e.table === 'evm_work_packages') {
        void useEvmStore.getState().pull().then(() => {
          useEvmStore.getState().recalculateMetrics()
        })
      }
    })
  })
}
