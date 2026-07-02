/**
 * planoExecucao — cálculos e utilidades do "Planejamento de Execução" (modo Compizzo).
 * Regras espelham os PDFs do cliente: faturamento = área × preço/m²;
 * bonificação por colaborador = R$/m² × área; bônus diário = total ÷ dias corridos.
 */
import type { PlanoExecucao } from '@/types'

export const WEEKDAY_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

export function dayOfWeekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? '' : (WEEKDAY_SHORT[d.getDay()] ?? '')
}

export function isWeekend(iso: string): boolean {
  const g = new Date(`${iso}T00:00:00`).getDay()
  return g === 0 || g === 6
}

/** Todos os dias corridos entre início e fim (inclusive). */
export function eachDay(inicio: string, fim: string): string[] {
  const out: string[] = []
  if (!inicio || !fim) return out
  const start = new Date(`${inicio}T00:00:00`)
  const end = new Date(`${fim}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return out
  const cur = new Date(start)
  let guard = 0
  while (cur <= end && guard < 400) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
    guard++
  }
  return out
}

export function diasCorridos(p: Pick<PlanoExecucao, 'periodoInicio' | 'periodoFim'>): number {
  return eachDay(p.periodoInicio, p.periodoFim).length
}

export function faturamento(p: Pick<PlanoExecucao, 'areaM2' | 'precoM2' | 'faturamentoOverride'>): number {
  if (p.faturamentoOverride != null && Number.isFinite(p.faturamentoOverride)) return p.faturamentoOverride
  return (p.areaM2 || 0) * (p.precoM2 || 0)
}

export function bonificacaoValor(rPorM2: number, areaM2: number): number {
  return (rPorM2 || 0) * (areaM2 || 0)
}

export function bonificacaoTotal(p: Pick<PlanoExecucao, 'bonificacao' | 'areaM2'>): number {
  return p.bonificacao.reduce((s, b) => s + bonificacaoValor(b.rPorM2, p.areaM2), 0)
}

/** Bônus diário = total da bonificação ÷ dias corridos (como no PDF). */
export function bonusDiario(
  p: Pick<PlanoExecucao, 'bonificacao' | 'areaM2' | 'periodoInicio' | 'periodoFim'>,
): number {
  const dias = diasCorridos(p)
  return dias > 0 ? bonificacaoTotal(p) / dias : 0
}

export function fmtBRL(v: number): string {
  return (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** dd/MM (formato curto usado na tabela do cronograma). */
export function fmtDataCurta(iso: string): string {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}` : iso
}

/** dd/MM/yyyy (usado no cabeçalho META). */
export function fmtDataLonga(iso: string): string {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}
