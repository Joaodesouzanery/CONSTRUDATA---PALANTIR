/**
 * DerivacaoPanel — Médio Prazo: interactive 6-week agenda derived from master schedule.
 * Two-column layout: week nav (left) + activity cards (right).
 * Cards show WBS, responsible, progress, dates, status, restrictions.
 * Click to open detail modal.
 */
import { useEffect, useRef, useState } from 'react'
import {
  RefreshCw, AlertTriangle, CheckCircle2, Clock, CircleDot,
  ChevronRight, CalendarDays, Users, TrendingUp, FileText,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import type { LookaheadDerivedActivity, MasterActivity } from '@/types'
import { cn } from '@/lib/utils'

// ─── Status meta ─────────────────────────────────────────────────────────────

type DaStatus = LookaheadDerivedActivity['status']

const STATUS_META: Record<DaStatus, { label: string; color: string; bar: string; icon: typeof Clock }> = {
  planned:   { label: 'Planejada',  color: '#6b6b6b', bar: 'bg-[#6b6b6b]',  icon: Clock         },
  ready:     { label: 'Pronta',     color: '#22c55e', bar: 'bg-[#22c55e]',  icon: CheckCircle2  },
  blocked:   { label: 'Bloqueada',  color: '#ef4444', bar: 'bg-[#ef4444]',  icon: AlertTriangle },
  completed: { label: 'Concluída',  color: '#3b82f6', bar: 'bg-[#3b82f6]',  icon: CircleDot     },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function weekLabel(weekIso: string): string {
  const [year, wPart] = weekIso.split('-W')
  return `Semana ${wPart} / ${year}`
}

function weekShort(weekIso: string): string {
  const [year, wPart] = weekIso.split('-W')
  return `S${wPart}/${year.slice(2)}`
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function isCurrentWeek(weekIso: string): boolean {
  const today = new Date()
  const jan4  = new Date(today.getFullYear(), 0, 4)
  const weekNum = Math.ceil(((today.getTime() - jan4.getTime()) / 86400000 + jan4.getDay() + 1) / 7)
  return weekIso === `${today.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const color   = clamped >= 80 ? '#22c55e' : clamped >= 40 ? '#2abfdc' : '#fbbf24'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#20406a] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-[#6b6b6b] w-7 text-right">{clamped}%</span>
    </div>
  )
}

// ─── Activity card ────────────────────────────────────────────────────────────

interface CardProps {
  da: LookaheadDerivedActivity
  master: MasterActivity | undefined
  onClick: () => void
}

function ActivityCard({ da, master, onClick }: CardProps) {
  const meta = STATUS_META[da.status]
  const Icon = meta.icon

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#0d2040] border border-[#20406a] rounded-xl overflow-hidden hover:border-[#2abfdc]/40 hover:bg-[#14294e] transition-all group"
    >
      {/* Left color bar */}
      <div className="flex">
        <div className={cn('w-1 shrink-0', meta.bar)} />
        <div className="flex-1 p-3 flex flex-col gap-2">
          {/* Row 1: WBS + responsible + status */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {master?.wbsCode && (
                <span className="text-[10px] font-mono text-[#2abfdc] shrink-0">{master.wbsCode}</span>
              )}
              {master?.responsibleTeam && (
                <span className="flex items-center gap-1 text-[10px] text-[#6b6b6b] shrink-0">
                  <Users size={9} />
                  {master.responsibleTeam}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Icon size={11} style={{ color: meta.color }} />
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: meta.color + '1a', color: meta.color }}
              >
                {meta.label}
              </span>
            </div>
          </div>

          {/* Row 2: Activity name */}
          <p className="text-xs font-medium text-[#f5f5f5] leading-snug">{da.name}</p>

          {/* Row 3: Progress bar (if master exists) */}
          {master && <ProgressBar pct={master.percentComplete} />}

          {/* Row 4: Dates + duration + restrictions */}
          <div className="flex items-center gap-3 text-[10px] text-[#6b6b6b]">
            {master && (
              <span className="flex items-center gap-1">
                <CalendarDays size={9} />
                {fmtDate(master.trendStart)} → {fmtDate(master.trendEnd)}
                <span className="text-[#3f3f3f]">·</span>
                {master.durationDays}d
              </span>
            )}
            {da.linkedRestrictionIds && da.linkedRestrictionIds.length > 0 && (
              <span className="flex items-center gap-1 text-[#ef4444]">
                <AlertTriangle size={9} />
                {da.linkedRestrictionIds.length} restrição(ões)
              </span>
            )}
            <span className="ml-auto text-[#3f3f3f] group-hover:text-[#6b6b6b] transition-colors">
              <ChevronRight size={10} />
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  da: LookaheadDerivedActivity
  master: MasterActivity | undefined
  baseline: MasterActivity | undefined
  onClose: () => void
  onUpdateStatus: (status: DaStatus) => void
  onUpdateNotes:  (notes: string) => void
  onViewInChart:  () => void
}

function DetailModal({ da, master, baseline, onClose, onUpdateStatus, onUpdateNotes, onViewInChart }: DetailModalProps) {
  const [notes, setNotes] = useState(da.notes ?? '')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#14294e] border border-[#20406a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#20406a]">
          <div className="flex-1 min-w-0 pr-3">
            {master?.wbsCode && (
              <p className="text-[10px] font-mono text-[#2abfdc] mb-0.5">{master.wbsCode}</p>
            )}
            <h3 className="text-sm font-bold text-[#f5f5f5] leading-snug">{da.name}</h3>
            <p className="text-[10px] text-[#6b6b6b] mt-1">{weekShort(da.weekIso)} · {da.responsible}</p>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] shrink-0 mt-0.5">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Status selector */}
          <div>
            <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wide mb-2">Status</p>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.entries(STATUS_META) as [DaStatus, typeof STATUS_META[DaStatus]][]).map(([s, m]) => {
                const SIcon = m.icon
                return (
                  <button
                    key={s}
                    onClick={() => onUpdateStatus(s)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      da.status === s
                        ? 'border-2'
                        : 'border opacity-50 hover:opacity-80',
                    )}
                    style={
                      da.status === s
                        ? { borderColor: m.color, backgroundColor: m.color + '1a', color: m.color }
                        : { borderColor: '#20406a', color: '#6b6b6b' }
                    }
                  >
                    <SIcon size={11} />
                    {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Progress */}
          {master && (
            <div>
              <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wide mb-2">Progresso</p>
              <ProgressBar pct={master.percentComplete} />
            </div>
          )}

          {/* Dates comparison */}
          {master && (
            <div>
              <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wide mb-2">Datas</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2">
                  <p className="text-[9px] text-[#6b6b6b] mb-1">Tendência atual</p>
                  <p className="text-[#f5f5f5] font-medium">{fmtDate(master.trendStart)} → {fmtDate(master.trendEnd)}</p>
                  <p className="text-[#6b6b6b] text-[9px] mt-0.5">{master.durationDays} dias</p>
                </div>
                {baseline && (
                  <div className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2">
                    <p className="text-[9px] text-[#6b6b6b] mb-1">Baseline</p>
                    <p className="text-[#a3a3a3] font-medium">{fmtDate(baseline.plannedStart)} → {fmtDate(baseline.plannedEnd)}</p>
                    <p className="text-[#6b6b6b] text-[9px] mt-0.5">{baseline.durationDays} dias</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Restrictions */}
          {da.linkedRestrictionIds && da.linkedRestrictionIds.length > 0 && (
            <div>
              <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wide mb-2">Restrições vinculadas</p>
              <div className="flex flex-col gap-1.5">
                {da.linkedRestrictionIds.map((rid) => (
                  <div key={rid} className="flex items-center gap-2 bg-[#dc2626]/10 border border-[#dc2626]/30 rounded-lg px-3 py-2">
                    <AlertTriangle size={11} className="text-[#ef4444] shrink-0" />
                    <span className="text-xs text-[#f87171] font-mono">{rid}</span>
                    <span className="text-[10px] text-[#6b6b6b] ml-1">— ver em LPS/Lean → Restrições</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked trechos */}
          {master?.linkedTrechoCodes && master.linkedTrechoCodes.length > 0 && (
            <div>
              <p className="text-[10px] text-[#6b6b6b] uppercase tracking-wide mb-2">Trechos vinculados</p>
              <div className="flex gap-1.5 flex-wrap">
                {master.linkedTrechoCodes.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-[#2abfdc]/10 text-[#2abfdc] border border-[#2abfdc]/20">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[10px] text-[#6b6b6b] uppercase tracking-wide mb-2 block">
              <FileText size={9} className="inline mr-1" />Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => onUpdateNotes(notes)}
              rows={3}
              placeholder="Adicionar observações..."
              className="w-full bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] placeholder:text-[#3f3f3f] focus:outline-none focus:border-[#2abfdc]/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#20406a]">
          <button
            onClick={onViewInChart}
            className="flex items-center gap-1.5 text-xs text-[#2abfdc] hover:text-[#2abfdc]/80 transition-colors"
          >
            <TrendingUp size={12} /> Ver no Cronograma
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-[#6b6b6b] border border-[#20406a] rounded-lg hover:text-[#f5f5f5] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function DerivacaoPanel() {
  const {
    derivedActivities, lookaheadWeeks, activities, baselines, activeBaselineId,
    setLookaheadWeeks, deriveFromMaster, updateDerivedActivity, setActiveTab,
  } = usePlanejamentoMestreStore(
    useShallow((s) => ({
      derivedActivities:     s.derivedActivities,
      lookaheadWeeks:        s.lookaheadWeeks,
      activities:            s.activities,
      baselines:             s.baselines,
      activeBaselineId:      s.activeBaselineId,
      setLookaheadWeeks:     s.setLookaheadWeeks,
      deriveFromMaster:      s.deriveFromMaster,
      updateDerivedActivity: s.updateDerivedActivity,
      setActiveTab:          s.setActiveTab,
    }))
  )

  const [statusFilter, setStatusFilter] = useState<DaStatus | 'todas'>('todas')
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const weekRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Auto-derive on mount
  useEffect(() => {
    if (derivedActivities.length === 0 && activities.length > 0) {
      deriveFromMaster()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Baseline activities map for comparison
  const baselineActivities = baselines.find((b) => b.id === activeBaselineId)?.activities ?? []
  const masterMap   = new Map<string, MasterActivity>(activities.map((a) => [a.id, a]))
  const baselineMap = new Map<string, MasterActivity>(baselineActivities.map((a) => [a.id, a]))

  // Group + filter
  const filtered = statusFilter === 'todas'
    ? derivedActivities
    : derivedActivities.filter((d) => d.status === statusFilter)

  const weekGroups = new Map<string, LookaheadDerivedActivity[]>()
  for (const da of filtered) {
    const list = weekGroups.get(da.weekIso) ?? []
    list.push(da)
    weekGroups.set(da.weekIso, list)
  }
  const sortedWeeks = Array.from(weekGroups.entries()).sort(([wa], [wb]) => wa.localeCompare(wb))
  const allWeeks    = [...new Set(derivedActivities.map((da2) => da2.weekIso))].sort()

  const counts = {
    planned:   derivedActivities.filter((da2) => da2.status === 'planned').length,
    ready:     derivedActivities.filter((da2) => da2.status === 'ready').length,
    blocked:   derivedActivities.filter((da2) => da2.status === 'blocked').length,
    completed: derivedActivities.filter((da2) => da2.status === 'completed').length,
  }

  const selectedDa = selectedId ? derivedActivities.find((d) => d.id === selectedId) : null

  function scrollToWeek(weekIso: string) {
    weekRefs.current[weekIso]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        {/* Horizon selector */}
        <div className="flex items-center gap-2">
          <span className="text-[#6b6b6b] text-xs">Horizonte:</span>
          {[4, 6, 8].map((w) => (
            <button
              key={w}
              onClick={() => setLookaheadWeeks(w)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                lookaheadWeeks === w
                  ? 'bg-[#2abfdc]/20 text-[#2abfdc] border border-[#2abfdc]/40'
                  : 'border border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3]',
              )}
            >
              {w} sem
            </button>
          ))}
        </div>

        <button
          onClick={deriveFromMaster}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] transition-colors"
        >
          <RefreshCw size={12} />
          Derivar
        </button>

        {/* Status filter */}
        <div className="flex gap-1 ml-auto flex-wrap">
          <button
            onClick={() => setStatusFilter('todas')}
            className={cn(
              'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
              statusFilter === 'todas'
                ? 'border-[#2abfdc]/40 bg-[#2abfdc]/10 text-[#2abfdc]'
                : 'border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3]',
            )}
          >
            Todas ({derivedActivities.length})
          </button>
          {(Object.entries(STATUS_META) as [DaStatus, typeof STATUS_META[DaStatus]][]).map(([s, m]) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                statusFilter === s
                  ? 'border-opacity-40 text-white'
                  : 'border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3]',
              )}
              style={
                statusFilter === s
                  ? { borderColor: m.color, backgroundColor: m.color + '20', color: m.color }
                  : {}
              }
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />
              {counts[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout: week nav + agenda */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Week nav sidebar */}
        <div className="w-32 shrink-0 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[9px] uppercase tracking-wide text-[#3f3f3f] px-1 mb-1">Semanas</p>
          {allWeeks.map((w) => {
            const isCurrent = isCurrentWeek(w)
            const hasItems  = weekGroups.has(w)
            return (
              <button
                key={w}
                onClick={() => scrollToWeek(w)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors',
                  isCurrent
                    ? 'bg-orange-900/20 text-orange-400 border border-orange-900/40'
                    : hasItems
                    ? 'text-[#f5f5f5] hover:bg-[#14294e] border border-transparent hover:border-[#20406a]'
                    : 'text-[#3f3f3f] border border-transparent',
                )}
              >
                {weekShort(w)}
                {isCurrent && <span className="text-[8px] block text-orange-500/80">atual</span>}
              </button>
            )
          })}
        </div>

        {/* Agenda body */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1">
          {sortedWeeks.length === 0 && (
            <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-8 text-center">
              <Clock size={32} className="text-[#6b6b6b] mx-auto mb-3" />
              <p className="text-[#6b6b6b] text-sm">Nenhuma atividade derivada.</p>
              <p className="text-[#6b6b6b] text-xs mt-1">
                Clique em <span className="text-[#2abfdc]">Derivar</span> para gerar o look-ahead.
              </p>
            </div>
          )}

          {sortedWeeks.map(([weekIso, items]) => {
            const isCurrent = isCurrentWeek(weekIso)
            return (
              <div
                key={weekIso}
                ref={(el) => { weekRefs.current[weekIso] = el }}
                className="flex flex-col gap-2"
              >
                {/* Week header */}
                <div className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg',
                  isCurrent ? 'bg-orange-900/15 border border-orange-900/30' : 'border-b border-[#20406a]',
                )}>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-bold', isCurrent ? 'text-orange-400' : 'text-[#f5f5f5]')}>
                      {weekLabel(weekIso)}
                    </span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-orange-900/30 text-orange-400 border border-orange-900/40">
                        semana atual
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#6b6b6b]">{items.length} atividade{items.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {items.map((da) => (
                    <ActivityCard
                      key={da.id}
                      da={da}
                      master={masterMap.get(da.masterActivityId)}
                      onClick={() => setSelectedId(da.id)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail modal */}
      {selectedDa && (
        <DetailModal
          da={selectedDa}
          master={masterMap.get(selectedDa.masterActivityId)}
          baseline={baselineMap.get(selectedDa.masterActivityId)}
          onClose={() => setSelectedId(null)}
          onUpdateStatus={(status) => {
            updateDerivedActivity(selectedDa.id, { status })
            setSelectedId(null)
          }}
          onUpdateNotes={(notes) => updateDerivedActivity(selectedDa.id, { notes })}
          onViewInChart={() => { setActiveTab('macro'); setSelectedId(null) }}
        />
      )}
    </div>
  )
}
