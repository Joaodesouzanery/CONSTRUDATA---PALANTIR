/**
 * MethodologySection — Posicionamento da Atlântico como METODOLOGIA, não software.
 *
 * 4 conceitos centrais (Ontologia, Loop de feedback, LPS nativo, Decisão antes de relatório)
 * + 7 benefícios mensuráveis com números em destaque (80%, 3-5%, etc.).
 *
 * Posicionada entre OntologiaSection (01) e ModulosOverviewSection (02) na landing page.
 */
import { Network, Zap, Target, Lightbulb, TrendingDown, AlertTriangle, Wallet, BellRing, MessageSquare, Wrench, ListChecks } from 'lucide-react'

interface MethodPillarProps {
  number: string
  title: string
  description: string
  icon: React.ReactNode
}

function MethodPillar({ number, title, description, icon }: MethodPillarProps) {
  return (
    <div
      className="relative p-6 transition-colors group"
      style={{
        border: '1px solid rgba(255,255,255,0.10)',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      {/* Top accent bar on hover */}
      <div
        className="absolute top-0 left-0 right-0 h-px transition-all"
        style={{ background: '#f97316', transform: 'scaleX(0)', transformOrigin: 'left' }}
      />
      <div className="flex items-start gap-4 mb-4">
        <span
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          className="text-[#f97316] text-xs font-mono"
        >
          {number}
        </span>
        <div className="text-[#f97316]">{icon}</div>
      </div>
      <h3
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        className="text-white text-base font-semibold mb-2 leading-tight"
      >
        {title}
      </h3>
      <p className="text-white/70 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

interface BenefitRowProps {
  icon: React.ReactNode
  benefit: string
  number?: string
  numberLabel?: string
  how: string
}

function BenefitRow({ icon, benefit, number, numberLabel, how }: BenefitRowProps) {
  return (
    <div
      className="grid grid-cols-12 gap-4 py-5 items-center transition-colors hover:bg-white/[0.02]"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="col-span-12 md:col-span-1 flex justify-start md:justify-center text-[#f97316]">
        {icon}
      </div>
      <div className="col-span-12 md:col-span-4">
        <div className="text-white text-sm font-medium leading-snug">{benefit}</div>
      </div>
      <div className="col-span-12 md:col-span-3">
        {number ? (
          <div className="flex flex-col">
            <span
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
              className="text-[#f97316] text-3xl font-bold leading-none"
            >
              {number}
            </span>
            {numberLabel && (
              <span className="text-white/55 text-[10px] uppercase tracking-wider mt-1">
                {numberLabel}
              </span>
            )}
          </div>
        ) : (
          <span className="text-white/40 text-xs italic">qualitativo</span>
        )}
      </div>
      <div className="col-span-12 md:col-span-4">
        <div className="text-white/65 text-xs leading-relaxed">{how}</div>
      </div>
    </div>
  )
}

export function MethodologySection() {
  const pillars: MethodPillarProps[] = [
    {
      number: '01',
      title: 'Ontologia da Construção',
      description:
        'Todos os módulos compartilham 1 só "modelo mental" da obra. RDO conhece o trecho do planejamento, que conhece o item de orçamento, que conhece o BIM. Sem ETL. Sem sync. Uma só base semântica — igual a Palantir Foundry.',
      icon: <Network size={20} strokeWidth={1.5} />,
    },
    {
      number: '02',
      title: 'Loop de Feedback Rápido',
      description:
        'O que o engenheiro registra à tarde já está no CPI do diretor antes do café da manhã do dia seguinte. Sem reunião de status, sem planilha consolidada de fim de mês.',
      icon: <Zap size={20} strokeWidth={1.5} />,
    },
    {
      number: '03',
      title: 'Last Planner System Nativo',
      description:
        'Lean Construction não é palestra — é o jeito da plataforma planejar. PPC, look-ahead de 6 semanas, Constraint Register e Pareto de causas: tudo embutido no fluxo, não num módulo separado.',
      icon: <Target size={20} strokeWidth={1.5} />,
    },
    {
      number: '04',
      title: 'Decisão Antes de Relatório',
      description:
        'A IA Copilot da plataforma cruza dados entre módulos para gerar a decisão pronta, não o gráfico. "Realocar 2 oficiais da T03 para T07" em vez de "T07 com SPI 0,71".',
      icon: <Lightbulb size={20} strokeWidth={1.5} />,
    },
  ]

  const benefits: BenefitRowProps[] = [
    {
      icon: <TrendingDown size={20} strokeWidth={1.5} />,
      benefit: 'Redução no tempo de orçamentação',
      number: '80%',
      numberLabel: 'menos tempo',
      how: 'Wizard "Criar Orçamento do Zero" + base SINAPI atualizada + reuso de orçamentos anteriores.',
    },
    {
      icon: <AlertTriangle size={20} strokeWidth={1.5} />,
      benefit: 'Mitigação proativa de multas contratuais',
      how: 'Alertas automáticos de prazo no LPS e Torre de Controle, com 2-3 semanas de antecedência.',
    },
    {
      icon: <Wallet size={20} strokeWidth={1.5} />,
      benefit: 'Redução de perdas por erros de faturamento',
      number: '3-5%',
      numberLabel: 'sobre faturamento',
      how: 'Three-Way Match automático em Suprimentos (PO × GRN × NF). Cada divergência vira alerta com R$ de variância.',
    },
    {
      icon: <BellRing size={20} strokeWidth={1.5} />,
      benefit: 'Antecipação de estouros de orçamento',
      number: 'Semanas',
      numberLabel: 'de antecedência',
      how: 'CPI/SPI calculados em tempo real a partir de RDO, Suprimentos e Planejamento na mesma ontologia.',
    },
    {
      icon: <MessageSquare size={20} strokeWidth={1.5} />,
      benefit: 'Comunicação com stakeholders',
      how: 'Relatório 360 e Torre de Controle no celular. Diretor abre, vê, decide. Sem reunião.',
    },
    {
      icon: <Wrench size={20} strokeWidth={1.5} />,
      benefit: 'Redução de erros de execução',
      how: 'RDO digital com fotos georreferenciadas, FVS amarrada ao trecho, BIM 4D sobreposto à execução.',
    },
    {
      icon: <ListChecks size={20} strokeWidth={1.5} />,
      benefit: 'Otimização de planejamento e acompanhamento',
      how: 'LPS / Last Planner nativo, PPC automático, Constraint Register integrado ao cronograma.',
    },
  ]

  return (
    <section
      id="metodologia"
      style={{ background: '#2c2c2c', borderTop: '1px solid rgba(255,255,255,0.10)' }}
      className="py-32"
    >
      <div className="max-w-7xl mx-auto px-6">
        {/* Section divider */}
        <div className="flex items-center gap-3 mb-16">
          <span
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }}
            className="text-white/60 text-xs uppercase font-mono"
          >
            02 / Metodologia
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        {/* Headline */}
        <div className="max-w-3xl mb-6">
          <p
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.08em' }}
            className="text-[#f97316] text-xs uppercase font-semibold mb-4"
          >
            Diferencial único
          </p>
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 'clamp(1.8rem, 4vw, 3rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              color: '#f4f5f7',
            }}
            className="mb-6"
          >
            Todo mundo tem acesso a código.
            <br />
            <span className="text-white/60">Nem todo mundo tem metodologia.</span>
          </h2>
          <p className="text-white/75 text-base leading-relaxed max-w-2xl">
            A Atlântico não é "mais um software de gestão". É uma{' '}
            <strong className="text-white">metodologia operacional</strong> com 4 conceitos
            centrais que tornam a plataforma diferente de tudo que existe no mercado brasileiro.
          </p>
        </div>

        {/* 4 Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-24">
          {pillars.map((p) => (
            <MethodPillar key={p.number} {...p} />
          ))}
        </div>

        {/* ── Eficiência: tabela com números em destaque ──────────────────── */}
        <div className="flex items-center gap-3 mb-10">
          <span
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }}
            className="text-white/60 text-xs uppercase font-mono"
          >
            O que o cliente ganha em eficiência
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <h3
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 'clamp(1.4rem, 2.5vw, 2rem)',
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            color: '#f4f5f7',
          }}
          className="mb-3"
        >
          Resultados mensuráveis em obras reais.
        </h3>
        <p className="text-white/65 text-sm mb-10 max-w-2xl">
          Cada benefício abaixo vem de loop fechado entre módulos da plataforma. Não é
          marketing — é o que acontece quando todos os dados conversam na mesma ontologia.
        </p>

        {/* Table header */}
        <div
          className="grid grid-cols-12 gap-4 py-3 mb-2 hidden md:grid"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}
        >
          <div className="col-span-1" />
          <div className="col-span-4">
            <span className="text-white/45 text-[10px] uppercase tracking-widest font-mono">
              Benefício
            </span>
          </div>
          <div className="col-span-3">
            <span className="text-white/45 text-[10px] uppercase tracking-widest font-mono">
              Número
            </span>
          </div>
          <div className="col-span-4">
            <span className="text-white/45 text-[10px] uppercase tracking-widest font-mono">
              Como acontece
            </span>
          </div>
        </div>

        {/* Benefit rows */}
        <div>
          {benefits.map((b) => (
            <BenefitRow key={b.benefit} {...b} />
          ))}
        </div>

        {/* Bottom proof callout */}
        <div
          className="mt-16 p-6 max-w-3xl mx-auto text-center"
          style={{
            border: '1px solid rgba(249,115,22,0.25)',
            borderLeft: '3px solid #f97316',
            background: 'rgba(249,115,22,0.03)',
          }}
        >
          <p className="text-white/90 text-sm leading-relaxed">
            <strong className="text-[#f97316]">Vale o investimento?</strong> Se a plataforma evitar
            apenas <strong className="text-white">1% do desperdício</strong> em uma obra de{' '}
            <strong className="text-white">R$ 20 milhões</strong>, ela gera{' '}
            <strong className="text-[#f97316]">R$ 200.000 de economia</strong> — retorno várias
            vezes superior ao custo anual da plataforma.
            <br />
            <span className="text-white/65 text-xs italic mt-2 block">
              E nós provamos essa economia com relatório PDF assinado em 90 dias. Se não bater, devolvemos.
            </span>
          </p>
        </div>
      </div>
    </section>
  )
}
