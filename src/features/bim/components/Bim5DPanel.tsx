import { useBimStore } from '@/store/bimStore'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function Bim5DPanel() {
  const project = useBimStore((s) => s.project)
  const setColorMode = useBimStore((s) => s.setColorMode)

  if (!project) {
    return (
      <div className="h-28 bg-gray-900 border-t border-gray-800 flex items-center justify-center">
        <p className="text-gray-600 text-xs">Carregue um projeto para usar a análise 5D</p>
      </div>
    )
  }

  const segs = project.segments
  const totalCost = segs.reduce((sum, s) => sum + s.totalCostBRL, 0)
  const totalLength = segs.reduce((sum, s) => sum + s.lengthM, 0)

  // Group by material
  const byMaterial = segs.reduce<Record<string, { cost: number; count: number }>>((acc, s) => {
    const mat = s.material || 'N/A'
    if (!acc[mat]) acc[mat] = { cost: 0, count: 0 }
    acc[mat].cost += s.totalCostBRL
    acc[mat].count += 1
    return acc
  }, {})

  // Group by diameter class
  const byDiam = segs.reduce<Record<string, { cost: number; count: number }>>((acc, s) => {
    const dn = `DN${s.diameter}`
    if (!acc[dn]) acc[dn] = { cost: 0, count: 0 }
    acc[dn].cost += s.totalCostBRL
    acc[dn].count += 1
    return acc
  }, {})

  const matEntries = Object.entries(byMaterial).sort((a, b) => b[1].cost - a[1].cost)
  const diamEntries = Object.entries(byDiam).sort((a, b) => b[1].cost - a[1].cost)

  return (
    <div className="h-28 bg-gray-900 border-t border-gray-800 flex items-start gap-6 px-4 py-2 shrink-0 overflow-x-auto">
      {/* Total cost card */}
      <div className="flex flex-col shrink-0">
        <span className="text-gray-400 text-xs font-semibold mb-0.5">Análise 5D — Custo</span>
        <span className="text-green-400 font-bold text-lg leading-tight">{fmtBRL(totalCost)}</span>
        <span className="text-gray-500 text-xs">
          {totalLength > 0 ? fmtBRL(Math.round(totalCost / totalLength)) : '—'}/m médio
        </span>
        <button
          onClick={() => setColorMode('cost')}
          className="mt-1.5 px-2 py-0.5 rounded text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition-colors w-fit"
        >
          Ver heatmap
        </button>
      </div>

      {/* Divider */}
      <div className="w-px bg-gray-800 self-stretch shrink-0" />

      {/* By material */}
      <div className="shrink-0">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Por Material</p>
        <div className="space-y-0.5">
          {matEntries.slice(0, 4).map(([mat, { cost, count }]) => (
            <div key={mat} className="flex items-center gap-2">
              <span className="text-gray-300 text-xs w-16 truncate">{mat}</span>
              <span className="text-gray-500 text-xs">({count} seg.)</span>
              <span className="text-green-400 text-xs font-medium">{fmtBRL(cost)}</span>
              <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${totalCost > 0 ? (cost / totalCost) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-gray-800 self-stretch shrink-0" />

      {/* By diameter */}
      <div className="shrink-0">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Por Diâmetro</p>
        <div className="space-y-0.5">
          {diamEntries.slice(0, 4).map(([dn, { cost, count }]) => (
            <div key={dn} className="flex items-center gap-2">
              <span className="text-gray-300 text-xs w-14 truncate">{dn}</span>
              <span className="text-gray-500 text-xs">({count} seg.)</span>
              <span className="text-indigo-400 text-xs font-medium">{fmtBRL(cost)}</span>
              <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${totalCost > 0 ? (cost / totalCost) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cost scale legend */}
      <div className="shrink-0 ml-auto">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Escala de Cor</p>
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-xs">Baixo</span>
          <div className="w-24 h-3 rounded" style={{
            background: 'linear-gradient(to right, #f9fafb, #f97316, #ef4444)',
          }} />
          <span className="text-gray-500 text-xs">Alto</span>
        </div>
        <p className="text-gray-600 text-xs mt-0.5">custo/m lineal</p>
      </div>
    </div>
  )
}
