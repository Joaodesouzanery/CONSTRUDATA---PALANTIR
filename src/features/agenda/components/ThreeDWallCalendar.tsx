import { addDays, addWeeks, format, isToday, parseISO, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useAgendaStore } from '@/store/agendaStore'
import { getTasksForDate, getTaskColor } from '../calendarUtils'
import { cn } from '@/lib/utils'
import type { AgendaResource, AgendaTask } from '@/types'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']

function resourceName(resources: AgendaResource[], task: AgendaTask) {
  return resources.find((r) => r.id === task.resourceId)?.name ?? 'Sem recurso'
}

export function ThreeDWallCalendar() {
  const { tasks, resources, viewStart, setViewStart, setEditingTask } = useAgendaStore()
  const start = startOfWeek(parseISO(viewStart), { weekStartsOn: 1 })
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const end = days[days.length - 1]
  const totalEvents = days.reduce((sum, day) => sum + getTasksForDate(tasks, day).length, 0)

  function shiftWeeks(delta: number) {
    setViewStart(format(addWeeks(start, delta), 'yyyy-MM-dd'))
  }

  function goToday() {
    setViewStart(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))
  }

  function editTask(id: string, event: MouseEvent) {
    event.stopPropagation()
    setEditingTask(id)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#333333]">
      <div className="flex items-center justify-between gap-3 border-b border-[#525252] px-5 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#525252] bg-[#2c2c2c] text-[#f97316]">
            <CalendarDays size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#f5f5f5]">Calendario 6 semanas</h2>
            <p className="truncate text-[11px] text-[#a3a3a3]">
              {format(start, 'dd/MM', { locale: ptBR })} a {format(end, 'dd/MM/yyyy', { locale: ptBR })} · {totalEvents} atividade(s)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeeks(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#525252] text-[#a3a3a3] hover:border-[#f97316]/40 hover:text-[#f97316]"
            title="Semana anterior"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-[#525252] px-3 py-1.5 text-xs font-semibold text-[#a3a3a3] hover:border-[#f97316]/40 hover:text-[#f97316]"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => shiftWeeks(1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#525252] text-[#a3a3a3] hover:border-[#f97316]/40 hover:text-[#f97316]"
            title="Proxima semana"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-[#525252] bg-[#2c2c2c]">
        {WEEKDAYS.map((day) => (
          <div key={day} className="border-r border-[#525252] px-2 py-2 text-center text-[10px] font-bold uppercase tracking-widest text-[#6b6b6b] last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 overflow-auto">
        {days.map((day) => {
          const dayTasks = getTasksForDate(tasks, day)
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              onClick={() => setEditingTask('new')}
              className={cn(
                'group flex min-h-[128px] flex-col border-b border-r border-[#525252] bg-[#333333] p-2 text-left transition-colors hover:bg-[#3d3d3d]',
                today && 'bg-[#f97316]/10 ring-1 ring-inset ring-[#f97316]/40'
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <span className={cn('text-sm font-bold tabular-nums', today ? 'text-[#f97316]' : 'text-[#f5f5f5]')}>
                    {format(day, 'dd')}
                  </span>
                  <span className="ml-1 text-[10px] capitalize text-[#6b6b6b]">{format(day, 'MMM', { locale: ptBR })}</span>
                </div>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2c2c2c] text-[#6b6b6b] opacity-0 transition-opacity group-hover:opacity-100">
                  <Plus size={11} />
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                {dayTasks.slice(0, 4).map((task) => (
                  <span
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => editTask(task.id, event)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setEditingTask(task.id)
                    }}
                    className="rounded-md border border-[#525252] bg-[#2c2c2c] px-2 py-1 hover:border-[#f97316]/40"
                    title={`${task.title} · ${resourceName(resources, task)}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: getTaskColor(task.color) }} />
                      <span className="truncate text-[11px] font-semibold text-[#f5f5f5]">{task.title}</span>
                    </span>
                    <span className="block truncate pl-3.5 text-[9px] text-[#6b6b6b]">{resourceName(resources, task)}</span>
                  </span>
                ))}
                {dayTasks.length > 4 && (
                  <span className="rounded-md bg-[#1f1f1f] px-2 py-1 text-[10px] font-semibold text-[#a3a3a3]">
                    +{dayTasks.length - 4} atividade(s)
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
