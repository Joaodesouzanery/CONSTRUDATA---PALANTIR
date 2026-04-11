/**
 * ImpactStatementSection — Manifesto "Vender Impacto, não Módulo".
 *
 * Seção emocional/de fechamento que vem DEPOIS dos módulos e ANTES do
 * AllModulesGrid. Reforça que a Atlântico não é software — é metodologia
 * que distribui autonomia pela cadeia inteira da construção.
 */
import { HardHat, ClipboardList, Smartphone } from 'lucide-react'
import { FlowHoverButton } from '@/components/ui/flow-hover-button'
import { CALENDLY_URL } from './LandingHeader'

interface PersonaProps {
  icon: React.ReactNode
  role: string
  where: string
  decision: string
}

function PersonaCard({ icon, role, where, decision }: PersonaProps) {
  return (
    <div
      className="p-6 transition-all group"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderTop: '2px solid rgba(249,115,22,0.40)',
      }}
    >
      <div className="text-[#f97316] mb-3">{icon}</div>
      <div
        style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.10em' }}
        className="text-white/45 text-[10px] uppercase font-semibold mb-1"
      >
        {where}
      </div>
      <div
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        className="text-white text-base font-semibold mb-2"
      >
        O {role}
      </div>
      <div className="text-white/70 text-sm leading-relaxed mb-4">{decision}</div>
      <a
        href={CALENDLY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#f97316] text-xs font-semibold hover:underline"
      >
        Ver como funciona &rarr;
      </a>
    </div>
  )
}

export function ImpactStatementSection() {
  return (
    <section
      style={{
        background:
          'linear-gradient(180deg, #2c2c2c 0%, #333333 50%, #2c2c2c 100%)',
        borderTop: '1px solid rgba(255,255,255,0.10)',
        borderBottom: '1px solid rgba(255,255,255,0.10)',
      }}
      className="py-16 sm:py-24 lg:py-32 relative overflow-hidden"
    >
      {/* Background ornament — círculo laranja sutil */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          border: '1px solid rgba(249,115,22,0.08)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          width: '900px',
          height: '900px',
          borderRadius: '50%',
          border: '1px solid rgba(249,115,22,0.05)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section divider */}
        <div className="flex items-center gap-3 mb-10 sm:mb-16">
          <span
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }}
            className="text-[#f97316] text-xs uppercase font-mono"
          >
            Manifesto / Impacto
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(249,115,22,0.20)' }} />
        </div>

        {/* Headline manifesto */}
        <div className="max-w-4xl mb-16">
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(1.6rem, 4.5vw, 3.5rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: '#f4f5f7',
            }}
            className="mb-8"
          >
            Você não está comprando um <span className="text-white/40">software</span>.
            <br />
            Está comprando{' '}
            <span style={{ color: '#f97316' }}>autonomia</span> para a sua cadeia inteira.
          </h2>

          <div
            className="pl-6 max-w-2xl"
            style={{ borderLeft: '3px solid #f97316' }}
          >
            <p className="text-white/85 text-base md:text-lg leading-relaxed">
              Toda obra é uma cadeia de decisões. Quando essa cadeia opera com{' '}
              <strong className="text-white">a mesma fonte de verdade</strong>, do canteiro
              ao escritório, o resultado é uma construtora que decide melhor em todos os níveis,
              ao mesmo tempo.
            </p>
          </div>
        </div>

        {/* 3 personas — onde a autonomia chega */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          <PersonaCard
            icon={<HardHat size={28} strokeWidth={1.5} />}
            where="No canteiro"
            role="engenheiro"
            decision="decide melhor sobre o que registrar, o que medir, qual restrição abrir — porque vê o impacto da decisão dele em tempo real no cronograma."
          />
          <PersonaCard
            icon={<ClipboardList size={28} strokeWidth={1.5} />}
            where="No escritório"
            role="gerente"
            decision="decide melhor sobre realocação de equipe, aprovação de PO, priorização de obra — porque vê o CPI/SPI atualizado sem precisar pedir relatório."
          />
          <PersonaCard
            icon={<Smartphone size={28} strokeWidth={1.5} />}
            where="No celular"
            role="diretor"
            decision="decide melhor sobre risco de portfólio, novas obras, conversa com cliente — porque abre 30 segundos de manhã e já sabe o que está em pé e o que está caindo."
          />
        </div>

        {/* Quote final */}
        <div className="max-w-3xl">
          <p
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            className="text-white text-2xl md:text-3xl font-semibold leading-tight mb-8"
          >
            A obra inteira fica{' '}
            <span style={{ color: '#f97316' }}>mais inteligente</span>.
          </p>
          <p className="text-white/65 text-sm leading-relaxed mb-10 max-w-2xl">
            Não porque tem mais dashboards. Porque tem mais pessoas decidindo bem,
            no momento certo, com a informação certa. É isso que distribui autonomia
            de verdade pela cadeia da sua construção.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <FlowHoverButton
              variant="accent"
              href={CALENDLY_URL}
              target="_blank"
              className="text-sm px-7 py-3"
            >
              Quero ver isso na minha obra
            </FlowHoverButton>
            <span className="text-white/40 text-xs">
              20 minutos. Sem compromisso.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
