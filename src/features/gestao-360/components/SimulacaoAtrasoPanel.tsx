/**
 * SimulacaoAtrasoPanel — "What-if" delay simulation for Gestão 360.
 * Calls generateSchedule() twice (base + with delays) and diffs the results.
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Clock, AlertTriangle, CalendarDays, DollarSign } from 'lucide-react'
import { generateSchedule } from '@/features/planejamento/utils/scheduleEngine'
import type { TrechoDelay, PlanTrecho, GanttRow } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `R$ ${(n / 1_000).toFixed(1)}k`
  return `R$ ${n.toFixed(0)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function daysBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

// ─── Gantt bar chart ──────────────────────────────────────────────────────────

function GanttComparison({
  base, delayed, allDates,
}: {
  base: GanttRow[]
  delayed: GanttRow[]
  allDates: string[]
}) {
  if (base.length === 0 || allDates.length === 0) return null
  const rows = base.slice(0, 15)
  const totalDays = allDates.length
  const W = 500

  function xOf(date: string): number {
    const idx = allDates.indexOf(date)
    if (idx < 0) return 0
    return Math.round((idx / totalDays) * W)
  }
  function wOf(start: string, end: string): number {
    const s = xOf(start)
    const e = xOf(end) + Math.round(W / totalDays)
    return Math.max(3, e - s)
  }

  return (
    <div className="overflow-x-auto">
      <svg width={W + 160} height={rows.length * 26 + 28} className="font-mono text-[10px]">
        {/* Legend */}
        <rect x={W + 10} y={6} width={12} height={10} rx={2} fill="#6b7280" opacity={0.8} />
        <text x={W + 26} y={15} fill="#9ca3af" fontSize={10}>Base</text>
        <rect x={W + 10} y={20} width={12} height={10} rx={2} fill="#f97316" opacity={0.5} />
        <text x={W + 26} y={29} fill="#9ca3af" fontSize={10}>C/ Atrasos</text>

        {rows.map((row, i) => {
          const delayedRow = delayed[i]
          const y = 28 + i * 26
          const bx = xOf(row.startDate)
          const bw = wOf(row.startDate, row.endDate)
          const dx = delayedRow ? xOf(delayedRow.startDate) : bx
          const dw = delayedRow ? wOf(delayedRow.startDate, delayedRow.endDate) : bw
          const label = row.trecho.code.length > 8
            ? row.trecho.code.slice(0, 8) + '…'
            : row.trecho.code

          return (
            <g key={row.trecho.id}>
              {/* Row label */}
              <text x={0} y={y + 10} fill="#9ca3af" fontSize={10}>{label}</text>
              {/* Base bar */}
              <rect x={120 + bx} y={y} width={bw} height={10} rx={2} fill="#6b7280" opacity={0.8} />
              {/* Delayed bar */}
              {delayedRow && (dx !== bx || dw !== bw) && (
                <rect x={120 + dx} y={y + 12} width={dw} height={6} rx={2} fill="#f97316" opacity={0.6} />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface ScheduleSummary {
  endDate: string | null
  workDays: number
  totalCost: number
  ganttRows: GanttRow[]
  allDates: string[]
}

export function SimulacaoAtrasoPanel() {
  const [trechos, setTrechos] = useState<PlanTrecho[]>([])
  const [delays, setDelays]   = useState<TrechoDelay[]>([])
  const [base, setBase]       = useState<ScheduleSummary | null>(null)
  const [delayed, setDelayed] = useState<ScheduleSummary | null>(null)

  // Form state
  const [selCode, setSelCode]     = useState('')
  const [delayDays, setDelayDays] = useState(1)

  // Load trechos from planejamentoStore (lazy)
  useEffect(() => {
    import('@/store/planejamentoStore').then(({ usePlanejamentoStore }) => {
      const s = usePlanejamentoStore.getState()
      setTrechos(s.trechos)
    })
  }, [])

  const runSchedules = useCallback(() => {
    import('@/store/planejamentoStore').then(({ usePlanejamentoStore }) => {
      const s = usePlanejamentoStore.getState()
      if (s.trechos.length === 0 || s.teams.length === 0) return

      const baseResult = generateSchedule(
        s.trechos, s.teams, s.productivityTable, s.scheduleConfig, s.holidays,
      )
      const delayedResult = generateSchedule(
        s.trechos, s.teams, s.productivityTable, s.scheduleConfig, s.holidays, delays,
      )

      // Build full date range covering both schedules
      const allSet = new Set([...baseResult.workDays, ...delayedResult.workDays])
      const allDates = Array.from(allSet).sort()

      setBase({
        endDate:   baseResult.projectEndDate,
        workDays:  baseResult.workDays.length,
        totalCost: baseResult.totalCostBRL,
        ganttRows: baseResult.ganttRows,
        allDates,
      })
      setDelayed({
        endDate:   delayedResult.projectEndDate,
        workDays:  delayedResult.workDays.length,
        totalCost: delayedResult.totalCostBRL,
        ganttRows: delayedResult.ganttRows,
        allDates,
      })
    })
  }, [delays])

  // Recalculate whenever delays change
  useEffect(() => { runSchedules() }, [runSchedules])

  function addDelay() {
    if (!selCode || delayDays < 1) return
    setDelays((prev) => {
      const exists = prev.find((d) => d.trechoCode === selCode)
      if (exists) {
        return prev.map((d) => d.trechoCode === selCode
          ? { ...d, delayDays: d.delayDays + delayDays }
          : d)
      }
      return [...prev, { trechoCode: selCode, delayDays }]
    })
  }

  function removeDelay(code: string) {
    setDelays((prev) => prev.filter((d) => d.trechoCode !== code))
  }

  const deltaDays = base && delayed
    ? daysBetween(base.endDate, delayed.endDate)
    : 0
  const deltaCost = base && delayed
    ? delayed.totalCost - base.totalCost
    : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Section A + B side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Section A — Configure Delays */}
        <div className="bg-[#1f1f1f] border border-[#2a2a2a] rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-[#f5f5f5] text-sm font-semibold flex items-center gap-2">
            <Clock size={14} className="text-[#f97316]" />
            Configurar Atrasos
          </h3>

          <div className="flex gap-2">
            <select
              value={selCode}
              onChange={(e) => setSelCode(e.target.value)}
              className="flex-1 bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
            >
              <option value="">Selecionar trecho…</option>
              {trechos.map((t) => (
                <option key={t.id} value={t.code}>{t.code} — {t.description.slice(0, 30)}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={365}
              value={delayDays}
              onChange={(e) => setDelayDays(Math.max(1, Number(e.target.value)))}
              className="w-16 bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] text-center focus:outline-none focus:border-[#f97316]/60"
            />
            <button
              onClick={addDelay}
              disabled={!selCode}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#f97316] hover:bg-[#ea6a00] text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={12} /> dias
            </button>
          </div>

          {/* Delay list */}
          {delays.length === 0 ? (
            <p className="text-[#6b6b6b] text-xs text-center py-4">
              Nenhum atraso configurado.<br />Selecione um trecho e adicione dias.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {delays.map((d) => (
                <div key={d.trechoCode} className="flex items-center justify-between bg-[#252525] rounded-lg px-3 py-2">
                  <div>
                    <span className="text-[#f5f5f5] text-xs font-mono">{d.trechoCode}</span>
                    <span className="ml-2 text-[#f97316] text-xs font-bold">+{d.delayDays}d</span>
                  </div>
                  <button onClick={() => removeDelay(d.trechoCode)} className="text-[#6b6b6b] hover:text-[#ef4444] transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {delays.length > 0 && (
            <button
              onClick={() => setDelays([])}
              className="text-xs text-[#6b6b6b] hover:text-[#ef4444] transition-colors text-center"
            >
              Limpar todos os atrasos
            </button>
          )}
        </div>

        {/* Section B — Impact KPIs */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 content-start">
          <KpiCard
            icon={<CalendarDays size={14} className="text-[#38bdf8]" />}
            label="Data Original"
            value={fmtDate(base?.endDate ?? null)}
            accent="text-[#38bdf8]"
          />
          <KpiCard
            icon={<CalendarDays size={14} className={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'} />}
            label="Nova Data Final"
            value={fmtDate(delayed?.endDate ?? null)}
            accent={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}
          />
          <KpiCard
            icon={<AlertTriangle size={14} className={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'} />}
            label="Atraso Total"
            value={deltaDays > 0 ? `+${deltaDays} dias` : deltaDays === 0 ? 'Sem atraso' : `${deltaDays} dias`}
            accent={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}
          />
          <KpiCard
            icon={<DollarSign size={14} className={deltaCost > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'} />}
            label="Impacto no Custo"
            value={deltaCost > 0 ? `+${fmtBRL(deltaCost)}` : deltaCost === 0 ? 'Sem impacto' : fmtBRL(deltaCost)}
            accent={deltaCost > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}
          />
          <KpiCard
            icon={<DollarSign size={14} className="text-[#a78bfa]" />}
            label="Custo Base"
            value={fmtBRL(base?.totalCost ?? 0)}
            accent="text-[#a78bfa]"
          />
          <KpiCard
            icon={<DollarSign size={14} className="text-[#f97316]" />}
            label="Custo C/ Atrasos"
            value={fmtBRL(delayed?.totalCost ?? 0)}
            accent="text-[#f97316]"
          />
          <KpiCard
            icon={<Clock size={14} className="text-[#a3a3a3]" />}
            label="Dias Úteis Base"
            value={String(base?.workDays ?? 0)}
            accent="text-[#a3a3a3]"
          />
          <KpiCard
            icon={<Clock size={14} className={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'} />}
            label="Dias Úteis C/ Atrasos"
            value={String(delayed?.workDays ?? 0)}
            accent={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}
          />
        </div>
      </div>

      {/* Section C — Gantt Comparativo */}
      {base && delayed && base.ganttRows.length > 0 && (
        <div className="bg-[#1f1f1f] border border-[#2a2a2a] rounded-xl p-4">
          <h3 className="text-[#f5f5f5] text-sm font-semibold mb-3 flex items-center gap-2">
            <CalendarDays size={14} className="text-[#f97316]" />
            Gantt Comparativo
            <span className="text-[#6b6b6b] text-xs font-normal">(primeiros 15 trechos)</span>
          </h3>
          <GanttComparison
            base={base.ganttRows}
            delayed={delayed.ganttRows}
            allDates={base.allDates}
          />
        </div>
      )}

      {trechos.length === 0 && (
        <div className="bg-[#1f1f1f] border border-[#2a2a2a] rounded-xl p-8 text-center">
          <Clock size={32} className="text-[#6b6b6b] mx-auto mb-3" />
          <p className="text-[#6b6b6b] text-sm">
            Nenhum trecho encontrado no módulo Planejamento.
          </p>
          <p className="text-[#6b6b6b] text-xs mt-1">
            Acesse <span className="text-[#f97316]">/planejamento</span> e cadastre trechos para usar a simulação.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="bg-[#1f1f1f] border border-[#2a2a2a] rounded-xl px-3 py-3 flex items-center gap-2">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-[#252525]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[#6b6b6b] text-[10px] truncate">{label}</p>
        <p className={`text-sm font-bold leading-tight truncate ${accent}`}>{value}</p>
      </div>
    </div>
  )
}
