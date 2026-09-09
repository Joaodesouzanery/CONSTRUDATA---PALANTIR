/**
 * DrePanel — Demonstração de Resultados (DRE) simplificada, auto-calculada a
 * partir dos lançamentos do Financeiro. Colunas por período (mensal) + Total.
 * Config: alíquota de deduções/impostos sobre a receita + remapeamento
 * categoria→linha (persistido em financeiroStore.dreConfig, sem migração).
 */
import { Fragment, useMemo, useState } from 'react'
import { Settings2, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { vigenciaDaObra } from '@/features/torre-de-controle/utils/obraBudget'
import { FinanceiroFilterBar } from './FinanceiroFilterBar'
import {
  filterEntries, computeDre, resolveDreLine, monthsOf, monthLabel, fmtBRL, catLabel,
  DRE_LINE_LABELS, ENTRADA_CATS, SAIDA_CATS, defaultDreLine, dreKey, fmtPct, corDaMargem, presetDePeriodo,
} from '../lib/financeiroCalc'
import type { FinanceiroFilter } from '../lib/financeiroCalc'
import type { DreLineKey, DreConfig, FinanceiroCategoria } from '@/types'

type RowSpec =
  | { kind: 'line'; key: DreLineKey; label: string; sign: '+' | '-'; pick: (d: ReturnType<typeof computeDre>) => number; strong?: boolean }
  | { kind: 'subtotal'; label: string; pick: (d: ReturnType<typeof computeDre>) => number }
  | { kind: 'result'; label: string; pick: (d: ReturnType<typeof computeDre>) => number }

const ROWS: RowSpec[] = [
  { kind: 'line', key: 'receita_bruta', label: DRE_LINE_LABELS.receita_bruta, sign: '+', pick: (d) => d.receitaBruta },
  { kind: 'line', key: 'deducao', label: '(−) ' + DRE_LINE_LABELS.deducao, sign: '-', pick: (d) => d.deducoes },
  { kind: 'subtotal', label: '(=) Receita Líquida', pick: (d) => d.receitaLiquida },
  { kind: 'line', key: 'custo', label: '(−) ' + DRE_LINE_LABELS.custo, sign: '-', pick: (d) => d.custos },
  { kind: 'subtotal', label: '(=) Lucro Bruto', pick: (d) => d.lucroBruto },
  { kind: 'line', key: 'despesa_adm', label: '(−) ' + DRE_LINE_LABELS.despesa_adm, sign: '-', pick: (d) => d.despesaAdm },
  { kind: 'line', key: 'despesa_outra', label: '(−) ' + DRE_LINE_LABELS.despesa_outra, sign: '-', pick: (d) => d.despesaOutra },
  { kind: 'result', label: '(=) Resultado Líquido', pick: (d) => d.resultado },
]

export function DrePanel() {
  const entries = useFinanceiroStore((s) => s.entries)
  const dreConfig = useFinanceiroStore((s) => s.dreConfig)
  const setDreConfig = useFinanceiroStore((s) => s.setDreConfig)
  /**
   * ⚠️ 12 meses, não `{}`.
   *
   * As COLUNAS da DRE já confrontam receita e custo dentro do mesmo mês — essa parte estava certa.
   * O que estava errado é a coluna **Total**, que somava o intervalo inteiro: com `{}` ela era o
   * histórico desde o primeiro lançamento. E o eixo de meses é derivado do dado, então uma receita
   * solta de 2025 fazia a tabela nascer em 2025 com uma coluna de receita sem custo nenhum ao lado.
   */
  const [filter, setFilter] = useState<FinanceiroFilter>(() => presetDePeriodo('12m'))
  const [showConfig, setShowConfig] = useState(false)
  const [expanded, setExpanded] = useState<Set<DreLineKey>>(new Set())

  // A DRE ignora o filtro de tipo/categoria (precisa de receitas e despesas juntas);
  // respeita período e obra.
  const sites = useTorreStore((s) => s.sites)
  /** A vigência da obra escolhida — o atalho "Contrato" da barra. */
  const vigencia = useMemo(
    () => (filter.obraId ? vigenciaDaObra(sites.find((s) => s.id === filter.obraId)) : null),
    [filter.obraId, sites],
  )

  const filtered = useMemo(
    () => filterEntries(entries, { from: filter.from, to: filter.to, obraId: filter.obraId }),
    [entries, filter.from, filter.to, filter.obraId],
  )

  const months = useMemo(() => monthsOf(filtered), [filtered])
  // Modo de dedução FIXO sobre o conjunto inteiro → colunas mensais somam o Total.
  const deducaoMode = useMemo(
    () => (filtered.some((e) => resolveDreLine(e, dreConfig) === 'deducao') ? 'lancada' as const : 'pct' as const),
    [filtered, dreConfig],
  )
  const totalDre = useMemo(() => computeDre(filtered, dreConfig, deducaoMode), [filtered, dreConfig, deducaoMode])
  const perMonth = useMemo(
    () => months.map((ym) => ({ ym, dre: computeDre(filtered.filter((e) => e.data.slice(0, 7) === ym), dreConfig, deducaoMode) })),
    [months, filtered, dreConfig, deducaoMode],
  )

  const toggleExpand = (k: DreLineKey) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    return next
  })

  return (
    <div className="p-6 space-y-4 overflow-auto">
      <FinanceiroFilterBar value={filter} onChange={setFilter} showTipo={false} showCategoria={false} vigencia={vigencia} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-white">Demonstração de Resultados (DRE)</h2>
          <p className="text-[10px] text-[#6b6b6b]">Simplificada · auto-calculada dos lançamentos · {filtered.length} lançamentos no período</p>
        </div>
        <button onClick={() => setShowConfig((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors">
          <Settings2 size={14} /> Configurar
        </button>
      </div>

      {showConfig && <DreConfigPanel config={dreConfig} onChange={setDreConfig} />}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-[#6b6b6b] text-sm rounded-xl border border-dashed border-[#525252]">
          Nenhum lançamento no período. Registre entradas e saídas para gerar a DRE.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#525252]">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                <th className="px-4 py-2.5 text-left sticky left-0 bg-[#1f1f1f] z-10">Conta</th>
                {perMonth.map((c) => <th key={c.ym} className="px-4 py-2.5 text-right whitespace-nowrap">{monthLabel(c.ym)}</th>)}
                <th className="px-4 py-2.5 text-right bg-[#252525] whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {ROWS.map((row, ri) => {
                const isLine = row.kind === 'line'
                const isResult = row.kind === 'result'
                const isSub = row.kind === 'subtotal'
                const detail = isLine ? totalDre.byLine[row.key] : []
                const canExpand = isLine && detail.length > 0
                const rowBg = isResult ? 'bg-[#f97316]/10' : isSub ? 'bg-white/[0.03]' : ''
                const labelColor = isResult ? 'text-white font-bold' : isSub ? 'text-white font-semibold' : 'text-[#d4d4d4]'
                return (
                  <Fragment key={ri}>
                    <tr className={`${rowBg} hover:bg-white/[0.02]`}>
                      <td className={`px-4 py-2 sticky left-0 z-10 ${rowBg || 'bg-[#2c2c2c]'} ${labelColor}`}>
                        <button
                          type="button"
                          onClick={() => canExpand && toggleExpand((row as { key: DreLineKey }).key)}
                          className={`flex items-center gap-1 ${canExpand ? 'hover:text-white cursor-pointer' : 'cursor-default'}`}
                        >
                          {canExpand ? (expanded.has((row as { key: DreLineKey }).key) ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-3" />}
                          {row.label}
                        </button>
                      </td>
                      {perMonth.map((c) => {
                        const v = row.pick(c.dre)
                        return <td key={c.ym} className={`px-4 py-2 text-right tabular-nums ${cellColor(row, v)}`}>{fmtBRL(v)}</td>
                      })}
                      <td className={`px-4 py-2 text-right tabular-nums font-semibold bg-[#252525] ${cellColor(row, row.pick(totalDre))}`}>{fmtBRL(row.pick(totalDre))}</td>
                    </tr>
                    {isLine && expanded.has(row.key) && detail.map((d) => (
                      <tr key={`${ri}-${d.categoria}`} className="bg-[#232323] text-[#a3a3a3]">
                        <td className="px-4 py-1.5 pl-9 sticky left-0 bg-[#232323] z-10">{catLabel(d.categoria)}</td>
                        {perMonth.map((c) => {
                          const catVal = (c.dre.byLine[row.key].find((x) => x.categoria === d.categoria)?.valor) ?? 0
                          return <td key={c.ym} className="px-4 py-1.5 text-right tabular-nums text-[#8a8a8a]">{catVal ? fmtBRL(catVal) : '—'}</td>
                        })}
                        <td className="px-4 py-1.5 text-right tabular-nums bg-[#252525] text-[#8a8a8a]">{fmtBRL(d.valor)}</td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
              {/* Margens */}
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] text-[11px]">
                <td className="px-4 py-2 sticky left-0 bg-[#1f1f1f] z-10">Margem bruta</td>
                {perMonth.map((c) => <td key={c.ym} className="px-4 py-2 text-right tabular-nums">{fmtPct(c.dre.margemBruta)}</td>)}
                <td className="px-4 py-2 text-right tabular-nums bg-[#252525]">{fmtPct(totalDre.margemBruta)}</td>
              </tr>
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] text-[11px]">
                <td className="px-4 py-2 sticky left-0 bg-[#1f1f1f] z-10">Margem líquida</td>
                {/* ⚠️ A cor vem de `corDaMargem`, não de `>= 0`. Com o teste antigo, um mês só com
                    saídas e nenhuma receita caía em `0 >= 0` e saía **verde esmeralda** — o pior
                    mês possível pintado como o melhor. */}
                {perMonth.map((c) => <td key={c.ym} className={`px-4 py-2 text-right tabular-nums ${corDaMargem(c.dre.margemLiquida)}`}>{fmtPct(c.dre.margemLiquida)}</td>)}
                <td className={`px-4 py-2 text-right tabular-nums bg-[#252525] font-semibold ${corDaMargem(totalDre.margemLiquida)}`}>{fmtPct(totalDre.margemLiquida)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function cellColor(row: RowSpec, v: number): string {
  if (row.kind === 'result') return v >= 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'
  if (row.kind === 'subtotal') return v >= 0 ? 'text-white' : 'text-red-400'
  if (row.kind === 'line' && row.sign === '+') return 'text-emerald-400'
  return 'text-[#d4d4d4]'
}

// ─── Config da DRE ────────────────────────────────────────────────────────────
const ALL_LINES: DreLineKey[] = ['receita_bruta', 'deducao', 'custo', 'despesa_adm', 'despesa_outra']

/**
 * ⚠️ Exportado para a aba **Configuração** também renderizar ESTE componente — não uma cópia.
 * Duas portas para a mesma sala: aqui, contextual (você está vendo a DRE que o mapa produz), e
 * lá, junto do Plano de Contas, onde se procura o que é configuração. Como é o mesmo componente
 * sobre o mesmo `dreConfig` do store, não existe como as duas divergirem.
 */
export function DreConfigPanel({ config, onChange }: { config: DreConfig; onChange: (patch: Partial<DreConfig>) => void }) {
  const cats: { cat: FinanceiroCategoria; tipo: 'entrada' | 'saida' }[] = [
    ...ENTRADA_CATS.map((c) => ({ cat: c as FinanceiroCategoria, tipo: 'entrada' as const })),
    ...SAIDA_CATS.map((c) => ({ cat: c as FinanceiroCategoria, tipo: 'saida' as const })),
  ]
  const setMapping = (cat: FinanceiroCategoria, line: DreLineKey, tipo: 'entrada' | 'saida') => {
    const key = dreKey(cat, tipo)
    const next = { ...config.mapping }
    if (line === defaultDreLine(cat, tipo)) delete next[key]
    else next[key] = line
    onChange({ mapping: next })
  }
  return (
    <div className="rounded-xl border border-[#525252] bg-[#333333] p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs text-[#a3a3a3] font-semibold">Alíquota de deduções/impostos sobre receita</label>
        <div className="flex items-center gap-1">
          <input
            type="number" min={0} max={100} step={0.5}
            value={config.deducaoPct}
            onChange={(e) => onChange({ deducaoPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
            className="w-20 bg-[#2c2c2c] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#f97316]/60"
          />
          <span className="text-xs text-[#a3a3a3]">%</span>
        </div>
        <span className="text-[10px] text-[#6b6b6b]">
          Aplicada sobre a Receita Bruta quando não há lançamentos classificados como “Deduções”.
        </span>
      </div>

      <div>
        <p className="text-xs text-[#a3a3a3] font-semibold mb-2">Mapeamento categoria → linha da DRE</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {cats.map(({ cat, tipo }) => {
            const key = dreKey(cat, tipo)
            const current = config.mapping[key] ?? defaultDreLine(cat, tipo)
            const isOverride = config.mapping[key] != null
            return (
              <div key={`${tipo}-${cat}`} className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#d4d4d4]">
                  <span className={tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}>●</span> {catLabel(cat)}
                  <span className="text-[#6b6b6b] ml-1">({tipo})</span>
                </span>
                <div className="flex items-center gap-1">
                  <select
                    value={current}
                    onChange={(e) => setMapping(cat, e.target.value as DreLineKey, tipo)}
                    className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-[#f97316]/60"
                  >
                    {ALL_LINES.map((l) => <option key={l} value={l}>{DRE_LINE_LABELS[l]}</option>)}
                  </select>
                  {isOverride && (
                    <button type="button" onClick={() => setMapping(cat, defaultDreLine(cat, tipo), tipo)} title="Restaurar padrão" className="text-[#6b6b6b] hover:text-white">
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
