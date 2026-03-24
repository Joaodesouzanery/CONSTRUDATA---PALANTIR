import { useMemo } from 'react'
import { useAgendaStore, getTasksForResource } from '@/store/agendaStore'
import { COLUMN_WIDTH, SIDEBAR_W, HEADER_H, ROW_HEIGHT, getTodayOffset } from '../utils'
import { GanttTimeHeader } from './GanttTimeHeader'
import { GanttRow } from './GanttRow'

interface GanttChartProps {
  filteredResourceIds: string[]
}

export function GanttChart({ filteredResourceIds }: GanttChartProps) {
  const { tasks, resources, viewStart, visibleWeeks } = useAgendaStore()

  const visibleResources = useMemo(
    () => resources.filter((r) => filteredResourceIds.includes(r.id)),
    [resources, filteredResourceIds]
  )

  const todayOffset = useMemo(
    () => getTodayOffset(viewStart, visibleWeeks),
    [viewStart, visibleWeeks]
  )

  // Grid background for each timeline row (computed once, shared)
  const gridStyle: React.CSSProperties = useMemo(
    () => ({
      backgroundImage: `repeating-linear-gradient(
        to right,
        transparent 0px,
        transparent ${COLUMN_WIDTH - 1}px,
        #1c3658 ${COLUMN_WIDTH - 1}px,
        #1c3658 ${COLUMN_WIDTH}px
      )`,
    }),
    []
  )

  const totalWidth = SIDEBAR_W + visibleWeeks * COLUMN_WIDTH
  const totalHeight = visibleResources.length * ROW_HEIGHT

  return (
    <div
      className="h-full overflow-auto"
      style={{ position: 'relative' }}
    >
      {/* Minimum width wrapper — needed for sticky to work inside overflow container */}
      <div style={{ minWidth: totalWidth, position: 'relative' }}>
        {/* Sticky time header */}
        <GanttTimeHeader />

        {/* Resource rows */}
        <div style={{ position: 'relative' }}>
          {visibleResources.map((resource, index) => {
            const rowTasks = getTasksForResource(tasks, resource.id)
            return (
              <GanttRow
                key={resource.id}
                resource={resource}
                tasks={rowTasks}
                viewStart={viewStart}
                visibleWeeks={visibleWeeks}
                index={index}
                gridStyle={gridStyle}
              />
            )
          })}

          {visibleResources.length === 0 && (
            <div
              className="flex items-center justify-center text-sm text-[#6b6b6b]"
              style={{ height: 200 }}
            >
              Nenhum recurso encontrado
            </div>
          )}

          {/* Today indicator line */}
          {todayOffset !== null && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: SIDEBAR_W + todayOffset,
                width: 2,
                height: totalHeight,
                background: '#2abfdc',
                opacity: 0.7,
                pointerEvents: 'none',
                zIndex: 5,
              }}
            >
              {/* Today label */}
              <div
                style={{
                  position: 'absolute',
                  top: -HEADER_H,
                  left: -18,
                  background: '#2abfdc',
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 4px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                Hoje
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
