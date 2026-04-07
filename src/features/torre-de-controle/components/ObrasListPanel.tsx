import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTorreStore } from '@/store/torreDeControleStore'
import type { ConstructionSite, ObraStatus } from '@/types'

const STATUS_LABEL: Record<ObraStatus, string> = {
  active:    'Ativa',
  planning:  'Planejamento',
  paused:    'Pausada',
  completed: 'Concluída',
}

const STATUS_COLOR: Record<ObraStatus, string> = {
  active:    'text-[#22c55e] bg-[#22c55e]/10',
  planning:  'text-[#3b82f6] bg-[#3b82f6]/10',
  paused:    'text-[#eab308] bg-[#eab308]/10',
  completed: 'text-[#a3a3a3] bg-[#a3a3a3]/10',
}

const STATUS_DOT: Record<ObraStatus, string> = {
  active:    '#22c55e',
  planning:  '#3b82f6',
  paused:    '#eab308',
  completed: '#a3a3a3',
}

interface ObrasListPanelProps {
  /** vertical = sidebar tradicional; horizontal = strip de cards (Torre de Controle empilhada) */
  orientation?: 'vertical' | 'horizontal'
}

export function ObrasListPanel({ orientation = 'vertical' }: ObrasListPanelProps) {
  const sites      = useTorreStore((s) => s.sites)
  const selectedId = useTorreStore((s) => s.selectedId)
  const selectSite = useTorreStore((s) => s.selectSite)
  const setEditing = useTorreStore((s) => s.setEditing)

  if (orientation === 'horizontal') {
    return (
      <section className="flex flex-col bg-[#333333] border-b border-[#525252] h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#525252] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#f5f5f5]">PROJETOS</span>
            <span className="text-[10px] text-[#6b6b6b]">{sites.length} canteiro{sites.length !== 1 ? 's' : ''}</span>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="flex items-center gap-1 text-[10px] font-semibold text-[#f97316] hover:text-[#ea580c] transition-colors px-2 py-1 rounded border border-[#f97316]/30"
          >
            <Plus size={12} />
            Nova Obra
          </button>
        </div>

        {/* Horizontal scroll strip */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          {sites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 h-full px-4 text-center">
              <span className="text-[#3f3f3f] text-xs">Nenhuma obra cadastrada</span>
              <button
                onClick={() => setEditing('new')}
                className="text-xs text-[#f97316] hover:underline"
              >
                Adicionar primeira obra
              </button>
            </div>
          ) : (
            <div className="flex gap-2 p-3 h-full">
              {sites.map((site) => (
                <ObraHorizontalCard
                  key={site.id}
                  site={site}
                  isSelected={site.id === selectedId}
                  onClick={() => selectSite(site.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    )
  }

  // ── Vertical (modo padrão / mobile) ──────────────────────────────────────
  return (
    <aside className="flex flex-col border-r border-[#525252] bg-[#333333] shrink-0 overflow-hidden w-full lg:w-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252] shrink-0">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-[#f5f5f5]">Obras</span>
          <span className="text-[10px] text-[#6b6b6b]">{sites.length} canteiro{sites.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="flex items-center gap-1 text-[10px] font-semibold text-[#f97316] hover:text-[#ea580c] transition-colors"
        >
          <Plus size={13} />
          Nova Obra
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sites.map((site) => (
          <ObraCard
            key={site.id}
            site={site}
            isSelected={site.id === selectedId}
            onClick={() => selectSite(site.id)}
          />
        ))}

        {sites.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
            <span className="text-[#3f3f3f] text-xs">Nenhuma obra cadastrada</span>
            <button
              onClick={() => setEditing('new')}
              className="text-xs text-[#f97316] hover:underline"
            >
              Adicionar primeira obra
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

function ObraCard({
  site,
  isSelected,
  onClick,
}: {
  site: ConstructionSite
  isSelected: boolean
  onClick: () => void
}) {
  const criticalRisks = site.risks.filter((r) => r.level === 'critical' && r.status === 'active').length
  const highRisks     = site.risks.filter((r) => r.level === 'high'     && r.status !== 'resolved').length

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 flex flex-col gap-2 border-b border-[#3d3d3d] transition-colors',
        isSelected
          ? 'bg-[#f97316]/10 border-l-2 border-l-[#f97316]'
          : 'hover:bg-[#484848] border-l-2 border-l-transparent'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT[site.status] }} />
            <span className="text-[10px] font-mono text-[#6b6b6b]">{site.code}</span>
          </div>
          <span className="text-sm font-semibold text-[#f5f5f5] leading-snug line-clamp-2">
            {site.name}
          </span>
        </div>
        <span className={cn('shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide', STATUS_COLOR[site.status])}>
          {STATUS_LABEL[site.status]}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] text-[#6b6b6b] truncate">
          {site.street}, {site.number} — {site.district}
        </span>
        <span className="text-[10px] text-[#6b6b6b]">{site.city} / {site.state}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[#6b6b6b]">
          Gerente: <span className="text-[#a3a3a3]">{site.manager}</span>
        </span>
        {(criticalRisks > 0 || highRisks > 0) && (
          <span className={cn(
            'text-[9px] font-semibold px-1.5 py-0.5 rounded',
            criticalRisks > 0 ? 'text-[#ef4444] bg-[#ef4444]/10' : 'text-[#f97316] bg-[#f97316]/10'
          )}>
            {criticalRisks > 0 ? `${criticalRisks} crítico${criticalRisks > 1 ? 's' : ''}` : `${highRisks} alto${highRisks > 1 ? 's' : ''}`}
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Horizontal card (modo Torre de Controle empilhada) ──────────────────────

function ObraHorizontalCard({
  site,
  isSelected,
  onClick,
}: {
  site: ConstructionSite
  isSelected: boolean
  onClick: () => void
}) {
  const criticalRisks = site.risks.filter((r) => r.level === 'critical' && r.status === 'active').length
  const highRisks     = site.risks.filter((r) => r.level === 'high'     && r.status !== 'resolved').length

  return (
    <button
      onClick={onClick}
      className={cn(
        'shrink-0 w-[260px] text-left rounded-lg p-3 flex flex-col gap-2 border transition-colors h-full',
        isSelected
          ? 'bg-[#f97316]/10 border-[#f97316]'
          : 'bg-[#3d3d3d] border-[#525252] hover:border-[#6b6b6b]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT[site.status] }} />
          <span className="text-[10px] font-mono text-[#6b6b6b] truncate">{site.code}</span>
        </div>
        <span className={cn('shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide', STATUS_COLOR[site.status])}>
          {STATUS_LABEL[site.status]}
        </span>
      </div>

      <div className="text-sm font-semibold text-[#f5f5f5] leading-tight line-clamp-2 min-h-[2.5em]">
        {site.name}
      </div>

      <div className="text-[10px] text-[#6b6b6b] truncate">
        {site.city} / {site.state}
      </div>

      <div className="flex items-center justify-between mt-auto">
        <span className="text-[10px] text-[#6b6b6b] truncate">
          {site.manager}
        </span>
        {(criticalRisks > 0 || highRisks > 0) && (
          <span className={cn(
            'shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded',
            criticalRisks > 0 ? 'text-[#ef4444] bg-[#ef4444]/10' : 'text-[#f97316] bg-[#f97316]/10'
          )}>
            {criticalRisks > 0 ? `${criticalRisks} crítico${criticalRisks > 1 ? 's' : ''}` : `${highRisks} alto${highRisks > 1 ? 's' : ''}`}
          </span>
        )}
      </div>
    </button>
  )
}
