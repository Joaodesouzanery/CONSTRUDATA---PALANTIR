import { FlowHoverButton } from '@/components/ui/flow-hover-button'
import { CALENDLY_URL, LOGIN_URL } from './LandingHeader'

export function FooterCTA() {
  return (
    <section style={{ background: '#2c2c2c', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-16 sm:py-24 lg:py-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-8 sm:mb-12">
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.10)' }} />
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }} className="text-white/55 text-xs uppercase font-mono">Próximo Passo</span>
          <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <h2
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(1.85rem, 5vw, 4.5rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
          className="text-white mb-6"
        >
          Construa com Inteligência.
        </h2>

        <p className="text-white/70 text-lg mb-12 max-w-xl mx-auto">
          Construa o futuro com a inteligência e a precisão da Atlântico.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <FlowHoverButton variant="ghost" href={LOGIN_URL} className="text-sm px-8 py-3">
            Acessar
          </FlowHoverButton>
          <FlowHoverButton
            variant="accent"
            href={CALENDLY_URL}
            target="_blank"
            className="text-sm px-8 py-3"
          >
            Agendar Demonstração
          </FlowHoverButton>
        </div>
      </div>
    </section>
  )
}
