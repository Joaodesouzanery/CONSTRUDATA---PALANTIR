/**
 * ScreenshotShowcase — Grid de screenshots estilo Palantir Construction.
 * Mosaico dark com hover zoom e labels de módulo.
 *
 * Para usar: coloque as imagens em public/screenshots/ com os nomes abaixo.
 * Se a imagem não existir, mostra um placeholder estilizado.
 */
import { useState } from 'react'
import { X } from 'lucide-react'

interface Shot {
  file: string
  module: string
  label: string
  span?: string // grid span class
}

const SHOTS: Shot[] = [
  { file: 'relatorio-360.png',      module: 'Relatório 360',     label: 'Relatório Diário de Obra',       span: 'col-span-2 row-span-2' },
  { file: 'gestao360.png',          module: 'Gestão 360',        label: 'Dashboard de Projetos + Mapa',   span: 'col-span-2 row-span-2' },
  { file: 'torre-controle-mapa.png', module: 'Torre de Controle', label: 'Mapa de Obras + KPIs',          span: 'col-span-2' },
  { file: 'lps-lookahead.png',      module: 'LPS / Lean',        label: 'Look-ahead 6 Semanas',           span: 'col-span-2' },
  { file: 'bim-5d.png',             module: 'Projetos + BIM',    label: 'BIM 5D + Análise de Custos',     span: 'col-span-2' },
  { file: 'quantitativos.png',      module: 'Quantitativos',     label: 'Composição SINAPI',              span: 'col-span-2' },
  { file: 'rdo-dashboard.png',      module: 'RDO',               label: 'RDO × Planejamento Integrado',   span: 'col-span-2' },
  { file: 'agenda-gantt.png',       module: 'Agenda',            label: 'Gantt de Recursos',              span: 'col-span-2' },
]

export function ScreenshotShowcase() {
  const [lightbox, setLightbox] = useState<Shot | null>(null)

  return (
    <section
      style={{ background: '#111111', borderTop: '1px solid rgba(255,255,255,0.04)' }}
      className="py-12 sm:py-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <p
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.12em' }}
            className="text-[#f97316] text-[10px] uppercase font-semibold mb-2"
          >
            A Plataforma em Ação
          </p>
          <h2
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}
            className="text-white text-xl sm:text-2xl"
          >
            Inteligência Operacional — Do Campo ao Escritório
          </h2>
        </div>

        {/* Masonry-style grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1.5 auto-rows-[140px] sm:auto-rows-[180px]">
          {SHOTS.map((shot) => (
            <button
              key={shot.file}
              onClick={() => setLightbox(shot)}
              className={`group relative overflow-hidden rounded-lg ${shot.span ?? 'col-span-1'}`}
              style={{ background: '#1a1a1a' }}
            >
              {/* Image — loads from /screenshots/ in public folder */}
              <img
                src={`/screenshots/${shot.file}`}
                alt={shot.label}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  // Hide broken image, show placeholder
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />

              {/* Gradient overlay */}
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.1) 100%)',
                }}
              />

              {/* Hover ring */}
              <div className="absolute inset-0 rounded-lg ring-0 group-hover:ring-1 ring-[#f97316]/50 transition-all" />

              {/* Label */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <span className="text-[#f97316] text-[10px] font-bold uppercase tracking-wider">
                  {shot.module}
                </span>
                <br />
                <span className="text-white/80 text-xs font-medium">
                  {shot.label}
                </span>
              </div>

              {/* Placeholder if no image */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-white/10 text-xs font-mono">{shot.file}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[2000] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white"
            >
              <X size={24} />
            </button>
            <img
              src={`/screenshots/${lightbox.file}`}
              alt={lightbox.label}
              className="w-full rounded-lg border border-[#525252]"
            />
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[#f97316] text-sm font-semibold">{lightbox.module}</span>
              <span className="text-white/60 text-sm">{lightbox.label}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
