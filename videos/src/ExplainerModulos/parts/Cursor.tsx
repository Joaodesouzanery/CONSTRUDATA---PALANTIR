import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS } from "../tokens";

// Cursor com keyframes em % do container pai (não pixels — funciona em
// qualquer tamanho). Cada keyframe pode ter `click: true` para disparar
// um pulse ring nessa posição + feedback de press no cursor.
//
// Movimento usa easing com OVERSHOOT (chega 4-6% além do target e volta)
// pra simular movimento humano natural ao invés de mecânico.
export type CursorKey = {
  frame: number;
  x: number; // 0-100 (%)
  y: number; // 0-100 (%)
  click?: boolean;
};

// Easing com overshoot — ease-out-back
const overshoot = Easing.bezier(0.34, 1.32, 0.64, 1);

const sampleKeyframes = (
  frame: number,
  kfs: CursorKey[]
): { x: number; y: number } => {
  if (kfs.length === 0) return { x: 50, y: 50 };
  if (frame <= kfs[0].frame) return { x: kfs[0].x, y: kfs[0].y };
  const last = kfs[kfs.length - 1];
  if (frame >= last.frame) return { x: last.x, y: last.y };
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const t = interpolate(frame, [a.frame, b.frame], [0, 1], {
        easing: overshoot,
      });
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return { x: last.x, y: last.y };
};

// Detecta se está no momento exato de um click (para press feedback no cursor)
const getClickPress = (frame: number, kfs: CursorKey[]): number => {
  for (const kf of kfs) {
    if (!kf.click) continue;
    const elapsed = frame - kf.frame;
    if (elapsed >= -2 && elapsed <= 6) {
      // Cursor encolhe pra 0.82x no momento do click e volta
      return interpolate(elapsed, [-2, 0, 6], [1, 0.82, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  }
  return 1;
};

export const Cursor: React.FC<{
  keyframes: CursorKey[];
  showFrom?: number;
}> = ({ keyframes, showFrom = 0 }) => {
  const frame = useCurrentFrame();
  if (frame < showFrom || keyframes.length === 0) return null;

  const { x, y } = sampleKeyframes(frame, keyframes);
  const pressScale = getClickPress(frame, keyframes);
  const clicks = keyframes.filter((k) => k.click);

  const entryOpacity = interpolate(frame, [showFrom, showFrom + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      {clicks.map((c, i) => {
        const elapsed = frame - c.frame;
        if (elapsed < 0 || elapsed > 40) return null;
        // Dois rings concêntricos com timing diferente para mais impacto
        const scale1 = interpolate(elapsed, [0, 32], [0.3, 2.2], {
          easing: Easing.out(Easing.cubic),
        });
        const op1 = interpolate(elapsed, [0, 32], [0.95, 0]);
        const scale2 = interpolate(elapsed, [4, 36], [0.3, 1.6], {
          easing: Easing.out(Easing.cubic),
        });
        const op2 = interpolate(elapsed, [4, 36], [0.6, 0]);
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: "absolute",
                left: `${c.x}%`,
                top: `${c.y}%`,
                width: 90,
                height: 90,
                marginLeft: -45,
                marginTop: -45,
                borderRadius: "50%",
                border: `3px solid ${COLORS.accent}`,
                transform: `scale(${scale1})`,
                opacity: op1,
                pointerEvents: "none",
                zIndex: 99,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${c.x}%`,
                top: `${c.y}%`,
                width: 90,
                height: 90,
                marginLeft: -45,
                marginTop: -45,
                borderRadius: "50%",
                background: COLORS.accent,
                transform: `scale(${scale2})`,
                opacity: op2 * 0.3,
                pointerEvents: "none",
                zIndex: 98,
              }}
            />
          </React.Fragment>
        );
      })}

      {/* Cursor arrow (estilo macOS) com press feedback */}
      <svg
        width={36}
        height={42}
        viewBox="0 0 24 28"
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))",
          pointerEvents: "none",
          zIndex: 100,
          opacity: entryOpacity,
          transform: `scale(${pressScale})`,
          transformOrigin: "0 0",
        }}
      >
        <path
          d="M3 2 L3 22 L8 18 L11 26 L14 25 L11 17 L18 17 Z"
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};
