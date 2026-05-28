/**
 * TorreDeControle — Vídeo standalone de ~73s mostrando o módulo
 * Torre de Controle do Atlântico ConstruData.
 *
 * 6 cenas com crossfade de 24 frames entre cada:
 *   1. Abertura       (5s)    — Logo + título + subtítulo
 *   2. O Problema     (9.3s)  — Typewriter rápido + pain icons + transição
 *   3. Demo Mapa      (13.3s) — Screenshot real + alertas/updates animados
 *   4. Demo Detail    (14s)   — DrillDown + RAG → KPIs + Alerts (tudo junto)
 *   5. Benefícios     (18.3s) — 3 BenefitCards + headline
 *   6. CTA            (17.3s) — Agendar Demonstração + URL
 *
 * Resolução: 1920×1080 (16:9), 30fps. Fundo #1f1f1f.
 */
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLORS, FONT, SIZE, URL_SITE } from "./tokens";

// Componentes reutilizados do ExplainerModulos
import { Logo } from "../ExplainerModulos/parts/Logo";
import { Eyebrow } from "../ExplainerModulos/parts/Eyebrow";
import { BrowserFrame } from "../ExplainerModulos/parts/BrowserFrame";
import { GlobalProgressBar } from "../ExplainerModulos/parts/ProgressBar";

// Componentes do Torre de Controle
import { Typewriter } from "./parts/Typewriter";
import { PainIcon } from "./parts/PainIcon";
import { KpiCard } from "./parts/KpiCard";
import { AlertFeed } from "./parts/AlertFeed";
import { RagMatrix } from "./parts/RagMatrix";
import { BenefitCard } from "./parts/BenefitCard";

// ─── Exports ────────────────────────────────────────────────────────────────
export const TORRE_FPS = 30;
export const TORRE_W = 1920;
export const TORRE_H = 1080;

const OVERLAP = 24;

const dur = {
  abertura: 150,
  problema: 280,
  demoMapa: 400,
  demoDetail: 420,
  beneficios: 550,
  cta: 520,
};

const seqList = [
  "abertura",
  "problema",
  "demoMapa",
  "demoDetail",
  "beneficios",
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

export const TORRE_DURATION = positions.cta.from + positions.cta.duration;

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

const SceneWrapper: React.FC<{ duration: number; children: React.ReactNode }> = ({
  duration,
  children,
}) => {
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
// CENA 1 — ABERTURA (5s)
// ═══════════════════════════════════════════════════════════════════════════
const SceneAbertura: React.FC = () => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const logoSpring = spring({
    frame: frame - 10,
    fps: config.fps,
    config: { damping: 14 },
  });

  return (
    <AbsoluteFill>
      <DotGrid />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `scale(${0.8 + logoSpring * 0.2}) translateY(${(1 - logoSpring) * 20}px)`,
            opacity: logoSpring,
            marginBottom: 50,
          }}
        >
          <Logo scale={6} />
        </div>

        <div style={{ opacity: fadeIn(frame, 25), marginBottom: 20 }}>
          <Eyebrow size={18}>Módulo 05</Eyebrow>
        </div>

        <div
          style={{
            fontFamily: FONT.display,
            fontSize: SIZE.h1,
            fontWeight: 700,
            color: COLORS.textPrimary,
            letterSpacing: "-0.02em",
            textAlign: "center",
            opacity: fadeIn(frame, 40),
            transform: `translateY(${slideUp(frame, 40)}px)`,
          }}
        >
          Torre de Controle
        </div>

        <div
          style={{
            fontFamily: FONT.body,
            fontSize: SIZE.h3,
            color: COLORS.textSecondary,
            textAlign: "center",
            marginTop: 24,
            opacity: fadeIn(frame, 60),
          }}
        >
          Visão Estratégica, Decisão Instantânea
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 2 — O PROBLEMA (9.3s — mais rápido)
// ═══════════════════════════════════════════════════════════════════════════
const SceneProblema: React.FC = () => {
  const frame = useCurrentFrame();

  // Dashboard glow transition no final
  const dashGlow = interpolate(frame, [220, 270], [0, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const contentFade = interpolate(frame, [210, 240], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <DotGrid />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, rgba(249,115,22,${dashGlow * 0.15}) 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{ alignItems: "center", justifyContent: "center", opacity: contentFade }}
      >
        {/* Typewriter rápido (speed 1.5 = ~1.5 frame/char) */}
        <div style={{ marginBottom: 60 }}>
          <Typewriter
            text="O gerente precisa acompanhar 5 obras ao mesmo tempo."
            startFrame={5}
            speed={1.5}
          />
        </div>

        {/* Pain icons 2×2 — stagger mais apertado */}
        <div style={{ display: "grid", gridTemplateColumns: "200px 200px", gap: 20, marginBottom: 50 }}>
          <PainIcon icon="spreadsheet" label="Planilhas" delay={60} />
          <PainIcon icon="whatsapp" label="WhatsApp" delay={72} />
          <PainIcon icon="email" label="E-mails" delay={84} />
          <PainIcon icon="meeting" label="Reuniões" delay={96} />
        </div>

        {/* 2º texto — aparece logo */}
        <Typewriter
          text="Sem uma visão unificada, decisões atrasam dias."
          startFrame={120}
          speed={1.5}
          fontSize={SIZE.h3}
          color={COLORS.textSecondary}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 3 — DEMO MAPA (13.3s — screenshot real + alertas por cima)
// ═══════════════════════════════════════════════════════════════════════════
const SceneDemoMapa: React.FC = () => {
  const frame = useCurrentFrame();

  // Ken Burns sutil
  const zoom = interpolate(frame, [30, 380], [1.0, 1.06], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Scan line reveal
  const scanY = interpolate(frame, [30, 65], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const scanOp = interpolate(frame, [28, 35, 60, 67], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Alertas/updates flutuantes sobre o mapa
  const UPDATES = [
    { from: 80, x: "62%", y: "12%", text: "OBR-001 · 2 riscos críticos", color: COLORS.ragRed },
    { from: 130, x: "38%", y: "18%", text: "OBR-002 · Fundação concluída ✓", color: COLORS.ragGreen },
    { from: 180, x: "55%", y: "28%", text: "OBR-003 · CPI 0.74 — abaixo do alvo", color: COLORS.ragAmber },
    { from: 240, x: "20%", y: "70%", text: "Novo milestone em OBR-001", color: COLORS.accent },
    { from: 300, x: "70%", y: "65%", text: "OBR-003 · Orçamento atualizado", color: COLORS.statusPlanning },
  ];

  // Cursor navegando pelo mapa
  const cursorOp = fadeIn(frame, 60);
  const cursorX = interpolate(
    frame,
    [60, 110, 160, 220, 300, 380],
    [50, 65, 40, 55, 22, 70],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }
  );
  const cursorY = interpolate(
    frame,
    [60, 110, 160, 220, 300, 380],
    [50, 30, 35, 45, 72, 65],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) }
  );

  // Click rings em momentos específicos
  const clickFrames = [110, 220];

  return (
    <AbsoluteFill>
      <DotGrid />

      {/* Header */}
      <div style={{ position: "absolute", top: 50, left: 80, zIndex: 10, opacity: fadeIn(frame, 0) }}>
        <Eyebrow>Torre de Controle · Dashboard</Eyebrow>
      </div>

      {/* Browser frame com screenshot real */}
      <div
        style={{
          position: "absolute",
          top: 100,
          left: 60,
          right: 60,
          bottom: 50,
          opacity: interpolate(frame, [10, 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          }),
          transform: `scale(${interpolate(frame, [10, 40], [0.97, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          })})`,
          transformOrigin: "center top",
        }}
      >
        <BrowserFrame url="construdata.software/torre-de-controle">
          <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
            {/* Screenshot real */}
            <Img
              src={staticFile("screenshots/torre-controle-mapa.png")}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
              }}
            />

            {/* Vignette */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.40) 100%)",
              }}
            />

            {/* Scan line */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${scanY}%`,
                height: 3,
                background: `linear-gradient(180deg, transparent, ${COLORS.accent}, transparent)`,
                boxShadow: `0 0 24px ${COLORS.accent}`,
                opacity: scanOp,
                pointerEvents: "none",
              }}
            />

            {/* Alertas/updates flutuantes */}
            {UPDATES.map((u, i) => {
              const op = interpolate(frame, [u.from, u.from + 14], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              });
              const y = interpolate(frame, [u.from, u.from + 14], [16, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              });
              // Fade out after 120 frames
              const fadeOp = interpolate(frame, [u.from + 100, u.from + 120], [1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: u.x,
                    top: u.y,
                    opacity: op * fadeOp,
                    transform: `translateY(${y}px)`,
                    background: "rgba(31,31,31,0.94)",
                    borderLeft: `3px solid ${u.color}`,
                    padding: "10px 16px",
                    fontFamily: FONT.mono,
                    fontSize: 14,
                    color: COLORS.textPrimary,
                    letterSpacing: "0.04em",
                    maxWidth: 340,
                    backdropFilter: "blur(4px)",
                    zIndex: 20,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ color: u.color, marginRight: 8 }}>●</span>
                  {u.text}
                </div>
              );
            })}

            {/* Cursor */}
            <svg
              width={32}
              height={38}
              viewBox="0 0 24 28"
              style={{
                position: "absolute",
                left: `${cursorX}%`,
                top: `${cursorY}%`,
                filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))",
                pointerEvents: "none",
                zIndex: 100,
                opacity: cursorOp,
              }}
            >
              <path d="M3 2 L3 22 L8 18 L11 26 L14 25 L11 17 L18 17 Z" fill="#fff" stroke="#000" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>

            {/* Click rings */}
            {clickFrames.map((cf, i) => {
              const elapsed = frame - cf;
              if (elapsed < 0 || elapsed > 35) return null;
              const scale = interpolate(elapsed, [0, 35], [0.3, 2.2], { easing: Easing.out(Easing.cubic) });
              const op = interpolate(elapsed, [0, 35], [0.9, 0]);
              const cx = interpolate(cf, [60, 110, 160, 220, 300, 380], [50, 65, 40, 55, 22, 70], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const cy = interpolate(cf, [60, 110, 160, 220, 300, 380], [50, 30, 35, 45, 72, 65], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${cx}%`,
                    top: `${cy}%`,
                    width: 70,
                    height: 70,
                    marginLeft: -35,
                    marginTop: -35,
                    borderRadius: "50%",
                    border: `3px solid ${COLORS.accent}`,
                    transform: `scale(${scale})`,
                    opacity: op,
                    pointerEvents: "none",
                    zIndex: 99,
                  }}
                />
              );
            })}
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 4 — DEMO DETAIL (14s — DrillDown + KPIs + Alerts juntos)
// Primeiro aparece o drill-down, depois os KPIs deslizam por cima.
// ═══════════════════════════════════════════════════════════════════════════
const SceneDemoDetail: React.FC = () => {
  const frame = useCurrentFrame();

  // Fase 1 (frames 0-200): DrillDown
  // Fase 2 (frames 180+): KPIs + Alerts sobem por cima
  const phase2T = interpolate(frame, [180, 210], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const phase1Fade = interpolate(frame, [180, 220], [1, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <DotGrid />

      {/* ── FASE 1: DrillDown ───────────────────────────────────────────── */}
      <AbsoluteFill style={{ padding: "70px 100px", opacity: phase1Fade }}>
        <div style={{ opacity: fadeIn(frame, 0), marginBottom: 30 }}>
          <Eyebrow>Drill-Down · OBR-001</Eyebrow>
        </div>

        <div style={{ display: "flex", gap: 50 }}>
          {/* Left: Detail */}
          <div style={{ width: 500, display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <span style={{ fontFamily: FONT.mono, fontSize: 14, color: COLORS.textMuted, background: COLORS.card, padding: "3px 10px", borderRadius: 4, border: `1px solid ${COLORS.borderStrong}` }}>OBR-001</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, color: COLORS.ragGreen, border: `1px solid ${COLORS.ragGreen}`, padding: "2px 8px", borderRadius: 3 }}>ATIVA</span>
              </div>
              <div style={{ fontFamily: FONT.display, fontSize: 34, fontWeight: 700, color: COLORS.textPrimary }}>Torre Residencial Paulista</div>
              <div style={{ fontFamily: FONT.body, fontSize: 16, color: COLORS.textMuted, marginTop: 6 }}>Av. Paulista, 1578 — Bela Vista, São Paulo / SP</div>
            </div>

            {/* Budget */}
            <div style={{ opacity: fadeIn(frame, 30) }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 12, color: COLORS.textMuted, letterSpacing: "0.10em", marginBottom: 10 }}>ORÇAMENTO</div>
              {[
                { cat: "Materiais", budget: "R$ 2.8M", proj: "R$ 3.1M", pct: 110, over: true },
                { cat: "Mão de Obra", budget: "R$ 4.2M", proj: "R$ 4.0M", pct: 95, over: false },
                { cat: "Equipamentos", budget: "R$ 1.5M", proj: "R$ 1.4M", pct: 93, over: false },
              ].map((r, i) => (
                <div key={r.cat} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr 50px", padding: "8px 0", borderBottom: `1px solid ${COLORS.borderSoft}`, fontFamily: FONT.body, fontSize: 14, opacity: fadeIn(frame, 40 + i * 8) }}>
                  <span style={{ color: COLORS.textSecondary }}>{r.cat}</span>
                  <span style={{ color: COLORS.textMuted, textAlign: "right" }}>{r.budget}</span>
                  <span style={{ color: COLORS.textSecondary, textAlign: "right" }}>{r.proj}</span>
                  <span style={{ color: r.over ? COLORS.ragRed : COLORS.ragGreen, textAlign: "right", fontFamily: FONT.mono, fontSize: 12 }}>{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: RAG Matrix */}
          <div style={{ flex: 1, opacity: fadeIn(frame, 60) }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 12, color: COLORS.textMuted, letterSpacing: "0.10em", marginBottom: 16 }}>MATRIZ DE RISCO RAG</div>
            <RagMatrix startFrame={70} fillDelay={4} />
          </div>
        </div>
      </AbsoluteFill>

      {/* ── FASE 2: KPIs + Alerts (sobem por cima) ──────────────────────── */}
      <AbsoluteFill
        style={{
          padding: "70px 100px",
          opacity: phase2T,
          transform: `translateY(${(1 - phase2T) * 60}px)`,
        }}
      >
        <div style={{ marginBottom: 30 }}>
          <Eyebrow>KPIs Executivos</Eyebrow>
        </div>

        <div style={{ display: "flex", gap: 50 }}>
          {/* KPIs */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
            <div style={{ display: "flex", gap: 20 }}>
              <KpiCard label="CPI" value={0.92} format="decimal" threshold={1.0} delay={190} />
              <KpiCard label="SPI" value={0.87} format="decimal" threshold={1.0} delay={200} />
              <KpiCard label="EAC" value={12.4} format="currency" delay={210} />
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <KpiCard label="OMs em Aberto" value={3} format="integer" delay={220} />
              <KpiCard label="Alertas Críticos" value={5} format="integer" threshold={3} delay={230} />
            </div>
          </div>

          {/* Alert feed */}
          <div style={{ width: 420 }}>
            <AlertFeed
              startFrame={220}
              stagger={18}
              alerts={[
                { severity: "critical", text: "OBR-003: CPI abaixo de 0.80" },
                { severity: "high", text: "OBR-001: 2 riscos críticos pendentes" },
                { severity: "medium", text: "OBR-004: Milestone próximo do prazo" },
                { severity: "low", text: "OBR-002: Fundação concluída ✓" },
              ]}
            />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 5 — BENEFÍCIOS (18.3s — mais tempo, cards mais rápidos)
// ═══════════════════════════════════════════════════════════════════════════
const SceneBeneficios: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <DotGrid />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ marginBottom: 60, opacity: fadeIn(frame, 0) }}>
          <Eyebrow>Benefícios</Eyebrow>
        </div>

        {/* Cards com delay menor (40 frames entre cada) */}
        <div style={{ display: "flex", gap: 40, marginBottom: 80 }}>
          <BenefitCard
            icon="eye"
            title="Visão 360° de todas as obras"
            description="Multiportfólio em uma tela. Status RAG por obra."
            delay={20}
          />
          <BenefitCard
            icon="bell"
            title="Alertas em tempo real"
            description="Notificação automática de desvios de CPI, SPI e riscos."
            delay={60}
          />
          <BenefitCard
            icon="zoomIn"
            title="Drill-down até a atividade"
            description="Do portfólio ao detalhe operacional em 3 cliques."
            delay={100}
          />
        </div>

        {/* Headline — aparece depois dos cards */}
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: SIZE.h2,
            fontWeight: 700,
            color: COLORS.textPrimary,
            textAlign: "center",
            letterSpacing: "-0.01em",
            opacity: fadeIn(frame, 160),
            transform: `translateY(${slideUp(frame, 160)}px)`,
          }}
        >
          De portfólio à atividade em{" "}
          <span style={{ color: COLORS.accent }}>3 cliques</span>.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// CENA 6 — CTA (17.3s)
// ═══════════════════════════════════════════════════════════════════════════
const SceneCta: React.FC = () => {
  const frame = useCurrentFrame();
  const arrowPulse = 1 + 0.18 * Math.sin(frame * 0.18);

  return (
    <AbsoluteFill>
      <DotGrid />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ marginBottom: 60, opacity: fadeIn(frame, 0) }}>
          <Eyebrow>Torre de Controle</Eyebrow>
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
          Quer ver isso funcionando
          <br />
          <span style={{ color: COLORS.accent }}>na sua obra?</span>
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
            borderRadius: 8,
            opacity: fadeIn(frame, 50),
            transform: `translateY(${slideUp(frame, 50)}px)`,
            display: "inline-flex",
            alignItems: "center",
            gap: 24,
            boxShadow: "0 20px 60px rgba(249,115,22,0.35)",
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

      <div style={{ position: "absolute", bottom: 80, left: 120, opacity: fadeIn(frame, 100) }}>
        <Logo scale={2.2} />
      </div>
    </AbsoluteFill>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSIÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export const TorreDeControle: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bg }}>
      <Sequence from={positions.abertura.from} durationInFrames={positions.abertura.duration}>
        <SceneWrapper duration={positions.abertura.duration}>
          <SceneAbertura />
        </SceneWrapper>
      </Sequence>

      <Sequence from={positions.problema.from} durationInFrames={positions.problema.duration}>
        <SceneWrapper duration={positions.problema.duration}>
          <SceneProblema />
        </SceneWrapper>
      </Sequence>

      <Sequence from={positions.demoMapa.from} durationInFrames={positions.demoMapa.duration}>
        <SceneWrapper duration={positions.demoMapa.duration}>
          <SceneDemoMapa />
        </SceneWrapper>
      </Sequence>

      <Sequence from={positions.demoDetail.from} durationInFrames={positions.demoDetail.duration}>
        <SceneWrapper duration={positions.demoDetail.duration}>
          <SceneDemoDetail />
        </SceneWrapper>
      </Sequence>

      <Sequence from={positions.beneficios.from} durationInFrames={positions.beneficios.duration}>
        <SceneWrapper duration={positions.beneficios.duration}>
          <SceneBeneficios />
        </SceneWrapper>
      </Sequence>

      <Sequence from={positions.cta.from} durationInFrames={positions.cta.duration}>
        <SceneWrapper duration={positions.cta.duration}>
          <SceneCta />
        </SceneWrapper>
      </Sequence>

      <GlobalProgressBar totalDuration={TORRE_DURATION} />
    </AbsoluteFill>
  );
};
