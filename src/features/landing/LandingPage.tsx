import { LandingHeader } from './components/LandingHeader'
import { HeroSection } from './components/HeroSection'
import { OntologiaSection } from './components/OntologiaSection'
import { ModulosOverviewSection } from './components/ModulosOverviewSection'
import { FeatureDeepSection } from './components/FeatureDeepSection'
import { AllModulesGrid } from './components/AllModulesGrid'
import { FooterCTA } from './components/FooterCTA'
import { ContactForm } from './components/ContactForm'

export function LandingPage() {
  return (
    <div className="min-h-screen font-sans antialiased" style={{ background: '#fff', color: '#111' }}>
      <LandingHeader />
      <HeroSection />
      <OntologiaSection />
      <ModulosOverviewSection />
      <FeatureDeepSection />
      <AllModulesGrid />
      <FooterCTA />
      <ContactForm />
      {/* Footer */}
      <footer className="bg-[#0a1628] border-t border-white/10 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-white/40 text-sm">© 2026 Atlântico Platform. Todos os direitos reservados.</span>
          <span className="text-white/40 text-sm">Construção &amp; Saneamento · Plataforma SaaS</span>
        </div>
      </footer>
    </div>
  )
}
