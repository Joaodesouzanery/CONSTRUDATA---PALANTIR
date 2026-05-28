import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import { COLORS, FONT } from "../tokens";

type IconType = "eye" | "bell" | "zoomIn";

const ICONS: Record<IconType, React.ReactNode> = {
  eye: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  bell: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  zoomIn: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  ),
};

export const BenefitCard: React.FC<{
  icon: IconType;
  title: string;
  description: string;
  delay?: number;
}> = ({ icon, title, description, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const op = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const y = interpolate(frame, [delay, delay + 20], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const scaleSpring = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 14 },
  });

  return (
    <div
      style={{
        width: 400,
        height: 220,
        background: COLORS.card,
        border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: 12,
        padding: "32px 28px",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        opacity: op,
        transform: `translateY(${y}px) scale(${0.9 + scaleSpring * 0.1})`,
        transformOrigin: "center",
      }}
    >
      <div style={{ color: COLORS.accent }}>{ICONS[icon]}</div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 26,
          fontWeight: 700,
          color: COLORS.textPrimary,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: FONT.body,
          fontSize: 18,
          color: COLORS.textSecondary,
          lineHeight: 1.4,
        }}
      >
        {description}
      </div>
    </div>
  );
};
