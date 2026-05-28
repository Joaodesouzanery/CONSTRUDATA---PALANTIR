const SABESP_N_PRECO_ALIASES: Record<string, string> = {
  '72000355': '410355',
  '72000356': '410356',
}

export function cleanNPreco(value?: string | number | null) {
  return String(value ?? '').replace(/\D/g, '')
}

export function normalizeNPreco(value?: string | number | null) {
  const cleaned = cleanNPreco(value)
  return SABESP_N_PRECO_ALIASES[cleaned] ?? cleaned
}

export function describeNPrecoAlias(value?: string | number | null) {
  const cleaned = cleanNPreco(value)
  const normalized = normalizeNPreco(cleaned)
  return cleaned && normalized !== cleaned ? `${cleaned} -> ${normalized}` : ''
}
