/**
 * FluxoCaixaPanel — Fluxo de Caixa mensal enriquecido: realizado (dos
 * lançamentos) × previsto (obrigações em aberto do Manejo Financeiro) ×
 * saldo projetado. Filtro de período/obra. Não altera nenhum dado.
 *
 * Fase C ligará também os títulos a pagar/receber (financeiroTitulosStore) na
 * coluna "previsto" — a estrutura já soma entradaPrevista/saidaPrevista.
 */
import { useMemo, useState } from 'react'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useManejoFinanceiroStore } from '@/store/manejoFinanceiroStore'
import { FinanceiroFilterBar } from './FinanceiroFilterBar'
import { useFinanceiroTitulosStore } from '@/store/financeiroTitulosStore'
import {
  filterEntries, monthlySeries, monthLabel, monthsRange, spreadValue, addMonthsYM, fmtBRL, num, presetDePeriodo,
} from '../lib/financeiroCalc'
import type { FinanceiroFilter } from '../lib/financeiroCalc'

interface FluxoRow {
  month: string
  entradasReal: number
  saidasReal: number
  resultadoReal: number
  saldoReal: number       // acumulado só do realizado
  entradaPrev: number
  saidaPrev: number
  saldoProjetado: number  // acumulado realizado + previsto líquido
  isFuture: boolean
}

function currentYM(): string {
  // Fuso local (toISOString usaria UTC e poderia virar o mês na última noite).
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function FluxoCaixaPanel() {
  const entries = useFinanceiroStore((s) => s.entries)
  const contratos = useManejoFinanceiroStore((s) => s.contratos)
  /** 12 meses por padrão: com `{}` o saldo acumulado começava no primeiro registro que existisse. */
  const [filter, setFilter] = useState<FinanceiroFilter>(() => presetDePeriodo('12m'))
  const titulos = useFinanceiroTitulosStore((s) => s.titulos)

  // Realizado respeita período + obra (não filtra por categoria/tipo).
  const filtered = useMemo(
    () => filterEntries(entries, { from: filter.from, to: filter.to, obraId: filter.obraId }),
    [entries, filter.from, filter.to, filter.obraId],
  )
  const realized = useMemo(() => monthlySeries(filtered), [filtered])

  // A previsão vem das obrigações do Manejo Financeiro, que NÃO têm obra —
  // são da empresa toda. Por isso só faz sentido quando nenhuma obra está
  // filtrada; com obra selecionada, mostramos apenas o realizado daquela obra.
  const showForecast = !filter.obraId

  // Previsto: obrigações ativas com saldo restante, distribuídas do mês atual até
  // o fim do período de execução. Obrigação vencida (fim no passado) cai no mês
  // atual; obrigação sem fim definido é distribuída em 12 meses (evita pico).
  const nowYM = currentYM()
  const forecast = useMemo(() => {
    const saidaByMonth = new Map<string, number>()
    if (!showForecast) return saidaByMonth
    for (const c of contratos) {
      if (c.status !== 'ativo') continue
      const restante = num(c.valorRestante)
      if (restante <= 0) continue
      const startYM = c.inicioContrato.slice(0, 7)
      const fimYM = c.fimPeriodoExecucao ? c.fimPeriodoExecucao.slice(0, 7) : addMonthsYM(nowYM, 11)
      const from = startYM > nowYM ? startYM : nowYM       // não distribui no passado
      const to = fimYM >= from ? fimYM : from              // vencido → tudo no mês atual
      for (const { month, valor } of spreadValue(restante, from, to)) {
        saidaByMonth.set(month, (saidaByMonth.get(month) ?? 0) + valor)
      }
    }
    return saidaByMonth
  }, [contratos, nowYM, showForecast])

  /**
   * Os títulos em aberto, no mês do VENCIMENTO — e é aqui que a tela para de mentir.
   *
   * ⚠️ O texto no rodapé sempre prometeu: *"Títulos a pagar/receber entram nesta projeção"*. Não
   * entravam — `entradaPrev` era a constante `0` e o painel nem importava o store de títulos. O
   * saldo projetado ignorava toda a carteira de contas a pagar, que é justamente o que faz ele
   * significar alguma coisa.
   *
   * Título vencido e não baixado cai no mês corrente: a obrigação não desapareceu por estar
   * atrasada — ela é ainda mais urgente.
   */
  const titulosPrevistos = useMemo(() => {
    const pagar = new Map<string, number>()
    const receber = new Map<string, number>()
    if (!showForecast) return { pagar, receber }
    for (const t of titulos) {
      if (t.status !== 'pendente') continue
      const valor = num(t.valor)
      if (valor <= 0) continue
      const venc = (t.vencimento ?? '').slice(0, 7)
      if (!venc) continue
      const mes = venc < nowYM ? nowYM : venc
      const alvo = t.tipo === 'pagar' ? pagar : receber
      alvo.set(mes, (alvo.get(mes) ?? 0) + valor)
    }
    return { pagar, receber }
  }, [titulos, nowYM, showForecast])

  const rows: FluxoRow[] = useMemo(() => {
    const realMonths = realized.map((r) => r.month)
    const fcMonths = [...forecast.keys(), ...titulosPrevistos.pagar.keys(), ...titulosPrevistos.receber.keys()]
    const all = [...new Set([...realMonths, ...fcMonths])].sort()
    if (all.length === 0) return []
    // eixo contínuo do primeiro ao último mês
    const axis = monthsRange(all[0], all[all.length - 1])
    const realMap = new Map(realized.map((r) => [r.month, r]))
    let saldoReal = 0
    let saldoProj = 0
    return axis.map((month) => {
      const r = realMap.get(month)
      const entradasReal = r?.entradas ?? 0
      const saidasReal = r?.saidas ?? 0
      const resultadoReal = entradasReal - saidasReal
      saldoReal += resultadoReal
      const saidaPrev = (forecast.get(month) ?? 0) + (titulosPrevistos.pagar.get(month) ?? 0)
      const entradaPrev = titulosPrevistos.receber.get(month) ?? 0
      saldoProj += resultadoReal + (entradaPrev - saidaPrev)
      return {
        month, entradasReal, saidasReal, resultadoReal, saldoReal,
        entradaPrev, saidaPrev, saldoProjetado: saldoProj,
        isFuture: month > nowYM,
      }
    })
  }, [realized, forecast, titulosPrevistos, nowYM])

  const totalPrev = [...forecast.values()].reduce((s, v) => s + v, 0)

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <FinanceiroFilterBar value={filter} onChange={setFilter} showTipo={false} showCategoria={false} />
        <div className="mt-5 text-center py-16 text-[#6b6b6b] text-sm rounded-xl border border-dashed border-[#525252]">
          {entries.length === 0 && contratos.length === 0
            ? 'Adicione lançamentos (ou contratos no Manejo Financeiro) para ver o fluxo de caixa.'
            : 'Nenhum lançamento no filtro selecionado.'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 overflow-auto">
      <FinanceiroFilterBar value={filter} onChange={setFilter} showTipo={false} showCategoria={false} />

      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <span className="text-[#a3a3a3] uppercase tracking-wider font-semibold">Fluxo de Caixa</span>
        <span className="text-[#6b6b6b]">{showForecast ? 'Realizado × Previsto × Saldo projetado' : 'Realizado (obra selecionada)'}</span>
        {showForecast && totalPrev > 0 && <span className="text-amber-400">Previsto (contratos em aberto): {fmtBRL(totalPrev)}</span>}
        {!showForecast && <span className="text-amber-400/80">Previsão de obrigações é da empresa toda — selecione “Todas as obras” para o saldo projetado.</span>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className="w-full text-xs min-w-max">
          <thead>
            <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
              <th className="px-4 py-2 text-left">Mês</th>
              <th className="px-4 py-2 text-right">Entradas</th>
              <th className="px-4 py-2 text-right">Saídas</th>
              <th className="px-4 py-2 text-right">Resultado</th>
              <th className="px-4 py-2 text-right">Saldo {showForecast ? 'realizado' : 'acumulado'}</th>
              {showForecast && <th className="px-4 py-2 text-right text-emerald-400/70">Entrada prevista</th>}
              {showForecast && <th className="px-4 py-2 text-right text-amber-400/80">Saída prevista</th>}
              {showForecast && <th className="px-4 py-2 text-right">Saldo projetado</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f2937]">
            {rows.map((m) => (
              <tr key={m.month} className={`hover:bg-white/[0.02] ${m.isFuture ? 'opacity-90' : ''}`}>
                <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">
                  {monthLabel(m.month)}
                  {showForecast && m.isFuture && <span className="ml-1.5 text-[9px] text-amber-400/80 uppercase">prev</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-emerald-400 tabular-nums">{m.entradasReal ? fmtBRL(m.entradasReal) : '—'}</td>
                <td className="px-4 py-2.5 text-right text-red-400 tabular-nums">{m.saidasReal ? fmtBRL(m.saidasReal) : '—'}</td>
                <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${m.resultadoReal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.entradasReal || m.saidasReal ? fmtBRL(m.resultadoReal) : '—'}
                </td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${m.saldoReal >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{fmtBRL(m.saldoReal)}</td>
                {showForecast && <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400/80">{m.entradaPrev ? fmtBRL(m.entradaPrev) : '—'}</td>}
                {showForecast && <td className="px-4 py-2.5 text-right tabular-nums text-amber-400/90">{m.saidaPrev ? fmtBRL(m.saidaPrev) : '—'}</td>}
                {showForecast && <td className={`px-4 py-2.5 text-right font-bold tabular-nums ${m.saldoProjetado >= 0 ? 'text-cyan-300' : 'text-red-400'}`}>{fmtBRL(m.saldoProjetado)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForecast && (
        <p className="text-[10px] text-[#6b6b6b]">
          Saldo projetado = saldo realizado acumulado + entradas previstas − saídas previstas.
          As saídas juntam as <strong>obrigações em aberto</strong> do Manejo Financeiro (distribuídas do mês atual
          até o fim do período de execução; sem fim definido, espalhadas em 12 meses) e os <strong>títulos a pagar</strong>
          ainda sem baixa, no mês do vencimento. As entradas são os <strong>títulos a receber</strong> em aberto.
          Título vencido e não baixado entra no mês corrente — atrasado não quer dizer que sumiu.
        </p>
      )}
    </div>
  )
}
