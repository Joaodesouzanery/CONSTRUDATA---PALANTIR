/**
 * DerivacaoPanel — Médio Prazo: Look-ahead 6-week grid.
 * Rows = unique activities grouped by networkType (categoria). Columns = 6 ISO weeks.
 * Deriva automaticamente do mestre (cascata) e permite adicionar/editar/excluir
 * atividades, refletindo em Longo/Curto Prazo e Programação Semanal.
 */
import { useState, useMemo, useEffect } from 'react'
import { RefreshCw, X, AlertTriangle, Plus, Trash2, Target } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useLpsStore } from '@/store/lpsStore'
import { usePlanoExecucaoStore } from '@/store/planoExecucaoStore'
import { NETWORK_TYPE_OPTIONS, networkColor, networkLabel, type NetworkCategory } from '../networkCategories'
import { isoWeekStrip } from '../utils/masterEngine'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { LookaheadDerivedActivity, MasterActivity } from '@/types'
import { cn } from '@/lib/utils'

// ─── Status helpers ───────────────────────────────────────────────────────────

type DaStatus = LookaheadDerivedActivity['status']

const STATUS_DOT: Record<DaStatus, string> = {
  planned:   'bg-[#f97316]',
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

const STATUS_BG: Record<DaStatus, string> = {
  planned:   'bg-[#f97316]/8',
  ready:     'bg-[#22c55e]/8',
  blocked:   'bg-[#ef4444]/8',
  completed: 'bg-[#3b82f6]/8',
}

function categoryOf(nt?: string): NetworkCategory {
  const found = NETWORK_TYPE_OPTIONS.find((o) => o.value === nt)
  return found ? found.value : 'geral'
}

/** Returns "S15/26" */
function weekShort(weekIso: string): string {
  const [year, wPart] = weekIso.split('-W')
  return `S${wPart}/${year.slice(2)}`
}

/** Returns Mon–Fri date range string for an ISO week */
function weekDateRange(weekIso: string): string {
  const [year, wStr] = weekIso.split('-W')
  const w = parseInt(wStr, 10)
  const jan4 = new Date(parseInt(year, 10), 0, 4)
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - (jan4.getDay() || 7) + 1 + (w - 1) * 7)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
  return `${fmt(monday)}–${fmt(friday)}`
}

const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60'

// ─── New Activity Modal ─────────────────────────────────────────────────────────

function NewActivityModal({ onClose }: { onClose: () => void }) {
  const addActivity = usePlanejamentoMestreStore((s) => s.addActivity)
  const activities  = usePlanejamentoMestreStore((s) => s.activities)
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    name: '', networkType: 'geral' as NetworkCategory, nucleo: '',
    plannedStart: today, plannedEnd: today,
  })

  function handleSave() {
    if (!form.name.trim()) return
    const start = form.plannedStart || today
    const end = form.plannedEnd || start
    const dur = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000))
    const leafCount = activities.filter((a) => a.level >= 1).length + 1
    addActivity({
      wbsCode: `M.${leafCount}`,
      name: form.name.trim(),
      parentId: null,
      level: 1,
      plannedStart: start,
      plannedEnd: end,
      trendStart: start,
      trendEnd: end,
      durationDays: dur,
      percentComplete: 0,
      status: 'not_started',
      isMilestone: false,
      networkType: form.networkType,
      nucleo: form.nucleo || undefined,
      plannedProgressPct: 0,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[#525252] bg-[#333333] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <h3 className="text-[#f5f5f5] font-bold text-sm">Nova atividade</h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          <div>
            <label className="text-[#6b6b6b] text-[10px] block mb-1 uppercase tracking-widest">Nome</label>
            <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex.: Assentamento de tubulação" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#6b6b6b] text-[10px] block mb-1 uppercase tracking-widest">Categoria</label>
              <select className={inputCls} value={form.networkType} onChange={(e) => setForm((f) => ({ ...f, networkType: e.target.value as NetworkCategory }))}>
                {NETWORK_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[#6b6b6b] text-[10px] block mb-1 uppercase tracking-widest">Núcleo/Área</label>
              <input className={inputCls} value={form.nucleo} onChange={(e) => setForm((f) => ({ ...f, nucleo: e.target.value }))} placeholder="Opcional" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#6b6b6b] text-[10px] block mb-1 uppercase tracking-widest">Início</label>
              <input type="date" className={inputCls} value={form.plannedStart} onChange={(e) => setForm((f) => ({ ...f, plannedStart: e.target.value }))} />
            </div>
            <div>
              <label className="text-[#6b6b6b] text-[10px] block mb-1 uppercase tracking-widest">Fim</label>
              <input type="date" className={inputCls} value={form.plannedEnd} onChange={(e) => setForm((f) => ({ ...f, plannedEnd: e.target.value }))} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-[#525252]">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#525252] text-xs text-[#6b6b6b] hover:text-[#a3a3a3]">Cancelar</button>
          <button onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c]">Adicionar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Modal (status/notes + edição/exclusão do mestre) ────────────────────

interface DetailModalProps {
  da: LookaheadDerivedActivity
  onClose: () => void
}

function DetailModal({ da, onClose }: DetailModalProps) {
  const updateDerivedActivity = usePlanejamentoMestreStore((s) => s.updateDerivedActivity)
  const updateActivity        = usePlanejamentoMestreStore((s) => s.updateActivity)
  const removeActivity        = usePlanejamentoMestreStore((s) => s.removeActivity)
  const master = usePlanejamentoMestreStore((s) => s.activities.find((a) => a.id === da.masterActivityId))

  function criarPlanoExecucao() {
    usePlanoExecucaoStore.getState().addPlano({
      obraNome: da.name || 'Plano',
      servico: da.name || '',
      periodoInicio: master?.plannedStart ?? '',
      periodoFim: master?.plannedEnd ?? '',
    })
    onClose()
    alert('Plano de Execução criado a partir desta atividade. Abra a aba "Execução" para preencher rendimento, custo e cronograma.')
  }

  const [status, setStatus]   = useState<DaStatus>(da.status)
  const [notes, setNotes]     = useState(da.notes ?? '')
  const [name, setName]       = useState(master?.name ?? da.name)
  const [networkType, setNetworkType] = useState<NetworkCategory>(categoryOf(master?.networkType))
  const [plannedStart, setPlannedStart] = useState(master?.plannedStart ?? '')
  const [plannedEnd, setPlannedEnd]     = useState(master?.plannedEnd ?? '')
  const [confirmDel, setConfirmDel] = useState(false)

  function handleSave() {
    updateDerivedActivity(da.id, { status, notes: notes || undefined })
    if (master) {
      const patch: Partial<MasterActivity> = { name, networkType }
      if (plannedStart) patch.plannedStart = plannedStart
      if (plannedEnd) patch.plannedEnd = plannedEnd
      updateActivity(master.id, patch)
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div>
            <h3 className="text-[#f5f5f5] font-bold text-sm">{da.name}</h3>
            <p className="text-[#6b6b6b] text-[10px] mt-0.5">{weekShort(da.weekIso)} · {da.responsible}</p>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div>
            <p className="text-[#6b6b6b] text-[10px] mb-2 uppercase tracking-widest">Status</p>
            <div className="flex gap-2 flex-wrap">
              {(Object.keys(STATUS_LABEL) as DaStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                    status === s
                      ? 'bg-[#f97316] text-white border-[#f97316]'
                      : 'bg-transparent text-[#6b6b6b] border-[#525252] hover:text-[#a3a3a3]'
                  )}
                >
                  {STATUS_TEXT[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Edição da atividade-mestre (reflete em todos os horizontes) */}
          {master && (
            <div className="flex flex-col gap-3 rounded-lg border border-[#525252]/60 p-3">
              <p className="text-[#6b6b6b] text-[10px] uppercase tracking-widest">Editar atividade</p>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
              <select className={inputCls} value={networkType} onChange={(e) => setNetworkType(e.target.value as NetworkCategory)}>
                {NETWORK_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" className={inputCls} value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
                <input type="date" className={inputCls} value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} />
              </div>
            </div>
          )}

          {da.linkedRestrictionIds && da.linkedRestrictionIds.length > 0 && (
            <div>
              <p className="text-[#6b6b6b] text-[10px] mb-1 uppercase tracking-widest">Restrições</p>
              {da.linkedRestrictionIds.map((rid) => (
                <div key={rid} className="flex items-center gap-1.5 text-xs text-[#ef4444] mt-0.5">
                  <AlertTriangle size={11} /><span>{rid}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-[#6b6b6b] text-[10px] mb-1 uppercase tracking-widest">Observações</p>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações..."
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-[#525252]">
          {master ? (
            <button onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#ef4444]">
              <Trash2 size={13} /> Excluir
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={criarPlanoExecucao} title="Criar um Plano de Execução a partir desta atividade" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40">
              <Plus size={13} /> Criar Plano de Execução
            </button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#525252] text-xs text-[#6b6b6b] hover:text-[#a3a3a3]">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c]">Salvar</button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Excluir atividade"
        message={`Excluir "${master?.name ?? da.name}"? Será removida também do Longo Prazo, Curto Prazo e Programação Semanal.`}
        confirmLabel="Excluir"
        onConfirm={() => { if (master) removeActivity(master.id); setConfirmDel(false); onClose() }}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  )
}

// ─── Grid Cell ────────────────────────────────────────────────────────────────

interface CellProps {
  da?: LookaheadDerivedActivity
  onClick: () => void
  actName: string
}

function Cell({ da, onClick, actName }: CellProps) {
  if (!da) {
    return (
      <td
        className="border border-[#525252]/30 min-w-[88px] h-8"
        style={{ background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 6px)' }}
      />
    )
  }

  const dot  = STATUS_DOT[da.status]
  const lbl  = STATUS_LABEL[da.status]
  const bg   = STATUS_BG[da.status]
  const pct  = da.percentComplete
  const rest = da.linkedRestrictionIds?.length ?? 0

  return (
    <td
      title={`${actName} — ${STATUS_TEXT[da.status]}${pct ? ` (${pct}%)` : ''}${rest ? ` · ${rest} restrição(ões)` : ''}`}
      className={cn('border border-[#525252]/30 cursor-pointer transition-colors min-w-[88px] h-8 px-2 py-1 align-middle', bg, 'hover:brightness-125')}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('w-2 h-2 rounded-full shrink-0', dot)} />
        <span className="text-[10px] font-bold text-[#f5f5f5]">{lbl}</span>
        {pct !== undefined && pct > 0 && pct < 100 && (
          <span className="text-[9px] text-[#a3a3a3]">{pct}%</span>
        )}
        {rest > 0 && <span className="text-[9px] text-[#ef4444] ml-auto">⚠{rest}</span>}
      </div>
    </td>
  )
}

// ─── Section header row ───────────────────────────────────────────────────────

function SectionHeaderRow({ label, color, colSpan }: { label: string; color: string; colSpan: number }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-[#525252]/50"
        style={{ background: `${color}18`, color, borderLeft: `3px solid ${color}` }}
      >
        {label}
      </td>
    </tr>
  )
}

// ─── PPC row ──────────────────────────────────────────────────────────────────

function PpcRow({ weeks, das }: { weeks: string[]; das: LookaheadDerivedActivity[] }) {
  function ppc(weekIso: string): number | null {
    const week = das.filter((d) => d.weekIso === weekIso)
    if (week.length === 0) return null
    return Math.round((week.filter((d) => d.status === 'completed').length / week.length) * 100)
  }

  function ppcColor(v: number) {
    if (v >= 80) return 'text-[#22c55e] bg-[#22c55e]/15 border-[#22c55e]/30'
    if (v >= 60) return 'text-[#fbbf24] bg-[#fbbf24]/15 border-[#fbbf24]/30'
    return 'text-[#ef4444] bg-[#ef4444]/15 border-[#ef4444]/30'
  }

  return (
    <tr className="bg-[#0d1c36]">
      <td className="px-3 py-1.5 text-[9px] font-bold text-[#6b6b6b] uppercase tracking-widest sticky left-0 bg-[#0d1c36] z-10 border border-[#525252]/30 whitespace-nowrap">
        PPC Semana
      </td>
      {weeks.map((w) => {
        const v = ppc(w)
        return (
          <td key={w} className="px-2 py-1.5 text-center border border-[#525252]/30">
            {v === null ? (
              <span className="text-[#525252] text-[9px]">—</span>
            ) : (
              <span className={cn('px-1.5 py-0.5 rounded border text-[9px] font-bold tabular-nums', ppcColor(v))}>
                {v}%
              </span>
            )}
          </td>
        )
      })}
    </tr>
  )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function DerivacaoPanel() {
  const { derivedActivities, activities } = usePlanejamentoMestreStore(
    useShallow((s) => ({
      derivedActivities: s.derivedActivities,
      activities:        s.activities,
    }))
  )
  const deriveFromMaster = usePlanejamentoMestreStore((s) => s.deriveFromMaster)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)

  const [filter,     setFilter]     = useState<'all' | NetworkCategory>('all')
  const [selectedDa, setSelectedDa] = useState<LookaheadDerivedActivity | null>(null)
  const [showNew,    setShowNew]    = useState(false)

  // Cascata automática: re-deriva sempre que o mestre muda (preserva status via merge no store).
  useEffect(() => {
    if (activities.length > 0) deriveFromMaster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities])

  // Strip base FIXO de 6 semanas ISO a partir de hoje (garante as 6 colunas mesmo sem atividade),
  // UNIDO às semanas que realmente têm atividade derivada. A janela do deriveLookahead são 42 dias
  // a partir de hoje, que num dia não-segunda alcança uma 7ª semana ISO — incluí-la evita que as
  // atividades da cauda do horizonte fiquem invisíveis (linha em branco).
  const allWeeks = useMemo(() => {
    const strip = isoWeekStrip(new Date().toISOString().slice(0, 10), 6)
    const min = strip[0]
    const union = new Set(strip)
    for (const d of derivedActivities) if (d.weekIso >= min) union.add(d.weekIso)
    return [...union].sort()
  }, [derivedActivities])

  const actMap = useMemo(
    () => new Map<string, typeof activities[number]>(activities.map((a) => [a.id, a])),
    [activities]
  )

  const rows = useMemo(() => {
    const uniqueIds = [...new Set(derivedActivities.map((d) => d.masterActivityId))]
    return uniqueIds.map((mid) => {
      const das = derivedActivities.filter((d) => d.masterActivityId === mid)
      const first = das[0]
      const masterAct = actMap.get(mid)
      const category = categoryOf(first?.networkType ?? masterAct?.networkType)
      const cellMap = new Map<string, LookaheadDerivedActivity>(das.map((d) => [d.weekIso, d]))
      return {
        masterActivityId: mid,
        name: first?.name ?? masterAct?.name ?? mid,
        responsible: first?.responsible ?? '—',
        category,
        cellMap,
      }
    })
  }, [derivedActivities, actMap])

  const filteredRows = rows
    .filter((r) => !activeObraId || (actMap.get(r.masterActivityId)?.obraId ?? null) === activeObraId)
    .filter((r) => filter === 'all' || r.category === filter)

  // Categorias presentes (na ordem canônica), apenas as que têm linhas
  const presentCategories = NETWORK_TYPE_OPTIONS
    .map((o) => o.value)
    .filter((cat) => filteredRows.some((r) => r.category === cat))

  const hasData = derivedActivities.length > 0
  const colSpan = allWeeks.length + 1

  // Médio Prazo → LPS: envia as atividades derivadas para o lookahead do LPS (idempotente por sourceMasterId).
  const addLps = useLpsStore((s) => s.addActivity)
  const updateLps = useLpsStore((s) => s.updateActivity)
  function enviarParaLps() {
    let novas = 0
    for (const d of derivedActivities) {
      const key = `${d.masterActivityId}:${d.weekIso}`
      const existing = useLpsStore.getState().activities.find((a) => a.sourceMasterId === key)
      const fields = {
        week: d.weekIso,
        trechoCode: (d.name || 'MP').slice(0, 24),
        description: d.name || 'Atividade',
        planned: true,
        completed: d.status === 'completed',
        readyStatus: (d.status === 'ready' ? 'green' : d.status === 'blocked' ? 'red' : 'yellow') as 'green' | 'yellow' | 'red',
        plannedMeters: 0,
        sourceMasterId: key,
      }
      if (existing) {
        if (existing.description !== fields.description || existing.week !== fields.week || existing.readyStatus !== fields.readyStatus || existing.completed !== fields.completed) updateLps(existing.id, fields)
      } else { addLps(fields); novas++ }
    }
    alert(`Enviado ao Look-ahead (LPS): ${derivedActivities.length} atividade(s) do Médio Prazo (${novas} nova(s)). Veja na sub-aba "Look-ahead (LPS)" do Médio Prazo.`)
  }

  return (
    <div className="flex flex-col gap-4 overflow-hidden h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] transition-colors"
        >
          <Plus size={13} />
          Nova atividade
        </button>
        <button
          onClick={deriveFromMaster}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs font-medium hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors"
        >
          <RefreshCw size={12} />
          Atualizar
        </button>
        <button
          onClick={enviarParaLps}
          disabled={!hasData}
          title="Enviar as atividades do Médio Prazo para o Look-ahead (LPS) — sub-aba do Médio Prazo"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs font-medium hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors disabled:opacity-40"
        >
          <Target size={12} />
          Enviar ao Look-ahead
        </button>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | NetworkCategory)}
          className="ml-auto bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
        >
          <option value="all">Todas as categorias</option>
          {NETWORK_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-[#6b6b6b] text-sm">Nenhuma atividade. Adicione no Longo Prazo ou clique em &ldquo;Nova atividade&rdquo;.</p>
        </div>
      ) : (
        <div className="overflow-auto flex-1 rounded-xl border border-[#525252]">
          <table className="border-collapse text-xs min-w-full">
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#0a1628]">
                <th className="px-3 py-2.5 text-left text-[#6b6b6b] font-semibold border border-[#525252]/50 min-w-[190px] sticky left-0 bg-[#0a1628] z-30">
                  Atividade
                </th>
                {allWeeks.map((w) => (
                  <th key={w} className="px-2 py-1.5 text-center border border-[#525252]/50 min-w-[88px]">
                    <div className="text-[#f5f5f5] font-bold text-[11px]">{weekShort(w)}</div>
                    <div className="text-[#6b6b6b] text-[9px] font-normal mt-0.5">{weekDateRange(w)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {presentCategories.map((cat) => {
                const catRows = filteredRows.filter((r) => r.category === cat)
                if (catRows.length === 0) return null
                const color = networkColor(cat)
                return (
                  <SectionBlock
                    key={cat}
                    label={networkLabel(cat)}
                    color={color}
                    colSpan={colSpan}
                    rows={catRows}
                    weeks={allWeeks}
                    das={derivedActivities.filter((d) => categoryOf(actMap.get(d.masterActivityId)?.networkType) === cat)}
                    onSelect={setSelectedDa}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {hasData && (
        <div className="flex items-center gap-4 shrink-0 text-[10px] text-[#6b6b6b] flex-wrap">
          <span className="font-semibold">Legenda:</span>
          {(Object.entries(STATUS_DOT) as [DaStatus, string][]).map(([s, dot]) => (
            <div key={s} className="flex items-center gap-1">
              <span className={cn('w-2 h-2 rounded-full', dot)} />
              <span>{STATUS_TEXT[s]}</span>
            </div>
          ))}
          <span className="ml-2">⚠ = Restrição</span>
        </div>
      )}

      {selectedDa && <DetailModal da={selectedDa} onClose={() => setSelectedDa(null)} />}
      {showNew && <NewActivityModal onClose={() => setShowNew(false)} />}
    </div>
  )
}

// ─── Section block (header + rows + ppc) ────────────────────────────────────────

interface SectionBlockProps {
  label: string
  color: string
  colSpan: number
  weeks: string[]
  das: LookaheadDerivedActivity[]
  rows: Array<{ masterActivityId: string; name: string; responsible: string; cellMap: Map<string, LookaheadDerivedActivity> }>
  onSelect: (da: LookaheadDerivedActivity) => void
}

function SectionBlock({ label, color, colSpan, weeks, das, rows, onSelect }: SectionBlockProps) {
  return (
    <>
      <SectionHeaderRow label={label} color={color} colSpan={colSpan} />
      {rows.map((row) => (
        <tr key={row.masterActivityId} className="hover:bg-[#3d3d3d]/40 transition-colors">
          <td className="px-3 py-1.5 border border-[#525252]/30 sticky left-0 bg-[#0d1117] z-10">
            <p className="text-[#f5f5f5] font-medium text-[11px] truncate max-w-[170px]">{row.name}</p>
            <p className="text-[#6b6b6b] text-[9px]">{row.responsible}</p>
          </td>
          {weeks.map((w) => (
            <Cell
              key={w}
              da={row.cellMap.get(w)}
              actName={row.name}
              onClick={() => { const d = row.cellMap.get(w); if (d) onSelect(d) }}
            />
          ))}
        </tr>
      ))}
      <PpcRow weeks={weeks} das={das} />
    </>
  )
}
