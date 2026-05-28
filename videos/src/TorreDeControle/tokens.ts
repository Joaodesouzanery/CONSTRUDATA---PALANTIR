/**
 * tokens.ts — Design tokens do vídeo Torre de Controle.
 *
 * Variante mais escura que ExplainerModulos (#1f1f1f vs #2c2c2c),
 * conforme spec de REMOTION_VIDEO_SCRIPTS.md.
 * Inclui cores RAG (Red/Amber/Green) para o módulo Torre.
 */
export const COLORS = {
  bg: "#1f1f1f",
  surface: "#2a2a2a",
  card: "#2c2c2c",
  cardHover: "#3d3d3d",
  muted: "#3f3f3f",

  borderSoft: "rgba(255,255,255,0.10)",
  borderMid: "rgba(255,255,255,0.14)",
  borderStrong: "#525252",

  accent: "#f97316",
  accentHover: "#ea580c",
  accentMuted: "rgba(249,115,22,0.12)",

  textPrimary: "#f5f5f5",
  textOn: "rgba(255,255,255,0.90)",
  textSecondary: "#a3a3a3",
  textMuted: "rgba(255,255,255,0.60)",
  textFaint: "rgba(255,255,255,0.14)",

  // RAG / Status (espelha o real torre-de-controle)
  ragGreen: "#22c55e",
  ragAmber: "#eab308",
  ragRed: "#ef4444",
  statusPlanning: "#3b82f6",
  statusCompleted: "#a3a3a3",
} as const;

export const FONT = {
  display: "'Space Grotesk', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
} as const;

export const SIZE = {
  display: 120,
  h1: 84,
  h2: 56,
  h3: 36,
  body: 28,
  caption: 22,
  mono: 22,
} as const;

export const URL_SITE = "https://www.construdata.software";
