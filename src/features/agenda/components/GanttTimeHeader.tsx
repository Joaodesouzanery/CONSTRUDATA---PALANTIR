import { useAgendaStore } from '@/store/agendaStore'
import {
  COLUMN_WIDTH,
  SIDEBAR_W,
  getVisibleWeeks,
  getMonthSegments,
  getWeekLabel,
} from '../utils'

export function GanttTimeHeader() {
  const { viewStart, visibleWeeks } = useAgendaStore()
  const weeks = getVisibleWeeks(viewStart, visibleWeeks)
  const months = getMonthSegments(weeks)

  return (
    <div
      style={{ position: 'sticky', top: 0, zIndex: 20 }}
      className="border-b border-[#1c3658] bg-[#0e1f38]"
    >
      {/* Month row */}
      <div className="flex" style={{ minWidth: SIDEBAR_W + visibleWeeks * COLUMN_WIDTH }}>
        {/* Corner cell */}
        <div
          style={{
            position: 'sticky',
            left: 0,
            zIndex: 21,
            width: SIDEBAR_W,
            minWidth: SIDEBAR_W,
            background: '#0e1f38',
          }}
          className="border-r border-b border-[#1c3658] px-3 flex items-center"
        >
          <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold">
            Recurso
          </span>
        </div>

        {/* Month segments */}
        {months.map((seg, i) => (
          <div
            key={`${seg.label}-${i}`}
            style={{ width: seg.spanWeeks * COLUMN_WIDTH, minWidth: seg.spanWeeks * COLUMN_WIDTH }}
            className="border-r border-b border-[#1c3658] px-3 flex items-center"
          >
            <span className="text-xs font-semibold text-[#f5f5f5] capitalize truncate">
              {seg.label}
            </span>
          </div>
        ))}
      </div>

      {/* Week numbers row */}
      <div className="flex" style={{ minWidth: SIDEBAR_W + visibleWeeks * COLUMN_WIDTH }}>
        {/* Corner cell (empty) */}
        <div
          style={{
            position: 'sticky',
            left: 0,
            zIndex: 21,
            width: SIDEBAR_W,
            minWidth: SIDEBAR_W,
            background: '#0e1f38',
          }}
          className="border-r border-[#1c3658]"
        />

        {/* Week cells */}
        {weeks.map((week, i) => (
          <div
            key={i}
            style={{ width: COLUMN_WIDTH, minWidth: COLUMN_WIDTH }}
            className="border-r border-[#1c3658] flex items-center justify-center"
          >
            <span className="text-[10px] font-mono text-[#6b6b6b]">
              {getWeekLabel(week)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
