/**
 * GanttPanel — HTML div-grid Gantt chart for construction scheduling.
 * NOT SVG. Sticky trecho column + sticky header row. Day-column execution grid.
 * Blue cells = execution; Yellow "T" cells = hydrostatic test.
 */
import { Play } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { fmtDate } from '../utils/exportEngine'

const CELL_W = 44       // px per day column
const TRECHO_COL_W = 200 // px for the sticky trecho label column

// Team colors (cycle through for multiple teams)
const TEAM_BG = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899']
const TEAM_BG_LIGHT = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f9a8d4']

function fmtR(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function GanttPanel() {
  const {
    ganttRows, workDays, trechos, teams,
    totalCostBRL, projectEndDate, scheduleConfig,
    isScheduleDirty, runSchedule,
  } = usePlanejamentoStore()

  const groupingMode = scheduleConfig.ganttGroupingMode ?? 'daily_segment'

  const totalMeters = trechos.reduce((s, t) => s + t.lengthM, 0)

  if (ganttRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-gray-500">
        <p className="text-sm">Nenhum planejamento gerado ainda.</p>
        <button
          onClick={runSchedule}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors"
        >
          <Play size={15} />
          Gerar Planejamento
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* KPI strip */}
      <div className="px-6 py-4 bg-gray-900 border-b border-gray-700 flex items-center gap-6 flex-wrap text-sm">
        <Kpi label="Trechos" value={String(trechos.length)} />
        <Kpi label="Total Metros" value={`${totalMeters.toFixed(0)} m`} />
        <Kpi label="Dias Úteis" value={String(workDays.length)} />
        <Kpi label="Início" value={scheduleConfig.startDate ? fmtDate(scheduleConfig.startDate) : '—'} />
        <Kpi label="Término Previsto" value={projectEndDate ? fmtDate(projectEndDate) : '—'} accent={!scheduleConfig.targetEndDate || !projectEndDate || projectEndDate <= scheduleConfig.targetEndDate} warn={!!scheduleConfig.targetEndDate && !!projectEndDate && projectEndDate > scheduleConfig.targetEndDate} />
        {scheduleConfig.targetEndDate && (
          <Kpi label="Data Alvo" value={fmtDate(scheduleConfig.targetEndDate)} />
        )}
        <Kpi label="Custo Total" value={fmtR(totalCostBRL)} accent />
        {isScheduleDirty && (
          <button onClick={runSchedule}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
            <Play size={12} /> Atualizar
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: TRECHO_COL_W + workDays.length * CELL_W + 'px' }}>
          {/* Header row */}
          <div
            className="flex sticky top-0 z-20 bg-gray-800 border-b border-gray-700"
            style={{ paddingLeft: TRECHO_COL_W + 'px' }}
          >
            {workDays.map((d, i) => (
              <div
                key={d}
                style={{ width: CELL_W, minWidth: CELL_W }}
                className="text-center text-xs text-gray-500 py-2 border-r border-gray-700/40 shrink-0"
                title={d}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Trecho rows */}
          {ganttRows.map((row) => {
            const color = TEAM_BG[row.teamIndex % TEAM_BG.length]
            const colorLight = TEAM_BG_LIGHT[row.teamIndex % TEAM_BG_LIGHT.length]
            const teamName = teams[row.teamIndex]?.name ?? `Equipe ${row.teamIndex + 1}`

            return (
              <div key={row.trecho.id} className="flex border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                {/* Sticky trecho label */}
                <div
                  className="sticky left-0 z-10 flex flex-col justify-center bg-gray-900 border-r border-gray-700 px-3 shrink-0"
                  style={{ width: TRECHO_COL_W, minWidth: TRECHO_COL_W }}
                >
                  <div className="text-xs font-medium text-white truncate">{row.trecho.code}</div>
                  {groupingMode === 'by_trecho' && (
                    <div className="text-[10px] text-gray-500 truncate font-mono">{row.startDate} → {row.endDate}</div>
                  )}
                  {groupingMode === 'trecho_activity' && (
                    <div className="text-[10px] text-gray-400 truncate">
                      Esc. → Asst. → Reat. → Teste
                    </div>
                  )}
                  {groupingMode === 'daily_segment' && (
                    <div className="text-xs text-gray-400 truncate">{row.trecho.description}</div>
                  )}
                  <div className="text-xs mt-0.5" style={{ color: colorLight }}>{teamName}</div>
                </div>

                {/* Day cells */}
                {workDays.map((d) => {
                  const cell = row.cells.find((c) => c.date === d)
                  if (!cell) {
                    return (
                      <div
                        key={d}
                        style={{ width: CELL_W, minWidth: CELL_W }}
                        className="border-r border-gray-800/40 shrink-0"
                      />
                    )
                  }
                  if (cell.isHydroTest) {
                    return (
                      <div
                        key={d}
                        style={{ width: CELL_W, minWidth: CELL_W, backgroundColor: '#eab308' }}
                        className="border-r border-gray-700/40 shrink-0 flex items-center justify-center text-xs font-bold text-gray-900 py-2"
                        title={`Teste Hidrostático — ${d}`}
                      >
                        T
                      </div>
                    )
                  }
                  return (
                    <div
                      key={d}
                      style={{ width: CELL_W, minWidth: CELL_W, backgroundColor: color }}
                      className="border-r border-gray-700/20 shrink-0 flex items-center justify-center text-xs text-white py-2 font-medium"
                      title={`${row.trecho.code} — ${cell.metersPlanned.toFixed(1)} m — ${d}`}
                    >
                      {cell.metersPlanned > 0 ? cell.metersPlanned.toFixed(0) : ''}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 bg-gray-900 border-t border-gray-700 flex items-center gap-6 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-sm bg-blue-500 inline-block" /> Execução (metros/dia)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-sm bg-yellow-500 inline-block" /> Teste Hidrostático
        </span>
        {teams.slice(0, 4).map((t, i) => (
          <span key={t.id} className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-sm inline-block" style={{ backgroundColor: TEAM_BG[i] }} />
            {t.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`font-semibold ${warn ? 'text-red-400' : accent ? 'text-orange-400' : 'text-white'}`}>{value}</span>
    </div>
  )
}
