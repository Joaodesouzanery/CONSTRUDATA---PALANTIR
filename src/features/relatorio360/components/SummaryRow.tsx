import { ClipboardList, Clock, DollarSign, Wrench, Users, Target, TrendingUp } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { useSummaryMetrics } from '@/hooks/useRelatorio360'
import { useOperacaoCampoStore } from '@/store/operacaoCampoStore'
import { formatCurrencyCompact, formatHours } from '@/lib/utils'

export function SummaryRow() {
  const {
    activityCount,
    timecardCount,
    totalTimecardHours,
    totalTimecardCost,
    equipmentCount,
    totalEquipmentHours,
    totalEquipmentCost,
  } = useSummaryMetrics()

  const weeklyPpcResults = useOperacaoCampoStore((s) => s.weeklyPpcResults)
  const trendPoints      = useOperacaoCampoStore((s) => s.trendPoints)

  const totalCost = totalTimecardCost + totalEquipmentCost

  // Latest weekly PPC
  const latestPpc = weeklyPpcResults.length > 0
    ? weeklyPpcResults[weeklyPpcResults.length - 1].ppc
    : null

  // Latest deviation (planned - actual)
  const validTrend = trendPoints.filter((p) => p.actualCumulativePct > 0)
  const lastTrend  = validTrend[validTrend.length - 1]
  const lastPlan   = trendPoints.find((p) => p.date === lastTrend?.date)
  const deviation  = lastTrend && lastPlan
    ? Math.round((lastTrend.actualCumulativePct - lastPlan.plannedCumulativePct) * 10) / 10
    : null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 px-3 sm:px-6 py-4">
      <StatCard
        label="Atividades"
        value={String(activityCount)}
        sub="tarefas"
        icon={ClipboardList}
        accent
      />
      <StatCard
        label="Apontamentos"
        value={String(timecardCount)}
        sub="registros"
        icon={Users}
      />
      <StatCard
        label="Horas Mão de Obra"
        value={formatHours(totalTimecardHours)}
        sub={formatCurrencyCompact(totalTimecardCost)}
        icon={Clock}
      />
      <StatCard
        label="Equipamentos"
        value={String(equipmentCount)}
        sub={`${formatHours(totalEquipmentHours)} utilizadas`}
        icon={Wrench}
      />
      <StatCard
        label="Custo Total"
        value={formatCurrencyCompact(totalCost)}
        sub="M.O. + Equip."
        icon={DollarSign}
        accent
      />
      <StatCard
        label="PPC Semanal"
        value={latestPpc !== null ? `${latestPpc}%` : '—'}
        sub={latestPpc !== null ? (latestPpc >= 80 ? 'meta atingida' : latestPpc >= 60 ? 'atenção' : 'abaixo da meta') : 'sem dados'}
        icon={Target}
        accent={latestPpc !== null && latestPpc >= 80}
      />
      <StatCard
        label="Desvio Acum."
        value={deviation !== null ? `${deviation > 0 ? '+' : ''}${deviation}%` : '—'}
        sub={deviation !== null ? (deviation >= 0 ? 'adiantado' : 'em atraso') : 'sem dados'}
        icon={TrendingUp}
        accent={deviation !== null && deviation >= 0}
      />
    </div>
  )
}
