import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Plus, GanttChart, CalendarDays } from 'lucide-react'
import { useAgendaStore } from '@/store/agendaStore'
import { formatViewRange } from '../utils'
import type { AgendaViewMode } from '@/types'
import { cn } from '@/lib/utils'
import { format, startOfWeek, parseISO } from 'date-fns'

interface AgendaToolbarProps {
  searchTerm: string
  onSearchChange: (v: string) => void
  onAddTask: () => void
}

const VIEW_MODES: { key: AgendaViewMode; label: string }[] = [
  { key: 'day',      label: 'Dia'       },
  { key: 'week',     label: 'Semana'    },
  { key: 'month',    label: 'Mês'       },
  { key: 'quarter',  label: 'Trimestre' },
  { key: 'semester', label: 'Semestre'  },
  { key: 'year',     label: 'Ano'       },
]

export function AgendaToolbar({ searchTerm, onSearchChange, onAddTask }: AgendaToolbarProps) {
  const {
    viewStart, visibleWeeks, viewMode,
    panLeft, panRight, setViewMode,
    displayView, setDisplayView,
    setVisibleWeeks, setViewStart,
  } = useAgendaStore()
  const range = formatViewRange(viewStart, visibleWeeks)

  function handleDateJump(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (!val) return
    // val is yyyy-MM-dd; snap to start of that week (Monday)
    const monday = format(startOfWeek(parseISO(val), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    setViewStart(monday)
  }

  return (
    <div className="flex flex-col border-b border-[#20406a] bg-[#112645] shrink-0">
      {/* Top row */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-2">
        {/* Search */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#20406a] bg-[#0d2040] w-40">
          <Search size={13} className="text-[#6b6b6b] shrink-0" />
          <input
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar recurso..."
            className="bg-transparent text-[#f5f5f5] text-xs outline-none w-full placeholder:text-[#6b6b6b]"
            maxLength={100}
          />
        </div>

        {/* Filter */}
        <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#20406a] text-[#6b6b6b] hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors">
          <SlidersHorizontal size={14} />
        </button>

        {/* Display view toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDisplayView('gantt')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              displayView === 'gantt'
                ? 'bg-[#2abfdc]/20 border-[#2abfdc]/50 text-[#2abfdc]'
                : 'border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3] hover:border-[#2a3a5e]'
            )}
          >
            <GanttChart size={13} /> Gantt
          </button>
          <button
            onClick={() => setDisplayView('calendar')}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors',
              displayView === 'calendar'
                ? 'bg-[#2abfdc]/20 border-[#2abfdc]/50 text-[#2abfdc]'
                : 'border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3] hover:border-[#2a3a5e]'
            )}
          >
            <CalendarDays size={13} /> Calendário
          </button>
        </div>

        <div className="h-5 w-px bg-[#20406a]" />

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={panLeft}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#20406a] text-[#a3a3a3] hover:text-[#2abfdc] hover:border-[#2abfdc]/40 transition-colors"
            title="Recuar"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-[#a3a3a3] font-mono px-2 min-w-[180px] text-center">
            {range}
          </span>
          <button
            onClick={panRight}
            className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#20406a] text-[#a3a3a3] hover:text-[#2abfdc] hover:border-[#2abfdc]/40 transition-colors"
            title="Avançar"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Jump to date */}
        <div className="flex items-center gap-1.5" title="Ir para data">
          <span className="text-[10px] text-[#6b6b6b] hidden sm:block">Data:</span>
          <input
            type="date"
            defaultValue={viewStart}
            onChange={handleDateJump}
            className="bg-[#0d2040] border border-[#20406a] rounded-lg px-2 py-1 text-xs text-[#a3a3a3] outline-none focus:border-[#2abfdc]/60 w-32"
          />
        </div>

        {/* Weeks count */}
        <div className="flex items-center gap-1.5" title="Semanas visíveis">
          <input
            type="number"
            min={1}
            max={52}
            value={visibleWeeks}
            onChange={(e) => setVisibleWeeks(parseInt(e.target.value) || 1)}
            className="bg-[#0d2040] border border-[#20406a] rounded-lg px-2 py-1 text-xs text-[#a3a3a3] text-center outline-none focus:border-[#2abfdc]/60 w-14"
          />
          <span className="text-[10px] text-[#6b6b6b]">sem.</span>
        </div>

        <div className="flex-1" />

        {/* Add task */}
        <button
          onClick={onAddTask}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2abfdc]/15 border border-[#2abfdc]/30 text-[#2abfdc] text-xs font-semibold hover:bg-[#2abfdc]/25 transition-colors"
        >
          <Plus size={13} />
          Nova Tarefa
        </button>
      </div>

      {/* ViewMode buttons row — only for Gantt view */}
      {displayView === 'gantt' && (
        <div className="flex items-center gap-1 px-5 pb-2">
          <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mr-2">
            Visualização:
          </span>
          {VIEW_MODES.map((vm) => (
            <button
              key={vm.key}
              onClick={() => setViewMode(vm.key)}
              className={cn(
                'px-3 py-1 rounded-md border text-xs font-medium transition-colors',
                viewMode === vm.key
                  ? 'bg-[#2abfdc]/20 border-[#2abfdc]/50 text-[#2abfdc]'
                  : 'border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3] hover:border-[#2a3a5e]'
              )}
            >
              {vm.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
