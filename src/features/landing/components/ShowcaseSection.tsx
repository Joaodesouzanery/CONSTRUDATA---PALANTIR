import { Calendar, ListChecks, FileText, Calculator, Monitor, Map, ArrowRight } from 'lucide-react'
import { FlowHoverButton } from '@/components/ui/flow-hover-button'
import { CALENDLY_URL, LOGIN_URL } from './LandingHeader'

/* ── Section divider ─────────────────────────────────────────────── */
function SectionDivider({ num, tag }: { num: string; tag: string }) {
  return (
    <div className="flex items-center gap-3 mb-10 sm:mb-16">
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }} className="text-white/60 text-xs uppercase font-mono">{num} / {tag}</span>
      <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
    </div>
  )
}

/* ── Data ─────────────────────────────────────────────────────────── */
const MODULES = [
  { icon: Calendar, name: 'Agenda / Cronograma', desc: 'Calendário de marcos com detecção de conflitos e alertas automáticos.' },
  { icon: ListChecks, name: 'LPS / Lean', desc: 'Last Planner System com look-ahead 6 semanas e PPC semanal.' },
  { icon: FileText, name: 'RDO', desc: 'Relatório Diário de Obra digital com IA preditiva e análise de campo.' },
  { icon: Calculator, name: 'Quantitativos', desc: 'BOQ com base SINAPI/SEINFRA, BDI configurável e exportação.' },
  { icon: Monitor, name: 'Torre de Controle', desc: 'Visão war room multiportfólio com CPI, SPI e drill-down.' },
  { icon: Map, name: 'Mapa Interativo', desc: 'Editor GIS com importação UTM, perfil 3D e análise de custos.' },
]

const OBJECTIVES = [
  { label: 'Transparência Total', desc: 'Dados integrados e acessíveis em tempo real para todos os stakeholders' },
  { label: 'Eficiência Operacional', desc: 'Redução de desperdício e retrabalho através de automação inteligente' },
  { label: 'Decisões Baseadas em Dados', desc: 'IA que antecipa riscos e sugere ações antes que problemas aconteçam' },
  { label: 'Acessibilidade Universal', desc: 'Plataforma web-based, sem softwares pesados, para toda a equipe' },
]

/* ── Component ────────────────────────────────────────────────────── */
export function ShowcaseSection() {

  return (
    <section>
      {/* ── A) AI Headline Block ──────────────────────────────────── */}
      <div style={{ background: '#2c2c2c', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-16 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionDivider num="10" tag="AUTOMAÇÃO IA" />

          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(1.6rem, 3.5vw, 3rem)',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              color: '#f4f5f7',
            }}
            className="max-w-4xl mb-6"
          >
            Automação Alimentada por Inteligência Artificial para Cada Decisão
          </h2>

          <p className="text-white/75 text-base leading-relaxed max-w-3xl">
            Nosso software alimenta decisões em tempo real, impulsionadas por IA, em operações críticas de construção e saneamento — do canteiro de obras ao escritório executivo.
          </p>
        </div>
      </div>

      {/* ── B) Software / Modules Grid ────────────────────────────── */}
      <div style={{ background: '#333333' }} className="py-12 sm:py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-px" style={{ background: 'rgba(255,255,255,0.10)' }}>
            {MODULES.map(({ icon: Icon, name, desc }) => (
              <div
                key={name}
                style={{ background: '#333333' }}
                className="group p-6 flex flex-col gap-3 hover:bg-[#2c2c2c] transition-colors cursor-default"
              >
                <Icon size={18} className="text-white/60 group-hover:text-[#f97316] transition-colors" />
                <div>
                  <div
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    className="text-white/90 font-semibold text-sm mb-1 group-hover:text-white transition-colors"
                  >
                    {name}
                  </div>
                  <div className="text-white/70 text-xs leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── C) Mission & Values ────────────────────────────────────── */}
      <div style={{ background: '#2c2c2c', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-16 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
            {/* Left — Mission */}
            <div style={{ borderLeft: '3px solid #f97316' }} className="pl-6">
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 'clamp(1.3rem, 2.5vw, 2rem)',
                  lineHeight: 1.2,
                  letterSpacing: '-0.01em',
                  color: '#f4f5f7',
                }}
                className="mb-5"
              >
                Nossa Missão
              </h3>
              <p className="text-white/75 text-sm leading-relaxed">
                Empoderar equipes de construção e saneamento com inteligência operacional de classe mundial. Acreditamos que dados conectados, automação inteligente e interfaces intuitivas transformam a maneira como projetos de infraestrutura são planejados, executados e entregues — eliminando desperdício, reduzindo riscos e acelerando resultados para toda a cadeia de valor.
              </p>
            </div>

            {/* Right — Objectives */}
            <div className="space-y-6">
              {OBJECTIVES.map((obj) => (
                <div key={obj.label} className="flex gap-4 items-start">
                  <div className="w-2 h-2 rounded-full bg-[#f97316] mt-1.5 shrink-0" />
                  <div>
                    <span className="text-white/90 text-sm font-medium">{obj.label}</span>
                    <span className="text-white/70 text-sm"> — {obj.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── D) Quote Block ─────────────────────────────────────────── */}
      <div style={{ background: '#333333' }} className="py-12 sm:py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: 'clamp(1.2rem, 2.2vw, 1.7rem)',
              lineHeight: 1.4,
              letterSpacing: '-0.01em',
              color: 'rgba(255,255,255,0.90)',
            }}
            className="mb-8"
          >
            &ldquo;Há tanto ainda a ser construído. A Atlântico entrega resultados decisivos para as instituições mais importantes da construção civil e saneamento.&rdquo;
          </p>
          <a
            href="#contato"
            className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wider transition-colors hover:opacity-80"
            style={{ color: '#f97316', letterSpacing: '0.12em' }}
          >
            SAIBA MAIS <ArrowRight size={14} />
          </a>
        </div>
      </div>

      {/* ── E) CTA Block ───────────────────────────────────────────── */}
      <div style={{ background: '#333333' }} className="py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-center gap-4">
          <FlowHoverButton variant="ghost" href={LOGIN_URL}>
            Acessar
          </FlowHoverButton>
          <FlowHoverButton variant="accent" href={CALENDLY_URL} target="_blank">
            Agendar Demonstração
          </FlowHoverButton>
        </div>
      </div>
    </section>
  )
}
