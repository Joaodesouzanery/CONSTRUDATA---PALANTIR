/**
 * P6CpmPanel.tsx — Primavera P6 CPM Schedule panel.
 *
 * Split layout:
 *   LEFT  (380px) — classic P6 activity table with 14 columns
 *   RIGHT (fluid) — SVG Gantt with red/blue bars, diamonds, dependency arrows
 *
 * Toolbar: Import XER, Export XER, Compute CPM, Zoom controls, Filters
 */
import { useRef, useState, useMemo, useCallback } from 'react'
import {
  Upload, Download, GitFork, ZoomIn, ZoomOut,
  AlertTriangle, Filter,
} from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import type { MasterActivity } from '@/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function iso(d: string | undefined) {
  return d ?? ''
}

function fmt(d: string | undefined) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('pt-BR') } catch { return d }
}

function daysBetween(a: string, b: string): number {
  if (!a || !b) return 0
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function addDays(iso: string, n: number): string {
  if (!iso) return ''
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function floatColor(tf: number | undefined) {
  if (tf === undefined) return 'text-[#a3a3a3]'
  if (tf <= 0)  return 'text-red-400 font-bold'
  if (tf <= 5)  return 'text-yellow-400'
  return 'text-[#a3a3a3]'
}

// ─── Zoom levels ─────────────────────────────────────────────────────────────

const ZOOM_LEVELS = [
  { label: 'Dia',  px: 8 },
  { label: 'Sem',  px: 4 },
  { label: 'Mês',  px: 2 },
  { label: 'Trim', px: 0.5 },
]

// ─── Gantt SVG ───────────────────────────────────────────────────────────────

const ROW_H = 28
const HEADER_H = 40

interface GanttProps {
  activities: MasterActivity[]
  projectStart: string
  projectEnd: string
  pxPerDay: number
}

function GanttSvg({ activities, projectStart, projectEnd, pxPerDay }: GanttProps) {
  const totalDays = Math.max(daysBetween(projectStart, projectEnd), 1)
  const width     = totalDays * pxPerDay + 40
  const height    = HEADER_H + activities.length * ROW_H + 20

  // Time scale markers
  const months: Array<{ label: string; x: number }> = []
  const cur = new Date(projectStart)
  cur.setDate(1)
  while (cur.toISOString().split('T')[0] <= projectEnd) {
    const x = daysBetween(projectStart, cur.toISOString().split('T')[0]) * pxPerDay
    months.push({
      label: cur.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      x,
    })
    cur.setMonth(cur.getMonth() + 1)
  }

  // Build activity id/code map for dependency lines
  const actMap = new Map<string, MasterActivity>()
  activities.forEach((a, i) => {
    actMap.set(a.id, { ...a, _rowIdx: i } as MasterActivity & { _rowIdx: number })
    if (a.activityCode) actMap.set(a.activityCode, { ...a, _rowIdx: i } as MasterActivity & { _rowIdx: number })
  })

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', minWidth: width }}
    >
      {/* Background */}
      <rect width={width} height={height} fill="#1a1a1a" />

      {/* Month grid lines + labels */}
      {months.map((m) => (
        <g key={m.x}>
          <line x1={m.x} y1={0} x2={m.x} y2={height} stroke="#3d3d3d" strokeWidth={1} />
          <text x={m.x + 4} y={16} fill="#6b6b6b" fontSize={9}>{m.label}</text>
        </g>
      ))}

      {/* Today line */}
      {(() => {
        const todayX = daysBetween(projectStart, new Date().toISOString().split('T')[0]) * pxPerDay
        if (todayX < 0 || todayX > width) return null
        return <line x1={todayX} y1={HEADER_H} x2={todayX} y2={height} stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2" />
      })()}

      {/* Row backgrounds */}
      {activities.map((_, i) => (
        <rect
          key={i}
          x={0} y={HEADER_H + i * ROW_H}
          width={width} height={ROW_H}
          fill={i % 2 === 0 ? '#1f1f1f' : '#1a1a1a'}
        />
      ))}

      {/* Activity bars */}
      {activities.map((a, i) => {
        const start = a.earlyStart || a.plannedStart
        const end   = a.earlyFinish || a.plannedEnd
        if (!start || !end) return null

        const x  = Math.max(0, daysBetween(projectStart, start) * pxPerDay)
        const w  = Math.max(2, daysBetween(start, end) * pxPerDay)
        const y  = HEADER_H + i * ROW_H + 4
        const bh = ROW_H - 8
        const cx = x + w / 2

        if (a.isMilestone) {
          const diamond = `${cx},${y} ${cx + 8},${y + bh / 2} ${cx},${y + bh} ${cx - 8},${y + bh / 2}`
          return (
            <g key={a.id}>
              <polygon points={diamond} fill={a.isCritical ? '#ef4444' : '#f97316'} />
            </g>
          )
        }

        const barColor = a.isCritical ? '#ef4444' : '#3b82f6'
        const progress = Math.min(100, a.percentComplete ?? 0)

        return (
          <g key={a.id}>
            {/* Background bar */}
            <rect x={x} y={y} width={w} height={bh} fill={barColor} opacity={0.35} rx={2} />
            {/* Progress overlay */}
            {progress > 0 && (
              <rect x={x} y={y} width={w * progress / 100} height={bh} fill={barColor} opacity={0.85} rx={2} />
            )}
            {/* Label (only if bar wide enough) */}
            {w > 30 && (
              <text x={x + 4} y={y + bh - 3} fill="white" fontSize={8} opacity={0.9}>
                {progress}%
              </text>
            )}
          </g>
        )
      })}

      {/* Dependency arrows (FS only for clarity — others drawn as simple lines) */}
      {activities.map((a, i) => {
        const succStart = a.earlyStart || a.plannedStart
        if (!succStart) return null
        const succX = daysBetween(projectStart, succStart) * pxPerDay
        const succY = HEADER_H + i * ROW_H + ROW_H / 2

        return (a.predecessors ?? []).map((p) => {
          const pred = actMap.get(p.activityId) as (MasterActivity & { _rowIdx?: number }) | undefined
          if (!pred || pred._rowIdx === undefined) return null
          const predEnd   = pred.earlyFinish || pred.plannedEnd
          if (!predEnd) return null
          const predX = daysBetween(projectStart, addDays(predEnd, p.lag ?? 0)) * pxPerDay
          const predY = HEADER_H + pred._rowIdx * ROW_H + ROW_H / 2

          return (
            <g key={`${a.id}-${p.activityId}`} opacity={0.5}>
              <line x1={predX} y1={predY} x2={succX} y2={succY} stroke="#6b6b6b" strokeWidth={1} />
              {/* Arrow head */}
              <polygon
                points={`${succX},${succY} ${succX - 5},${succY - 3} ${succX - 5},${succY + 3}`}
                fill="#6b6b6b"
              />
            </g>
          )
        })
      })}
    </svg>
  )
}

// ─── Filter state ─────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'critical' | 'in_progress' | 'milestones'

// ─── Main panel ──────────────────────────────────────────────────────────────

export function P6CpmPanel() {
  const activities   = usePlanejamentoMestreStore((s) => s.activities)
  const computeCPMFn = usePlanejamentoMestreStore((s) => s.computeCPM)
  const importFromXer = usePlanejamentoMestreStore((s) => s.importFromXer)
  const exportToXerFn = usePlanejamentoMestreStore((s) => s.exportToXer)

  const [zoomIdx, setZoomIdx]   = useState(1)
  const [filter, setFilter]     = useState<FilterKey>('all')
  const [computed, setComputed] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const ganttRef = useRef<HTMLDivElement>(null)

  const pxPerDay = ZOOM_LEVELS[zoomIdx].px

  // Project date range
  const { projectStart, projectEnd } = useMemo(() => {
    const starts  = activities.map((a) => a.earlyStart || a.plannedStart).filter(Boolean)
    const ends    = activities.map((a) => a.earlyFinish || a.plannedEnd).filter(Boolean)
    const today   = new Date().toISOString().split('T')[0]
    return {
      projectStart: starts.length ? [...starts].sort()[0]    : today,
      projectEnd:   ends.length   ? [...ends].sort().reverse()[0] : today,
    }
  }, [activities])

  // Filtered list
  const visible = useMemo(() => {
    let list = activities
    if (filter === 'critical')    list = list.filter((a) => a.isCritical)
    if (filter === 'in_progress') list = list.filter((a) => a.status === 'in_progress')
    if (filter === 'milestones')  list = list.filter((a) => a.isMilestone)
    return list
  }, [activities, filter])

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      if (content) {
        importFromXer(content)
        setComputed(false)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [importFromXer])

  const handleExport = useCallback(() => {
    const xer = exportToXerFn()
    const blob = new Blob([xer], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'construdata_p6.xer'
    a.click()
    URL.revokeObjectURL(url)
  }, [exportToXerFn])

  const handleComputeCPM = useCallback(() => {
    computeCPMFn()
    setComputed(true)
  }, [computeCPMFn])

  const criticalCount = activities.filter((a) => a.isCritical).length

  return (
    <div className="flex flex-col h-full gap-0 bg-[#1a1a1a]">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-[#2c2c2c] border-b border-[#525252]">

        {/* Import XER */}
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#3d3d3d] text-[#f5f5f5] text-xs hover:bg-[#525252] transition-colors"
        >
          <Upload size={13} /> Importar XER
        </button>
        <input ref={fileRef} type="file" accept=".xer" className="hidden" onChange={handleImport} />

        {/* Export XER */}
        <button
          onClick={handleExport}
          disabled={activities.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#3d3d3d] text-[#f5f5f5] text-xs hover:bg-[#525252] transition-colors disabled:opacity-40"
        >
          <Download size={13} /> Exportar XER
        </button>

        {/* Compute CPM */}
        <button
          onClick={handleComputeCPM}
          disabled={activities.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#f97316] text-white text-xs hover:bg-[#ea6c0a] transition-colors disabled:opacity-40 font-medium"
        >
          <GitFork size={13} /> Calcular CPM
        </button>

        {computed && criticalCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle size={12} />
            {criticalCount} atividade{criticalCount !== 1 ? 's' : ''} crítica{criticalCount !== 1 ? 's' : ''}
          </span>
        )}

        <div className="flex-1" />

        {/* Filters */}
        <div className="flex items-center gap-1">
          <Filter size={12} className="text-[#6b6b6b]" />
          {(['all', 'critical', 'in_progress', 'milestones'] as FilterKey[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded text-[10px] transition-colors ${
                filter === f
                  ? 'bg-[#f97316] text-white'
                  : 'bg-[#3d3d3d] text-[#a3a3a3] hover:bg-[#525252]'
              }`}
            >
              { f === 'all' ? 'Todos' : f === 'critical' ? 'Crítico' : f === 'in_progress' ? 'Em andamento' : 'Marcos' }
            </button>
          ))}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoomIdx((i) => Math.max(0, i - 1))} className="p-1 rounded bg-[#3d3d3d] text-[#a3a3a3] hover:bg-[#525252]"><ZoomIn size={13} /></button>
          <span className="text-[10px] text-[#6b6b6b] w-8 text-center">{ZOOM_LEVELS[zoomIdx].label}</span>
          <button onClick={() => setZoomIdx((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))} className="p-1 rounded bg-[#3d3d3d] text-[#a3a3a3] hover:bg-[#525252]"><ZoomOut size={13} /></button>
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {activities.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[#6b6b6b]">
          <GitFork size={40} strokeWidth={1} />
          <p className="text-sm">Nenhuma atividade carregada.</p>
          <p className="text-xs">Importe um arquivo <strong>.xer</strong> do Primavera P6 ou use os dados do módulo de Planejamento Macro.</p>
          <button
            onClick={handleComputeCPM}
            className="mt-2 px-4 py-2 rounded bg-[#f97316] text-white text-xs font-medium hover:bg-[#ea6c0a]"
          >
            Calcular CPM com dados atuais
          </button>
        </div>
      )}

      {/* ── Split View ────────────────────────────────────────────────────── */}
      {activities.length > 0 && (
        <div className="flex flex-1 overflow-hidden">

          {/* LEFT TABLE */}
          <div className="w-[480px] min-w-[480px] overflow-y-auto overflow-x-auto border-r border-[#525252]">
            <table className="w-full text-[10px] border-collapse">
              <thead className="sticky top-0 z-10 bg-[#2c2c2c]">
                <tr>
                  {[
                    'ID', 'Atividade', 'WBS', 'Dur Orig', 'Dur Rem',
                    '% Conc', 'ES', 'EF', 'LS', 'LF', 'TF', 'FF', 'Pred', 'Restr',
                  ].map((h) => (
                    <th key={h} className="px-2 py-2 text-left text-[#6b6b6b] border-b border-[#525252] font-medium whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((a, i) => (
                  <tr
                    key={a.id}
                    className={`border-b border-[#2c2c2c] ${
                      i % 2 === 0 ? 'bg-[#1f1f1f]' : 'bg-[#1a1a1a]'
                    } ${a.isCritical ? 'text-red-300' : 'text-[#a3a3a3]'}`}
                  >
                    <td className="px-2 py-1 font-mono whitespace-nowrap">
                      {a.activityCode || a.id.slice(0, 8)}
                    </td>
                    <td className="px-2 py-1 max-w-[120px] truncate" title={a.name}>
                      {a.isMilestone && <span className="mr-1">◆</span>}
                      {a.name}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">{a.wbsCode || '—'}</td>
                    <td className="px-2 py-1 text-right">{a.originalDurationDays ?? a.durationDays ?? '—'}</td>
                    <td className="px-2 py-1 text-right">{a.remainingDurationDays ?? '—'}</td>
                    <td className="px-2 py-1 text-right">{a.percentComplete ?? 0}%</td>
                    <td className="px-2 py-1 whitespace-nowrap">{fmt(iso(a.earlyStart) || iso(a.plannedStart))}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{fmt(iso(a.earlyFinish) || iso(a.plannedEnd))}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{fmt(iso(a.lateStart))}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{fmt(iso(a.lateFinish))}</td>
                    <td className={`px-2 py-1 text-right ${floatColor(a.totalFloat)}`}>
                      {a.totalFloat !== undefined ? a.totalFloat : '—'}
                    </td>
                    <td className="px-2 py-1 text-right">{a.freeFloat !== undefined ? a.freeFloat : '—'}</td>
                    <td className="px-2 py-1 max-w-[80px] truncate text-[#6b6b6b]">
                      {(a.predecessors ?? []).map((p) => `${p.activityId} ${p.relationship}${p.lag ? `+${p.lag}d` : ''}`).join(', ') || '—'}
                    </td>
                    <td className="px-2 py-1 text-[#6b6b6b]">{a.constraintType ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* RIGHT GANTT */}
          <div ref={ganttRef} className="flex-1 overflow-auto bg-[#1a1a1a]">
            {projectStart && projectEnd && (
              <GanttSvg
                activities={visible}
                projectStart={projectStart}
                projectEnd={projectEnd}
                pxPerDay={pxPerDay}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      {activities.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 bg-[#2c2c2c] border-t border-[#525252] text-[9px] text-[#6b6b6b]">
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded inline-block bg-red-500 opacity-70" /> Caminho crítico (TF=0)</span>
          <span className="flex items-center gap-1"><span className="w-4 h-3 rounded inline-block bg-blue-500 opacity-70" /> Atividade normal</span>
          <span className="flex items-center gap-1"><span className="text-[#f97316]">◆</span> Marco</span>
          <span className="flex items-center gap-1"><span className="w-4 h-0.5 inline-block bg-[#f97316]" /> Hoje</span>
        </div>
      )}
    </div>
  )
}
