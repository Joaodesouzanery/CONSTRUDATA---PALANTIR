/**
 * PlanejamentoMacroPanel — WBS Gantt with Previsto vs Tendência bars,
 * baseline management, and activity CRUD.
 */
import { useState } from 'react'
import { Plus, Save, Download, X, Check } from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { getProjectDateRange, daysBetween } from '../utils/masterEngine'
import type { MasterActivity, MasterActivityStatus } from '@/types'

const STATUS_COLOR: Record<MasterActivityStatus, string> = {
  not_started: '#6b6b6b',
  in_progress: '#2abfdc',
  completed:   '#22c55e',
  delayed:     '#ef4444',
}

const STATUS_LABEL: Record<MasterActivityStatus, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  completed:   'Concluída',
  delayed:     'Atrasada',
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// ─── Gantt SVG ───────────────────────────────────────────────────────────────

function GanttChart({ activities }: { activities: MasterActivity[] }) {
  const leafActivities = activities.filter((a) => a.level >= 1)
  if (leafActivities.length === 0) return <p className="text-[#6b6b6b] text-xs text-center py-8">Nenhuma atividade cadastrada</p>

  const { start: projStart, end: projEnd } = getProjectDateRange(activities)
  const totalDays = Math.max(1, daysBetween(projStart, projEnd))

  const LABEL_W = 220
  const W = 600
  const ROW_H = 28
  const PAD_TOP = 28
  const svgH = PAD_TOP + leafActivities.length * ROW_H + 20

  function xOf(date: string) {
    return Math.round((daysBetween(projStart, date) / totalDays) * W)
  }
  function wOf(start: string, end: string) {
    return Math.max(3, Math.round((daysBetween(start, end) / totalDays) * W))
  }

  // Month markers
  const months: { date: string; label: string }[] = []
  const d = new Date(projStart + 'T00:00:00')
  d.setDate(1)
  if (d.toISOString().slice(0, 10) < projStart) d.setMonth(d.getMonth() + 1)
  while (d.toISOString().slice(0, 10) <= projEnd) {
    const iso = d.toISOString().slice(0, 10)
    months.push({ date: iso, label: d.toLocaleDateString('pt-BR', { month: 'short' }) })
    d.setMonth(d.getMonth() + 1)
  }

  return (
    <div className="overflow-x-auto">
      <svg width={LABEL_W + W + 20} height={svgH} className="font-mono text-[10px]">
        {/* Month headers */}
        {months.map((m) => {
          const x = LABEL_W + xOf(m.date)
          return (
            <g key={m.date}>
              <line x1={x} y1={0} x2={x} y2={svgH - 14} stroke="#20406a" strokeWidth={0.5} />
              <text x={x + 3} y={12} fontSize={9} fill="#5a8caa">{m.label}</text>
            </g>
          )
        })}

        {/* Today line */}
        {(() => {
          const today = new Date().toISOString().slice(0, 10)
          if (today >= projStart && today <= projEnd) {
            const tx = LABEL_W + xOf(today)
            return (
              <>
                <line x1={tx} y1={0} x2={tx} y2={svgH - 14} stroke="#2abfdc" strokeWidth={1} strokeDasharray="3,2" opacity={0.8} />
                <text x={tx + 2} y={22} fontSize={8} fill="#2abfdc">hoje</text>
              </>
            )
          }
          return null
        })()}

        {/* Activity rows */}
        {leafActivities.map((act, i) => {
          const y = PAD_TOP + i * ROW_H
          const indent = act.level * 12
          const color = STATUS_COLOR[act.status]

          // Previsto bar (baseline — gray)
          const px = xOf(act.plannedStart)
          const pw = wOf(act.plannedStart, act.plannedEnd)

          // Tendência bar (colored)
          const tx = xOf(act.trendStart)
          const tw = wOf(act.trendStart, act.trendEnd)

          const label = act.wbsCode + ' ' + (act.name.length > 22 ? act.name.slice(0, 21) + '…' : act.name)

          return (
            <g key={act.id}>
              {/* Alternating row bg */}
              {i % 2 === 0 && <rect x={0} y={y - 2} width={LABEL_W + W} height={ROW_H} fill="#14294e08" />}

              {/* Label */}
              <text x={indent + 4} y={y + 12} fontSize={9} fill="#8fb3c8">{label}</text>

              {/* % complete */}
              <text x={LABEL_W - 28} y={y + 12} textAnchor="end" fontSize={8} fill={color}>
                {act.isMilestone ? '◆' : `${act.percentComplete}%`}
              </text>

              {act.isMilestone ? (
                // Milestone diamond
                <>
                  <polygon
                    points={`${LABEL_W + px},${y + 2} ${LABEL_W + px + 6},${y + 8} ${LABEL_W + px},${y + 14} ${LABEL_W + px - 6},${y + 8}`}
                    fill="#6b728040"
                    stroke="#6b7280"
                    strokeWidth={0.8}
                  />
                  <polygon
                    points={`${LABEL_W + tx},${y + 5} ${LABEL_W + tx + 4},${y + 9} ${LABEL_W + tx},${y + 13} ${LABEL_W + tx - 4},${y + 9}`}
                    fill={color}
                    opacity={0.9}
                  />
                </>
              ) : (
                <>
                  {/* Previsto (baseline) bar */}
                  <rect x={LABEL_W + px} y={y + 2} width={pw} height={8} rx={2} fill="#3a4a6b" opacity={0.6} />
                  {/* Tendência bar */}
                  <rect x={LABEL_W + tx} y={y + 12} width={tw} height={6} rx={2} fill={color} opacity={0.85} />
                  {/* Progress fill on trend bar */}
                  {act.percentComplete > 0 && (
                    <rect
                      x={LABEL_W + tx}
                      y={y + 12}
                      width={Math.round(tw * act.percentComplete / 100)}
                      height={6}
                      rx={2}
                      fill={color}
                    />
                  )}
                </>
              )}
            </g>
          )
        })}

        {/* Legend */}
        <g transform={`translate(${LABEL_W + W - 120}, ${svgH - 16})`}>
          <rect x={0} y={0} width={8} height={6} rx={1} fill="#3a4a6b" opacity={0.6} />
          <text x={12} y={5} fontSize={8} fill="#6b6b6b">Previsto</text>
          <rect x={55} y={0} width={8} height={6} rx={1} fill="#2abfdc" opacity={0.85} />
          <text x={67} y={5} fontSize={8} fill="#6b6b6b">Tendência</text>
        </g>
      </svg>
    </div>
  )
}

// ─── New Activity Form ───────────────────────────────────────────────────────

function NewActivityForm({ onClose }: { onClose: () => void }) {
  const addActivity = usePlanejamentoMestreStore((s) => s.addActivity)
  const activities  = usePlanejamentoMestreStore((s) => s.activities)

  const [form, setForm] = useState({
    wbsCode: '', name: '',
    parentId: '' as string,
    plannedStart: new Date().toISOString().slice(0, 10),
    plannedEnd: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    responsibleTeam: '', isMilestone: false, weight: 5,
    networkType: '' as string,
  })

  const parentActivity = activities.find((a) => a.id === form.parentId) ?? null
  const derivedLevel   = parentActivity ? parentActivity.level + 1 : 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.wbsCode.trim() || !form.name.trim()) return
    const dur = daysBetween(form.plannedStart, form.plannedEnd)
    addActivity({
      wbsCode: form.wbsCode,
      name: form.name,
      parentId: form.parentId || null,
      level: derivedLevel,
      plannedStart: form.plannedStart,
      plannedEnd: form.plannedEnd,
      trendStart: form.plannedStart,
      trendEnd: form.plannedEnd,
      durationDays: Math.max(0, dur),
      percentComplete: 0,
      status: 'not_started',
      isMilestone: form.isMilestone,
      responsibleTeam: form.responsibleTeam || undefined,
      weight: form.weight,
      networkType: (form.networkType || undefined) as MasterActivity['networkType'],
    })
    onClose()
  }

  const inputCls = 'w-full bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#2abfdc]/60'

  return (
    <form onSubmit={handleSubmit} className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[#f5f5f5] text-sm font-semibold">Nova Atividade</p>
        <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* Parent selector */}
        <div className="col-span-2">
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Atividade Pai</label>
          <select
            className={inputCls}
            value={form.parentId}
            onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
          >
            <option value="">— Raiz (sem parent) — Nível 0</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {'  '.repeat(a.level)}{a.wbsCode} — {a.name}  (Nível {a.level})
              </option>
            ))}
          </select>
          {parentActivity && (
            <p className="text-[10px] text-[#2abfdc] mt-0.5">Nível calculado: {derivedLevel}</p>
          )}
        </div>

        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Código WBS *</label>
          <input className={inputCls} value={form.wbsCode} onChange={(e) => setForm((f) => ({ ...f, wbsCode: e.target.value }))} placeholder="1.1.6" required />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Tipo de Rede</label>
          <select className={inputCls} value={form.networkType} onChange={(e) => setForm((f) => ({ ...f, networkType: e.target.value }))}>
            <option value="">— Geral —</option>
            <option value="agua">Água</option>
            <option value="esgoto">Esgoto</option>
            <option value="civil">Civil</option>
            <option value="geral">Geral</option>
          </select>
        </div>

        <div className="col-span-2">
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Nome *</label>
          <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
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
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Peso</label>
          <input type="number" min={0} max={100} className={inputCls} value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={form.isMilestone} onChange={(e) => setForm((f) => ({ ...f, isMilestone: e.target.checked }))} className="accent-[#2abfdc]" />
          <span className="text-[#6b6b6b] text-xs">Marco (Milestone)</span>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#20406a] text-[#6b6b6b] text-xs hover:text-[#a3a3a3]">Cancelar</button>
        <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8]">
          <Check size={12} className="inline mr-1" />Criar
        </button>
      </div>
    </form>
  )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function PlanejamentoMacroPanel() {
  const activities    = usePlanejamentoMestreStore((s) => s.activities)
  const baselines     = usePlanejamentoMestreStore((s) => s.baselines)
  const activeBlId    = usePlanejamentoMestreStore((s) => s.activeBaselineId)
  const saveBaseline  = usePlanejamentoMestreStore((s) => s.saveBaseline)
  const loadBaseline  = usePlanejamentoMestreStore((s) => s.loadBaseline)

  const [showNewForm, setShowNewForm] = useState(false)
  const [blName, setBlName]           = useState('')
  const [showBlSave, setShowBlSave]   = useState(false)

  function handleSaveBaseline() {
    if (!blName.trim()) return
    saveBaseline(blName.trim())
    setBlName('')
    setShowBlSave(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[#6b6b6b] text-xs">Baseline:</span>
          <select
            value={activeBlId ?? ''}
            onChange={(e) => e.target.value && loadBaseline(e.target.value)}
            className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#2abfdc]/60"
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
              className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#2abfdc]/60 w-40"
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
          <button
            onClick={() => setShowBlSave(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#20406a] text-[#6b6b6b] text-xs hover:text-[#2abfdc] hover:border-[#2abfdc]/40 transition-colors"
          >
            <Download size={12} />Salvar Baseline
          </button>
        )}

        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] ml-auto"
        >
          <Plus size={13} />Nova Atividade
        </button>
      </div>

      {/* New activity form */}
      {showNewForm && <NewActivityForm onClose={() => setShowNewForm(false)} />}

      {/* Activity summary table */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#20406a]">
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Cronograma Macro — Previsto vs Tendência</h3>
          <p className="text-[#6b6b6b] text-xs mt-0.5">{activities.length} atividades no WBS</p>
        </div>
        <div className="p-4">
          <GanttChart activities={activities} />
        </div>
      </div>

      {/* Activity list table */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#20406a]">
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">WBS</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Atividade</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Início</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Fim</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Tendência</th>
                <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">%</th>
                <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {activities.filter((a) => a.level >= 1).map((act) => {
                const color = STATUS_COLOR[act.status]
                const delta = daysBetween(act.plannedEnd, act.trendEnd)
                return (
                  <tr key={act.id} className="border-b border-[#20406a] hover:bg-[#1a3662]">
                    <td className="px-3 py-2 font-mono text-[#6b6b6b]" style={{ paddingLeft: `${12 + act.level * 16}px` }}>
                      {act.isMilestone ? '◆ ' : ''}{act.wbsCode}
                    </td>
                    <td className="px-3 py-2 text-[#f5f5f5]">{act.name}</td>
                    <td className="px-3 py-2 text-[#a3a3a3] font-mono">{fmtDate(act.plannedStart)}</td>
                    <td className="px-3 py-2 text-[#a3a3a3] font-mono">{fmtDate(act.plannedEnd)}</td>
                    <td className="px-3 py-2 font-mono">
                      <span className={delta > 0 ? 'text-[#ef4444]' : delta < 0 ? 'text-[#22c55e]' : 'text-[#6b6b6b]'}>
                        {fmtDate(act.trendEnd)} {delta > 0 ? `(+${delta}d)` : delta < 0 ? `(${delta}d)` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-mono" style={{ color }}>{act.percentComplete}%</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: color + '18', color }}>
                        {STATUS_LABEL[act.status]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
