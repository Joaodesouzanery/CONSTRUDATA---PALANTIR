/**
 * DashboardPanel — S-Curve chart and alert cards for the EVM module.
 */
import { AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'

const W = 900
const H = 400
const PAD = { left: 60, right: 30, top: 20, bottom: 50 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom

const GRID_PCTS = [0, 25, 50, 75, 100]

const SERIES: { key: 'plannedFinancialPct' | 'actualPhysicalPct' | 'earnedValuePct'; color: string; label: string }[] = [
  { key: 'plannedFinancialPct', color: '#38bdf8', label: 'PV — Planejado Financeiro' },
  { key: 'actualPhysicalPct',   color: '#22c55e', label: 'AC — Físico Realizado' },
  { key: 'earnedValuePct',      color: '#f97316', label: 'EV — Valor Agregado' },
]

export function DashboardPanel() {
  const { sCurveData, evmMetrics } = useEvmStore()
  const { CPI, SPI } = evmMetrics
  const n = sCurveData.length

  function toX(i: number) {
    if (n <= 1) return PAD.left
    return PAD.left + (i / (n - 1)) * PLOT_W
  }

  function toY(pct: number) {
    return PAD.top + PLOT_H - (pct / 100) * PLOT_H
  }

  function polylinePoints(key: 'plannedFinancialPct' | 'actualPhysicalPct' | 'earnedValuePct') {
    return sCurveData.map((pt, i) => `${toX(i)},${toY(pt[key])}`).join(' ')
  }

  function monthLabel(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  }

  const costAlert = CPI < 1
  const scheduleAlert = SPI < 1
  const allGood = CPI >= 1 && SPI >= 1

  return (
    <div className="p-6 space-y-6">
      {/* S-Curve Chart */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-5">
        <h2 className="text-[#f5f5f5] text-sm font-semibold mb-4">Curva S Multidimensional</h2>

        {n === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-[#6b6b6b] text-sm">
            Nenhum dado de curva S. Clique em &quot;Carregar Demo&quot; para visualizar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full max-w-[900px] mx-auto"
              style={{ backgroundColor: '#0d1626' }}
            >
              {/* Grid lines */}
              {GRID_PCTS.map((pct) => (
                <g key={pct}>
                  <line
                    x1={PAD.left}
                    y1={toY(pct)}
                    x2={W - PAD.right}
                    y2={toY(pct)}
                    stroke="#1e293b"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 8}
                    y={toY(pct) + 4}
                    fill="#64748b"
                    fontSize={11}
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {pct}%
                  </text>
                </g>
              ))}

              {/* X-axis labels */}
              {sCurveData.map((pt, i) => (
                <text
                  key={pt.date}
                  x={toX(i)}
                  y={H - 8}
                  fill="#64748b"
                  fontSize={10}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {monthLabel(pt.date)}
                </text>
              ))}

              {/* Data polylines */}
              {SERIES.map((s) => (
                <polyline
                  key={s.key}
                  points={polylinePoints(s.key)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}

              {/* Data dots */}
              {SERIES.map((s) =>
                sCurveData.map((pt, i) => (
                  <circle
                    key={`${s.key}-${i}`}
                    cx={toX(i)}
                    cy={toY(pt[s.key])}
                    r={3}
                    fill={s.color}
                  />
                )),
              )}
            </svg>

            {/* Legend */}
            <div className="flex items-center gap-6 justify-center mt-3">
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  <span className="text-[#a3a3a3] text-xs">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {costAlert && (
          <div className="bg-[#3d3d3d] border border-red-700/50 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-900/40 flex items-center justify-center shrink-0">
              <TrendingDown size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-red-400 text-sm font-semibold">Custo acima do planejado</p>
              <p className="text-[#a3a3a3] text-xs mt-1">
                CPI = {CPI.toFixed(2)} — O custo real excede o valor agregado. Revise as contas de custo.
              </p>
            </div>
          </div>
        )}

        {scheduleAlert && (
          <div className="bg-[#3d3d3d] border border-amber-700/50 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-amber-400 text-sm font-semibold">Prazo atrasado</p>
              <p className="text-[#a3a3a3] text-xs mt-1">
                SPI = {SPI.toFixed(2)} — O progresso real está abaixo do planejado. Verifique o cronograma.
              </p>
            </div>
          </div>
        )}

        {allGood && (
          <div className="bg-[#3d3d3d] border border-green-700/50 rounded-xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-900/40 flex items-center justify-center shrink-0">
              <CheckCircle size={16} className="text-green-400" />
            </div>
            <div>
              <p className="text-green-400 text-sm font-semibold">Projeto dentro das metas</p>
              <p className="text-[#a3a3a3] text-xs mt-1">
                CPI = {CPI.toFixed(2)}, SPI = {SPI.toFixed(2)} — Custo e prazo dentro do esperado.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
