/**
 * Peças visuais do card de contrato — e a paleta legível.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────────
 * O cliente disse: "tem algumas coisas ali escritas em cinza, pode deixar em branco, para
 * facilitar a visualização. Inclusive se quiser aumentar algumas coisas, pois estão bem
 * pequenas." Medindo o contraste real da Torre de Controle:
 *
 *   #3f3f3f  (18 usos)   1,2:1   cabeçalhos de tabela, legendas, estados vazios → invisível
 *   #6b6b6b  (60 usos)   2,4:1   rótulo de TODO campo e de TODO dado            → reprova
 *   #4b5563  (1 uso)     1,6:1   nome de marco pendente                          → sobra de tema
 *   #a3a3a3              5,0:1   valores das tabelas                             → ok
 *
 * O mínimo do padrão de acessibilidade é 4,5:1. E os tamanhos: 60 usos de 10px, 23 de 9px, um
 * de 8px — só 15 de ~130 chegam a 12px. O pior caso do projeto era a data de um marco: 8px a
 * 1,2:1, literalmente ilegível.
 *
 * A regra daqui em diante: **texto de conteúdo nunca abaixo de `#a3a3a3`**, e nada menor que
 * 11px. `#6b6b6b` e `#3f3f3f` só para borda e placeholder.
 */

/** Paleta de texto. Use estes nomes em vez de repetir hexadecimal pela tela. */
export const TXT = {
  /** Valor, título, o que a pessoa vem ler.       11,6:1 */
  forte:  'text-[#f5f5f5]',
  /** Texto corrido e valores secundários.         10,0:1 */
  normal: 'text-[#e5e5e5]',
  /** Rótulo de campo, cabeçalho de tabela.         5,0:1 */
  fraco:  'text-[#a3a3a3]',
  positivo: 'text-[#4ade80]',
  atencao:  'text-[#fbbf24]',
  erro:     'text-[#f87171]',
  destaque: 'text-[#fdba74]',
} as const

export const brl = (v: number) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const num = (v: number, casas = 2) =>
  (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

export const pct = (v: number) => `${num(v, 1)}%`

/** Campo de texto do formulário. 12px — o antigo era 10px. */
export const inputCls =
  'w-full rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1.5 text-xs text-[#f5f5f5] ' +
  'outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]/60'
export const numCls = `${inputCls} text-right tabular-nums`
