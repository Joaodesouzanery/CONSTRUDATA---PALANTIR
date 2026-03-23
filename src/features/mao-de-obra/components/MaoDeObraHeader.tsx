import { useShallow } from 'zustand/react/shallow'
import { Users, Clock, TrendingUp, ShieldCheck, AlertTriangle } from 'lucide-react'
import { useMaoDeObraStore, calcWeeklyHH, calcProductivity, calcComplianceRate, calcActiveOccurrences } from '@/store/maoDeObraStore'
import { cn } from '@/lib/utils'

export type MaoDeObraTab = 'dashboard' | 'apontamentos' | 'escalonamento' | 'seguranca'

interface Props {
  activeTab: MaoDeObraTab
  onTabChange: (tab: MaoDeObraTab) => void
}

const TABS: Array<{ id: MaoDeObraTab; label: string }> = [
  { id: 'dashboard',    label: 'Dashboard'    },
  { id: 'apontamentos', label: 'Apontamentos' },
  { id: 'escalonamento', label: 'Escalonamento' },
  { id: 'seguranca',    label: 'Segurança e Treinamento' },
]

export function MaoDeObraHeader({ activeTab, onTabChange }: Props) {
  const { workers, timecards, occurrences } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, timecards: s.timecards, occurrences: s.occurrences }))
  )

  const weeklyHH    = calcWeeklyHH(timecards)
  const productivity = calcProductivity(timecards)
  const compliance  = calcComplianceRate(workers)
  const activeOcc   = calcActiveOccurrences(occurrences)

  const kpis = [
    {
      label:   'HH Trabalhadas (7d)',
      value:   `${weeklyHH}h`,
      icon:    Clock,
      color:   '#3b82f6',
    },
    {
      label:   'Produtividade (HH/m²)',
      value:   productivity > 0 ? `${productivity}` : '—',
      icon:    TrendingUp,
      color:   '#22c55e',
    },
    {
      label:   'Conformidade (%)',
      value:   `${compliance}%`,
      icon:    ShieldCheck,
      color:   compliance >= 80 ? '#22c55e' : compliance >= 60 ? '#f59e0b' : '#ef4444',
    },
    {
      label:   'Ocorrências (30d)',
      value:   String(activeOcc),
      icon:    AlertTriangle,
      color:   activeOcc === 0 ? '#22c55e' : activeOcc <= 2 ? '#f59e0b' : '#ef4444',
    },
  ]

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-0">
      {/* Title row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]/15">
          <Users size={18} className="text-[#f97316]" />
        </div>
        <div>
          <h1 className="text-[#f5f5f5] text-lg font-semibold leading-none">Mão de Obra</h1>
          <p className="text-[#6b6b6b] text-xs mt-0.5">Gestão de equipes, apontamentos e segurança</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#222222] border border-[#2a2a2a] rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ backgroundColor: `${kpi.color}18` }}
            >
              <kpi.icon size={16} style={{ color: kpi.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[#6b6b6b] text-xs truncate">{kpi.label}</p>
              <p className="text-[#f5f5f5] text-lg font-bold leading-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#2a2a2a] -mb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-[#f97316] text-[#f97316]'
                : 'border-transparent text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
