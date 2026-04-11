/**
 * ScreenshotShowcase — Grid de screenshots da plataforma.
 * Exibido logo após a seção de Metodologia na landing page.
 *
 * Para adicionar screenshots reais:
 * 1. Coloque os arquivos .jpg/.png em src/assets/screenshots/
 * 2. Importe e substitua os placeholders abaixo
 */
import { useState } from 'react'

interface Screenshot {
  id: string
  label: string
  module: string
  src: string | null  // null = placeholder, string = imported image URL
}

// Quando tiver as imagens reais, importe assim:
// import screenshotAgenda from '@/assets/screenshots/agenda.jpg'
// e substitua src: null por src: screenshotAgenda

const SCREENSHOTS: Screenshot[] = [
  { id: 'agenda',        label: 'Agenda Gantt',              module: 'Agenda',           src: null },
  { id: 'gestao360',     label: 'Dashboard de Obras',        module: 'Gestão 360',       src: null },
  { id: 'lps',           label: 'Look-ahead LPS',            module: 'LPS / Lean',       src: null },
  { id: 'projetos',      label: 'BIM 5D + Projetos',         module: 'Projetos',         src: null },
  { id: 'quantitativos', label: 'Composição Orçamentária',   module: 'Quantitativos',    src: null },
  { id: 'rdo-plan',      label: 'RDO × Planejamento',        module: 'RDO',              src: null },
  { id: 'relatorio360',  label: 'Relatório Diário de Obra',  module: 'Relatório 360',    src: null },
]

function PlaceholderCard({ label, module }: { label: string; module: string }) {
  return (
    <div className="w-full aspect-video rounded-lg flex flex-col items-center justify-center"
      style={{ background: '#1a1a2e', border: '1px solid rgba(249,115,22,0.20)' }}
    >
      <span className="text-[#f97316] text-xs font-semibold mb-1">{module}</span>
      <span className="text-white/40 text-[10px]">{label}</span>
    </div>
  )
}

export function ScreenshotShowcase() {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedShot = SCREENSHOTS.find((s) => s.id === selected)

  return (
    <section
      style={{ background: '#1f1f1f', borderTop: '1px solid rgba(255,255,255,0.06)' }}
      className="py-16 sm:py-20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <p
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.10em' }}
            className="text-[#f97316] text-xs uppercase font-semibold mb-3"
          >
            A Plataforma em Ação
          </p>
          <h2
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 'clamp(1.3rem, 2.5vw, 2rem)' }}
            className="text-white"
          >
            Veja como cada módulo funciona na prática
          </h2>
        </div>

        {/* Screenshot grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {SCREENSHOTS.map((shot) => (
            <button
              key={shot.id}
              onClick={() => setSelected(shot.id === selected ? null : shot.id)}
              className="group relative rounded-xl overflow-hidden transition-all hover:ring-2 hover:ring-[#f97316]/50"
              style={{
                border: selected === shot.id ? '2px solid #f97316' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {shot.src ? (
                <img
                  src={shot.src}
                  alt={shot.label}
                  className="w-full aspect-video object-cover object-top"
                  loading="lazy"
                />
              ) : (
                <PlaceholderCard label={shot.label} module={shot.module} />
              )}

              {/* Overlay label */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <span className="text-white text-xs font-semibold">{shot.module}</span>
                <br />
                <span className="text-white/60 text-[10px]">{shot.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Expanded view */}
        {selectedShot && selectedShot.src && (
          <div className="mt-6 rounded-xl overflow-hidden border border-[#525252]">
            <img
              src={selectedShot.src}
              alt={selectedShot.label}
              className="w-full"
            />
            <div className="bg-[#2c2c2c] px-4 py-2 flex items-center justify-between">
              <span className="text-white text-sm font-semibold">{selectedShot.module} — {selectedShot.label}</span>
              <button
                onClick={() => setSelected(null)}
                className="text-[#6b6b6b] hover:text-white text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
