import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Kanban } from 'lucide-react'
import { useCurrentReport } from '@/hooks/useRelatorio360'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import type { Activity, ActivityStatus } from '@/types'
import { KanbanColumn } from './KanbanColumn'
import { ActivityCard } from './ActivityCard'

const STATUSES: ActivityStatus[] = ['planned', 'in_progress', 'completed']

function findStatusOfActivity(activities: Activity[], id: string): ActivityStatus | null {
  const act = activities.find((a) => a.id === id)
  return act?.status ?? null
}

export function KanbanBoard() {
  const report = useCurrentReport()
  const { moveActivity, reorderActivity } = useRelatorio360Store()
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const activities = report?.activities ?? []

  function handleDragStart(event: DragStartEvent) {
    const act = activities.find((a) => a.id === event.active.id)
    setActiveActivity(act ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveActivity(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Check if over is a column (status) or a card
    const isOverColumn = STATUSES.includes(overId as ActivityStatus)

    if (isOverColumn) {
      const newStatus = overId as ActivityStatus
      const activeStatus = findStatusOfActivity(activities, activeId)
      if (activeStatus !== newStatus) {
        moveActivity(activeId, newStatus)
      }
    } else {
      // Over a card
      const overStatus = findStatusOfActivity(activities, overId)
      const activeStatus = findStatusOfActivity(activities, activeId)

      if (activeStatus !== overStatus && overStatus) {
        // Cross-column move
        moveActivity(activeId, overStatus)
      } else if (activeId !== overId) {
        // Reorder within same column
        reorderActivity(activeId, overId)
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] flex items-center gap-2">
          <Kanban size={13} />
          Atividades do Dia
        </h2>
        <span className="text-xs font-mono text-[#6b6b6b]">{activities.length} atividades</span>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-4">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              activities={activities.filter((a) => a.status === status)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeActivity && (
            <ActivityCard activity={activeActivity} overlay />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
