/**
 * LinkedInTeaser60s — Vídeo vertical de 60s para LinkedIn Reels / Stories /
 * Instagram Reels / TikTok / YouTube Shorts.
 *
 * Estrutura:
 *   0-3s    Hook agressivo: "Sua obra perde R$200k por ano"
 *   3-12s   A dor (planilhas, WhatsApp, papel)
 *   12-25s  A virada — Atlântico aparece
 *   25-45s  3 destaques rápidos (números)
 *   45-60s  CTA com QR / link
 *
 * Resolução: 1080×1920 (9:16), 30fps, 1800 frames.
 */
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import { COLORS, FONTS } from '../shared/theme'

const FPS = 30
const sec = (s: number) => s * FPS

// ── Cena 1: Hook (0-3s) — text grande + impactante ──────────────────────────
function HookScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = interpolate(frame, [0, 8, sec(2.5), sec(3)], [0, 1, 1, 0])

  // Animação do número R$200k
  const numScale = spring({ frame, fps, config: { damping: 8, stiffness: 100 } })

  return (
    <AbsoluteFill
      style={{
        background: COLORS.error,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 60,
            color: 'white',
            letterSpacing: '0.04em',
            marginBottom: 30,
            fontWeight: 600,
          }}
        >
          Sua obra perde
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 240,
            fontWeight: 900,
            color: 'white',
            lineHeight: 0.85,
            letterSpacing: '-0.04em',
            transform: `scale(${numScale})`,
            textShadow: '0 20px 80px rgba(0,0,0,0.5)',
          }}
        >
          R$200k
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 60,
            color: 'white',
            marginTop: 30,
            fontWeight: 600,
          }}
        >
          por ano
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Cena 2: A dor (3-12s) ────────────────────────────────────────────────────
function PainScene() {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 15, sec(8), sec(9)], [0, 1, 1, 0])

  const PAINS = [
    { emoji: '📊', text: 'Excel de 14 abas', delay: 0 },
    { emoji: '📱', text: 'Foto perdida no WhatsApp', delay: 30 },
    { emoji: '📋', text: 'Planilha do engenheiro que saiu', delay: 60 },
    { emoji: '📄', text: 'PDF do cronograma de 6 meses atrás', delay: 90 },
  ]

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgDeep,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        padding: 60,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 50,
          color: COLORS.textDim,
          textAlign: 'center',
          marginBottom: 50,
          letterSpacing: '0.04em',
        }}
      >
        Por causa disso:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, width: '100%', maxWidth: 900 }}>
        {PAINS.map((p) => {
          const localFrame = Math.max(0, frame - p.delay)
          const x = interpolate(localFrame, [0, 20], [-200, 0], { extrapolateRight: 'clamp' })
          const op = interpolate(localFrame, [0, 20], [0, 1], { extrapolateRight: 'clamp' })
          return (
            <div
              key={p.text}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 24,
                padding: '32px 40px',
                background: COLORS.bgPanel,
                border: `2px solid ${COLORS.error}`,
                borderRadius: 16,
                opacity: op,
                transform: `translateX(${x}px)`,
              }}
            >
              <div style={{ fontSize: 60 }}>{p.emoji}</div>
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 42,
                  color: COLORS.text,
                  fontWeight: 600,
                }}
              >
                {p.text}
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ── Cena 3: A virada (12-25s) ──────────────────────────────────────────────
function TurnScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = interpolate(frame, [0, 15, sec(12), sec(13)], [0, 1, 1, 0])
  const logoScale = spring({ frame, fps, config: { damping: 12 } })

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${COLORS.bg} 0%, ${COLORS.bgDeep} 100%)`,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        padding: 60,
      }}
    >
      <div style={{ textAlign: 'center', transform: `scale(${logoScale})` }}>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 44,
            color: COLORS.accent,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            marginBottom: 40,
            fontWeight: 600,
          }}
        >
          Mas e se…
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 160,
            fontWeight: 900,
            color: COLORS.text,
            letterSpacing: '0.04em',
            lineHeight: 1,
          }}
        >
          ATLÂNTICO
        </div>
        <div
          style={{
            width: 200,
            height: 4,
            background: COLORS.accent,
            margin: '40px auto',
          }}
        />
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 50,
            color: COLORS.text,
            lineHeight: 1.2,
            maxWidth: 900,
          }}
        >
          Todos os dados da sua obra
          <br />
          em <strong style={{ color: COLORS.accent }}>uma só ontologia</strong>.
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Cena 4: Highlights (25-45s) ─────────────────────────────────────────────
function HighlightsScene() {
  const frame = useCurrentFrame()

  const HIGHLIGHTS = [
    { num: '80%',    label: 'menos tempo de orçamento',  color: COLORS.accent, start: 0 },
    { num: 'TEMPO REAL', label: 'CPI/SPI sem reunião',  color: COLORS.success, start: sec(7) },
    { num: '38→72%',  label: 'salto de PPC em 4 meses',  color: COLORS.info,    start: sec(14) },
  ]

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgDeep,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 60,
      }}
    >
      {HIGHLIGHTS.map((h, i) => {
        const localFrame = frame - h.start
        const visibleEnd = sec(7)
        const opacity = interpolate(
          localFrame,
          [0, 15, visibleEnd - 15, visibleEnd],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )
        if (localFrame < -10 || localFrame > visibleEnd + 10) return null

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              opacity,
              textAlign: 'center',
              padding: 60,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: h.num.length > 4 ? 140 : 220,
                fontWeight: 900,
                color: h.color,
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
                textShadow: `0 20px 80px ${h.color}40`,
              }}
            >
              {h.num}
            </div>
            <div
              style={{
                fontFamily: FONTS.body,
                fontSize: 50,
                color: COLORS.text,
                marginTop: 40,
                lineHeight: 1.2,
                fontWeight: 600,
              }}
            >
              {h.label}
            </div>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

// ── Cena 5: CTA final (45-60s) ──────────────────────────────────────────────
function CTAScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
  const btnScale = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 10 } })

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${COLORS.bgDeep} 0%, ${COLORS.bg} 100%)`,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        padding: 60,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 90,
            fontWeight: 900,
            color: COLORS.text,
            letterSpacing: '-0.02em',
            marginBottom: 20,
            lineHeight: 1.05,
          }}
        >
          Quer ver na
          <br />
          sua obra?
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 42,
            color: COLORS.textDim,
            marginBottom: 60,
          }}
        >
          20 minutos. Sem compromisso.
        </div>

        <div
          style={{
            display: 'inline-block',
            transform: `scale(${btnScale})`,
            padding: '40px 80px',
            background: COLORS.accent,
            color: COLORS.bgDeep,
            fontFamily: FONTS.display,
            fontSize: 50,
            fontWeight: 900,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            borderRadius: 12,
            boxShadow: '0 30px 80px rgba(249,115,22,0.5)',
          }}
        >
          Link na bio
        </div>

        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 32,
            color: COLORS.accent,
            marginTop: 60,
            letterSpacing: '0.06em',
            fontWeight: 700,
          }}
        >
          @atlantico
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Composição final ────────────────────────────────────────────────────────
export const LinkedInTeaser60s: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      <Sequence from={0}        durationInFrames={sec(3)}>  <HookScene />       </Sequence>
      <Sequence from={sec(3)}   durationInFrames={sec(9)}>  <PainScene />       </Sequence>
      <Sequence from={sec(12)}  durationInFrames={sec(13)}> <TurnScene />       </Sequence>
      <Sequence from={sec(25)}  durationInFrames={sec(20)}> <HighlightsScene /> </Sequence>
      <Sequence from={sec(45)}  durationInFrames={sec(15)}> <CTAScene />        </Sequence>
    </AbsoluteFill>
  )
}
