import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { COLORS, FONT } from "../tokens";

type KpiFormat = "decimal" | "currency" | "integer";

function formatValue(v: number, fmt: KpiFormat): string {
  if (fmt === "currency") return `R$ ${v.toFixed(1)}M`;
  if (fmt === "decimal") return v.toFixed(2);
  return Math.round(v).toString();
}

export const KpiCard: React.FC<{
  label: string;
  value: number;
  format?: KpiFormat;
  threshold?: number; // abaixo deste valor, cor vermelha
  delay?: number;
}> = ({ label, value, format = "decimal", threshold, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryScale = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 12 },
  });

  const animatedValue = interpolate(
    frame,
    [delay + 10, delay + 55],
    [0, value],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }
  );

  const isWarning = threshold !== undefined && value < threshold;
  const valueColor = isWarning ? COLORS.ragRed : COLORS.textPrimary;

  return (
    <div
      style={{
        width: 280,
        height: 160,
        background: COLORS.card,
        border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: 8,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        transform: `scale(${entryScale})`,
        transformOrigin: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Barra accent no topo */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: isWarning ? COLORS.ragRed : COLORS.accent,
        }}
      />

      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 14,
          color: COLORS.textMuted,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontFamily: FONT.display,
          fontSize: 48,
          fontWeight: 700,
          color: valueColor,
          letterSpacing: "-0.02em",
        }}
      >
        {formatValue(animatedValue, format)}
      </span>
    </div>
  );
};
