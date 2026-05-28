import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Img,
  staticFile,
  Easing,
} from "remotion";
import { COLORS, FONT, URL_SITE } from "../tokens";
import { Eyebrow } from "./Eyebrow";
import { BrowserFrame } from "./BrowserFrame";
import { Cursor, type CursorKey } from "./Cursor";

export type Caption = { from: number; text: string };
export type Highlight = {
  from: number;
  to: number;
  x: number; // %
  y: number; // %
  w: number; // %
  h: number; // %
  label?: string;
};

// DotGrid background — replica da Landing
const DotGridBg: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: COLORS.bg,
      backgroundImage: `radial-gradient(circle, ${COLORS.surface} 1px, transparent 1px)`,
      backgroundSize: "28px 28px",
    }}
  />
);

export const ModuleShowcase: React.FC<{
  eyebrow: string;
  title: string;
  body: string;
  screenshots: string[];
  screenshotSwapAt?: number;
  cursorKeyframes: CursorKey[];
  captions?: Caption[];
  highlights?: Highlight[];
  urlSuffix?: string;
  moduleNumber?: string; // "05 / 16"
}> = ({
  eyebrow,
  title,
  body,
  screenshots,
  screenshotSwapAt,
  cursorKeyframes,
  captions = [],
  highlights = [],
  urlSuffix = "",
  moduleNumber,
}) => {
  const frame = useCurrentFrame();

  const currentScreenshot =
    screenshotSwapAt && frame >= screenshotSwapAt
      ? screenshots[1] ?? screenshots[0]
      : screenshots[0];

  // ── Entradas ──────────────────────────────────────────────────────────────
  const headerOp = interpolate(frame, [0, 24], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const bodyOp = interpolate(frame, [10, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const browserOp = interpolate(frame, [16, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const browserScale = interpolate(frame, [16, 46], [0.96, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Ken Burns
  const kenBurns = interpolate(frame, [16, 240], [1.0, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const swapKenBurns =
    screenshotSwapAt && frame >= screenshotSwapAt
      ? interpolate(
          frame,
          [screenshotSwapAt, screenshotSwapAt + 200],
          [1.0, 1.05],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.cubic),
          }
        )
      : kenBurns;

  // Scan line — linha accent varre top→bottom no início (frames 30-60)
  const scanProgress = interpolate(frame, [30, 60], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const scanOpacity = interpolate(frame, [28, 35, 55, 62], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Caption ativa
  const activeCaption = [...captions].reverse().find((c) => frame >= c.from);
  const captionEnterFrame = activeCaption ? activeCaption.from : 0;
  const captionOp = interpolate(
    frame,
    [captionEnterFrame, captionEnterFrame + 12],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <AbsoluteFill>
      <DotGridBg />

      {/* Eyebrow */}
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 100,
          opacity: headerOp,
          transform: `translateY(${(1 - headerOp) * 12}px)`,
        }}
      >
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>

      {/* Module counter (top-right) */}
      {moduleNumber && (
        <div
          style={{
            position: "absolute",
            top: 70,
            right: 100,
            fontFamily: FONT.mono,
            fontSize: 22,
            color: COLORS.textMuted,
            letterSpacing: "0.20em",
            opacity: interpolate(frame, [12, 36], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{ width: 32, height: 1, background: COLORS.borderMid }}
          />
          {moduleNumber}
        </div>
      )}

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 100,
          right: 100,
          fontFamily: FONT.display,
          fontSize: 56,
          fontWeight: 700,
          color: COLORS.textPrimary,
          letterSpacing: "-0.02em",
          lineHeight: 1.08,
          opacity: headerOp,
          transform: `translateY(${(1 - headerOp) * 18}px)`,
        }}
      >
        {title}
      </div>

      {/* Body */}
      <div
        style={{
          position: "absolute",
          top: 200,
          left: 100,
          right: 100,
          fontFamily: FONT.body,
          fontSize: 24,
          color: COLORS.textSecondary,
          lineHeight: 1.5,
          maxWidth: 1200,
          opacity: bodyOp,
        }}
      >
        {body}
      </div>

      {/* Browser frame com screenshot */}
      <div
        style={{
          position: "absolute",
          top: 270,
          left: 110,
          right: 110,
          bottom: 90,
          opacity: browserOp,
          transform: `scale(${browserScale})`,
          transformOrigin: "center top",
        }}
      >
        <BrowserFrame url={`${URL_SITE.replace("https://", "")}${urlSuffix}`}>
          <div
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "hidden",
            }}
          >
            <Img
              key={currentScreenshot}
              src={staticFile(`screenshots/${currentScreenshot}`)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
                transform: `scale(${swapKenBurns})`,
                transformOrigin: "center center",
              }}
            />

            {/* Vignette — escurece bordas para focar centro */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.40) 100%)",
              }}
            />

            {/* Scan line reveal */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: `${scanProgress}%`,
                height: 3,
                background: `linear-gradient(180deg, transparent, ${COLORS.accent}, transparent)`,
                boxShadow: `0 0 24px ${COLORS.accent}`,
                opacity: scanOpacity,
                pointerEvents: "none",
              }}
            />

            {/* Highlight rectangles — desenham borda accent ao redor de áreas */}
            {highlights.map((h, i) => {
              if (frame < h.from || frame > h.to + 20) return null;
              const drawT = interpolate(frame, [h.from, h.from + 18], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              });
              const fadeT = interpolate(frame, [h.to, h.to + 20], [1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const op = Math.min(drawT, fadeT);
              // perímetro animado via clip-path inset
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: `${h.x}%`,
                    top: `${h.y}%`,
                    width: `${h.w}%`,
                    height: `${h.h}%`,
                    border: `2px solid ${COLORS.accent}`,
                    boxShadow: `0 0 0 1px rgba(249,115,22,0.30), 0 0 24px rgba(249,115,22,0.40)`,
                    opacity: op,
                    pointerEvents: "none",
                  }}
                >
                  {h.label && (
                    <div
                      style={{
                        position: "absolute",
                        top: -32,
                        left: 0,
                        fontFamily: FONT.mono,
                        fontSize: 13,
                        color: COLORS.accent,
                        background: COLORS.bg,
                        padding: "4px 10px",
                        border: `1px solid ${COLORS.accent}`,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h.label}
                    </div>
                  )}
                </div>
              );
            })}

            <Cursor keyframes={cursorKeyframes} showFrom={20} />

            {/* Caption */}
            {activeCaption && (
              <div
                style={{
                  position: "absolute",
                  bottom: 32,
                  left: 32,
                  background: "rgba(44,44,44,0.94)",
                  borderLeft: `3px solid ${COLORS.accent}`,
                  padding: "16px 24px",
                  fontFamily: FONT.mono,
                  fontSize: 18,
                  color: COLORS.textPrimary,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  maxWidth: 700,
                  opacity: captionOp,
                  transform: `translateX(${(1 - captionOp) * -16}px)`,
                  backdropFilter: "blur(4px)",
                }}
              >
                <span style={{ color: COLORS.accent, marginRight: 12 }}>›</span>
                {activeCaption.text}
              </div>
            )}
          </div>
        </BrowserFrame>
      </div>
    </AbsoluteFill>
  );
};
