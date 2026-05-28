import React from "react";
import { COLORS, FONT } from "../tokens";

// Eyebrow / kicker — barra accent + label uppercase letter-spacing 0.20em.
// Replica o pattern de HeroSection.tsx (linhas 225-230 da Landing).
export const Eyebrow: React.FC<{
  children: React.ReactNode;
  accent?: boolean;
  size?: number;
}> = ({ children, accent = true, size = 22 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
    <div
      style={{
        height: 2,
        width: 64,
        background: accent ? COLORS.accent : COLORS.textFaint,
      }}
    />
    <span
      style={{
        fontFamily: FONT.display,
        color: accent ? COLORS.accent : COLORS.textMuted,
        fontSize: size,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.20em",
      }}
    >
      {children}
    </span>
  </div>
);
