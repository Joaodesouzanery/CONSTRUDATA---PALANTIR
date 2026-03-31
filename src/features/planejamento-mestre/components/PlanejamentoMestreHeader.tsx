/**
 * PlanejamentoMestreHeader — KPI strip + 3-tab navigation for Planejamento Mestre.
 */
import { BrainCircuit } from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { getProjectDateRange, daysBetween } from '../utils/masterEngine'
import type { PlanejamentoMestreTab } from '@/types'

const TABS: { key: PlanejamentoMestreTab; label: string }[] = [
  { key: 'macro',     label: 'Planejamento Macro'    },
  { key: 'derivacao', label: 'Derivação Look-ahead'  },
  { key: 'whatif',    label: 'Simulador What-if'     },
]

export function PlanejamentoMestreHeader() {
  const activeTab  = usePlanejamentoMestreStore((s) => s.activeTab)
  const setTab     = usePlanejamentoMestreStore((s) => s.setActiveTab)
  const activities = usePlanejamentoMestreStore((s) => s.activities)
  const baselines  = usePlanejamentoMestreStore((s) => s.baselines)
  const activeBlId = usePlanejamentoMestreStore((s) => s.activeBaselineId)

  const totalActivities = activities.filter((a) => a.level >= 1 && !a.isMilestone).length
  const avgComplete     = activities.length > 0
    ? Math.round(activities.reduce((s, a) => s + (a.weight ?? 1) * a.percentComplete, 0) /
        Math.max(1, activities.reduce((s, a) => s + (a.weight ?? 1), 0)))
    : 0
  const activeBaseline = baselines.find((b) => b.id === activeBlId)?.name ?? '—'
  const { end } = getProjectDateRange(activities)
  const daysRemaining = activities.length > 0
    ? daysBetween(new Date().toISOString().slice(0, 10), end)
    : 0

  return (
    <div className="bg-[#0d2040] border-b border-[#20406a] print:hidden">
      {/* Title + KPIs */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#2abfdc]">
            <BrainCircuit size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] font-semibold text-lg leading-tight">Planejamento Mestre</h1>
            <p className="text-[#6b6b6b] text-xs">Estratégia, baseline e simulações</p>
          </div>
        </div>

        <div className="flex gap-4">
          {[
            { label: 'Atividades', value: String(totalActivities) },
            { label: '% Concluído', value: `${avgComplete}%` },
            { label: 'Baseline', value: activeBaseline },
            { label: 'Dias p/ fim', value: daysRemaining > 0 ? String(daysRemaining) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">{label}</p>
              <p className="text-sm font-bold text-[#f5f5f5] tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-[#14294e] text-[#2abfdc] border-b-2 border-[#2abfdc]'
                : 'text-[#6b6b6b] hover:text-[#a3a3a3] hover:bg-[#14294e]/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
