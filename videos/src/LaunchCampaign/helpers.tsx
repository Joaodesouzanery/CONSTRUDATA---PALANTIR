import React from 'react'
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { COLORS, FONTS } from '../shared/theme'

export const GridBackground: React.FC<{
  accentGlow?: number
}> = ({ accentGlow = 0.18 }) => (
  <AbsoluteFill
    style={{
      backgroundColor: COLORS.bgDeep,
      backgroundImage: `radial-gradient(circle at center, rgba(249,115,22,${accentGlow}) 0%, transparent 32%), radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
      backgroundSize: '100% 100%, 28px 28px',
    }}
  />
)

export const Eyebrow: React.FC<{
  children: React.ReactNode
  accent?: boolean
}> = ({ children, accent = true }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
    <div
      style={{
        width: 56,
        height: 2,
        background: accent ? COLORS.accent : 'rgba(255,255,255,0.2)',
      }}
    />
    <div
      style={{
        fontFamily: FONTS.display,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: accent ? COLORS.accent : COLORS.textDim,
      }}
    >
      {children}
    </div>
  </div>
)

export const BrandLogo: React.FC<{
  scale?: number
}> = ({ scale = 1 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 * scale }}>
    <svg width={24 * scale} height={32 * scale} viewBox="0 0 24 32" fill="none">
      <path
        d="M12 2C12 2 2 14 2 21C2 26 6.5 30 12 30C17.5 30 22 26 22 21C22 14 12 2 12 2Z"
        stroke={COLORS.accent}
        strokeWidth="1.6"
      />
      <path
        d="M12 8C12 8 5 16 5 21C5 24.5 8.1 27 12 27C15.9 27 19 24.5 19 21C19 16 12 8 12 8Z"
        stroke={COLORS.accent}
        strokeWidth="1.4"
      />
      <path
        d="M12 13.5C12 13.5 8.5 18 8.5 21C8.5 23 10 24.5 12 24.5C14 24.5 15.5 23 15.5 21C15.5 18 12 13.5 12 13.5Z"
        stroke={COLORS.accentDeep}
        strokeWidth="1.2"
      />
    </svg>
    <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
      <span
        style={{
          fontFamily: FONTS.display,
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: COLORS.text,
          fontSize: 14 * scale,
        }}
      >
        Atlantico
      </span>
      <span
        style={{
          fontFamily: FONTS.display,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 9 * scale,
          marginTop: 2 * scale,
        }}
      >
        ConstruData
      </span>
    </div>
  </div>
)

export const TypewriterText: React.FC<{
  text: string
  start?: number
  speed?: number
  style?: React.CSSProperties
}> = ({ text, start = 0, speed = 1.6, style }) => {
  const frame = useCurrentFrame()
  const visibleChars = Math.max(0, Math.floor((frame - start) / speed))
  return <div style={style}>{text.slice(0, visibleChars)}</div>
}

export const CameraPush: React.FC<{
  children: React.ReactNode
  fromScale?: number
  toScale?: number
  fromY?: number
  toY?: number
}> = ({
  children,
  fromScale = 1,
  toScale = 1.08,
  fromY = 0,
  toY = -24,
}) => {
  const frame = useCurrentFrame()
  const scale = interpolate(frame, [0, 100], [fromScale, toScale], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const y = interpolate(frame, [0, 100], [fromY, toY], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return <div style={{ transform: `translateY(${y}px) scale(${scale})` }}>{children}</div>
}

export const ClickPulse: React.FC<{
  x: string
  y: string
  delay?: number
  color?: string
}> = ({ x, y, delay = 0, color = COLORS.accent }) => {
  const frame = useCurrentFrame()
  const local = frame - delay

  if (local < 0 || local > 32) {
    return null
  }

  const scale = interpolate(local, [0, 32], [0.4, 2.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = interpolate(local, [0, 32], [0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: 74,
        height: 74,
        marginLeft: -37,
        marginTop: -37,
        border: `3px solid ${color}`,
        borderRadius: '50%',
        transform: `scale(${scale})`,
        opacity,
      }}
    />
  )
}

export const GlassPanel: React.FC<{
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({ children, style }) => (
  <div
    style={{
      background: 'linear-gradient(180deg, rgba(44,44,44,0.92) 0%, rgba(18,28,44,0.94) 100%)',
      border: `1px solid ${COLORS.borderDim}`,
      borderRadius: 20,
      boxShadow: '0 28px 80px rgba(0,0,0,0.35)',
      backdropFilter: 'blur(10px)',
      ...style,
    }}
  >
    {children}
  </div>
)

export const CardStack: React.FC<{
  items: Array<{ label: string; tag: string; tone?: string }>
}> = ({ items }) => {
  const frame = useCurrentFrame()

  return (
    <div style={{ position: 'relative', width: 360, height: 280 }}>
      {items.map((item, index) => {
        const local = Math.max(0, frame - index * 8)
        const slide = spring({ frame: local, fps: 30, config: { damping: 14 } })
        const offsetX = index * 18
        const offsetY = index * 20

        return (
          <GlassPanel
            key={item.label}
            style={{
              position: 'absolute',
              inset: `${offsetY}px auto auto ${offsetX}px`,
              width: 280,
              padding: '22px 20px',
              transform: `translateY(${(1 - slide) * 26}px) rotate(${(index - 1.5) * 2}deg)`,
              opacity: 0.68 + index * 0.1,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: item.tone ?? COLORS.accent,
              }}
            >
              {item.tag}
            </div>
            <div
              style={{
                marginTop: 14,
                fontFamily: FONTS.body,
                fontSize: 24,
                fontWeight: 600,
                lineHeight: 1.2,
                color: COLORS.text,
              }}
            >
              {item.label}
            </div>
          </GlassPanel>
        )
      })}
    </div>
  )
}

export const FloatingUiWall: React.FC<{
  items: Array<{ title: string; file?: string; tone?: string }>
  vertical?: boolean
}> = ({ items, vertical = false }) => {
  const frame = useCurrentFrame()
  const columns = vertical ? 2 : 4
  const cardWidth = vertical ? 260 : 300
  const cardHeight = vertical ? 200 : 190

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, ${cardWidth}px)`,
        gap: vertical ? 18 : 22,
        perspective: 1800,
      }}
    >
      {items.map((item, index) => {
        const local = Math.max(0, frame - index * 6)
        const reveal = spring({ frame: local, fps: 30, config: { damping: 16 } })
        const row = Math.floor(index / columns)
        const col = index % columns
        const rotateY = (col - (columns - 1) / 2) * 6
        const rotateX = (row - 0.5) * -3

        return (
          <GlassPanel
            key={item.title}
            style={{
              width: cardWidth,
              height: cardHeight,
              overflow: 'hidden',
              transform: `translateZ(${reveal * 120}px) translateY(${(1 - reveal) * 40}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
            }}
          >
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {item.file ? (
                <Img
                  src={staticFile(`screenshots/${item.file}`)}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(135deg, rgba(11,26,48,1) 0%, rgba(249,115,22,0.22) 100%)',
                  }}
                />
              )}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(180deg, rgba(7,20,35,0.05) 0%, rgba(7,20,35,0.78) 100%)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: 18,
                  right: 18,
                  bottom: 16,
                }}
              >
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: item.tone ?? COLORS.accent,
                  }}
                >
                  {item.title}
                </div>
              </div>
            </div>
          </GlassPanel>
        )
      })}
    </div>
  )
}

export const KpiZoom: React.FC<{
  label: string
  value: string
  tone?: string
  delay?: number
}> = ({ label, value, tone = COLORS.accent, delay = 0 }) => {
  const frame = useCurrentFrame()
  const local = Math.max(0, frame - delay)
  const reveal = spring({ frame: local, fps: 30, config: { damping: 12 } })
  const pulse = 1 + Math.max(0, Math.sin((local + 12) * 0.08)) * 0.04

  return (
    <GlassPanel
      style={{
        padding: '18px 20px',
        minWidth: 180,
        transform: `scale(${0.94 + reveal * 0.06})`,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.display,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: COLORS.textDim,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 12,
          fontFamily: FONTS.display,
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: tone,
          transform: `scale(${pulse})`,
          transformOrigin: 'left center',
        }}
      >
        {value}
      </div>
    </GlassPanel>
  )
}

export const ChromeShot: React.FC<{
  title: string
  file: string
  accent?: string
  height?: number | string
}> = ({ title, file, accent = COLORS.accent, height = '100%' }) => (
  <GlassPanel style={{ overflow: 'hidden', height }}>
    <div
      style={{
        height: 46,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 18px',
        borderBottom: `1px solid ${COLORS.borderDim}`,
        background: 'rgba(7,20,35,0.9)',
      }}
    >
      {['#ff5f57', '#febc2e', '#28c840'].map((dot) => (
        <div
          key={dot}
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: dot,
          }}
        />
      ))}
      <div
        style={{
          marginLeft: 10,
          fontFamily: FONTS.display,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: accent,
        }}
      >
        {title}
      </div>
    </div>
    <div style={{ position: 'relative', height: 'calc(100% - 46px)' }}>
      <Img
        src={staticFile(`screenshots/${file}`)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(7,20,35,0.06) 0%, rgba(7,20,35,0.48) 100%)',
        }}
      />
    </div>
  </GlassPanel>
)

export const ModulePills: React.FC<{
  items: string[]
}> = ({ items }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
    {items.map((item) => (
      <div
        key={item}
        style={{
          padding: '10px 16px',
          borderRadius: 999,
          border: `1px solid ${COLORS.borderDim}`,
          background: 'rgba(255,255,255,0.04)',
          fontFamily: FONTS.body,
          fontSize: 15,
          fontWeight: 600,
          color: COLORS.text,
        }}
      >
        {item}
      </div>
    ))}
  </div>
)

export const ProgressBar: React.FC<{
  totalDuration: number
}> = ({ totalDuration }) => {
  const frame = useCurrentFrame()
  const progress = interpolate(frame, [0, totalDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 4,
        background: 'rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: '100%',
          background: COLORS.accent,
          boxShadow: `0 0 16px ${COLORS.accent}`,
        }}
      />
    </div>
  )
}

export const CTAButton: React.FC<{
  label: string
}> = ({ label }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const reveal = spring({ frame: Math.max(0, frame - 18), fps, config: { damping: 12 } })
  const nudge = 1 + Math.sin(frame * 0.16) * 0.05

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 18,
        padding: '22px 34px',
        borderRadius: 14,
        background: COLORS.accent,
        color: COLORS.bgDeep,
        fontFamily: FONTS.display,
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        transform: `scale(${0.92 + reveal * 0.08})`,
        boxShadow: '0 24px 80px rgba(249,115,22,0.42)',
      }}
    >
      {label}
      <span style={{ transform: `translateX(${(nudge - 1) * 28}px)` }}>{'->'}</span>
    </div>
  )
}
