/**
 * ProductDemo30s — Vídeo de produto de 30s para landing page e marketing.
 *
 * Estrutura:
 *   0-5s   Hook (dor) — "Toda obra perde 30% do tempo procurando informação"
 *   5-10s  Solução — Logo Atlântico + tagline
 *   10-20s Demo — 4 mock screens em sequência
 *   20-25s Resultados — números (80% / 3-5% / R$200k)
 *   25-30s CTA — "Agende uma demonstração"
 *
 * Resolução: 1920×1080, 30fps, 900 frames.
 */
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion'
import { COLORS, FONTS } from '../shared/theme'

// Helpers
const FPS = 30
const sec = (s: number) => s * FPS

// ── Cena 1: Hook (0-5s) ─────────────────────────────────────────────────────
function SceneHook() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const opacity = interpolate(frame, [0, 15, sec(4.5), sec(5)], [0, 1, 1, 0])
  const scale = spring({ frame, fps, config: { damping: 12 } })

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgDeep,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center', transform: `scale(${scale})` }}>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 32,
            color: COLORS.textDim,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 30,
          }}
        >
          Toda obra perde
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 220,
            fontWeight: 900,
            color: COLORS.accent,
            lineHeight: 0.9,
            letterSpacing: '-0.04em',
            textShadow: '0 8px 60px rgba(249,115,22,0.4)',
          }}
        >
          30%
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 32,
            color: COLORS.text,
            marginTop: 30,
          }}
        >
          do tempo procurando informação
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 22,
            color: COLORS.textDim,
            marginTop: 8,
            fontStyle: 'italic',
          }}
        >
          que já existe em algum lugar.
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Cena 2: Solução (5-10s) ─────────────────────────────────────────────────
function SceneSolution() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = interpolate(frame, [0, 15, sec(4.5), sec(5)], [0, 1, 1, 0])
  const titleScale = spring({ frame, fps, config: { damping: 14 } })

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${COLORS.bg} 0%, ${COLORS.bgDeep} 100%)`,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center', transform: `scale(${titleScale})` }}>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 24,
            color: COLORS.accent,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          Apresentamos
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 180,
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
            width: 120,
            height: 3,
            background: COLORS.accent,
            margin: '24px auto',
          }}
        />
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 28,
            color: COLORS.textDim,
            maxWidth: 900,
          }}
        >
          A inteligência operacional para construção e saneamento.
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Cena 3: Demo das telas (10-20s) ─────────────────────────────────────────
function SceneDemo() {
  const frame = useCurrentFrame()

  const SCREENS = [
    { title: 'TORRE DE CONTROLE', subtitle: 'Visão executiva no celular',         color: COLORS.accent },
    { title: 'RDO DIGITAL',       subtitle: 'Campo conectado em tempo real',      color: COLORS.success },
    { title: 'FVS / QUALIDADE',   subtitle: 'Rastreabilidade total',              color: COLORS.info },
    { title: 'PLAN. MESTRE',      subtitle: 'Cronograma + CPI/SPI ao vivo',       color: '#a855f7' },
  ]

  // Cada tela aparece por ~2.5s
  const SCREEN_DURATION = sec(2.5)

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgDeep,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {SCREENS.map((screen, i) => {
        const start = i * SCREEN_DURATION
        const end = start + SCREEN_DURATION
        const localFrame = frame - start

        if (frame < start - 10 || frame > end + 10) return null

        const opacity = interpolate(
          localFrame,
          [0, 10, SCREEN_DURATION - 10, SCREEN_DURATION],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )
        const x = interpolate(
          localFrame,
          [0, 15, SCREEN_DURATION - 15, SCREEN_DURATION],
          [-100, 0, 0, 100],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
        )

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              opacity,
              transform: `translateX(${x}px)`,
              textAlign: 'center',
            }}
          >
            {/* Mock screen frame */}
            <div
              style={{
                width: 1200,
                height: 700,
                background: COLORS.bgPanel,
                border: `2px solid ${screen.color}`,
                borderRadius: 16,
                padding: 50,
                boxShadow: `0 20px 80px ${screen.color}30`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 18,
                  color: screen.color,
                  letterSpacing: '0.2em',
                  marginBottom: 20,
                }}
              >
                MÓDULO {i + 1}/4
              </div>
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 86,
                  fontWeight: 900,
                  color: COLORS.text,
                  letterSpacing: '-0.02em',
                }}
              >
                {screen.title}
              </div>
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 28,
                  color: COLORS.textDim,
                  marginTop: 20,
                }}
              >
                {screen.subtitle}
              </div>

              {/* Faux UI bars */}
              <div style={{ display: 'flex', gap: 16, marginTop: 50 }}>
                {[0, 1, 2, 3, 4].map((b) => {
                  const barHeight = 30 + Math.sin((frame + b * 8) / 6) * 18
                  return (
                    <div
                      key={b}
                      style={{
                        width: 50,
                        height: barHeight + 30,
                        background: screen.color,
                        opacity: 0.7 - b * 0.1,
                        borderRadius: 4,
                      }}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </AbsoluteFill>
  )
}

// ── Cena 4: Resultados (20-25s) ─────────────────────────────────────────────
function SceneResults() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = interpolate(frame, [0, 15, sec(4.5), sec(5)], [0, 1, 1, 0])

  const RESULTS = [
    { number: '80%',     label: 'menos tempo de orçamento', delay: 0 },
    { number: '3-5%',    label: 'menos perdas de faturamento', delay: 10 },
    { number: 'R$200k',  label: 'economia em obra de R$20M', delay: 20 },
    { number: '38→72%',  label: 'salto de PPC em 4 meses', delay: 30 },
  ]

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bgDeep,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: 28,
          color: COLORS.accent,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          marginBottom: 60,
        }}
      >
        Resultados em obras reais
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 60,
          maxWidth: 1400,
        }}
      >
        {RESULTS.map((r) => {
          const localFrame = Math.max(0, frame - r.delay)
          const scale = spring({ frame: localFrame, fps, config: { damping: 12 } })
          return (
            <div key={r.number} style={{ textAlign: 'center', transform: `scale(${scale})` }}>
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 130,
                  fontWeight: 900,
                  color: COLORS.accent,
                  lineHeight: 0.9,
                  letterSpacing: '-0.03em',
                }}
              >
                {r.number}
              </div>
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontSize: 22,
                  color: COLORS.textDim,
                  marginTop: 12,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {r.label}
              </div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

// ── Cena 5: CTA (25-30s) ────────────────────────────────────────────────────
function SceneCTA() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const opacity = interpolate(frame, [0, 15, sec(4.5), sec(5)], [0, 1, 1, 1])
  const ctaScale = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 12 } })

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${COLORS.bg} 0%, ${COLORS.bgDeep} 100%)`,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: FONTS.display,
            fontSize: 72,
            fontWeight: 900,
            color: COLORS.text,
            letterSpacing: '-0.02em',
            marginBottom: 20,
          }}
        >
          Pronto para ver na sua obra?
        </div>
        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 26,
            color: COLORS.textDim,
            marginBottom: 60,
          }}
        >
          20 minutos. Sem compromisso. Com seus dados reais.
        </div>

        <div
          style={{
            display: 'inline-block',
            transform: `scale(${ctaScale})`,
            padding: '24px 60px',
            background: COLORS.accent,
            color: COLORS.bgDeep,
            fontFamily: FONTS.display,
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            borderRadius: 8,
            boxShadow: '0 20px 60px rgba(249,115,22,0.5)',
          }}
        >
          Agendar Demonstração
        </div>

        <div
          style={{
            fontFamily: FONTS.body,
            fontSize: 22,
            color: COLORS.accent,
            marginTop: 40,
            letterSpacing: '0.05em',
          }}
        >
          calendly.com/joaodsouzanery/demonstracao-construdata
        </div>
      </div>
    </AbsoluteFill>
  )
}

// ── Composição final ────────────────────────────────────────────────────────
export const ProductDemo30s: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      <Sequence from={0}            durationInFrames={sec(5)}>  <SceneHook />     </Sequence>
      <Sequence from={sec(5)}       durationInFrames={sec(5)}>  <SceneSolution /> </Sequence>
      <Sequence from={sec(10)}      durationInFrames={sec(10)}> <SceneDemo />     </Sequence>
      <Sequence from={sec(20)}      durationInFrames={sec(5)}>  <SceneResults />  </Sequence>
      <Sequence from={sec(25)}      durationInFrames={sec(5)}>  <SceneCTA />      </Sequence>
    </AbsoluteFill>
  )
}
