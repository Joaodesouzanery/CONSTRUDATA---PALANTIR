import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Activity } from '@/types'
import { useCurrentReport } from '@/hooks/useRelatorio360'

interface ActivityCardProps {
  activity: Activity
  overlay?: boolean
}

export function ActivityCard({ activity, overlay }: ActivityCardProps) {
  const report = useCurrentReport()
  const crew = report?.crews.find((c) => c.id === activity.crewId)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const pct =
    activity.plannedQty > 0
      ? Math.min(100, Math.round((activity.actualQty / activity.plannedQty) * 100))
      : 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-xl border bg-[#1a1a1a] p-3 flex flex-col gap-2.5 select-none cursor-default',
        overlay
          ? 'border-[#f97316] shadow-lg shadow-[#f97316]/10 rotate-1 scale-105'
          : isDragging
          ? 'border-[#f97316]/40 opacity-40'
          : 'border-[#2a2a2a] hover:border-[#3a3a3a] hover:bg-[#222222] transition-colors'
      )}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[#f5f5f5] text-sm font-semibold leading-snug">
          {activity.name}
        </span>
        <div
          {...attributes}
          {...listeners}
          className="shrink-0 mt-0.5 text-[#3f3f3f] hover:text-[#6b6b6b] cursor-grab active:cursor-grabbing transition-colors"
        >
          <GripVertical size={14} />
        </div>
      </div>

      {/* Qty row */}
      <div className="flex items-center gap-3 text-xs text-[#a3a3a3]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[#6b6b6b] text-[10px] uppercase tracking-wider">Planejado</span>
          <span className="font-mono text-[#f5f5f5] font-semibold">
            {activity.plannedQty.toLocaleString('pt-BR')} {activity.unit}
          </span>
        </div>
        <div className="h-6 w-px bg-[#2a2a2a]" />
        <div className="flex flex-col gap-0.5">
          <span className="text-[#6b6b6b] text-[10px] uppercase tracking-wider">Realizado</span>
          <span className="font-mono text-[#f97316] font-semibold">
            {activity.actualQty.toLocaleString('pt-BR')} {activity.unit}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {activity.status !== 'planned' && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                pct >= 100 ? 'bg-[#22c55e]' : 'bg-[#f97316]'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#6b6b6b] flex items-center gap-1">
              <TrendingUp size={9} />
              {pct}% concluído
            </span>
          </div>
        </div>
      )}

      {/* Crew badge */}
      {crew && (
        <div className="flex items-center gap-1.5 text-[10px] text-[#6b6b6b]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#f97316]" />
          <span>{crew.foremanName} · {crew.crewType}</span>
        </div>
      )}
    </div>
  )
}
