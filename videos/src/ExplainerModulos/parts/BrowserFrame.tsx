import React from "react";
import { COLORS, FONT } from "../tokens";

// Janela de browser fake com chrome estilo macOS — usado para enquadrar
// screenshots da plataforma e dar contexto visual de "isso roda no navegador".
export const BrowserFrame: React.FC<{
  url: string;
  children: React.ReactNode;
}> = ({ url, children }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      border: `1px solid ${COLORS.borderMid}`,
      background: COLORS.bg,
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)",
      overflow: "hidden",
    }}
  >
    {/* Chrome */}
    <div
      style={{
        height: 52,
        background: COLORS.surface,
        borderBottom: `1px solid ${COLORS.borderMid}`,
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 20,
        flexShrink: 0,
      }}
    >
      {/* Traffic lights */}
      <div style={{ display: "flex", gap: 10 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div
            key={c}
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: c,
              boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.15)",
            }}
          />
        ))}
      </div>
      {/* URL bar */}
      <div
        style={{
          flex: 1,
          height: 32,
          background: COLORS.bg,
          border: `1px solid ${COLORS.borderSoft}`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          fontFamily: FONT.mono,
          fontSize: 16,
          color: COLORS.textSecondary,
          gap: 10,
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        <span style={{ color: COLORS.success, fontSize: 10 }}>●</span>
        {url}
      </div>
      <div style={{ width: 50 }} />
    </div>
    {/* Content */}
    <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
      {children}
    </div>
  </div>
);
