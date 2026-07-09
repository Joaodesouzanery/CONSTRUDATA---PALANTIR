/**
 * Tabela360Panel — visão "Project 360" do Longo Prazo: tabela dinâmica e responsiva,
 * agrupada por NÚCLEO (frente da obra) dentro da OBRA (contrato), com orçamento, prazo,
 * progresso (físico/financeiro), recursos (HH) e responsável. Roll-ups por núcleo + obra.
 * Só leitura/visão — a edição continua no Gantt/tabela. Núcleos recolhíveis.
 */
import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Layers, Building2 } from 'lucide-react'
import type { MasterActivity, PlanningNucleus, PlanningContract } from '@/types'

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

interface Props {
  activities: MasterActivity[]
  nuclei: PlanningNucleus[]
  contract: PlanningContract | null
}

export function Tabela360Panel({ activities, nuclei, contract }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggle = (k: string) => setCollapsed((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  const bac = contract?.bacTotal ?? 0
  const orcAtividade = (a: MasterActivity) => (pesoPct(a) / 100) * bac

  // Agrupa atividades-folha por núcleo (nucleusId → nome do núcleo; senão string `nucleo`).
  const grupos = useMemo(() => {
    const leaf = activities.filter((a) => a.level >= 1 && !a.isMilestone)
    const byKey = new Map<string, { key: string; nome: string; nucleus?: PlanningNucleus; acts: MasterActivity[] }>()
    for (const a of leaf) {
      const nucleus = a.nucleusId ? nuclei.find((n) => n.id === a.nucleusId) : undefined
      const nome = nucleus?.name || a.nucleo || 'Sem núcleo'
      const key = a.nucleusId || a.nucleo || '__none__'
      if (!byKey.has(key)) byKey.set(key, { key, nome, nucleus, acts: [] })
      byKey.get(key)!.acts.push(a)
    }
    return [...byKey.values()].sort((x, y) => x.nome.localeCompare(y.nome))
  }, [activities, nuclei])

  const obraFisico = avg(activities.map(fisico))
  const obraFinanceiro = avg(activities.map(financeiro))
  const obraHH = activities.reduce((s, a) => s + (a.estimatedHH ?? 0), 0)

  const cell = 'px-3 py-2 whitespace-nowrap'
  const th = 'px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[#6b6b6b] font-medium whitespace-nowrap'

  return (
    <div className="flex flex-col gap-3">
      {/* Banda OBRA */}
      <div className="rounded-xl border border-[#f97316]/30 bg-[#343434] p-4">
        <div className="flex items-center gap-2 mb-2">
          <Building2 size={16} className="text-[#f97316]" />
          <span className="text-sm font-bold text-[#f5f5f5]">{contract?.contractName || 'Obra'}</span>
          {contract?.contractor && <span className="text-xs text-[#a3a3a3]">· {contract.contractor}</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <Kpi label="Orçamento total" value={fmtBRL(bac)} accent />
          <Kpi label="Prazo" value={contract ? `${fmtDate(contract.startDate)} → ${fmtDate(contract.endDate)}` : '—'} />
          <Kpi label="Núcleos" value={String(grupos.length)} />
          <Kpi label="Físico médio" value={`${obraFisico.toFixed(0)}%`} />
          <Kpi label="Financeiro médio" value={`${obraFinanceiro.toFixed(0)}%`} />
        </div>
      </div>

      {/* Tabela agrupada por núcleo */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
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
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-[#6b6b6b]">Sem atividades para exibir.</td></tr>
              )}
              {grupos.map((g) => {
                const isOpen = !collapsed.has(g.key)
                const orcNucleo = g.nucleus?.budgetBRL ?? g.acts.reduce((s, a) => s + orcAtividade(a), 0)
                return (
                  <Fragment key={g.key}>
                    {/* Banda NÚCLEO */}
                    <tr className="bg-[#2b2c6b]/40 border-b border-[#525252] cursor-pointer" onClick={() => toggle(g.key)}>
                      <td className="px-3 py-2 font-bold text-[#f5f5f5]" colSpan={3}>
                        <span className="inline-flex items-center gap-1.5">
                          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <Layers size={12} className="text-[#f97316]" /> {g.nome}
                          <span className="text-[10px] font-normal text-[#a3a3a3]">({g.acts.length})</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[#c9c9c9]">{diasEntre(minDate(g.acts), maxDate(g.acts)) || ''}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#e5e5e5]">{avg(g.acts.map(fisico)).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#e5e5e5]">{avg(g.acts.map(financeiro)).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right text-[#c9c9c9]">{g.acts.reduce((s, a) => s + (a.estimatedHH ?? 0), 0) || ''}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#f59e0b]">{fmtBRL(orcNucleo)}</td>
                      <td className="px-3 py-2" />
                    </tr>
                    {/* Atividades */}
                    {isOpen && g.acts.map((a) => (
                      <tr key={a.id} className="border-b border-[#484848] text-[#e5e5e5] hover:bg-[#454545]">
                        <td className={cell}><span className="text-[#6b6b6b] mr-1">{a.wbsCode}</span>{a.name}</td>
                        <td className={`${cell} text-[#c9c9c9]`}>{fmtDate(a.plannedStart)}</td>
                        <td className={`${cell} text-[#c9c9c9]`}>{fmtDate(a.plannedEnd)}</td>
                        <td className={`${cell} text-right text-[#c9c9c9]`}>{a.durationDays || diasEntre(a.plannedStart, a.plannedEnd)}</td>
                        <td className={`${cell} text-right`}>{fisico(a).toFixed(0)}%</td>
                        <td className={`${cell} text-right`}>{financeiro(a).toFixed(0)}%</td>
                        <td className={`${cell} text-right text-[#c9c9c9]`}>{a.estimatedHH ?? '—'}</td>
                        <td className={`${cell} text-right text-[#c9c9c9]`}>{pesoPct(a) > 0 ? fmtBRL(orcAtividade(a)) : '—'}</td>
                        <td className={`${cell} text-[#a3a3a3]`}>{a.coordenador || a.responsibleTeam || '—'}</td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#f97316] bg-[#2c2c2c] text-[#f59e0b] font-bold">
                <td className="px-3 py-2" colSpan={4}>TOTAL DA OBRA</td>
                <td className="px-3 py-2 text-right">{obraFisico.toFixed(0)}%</td>
                <td className="px-3 py-2 text-right">{obraFinanceiro.toFixed(0)}%</td>
                <td className="px-3 py-2 text-right">{obraHH || ''}</td>
                <td className="px-3 py-2 text-right">{fmtBRL(bac)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-[#6b6b6b]">Orçamento est. por atividade = peso financeiro (%) × orçamento total da obra. Núcleo usa o orçamento cadastrado quando disponível.</p>
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
