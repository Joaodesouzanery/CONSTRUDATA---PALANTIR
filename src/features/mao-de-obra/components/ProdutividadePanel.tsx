/**
 * ProdutividadePanel — RUP (homem-hora ÷ m²) por obra vs TCPO (0,45), tendência,
 * aderência de metragem (planejado × executado) e análise de fim de semana.
 * Escopo pela obra ativa via useObraScopedLabor. Meta TCPO configurável (CLTSettings).
 */
import { useMemo, useState } from 'react'
import { Gauge, TrendingUp, CalendarClock, Ruler, Clock, ArrowRight, AlertTriangle, Users } from 'lucide-react'
import { useMaoDeObraStore, type MaoDeObraTab } from '@/store/maoDeObraStore'
import { useActiveObra } from '@/hooks/useActiveObra'
import { useObraScopedLabor } from '../hooks/useObraScopedLabor'
import { dataLocalISO, hojeLocalISO } from '@/lib/utils'
import {
  computeRup, computeRupTrend, computeMetragemBalance, analyzeWeekend, summarizeEscala,
  computeRupPorWorker, type RupPorWorker,
  resolveRupTarget, rupSemaforo, type Semaforo,
} from '../utils/produtividade'

const SEM_COLOR: Record<Semaforo, string> = { verde: '#22c55e', amarelo: '#f59e0b', vermelho: '#ef4444' }
const SEM_LABEL: Record<Semaforo, string> = { verde: 'No alvo', amarelo: 'Atenção', vermelho: 'Fora do alvo' }
const SHIFT_LABEL: Record<string, string> = { regular: 'Regular', overtime: 'HE', night: 'Noturno', holiday: 'Feriado', day_off: 'DSR' }
const VERDICT: Record<string, { label: string; color: string }> = {
  vale: { label: 'Vale a pena', color: '#22c55e' },
  nao_vale: { label: 'Não vale', color: '#ef4444' },
  neutro: { label: 'Neutro', color: '#f59e0b' },
}

const card = 'bg-[#3d3d3d] border border-[#525252] rounded-xl p-4'
const brl = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function ProdutividadePanel({ onNavigate }: { onNavigate?: (tab: MaoDeObraTab) => void }) {
  const { activeSite, isAllObras } = useActiveObra()
  const { workers, timecards, shifts, planos, rdoExecInPeriod, unassignedWorkerCount } = useObraScopedLabor()
  const settings = useMaoDeObraStore((s) => s.cltSettings)
  const updateCLTSettings = useMaoDeObraStore((s) => s.updateCLTSettings)
  const target = resolveRupTarget(settings)

  const [period, setPeriod] = useState<'última semana' | 'último mês' | 'este mês'>('último mês')
  const { periodStart, periodEnd } = useMemo(() => {
    const end = hojeLocalISO()
    const d = new Date()
    if (period === 'última semana') d.setDate(d.getDate() - 6)
    else if (period === 'este mês') d.setDate(1)
    else d.setDate(d.getDate() - 29)
    return { periodStart: dataLocalISO(d), periodEnd: end }
  }, [period])

  const periodTc = useMemo(() => timecards.filter((tc) => tc.date >= periodStart && tc.date <= periodEnd), [timecards, periodStart, periodEnd])
  const rdoExec = useMemo(() => rdoExecInPeriod(periodStart, periodEnd), [rdoExecInPeriod, periodStart, periodEnd])
  const rup = useMemo(() => computeRup(periodTc, { extraHH: rdoExec.hh, extraM2: rdoExec.m2 }, target), [periodTc, rdoExec, target])
  const tcM2 = useMemo(() => periodTc.filter((tc) => tc.unit === 'm²').reduce((s, tc) => s + (tc.reportedQty || 0), 0), [periodTc])
  // Por funcionário: mesma fórmula e mesmo filtro do agregado, para as duas visões fecharem.
  const porWorker = useMemo(() => computeRupPorWorker(periodTc, target), [periodTc, target])
  const nomeDoWorker = useMemo(() => new Map(workers.map((w) => [w.id, w.name])), [workers])
  const executedM2 = rup.totalM2
  // Tendência: janela própria (6 semanas), com RDO por data de todo o histórico da obra.
  const trendRdo = useMemo(() => rdoExecInPeriod('0000-01-01', '9999-12-31').byDate, [rdoExecInPeriod])
  const metragem = useMemo(() => computeMetragemBalance(planos, executedM2, periodStart, periodEnd), [planos, executedM2, periodStart, periodEnd])
  const trend = useMemo(() => computeRupTrend(timecards, 'week', 6, target, trendRdo), [timecards, target, trendRdo])
  const weekend = useMemo(() => analyzeWeekend({ shifts, workers, timecards, settings, periodStart, periodEnd, rupTarget: target, rdoByDate: rdoExec.byDate }), [shifts, workers, timecards, settings, periodStart, periodEnd, target, rdoExec])
  const escala = useMemo(() => summarizeEscala(shifts, periodStart, periodEnd), [shifts, periodStart, periodEnd])

  const sem = rup.semaforo
  const rupColor = sem ? SEM_COLOR[sem] : '#9a9a9a'
  const produtividade = rup.totalHH > 0 ? executedM2 / rup.totalHH : null
  const trendMax = Math.max(target, ...trend.map((p) => p.rup ?? 0)) || target

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]/15"><Gauge size={18} className="text-[#f97316]" /></div>
          <div>
            <h2 className="text-[#f5f5f5] text-base font-semibold leading-none">Produtividade (RUP)</h2>
            <p className="text-[#6b6b6b] text-xs mt-0.5">{isAllObras ? 'Todas as obras' : (activeSite?.name ?? 'Obra')} · homem-hora por m² vs TCPO</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-[#2d2d2d] border border-[#525252] rounded-lg px-2 py-1">
            <label className="text-[10px] uppercase tracking-wider text-[#9a9a9a]">Meta TCPO (h/m²)</label>
            <input className="w-16 bg-transparent text-sm text-[#f5f5f5] outline-none text-right" defaultValue={target} key={`tcpo-${target}`}
              onBlur={(e) => { const v = Number(String(e.target.value).replace(',', '.')); updateCLTSettings({ rupTargetM2PerHH: v > 0 ? v : 0.45 }) }} />
          </div>
          <div className="flex bg-[#2d2d2d] border border-[#525252] rounded-lg p-0.5">
            {(['última semana', 'último mês', 'este mês'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${period === p ? 'bg-[#f97316] text-white' : 'text-[#9a9a9a] hover:text-[#f5f5f5]'}`}>{p}</button>
            ))}
          </div>
        </div>
      </div>

      {isAllObras && unassignedWorkerCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
          <AlertTriangle size={13} /> {unassignedWorkerCount} funcionário(s) sem obra vinculada — selecione uma obra para o RUP por obra, ou vincule-os na aba Funcionários.
        </div>
      )}

      <ProdutividadePorFuncionario linhas={porWorker} nomes={nomeDoWorker} target={target} extraHH={rdoExec.hh} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={card}>
          <div className="flex items-center gap-2 text-[#9a9a9a] text-xs"><Gauge size={13} /> RUP atual</div>
          <div className="mt-1 text-2xl font-bold" style={{ color: rupColor }}>{rup.rup != null ? rup.rup.toFixed(2) : '—'}</div>
          <div className="text-[10px] text-[#7a7a7a]">HH/m² · meta ≤ {target}</div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-[#9a9a9a] text-xs">Situação vs TCPO</div>
          {sem ? (
            <div className="mt-1 inline-flex items-center gap-2 px-2 py-1 rounded" style={{ backgroundColor: `${SEM_COLOR[sem]}20`, color: SEM_COLOR[sem] }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SEM_COLOR[sem] }} /> <span className="text-sm font-semibold">{SEM_LABEL[sem]}</span>
            </div>
          ) : <div className="mt-1 text-sm text-[#7a7a7a]">Sem apontamentos em m²</div>}
          <div className="text-[10px] text-[#7a7a7a] mt-1">{rup.sampleSize} apontamento(s)</div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-[#9a9a9a] text-xs"><Clock size={13} /> Homem-hora</div>
          <div className="mt-1 text-2xl font-bold text-[#f5f5f5]">{rup.totalHH.toFixed(0)}<span className="text-sm font-normal text-[#9a9a9a]"> h</span></div>
          <div className="text-[10px] text-[#7a7a7a]">Produtividade: {produtividade != null ? `${produtividade.toFixed(2)} m²/HH` : '—'}</div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-[#9a9a9a] text-xs"><Ruler size={13} /> Metragem</div>
          <div className="mt-1 text-2xl font-bold text-[#f5f5f5]">{Math.round(executedM2).toLocaleString('pt-BR')}<span className="text-sm font-normal text-[#9a9a9a]"> m²</span></div>
          <div className="text-[10px] text-[#7a7a7a]">Apontam.: {Math.round(tcM2).toLocaleString('pt-BR')} · RDO: {Math.round(rdoExec.m2).toLocaleString('pt-BR')}</div>
        </div>
      </div>

      {/* Trend + Metragem */}
      <div className="grid lg:grid-cols-3 gap-3">
        <div className={`${card} lg:col-span-2`}>
          <div className="flex items-center gap-2 text-[#f5f5f5] text-sm font-semibold mb-3"><TrendingUp size={15} className="text-[#f97316]" /> Tendência do RUP (6 semanas)</div>
          <div className="flex items-end gap-2 h-32">
            {trend.map((p, i) => {
              const h = p.rup != null ? Math.max(4, (p.rup / trendMax) * 100) : 0
              const c = p.rup != null ? SEM_COLOR[rupSemaforo(p.rup, target) ?? 'vermelho'] : '#525252'
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                  <span className="text-[9px] text-[#9a9a9a]">{p.rup != null ? p.rup.toFixed(2) : '—'}</span>
                  <div className="w-full rounded-t" style={{ height: `${h}%`, backgroundColor: c, minHeight: p.rup != null ? 4 : 0 }} title={`${p.hh.toFixed(0)} HH · ${p.m2.toFixed(0)} m²`} />
                  <span className="text-[9px] text-[#7a7a7a]">{p.label}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-2 text-[10px] text-[#7a7a7a] flex items-center gap-1.5"><span className="inline-block w-3 h-[2px]" style={{ backgroundColor: '#22c55e' }} /> meta TCPO ≤ {target} HH/m² (barras menores = melhor)</div>
        </div>
        <div className={card}>
          <div className="flex items-center gap-2 text-[#f5f5f5] text-sm font-semibold mb-2"><Ruler size={15} className="text-[#f97316]" /> Planejado × Executado</div>
          <div className="flex justify-between text-xs text-[#9a9a9a] mb-1">
            <span>{Math.round(metragem.executedM2).toLocaleString('pt-BR')} de {Math.round(metragem.plannedM2).toLocaleString('pt-BR')} m²</span>
            <span>{metragem.pctExecuted.toFixed(0)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-[#2d2d2d] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, metragem.pctExecuted)}%`, background: metragem.aheadBehind === 'behind' ? '#ef4444' : metragem.aheadBehind === 'ahead' ? '#22c55e' : '#f97316' }} />
          </div>
          <div className="mt-2 text-[11px] text-[#9a9a9a]">
            {metragem.plannedM2 === 0 ? 'Sem plano de execução no período para comparar.' : metragem.aheadBehind === 'behind' ? 'Abaixo do planejado no período.' : metragem.aheadBehind === 'ahead' ? 'No/acima do planejado.' : 'Dentro do esperado.'}
          </div>
          <p className="mt-1 text-[10px] text-[#6b6b6b]">Planejado = Σ áreas dos planos que cobrem o período.</p>
        </div>
      </div>

      {/* Fim de semana */}
      <div className={card}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-[#f5f5f5] text-sm font-semibold"><CalendarClock size={15} className="text-[#f97316]" /> Vale a pena sábado / domingo?</div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold" style={{ backgroundColor: `${VERDICT[weekend.verdict].color}20`, color: VERDICT[weekend.verdict].color }}>
            {VERDICT[weekend.verdict].label}
          </span>
        </div>
        <p className="text-sm text-[#c9c9c9] mb-3">{weekend.reason}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <We label="Custo do FDS" value={brl(weekend.weekendLaborCost)} />
          <We label="m² no FDS" value={`${Math.round(weekend.weekendM2).toLocaleString('pt-BR')} m²`} />
          <We label="R$/m² FDS vs útil" value={`${weekend.costPerM2Weekend != null ? brl(weekend.costPerM2Weekend) : '—'} / ${weekend.costPerM2Weekday != null ? brl(weekend.costPerM2Weekday) : '—'}`} />
          <We label="Dias ganhos no prazo" value={weekend.scheduleDaysSaved > 0 ? `~${weekend.scheduleDaysSaved.toFixed(1)}` : '—'} />
        </div>
        <p className="mt-2 text-[10px] text-[#6b6b6b]">Sábado com prêmio de HE ({settings.overtimeRate}%); domingo/feriado com 100%.</p>
      </div>

      {/* Escala */}
      <div className={card}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-[#f5f5f5] text-sm font-semibold">Como estão escalados?</div>
          {onNavigate && (
            <button onClick={() => onNavigate('escala')} className="flex items-center gap-1 text-xs text-[#f97316] hover:text-[#ea580c]">Ver calendário completo <ArrowRight size={13} /></button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {Object.entries(escala.byType).length === 0 ? <span className="text-xs text-[#9a9a9a]">Sem turnos no período.</span> :
            Object.entries(escala.byType).map(([t, n]) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-[#2d2d2d] border border-[#484848] text-xs text-[#e5e5e5]">{SHIFT_LABEL[t] ?? t}: <strong>{n}</strong></span>
            ))}
        </div>
        <div className="text-xs text-[#9a9a9a]">
          {escala.total} turno(s) no período · {escala.weekendShifts} em fim de semana ({escala.weekendHHShare.toFixed(0)}% das horas) · {workers.filter((w) => w.status === 'active').length} funcionário(s) ativo(s){isAllObras ? '' : ' nesta obra'}
        </div>
      </div>
    </div>
  )
}

function We({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#2d2d2d] border border-[#484848] rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-[#9a9a9a]">{label}</div>
      <div className="text-sm font-bold text-[#f5f5f5] mt-0.5">{value}</div>
    </div>
  )
}

/**
 * Produtividade por funcionário.
 *
 * A visão agregada responde "a obra está a 0,42 HH/m²". Esta responde QUEM. São perguntas
 * diferentes, e até aqui o módulo só sabia responder a primeira — nenhum cálculo quebrava por
 * pessoa, embora o dado bruto sempre estivesse no apontamento.
 *
 * Duas honestidades na tela, porque sem elas a tabela induz conclusão errada:
 *  - os m² lançados pelo RDO Compizzo NÃO entram: o RDO registra o total do dia sem dizer quem
 *    fez o quê, então não há a quem atribuir. O total que fica de fora é mostrado;
 *  - amostra pequena não sustenta comparação, e a coluna de apontamentos diz isso em vez de
 *    deixar o leitor supor.
 */
function ProdutividadePorFuncionario({
  linhas, nomes, target, extraHH,
}: {
  linhas: RupPorWorker[]
  nomes: Map<string, string>
  target: number
  extraHH: number
}) {
  const card = 'bg-[#3d3d3d] border border-[#525252] rounded-xl p-4'
  if (linhas.length === 0) {
    return (
      <div className={card}>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#9a9a9a]"><Users size={13} /> Produtividade por funcionário</div>
        <p className="mt-2 text-[11px] text-[#7a7a7a]">
          Nenhum apontamento em m² no período. A produtividade por pessoa vem do apontamento
          nominal — o m² lançado pelo RDO não diz quem executou.
        </p>
      </div>
    )
  }
  const cor = (s: RupPorWorker['semaforo']) =>
    s === 'verde' ? '#4ade80' : s === 'amarelo' ? '#fbbf24' : s === 'vermelho' ? '#f87171' : '#7a7a7a'

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#9a9a9a]"><Users size={13} /> Produtividade por funcionário</div>
        <span className="text-[10px] text-[#7a7a7a]">HH/m² · meta ≤ {target} · menor é melhor</span>
        {extraHH > 0 && (
          <span className="ml-auto text-[10px] text-[#7a7a7a]">
            {extraHH.toFixed(0)} HH vindos de RDO ficam fora (sem atribuição por pessoa)
          </span>
        )}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-[#7a7a7a]">
              <th className="pb-1.5 text-left font-semibold">Funcionário</th>
              <th className="pb-1.5 text-right font-semibold">HH</th>
              <th className="pb-1.5 text-right font-semibold">m²</th>
              <th className="pb-1.5 text-right font-semibold">RUP</th>
              <th className="pb-1.5 text-right font-semibold">Apont.</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.workerId} className="border-t border-[#525252]/50">
                <td className="py-1.5 text-[#e5e5e5]">{nomes.get(l.workerId) ?? 'Funcionário removido'}</td>
                <td className="py-1.5 text-right tabular-nums text-[#a3a3a3]">{l.hh.toFixed(1)}</td>
                <td className="py-1.5 text-right tabular-nums text-[#a3a3a3]">{l.m2.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                <td className="py-1.5 text-right font-bold tabular-nums" style={{ color: cor(l.semaforo) }}>
                  {l.rup != null ? l.rup.toFixed(2) : '—'}
                </td>
                <td className="py-1.5 text-right tabular-nums text-[#7a7a7a]">
                  {l.apontamentos}
                  {l.apontamentos < 3 && <span className="ml-1 text-[9px] text-[#7a7a7a]">amostra baixa</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
