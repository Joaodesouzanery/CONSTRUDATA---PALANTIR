/**
 * DerivacaoPanel — 6-week look-ahead derivation from master schedule.
 * Groups derived activities by ISO week and shows status badges.
 */
import { useEffect } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle2, Clock, CircleDot } from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import type { LookaheadDerivedActivity } from '@/types'

const STATUS_META: Record<LookaheadDerivedActivity['status'], { label: string; color: string; icon: typeof Clock }> = {
  planned:   { label: 'Planejada',  color: '#6b6b6b', icon: Clock         },
  ready:     { label: 'Pronta',     color: '#22c55e', icon: CheckCircle2  },
  blocked:   { label: 'Bloqueada',  color: '#ef4444', icon: AlertTriangle },
  completed: { label: 'Concluída',  color: '#3b82f6', icon: CircleDot     },
}

function weekLabel(weekIso: string): string {
  const [year, wPart] = weekIso.split('-W')
  return `S${wPart}/${year.slice(2)}`
}

export function DerivacaoPanel() {
  const derivedActivities = usePlanejamentoMestreStore((s) => s.derivedActivities)
  const lookaheadWeeks    = usePlanejamentoMestreStore((s) => s.lookaheadWeeks)
  const setLookaheadWeeks = usePlanejamentoMestreStore((s) => s.setLookaheadWeeks)
  const deriveFromMaster  = usePlanejamentoMestreStore((s) => s.deriveFromMaster)
  const activities        = usePlanejamentoMestreStore((s) => s.activities)

  // Auto-derive on mount if needed
  useEffect(() => {
    if (derivedActivities.length === 0 && activities.length > 0) {
      deriveFromMaster()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Group by week
  const weekGroups = new Map<string, LookaheadDerivedActivity[]>()
  for (const da of derivedActivities) {
    const list = weekGroups.get(da.weekIso) ?? []
    list.push(da)
    weekGroups.set(da.weekIso, list)
  }
  const sortedWeeks = Array.from(weekGroups.entries()).sort(([a], [b]) => a.localeCompare(b))

  const counts = {
    planned:   derivedActivities.filter((d) => d.status === 'planned').length,
    ready:     derivedActivities.filter((d) => d.status === 'ready').length,
    blocked:   derivedActivities.filter((d) => d.status === 'blocked').length,
    completed: derivedActivities.filter((d) => d.status === 'completed').length,
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[#6b6b6b] text-xs">Horizonte:</span>
          {[4, 6, 8].map((w) => (
            <button
              key={w}
              onClick={() => setLookaheadWeeks(w)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                lookaheadWeeks === w
                  ? 'bg-[#2abfdc]/20 text-[#2abfdc] border border-[#2abfdc]/40'
                  : 'border border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3]'
              }`}
            >
              {w} sem
            </button>
          ))}
        </div>

        <button
          onClick={deriveFromMaster}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] transition-colors"
        >
          <RefreshCw size={12} />
          Derivar
        </button>

        {/* Status counts */}
        <div className="flex gap-3 ml-auto">
          {(Object.entries(counts) as [LookaheadDerivedActivity['status'], number][]).map(([status, count]) => {
            const meta = STATUS_META[status]
            return (
              <span key={status} className="flex items-center gap-1 text-xs" style={{ color: meta.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                {count} {meta.label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Week groups */}
      {sortedWeeks.length === 0 ? (
        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-8 text-center">
          <Clock size={32} className="text-[#6b6b6b] mx-auto mb-3" />
          <p className="text-[#6b6b6b] text-sm">Nenhuma atividade derivada.</p>
          <p className="text-[#6b6b6b] text-xs mt-1">
            Clique em <span className="text-[#2abfdc]">Derivar</span> para gerar o look-ahead a partir do cronograma mestre.
          </p>
        </div>
      ) : (
        sortedWeeks.map(([weekIso, items]) => (
          <div key={weekIso} className="bg-[#14294e] border border-[#20406a] rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-[#0d2040] border-b border-[#20406a] flex items-center justify-between">
              <span className="text-[#f5f5f5] text-xs font-semibold">{weekLabel(weekIso)}</span>
              <span className="text-[#6b6b6b] text-[10px]">{items.length} atividade{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-[#20406a]">
              {items.map((da) => {
                const meta = STATUS_META[da.status]
                const Icon = meta.icon
                return (
                  <div key={da.id} className="px-4 py-3 flex items-center gap-3 hover:bg-[#1a3662] transition-colors">
                    <Icon size={14} style={{ color: meta.color }} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#f5f5f5] text-xs font-medium truncate">{da.name}</p>
                      <p className="text-[#6b6b6b] text-[10px] mt-0.5">
                        {da.responsible}
                        {da.linkedRestrictionIds && da.linkedRestrictionIds.length > 0 && (
                          <span className="ml-2 text-[#ef4444]">
                            {da.linkedRestrictionIds.length} restrição(ões)
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-semibold shrink-0"
                      style={{ backgroundColor: meta.color + '18', color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
