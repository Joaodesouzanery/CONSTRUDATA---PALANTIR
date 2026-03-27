import { FlowHoverButton } from '@/components/ui/flow-hover-button'
import { ArrowRight } from 'lucide-react'

export function FooterCTA() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
          Construa com Inteligência
        </h2>
        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Construa o futuro com a inteligência e a precisão da Atlântico.
        </p>
        <FlowHoverButton
          variant="light"
          href="#contato"
          className="mx-auto text-base px-8 py-4"
        >
          <ArrowRight size={18} />
          Agendar uma Demonstração Técnica Gratuita
        </FlowHoverButton>
      </div>
    </section>
  )
}
