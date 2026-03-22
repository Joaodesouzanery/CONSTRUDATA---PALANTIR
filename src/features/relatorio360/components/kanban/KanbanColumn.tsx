import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import type { Activity, ActivityStatus } from '@/types'
import { ActivityCard } from './ActivityCard'

interface KanbanColumnProps {
  status: ActivityStatus
  activities: Activity[]
}

const COLUMN_CONFIG: Record<ActivityStatus, { label: string; accent: string; dot: string }> = {
  planned: {
    label: 'Planejado',
    accent: 'text-[#94a3b8]',
    dot: 'bg-[#64748b]',
  },
  in_progress: {
    label: 'Em Andamento',
    accent: 'text-[#f97316]',
    dot: 'bg-[#f97316]',
  },
  completed: {
    label: 'Concluído',
    accent: 'text-[#22c55e]',
    dot: 'bg-[#22c55e]',
  },
}

export function KanbanColumn({ status, activities }: KanbanColumnProps) {
  const config = COLUMN_CONFIG[status]
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col gap-3 min-w-0">
      {/* Column header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', config.dot)} />
          <span className={cn('text-xs font-semibold uppercase tracking-widest', config.accent)}>
            {config.label}
          </span>
        </div>
        <span className="text-xs font-mono text-[#6b6b6b] bg-[#1f1f1f] border border-[#2a2a2a] px-2 py-0.5 rounded-full">
          {activities.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 min-h-24 rounded-xl border border-dashed p-2 transition-colors',
          isOver
            ? 'border-[#f97316]/50 bg-[#f97316]/5'
            : 'border-[#2a2a2a] bg-[#111111]/40'
        )}
      >
        <SortableContext
          items={activities.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          {activities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </SortableContext>

        {activities.length === 0 && (
          <div className="flex items-center justify-center h-16 text-[10px] text-[#3f3f3f] uppercase tracking-widest font-semibold">
            Solte aqui
          </div>
        )}
      </div>
    </div>
  )
}
