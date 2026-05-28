export function parseLocaleNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (value == null) return 0

  const trimmed = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/[R$]/g, '')

  if (!trimmed) return 0

  const negative = trimmed.startsWith('-') || /^\(.+\)$/.test(trimmed)
  const clean = trimmed.replace(/[()]/g, '').replace(/^-/, '')
  const lastComma = clean.lastIndexOf(',')
  const lastDot = clean.lastIndexOf('.')
  let normalized = clean

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ','
    normalized = clean.split(thousandsSeparator).join('').replace(decimalSeparator, '.')
  } else if (lastComma >= 0) {
    const decimals = clean.length - lastComma - 1
    normalized = decimals === 3 ? clean.replace(/,/g, '') : clean.replace(',', '.')
  } else if (lastDot >= 0) {
    const decimals = clean.length - lastDot - 1
    normalized = decimals === 3 ? clean.replace(/\./g, '') : clean
  }

  const parsed = Number(normalized.replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(parsed)) return 0
  return negative ? -parsed : parsed
}

export function formatDecimalInput(value: number, decimals = 4): string {
  if (!Number.isFinite(value) || value === 0) return ''
  return Number(value.toFixed(decimals)).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })
}

export function formatMoneyInput(value: number): string {
  if (!Number.isFinite(value) || value === 0) return ''
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
