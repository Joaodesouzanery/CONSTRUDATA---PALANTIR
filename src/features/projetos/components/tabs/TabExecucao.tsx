import { Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import type { Project, ProjectPhase, ProjectPhaseStatus } from '@/types'

const PHASE_STATUS_LABEL: Record<ProjectPhaseStatus, string> = {
  not_started: 'Não Iniciado',
  in_progress: 'Em Andamento',
  completed:   'Concluído',
  delayed:     'Atrasado',
}

const PHASE_STATUS_COLORS: Record<ProjectPhaseStatus, { text: string; bg: string; bar: string }> = {
  not_started: { text: 'text-[#6b6b6b]', bg: 'bg-[#6b6b6b]/10', bar: '#6b6b6b' },
  in_progress: { text: 'text-[#f97316]', bg: 'bg-[#f97316]/10', bar: '#f97316' },
  completed:   { text: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', bar: '#22c55e' },
  delayed:     { text: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', bar: '#ef4444' },
}

function PhaseCard({ phase, onEdit }: { phase: ProjectPhase; onEdit: () => void }) {
  const colors = PHASE_STATUS_COLORS[phase.status]

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1f1f1f] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-semibold text-[#f5f5f5] leading-snug">{phase.name}</span>
          <span
            className={cn(
              'self-start text-[9px] font-semibold px-2 py-0.5 rounded uppercase tracking-wide',
              colors.text, colors.bg
            )}
          >
            {PHASE_STATUS_LABEL[phase.status]}
          </span>
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f97316] hover:bg-[#f97316]/10 transition-colors"
        >
          <Pencil size={12} />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#6b6b6b]">Progresso</span>
          <span className="text-[10px] font-mono font-semibold" style={{ color: colors.bar }}>
            {phase.progress}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#252525] overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${phase.progress}%`, background: colors.bar }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Início</span>
          <span className="text-xs text-[#a3a3a3]">{phase.startDate}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Término</span>
          <span className="text-xs text-[#a3a3a3]">{phase.endDate}</span>
        </div>
      </div>

      {phase.notes && (
        <p className="text-[11px] text-[#6b6b6b] leading-relaxed line-clamp-3 border-t border-[#2a2a2a] pt-2">
          {phase.notes}
        </p>
      )}
    </div>
  )
}

export function TabExecucao({ project }: { project: Project }) {
  const setEditingPhase = useProjetosStore((s) => s.setEditingPhase)

  return (
    <div className="p-5 overflow-y-auto h-full">
      <div className="grid grid-cols-3 gap-4">
        {project.executionPhases.map((phase) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            onEdit={() =>
              setEditingPhase({ projectId: project.id, group: 'execution', phaseId: phase.id })
            }
          />
        ))}
      </div>
    </div>
  )
}
