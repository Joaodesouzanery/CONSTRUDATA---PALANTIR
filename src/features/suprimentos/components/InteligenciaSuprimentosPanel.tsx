import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  FileSpreadsheet,
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
  'Medicao',
  'RDO',
  'Almoxarifado',
  'Financeiro/EVM',
  'Projetos/Nucleos',
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
  attention: { label: 'Atencao', icon: Clock, cls: 'bg-[#ca8a04]/15 text-[#fbbf24] border-[#ca8a04]/30' },
  critical: { label: 'Critico', icon: AlertTriangle, cls: 'bg-[#dc2626]/15 text-[#f87171] border-[#dc2626]/30' },
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
    return { material: `Aneis e tampao de PV${dn}`, category: 'Civil / PV', unit: 'un' }
  }
  if (desc.includes('esgoto')) {
    return { material: `Tubo PVC esgoto${dn}`, category: 'Tubulacao e Saneamento', unit: 'm' }
  }
  if (desc.includes('agua') || desc.includes('adutora') || desc.includes('rede')) {
    return { material: `Tubo PEAD/PVC agua${dn}`, category: 'Tubulacao e Saneamento', unit: 'm' }
  }
  if (trecho.requiresShoring || desc.includes('escav')) {
    return { material: 'Escoramento e material de vala', category: 'Escavacao', unit: 'm' }
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
              rule: 'Itens da aba Materiais Pendentes viram demandas; status pendente do Consolidado e km pendente do Resumo ajustam urgencia.',
              updatedAt,
              modules: ['Planilhas Consolidadas/Suprimentos', 'Medição', 'Projetos/Nucleos', 'Almoxarifado'],
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
          rule: 'Trechos nao concluidos geram demanda pelo comprimento ainda nao executado e pelo DN/tipo da atividade.',
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
      rule: `${demand.audit.rule} Calculo: necessario + reservado - disponivel - transito; compra sugerida com 5% de folga e lead time.`,
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
        rule: 'Atividades derivadas do lookahead criam pacote minimo de material por semana/frente.',
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
          rule: 'Previsoes sugeridas entram como demanda quando ainda nao ha planilha, planejamento ou lookahead.',
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
    { label: 'Medicao/RDO', count: medicaoSegments.length + rdos.length },
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

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Demandas auditadas', value: demands.length, cls: 'text-[#f5f5f5]' },
          { label: 'Criticas', value: critical, cls: 'text-[#f87171]' },
          { label: 'Atencao', value: attention, cls: 'text-[#fbbf24]' },
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
            <p className="text-sm font-semibold text-[#f5f5f5]">Inteligencia de Suprimentos auditavel</p>
          </div>
          <p className="mt-1 text-xs text-[#a3a3a3]">
            Cada insight mostra fonte, regra, data de atualizacao e os modulos que alimentaram a decisao.
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

      <div className="flex-1 overflow-auto rounded-xl border border-[#525252] bg-[#2c2c2c]">
        <table className="w-full min-w-[1180px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#484848]">
              <th className="px-3 py-2 text-left text-xs font-medium text-[#a3a3a3]">Nucleo / Local</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#a3a3a3]">Material</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[#a3a3a3]">Necessario</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[#a3a3a3]">Disp. / Res. / Trans.</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[#a3a3a3]">Falta</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#a3a3a3]">Comprar ate</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#a3a3a3]">Auditoria</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[#a3a3a3]">Risco</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[#a3a3a3]">Acao</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((rec) => {
              const meta = RISK_META[rec.risk]
              const Icon = meta.icon
              const created = createdIds.has(rec.id)
              return (
                <tr key={rec.id} className="border-t border-[#525252] hover:bg-[#484848]/40">
                  <td className="px-3 py-3">
                    <p className="text-xs font-semibold text-[#f5f5f5]">{rec.nucleo}</p>
                    <p className="text-[10px] text-[#6b6b6b]">{rec.local} - precisa em {formatDate(rec.neededBy)}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-xs font-semibold text-[#f5f5f5]">{rec.material}</p>
                    <p className="text-[10px] text-[#a3a3a3]">{rec.reason}</p>
                  </td>
                  <td className="px-3 py-3 text-right text-xs tabular-nums text-[#f5f5f5]">{formatQty(rec.requiredQty, rec.unit)}</td>
                  <td className="px-3 py-3 text-right text-xs tabular-nums text-[#a3a3a3]">
                    {formatQty(rec.availableQty, rec.unit)} / {formatQty(rec.reservedQty, rec.unit)} / {formatQty(rec.inTransitQty, rec.unit)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-[#f97316]">{formatQty(rec.missingQty, rec.unit)}</td>
                  <td className="px-3 py-3 text-xs text-[#f5f5f5]">
                    {formatDate(rec.suggestedOrderDate)}
                    <span className="ml-1 text-[10px] text-[#6b6b6b]">LT {rec.leadTimeDays}d</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="max-w-[330px] space-y-1">
                      <p className="flex items-center gap-1 text-[10px] font-semibold text-[#f5f5f5]">
                        <FileSpreadsheet size={11} className="text-[#f97316]" /> {rec.audit.source}
                      </p>
                      <p className="text-[10px] leading-snug text-[#a3a3a3]">{rec.audit.rule}</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded bg-[#1f1f1f] px-1.5 py-0.5 text-[9px] text-[#6b6b6b]">
                          Atualizado {formatDate(rec.audit.updatedAt)}
                        </span>
                        {rec.audit.modules.slice(0, 4).map((module) => (
                          <span key={module} className="rounded bg-[#1f1f1f] px-1.5 py-0.5 text-[9px] text-[#a3a3a3]">
                            {module}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', meta.cls)}>
                      <Icon size={11} /> {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      disabled={created || rec.suggestedOrderQty <= 0}
                      onClick={() => prepareForecast(rec)}
                      className="rounded-lg bg-[#f97316] px-3 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#3d3d3d] disabled:text-[#6b6b6b]"
                    >
                      {created ? 'Na previsao' : 'Preparar'}
                    </button>
                  </td>
                </tr>
              )
            })}
            {recommendations.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-[#6b6b6b]">
                  Importe as planilhas ou sincronize planejamento/lookahead para gerar insights auditaveis.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-[#22c55e]" />
          <p className="text-xs font-semibold text-[#f5f5f5]">Governanca do insight</p>
        </div>
        <p className="mt-1 text-[10px] text-[#a3a3a3]">
          O sistema importa hoje, substitui a planilha por formularios equivalentes amanha e usa os dados validados como motor da inteligencia.
        </p>
      </div>
    </div>
  )
}
