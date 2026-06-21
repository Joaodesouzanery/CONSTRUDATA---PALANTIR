import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Gauge,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { useEconomiaStore } from '@/store/economiaStore'
import { useLpsStore } from '@/store/lpsStore'
import type { EconomyBaseline, EconomyEvent, EconomyEventStatus, EconomyReport, EconomySourceModule } from '@/types'
import {
  brl,
  ECONOMY_CATEGORY_LABELS,
  ECONOMY_SOURCE_LABELS,
  ECONOMY_SOURCE_ROUTE,
  latestPpc,
  methodologyFor,
  monthlySeries,
  monthPeriod,
  summarizeEconomy,
} from './utils/economiaEngine'
import { printEconomyDossier, printEconomyReport } from './utils/economiaReportExport'

type EconomiaTab = 'overview' | 'events' | 'baseline' | 'report' | 'qbr'

const TABS: { id: EconomiaTab; label: string; icon: typeof Gauge }[] = [
  { id: 'overview', label: 'Prova de valor', icon: ShieldCheck },
  { id: 'events', label: 'Eventos', icon: BadgeDollarSign },
  { id: 'baseline', label: 'Baseline', icon: SlidersHorizontal },
  { id: 'report', label: 'Relatorio mensal', icon: FileText },
  { id: 'qbr', label: 'QBR', icon: CalendarDays },
]

const STATUS_LABELS: Record<EconomyEventStatus, string> = {
  detected: 'Detectado',
  validated: 'Validado',
  dismissed: 'Descartado',
  reported: 'Reportado',
}

export function EconomiaPage() {
  const store = useEconomiaStore()
  const lpsActivities = useLpsStore((state) => state.activities)
  const [activeTab, setActiveTab] = useState<EconomiaTab>('overview')
  const [obra, setObra] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<EconomySourceModule | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<EconomyEventStatus | 'all'>('all')

  useEffect(() => {
    if (store.baselines.length === 0) store.addBaseline()
    if (store.events.length === 0 && store.baselines.length > 0) store.scanEvents()
    // Run once when the module opens; explicit refresh remains available in the header.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Obra = filtro por nome de obra presente nos eventos (exato, sem heurística).
  // Cliente já é isolado por organização via RLS no store.
  const obraOptions = useMemo(
    () => Array.from(new Set(store.events.map((event) => event.projectName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [store.events],
  )

  const eventsForObra = useMemo(
    () => (obra === 'all' ? store.events : store.events.filter((event) => event.projectName === obra)),
    [obra, store.events],
  )

  const summary = useMemo(
    () => summarizeEconomy(eventsForObra, store.baselines, store.selectedPeriod, undefined),
    [eventsForObra, store.baselines, store.selectedPeriod],
  )

  const series = useMemo(() => monthlySeries(eventsForObra, 6), [eventsForObra])
  const currentPpc = useMemo(() => latestPpc(lpsActivities), [lpsActivities])

  const filteredEvents = useMemo(() => {
    return summary.events.filter((event) => {
      if (sourceFilter !== 'all' && event.sourceModule !== sourceFilter) return false
      if (statusFilter !== 'all' && event.status !== statusFilter) return false
      return true
    })
  }, [sourceFilter, statusFilter, summary.events])

  const currentReport = store.reports.find((report) =>
    report.period === store.selectedPeriod &&
    report.projectId === (store.selectedProjectId ?? null)
  )

  // Exporta o dossiê com exatamente o que está na tela (obra + período selecionados),
  // sem precisar gerar/persistir um relatório antes.
  const exportDossier = () => {
    const baseline = summary.baseline
    const liveReport: EconomyReport = {
      id: 'live',
      period: store.selectedPeriod,
      projectId: null,
      projectName: obra === 'all' ? (baseline?.projectName ?? 'Carteira de obras') : obra,
      baselineId: baseline?.id ?? null,
      eventIds: summary.events.map((event) => event.id),
      detectedEvents: summary.detectedEvents,
      avoidedLossBRL: summary.avoidedLossBRL,
      platformFeeBRL: summary.platformFeeBRL,
      roiPercent: summary.roiPercent,
      ppcBefore: baseline?.ppcPercent ?? 0,
      ppcAfter: currentPpc || (baseline?.ppcPercent ?? 0),
      materialDeviationBefore: baseline?.materialDeviationPercent ?? 0,
      materialDeviationAfter: baseline?.targetMaterialDeviationPercent ?? 0,
      materialSavingsBRL: Math.max(0, ((baseline?.materialDeviationPercent ?? 0) - (baseline?.targetMaterialDeviationPercent ?? 0)) / 100) * (baseline?.materialMonthlyBudgetBRL ?? 0),
      status: 'draft',
      generatedAt: new Date().toISOString(),
    }
    printEconomyDossier(liveReport, eventsForObra, baseline)
  }

  const renderPanel = () => {
    switch (activeTab) {
      case 'overview':
        return <ProvaDeValorPanel summary={summary} series={series} currentPpc={currentPpc} lastScanAt={store.lastScanAt} />
      case 'events':
        return (
          <EventsPanel
            events={filteredEvents}
            sourceFilter={sourceFilter}
            statusFilter={statusFilter}
            setSourceFilter={setSourceFilter}
            setStatusFilter={setStatusFilter}
            updateEvent={store.updateEvent}
            validateEvent={store.validateEvent}
            dismissEvent={store.dismissEvent}
          />
        )
      case 'baseline':
        return <BaselinePanel baselines={store.baselines} updateBaseline={store.updateBaseline} addBaseline={store.addBaseline} />
      case 'report':
        return (
          <ReportPanel
            report={currentReport}
            events={store.events}
            baseline={summary.baseline}
            generateReport={() => store.generateMonthlyReport()}
            markSent={store.markReportSent}
          />
        )
      case 'qbr':
        return <QbrPanel events={store.events} baseline={summary.baseline} />
      default:
        return <ProvaDeValorPanel summary={summary} series={series} currentPpc={currentPpc} lastScanAt={store.lastScanAt} />
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#2c2c2c] text-[#f5f5f5]">
      <header className="border-b border-[#525252] bg-[#242424] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#f97316]">
              <BadgeDollarSign size={16} />
              Economia
            </div>
            <h1 className="mt-1 text-xl font-semibold text-white">ROI e valor entregue</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={obra}
              onChange={(event) => setObra(event.target.value)}
              className="h-9 max-w-[14rem] rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-white outline-none focus:border-[#f97316]"
              title="Obra / carteira"
            >
              <option value="all">Carteira (todas as obras)</option>
              {obraOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <input
              type="month"
              value={store.selectedPeriod}
              onChange={(event) => store.setSelectedPeriod(event.target.value || monthPeriod())}
              className="h-9 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-white outline-none focus:border-[#f97316]"
            />
            <FreshnessBadge lastScanAt={store.lastScanAt} />
            <button
              type="button"
              onClick={store.scanEvents}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#525252] px-3 text-sm font-medium text-[#e5e5e5] hover:border-[#f97316]/60 hover:text-white"
            >
              <RefreshCw size={15} />
              Atualizar eventos
            </button>
            <button
              type="button"
              onClick={exportDossier}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f97316] px-3 text-sm font-semibold text-white hover:bg-[#ea580c]"
            >
              <Download size={15} />
              Dossiê PDF
            </button>
          </div>
        </div>

        <nav className="mt-4 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition ${
                  active
                    ? 'bg-[#f97316]/15 text-[#f97316]'
                    : 'text-[#a3a3a3] hover:bg-[#333333] hover:text-white'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="flex-1 overflow-auto p-5">
        {renderPanel()}
      </main>
    </div>
  )
}

function ProvaDeValorPanel({
  summary,
  series,
  currentPpc,
  lastScanAt,
}: {
  summary: ReturnType<typeof summarizeEconomy>
  series: Array<{ period: string; validatedBRL: number }>
  currentPpc: number
  lastScanAt: string | null
}) {
  const events = summary.events
  const baseline = summary.baseline
  const valued = events.filter((event) => event.impactBRL > 0)
  const bySource = groupValue(valued, (event) => ECONOMY_SOURCE_LABELS[event.sourceModule])
  const byCategory = groupValue(valued, (event) => ECONOMY_CATEGORY_LABELS[event.category])
  const topEvents = [...valued]
    .sort((a, b) => proofRank(b) - proofRank(a) || b.impactBRL - a.impactBRL)
    .slice(0, 6)

  if (events.length === 0) return <ProofEmptyState />

  return (
    <div className="space-y-6">
      <HeroProof summary={summary} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="De onde vem a economia (por módulo)">
          <div className="space-y-3">
            {bySource.map((row) => <HorizontalBar key={row.label} label={row.label} value={row.value} max={bySource[0]?.value || 1} />)}
            {bySource.length === 0 && <EmptyText text="Sem valor financeiro consolidado no período." />}
          </div>
        </Panel>
        <Panel title="Por tipo de ganho">
          <div className="space-y-3">
            {byCategory.map((row) => <HorizontalBar key={row.label} label={row.label} value={row.value} max={byCategory[0]?.value || 1} />)}
            {byCategory.length === 0 && <EmptyText text="Sem valor financeiro consolidado no período." />}
          </div>
        </Panel>
      </div>

      <Panel title="Antes e depois (baseline → atual)">
        <div className="grid gap-3 sm:grid-cols-3">
          <BeforeAfterRow
            label="PPC (cumprimento do plano)"
            before={`${Math.round(baseline?.ppcPercent ?? 0)}%`}
            after={currentPpc > 0 ? `${currentPpc}%` : '—'}
            good={currentPpc >= (baseline?.ppcPercent ?? 0)}
          />
          <BeforeAfterRow
            label="Desvio de material"
            before={`${baseline?.materialDeviationPercent ?? 0}%`}
            after={`${baseline?.targetMaterialDeviationPercent ?? 0}% (meta)`}
            good
          />
          <BeforeAfterRow
            label="Horas em relatório manual"
            before={`${baseline?.manualReportHoursPerWeek ?? 0}h/sem`}
            after="automatizado"
            good
          />
        </div>
      </Panel>

      <Panel title="Economia validada por mês">
        <TrendBars series={series} />
      </Panel>

      <Panel title="Evidências de maior impacto">
        <div className="grid gap-3 lg:grid-cols-2">
          {topEvents.map((event) => <EvidenceCard key={event.id} event={event} />)}
          {topEvents.length === 0 && <EmptyText text="Ainda sem eventos com valor financeiro. Os indicadores sem R$ aparecem na aba Eventos." />}
        </div>
      </Panel>

      <DisclosureNote summary={summary} lastScanAt={lastScanAt} />
    </div>
  )
}

function proofRank(event: EconomyEvent) {
  return event.status === 'validated' || event.status === 'reported' ? 1 : 0
}

function HeroProof({ summary }: { summary: ReturnType<typeof summarizeEconomy> }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#525252] bg-gradient-to-br from-[#1d2a23] via-[#242424] to-[#1f1f1f] p-6 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
          <BadgeDollarSign size={15} /> Economia comprovada no período
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
          <p className="text-4xl font-bold tabular-nums text-emerald-300 sm:text-5xl lg:text-6xl">{brl(summary.avoidedLossBRL)}</p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 pb-1">
            <Stat icon={TrendingUp} label="ROI do mês" value={`${Math.round(summary.roiPercent)}%`} positive={summary.roiPercent >= 0} />
            <Stat label="Retorno por R$ investido" value={`${summary.paybackRatio.toFixed(1)}x`} positive={summary.paybackRatio >= 1} />
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-5 text-[#a3a3a3]">
          {summary.validatedEvents} de {summary.detectedEvents} eventos validados · investimento na plataforma {brl(summary.platformFeeBRL)}/mês
          {summary.estimatedPipelineBRL > 0 && <> · {brl(summary.estimatedPipelineBRL)} em potencial ainda em análise (não somado)</>}
        </p>
      </div>
    </section>
  )
}

function Stat({ label, value, positive = true, icon: Icon }: { label: string; value: string; positive?: boolean; icon?: typeof TrendingUp }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[#a3a3a3]">{label}</p>
      <p className={`mt-0.5 flex items-center gap-1.5 text-xl font-semibold tabular-nums ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
        {Icon && <Icon size={16} />}{value}
      </p>
    </div>
  )
}

function BeforeAfterRow({ label, before, after, good = true }: { label: string; before: string; after: string; good?: boolean }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
      <p className="text-xs text-[#a3a3a3]">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="text-[#9a9a9a] line-through decoration-[#5a5a5a]">{before}</span>
        <ArrowRight size={13} className="shrink-0 text-[#737373]" />
        <span className={`font-semibold ${good ? 'text-emerald-300' : 'text-amber-300'}`}>{after}</span>
      </div>
    </div>
  )
}

function TrendBars({ series }: { series: Array<{ period: string; validatedBRL: number }> }) {
  const max = Math.max(1, ...series.map((row) => row.validatedBRL))
  if (!series.some((row) => row.validatedBRL > 0)) {
    return <EmptyText text="Sem histórico de economia validada nos últimos meses." />
  }
  return (
    <div className="flex h-44 items-end gap-3">
      {series.map((row) => (
        <div key={row.period} className="flex h-full flex-1 flex-col items-center">
          <span className="mb-1 text-[10px] font-semibold tabular-nums text-emerald-300/80">{row.validatedBRL > 0 ? brlShort(row.validatedBRL) : ''}</span>
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t bg-gradient-to-t from-emerald-500/40 to-emerald-400/80" style={{ height: `${Math.max(2, (row.validatedBRL / max) * 100)}%` }} />
          </div>
          <span className="mt-2 text-[10px] text-[#a3a3a3]">{monthShort(row.period)}</span>
        </div>
      ))}
    </div>
  )
}

function EvidenceCard({ event }: { event: EconomyEvent }) {
  const route = ECONOMY_SOURCE_ROUTE[event.sourceModule]
  return (
    <article className="rounded-lg border border-[#525252] bg-[#242424] p-4 transition hover:border-emerald-500/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#f97316]/10 px-2 py-0.5 text-[11px] font-semibold text-[#f97316]">{ECONOMY_SOURCE_LABELS[event.sourceModule]}</span>
            <ConfidencePill confidence={event.confidence} />
          </div>
          <h3 className="mt-2 text-sm font-semibold text-white">{event.title}</h3>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-300">{event.impactBRL > 0 ? brl(event.impactBRL) : 'indicador'}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#a3a3a3]">{methodologyFor(event.category)}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="truncate text-[11px] text-[#a3a3a3]">{event.projectName}</span>
        {route && (
          <Link to={route} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-cyan-300 transition hover:text-cyan-200">
            Ver evidência <ArrowUpRight size={12} />
          </Link>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-[#737373] transition hover:text-[#a3a3a3]">Como calculamos</summary>
        <div className="mt-2 rounded-md bg-[#1f1f1f] p-2 text-[11px] text-[#a3a3a3]">
          <p className="font-mono text-[#d4d4d4]">{event.formula}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {Object.entries(event.assumptions).map(([key, value]) => (
              <span key={key}>{key}: <span className="text-[#d4d4d4]">{typeof value === 'number' ? value.toLocaleString('pt-BR') : String(value)}</span></span>
            ))}
          </div>
        </div>
      </details>
    </article>
  )
}

function ConfidencePill({ confidence }: { confidence: EconomyEvent['confidence'] }) {
  const map: Record<EconomyEvent['confidence'], [string, string]> = {
    high: ['Alta', 'bg-emerald-500/10 text-emerald-300'],
    medium: ['Média', 'bg-amber-500/10 text-amber-300'],
    low: ['Baixa', 'bg-[#333333] text-[#a3a3a3]'],
  }
  const [label, cls] = map[confidence] ?? map.low
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>Confiança {label}</span>
}

function DisclosureNote({ summary, lastScanAt }: { summary: ReturnType<typeof summarizeEconomy>; lastScanAt: string | null }) {
  return (
    <p className="text-[11px] leading-5 text-[#737373]">
      Valores conservadores, calculados a partir de dados reais dos módulos operacionais. O ROI considera apenas eventos validados ({summary.validatedEvents} de {summary.detectedEvents});
      indicadores sem R$ direto não entram na conta, para evitar dupla contagem.
      {lastScanAt && <> Última atualização: {new Date(lastScanAt).toLocaleString('pt-BR')}.</>}
    </p>
  )
}

function ProofEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[#525252] bg-[#242424] p-10 text-center">
      <ShieldCheck className="mx-auto text-[#525252]" size={40} />
      <h2 className="mt-4 text-lg font-semibold text-white">Ainda não há economia comprovada neste período</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#a3a3a3]">
        Alimente RDO, Suprimentos, LPS, Medição e EVM e clique em <span className="text-[#e5e5e5]">"Atualizar eventos"</span>. A comprovação é gerada a partir de dados reais — nunca de números fictícios.
      </p>
    </div>
  )
}

function FreshnessBadge({ lastScanAt }: { lastScanAt: string | null }) {
  if (!lastScanAt) return null
  return (
    <span className="hidden h-9 items-center gap-1.5 rounded-lg border border-[#525252] px-3 text-[11px] text-[#a3a3a3] sm:inline-flex">
      <Clock size={13} /> {new Date(lastScanAt).toLocaleDateString('pt-BR')}
    </span>
  )
}

function brlShort(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  if (value >= 1000) return `R$ ${Math.round(value / 1000)}k`
  return brl(value)
}

function monthShort(period: string): string {
  const [year, month] = period.split('-')
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${names[Number(month) - 1] ?? month}/${(year ?? '').slice(2)}`
}

function EventsPanel({
  events,
  sourceFilter,
  statusFilter,
  setSourceFilter,
  setStatusFilter,
  updateEvent,
  validateEvent,
  dismissEvent,
}: {
  events: EconomyEvent[]
  sourceFilter: EconomySourceModule | 'all'
  statusFilter: EconomyEventStatus | 'all'
  setSourceFilter: (value: EconomySourceModule | 'all') => void
  setStatusFilter: (value: EconomyEventStatus | 'all') => void
  updateEvent: (id: string, patch: Partial<EconomyEvent>) => void
  validateEvent: (id: string) => void
  dismissEvent: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as EconomySourceModule | 'all')} className={selectClass}>
          <option value="all">Todos os modulos</option>
          {Object.entries(ECONOMY_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EconomyEventStatus | 'all')} className={selectClass}>
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="grid gap-3">
        {events.map((event) => (
          <EventEditor
            key={event.id}
            event={event}
            updateEvent={updateEvent}
            validateEvent={validateEvent}
            dismissEvent={dismissEvent}
          />
        ))}
        {events.length === 0 && <Panel title="Eventos"><EmptyText text="Nenhum evento encontrado com os filtros atuais." /></Panel>}
      </div>
    </div>
  )
}

function EventEditor({
  event,
  updateEvent,
  validateEvent,
  dismissEvent,
}: {
  event: EconomyEvent
  updateEvent: (id: string, patch: Partial<EconomyEvent>) => void
  validateEvent: (id: string) => void
  dismissEvent: (id: string) => void
}) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#242424] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#f97316]/10 px-2 py-1 text-[11px] font-semibold text-[#f97316]">
              {ECONOMY_SOURCE_LABELS[event.sourceModule]}
            </span>
            <span className="rounded-md bg-[#333333] px-2 py-1 text-[11px] text-[#d4d4d4]">
              {ECONOMY_CATEGORY_LABELS[event.category]}
            </span>
            <StatusPill status={event.status} />
          </div>
          <h3 className="mt-2 text-sm font-semibold text-white">{event.title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#a3a3a3]">{event.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={event.impactBRL}
            onChange={(input) => updateEvent(event.id, { impactBRL: Number(input.target.value) || 0 })}
            className="h-9 w-32 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-right text-sm font-semibold text-emerald-300 outline-none focus:border-[#22c55e]"
          />
          <button type="button" onClick={() => validateEvent(event.id)} className="rounded-lg border border-emerald-500/40 p-2 text-emerald-300 hover:bg-emerald-500/10" title="Validar">
            <CheckCircle2 size={16} />
          </button>
          <button type="button" onClick={() => dismissEvent(event.id)} className="rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10" title="Descartar">
            <XCircle size={16} />
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-[#d4d4d4] md:grid-cols-3">
        <span>Obra: {event.projectName}</span>
        <span>Formula: {event.formula}</span>
        <span>Confianca: {event.confidence}</span>
      </div>
    </div>
  )
}

function BaselinePanel({
  baselines,
  updateBaseline,
  addBaseline,
}: {
  baselines: EconomyBaseline[]
  updateBaseline: (id: string, patch: Partial<EconomyBaseline>) => void
  addBaseline: (baseline?: Partial<EconomyBaseline>) => EconomyBaseline
}) {
  const baseline = baselines[0]
  if (!baseline) {
    return (
      <Panel title="Baseline semana 0">
        <button type="button" onClick={() => addBaseline()} className={primaryButtonClass}>Criar baseline</button>
      </Panel>
    )
  }

  return (
    <Panel title="Baseline semana 0">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Obra / carteira" value={baseline.projectName} onChange={(value) => updateBaseline(baseline.id, { projectName: value })} />
        <Field label="PPC atual (%)" type="number" value={baseline.ppcPercent} onChange={(value) => updateBaseline(baseline.id, { ppcPercent: num(value) })} />
        <Field label="Desvio material (%)" type="number" value={baseline.materialDeviationPercent} onChange={(value) => updateBaseline(baseline.id, { materialDeviationPercent: num(value) })} />
        <Field label="Horas relatorios/sem" type="number" value={baseline.manualReportHoursPerWeek} onChange={(value) => updateBaseline(baseline.id, { manualReportHoursPerWeek: num(value) })} />
        <Field label="Paralisacoes trimestre" type="number" value={baseline.stoppagesLastQuarter} onChange={(value) => updateBaseline(baseline.id, { stoppagesLastQuarter: num(value) })} />
        <Field label="Trabalhadores" type="number" value={baseline.workersCount} onChange={(value) => updateBaseline(baseline.id, { workersCount: num(value) })} />
        <Field label="Custo/dia por pessoa" type="number" value={baseline.costPerPersonDayBRL} onChange={(value) => updateBaseline(baseline.id, { costPerPersonDayBRL: num(value) })} />
        <Field label="Orcamento material/mes" type="number" value={baseline.materialMonthlyBudgetBRL} onChange={(value) => updateBaseline(baseline.id, { materialMonthlyBudgetBRL: num(value) })} />
        <Field label="Meta desvio material (%)" type="number" value={baseline.targetMaterialDeviationPercent} onChange={(value) => updateBaseline(baseline.id, { targetMaterialDeviationPercent: num(value) })} />
        <Field label="Mensalidade plataforma" type="number" value={baseline.platformMonthlyFeeBRL} onChange={(value) => updateBaseline(baseline.id, { platformMonthlyFeeBRL: num(value) })} />
        <Field label="Custo hora gestor" type="number" value={baseline.managerHourlyCostBRL} onChange={(value) => updateBaseline(baseline.id, { managerHourlyCostBRL: num(value) })} />
        <Field label="Custo diario equipamento" type="number" value={baseline.equipmentDailyCostBRL} onChange={(value) => updateBaseline(baseline.id, { equipmentDailyCostBRL: num(value) })} />
      </div>
    </Panel>
  )
}

function ReportPanel({
  report,
  events,
  baseline,
  generateReport,
  markSent,
}: {
  report?: EconomyReport
  events: EconomyEvent[]
  baseline?: EconomyBaseline
  generateReport: () => EconomyReport
  markSent: (id: string) => void
}) {
  const activeReport = report
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={generateReport} className={primaryButtonClass}>Gerar relatorio do mes</button>
        {activeReport && (
          <>
            <button type="button" onClick={() => printEconomyReport(activeReport, events, baseline)} className={secondaryButtonClass}>Imprimir PDF</button>
            <button type="button" onClick={() => markSent(activeReport.id)} className={secondaryButtonClass}>Marcar enviado</button>
          </>
        )}
      </div>
      {activeReport ? (
        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard label="Eventos" value={String(activeReport.detectedEvents)} />
          <KpiCard label="Valor evitado" value={brl(activeReport.avoidedLossBRL)} tone="green" />
          <KpiCard label="ROI" value={`${Math.round(activeReport.roiPercent)}%`} tone="green" />
          <KpiCard label="Status" value={activeReport.status} />
        </div>
      ) : (
        <Panel title="Relatorio mensal"><EmptyText text="Nenhum relatorio gerado para o periodo selecionado." /></Panel>
      )}
    </div>
  )
}

function QbrPanel({ events, baseline }: { events: EconomyEvent[]; baseline?: EconomyBaseline }) {
  const quarterEvents = events.filter((event) => event.status !== 'dismissed').slice(0, 30)
  const total = quarterEvents.reduce((sum, event) => sum + event.impactBRL, 0)
  const fee = (baseline?.platformMonthlyFeeBRL ?? 5000) * 3
  return (
    <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <div className="grid gap-3">
        <KpiCard label="Valor no trimestre" value={brl(total)} tone="green" />
        <KpiCard label="Custo no trimestre" value={brl(fee)} />
        <KpiCard label="ROI trimestral" value={`${Math.round(fee > 0 ? ((total - fee) / fee) * 100 : 0)}%`} tone="green" />
      </div>
      <Panel title="Base para renovacao e upsell">
        <div className="grid gap-3 md:grid-cols-3">
          <QbrItem label="Baseline PPC" before={`${baseline?.ppcPercent ?? 0}%`} after="resultado atual no relatorio" />
          <QbrItem label="Desvio de material" before={`${baseline?.materialDeviationPercent ?? 0}%`} after={`${baseline?.targetMaterialDeviationPercent ?? 0}% meta`} />
          <QbrItem label="Eventos validados" before="0" after={String(quarterEvents.filter((event) => event.status === 'validated' || event.status === 'reported').length)} />
        </div>
      </Panel>
    </div>
  )
}

function KpiCard({ label, value, tone, icon: Icon = BadgeDollarSign }: { label: string; value: string; tone?: 'green' | 'red'; icon?: typeof BadgeDollarSign }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#242424] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[#a3a3a3]">{label}</span>
        <Icon size={16} className="text-[#f97316]" />
      </div>
      <p className={`mt-3 text-2xl font-semibold ${tone === 'green' ? 'text-emerald-300' : tone === 'red' ? 'text-red-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#525252] bg-[#242424]">
      <div className="border-b border-[#525252] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function HorizontalBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(4, Math.min(100, (value / max) * 100))
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-[#d4d4d4]">{label}</span>
        <span className="font-semibold text-emerald-300">{brl(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#333333]">
        <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#a3a3a3]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-white outline-none focus:border-[#f97316]"
      />
    </label>
  )
}

function StatusPill({ status }: { status: EconomyEventStatus }) {
  const cls = status === 'validated' || status === 'reported'
    ? 'bg-emerald-500/10 text-emerald-300'
    : status === 'dismissed'
      ? 'bg-red-500/10 text-red-300'
      : 'bg-amber-500/10 text-amber-300'
  return <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${cls}`}>{STATUS_LABELS[status]}</span>
}

function QbrItem({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
      <p className="text-xs text-[#a3a3a3]">{label}</p>
      <p className="mt-2 text-sm text-[#d4d4d4]">Antes: {before}</p>
      <p className="mt-1 text-sm font-semibold text-emerald-300">Depois: {after}</p>
    </div>
  )
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-[#a3a3a3]">{text}</p>
}

function groupValue(events: EconomyEvent[], label: (event: EconomyEvent) => string) {
  const map = new Map<string, number>()
  for (const event of events) map.set(label(event), (map.get(label(event)) ?? 0) + event.impactBRL)
  return Array.from(map.entries())
    .map(([rowLabel, value]) => ({ label: rowLabel, value }))
    .sort((a, b) => b.value - a.value)
}

function num(value: string) {
  return Number(value) || 0
}

const selectClass = 'h-9 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-white outline-none focus:border-[#f97316]'
const primaryButtonClass = 'inline-flex h-9 items-center rounded-lg bg-[#f97316] px-3 text-sm font-semibold text-white hover:bg-[#ea580c]'
const secondaryButtonClass = 'inline-flex h-9 items-center rounded-lg border border-[#525252] px-3 text-sm font-medium text-[#e5e5e5] hover:border-[#f97316]/60 hover:text-white'
