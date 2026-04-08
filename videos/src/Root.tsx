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
    </>
  )
}
