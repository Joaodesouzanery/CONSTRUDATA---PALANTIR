/**
 * charts — primitivas SVG leves (sem lib) reusadas nos painéis do Predial.
 * Lift dos padrões já existentes no app (DonutChart do RHFinanceiroPanel, TrendLineChart,
 * Sparkline do StatCard), adaptadas à paleta escura do módulo.
 */

export interface Slice { label: string; value: number; color: string }

/** Pizza/donut com legenda. `total` no centro (ou `centerLabel`). */
export function Donut({ data, size = 96, centerLabel }: { data: Slice[]; size?: number; centerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const R = 40, CX = 50, CY = 50
  if (total === 0) return <p className="text-[#6b6b6b] text-xs py-6 text-center">Sem dados.</p>
  const positive = data.filter((d) => d.value > 0)
  const slices = positive.map((d, i) => {
    // Ângulo inicial = -90° + soma dos anteriores (prefix-sum, sem acumulador mutável).
    const start = -Math.PI / 2 + positive.slice(0, i).reduce((s, x) => s + (x.value / total) * 2 * Math.PI, 0)
    const angle = (d.value / total) * 2 * Math.PI
    const end = start + angle
    return {
      ...d,
      x1: CX + R * Math.cos(start), y1: CY + R * Math.sin(start),
      x2: CX + R * Math.cos(end), y2: CY + R * Math.sin(end),
      large: angle > Math.PI ? 1 : 0,
    }
  })
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={`M ${CX} ${CY} L ${s.x1} ${s.y1} A ${R} ${R} 0 ${s.large} 1 ${s.x2} ${s.y2} Z`} fill={s.color} stroke="#2c2c2c" strokeWidth={1} />
        ))}
        <circle cx={CX} cy={CY} r={23} fill="#2c2c2c" />
        <text x={CX} y={CY + (centerLabel ? 0 : 4)} textAnchor="middle" fontSize={13} fontWeight="bold" fill="#f5f5f5">{total}</text>
        {centerLabel && <text x={CX} y={CY + 12} textAnchor="middle" fontSize={7} fill="#a3a3a3">{centerLabel}</text>}
      </svg>
      <div className="space-y-1.5 min-w-0">
        {data.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[11px] text-[#a3a3a3] truncate">{s.label}</span>
            <span className="text-[11px] font-semibold text-[#f5f5f5] ml-auto tabular-nums">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Linha com pontos + rótulos esparsos no eixo X. */
export function LineChart({ points, color = '#f97316', height = 120 }: { points: { label: string; value: number }[]; color?: string; height?: number }) {
  if (points.length === 0) return <p className="text-[#6b6b6b] text-xs py-6 text-center">Sem dados.</p>
  const W = 520, H = height, PAD = 28
  const vals = points.map((p) => p.value)
  const min = Math.min(0, ...vals), max = Math.max(1, ...vals)
  const range = max - min || 1
  const n = points.length
  const x = (i: number) => PAD + (n === 1 ? (W - 2 * PAD) / 2 : (i / (n - 1)) * (W - 2 * PAD))
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - 2 * PAD)
  const poly = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }} preserveAspectRatio="none">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#525252" strokeDasharray="3 3" />
        <polyline points={poly} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.value)} r={2.5} fill={color} />
            {(i === 0 || i === n - 1 || i === Math.floor(n / 2)) && (
              <text x={x(i)} y={H - 8} fill="#6b6b6b" fontSize={9} textAnchor="middle">{p.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}

/** Mini-barras (tendência) para KPIs. */
export function Sparkline({ values, color = '#f97316', width = 60, height = 22 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const bw = width / values.length
  return (
    <svg width={width} height={height} className="block">
      {values.map((v, i) => {
        const h = Math.max(1, (v / max) * height)
        return <rect key={i} x={i * bw} y={height - h} width={Math.max(1, bw - 1)} height={h} rx={0.5} fill={color} opacity={i === values.length - 1 ? 1 : 0.45} />
      })}
    </svg>
  )
}
