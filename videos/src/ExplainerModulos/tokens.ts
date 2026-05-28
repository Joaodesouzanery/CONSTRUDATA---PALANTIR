/**
 * tokens.ts — Tokens locais do ExplainerModulos.
 *
 * Complementa videos/src/shared/theme.ts com a paleta exata da Landing
 * atual (#2c2c2c base + accent laranja Atlântico). O shared/theme.ts dos
 * outros vídeos usa uma paleta azul antiga; este arquivo mantém o
 * Explainer alinhado ao design system real do site.
 *
 * Fonte: CONSTRUDATA---PALANTIR/src/styles/globals.css
 */
export const COLORS = {
  // Surfaces
  bg: "#2c2c2c",
  surface: "#333333",
  card: "#3d3d3d",
  cardHover: "#484848",
  muted: "#3f3f3f",

  // Borders (sempre branco com alpha)
  borderSoft: "rgba(255,255,255,0.10)",
  borderMid: "rgba(255,255,255,0.14)",
  borderStrong: "#525252",

  // Accent (laranja Atlântico)
  accent: "#f97316",
  accentHover: "#ea580c",
  accentMuted: "rgba(249,115,22,0.12)",

  // Texto
  textPrimary: "#f5f5f5",
  textOn: "rgba(255,255,255,0.90)",
  textSecondary: "rgba(255,255,255,0.75)",
  textMuted: "rgba(255,255,255,0.60)",
  textFaint: "rgba(255,255,255,0.14)",

  // Status
  success: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",
  info: "#38bdf8",
  violet: "#a78bfa",
} as const;

export const FONT = {
  display: "'Space Grotesk', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
} as const;

// Escala para 1920×1080
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

// Lista canônica dos 16 módulos — fonte: AllModulesGrid.tsx da Landing
export const MODULOS = [
  { n: "01", label: "Relatório 360", cat: "Visibilidade" },
  { n: "02", label: "Agenda / Cronograma", cat: "Planejamento" },
  { n: "03", label: "Equipamentos", cat: "Recursos" },
  { n: "04", label: "Projetos (BIM)", cat: "BIM" },
  { n: "05", label: "Torre de Controle", cat: "Gestão" },
  { n: "06", label: "Mapa Interativo", cat: "GIS" },
  { n: "07", label: "Pré-Construção", cat: "Planejamento" },
  { n: "08", label: "Suprimentos", cat: "Suprimentos" },
  { n: "09", label: "Mão de Obra", cat: "Recursos" },
  { n: "10", label: "Planejamento", cat: "Planejamento" },
  { n: "11", label: "LPS / Lean", cat: "Lean" },
  { n: "12", label: "RDO", cat: "Campo" },
  { n: "13", label: "Quantitativos", cat: "Orçamento" },
  { n: "14", label: "BIM 3D/4D/5D", cat: "BIM" },
  { n: "15", label: "Frota", cat: "Recursos" },
  { n: "16", label: "Gestão 360", cat: "Gestão" },
] as const;
