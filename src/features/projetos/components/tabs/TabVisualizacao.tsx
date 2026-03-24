import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import type { Project, BudgetLineType, DesignViewType } from '@/types'
import { lazy, Suspense, useEffect } from 'react'
import { projectToBim } from '../../utils/projectToBim'

// Lazy-load BimCanvas so Three.js is in its own chunk
const BimCanvas = lazy(() =>
  import('@/features/bim/components/BimCanvas').then((m) => ({ default: m.BimCanvas }))
)

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<BudgetLineType, string> = {
  labor:       'Mão de Obra',
  equipment:   'Equipamentos',
  materials:   'Materiais',
  subcontract: 'Subcontratado',
  overhead:    'Custos Fixos',
  other:       'Outros',
}

const BAR_COLORS = {
  budgeted:  '#3b82f6',
  projected: '#f97316',
  spent:     '#22c55e',
}

const PHASE_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#eab308']

// ─── 3D Building View — real BimCanvas ────────────────────────────────────────

function View3D({ project }: { project: Project }) {
  // Inject synthetic BimProject into the bim store when this view mounts
  useEffect(() => {
    const bimProject = projectToBim(project)
    import('@/store/bimStore').then(({ useBimStore }) => {
      const { projects, addProject, setActiveProject } = useBimStore.getState()
      const existing = projects.find((p) => p.id === bimProject.id)
      if (existing) {
        setActiveProject(existing.id)
      } else {
        addProject(bimProject)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const progress = project.executionPhases.length > 0
    ? Math.round(project.executionPhases.reduce((s, p) => s + p.progress, 0) / project.executionPhases.length)
    : 0

  return (
    <div className="flex flex-col gap-2">
      {/* Canvas */}
      <div style={{ height: 420, position: 'relative' }}>
        <Suspense fallback={
          <div className="flex items-center justify-center h-full text-[#3f3f3f] text-xs">
            Carregando modelo 3D...
          </div>
        }>
          <BimCanvas />
        </Suspense>
      </div>
      {/* Footer info */}
      <div className="flex items-center justify-between px-4 pb-3 flex-wrap gap-2">
        <p className="text-[10px] text-[#6b6b6b]">{project.name} — Modelo BIM 3D · arraste para orbitar, scroll para zoom</p>
        <span className="text-xs font-mono text-[#22c55e] font-semibold">Avanço médio: {progress}%</span>
      </div>
    </div>
  )
}

// ─── 4D Timeline View ─────────────────────────────────────────────────────────

function View4D({ project }: { project: Project }) {
  const allPhases = [...project.planningPhases, ...project.executionPhases]
  if (allPhases.length === 0) return <p className="text-center text-xs text-[#3f3f3f] py-10">Sem fases definidas</p>

  const today = new Date()

  // Get overall date range
  const allStarts = allPhases.map((p) => new Date(p.startDate).getTime())
  const allEnds   = allPhases.map((p) => new Date(p.endDate).getTime())
  const rangeStart = Math.min(...allStarts)
  const rangeEnd   = Math.max(...allEnds)
  const totalMs    = rangeEnd - rangeStart || 1

  // Build month labels
  const months: Array<{ label: string; left: number; width: number }> = []
  const d = new Date(rangeStart)
  d.setDate(1)
  while (d.getTime() <= rangeEnd) {
    const mStart = Math.max(d.getTime(), rangeStart)
    const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    const mCapped = Math.min(mEnd, rangeEnd)
    months.push({
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      left:  ((mStart - rangeStart) / totalMs) * 100,
      width: ((mCapped - mStart) / totalMs) * 100,
    })
    d.setMonth(d.getMonth() + 1)
  }

  // Today line
  const todayPct = Math.max(0, Math.min(100, ((today.getTime() - rangeStart) / totalMs) * 100))
  const todayInRange = today.getTime() >= rangeStart && today.getTime() <= rangeEnd

  const ROW_H = 44

  return (
    <div className="flex flex-col gap-3 py-4 px-4">
      {/* Month headers */}
      <div className="flex ml-40 relative h-6">
        {months.map((m, i) => (
          <div
            key={i}
            className="absolute text-[9px] text-[#6b6b6b] font-semibold uppercase tracking-wide border-l border-[#2a2a2a] pl-1 overflow-hidden"
            style={{ left: `${m.left}%`, width: `${m.width}%` }}
          >
            {m.label}
          </div>
        ))}
      </div>

      {/* Phase rows */}
      <div className="flex flex-col gap-1.5">
        {allPhases.map((phase, i) => {
          const start  = new Date(phase.startDate).getTime()
          const end    = new Date(phase.endDate).getTime()
          const left   = ((start - rangeStart) / totalMs) * 100
          const width  = Math.max(1, ((end - start) / totalMs) * 100)
          const color  = PHASE_COLORS[i % PHASE_COLORS.length]
          const isExec = i >= project.planningPhases.length

          return (
            <div key={phase.id} className="flex items-center gap-2" style={{ height: ROW_H }}>
              {/* Phase name */}
              <div className="w-40 shrink-0 flex flex-col justify-center">
                <span className="text-[10px] text-[#a3a3a3] leading-tight truncate">{phase.name}</span>
                <span className="text-[9px] text-[#6b6b6b]">{isExec ? 'Execução' : 'Planejamento'}</span>
              </div>

              {/* Timeline bar */}
              <div className="flex-1 relative bg-[#1a1a1a] rounded-md overflow-visible" style={{ height: 28 }}>
                {/* Grid lines */}
                {months.map((m, mi) => (
                  <div key={mi} className="absolute top-0 h-full border-l border-[#2a2a2a]"
                    style={{ left: `${m.left}%` }} />
                ))}

                {/* Progress fill */}
                <div
                  className="absolute top-0 h-full rounded-md"
                  style={{ left: `${left}%`, width: `${(width * phase.progress) / 100}%`, background: color, opacity: 0.25 }}
                />

                {/* Main bar */}
                <div
                  className="absolute top-1 rounded-md flex items-center px-2 overflow-hidden"
                  style={{ left: `${left}%`, width: `${width}%`, height: 20, background: color, opacity: 0.85 }}
                >
                  <span className="text-[9px] text-white font-semibold whitespace-nowrap">
                    {phase.name.length < 14 ? phase.name : ''} {phase.progress}%
                  </span>
                </div>

                {/* Today line */}
                {todayInRange && (
                  <div
                    className="absolute top-0 h-full w-px z-10"
                    style={{ left: `${todayPct}%`, background: '#f97316', boxShadow: '0 0 4px #f97316' }}
                  />
                )}
              </div>

              {/* End date */}
              <span className="text-[9px] text-[#6b6b6b] w-16 shrink-0 font-mono">
                {phase.endDate.slice(0, 7)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend + Today indicator */}
      <div className="flex items-center gap-4 mt-2 pt-2 border-t border-[#2a2a2a] flex-wrap">
        {project.planningPhases.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: PHASE_COLORS[0] }} />
            <span className="text-[10px] text-[#6b6b6b]">Planejamento</span>
          </div>
        )}
        {project.executionPhases.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: PHASE_COLORS[project.planningPhases.length % PHASE_COLORS.length] }} />
            <span className="text-[10px] text-[#6b6b6b]">Execução</span>
          </div>
        )}
        {todayInRange && (
          <div className="flex items-center gap-1.5">
            <div className="w-px h-3" style={{ background: '#f97316', boxShadow: '0 0 4px #f97316' }} />
            <span className="text-[10px] text-[#f97316]">Hoje</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 5D Cost Chart ────────────────────────────────────────────────────────────

function fmtM(v: number): string {
  if (v >= 1e6)  return `R$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3)  return `R$${(v / 1e3).toFixed(0)}K`
  return `R$${v.toFixed(0)}`
}

function View5D({ project }: { project: Project }) {
  if (project.budgetLines.length === 0) {
    return <p className="text-center text-xs text-[#3f3f3f] py-10">Sem linhas orçamentárias cadastradas</p>
  }

  const vals    = project.budgetLines.flatMap((l) => [l.budgeted, l.projected, l.spent])
  const maxVal  = Math.max(...vals, 1)
  const chartH  = 180
  const barW    = 18
  const gap     = 3
  const groupW  = barW * 3 + gap * 2 + 24
  const leftPad = 64
  const botPad  = 48
  const totalW  = leftPad + project.budgetLines.length * groupW + 20

  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="flex flex-col gap-4 py-4 px-4">
      <div className="overflow-x-auto">
        <svg width={totalW} height={chartH + botPad + 20}>
          {/* Y-axis labels + grid lines */}
          {yTicks.map((t) => {
            const y = chartH - t * chartH
            return (
              <g key={t}>
                <line x1={leftPad} y1={y} x2={totalW - 10} y2={y} stroke="#2a2a2a" strokeWidth={1} />
                <text x={leftPad - 6} y={y + 4} textAnchor="end" fill="#6b6b6b" fontSize="9" fontFamily="monospace">
                  {fmtM(maxVal * t)}
                </text>
              </g>
            )
          })}

          {/* Y-axis line */}
          <line x1={leftPad} y1={0} x2={leftPad} y2={chartH} stroke="#3a3a3a" strokeWidth={1} />

          {project.budgetLines.map((line, gi) => {
            const x = leftPad + gi * groupW + 12
            const bars = [
              { key: 'budgeted',  val: line.budgeted,  color: BAR_COLORS.budgeted  },
              { key: 'projected', val: line.projected, color: BAR_COLORS.projected },
              { key: 'spent',     val: line.spent,     color: BAR_COLORS.spent     },
            ]

            return (
              <g key={line.id}>
                {bars.map((b, bi) => {
                  const h  = (b.val / maxVal) * chartH
                  const bx = x + bi * (barW + gap)
                  const by = chartH - h
                  return (
                    <g key={b.key}>
                      <rect x={bx} y={by} width={barW} height={Math.max(h, 0)} rx={2} fill={b.color} opacity={0.85} />
                      {h > 16 && (
                        <text x={bx + barW / 2} y={by - 3} textAnchor="middle" fill={b.color} fontSize="7" fontFamily="monospace">
                          {fmtM(b.val)}
                        </text>
                      )}
                    </g>
                  )
                })}

                {/* X-axis label */}
                <text
                  x={x + (barW * 3 + gap * 2) / 2}
                  y={chartH + 14}
                  textAnchor="middle"
                  fill="#6b6b6b"
                  fontSize="8"
                  fontFamily="sans-serif"
                >
                  {TYPE_LABEL[line.type]}
                </text>
              </g>
            )
          })}

          {/* X-axis line */}
          <line x1={leftPad} y1={chartH} x2={totalW - 10} y2={chartH} stroke="#3a3a3a" strokeWidth={1} />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 flex-wrap border-t border-[#2a2a2a] pt-3">
        {(['budgeted', 'projected', 'spent'] as const).map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: BAR_COLORS[key] }} />
            <span className="text-[10px] text-[#a3a3a3]">
              {key === 'budgeted' ? 'Orçado' : key === 'projected' ? 'Projetado' : 'Gasto'}
            </span>
          </div>
        ))}
      </div>

      {/* Totals row */}
      <div className="grid grid-cols-3 gap-3">
        {(['budgeted', 'projected', 'spent'] as const).map((key) => {
          const total = project.budgetLines.reduce((s, l) => s + l[key], 0)
          return (
            <div key={key} className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-3 flex flex-col gap-0.5">
              <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">
                {key === 'budgeted' ? 'Total Orçado' : key === 'projected' ? 'Total Projetado' : 'Total Gasto'}
              </span>
              <span className="text-sm font-bold font-mono" style={{ color: BAR_COLORS[key] }}>
                {formatCurrency(total)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TabVisualizacao({ project }: { project: Project }) {
  const activeView    = useProjetosStore((s) => s.activeDesignView)
  const setActiveView = useProjetosStore((s) => s.setActiveDesignView)

  const views: DesignViewType[] = ['3D', '4D', '5D']

  const VIEW_DESCRIPTIONS: Record<DesignViewType, string> = {
    '3D': 'Modelo estrutural do edifício com progresso de andares',
    '4D': 'Cronograma das fases ao longo do tempo (Planejamento + Execução)',
    '5D': 'Comparativo orçamentário: Orçado × Projetado × Gasto',
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tab bar */}
      <div className="flex items-end gap-0 px-5 pt-4 border-b border-[#2a2a2a] shrink-0">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={cn(
              'px-5 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px',
              activeView === v
                ? 'text-[#f97316] border-[#f97316]'
                : 'text-[#6b6b6b] border-transparent hover:text-[#a3a3a3]'
            )}
          >
            {v}
          </button>
        ))}
        <span className="ml-4 text-[10px] text-[#3f3f3f] self-center">
          {VIEW_DESCRIPTIONS[activeView]}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Visualization panel */}
        <div className="mx-5 mt-4 rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] overflow-hidden">
          {activeView === '3D' && <View3D project={project} />}
          {activeView === '4D' && <View4D project={project} />}
          {activeView === '5D' && <View5D project={project} />}
        </div>

        {/* Demands table */}
        {project.demands.length > 0 && (
          <div className="mx-5 mt-4 mb-5 flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[#6b6b6b]">
              Demandas e Custos
            </span>
            <div className="rounded-xl border border-[#2a2a2a] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#2a2a2a] bg-[#161616]">
                    {['Item', 'Quantidade', 'Unidade', 'Custo Unit.', 'Total Estimado'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {project.demands.map((d, i) => (
                    <tr key={d.id} className={cn(i < project.demands.length - 1 && 'border-b border-[#1f1f1f]')}>
                      <td className="px-4 py-3 text-[#f5f5f5]">{d.label}</td>
                      <td className="px-4 py-3 font-mono text-[#a3a3a3]">{d.quantity.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-[#6b6b6b]">{d.unit}</td>
                      <td className="px-4 py-3 font-mono text-[#a3a3a3]">{formatCurrency(d.estimatedCost / d.quantity)}</td>
                      <td className="px-4 py-3 font-mono text-[#f97316] font-semibold">{formatCurrency(d.estimatedCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
