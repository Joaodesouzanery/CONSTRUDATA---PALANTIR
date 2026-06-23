/**
 * assessmentEngine.ts — cálculo puro da Ficha de Avaliação de Funcionário.
 *
 * Nota Final = média dos 8 critérios (0–10) penalizada por faltas e atrasos,
 * com teto de penalização. Classificação por faixa da nota final.
 * Funções puras (sem store/UI) para facilitar teste.
 */
import type { AssessmentCriteria, AssessmentRating, WorkerAbsence } from '@/types'

// ─── Pesos de penalização (ajustáveis) ────────────────────────────────────────
export const PENALTY = {
  PER_UNJUSTIFIED_ABSENCE: 0.5,  // falta injustificada: -0,5 ponto cada
  PER_JUSTIFIED_ABSENCE:   0.15, // falta justificada/atestado: -0,15 cada
  PER_LATE:                0.1,   // atraso: -0,1 ponto cada
  MAX_TOTAL_PENALTY:       3.0,   // teto: penalização nunca passa de 3 pontos
} as const

export const CRITERIA_KEYS: (keyof AssessmentCriteria)[] = [
  'qualidade', 'retrabalho', 'organizacao', 'produtividade',
  'comprometimento', 'orientacoes', 'confiabilidade', 'lideranca',
]

export const CRITERIA_LABELS: Record<keyof AssessmentCriteria, string> = {
  qualidade:       'Qualidade',
  retrabalho:      'Retrabalho',
  organizacao:     'Organização',
  produtividade:   'Produtividade',
  comprometimento: 'Comprometimento',
  orientacoes:     'Orientações',
  confiabilidade:  'Confiabilidade',
  lideranca:       'Liderança',
}

/** Média simples dos 8 critérios (0–10). */
export function criteriaAverage(c: AssessmentCriteria): number {
  const sum = CRITERIA_KEYS.reduce((s, k) => s + (Number(c[k]) || 0), 0)
  return sum / CRITERIA_KEYS.length
}

/** Conta faltas no período (inclusive), separando injustificadas das demais.
 *  Férias (`vacation`) não contam como falta. */
export function countAbsencesInPeriod(
  absences: WorkerAbsence[],
  workerId: string,
  start: string,
  end: string,
): { unjustified: number; justified: number; total: number } {
  const inRange = absences.filter(
    (a) => a.workerId === workerId && a.date >= start && a.date <= end && a.type !== 'vacation',
  )
  const unjustified = inRange.filter((a) => a.type === 'unjustified').length
  return { unjustified, justified: inRange.length - unjustified, total: inRange.length }
}

/** Penalização total (em pontos), com teto. */
export function computePenalty(unjustified: number, justified: number, lateCount: number): number {
  const raw =
    unjustified * PENALTY.PER_UNJUSTIFIED_ABSENCE +
    justified * PENALTY.PER_JUSTIFIED_ABSENCE +
    lateCount * PENALTY.PER_LATE
  return Math.min(raw, PENALTY.MAX_TOTAL_PENALTY)
}

/** Nota final 0–10 (média penalizada), clampada e arredondada a 1 casa. */
export function computeFinalScore(
  criteria: AssessmentCriteria,
  unjustified: number,
  justified: number,
  lateCount: number,
): number {
  const base = criteriaAverage(criteria)
  const score = base - computePenalty(unjustified, justified, lateCount)
  return Math.round(Math.max(0, Math.min(10, score)) * 10) / 10
}

/** Classificação por faixa da nota final (escala 0–10). */
export function classify(notaFinal: number): AssessmentRating {
  if (notaFinal >= 9) return 'excelente'
  if (notaFinal >= 7.5) return 'muito_bom'
  if (notaFinal >= 6) return 'bom'
  if (notaFinal >= 4) return 'regular'
  return 'atencao'
}

export const RATING_LABELS: Record<AssessmentRating, string> = {
  excelente: 'Excelente',
  muito_bom: 'Muito Bom',
  bom:       'Bom',
  regular:   'Regular',
  atencao:   'Atenção',
}

/** Classes Tailwind de badge por classificação (padrão de cores do módulo). */
export const RATING_COLORS: Record<AssessmentRating, string> = {
  excelente: 'bg-[#22c55e]/15 text-[#22c55e]',
  muito_bom: 'bg-[#3b82f6]/15 text-[#3b82f6]',
  bom:       'bg-[#f59e0b]/15 text-[#f59e0b]',
  regular:   'bg-[#f97316]/15 text-[#f97316]',
  atencao:   'bg-[#ef4444]/15 text-[#ef4444]',
}
