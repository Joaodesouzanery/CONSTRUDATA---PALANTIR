import React from 'react'
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import {
  buildLaunchVideoConfig,
  getLaunchVideoDuration,
  type LaunchSceneSpec,
  type LaunchVideoConfig,
  type LaunchVideoVariant,
} from './config'
import {
  BrandLogo,
  CTAButton,
  CameraPush,
  CardStack,
  ChromeShot,
  ClickPulse,
  Eyebrow,
  FloatingUiWall,
  GlassPanel,
  GridBackground,
  KpiZoom,
  ModulePills,
  ProgressBar,
  TypewriterText,
} from './helpers'
import { COLORS, FONTS } from '../shared/theme'

export type LaunchCampaignProps = {
  variant: LaunchVideoVariant
  title?: string
  subtitle?: string
  audience?: string
  claims?: string[]
  sceneOrder?: LaunchVideoConfig['sceneOrder']
  ctaLabel?: string
  ctaUrl?: string
  modules?: string[]
}

export const LAUNCH_FPS = 30
export const LAUNCH_MASTER_W = 1920
export const LAUNCH_MASTER_H = 1080
export const LAUNCH_LANDING_W = 1920
export const LAUNCH_LANDING_H = 1080
export const LAUNCH_VERTICAL_W = 1080
export const LAUNCH_VERTICAL_H = 1920
export const LAUNCH_MASTER_DURATION = getLaunchVideoDuration('master')
export const LAUNCH_LANDING_DURATION = getLaunchVideoDuration('landing')
export const LAUNCH_VERTICAL_DURATION = getLaunchVideoDuration('vertical')

const buildResolvedConfig = (props: LaunchCampaignProps) =>
  buildLaunchVideoConfig(props.variant, {
    title: props.title,
    subtitle: props.subtitle,
    audience: props.audience,
    claims: props.claims,
    sceneOrder: props.sceneOrder,
    ctaLabel: props.ctaLabel,
    ctaUrl: props.ctaUrl,
    modules: props.modules,
  })

const getScenePositions = (scenes: LaunchSceneSpec[]) => {
  let cursor = 0

  return scenes.map((scene) => {
    const positioned = { ...scene, from: cursor }
    cursor += scene.durationInFrames
    return positioned
  })
}

const SceneFrame: React.FC<{
  children: React.ReactNode
}> = ({ children }) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill style={{ opacity }}>
      <GridBackground />
      {children}
    </AbsoluteFill>
  )
}

const HeadlineBlock: React.FC<{
  scene: LaunchSceneSpec
  align?: 'left' | 'center'
  maxWidth?: number
}> = ({ scene, align = 'left', maxWidth = 760 }) => {
  const { width, height } = useVideoConfig()
  const isVertical = height > width

  return (
    <div style={{ maxWidth }}>
      <Eyebrow>{scene.eyebrow}</Eyebrow>
      <div
        style={{
          marginTop: 22,
          fontFamily: FONTS.display,
          fontSize: isVertical ? 68 : 72,
          lineHeight: 1.04,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: COLORS.text,
          textAlign: align,
        }}
      >
        {scene.title}
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: FONTS.body,
          fontSize: isVertical ? 28 : 30,
          lineHeight: 1.35,
          color: COLORS.textDim,
          textAlign: align,
        }}
      >
        {scene.subtitle}
      </div>
    </div>
  )
}

const HookScene: React.FC<{ scene: LaunchSceneSpec }> = ({ scene }) => {
  const { width, height } = useVideoConfig()
  const isVertical = height > width
  const frame = useCurrentFrame()
  const lineLift = interpolate(frame, [0, 120], [0, -28], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <SceneFrame>
      <AbsoluteFill
        style={{
          padding: isVertical ? '90px 68px 80px' : '82px 90px 70px',
          display: 'grid',
          gridTemplateColumns: isVertical ? '1fr' : '1.1fr 0.9fr',
          gap: isVertical ? 44 : 56,
          alignItems: 'center',
        }}
      >
        <div>
          <HeadlineBlock scene={scene} maxWidth={isVertical ? 920 : 760} />
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {['Cronograma sob pressao', 'Frentes fora de sincronia', 'Alertas sem contexto'].map((label) => (
              <div
                key={label}
                style={{
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${COLORS.borderDim}`,
                  fontFamily: FONTS.body,
                  fontSize: 16,
                  fontWeight: 600,
                  color: COLORS.text,
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <GlassPanel style={{ padding: isVertical ? 22 : 28 }}>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: COLORS.accent,
            }}
          >
            Operacao estagnada
          </div>
          <div style={{ position: 'relative', height: isVertical ? 320 : 360, marginTop: 18 }}>
            <svg width="100%" height="100%" viewBox="0 0 540 320">
              <defs>
                <linearGradient id="launch-flat-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                  <stop offset="100%" stopColor={COLORS.accent} />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3].map((i) => (
                <line
                  key={i}
                  x1="30"
                  y1={60 + i * 56}
                  x2="510"
                  y2={60 + i * 56}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />
              ))}
              <path
                d={`M30 220 C140 210, 180 212, 260 ${220 + lineLift} S420 196, 510 ${214 + lineLift}`}
                stroke="url(#launch-flat-line)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="430" cy={199 + lineLift} r="9" fill={COLORS.accent} />
            </svg>

            <GlassPanel
              style={{
                position: 'absolute',
                top: 26,
                right: 24,
                padding: '14px 16px',
                width: 190,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: COLORS.error,
                }}
              >
                Alerta silencioso
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontFamily: FONTS.body,
                  fontSize: 18,
                  lineHeight: 1.3,
                  color: COLORS.text,
                }}
              >
                Equipe aguardando liberacao de frente e material.
              </div>
            </GlassPanel>

            <GlassPanel
              style={{
                position: 'absolute',
                left: 22,
                bottom: 16,
                padding: '14px 16px',
                width: 260,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  fontFamily: FONTS.body,
                  fontSize: 16,
                  color: COLORS.text,
                }}
              >
                <span>Material critico</span>
                <span style={{ color: COLORS.warning, fontWeight: 700 }}>pendente</span>
                <span>Equipe ociosa</span>
                <span style={{ color: COLORS.error, fontWeight: 700 }}>+4h</span>
                <span>Obra exigindo acao</span>
                <span style={{ color: COLORS.accent, fontWeight: 700 }}>OBR-003</span>
              </div>
            </GlassPanel>
          </div>
        </GlassPanel>
      </AbsoluteFill>
    </SceneFrame>
  )
}

const PainScene: React.FC<{ scene: LaunchSceneSpec }> = ({ scene }) => {
  const { width, height } = useVideoConfig()
  const isVertical = height > width

  return (
    <SceneFrame>
      <AbsoluteFill
        style={{
          padding: isVertical ? '90px 68px 80px' : '88px 88px 72px',
          display: 'grid',
          gridTemplateColumns: isVertical ? '1fr' : '1fr 380px',
          gap: 48,
          alignItems: 'center',
        }}
      >
        <div>
          <Eyebrow accent={false}>{scene.eyebrow}</Eyebrow>
          <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {scene.onScreen.map((line, index) => (
              <TypewriterText
                key={line}
                text={line}
                start={index * 22}
                speed={1.2}
                style={{
                  fontFamily: FONTS.display,
                  fontSize: isVertical ? 56 : 62,
                  lineHeight: 1.08,
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: index === 0 ? COLORS.text : COLORS.textDim,
                }}
              />
            ))}
          </div>
          <div
            style={{
              marginTop: 28,
              fontFamily: FONTS.body,
              fontSize: isVertical ? 28 : 30,
              lineHeight: 1.35,
              color: COLORS.textDim,
              maxWidth: 760,
            }}
          >
            Decisao sem contexto vira retrabalho, espera e replanejamento manual.
          </div>
        </div>

        <CardStack
          items={[
            { tag: 'Planilha', label: 'Versao divergente do cronograma' },
            { tag: 'WhatsApp', label: 'Foto perdida da frente critica', tone: COLORS.warning },
            { tag: 'PDF', label: 'RDO fechado tarde demais', tone: COLORS.error },
            { tag: 'Campo', label: 'Material sem confirmacao de recebimento', tone: COLORS.info },
          ]}
        />
      </AbsoluteFill>
    </SceneFrame>
  )
}

const PivotScene: React.FC<{ scene: LaunchSceneSpec; config: LaunchVideoConfig }> = ({
  scene,
  config,
}) => {
  const { width, height } = useVideoConfig()
  const isVertical = height > width

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at center, rgba(249,115,22,0.18) 0%, rgba(7,20,35,1) 48%, rgba(0,0,0,1) 100%)',
      }}
    >
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          padding: isVertical ? '90px 68px' : '90px 120px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 1080 }}>
          <div style={{ display: 'inline-flex', marginBottom: 26 }}>
            <BrandLogo scale={isVertical ? 3.2 : 3.6} />
          </div>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: isVertical ? 62 : 72,
              lineHeight: 1.06,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: COLORS.text,
            }}
          >
            {scene.title}
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: FONTS.body,
              fontSize: isVertical ? 28 : 30,
              lineHeight: 1.35,
              color: COLORS.textDim,
            }}
          >
            {scene.subtitle}
          </div>
          <div
            style={{
              marginTop: 28,
              fontFamily: FONTS.display,
              fontSize: isVertical ? 18 : 20,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: COLORS.accent,
            }}
          >
            {config.subtitle}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const PlatformScene: React.FC<{ scene: LaunchSceneSpec }> = ({ scene }) => {
  const { width, height } = useVideoConfig()
  const isVertical = height > width

  return (
    <SceneFrame>
      <AbsoluteFill
        style={{
          padding: isVertical ? '88px 58px 72px' : '84px 82px 64px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start', flexDirection: isVertical ? 'column' : 'row' }}>
          <HeadlineBlock scene={scene} maxWidth={isVertical ? 920 : 700} />
          {!isVertical ? (
            <GlassPanel style={{ padding: '18px 20px', maxWidth: 380 }}>
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
                Suite Atlantico
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontFamily: FONTS.body,
                  fontSize: 18,
                  lineHeight: 1.35,
                  color: COLORS.text,
                }}
              >
                Plataforma operacional completa, nao colecao de dashboards soltos.
              </div>
            </GlassPanel>
          ) : null}
        </div>

        <div style={{ marginTop: isVertical ? 34 : 40 }}>
          <FloatingUiWall
            vertical={isVertical}
            items={[
              { title: 'Torre de Controle', file: 'torre-controle-mapa.png' },
              { title: 'RDO', file: 'rdo-dashboard.png', tone: COLORS.success },
              { title: 'Suprimentos', tone: COLORS.warning },
              { title: 'Planejamento', file: 'agenda-gantt.png', tone: COLORS.info },
              { title: 'LPS / Lean', file: 'lps-lookahead.png' },
              { title: 'BIM 3D/4D/5D', file: 'bim-5d.png', tone: COLORS.info },
              { title: 'Mapa Interativo', file: 'gestao360.png', tone: COLORS.accent },
              { title: 'Relatorio 360', file: 'relatorio-360.png' },
            ]}
          />
        </div>
      </AbsoluteFill>
    </SceneFrame>
  )
}

const FieldScene: React.FC<{ scene: LaunchSceneSpec }> = ({ scene }) => {
  const { width, height } = useVideoConfig()
  const isVertical = height > width

  return (
    <SceneFrame>
      <AbsoluteFill
        style={{
          padding: isVertical ? '86px 58px 70px' : '82px 82px 64px',
          display: 'grid',
          gridTemplateColumns: isVertical ? '1fr' : '1.1fr 0.9fr',
          gap: isVertical ? 30 : 38,
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative' }}>
          <CameraPush fromScale={0.98} toScale={1.05} fromY={12} toY={-22}>
            <ChromeShot title="RDO Inteligente" file="rdo-dashboard.png" height={isVertical ? 460 : 520} />
          </CameraPush>
          <ClickPulse x="72%" y="34%" delay={38} />
          <ClickPulse x="54%" y="64%" delay={76} color={COLORS.success} />
          <GlassPanel
            style={{
              position: 'absolute',
              right: isVertical ? 20 : -18,
              bottom: isVertical ? 24 : 34,
              padding: '16px 18px',
              width: isVertical ? 240 : 260,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: COLORS.success,
              }}
            >
              Campo atualizado
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: FONTS.body,
                fontSize: 18,
                lineHeight: 1.35,
                color: COLORS.text,
              }}
            >
              Fotos, equipes e trechos alimentando o controle do dia.
            </div>
          </GlassPanel>
        </div>

        <div>
          <HeadlineBlock scene={scene} maxWidth={640} />
          <div
            style={{
              marginTop: 28,
              display: 'grid',
              gridTemplateColumns: isVertical ? '1fr 1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            <KpiZoom label="Ultimo RDO" value="Hoje" />
            <KpiZoom label="Frentes ativas" value="08" tone={COLORS.info} delay={8} />
            <KpiZoom label="Alertas" value="03" tone={COLORS.warning} delay={16} />
          </div>
          <GlassPanel style={{ marginTop: 18, padding: '18px 20px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 10,
                fontFamily: FONTS.body,
                fontSize: 18,
                color: COLORS.text,
              }}
            >
              <span>Relatorio 360 atualizado</span>
              <span style={{ color: COLORS.accent, fontWeight: 700 }}>ao vivo</span>
              <span>Torre de Controle sinalizada</span>
              <span style={{ color: COLORS.success, fontWeight: 700 }}>RAG</span>
              <span>Fechamento mensal antecipado</span>
              <span style={{ color: COLORS.info, fontWeight: 700 }}>no mesmo dia</span>
            </div>
          </GlassPanel>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  )
}

const PlanningScene: React.FC<{ scene: LaunchSceneSpec }> = ({ scene }) => {
  const { width, height } = useVideoConfig()
  const isVertical = height > width
  const frame = useCurrentFrame()
  const delayWidth = interpolate(frame, [42, 110], [0, 132], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <SceneFrame>
      <AbsoluteFill
        style={{
          padding: isVertical ? '86px 58px 70px' : '82px 82px 64px',
          display: 'grid',
          gridTemplateColumns: isVertical ? '1fr' : '1fr 0.92fr',
          gap: 34,
          alignItems: 'center',
        }}
      >
        <div>
          <HeadlineBlock scene={scene} maxWidth={720} />
          <GlassPanel style={{ marginTop: 24, padding: '20px 22px' }}>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: COLORS.accent,
              }}
            >
              Gantt + impacto
            </div>
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { name: 'Escavacao T01', base: 210, tone: COLORS.accent },
                { name: 'Assentamento DN200', base: 290, tone: COLORS.info },
                { name: 'Reaterro T01', base: 160, tone: COLORS.success },
                { name: 'Pavimento', base: 240, tone: COLORS.warning },
              ].map((row, index) => (
                <div key={row.name}>
                  <div
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 16,
                      color: COLORS.textDim,
                      marginBottom: 6,
                    }}
                  >
                    {row.name}
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      height: 18,
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: 999,
                    }}
                  >
                    <div
                      style={{
                        width: row.base,
                        height: '100%',
                        borderRadius: 999,
                        background: row.tone,
                        opacity: 0.75,
                      }}
                    />
                    {index === 1 ? (
                      <div
                        style={{
                          position: 'absolute',
                          left: row.base - 8,
                          top: 0,
                          width: delayWidth,
                          height: '100%',
                          borderRadius: 999,
                          background: COLORS.error,
                          opacity: 0.88,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GlassPanel style={{ padding: '18px 20px' }}>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: COLORS.success,
              }}
            >
              LPS / Lean
            </div>
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[
                ['Look-ahead', '06 sem'],
                ['Restricoes', '04'],
                ['PPC', '72%'],
              ].map(([label, value]) => (
                <GlassPanel key={label} style={{ padding: '14px 14px' }}>
                  <div
                    style={{
                      fontFamily: FONTS.display,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: COLORS.textDim,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      fontFamily: FONTS.display,
                      fontSize: 32,
                      fontWeight: 800,
                      letterSpacing: '-0.03em',
                      color: label === 'Restricoes' ? COLORS.warning : COLORS.text,
                    }}
                  >
                    {value}
                  </div>
                </GlassPanel>
              ))}
            </div>
          </GlassPanel>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
            }}
          >
            <KpiZoom label="Impacto" value="+4d" tone={COLORS.error} />
            <KpiZoom label="Acao" value="agora" tone={COLORS.accent} delay={10} />
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  )
}

const SupplyScene: React.FC<{ scene: LaunchSceneSpec }> = ({ scene }) => {
  const { width, height } = useVideoConfig()
  const isVertical = height > width

  return (
    <SceneFrame>
      <AbsoluteFill
        style={{
          padding: isVertical ? '86px 58px 70px' : '82px 82px 64px',
        }}
      >
        <HeadlineBlock scene={scene} maxWidth={900} />
        <div
          style={{
            marginTop: 28,
            display: 'grid',
            gridTemplateColumns: isVertical ? '1fr' : 'repeat(4, 1fr)',
            gap: 18,
            alignItems: 'stretch',
          }}
        >
          {[
            ['PO', 'Pedido aprovado com centro de custo e projeto vinculados.'],
            ['Recebimento', 'Entrega parcial registrada com condicao e data.'],
            ['NF', 'Nota fiscal comparada item a item.'],
            ['Match Engine', 'Divergencia exposta antes de virar surpresa no faturamento.'],
          ].map(([title, body], index) => (
            <GlassPanel
              key={title}
              style={{
                padding: '20px 20px',
                borderColor: index === 3 ? COLORS.accent : COLORS.borderDim,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: index === 3 ? COLORS.accent : COLORS.textDim,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontFamily: FONTS.body,
                  fontSize: 19,
                  lineHeight: 1.34,
                  color: COLORS.text,
                }}
              >
                {body}
              </div>
            </GlassPanel>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: isVertical ? '1fr' : '1fr 1fr',
            gap: 16,
          }}
        >
          <GlassPanel style={{ padding: '18px 20px' }}>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: COLORS.warning,
              }}
            >
              Risco de ruptura
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: FONTS.body,
                fontSize: 18,
                lineHeight: 1.36,
                color: COLORS.text,
              }}
            >
              Tubo DN200 abaixo do minimo para frente da semana seguinte.
            </div>
          </GlassPanel>
          <GlassPanel style={{ padding: '18px 20px' }}>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: COLORS.error,
              }}
            >
              Impacto operacional
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: FONTS.body,
                fontSize: 18,
                lineHeight: 1.36,
                color: COLORS.text,
              }}
            >
              Frente T03 exige acao imediata para nao parar equipe e cronograma.
            </div>
          </GlassPanel>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  )
}

const CtaScene: React.FC<{
  scene: LaunchSceneSpec
  config: LaunchVideoConfig
}> = ({ scene, config }) => {
  const { width, height } = useVideoConfig()
  const isVertical = height > width

  return (
    <SceneFrame>
      <AbsoluteFill
        style={{
          padding: isVertical ? '86px 58px 74px' : '82px 82px 72px',
          display: 'grid',
          gridTemplateColumns: isVertical ? '1fr' : '1fr 0.92fr',
          gap: 34,
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ marginBottom: 20 }}>
            <BrandLogo scale={2.4} />
          </div>
          <HeadlineBlock scene={scene} maxWidth={760} />
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {config.claims.slice(0, isVertical ? 4 : 5).map((claim) => (
              <div
                key={claim}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontFamily: FONTS.body,
                  fontSize: 20,
                  lineHeight: 1.3,
                  color: COLORS.text,
                }}
              >
                <span style={{ color: COLORS.accent }}>•</span>
                {claim}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 28 }}>
            <CTAButton label={config.ctaLabel} />
          </div>
          <div
            style={{
              marginTop: 20,
              fontFamily: FONTS.body,
              fontSize: 18,
              fontWeight: 600,
              color: COLORS.accent,
            }}
          >
            {config.ctaUrl}
          </div>
        </div>

        <GlassPanel style={{ padding: '24px 24px' }}>
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: COLORS.accent,
            }}
          >
            Modulos em destaque
          </div>
          <div style={{ marginTop: 18 }}>
            <ModulePills items={config.modules} />
          </div>
        </GlassPanel>
      </AbsoluteFill>
    </SceneFrame>
  )
}

const renderScene = (scene: LaunchSceneSpec, config: LaunchVideoConfig) => {
  switch (scene.id) {
    case 'hook':
      return <HookScene scene={scene} />
    case 'pain':
      return <PainScene scene={scene} />
    case 'pivot':
      return <PivotScene scene={scene} config={config} />
    case 'platform':
      return <PlatformScene scene={scene} />
    case 'field':
      return <FieldScene scene={scene} />
    case 'planning':
      return <PlanningScene scene={scene} />
    case 'supply':
      return <SupplyScene scene={scene} />
    case 'cta':
      return <CtaScene scene={scene} config={config} />
    default:
      return null
  }
}

export const LaunchCampaign: React.FC<LaunchCampaignProps> = (props) => {
  const config = buildResolvedConfig(props)
  const positionedScenes = getScenePositions(config.scenes)
  const totalDuration = positionedScenes.reduce(
    (total, scene) => total + scene.durationInFrames,
    0,
  )

  return (
    <AbsoluteFill style={{ background: COLORS.bgDeep }}>
      {positionedScenes.map((scene) => (
        <Sequence key={scene.id} from={scene.from} durationInFrames={scene.durationInFrames}>
          {renderScene(scene, config)}
        </Sequence>
      ))}
      <ProgressBar totalDuration={totalDuration} />
    </AbsoluteFill>
  )
}

export const LaunchMaster90s: React.FC = () => <LaunchCampaign variant="master" />

export const LaunchLandingCut45s: React.FC = () => (
  <LaunchCampaign variant="landing" />
)

export const LaunchVertical60s: React.FC = () => (
  <LaunchCampaign variant="vertical" />
)
