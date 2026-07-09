/**
 * Tabela360Panel — visão "Project 360" do Longo Prazo: tabela dinâmica e responsiva,
 * agrupada por OBRA (quando "Todas as obras") → NÚCLEO (frente) → atividades.
 * Editável inline (nome, datas, % físico/financeiro, HH, responsável, núcleo, obra) via
 * updateActivity — o Gantt reflete as mesmas mudanças (mesma fonte de dados). Roll-ups por
 * núcleo/obra. Núcleos e obras recolhíveis.
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Layers, Building2 } from 'lucide-react'
import type { MasterActivity, PlanningNucleus, PlanningContract, ConstructionSite } from '@/types'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'

const fmtBRL = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
function fmtDate(iso?: string): string {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : '—'
}
function diasEntre(a?: string, b?: string): number {
  if (!a || !b) return 0
  const d = Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000) + 1
  return d > 0 ? d : 0
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const fisico = (a: MasterActivity) => a.physicalProgressPct ?? a.percentComplete ?? 0
const financeiro = (a: MasterActivity) => a.financialProgressPct ?? a.physicalProgressPct ?? a.percentComplete ?? 0
const pesoPct = (a: MasterActivity) => a.financialWeightPct ?? a.weight ?? 0
const clampPct = (n: number) => Math.max(0, Math.min(100, n))

interface Props {
  activities: MasterActivity[]
  nuclei: PlanningNucleus[]
  contract: PlanningContract | null
  allObras?: boolean
  sites?: ConstructionSite[]
}

/** Célula editável (commit no blur / Enter) — evita 1 sync por tecla. */
function EditCell({ value, onCommit, type = 'text', align = 'left', className = '' }: {
  value: string; onCommit: (v: string) => void; type?: 'text' | 'date' | 'number'; align?: 'left' | 'right'; className?: string
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      type={type}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== value) onCommit(v) }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={`w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs text-[#e5e5e5] outline-none hover:border-[#525252] focus:border-[#f97316]/60 focus:bg-[#2c2c2c] ${align === 'right' ? 'text-right tabular-nums' : ''} ${className}`}
    />
  )
}

export function Tabela360Panel({ activities, nuclei, contract, allObras, sites = [] }: Props) {
  const updateActivity = usePlanejamentoMestreStore((s) => s.updateActivity)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  const bac = contract?.bacTotal ?? 0
  const orcAtividade = (a: MasterActivity) => (pesoPct(a) / 100) * bac

  // Agrupa atividades-folha por OBRA (quando allObras) → NÚCLEO.
  const obraGroups = useMemo(() => {
    const leaf = activities.filter((a) => a.level >= 1 && !a.isMilestone)
    const byObra = new Map<string, MasterActivity[]>()
    for (const a of leaf) {
      const key = allObras ? (a.obraId || '__none__') : '__all__'
      if (!byObra.has(key)) byObra.set(key, [])
      byObra.get(key)!.push(a)
    }
    return [...byObra.entries()].map(([obraKey, acts]) => {
      const obraName = obraKey === '__all__' ? (contract?.contractName || 'Obra')
        : obraKey === '__none__' ? 'Sem obra'
        : (sites.find((s) => s.id === obraKey)?.name || 'Obra')
      const byNuc = new Map<string, { key: string; nome: string; nucleus?: PlanningNucleus; acts: MasterActivity[] }>()
      for (const a of acts) {
        const nucleus = a.nucleusId ? nuclei.find((n) => n.id === a.nucleusId) : undefined
        const nome = nucleus?.name || a.nucleo || 'Sem núcleo'
        const nk = a.nucleusId || a.nucleo || '__none__'
        if (!byNuc.has(nk)) byNuc.set(nk, { key: `${obraKey}:${nk}`, nome, nucleus, acts: [] })
        byNuc.get(nk)!.acts.push(a)
      }
      const grupos = [...byNuc.values()].sort((x, y) => x.nome.localeCompare(y.nome))
      return { obraKey, obraName, acts, grupos }
    }).sort((x, y) => x.obraName.localeCompare(y.obraName))
  }, [activities, nuclei, allObras, sites, contract])

  const obraFisico = avg(activities.map(fisico))
  const obraFinanceiro = avg(activities.map(financeiro))
  const obraHH = activities.reduce((s, a) => s + (a.estimatedHH ?? 0), 0)
  const multiObra = allObras && obraGroups.length > 1

  const cell = 'px-2 py-1 whitespace-nowrap'
  const th = 'px-2 py-2 text-left text-[10px] uppercase tracking-wider text-[#6b6b6b] font-medium whitespace-nowrap'
  const colCount = allObras ? 11 : 10

  return (
    <div className="flex flex-col gap-3">
      {/* Banda OBRA (contrato) — só quando visão única */}
      {!multiObra && (
        <div className="rounded-xl border border-[#f97316]/30 bg-[#343434] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-[#f97316]" />
            <span className="text-sm font-bold text-[#f5f5f5]">{contract?.contractName || 'Obra'}</span>
            {contract?.contractor && <span className="text-xs text-[#a3a3a3]">· {contract.contractor}</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <Kpi label="Orçamento total" value={fmtBRL(bac)} accent />
            <Kpi label="Prazo" value={contract ? `${fmtDate(contract.startDate)} → ${fmtDate(contract.endDate)}` : '—'} />
            <Kpi label="Núcleos" value={String(obraGroups[0]?.grupos.length ?? 0)} />
            <Kpi label="Físico médio" value={`${obraFisico.toFixed(0)}%`} />
            <Kpi label="Financeiro médio" value={`${obraFinanceiro.toFixed(0)}%`} />
          </div>
        </div>
      )}

      {/* Tabela agrupada por obra → núcleo */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[980px]">
            <thead>
              <tr className="border-b border-[#525252] bg-[#2c2c2c]">
                <th className={th}>Atividade</th>
                <th className={th}>Início</th>
                <th className={th}>Fim</th>
                <th className={`${th} text-right`}>Dias</th>
                <th className={`${th} text-right`}>% Físico</th>
                <th className={`${th} text-right`}>% Financ.</th>
                <th className={`${th} text-right`}>HH</th>
                <th className={`${th} text-right`}>Orçam. est.</th>
                <th className={th}>Responsável</th>
                <th className={th}>Núcleo</th>
                {allObras && <th className={th}>Obra</th>}
              </tr>
            </thead>
            <tbody>
              {obraGroups.length === 0 && (
                <tr><td colSpan={colCount} className="px-3 py-6 text-center text-[#6b6b6b]">Sem atividades para exibir.</td></tr>
              )}
              {obraGroups.map((obra) => {
                const obraOpen = !collapsed.has(`obra:${obra.obraKey}`)
                return (
                  <Fragment key={obra.obraKey}>
                    {/* Banda OBRA (só multi-obra) */}
                    {multiObra && (
                      <tr className="bg-[#f97316]/15 border-b border-[#f97316]/30 cursor-pointer" onClick={() => toggle(`obra:${obra.obraKey}`)}>
                        <td className="px-2 py-2 font-bold text-[#f5f5f5]" colSpan={3}>
                          <span className="inline-flex items-center gap-1.5">
                            {obraOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            <Building2 size={13} className="text-[#f97316]" /> {obra.obraName}
                            <span className="text-[10px] font-normal text-[#a3a3a3]">({obra.acts.length})</span>
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right text-[#c9c9c9]">{diasEntre(minDate(obra.acts), maxDate(obra.acts)) || ''}</td>
                        <td className="px-2 py-2 text-right font-semibold text-[#e5e5e5]">{avg(obra.acts.map(fisico)).toFixed(0)}%</td>
                        <td className="px-2 py-2 text-right font-semibold text-[#e5e5e5]">{avg(obra.acts.map(financeiro)).toFixed(0)}%</td>
                        <td className="px-2 py-2 text-right text-[#c9c9c9]">{obra.acts.reduce((s, a) => s + (a.estimatedHH ?? 0), 0) || ''}</td>
                        <td className="px-2 py-2 text-right font-semibold text-[#f59e0b]">{fmtBRL(obra.acts.reduce((s, a) => s + orcAtividade(a), 0))}</td>
                        <td className="px-2 py-2" colSpan={allObras ? 2 : 1} />
                      </tr>
                    )}
                    {obraOpen && obra.grupos.map((g) => {
                      const isOpen = !collapsed.has(g.key)
                      const orcNucleo = g.nucleus?.budgetBRL ?? g.acts.reduce((s, a) => s + orcAtividade(a), 0)
                      return (
                        <Fragment key={g.key}>
                          {/* Banda NÚCLEO */}
                          <tr className="bg-[#2b2c6b]/40 border-b border-[#525252] cursor-pointer" onClick={() => toggle(g.key)}>
                            <td className={`${multiObra ? 'pl-6' : ''} px-2 py-2 font-bold text-[#f5f5f5]`} colSpan={3}>
                              <span className="inline-flex items-center gap-1.5">
                                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                <Layers size={12} className="text-[#f97316]" /> {g.nome}
                                <span className="text-[10px] font-normal text-[#a3a3a3]">({g.acts.length})</span>
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right text-[#c9c9c9]">{diasEntre(minDate(g.acts), maxDate(g.acts)) || ''}</td>
                            <td className="px-2 py-2 text-right font-semibold text-[#e5e5e5]">{avg(g.acts.map(fisico)).toFixed(0)}%</td>
                            <td className="px-2 py-2 text-right font-semibold text-[#e5e5e5]">{avg(g.acts.map(financeiro)).toFixed(0)}%</td>
                            <td className="px-2 py-2 text-right text-[#c9c9c9]">{g.acts.reduce((s, a) => s + (a.estimatedHH ?? 0), 0) || ''}</td>
                            <td className="px-2 py-2 text-right font-semibold text-[#f59e0b]">{fmtBRL(orcNucleo)}</td>
                            <td className="px-2 py-2" colSpan={allObras ? 2 : 1} />
                          </tr>
                          {/* Atividades (editáveis) */}
                          {isOpen && g.acts.map((a) => (
                            <tr key={a.id} className="border-b border-[#484848] text-[#e5e5e5] hover:bg-[#454545]">
                              <td className={cell}>
                                <span className="text-[#6b6b6b] mr-1">{a.wbsCode}</span>
                                <EditCell value={a.name} onCommit={(v) => updateActivity(a.id, { name: v })} className="inline-block w-[200px]" />
                              </td>
                              <td className={cell}><EditCell type="date" value={a.plannedStart ?? ''} onCommit={(v) => updateActivity(a.id, { plannedStart: v, trendStart: a.trendStart || v })} /></td>
                              <td className={cell}><EditCell type="date" value={a.plannedEnd ?? ''} onCommit={(v) => updateActivity(a.id, { plannedEnd: v, trendEnd: a.trendEnd || v })} /></td>
                              <td className={`${cell} text-right text-[#c9c9c9]`}>{a.durationDays || diasEntre(a.plannedStart, a.plannedEnd)}</td>
                              <td className={cell}><EditCell type="number" align="right" value={String(fisico(a))} onCommit={(v) => { const n = clampPct(Number(v) || 0); updateActivity(a.id, { physicalProgressPct: n, percentComplete: n }) }} /></td>
                              <td className={cell}><EditCell type="number" align="right" value={String(financeiro(a))} onCommit={(v) => updateActivity(a.id, { financialProgressPct: clampPct(Number(v) || 0) })} /></td>
                              <td className={cell}><EditCell type="number" align="right" value={String(a.estimatedHH ?? 0)} onCommit={(v) => updateActivity(a.id, { estimatedHH: Math.max(0, Number(v) || 0) })} /></td>
                              <td className={`${cell} text-right text-[#c9c9c9]`}>{pesoPct(a) > 0 ? fmtBRL(orcAtividade(a)) : '—'}</td>
                              <td className={cell}><EditCell value={a.coordenador ?? a.responsibleTeam ?? ''} onCommit={(v) => updateActivity(a.id, { coordenador: v })} className="inline-block w-[120px]" /></td>
                              <td className={cell}>
                                <select
                                  value={a.nucleusId ?? ''}
                                  onChange={(e) => { const n = nuclei.find((x) => x.id === e.target.value); updateActivity(a.id, { nucleusId: e.target.value || undefined, nucleo: n?.name ?? a.nucleo }) }}
                                  className="rounded border border-transparent bg-transparent px-1 py-1 text-xs text-[#c9c9c9] outline-none hover:border-[#525252] focus:border-[#f97316]/60"
                                >
                                  <option value="">{a.nucleo || '—'}</option>
                                  {nuclei.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                                </select>
                              </td>
                              {allObras && (
                                <td className={cell}>
                                  <select
                                    value={a.obraId ?? ''}
                                    onChange={(e) => updateActivity(a.id, { obraId: e.target.value || null })}
                                    className="rounded border border-transparent bg-transparent px-1 py-1 text-xs text-[#c9c9c9] outline-none hover:border-[#525252] focus:border-[#f97316]/60"
                                  >
                                    <option value="">Sem obra</option>
                                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                  </select>
                                </td>
                              )}
                            </tr>
                          ))}
                        </Fragment>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#f97316] bg-[#2c2c2c] text-[#f59e0b] font-bold">
                <td className="px-2 py-2" colSpan={4}>TOTAL {multiObra ? 'GERAL' : 'DA OBRA'}</td>
                <td className="px-2 py-2 text-right">{obraFisico.toFixed(0)}%</td>
                <td className="px-2 py-2 text-right">{obraFinanceiro.toFixed(0)}%</td>
                <td className="px-2 py-2 text-right">{obraHH || ''}</td>
                <td className="px-2 py-2 text-right">{fmtBRL(bac)}</td>
                <td className="px-2 py-2" colSpan={allObras ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-[#6b6b6b]">
        Edite direto na tabela (nome, datas, %, HH, responsável, núcleo{allObras ? ', obra' : ''}) — o Gantt reflete as mesmas mudanças.
        Orçamento est. por atividade = peso financeiro (%) × orçamento total. Núcleo usa o orçamento cadastrado quando disponível.
      </p>
    </div>
  )
}

function minDate(acts: MasterActivity[]): string | undefined {
  return acts.map((a) => a.plannedStart).filter(Boolean).sort()[0]
}
function maxDate(acts: MasterActivity[]): string | undefined {
  return acts.map((a) => a.plannedEnd).filter(Boolean).sort().slice(-1)[0]
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">{label}</div>
      <div className={`text-sm font-bold mt-0.5 ${accent ? 'text-[#f59e0b]' : 'text-[#f5f5f5]'}`}>{value}</div>
    </div>
  )
}
