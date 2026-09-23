import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore, getCertExpiringSoon } from '@/store/maoDeObraStore'
import { useObraScopedLabor } from '../hooks/useObraScopedLabor'
import { computeRup, resolveRupTarget } from '../utils/produtividade'
import { dataLocalISO, hojeLocalISO } from '@/lib/utils'
import { ClipboardCheck } from 'lucide-react'
import { quinzenaAtual, deslocarQuinzena, avaliacaoNaQuinzena } from '../utils/quinzena'
import { calcShiftHours } from '../utils/cltEngine'
import { FaixaDeCusto } from './FaixaDeCusto'
import { OQueE } from '@/components/shared/OQueE'
import { usePontoStore } from '@/store/pontoStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { jornadasDoPeriodo } from '@/features/ponto/jornada'
import { montarIndicadoresDeMaoDeObra, type TomDoIndicador } from '../utils/painel360'

const RUP_SEM_COLOR = { verde: '#22c55e', amarelo: '#f59e0b', vermelho: '#ef4444' } as const

function RupMiniCard({ period }: { period: 'última semana' | 'último mês' | 'este mês' }) {
  const { timecards, rdoExecInPeriod } = useObraScopedLabor()
  const settings = useMaoDeObraStore((s) => s.cltSettings)
  const target = resolveRupTarget(settings)
  const { start, end } = useMemo(() => {
    const e = hojeLocalISO()
    const d = new Date()
    if (period === 'última semana') d.setDate(d.getDate() - 6)
    else if (period === 'este mês') d.setDate(1)
    else d.setDate(d.getDate() - 29)
    return { start: dataLocalISO(d), end: e }
  }, [period])
  const rdo = useMemo(() => rdoExecInPeriod(start, end), [rdoExecInPeriod, start, end])
  const rup = useMemo(() => computeRup(timecards.filter((t) => t.date >= start && t.date <= end), { extraHH: rdo.hh, extraM2: rdo.m2 }, target), [timecards, start, end, rdo, target])
  const color = rup.semaforo ? RUP_SEM_COLOR[rup.semaforo] : '#9a9a9a'
  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div>
        <p className="text-[#adadad] text-xs">Produtividade RUP (homem-hora/m²) · meta TCPO ≤ {target}</p>
        <p className="text-xl font-bold leading-tight" style={{ color }}>{rup.rup != null ? `${rup.rup.toFixed(2)} HH/m²` : '— sem apontamentos/RDO em m²'}</p>
      </div>
      <div className="text-right text-[11px] text-[#c9c9c9]">
        <div>{rup.totalHH.toFixed(0)} HH · {Math.round(rup.totalM2).toLocaleString('pt-BR')} m²</div>
        {rup.rup != null && <div style={{ color }}>{rup.rup <= target ? 'No alvo' : rup.rup <= target * 1.15 ? 'Atenção' : 'Fora do alvo'}</div>}
      </div>
    </div>
  )
}

// ─── Bar Chart — Planned HH vs Actual HH per day (last 7 days) ───────────────

/**
 * HH planejado × realizado, por dia.
 *
 * ⚠️ **O planejado era inventado.** A linha era literalmente
 * `plannedPerDay = Math.round(maxActual * 1.15)   // mock`, e a barra azul tinha **sempre altura
 * cheia** — ou seja, o gráfico mostrava o realizado contra ele mesmo mais 15%, e chamava isso de
 * meta. Agora o planejado é a soma das horas dos TURNOS lançados no dia (`calcShiftHours`), e o dia
 * sem escala lançada **não desenha barra de planejado**: diz que não há escala.
 *
 * ⚠️ O título dizia "(7 dias)" fixo mesmo com o período em 30.
 */
function HHBarChart({ timecards, shifts, period }: {
  timecards: import('@/types').TimecardEntry[]
  shifts: import('@/types').Shift[]
  period: string
}) {
  const dias = useMemo(() => {
    const total = period === 'este mês' ? new Date().getDate() : period === 'última semana' ? 7 : 30
    const out: Array<{ label: string; realizado: number; planejado: number | null }> = []
    for (let i = total - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const iso = dataLocalISO(d)
      // ⚠️ Turno de folga/feriado/ausente não é planejado de trabalho. `type` diz o que o turno é;
      // `status` diz o que aconteceu com ele.
      const doDia = shifts.filter((sh) => sh.date === iso
        && sh.type !== 'day_off' && sh.type !== 'holiday'
        && sh.status !== 'absent')
      out.push({
        label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
        realizado: timecards.filter((tc) => tc.date === iso).reduce((sum, tc) => sum + tc.hoursWorked, 0),
        // `null` = ninguém lançou escala nesse dia. Diferente de zero.
        planejado: doDia.length > 0 ? doDia.reduce((sum, sh) => sum + calcShiftHours(sh), 0) : null,
      })
    }
    return out
  }, [timecards, shifts, period])

  const teto = Math.max(...dias.map((d) => Math.max(d.realizado, d.planejado ?? 0)), 1)
  const alturaDoGrafico = 120
  const semEscala = dias.every((d) => d.planejado == null)

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <p className="mb-1 text-sm font-semibold text-[#f5f5f5]">
        HH planejado × realizado ({period})
      </p>
      {semEscala && (
        <p className="mb-3 text-[11px] leading-4 text-[#a3a3a3]">
          Nenhum turno lançado no período — sem escala não há planejado, e inventar um número aqui
          seria comparar o realizado com ele mesmo. Lance a escala em <b>Escala e Postos</b>.
        </p>
      )}
      <div className="flex h-[120px] items-end gap-2">
        {dias.map((dia, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="relative flex w-full items-end justify-center gap-0.5" style={{ height: alturaDoGrafico }}>
              {dia.planejado != null && (
                <div
                  className="w-[45%] rounded-sm border border-[#3b82f6]/40 bg-[#3b82f6]/25"
                  style={{ height: Math.max(2, Math.round((dia.planejado / teto) * alturaDoGrafico)) }}
                  title={`Planejado: ${dia.planejado.toFixed(0)}h`}
                />
              )}
              <div
                className="w-[45%] rounded-sm"
                style={{
                  height: Math.max(2, Math.round((dia.realizado / teto) * alturaDoGrafico)),
                  backgroundColor: dia.planejado == null ? '#6b7280'
                    : dia.realizado >= dia.planejado * 0.85 ? '#22c55e' : '#f59e0b',
                }}
                title={`Realizado: ${dia.realizado.toFixed(0)}h`}
              />
            </div>
            <span className="w-full truncate text-center text-[11px] text-[#adadad]">{dia.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        <span className="flex items-center gap-1.5 text-xs text-[#adadad]">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#3b82f6]/40" /> Planejado (turnos lançados)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#adadad]">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#22c55e]" /> Realizado ≥ 85%
        </span>
        <span className="flex items-center gap-1.5 text-xs text-[#adadad]">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#f59e0b]" /> Realizado {'<'} 85%
        </span>
      </div>
    </div>
  )
}

/* ⚠️ `PhysicalProgressSummary` foi REMOVIDO em 23/09/2026.
   Ele lia `maoDeObraStore.progress`, e **nenhuma tela chama `addProgress`** — o campo nem está no
   `partialize`, então nascia vazio e sumia a cada F5. Era um cartão que nunca acendeu.
   E progresso físico não é indicador de mão de obra: o equivalente alimentado é a produção do RDO,
   que já entra pelo RUP e por `produtividadePorServico`. */

// ─── Cert Expiry Table ────────────────────────────────────────────────────────

function CertExpiryTable({ workers }: { workers: import('@/types').Worker[] }) {
  const expiring = getCertExpiringSoon(workers, 60)

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <p className="text-[#f5f5f5] text-sm font-semibold mb-3">
        Certificações a Vencer (60 dias)
        {expiring.length > 0 && (
          <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold bg-[#f59e0b]/20 text-[#fbbf24]">
            {expiring.length}
          </span>
        )}
      </p>
      {expiring.length === 0 ? (
        <p className="text-[#adadad] text-sm">Nenhuma certificação vencendo nos próximos 60 dias.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#525252]">
                <th className="text-left text-[#adadad] text-xs font-medium pb-2">Funcionário</th>
                <th className="text-left text-[#adadad] text-xs font-medium pb-2">Certificação</th>
                <th className="text-left text-[#adadad] text-xs font-medium pb-2">Vence em</th>
                <th className="text-left text-[#adadad] text-xs font-medium pb-2">Dias</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((item, i) => (
                <tr key={i} className="border-b border-[#3d3d3d] last:border-0">
                  <td className="py-2 text-[#f5f5f5] text-xs">{item.worker.name}</td>
                  <td className="py-2">
                    <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-[#525252] text-[#f5f5f5]">
                      {item.certType}
                    </span>
                  </td>
                  <td className="py-2 text-[#adadad] text-xs">
                    {new Date(item.expiryDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-2">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: item.daysLeft <= 15 ? '#ef4444' : item.daysLeft <= 30 ? '#f59e0b' : '#22c55e' }}
                    >
                      {item.daysLeft}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

// ─── New HR KPI cards ─────────────────────────────────────────────────────────

/**
 * Os indicadores 360 do módulo.
 *
 * ⚠️ Substituiu `HRKpiCards`, que tinha seis cartões e **três números errados**: "Certificações OK"
 * marcava 100% fixo para sempre (o corte da função era o próprio instante, a lista voltava vazia
 * por construção), "HE esta semana" somava turnos de escala em vez da coleção de horas extras que
 * a aba usa, e o "% presença" misturava pessoas com pessoas-dia.
 *
 * ⚠️ A conta mora em `utils/painel360.ts`, puro e testado. Aqui só há tela — é o que permite
 * afirmar, por teste, que nenhum indicador devolve `0` quando o certo é "não sei".
 */
function Indicadores360({ de, ate }: { de: string; ate: string }) {
  const dados = useMaoDeObraStore(useShallow((s) => ({
    workers: s.workers, absences: s.absences, shifts: s.shifts, timecards: s.timecards,
    assessments: s.assessments, horasExtras: s.horasExtras, workPosts: s.workPosts,
    cltSettings: s.cltSettings,
  })))
  const registros = usePontoStore(useShallow((s) => s.registros))
  const solicitacoes = usePontoStore(useShallow((s) => s.solicitacoes))
  const holidays = usePlanejamentoStore(useShallow((s) => s.holidays))
  // ⚠️ A jornada semanal decide o que é DIA ÚTIL no denominador da frequência — e ela mora no
  // Planejamento, não nas configurações CLT. É a mesma fonte que o Gestão 360 usa.
  const jornadaSemanal = usePlanejamentoStore((s) => s.scheduleConfig.workWeekMode)
  const setTab = useMaoDeObraStore((s) => s.setActiveTab)

  const feriados = useMemo(() => new Set((holidays ?? []).map((h) => h.date)), [holidays])
  const jornadas = useMemo(() => jornadasDoPeriodo(registros, de, ate), [registros, de, ate])
  // ⚠️ Doze meses, só para o crédito a vencer: a conta do art. 59 §5º é FIFO sobre competências
  // mensais, e calculá-la com o recorte da tela daria sempre zero.
  const jornadasDoAno = useMemo(() => {
    const d = new Date(`${ate}T00:00:00`)
    d.setFullYear(d.getFullYear() - 1)
    return jornadasDoPeriodo(registros, d.toISOString().slice(0, 10), ate)
  }, [registros, ate])

  const indicadores = useMemo(() => montarIndicadoresDeMaoDeObra({
    ...dados, jornadas, jornadasDoAno, solicitacoes, feriados,
    // A jornada semanal da empresa decide o que é dia útil no denominador da frequência.
    jornadaSemanal,
    de, ate, hoje: hojeLocalISO(),
  }), [dados, jornadas, jornadasDoAno, solicitacoes, feriados, jornadaSemanal, de, ate])

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {indicadores.map((ind) => (
        <button
          key={ind.id} type="button"
          onClick={() => { if (ind.destino) setTab(ind.destino as Parameters<typeof setTab>[0]) }}
          disabled={!ind.destino}
          className="rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-3 text-left transition-colors hover:border-[#f97316]/40 disabled:cursor-default"
        >
          <span className="mb-1 flex items-start gap-1.5">
            <span className="text-xs leading-4 text-[#adadad]">{ind.titulo}</span>
            <OQueE titulo={ind.titulo} explicacao={ind.explicacao} className="mt-0.5" />
          </span>
          <p className="text-xl font-bold leading-tight" style={{ color: COR_DO_TOM[ind.tom] }}>
            {ind.valor}
          </p>
          {ind.detalhe && <p className="mt-0.5 text-xs leading-4 text-[#adadad]">{ind.detalhe}</p>}
          {/* ⚠️ Sem base, o cartão DIZ o que falta. Um card cinza mudo ensina a pessoa a ignorá-lo —
              é a regra que o PainelIndicadores já impunha. */}
          {ind.tom === 'sem-dado' && ind.explicacao.oQueFalta && (
            <p className="mt-1 text-[10px] leading-4 text-[#8a8a8a]">{ind.explicacao.oQueFalta}</p>
          )}
        </button>
      ))}
    </div>
  )
}

/** `sem-dado` é cinza e NUNCA verde: verde afirma que está tudo certo, e o sistema não sabe. */
const COR_DO_TOM: Record<TomDoIndicador, string> = {
  ok: '#22c55e', atencao: '#f59e0b', grave: '#ef4444', 'sem-dado': '#9a9a9a',
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function DashboardPanel() {
  const { workers, timecards, shifts } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, timecards: s.timecards, shifts: s.shifts }))
  )

  const [period, setPeriod] = useState<'última semana' | 'último mês' | 'este mês'>('última semana')
  const [filterDept, setFilterDept] = useState('')

  const depts = useMemo(() => [...new Set(workers.map((w) => w.department).filter(Boolean))], [workers])

  /** O início do período escolhido na barra — os cartões acompanham o seletor, como o resto. */
  const inicioDoPeriodo = useMemo(() => {
    const d = new Date()
    if (period === 'este mês') d.setDate(1)
    else if (period === 'última semana') d.setDate(d.getDate() - 6)
    else d.setDate(d.getDate() - 29)
    return dataLocalISO(d)
  }, [period])

  const filteredWorkers = useMemo(
    () => filterDept ? workers.filter((w) => w.department === filterDept) : workers,
    [workers, filterDept]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg bg-[#3d3d3d] border border-[#525252]">
          {(['última semana', 'último mês', 'este mês'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                period === p ? 'bg-orange-600 text-white' : 'text-[#c9c9c9] hover:text-white'
              }`}>
              {p}
            </button>
          ))}
        </div>
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
          className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] focus:outline-none">
          <option value="">Todos os departamentos</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <Indicadores360 de={inicioDoPeriodo} ate={hojeLocalISO()} />

      {/* A faixa de dinheiro. Três abas inteiras do módulo — Custo Mensal, Folha de Pagamento e
          RH Financeiro — não tinham um pixel aqui; o Dashboard não mostrava um único valor em
          reais. Junto vêm as férias da semana (que o KPI de faltas exclui, então ninguém via) e as
          faltas DESCOBERTAS, que é o dado acionável. */}
      <FaixaDeCusto />

      <AvaliacoesDaQuinzena />
      <RupMiniCard period={period} />
      <HHBarChart timecards={timecards} shifts={shifts} period={period} />
      <CertExpiryTable workers={filteredWorkers} />
    </div>
  )
}


/**
 * Avaliações da quinzena — quem falta avaliar.
 *
 * As avaliações eram avulsas: o período era um par de datas digitado à mão, sem ciclo nenhum, e
 * nada dizia quem já tinha sido avaliado nem quando. Dava para criar cinco avaliações do mesmo
 * funcionário no mesmo intervalo e nenhuma para o resto da equipe, sem que a tela notasse.
 *
 * Quinzena de calendário (1–15 e 16 ao fim do mês) porque é assim que a folha e a medição deste
 * produto fecham; a definição e o porquê estão em `utils/quinzena.ts`.
 */
function AvaliacoesDaQuinzena() {
  const { workers, assessments } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, assessments: s.assessments })),
  )
  const [deslocamento, setDeslocamento] = useState(0)
  const q = useMemo(() => deslocarQuinzena(quinzenaAtual(), deslocamento), [deslocamento])

  const { avaliados, pendentes } = useMemo(() => {
    // Só quem está ativo entra na cobrança — desligado não se avalia.
    const ativos = workers.filter((w) => w.status !== 'inactive')
    const feitos = new Set(
      assessments.filter((a) => avaliacaoNaQuinzena(a, q)).map((a) => a.workerId),
    )
    return {
      avaliados: ativos.filter((w) => feitos.has(w.id)),
      pendentes: ativos.filter((w) => !feitos.has(w.id)),
    }
  }, [workers, assessments, q])

  const total = avaliados.length + pendentes.length
  const pct = total > 0 ? Math.round((avaliados.length / total) * 100) : 0

  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#c9c9c9]">
          <ClipboardCheck size={13} /> Avaliações da quinzena
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setDeslocamento((d) => d - 1)} title="Quinzena anterior"
            className="rounded border border-[#525252] px-1.5 py-0.5 text-[#c9c9c9] hover:text-white">‹</button>
          <span className="min-w-[11rem] text-center text-[11px] font-semibold text-[#e5e5e5]">{q.rotulo}</span>
          <button onClick={() => setDeslocamento((d) => d + 1)} disabled={deslocamento >= 0} title="Próxima quinzena"
            className="rounded border border-[#525252] px-1.5 py-0.5 text-[#c9c9c9] hover:text-white disabled:opacity-30">›</button>
        </div>
        <span className="text-[11px] text-[#adadad]">
          {q.inicio.slice(8)}/{q.mes.toString().padStart(2, '0')} a {q.fim.slice(8)}/{q.mes.toString().padStart(2, '0')} · {q.diasNaQuinzena} dias
        </span>
        <span className="ml-auto text-sm font-bold tabular-nums text-[#e5e5e5]">
          {avaliados.length}/{total}
          <span className="ml-1 text-[11px] font-normal text-[#adadad]">avaliados</span>
        </span>
      </div>

      {total === 0 ? (
        <p className="mt-2 text-[11px] text-[#adadad]">Nenhum funcionário ativo cadastrado.</p>
      ) : (
        <>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#2c2c2c]">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
          </div>
          {pendentes.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#adadad]">Faltam:</span>
              {pendentes.slice(0, 12).map((w) => (
                <span key={w.id} className="rounded border border-[#525252] bg-[#333333] px-1.5 py-0.5 text-[11px] text-[#d4d4d4]">
                  {w.name}
                </span>
              ))}
              {pendentes.length > 12 && (
                <span className="text-[11px] text-[#adadad]">e mais {pendentes.length - 12}</span>
              )}
            </div>
          ) : (
            <p className="mt-2.5 text-[11px] text-[#4ade80]">Todos os funcionários ativos avaliados nesta quinzena.</p>
          )}
        </>
      )}
    </div>
  )
}
