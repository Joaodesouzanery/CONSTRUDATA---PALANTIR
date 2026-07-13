/**
 * MatrizMensalPanel — visão "Gestão à Vista" do Longo Prazo: matriz dinâmica
 * ATIVIDADE (linhas) × MÊS (colunas) com % físico planejado por mês, editável célula
 * a célula. Colunas: Atividade · % Concluído · [meses] · Total. Agrupada por OBRA →
 * NÚCLEO (quando "Todas as obras"). Adicionar/excluir linhas; distribuir automático
 * pela duração. Tudo via updateActivity/addActivity/removeActivity (payload jsonb).
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Layers, Building2, Plus, Trash2, Wand2, Activity } from 'lucide-react'
import type { MasterActivity, PlanningNucleus, PlanningContract, ConstructionSite } from '@/types'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { usePlanoExecucaoStore } from '@/store/planoExecucaoStore'
import { useRdoStore } from '@/store/rdoStore'
import { parseLocaleNumber } from '@/lib/numberFormat'

const clampPct = (n: number) => Math.max(0, Math.min(100, n))
const fisico = (a: MasterActivity) => a.physicalProgressPct ?? a.percentComplete ?? 0

const MAX_MESES = 60
/** Lista de meses 'YYYY-MM' entre a menor data de início e a maior de fim (teto: 60 meses). */
function monthsRange(acts: MasterActivity[]): string[] {
  const starts = acts.map((a) => a.plannedStart).filter(Boolean).sort()
  const ends = acts.map((a) => a.plannedEnd).filter(Boolean).sort()
  if (!starts.length || !ends.length) return []
  const start = starts[0].slice(0, 7)
  const end = ends[ends.length - 1].slice(0, 7)
  const out: string[] = []
  let [y, m] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  let guard = 0
  while ((y < ey || (y === ey && m <= em)) && guard++ < MAX_MESES) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}
const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${MES_ABREV[(m - 1) % 12]}/${String(y).slice(2)}`
}
/** Meses (YYYY-MM) cobertos por uma atividade, do início ao fim planejados. */
function activityMonths(a: MasterActivity): string[] {
  if (!a.plannedStart || !a.plannedEnd) return []
  return monthsRange([a])
}

interface Props {
  activities: MasterActivity[]
  nuclei: PlanningNucleus[]
  contract: PlanningContract | null
  allObras?: boolean
  sites?: ConstructionSite[]
}

/** Célula editável (commit no blur / Enter). */
function EditCell({ value, onCommit, align = 'left', type = 'text', className = '', placeholder }: {
  value: string; onCommit: (v: string) => void; align?: 'left' | 'right'; type?: 'text' | 'number'; className?: string; placeholder?: string
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      type={type} value={v} placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onCommit(v) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={`w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs text-[#e5e5e5] outline-none hover:border-[#525252] focus:border-[#f97316]/60 focus:bg-[#2c2c2c] ${align === 'right' ? 'text-right tabular-nums' : ''} ${className}`}
    />
  )
}

export function MatrizMensalPanel({ activities, nuclei, contract, allObras, sites = [] }: Props) {
  const updateActivity = usePlanejamentoMestreStore((s) => s.updateActivity)
  const addActivity = usePlanejamentoMestreStore((s) => s.addActivity)
  const removeActivity = usePlanejamentoMestreStore((s) => s.removeActivity)
  const rdos = useRdoStore((s) => s.rdos)
  const planos = usePlanoExecucaoStore((s) => s.planos)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [showReal, setShowReal] = useState(false)
  const toggle = (k: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  const leaf = useMemo(() => activities.filter((a) => a.level >= 1 && !a.isMilestone), [activities])
  const months = useMemo(() => monthsRange(leaf), [leaf])

  // Executado real por mês (overlay planejado × real): m² dos RDOs Compizzo vinculados
  // (planningActivityId), agrupado por mês, ÷ meta da atividade (plannedQuantity ou
  // area da obra no Plano de Execução) → % físico executado naquele mês. Mesma
  // fórmula do rdoStore.syncExecutionToPlanejamento, para os números baterem.
  const metaByObra = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of planos) {
      if (p.siteId && (p.areaM2 ?? 0) > 0) m.set(p.siteId, Math.max(m.get(p.siteId) ?? 0, p.areaM2))
    }
    return m
  }, [planos])
  const realByActMonth = useMemo(() => {
    const m = new Map<string, Map<string, number>>() // activityId -> 'YYYY-MM' -> m²
    for (const rdo of rdos) {
      const cz = rdo.compizzo
      if (!cz?.planningActivityId) continue
      const m2 = (cz.producao ?? []).reduce((s, r) => (/m²|m2/i.test(r.servico) ? s + parseLocaleNumber(r.quantidade) : s), 0)
      if (m2 <= 0) continue
      const ym = rdo.date.slice(0, 7)
      let byMonth = m.get(cz.planningActivityId)
      if (!byMonth) { byMonth = new Map(); m.set(cz.planningActivityId, byMonth) }
      byMonth.set(ym, (byMonth.get(ym) ?? 0) + m2)
    }
    return m
  }, [rdos])
  function metaOf(a: MasterActivity): number {
    const planned = Number(a.plannedQuantity) || 0
    if (planned > 0) return planned
    return a.obraId ? (metaByObra.get(a.obraId) ?? 0) : 0
  }
  function realPctMonth(a: MasterActivity, ym: string): number {
    const m2 = realByActMonth.get(a.id)?.get(ym) ?? 0
    if (m2 <= 0) return 0
    const meta = metaOf(a)
    return meta > 0 ? Math.min(100, (m2 / meta) * 100) : 0
  }

  // Agrupa por OBRA → NÚCLEO (mesma lógica da Tabela 360).
  const obraGroups = useMemo(() => {
    const byObra = new Map<string, MasterActivity[]>()
    for (const a of leaf) {
      const key = a.obraId || '__none__'
      if (!byObra.has(key)) byObra.set(key, [])
      byObra.get(key)!.push(a)
    }
    return [...byObra.entries()].map(([obraKey, acts]) => {
      const site = obraKey !== '__none__' ? sites.find((s) => s.id === obraKey) : undefined
      const obraName = site?.name || (obraKey === '__none__' ? (contract?.contractName || 'Sem obra') : (contract?.contractName || 'Obra'))
      const byNuc = new Map<string, { key: string; nome: string; acts: MasterActivity[] }>()
      for (const a of acts) {
        const nucleus = a.nucleusId ? nuclei.find((n) => n.id === a.nucleusId) : undefined
        const nome = nucleus?.name || a.nucleo || 'Sem núcleo'
        const nk = a.nucleusId || a.nucleo || '__none__'
        if (!byNuc.has(nk)) byNuc.set(nk, { key: `${obraKey}:${nk}`, nome, acts: [] })
        byNuc.get(nk)!.acts.push(a)
      }
      return { obraKey, obraName, acts, grupos: [...byNuc.values()].sort((x, y) => x.nome.localeCompare(y.nome)) }
    }).sort((x, y) => x.obraName.localeCompare(y.obraName))
  }, [leaf, nuclei, sites, contract, allObras])

  const multiObra = allObras && obraGroups.length > 1
  const cell = 'px-2 py-1 whitespace-nowrap'
  const th = 'px-2 py-2 text-[10px] uppercase tracking-wider text-[#6b6b6b] font-medium whitespace-nowrap'
  const colTotal = 3 + months.length + (allObras ? 1 : 0)

  function setMonth(a: MasterActivity, ym: string, raw: string) {
    const val = clampPct(Number(raw) || 0)
    const next = { ...(a.monthlyPhysicalPct ?? {}) }
    if (val > 0) next[ym] = val; else delete next[ym]
    updateActivity(a.id, { monthlyPhysicalPct: next })
  }
  const rowTotal = (a: MasterActivity) => months.reduce((s, ym) => s + (a.monthlyPhysicalPct?.[ym] ?? 0), 0)
  // Distribui 100% igualmente pelos meses cobertos pela atividade (ponto de partida).
  function autoDistribuir(a: MasterActivity) {
    const ms = activityMonths(a)
    if (!ms.length) return
    const each = Math.round((100 / ms.length) * 100) / 100
    const dist: Record<string, number> = {}
    ms.forEach((ym, i) => { dist[ym] = i === ms.length - 1 ? Math.round((100 - each * (ms.length - 1)) * 100) / 100 : each })
    updateActivity(a.id, { monthlyPhysicalPct: dist })
  }
  function novaAtividade(obraId: string | null, nucleusId?: string, nucleo?: string) {
    const hoje = new Date().toISOString().slice(0, 10)
    addActivity({
      wbsCode: '', name: 'Nova atividade', parentId: null, level: 1,
      plannedStart: hoje, plannedEnd: hoje, trendStart: hoje, trendEnd: hoje,
      durationDays: 1, percentComplete: 0, status: 'not_started', isMilestone: false,
      obraId: obraId ?? undefined, nucleusId, nucleo,
    })
  }
  function distribuirTodas() { leaf.forEach((a) => autoDistribuir(a)) }

  const truncado = months.length >= MAX_MESES
  const colSpanLabel = 2 // Atividade + %Concl ocupam 2 colunas nas bandas
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[#525252] bg-[#2c2c2c]">
        <span className="text-xs font-bold text-[#f5f5f5]">Gestão à Vista — avanço físico por mês</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowReal((v) => !v)} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-semibold ${showReal ? 'border-[#22c55e]/50 text-[#22c55e]' : 'border-[#525252] text-[#a3a3a3] hover:border-[#22c55e]/40 hover:text-[#22c55e]'}`} title="Mostrar o executado real por mês (dos RDOs) abaixo do planejado"><Activity size={11} /> Real (RDO)</button>
          <button onClick={distribuirTodas} className="inline-flex items-center gap-1 rounded border border-[#525252] px-2 py-1 text-[10px] font-semibold text-[#a3a3a3] hover:border-[#f97316]/40 hover:text-[#f97316]" title="Distribuir 100% pelos meses de cada atividade (ponto de partida)"><Wand2 size={11} /> Distribuir todas</button>
          <span className="text-[10px] text-[#6b6b6b]">{months.length} mês(es) · "Total" = soma da linha</span>
        </div>
      </div>
      {truncado && (
        <p className="px-3 py-1.5 text-[10px] text-[#fdba74] bg-[#f97316]/10 border-b border-[#f97316]/20">Período muito longo — mostrando os primeiros {MAX_MESES} meses. Verifique se alguma atividade tem data de início/fim errada.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 640 + months.length * 64 }}>
          <thead>
            <tr className="border-b border-[#525252] bg-[#2c2c2c]">
              <th className={`${th} text-left sticky left-0 bg-[#2c2c2c]`}>Atividade</th>
              <th className={`${th} text-right`}>% Concl.</th>
              {months.map((ym) => <th key={ym} className={`${th} text-right`}>{fmtMonth(ym)}</th>)}
              <th className={`${th} text-right`}>Total</th>
              {allObras && <th className={th}>Obra</th>}
            </tr>
          </thead>
          <tbody>
            {obraGroups.length === 0 && (
              <tr><td colSpan={colTotal} className="px-3 py-6 text-center text-[#6b6b6b]">Sem atividades. Adicione uma linha ou crie o planejamento.</td></tr>
            )}
            {obraGroups.map((obra) => {
              const obraOpen = !collapsed.has(`o:${obra.obraKey}`)
              return (
                <Fragment key={obra.obraKey}>
                  {multiObra && (
                    <tr className="bg-[#f97316]/15 border-b border-[#f97316]/30 cursor-pointer" onClick={() => toggle(`o:${obra.obraKey}`)}>
                      <td className="px-2 py-2 font-bold text-[#f5f5f5] sticky left-0 bg-[#3a2c1e]" colSpan={colSpanLabel}>
                        <span className="inline-flex items-center gap-1.5">
                          {obraOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <Building2 size={13} className="text-[#f97316]" /> {obra.obraName}
                          <span className="text-[10px] font-normal text-[#a3a3a3]">({obra.acts.length})</span>
                        </span>
                      </td>
                      {months.map((ym) => { const v = obra.acts.reduce((s, a) => s + (a.monthlyPhysicalPct?.[ym] ?? 0), 0); return <td key={ym} className="px-2 py-2 text-right text-[#c9c9c9]">{v ? v.toFixed(0) : ''}</td> })}
                      <td className="px-2 py-2" colSpan={allObras ? 2 : 1} />
                    </tr>
                  )}
                  {obraOpen && obra.grupos.map((g) => {
                    const isOpen = !collapsed.has(g.key)
                    return (
                      <Fragment key={g.key}>
                        <tr className="bg-[#2b2c6b]/40 border-b border-[#525252]">
                          <td className={`${multiObra ? 'pl-5' : ''} px-2 py-1.5 font-bold text-[#f5f5f5] cursor-pointer sticky left-0 bg-[#26295a]`} colSpan={colSpanLabel} onClick={() => toggle(g.key)}>
                            <span className="inline-flex items-center gap-1.5">
                              {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              <Layers size={11} className="text-[#f97316]" /> {g.nome}
                              <span className="text-[10px] font-normal text-[#a3a3a3]">({g.acts.length})</span>
                            </span>
                          </td>
                          {months.map((ym) => { const v = g.acts.reduce((s, a) => s + (a.monthlyPhysicalPct?.[ym] ?? 0), 0); return <td key={ym} className="px-2 py-1.5 text-right font-semibold text-[#e5e5e5]">{v ? v.toFixed(0) : ''}</td> })}
                          <td className="px-2 py-1.5 text-right">
                            <button onClick={() => novaAtividade(obra.obraKey === '__none__' ? null : obra.obraKey, g.acts[0]?.nucleusId, g.acts[0]?.nucleo)} className="text-[#a3a3a3] hover:text-[#f97316]" title="Adicionar atividade nesta frente"><Plus size={13} /></button>
                          </td>
                          {allObras && <td className="px-2 py-1.5" />}
                        </tr>
                        {isOpen && g.acts.map((a) => {
                          const total = rowTotal(a)
                          const totalOk = Math.abs(total - 100) < 0.5 || total === 0
                          return (
                            <tr key={a.id} className="border-b border-[#484848] text-[#e5e5e5] hover:bg-[#454545]">
                              <td className={`${cell} sticky left-0 bg-[#3d3d3d]`}>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => autoDistribuir(a)} className="shrink-0 text-[#6b6b6b] hover:text-[#f97316]" title="Distribuir 100% pelos meses da atividade"><Wand2 size={12} /></button>
                                  <EditCell value={a.name} onCommit={(v) => updateActivity(a.id, { name: v })} className="inline-block min-w-[160px]" />
                                  <button onClick={() => removeActivity(a.id)} className="shrink-0 text-[#6b6b6b] hover:text-[#f87171]" title="Excluir atividade"><Trash2 size={12} /></button>
                                </div>
                              </td>
                              <td className={cell}><EditCell type="number" align="right" value={String(fisico(a))} onCommit={(v) => { const n = clampPct(Number(v) || 0); updateActivity(a.id, { physicalProgressPct: n, percentComplete: n }) }} /></td>
                              {months.map((ym) => {
                                const real = showReal ? realPctMonth(a, ym) : 0
                                return (
                                  <td key={ym} className={cell}>
                                    <EditCell type="number" align="right" placeholder="·" value={a.monthlyPhysicalPct?.[ym] ? String(a.monthlyPhysicalPct[ym]) : ''} onCommit={(v) => setMonth(a, ym, v)} />
                                    {showReal && real > 0 && (
                                      <div className="px-1 text-right text-[9px] font-semibold text-[#22c55e]/85" title="Executado real (RDO) neste mês">{real.toFixed(0)}%</div>
                                    )}
                                  </td>
                                )
                              })}
                              <td className={`${cell} text-right font-semibold ${totalOk ? 'text-[#e5e5e5]' : 'text-[#f59e0b]'}`} title={totalOk ? undefined : 'A soma dos meses ≠ 100%'}>{total ? total.toFixed(0) + '%' : '—'}</td>
                              {allObras && (
                                <td className={cell}>
                                  <select value={a.obraId ?? ''} onChange={(e) => updateActivity(a.id, { obraId: e.target.value || null })} className="rounded border border-transparent bg-transparent px-1 py-1 text-xs text-[#c9c9c9] outline-none hover:border-[#525252] focus:border-[#f97316]/60">
                                    <option value="">Sem obra</option>
                                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                  </select>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="px-3 py-2 text-[10px] text-[#6b6b6b]">Cada célula = % de avanço físico planejado naquele mês. "% Concl." = executado até hoje. Ligue <span className="text-[#22c55e]">Real (RDO)</span> para ver, em <span className="text-[#22c55e]">verde</span> abaixo do planejado, o executado real do mês (m² dos RDOs vinculados ÷ meta). Use a varinha para distribuir 100% pelos meses da atividade. Edite/adicione/exclua por aqui; filtra por obra (seletor no topo) e mostra todas juntas.</p>
    </div>
  )
}
