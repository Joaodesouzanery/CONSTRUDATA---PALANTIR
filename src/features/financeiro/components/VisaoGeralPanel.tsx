/**
 * VisaoGeralPanel — Análise financeira com filtros avançados (período livre,
 * obra, categoria, tipo). KPIs, receita×despesa mensal, saldo acumulado,
 * quebra por categoria e por obra, e tabela mensal. Tudo derivado de
 * `financeiroStore.entries` (não altera nenhum dado).
 */
import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Building2 } from 'lucide-react'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { FinanceiroFilterBar } from './FinanceiroFilterBar'
import {
  filterEntries, monthlySeries, catLabel, fmtBRL, fmtBRLcompact, monthLabel, num,
} from '../lib/financeiroCalc'
import type { FinanceiroFilter } from '../lib/financeiroCalc'
import type { FinanceiroEntry } from '@/types'

export function VisaoGeralPanel() {
  const entries = useFinanceiroStore((s) => s.entries)
  const sites = useTorreStore((s) => s.sites)
  const [filter, setFilter] = useState<FinanceiroFilter>({})

  const siteName = useMemo(() => {
    const m = new Map(sites.map((s) => [s.id, s.code ? `${s.code} — ${s.name}` : s.name]))
    return (id?: string) => (id ? (m.get(id) ?? 'Obra desconhecida') : 'Sem obra')
  }, [sites])

  const filtered = useMemo(() => filterEntries(entries, filter), [entries, filter])
  const monthly = useMemo(() => monthlySeries(filtered), [filtered])

  const totEntradas = filtered.filter((e) => e.tipo === 'entrada').reduce((s, e) => s + num(e.valor), 0)
  const totSaidas = filtered.filter((e) => e.tipo === 'saida').reduce((s, e) => s + num(e.valor), 0)
  const resultado = totEntradas - totSaidas
  const margem = totEntradas > 0 ? (resultado / totEntradas) * 100 : 0

  // Quebra por categoria (separando entrada/saída)
  const porCatEntrada = aggregate(filtered.filter((e) => e.tipo === 'entrada'), (e) => e.categoria)
  const porCatSaida = aggregate(filtered.filter((e) => e.tipo === 'saida'), (e) => e.categoria)
  const porObra = aggregateObra(filtered)

  return (
    <div className="p-6 space-y-5 overflow-auto">
      <FinanceiroFilterBar value={filter} onChange={setFilter} />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<TrendingUp size={18} className="text-emerald-400" />} label="Entradas" value={fmtBRL(totEntradas)} color="text-emerald-400" />
        <KpiCard icon={<TrendingDown size={18} className="text-red-400" />} label="Saídas" value={fmtBRL(totSaidas)} color="text-red-400" />
        <KpiCard icon={<DollarSign size={18} className={resultado >= 0 ? 'text-emerald-400' : 'text-red-400'} />} label="Resultado" value={fmtBRL(resultado)} color={resultado >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <KpiCard icon={<BarChart3 size={18} className="text-cyan-400" />} label="Margem" value={`${margem.toFixed(1)}%`} color="text-cyan-400" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#6b6b6b] text-sm rounded-xl border border-dashed border-[#525252]">
          Nenhum lançamento no filtro selecionado.
        </div>
      ) : (
        <>
          {/* Receita × Despesa mensal + Saldo acumulado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Receita × Despesa (mensal)">
              <MonthlyBars monthly={monthly} />
            </Card>
            <Card title="Saldo acumulado">
              <SaldoLine monthly={monthly} />
            </Card>
          </div>

          {/* Quebra por categoria */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Entradas por categoria">
              <CategoryBars data={porCatEntrada} total={totEntradas} color="#22c55e" />
            </Card>
            <Card title="Saídas por categoria">
              <CategoryBars data={porCatSaida} total={totSaidas} color="#ef4444" />
            </Card>
          </div>

          {/* Resultado por obra */}
          {porObra.length > 0 && (
            <Card title="Resultado por obra">
              <div className="space-y-2.5">
                {porObra.map((o) => {
                  const max = Math.max(...porObra.map((x) => Math.abs(x.resultado)), 1)
                  const pct = (Math.abs(o.resultado) / max) * 100
                  const positive = o.resultado >= 0
                  return (
                    <div key={o.obraId ?? 'none'}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-white flex items-center gap-1.5"><Building2 size={11} className="text-[#6b6b6b]" />{siteName(o.obraId)}</span>
                        <span className={positive ? 'text-emerald-400' : 'text-red-400'}>{fmtBRL(o.resultado)}</span>
                      </div>
                      <div className="h-2.5 bg-[#2c2c2c] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: positive ? '#22c55e' : '#ef4444' }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#6b6b6b] mt-0.5">
                        <span>Entradas {fmtBRLcompact(o.entradas)}</span>
                        <span>Saídas {fmtBRLcompact(o.saidas)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Tabela mensal */}
          <Card title="Resumo mensal">
            <div className="overflow-auto rounded-lg border border-[#525252]">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-2 text-left">Mês</th>
                    <th className="px-4 py-2 text-right">Entradas</th>
                    <th className="px-4 py-2 text-right">Saídas</th>
                    <th className="px-4 py-2 text-right">Resultado</th>
                    <th className="px-4 py-2 text-right">Saldo acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2937]">
                  {monthly.map((m) => (
                    <tr key={m.month} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-2 text-white font-medium">{monthLabel(m.month)}</td>
                      <td className="px-4 py-2 text-right text-emerald-400 tabular-nums">{fmtBRL(m.entradas)}</td>
                      <td className="px-4 py-2 text-right text-red-400 tabular-nums">{fmtBRL(m.saidas)}</td>
                      <td className={`px-4 py-2 text-right font-bold tabular-nums ${m.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtBRL(m.resultado)}</td>
                      <td className={`px-4 py-2 text-right font-bold tabular-nums ${m.saldo >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{fmtBRL(m.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

// ─── Agregações ─────────────────────────────────────────────────────────────
function aggregate(entries: FinanceiroEntry[], keyOf: (e: FinanceiroEntry) => string) {
  const m = new Map<string, number>()
  for (const e of entries) m.set(keyOf(e), (m.get(keyOf(e)) ?? 0) + num(e.valor))
  return [...m.entries()].map(([key, valor]) => ({ key, valor })).sort((a, b) => b.valor - a.valor)
}
function aggregateObra(entries: FinanceiroEntry[]) {
  const m = new Map<string, { obraId?: string; entradas: number; saidas: number }>()
  for (const e of entries) {
    const k = e.obraId ?? '__none__'
    if (!m.has(k)) m.set(k, { obraId: e.obraId, entradas: 0, saidas: 0 })
    const row = m.get(k)!
    if (e.tipo === 'entrada') row.entradas += num(e.valor)
    else row.saidas += num(e.valor)
  }
  return [...m.values()]
    .map((r) => ({ ...r, resultado: r.entradas - r.saidas }))
    .sort((a, b) => b.resultado - a.resultado)
}

// ─── UI ─────────────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4">
      <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  )
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p></div>
      <p className={`text-xl font-bold tabular-nums ${color || 'text-white'}`}>{value}</p>
    </div>
  )
}

function MonthlyBars({ monthly }: { monthly: ReturnType<typeof monthlySeries> }) {
  const max = Math.max(...monthly.map((m) => Math.max(m.entradas, m.saidas)), 1)
  return (
    <div className="space-y-3">
      {monthly.map((m) => (
        <div key={m.month}>
          <div className="flex items-center justify-between text-[10px] text-[#a3a3a3] mb-1">
            <span>{monthLabel(m.month)}</span>
            <span className={m.resultado >= 0 ? 'text-emerald-400' : 'text-red-400'}>{fmtBRL(m.resultado)}</span>
          </div>
          <div className="space-y-1">
            <div className="h-2.5 bg-[#2c2c2c] rounded-full overflow-hidden" title={`Entradas: ${fmtBRL(m.entradas)}`}>
              <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${(m.entradas / max) * 100}%` }} />
            </div>
            <div className="h-2.5 bg-[#2c2c2c] rounded-full overflow-hidden" title={`Saídas: ${fmtBRL(m.saidas)}`}>
              <div className="h-full bg-red-500/70 rounded-full" style={{ width: `${(m.saidas / max) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-4 pt-1 text-[10px] text-[#6b6b6b]">
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500/70 rounded" /> Entradas</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-500/70 rounded" /> Saídas</span>
      </div>
    </div>
  )
}

function SaldoLine({ monthly }: { monthly: ReturnType<typeof monthlySeries> }) {
  const W = 520, H = 180, PAD = 28
  if (monthly.length === 0) return <div className="text-[#6b6b6b] text-xs py-8 text-center">Sem dados.</div>
  const saldos = monthly.map((m) => m.saldo)
  const min = Math.min(0, ...saldos)
  const max = Math.max(0, ...saldos)
  const range = max - min || 1
  const n = monthly.length
  const x = (i: number) => PAD + (n === 1 ? (W - 2 * PAD) / 2 : (i / (n - 1)) * (W - 2 * PAD))
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - 2 * PAD)
  const pts = monthly.map((m, i) => `${x(i)},${y(m.saldo)}`).join(' ')
  const zeroY = y(0)
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 320 }}>
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="#525252" strokeDasharray="3 3" />
        <polyline points={pts} fill="none" stroke="#38bdf8" strokeWidth={2} />
        {monthly.map((m, i) => (
          <g key={m.month}>
            <circle cx={x(i)} cy={y(m.saldo)} r={3} fill={m.saldo >= 0 ? '#38bdf8' : '#ef4444'} />
            {(i === 0 || i === n - 1 || i === Math.floor(n / 2)) && (
              <text x={x(i)} y={H - 8} fill="#6b6b6b" fontSize={9} textAnchor="middle">{monthLabel(m.month)}</text>
            )}
          </g>
        ))}
        <text x={PAD} y={y(max) - 4} fill="#6b6b6b" fontSize={9}>{fmtBRLcompact(max)}</text>
      </svg>
    </div>
  )
}

function CategoryBars({ data, total, color }: { data: { key: string; valor: number }[]; total: number; color: string }) {
  if (data.length === 0) return <div className="text-[#6b6b6b] text-xs py-6 text-center">Sem dados.</div>
  const max = Math.max(...data.map((d) => d.valor), 1)
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.key}>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-white">{catLabel(d.key as never)}</span>
            <span className="text-[#a3a3a3] tabular-nums">{fmtBRL(d.valor)} · {total > 0 ? ((d.valor / total) * 100).toFixed(0) : 0}%</span>
          </div>
          <div className="h-2.5 bg-[#2c2c2c] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(d.valor / max) * 100}%`, backgroundColor: color }} />
          </div>
        </div>
      ))}
    </div>
  )
}
