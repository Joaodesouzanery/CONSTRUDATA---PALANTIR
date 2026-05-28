import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, FONT } from "../tokens";

type PainType = "spreadsheet" | "whatsapp" | "email" | "meeting";

const ICONS: Record<PainType, React.ReactNode> = {
  spreadsheet: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.ragRed} strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  whatsapp: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.ragRed} strokeWidth="1.5">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  email: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.ragRed} strokeWidth="1.5">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22,4 12,13 2,4" />
    </svg>
  ),
  meeting: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={COLORS.ragRed} strokeWidth="1.5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

export const PainIcon: React.FC<{
  icon: PainType;
  label: string;
  delay?: number;
}> = ({ icon, label, delay = 0 }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [delay, delay + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const y = interpolate(frame, [delay, delay + 18], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        width: 200,
        height: 140,
        background: COLORS.card,
        border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        opacity: op,
        transform: `translateY(${y}px)`,
      }}
    >
      {ICONS[icon]}
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 18,
          color: COLORS.textSecondary,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
};
