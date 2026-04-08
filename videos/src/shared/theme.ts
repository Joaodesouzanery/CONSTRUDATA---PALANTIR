/**
 * theme.ts — Tokens compartilhados entre as composições.
 * Mesma paleta da plataforma Atlântico.
 */
export const COLORS = {
  bg:        '#0b1a30',
  bgDeep:    '#071423',
  bgPanel:   '#2c2c2c',
  bgCard:    '#3d3d3d',
  border:    '#525252',
  borderDim: 'rgba(255,255,255,0.10)',
  text:      '#f4f5f7',
  textDim:   'rgba(255,255,255,0.65)',
  textMute:  'rgba(255,255,255,0.40)',
  accent:    '#f97316',
  accentDeep:'#ea580c',
  accentDim: 'rgba(249,115,22,0.20)',
  success:   '#22c55e',
  warning:   '#eab308',
  error:     '#ef4444',
  info:      '#3b82f6',
} as const

export const FONTS = {
  display: "'Space Grotesk', sans-serif",
  body:    "'Inter', sans-serif",
} as const
