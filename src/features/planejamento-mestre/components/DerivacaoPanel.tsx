/**
 * DerivacaoPanel — Médio Prazo: Look-ahead grid.
 * Rows = unique activities grouped by networkType (ÁGUA / ESGOTO / SERVIÇOS CIVIS).
 * Columns = ISO weeks.
 * PPC row at bottom.
 * Click cell → detail modal.
 */
import { useState } from 'react'
import { RefreshCw, X, AlertTriangle } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import type { LookaheadDerivedActivity } from '@/types'
import { cn } from '@/lib/utils'

// ─── Status helpers ───────────────────────────────────────────────────────────

type DaStatus = LookaheadDerivedActivity['status']

const STATUS_DOT: Record<DaStatus, string> = {
  planned:   'bg-[#2abfdc]',
  ready:     'bg-[#22c55e]',
  blocked:   'bg-[#ef4444]',
  completed: 'bg-[#3b82f6]',
}

const STATUS_LABEL: Record<DaStatus, string> = {
  planned:   'P',
  ready:     'P',
  blocked:   'B',
  completed: 'E',
}

const STATUS_TEXT: Record<DaStatus, string> = {
  planned:   'Planejado',
  ready:     'Pronto',
  blocked:   'Bloqueado',
  completed: 'Executado',
}

type NetworkFilter = 'all' | 'agua' | 'esgoto'
type NetworkType   = 'agua' | 'esgoto' | 'civil' | 'geral' | undefined

function sectionOf(nt: NetworkType): 'agua' | 'esgoto' | 'civil' {
  if (nt === 'agua')   return 'agua'
  if (nt === 'civil')  return 'civil'
  return 'esgoto' // esgoto, geral, undefined → esgoto section
}

function weekShort(weekIso: string): string {
  const [year, wPart] = weekIso.split('-W')
  return `S${wPart}/${year.slice(2)}`
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  da: LookaheadDerivedActivity
  onClose: () => void
}

function DetailModal({ da, onClose }: DetailModalProps) {
  const updateDerivedActivity = usePlanejamentoMestreStore((s) => s.updateDerivedActivity)
  const [status, setStatus]   = useState<DaStatus>(da.status)
  const [notes, setNotes]     = useState(da.notes ?? '')

  function handleSave() {
    updateDerivedActivity(da.id, { status, notes: notes || undefined })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#20406a] bg-[#112645] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#20406a]">
          <h3 className="text-[#f5f5f5] font-bold text-sm">{da.name}</h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[#6b6b6b] text-[10px] mb-1">Semana</p>
              <p className="text-[#f5f5f5]">{weekShort(da.weekIso)}</p>
            </div>
            <div>
              <p className="text-[#6b6b6b] text-[10px] mb-1">Responsável</p>
              <p className="text-[#f5f5f5]">{da.responsible}</p>
            </div>
          </div>

          <div>
            <p className="text-[#6b6b6b] text-[10px] mb-1 uppercase tracking-widest">Status</p>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(STATUS_LABEL) as DaStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                    status === s
                      ? 'bg-[#2abfdc] text-white border-[#2abfdc]'
                      : 'bg-transparent text-[#6b6b6b] border-[#20406a] hover:text-[#a3a3a3]'
                  )}
                >
                  {STATUS_TEXT[s]}
                </button>
              ))}
            </div>
          </div>

          {da.linkedRestrictionIds && da.linkedRestrictionIds.length > 0 && (
            <div>
              <p className="text-[#6b6b6b] text-[10px] mb-1 uppercase tracking-widest">Restrições</p>
              <div className="flex flex-col gap-1">
                {da.linkedRestrictionIds.map((rid) => (
                  <div key={rid} className="flex items-center gap-1.5 text-xs text-[#ef4444]">
                    <AlertTriangle size={11} />
                    <span>{rid}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[#6b6b6b] text-[10px] mb-1 uppercase tracking-widest">Observações</p>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações..."
              className="w-full bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#2abfdc]/60 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#20406a]">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#20406a] text-xs text-[#6b6b6b] hover:text-[#a3a3a3]">Cancelar</button>
          <button onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8]">Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Grid Cell ────────────────────────────────────────────────────────────────

interface CellProps {
  da?: LookaheadDerivedActivity
  onClick: () => void
}

function Cell({ da, onClick }: CellProps) {
  if (!da) {
    return <td className="px-1 py-0.5 border border-[#20406a]/40 bg-[#0d2040]/20 min-w-[72px]" />
  }

  const dot  = STATUS_DOT[da.status]
  const lbl  = STATUS_LABEL[da.status]
  const pct  = da.percentComplete
  const rest = da.linkedRestrictionIds?.length ?? 0

  return (
    <td
      className="px-1.5 py-1 border border-[#20406a]/40 cursor-pointer hover:bg-[#14294e] transition-colors min-w-[72px] align-top"
      onClick={onClick}
    >
      <div className="flex items-start gap-1">
        <span className={cn('mt-0.5 w-2 h-2 rounded-full shrink-0', dot)} />
        <div className="min-w-0">
          <span className="text-[9px] font-bold text-[#f5f5f5]">{lbl}</span>
          {pct !== undefined && pct > 0 && pct < 100 && (
            <span className="text-[9px] text-[#a3a3a3] ml-0.5">{pct}%</span>
          )}
          {rest > 0 && (
            <span className="ml-0.5 text-[9px] text-[#ef4444]">🚧{rest}</span>
          )}
        </div>
      </div>
    </td>
  )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function DerivacaoPanel() {
  const { derivedActivities, lookaheadWeeks, activities } = usePlanejamentoMestreStore(
    useShallow((s) => ({
      derivedActivities: s.derivedActivities,
      lookaheadWeeks:    s.lookaheadWeeks,
      activities:        s.activities,
    }))
  )
  const setLookaheadWeeks = usePlanejamentoMestreStore((s) => s.setLookaheadWeeks)
  const deriveFromMaster  = usePlanejamentoMestreStore((s) => s.deriveFromMaster)

  const [filter,     setFilter]     = useState<NetworkFilter>('all')
  const [selectedDa, setSelectedDa] = useState<LookaheadDerivedActivity | null>(null)

  // Build sorted list of ISO weeks present in derived activities
  const allWeeks = [...new Set(derivedActivities.map((d) => d.weekIso))].sort()

  // Map masterActivityId → networkType (from master activities)
  const actMap = new Map<string, typeof activities[number]>(activities.map((a) => [a.id, a]))

  // Get all unique activities (by masterActivityId), preserving networkType
  const uniqueActIds = [...new Set(derivedActivities.map((d) => d.masterActivityId))]

  // Build rows: { masterActivityId, name, networkType, cells: Map<weekIso, da> }
  const rows = uniqueActIds.map((mid) => {
    const das = derivedActivities.filter((d) => d.masterActivityId === mid)
    const first = das[0]
    const masterAct = actMap.get(mid)
    const networkType: NetworkType = first?.networkType ?? masterAct?.networkType
    const cellMap = new Map<string, LookaheadDerivedActivity>(das.map((d) => [d.weekIso, d]))
    return {
      masterActivityId: mid,
      name: first?.name ?? masterAct?.name ?? mid,
      responsible: first?.responsible ?? '—',
      networkType,
      section: sectionOf(networkType),
      cellMap,
    }
  })

  // Filter by section
  const filteredRows = rows.filter((r) => {
    if (filter === 'agua')   return r.section === 'agua'
    if (filter === 'esgoto') return r.section === 'esgoto'
    return true
  })

  const aguaRows  = filteredRows.filter((r) => r.section === 'agua')
  const esgotoRows = filteredRows.filter((r) => r.section === 'esgoto')
  const civilRows = filteredRows.filter((r) => r.section === 'civil')

  // PPC per week: completed / (all non-empty) * 100
  function ppc(weekIso: string): number | null {
    const cellsThisWeek = derivedActivities.filter((d) => d.weekIso === weekIso)
    if (cellsThisWeek.length === 0) return null
    const completed = cellsThisWeek.filter((d) => d.status === 'completed').length
    return Math.round((completed / cellsThisWeek.length) * 100)
  }

  function ppcColor(v: number): string {
    if (v >= 80) return 'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/30'
    if (v >= 60) return 'text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/30'
    return 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/30'
  }

  const hasData = derivedActivities.length > 0

  return (
    <div className="flex flex-col gap-4 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        {/* Horizon selector */}
        <div className="flex items-center gap-1 bg-[#14294e] border border-[#20406a] rounded-lg p-0.5">
          {[4, 6, 8].map((w) => (
            <button
              key={w}
              onClick={() => setLookaheadWeeks(w)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                lookaheadWeeks === w ? 'bg-[#2abfdc] text-white' : 'text-[#6b6b6b] hover:text-[#a3a3a3]'
              )}
            >
              {w}S
            </button>
          ))}
        </div>

        {/* Derive button */}
        <button
          onClick={deriveFromMaster}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] transition-colors"
        >
          <RefreshCw size={12} />
          Derivar do Mestre
        </button>

        {/* Section filter */}
        <div className="flex items-center gap-1 bg-[#14294e] border border-[#20406a] rounded-lg p-0.5 ml-auto">
          {([['all', 'Todas'], ['agua', 'Água'], ['esgoto', 'Esgoto']] as [NetworkFilter, string][]).map(([key, lbl]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-medium transition-colors',
                filter === key ? 'bg-[#2abfdc] text-white' : 'text-[#6b6b6b] hover:text-[#a3a3a3]'
              )}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="flex-1 flex items-center justify-center py-16 text-[#6b6b6b] text-sm">
          Clique em &ldquo;Derivar do Mestre&rdquo; para gerar o look-ahead de {lookaheadWeeks} semanas.
        </div>
      ) : (
        <div className="overflow-auto flex-1 rounded-xl border border-[#20406a]">
          <table className="border-collapse text-xs min-w-full">
            <thead>
              <tr className="bg-[#0d2040] sticky top-0 z-10">
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-semibold border border-[#20406a] min-w-[180px] sticky left-0 bg-[#0d2040] z-20">
                  Atividade
                </th>
                {allWeeks.map((w) => (
                  <th key={w} className="px-2 py-2 text-center text-[#6b6b6b] font-semibold border border-[#20406a] min-w-[72px] whitespace-nowrap">
                    {weekShort(w)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* ÁGUA section */}
              {aguaRows.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={allWeeks.length + 1}
                      className="px-3 py-1.5 bg-[#2abfdc]/10 text-[#2abfdc] text-[10px] font-bold uppercase tracking-widest border border-[#20406a]"
                    >
                      ══ ÁGUA ══
                    </td>
                  </tr>
                  {aguaRows.map((row) => (
                    <tr key={row.masterActivityId} className="hover:bg-[#14294e]/50">
                      <td className="px-3 py-1.5 border border-[#20406a] text-[#a3a3a3] sticky left-0 bg-[#0d1117] z-10 whitespace-nowrap">
                        <p className="text-[#f5f5f5] font-medium text-[11px] truncate max-w-[160px]">{row.name}</p>
                        <p className="text-[#6b6b6b] text-[9px]">{row.responsible}</p>
                      </td>
                      {allWeeks.map((w) => (
                        <Cell
                          key={w}
                          da={row.cellMap.get(w)}
                          onClick={() => { const d = row.cellMap.get(w); if (d) setSelectedDa(d) }}
                        />
                      ))}
                    </tr>
                  ))}
                </>
              )}

              {/* ESGOTO section */}
              {esgotoRows.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={allWeeks.length + 1}
                      className="px-3 py-1.5 bg-[#22c55e]/10 text-[#22c55e] text-[10px] font-bold uppercase tracking-widest border border-[#20406a]"
                    >
                      ══ ESGOTO ══
                    </td>
                  </tr>
                  {esgotoRows.map((row) => (
                    <tr key={row.masterActivityId} className="hover:bg-[#14294e]/50">
                      <td className="px-3 py-1.5 border border-[#20406a] text-[#a3a3a3] sticky left-0 bg-[#0d1117] z-10 whitespace-nowrap">
                        <p className="text-[#f5f5f5] font-medium text-[11px] truncate max-w-[160px]">{row.name}</p>
                        <p className="text-[#6b6b6b] text-[9px]">{row.responsible}</p>
                      </td>
                      {allWeeks.map((w) => (
                        <Cell
                          key={w}
                          da={row.cellMap.get(w)}
                          onClick={() => { const d = row.cellMap.get(w); if (d) setSelectedDa(d) }}
                        />
                      ))}
                    </tr>
                  ))}
                </>
              )}

              {/* SERVIÇOS CIVIS section */}
              {civilRows.length > 0 && (
                <>
                  <tr>
                    <td
                      colSpan={allWeeks.length + 1}
                      className="px-3 py-1.5 bg-[#f59e0b]/10 text-[#f59e0b] text-[10px] font-bold uppercase tracking-widest border border-[#20406a]"
                    >
                      ══ SERVIÇOS CIVIS ══
                    </td>
                  </tr>
                  {civilRows.map((row) => (
                    <tr key={row.masterActivityId} className="hover:bg-[#14294e]/50">
                      <td className="px-3 py-1.5 border border-[#20406a] text-[#a3a3a3] sticky left-0 bg-[#0d1117] z-10 whitespace-nowrap">
                        <p className="text-[#f5f5f5] font-medium text-[11px] truncate max-w-[160px]">{row.name}</p>
                        <p className="text-[#6b6b6b] text-[9px]">{row.responsible}</p>
                      </td>
                      {allWeeks.map((w) => (
                        <Cell
                          key={w}
                          da={row.cellMap.get(w)}
                          onClick={() => { const d = row.cellMap.get(w); if (d) setSelectedDa(d) }}
                        />
                      ))}
                    </tr>
                  ))}
                </>
              )}

              {/* PPC row */}
              <tr className="bg-[#14294e] sticky bottom-0">
                <td className="px-3 py-2 border border-[#20406a] text-[#6b6b6b] font-bold text-[10px] uppercase tracking-widest sticky left-0 bg-[#14294e] z-10">
                  PPC da Semana
                </td>
                {allWeeks.map((w) => {
                  const v = ppc(w)
                  return (
                    <td key={w} className="px-1.5 py-1.5 border border-[#20406a] text-center">
                      {v === null ? (
                        <span className="text-[#6b6b6b] text-[9px]">—</span>
                      ) : (
                        <span className={cn('px-1.5 py-0.5 rounded border text-[9px] font-bold tabular-nums', ppcColor(v))}>
                          {v}%
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {hasData && (
        <div className="flex items-center gap-4 shrink-0 text-[10px] text-[#6b6b6b]">
          <span className="font-semibold">Legenda:</span>
          {(Object.entries(STATUS_DOT) as [DaStatus, string][]).map(([s, dot]) => (
            <div key={s} className="flex items-center gap-1">
              <span className={cn('w-2 h-2 rounded-full', dot)} />
              <span>{STATUS_TEXT[s]}</span>
            </div>
          ))}
          <span className="ml-2">🚧 = Restrições vinculadas</span>
        </div>
      )}

      {/* Detail modal */}
      {selectedDa && (
        <DetailModal da={selectedDa} onClose={() => setSelectedDa(null)} />
      )}
    </div>
  )
}
