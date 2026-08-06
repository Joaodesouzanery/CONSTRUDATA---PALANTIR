/**
 * laudos.ts — catálogo das obrigações legais padrão + cálculo do semáforo de vencimento
 * da Tela "Compliance de Laudos". Determinístico (sem servidor): o semáforo e o aviso
 * escalonado 60/30/7 são derivados da validade do laudo, direto no app (sem e-mail).
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

/**
 * Cadência única do aviso IN-APP (dias de antecedência). Centralizada aqui para que
 * todas as telas (painel, aba de laudos, badge) usem os MESMOS limiares — sem números
 * conflitantes. É um aviso no próprio produto, sem e-mail/agendador.
 */
export const LAUDO_ALERTA_DIAS = [60, 30, 7] as const

export type LaudoAlertTier = 'vencido' | 'd7' | 'd30' | 'd60'

/**
 * Tier de aviso 60/30/7 a partir da validade — o mais urgente aplicável:
 *  vencido · d7 (≤7d) · d30 (≤30d) · d60 (≤60d) · null (sem validade ou faltam >60 dias).
 * Base do aviso in-app: derivado da validade, nunca persistido (funciona em demo e real).
 */
export function laudoAlertTier(validade?: string): LaudoAlertTier | null {
  const dias = laudoDiasRestantes(validade)
  if (dias == null) return null
  if (dias < 0) return 'vencido'
  if (dias <= 7) return 'd7'
  if (dias <= 30) return 'd30'
  if (dias <= 60) return 'd60'
  return null
}

/** Conta laudos por tier de aviso (cada um entra no tier mais urgente; ignora sem-validade/>60d). */
export function contarLaudosPorTier(laudos: { validade?: string }[]): Record<LaudoAlertTier, number> {
  const acc: Record<LaudoAlertTier, number> = { vencido: 0, d7: 0, d30: 0, d60: 0 }
  for (const l of laudos) { const t = laudoAlertTier(l.validade); if (t) acc[t] += 1 }
  return acc
}

/** Soma `meses` a uma data yyyy-MM-dd e devolve yyyy-MM-dd (para sugerir a próxima validade). */
export function addMonthsISO(dateISO: string, meses: number): string {
  const d = new Date(dateISO + 'T12:00:00')
  d.setMonth(d.getMonth() + meses)
  return d.toISOString().slice(0, 10)
}
