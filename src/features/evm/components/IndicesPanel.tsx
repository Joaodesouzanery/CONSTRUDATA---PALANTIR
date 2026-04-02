/**
 * IndicesPanel — Performance Indices table with CPI/SPI color coding,
 * interpretation text, sparkline trends, and summary row.
 */
import { useEvmStore } from '@/store/evmStore'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function indexColor(value: number): string {
  if (value >= 1.0) return '#22c55e'
  if (value >= 0.9) return '#eab308'
  return '#ef4444'
}

function interpretation(cpi: number, spi: number): { text: string; color: string } {
  if (cpi >= 1.0 && spi >= 1.0) {
    return { text: 'Dentro do esperado', color: '#22c55e' }
  }
  if (cpi < 0.9 || spi < 0.9) {
    return { text: 'Acima do orçamento / Atrasado', color: '#ef4444' }
  }
  if (cpi < 1.0) {
    return { text: 'Acima do orçamento', color: '#eab308' }
  }
  if (spi < 1.0) {
    return { text: 'Prazo atrasado', color: '#eab308' }
  }
  return { text: 'Abaixo do orçamento', color: '#22c55e' }
}

/** Simple SVG sparkline from a small array of values. */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const W = 80
  const H = 24
  const pad = 2
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * (W - 2 * pad)
      const y = pad + (1 - (v - min) / range) * (H - 2 * pad)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last-point dot */}
      {data.length > 0 && (() => {
        const lastIdx = data.length - 1
        const lx = pad + (lastIdx / (data.length - 1)) * (W - 2 * pad)
        const ly = pad + (1 - (data[lastIdx] - min) / range) * (H - 2 * pad)
        return <circle cx={lx} cy={ly} r={2} fill={color} />
      })()}
    </svg>
  )
}

/** Generate synthetic sparkline history for a measurement, ending at the given value. */
function generateSparklineData(current: number): number[] {
  const points = 5
  const result: number[] = []
  let base = current + (Math.random() - 0.5) * 0.3
  for (let i = 0; i < points - 1; i++) {
    result.push(Math.max(0, base + (Math.random() - 0.5) * 0.15))
    base += (current - base) * 0.4
  }
  result.push(current)
  return result
}

function TrendIcon({ value }: { value: number }) {
  if (value >= 1.0) return <TrendingUp size={14} className="text-green-400" />
  if (value >= 0.9) return <Minus size={14} className="text-yellow-400" />
  return <TrendingDown size={14} className="text-red-400" />
}

export function IndicesPanel() {
  const { measurements, evmMetrics } = useEvmStore()
  const { CPI: overallCPI, SPI: overallSPI } = evmMetrics

  // Build per-activity index data. In real apps this comes from EVM computations per WBS;
  // here we derive synthetic CPI/SPI from the composite score for demonstration.
  const activityIndices = measurements.map((m) => {
    const score = m.compositeScore
    // Synthetic CPI/SPI derived from weights and composite — for demo purposes
    const cpi = 0.7 + score * 1.1
    const spi = 0.65 + score * 1.2
    return {
      id: m.id,
      activityName: m.activityName,
      activityId: m.activityId,
      cpi: Math.round(cpi * 100) / 100,
      spi: Math.round(spi * 100) / 100,
    }
  })

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-[#f5f5f5] text-sm font-semibold">Índices de Desempenho — IDC (CPI) / IDP (SPI)</h2>

      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        {measurements.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-[#6b6b6b] text-sm">
            Nenhuma atividade para exibir. Clique em &quot;Carregar Demo&quot; para visualizar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#525252]">
                  <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-3">Atividade</th>
                  <th className="text-center text-[#a3a3a3] text-xs font-medium px-4 py-3 w-24">IDC (CPI)</th>
                  <th className="text-center text-[#a3a3a3] text-xs font-medium px-4 py-3 w-20">Trend CPI</th>
                  <th className="text-center text-[#a3a3a3] text-xs font-medium px-4 py-3 w-24">IDP (SPI)</th>
                  <th className="text-center text-[#a3a3a3] text-xs font-medium px-4 py-3 w-20">Trend SPI</th>
                  <th className="text-left text-[#a3a3a3] text-xs font-medium px-4 py-3">Interpretação</th>
                </tr>
              </thead>
              <tbody>
                {activityIndices.map((ai) => {
                  const interp = interpretation(ai.cpi, ai.spi)
                  const cpiColor = indexColor(ai.cpi)
                  const spiColor = indexColor(ai.spi)
                  return (
                    <tr key={ai.id} className="border-b border-[#525252]/50 hover:bg-[#484848]/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[#f5f5f5] text-sm">{ai.activityName}</p>
                        <p className="text-[#6b6b6b] text-[10px] font-mono">{ai.activityId}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <TrendIcon value={ai.cpi} />
                          <span className="font-mono text-sm font-semibold" style={{ color: cpiColor }}>
                            {ai.cpi.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Sparkline data={generateSparklineData(ai.cpi)} color={cpiColor} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <TrendIcon value={ai.spi} />
                          <span className="font-mono text-sm font-semibold" style={{ color: spiColor }}>
                            {ai.spi.toFixed(2)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Sparkline data={generateSparklineData(ai.spi)} color={spiColor} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium" style={{ color: interp.color }}>
                          {interp.text}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Summary row */}
              <tfoot>
                <tr className="bg-[#2c2c2c]/70 border-t-2 border-[#525252]">
                  <td className="px-4 py-3">
                    <span className="text-[#f5f5f5] text-sm font-semibold">Geral do Projeto</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <TrendIcon value={overallCPI} />
                      <span className="font-mono text-sm font-bold" style={{ color: indexColor(overallCPI) }}>
                        {overallCPI.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Sparkline data={generateSparklineData(overallCPI)} color={indexColor(overallCPI)} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <TrendIcon value={overallSPI} />
                      <span className="font-mono text-sm font-bold" style={{ color: indexColor(overallSPI) }}>
                        {overallSPI.toFixed(2)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Sparkline data={generateSparklineData(overallSPI)} color={indexColor(overallSPI)} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: interpretation(overallCPI, overallSPI).color }}
                    >
                      {interpretation(overallCPI, overallSPI).text}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full inline-block bg-[#22c55e]" />
          <span className="text-[#a3a3a3] text-xs">&ge; 1.00 — Dentro do esperado</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full inline-block bg-[#eab308]" />
          <span className="text-[#a3a3a3] text-xs">0.90 – 0.99 — Atenção</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full inline-block bg-[#ef4444]" />
          <span className="text-[#a3a3a3] text-xs">&lt; 0.90 — Crítico</span>
        </div>
      </div>
    </div>
  )
}
