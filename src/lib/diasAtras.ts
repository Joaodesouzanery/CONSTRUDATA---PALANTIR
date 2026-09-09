/**
 * "há 3 dias", "hoje", "ontem" — a frase que as Rotinas usam, solta para qualquer tela.
 *
 * Existe porque `frasePendencia` (minha-rotina/utils/atrasoRotina.ts) está acoplada a `Rotina`:
 * dá para copiar a ideia, não para importar a função. Dia em fuso LOCAL, por data — nunca por
 * `toISOString()`, que depois das 21h no Brasil já é amanhã.
 */
export function diasAtras(iso: string | null | undefined, hojeISO?: string): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  const local = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())
  const hoje = hojeISO ? new Date(`${hojeISO}T12:00:00`) : new Date()
  return Math.max(0, Math.round((local(hoje) - local(d)) / 86_400_000))
}

export function fraseHaDias(dias: number | null): string {
  if (dias === null) return 'nunca'
  if (dias === 0) return 'hoje'
  if (dias === 1) return 'ontem'
  return `há ${dias} dias`
}
