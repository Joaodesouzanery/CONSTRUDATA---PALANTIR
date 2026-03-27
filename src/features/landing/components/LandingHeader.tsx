import { useState, useEffect } from 'react'
import { Search, Menu, X, Droplets } from 'lucide-react'
import { FlowHoverButton } from '@/components/ui/flow-hover-button'

const NAV_LINKS = [
  { label: 'Plataforma', href: '#plataforma' },
  { label: 'Módulos', href: '#modulos' },
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Contato', href: '#contato' },
]

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#0a1628] flex items-center justify-center group-hover:bg-[#112645] transition-colors">
              <Droplets size={16} className="text-[#2abfdc]" />
            </div>
            <span className={`font-bold text-lg tracking-tight transition-colors ${scrolled ? 'text-[#0a1628]' : 'text-white'}`}>
              Atlântico
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-[#2abfdc] ${
                  scrolled ? 'text-gray-600' : 'text-white/80'
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-3">
            <button className={`p-2 rounded-lg transition-colors ${scrolled ? 'text-gray-500 hover:text-gray-900 hover:bg-gray-100' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
              <Search size={18} />
            </button>
            <FlowHoverButton variant={scrolled ? 'light' : 'dark'} href="/app/gestao-360">
              Começar Agora
            </FlowHoverButton>
          </div>

          {/* Mobile hamburger */}
          <button
            className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? 'text-gray-700' : 'text-white'}`}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <div className="px-4 py-4 space-y-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block text-sm font-medium text-gray-700 hover:text-[#2abfdc] py-2"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <FlowHoverButton variant="light" href="/app/gestao-360" className="w-full justify-center mt-2">
              Começar Agora
            </FlowHoverButton>
          </div>
        </div>
      )}
    </header>
  )
}
