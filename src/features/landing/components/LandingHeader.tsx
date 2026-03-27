import { useState } from 'react'
import { Search, Menu, X } from 'lucide-react'
import { FlowHoverButton } from '@/components/ui/flow-hover-button'

const NAV_LINKS = [
  { label: 'Plataforma', href: '#plataforma' },
  { label: 'Módulos', href: '#modulos' },
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Contato', href: '#contato' },
]

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header
      style={{ background: 'rgba(8,9,13,0.96)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 1L17 9L9 17L1 9L9 1Z" stroke="#2abfdc" strokeWidth="1.5" fill="rgba(42,191,220,0.08)" />
            </svg>
            <span
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.18em' }}
              className="text-white font-semibold text-sm uppercase"
            >
              Atlântico
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{ letterSpacing: '0.06em' }}
                className="text-white/45 text-xs font-medium uppercase hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-4">
            <button className="text-white/40 hover:text-white transition-colors p-1">
              <Search size={16} />
            </button>
            <FlowHoverButton variant="accent" href="/app/gestao-360" className="text-xs py-2 px-4">
              Começar Agora
            </FlowHoverButton>
          </div>

          {/* Mobile */}
          <button
            className="md:hidden text-white/60 hover:text-white p-1"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: '#08090d', borderTop: '1px solid rgba(255,255,255,0.07)' }} className="md:hidden">
          <div className="px-6 py-6 flex flex-col gap-5">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                style={{ letterSpacing: '0.08em' }}
                className="text-white/50 text-xs uppercase font-medium hover:text-white transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <FlowHoverButton variant="accent" href="/app/gestao-360" className="w-full justify-center mt-2 text-xs">
              Começar Agora
            </FlowHoverButton>
          </div>
        </div>
      )}
    </header>
  )
}
