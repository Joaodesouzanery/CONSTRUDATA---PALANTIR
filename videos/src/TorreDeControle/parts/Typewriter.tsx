import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, FONT, SIZE } from "../tokens";

// Texto aparecendo caractere por caractere com cursor | piscando.
export const Typewriter: React.FC<{
  text: string;
  startFrame?: number;
  speed?: number; // frames por caractere (default 2)
  fontSize?: number;
  color?: string;
  maxWidth?: number;
}> = ({
  text,
  startFrame = 0,
  speed = 2,
  fontSize = SIZE.h2,
  color = COLORS.textPrimary,
  maxWidth = 1400,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charsVisible = Math.min(Math.floor(elapsed / speed), text.length);
  const done = charsVisible >= text.length;
  const cursorVisible = !done || Math.floor(frame / 15) % 2 === 0;

  if (elapsed < 0) return null;

  return (
    <div
      style={{
        fontFamily: FONT.display,
        fontSize,
        fontWeight: 700,
        color,
        lineHeight: 1.2,
        letterSpacing: "-0.01em",
        textAlign: "center",
        maxWidth,
      }}
    >
      {text.slice(0, charsVisible)}
      <span
        style={{
          color: COLORS.accent,
          opacity: cursorVisible ? 1 : 0,
          fontWeight: 300,
        }}
      >
        |
      </span>
    </div>
  );
};
