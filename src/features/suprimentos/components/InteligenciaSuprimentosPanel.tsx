import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import type {
  FrameworkAgreement,
  ItemEstoque,
  PlanTrecho,
  SupplyIntelligenceDemand,
  SupplyIntelligenceRecommendation,
  SupplyRiskLevel,
} from '@/types'

const MS_PER_DAY = 86_400_000

const RISK_META: Record<SupplyRiskLevel, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  ok: { label: 'OK', icon: CheckCircle2, cls: 'bg-[#16a34a]/15 text-[#4ade80] border-[#16a34a]/30' },
  atenção: { label: 'Atencao', icon: Clock, cls: 'bg-[#ca8a04]/15 text-[#fbbf24] border-[#ca8a04]/30' },
  crítico: { label: 'Critico', icon: AlertTriangle, cls: 'bg-[#dc2626]/15 text-[#f87171] border-[#dc2626]/30' },
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

function daysBetween(a: string, b: string) {
  return Math.ceil((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / MS_PER_DAY)
}

function toCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatQty(qty: number, unit: string) {
  return `${qty.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${unit}`
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

function bestAgreement(category: string, agreements: FrameworkAgreement[]) {
  const wanted = normalize(category)
  return agreements
    .filter((fa) => fa.status !== 'expired')
    .find((fa) => normalize(fa.category).includes(wanted) || wanted.includes(normalize(fa.category)))
}

function inventoryFor(material: string, items: ItemEstoque[]) {
  const wanted = normalize(material)
  const matches = items.filter((item) => {
    const text = normalize(`${item.descricao} ${item.categoria ?? ''}`)
    return wanted.includes(text) || text.includes(wanted.split(' ')[0] ?? wanted)
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
  return orders
    .filter((po) => po.status === 'open' || po.status === 'partial')
    .flatMap((po) => po.items)
    .filter((item) => {
      const text = normalize(item.description)
      return wanted.includes(text) || text.includes(wanted.split(' ')[0] ?? wanted)
    })
    .reduce((sum, item) => sum + item.quantity, 0)
}

function buildPlanningDemands(
  trechos: PlanTrecho[],
  nuclei: ReturnType<typeof usePlanejamentoStore.getState>['nuclei'],
  todayIso: string,
): SupplyIntelligenceDemand[] {
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
        source: 'planejamento',
        nucleo: t.nucleusId ? byNucleus.get(t.nucleusId) ?? t.nucleusId : 'Geral',
        local: t.code,
        activityId: t.id,
        activityName: t.description,
        material: inferred.material,
        category: inferred.category,
        unit: inferred.unit,
        requiredQty,
        plannedDate: t.plannedStartDate ?? addDaysIso(todayIso, 14),
        executedQty: t.executedMeters ?? 0,
      }
    })
}

function recommendationFor(
  demand: SupplyIntelligenceDemand,
  todayIso: string,
  estoqueItens: ItemEstoque[],
  purchaseOrders: ReturnType<typeof useSuprimentosStore.getState>['purchaseOrders'],
  frameworkAgreements: FrameworkAgreement[],
): SupplyIntelligenceRecommendation {
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
  const risk: SupplyRiskLevel = missingQty <= 0 ? 'ok' : daysToBuy <= 0 ? 'crítico' : 'atenção'
  const unitCost = agreement?.agreedUnitPrice ?? inventory.unitCost ?? 0

  return {
    id: `rec-${demand.id}`,
    demandId: demand.id,
    nucleo: demand.nucleo,
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
      ? 'Estoque e pedidos em aberto cobrem a necessidade planejada.'
      : `Faltam ${formatQty(missingQty, demand.unit)} para atender ${demand.activityName}.`,
  }
}

export function InteligenciaSuprimentosPanel() {
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10))
  const [createdIds, setCreatedIds] = useState<Set<string>>(() => new Set())
  const { estoqueItens, purchaseOrders, frameworkAgreements, forecasts, addForecast } = useSuprimentosStore(
    useShallow((s) => ({
      estoqueItens: s.estoqueItens,
      purchaseOrders: s.purchaseOrders,
      frameworkAgreements: s.frameworkAgreements,
      forecasts: s.forecasts,
      addForecast: s.addForecast,
    })),
  )
  const { trechos, nuclei } = usePlanejamentoStore(
    useShallow((s) => ({ trechos: s.trechos, nuclei: s.nuclei })),
  )
  const derivedActivities = usePlanejamentoMestreStore((s) => s.derivedActivities)

  const demands = useMemo<SupplyIntelligenceDemand[]>(() => {
    const planning = buildPlanningDemands(trechos, nuclei, todayIso)
    if (planning.length > 0) return planning

    if (derivedActivities.length > 0) {
      return derivedActivities.slice(0, 12).map((activity) => ({
        id: `lookahead-${activity.id}`,
        source: 'lookahead',
        nucleo: activity.responsible || 'Geral',
        local: activity.weekIso,
        activityId: activity.id,
        activityName: activity.name,
        material: activity.networkType === 'civil' ? 'Material civil de frente' : 'Material operacional de frente',
        category: activity.networkType ?? 'geral',
        unit: 'lote',
        requiredQty: 1,
        plannedDate: activity.weekIso,
      }))
    }

    return forecasts
      .filter((forecast) => forecast.status === 'suggested')
      .slice(0, 12)
      .map((forecast) => ({
        id: `forecast-${forecast.id}`,
        source: 'manual',
        nucleo: 'Geral',
        local: forecast.weekLabel,
        activityName: forecast.relatedPhase,
        material: forecast.materialCategory,
        category: forecast.materialCategory,
        unit: forecast.unit,
        requiredQty: forecast.estimatedQty,
        plannedDate: forecast.suggestedOrderDate,
      }))
  }, [derivedActivities, forecasts, nuclei, todayIso, trechos])

  const recommendations = useMemo(
    () => demands.map((demand) => recommendationFor(demand, todayIso, estoqueItens, purchaseOrders, frameworkAgreements)),
    [demands, estoqueItens, frameworkAgreements, purchaseOrders, todayIso],
  )

  const critical = recommendations.filter((rec) => rec.risk === 'crítico').length
  const attention = recommendations.filter((rec) => rec.risk === 'atenção').length
  const estimated = recommendations.reduce((sum, rec) => sum + rec.estimatedValue, 0)

  function prepareForecast(rec: SupplyIntelligenceRecommendation) {
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
          { label: 'Demandas cruzadas', value: demands.length, cls: 'text-[#f5f5f5]' },
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

      <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#f97316]" />
          <p className="text-sm font-semibold text-[#f5f5f5]">Motor recomendador de suprimentos</p>
        </div>
        <p className="mt-1 text-xs text-[#a3a3a3]">
          Cruza planejamento, lookahead, estoque, pedidos em aberto e acordos. A v1 apenas sugere; nenhuma OC e criada sem aprovacao.
        </p>
      </div>

      <div className="flex-1 overflow-auto rounded-xl border border-[#525252] bg-[#2c2c2c]">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="bg-[#484848]">
              <th className="px-3 py-2 text-left text-xs font-medium text-[#6b6b6b]">Nucleo / Local</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#6b6b6b]">Material</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[#6b6b6b]">Necessario</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[#6b6b6b]">Disp. / Res. / Trans.</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[#6b6b6b]">Falta</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#6b6b6b]">Comprar ate</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[#6b6b6b]">Fornecedor</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[#6b6b6b]">Risco</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-[#6b6b6b]">Acao</th>
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
                    <p className="text-[10px] text-[#6b6b6b]">Precisa em {new Date(`${rec.neededBy}T12:00:00`).toLocaleDateString('pt-BR')}</p>
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
                    {new Date(`${rec.suggestedOrderDate}T12:00:00`).toLocaleDateString('pt-BR')}
                    <span className="ml-1 text-[10px] text-[#6b6b6b]">LT {rec.leadTimeDays}d</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-[#a3a3a3]">{rec.preferredSupplier ?? 'Sem acordo'}</td>
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
                  Sem dados de planejamento, lookahead ou previsao para cruzar ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
