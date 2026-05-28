/**
 * Root.tsx — Registro de todas as composições Remotion da Atlântico.
 *
 * Cada <Composition> é um vídeo que pode ser preview/renderizado por id.
 * IDs são usados nos comandos `npm run render:hero` etc.
 */
import { Composition } from 'remotion'
import { HeroLoop } from './HeroLoop/HeroLoop'
import { ProductDemo30s } from './ProductDemo30s/ProductDemo30s'
import { LinkedInTeaser60s } from './LinkedInTeaser60s/LinkedInTeaser60s'
import {
  ExplainerModulos,
  EXPLAINER_DURATION,
  EXPLAINER_FPS,
  EXPLAINER_W,
  EXPLAINER_H,
} from './ExplainerModulos/ExplainerModulos'
import {
  TorreDeControle,
  TORRE_DURATION,
  TORRE_FPS,
  TORRE_W,
  TORRE_H,
} from './TorreDeControle/TorreDeControle'
import {
  LAUNCH_FPS,
  LAUNCH_LANDING_DURATION,
  LAUNCH_LANDING_H,
  LAUNCH_LANDING_W,
  LAUNCH_MASTER_DURATION,
  LAUNCH_MASTER_H,
  LAUNCH_MASTER_W,
  LAUNCH_VERTICAL_DURATION,
  LAUNCH_VERTICAL_H,
  LAUNCH_VERTICAL_W,
  LaunchLandingCut45s,
  LaunchMaster90s,
  LaunchVertical60s,
} from './LaunchCampaign/LaunchCampaign'

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ── 1) Hero Loop — vídeo de fundo da landing (16:9, 15s, sem áudio, loop) */}
      <Composition
        id="HeroLoop"
        component={HeroLoop}
        durationInFrames={450} // 15s × 30fps
        fps={30}
        width={1920}
        height={1080}
      />

      {/* ── 2) Product Demo 30s — vídeo curto para landing/email/twitter (16:9) */}
      <Composition
        id="ProductDemo30s"
        component={ProductDemo30s}
        durationInFrames={900} // 30s × 30fps
        fps={30}
        width={1920}
        height={1080}
      />

      {/* ── 3) LinkedIn Teaser 60s — vertical para Reels/Stories/Shorts (9:16) */}
      <Composition
        id="LinkedInTeaser60s"
        component={LinkedInTeaser60s}
        durationInFrames={1800} // 60s × 30fps
        fps={30}
        width={1080}
        height={1920}
      />

      {/* ── 4) Explainer Módulos ~96s — vídeo principal com screenshots reais
             dos 6 módulos em destaque + cursor animado clicando na UI (16:9) */}
      <Composition
        id="ExplainerModulos"
        component={ExplainerModulos}
        durationInFrames={EXPLAINER_DURATION}
        fps={EXPLAINER_FPS}
        width={EXPLAINER_W}
        height={EXPLAINER_H}
      />

      {/* ── 5) Torre de Controle 75s — vídeo standalone com mockups animados
             do módulo Torre de Controle (16:9) */}
      <Composition
        id="TorreDeControle"
        component={TorreDeControle}
        durationInFrames={TORRE_DURATION}
        fps={TORRE_FPS}
        width={TORRE_W}
        height={TORRE_H}
      />

      {/* -- 6) Launch Master 16:9 - peca-mae para landing e apresentacao */}
      <Composition
        id="LaunchMaster90s"
        component={LaunchMaster90s}
        durationInFrames={LAUNCH_MASTER_DURATION}
        fps={LAUNCH_FPS}
        width={LAUNCH_MASTER_W}
        height={LAUNCH_MASTER_H}
      />

      {/* -- 7) Launch Landing Cut 45s - corte curto para hero/showcase */}
      <Composition
        id="LaunchLandingCut45s"
        component={LaunchLandingCut45s}
        durationInFrames={LAUNCH_LANDING_DURATION}
        fps={LAUNCH_FPS}
        width={LAUNCH_LANDING_W}
        height={LAUNCH_LANDING_H}
      />

      {/* -- 8) Launch Vertical 60s - corte para social e divulgacao */}
      <Composition
        id="LaunchVertical60s"
        component={LaunchVertical60s}
        durationInFrames={LAUNCH_VERTICAL_DURATION}
        fps={LAUNCH_FPS}
        width={LAUNCH_VERTICAL_W}
        height={LAUNCH_VERTICAL_H}
      />
    </>
  )
}
