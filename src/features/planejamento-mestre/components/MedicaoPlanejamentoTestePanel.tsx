import { useMemo, useState, type ReactNode } from 'react'
import { Activity, ArrowRight, BadgeCheck, Beaker, CalendarClock, GitBranch, LineChart, Lock, RefreshCw, TrendingUp } from 'lucide-react'
import { useMedicaoUnificadaStore, type UnifiedMeasurementMemoryLine } from '@/store/medicaoUnificadaStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import type { MasterActivity } from '@/types'

type LinkedImpact = {
  activity: MasterActivity
  measuredQty: number
  plannedQty: number
  measuredAmount: number
  physicalPct: number
  financialPct: number
  deltaPct: number
  expectedPct: number
  trendDays: number
  status: 'adiantada' | 'no_prazo' | 'risco' | 'atrasada'
  sourceCount: number
  linkLabel: string
}

const statusLabel: Record<LinkedImpact['status'], string> = {
  adiantada: 'Adiantada',
  no_prazo: 'No prazo',
  risco: 'Risco',
  atrasada: 'Atrasada',
}

const statusClass: Record<LinkedImpact['status'], string> = {
  adiantada: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  no_prazo: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  risco: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  atrasada: 'border-red-500/30 bg-red-500/10 text-red-300',
}

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const pct = (value: number) => `${Math.round(value)}%`
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))

function daysBetween(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`).getTime()
  const b = new Date(`${end}T00:00:00`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, Math.ceil((b - a) / 86_400_000))
}

function expectedProgress(activity: MasterActivity) {
  const today = new Date().toISOString().slice(0, 10)
  const total = Math.max(1, daysBetween(activity.plannedStart, activity.plannedEnd))
  const elapsed = daysBetween(activity.plannedStart, today)
  return clamp((elapsed / total) * 100)
}

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function activityQuantity(activity: MasterActivity) {
  return Math.max(1, Number(activity.comprimento || activity.quantidadeLigacoes || (activity.weight ?? 1) * 100 || 100))
}

function makeDemoLines(activities: MasterActivity[]): UnifiedMeasurementMemoryLine[] {
  return activities.slice(0, 5).map((activity, index) => {
    const planned = activityQuantity(activity)
    const ratio = [0.42, 0.68, 0.18, 0.91, 0.33][index] ?? 0.4
    const quantity = Math.round(planned * ratio)
    const unitPrice = activity.networkType === 'agua' ? 340 : activity.networkType === 'esgoto' ? 510 : 220
    return {
      id: `teste-medicao-${activity.id}`,
      period_id: 'periodo-teste',
      service_description: activity.name,
      n_preco: activity.wbsCode,
      unit: activity.unidade ?? (activity.comprimento ? 'm' : 'un'),
      quantity,
      unit_price: unitPrice,
      nucleo: activity.nucleo,
      location_text: activity.local,
      review_status: 'approved',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  })
}

function lineMatchesActivity(line: UnifiedMeasurementMemoryLine, activity: MasterActivity) {
  const haystack = normalize([
    line.service_description,
    line.n_preco,
    line.nucleo,
    line.location_text,
    line.street,
    line.trecho_inicial,
    line.trecho_final,
  ].join(' '))
  const candidates = [
    activity.wbsCode,
    activity.name,
    activity.nucleo,
    activity.local,
    activity.serviceCategory,
    activity.networkType,
  ].map(normalize).filter(Boolean)

  return candidates.some((candidate) => candidate.length >= 2 && haystack.includes(candidate))
}

function buildImpacts(activities: MasterActivity[], approvedLines: UnifiedMeasurementMemoryLine[]): LinkedImpact[] {
  return activities
    .filter((activity) => activity.level >= 1 && !activity.isMilestone)
    .map((activity) => {
      const lines = approvedLines.filter((line) => lineMatchesActivity(line, activity))
      const measuredQty = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
      const measuredAmount = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0), 0)
      const plannedQty = activityQuantity(activity)
      const physicalPct = clamp(Math.max(activity.percentComplete || 0, (measuredQty / plannedQty) * 100))
      const financialBase = Math.max(1, plannedQty * (measuredAmount > 0 && measuredQty > 0 ? measuredAmount / measuredQty : 350))
      const financialPct = clamp((measuredAmount / financialBase) * 100)
      const expectedPct = expectedProgress(activity)
      const deltaPct = physicalPct - (activity.percentComplete || 0)
      const gap = physicalPct - expectedPct
      const trendDays = gap >= -5 ? 0 : Math.min(45, Math.ceil(Math.abs(gap) / 2))
      const status: LinkedImpact['status'] = gap >= 8 ? 'adiantada' : gap >= -5 ? 'no_prazo' : gap >= -15 ? 'risco' : 'atrasada'

      return {
        activity,
        measuredQty,
        plannedQty,
        measuredAmount,
        physicalPct,
        financialPct,
        deltaPct,
        expectedPct,
        trendDays,
        status,
        sourceCount: lines.length,
        linkLabel: lines[0]?.n_preco || lines[0]?.service_description || activity.wbsCode,
      }
    })
    .filter((impact) => impact.sourceCount > 0 || impact.activity.percentComplete > 0)
    .sort((a, b) => b.measuredAmount - a.measuredAmount)
}

export function MedicaoPlanejamentoTestePanel() {
  const [showProjection, setShowProjection] = useState(true)
  const activities = usePlanejamentoMestreStore((state) => state.activities)
  const periods = useMedicaoUnificadaStore((state) => state.periods)
  const memoryLines = useMedicaoUnificadaStore((state) => state.memoryLines)
  const activePeriodId = useMedicaoUnificadaStore((state) => state.activePeriodId)

  const activePeriod = periods.find((period) => period.id === activePeriodId) ?? periods[0]
  const planningActivities = activities.filter((activity) => activity.level >= 1 && !activity.isMilestone)
  const approvedMemory = memoryLines.filter((line) => line.review_status === 'approved' && !line.deleted_at)
  const usingDemoData = approvedMemory.length === 0
  const linesForSimulation = usingDemoData ? makeDemoLines(planningActivities) : approvedMemory

  const impacts = useMemo(() => buildImpacts(planningActivities, linesForSimulation), [planningActivities, linesForSimulation])
  const totalAmount = impacts.reduce((sum, item) => sum + item.measuredAmount, 0)
  const averagePhysical = impacts.length ? impacts.reduce((sum, item) => sum + item.physicalPct, 0) / impacts.length : 0
  const riskCount = impacts.filter((item) => item.status === 'risco' || item.status === 'atrasada').length
  const projectedEndImpact = impacts.reduce((max, item) => Math.max(max, item.trendDays), 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border border-[#525252] bg-[#2c2c2c] p-5">
        <div className="max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-300">
              <Beaker size={12} /> Teste isolado
            </span>
            <span className="inline-flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              <Lock size={12} /> Nao grava baseline
            </span>
          </div>
          <h2 className="text-lg font-bold text-[#f5f5f5]">Medição ditando realizado e tendência do Planejamento</h2>
          <p className="mt-2 text-sm leading-6 text-[#a3a3a3]">
            Este laboratório conecta memória de medição aprovada com atividades do cronograma mestre, calcula avanço físico,
            avanço financeiro, atraso provável e impacto de tendência. A baseline oficial permanece intacta.
          </p>
        </div>
        <button
          onClick={() => setShowProjection((value) => !value)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-xs font-semibold text-[#f5f5f5] hover:border-[#f97316]/50"
        >
          <RefreshCw size={14} />
          {showProjection ? 'Ocultar projeção' : 'Mostrar projeção'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi icon={<BadgeCheck size={16} />} label="Memórias aprovadas" value={String(linesForSimulation.length)} note={usingDemoData ? 'amostra de teste' : activePeriod?.period_label ?? 'período atual'} />
        <Kpi icon={<GitBranch size={16} />} label="Atividades vinculadas" value={String(impacts.length)} note={`${planningActivities.length} atividades no plano`} />
        <Kpi icon={<TrendingUp size={16} />} label="Avanço físico medido" value={pct(averagePhysical)} note="média das atividades vinculadas" />
        <Kpi icon={<LineChart size={16} />} label="Valor medido" value={brl(totalAmount)} note={`${riskCount} atividades em risco/atraso`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="border border-[#525252] bg-[#2c2c2c]">
          <div className="border-b border-[#525252] px-4 py-3">
            <h3 className="text-sm font-bold text-[#f5f5f5]">Caminho operacional</h3>
          </div>
          <div className="grid gap-2 p-4 md:grid-cols-5">
            {[
              ['1', 'Medição fechada', 'período e contrato'],
              ['2', 'Memória aprovada', 'quantidade executada'],
              ['3', 'Vínculo WBS', 'N. preço, núcleo e serviço'],
              ['4', 'Atualiza realizado', 'físico e financeiro'],
              ['5', 'Projeta tendência', 'prazo e curva S'],
            ].map(([step, title, detail], index) => (
              <div key={step} className="relative rounded border border-[#525252] bg-[#1f1f1f] p-3">
                {index < 4 && <ArrowRight className="absolute -right-4 top-1/2 z-10 hidden -translate-y-1/2 text-[#6b6b6b] md:block" size={18} />}
                <div className="mb-3 flex h-7 w-7 items-center justify-center rounded bg-[#f97316] text-xs font-black text-white">{step}</div>
                <p className="text-xs font-bold text-[#f5f5f5]">{title}</p>
                <p className="mt-1 text-[11px] text-[#a3a3a3]">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-[#525252] bg-[#2c2c2c]">
          <div className="border-b border-[#525252] px-4 py-3">
            <h3 className="text-sm font-bold text-[#f5f5f5]">Resultado da simulação</h3>
          </div>
          <div className="space-y-3 p-4">
            <ProjectionLine label="Baseline" value="preservada" tone="text-emerald-300" />
            <ProjectionLine label="Realizado físico" value={pct(averagePhysical)} tone="text-sky-300" />
            <ProjectionLine label="Maior impacto de prazo" value={projectedEndImpact > 0 ? `+${projectedEndImpact} dias` : 'sem impacto'} tone={projectedEndImpact > 0 ? 'text-amber-300' : 'text-emerald-300'} />
            <ProjectionLine label="Modo" value={usingDemoData ? 'dados de teste' : 'dados reais aprovados'} tone="text-orange-300" />
            {showProjection && (
              <div className="mt-4 rounded border border-[#525252] bg-[#1f1f1f] p-3">
                <p className="text-xs font-semibold text-[#f5f5f5]">Regra aplicada neste teste</p>
                <p className="mt-1 text-xs leading-5 text-[#a3a3a3]">
                  Medição aprovada aumenta o realizado. Se o realizado ficar abaixo do esperado pela linha do tempo,
                  o painel projeta atraso em tendência, sem alterar o cronograma oficial.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="overflow-hidden border border-[#525252] bg-[#2c2c2c]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#525252] px-4 py-3">
          <h3 className="text-sm font-bold text-[#f5f5f5]">Atividades impactadas pela medição</h3>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b6b]">somente leitura</span>
        </div>
        {impacts.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#a3a3a3]">
            Crie ou carregue um cronograma para visualizar o caminho de medição para planejamento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-[#1f1f1f] text-[10px] uppercase tracking-widest text-[#6b6b6b]">
                <tr>
                  <th className="px-4 py-3">Atividade</th>
                  <th className="px-4 py-3">Vínculo</th>
                  <th className="px-4 py-3">Medido</th>
                  <th className="px-4 py-3">Avanço</th>
                  <th className="px-4 py-3">Financeiro</th>
                  <th className="px-4 py-3">Esperado</th>
                  <th className="px-4 py-3">Tendência</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3a3a3a]">
                {impacts.map((impact) => (
                  <tr key={impact.activity.id} className="hover:bg-[#3a3a3a]/35">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Activity className="mt-0.5 text-[#f97316]" size={14} />
                        <div>
                          <p className="font-semibold text-[#f5f5f5]">{impact.activity.name}</p>
                          <p className="mt-1 text-[11px] text-[#6b6b6b]">{impact.activity.wbsCode} · {impact.activity.nucleo || impact.activity.networkType || 'sem núcleo'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#a3a3a3]">{impact.linkLabel}</td>
                    <td className="px-4 py-3 text-[#f5f5f5]">{Math.round(impact.measuredQty)} / {Math.round(impact.plannedQty)}</td>
                    <td className="px-4 py-3">
                      <Progress value={impact.physicalPct} accent="#38bdf8" />
                      <p className="mt-1 text-[11px] text-[#6b6b6b]">+{pct(Math.max(0, impact.deltaPct))} vs. plano atual</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#f5f5f5]">{brl(impact.measuredAmount)}</p>
                      <p className="mt-1 text-[11px] text-[#6b6b6b]">{pct(impact.financialPct)} do valor previsto</p>
                    </td>
                    <td className="px-4 py-3 text-[#a3a3a3]">{pct(impact.expectedPct)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[#f5f5f5]">
                        <CalendarClock size={13} className="text-[#f97316]" />
                        {impact.trendDays > 0 ? `+${impact.trendDays} dias` : 'mantém'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded border px-2 py-1 text-[11px] font-semibold ${statusClass[impact.status]}`}>
                        {statusLabel[impact.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Kpi({ icon, label, value, note }: { icon: ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="border border-[#525252] bg-[#2c2c2c] p-4">
      <div className="mb-3 flex items-center justify-between text-[#f97316]">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#6b6b6b]">{label}</span>
      </div>
      <p className="text-2xl font-black text-[#f5f5f5]">{value}</p>
      <p className="mt-1 text-xs text-[#a3a3a3]">{note}</p>
    </div>
  )
}

function ProjectionLine({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#3a3a3a] pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs text-[#a3a3a3]">{label}</span>
      <span className={`text-sm font-bold ${tone}`}>{value}</span>
    </div>
  )
}

function Progress({ value, accent }: { value: number; accent: string }) {
  return (
    <div>
      <div className="h-2 w-32 overflow-hidden rounded bg-[#1f1f1f]">
        <div className="h-full rounded" style={{ width: `${clamp(value)}%`, backgroundColor: accent }} />
      </div>
      <p className="mt-1 text-[11px] font-semibold text-[#f5f5f5]">{pct(value)}</p>
    </div>
  )
}
