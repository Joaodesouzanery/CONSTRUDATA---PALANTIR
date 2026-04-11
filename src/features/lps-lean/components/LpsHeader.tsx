/**
 * LpsHeader — KPI strip + tab navigation for the LPS/Lean module.
 */
import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { useLpsStore, computeWeeklyPPC } from '@/store/lpsStore'
import type { LpsTab } from '@/types'

const CNC_LABELS: Record<string, string> = {
  weather:   'Clima',
  equipment: 'Equipamento',
  labor:     'Mão de Obra',
  material:  'Material',
  design:    'Projeto',
  other:     'Outro',
}

const TABS: { id: LpsTab; label: string }[] = [
  { id: 'semaforo',            label: 'Semáforo' },
  { id: 'lookahead',           label: 'Look-ahead' },
  { id: 'ppc',                 label: 'PPC Dashboard' },
  { id: 'takt',                label: 'Takt Time' },
  { id: 'restricoes',          label: 'Restrições' },
  { id: 'analytics',           label: 'Analytics' },
  { id: 'timeline-restricoes', label: 'Timeline Restrições' },
  { id: 'alertas',             label: 'Alertas' },
  { id: 'mao-de-obra',         label: 'Mão de Obra' },
  { id: 'integracoes',         label: 'Integrações' },
]

export function LpsHeader() {
  const activeTab    = useLpsStore((s) => s.activeTab)
  const setActiveTab = useLpsStore((s) => s.setActiveTab)
  const activities   = useLpsStore((s) => s.activities)

  const weekly = useMemo(() => computeWeeklyPPC(activities), [activities])

  // PPC média últimas 4 semanas (past only)
  const pastWeekly = weekly.slice(-5, -1)  // 4 semanas passadas
  const avgPpc = pastWeekly.length > 0
    ? Math.round(pastWeekly.reduce((s, w) => s + w.ppc, 0) / pastWeekly.length)
    : 0

  // Tendência: comparar última vs penúltima
  const last    = weekly[weekly.length - 2]?.ppc ?? 0
  const prev    = weekly[weekly.length - 3]?.ppc ?? 0
  const trend   = last - prev

  // Atividades da semana atual
  const currentWeek = weekly[weekly.length - 1]
  const weekPlanned   = currentWeek?.planned   ?? 0
  const weekCompleted = currentWeek?.completed ?? 0

  // Top CNC
  const cncCount = activities
    .filter((a) => a.cncCategory)
    .reduce<Record<string, number>>((acc, a) => {
      const cat = a.cncCategory!
      acc[cat] = (acc[cat] ?? 0) + 1
      return acc
    }, {})
  const topCnc = Object.entries(cncCount).sort((a, b) => b[1] - a[1])[0]

  const ppcColor = avgPpc >= 80 ? 'text-green-400' : avgPpc >= 60 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252]">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-[#525252]">
        {/* PPC médio */}
        <div className={`border rounded-xl p-4 flex flex-col gap-1 ${avgPpc >= 80 ? 'bg-[#16a34a]/10 border-[#16a34a]/30' : avgPpc >= 60 ? 'bg-[#ca8a04]/10 border-[#ca8a04]/30' : 'bg-[#dc2626]/10 border-[#dc2626]/30'}`}>
          <p className="text-[#6b6b6b] text-xs">PPC (4 sem.)</p>
          <p className={`text-2xl font-bold tabular-nums ${ppcColor}`}>{avgPpc}%</p>
        </div>

        {/* Tendência */}
        <div className="border rounded-xl p-4 flex flex-col gap-1 bg-[#3d3d3d] border-[#525252]">
          <p className="text-[#6b6b6b] text-xs">Tendência</p>
          <div className="flex items-center gap-1.5">
            {trend > 0
              ? <TrendingUp size={18} className="text-[#4ade80]" />
              : trend < 0
                ? <TrendingDown size={18} className="text-[#f87171]" />
                : <Minus size={18} className="text-[#6b6b6b]" />}
            <span className={`text-2xl font-bold tabular-nums ${trend > 0 ? 'text-[#4ade80]' : trend < 0 ? 'text-[#f87171]' : 'text-[#a3a3a3]'}`}>
              {trend > 0 ? `+${trend}` : trend === 0 ? '—' : trend}pp
            </span>
          </div>
        </div>

        {/* Semana atual */}
        <div className="border rounded-xl p-4 flex flex-col gap-1 bg-[#3d3d3d] border-[#525252]">
          <p className="text-[#6b6b6b] text-xs">Esta Semana</p>
          <p className={`text-2xl font-bold tabular-nums ${weekPlanned > 0 && weekCompleted === weekPlanned ? 'text-[#4ade80]' : 'text-[#f5f5f5]'}`}>
            {weekCompleted}/{weekPlanned}
          </p>
          <p className="text-[10px] text-[#6b6b6b]">concluídas / planejadas</p>
        </div>

        {/* Top CNC */}
        <div className="border rounded-xl p-4 flex flex-col gap-1 bg-[#f97316]/10 border-[#f97316]/30">
          <p className="text-[#6b6b6b] text-xs">Principal CNC</p>
          {topCnc ? (
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={16} className="text-[#f97316]" />
              <span className="text-lg font-bold text-[#f97316]">{CNC_LABELS[topCnc[0]] ?? topCnc[0]}</span>
              <span className="text-xs text-[#6b6b6b]">({topCnc[1]}×)</span>
            </div>
          ) : (
            <p className="text-2xl font-bold text-[#4ade80]">Nenhum</p>
          )}
        </div>
      </div>

      {/* Tabs — standard platform pattern */}
      <div className="flex items-center gap-3 px-6 py-3 flex-wrap">
        <div className="flex gap-1 bg-[#3d3d3d] border border-[#525252] rounded-lg p-1 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-[#f97316] text-white'
                  : 'text-[#6b6b6b] hover:text-[#f5f5f5]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

