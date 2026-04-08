/**
 * HeroLoop — vídeo em loop de 15s para o background do Hero da landing page.
 *
 * Conceito: a "ontologia" da Atlântico — 4 módulos conectados em tempo real.
 * Sem áudio. Loop seamless (último frame == primeiro frame).
 *
 * Resolução: 1920×1080 (16:9), 30fps, 450 frames.
 *
 * Uso na landing: coloque <video autoPlay loop muted playsInline> apontando
 * para o MP4 renderizado em vez da imagem estática do hero.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion'
import { COLORS, FONTS } from '../shared/theme'

const MODULES = [
  { label: 'RDO',         x: 25, y: 30 },
  { label: 'BIM',         x: 75, y: 30 },
  { label: 'CRONOGRAMA',  x: 75, y: 70 },
  { label: 'ORÇAMENTO',   x: 25, y: 70 },
]

// Conexões entre módulos (índices de MODULES)
const CONNECTIONS: [number, number][] = [
  [0, 1], // RDO → BIM
  [1, 2], // BIM → Cronograma
  [2, 3], // Cronograma → Orçamento
  [3, 0], // Orçamento → RDO
  [0, 2], // RDO → Cronograma (cross)
  [1, 3], // BIM → Orçamento (cross)
]

export const HeroLoop: React.FC = () => {
  const frame = useCurrentFrame()
  const { width, height, durationInFrames } = useVideoConfig()

  // Loop seamless: usa modulus para os pulses
  const cycle = durationInFrames

  // Logo opacity: fade in 0-30, hold 30→durationInFrames-30, fade out últimos 30
  const logoOpacity = interpolate(
    frame,
    [0, 30, cycle - 30, cycle],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp' },
  )

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${COLORS.bg} 0%, ${COLORS.bgDeep} 100%)`,
      }}
    >
      {/* ── Grid sutil de fundo ─────────────────────────────────────── */}
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, opacity: 0.08 }}
      >
        <defs>
          <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M 80 0 L 0 0 0 80" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* ── Conexões entre módulos com pulses animados ──────────────── */}
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', inset: 0 }}
      >
        {CONNECTIONS.map((conn, i) => {
          const [a, b] = conn
          const x1 = (MODULES[a].x / 100) * width
          const y1 = (MODULES[a].y / 100) * height
          const x2 = (MODULES[b].x / 100) * width
          const y2 = (MODULES[b].y / 100) * height

          // Cada conexão pulsa em fase diferente
          const phase = (frame + i * 75) % cycle
          const pulseProgress = (phase / cycle)

          // Opacidade base + pulse circle no caminho
          const lineOpacity = interpolate(
            phase,
            [0, cycle / 2, cycle],
            [0.15, 0.35, 0.15],
          )

          // Posição do "ponto de dado" caminhando pela linha
          const dotX = x1 + (x2 - x1) * pulseProgress
          const dotY = y1 + (y2 - y1) * pulseProgress

          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={COLORS.accent}
                strokeWidth={1.5}
                opacity={lineOpacity}
              />
              <circle cx={dotX} cy={dotY} r={6} fill={COLORS.accent} opacity={0.9} />
              <circle cx={dotX} cy={dotY} r={12} fill={COLORS.accent} opacity={0.25} />
            </g>
          )
        })}
      </svg>

      {/* ── Módulos como nós ────────────────────────────────────────── */}
      {MODULES.map((m, i) => {
        const moduleScale = interpolate(
          (frame + i * 30) % 90,
          [0, 45, 90],
          [1, 1.05, 1],
        )
        return (
          <div
            key={m.label}
            style={{
              position: 'absolute',
              left: `${m.x}%`,
              top: `${m.y}%`,
              transform: `translate(-50%, -50%) scale(${moduleScale})`,
            }}
          >
            <div
              style={{
                width: 180,
                height: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: COLORS.bgPanel,
                border: `2px solid ${COLORS.accent}`,
                borderRadius: 8,
                boxShadow: `0 0 40px rgba(249,115,22,0.25)`,
                fontFamily: FONTS.display,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: COLORS.accent,
              }}
            >
              {m.label}
            </div>
          </div>
        )
      })}

      {/* ── Logo + tagline central ──────────────────────────────────── */}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          opacity: logoOpacity,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: '0.04em',
              color: COLORS.text,
              textShadow: '0 4px 30px rgba(0,0,0,0.6)',
            }}
          >
            ATLÂNTICO
          </div>
          <div
            style={{
              fontFamily: FONTS.body,
              fontSize: 22,
              fontWeight: 500,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: COLORS.accent,
              marginTop: 12,
            }}
          >
            Inteligência Operacional
          </div>
          <div
            style={{
              width: 80,
              height: 2,
              background: COLORS.accent,
              margin: '20px auto 0',
            }}
          />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
