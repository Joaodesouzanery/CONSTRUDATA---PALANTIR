import { useState, useEffect } from 'react'
import { ChevronRight, ArrowRight } from 'lucide-react'
import { FlowHoverButton } from '@/components/ui/flow-hover-button'

const SLIDES = [
  {
    title: 'Gestão de Projeto 360',
    subtitle: 'Visão executiva de portfólio com KPIs em tempo real, curva-S e alertas críticos.',
    tag: 'Torre de Controle',
    mockup: 'gestao360',
  },
  {
    title: 'Mapa Interativo de Redes',
    subtitle: 'Visualize e gerencie redes de esgoto, água e drenagem com análise 3D/4D/5D integrada.',
    tag: 'Mapa Interativo',
    mockup: 'mapa',
  },
  {
    title: 'LPS / Last Planner System',
    subtitle: 'Planejamento colaborativo lean com look-ahead de 6 semanas e PPC semanal.',
    tag: 'LPS / Lean',
    mockup: 'lps',
  },
  {
    title: 'Quantitativos e Orçamento',
    subtitle: 'Base SINAPI/SEINFRA integrada com composição de custos e exportação Excel.',
    tag: 'Quantitativos',
    mockup: 'quant',
  },
]

// Browser mockup frame colors per slide
const SLIDE_COLORS = ['#0a1628', '#0d2040', '#1a0a28', '#0a1a28']

function BrowserFrame({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10" style={{ background: color }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10" style={{ background: `${color}cc` }}>
        <span className="w-3 h-3 rounded-full bg-red-500/70" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
        <span className="w-3 h-3 rounded-full bg-green-500/70" />
        <div className="flex-1 ml-2 h-5 rounded bg-white/10 flex items-center px-3">
          <span className="text-white/40 text-xs font-mono">app.atlantico.com.br/gestao-360</span>
        </div>
      </div>
      {children}
    </div>
  )
}

function GestaoMockup() {
  return (
    <div className="p-4 space-y-3 min-h-64">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded bg-[#2abfdc]/20 flex items-center justify-center">
          <div className="w-3 h-3 rounded-sm bg-[#2abfdc]" />
        </div>
        <span className="text-white text-sm font-semibold">Gestão de Projeto 360</span>
        <div className="ml-auto flex items-center gap-1 text-xs text-white/50">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Ao Vivo
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'EAC Projetado', value: 'R$12.4M', color: '#2abfdc' },
          { label: 'CPI', value: '0.59', color: '#ef4444' },
          { label: 'SPI', value: '0.39', color: '#f97316' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white/5 rounded-lg p-2 border border-white/10">
            <div className="text-white/50 text-xs mb-1">{kpi.label}</div>
            <div className="font-bold text-sm" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="text-white/50 text-xs mb-2">Progresso — PRJ-001 Torre Residencial Premium</div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-[#2abfdc] to-[#38bdf8]" style={{ width: '47%' }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-white/40 text-xs">47%</span>
          <span className="text-white/40 text-xs">Prazo: Jun/26</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {['OBR-001 ● Crítico', 'OBR-002 ● Alerta', 'OBR-003 ● OK', 'OBR-006 ● OK'].map((item, i) => {
          const color = i === 0 ? '#ef4444' : i === 1 ? '#f97316' : '#22c55e'
          return (
            <div key={item} className="bg-white/5 rounded-lg px-2 py-1.5 border border-white/10 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-white/70 text-xs truncate">{item.split('●')[0]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MapaMockup() {
  return (
    <div className="p-4 space-y-3 min-h-64">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-white text-sm font-semibold">Mapa Interativo</span>
        <span className="text-xs bg-[#2abfdc]/20 text-[#2abfdc] px-2 py-0.5 rounded-full border border-[#2abfdc]/30">SATÉLITE</span>
      </div>
      <div className="relative rounded-lg overflow-hidden" style={{ height: 160, background: 'linear-gradient(135deg, #1a3a2a 0%, #0d2a1a 50%, #1a2a3a 100%)' }}>
        <svg width="100%" height="100%" viewBox="0 0 400 160">
          <path d="M50,80 L100,60 L160,90 L220,50 L300,70 L380,55" stroke="#2abfdc" strokeWidth="2.5" fill="none" opacity="0.8" strokeDasharray="6,3" />
          <path d="M80,110 L140,95 L200,115 L260,85 L320,100" stroke="#22c55e" strokeWidth="2" fill="none" opacity="0.6" strokeDasharray="5,3" />
          <path d="M30,50 L90,40 L150,65 L210,35 L270,55 L340,40" stroke="#38bdf8" strokeWidth="2" fill="none" opacity="0.5" />
          {[[100,60],[160,90],[220,50],[300,70]].map(([x,y], i) => (
            <circle key={i} cx={x} cy={y} r="4" fill="#2abfdc" opacity="0.9" />
          ))}
          {[[140,95],[200,115],[260,85]].map(([x,y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="#22c55e" opacity="0.9" />
          ))}
        </svg>
        <div className="absolute bottom-2 right-2 bg-black/60 rounded px-2 py-1 text-xs text-white/70">
          39 nós · 2.4km
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {[
          { label: 'Extensão', value: '2.4 km', c: '#2abfdc' },
          { label: 'Custo Est.', value: 'R$ 180k', c: '#22c55e' },
          { label: 'Nós', value: '39', c: '#a78bfa' },
        ].map((s) => (
          <div key={s.label} className="bg-white/5 rounded p-2 border border-white/10 text-center">
            <div className="font-bold" style={{ color: s.c }}>{s.value}</div>
            <div className="text-white/40">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LpsMockup() {
  const weeks = ['S13', 'S14', 'S15', 'S16', 'S17', 'S18']
  const trechos = ['T01 — Escavação', 'T02 — Assentamento DN200', 'T03 — Reaterro', 'T04 — PVs']
  const colors = ['#2abfdc', '#2abfdc', '#a78bfa', '#a78bfa']
  return (
    <div className="p-4 space-y-2 min-h-64">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-white text-sm font-semibold">LPS / Lean — Look-ahead 6 Semanas</span>
        <span className="ml-auto text-xs text-white/50">PPC 46%</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-white/50 pb-1 pr-2 font-normal">Trecho</th>
              {weeks.map((w) => <th key={w} className="text-white/50 pb-1 px-1 font-normal text-center w-12">{w}</th>)}
            </tr>
          </thead>
          <tbody>
            {trechos.map((t, ti) => (
              <tr key={t}>
                <td className="pr-2 py-1">
                  <div className="text-white/70 truncate max-w-[100px]">{t.split('—')[0].trim()}</div>
                  <div className="text-white/30 text-xs">{t.split('—')[1]?.trim()}</div>
                </td>
                {weeks.map((w, wi) => (
                  <td key={w} className="px-0.5 py-1 text-center">
                    {wi < 3 ? (
                      <div className="rounded text-white text-xs py-0.5 px-1 text-center font-medium" style={{ background: `${colors[ti]}33`, border: `1px solid ${colors[ti]}44`, color: colors[ti] }}>
                        {['80m', '60m', '90m', '40m'][ti]}
                      </div>
                    ) : (
                      <div className="text-white/20 text-center">—</div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QuantMockup() {
  const items = [
    { code: 'SINAPI-73965', desc: 'Escavação Mecânica de Vala em Solo Mole', un: 'm³', qty: 480, unit: 18.5, total: 'R$ 11.100' },
    { code: 'SINAPI-76413', desc: 'Assentamento Tubo PVC DN200 — Rede Pluvial', un: 'm', qty: 420, unit: 85, total: 'R$ 44.625' },
    { code: 'SINAPI-73961', desc: 'Boca de Lobo Simples — Concreto Armado', un: 'un', qty: 12, unit: 1850, total: 'R$ 27.750' },
  ]
  return (
    <div className="p-4 space-y-3 min-h-64">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white text-sm font-semibold">Quantitativos e Orçamento</span>
        <span className="text-xs text-[#2abfdc]">Total: R$ 240.807,50</span>
      </div>
      <div className="rounded-lg overflow-hidden border border-white/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-white/40 px-2 py-2 font-normal">Código</th>
              <th className="text-left text-white/40 px-2 py-2 font-normal">Descrição</th>
              <th className="text-right text-white/40 px-2 py-2 font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.code} className="border-b border-white/5">
                <td className="px-2 py-1.5 font-mono text-[#8fb3c8] text-xs">{item.code}</td>
                <td className="px-2 py-1.5 text-white/70 max-w-[120px] truncate">{item.desc}</td>
                <td className="px-2 py-1.5 text-[#2abfdc] text-right font-semibold">{item.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 bg-[#2abfdc]/10 rounded-lg p-2 border border-[#2abfdc]/20 text-center">
          <div className="text-[#2abfdc] font-bold text-sm">10</div>
          <div className="text-white/40 text-xs">itens</div>
        </div>
        <div className="flex-1 bg-white/5 rounded-lg p-2 border border-white/10 text-center">
          <div className="text-white font-bold text-sm">25%</div>
          <div className="text-white/40 text-xs">BDI Global</div>
        </div>
        <div className="flex-1 bg-[#22c55e]/10 rounded-lg p-2 border border-[#22c55e]/20 text-center">
          <div className="text-[#22c55e] font-bold text-sm">SINAPI</div>
          <div className="text-white/40 text-xs">base</div>
        </div>
      </div>
    </div>
  )
}

const MOCKUP_COMPONENTS = [GestaoMockup, MapaMockup, LpsMockup, QuantMockup]

export function HeroSection() {
  const [activeSlide, setActiveSlide] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((s) => (s + 1) % SLIDES.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [])

  const slide = SLIDES[activeSlide]
  const MockupComponent = MOCKUP_COMPONENTS[activeSlide]

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2040 50%, #112645 100%)' }}>
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #2abfdc 1px, transparent 0)',
        backgroundSize: '40px 40px',
      }} />

      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ background: '#2abfdc' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-5" style={{ background: '#a78bfa' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#2abfdc]/30 bg-[#2abfdc]/10">
              <span className="w-2 h-2 rounded-full bg-[#2abfdc] animate-pulse" />
              <span className="text-[#2abfdc] text-xs font-medium">Plataforma para Construção &amp; Saneamento</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Inteligência Operacional para{' '}
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(90deg, #2abfdc, #38bdf8)' }}>
                Construção e Saneamento
              </span>
            </h1>

            <p className="text-lg text-white/60 leading-relaxed max-w-xl">
              Da pré-construção ao encerramento, a Atlântico conecta canteiro, escritório e diretoria em uma única plataforma de dados em tempo real.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <FlowHoverButton href="#contato" variant="dark">
                Solicitar Demonstração Personalizada
              </FlowHoverButton>
              <FlowHoverButton href="#modulos" variant="dark" className="border-white/30 text-white before:bg-white hover:text-[#0a1628]">
                <ArrowRight size={16} />
                Explorar Nossos Módulos
              </FlowHoverButton>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
              {[
                { value: '16+', label: 'Módulos Integrados' },
                { value: '100%', label: 'Baseado em Web' },
                { value: 'BIM', label: '3D / 4D / 5D' },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-white/50 text-xs mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: browser mockup carousel */}
          <div className="relative">
            {/* Slide indicator */}
            <div className="absolute -top-4 left-0 flex items-center gap-2 z-10">
              <span className="text-xs text-[#2abfdc] font-medium border border-[#2abfdc]/30 bg-[#2abfdc]/10 px-2 py-0.5 rounded-full">
                {slide.tag}
              </span>
            </div>

            <BrowserFrame color={SLIDE_COLORS[activeSlide]}>
              <div style={{ transition: 'opacity 0.5s ease', opacity: 1 }}>
                <MockupComponent />
              </div>
            </BrowserFrame>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-4">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSlide(i)}
                  className={`transition-all duration-300 rounded-full ${
                    i === activeSlide ? 'w-6 h-2 bg-[#2abfdc]' : 'w-2 h-2 bg-white/30 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>

            {/* Slide title */}
            <div className="text-center mt-2">
              <p className="text-white/70 text-sm font-medium">{slide.title}</p>
              <p className="text-white/40 text-xs mt-0.5">{slide.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <ChevronRight className="rotate-90 text-white/30 animate-bounce" size={20} />
      </div>
    </section>
  )
}
