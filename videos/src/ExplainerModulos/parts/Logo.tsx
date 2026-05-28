import React from "react";
import { COLORS, FONT } from "../tokens";

// Replica idêntica do logo da Landing — 3 arcos concêntricos accent + lockup
// "ATLÂNTICO / ConstruData". Fonte: src/features/landing/components/LandingHeader.tsx
export const Logo: React.FC<{
  scale?: number;
  showWordmark?: boolean;
  vertical?: boolean;
}> = ({ scale = 1, showWordmark = true, vertical = false }) => {
  const iconW = 22 * scale;
  const iconH = 28 * scale;
  const sizePrimary = 14 * scale;
  const sizeSecondary = 9 * scale;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: "center",
        gap: vertical ? 12 * scale : 10 * scale,
      }}
    >
      <svg width={iconW} height={iconH} viewBox="0 0 24 32" fill="none">
        <path
          d="M12 2C12 2 2 14 2 21C2 26 6.5 30 12 30C17.5 30 22 26 22 21C22 14 12 2 12 2Z"
          stroke={COLORS.accent}
          strokeWidth="1.6"
          fill="none"
        />
        <path
          d="M12 8C12 8 5 16 5 21C5 24.5 8.1 27 12 27C15.9 27 19 24.5 19 21C19 16 12 8 12 8Z"
          stroke={COLORS.accent}
          strokeWidth="1.4"
          fill="none"
        />
        <path
          d="M12 13.5C12 13.5 8.5 18 8.5 21C8.5 23 10 24.5 12 24.5C14 24.5 15.5 23 15.5 21C15.5 18 12 13.5 12 13.5Z"
          stroke={COLORS.accentHover}
          strokeWidth="1.2"
          fill="none"
        />
      </svg>

      {showWordmark && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            lineHeight: 1,
            alignItems: vertical ? "center" : "flex-start",
          }}
        >
          <span
            style={{
              fontFamily: FONT.display,
              letterSpacing: "0.18em",
              color: COLORS.textPrimary,
              fontWeight: 600,
              fontSize: sizePrimary,
              textTransform: "uppercase",
            }}
          >
            Atlântico
          </span>
          <span
            style={{
              fontFamily: FONT.display,
              letterSpacing: "0.16em",
              color: "#6b6b6b",
              fontWeight: 600,
              fontSize: sizeSecondary,
              textTransform: "uppercase",
              marginTop: 2 * scale,
            }}
          >
            ConstruData
          </span>
        </div>
      )}
    </div>
  );
};
