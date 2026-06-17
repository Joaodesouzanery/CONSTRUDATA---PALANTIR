import { useMemo } from 'react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { buildEventLog } from '../utils/buildEventLog'

export function GargalosPanel() {
  const sites = useTorreStore((s) => s.sites) ?? []
  const events = useMemo(() => buildEventLog(), [])

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const ranking = useMemo(() => {
    return sites
      .map((site) => ({
        id: site.id,
        name: site.name,
        count: events.filter((e) => e.obraId === site.id && e.timestamp >= thirtyDaysAgo).length,
      }))
      .sort((a, b) => a.count - b.count)
  }, [sites, events, thirtyDaysAgo])

  const max = Math.max(...ranking.map((r) => r.count), 1)

  const getColor = (count: number) => {
    if (count < 5) return '#ef4444'
    if (count <= 15) return '#eab308'
    return '#22c55e'
  }

  const getLabel = (count: number) => {
    if (count < 5) return 'Crítico'
    if (count <= 15) return 'Atenção'
    return 'Normal'
  }

  return (
    <div className="space-y-3">
      <p className="text-[#a3a3a3] text-sm mb-4">
        Obras com menos eventos nos últimos 30 dias aparecem primeiro (maior gargalo).
      </p>
      {ranking.length === 0 && (
        <div className="text-center text-[#6b6b6b] py-8">Nenhuma obra cadastrada</div>
      )}
      {ranking.map((item) => (
        <div key={item.id} className="bg-[#2c2c2c] rounded-lg p-4 border border-[#525252]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#f5f5f5] font-medium text-sm">{item.name}</span>
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${getColor(item.count)}22`, color: getColor(item.count) }}
              >
                {getLabel(item.count)}
              </span>
              <span className="text-[#a3a3a3] text-xs">{item.count} eventos</span>
            </div>
          </div>
          <div className="w-full h-2 bg-[#1c1c1c] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.count / max) * 100}%`,
                backgroundColor: getColor(item.count),
              }}
            />
          </div>
        </div>
      ))}
      <div className="flex gap-4 mt-2">
        <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
          <span className="w-2 h-2 rounded-full bg-[#ef4444] inline-block" /> {'< 5 eventos (Crítico)'}
        </div>
        <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
          <span className="w-2 h-2 rounded-full bg-[#eab308] inline-block" /> 5–15 (Atenção)
        </div>
        <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block" /> {'> 15 (Normal)'}
        </div>
      </div>
    </div>
  )
}
