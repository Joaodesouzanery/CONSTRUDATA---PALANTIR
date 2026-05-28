import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, FONT } from "../tokens";

type ObraStatus = "active" | "planning" | "paused" | "completed";

const STATUS_COLORS: Record<ObraStatus, string> = {
  active: COLORS.ragGreen,
  planning: COLORS.statusPlanning,
  paused: COLORS.ragAmber,
  completed: COLORS.statusCompleted,
};

const STATUS_LABELS: Record<ObraStatus, string> = {
  active: "ATIVA",
  planning: "PLANEJAMENTO",
  paused: "PAUSADA",
  completed: "CONCLUÍDA",
};

export const ObraCard: React.FC<{
  code: string;
  name: string;
  status: ObraStatus;
  riskCount?: number;
  city: string;
  manager: string;
  delay?: number;
  selected?: boolean;
}> = ({
  code,
  name,
  status,
  riskCount = 0,
  city,
  manager,
  delay = 0,
  selected = false,
}) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [delay, delay + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const y = interpolate(frame, [delay, delay + 18], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <div
      style={{
        width: 260,
        height: 140,
        background: COLORS.cardHover,
        border: `${selected ? 2 : 1}px solid ${selected ? COLORS.accent : COLORS.borderStrong}`,
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        opacity: op,
        transform: `translateY(${y}px)`,
        boxShadow: selected ? `0 0 0 1px ${COLORS.accent}, 0 0 20px rgba(249,115,22,0.15)` : "none",
        flexShrink: 0,
      }}
    >
      {/* Header: status dot + code + badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
          <span style={{ fontFamily: FONT.mono, fontSize: 12, color: COLORS.textMuted }}>{code}</span>
        </div>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9,
            fontWeight: 600,
            color,
            letterSpacing: "0.06em",
            border: `1px solid ${color}`,
            padding: "2px 6px",
            borderRadius: 3,
          }}
        >
          {label}
        </span>
      </div>

      {/* Name */}
      <div
        style={{
          fontFamily: FONT.body,
          fontSize: 16,
          fontWeight: 600,
          color: COLORS.textPrimary,
          lineHeight: 1.2,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {name}
      </div>

      {/* Bottom: city + manager + risk */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: FONT.body, fontSize: 11, color: COLORS.textMuted }}>{manager}</span>
        {riskCount > 0 && (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              fontWeight: 600,
              color: COLORS.ragRed,
              letterSpacing: "0.04em",
            }}
          >
            {riskCount} crítico{riskCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
};
