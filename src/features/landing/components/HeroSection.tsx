import { useState, useEffect, type ReactNode } from 'react'
import { CALENDLY_URL, LOGIN_URL } from './LandingHeader'

const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4'

const CHAR_DELAY = 30
const HEADING_INITIAL_DELAY = 200

function FadeIn({
  delay = 0,
  duration = 1000,
  children,
  className = '',
}: {
  delay?: number
  duration?: number
  children: ReactNode
  className?: string
}) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return (
    <div
      className={`transition-opacity ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  )
}

function AnimatedHeading({ text, className = '', style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const [started, setStarted] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setStarted(true), HEADING_INITIAL_DELAY)
    return () => clearTimeout(t)
  }, [])
  const lines = text.split('\n')
  return (
    <h1 className={className} style={style}>
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} style={{ display: 'block' }}>
          {Array.from(line).map((char, charIndex) => {
            const delay = lineIndex * line.length * CHAR_DELAY + charIndex * CHAR_DELAY
            return (
              <span
                key={charIndex}
                style={{
                  display: 'inline-block',
                  opacity: started ? 1 : 0,
                  transform: started ? 'translateX(0)' : 'translateX(-18px)',
                  transition: `opacity 500ms ease ${delay}ms, transform 500ms ease ${delay}ms`,
                  whiteSpace: 'pre',
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            )
          })}
        </span>
      ))}
    </h1>
  )
}

export function HeroSection() {
  return (
    <section className="relative w-full h-screen min-h-[640px] overflow-hidden bg-black text-white">
      {/* Local liquid-glass styles (escopo Hero) */}
      <style>{`
        .hero-liquid-glass {
          background: rgba(0, 0, 0, 0.4);
          background-blend-mode: luminosity;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: none;
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
          position: relative;
          overflow: hidden;
        }
        .hero-liquid-glass::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1.4px;
          background: linear-gradient(180deg,
            rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 20%,
            rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%,
            rgba(255,255,255,0.1) 80%, rgba(255,255,255,0.3) 100%);
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
          pointer-events: none;
        }
      `}</style>

      {/* Background video — sem overlay */}
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Conteúdo do Hero — alinhado ao fundo */}
      <div className="relative z-10 h-full px-6 md:px-12 lg:px-16 flex flex-col">
        <div className="flex-1 flex flex-col justify-end pb-12 lg:pb-16">
          <div className="lg:grid lg:grid-cols-2 lg:items-end lg:gap-8">
            {/* Coluna esquerda */}
            <div>
              <AnimatedHeading
                text={'Inteligência Operacional\npara Construção e Saneamento.'}
                className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-normal mb-4 text-white"
                style={{ letterSpacing: '-0.04em', lineHeight: 1.05 }}
              />

              <FadeIn delay={800} duration={1000}>
                <p className="text-base md:text-lg text-gray-300 mb-5 max-w-xl">
                  Da pré-construção ao encerramento, cada atividade, recurso e
                  material conectados em uma única plataforma de dados em tempo real.
                </p>
              </FadeIn>

              <FadeIn delay={1200} duration={1000}>
                <div className="flex flex-wrap gap-4">
                  <a
                    href={LOGIN_URL}
                    className="bg-white text-black px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                  >
                    Login
                  </a>
                  <a
                    href={CALENDLY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hero-liquid-glass border border-white/20 text-white px-8 py-3 rounded-lg font-medium hover:bg-white hover:text-black transition-colors"
                  >
                    Agendar Demonstração
                  </a>
                </div>
              </FadeIn>
            </div>

            {/* Coluna direita — tag glass */}
            <div className="flex items-end justify-start lg:justify-end mt-10 lg:mt-0">
              <FadeIn delay={1400} duration={1000}>
                <div className="hero-liquid-glass border border-white/20 px-6 py-3 rounded-xl">
                  <span className="text-lg md:text-xl lg:text-2xl font-light text-white">
                    Construção. Saneamento. Inteligência.
                  </span>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
