import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../tokens";

// Barra fina no rodapé do vídeo inteiro mostrando % assistido. Aparece em
// TODAS as cenas (renderizada fora das Sequences, no nível raiz da
// composição). Tom sutil — não compete com o conteúdo.
export const GlobalProgressBar: React.FC<{
  totalDuration: number;
}> = ({ totalDuration }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, totalDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress * 100}%`,
            background: COLORS.accent,
            boxShadow: `0 0 12px ${COLORS.accent}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
