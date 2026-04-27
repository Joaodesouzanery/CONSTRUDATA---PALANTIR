import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FileText,
  HardHat,
  PackageCheck,
  RadioTower,
  ShieldAlert,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useEvmStore } from '@/store/evmStore'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useMedicaoStore } from '@/store/medicaoStore'
import { useOperacaoCampoStore } from '@/store/operacaoCampoStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { useRdoStore } from '@/store/rdoStore'
import { useRede360Store } from '@/store/rede360Store'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { readLocalRdoSabesp } from '@/features/rdo-sabesp/lib/rdoSabespLocalStore'
import { cn, formatCurrencyCompact } from '@/lib/utils'

interface Props {
  date: string
  projectName?: string
  compact?: boolean
}

interface Signal {
  label: string
  value: string
  sub: string
  icon: LucideIcon
  tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'
}

const toneClass: Record<Signal['tone'], string> = {
  ok: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  danger: 'border-red-500/30 bg-red-500/10 text-red-300',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  neutral: 'border-[#525252] bg-[#333333] text-[#f5f5f5]',
}

function sameProject(haystack: string, projectName?: string) {
  if (!projectName) return true
  const text = haystack.toLowerCase()
  const project = projectName.toLowerCase()
  const first = projectName.split(/\s+/)[0]?.toLowerCase() || ''
  return text.includes(project) || (first.length > 3 && text.includes(first))
}

function metricTone(value: number, warnAt: number, dangerAt: number): Signal['tone'] {
  if (value >= dangerAt) return 'danger'
  if (value >= warnAt) return 'warn'
  return 'ok'
}

function SignalCard({ signal }: { signal: Signal }) {
  const Icon = signal.icon
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-3 min-w-0">
      <div className="mb-2 flex items-center gap-2 text-[11px] text-[#a3a3a3]">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', toneClass[signal.tone])}>
          <Icon size={14} />
        </span>
        <span className="truncate">{signal.label}</span>
      </div>
      <div className="text-xl font-bold text-white tabular-nums">{signal.value}</div>
      <div className="mt-1 text-[11px] text-[#6b6b6b] truncate">{signal.sub}</div>
    </div>
  )
}

export function Ecosystem360Panel({ date, projectName, compact = false }: Props) {
  const reports = useRelatorio360Store((s) => s.reports)
  const rdos = useRdoStore((s) => s.rdos)
  const fvss = useQualidadeStore((s) => s.fvss)
  const nonConformities = useQualidadeStore((s) => s.nonConformities)
  const equipmentOrders = useGestaoEquipamentosStore((s) => s.orders)
  const { purchaseOrders, requisitions, estoqueItens, planilhaItensOperacionais, planilhaOrdens } = useSuprimentosStore(
    useShallow((s) => ({
      purchaseOrders: s.purchaseOrders,
      requisitions: s.requisitions,
      estoqueItens: s.estoqueItens,
      planilhaItensOperacionais: s.planilhaItensOperacionais,
      planilhaOrdens: s.planilhaOrdens,
    }))
  )
  const evmMetrics = useEvmStore((s) => s.evmMetrics)
  const { trechos, isScheduleDirty, projectEndDate } = usePlanejamentoStore(
    useShallow((s) => ({
      trechos: s.trechos,
      isScheduleDirty: s.isScheduleDirty,
      projectEndDate: s.projectEndDate,
    }))
  )
  const { workers, timecards, violations, absences } = useMaoDeObraStore(
    useShallow((s) => ({
      workers: s.workers,
      timecards: s.timecards,
      violations: s.violations,
      absences: s.absences,
    }))
  )
  const weeklyPpcResults = useOperacaoCampoStore((s) => s.weeklyPpcResults)
  const getMedicaoKpis = useMedicaoStore((s) => s.getGlobalKpis)
  const medicaoKpis = getMedicaoKpis()
  const { outages, serviceOrders } = useRede360Store(
    useShallow((s) => ({ outages: s.outages, serviceOrders: s.serviceOrders }))
  )

  const sabespRdos = readLocalRdoSabesp().filter((rdo) => rdo.report_date === date && sameProject(`${rdo.rua_beco} ${rdo.encarregado}`, projectName))
  const reportList = Object.values(reports).filter((report) => report.date === date && sameProject(report.projectName, projectName))
  const rdoList = rdos.filter((rdo) => rdo.date === date && sameProject(`${rdo.responsible} ${rdo.observations} ${rdo.incidents}`, projectName))
  const openNcs = nonConformities.filter((nc) => nc.status !== 'concluida')
  const dueEquipment = equipmentOrders.filter((order) => {
    const scheduledDate = (order as { scheduledDate?: string }).scheduledDate
    const status = (order as { status?: string }).status
    return scheduledDate === date || status === 'open' || status === 'scheduled'
  })
  const issuedPOs = purchaseOrders.filter((po) => po.issuedDate === date || po.status === 'open')
  const pendingReqs = requisitions.filter((req) => !['ordered', 'cancelled'].includes(req.status))
  const estoqueRuptura = estoqueItens.filter((item) => item.qtdDisponivel <= item.estoqueMinimo).length
  const pendingMaterials = planilhaItensOperacionais.filter((item) => item.status === 'pend')
  const activeWorkers = workers.filter((worker) => worker.status === 'active')
  const todaysTimecards = timecards.filter((entry) => entry.date === date)
  const latestPpc = weeklyPpcResults.at(-1)?.ppc ?? null
  const plannedTrechos = trechos.length
  const delayedTrechos = trechos.filter((trecho) => trecho.executionStatus === 'in_progress' && (trecho.physicalProgressPct ?? 0) < 70).length
  const openOutages = outages.filter((outage) => outage.status !== 'resolved').length
  const openNetworkOrders = serviceOrders.filter((order) => ['pending', 'in_progress'].includes(order.status)).length

  const signals: Signal[] = [
    {
      label: 'RDOs',
      value: String(reportList.length + rdoList.length + sabespRdos.length),
      sub: `${reportList.length} R360 | ${rdoList.length + sabespRdos.length} campo`,
      icon: ClipboardList,
      tone: reportList.length + rdoList.length + sabespRdos.length > 0 ? 'ok' : 'warn',
    },
    {
      label: 'Qualidade',
      value: String(openNcs.length),
      sub: `${fvss.length} FVS | NCs abertas`,
      icon: ShieldAlert,
      tone: metricTone(openNcs.length, 1, 3),
    },
    {
      label: 'Suprimentos',
      value: String(pendingMaterials.length + pendingReqs.length),
      sub: `${issuedPOs.length} OCs | ${estoqueRuptura} rupturas | ${planilhaOrdens.length} ordens`,
      icon: PackageCheck,
      tone: metricTone(pendingMaterials.length + pendingReqs.length, 20, 80),
    },
    {
      label: 'Equipamentos',
      value: String(dueEquipment.length),
      sub: 'manutencoes e ordens abertas',
      icon: Wrench,
      tone: metricTone(dueEquipment.length, 1, 4),
    },
    {
      label: 'Mao de obra',
      value: String(activeWorkers.length),
      sub: `${todaysTimecards.length} apontamentos | ${violations.length} alertas CLT`,
      icon: Users,
      tone: violations.length ? 'warn' : 'ok',
    },
    {
      label: 'Planejamento',
      value: plannedTrechos ? `${Math.round((trechos.filter((t) => t.executionStatus === 'completed').length / plannedTrechos) * 100)}%` : '0%',
      sub: projectEndDate ? `fim previsto ${projectEndDate}` : (isScheduleDirty ? 'cronograma pendente' : 'sem data final'),
      icon: BarChart3,
      tone: delayedTrechos > 0 || isScheduleDirty ? 'warn' : 'ok',
    },
    {
      label: 'Financeiro / EVM',
      value: evmMetrics.BAC ? formatCurrencyCompact(evmMetrics.VAC) : 'sem BAC',
      sub: `CPI ${evmMetrics.CPI.toFixed(2)} | SPI ${evmMetrics.SPI.toFixed(2)}`,
      icon: FileText,
      tone: evmMetrics.CPI < 0.9 || evmMetrics.SPI < 0.9 ? 'danger' : evmMetrics.CPI < 1 || evmMetrics.SPI < 1 ? 'warn' : 'ok',
    },
    {
      label: 'Medicao',
      value: `${medicaoKpis.pctExec}%`,
      sub: `${medicaoKpis.kmExec.toFixed(1)} km exec | ${medicaoKpis.kmPend.toFixed(1)} km pend`,
      icon: CheckCircle2,
      tone: medicaoKpis.pctExec >= 70 ? 'ok' : medicaoKpis.pctExec >= 35 ? 'warn' : 'info',
    },
    {
      label: 'Rede 360',
      value: String(openOutages + openNetworkOrders),
      sub: `${openOutages} ocorrencias | ${openNetworkOrders} OS abertas`,
      icon: RadioTower,
      tone: metricTone(openOutages + openNetworkOrders, 1, 4),
    },
    {
      label: 'Campo / PPC',
      value: latestPpc === null ? '--' : `${latestPpc}%`,
      sub: `${absences.filter((a) => a.date === date && a.status !== 'covered').length} ausencias no dia`,
      icon: HardHat,
      tone: latestPpc === null ? 'neutral' : latestPpc >= 80 ? 'ok' : latestPpc >= 60 ? 'warn' : 'danger',
    },
  ]

  const critical = signals.filter((signal) => signal.tone === 'danger' || signal.tone === 'warn')

  return (
    <section className="rounded-xl border border-[#525252] bg-[#2f2f2f]">
      <div className="flex items-center justify-between gap-3 border-b border-[#525252] px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className={critical.length ? 'text-amber-300' : 'text-[#22c55e]'} />
          <h2 className="text-sm font-semibold text-white">Radar 360</h2>
        </div>
        <span className="text-[11px] text-[#a3a3a3]">{critical.length} pontos de atencao</span>
      </div>
      <div className={cn('grid gap-3 p-4', compact ? 'md:grid-cols-5' : 'md:grid-cols-2 xl:grid-cols-5')}>
        {signals.map((signal) => <SignalCard key={signal.label} signal={signal} />)}
      </div>
    </section>
  )
}
