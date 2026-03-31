/**
 * ModelViewPanel — Schedule execution view with animated playback.
 * Shows gantt timeline, KPIs, and plays through the schedule day by day.
 */
import { useEffect, useRef, useState } from 'react'
import { X, ExternalLink, Play, Pause, RotateCcw } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'

const TEAM_COLORS = [
  'bg-[#2abfdc]',
  'bg-[#22c55e]',
  'bg-[#f59e0b]',
  'bg-[#8b5cf6]',
  'bg-[#ef4444]',
  'bg-[#06b6d4]',
]

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function ModelViewPanel({ onClose }: { onClose: () => void }) {
  const ganttRows   = usePlanejamentoStore((s) => s.ganttRows)
  const workDays    = usePlanejamentoStore((s) => s.workDays)
  const loadDemoData = usePlanejamentoStore((s) => s.loadDemoData)
  const runSchedule  = usePlanejamentoStore((s) => s.runSchedule)

  const [currentDayIdx, setCurrentDayIdx] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load demo data + run schedule if empty
  useEffect(() => {
    if (ganttRows.length === 0) {
      loadDemoData()
      setTimeout(() => runSchedule(), 50)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Play/pause logic
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentDayIdx((prev) => {
          if (prev >= workDays.length - 1) {
            setIsPlaying(false)
            return prev
          }
          return prev + 1
        })
      }, 150)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPlaying, workDays.length])

  const currentDate = workDays[currentDayIdx] ?? ''
  const totalCost   = ganttRows.reduce((s, r) => s + r.totalCostBRL, 0)
  const totalMeters = ganttRows.reduce((s, r) => s + r.trecho.lengthM, 0)
  const totalDays   = workDays.length

  // Completion: rows whose endDate <= currentDate
  const doneRows = ganttRows.filter((r) => r.endDate && r.endDate <= currentDate).length
  const pctComplete = ganttRows.length > 0 ? Math.round((doneRows / ganttRows.length) * 100) : 0

  return (
    <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-[#0d1117] border-l border-[#20406a] shadow-2xl w-full sm:w-[480px]">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#20406a] flex items-center justify-between shrink-0">
        <div>
          <p className="text-[#f5f5f5] text-sm font-semibold">Execução do Modelo</p>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            {ganttRows.length > 0 ? `${ganttRows.length} trechos · ${totalDays} dias úteis` : 'Carregando dados demo...'}
          </p>
        </div>
        <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={18} /></button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-px bg-[#20406a] border-b border-[#20406a] shrink-0">
        {[
          { label: 'Metros', value: `${totalMeters.toLocaleString('pt-BR')} m` },
          { label: 'Custo Total', value: fmtBRL(totalCost) },
          { label: 'Duração', value: `${totalDays}d` },
          { label: 'Concluído', value: `${pctComplete}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#0d1117] px-3 py-2.5 flex flex-col">
            <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">{label}</span>
            <span className="text-xs font-bold text-[#f5f5f5] tabular-nums mt-0.5">{value}</span>
          </div>
        ))}
      </div>

      {/* Playback controls */}
      <div className="px-4 py-2.5 border-b border-[#20406a] flex items-center gap-3 shrink-0">
        <button
          onClick={() => setIsPlaying((v) => !v)}
          disabled={ganttRows.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2abfdc]/20 hover:bg-[#2abfdc]/30 text-[#2abfdc] text-xs font-semibold transition-colors disabled:opacity-40"
        >
          {isPlaying ? <><Pause size={12} /> Pausar</> : <><Play size={12} /> Play</>}
        </button>
        <button
          onClick={() => { setCurrentDayIdx(0); setIsPlaying(false) }}
          className="p-1.5 rounded-lg border border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3] transition-colors"
          title="Reiniciar"
        >
          <RotateCcw size={13} />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, workDays.length - 1)}
            value={currentDayIdx}
            onChange={(e) => { setCurrentDayIdx(Number(e.target.value)); setIsPlaying(false) }}
            className="flex-1 h-1.5 accent-[#2abfdc]"
          />
          <span className="text-[10px] text-[#a3a3a3] font-mono w-24 text-right shrink-0">
            {currentDate || '—'}
          </span>
        </div>
      </div>

      {/* Schedule timeline */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {ganttRows.length === 0 && (
          <div className="flex items-center justify-center h-32 text-[#3f3f3f] text-xs">
            Carregando cronograma...
          </div>
        )}
        {ganttRows.map((row) => {
          const started  = row.startDate && row.startDate <= currentDate
          const finished = row.endDate && row.endDate <= currentDate
          const isActive = started && !finished

          // Compute fill %
          let fillPct = 0
          if (finished) {
            fillPct = 100
          } else if (started && row.durationDays > 0) {
            const startIdx = workDays.indexOf(row.startDate)
            const elapsed  = currentDayIdx - startIdx
            fillPct = Math.min(100, Math.round((elapsed / row.durationDays) * 100))
          }

          const colorClass = TEAM_COLORS[row.teamIndex % TEAM_COLORS.length]

          return (
            <div
              key={row.trecho.id}
              className={`rounded-lg border p-2.5 transition-all ${
                isActive
                  ? 'border-[#2abfdc]/50 bg-[#2abfdc]/5'
                  : finished
                  ? 'border-[#22c55e]/30 bg-[#22c55e]/5'
                  : 'border-[#20406a] bg-[#112645]'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#2abfdc] shrink-0 animate-pulse" />}
                  {finished && <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] shrink-0" />}
                  {!started && <span className="w-1.5 h-1.5 rounded-full bg-[#20406a] shrink-0" />}
                  <span className="font-mono text-[10px] text-[#6b6b6b] shrink-0">{row.trecho.code}</span>
                  <span className="text-xs text-[#a3a3a3] truncate">{row.trecho.description}</span>
                </div>
                <span className="text-[10px] text-[#6b6b6b] shrink-0 tabular-nums">
                  {row.trecho.lengthM.toLocaleString('pt-BR')} m · {row.durationDays}d
                </span>
              </div>
              <div className="h-1.5 bg-[#0d2040] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${colorClass}`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-[#3f3f3f]">
                <span>{row.startDate}</span>
                <span>{fillPct}%</span>
                <span>{row.endDate}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#20406a] shrink-0 flex items-center justify-between">
        <p className="text-[10px] text-[#3f3f3f]">Dados demo — {ganttRows.length} trechos carregados</p>
        <a
          href="/bim"
          className="flex items-center gap-1.5 text-xs text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
        >
          <ExternalLink size={12} />
          Abrir BIM completo
        </a>
      </div>
    </div>
  )
}
