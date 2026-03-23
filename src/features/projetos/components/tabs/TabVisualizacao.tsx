import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import type { Project, BudgetLineType, DesignViewType } from '@/types'

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

// ─── 3D Building View ─────────────────────────────────────────────────────────

function View3D({ project }: { project: Project }) {
  const totalFloors = 12
  const progress = project.executionPhases[0]?.progress ?? 0
  const builtFloors = Math.round((progress / 100) * totalFloors)

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-6">
      <svg
        width="260"
        height="300"
        viewBox="0 0 260 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.6))' }}
      >
        {/* Ground shadow */}
        <ellipse cx="130" cy="285" rx="90" ry="8" fill="#000" opacity="0.4" />

        {/* Building floors — back face (3D right side) */}
        {Array.from({ length: totalFloors }).map((_, i) => {
          const floorIdx = totalFloors - 1 - i
          const y = 40 + floorIdx * 20
          const built = floorIdx < builtFloors
          return (
            <polygon
              key={`side-${i}`}
              points={`190,${y + 4} 220,${y - 10} 220,${y + 10} 190,${y + 24}`}
              fill={built ? '#2a4a2a' : '#1a2a1a'}
              stroke="#333"
              strokeWidth="0.5"
            />
          )
        })}

        {/* Building floors — top face */}
        {Array.from({ length: totalFloors }).map((_, i) => {
          const floorIdx = totalFloors - 1 - i
          const y = 40 + floorIdx * 20
          const built = floorIdx < builtFloors
          if (floorIdx !== builtFloors - 1 && floorIdx !== totalFloors - 1) return null
          return (
            <polygon
              key={`top-${i}`}
              points={`70,${y - 4} 190,${y - 4} 220,${y - 18} 100,${y - 18}`}
              fill={built ? '#4a7a4a' : '#2a3a2a'}
              stroke="#444"
              strokeWidth="0.5"
            />
          )
        })}

        {/* Building floors — front face */}
        {Array.from({ length: totalFloors }).map((_, i) => {
          const floorIdx = totalFloors - 1 - i
          const y = 40 + floorIdx * 20
          const built = floorIdx < builtFloors
          return (
            <rect
              key={`front-${i}`}
              x={70}
              y={y}
              width={120}
              height={20}
              fill={built ? '#1a3a1a' : '#111'}
              stroke={built ? '#22c55e' : '#2a2a2a'}
              strokeWidth="0.5"
            />
          )
        })}

        {/* Windows */}
        {Array.from({ length: totalFloors }).map((_, i) => {
          const floorIdx = totalFloors - 1 - i
          const y = 40 + floorIdx * 20 + 4
          const built = floorIdx < builtFloors
          return Array.from({ length: 4 }).map((_, w) => (
            <rect
              key={`win-${i}-${w}`}
              x={80 + w * 26}
              y={y}
              width={16}
              height={10}
              rx={1}
              fill={built ? '#0f4f0f' : '#1a1a1a'}
              stroke={built ? '#22c55e' : '#333'}
              strokeWidth="0.3"
            />
          ))
        })}

        {/* Progress label */}
        <text x="130" y="275" textAnchor="middle" fill="#22c55e" fontSize="11" fontFamily="monospace">
          {progress}% concluído
        </text>
      </svg>

      <div className="text-center">
        <p className="text-xs text-[#6b6b6b]">
          {builtFloors} de {totalFloors} andares construídos
        </p>
        <p className="text-[10px] text-[#3f3f3f] mt-0.5">{project.name}</p>
      </div>
    </div>
  )
}

// ─── 4D Timeline View ─────────────────────────────────────────────────────────

const PHASE_COLORS = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#eab308']

function View4D({ project }: { project: Project }) {
  const allPhases = [...project.planningPhases, ...project.executionPhases]
  if (allPhases.length === 0) return null

  // Find date range
  const starts = allPhases.map((p) => p.startDate).sort()
  const ends   = allPhases.map((p) => p.endDate).sort()
  const minDate = new Date(starts[0]).getTime()
  const maxDate = new Date(ends[ends.length - 1]).getTime()
  const totalMs = maxDate - minDate || 1

  return (
    <div className="flex flex-col gap-3 py-4 px-2">
      {allPhases.map((phase, i) => {
        const start   = new Date(phase.startDate).getTime()
        const end     = new Date(phase.endDate).getTime()
        const left    = ((start - minDate) / totalMs) * 100
        const width   = Math.max(2, ((end - start) / totalMs) * 100)
        const color   = PHASE_COLORS[i % PHASE_COLORS.length]

        return (
          <div key={phase.id} className="flex items-center gap-3">
            <span className="text-[10px] text-[#a3a3a3] w-36 shrink-0 truncate text-right">{phase.name}</span>
            <div className="flex-1 relative h-6 bg-[#1a1a1a] rounded-md overflow-hidden">
              <div
                className="absolute top-0 h-full rounded-md flex items-center px-2"
                style={{ left: `${left}%`, width: `${width}%`, background: color, opacity: 0.85 }}
              >
                <span className="text-[9px] text-white font-semibold whitespace-nowrap overflow-hidden">
                  {phase.progress}%
                </span>
              </div>
              {/* Progress fill overlay */}
              <div
                className="absolute top-0 h-full rounded-md"
                style={{
                  left: `${left}%`,
                  width: `${(width * phase.progress) / 100}%`,
                  background: color,
                  opacity: 0.3,
                }}
              />
            </div>
            <span className="text-[10px] text-[#6b6b6b] w-10 shrink-0 font-mono">{phase.startDate.slice(0, 7)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── 5D Cost Chart ────────────────────────────────────────────────────────────

function View5D({ project }: { project: Project }) {
  if (project.budgetLines.length === 0) {
    return <p className="text-center text-xs text-[#3f3f3f] py-10">Sem linhas orçamentárias</p>
  }

  const maxVal = Math.max(...project.budgetLines.flatMap((l) => [l.budgeted, l.projected, l.spent]))
  const chartH = 160
  const barW   = 16
  const gap    = 4
  const groupW = barW * 3 + gap * 2 + 16

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="overflow-x-auto">
        <svg
          width={project.budgetLines.length * groupW + 40}
          height={chartH + 50}
          style={{ minWidth: '100%' }}
        >
          {/* Y grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={30}
              y1={chartH - t * chartH}
              x2={project.budgetLines.length * groupW + 40}
              y2={chartH - t * chartH}
              stroke="#2a2a2a"
              strokeWidth={1}
            />
          ))}

          {project.budgetLines.map((line, gi) => {
            const x = 40 + gi * groupW
            const vals = [
              { key: 'budgeted',  val: line.budgeted,  color: BAR_COLORS.budgeted  },
              { key: 'projected', val: line.projected, color: BAR_COLORS.projected },
              { key: 'spent',     val: line.spent,     color: BAR_COLORS.spent     },
            ]
            return (
              <g key={line.id}>
                {vals.map((v, bi) => {
                  const h = maxVal > 0 ? (v.val / maxVal) * chartH : 0
                  return (
                    <rect
                      key={v.key}
                      x={x + bi * (barW + gap)}
                      y={chartH - h}
                      width={barW}
                      height={h}
                      rx={2}
                      fill={v.color}
                      opacity={0.85}
                    />
                  )
                })}
                <text
                  x={x + groupW / 2 - 8}
                  y={chartH + 16}
                  textAnchor="middle"
                  fill="#6b6b6b"
                  fontSize="8"
                  fontFamily="sans-serif"
                >
                  {TYPE_LABEL[line.type].slice(0, 8)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center">
        {(['budgeted', 'projected', 'spent'] as const).map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: BAR_COLORS[key] }} />
            <span className="text-[10px] text-[#a3a3a3] capitalize">
              {key === 'budgeted' ? 'Orçado' : key === 'projected' ? 'Projetado' : 'Gasto'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TabVisualizacao({ project }: { project: Project }) {
  const activeView    = useProjetosStore((s) => s.activeDesignView)
  const setActiveView = useProjetosStore((s) => s.setActiveDesignView)

  const views: DesignViewType[] = ['3D', '4D', '5D']

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 px-5 pt-4 border-b border-[#2a2a2a] shrink-0">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={cn(
              'px-4 py-2 text-xs font-bold rounded-t-lg transition-colors border-b-2 -mb-px',
              activeView === v
                ? 'text-[#f97316] border-[#f97316]'
                : 'text-[#6b6b6b] border-transparent hover:text-[#a3a3a3]'
            )}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-5">
          {/* View content */}
          <div className="rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] overflow-hidden mb-5">
            {activeView === '3D' && <View3D project={project} />}
            {activeView === '4D' && <View4D project={project} />}
            {activeView === '5D' && <View5D project={project} />}
          </div>

          {/* Demands table */}
          {project.demands.length > 0 && (
            <div className="flex flex-col gap-2">
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
                      <tr
                        key={d.id}
                        className={cn('border-[#1f1f1f]', i < project.demands.length - 1 && 'border-b')}
                      >
                        <td className="px-4 py-3 text-[#f5f5f5]">{d.label}</td>
                        <td className="px-4 py-3 font-mono text-[#a3a3a3]">{d.quantity.toLocaleString('pt-BR')}</td>
                        <td className="px-4 py-3 text-[#6b6b6b]">{d.unit}</td>
                        <td className="px-4 py-3 font-mono text-[#a3a3a3]">
                          {formatCurrency(d.estimatedCost / d.quantity)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[#f97316] font-semibold">
                          {formatCurrency(d.estimatedCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
