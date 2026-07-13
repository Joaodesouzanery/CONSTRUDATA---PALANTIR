/**
 * ProgramacaoSemanalPanel — Weekly programming table for Planejamento Mestre.
 * Shows per-activity daily Previsto/Realizado for the selected ISO week.
 * Columns: Item, Núcleo, Local, Atividade, Comprimento, Qtd.Lig., % Peso, Coordenador,
 *          Ação/Restrição, Unidade | Day columns (Mon-Sun) Prev/Real | Summary columns.
 */
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Download, TableProperties, Plus, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { byActiveObra } from '@/hooks/useActiveObra'
import { useRdoStore } from '@/store/rdoStore'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { MasterActivity, ProgramacaoDiaria } from '@/types'

// ─── ISO week helpers ────────────────────────────────────────────────────────

function getISOWeekDates(isoWeek: string): Date[] {
  const [yearStr, weekStr] = isoWeek.split('-W')
  const year = parseInt(yearStr)
  const week = parseInt(weekStr)

  // Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7 // 1=Mon … 7=Sun
  const mon = new Date(jan4)
  mon.setDate(jan4.getDate() - (jan4Day - 1) + (week - 1) * 7)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon)
    d.setDate(mon.getDate() + i)
    return d
  })
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

function currentISOWeek(): string {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function prevWeek(w: string): string {
  const dates = getISOWeekDates(w)
  const prev = new Date(dates[0])
  prev.setDate(prev.getDate() - 1)
  const d = new Date(Date.UTC(prev.getFullYear(), prev.getMonth(), prev.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function nextWeek(w: string): string {
  const dates = getISOWeekDates(w)
  const next = new Date(dates[6])
  next.setDate(next.getDate() + 1)
  const d = new Date(Date.UTC(next.getFullYear(), next.getMonth(), next.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// ─── Inline editable cell ─────────────────────────────────────────────────────

function EditableNumber({
  value, onChange,
}: { value: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(Math.max(0, parseFloat(draft) || 0)); setEditing(false) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onChange(Math.max(0, parseFloat(draft) || 0)); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className="w-12 bg-[#2c2c2c] border border-[#f97316]/50 rounded px-1 py-0.5 text-[10px] text-[#f5f5f5] text-center focus:outline-none"
        style={{ WebkitAppearance: 'none' }}
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(String(value || '')); setEditing(true) }}
      className={`w-12 text-[10px] font-mono text-center rounded px-1 py-0.5 transition-colors hover:bg-[#525252] ${
        value > 0 ? 'text-[#f5f5f5]' : 'text-[#525252]'
      }`}
    >
      {value > 0 ? value : '—'}
    </button>
  )
}

// ─── Inline editable text cell ───────────────────────────────────────────────

function EditableText({
  value, onChange, placeholder = '—', className = '',
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onChange(draft.trim()); setEditing(false) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { onChange(draft.trim()); setEditing(false) }
          if (e.key === 'Escape') setEditing(false)
        }}
        className={`w-full min-w-[70px] bg-[#2c2c2c] border border-[#f97316]/50 rounded px-1.5 py-0.5 text-[10px] text-[#f5f5f5] focus:outline-none ${className}`}
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      className={`block w-full text-left text-[10px] rounded px-1.5 py-0.5 transition-colors hover:bg-[#525252] ${value ? 'text-[#f5f5f5]' : 'text-[#525252]'} ${className}`}
      title="Clique para editar"
    >
      {value || placeholder}
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProgramacaoSemanalPanel() {
  const activities          = usePlanejamentoMestreStore((s) => s.activities)
  const derivedActivities   = usePlanejamentoMestreStore((s) => s.derivedActivities)
  const programacaoSemanal  = usePlanejamentoMestreStore((s) => s.programacaoSemanal)
  const setProgramacaoDiaria = usePlanejamentoMestreStore((s) => s.setProgramacaoDiaria)
  const updateActivity      = usePlanejamentoMestreStore((s) => s.updateActivity)
  const addActivity         = usePlanejamentoMestreStore((s) => s.addActivity)
  const removeActivity      = usePlanejamentoMestreStore((s) => s.removeActivity)
  const activeObraId        = useActiveObraStore((s) => s.activeObraId)

  const [week, setWeek]         = useState(currentISOWeek)
  const [filterNucleo, setFilterNucleo] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MasterActivity | null>(null)

  function nucleoArea(a: MasterActivity): string {
    return [a.nucleo, a.area].filter(Boolean).join(' / ')
  }

  function handleAddRow() {
    const today = new Date().toISOString().slice(0, 10)
    const leafCount = activities.filter((a) => a.level >= 1).length + 1
    addActivity({
      wbsCode: `S.${leafCount}`,
      name: 'Nova atividade',
      parentId: null,
      level: 1,
      plannedStart: today,
      plannedEnd: today,
      trendStart: today,
      trendEnd: today,
      durationDays: 1,
      percentComplete: 0,
      status: 'not_started',
      isMilestone: false,
      networkType: 'geral',
      unidade: 'm',
      plannedProgressPct: 0,
    })
  }

  const weekDates = useMemo(() => getISOWeekDates(week), [week])
  const weekNumber = week.split('-W')[1]

  // Prog. Semanal ← Médio Prazo: distribui a quantidade das atividades derivadas nesta
  // semana entre os dias úteis (Seg–Sex), preenchendo Previsto onde ainda está zerado.
  function gerarDaDerivacao() {
    const dias = weekDates.slice(0, 5)
    const daSemana = derivedActivities.filter((d) => d.weekIso === week)
    if (daSemana.length === 0) {
      alert('Nenhuma atividade do Médio Prazo cai nesta semana. Gere/atualize o Médio Prazo primeiro (aba "Médio Prazo" → Atualizar) e navegue até a semana certa.')
      return
    }
    for (const d of daSemana) {
      const act = activities.find((a) => a.id === d.masterActivityId)
      if (!act) continue
      const qtd = act.plannedQuantity ?? act.comprimento ?? 0
      const porDia = qtd > 0 ? qtd / dias.length : 0
      for (const dia of dias) {
        const dateStr = toDateStr(dia)
        const cur = programacaoSemanal[act.id]?.[dateStr]
        if (!cur || cur.previsto === 0) setProgramacaoDiaria(act.id, dateStr, { previsto: porDia, realizado: cur?.realizado ?? 0 })
      }
    }
    alert(`Programação da semana ${week} gerada a partir do Médio Prazo: ${daSemana.length} atividade(s).`)
  }

  // Realizado ← RDO Compizzo: puxa a produção do dia (m²) dos RDOs desta semana que
  // têm uma atividade do Planejamento vinculada (planningActivityId) e preenche o
  // Realizado da célula (atividade × data). Mesma fórmula de m² do rdoStore.
  // Sobrescreve só as células que têm RDO (fonte medida) — o resto do manual fica.
  function puxarRealizadoDoRdo() {
    const dateStrs = new Set(weekDates.map(toDateStr))
    const rdos = useRdoStore.getState().rdos
    const agg = new Map<string, Map<string, number>>() // activityId -> data -> m²
    let rdoCount = 0
    for (const rdo of rdos) {
      const cz = rdo.compizzo
      if (!cz?.planningActivityId) continue
      if (!dateStrs.has(rdo.date)) continue
      if (activeObraId && (rdo.siteId ?? null) !== activeObraId) continue
      const m2 = (cz.producao ?? []).reduce((s, r) => (/m²|m2/i.test(r.servico) ? s + parseLocaleNumber(r.quantidade) : s), 0)
      if (m2 <= 0) continue
      let byDate = agg.get(cz.planningActivityId)
      if (!byDate) { byDate = new Map(); agg.set(cz.planningActivityId, byDate) }
      byDate.set(rdo.date, (byDate.get(rdo.date) ?? 0) + m2)
      rdoCount++
    }
    if (rdoCount === 0) {
      alert('Nenhum RDO Compizzo com atividade vinculada e produção (m²) nesta semana. No RDO Compizzo, selecione a "Atividade do Planejamento" e informe a produção do dia.')
      return
    }
    let cells = 0
    for (const [activityId, byDate] of agg) {
      for (const [date, m2] of byDate) {
        const cur = getDay(activityId, date)
        setProgramacaoDiaria(activityId, date, { previsto: cur.previsto, realizado: Math.round(m2 * 100) / 100 })
        cells++
      }
    }
    alert(`Realizado puxado de ${rdoCount} RDO(s) → ${cells} célula(s) da semana ${week}.`)
  }

  // Only leaf activities (level >= 1, not milestones), escopadas pela obra ativa.
  const leafActivities = useMemo(
    () => byActiveObra(activities.filter((a) => a.level >= 1 && !a.isMilestone), activeObraId),
    [activities, activeObraId],
  )

  const nucleos = useMemo(() => {
    const set = new Set(leafActivities.map((a) => a.nucleo ?? '').filter(Boolean))
    return Array.from(set).sort()
  }, [leafActivities])

  const filtered = useMemo(() => {
    if (!filterNucleo) return leafActivities
    return leafActivities.filter((a) => (a.nucleo ?? '') === filterNucleo)
  }, [leafActivities, filterNucleo])

  function getDay(activityId: string, date: string): ProgramacaoDiaria {
    return programacaoSemanal[activityId]?.[date] ?? { previsto: 0, realizado: 0 }
  }

  function setDay(activityId: string, date: string, field: 'previsto' | 'realizado', val: number) {
    const cur = getDay(activityId, date)
    setProgramacaoDiaria(activityId, date, { ...cur, [field]: val })
  }

  // Totals per activity
  function actTotals(a: MasterActivity) {
    let prevTotal = 0, realTotal = 0
    weekDates.forEach((d) => {
      const day = getDay(a.id, toDateStr(d))
      prevTotal  += day.previsto
      realTotal  += day.realizado
    })
    return { prevTotal, realTotal }
  }

  // Previous week accumulation (sum of realizado for all dates before this week)
  function acumAnterior(activityId: string): number {
    let sum = 0
    const weekStart = toDateStr(weekDates[0])
    Object.entries(programacaoSemanal[activityId] ?? {}).forEach(([date, day]) => {
      if (date < weekStart) sum += day.realizado
    })
    return sum
  }

  // Total accumulation
  function acumTotal(activityId: string): number {
    let sum = 0
    Object.values(programacaoSemanal[activityId] ?? {}).forEach((day) => {
      sum += day.realizado
    })
    return sum
  }

  // Daily totals across all filtered activities
  function dayTotal(date: string, field: 'previsto' | 'realizado'): number {
    return filtered.reduce((s, a) => s + getDay(a.id, date)[field], 0)
  }

  function handleExportExcel() {
    const header = [
      'Item', 'Núcleo/Área', 'Local', 'Atividade', 'Comprimento', 'Qtd. Ligações',
      '% Peso', 'Coordenador', 'Ação/Restrição', 'Unidade',
      ...weekDates.flatMap((d, i) => [`${DAY_NAMES[i]} ${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} Prev`, `${DAY_NAMES[i]} Real`]),
      'Prev Total Semana', 'Real Total Semana', 'Acum. Sem. Anterior', 'Acum. Sem. Atual', 'Acum. Total',
    ]

    const rows = filtered.map((a) => {
      const { prevTotal, realTotal } = actTotals(a)
      const ant = acumAnterior(a.id)
      return [
        a.wbsCode, nucleoArea(a), a.local ?? '', a.name,
        a.comprimento ?? '', a.quantidadeLigacoes ?? '',
        a.pesoMeta1000 ?? '', a.coordenador ?? a.responsibleTeam ?? '', a.notes ?? '',
        a.unidade ?? '',
        ...weekDates.flatMap((d) => {
          const day = getDay(a.id, toDateStr(d))
          return [day.previsto || '', day.realizado || '']
        }),
        prevTotal || '', realTotal || '', ant || '', (ant + realTotal) || '', acumTotal(a.id) || '',
      ]
    })

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `Semana ${weekNumber}`)
    XLSX.writeFile(wb, `programacao-semanal-${week}.xlsx`)
  }

  const thCls = 'px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#6b6b6b] whitespace-nowrap bg-[#2c2c2c] border-b border-r border-[#525252] text-center'
  const tdCls = 'px-2 py-1 text-[10px] text-[#a3a3a3] border-b border-r border-[#525252] whitespace-nowrap'
  const tdFixedCls = `${tdCls} bg-[#333333] sticky`

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]/15">
            <TableProperties size={18} className="text-[#f97316]" />
          </div>
          <div>
            <h2 className="text-[#f5f5f5] font-semibold text-base">Programação Semanal</h2>
            <p className="text-[#6b6b6b] text-xs">Previsto × Realizado por dia e atividade</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Week navigation */}
          <div className="flex items-center gap-1 bg-[#3d3d3d] border border-[#525252] rounded-lg px-1">
            <button
              onClick={() => setWeek(prevWeek(week))}
              className="p-1.5 text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[#f5f5f5] font-mono text-xs px-2">
              Semana {weekNumber} · {weekDates[0].getDate().toString().padStart(2,'0')}/{(weekDates[0].getMonth()+1).toString().padStart(2,'0')} – {weekDates[6].getDate().toString().padStart(2,'0')}/{(weekDates[6].getMonth()+1).toString().padStart(2,'0')}
            </span>
            <button
              onClick={() => setWeek(nextWeek(week))}
              className="p-1.5 text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Núcleo filter */}
          {nucleos.length > 0 && (
            <select
              value={filterNucleo}
              onChange={(e) => setFilterNucleo(e.target.value)}
              className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
            >
              <option value="">Todos os Núcleos</option>
              {nucleos.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          )}

          {/* Add activity */}
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
          >
            <Plus size={13} />
            Adicionar atividade
          </button>

          {/* Seed from Médio Prazo */}
          <button
            onClick={gerarDaDerivacao}
            title="Preencher o Previsto da semana a partir das atividades do Médio Prazo"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors"
          >
            <TableProperties size={13} />
            Gerar da derivação
          </button>

          {/* Pull Realizado from RDO Compizzo */}
          <button
            onClick={puxarRealizadoDoRdo}
            title="Preencher o Realizado da semana com a produção (m²) dos RDOs Compizzo que têm atividade vinculada"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors"
          >
            <Download size={13} />
            Puxar realizado (RDO)
          </button>

          {/* Export */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors"
          >
            <Download size={13} />
            Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#525252] overflow-hidden bg-[#333333]">
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs" style={{ minWidth: 1200 }}>
            <thead>
              {/* Row 1: group headers */}
              <tr>
                <th colSpan={10} className={`${thCls} text-left`}>Identificação da Atividade</th>
                {weekDates.map((d, i) => (
                  <th key={i} colSpan={2} className={thCls} style={{ color: '#f97316' }}>
                    {DAY_NAMES[i]}<br />
                    <span className="text-[#6b6b6b] font-normal">
                      {d.getDate().toString().padStart(2,'0')}/{(d.getMonth()+1).toString().padStart(2,'0')}
                    </span>
                  </th>
                ))}
                <th colSpan={5} className={thCls}>Acumulados</th>
                <th rowSpan={2} className={thCls}>Ações</th>
              </tr>
              {/* Row 2: column headers */}
              <tr>
                <th className={`${thCls} text-left sticky left-0 z-10 min-w-[48px]`}>Item</th>
                <th className={`${thCls} text-left min-w-[110px]`}>Núcleo/Área</th>
                <th className={`${thCls} text-left min-w-[100px]`}>Local</th>
                <th className={`${thCls} text-left min-w-[160px]`}>Atividade</th>
                <th className={thCls}>Comp. (m)</th>
                <th className={thCls}>Qtd. Lig.</th>
                <th className={thCls}>% Peso</th>
                <th className={`${thCls} min-w-[80px]`}>Coord.</th>
                <th className={`${thCls} min-w-[100px]`}>Ação/Restr.</th>
                <th className={thCls}>Unid.</th>
                {weekDates.map((_, i) => (
                  <>
                    <th key={`${i}-p`} className={`${thCls} text-[#22c55e]`}>Prev</th>
                    <th key={`${i}-r`} className={`${thCls} text-[#f97316]`}>Real</th>
                  </>
                ))}
                <th className={thCls}>Prev Sem.</th>
                <th className={thCls}>Real Sem.</th>
                <th className={thCls}>Acum. Ant.</th>
                <th className={thCls}>Acum. Sem.</th>
                <th className={thCls}>Acum. Total</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10 + 14 + 5 + 1} className="text-center py-8 text-[#6b6b6b] text-xs">
                    Nenhuma atividade. Clique em "Adicionar atividade" ou crie no módulo Longo Prazo.
                  </td>
                </tr>
              )}

              {filtered.map((a, rowIdx) => {
                const { prevTotal, realTotal } = actTotals(a)
                const ant = acumAnterior(a.id)
                const acumSem = ant + realTotal
                const acumTot = acumTotal(a.id)
                const rowBg = rowIdx % 2 === 0 ? '' : 'bg-[#222222]/30'

                return (
                  <tr key={a.id} className={`${rowBg} hover:bg-[#3d3d3d]/60 transition-colors`}>
                    <td className={`${tdFixedCls} left-0 z-10 font-mono`}>{a.wbsCode}</td>
                    <td className={tdCls}>
                      <EditableText value={a.nucleo ?? ''} placeholder="Núcleo/Área" onChange={(v) => updateActivity(a.id, { nucleo: v || undefined })} />
                    </td>
                    <td className={tdCls}>
                      <EditableText value={a.local ?? ''} placeholder="Local" onChange={(v) => updateActivity(a.id, { local: v || undefined })} />
                    </td>
                    <td className={`${tdCls} max-w-[220px]`}>
                      <EditableText value={a.name} placeholder="Atividade" onChange={(v) => updateActivity(a.id, { name: v || 'Sem nome' })} />
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <EditableNumber value={a.comprimento ?? 0} onChange={(v) => updateActivity(a.id, { comprimento: v || undefined })} />
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <EditableNumber value={a.quantidadeLigacoes ?? 0} onChange={(v) => updateActivity(a.id, { quantidadeLigacoes: v || undefined })} />
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <EditableNumber value={a.pesoMeta1000 ?? 0} onChange={(v) => updateActivity(a.id, { pesoMeta1000: v || undefined })} />
                    </td>
                    <td className={tdCls}>
                      <EditableText value={a.coordenador ?? a.responsibleTeam ?? ''} placeholder="Coord." onChange={(v) => updateActivity(a.id, { coordenador: v || undefined })} />
                    </td>
                    <td className={`${tdCls} max-w-[140px]`}>
                      <EditableText value={a.notes ?? ''} placeholder="Ação/Restr." onChange={(v) => updateActivity(a.id, { notes: v || undefined })} />
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <EditableText value={a.unidade ?? ''} placeholder="m" onChange={(v) => updateActivity(a.id, { unidade: v || undefined })} className="text-center" />
                    </td>

                    {weekDates.map((d) => {
                      const dateStr = toDateStr(d)
                      const day = getDay(a.id, dateStr)
                      return (
                        <>
                          <td key={`${a.id}-${dateStr}-p`} className={`${tdCls} p-0.5 text-center`}>
                            <EditableNumber
                              value={day.previsto}
                              onChange={(v) => setDay(a.id, dateStr, 'previsto', v)}
                            />
                          </td>
                          <td key={`${a.id}-${dateStr}-r`} className={`${tdCls} p-0.5 text-center`}>
                            <EditableNumber
                              value={day.realizado}
                              onChange={(v) => setDay(a.id, dateStr, 'realizado', v)}
                            />
                          </td>
                        </>
                      )
                    })}

                    <td className={`${tdCls} text-right font-mono text-[#22c55e]`}>{prevTotal > 0 ? prevTotal.toFixed(1) : '—'}</td>
                    <td className={`${tdCls} text-right font-mono text-[#f97316]`}>{realTotal > 0 ? realTotal.toFixed(1) : '—'}</td>
                    <td className={`${tdCls} text-right font-mono`}>{ant > 0 ? ant.toFixed(1) : '—'}</td>
                    <td className={`${tdCls} text-right font-mono text-[#f97316]`}>{acumSem > 0 ? acumSem.toFixed(1) : '—'}</td>
                    <td className={`${tdCls} text-right font-mono`}>{acumTot > 0 ? acumTot.toFixed(1) : '—'}</td>
                    <td className={`${tdCls} text-center`}>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(a)}
                        title="Excluir atividade"
                        className="inline-flex items-center justify-center rounded p-1 text-[#6b6b6b] transition-colors hover:bg-[#ef4444]/15 hover:text-[#ef4444]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Footer totals */}
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-[#3d3d3d]">
                  <td colSpan={10} className={`${tdCls} font-semibold text-[#f5f5f5]`}>
                    Total ({filtered.length} atividades)
                  </td>
                  {weekDates.map((d) => {
                    const dateStr = toDateStr(d)
                    return (
                      <>
                        <td key={`tot-${dateStr}-p`} className={`${tdCls} text-right font-mono text-[#22c55e] font-semibold`}>
                          {dayTotal(dateStr, 'previsto') > 0 ? dayTotal(dateStr, 'previsto').toFixed(1) : '—'}
                        </td>
                        <td key={`tot-${dateStr}-r`} className={`${tdCls} text-right font-mono text-[#f97316] font-semibold`}>
                          {dayTotal(dateStr, 'realizado') > 0 ? dayTotal(dateStr, 'realizado').toFixed(1) : '—'}
                        </td>
                      </>
                    )
                  })}
                  <td colSpan={6} className={tdCls} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <p className="text-[10px] text-[#6b6b6b]">
        Clique em qualquer célula (identificação ou Prev/Real) para editar — salva automaticamente e
        reflete no Longo/Médio/Curto Prazo. Use "Adicionar atividade" para criar e o ícone de lixeira para excluir.
      </p>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir atividade"
        message={deleteTarget ? `Tem certeza que deseja excluir "${deleteTarget.name}"? Ela será removida de todos os horizontes de planejamento.` : ''}
        confirmLabel="Excluir"
        onConfirm={() => { if (deleteTarget) removeActivity(deleteTarget.id); setDeleteTarget(null) }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
