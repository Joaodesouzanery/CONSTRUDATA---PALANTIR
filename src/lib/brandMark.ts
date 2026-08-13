/**
 * brandMark.ts — a marca ConstruData como dado, não como componente.
 *
 * O símbolo "N" (Grupo Nery) vive aqui para que o componente React (BrandLogo) e os
 * geradores de relatório — que montam HTML string, fora do React — usem exatamente o mesmo
 * traçado. Antes, cada relatório do repo desenhava um quadrado laranja com uma letra dentro,
 * e a marca de verdade não aparecia em nenhum documento entregue ao cliente.
 */

/** Caixa do traçado: `viewBox="0 0 327 334"`. */
export const BRAND_MARK_VIEWBOX = '0 0 327 334'

/**
 * Duas peças congruentes giradas 180° (barra ortogonal + diagonal + retorno). Extraído do PDF
 * do manual da marca (traçado + otimização contra o render vetorial; desvio ~2%).
 */
export const BRAND_MARK_PATH =
  'M2.6 0 L130.2 0 L261.2 140.6 L263.1 55.8 L210.5 0 L327 0 L327 233 L268 233 L100.1 51.4 L2.6 51.4 Z ' +
  'M324.4 334 L196.8 334 L65.8 193.4 L63.9 278.2 L116.5 334 L0 334 L0 101 L59 101 L226.9 282.6 L324.4 282.6 Z'

/**
 * A marca como SVG inline, para embutir em HTML de relatório (`window.print()`).
 * Vetorial: imprime nítida em qualquer resolução e sobrevive ao preto e branco.
 */
export function brandMarkSvg(size = 24, color = '#f97316'): string {
  const h = Math.round((size * 334) / 327)
  return `<svg viewBox="${BRAND_MARK_VIEWBOX}" width="${size}" height="${h}" fill="${color}" aria-hidden="true"><path d="${BRAND_MARK_PATH}" /></svg>`
}
