import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, FONT } from "../tokens";

type RagColor = "green" | "amber" | "red";

const RAG_HEX: Record<RagColor, string> = {
  green: COLORS.ragGreen,
  amber: COLORS.ragAmber,
  red: COLORS.ragRed,
};

const ROW_LABELS = ["Fundação", "Estrutura", "Vedação", "Acabamento"];
const COL_LABELS = ["S1", "S2", "S3", "S4", "S5"];

// Dados padrão — mix realista (60% green, 25% amber, 15% red)
const DEFAULT_DATA: RagColor[][] = [
  ["green", "green", "amber", "green", "green"],
  ["green", "amber", "green", "red", "amber"],
  ["amber", "green", "green", "green", "red"],
  ["green", "green", "amber", "green", "green"],
];

export const RagMatrix: React.FC<{
  startFrame?: number;
  data?: RagColor[][];
  fillDelay?: number; // frames entre cada célula (default 3)
}> = ({ startFrame = 0, data = DEFAULT_DATA, fillDelay = 3 }) => {
  const frame = useCurrentFrame();
  const rows = data.length;
  const cols = data[0]?.length ?? 5;
  const cellW = 64;
  const cellH = 42;
  const labelW = 100;
  const gap = 2;

  // Header fade
  const headerOp = interpolate(frame, [startFrame, startFrame + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", gap, marginBottom: gap, opacity: headerOp }}>
        <div style={{ width: labelW }} />
        {COL_LABELS.slice(0, cols).map((c) => (
          <div
            key={c}
            style={{
              width: cellW,
              textAlign: "center",
              fontFamily: FONT.mono,
              fontSize: 12,
              color: COLORS.textMuted,
              letterSpacing: "0.10em",
            }}
          >
            {c}
          </div>
        ))}
      </div>

      {/* Data rows */}
      {data.map((row, ri) => (
        <div key={ri} style={{ display: "flex", gap, marginBottom: gap, alignItems: "center" }}>
          {/* Row label */}
          <div
            style={{
              width: labelW,
              fontFamily: FONT.mono,
              fontSize: 13,
              color: COLORS.textSecondary,
              opacity: headerOp,
              paddingRight: 8,
              textAlign: "right",
            }}
          >
            {ROW_LABELS[ri] ?? `R${ri + 1}`}
          </div>

          {/* Cells */}
          {row.map((cell, ci) => {
            const cellIndex = ri * cols + ci;
            const cellStart = startFrame + 16 + cellIndex * fillDelay;
            const fillOp = interpolate(frame, [cellStart, cellStart + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            });

            return (
              <div
                key={ci}
                style={{
                  width: cellW,
                  height: cellH,
                  border: `1px solid ${COLORS.borderStrong}`,
                  borderRadius: 4,
                  background: fillOp > 0.01
                    ? `${RAG_HEX[cell]}${Math.round(fillOp * 255).toString(16).padStart(2, "0")}`
                    : "transparent",
                  transition: "background 0.1s",
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};
