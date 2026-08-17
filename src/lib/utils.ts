import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000) return `R$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000)     return `R$${(value / 1_000).toFixed(0)}k`
  return `R$${value.toFixed(0)}`
}

/**
 * Hoje no fuso LOCAL, em `yyyy-MM-dd`.
 *
 * `new Date().toISOString().slice(0,10)` devolve a data em UTC: no Brasil (GMT-3), a partir
 * das 21h já é "amanhã". Isso fazia uma parcela que vence hoje aparecer como "venceu há 1d"
 * e, pior, uma baixa dada às 22h do dia 31 cair no mês seguinte na DRE.
 */
export function hojeLocalISO(): string {
  return dataLocalISO(new Date())
}

/**
 * `Date` → `yyyy-MM-dd` no fuso LOCAL.
 *
 * A versão sem argumento (`hojeLocalISO`) cobria só "hoje". A maioria dos casos errados no
 * projeto é outra: uma `Date` construída a partir de agora e deslocada — `d.setDate(d.getDate()
 * - 6)`, `d.setDate(1)` — e depois passada por `toISOString()`. Como o deslocamento preserva a
 * HORA corrente, às 21h30 no Brasil o resultado pula um dia. Foi assim que o filtro "este mês"
 * do Dashboard passou a perder o dia 1º para quem abria a tela à noite.
 */
export function dataLocalISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** `Date` → `yyyy-MM` no fuso local. Mesmo motivo. */
export function mesLocalISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** `yyyy-MM-dd` → `dd/MM/aaaa`. Por split de string: passar por `Date` deslocaria um dia. */
export function fmtDataBR(iso?: string | null): string {
  if (!iso || iso.length < 10) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
