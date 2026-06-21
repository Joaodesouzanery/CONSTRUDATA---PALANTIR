import type {
  DemandForecast,
  EconomyBaseline,
  EconomyEvent,
  EconomyEventCategory,
  EconomySourceModule,
  EconomyValuationRule,
  ItemEstoque,
  LpsActivity,
  LpsRestriction,
  MaintenanceOrder,
  PurchaseOrder,
  RDO,
  ThreeWayMatch,
} from '@/types'
import type { GeneratedSubempreiteiroMeasurement } from '@/features/medicao/utils/measurementGeneration'

export interface EconomyInput {
  baselines: EconomyBaseline[]
  existingEvents: EconomyEvent[]
  rules: EconomyValuationRule[]
  purchaseOrders: PurchaseOrder[]
  matches: ThreeWayMatch[]
  forecasts: DemandForecast[]
  estoqueItens: ItemEstoque[]
  lpsActivities: LpsActivity[]
  lpsRestrictions: LpsRestriction[]
  rdos: RDO[]
  maintenanceOrders: MaintenanceOrder[]
  generatedMeasurements?: GeneratedSubempreiteiroMeasurement[]
  evmMetrics?: {
    CPI?: number
    SPI?: number
    CV?: number
    VAC?: number
    healthStatus?: string
  }
}

export function monthPeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7)
}

export function dateToPeriod(date: string): string {
  return date.slice(0, 7) || monthPeriod()
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function brl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export const ECONOMY_CATEGORY_LABELS: Record<EconomyEventCategory, string> = {
  material_waste: 'Desperdicio de material',
  production_stoppage: 'Paralisacao evitada',
  restriction_removed: 'Restricao resolvida',
  equipment_idle: 'Equipamento ocioso',
  management_hours: 'Horas de gestao',
  measurement_discrepancy: 'Divergencia de medicao',
  schedule_alert: 'Alerta de cronograma',
  cost_deviation: 'Desvio de custo',
}

export const ECONOMY_SOURCE_LABELS: Record<EconomySourceModule, string> = {
  suprimentos: 'Suprimentos',
  lps: 'LPS',
  planejamento: 'Planejamento',
  rdo: 'RDO',
  relatorio360: 'Relatorio 360',
  equipamentos: 'Equipamentos',
  medicao: 'Medicao',
  evm: 'EVM',
  manual: 'Manual',
}

/** Deeplink (rota interna) do módulo de origem de cada evento, para rastreabilidade. */
export const ECONOMY_SOURCE_ROUTE: Record<EconomySourceModule, string> = {
  suprimentos: '/app/suprimentos',
  lps: '/app/lps-lean',
  planejamento: '/app/planejamento',
  rdo: '/app/rdo',
  relatorio360: '/app/relatorio-360',
  equipamentos: '/app/gestao-equipamentos',
  medicao: '/app/medicao',
  evm: '/app/evm',
  manual: '',
}

/** Explicação em linguagem de negócio de como cada categoria é valorada (transparência/conservadorismo). */
export function methodologyFor(category: EconomyEventCategory): string {
  switch (category) {
    case 'material_waste':
      return 'Valorado pela diferença confirmada de quantidade/preço no three-way match, ou pelo prêmio de compra emergencial evitado. Usa apenas o delta confirmado.'
    case 'production_stoppage':
      return 'Custo de equipe parada (trabalhadores × custo/dia × dias evitados). Registros de RDO ficam zerados até validação humana, para não superestimar.'
    case 'restriction_removed':
      return 'Probabilidade de virar atraso × custo de um dia de parada × dias antecipados, com probabilidade conservadora.'
    case 'equipment_idle':
      return 'Custo diário do equipamento × dias de ociosidade evitados, a partir do uso registrado no RDO/manutenção.'
    case 'management_hours':
      return 'Horas de consolidação manual substituídas por automação × custo-hora do gestor (baseline vs. tempo atual).'
    case 'measurement_discrepancy':
      return 'Valor afetado × fator conservador de erro de medição, identificado antes do fechamento/NF para evitar glosa.'
    case 'schedule_alert':
      return 'Indicador operacional (PPC). Sem valor financeiro direto, para evitar dupla contagem.'
    case 'cost_deviation':
      return 'Desvio financeiro (CPI/SPI) × fator conservador, sinalizado em tempo real para ação preventiva.'
    default:
      return 'Cálculo conservador a partir de dados operacionais auditáveis.'
  }
}

/** Série mensal de economia validada (últimos N meses), para a tendência do painel. */
export function monthlySeries(
  events: EconomyEvent[],
  months = 6,
  reference = new Date(),
): Array<{ period: string; validatedBRL: number }> {
  const out: Array<{ period: string; validatedBRL: number }> = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth() - i, 1)
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const validatedBRL = events
      .filter((event) => event.period === period && (event.status === 'validated' || event.status === 'reported'))
      .reduce((sum, event) => sum + Math.max(0, event.impactBRL), 0)
    out.push({ period, validatedBRL })
  }
  return out
}

export function defaultEconomyBaseline(projectName = 'Carteira de obras'): EconomyBaseline {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    projectId: null,
    projectName,
    capturedAt: todayIso(),
    period: monthPeriod(),
    ppcPercent: 54,
    materialDeviationPercent: 8,
    manualReportHoursPerWeek: 6,
    stoppagesLastQuarter: 4,
    workersCount: 80,
    costPerPersonDayBRL: 160,
    materialMonthlyBudgetBRL: 300000,
    targetMaterialDeviationPercent: 3,
    platformMonthlyFeeBRL: 5000,
    managerHourlyCostBRL: 120,
    equipmentDailyCostBRL: 1200,
    manualMeasurementHoursPerSub: 8,
    automatedMeasurementHoursPerSub: 1.5,
    baselineMeasurementErrorRatePercent: 2,
    costOfCapitalMonthlyPercent: 1.2,
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function defaultEconomyRules(): EconomyValuationRule[] {
  const updatedAt = new Date().toISOString()
  return [
    {
      id: '00000000-0000-4000-8000-000000000101',
      category: 'production_stoppage',
      label: 'Paralisacao evitada',
      formula: 'trabalhadores * custoDiaPessoa * diasImpacto + custoEquipamentosOpcional',
      assumptions: { diasImpacto: 2, custoEquipamentosOpcional: 0 },
      enabled: true,
      updatedAt,
    },
    {
      id: '00000000-0000-4000-8000-000000000102',
      category: 'material_waste',
      label: 'Material economizado',
      formula: '(desvioAntes - desvioAtualOuMeta) * orcamentoMensalMaterial',
      assumptions: { emergencyMarkupPct: 0.12 },
      enabled: true,
      updatedAt,
    },
    {
      id: '00000000-0000-4000-8000-000000000103',
      category: 'restriction_removed',
      label: 'Restricao resolvida antes do atraso',
      formula: 'probabilidadeImpacto * custoDiaParada * diasEvitados',
      assumptions: { probabilidadeImpacto: 0.35, diasEvitados: 1 },
      enabled: true,
      updatedAt,
    },
    {
      id: '00000000-0000-4000-8000-000000000104',
      category: 'equipment_idle',
      label: 'Ociosidade de equipamento evitada',
      formula: 'diasOciososEvitados * custoDiarioEquipamento',
      assumptions: { diasOciososEvitados: 1 },
      enabled: true,
      updatedAt,
    },
    {
      id: '00000000-0000-4000-8000-000000000105',
      category: 'management_hours',
      label: 'Horas de gestao recuperadas',
      formula: '(horasBaseline - horasAtuais) * custoHoraGestor * 4.33',
      assumptions: { horasAtuais: 0.5 },
      enabled: true,
      updatedAt,
    },
    {
      id: '00000000-0000-4000-8000-000000000106',
      category: 'measurement_discrepancy',
      label: 'Divergencia de medicao evitada',
      formula: 'valorAfetado * fatorConservadorDeErro',
      assumptions: { fatorConservadorDeErro: 0.02 },
      enabled: true,
      updatedAt,
    },
  ]
}

export function summarizeEconomy(events: EconomyEvent[], baselines: EconomyBaseline[], period: string, projectId?: string | null) {
  const filtered = events.filter((event) =>
    event.period === period &&
    (projectId === undefined || event.projectId === projectId) &&
    event.status !== 'dismissed',
  )
  const baseline = baselines.find((item) => (projectId === undefined ? true : item.projectId === projectId)) ?? baselines[0]
  const validated = filtered.filter((event) => event.status === 'validated' || event.status === 'reported')
  const avoidedLossBRL = validated.reduce((sum, event) => sum + Math.max(0, event.impactBRL), 0)
  const estimatedPipelineBRL = filtered
    .filter((event) => event.status === 'detected')
    .reduce((sum, event) => sum + Math.max(0, event.impactBRL), 0)
  const platformFeeBRL = baseline?.platformMonthlyFeeBRL ?? 5000
  const roiPercent = platformFeeBRL > 0 ? ((avoidedLossBRL - platformFeeBRL) / platformFeeBRL) * 100 : 0

  return {
    events: filtered,
    baseline,
    detectedEvents: filtered.length,
    validatedEvents: validated.length,
    avoidedLossBRL,
    estimatedPipelineBRL,
    platformFeeBRL,
    roiPercent,
    paybackRatio: platformFeeBRL > 0 ? avoidedLossBRL / platformFeeBRL : 0,
  }
}

export function generateEconomyEvents(input: EconomyInput): EconomyEvent[] {
  const existingByKey = new Map(input.existingEvents.map((event) => [event.stableKey, event]))
  const baseline = input.baselines[0] ?? defaultEconomyBaseline()
  const generated: EconomyEvent[] = []

  const push = (draft: Omit<EconomyEvent, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: EconomyEvent['status'] }) => {
    const stableKey = draft.stableKey
    const existing = existingByKey.get(stableKey)
    const now = new Date().toISOString()
    generated.push({
      ...draft,
      id: existing?.id ?? crypto.randomUUID(),
      impactBRL: roundMoney(existing && existing.status !== 'detected' ? existing.impactBRL : draft.impactBRL),
      assumptions: existing && existing.status !== 'detected' ? existing.assumptions : draft.assumptions,
      evidence: existing?.evidence?.length ? existing.evidence : draft.evidence,
      status: existing?.status ?? draft.status ?? 'detected',
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing?.updatedAt ?? now,
      validatedAt: existing?.validatedAt,
      reportedAt: existing?.reportedAt,
    })
  }

  collectSupplyEvents(input, baseline, push)
  collectLpsEvents(input, baseline, push)
  collectRdoEvents(input, baseline, push)
  collectEquipmentEvents(input, baseline, push)
  collectEvmEvents(input, baseline, push)
  collectMeasurementEvents(input, baseline, push)
  collectManagementHoursEvent(input, baseline, push)

  return generated.sort((a, b) => b.date.localeCompare(a.date) || b.impactBRL - a.impactBRL)
}

function collectSupplyEvents(input: EconomyInput, baseline: EconomyBaseline, push: (event: EventDraft) => void) {
  const poById = new Map(input.purchaseOrders.map((po) => [po.id, po]))
  for (const match of input.matches) {
    if (match.status !== 'discrepancy' && match.status !== 'partial') continue
    const po = poById.get(match.poId)
    const date = match.matchedAt?.slice(0, 10) ?? todayIso()
    const period = dateToPeriod(date)
    for (const discrepancy of match.discrepancies) {
      const item = po?.items.find((poItem) => poItem.id === discrepancy.itemId)
      const unitPrice = item?.unitPrice ?? 0
      const quantity = item?.quantity ?? Math.abs(discrepancy.delta)
      const impact = discrepancy.field === 'price'
        ? Math.abs(discrepancy.delta) * quantity
        : Math.abs(discrepancy.delta) * unitPrice
      push({
        stableKey: makeStableKey('suprimentos', `${match.id}-${discrepancy.itemId}-${discrepancy.field}`, 'material_waste', period),
        sourceModule: 'suprimentos',
        sourceId: match.id,
        category: 'material_waste',
        projectId: null,
        projectName: po?.projectRef || baseline.projectName,
        date,
        period,
        title: 'Divergencia de material detectada',
        description: `${item?.description ?? 'Item'} com diferenca de ${Math.abs(discrepancy.deltaPercent).toFixed(1)}% no three-way match.`,
        impactBRL: impact,
        formula: 'deltaQuantidadeOuPreco * valorUnitarioOuQuantidade',
        assumptions: { delta: discrepancy.delta, deltaPercent: discrepancy.deltaPercent, unitPrice, quantity },
        confidence: Math.abs(discrepancy.deltaPercent) >= 5 ? 'high' : 'medium',
        evidence: [
          { label: 'PO', value: po?.code ?? match.poId },
          { label: 'Campo', value: discrepancy.field },
          { label: 'Delta', value: `${discrepancy.deltaPercent}%` },
        ],
      })
    }
  }

  for (const item of input.estoqueItens) {
    const available = item.qtdDisponivel + item.qtdTransito - item.qtdReservada
    const deficit = item.estoqueMinimo - available
    if (deficit <= 0) continue
    const period = monthPeriod()
    const emergencyMarkupPct = 0.12
    push({
      stableKey: makeStableKey('suprimentos', `stock-${item.id}`, 'material_waste', period),
      sourceModule: 'suprimentos',
      sourceId: item.id,
      category: 'material_waste',
      projectId: null,
      projectName: baseline.projectName,
      date: todayIso(),
      period,
      title: 'Risco de ruptura de estoque mitigavel',
      description: `${item.descricao} abaixo do minimo em ${deficit.toLocaleString('pt-BR')} ${item.unidade}.`,
      impactBRL: deficit * (item.custoUnitario ?? 0) * emergencyMarkupPct,
      formula: 'deficit * custoUnitario * markupEmergencial',
      assumptions: { deficit, custoUnitario: item.custoUnitario ?? 0, emergencyMarkupPct },
      confidence: item.custoUnitario ? 'medium' : 'low',
      evidence: [
        { label: 'Disponivel liquido', value: String(available) },
        { label: 'Estoque minimo', value: String(item.estoqueMinimo) },
      ],
    })
  }

  for (const forecast of input.forecasts) {
    if (forecast.status !== 'ordered') continue
    const date = forecast.suggestedOrderDate || todayIso()
    const period = dateToPeriod(date)
    push({
      stableKey: makeStableKey('suprimentos', `forecast-${forecast.id}`, 'material_waste', period),
      sourceModule: 'suprimentos',
      sourceId: forecast.id,
      category: 'material_waste',
      projectId: null,
      projectName: forecast.relatedPhase || baseline.projectName,
      date,
      period,
      title: 'Compra preventiva acionada por previsao de demanda',
      description: `${forecast.materialCategory} pedido antes de virar reposicao emergencial.`,
      impactBRL: forecast.estimatedValue * 0.08,
      formula: 'valorEstimado * premioEmergencialEvitado',
      assumptions: { valorEstimado: forecast.estimatedValue, premioEmergencialEvitado: 0.08 },
      confidence: 'medium',
      evidence: [
        { label: 'Quantidade', value: `${forecast.estimatedQty} ${forecast.unit}` },
        { label: 'Valor previsto', value: brl(forecast.estimatedValue) },
      ],
    })
  }
}

function collectLpsEvents(input: EconomyInput, baseline: EconomyBaseline, push: (event: EventDraft) => void) {
  const costDay = baseline.workersCount * baseline.costPerPersonDayBRL
  for (const restriction of input.lpsRestrictions) {
    if (restriction.status !== 'resolvida') continue
    const date = restriction.resolvedAt?.slice(0, 10) ?? todayIso()
    const period = dateToPeriod(date)
    const daysSaved = daysBetween(date, restriction.prazoRemocao ?? date) >= 0
      ? Math.max(1, Math.min(5, daysBetween(date, restriction.prazoRemocao ?? date) + 1))
      : 1
    const probability = 0.35
    push({
      stableKey: makeStableKey('lps', restriction.id, 'restriction_removed', period),
      sourceModule: 'lps',
      sourceId: restriction.id,
      category: 'restriction_removed',
      projectId: null,
      projectName: restriction.obraProjeto || restriction.nucleo || baseline.projectName,
      date,
      period,
      title: 'Restricao resolvida antes de virar atraso',
      description: restriction.tema || restriction.descricao || 'Restricao LPS removida no prazo.',
      impactBRL: probability * costDay * daysSaved,
      formula: 'probabilidadeImpacto * custoDiaParada * diasEvitados',
      assumptions: { probabilidadeImpacto: probability, custoDiaParada: costDay, diasEvitados: daysSaved },
      confidence: restriction.prazoRemocao ? 'high' : 'medium',
      evidence: [
        { label: 'Responsavel', value: restriction.responsavel ?? '-' },
        { label: 'Prazo', value: restriction.prazoRemocao ?? '-' },
      ],
    })
  }

  for (const ppc of computeWeeklyPpc(input.lpsActivities)) {
    if (ppc.ppc >= 60) continue
    push({
      stableKey: makeStableKey('lps', `ppc-${ppc.week}`, 'schedule_alert', ppc.week),
      sourceModule: 'lps',
      sourceId: ppc.week,
      category: 'schedule_alert',
      projectId: null,
      projectName: baseline.projectName,
      date: todayIso(),
      period: monthPeriod(),
      title: 'PPC abaixo de 60%',
      description: `Plano semanal com PPC ${ppc.ppc}% (${ppc.completed}/${ppc.planned}). Evento sem valor financeiro direto para evitar dupla contagem.`,
      impactBRL: 0,
      formula: 'indicador operacional, sem R$ direto',
      assumptions: { ppc: ppc.ppc, planned: ppc.planned, completed: ppc.completed },
      confidence: 'high',
      evidence: [{ label: 'Semana', value: ppc.week }],
    })
  }
}

function collectRdoEvents(input: EconomyInput, baseline: EconomyBaseline, push: (event: EventDraft) => void) {
  for (const rdo of input.rdos) {
    const period = dateToPeriod(rdo.date)
    for (const [index, stoppage] of (rdo.stoppages ?? []).entries()) {
      push({
        stableKey: makeStableKey('rdo', `${rdo.id}-stoppage-${index}`, 'production_stoppage', period),
        sourceModule: 'rdo',
        sourceId: rdo.id,
        category: 'production_stoppage',
        projectId: (rdo as { projectId?: string | null }).projectId ?? null,
        projectName: rdo.local || baseline.projectName,
        date: rdo.date,
        period,
        title: 'Paralisacao registrada no RDO',
        description: `${stoppage.reason}. Evento registrado para evidenciar causa raiz; valor fica zerado ate validacao humana.`,
        impactBRL: 0,
        formula: 'validacao humana necessaria',
        assumptions: { trabalhadores: baseline.workersCount, custoDiaPessoa: baseline.costPerPersonDayBRL },
        confidence: 'medium',
        evidence: [
          { label: 'Periodo', value: stoppage.period },
          { label: 'Horario', value: `${stoppage.start}-${stoppage.end}` },
        ],
      })
    }

    for (const equipment of rdo.equipment) {
      if (equipment.quantity <= 0 || equipment.hours > 1) continue
      push({
        stableKey: makeStableKey('rdo', `${rdo.id}-idle-${equipment.id}`, 'equipment_idle', period),
        sourceModule: 'rdo',
        sourceId: rdo.id,
        category: 'equipment_idle',
        projectId: (rdo as { projectId?: string | null }).projectId ?? null,
        projectName: rdo.local || baseline.projectName,
        date: rdo.date,
        period,
        title: 'Equipamento ocioso registrado no RDO',
        description: `${equipment.name} com ${equipment.hours}h de uso no dia.`,
        impactBRL: baseline.equipmentDailyCostBRL * equipment.quantity,
        formula: 'diasOciososEvitados * custoDiarioEquipamento * quantidade',
        assumptions: { diasOciososEvitados: 1, custoDiarioEquipamento: baseline.equipmentDailyCostBRL, quantidade: equipment.quantity },
        confidence: 'medium',
        evidence: [{ label: 'Equipamento', value: equipment.name }],
      })
    }
  }
}

function collectEquipmentEvents(input: EconomyInput, baseline: EconomyBaseline, push: (event: EventDraft) => void) {
  const today = todayIso()
  for (const order of input.maintenanceOrders) {
    if (order.status === 'completed' || order.status === 'cancelled') continue
    if (order.scheduledDate >= today) continue
    const period = dateToPeriod(today)
    push({
      stableKey: makeStableKey('equipamentos', `maintenance-${order.id}`, 'equipment_idle', period),
      sourceModule: 'equipamentos',
      sourceId: order.id,
      category: 'equipment_idle',
      projectId: null,
      projectName: baseline.projectName,
      date: today,
      period,
      title: 'Manutencao vencida com risco de parada',
      description: order.description,
      impactBRL: Math.max(baseline.equipmentDailyCostBRL, order.estimatedCost * 0.25),
      formula: 'max(custoDiarioEquipamento, custoEstimadoManutencao * 25%)',
      assumptions: { custoDiarioEquipamento: baseline.equipmentDailyCostBRL, estimatedCost: order.estimatedCost },
      confidence: 'medium',
      evidence: [
        { label: 'Equipamento', value: order.equipmentId },
        { label: 'Data prevista', value: order.scheduledDate },
      ],
    })
  }
}

function collectEvmEvents(input: EconomyInput, baseline: EconomyBaseline, push: (event: EventDraft) => void) {
  const metrics = input.evmMetrics
  if (!metrics) return
  const cpi = metrics.CPI ?? 1
  const spi = metrics.SPI ?? 1
  if (cpi >= 0.9 && spi >= 0.9) return
  const period = monthPeriod()
  const deviation = Math.abs(metrics.CV ?? metrics.VAC ?? 0)
  push({
    stableKey: makeStableKey('evm', `evm-${period}`, 'cost_deviation', period),
    sourceModule: 'evm',
    sourceId: `evm-${period}`,
    category: 'cost_deviation',
    projectId: null,
    projectName: baseline.projectName,
    date: todayIso(),
    period,
    title: 'Desvio financeiro detectado em tempo real',
    description: `CPI ${cpi.toFixed(2)} e SPI ${spi.toFixed(2)} indicam necessidade de acao preventiva.`,
    impactBRL: deviation * 0.1,
    formula: 'desvioFinanceiro * fatorConservador10%',
    assumptions: { CPI: cpi, SPI: spi, desvioFinanceiro: deviation, fatorConservador: 0.1 },
    confidence: deviation > 0 ? 'medium' : 'low',
    evidence: [
      { label: 'CPI', value: cpi.toFixed(2) },
      { label: 'SPI', value: spi.toFixed(2) },
    ],
  })
}

function collectMeasurementEvents(input: EconomyInput, baseline: EconomyBaseline, push: (event: EventDraft) => void) {
  const measurements = input.generatedMeasurements ?? []
  if (!measurements.length) return

  const periodGroups = new Map<string, GeneratedSubempreiteiroMeasurement[]>()
  for (const measurement of measurements) {
    const period = normalizeMeasurementPeriod(measurement.periodLabel)
    const list = periodGroups.get(period) ?? []
    list.push(measurement)
    periodGroups.set(period, list)

    const discrepancyValue = measurement.exceptions
      .filter((exception) => ['missing_n_preco', 'missing_unit_price', 'blocked_quality', 'closing_divergence'].includes(exception.code))
      .reduce((sum, exception) => sum + Math.abs(exception.valueBRL ?? measurement.economy.netPreviewBRL * 0.02), 0)
    if (discrepancyValue > 0) {
      push({
        stableKey: makeStableKey('medicao', `${measurement.key}-discrepancy`, 'measurement_discrepancy', period),
        sourceModule: 'medicao',
        sourceId: measurement.key,
        category: 'measurement_discrepancy',
        projectId: null,
        projectName: measurement.nucleo || baseline.projectName,
        date: todayIso(),
        period,
        title: 'Divergencia de medicao detectada antes do fechamento',
        description: `${measurement.contractorName} com ${measurement.exceptions.length} ponto(s) de conferencia antes da NF.`,
        impactBRL: discrepancyValue,
        formula: 'valorAfetadoOuEstimado * fatorConservadorDeErro',
        assumptions: {
          valorLiquidoPrevisto: measurement.economy.netPreviewBRL,
          fatorConservadorDeErro: baseline.baselineMeasurementErrorRatePercent ?? 2,
          pendenciasCriticas: measurement.economy.pendingCriticalCount,
        },
        confidence: measurement.economy.pendingCriticalCount > 0 ? 'high' : 'medium',
        evidence: [
          { label: 'Empreiteiro', value: measurement.contractorName },
          { label: 'Nucleo', value: measurement.nucleo },
          { label: 'Linhas de memoria', value: String(measurement.memoryLines.length) },
        ],
      })
    }

    if (measurement.economy.evidenceCoveragePercent >= 80 && measurement.memoryLines.length > 0) {
      push({
        stableKey: makeStableKey('medicao', `${measurement.key}-evidence`, 'measurement_discrepancy', period),
        sourceModule: 'medicao',
        sourceId: measurement.key,
        category: 'measurement_discrepancy',
        projectId: null,
        projectName: measurement.nucleo || baseline.projectName,
        date: todayIso(),
        period,
        title: 'Medição com evidencia rastreavel',
        description: `${measurement.economy.evidenceCoveragePercent}% das linhas de ${measurement.contractorName} possuem RDO, fonte ou evidencia vinculada.`,
        impactBRL: 0,
        formula: 'indicador de auditoria, sem R$ direto para evitar dupla contagem',
        assumptions: { evidenceCoveragePercent: measurement.economy.evidenceCoveragePercent },
        confidence: 'high',
        evidence: [{ label: 'Cobertura', value: `${measurement.economy.evidenceCoveragePercent}%` }],
      })
    }
  }

  for (const [period, list] of periodGroups) {
    const manualHours = baseline.manualMeasurementHoursPerSub ?? 8
    const automatedHours = baseline.automatedMeasurementHoursPerSub ?? 1.5
    const savedHours = Math.max(0, manualHours - automatedHours) * list.length
    if (savedHours <= 0) continue
    push({
      stableKey: makeStableKey('medicao', `measurement-hours-${period}`, 'management_hours', period),
      sourceModule: 'medicao',
      sourceId: `measurement-hours-${period}`,
      category: 'management_hours',
      projectId: baseline.projectId,
      projectName: baseline.projectName,
      date: todayIso(),
      period,
      title: 'Horas de medicao recuperadas',
      description: `${list.length} pacote(s) de subempreiteiro gerados automaticamente a partir de fontes auditaveis.`,
      impactBRL: savedHours * baseline.managerHourlyCostBRL,
      formula: '(horasManuaisPorSub - horasAutomatizadasPorSub) * subempreiteiros * custoHoraGestor',
      assumptions: {
        horasManuaisPorSub: manualHours,
        horasAutomatizadasPorSub: automatedHours,
        subempreiteiros: list.length,
        custoHoraGestor: baseline.managerHourlyCostBRL,
      },
      confidence: list.some((measurement) => measurement.economy.autoGeneratedLines > 0) ? 'high' : 'medium',
      evidence: [
        { label: 'Pacotes', value: String(list.length) },
        { label: 'Linhas automaticas', value: String(list.reduce((sum, measurement) => sum + measurement.economy.autoGeneratedLines, 0)) },
      ],
    })
  }
}

function collectManagementHoursEvent(input: EconomyInput, baseline: EconomyBaseline, push: (event: EventDraft) => void) {
  if (!input.rdos.length && !input.matches.length && !input.lpsActivities.length) return
  const period = monthPeriod()
  const hoursNow = input.rules.find((rule) => rule.category === 'management_hours')?.assumptions.horasAtuais ?? 0.5
  const savedHours = Math.max(0, baseline.manualReportHoursPerWeek - hoursNow)
  if (savedHours <= 0) return
  push({
    stableKey: makeStableKey('manual', `management-hours-${period}`, 'management_hours', period),
    sourceModule: 'manual',
    sourceId: `management-hours-${period}`,
    category: 'management_hours',
    projectId: baseline.projectId,
    projectName: baseline.projectName,
    date: todayIso(),
    period,
    title: 'Horas de gestao recuperadas',
    description: 'Reducao estimada do tempo gasto em consolidacao manual de relatorios.',
    impactBRL: savedHours * baseline.managerHourlyCostBRL * 4.33,
    formula: '(horasBaseline - horasAtuais) * custoHoraGestor * 4.33',
    assumptions: { horasBaseline: baseline.manualReportHoursPerWeek, horasAtuais: hoursNow, custoHoraGestor: baseline.managerHourlyCostBRL },
    confidence: 'medium',
    evidence: [{ label: 'Baseline', value: `${baseline.manualReportHoursPerWeek}h/sem` }],
  })
}

type EventDraft = Omit<EconomyEvent, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: EconomyEvent['status'] }

function makeStableKey(source: EconomySourceModule, sourceId: string, category: EconomyEventCategory, period: string): string {
  return `${source}:${sourceId}:${category}:${period}`
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
}

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`).getTime()
  const b = new Date(`${end}T00:00:00`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.round((b - a) / 86400000)
}

/** PPC (%) da semana mais recente com plano — usado como "depois" no antes/depois. */
export function latestPpc(activities: LpsActivity[]): number {
  const weeks = computeWeeklyPpc(activities)
  const latest = [...weeks].sort((a, b) => b.week.localeCompare(a.week))[0]
  return latest ? latest.ppc : 0
}

export function computeWeeklyPpc(activities: LpsActivity[]) {
  const map = new Map<string, { planned: number; completed: number }>()
  for (const activity of activities) {
    if (!activity.planned) continue
    const row = map.get(activity.week) ?? { planned: 0, completed: 0 }
    row.planned += 1
    if (activity.completed) row.completed += 1
    map.set(activity.week, row)
  }
  return Array.from(map.entries()).map(([week, row]) => ({
    week,
    planned: row.planned,
    completed: row.completed,
    ppc: row.planned > 0 ? Math.round((row.completed / row.planned) * 100) : 0,
  }))
}

function normalizeMeasurementPeriod(periodLabel: string): string {
  const monthMap: Record<string, string> = {
    jan: '01',
    fev: '02',
    mar: '03',
    abr: '04',
    mai: '05',
    jun: '06',
    jul: '07',
    ago: '08',
    set: '09',
    out: '10',
    nov: '11',
    dez: '12',
  }
  const lower = periodLabel.toLowerCase().trim()
  const match = lower.match(/([a-z]{3})\D?(\d{2,4})/)
  if (!match) return monthPeriod()
  const month = monthMap[match[1]]
  if (!month) return monthPeriod()
  const year = match[2].length === 2 ? `20${match[2]}` : match[2]
  return `${year}-${month}`
}
