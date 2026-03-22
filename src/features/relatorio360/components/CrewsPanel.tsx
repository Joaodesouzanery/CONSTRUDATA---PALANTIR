import { Users, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { cn, formatCurrency, formatHours } from '@/lib/utils'
import { useCurrentReport } from '@/hooks/useRelatorio360'
import type { Crew } from '@/types'

function CrewCard({ crew }: { crew: Crew }) {
  const [open, setOpen] = useState(false)
  const report = useCurrentReport()

  const totalHours = crew.timecards.reduce((s, t) => s + t.hoursWorked, 0)
  const totalCost = crew.timecards.reduce((s, t) => s + t.hoursWorked * t.hourlyRate, 0)

  const crewActivities = report?.activities.filter((a) =>
    crew.activityIds.includes(a.id)
  ) ?? []

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#252525] transition-colors"
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[#f5f5f5] font-semibold text-sm">{crew.foremanName}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f97316]/15 text-[#f97316] font-semibold uppercase tracking-wider">
              {crew.crewType}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#a3a3a3]">
            <span className="flex items-center gap-1">
              <Users size={11} />
              {crew.timecards.length} apontamentos
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {formatHours(totalHours)}
            </span>
            <span className="text-[#f97316] font-mono font-semibold">{formatCurrency(totalCost)}</span>
          </div>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-[#6b6b6b] shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-[#6b6b6b] shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-[#2a2a2a] px-4 py-3 flex flex-col gap-3">
          {/* Apontamentos */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-2">
              Apontamentos
            </p>
            <div className="flex flex-col gap-1.5">
              {crew.timecards.map((tc) => (
                <div
                  key={tc.id}
                  className="flex items-center justify-between text-xs text-[#a3a3a3]"
                >
                  <div className="flex flex-col">
                    <span className="text-[#f5f5f5] font-medium">{tc.workerName}</span>
                    <span className="text-[#6b6b6b]">{tc.role}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono">{formatHours(tc.hoursWorked)}</span>
                    <span className="font-mono text-[#f97316]">
                      {formatCurrency(tc.hoursWorked * tc.hourlyRate)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Atividades */}
          {crewActivities.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-2">
                Atividades
              </p>
              <div className="flex flex-wrap gap-1.5">
                {crewActivities.map((act) => (
                  <span
                    key={act.id}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider',
                      act.status === 'completed'
                        ? 'bg-[#22c55e]/15 text-[#22c55e]'
                        : act.status === 'in_progress'
                        ? 'bg-[#f97316]/15 text-[#f97316]'
                        : 'bg-[#3f3f3f] text-[#a3a3a3]'
                    )}
                  >
                    {act.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CrewsPanel() {
  const report = useCurrentReport()
  const crews = report?.crews ?? []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] flex items-center gap-2">
          <Users size={13} />
          Equipes em Campo
        </h2>
        <span className="text-xs font-mono text-[#6b6b6b]">{crews.length} equipes</span>
      </div>

      {crews.length === 0 ? (
        <div className="rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] p-6 text-center text-sm text-[#6b6b6b]">
          Nenhuma equipe registrada
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {crews.map((crew) => (
            <CrewCard key={crew.id} crew={crew} />
          ))}
        </div>
      )}
    </div>
  )
}
