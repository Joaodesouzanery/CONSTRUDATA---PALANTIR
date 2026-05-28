/**
 * ExplainerModulos — Vídeo explainer principal mostrando o Atlântico
 * ConstruData com 7 módulos em destaque usando screenshots reais da
 * plataforma + cursor animado clicando em UI + highlights, scan line,
 * Ken Burns, vignette, module counter e progress bar global.
 *
 * Resolução: 1920×1080 (16:9), 30 fps, ~91s total.
 *
 * Estrutura (13 cenas com crossfade de 24 frames entre cada):
 *   1.  Problema       — dados fragmentados
 *   2.  Logo reveal    — Atlântico ConstruData
 *   3.  Promessa       — pré-construção → encerramento
 *   4.  Grid 16 mód.   — visão geral, 7 highlights pulsam
 *   5.  Relatório 360  — dashboard executivo
 *   6.  RDO            — relatório diário
 *   7.  Quantitativos  — orçamento SINAPI
 *   8.  Agenda         — Gantt
 *   9.  Gestão 360     — centro de comando + mapa
 *  10.  LPS / Lean     — look-ahead
 *  11.  BIM 3D/4D/5D   — modelo conectado a custo
 *  12.  Stats          — 16+ módulos · BIM · 100% web
 *  13.  CTA            — agendar demonstração + URL
 *
 * Screenshots em videos/public/screenshots/:
 *   relatorio-360.png · rdo-dashboard.png · quantitativos.png ·
 *   agenda-gantt.png · gestao360.png · lps-lookahead.png · bim-5d.png
 */
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLORS, FONT, SIZE, MODULOS, URL_SITE } from "./tokens";
import { Logo } from "./parts/Logo";
import { Eyebrow } from "./parts/Eyebrow";
import { ModuleShowcase, type Highlight } from "./parts/ModuleShowcase";
import type { CursorKey } from "./parts/Cursor";
import { GlobalProgressBar } from "./parts/ProgressBar";

export const EXPLAINER_FPS = 30;
export const EXPLAINER_W = 1920;
export const EXPLAINER_H = 1080;

const OVERLAP = 24;

const dur = {
  problema: 200,
  logo: 174,
  promessa: 204,
  grid: 324,
  relatorio: 220,
  rdo: 220,
  quant: 220,
  agenda: 220,
  gestao: 220,
  lps: 220,
  bim: 220,
  stats: 234,
  cta: 354,
};

const seqList = [
  "problema",
  "logo",
  "promessa",
  "grid",
  "relatorio",
  "rdo",
  "quant",
  "agenda",
  "gestao",
  "lps",
  "bim",
  "stats",
  "cta",
] as const;
type SeqKey = (typeof seqList)[number];

const positions: Record<SeqKey, { from: number; duration: number }> = (() => {
  const out = {} as Record<SeqKey, { from: number; duration: number }>;
  let cursor = 0;
  for (const key of seqList) {
    out[key] = { from: cursor, duration: dur[key] };
    cursor += dur[key] - OVERLAP;
  }
  return out;
})();

export const EXPLAINER_DURATION =
  positions.cta.from + positions.cta.duration;

// ─── Helpers ────────────────────────────────────────────────────────────────
const fadeIn = (frame: number, start = 0, len = 18) =>
  interpolate(frame, [start, start + len], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

const slideUp = (frame: number, start = 0, len = 18, distance = 24) =>
  interpolate(frame, [start, start + len], [distance, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

const DotGrid: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: COLORS.bg,
      backgroundImage: `radial-gradient(circle, ${COLORS.surface} 1px, transparent 1px)`,
      backgroundSize: "28px 28px",
    }}
  />
);

// SceneWrapper: fade-in + fade-out + scale para crossfade entre cenas
const SceneWrapper: React.FC<{
  duration: number;
  children: React.ReactNode;
}> = ({ duration, children }) => {
  const frame = useCurrentFrame();
  const fIn = interpolate(frame, [0, OVERLAP], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const fOut = interpolate(frame, [duration - OVERLAP, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const sIn = interpolate(frame, [0, OVERLAP], [1.03, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const sOut = interpolate(frame, [duration - OVERLAP, duration], [1, 0.98], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(fIn, fOut),
        transform: `scale(${Math.min(sIn, sOut)})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 1 — PROBLEMA
// ═══════════════════════════════════════════════════════════════════════════
const SceneProblema: React.FC = () => {
  const frame = useCurrentFrame();
  const sources = [
    { x: 280, y: 220, label: "PLANILHA XLSX" },
    { x: 1500, y: 220, label: "E-MAIL" },
    { x: 280, y: 780, label: "WHATSAPP" },
    { x: 1500, y: 780, label: "PDF IMPRESSO" },
  ];
  const collapse = interpolate(frame, [150, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const cx = EXPLAINER_W / 2;
  const cy = EXPLAINER_H / 2;

  return (
    <AbsoluteFill>
      <DotGrid />
      <svg
        width={EXPLAINER_W}
        height={EXPLAINER_H}
        style={{ position: "absolute" }}
      >
        {sources.map((s, i) => {
          const x = s.x + (cx - s.x) * collapse;
          const y = s.y + (cy - s.y) * collapse;
          // Pulse vermelho nos gap markers
          const pulse =
            0.7 + 0.3 * Math.sin((frame + i * 8) * 0.15);
          return (
            <g key={i} opacity={fadeIn(frame, 10 + i * 6) * (1 - collapse)}>
              <line
                x1={x}
                y1={y}
                x2={cx}
                y2={cy}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="1"
                strokeDasharray="6 6"
              />
              <circle
                cx={(x + cx) / 2}
                cy={(y + cy) / 2}
                r="6"
                fill={COLORS.danger}
                opacity={pulse}
              />
            </g>
          );
        })}
      </svg>
      {sources.map((s, i) => {
        const op = fadeIn(frame, 10 + i * 6) * (1 - collapse);
        const x = s.x + (cx - s.x) * collapse;
        const y = s.y + (cy - s.y) * collapse;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 100,
              top: y - 30,
              width: 200,
              opacity: op,
              fontFamily: FONT.mono,
              fontSize: 22,
              color: COLORS.textSecondary,
              textAlign: "center",
              letterSpacing: "0.12em",
              border: `1px solid ${COLORS.borderMid}`,
              padding: "16px 12px",
              background: COLORS.bg,
            }}
          >
            {s.label}
          </div>
        );
      })}

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: fadeIn(frame, 60),
        }}
      >
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: SIZE.h2,
            color: COLORS.textPrimary,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            transform: `translateY(${slideUp(frame, 60)}px)`,
          }}
        >
          Dados de obra fragmentados.
          <br />
          <span style={{ color: COLORS.textMuted, fontWeight: 500 }}>
            Decisões tomadas tarde demais.
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 2 — LOGO REVEAL
// ═══════════════════════════════════════════════════════════════════════════
const SceneLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const logoSpring = spring({
    frame: frame - 15,
    fps: config.fps,
    config: { damping: 14 },
  });

  return (
    <AbsoluteFill>
      <DotGrid />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: fadeIn(frame, 0), marginBottom: 60 }}>
          <Eyebrow size={20}>Plataforma para Construção e Saneamento</Eyebrow>
        </div>

        <div
          style={{
            transform: `scale(${0.8 + logoSpring * 0.2}) translateY(${(1 - logoSpring) * 30}px)`,
            opacity: logoSpring,
          }}
        >
          <Logo scale={9} />
        </div>

        <div
          style={{
            marginTop: 80,
            fontFamily: FONT.display,
            fontSize: SIZE.h3,
            color: COLORS.textOn,
            fontWeight: 500,
            textAlign: "center",
            opacity: fadeIn(frame, 70),
            letterSpacing: "-0.005em",
            maxWidth: 1100,
          }}
        >
          Inteligência Operacional para Construção e Saneamento.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 3 — PROMESSA
// ═══════════════════════════════════════════════════════════════════════════
const ScenePromessa: React.FC = () => {
  const frame = useCurrentFrame();
  const milestones = ["PRÉ-CONSTRUÇÃO", "EXECUÇÃO", "ENCERRAMENTO", "PÓS-OBRA"];
  const lineGrow = interpolate(frame, [10, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <DotGrid />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 1500, position: "relative", marginBottom: 120 }}>
          <div
            style={{
              height: 1,
              width: `${lineGrow * 100}%`,
              background: COLORS.textFaint,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: -2,
              left: 0,
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            {milestones.map((m, i) => {
              const op = fadeIn(frame, 30 + i * 10);
              return (
                <div
                  key={m}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    opacity: op,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      background: COLORS.accent,
                      marginTop: -3,
                    }}
                  />
                  <div
                    style={{
                      marginTop: 16,
                      fontFamily: FONT.mono,
                      fontSize: 22,
                      color: COLORS.textMuted,
                      letterSpacing: "0.12em",
                    }}
                  >
                    {m}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            fontFamily: FONT.display,
            fontSize: SIZE.h1,
            color: COLORS.textPrimary,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            opacity: fadeIn(frame, 80),
            transform: `translateY(${slideUp(frame, 80)}px)`,
          }}
        >
          Da pré-construção ao encerramento,
          <br />
          <span style={{ color: COLORS.accent }}>uma única plataforma.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 4 — GRID DOS 16 MÓDULOS
// ═══════════════════════════════════════════════════════════════════════════
const SceneGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const cols = 4;
  const cellW = 360;
  const cellH = 150;
  const gap = 1;
  const gridW = cols * cellW + (cols - 1) * gap;
  // Os 7 módulos que viram showcase
  const HIGHLIGHTS = [
    "Relatório 360",
    "RDO",
    "Quantitativos",
    "Agenda / Cronograma",
    "Gestão 360",
    "LPS / Lean",
    "BIM 3D/4D/5D",
  ];

  return (
    <AbsoluteFill>
      <DotGrid />
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 120,
          opacity: fadeIn(frame, 0),
        }}
      >
        <Eyebrow accent={false}>02 / Módulos</Eyebrow>
      </div>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${cellW}px)`,
            gap: `${gap}px`,
            background: COLORS.borderSoft,
            width: gridW,
            border: `1px solid ${COLORS.borderMid}`,
          }}
        >
          {MODULOS.map((m, i) => {
            const delay = 20 + i * 4;
            const op = fadeIn(frame, delay);
            const isHighlight = HIGHLIGHTS.includes(m.label);
            const pulse = isHighlight
              ? interpolate(frame, [200, 220, 240, 260], [0, 1, 0, 0.55], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0;
            return (
              <div
                key={m.label}
                style={{
                  background: COLORS.bg,
                  height: cellH,
                  padding: "24px 28px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  opacity: op,
                  transform: `translateY(${slideUp(frame, delay, 18, 12)}px)`,
                  boxShadow: pulse
                    ? `inset 0 0 0 2px ${COLORS.accent}`
                    : "none",
                }}
              >
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 16,
                    color: pulse ? COLORS.accent : COLORS.textMuted,
                    letterSpacing: "0.12em",
                  }}
                >
                  {m.n}
                </div>
                <div
                  style={{
                    fontFamily: FONT.display,
                    fontSize: SIZE.h3,
                    color: pulse ? COLORS.accent : COLORS.textOn,
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {m.label}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 60,
            fontFamily: FONT.display,
            fontSize: SIZE.body,
            color: COLORS.textSecondary,
            opacity: fadeIn(frame, 270),
          }}
        >
          16 módulos. 1 ontologia de dados.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 12 — STATS
// ═══════════════════════════════════════════════════════════════════════════
const SceneStats: React.FC = () => {
  const frame = useCurrentFrame();
  const num16 = Math.round(
    interpolate(frame, [10, 50], [0, 16], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    })
  );
  const num100 = Math.round(
    interpolate(frame, [30, 70], [0, 100], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    })
  );

  const stats = [
    { v: `${num16}+`, l: "Módulos", op: fadeIn(frame, 0) },
    { v: `BIM 3D/4D/5D`, l: "Integrado", op: fadeIn(frame, 20) },
    { v: `${num100}%`, l: "Web-based", op: fadeIn(frame, 40) },
  ];

  return (
    <AbsoluteFill>
      <DotGrid />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
          {stats.map((s, i) => (
            <React.Fragment key={s.l}>
              {i > 0 && (
                <div
                  style={{
                    width: 1,
                    background: COLORS.borderSoft,
                    marginInline: 60,
                  }}
                />
              )}
              <div
                style={{
                  opacity: s.op,
                  textAlign: "center",
                  padding: "0 40px",
                }}
              >
                <div
                  style={{
                    fontFamily: FONT.display,
                    fontWeight: 700,
                    fontSize: i === 1 ? 72 : SIZE.display,
                    color: COLORS.textPrimary,
                    letterSpacing: "-0.03em",
                    lineHeight: 1,
                  }}
                >
                  {s.v}
                </div>
                <div
                  style={{
                    marginTop: 24,
                    fontFamily: FONT.mono,
                    fontSize: SIZE.caption,
                    color: COLORS.textMuted,
                    letterSpacing: "0.20em",
                    textTransform: "uppercase",
                  }}
                >
                  {s.l}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 13 — CTA
// ═══════════════════════════════════════════════════════════════════════════
const SceneCta: React.FC = () => {
  const frame = useCurrentFrame();
  // Arrow pulse loop
  const arrowPulse = 1 + 0.18 * Math.sin(frame * 0.18);

  return (
    <AbsoluteFill>
      <DotGrid />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ marginBottom: 60, opacity: fadeIn(frame, 0) }}>
          <Eyebrow>Pronto para ver na sua obra?</Eyebrow>
        </div>

        <div
          style={{
            fontFamily: FONT.display,
            fontSize: SIZE.h1,
            color: COLORS.textPrimary,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            opacity: fadeIn(frame, 20),
            transform: `translateY(${slideUp(frame, 20)}px)`,
            marginBottom: 32,
          }}
        >
          <span style={{ color: COLORS.accent }}>Agende uma demonstração.</span>
          <br />
          Em 30 minutos mostramos sua operação na Atlântico.
        </div>

        <div
          style={{
            marginTop: 60,
            background: COLORS.accent,
            color: COLORS.bg,
            fontFamily: FONT.display,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            padding: "28px 64px",
            opacity: fadeIn(frame, 50),
            transform: `translateY(${slideUp(frame, 50)}px)`,
            display: "inline-flex",
            alignItems: "center",
            gap: 24,
            boxShadow: `0 20px 60px rgba(249,115,22,0.35)`,
          }}
        >
          Agendar Demonstração
          <span
            style={{
              fontSize: 36,
              display: "inline-block",
              transform: `translateX(${(arrowPulse - 1) * 30}px)`,
            }}
          >
            →
          </span>
        </div>

        <div
          style={{
            marginTop: 80,
            fontFamily: FONT.mono,
            fontSize: SIZE.body,
            color: COLORS.textSecondary,
            letterSpacing: "0.10em",
            opacity: fadeIn(frame, 80),
          }}
        >
          {URL_SITE.replace("https://", "")}
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 120,
          opacity: fadeIn(frame, 100),
        }}
      >
        <Logo scale={2.2} />
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CURSOR KEYFRAMES — uma definição por módulo (% do screenshot, ajuste fino depois)
// ═══════════════════════════════════════════════════════════════════════════
const cursorRelatorio: CursorKey[] = [
  { frame: 30, x: 12, y: 18 },
  { frame: 70, x: 30, y: 22, click: true },
  { frame: 110, x: 65, y: 50 },
  { frame: 150, x: 65, y: 50, click: true },
  { frame: 200, x: 88, y: 12 },
];

const cursorRdo: CursorKey[] = [
  { frame: 30, x: 12, y: 18 },
  { frame: 65, x: 50, y: 28, click: true },
  { frame: 110, x: 80, y: 12 },
  { frame: 145, x: 80, y: 12, click: true },
  { frame: 200, x: 60, y: 60 },
];

const cursorQuant: CursorKey[] = [
  { frame: 30, x: 8, y: 8 },
  { frame: 70, x: 88, y: 5, click: true },
  { frame: 110, x: 16, y: 50 },
  { frame: 150, x: 16, y: 50, click: true },
  { frame: 200, x: 85, y: 90 },
];

const cursorAgenda: CursorKey[] = [
  { frame: 30, x: 12, y: 12 },
  { frame: 60, x: 18, y: 10, click: true },
  { frame: 100, x: 50, y: 35 },
  { frame: 140, x: 50, y: 35, click: true },
  { frame: 200, x: 92, y: 10, click: true },
];

const cursorGestao: CursorKey[] = [
  { frame: 30, x: 10, y: 22 },
  { frame: 70, x: 18, y: 36, click: true },
  { frame: 120, x: 58, y: 72 },
  { frame: 160, x: 58, y: 72, click: true },
  { frame: 200, x: 12, y: 14 },
];

const cursorLps: CursorKey[] = [
  { frame: 30, x: 14, y: 22 },
  { frame: 65, x: 24, y: 42, click: true },
  { frame: 105, x: 36, y: 42, click: true },
  { frame: 145, x: 48, y: 42, click: true },
  { frame: 200, x: 14, y: 80 },
];

const cursorBim: CursorKey[] = [
  { frame: 30, x: 42, y: 12 },
  { frame: 65, x: 52, y: 12, click: true },
  { frame: 110, x: 90, y: 70 },
  { frame: 150, x: 90, y: 70, click: true },
  { frame: 200, x: 50, y: 40 },
];

// ═══════════════════════════════════════════════════════════════════════════
// HIGHLIGHTS por módulo — retângulos accent ao redor de áreas-chave
// ═══════════════════════════════════════════════════════════════════════════
const highlightsRelatorio: Highlight[] = [
  { from: 60, to: 130, x: 20, y: 18, w: 30, h: 12, label: "KPIs RAG" },
  { from: 140, to: 210, x: 5, y: 40, w: 90, h: 35, label: "Curva-S em tempo real" },
];

const highlightsRdo: Highlight[] = [
  { from: 55, to: 125, x: 30, y: 18, w: 50, h: 18, label: "KPIs do dia" },
  { from: 135, to: 205, x: 5, y: 45, w: 90, h: 50, label: "Atividades por status" },
];

const highlightsQuant: Highlight[] = [
  { from: 60, to: 130, x: 80, y: 0, w: 18, h: 9, label: "Exportar Excel" },
  { from: 140, to: 210, x: 0, y: 30, w: 100, h: 60, label: "Composição SINAPI" },
];

const highlightsAgenda: Highlight[] = [
  { from: 50, to: 120, x: 12, y: 5, w: 18, h: 12, label: "Modo Gantt" },
  { from: 130, to: 200, x: 22, y: 22, w: 75, h: 70, label: "10 semanas · 6 recursos" },
];

const highlightsGestao: Highlight[] = [
  { from: 60, to: 130, x: 5, y: 14, w: 95, h: 14, label: "EAC · CPI · SPI ao vivo" },
  { from: 140, to: 210, x: 5, y: 45, w: 95, h: 50, label: "Mapa multiportfólio" },
];

const highlightsLps: Highlight[] = [
  { from: 55, to: 195, x: 18, y: 30, w: 38, h: 60, label: "Look-ahead 6 semanas" },
];

const highlightsBim: Highlight[] = [
  { from: 55, to: 100, x: 38, y: 5, w: 18, h: 12, label: "Análise 5D" },
  { from: 110, to: 200, x: 80, y: 60, w: 18, h: 12, label: "Heatmap" },
];

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSIÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export const ExplainerModulos: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <Sequence
        from={positions.problema.from}
        durationInFrames={positions.problema.duration}
      >
        <SceneWrapper duration={positions.problema.duration}>
          <SceneProblema />
        </SceneWrapper>
      </Sequence>

      <Sequence
        from={positions.logo.from}
        durationInFrames={positions.logo.duration}
      >
        <SceneWrapper duration={positions.logo.duration}>
          <SceneLogo />
        </SceneWrapper>
      </Sequence>

      <Sequence
        from={positions.promessa.from}
        durationInFrames={positions.promessa.duration}
      >
        <SceneWrapper duration={positions.promessa.duration}>
          <ScenePromessa />
        </SceneWrapper>
      </Sequence>

      <Sequence
        from={positions.grid.from}
        durationInFrames={positions.grid.duration}
      >
        <SceneWrapper duration={positions.grid.duration}>
          <SceneGrid />
        </SceneWrapper>
      </Sequence>

      {/* RELATÓRIO 360 */}
      <Sequence
        from={positions.relatorio.from}
        durationInFrames={positions.relatorio.duration}
      >
        <SceneWrapper duration={positions.relatorio.duration}>
          <ModuleShowcase
            eyebrow="01 / Relatório 360"
            title="Dashboard executivo 360°"
            body="Curva-S, alertas RAG, KPIs em tempo real e visão consolidada do projeto inteiro. O painel que o board olha de manhã."
            screenshots={["relatorio-360.png"]}
            cursorKeyframes={cursorRelatorio}
            highlights={highlightsRelatorio}
            captions={[
              { from: 30, text: "Curva-S e KPIs em tempo real" },
              { from: 110, text: "Alertas RAG por categoria" },
              { from: 170, text: "Visão executiva 360°" },
            ]}
            urlSuffix="/relatorio-360"
            moduleNumber="01 / 16"
          />
        </SceneWrapper>
      </Sequence>

      {/* RDO */}
      <Sequence
        from={positions.rdo.from}
        durationInFrames={positions.rdo.duration}
      >
        <SceneWrapper duration={positions.rdo.duration}>
          <ModuleShowcase
            eyebrow="12 / RDO"
            title="Relatório Diário com IA preditiva"
            body="Mão de obra, equipamentos, clima, ocorrências e progresso por atividade — em um único formulário digital integrado ao planejamento."
            screenshots={["rdo-dashboard.png"]}
            cursorKeyframes={cursorRdo}
            highlights={highlightsRdo}
            captions={[
              { from: 30, text: "Dashboard executivo do dia" },
              { from: 100, text: "Atividades agrupadas por status" },
              { from: 170, text: "Exportação automática em PDF" },
            ]}
            urlSuffix="/rdo"
            moduleNumber="12 / 16"
          />
        </SceneWrapper>
      </Sequence>

      {/* QUANTITATIVOS */}
      <Sequence
        from={positions.quant.from}
        durationInFrames={positions.quant.duration}
      >
        <SceneWrapper duration={positions.quant.duration}>
          <ModuleShowcase
            eyebrow="13 / Quantitativos"
            title="BOQ com base SINAPI / SEINFRA"
            body="Composição completa de orçamento com BDI configurável. Importação direta de Pré-Construção e Suprimentos, exportação para Excel, CSV ou PDF."
            screenshots={["quantitativos.png"]}
            cursorKeyframes={cursorQuant}
            highlights={highlightsQuant}
            captions={[
              { from: 20, text: "Base SINAPI · SEINFRA · Própria" },
              { from: 80, text: "Exportação para Excel ou CSV" },
              { from: 140, text: "10 itens · BDI global 25%" },
              { from: 200, text: "Total: R$ 240.807,50" },
            ]}
            urlSuffix="/quantitativos"
            moduleNumber="13 / 16"
          />
        </SceneWrapper>
      </Sequence>

      {/* AGENDA */}
      <Sequence
        from={positions.agenda.from}
        durationInFrames={positions.agenda.duration}
      >
        <SceneWrapper duration={positions.agenda.duration}>
          <ModuleShowcase
            eyebrow="02 / Agenda"
            title="Gantt e Calendário sincronizados"
            body="Visualização Gantt, calendário, semanal, mensal — todas alimentadas pela mesma fonte de dados. Detecção automática de conflitos de recursos."
            screenshots={["agenda-gantt.png"]}
            cursorKeyframes={cursorAgenda}
            highlights={highlightsAgenda}
            captions={[
              { from: 30, text: "Visualização Gantt ativada" },
              { from: 100, text: "10 semanas em uma única tela" },
              { from: 170, text: "Tarefas agrupadas por equipamento" },
            ]}
            urlSuffix="/agenda"
            moduleNumber="02 / 16"
          />
        </SceneWrapper>
      </Sequence>

      {/* GESTÃO 360 */}
      <Sequence
        from={positions.gestao.from}
        durationInFrames={positions.gestao.duration}
      >
        <SceneWrapper duration={positions.gestao.duration}>
          <ModuleShowcase
            eyebrow="16 / Gestão 360"
            title="Centro de Comando multiportfólio"
            body="EAC, CPI e SPI calculados em tempo real. Filtragem por criticidade, drill-down por projeto direto no mapa, ordens de mudança e simulação de atrasos."
            screenshots={["gestao360.png"]}
            cursorKeyframes={cursorGestao}
            highlights={highlightsGestao}
            captions={[
              { from: 30, text: "EAC, CPI e SPI ao vivo" },
              { from: 90, text: "Filtragem por criticidade" },
              { from: 160, text: "Drill-down por projeto no mapa" },
            ]}
            urlSuffix="/gestao-360"
            moduleNumber="16 / 16"
          />
        </SceneWrapper>
      </Sequence>

      {/* LPS / LEAN */}
      <Sequence
        from={positions.lps.from}
        durationInFrames={positions.lps.duration}
      >
        <SceneWrapper duration={positions.lps.duration}>
          <ModuleShowcase
            eyebrow="11 / LPS / Lean"
            title="Last Planner System completo"
            body="Look-ahead de 6 semanas, PPC semanal, restrições, takt time e mão de obra integrados. Click pra planejar, marcar como concluído ou remover."
            screenshots={["lps-lookahead.png"]}
            cursorKeyframes={cursorLps}
            highlights={highlightsLps}
            captions={[
              { from: 30, text: "Look-ahead de 6 semanas" },
              { from: 90, text: "Click pra planejar / concluir" },
              { from: 170, text: "PPC semanal automático" },
            ]}
            urlSuffix="/lps"
            moduleNumber="11 / 16"
          />
        </SceneWrapper>
      </Sequence>

      {/* BIM 3D/4D/5D */}
      <Sequence
        from={positions.bim.from}
        durationInFrames={positions.bim.duration}
      >
        <SceneWrapper duration={positions.bim.duration}>
          <ModuleShowcase
            eyebrow="14 / BIM 3D/4D/5D"
            title="Modelo conectado ao cronograma e ao custo"
            body="Visualizador BIM standalone com simulação temporal 4D, análise 5D de custos por elemento e heatmap visual. O modelo BIM virou painel de decisão."
            screenshots={["bim-5d.png"]}
            cursorKeyframes={cursorBim}
            highlights={highlightsBim}
            captions={[
              { from: 30, text: "Modelo 3D · 4D · 5D" },
              { from: 90, text: "Análise 5D — R$ 13.5M projetados" },
              { from: 170, text: "Heatmap de custo por elemento" },
            ]}
            urlSuffix="/bim"
            moduleNumber="14 / 16"
          />
        </SceneWrapper>
      </Sequence>

      <Sequence
        from={positions.stats.from}
        durationInFrames={positions.stats.duration}
      >
        <SceneWrapper duration={positions.stats.duration}>
          <SceneStats />
        </SceneWrapper>
      </Sequence>

      <Sequence
        from={positions.cta.from}
        durationInFrames={positions.cta.duration}
      >
        <SceneWrapper duration={positions.cta.duration}>
          <SceneCta />
        </SceneWrapper>
      </Sequence>

      {/* Progress bar global — sempre visível, no rodapé */}
      <GlobalProgressBar totalDuration={EXPLAINER_DURATION} />
    </AbsoluteFill>
  );
};
