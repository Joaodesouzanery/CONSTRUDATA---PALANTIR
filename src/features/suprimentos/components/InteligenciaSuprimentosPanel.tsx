import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Network,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useMedicaoStore } from '@/store/medicaoStore'
import { useRdoStore } from '@/store/rdoStore'
import { useEvmStore } from '@/store/evmStore'
import { useProjetosStore } from '@/store/projetosStore'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { useBimStore } from '@/store/bimStore'
import type { FrameworkAgreement, ItemEstoque, PlanTrecho } from '@/types'
import type { ConsolidadoTrecho, MaterialItem, ResumoNucleo } from '@/data/mockPlanilhasConsolidadas'

const MS_PER_DAY = 86_400_000
const FEEDING_MODULES = [
  'Planilhas Consolidadas/Suprimentos',
  'Planejamento Mestre',
  'LPS/Lookahead',
  'Quantitativos/BIM',
  'Medição',
  'RDO',
  'Almoxarifado',
  'Financeiro/EVM',
  'Projetos/Núcleos',
  'Qualidade',
]

type RiskLevel = 'ok' | 'attention' | 'critical'

interface AuditTrail {
  source: string
  rule: string
  updatedAt: string
  modules: string[]
}

interface IntelligenceDemand {
  id: string
  nucleo: string
  local: string
  activityName: string
  material: string
  category: string
  unit: string
  requiredQty: number
  plannedDate: string
  executedQty?: number
  audit: AuditTrail
}

interface AuditedRecommendation {
  id: string
  demandId: string
  nucleo: string
  local: string
  material: string
  category: string
  unit: string
  requiredQty: number
  availableQty: number
  reservedQty: number
  inTransitQty: number
  missingQty: number
  suggestedOrderQty: number
  suggestedOrderDate: string
  neededBy: string
  leadTimeDays: number
  preferredSupplier?: string
  estimatedValue: number
  risk: RiskLevel
  reason: string
  audit: AuditTrail
}

const RISK_META: Record<RiskLevel, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  ok: { label: 'OK', icon: CheckCircle2, cls: 'bg-[#16a34a]/15 text-[#4ade80] border-[#16a34a]/30' },
  attention: { label: 'Atenção', icon: Clock, cls: 'bg-[#ca8a04]/15 text-[#fbbf24] border-[#ca8a04]/30' },
  critical: { label: 'Crítico', icon: AlertTriangle, cls: 'bg-[#dc2626]/15 text-[#f87171] border-[#dc2626]/30' },
}

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function safeDateIso(value: string | null | undefined, fallbackIso: string) {
  if (!value) return fallbackIso
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/')
    return `${year}-${month}-${day}`
  }
  return fallbackIso
}

function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / MS_PER_DAY)
}

function toCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatQty(qty: number, unit: string) {
  return `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unit}`
}

function parseMetragem(value: string | null | undefined) {
  if (!value) return 0
  const parsed = Number(value.replace(/[^\d.,-]/g, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

function inferMaterial(trecho: Pick<PlanTrecho, 'description' | 'diameterMm' | 'activityType' | 'requiresShoring'>) {
  const desc = normalize(`${trecho.description} ${trecho.activityType ?? ''}`)
  const dn = trecho.diameterMm ? ` DN ${trecho.diameterMm}` : ''

  if (desc.includes('pv') || desc.includes('poco') || desc.includes('visita')) {
    return { material: `Anéis e tampão de PV${dn}`, category: 'Civil / PV', unit: 'un' }
  }
  if (desc.includes('esgoto')) {
    return { material: `Tubo PVC esgoto${dn}`, category: 'Tubulação e Saneamento', unit: 'm' }
  }
  if (desc.includes('agua') || desc.includes('adutora') || desc.includes('rede')) {
    return { material: `Tubo PEAD/PVC água${dn}`, category: 'Tubulação e Saneamento', unit: 'm' }
  }
  if (trecho.requiresShoring || desc.includes('escav')) {
    return { material: 'Escoramento e material de vala', category: 'Escavação', unit: 'm' }
  }
  return { material: 'Material operacional de frente', category: 'Operacional', unit: 'lote' }
}

function materialCategory(item: MaterialItem) {
  const text = normalize(`${item.material} ${item.rede}`)
  if (text.includes('tubo') || text.includes('pvc') || text.includes('pead')) return 'Tubulacao e Saneamento'
  if (text.includes('pv') || text.includes('poco') || text.includes('tampao')) return 'Civil / PV'
  if (text.includes('registro') || text.includes('valvula')) return 'Hidraulica'
  return item.rede || 'Material operacional'
}

function bestAgreement(category: string, agreements: FrameworkAgreement[]) {
  const wanted = normalize(category)
  return agreements
    .filter((fa) => fa.status !== 'expired')
    .find((fa) => normalize(fa.category).includes(wanted) || wanted.includes(normalize(fa.category)))
}

function inventoryFor(material: string, items: ItemEstoque[]) {
  const wanted = normalize(material)
  const firstToken = wanted.split(' ').find(Boolean) ?? wanted
  const matches = items.filter((item) => {
    const text = normalize(`${item.descricao} ${item.categoria ?? ''}`)
    return wanted.includes(text) || text.includes(wanted) || text.includes(firstToken)
  })
  return matches.reduce(
    (acc, item) => ({
      available: acc.available + item.qtdDisponivel,
      reserved: acc.reserved + item.qtdReservada,
      transit: acc.transit + item.qtdTransito,
      unitCost: acc.unitCost || item.custoUnitario || 0,
      supplier: acc.supplier || item.fornecedorPrincipal,
    }),
    { available: 0, reserved: 0, transit: 0, unitCost: 0, supplier: undefined as string | undefined },
  )
}

function orderTransitFor(material: string, orders: ReturnType<typeof useSuprimentosStore.getState>['purchaseOrders']) {
  const wanted = normalize(material)
  const firstToken = wanted.split(' ').find(Boolean) ?? wanted
  return orders
    .filter((po) => po.status === 'open' || po.status === 'partial')
    .flatMap((po) => po.items)
    .filter((item) => {
      const text = normalize(item.description)
      return wanted.includes(text) || text.includes(wanted) || text.includes(firstToken)
    })
    .reduce((sum, item) => sum + item.quantity, 0)
}

function buildPlanilhaDemands(
  materiais: ReturnType<typeof useSuprimentosStore.getState>['planilhaMateriais'],
  trechos: ConsolidadoTrecho[],
  resumo: ResumoNucleo[],
  todayIso: string,
  updatedAt: string,
): IntelligenceDemand[] {
  const resumoByNucleo = new Map(resumo.map((item) => [normalize(item.nucleo), item]))
  const pendingByLocation = new Map<string, number>()

  for (const trecho of trechos) {
    if (trecho.status !== 'PENDENTE') continue
    const key = `${normalize(trecho.nucleo)}|${normalize(trecho.rua)}`
    pendingByLocation.set(key, (pendingByLocation.get(key) ?? 0) + trecho.extM)
  }

  return materiais.flatMap((nucleo) => {
    const nucleoSummary = resumoByNucleo.get(normalize(nucleo.nucleo))
    const urgencyDays = nucleoSummary && (nucleoSummary.pctExec < 35 || nucleoSummary.kmPend > 2) ? 5 : 10
    return nucleo.ruas.flatMap((rua) =>
      rua.items
        .filter((item) => !item.isSubItem && item.qtd > 0)
        .map((item, index) => {
          const pendingM = pendingByLocation.get(`${normalize(nucleo.nucleo)}|${normalize(rua.rua)}`) ?? parseMetragem(item.metragem)
          const requiredQty = Math.max(item.qtd, pendingM && normalize(item.un).startsWith('m') ? pendingM : 0)
          return {
            id: `planilha-${normalize(nucleo.nucleo)}-${normalize(rua.rua)}-${index}`,
            nucleo: nucleo.nucleo,
            local: rua.rua,
            activityName: `${item.rede || 'Rede'} pendente - ${rua.rua}`,
            material: item.material,
            category: materialCategory(item),
            unit: item.un || 'un',
            requiredQty,
            plannedDate: addDaysIso(todayIso, urgencyDays),
            executedQty: item.kmExec,
            audit: {
              source: 'Planilhas Consolidadas/Suprimentos',
              rule: 'Itens da aba Materiais Pendentes viram demandas; status pendente do Consolidado e km pendente do Resumo ajustam urgência.',
              updatedAt,
              modules: ['Planilhas Consolidadas/Suprimentos', 'Medição', 'Projetos/Núcleos', 'Almoxarifado'],
            },
          }
        }),
    )
  })
}

function buildPlanningDemands(
  trechos: PlanTrecho[],
  nuclei: ReturnType<typeof usePlanejamentoStore.getState>['nuclei'],
  todayIso: string,
): IntelligenceDemand[] {
  const byNucleus = new Map(nuclei.map((n) => [n.id, n.name]))
  return trechos
    .filter((t) => t.executionStatus !== 'completed')
    .slice(0, 18)
    .map((t) => {
      const inferred = inferMaterial(t)
      const requiredQty = inferred.unit === 'un'
        ? Math.max(1, Math.round(t.lengthM / 35))
        : Math.max(1, Math.round((t.lengthM - (t.executedMeters ?? 0)) * 10) / 10)
      return {
        id: `plan-${t.id}`,
        nucleo: t.nucleusId ? byNucleus.get(t.nucleusId) ?? t.nucleusId : 'Geral',
        local: t.code,
        activityName: t.description,
        material: inferred.material,
        category: inferred.category,
        unit: inferred.unit,
        requiredQty,
        plannedDate: safeDateIso(t.plannedStartDate, addDaysIso(todayIso, 14)),
        executedQty: t.executedMeters ?? 0,
        audit: {
          source: 'Planejamento Mestre',
          rule: 'Trechos não concluídos geram demanda pelo comprimento ainda não executado e pelo DN/tipo da atividade.',
          updatedAt: todayIso,
          modules: ['Planejamento Mestre', 'LPS/Lookahead', 'Quantitativos/BIM', 'Almoxarifado'],
        },
      }
    })
}

function recommendationFor(
  demand: IntelligenceDemand,
  todayIso: string,
  estoqueItens: ItemEstoque[],
  purchaseOrders: ReturnType<typeof useSuprimentosStore.getState>['purchaseOrders'],
  frameworkAgreements: FrameworkAgreement[],
): AuditedRecommendation {
  const inventory = inventoryFor(demand.material, estoqueItens)
  const openOrdersQty = orderTransitFor(demand.material, purchaseOrders)
  const agreement = bestAgreement(demand.category, frameworkAgreements)
  const leadTimeDays = agreement?.leadTimeDays ?? 10
  const availableQty = inventory.available
  const reservedQty = inventory.reserved
  const inTransitQty = inventory.transit + openOrdersQty
  const missingQty = Math.max(0, demand.requiredQty + reservedQty - availableQty - inTransitQty)
  const suggestedOrderQty = Math.ceil(missingQty * 1.05)
  const suggestedOrderDate = addDaysIso(demand.plannedDate, -(leadTimeDays + 2))
  const daysToBuy = daysBetween(suggestedOrderDate, todayIso)
  const risk: RiskLevel = missingQty <= 0 ? 'ok' : daysToBuy <= 0 ? 'critical' : 'attention'
  const unitCost = agreement?.agreedUnitPrice ?? inventory.unitCost ?? 0

  return {
    id: `rec-${demand.id}`,
    demandId: demand.id,
    nucleo: demand.nucleo,
    local: demand.local,
    material: demand.material,
    category: demand.category,
    unit: demand.unit,
    requiredQty: demand.requiredQty,
    availableQty,
    reservedQty,
    inTransitQty,
    missingQty,
    suggestedOrderQty,
    suggestedOrderDate,
    neededBy: demand.plannedDate,
    leadTimeDays,
    preferredSupplier: agreement?.supplier ?? inventory.supplier,
    estimatedValue: suggestedOrderQty * unitCost,
    risk,
    reason: missingQty <= 0
      ? 'Estoque, reservas e pedidos em aberto cobrem a necessidade.'
      : `Faltam ${formatQty(missingQty, demand.unit)} para atender ${demand.activityName}.`,
    audit: {
      ...demand.audit,
      rule: `${demand.audit.rule} Cálculo: necessário + reservado - disponível - trânsito; compra sugerida com 5% de folga e lead time.`,
      modules: Array.from(new Set([...demand.audit.modules, 'Financeiro/EVM', 'Qualidade'])),
    },
  }
}

function formatDate(value: string) {
  return new Date(`${safeDateIso(value, new Date().toISOString().slice(0, 10))}T12:00:00`).toLocaleDateString('pt-BR')
}

export function InteligenciaSuprimentosPanel() {
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10))
  const [createdIds, setCreatedIds] = useState<Set<string>>(() => new Set())
  const {
    estoqueItens,
    purchaseOrders,
    frameworkAgreements,
    forecasts,
    planilhaResumo,
    planilhaTrechos,
    planilhaMateriais,
    planilhaMetadata,
    addForecast,
  } = useSuprimentosStore(
    useShallow((s) => ({
      estoqueItens: s.estoqueItens,
      purchaseOrders: s.purchaseOrders,
      frameworkAgreements: s.frameworkAgreements,
      forecasts: s.forecasts,
      planilhaResumo: s.planilhaResumo,
      planilhaTrechos: s.planilhaTrechos,
      planilhaMateriais: s.planilhaMateriais,
      planilhaMetadata: s.planilhaMetadata,
      addForecast: s.addForecast,
    })),
  )
  const { trechos, nuclei } = usePlanejamentoStore(
    useShallow((s) => ({ trechos: s.trechos, nuclei: s.nuclei })),
  )
  const derivedActivities = usePlanejamentoMestreStore((s) => s.derivedActivities)
  const medicaoSegments = useMedicaoStore((s) => s.segments)
  const rdos = useRdoStore((s) => s.rdos)
  const evmMetrics = useEvmStore((s) => s.evmMetrics)
  const projects = useProjetosStore((s) => s.projects)
  const nonConformities = useQualidadeStore((s) => s.nonConformities)
  const quantItems = useQuantitativosStore((s) => s.currentItems)
  const bimProjects = useBimStore((s) => s.projects)

  const updatedAt = planilhaMetadata?.dataRef || todayIso
  const demands = useMemo<IntelligenceDemand[]>(() => {
    const fromSheets = buildPlanilhaDemands(planilhaMateriais, planilhaTrechos, planilhaResumo, todayIso, updatedAt)
    const fromPlanning = buildPlanningDemands(trechos, nuclei, todayIso)
    const fromLookahead = derivedActivities.slice(0, 12).map<IntelligenceDemand>((activity) => ({
      id: `lookahead-${activity.id}`,
      nucleo: activity.responsible || 'Geral',
      local: activity.weekIso,
      activityName: activity.name,
      material: activity.networkType === 'civil' ? 'Material civil de frente' : 'Material operacional de frente',
      category: activity.networkType ?? 'geral',
      unit: 'lote',
      requiredQty: 1,
      plannedDate: addDaysIso(todayIso, 7),
      audit: {
        source: 'LPS/Lookahead',
        rule: 'Atividades derivadas do lookahead criam pacote mínimo de material por semana/frente.',
        updatedAt: todayIso,
        modules: ['LPS/Lookahead', 'Planejamento Mestre', 'Almoxarifado'],
      },
    }))

    const base = [...fromSheets, ...fromPlanning, ...fromLookahead]
    if (base.length > 0) return base.slice(0, 40)

    return forecasts
      .filter((forecast) => forecast.status === 'suggested')
      .slice(0, 12)
      .map((forecast) => ({
        id: `forecast-${forecast.id}`,
        nucleo: 'Geral',
        local: forecast.weekLabel,
        activityName: forecast.relatedPhase,
        material: forecast.materialCategory,
        category: forecast.materialCategory,
        unit: forecast.unit,
        requiredQty: forecast.estimatedQty,
        plannedDate: safeDateIso(forecast.suggestedOrderDate, todayIso),
        audit: {
          source: 'Previsao manual de Suprimentos',
          rule: 'Previsões sugeridas entram como demanda quando ainda não há planilha, planejamento ou lookahead.',
          updatedAt: todayIso,
          modules: ['Planilhas Consolidadas/Suprimentos', 'Almoxarifado'],
        },
      }))
  }, [derivedActivities, forecasts, nuclei, planilhaMateriais, planilhaResumo, planilhaTrechos, todayIso, trechos, updatedAt])

  const recommendations = useMemo(
    () => demands.map((demand) => recommendationFor(demand, todayIso, estoqueItens, purchaseOrders, frameworkAgreements)),
    [demands, estoqueItens, frameworkAgreements, purchaseOrders, todayIso],
  )

  const critical = recommendations.filter((rec) => rec.risk === 'critical').length
  const attention = recommendations.filter((rec) => rec.risk === 'attention').length
  const estimated = recommendations.reduce((sum, rec) => sum + rec.estimatedValue, 0)
  const priorityNucleos = planilhaResumo
    .filter((item) => item.trPend > 0 || item.kmPend > 0)
    .sort((a, b) => b.kmPend - a.kmPend)
    .slice(0, 4)

  const moduleStatus = [
    { label: 'Planilhas', count: planilhaMateriais.length + planilhaTrechos.length + planilhaResumo.length },
    { label: 'Planejamento', count: trechos.length + derivedActivities.length },
    { label: 'Quant/BIM', count: quantItems.length + bimProjects.reduce((sum, project) => sum + project.segments.length, 0) },
    { label: 'Medição/RDO', count: medicaoSegments.length + rdos.length },
    { label: 'EVM/Qualidade', count: (evmMetrics.BAC > 0 || evmMetrics.AC > 0 ? 1 : 0) + nonConformities.length },
    { label: 'Projetos', count: projects.length },
  ]

  function prepareForecast(rec: AuditedRecommendation) {
    if (createdIds.has(rec.id) || rec.suggestedOrderQty <= 0) return
    addForecast({
      weekLabel: `${rec.nucleo} - ${rec.neededBy}`,
      materialCategory: rec.material,
      estimatedQty: rec.suggestedOrderQty,
      unit: rec.unit,
      suggestedOrderDate: rec.suggestedOrderDate,
      relatedPhase: rec.category,
      estimatedValue: rec.estimatedValue,
      status: 'suggested',
    })
    setCreatedIds((prev) => new Set(prev).add(rec.id))
  }

  const lanes: Array<{ id: RiskLevel; title: string; items: AuditedRecommendation[] }> = [
    { id: 'critical', title: 'Críticas', items: recommendations.filter((rec) => rec.risk === 'critical') },
    { id: 'attention', title: 'Atenção', items: recommendations.filter((rec) => rec.risk === 'attention') },
    { id: 'ok', title: 'Cobertas', items: recommendations.filter((rec) => rec.risk === 'ok') },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Demandas auditadas', value: demands.length, cls: 'text-[#f5f5f5]' },
          { label: 'Críticas', value: critical, cls: 'text-[#f87171]' },
          { label: 'Atenção', value: attention, cls: 'text-[#fbbf24]' },
          { label: 'Valor sugerido', value: toCurrency(estimated), cls: 'text-[#4ade80]' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
            <p className="text-xs text-[#6b6b6b]">{kpi.label}</p>
            <p className={cn('mt-1 text-xl font-bold tabular-nums', kpi.cls)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#f97316]" />
            <p className="text-sm font-semibold text-[#f5f5f5]">Inteligência de Suprimentos auditável</p>
          </div>
          <p className="mt-1 text-xs text-[#a3a3a3]">
            Cada insight mostra fonte, regra, data de atualização e os módulos que alimentaram a decisão.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {FEEDING_MODULES.map((module) => (
              <span key={module} className="rounded-full border border-[#525252] bg-[#1f1f1f] px-2 py-1 text-[10px] text-[#a3a3a3]">
                {module}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-[#22c55e]" />
            <p className="text-sm font-semibold text-[#f5f5f5]">Fontes ativas</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {moduleStatus.map((item) => (
              <div key={item.label} className="rounded-lg bg-[#1f1f1f] px-3 py-2">
                <p className="text-[10px] text-[#6b6b6b]">{item.label}</p>
                <p className="text-sm font-bold text-[#f5f5f5]">{item.count}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {priorityNucleos.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-4">
          {priorityNucleos.map((item) => (
            <div key={`${item.nucleo}-${item.tipo}`} className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
              <div className="flex items-center gap-2">
                <Network size={14} className="text-[#f97316]" />
                <p className="truncate text-xs font-semibold text-[#f5f5f5]">{item.nucleo}</p>
              </div>
              <p className="mt-2 text-[10px] text-[#a3a3a3]">{item.tipo} - {item.trPend} trechos pendentes</p>
              <p className="text-sm font-bold text-[#fbbf24]">{item.kmPend.toLocaleString('pt-BR')} km pend.</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#f5f5f5]">Quadro macro de previsão</p>
            <p className="text-xs text-[#6b6b6b]">{recommendations.length} recomendações classificadas por risco e data de compra.</p>
          </div>
          <span className="rounded-full border border-[#525252] bg-[#1f1f1f] px-3 py-1 text-xs font-semibold text-[#a3a3a3]">
            Sem rolagem interna
          </span>
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {lanes.map((lane) => {
            const laneMeta = RISK_META[lane.id]
            return (
              <section key={lane.id} className="rounded-xl border border-[#525252] bg-[#292929] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', laneMeta.cls)}>{lane.title}</span>
                  <span className="text-xs font-bold text-[#f5f5f5]">{lane.items.length}</span>
                </div>
                <div className="grid gap-3">
                  {lane.items.map((rec) => {
                    const created = createdIds.has(rec.id)
                    return (
                      <article key={rec.id} className="rounded-xl border border-[#525252] bg-[#333333] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">{rec.nucleo} / {rec.local}</p>
                            <h3 className="mt-1 text-sm font-semibold leading-snug text-[#f5f5f5]">{rec.material}</h3>
                          </div>
                          <button
                            type="button"
                            disabled={created || rec.suggestedOrderQty <= 0}
                            onClick={() => prepareForecast(rec)}
                            className="shrink-0 rounded-lg bg-[#f97316] px-3 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#3d3d3d] disabled:text-[#6b6b6b]"
                          >
                            {created ? 'Na previsão' : 'Preparar'}
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-[#1f1f1f] px-2 py-2">
                            <p className="text-[9px] text-[#6b6b6b]">Necessário</p>
                            <p className="text-xs font-bold text-[#f5f5f5]">{formatQty(rec.requiredQty, rec.unit)}</p>
                          </div>
                          <div className="rounded-lg bg-[#1f1f1f] px-2 py-2">
                            <p className="text-[9px] text-[#6b6b6b]">Falta</p>
                            <p className="text-xs font-bold text-[#f97316]">{formatQty(rec.missingQty, rec.unit)}</p>
                          </div>
                          <div className="rounded-lg bg-[#1f1f1f] px-2 py-2">
                            <p className="text-[9px] text-[#6b6b6b]">Comprar</p>
                            <p className="text-xs font-bold text-[#f5f5f5]">{formatDate(rec.suggestedOrderDate)}</p>
                          </div>
                        </div>
                        <p className="mt-2 text-[10px] leading-relaxed text-[#a3a3a3]">{rec.reason}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded bg-[#1f1f1f] px-1.5 py-0.5 text-[9px] text-[#6b6b6b]">
                            {rec.audit.source}
                          </span>
                          <span className="rounded bg-[#1f1f1f] px-1.5 py-0.5 text-[9px] text-[#6b6b6b]">
                            LT {rec.leadTimeDays}d
                          </span>
                          {rec.preferredSupplier && (
                            <span className="rounded bg-[#1f1f1f] px-1.5 py-0.5 text-[9px] text-[#a3a3a3]">{rec.preferredSupplier}</span>
                          )}
                        </div>
                      </article>
                    )
                  })}
                  {lane.items.length === 0 && (
                    <div className="rounded-xl border border-dashed border-[#525252] px-3 py-8 text-center text-xs text-[#6b6b6b]">
                      Nenhuma recomendação nesta faixa.
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[#22c55e]" />
          <p className="text-xs font-semibold text-[#f5f5f5]">Governança do insight</p>
        </div>
        <p className="mt-1 text-[10px] text-[#a3a3a3]">
          O sistema importa hoje, substitui a planilha por formulários equivalentes amanhã e usa os dados validados como motor da inteligência.
        </p>
      </div>
    </div>
  )
}
