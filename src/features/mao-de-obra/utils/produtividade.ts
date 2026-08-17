/**
 * produtividade — RUP (Razão Unitária de Produção = homem-hora ÷ m²), comparação
 * com o TCPO (referência de mercado, ideal 0,45 HH/m²), tendência, aderência de
 * metragem (planejado × executado) e análise de fim de semana ("vale a pena sábado?").
 * Funções puras; o chamador entrega as fatias já filtradas por obra/período.
 */
import type { Shift, TimecardEntry, Worker, CLTSettings, PlanoExecucao } from '@/types'
import { calcShiftHours } from './cltEngine'
import { dataLocalISO } from '@/lib/utils'

/** RUP referência de mercado (TCPO) para piso/pintura industrial — menor é melhor. */
export const TCPO_RUP_TARGET_DEFAULT = 0.45
/** Banda amarela: até +15% acima da meta ainda é "aceitável". */
export const RUP_YELLOW_TOLERANCE = 0.15

export type Semaforo = 'verde' | 'amarelo' | 'vermelho'

const brl = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dow = (iso: string) => new Date(`${iso}T00:00:00`).getDay()  // 0=Dom … 6=Sáb
const isWeekendIso = (iso: string) => { const g = dow(iso); return g === 0 || g === 6 }

function mondayOf(d: Date): Date {
  const x = new Date(d)
  const day = x.getDay()
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  x.setHours(0, 0, 0, 0)
  return x
}
const ymd = (d: Date) => dataLocalISO(d)
const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

/** Resolve a meta TCPO (campo opcional em CLTSettings, default 0,45). */
export function resolveRupTarget(settings?: Pick<CLTSettings, 'rupTargetM2PerHH'> | null): number {
  const t = settings?.rupTargetM2PerHH
  return t && t > 0 ? t : TCPO_RUP_TARGET_DEFAULT
}

/** Semáforo do RUP vs meta (menor é melhor). null quando não há dados. */
export function rupSemaforo(rup: number | null, target = TCPO_RUP_TARGET_DEFAULT, tol = RUP_YELLOW_TOLERANCE): Semaforo | null {
  if (rup == null || !(rup > 0)) return null
  if (rup <= target) return 'verde'
  if (rup <= target * (1 + tol)) return 'amarelo'
  return 'vermelho'
}

export interface RupResult {
  totalHH: number
  totalM2: number
  rup: number | null   // null quando não há m² apontado (evita ÷0 e "verde falso")
  semaforo: Semaforo | null
  sampleSize: number   // nº de apontamentos em m² (sinal de qualidade do dado)
}

/**
 * RUP = ΣHH ÷ Σm². Fonte = apontamentos (unit === 'm²') + extras do RDO Compizzo
 * (horas + m²), passados via `opts`. Aditivo — na prática os fluxos são exclusivos
 * por cliente (Compizzo mede por RDO; demais por apontamento), sem dupla contagem.
 */
export function computeRup(
  timecards: TimecardEntry[],
  opts: { extraHH?: number; extraM2?: number } = {},
  target = TCPO_RUP_TARGET_DEFAULT,
): RupResult {
  const relevant = timecards.filter((tc) => tc.unit === 'm²' && tc.reportedQty > 0)
  const totalHH = relevant.reduce((s, tc) => s + (tc.hoursWorked || 0), 0) + (opts.extraHH || 0)
  const totalM2 = relevant.reduce((s, tc) => s + (tc.reportedQty || 0), 0) + (opts.extraM2 || 0)
  const rup = totalM2 > 0 ? totalHH / totalM2 : null
  return { totalHH, totalM2, rup, semaforo: rupSemaforo(rup, target), sampleSize: relevant.length }
}

export interface RupTrendPoint { label: string; startISO: string; rup: number | null; hh: number; m2: number }

/** Tendência do RUP nos últimos `buckets` períodos (dia ou semana), terminando hoje. */
export function computeRupTrend(
  timecards: TimecardEntry[], bucket: 'day' | 'week', buckets: number, target = TCPO_RUP_TARGET_DEFAULT,
  rdoByDate?: Map<string, { m2: number; hh: number }>,
): RupTrendPoint[] {
  const out: RupTrendPoint[] = []
  const today = new Date()
  for (let i = buckets - 1; i >= 0; i--) {
    let start: Date, end: Date, label: string
    if (bucket === 'day') {
      const d = new Date(today); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
      start = d; end = d; label = dm(d)
    } else {
      const ref = new Date(today); ref.setDate(ref.getDate() - i * 7)
      start = mondayOf(ref); end = new Date(start); end.setDate(end.getDate() + 6)
      label = dm(start)
    }
    const sISO = ymd(start), eISO = ymd(end)
    const inRange = timecards.filter((tc) => tc.date >= sISO && tc.date <= eISO)
    const extra = rdoByDate ? [...rdoByDate.entries()].filter(([d]) => d >= sISO && d <= eISO).reduce((a, [, v]) => ({ hh: a.hh + v.hh, m2: a.m2 + v.m2 }), { hh: 0, m2: 0 }) : { hh: 0, m2: 0 }
    const r = computeRup(inRange, { extraHH: extra.hh, extraM2: extra.m2 }, target)
    out.push({ label, startISO: sISO, rup: r.rup, hh: r.totalHH, m2: r.totalM2 })
  }
  return out
}

export interface MetragemBalance {
  plannedM2: number
  executedM2: number
  pctExecuted: number
  aheadBehind: 'ahead' | 'behind' | 'on_track'
}

/** Aderência de metragem: Σ áreas planejadas (planos que sobrepõem o período) × executado. */
export function computeMetragemBalance(
  planos: PlanoExecucao[], executedM2: number, periodStart: string, periodEnd: string,
): MetragemBalance {
  const overlapping = planos.filter((p) =>
    (!p.periodoInicio || !p.periodoFim) || (p.periodoInicio <= periodEnd && p.periodoFim >= periodStart))
  const plannedM2 = overlapping.reduce((s, p) => s + (p.areaM2 || 0), 0)
  const pct = plannedM2 > 0 ? (executedM2 / plannedM2) * 100 : 0
  const aheadBehind = plannedM2 === 0 ? 'on_track' : pct >= 100 ? 'ahead' : pct >= 80 ? 'on_track' : 'behind'
  return { plannedM2, executedM2, pctExecuted: pct, aheadBehind }
}

export interface WeekendAnalysis {
  weekendHH: number
  weekendHeadcountDays: number
  weekendLaborCost: number
  weekendM2: number
  weekdayM2PerDay: number
  weekendRup: number | null
  costPerM2Weekend: number | null
  costPerM2Weekday: number | null
  scheduleDaysSaved: number
  verdict: 'vale' | 'nao_vale' | 'neutro'
  reason: string
}

/**
 * "Vale a pena sábado/domingo?" — compara o custo do fim de semana
 * (sábado com prêmio de HE; domingo/feriado 100%) com a produção marginal e o
 * ganho de prazo (m² do FDS ÷ produção média em dia útil).
 */
export function analyzeWeekend(args: {
  shifts: Shift[]; workers: Worker[]; timecards: TimecardEntry[]; settings: CLTSettings;
  periodStart: string; periodEnd: string; rupTarget?: number;
  rdoByDate?: Map<string, { m2: number; hh: number }>;
}): WeekendAnalysis {
  const { shifts, workers, timecards, settings, periodStart, periodEnd, rdoByDate } = args
  const rupTarget = args.rupTarget ?? resolveRupTarget(settings)
  const rateOf = new Map(workers.map((w) => [w.id, w.hourlyRate || 0]))
  const inPeriod = (d: string) => d >= periodStart && d <= periodEnd

  let weekendHH = 0, weekendCost = 0, weekendHeadcountDays = 0
  for (const s of shifts) {
    if (!inPeriod(s.date)) continue
    const g = dow(s.date)
    const isSat = g === 6, isSun = g === 0
    if (!isSat && !isSun && s.type !== 'holiday') continue
    const hours = calcShiftHours(s)
    if (hours <= 0) continue
    const rate = rateOf.get(s.workerId) ?? 0
    const premium = isSun || s.type === 'holiday' ? 2.0 : 1 + settings.overtimeRate / 100
    weekendHH += hours
    weekendCost += hours * rate * premium
    weekendHeadcountDays += 1
  }

  const weekendTc = timecards.filter((tc) => inPeriod(tc.date) && tc.unit === 'm²' && isWeekendIso(tc.date))
  let weekendM2 = weekendTc.reduce((s, tc) => s + (tc.reportedQty || 0), 0)
  // RDO Compizzo: soma m² + HH dos dias de fim de semana no período.
  if (rdoByDate) {
    for (const [d, v] of rdoByDate) {
      if (inPeriod(d) && isWeekendIso(d)) { weekendM2 += v.m2; weekendHH += v.hh }
    }
  }

  const weekdayTc = timecards.filter((tc) => inPeriod(tc.date) && tc.unit === 'm²' && !isWeekendIso(tc.date))
  let weekdayM2 = weekdayTc.reduce((s, tc) => s + (tc.reportedQty || 0), 0)
  const weekdayDates = new Set(weekdayTc.map((tc) => tc.date))
  if (rdoByDate) {
    for (const [d, v] of rdoByDate) {
      if (inPeriod(d) && !isWeekendIso(d)) { weekdayM2 += v.m2; if (v.m2 > 0) weekdayDates.add(d) }
    }
  }
  const weekdayM2PerDay = weekdayDates.size > 0 ? weekdayM2 / weekdayDates.size : 0
  const weekdayCost = weekdayTc.reduce((s, tc) => s + (rateOf.get(tc.workerId) ?? 0) * (tc.hoursWorked || 0), 0)

  const weekendRup = weekendM2 > 0 && weekendHH > 0 ? weekendHH / weekendM2 : null
  // Custo só é conhecido quando há turnos (shifts) com R$/hora. Sem turnos → null (não R$0).
  const costPerM2Weekend = weekendM2 > 0 && weekendCost > 0 ? weekendCost / weekendM2 : null
  const costPerM2Weekday = weekdayM2 > 0 && weekdayCost > 0 ? weekdayCost / weekdayM2 : null
  const scheduleDaysSaved = weekdayM2PerDay > 0 ? weekendM2 / weekdayM2PerDay : 0
  const hasCost = costPerM2Weekend != null && costPerM2Weekday != null

  let verdict: WeekendAnalysis['verdict'] = 'neutro'
  let reason = ''
  if (weekendHH === 0 && weekendM2 === 0) {
    reason = 'Nenhum trabalho em fim de semana no período.'
  } else if (weekendM2 === 0) {
    verdict = 'nao_vale'
    reason = weekendCost > 0
      ? `Pagou ~R$ ${brl(weekendCost)} em fim de semana sem produção de m² registrada.`
      : 'Houve horas em fim de semana sem produção de m² registrada.'
  } else {
    const custoOk = !hasCost || costPerM2Weekend! <= costPerM2Weekday! * 1.6
    const rupOk = weekendRup != null && weekendRup <= rupTarget * 1.5
    const ganho = scheduleDaysSaved > 0 ? `ganho de ~${scheduleDaysSaved.toFixed(1)} dia(s) no prazo` : 'sem base de dia útil p/ estimar prazo'
    if (custoOk && rupOk) {
      verdict = 'vale'
      reason = hasCost
        ? `R$ ${brl(costPerM2Weekend!)}/m² no fim de semana vs R$ ${brl(costPerM2Weekday!)}/m² em dia útil; ${ganho}.`
        : `Produtividade do fim de semana ok (${weekendRup != null ? `${weekendRup.toFixed(2)} HH/m²` : '—'}); ${ganho}. Custo indisponível (sem turnos lançados).`
    } else if (!rupOk || (hasCost && costPerM2Weekend! > costPerM2Weekday! * 2)) {
      verdict = 'nao_vale'
      reason = `Custo/produtividade do fim de semana elevado${costPerM2Weekend != null ? ` (R$ ${brl(costPerM2Weekend)}/m²)` : weekendRup != null ? ` (${weekendRup.toFixed(2)} HH/m²)` : ''} — melhor concentrar em dias úteis.`
    } else {
      verdict = 'neutro'
      reason = `Custo aceitável, mas ${ganho}.`
    }
  }
  return { weekendHH, weekendHeadcountDays, weekendLaborCost: weekendCost, weekendM2, weekdayM2PerDay, weekendRup, costPerM2Weekend, costPerM2Weekday, scheduleDaysSaved, verdict, reason }
}

export interface EscalaSummary {
  total: number
  byType: Record<string, number>
  weekendShifts: number
  weekendHHShare: number   // % das HH que caem no fim de semana
}

/** Resumo de escala no período: turnos por tipo + carga de fim de semana. */
export function summarizeEscala(shifts: Shift[], periodStart: string, periodEnd: string): EscalaSummary {
  const inP = shifts.filter((s) => s.date >= periodStart && s.date <= periodEnd)
  const byType: Record<string, number> = {}
  let weekendShifts = 0, weekendHH = 0, totalHH = 0
  for (const s of inP) {
    byType[s.type] = (byType[s.type] ?? 0) + 1
    const h = calcShiftHours(s)
    totalHH += h
    if (isWeekendIso(s.date)) { weekendShifts++; weekendHH += h }
  }
  return { total: inP.length, byType, weekendShifts, weekendHHShare: totalHH > 0 ? (weekendHH / totalHH) * 100 : 0 }
}
