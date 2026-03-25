import { useEquipamentosStore } from '@/store/equipamentosStore'

// ─── Hourly rate by equipment type ───────────────────────────────────────────

function hourlyRateForType(type: string): number {
  const HEAVY_TYPES = [
    'Guindaste',
    'Bomba Estacionária',
    'Escavadeira',
    'Escavadeira Hidráulica',
    'Guindaste Torre',
  ]
  return HEAVY_TYPES.some((t) => type.includes(t)) ? 45 : 25
}

// ─── Type groups for the distribution chart ──────────────────────────────────

const TYPE_GROUPS: { label: string; match: (t: string) => boolean; color: string }[] = [
  {
    label: 'Plataforma Elevatória',
    match: (t) => t.toLowerCase().includes('plataforma') || t.toLowerCase().includes('tesoura'),
    color: '#2abfdc',
  },
  {
    label: 'Bomba de Concreto',
    match: (t) => t.toLowerCase().includes('bomba'),
    color: '#3b82f6',
  },
  {
    label: 'Guindaste Torre',
    match: (t) => t.toLowerCase().includes('guindaste'),
    color: '#8b5cf6',
  },
  {
    label: 'Retroescavadeira',
    match: (t) => t.toLowerCase().includes('escavad'),
    color: '#ef4444',
  },
  {
    label: 'Outros',
    match: () => true,
    color: '#6b6b6b',
  },
]

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 bg-[#0d2040] border border-[#20406a] rounded-xl px-5 py-4">
      <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold">
        {label}
      </span>
      <span
        className="text-2xl font-bold leading-tight"
        style={{ color: accent ? '#2abfdc' : '#f5f5f5' }}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-[#6b6b6b]">{sub}</span>}
    </div>
  )
}

// ─── Bar chart for cost distribution ─────────────────────────────────────────

function CostDistributionChart({
  groups,
}: {
  groups: { label: string; cost: number; color: string }[]
}) {
  const SVG_W  = 560
  const SVG_H  = 180
  const LEFT   = 16
  const RIGHT  = 16
  const TOP    = 16
  const BOTTOM = 48   // space for X-axis labels
  const plotW  = SVG_W - LEFT - RIGHT
  const plotH  = SVG_H - TOP - BOTTOM
  const n      = groups.length
  const maxC   = groups.length > 0 ? Math.max(...groups.map((g) => g.cost), 1) : 1
  const groupW = Math.floor(plotW / n)
  const barW   = Math.floor(groupW * 0.55)
  const barGap = Math.floor((groupW - barW) / 2)

  function truncate(s: string, n2 = 14) {
    return s.length > n2 ? s.slice(0, n2 - 1) + '…' : s
  }

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height={SVG_H}
      style={{ display: 'block' }}
    >
      {/* Baseline */}
      <line
        x1={LEFT}
        y1={TOP + plotH}
        x2={LEFT + plotW}
        y2={TOP + plotH}
        stroke="#20406a"
        strokeWidth={1}
      />

      {groups.map((g, i) => {
        const barH  = maxC > 0 ? Math.round((g.cost / maxC) * plotH) : 0
        const x     = LEFT + i * groupW + barGap
        const y     = TOP + plotH - barH
        const cx    = LEFT + i * groupW + groupW / 2

        return (
          <g key={g.label}>
            {/* Bar */}
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={g.color} opacity={0.8} />

            {/* Value above bar */}
            {barH > 14 && (
              <text
                x={cx}
                y={y - 6}
                textAnchor="middle"
                fontSize={9}
                fill="#a3a3a3"
                fontFamily="system-ui, sans-serif"
              >
                {g.cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </text>
            )}

            {/* X-axis label */}
            <text
              x={cx}
              y={TOP + plotH + 14}
              textAnchor="middle"
              fontSize={9}
              fill="#6b6b6b"
              fontFamily="system-ui, sans-serif"
            >
              {truncate(g.label)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CustosPanel() {
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)

  // Build row data
  const rows = equipamentos.map((eq) => {
    const rate    = hourlyRateForType(eq.type)
    const monthly = Math.round(rate * eq.engineHours)
    return { eq, rate, monthly }
  }).sort((a, b) => b.monthly - a.monthly)

  // KPI values
  const totalFleet = rows.reduce((sum, r) => sum + r.monthly, 0)

  const totalHours = equipamentos.reduce((sum, e) => sum + e.engineHours, 0)
  const avgPerHour = totalHours > 0 ? totalFleet / totalHours : 0

  const maxRow = rows.length > 0 ? rows[0] : null

  // Cost distribution by type group
  const groupCosts = TYPE_GROUPS.map((g) => {
    const grouped = rows.filter((r) => g.match(r.eq.type))
    const cost    = grouped.reduce((s, r) => s + r.monthly, 0)
    return { label: g.label, cost, color: g.color }
  })
  // Only show groups with cost > 0 (except the catch-all "Outros")
  const chartGroups = groupCosts.filter((g) => g.cost > 0)

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto h-full">

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="Custo Total Frota"
          value={totalFleet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          sub="Soma estimada mensal"
          accent
        />
        <KpiCard
          label="Custo Médio / Hora"
          value={avgPerHour.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          sub={`${totalHours.toLocaleString('pt-BR')}h totais`}
        />
        <KpiCard
          label="Maior Custo Individual"
          value={
            maxRow
              ? maxRow.monthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : '—'
          }
          sub={maxRow ? maxRow.eq.name : ''}
        />
      </div>

      {/* Distribution chart */}
      <div className="bg-[#0d2040] border border-[#20406a] rounded-xl p-5 flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          Distribuição de Custos por Tipo de Equipamento
        </h2>
        <CostDistributionChart groups={chartGroups} />
      </div>

      {/* Cost table */}
      <div className="bg-[#0d2040] border border-[#20406a] rounded-xl p-5 flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          Custos por Equipamento
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#20406a]">
                {['Equipamento', 'Custo/Hora (R$)', 'Horas Este Mês', 'Custo Mensal (R$)'].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold pb-2 pr-6 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#14294e]">
              {rows.map(({ eq, rate, monthly }) => (
                <tr key={eq.id} className="hover:bg-[#14294e]/50 transition-colors">
                  <td className="py-2.5 pr-6">
                    <div className="flex flex-col">
                      <span className="text-[#f5f5f5] font-medium">{eq.name}</span>
                      <span className="text-[10px] text-[#6b6b6b]">{eq.code} · {eq.type}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-6 text-[#a3a3a3] font-mono">
                    {rate.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-2.5 pr-6 text-[#f5f5f5] font-mono">
                    {eq.engineHours.toLocaleString('pt-BR')}h
                  </td>
                  <td className="py-2.5 pr-6">
                    <span className="text-[#2abfdc] font-semibold font-mono">
                      {monthly.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#20406a]">
                <td colSpan={3} className="pt-2.5 pr-6 text-[10px] text-[#6b6b6b] font-semibold uppercase tracking-widest">
                  Total Frota
                </td>
                <td className="pt-2.5 font-bold text-[#2abfdc] font-mono">
                  {totalFleet.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

    </div>
  )
}
