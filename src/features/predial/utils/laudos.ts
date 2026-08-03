/**
 * laudos.ts — catálogo das obrigações legais padrão + cálculo do semáforo de vencimento
 * da Tela "Compliance de Laudos". Determinístico (sem servidor): o semáforo usa a validade
 * do laudo; os alertas por e-mail 60/30/7 são fase 2.
 */

/** Obrigações legais recorrentes mais comuns (Brasil/DF). "Outro" para casos avulsos. */
export const LAUDO_TIPOS = [
  'AVCB / CBMDF',
  'SPDA (para-raios)',
  "Limpeza de caixa d'água",
  'Dedetização',
  'Gás (NR-13 / rede)',
  'Pressurização de escada',
  'Inspeção de elevadores',
  'Recarga de extintores',
  'Outro',
] as const

/** Periodicidade padrão (meses) por obrigação — usada no cadastro em lote e para sugerir validade. */
export const LAUDO_PERIODICIDADE_PADRAO: Record<string, number> = {
  'AVCB / CBMDF': 12,
  'SPDA (para-raios)': 12,
  "Limpeza de caixa d'água": 6,
  'Dedetização': 6,
  'Gás (NR-13 / rede)': 12,
  'Pressurização de escada': 12,
  'Inspeção de elevadores': 12,
  'Recarga de extintores': 12,
}

export type LaudoStatusCor = 'verde' | 'amarelo' | 'vermelho' | 'cinza'

/** Dias corridos até a validade (negativo = vencido). null se sem validade. */
export function laudoDiasRestantes(validade?: string): number | null {
  if (!validade) return null
  return Math.floor((new Date(validade + 'T12:00:00').getTime() - Date.now()) / 86_400_000)
}

/**
 * Semáforo do laudo a partir da validade:
 *  vermelho = vencido ou vence em ≤30 dias · amarelo = 31–60 dias · verde = >60 dias.
 * Espelha a cadência de alerta 60/30/7 (o alerta de 7 dias aparece pelo nº de dias exibido).
 */
export function laudoStatus(validade?: string): { cor: LaudoStatusCor; label: string; dias: number | null } {
  const dias = laudoDiasRestantes(validade)
  if (dias == null) return { cor: 'cinza', label: 'Sem validade', dias: null }
  if (dias < 0) return { cor: 'vermelho', label: 'Vencido', dias }
  if (dias <= 30) return { cor: 'vermelho', label: `${dias}d`, dias }
  if (dias <= 60) return { cor: 'amarelo', label: `${dias}d`, dias }
  return { cor: 'verde', label: `${dias}d`, dias }
}

/** Soma `meses` a uma data yyyy-MM-dd e devolve yyyy-MM-dd (para sugerir a próxima validade). */
export function addMonthsISO(dateISO: string, meses: number): string {
  const d = new Date(dateISO + 'T12:00:00')
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}
