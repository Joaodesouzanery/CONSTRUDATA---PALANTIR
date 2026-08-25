import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore, getCertExpiringSoon } from '@/store/maoDeObraStore'
import { useObraScopedLabor } from '../hooks/useObraScopedLabor'
import { computeRup, resolveRupTarget } from '../utils/produtividade'
import { dataLocalISO, hojeLocalISO } from '@/lib/utils'
import { ClipboardCheck } from 'lucide-react'
import { quinzenaAtual, deslocarQuinzena, avaliacaoNaQuinzena } from '../utils/quinzena'

const RUP_SEM_COLOR = { verde: '#22c55e', amarelo: '#f59e0b', vermelho: '#ef4444' } as const

function RupMiniCard({ period }: { period: 'última semana' | 'último mês' | 'este mês' }) {
  const { timecards, rdoExecInPeriod } = useObraScopedLabor()
  const settings = useMaoDeObraStore((s) => s.cltSettings)
  const target = resolveRupTarget(settings)
  const { start, end } = useMemo(() => {
    const e = hojeLocalISO()
    const d = new Date()
    if (period === 'última semana') d.setDate(d.getDate() - 6)
    else if (period === 'este mês') d.setDate(1)
    else d.setDate(d.getDate() - 29)
    return { start: dataLocalISO(d), end: e }
  }, [period])
  const rdo = useMemo(() => rdoExecInPeriod(start, end), [rdoExecInPeriod, start, end])
  const rup = useMemo(() => computeRup(timecards.filter((t) => t.date >= start && t.date <= end), { extraHH: rdo.hh, extraM2: rdo.m2 }, target), [timecards, start, end, rdo, target])
  const color = rup.semaforo ? RUP_SEM_COLOR[rup.semaforo] : '#9a9a9a'
  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-[#adadad] text-xs">Produtividade RUP (homem-hora/m²) · meta TCPO ≤ {target}</p>
        <p className="text-xl font-bold leading-tight" style={{ color }}>{rup.rup != null ? `${rup.rup.toFixed(2)} HH/m²` : '— sem apontamentos/RDO em m²'}</p>
      </div>
      <div className="text-right text-[11px] text-[#c9c9c9]">
        <div>{rup.totalHH.toFixed(0)} HH · {Math.round(rup.totalM2).toLocaleString('pt-BR')} m²</div>
        {rup.rup != null && <div style={{ color }}>{rup.rup <= target ? 'No alvo' : rup.rup <= target * 1.15 ? 'Atenção' : 'Fora do alvo'}</div>}
      </div>
    </div>
  )
}

// ─── Bar Chart — Planned HH vs Actual HH per day (last 7 days) ───────────────

function HHBarChart({ timecards, period }: { timecards: import('@/types').TimecardEntry[]; period: string }) {
  const days: Array<{ label: string; actual: number }> = []

  const periodDays = period === 'última semana' ? 7 : period === 'último mês' ? 30 : 30
  const startDate = (() => {
    const d = new Date()
    if (period === 'este mês') { d.setDate(1); return dataLocalISO(d) }
    d.setDate(d.getDate() - (periodDays - 1))
    return dataLocalISO(d)
  })()

  const displayDays = Math.min(periodDays, period === 'este mês' ? new Date().getDate() : periodDays)
  for (let i = displayDays - 1; i >= 0; i--) {
    const d = new Date()
    if (period === 'este mês') {
      d.setDate(new Date().getDate() - i)
    } else {
      d.setDate(d.getDate() - i)
    }
    const iso = dataLocalISO(d)
    const label = d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })
    const actual = timecards
      .filter((tc) => tc.date === iso)
      .reduce((sum, tc) => sum + tc.hoursWorked, 0)
    days.push({ label, actual })
  }
  void startDate // used for filtering above

  // Planned HH per day (target: 8h × active workers in the day — use max observed as reference)
  const maxActual = Math.max(...days.map((d) => d.actual), 1)
  const plannedPerDay = Math.round(maxActual * 1.15)   // mock: planned is ~15% above actual average

  const chartH = 120

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-4">HH Planejado vs Realizado (7 dias)</p>
      <div className="flex items-end gap-2 h-[120px]">
        {days.map((day, i) => {
          const actualH  = Math.round((day.actual   / plannedPerDay) * chartH)
          const plannedH = chartH   // always full height for planned

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="relative w-full flex items-end justify-center gap-0.5" style={{ height: chartH }}>
                {/* planned bar */}
                <div
                  className="w-[45%] rounded-sm bg-[#3b82f6]/25 border border-[#3b82f6]/40"
                  style={{ height: plannedH }}
                  title={`Planejado: ${plannedPerDay}h`}
                />
                {/* actual bar */}
                <div
                  className="w-[45%] rounded-sm"
                  style={{
                    height: Math.max(4, actualH),
                    backgroundColor: actualH >= plannedH * 0.85 ? '#22c55e' : '#f59e0b',
                  }}
                  title={`Realizado: ${day.actual}h`}
                />
              </div>
              <span className="text-[#adadad] text-[11px] truncate w-full text-center">{day.label}</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 mt-3">
        <span className="flex items-center gap-1.5 text-[#adadad] text-xs">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#3b82f6]/40 inline-block" />
          Planejado
        </span>
        <span className="flex items-center gap-1.5 text-[#adadad] text-xs">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#22c55e] inline-block" />
          Realizado ≥ 85%
        </span>
        <span className="flex items-center gap-1.5 text-[#adadad] text-xs">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b] inline-block" />
          Realizado {'<'} 85%
        </span>
      </div>
    </div>
  )
}

// ─── Physical Progress Summary ────────────────────────────────────────────────

function PhysicalProgressSummary({ progress }: { progress: import('@/types').PhysicalProgress[] }) {
  // Group by activityName, sum planned/reported
  const map = new Map<string, { planned: number; reported: number; unit: string }>()
  for (const p of progress) {
    const ex = map.get(p.activityName)
    if (ex) {
      ex.planned  += p.plannedQty
      ex.reported += p.reportedQty
    } else {
      map.set(p.activityName, { planned: p.plannedQty, reported: p.reportedQty, unit: p.unit })
    }
  }

  const rows = Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v, pct: v.planned > 0 ? Math.round((v.reported / v.planned) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct)   // worst first
    .slice(0, 6)

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-3">Progresso Físico por Atividade</p>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.name} className="flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="text-[#f5f5f5] text-xs truncate max-w-[60%]">{row.name}</span>
              <span
                className="text-xs font-medium"
                style={{ color: row.pct >= 90 ? '#22c55e' : row.pct >= 70 ? '#f59e0b' : '#ef4444' }}
              >
                {row.reported}/{row.planned} {row.unit} ({row.pct}%)
              </span>
            </div>
            <div className="h-1.5 bg-[#525252] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, row.pct)}%`,
                  backgroundColor: row.pct >= 90 ? '#22c55e' : row.pct >= 70 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Cert Expiry Table ────────────────────────────────────────────────────────

function CertExpiryTable({ workers }: { workers: import('@/types').Worker[] }) {
  const expiring = getCertExpiringSoon(workers, 60)

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-3">
        Certificações a Vencer (60 dias)
        {expiring.length > 0 && (
          <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold bg-[#f59e0b]/20 text-[#fbbf24]">
            {expiring.length}
          </span>
        )}
      </p>
      {expiring.length === 0 ? (
        <p className="text-[#adadad] text-sm">Nenhuma certificação vencendo nos próximos 60 dias.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#525252]">
                <th className="text-left text-[#adadad] text-xs font-medium pb-2">Funcionário</th>
                <th className="text-left text-[#adadad] text-xs font-medium pb-2">Certificação</th>
                <th className="text-left text-[#adadad] text-xs font-medium pb-2">Vence em</th>
                <th className="text-left text-[#adadad] text-xs font-medium pb-2">Dias</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((item, i) => (
                <tr key={i} className="border-b border-[#3d3d3d] last:border-0">
                  <td className="py-2 text-[#f5f5f5] text-xs">{item.worker.name}</td>
                  <td className="py-2">
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-[#525252] text-[#f5f5f5]">
                      {item.certType}
                    </span>
                  </td>
                  <td className="py-2 text-[#adadad] text-xs">
                    {new Date(item.expiryDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-2">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: item.daysLeft <= 15 ? '#ef4444' : item.daysLeft <= 30 ? '#f59e0b' : '#22c55e' }}
                    >
                      {item.daysLeft}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

// ─── New HR KPI cards ─────────────────────────────────────────────────────────

function HRKpiCards() {
  const { workers, shifts, absences, workPosts, timecards } = useMaoDeObraStore(
    useShallow((s) => ({
      workers:   s.workers,
      shifts:    s.shifts,
      absences:  s.absences,
      workPosts: s.workPosts,
      timecards: s.timecards,
    }))
  )

  const kpis = useMemo(() => {
    const today     = hojeLocalISO()
    const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return dataLocalISO(d) })()

    const active = workers.filter((w) => w.status === 'active').length
    const total  = workers.length

    const faltasSemana = absences.filter(
      (a) => a.date >= weekStart && a.date <= today && a.type !== 'vacation',
    ).length
    const attendancePct = total > 0 ? Math.round(((total - faltasSemana) / total) * 100) : 100

    const heShifts = shifts.filter((s) => s.type === 'overtime' && s.date >= weekStart && s.date <= today)
    const heHours  = heShifts.reduce((sum, s) => {
      const [sh, sm] = s.startTime.split(':').map(Number)
      const [eh, em] = s.endTime.split(':').map(Number)
      let h = (eh * 60 + em - sh * 60 - sm) / 60
      if (h < 0) h += 24
      return sum + Math.max(0, h - s.breakMinutes / 60)
    }, 0)

    const todayActive = shifts.filter(
      (s) => s.date === today && s.status !== 'cancelled' && s.status !== 'absent',
    )
    const postosDesc = workPosts.filter((p) => {
      const covered = todayActive.filter((s) => s.workFront === p.workFront).length
      return covered < p.minWorkers
    }).length

    // Aderência HH: actual vs planned ratio this week
    const weekTimecards = timecards?.filter((tc: import('@/types').TimecardEntry) => tc.date >= weekStart && tc.date <= today) ?? []
    const actualHH = weekTimecards.reduce((s: number, tc: import('@/types').TimecardEntry) => s + tc.hoursWorked, 0)
    const plannedHH = active * 5 * 8   // 5 work days × 8h
    const adherencePct = plannedHH > 0 ? Math.round((actualHH / plannedHH) * 100) : 100

    // Certificações OK: workers with no expired certs
    const expiring = getCertExpiringSoon(workers, 0) // already expired
    const certOkCount = total - new Set(expiring.map((e: { worker: { id: string } }) => e.worker.id)).size
    const certOkPct = total > 0 ? Math.round((certOkCount / total) * 100) : 100

    return [
      { label: 'Total Colaboradores', value: `${active} / ${total}`, sub: 'ativos / total',    color: '#3b82f6' },
      { label: 'Faltas esta Semana',  value: String(faltasSemana),   sub: `${attendancePct}% presença`, color: faltasSemana === 0 ? '#22c55e' : faltasSemana <= 3 ? '#f59e0b' : '#ef4444' },
      { label: 'HE esta Semana',      value: `${heHours.toFixed(1)}h`, sub: `${heShifts.length} turno(s)`, color: heHours === 0 ? '#22c55e' : heHours <= 20 ? '#f59e0b' : '#ef4444' },
      { label: 'Postos Descobertos',  value: String(postosDesc),     sub: 'hoje',              color: postosDesc === 0 ? '#22c55e' : '#ef4444' },
      { label: 'Aderência HH',        value: `${adherencePct}%`,     sub: `${actualHH.toFixed(0)}h / ${plannedHH}h planej.`, color: adherencePct >= 85 ? '#22c55e' : '#f59e0b' },
      { label: 'Certificações OK',    value: `${certOkPct}%`,        sub: `${certOkCount} / ${total} funcionários`, color: certOkPct >= 90 ? '#22c55e' : certOkPct >= 70 ? '#f59e0b' : '#ef4444' },
    ]
  }, [workers, shifts, absences, workPosts, timecards])

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-3">
          <p className="text-[#adadad] text-xs mb-1">{kpi.label}</p>
          <p className="text-[#f5f5f5] text-xl font-bold leading-tight" style={{ color: kpi.color }}>
            {kpi.value}
          </p>
          <p className="text-[#adadad] text-xs mt-0.5">{kpi.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function DashboardPanel() {
  const { workers, timecards, progress } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, timecards: s.timecards, progress: s.progress }))
  )

  const [period, setPeriod] = useState<'última semana' | 'último mês' | 'este mês'>('última semana')
  const [filterDept, setFilterDept] = useState('')

  const depts = useMemo(() => [...new Set(workers.map((w) => w.department).filter(Boolean))], [workers])

  const filteredWorkers = useMemo(
    () => filterDept ? workers.filter((w) => w.department === filterDept) : workers,
    [workers, filterDept]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg bg-[#3d3d3d] border border-[#525252]">
          {(['última semana', 'último mês', 'este mês'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                period === p ? 'bg-orange-600 text-white' : 'text-[#c9c9c9] hover:text-white'
              }`}>
              {p}
            </button>
          ))}
        </div>
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
          className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] focus:outline-none">
          <option value="">Todos os departamentos</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <HRKpiCards />
      <AvaliacoesDaQuinzena />
      <RupMiniCard period={period} />
      <HHBarChart timecards={timecards} period={period} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PhysicalProgressSummary progress={progress} />
        <CertExpiryTable workers={filteredWorkers} />
      </div>
    </div>
  )
}


/**
 * Avaliações da quinzena — quem falta avaliar.
 *
 * As avaliações eram avulsas: o período era um par de datas digitado à mão, sem ciclo nenhum, e
 * nada dizia quem já tinha sido avaliado nem quando. Dava para criar cinco avaliações do mesmo
 * funcionário no mesmo intervalo e nenhuma para o resto da equipe, sem que a tela notasse.
 *
 * Quinzena de calendário (1–15 e 16 ao fim do mês) porque é assim que a folha e a medição deste
 * produto fecham; a definição e o porquê estão em `utils/quinzena.ts`.
 */
function AvaliacoesDaQuinzena() {
  const { workers, assessments } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, assessments: s.assessments })),
  )
  const [deslocamento, setDeslocamento] = useState(0)
  const q = useMemo(() => deslocarQuinzena(quinzenaAtual(), deslocamento), [deslocamento])

  const { avaliados, pendentes } = useMemo(() => {
    // Só quem está ativo entra na cobrança — desligado não se avalia.
    const ativos = workers.filter((w) => w.status !== 'inactive')
    const feitos = new Set(
      assessments.filter((a) => avaliacaoNaQuinzena(a, q)).map((a) => a.workerId),
    )
    return {
      avaliados: ativos.filter((w) => feitos.has(w.id)),
      pendentes: ativos.filter((w) => !feitos.has(w.id)),
    }
  }, [workers, assessments, q])

  const total = avaliados.length + pendentes.length
  const pct = total > 0 ? Math.round((avaliados.length / total) * 100) : 0

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#c9c9c9]">
          <ClipboardCheck size={13} /> Avaliações da quinzena
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setDeslocamento((d) => d - 1)} title="Quinzena anterior"
            className="rounded border border-[#525252] px-1.5 py-0.5 text-[#c9c9c9] hover:text-white">‹</button>
          <span className="min-w-[11rem] text-center text-[11px] font-semibold text-[#e5e5e5]">{q.rotulo}</span>
          <button onClick={() => setDeslocamento((d) => d + 1)} disabled={deslocamento >= 0} title="Próxima quinzena"
            className="rounded border border-[#525252] px-1.5 py-0.5 text-[#c9c9c9] hover:text-white disabled:opacity-30">›</button>
        </div>
        <span className="text-[11px] text-[#adadad]">
          {q.inicio.slice(8)}/{q.mes.toString().padStart(2, '0')} a {q.fim.slice(8)}/{q.mes.toString().padStart(2, '0')} · {q.diasNaQuinzena} dias
        </span>
        <span className="ml-auto text-sm font-bold tabular-nums text-[#e5e5e5]">
          {avaliados.length}/{total}
          <span className="ml-1 text-[11px] font-normal text-[#adadad]">avaliados</span>
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-2 text-[11px] text-[#adadad]">Nenhum funcionário ativo cadastrado.</p>
      ) : (
        <>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#2c2c2c]">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
          </div>
          {pendentes.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#adadad]">Faltam:</span>
              {pendentes.slice(0, 12).map((w) => (
                <span key={w.id} className="rounded border border-[#525252] bg-[#333333] px-1.5 py-0.5 text-[11px] text-[#d4d4d4]">
                  {w.name}
                </span>
              ))}
              {pendentes.length > 12 && (
                <span className="text-[11px] text-[#adadad]">e mais {pendentes.length - 12}</span>
              )}
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-[#4ade80]">Todos os funcionários ativos avaliados nesta quinzena.</p>
          )}
        </>
      )}
    </div>
  )
}
