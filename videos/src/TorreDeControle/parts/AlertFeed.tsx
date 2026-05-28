import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, FONT } from "../tokens";

type Severity = "critical" | "high" | "medium" | "low";

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: COLORS.ragRed,
  high: COLORS.accent,
  medium: COLORS.ragAmber,
  low: COLORS.ragGreen,
};

export type AlertItem = {
  severity: Severity;
  text: string;
};

export const AlertFeed: React.FC<{
  alerts: AlertItem[];
  startFrame?: number;
  stagger?: number;
}> = ({ alerts, startFrame = 0, stagger = 22 }) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        width: 420,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 13,
          color: COLORS.textMuted,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          marginBottom: 8,
          opacity: interpolate(frame, [startFrame, startFrame + 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        ALERTAS EM TEMPO REAL
      </div>

      {alerts.map((a, i) => {
        const d = startFrame + 12 + i * stagger;
        const op = interpolate(frame, [d, d + 14], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const y = interpolate(frame, [d, d + 14], [24, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const color = SEVERITY_COLORS[a.severity];

        return (
          <div
            key={i}
            style={{
              background: COLORS.card,
              borderLeft: `3px solid ${color}`,
              borderRadius: 4,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              opacity: op,
              transform: `translateY(${y}px)`,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: FONT.body,
                fontSize: 16,
                color: COLORS.textOn,
                lineHeight: 1.3,
              }}
            >
              {a.text}
            </span>
          </div>
        );
      })}
    </div>
  );
};
