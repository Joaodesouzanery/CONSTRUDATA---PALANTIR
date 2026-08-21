/**
 * Unidades de medida — o único lugar do projeto que decide se algo é área ou comprimento.
 *
 * Existe porque a mesma pergunta estava respondida em quatro lugares diferentes, com listas e
 * regex divergentes, e em todos eles o total acabava somando metro linear com metro quadrado.
 * No contrato real de pintura epóxi isso dá 25.567,02 — a soma de 18.605,01 m² de piso/parede/
 * meio-fio com 6.962,01 m de demarcação. É um número que não significa nada e ninguém pode
 * conferir.
 *
 * A regra aqui é simples: **nunca some unidades de tipos diferentes.** Devolva as parcelas.
 */

export type TipoUnidade = 'area' | 'linear' | 'verba' | 'outra'

/** Serviço de valor fechado, sem metragem (ex.: "Faturamento direto" do contrato). */
export const UNIDADE_VERBA = 'vb'

/**
 * Classifica a unidade pelo token INTEIRO.
 *
 * Um `/^m/` casaria com "mm" e "min": milímetro entrando no total de metros, minuto virando
 * metragem. Por isso a âncora nos dois lados.
 */
export function classificarUnidade(unidade: string | null | undefined): TipoUnidade {
  const u = (unidade ?? '').trim().toLowerCase()
  if (u === UNIDADE_VERBA || u === 'verba') return 'verba'
  if (/^(m|ml|metro|metros|m\.?l\.?|metro linear|metros lineares)$/.test(u)) return 'linear'
  if (/^(m²|m2|metro quadrado|metros quadrados)$/.test(u)) return 'area'
  return 'outra'
}

export function ehVerba(unidade?: string | null): boolean {
  return classificarUnidade(unidade) === 'verba'
}

/** Rótulo canônico de cada tipo, para a tela não inventar variações. */
export const ROTULO_UNIDADE: Record<TipoUnidade, string> = {
  area:   'm²',
  linear: 'm',
  verba:  'vb',
  outra:  'un',
}

export interface Metragem {
  /** Soma das quantidades em m². */
  area: number
  /** Soma das quantidades em metro linear. */
  linear: number
  /** Soma das quantidades em unidades que não são nem área nem comprimento. */
  outra: number
  /** Quantos itens de valor fechado (verba) entraram — eles não têm metragem. */
  verbas: number
}

export const METRAGEM_ZERO: Metragem = { area: 0, linear: 0, outra: 0, verbas: 0 }

/** Soma quantidades respeitando a unidade de cada uma. */
export function somarMetragem(itens: Array<{ unidade?: string | null; quantidade: number }>): Metragem {
  const out: Metragem = { ...METRAGEM_ZERO }
  for (const item of itens) {
    const q = Number(item.quantidade) || 0
    switch (classificarUnidade(item.unidade)) {
      case 'area':   out.area += q; break
      case 'linear': out.linear += q; break
      case 'verba':  out.verbas += 1; break
      default:       out.outra += q
    }
  }
  return out
}

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Texto da metragem, em parcelas separadas: `"18.605,01 m² + 6.962,01 m"`.
 *
 * Duas parcelas em vez de um total é a decisão de projeto inteira em uma linha. Some e você tem
 * um número; separe e você tem a informação.
 */
export function formatarMetragem(m: Metragem): string {
  const partes: string[] = []
  if (m.area > 0)   partes.push(`${fmt(m.area)} m²`)
  if (m.linear > 0) partes.push(`${fmt(m.linear)} m`)
  if (m.outra > 0)  partes.push(`${fmt(m.outra)} un`)
  if (partes.length === 0) return m.verbas > 0 ? 'valor fechado' : '—'
  return partes.join(' + ')
}

/** `true` quando há mais de um tipo de unidade — a tela deve mostrar parcelas, nunca um total. */
export function temUnidadesMistas(m: Metragem): boolean {
  return [m.area > 0, m.linear > 0, m.outra > 0].filter(Boolean).length > 1
}
