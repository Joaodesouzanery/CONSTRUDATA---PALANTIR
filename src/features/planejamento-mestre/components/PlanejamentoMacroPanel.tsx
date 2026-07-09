/**
 * PlanejamentoMacroPanel — WBS Gantt with Previsto vs Tendência bars,
 * baseline management, activity CRUD, and export (PDF / Excel / PNG).
 */
import { useRef, useState, useMemo, useEffect } from 'react'
import { Plus, Save, Download, X, Check, FileDown, Image, FileSpreadsheet, Search, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { byActiveObra } from '@/hooks/useActiveObra'
import { getProjectDateRange, daysBetween } from '../utils/masterEngine'
import { NETWORK_TYPE_OPTIONS } from '../networkCategories'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tabela360Panel } from './Tabela360Panel'
import type { MasterActivity, MasterActivityStatus } from '@/types'

// ─── Colors ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<MasterActivityStatus, string> = {
  not_started: '#6b6b6b',
  in_progress: '#f97316',
  completed:   '#22c55e',
  delayed:     '#ef4444',
}

const STATUS_LABEL: Record<MasterActivityStatus, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  completed:   'Concluída',
  delayed:     'Atrasada',
}

const NETWORK_COLOR: Record<string, string> = {
  agua:       '#f97316',
  esgoto:     '#22c55e',
  civil:      '#f59e0b',
  manutencao: '#38bdf8',
  ambiental:  '#10b981',
  outro:      '#a3a3a3',
  geral:      '#a78bfa',
}

function networkColor(nt: string | undefined): string {
  return nt ? (NETWORK_COLOR[nt] ?? '#6b7280') : '#6b7280'
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function fmtMoney(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function PlanningKpi({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-[140px] rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[#8a8a8a]">{label}</p>
      <p className={accent ? 'text-sm font-semibold text-[#f97316]' : 'text-sm font-semibold text-[#f5f5f5]'}>
        {value}
      </p>
    </div>
  )
}

// ─── Gantt SVG ───────────────────────────────────────────────────────────────

function PercentCell({ value, onChange, color = '#f5f5f5' }: { value: number; onChange: (value: number) => void; color?: string }) {
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step="0.01"
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Math.min(100, Math.max(0, Number(event.target.value) || 0)))}
        className="w-16 rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-right font-mono text-xs outline-none focus:border-[#f97316]/60"
        style={{ color }}
      />
      <span className="text-[#6b6b6b]">%</span>
    </div>
  )
}

interface GanttChartProps {
  activities: MasterActivity[]
  collapsed: Set<string>
  onToggle: (id: string) => void
  svgRef: React.RefObject<SVGSVGElement | null>
  updateActivity: (id: string, patch: Partial<MasterActivity>) => void
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

interface DragState { id: string; mode: 'move' | 'resize'; x0: number; start0: string; end0: string; deltaDays: number }

function GanttChart({ activities, collapsed, onToggle, svgRef, updateActivity }: GanttChartProps) {
  const [drag, setDrag] = useState<DragState | null>(null)

  // Determine which activities to show (hide children of collapsed parents)
  function isVisible(act: MasterActivity): boolean {
    if (!act.parentId) return true
    if (collapsed.has(act.parentId)) return false
    const parent = activities.find((a) => a.id === act.parentId)
    return parent ? isVisible(parent) : true
  }

  const visible = activities.filter((a) => a.level >= 0 && isVisible(a))
  if (visible.length === 0) return (
    <p className="text-[#6b6b6b] text-xs text-center py-8">Nenhuma atividade cadastrada</p>
  )

  const { start: projStart, end: projEnd } = getProjectDateRange(activities)
  const totalDays = Math.max(1, daysBetween(projStart, projEnd))

  const LABEL_W = 360
  const W       = 1120
  const ROW_H   = 42
  const PAD_TOP = 48
  const svgH    = PAD_TOP + visible.length * ROW_H + 20

  function xOf(date: string) { return Math.round((daysBetween(projStart, date) / totalDays) * W) }
  function wOf(s: string, e: string) { return Math.max(3, Math.round((daysBetween(s, e) / totalDays) * W)) }
  const pxPerDay = W / totalDays

  // Arrastar a barra "Previsto" move (corpo) ou redimensiona (borda direita) as datas.
  function commitDrag() {
    setDrag((d) => {
      if (d && d.deltaDays !== 0) {
        if (d.mode === 'move') {
          updateActivity(d.id, { plannedStart: addDaysIso(d.start0, d.deltaDays), plannedEnd: addDaysIso(d.end0, d.deltaDays) })
        } else {
          let newEnd = addDaysIso(d.end0, d.deltaDays)
          if (newEnd < d.start0) newEnd = d.start0
          updateActivity(d.id, { plannedEnd: newEnd, durationDays: Math.max(1, daysBetween(d.start0, newEnd) + 1) })
        }
      }
      return null
    })
  }
  useEffect(() => {
    if (!drag) return
    const onMove = (e: MouseEvent) => {
      const deltaDays = Math.round((e.clientX - drag.x0) / pxPerDay)
      setDrag((d) => (d && d.deltaDays !== deltaDays ? { ...d, deltaDays } : d))
    }
    const onUp = () => commitDrag()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag?.id, drag?.mode, drag?.x0, pxPerDay])

  // Month markers
  const months: { date: string; label: string }[] = []
  const dIter = new Date(projStart + 'T00:00:00')
  dIter.setDate(1)
  if (dIter.toISOString().slice(0, 10) < projStart) dIter.setMonth(dIter.getMonth() + 1)
  while (dIter.toISOString().slice(0, 10) <= projEnd) {
    const iso = dIter.toISOString().slice(0, 10)
    months.push({ date: iso, label: dIter.toLocaleDateString('pt-BR', { month: 'short' }) })
    dIter.setMonth(dIter.getMonth() + 1)
  }

  const today = new Date().toISOString().slice(0, 10)

  // Determine which activities have children
  const parentIds = new Set(activities.map((a) => a.parentId).filter(Boolean) as string[])

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} width={LABEL_W + W + 20} height={svgH} className="font-mono text-[12px]" style={{ background: '#111827' }}>
        <rect x={0} y={0} width={LABEL_W + W + 20} height={svgH} fill="#111827" />
        <rect x={0} y={0} width={LABEL_W} height={svgH} fill="#1f1f1f" />
        <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={svgH} stroke="#525252" strokeWidth={1} />
        {/* Month headers */}
        {months.map((m) => {
          const x = LABEL_W + xOf(m.date)
          return (
            <g key={m.date}>
              <line x1={x} y1={0} x2={x} y2={svgH - 16} stroke="#2f4663" strokeWidth={0.7} />
              <text x={x + 6} y={18} fontSize={11} fill="#60a5fa" fontWeight={700}>{m.label}</text>
            </g>
          )
        })}

        {/* Today line */}
        {today >= projStart && today <= projEnd && (() => {
          const tx = LABEL_W + xOf(today)
          return (
            <>
              <line x1={tx} y1={0} x2={tx} y2={svgH - 16} stroke="#f97316" strokeWidth={1.2} strokeDasharray="3,2" opacity={0.8} />
              <text x={tx + 4} y={32} fontSize={10} fill="#f97316" fontWeight={700}>hoje</text>
            </>
          )
        })()}

        {/* Activity rows */}
        {visible.map((act, i) => {
          const y       = PAD_TOP + i * ROW_H
          const indent  = act.level * 14
          const color   = STATUS_COLOR[act.status]
          const nColor  = networkColor(act.networkType)
          const hasKids = parentIds.has(act.id)
          const isCollapsed = collapsed.has(act.id)
          const isL0  = act.level === 0
          const isL1  = act.level === 1

          const bPx   = xOf(act.plannedStart)
          const bW    = wOf(act.plannedStart, act.plannedEnd)
          const tPx   = xOf(act.trendStart)
          const tW    = wOf(act.trendStart, act.trendEnd)

          const maxLabelChars = Math.floor((LABEL_W - indent - 38) / 6.3)
          const labelName = act.name.length > maxLabelChars
            ? act.name.slice(0, maxLabelChars - 1) + '…'
            : act.name
          const label = `${act.wbsCode} ${labelName}`

          const tooltip = `${act.wbsCode} ${act.name}\nInício: ${act.plannedStart} → ${act.trendStart}\nFim: ${act.plannedEnd} → ${act.trendEnd}\nAndamento: ${act.percentComplete}%\nStatus: ${STATUS_LABEL[act.status]}`

          return (
            <g key={act.id}>
              <title>{tooltip}</title>

              {/* Row background */}
              {isL0 && <rect x={0} y={y - 1} width={LABEL_W + W} height={ROW_H} fill="#2c2c2c" />}
              {!isL0 && i % 2 === 0 && <rect x={0} y={y - 1} width={LABEL_W + W} height={ROW_H} fill="#182235" opacity={0.36} />}
              <line x1={0} y1={y + ROW_H - 1} x2={LABEL_W + W} y2={y + ROW_H - 1} stroke="#2f2f2f" strokeWidth={0.6} />

              {/* Network type accent line (left) */}
              {act.networkType && (
                <rect x={0} y={y} width={3} height={ROW_H - 2} fill={nColor} opacity={0.7} rx={1} />
              )}

              {/* Toggle triangle for parents */}
              {hasKids && (
                <text
                  x={indent + 5}
                  y={y + ROW_H / 2 + 4}
                  fontSize={12}
                  fill="#60a5fa"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => onToggle(act.id)}
                >
                  {isCollapsed ? '▶' : '▼'}
                </text>
              )}

              {/* WBS label */}
              <text
                x={indent + (hasKids ? 18 : 8)}
                y={y + ROW_H / 2 + 4}
                fontSize={isL0 ? 13 : isL1 ? 12 : 11}
                fontWeight={isL0 || isL1 ? 'bold' : 'normal'}
                fill={isL0 ? '#f5f5f5' : isL1 ? '#d4d4d4' : '#b8b8b8'}
                style={{ cursor: hasKids ? 'pointer' : 'default' }}
                onClick={hasKids ? () => onToggle(act.id) : undefined}
              >
                {label}
              </text>

              {/* % complete */}
              <text x={LABEL_W - 24} y={y + ROW_H / 2 + 4} textAnchor="end" fontSize={10} fontWeight={700} fill={color}>
                {act.isMilestone ? '◆' : `${act.percentComplete}%`}
              </text>

              {act.isMilestone ? (
                <>
                  <polygon
                    points={`${LABEL_W + bPx},${y + 4} ${LABEL_W + bPx + 6},${y + 10} ${LABEL_W + bPx},${y + 16} ${LABEL_W + bPx - 6},${y + 10}`}
                    fill="#6b728030" stroke="#6b7280" strokeWidth={0.8}
                  />
                  <polygon
                    points={`${LABEL_W + tPx},${y + 8} ${LABEL_W + tPx + 4},${y + 12} ${LABEL_W + tPx},${y + 16} ${LABEL_W + tPx - 4},${y + 12}`}
                    fill={color} opacity={0.9}
                  />
                </>
              ) : (
                <>
                  {/* Previsto bar (arrastável nas folhas: corpo = mover, borda direita = redimensionar) */}
                  {(() => {
                    const editable = !hasKids
                    const isDragging = drag?.id === act.id
                    const dMove = isDragging && drag?.mode === 'move' ? drag.deltaDays * pxPerDay : 0
                    const dResize = isDragging && drag?.mode === 'resize' ? drag.deltaDays * pxPerDay : 0
                    const x = LABEL_W + bPx + dMove
                    const w = Math.max(3, bW + dResize)
                    return (
                      <>
                        <rect
                          x={x} y={y + 7} width={w} height={10} rx={3}
                          fill={isDragging ? '#f97316' : '#64748b'} opacity={isDragging ? 0.7 : 0.45}
                          style={{ cursor: editable ? 'grab' : 'default' }}
                          onMouseDown={editable ? (e) => { e.preventDefault(); setDrag({ id: act.id, mode: 'move', x0: e.clientX, start0: act.plannedStart, end0: act.plannedEnd, deltaDays: 0 }) } : undefined}
                        />
                        {editable && (
                          <rect
                            x={x + w - 5} y={y + 5} width={8} height={14} rx={2}
                            fill="#f97316" opacity={isDragging && drag?.mode === 'resize' ? 0.9 : 0.35}
                            style={{ cursor: 'ew-resize' }}
                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setDrag({ id: act.id, mode: 'resize', x0: e.clientX, start0: act.plannedStart, end0: act.plannedEnd, deltaDays: 0 }) }}
                          />
                        )}
                      </>
                    )
                  })()}
                  {/* Tendência bar (network-colored) */}
                  <rect x={LABEL_W + tPx} y={y + 22} width={tW} height={isL0 ? 10 : 9} rx={3} fill={nColor} opacity={0.78} />
                  {/* Progress fill */}
                  {act.percentComplete > 0 && (
                    <rect
                      x={LABEL_W + tPx}
                      y={y + 22}
                      width={Math.round(tW * act.percentComplete / 100)}
                      height={isL0 ? 10 : 9}
                      rx={3}
                      fill={nColor}
                    />
                  )}
                  {act.financialProgressPct != null && (
                    <rect
                      x={LABEL_W + tPx}
                      y={y + 35}
                      width={Math.round(tW * Math.min(100, Math.max(0, act.financialProgressPct)) / 100)}
                      height={4}
                      rx={1}
                      fill="#f97316"
                      opacity={0.95}
                    />
                  )}
                </>
              )}
            </g>
          )
        })}

        {/* Legend */}
        <g transform={`translate(${LABEL_W + 4}, ${svgH - 16})`}>
          <rect x={0} y={0} width={10} height={6} rx={1} fill="#64748b" opacity={0.5} />
          <text x={14} y={6} fontSize={10} fill="#a3a3a3">Previsto</text>
          <rect x={70} y={0} width={10} height={6} rx={1} fill="#f97316" opacity={0.8} />
          <text x={84} y={6} fontSize={10} fill="#a3a3a3">Tendencia</text>
          {/* Network legend */}
          {Object.entries(NETWORK_COLOR).map(([nt, c], i) => (
            <g key={nt} transform={`translate(${165 + i * 68}, 0)`}>
              <rect x={0} y={0} width={10} height={6} rx={1} fill={c} opacity={0.8} />
              <text x={14} y={6} fontSize={10} fill="#a3a3a3">{nt.charAt(0).toUpperCase() + nt.slice(1)}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

// ─── New Activity Form ───────────────────────────────────────────────────────

function NewActivityForm({ onClose }: { onClose: () => void }) {
  const addActivity = usePlanejamentoMestreStore((s) => s.addActivity)
  const activities  = usePlanejamentoMestreStore((s) => s.activities)

  const [form, setForm] = useState(() => {
    const start = new Date()
    const end = new Date(start)
    end.setDate(start.getDate() + 14)
    return {
    wbsCode: '', name: '',
    parentId: '' as string,
    plannedStart: start.toISOString().slice(0, 10),
    plannedEnd: end.toISOString().slice(0, 10),
    responsibleTeam: '', isMilestone: false, weight: 5,
    networkType: 'geral' as string,
    local: '',
    unidade: '',
    plannedQuantity: '',
    plannedProgressPct: 0,
    operationalKey: '',
    }
  })

  const parentActivity = activities.find((a) => a.id === form.parentId) ?? null
  const derivedLevel   = parentActivity ? parentActivity.level + 1 : 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.wbsCode.trim() || !form.name.trim()) return
    const dur = daysBetween(form.plannedStart, form.plannedEnd)
    addActivity({
      wbsCode: form.wbsCode, name: form.name,
      parentId: form.parentId || null, level: derivedLevel,
      plannedStart: form.plannedStart, plannedEnd: form.plannedEnd,
      trendStart: form.plannedStart, trendEnd: form.plannedEnd,
      durationDays: Math.max(0, dur), percentComplete: 0, status: 'not_started',
      isMilestone: form.isMilestone, responsibleTeam: form.responsibleTeam || undefined,
      weight: form.weight,
      networkType: (form.networkType || undefined) as MasterActivity['networkType'],
      plannedProgressPct: Math.min(100, Math.max(0, Number(form.plannedProgressPct) || 0)),
      local: form.local || undefined,
      unidade: form.unidade || undefined,
      plannedQuantity: Number(form.plannedQuantity) || undefined,
      executedQuantity: 0,
      operationalKey: form.operationalKey || `${form.wbsCode}|${form.name}`.toLowerCase(),
    })
    onClose()
  }

  const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60'

  return (
    <form onSubmit={handleSubmit} className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[#f5f5f5] text-sm font-semibold">Nova Atividade</p>
        <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Atividade Pai</label>
          <select className={inputCls} value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}>
            <option value="">— Raiz (sem parent) — Nível 0</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>{'  '.repeat(a.level)}{a.wbsCode} — {a.name}  (N{a.level})</option>
            ))}
          </select>
          {parentActivity && <p className="text-[10px] text-[#f97316] mt-0.5">Nível calculado: {derivedLevel}</p>}
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Código WBS *</label>
          <input className={inputCls} value={form.wbsCode} onChange={(e) => setForm((f) => ({ ...f, wbsCode: e.target.value }))} placeholder="1.1.6" required />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Tipo de Rede</label>
          <select className={inputCls} value={form.networkType} onChange={(e) => setForm((f) => ({ ...f, networkType: e.target.value }))}>
            {NETWORK_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Nome *</label>
          <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Frente / local</label>
          <input className={inputCls} value={form.local} onChange={(e) => setForm((f) => ({ ...f, local: e.target.value }))} placeholder="Ex: garagem, subsolo 1" />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Chave para RDO</label>
          <input className={inputCls} value={form.operationalKey} onChange={(e) => setForm((f) => ({ ...f, operationalKey: e.target.value }))} placeholder="Opcional; usada para vincular apontamentos" />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Início</label>
          <input type="date" className={inputCls} value={form.plannedStart} onChange={(e) => setForm((f) => ({ ...f, plannedStart: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Fim</label>
          <input type="date" className={inputCls} value={form.plannedEnd} onChange={(e) => setForm((f) => ({ ...f, plannedEnd: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Equipe</label>
          <input className={inputCls} value={form.responsibleTeam} onChange={(e) => setForm((f) => ({ ...f, responsibleTeam: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Unidade</label>
          <input className={inputCls} value={form.unidade} onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))} placeholder="m2, ml, un..." />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Quantidade planejada</label>
          <input type="number" min={0} step="0.01" className={inputCls} value={form.plannedQuantity} onChange={(e) => setForm((f) => ({ ...f, plannedQuantity: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Peso</label>
          <input type="number" min={0} max={100} className={inputCls} value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">% previsto do serviço</label>
          <input type="number" min={0} max={100} step="0.01" className={inputCls} value={form.plannedProgressPct} onChange={(e) => setForm((f) => ({ ...f, plannedProgressPct: Number(e.target.value) }))} placeholder="Ex: Lixamento 15" />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={form.isMilestone} onChange={(e) => setForm((f) => ({ ...f, isMilestone: e.target.checked }))} className="accent-[#f97316]" />
          <span className="text-[#6b6b6b] text-xs">Marco (Milestone)</span>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#a3a3a3]">Cancelar</button>
        <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c]">
          <Check size={12} className="inline mr-1" />Criar
        </button>
      </div>
    </form>
  )
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportExcel(activities: MasterActivity[]) {
  const rows = activities.map((a) => ({
    'WBS':         a.wbsCode,
    'Atividade':   a.name,
    'Nível':       a.level,
    'Tipo Rede':   a.networkType ?? '',
    'Início Plan': a.plannedStart,
    'Fim Plan':    a.plannedEnd,
    'Início Tend': a.trendStart,
    'Fim Tend':    a.trendEnd,
    '% Previsto':  a.plannedProgressPct ?? '',
    '% Conc.':     a.percentComplete,
    'Status':      a.status,
    'Equipe':      a.responsibleTeam ?? '',
    'Peso':        a.weight ?? '',
    'Marco':       a.isMilestone ? 'Sim' : 'Não',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'WBS')
  XLSX.writeFile(wb, 'planejamento-mestre-longo-prazo.xlsx')
}

function exportPng(svgEl: SVGSVGElement | null) {
  if (!svgEl) return
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgEl)
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url  = URL.createObjectURL(blob)
  const img  = new window.Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width  = svgEl.width.baseVal.value * 2
    canvas.height = svgEl.height.baseVal.value * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    const link = document.createElement('a')
    link.download = 'gantt-longo-prazo.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
  img.src = url
}

function exportPdf() {
  window.print()
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

interface PlanejamentoMacroPanelProps {
  /** Callback opcional para abrir o wizard "Criar Planejamento do Zero" */
  onCreateProject?: () => void
}

export function PlanejamentoMacroPanel({ onCreateProject }: PlanejamentoMacroPanelProps = {}) {
  const activities    = usePlanejamentoMestreStore((s) => s.activities)
  const baselines     = usePlanejamentoMestreStore((s) => s.baselines)
  const activeBlId    = usePlanejamentoMestreStore((s) => s.activeBaselineId)
  const contract      = usePlanejamentoMestreStore((s) => s.contract)
  const nuclei        = usePlanejamentoMestreStore((s) => s.nuclei)
  const saveBaseline  = usePlanejamentoMestreStore((s) => s.saveBaseline)
  const loadBaseline  = usePlanejamentoMestreStore((s) => s.loadBaseline)
  const updateActivity = usePlanejamentoMestreStore((s) => s.updateActivity)
  const removeActivity = usePlanejamentoMestreStore((s) => s.removeActivity)
  const backfillObraId = usePlanejamentoMestreStore((s) => s.backfillObraId)

  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const sites = useTorreStore((s) => s.sites)

  const [deleteTarget, setDeleteTarget] = useState<MasterActivity | null>(null)
  const [showNewForm, setShowNewForm]   = useState(false)
  const [blName, setBlName]             = useState('')
  const [showBlSave, setShowBlSave]     = useState(false)
  const [collapsed, setCollapsed]       = useState<Set<string>>(new Set())
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState<MasterActivityStatus | ''>('')
  const [filterNetwork, setFilterNetwork] = useState<string>('')
  const [filterService, setFilterService] = useState<string>('')
  const [filterNucleo, setFilterNucleo] = useState<string>('')
  const [showFilters, setShowFilters]   = useState(false)
  const [view, setView] = useState<'gantt' | 'tabela360'>('gantt')
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Núcleos presentes nas atividades (para o filtro), casando nucleusId → nome do cadastro.
  const nucleoOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of activities) {
      const key = a.nucleusId || a.nucleo
      if (!key) continue
      const nome = (a.nucleusId ? nuclei.find((n) => n.id === a.nucleusId)?.name : undefined) || a.nucleo || key
      if (!map.has(key)) map.set(key, nome)
    }
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((x, y) => x.label.localeCompare(y.label))
  }, [activities, nuclei])

  const filtered = useMemo(() =>
    byActiveObra(activities, activeObraId).filter((a) =>
      (!search || a.name.toLowerCase().includes(search.toLowerCase()) || a.wbsCode.toLowerCase().includes(search.toLowerCase())) &&
      (!filterStatus  || a.status          === filterStatus) &&
      (!filterNetwork || a.networkType     === filterNetwork) &&
      (!filterService || a.serviceCategory === filterService) &&
      (!filterNucleo  || a.nucleusId === filterNucleo || a.nucleo === filterNucleo)
    ),
    [activities, activeObraId, search, filterStatus, filterNetwork, filterService, filterNucleo],
  )

  // Atividades sem obra (legadas) — oferecemos backfill para a obra selecionada.
  const semObraCount = useMemo(() => activities.filter((a) => !a.obraId).length, [activities])
  const activeSiteName = activeObraId ? sites.find((s) => s.id === activeObraId)?.name : undefined

  const activeFilterCount = [search, filterStatus, filterNetwork, filterService, filterNucleo].filter(Boolean).length
  const averagePhysical = activities.length > 0
    ? activities.reduce((sum, a) => sum + (a.physicalProgressPct ?? a.percentComplete ?? 0), 0) / activities.length
    : 0
  const averageFinancial = activities.length > 0
    ? activities.reduce((sum, a) => sum + (a.financialProgressPct ?? a.physicalProgressPct ?? a.percentComplete ?? 0), 0) / activities.length
    : 0
  const ppcBasedIdc = Math.max(0.35, averagePhysical / 100)
  const eacByPpc = contract ? contract.bacTotal / ppcBasedIdc : 0

  function clearFilters() {
    setSearch('')
    setFilterStatus('')
    setFilterNetwork('')
    setFilterService('')
    setFilterNucleo('')
  }

  function handleBackfill() {
    if (!activeObraId) return
    const n = backfillObraId(activeObraId)
    window.alert(n > 0
      ? `${n} atividade(s) sem obra foram vinculadas a "${activeSiteName ?? 'obra selecionada'}".`
      : 'Nenhuma atividade sem obra para vincular.')
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSaveBaseline() {
    if (!blName.trim()) return
    saveBaseline(blName.trim())
    setBlName('')
    setShowBlSave(false)
  }

  const btnCls = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors'

  return (
    <div className="flex flex-col gap-4 print:gap-2">
      {contract && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#525252] bg-[#343434] p-3 print:hidden">
          <PlanningKpi label="Contrato" value={contract.contractName} accent />
          <PlanningKpi label="Contratante" value={contract.contractor} />
          <PlanningKpi label="Orçamento Total Planejado" value={fmtMoney(contract.bacTotal)} />
          <PlanningKpi label="Nucleos" value={String(nuclei.length || contract.nucleusCount)} />
          <PlanningKpi label="Takt teorico" value={`${contract.theoreticalTaktDays} dias/nucleo`} />
          <PlanningKpi label="Fisico medio" value={`${averagePhysical.toFixed(1)}%`} />
          <PlanningKpi label="Financeiro medio" value={`${averageFinancial.toFixed(1)}%`} />
          <PlanningKpi label="EAC por PPC" value={fmtMoney(eacByPpc)} accent />
        </div>
      )}
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        {/* Baseline */}
        <div className="flex items-center gap-2">
          <span className="text-[#6b6b6b] text-xs">Baseline:</span>
          <select
            value={activeBlId ?? ''}
            onChange={(e) => e.target.value && loadBaseline(e.target.value)}
            className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
          >
            <option value="">— Selecionar —</option>
            {baselines.map((bl) => (
              <option key={bl.id} value={bl.id}>{bl.name}</option>
            ))}
          </select>
        </div>

        {showBlSave ? (
          <div className="flex items-center gap-2">
            <input
              className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60 w-40"
              placeholder="Nome da baseline"
              value={blName}
              onChange={(e) => setBlName(e.target.value)}
              autoFocus
            />
            <button onClick={handleSaveBaseline} className="px-2.5 py-1.5 rounded-lg bg-[#22c55e]/20 text-[#22c55e] text-xs font-semibold hover:bg-[#22c55e]/30">
              <Save size={12} className="inline mr-1" />Salvar
            </button>
            <button onClick={() => setShowBlSave(false)} className="text-[#6b6b6b] hover:text-[#a3a3a3] text-xs">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setShowBlSave(true)} className={btnCls}>
            <Download size={12} />Salvar Baseline
          </button>
        )}

        {/* Export buttons */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={exportPdf} className={btnCls} title="Exportar PDF">
            <FileDown size={12} />PDF
          </button>
          <button onClick={() => exportExcel(filtered)} className={btnCls} title="Exportar Excel">
            <FileSpreadsheet size={12} />Excel
          </button>
          <button onClick={() => exportPng(svgRef.current)} className={btnCls} title="Exportar PNG">
            <Image size={12} />PNG
          </button>
        </div>

        {onCreateProject && (
          <button
            onClick={onCreateProject}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#f97316]/50 text-[#f97316] text-xs font-semibold hover:bg-[#f97316]/10 transition-colors"
            title="Criar planejamento do zero (substitui o atual)"
          >
            <Sparkles size={13} />Criar Planejamento
          </button>
        )}
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c]"
        >
          <Plus size={13} />Nova Atividade
        </button>
      </div>

      {/* New activity form */}
      {showNewForm && <NewActivityForm onClose={() => setShowNewForm(false)} />}

      {/* ── Filter Bar ── */}
      <div className="print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou WBS..."
              className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[#3d3d3d] border border-[#525252] text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50 transition-colors"
            />
          </div>

          {/* Toggle advanced filters */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                : 'border-[#525252] text-[#6b6b6b] hover:text-[#f5f5f5]'
            }`}
          >
            <SlidersHorizontal size={12} />
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#ef4444] hover:bg-[#ef4444]/10 border border-[#ef4444]/30 transition-colors"
            >
              <X size={11} />Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* Status filter */}
            <div className="flex items-center gap-2">
              <span className="text-[#6b6b6b] text-xs shrink-0">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as MasterActivityStatus | '')}
                className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
              >
                <option value="">Todos</option>
                <option value="not_started">Não iniciada</option>
                <option value="in_progress">Em andamento</option>
                <option value="completed">Concluída</option>
                <option value="delayed">Atrasada</option>
              </select>
            </div>

            {/* Network type filter */}
            <div className="flex items-center gap-2">
              <span className="text-[#6b6b6b] text-xs shrink-0">Rede:</span>
              <select
                value={filterNetwork}
                onChange={(e) => setFilterNetwork(e.target.value)}
                className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
              >
                <option value="">Todas</option>
                {NETWORK_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Service category filter */}
            <div className="flex items-center gap-2">
              <span className="text-[#6b6b6b] text-xs shrink-0">Serviço:</span>
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
              >
                <option value="">Todos</option>
                <option value="LA">LA — Ligação de Água</option>
                <option value="LE">LE — Ligação de Esgoto</option>
                <option value="intra">Intra</option>
                <option value="interligacao">Interligação</option>
                <option value="reposicao">Reposição</option>
                <option value="na_rede">Na Rede</option>
                <option value="OS">OS — Ordem de Serviço</option>
                <option value="pavimentacao">Pavimentação</option>
                <option value="recomposicao">Recomposição</option>
              </select>
            </div>

            {/* Núcleo filter */}
            {nucleoOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[#6b6b6b] text-xs shrink-0">Núcleo:</span>
                <select
                  value={filterNucleo}
                  onChange={(e) => setFilterNucleo(e.target.value)}
                  className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
                >
                  <option value="">Todos</option>
                  {nucleoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            <span className="text-[#6b6b6b] text-xs ml-auto">
              {filtered.length} de {activities.length} atividade{activities.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Backfill: atividades legadas sem obra → vincular à obra selecionada */}
      {semObraCount > 0 && activeObraId && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#f97316]/40 bg-[#f97316]/10 px-3 py-2 text-xs print:hidden">
          <span className="text-[#fed7aa]">
            {semObraCount} atividade(s) ainda sem obra vinculada — elas só aparecem em "Todas as obras".
          </span>
          <button onClick={handleBackfill} className="rounded-lg bg-[#f97316] px-3 py-1.5 font-semibold text-white hover:bg-[#ea580c]">
            Vincular a "{activeSiteName ?? 'obra selecionada'}"
          </button>
        </div>
      )}

      {/* View toggle: Cronograma (Gantt) × Tabela 360 (Núcleo/Obra) */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
      <div className="inline-flex self-start rounded-lg border border-[#525252] bg-[#1f1f1f] p-1">
        {([['gantt', 'Cronograma (Gantt)'], ['tabela360', 'Tabela 360']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setView(k)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${view === k ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:bg-[#3a3a3a] hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>
        <span className="rounded-full border border-[#525252] bg-[#2c2c2c] px-3 py-1 text-xs text-[#a3a3a3]">
          {activeObraId ? <>Obra: <strong className="text-[#f5f5f5]">{activeSiteName ?? 'selecionada'}</strong></> : <>Vendo <strong className="text-[#f5f5f5]">todas as obras</strong></>}
        </span>
      </div>

      {view === 'tabela360' && <Tabela360Panel activities={filtered} nuclei={nuclei} contract={contract} allObras={!activeObraId} sites={sites} />}

      {view === 'gantt' && (<>
      {/* ── Gantt Chart ── */}
      <div className="bg-[#111827] border border-[#525252] rounded-lg overflow-hidden print:border-0">
        <div className="px-4 py-3 border-b border-[#525252] flex items-center justify-between print:hidden bg-[#2c2c2c]">
          <div>
            <h3 className="text-[#f5f5f5] text-base font-semibold">Cronograma Macro - Previsto vs Tendencia</h3>
            <p className="text-[#a3a3a3] text-sm mt-0.5">
              {filtered.length} atividade{filtered.length !== 1 ? 's' : ''}
              {activeFilterCount > 0 ? ` (filtrado de ${activities.length})` : ''}
              {' '}· Clique em ▶/▼ para expandir/recolher
            </p>
          </div>
        </div>
        <div className="p-2">
          <GanttChart
            activities={filtered}
            collapsed={collapsed}
            onToggle={toggleCollapse}
            svgRef={svgRef}
            updateActivity={updateActivity}
          />
        </div>
      </div>

      {/* ── Activity list table ── */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#525252] bg-[#2c2c2c]">
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">WBS</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Atividade</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Tipo</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Início</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Fim</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Tendência</th>
                <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">% Prev.</th>
                <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">% Conc.</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Status</th>
                <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.filter((a) => a.level >= 1).map((act) => {
                const color  = STATUS_COLOR[act.status]
                const nColor = networkColor(act.networkType)
                const delta  = daysBetween(act.plannedEnd, act.trendEnd)
                return (
                  <tr key={act.id} className="border-b border-[#525252]/50 hover:bg-[#484848]">
                    <td
                      className="px-3 py-2 font-mono text-[#6b6b6b]"
                      style={{ paddingLeft: `${10 + act.level * 14}px` }}
                    >
                      {act.isMilestone ? '◆ ' : ''}{act.wbsCode}
                    </td>
                    <td className="px-3 py-2 text-[#f5f5f5]">{act.name}</td>
                    <td className="px-3 py-2">
                      <select
                        value={act.networkType ?? 'geral'}
                        onChange={(event) => updateActivity(act.id, { networkType: event.target.value as MasterActivity['networkType'] })}
                        className="rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-[10px] font-semibold uppercase outline-none"
                        style={{ color: nColor }}
                      >
                        {NETWORK_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {false && act.networkType ? (
                        <span
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
                          style={{ backgroundColor: nColor + '20', color: nColor }}
                        >
                          {act.networkType}
                        </span>
                      ) : <span className="text-[#525252]">—</span>}
                    </td>
                    <td className="px-3 py-2 text-[#a3a3a3] font-mono">{fmtDate(act.plannedStart)}</td>
                    <td className="px-3 py-2 text-[#a3a3a3] font-mono">{fmtDate(act.plannedEnd)}</td>
                    <td className="px-3 py-2 font-mono">
                      <span className={delta > 0 ? 'text-[#ef4444]' : delta < 0 ? 'text-[#22c55e]' : 'text-[#6b6b6b]'}>
                        {fmtDate(act.trendEnd)}{delta > 0 ? ` (+${delta}d)` : delta < 0 ? ` (${delta}d)` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <PercentCell value={act.plannedProgressPct ?? 0} onChange={(value) => updateActivity(act.id, { plannedProgressPct: value })} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <PercentCell
                        value={act.percentComplete}
                        color={color}
                        onChange={(value) => updateActivity(act.id, {
                          percentComplete: value,
                          physicalProgressPct: value,
                          status: value >= 100 ? 'completed' : value > 0 ? 'in_progress' : 'not_started',
                        })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: color + '18', color }}>
                        {STATUS_LABEL[act.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(act)}
                        title="Excluir atividade"
                        className="inline-flex items-center justify-center rounded p-1.5 text-[#6b6b6b] transition-colors hover:bg-[#ef4444]/15 hover:text-[#ef4444]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>)}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir atividade"
        message={deleteTarget ? `Tem certeza que deseja excluir "${deleteTarget.name}"? Ela será removida também do Médio Prazo, Curto Prazo e Programação Semanal. Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Excluir"
        onConfirm={() => {
          if (deleteTarget) removeActivity(deleteTarget.id)
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #root { display: block !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
