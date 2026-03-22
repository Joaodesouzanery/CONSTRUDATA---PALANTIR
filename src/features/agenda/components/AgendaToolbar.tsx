import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, ZoomIn, ZoomOut, Plus } from 'lucide-react'
import { useAgendaStore } from '@/store/agendaStore'
import { formatViewRange } from '../utils'

interface AgendaToolbarProps {
  searchTerm: string
  onSearchChange: (v: string) => void
  onAddTask: () => void
}

export function AgendaToolbar({ searchTerm, onSearchChange, onAddTask }: AgendaToolbarProps) {
  const { viewStart, visibleWeeks, panLeft, panRight, zoomIn, zoomOut } = useAgendaStore()
  const range = formatViewRange(viewStart, visibleWeeks)

  return (
    <div className="flex items-center gap-3 px-5 py-2 border-b border-[#2a2a2a] bg-[#1a1a1a] shrink-0">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2a2a2a] bg-[#111111] w-44">
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
      <button className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#2a2a2a] text-[#6b6b6b] hover:text-[#f5f5f5] hover:border-[#3a3a3a] transition-colors">
        <SlidersHorizontal size={14} />
      </button>

      <div className="h-5 w-px bg-[#2a2a2a]" />

      {/* Date navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={panLeft}
          className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#2a2a2a] text-[#a3a3a3] hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors"
          title="Recuar 4 semanas"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-xs text-[#a3a3a3] font-mono px-2 min-w-[220px] text-center">
          {range}
        </span>
        <button
          onClick={panRight}
          className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#2a2a2a] text-[#a3a3a3] hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors"
          title="Avançar 4 semanas"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="h-5 w-px bg-[#2a2a2a]" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={zoomOut}
          className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#2a2a2a] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#3a3a3a] transition-colors"
          title="Mais semanas"
        >
          <ZoomOut size={13} />
        </button>
        <span className="text-[10px] text-[#6b6b6b] font-mono w-12 text-center">
          {visibleWeeks}sem
        </span>
        <button
          onClick={zoomIn}
          className="flex items-center justify-center w-7 h-7 rounded-lg border border-[#2a2a2a] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#3a3a3a] transition-colors"
          title="Menos semanas"
        >
          <ZoomIn size={13} />
        </button>
      </div>

      <div className="flex-1" />

      {/* Add task */}
      <button
        onClick={onAddTask}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316]/15 border border-[#f97316]/30 text-[#f97316] text-xs font-semibold hover:bg-[#f97316]/25 transition-colors"
      >
        <Plus size={13} />
        Nova Tarefa
      </button>
    </div>
  )
}
