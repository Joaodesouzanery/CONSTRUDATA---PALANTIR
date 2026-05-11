import { type FormEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeDollarSign,
  BrainCircuit,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileText,
  Layers3,
  LineChart,
  LockKeyhole,
  Map,
  PackageCheck,
  ShieldCheck,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import { BrandLockup } from '@/components/shared/BrandLogo'

const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'
const LOGIN_URL = '/app/minha-rotina'

type ModuleCategory = 'gestao' | 'planejamento' | 'campo' | 'projetos' | 'suprimentos'

interface ModuleItem {
  id: string
  category: ModuleCategory
  icon: LucideIcon
  title: string
  tagline: string
  copy: string
  screenshot?: string
  features: string[]
  connects: string[]
}

const categories: Array<{ id: ModuleCategory; label: string }> = [
  { id: 'gestao', label: 'Gestão' },
  { id: 'planejamento', label: 'Planejamento' },
  { id: 'campo', label: 'Campo' },
  { id: 'projetos', label: 'Projetos' },
  { id: 'suprimentos', label: 'Suprimentos' },
]

const modules: ModuleItem[] = [
  {
    id: 'gestao-360',
    category: 'gestao',
    icon: Layers3,
    title: 'Gestão 360',
    tagline: 'CPI, SPI, curva S e decisões executivas.',
    copy: 'Visão financeira e operacional da obra com alertas, tendência, avanço físico-financeiro e drill-down por projeto.',
    screenshot: '/screenshots/gestao360.png',
    features: ['Curva S integrada', 'Indicadores executivos', 'Alertas por exceção'],
    connects: ['RDO', 'Planejamento', 'Medição', 'EVM'],
  },
  {
    id: 'torre',
    category: 'gestao',
    icon: LineChart,
    title: 'Torre de Controle',
    tagline: 'War room digital para diretoria e operação.',
    copy: 'Mapa, status, riscos e indicadores em uma visão de comando para enxergar onde a obra precisa de decisão.',
    screenshot: '/screenshots/torre-controle-mapa.png',
    features: ['Mapa de obras', 'Matriz de risco', 'Acompanhamento por exceção'],
    connects: ['Gestão 360', 'Qualidade', 'Suprimentos', 'LPS'],
  },
  {
    id: 'medicao',
    category: 'gestao',
    icon: ClipboardCheck,
    title: 'Medição',
    tagline: 'Memória, boletim, descontos, NFs e conferência.',
    copy: 'RDOs, planilhas e fontes financeiras viram rascunhos rastreáveis para empreiteiros e fornecedores.',
    screenshot: '/screenshots/relatorio-360.png',
    features: ['Memória de medição', 'Conferência automática', 'Aprovação humana'],
    connects: ['RDO', 'Suprimentos', 'Qualidade', 'Planejamento'],
  },
  {
    id: 'planejamento',
    category: 'planejamento',
    icon: CalendarClock,
    title: 'Planejamento',
    tagline: 'Baseline, cronograma, avanço real e tendência.',
    copy: 'Planejamento mestre e operacional conectados ao que acontece no campo, sem alterar a baseline sem decisão humana.',
    screenshot: '/screenshots/agenda-gantt.png',
    features: ['WBS e marcos', 'Gantt operacional', 'Atualização por avanço aprovado'],
    connects: ['RDO', 'Medição', 'LPS', 'EVM'],
  },
  {
    id: 'lps',
    category: 'planejamento',
    icon: BrainCircuit,
    title: 'LPS / Lean',
    tagline: 'Look-ahead, restrições, plano semanal e PPC.',
    copy: 'Last Planner System conectado a materiais, máquinas, pessoas, qualidade e avanço físico da obra.',
    screenshot: '/screenshots/lps-lookahead.png',
    features: ['Look-ahead 6 semanas', 'Registro de restrições', 'PPC e causas de não cumprimento'],
    connects: ['Planejamento', 'Suprimentos', 'Mão de Obra', 'Qualidade'],
  },
  {
    id: 'rdo',
    category: 'campo',
    icon: FileText,
    title: 'RDO',
    tagline: 'Campo estruturado com origem, evidência e assinatura.',
    copy: 'O Relatório Diário de Obras registra serviços, local, equipe, material, máquina, foto e ocorrências em uma base que alimenta os demais módulos.',
    screenshot: '/screenshots/rdo-dashboard.png',
    features: ['Serviços executados', 'Fotos e evidências', 'Dados para medição'],
    connects: ['Medição', 'Qualidade', 'Planejamento', 'Torre'],
  },
  {
    id: 'qualidade',
    category: 'campo',
    icon: ShieldCheck,
    title: 'Qualidade',
    tagline: 'FVS, não conformidades e bloqueios de fechamento.',
    copy: 'Qualidade deixa de ser checklist isolado e passa a controlar evidências, pendências e liberações antes da medição.',
    features: ['FVS digital', 'Tratamento de NC', 'Bloqueio por pendência'],
    connects: ['RDO', 'Medição', 'LPS', 'Torre'],
  },
  {
    id: 'mao-de-obra',
    category: 'campo',
    icon: Users,
    title: 'Mão de Obra',
    tagline: 'Cadastro, alocação, produtividade e certificações.',
    copy: 'Equipes e funções conectadas à frente de serviço, ao RDO, à produtividade e ao custo operacional.',
    features: ['Alocação diária', 'Certificações', 'Produtividade por equipe'],
    connects: ['RDO', 'LPS', 'EVM', 'Planejamento'],
  },
  {
    id: 'equipamentos',
    category: 'campo',
    icon: Wrench,
    title: 'Equipamentos',
    tagline: 'Disponibilidade, manutenção e custo por frente.',
    copy: 'Máquinas e equipamentos passam a fazer parte da chave operacional da obra, com uso diário e custo rastreável.',
    features: ['Controle de uso', 'Manutenção', 'Custo operacional'],
    connects: ['RDO', 'LPS', 'Suprimentos', 'EVM'],
  },
  {
    id: 'bim',
    category: 'projetos',
    icon: Building2,
    title: 'BIM 3D/4D/5D',
    tagline: 'Modelo, cronograma e custo como base visual.',
    copy: 'BIM conecta projeto, tempo, custo e execução para transformar visualização em decisão operacional.',
    screenshot: '/screenshots/bim-5d.png',
    features: ['Visualização 3D', 'Simulação 4D', 'Análise 5D'],
    connects: ['Planejamento', 'Quantitativos', 'EVM', 'Torre'],
  },
  {
    id: 'mapa',
    category: 'projetos',
    icon: Map,
    title: 'Mapa Interativo',
    tagline: 'Rua, trecho, rede, núcleo e status em um mapa.',
    copy: 'A frente física da obra ganha referência espacial para conectar local, execução, medição e planejamento.',
    features: ['Redes e trechos', 'Status por local', 'Base para medição'],
    connects: ['RDO', 'Medição', 'Planejamento', 'Torre'],
  },
  {
    id: 'quantitativos',
    category: 'projetos',
    icon: BadgeDollarSign,
    title: 'Quantitativos',
    tagline: 'Orçamento com bases, composições e rastreabilidade.',
    copy: 'Itens de orçamento e serviços viram referência comum para custo, medição, planejamento e avanço físico-financeiro.',
    screenshot: '/screenshots/quantitativos.png',
    features: ['SINAPI e SEINFRA', 'BDI e composições', 'Exportação estruturada'],
    connects: ['Medição', 'EVM', 'Planejamento', 'BIM'],
  },
  {
    id: 'suprimentos',
    category: 'suprimentos',
    icon: PackageCheck,
    title: 'Suprimentos',
    tagline: 'Pedido, recebimento, NF e fornecedor no mesmo fluxo.',
    copy: 'Suprimentos conversa com planejamento, medição e LPS para antecipar falta de material e conciliar compras com execução.',
    features: ['Three-Way Match', 'Recebimento e NF', 'Scorecard de fornecedor'],
    connects: ['Medição', 'LPS', 'Planejamento', 'EVM'],
  },
]

const impactRows = [
  {
    code: '0.1',
    title: 'Ganhe uma vantagem desleal',
    metric: 'Redução de 3-5% no custo total sobre o faturamento.',
    how: 'Otimização de suprimentos e eliminação de perdas por erros de faturamento via Three-Way Match.',
  },
  {
    code: '0.2',
    title: 'Entregue com velocidade',
    metric: 'Controle total da obra em dias, não meses.',
    how: 'Integração instantânea de cronogramas, planejamento, financeiro e execução de campo na mesma ontologia.',
  },
  {
    code: '0.3',
    title: 'Economize tempo',
    metric: 'Redução de 80% no tempo de orçamentação.',
    how: 'Automação de processos de alocação e ciclos de relatórios em tempo real, com RDO digital.',
  },
  {
    code: '0.4',
    title: 'Fortaleça sua cadeia',
    metric: 'Queda de 40% nos riscos de falta de material.',
    how: 'Alertas preditivos e monitoramento proativo de interrupções na cadeia de suprimentos.',
  },
  {
    code: '0.5',
    title: 'Controle físico-financeiro',
    metric: 'Decisões financeiras por setor, núcleo e frente.',
    how: 'Integração dos módulos e decisões da obra para controle financeiro total de cada setor e núcleo.',
  },
]

const screenshots = [
  { file: '/screenshots/gestao360.png', module: 'Gestão 360', label: 'Dashboard de projetos e mapa' },
  { file: '/screenshots/relatorio-360.png', module: 'Relatório 360', label: 'Relatório diário de obra' },
  { file: '/screenshots/torre-controle-mapa.png', module: 'Torre de Controle', label: 'Mapa de obras e KPIs' },
  { file: '/screenshots/lps-lookahead.png', module: 'LPS / Lean', label: 'Look-ahead 6 semanas' },
  { file: '/screenshots/bim-5d.png', module: 'BIM 5D', label: 'Modelo, tempo e custo' },
  { file: '/screenshots/quantitativos.png', module: 'Quantitativos', label: 'Composição SINAPI' },
  { file: '/screenshots/rdo-dashboard.png', module: 'RDO', label: 'Campo conectado ao planejamento' },
  { file: '/screenshots/agenda-gantt.png', module: 'Agenda', label: 'Gantt de recursos' },
]

const logos = [
  { src: '/logos/social-proof/engelfer-horizontal.png', alt: 'Engelfer Engenharia' },
  { src: '/logos/social-proof/cslnr.jpg', alt: 'Consórcio Se Liga na Rede' },
  { src: '/logos/social-proof/vr.jfif', alt: 'Vila Rica Engenharia' },
  { src: '/logos/social-proof/engelfer-selo.png', alt: 'Engelfer Engenharia' },
]

const testimonials = [
  {
    name: 'Felipe Nery',
    role: 'Engenheiro',
    company: 'Engelfer',
    quote: 'A proposta do ConstruData é transformar o dado de campo em decisão operacional, sem depender de consolidação manual.',
  },
  {
    name: 'Fabrizzio de Paoli',
    role: 'Consórcio Se Liga Na Rede',
    company: 'CSLNR',
    quote: 'Quando RDO, planejamento e medição conversam, a gestão deixa de discutir planilha e passa a discutir decisão.',
  },
  {
    name: 'Matheus Marques',
    role: 'Vila Rica Engenharia',
    company: 'Vila Rica',
    quote: 'O ganho está em rastrear origem, pendência e responsabilidade antes que o problema chegue ao fechamento.',
  },
]

const flow = [
  'O RDO registra serviço, local, equipe, material, máquina, foto e assinatura.',
  'Qualidade libera, bloqueia ou exige evidência antes do fechamento.',
  'Suprimentos confirma material, recebimento, nota fiscal e fornecedor.',
  'Medição gera rascunho com memória, descontos, retenções e pendências.',
  'Planejamento, LPS e Torre de Controle recebem avanço, risco e tendência.',
]

const faqs = [
  {
    q: 'O ConstruData substitui minhas planilhas no primeiro dia?',
    a: 'Não precisa. A plataforma importa bases existentes, preserva origem e transforma planilhas em dados rastreáveis para medição, planejamento e controle.',
  },
  {
    q: 'O RDO fecha automaticamente a medição?',
    a: 'Ele gera fonte e rascunho quando há vínculo suficiente. Fechamento e aprovação continuam exigindo revisão humana.',
  },
  {
    q: 'Funciona para saneamento e infraestrutura?',
    a: 'Sim. A estrutura foi pensada para contrato, núcleo, rua/local, serviço, período, equipes, materiais e evidências.',
  },
  {
    q: 'A plataforma conversa com SINAPI, SEINFRA, BIM e cronogramas?',
    a: 'Sim. A proposta é conectar bases técnicas, orçamento, modelo, planejamento e execução em uma camada operacional única.',
  },
]

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="mb-8 flex items-center gap-3">
      <span className="font-mono text-[11px] font-bold uppercase text-[#f97316]">{children}</span>
      <div className="h-px flex-1 bg-[#525252]" />
    </div>
  )
}

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="mb-10 grid gap-5 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14">
      <div>
        <p className="mb-3 font-mono text-[11px] font-bold uppercase text-white/45">{eyebrow}</p>
        <h2 className="font-['Space_Grotesk'] text-3xl font-bold leading-tight text-white sm:text-4xl">{title}</h2>
      </div>
      <p className="max-w-3xl text-sm leading-7 text-white/72 sm:text-base">{copy}</p>
    </div>
  )
}

function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[#2c2c2c]" />
      <div className="construction-grid absolute inset-0 opacity-55" />
      <div className="absolute inset-y-0 right-0 w-full bg-[radial-gradient(circle_at_76%_30%,rgba(249,115,22,0.24),transparent_30%),radial-gradient(circle_at_24%_72%,rgba(255,255,255,0.07),transparent_28%)]" />
      <svg className="absolute right-0 top-20 h-[620px] w-[720px] text-[#f97316]/28" viewBox="0 0 720 620" fill="none">
        <path className="draw-line" d="M70 480H580M150 480V180L430 70V480M150 250H430M150 330H430M270 130V480M515 480V250H620V480M515 250L565 170L620 250" stroke="currentColor" strokeWidth="2" />
        <path className="draw-line delay-1" d="M70 520H650M88 520C128 492 174 492 214 520C254 548 300 548 340 520C380 492 426 492 466 520C506 548 552 548 592 520" stroke="white" strokeOpacity="0.18" strokeWidth="2" />
        <circle className="pulse-node" cx="150" cy="250" r="6" fill="currentColor" />
        <circle className="pulse-node delay-1" cx="430" cy="330" r="6" fill="currentColor" />
        <circle className="pulse-node delay-2" cx="565" cy="170" r="6" fill="currentColor" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-r from-[#2c2c2c] via-[#2c2c2c]/93 to-[#2c2c2c]/52" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#252525]/80 via-transparent to-[#2c2c2c]" />
    </div>
  )
}

function HeroMockup() {
  return (
    <div className="border border-[#525252] bg-[#333333]/92 p-4 shadow-2xl shadow-black/30">
      <div className="mb-4 flex items-center justify-between border-b border-[#525252] pb-3">
        <span className="font-mono text-[11px] font-bold uppercase text-white/60">Ontologia operacional</span>
        <span className="flex items-center gap-2 font-mono text-[11px] text-[#f97316]">
          <span className="h-2 w-2 animate-pulse bg-[#f97316]" />
          ao vivo
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <img src="/screenshots/gestao360.png" alt="Dashboard Gestão 360" className="h-44 w-full border border-[#525252] object-cover object-top sm:h-56" />
        <div className="grid gap-3">
          {[
            ['RDO finalizado', 'gera fonte para medição'],
            ['Suprimentos', 'confirma recebimento e NF'],
            ['Planejamento', 'recebe avanço aprovado'],
            ['LPS / Lean', 'recalcula restrições e PPC'],
          ].map(([title, copy]) => (
            <div key={title} className="border border-[#525252] bg-[#2c2c2c] p-3">
              <div className="font-['Space_Grotesk'] text-sm font-bold text-white">{title}</div>
              <div className="mt-1 text-xs text-white/58">{copy}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          ['16+', 'módulos'],
          ['D+0', 'campo'],
          ['100%', 'origem'],
        ].map(([value, label]) => (
          <div key={label} className="border border-[#525252] bg-[#3d3d3d] p-4">
            <div className="font-['Space_Grotesk'] text-xl font-bold text-white">{value}</div>
            <div className="mt-1 text-[10px] font-bold uppercase text-white/45">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScreenshotShowcase() {
  const [active, setActive] = useState<(typeof screenshots)[number] | null>(null)

  return (
    <>
      <section id="plataforma" className="border-t border-[#525252] bg-[#111111] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionLabel>03 / Plataforma em ação</SectionLabel>
          <SectionTitle
            eyebrow="Screenshots reais"
            title="A inteligência operacional aparece em telas de obra, não em promessa abstrata."
            copy="Os principais módulos usam a mesma linguagem visual da plataforma: dados densos, leitura rápida e origem rastreável para cada decisão."
          />
          <div className="grid auto-rows-[150px] grid-cols-2 gap-2 sm:auto-rows-[190px] lg:grid-cols-6">
            {screenshots.map((shot, index) => (
              <button
                key={shot.file}
                type="button"
                onClick={() => setActive(shot)}
                className={`group relative overflow-hidden border border-[#333333] bg-[#1a1a1a] text-left ${index < 2 ? 'lg:col-span-2 lg:row-span-2' : 'lg:col-span-2'}`}
              >
                <img src={shot.file} alt={shot.label} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-black/10" />
                <div className="absolute inset-0 border border-transparent transition group-hover:border-[#f97316]/70" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <span className="font-mono text-[10px] font-bold uppercase text-[#f97316]">{shot.module}</span>
                  <p className="mt-1 text-xs font-semibold text-white/84">{shot.label}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {active && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setActive(null)}>
          <div className="relative w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setActive(null)} className="absolute -top-12 right-0 text-white/70 transition hover:text-white" aria-label="Fechar imagem">
              <X size={26} />
            </button>
            <img src={active.file} alt={active.label} className="max-h-[82vh] w-full border border-[#525252] object-contain" />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs font-bold uppercase text-[#f97316]">{active.module}</span>
              <span className="text-sm text-white/68">{active.label}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ModulesExplorer() {
  const [activeCategory, setActiveCategory] = useState<ModuleCategory>('gestao')
  const filtered = useMemo(() => modules.filter((module) => module.category === activeCategory), [activeCategory])
  const [activeModuleId, setActiveModuleId] = useState(filtered[0]?.id ?? modules[0].id)
  const activeModule = modules.find((module) => module.id === activeModuleId) ?? filtered[0] ?? modules[0]

  function selectCategory(category: ModuleCategory) {
    setActiveCategory(category)
    const first = modules.find((module) => module.category === category)
    if (first) setActiveModuleId(first.id)
  }

  return (
    <section id="modulos" className="border-t border-[#525252] bg-[#333333] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionLabel>04 / Módulos clicáveis</SectionLabel>
        <SectionTitle
          eyebrow="Uma plataforma, muitos fluxos"
          title="Clique em um módulo e veja funcionalidades, integrações e telas relacionadas."
          copy="Os módulos não são ilhas. Cada um lê e escreve na mesma base operacional para conectar campo, suprimentos, planejamento, medição e diretoria."
        />

        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => selectCategory(category.id)}
              className={`border px-4 py-2 text-sm font-semibold transition ${activeCategory === category.id ? 'border-[#f97316] bg-[#f97316] text-white' : 'border-[#525252] bg-[#2c2c2c] text-white/70 hover:border-[#f97316] hover:text-white'}`}
            >
              {category.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="grid gap-2">
            {filtered.map((module) => {
              const Icon = module.icon
              const selected = activeModule.id === module.id
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setActiveModuleId(module.id)}
                  className={`group grid grid-cols-[44px_1fr] gap-4 border p-4 text-left transition ${selected ? 'border-[#f97316] bg-[#2c2c2c]' : 'border-[#525252] bg-[#333333] hover:border-[#f97316]/70'}`}
                >
                  <span className={`flex h-11 w-11 items-center justify-center ${selected ? 'bg-[#f97316] text-white' : 'bg-[#2c2c2c] text-[#f97316]'}`}>
                    <Icon size={20} />
                  </span>
                  <span>
                    <span className="block font-['Space_Grotesk'] text-base font-bold text-white">{module.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-white/58">{module.tagline}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <article className="border border-[#525252] bg-[#2c2c2c]">
            {activeModule.screenshot ? (
              <img src={activeModule.screenshot} alt={`Tela do módulo ${activeModule.title}`} className="h-72 w-full border-b border-[#525252] object-cover object-top" />
            ) : (
              <div className="flex h-72 items-center justify-center border-b border-[#525252] bg-[#252525]">
                <div className="max-w-sm text-center">
                  <DatabaseZap className="mx-auto mb-4 text-[#f97316]" size={36} />
                  <p className="text-sm leading-6 text-white/65">Este módulo usa dados da mesma ontologia e alimenta os demais fluxos em tempo real.</p>
                </div>
              </div>
            )}
            <div className="p-5 sm:p-7">
              <p className="mb-2 font-mono text-[11px] font-bold uppercase text-[#f97316]">{activeModule.tagline}</p>
              <h3 className="font-['Space_Grotesk'] text-3xl font-bold text-white">{activeModule.title}</h3>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72">{activeModule.copy}</p>
              <div className="mt-7 grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-3 font-mono text-[11px] font-bold uppercase text-white/45">Funcionalidades</h4>
                  <div className="grid gap-2">
                    {activeModule.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-3 border border-[#525252] bg-[#333333] p-3 text-sm text-white/76">
                        <CheckCircle2 size={16} className="text-[#f97316]" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 font-mono text-[11px] font-bold uppercase text-white/45">Conecta com</h4>
                  <div className="flex flex-wrap gap-2">
                    {activeModule.connects.map((item) => (
                      <span key={item} className="border border-[#525252] bg-[#333333] px-3 py-2 text-xs font-semibold text-white/75">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

function SocialProof() {
  return (
    <section id="casos" className="border-t border-[#525252] bg-[#333333] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionLabel>06 / Empresas e líderes</SectionLabel>
        <SectionTitle
          eyebrow="Prova social"
          title="Logotipos e depoimentos preparados para validação comercial."
          copy="A seção usa nomes e empresas indicados no material da landing e evita métricas não confirmadas. O foco é transformação operacional, rastreabilidade e maturidade de dados."
        />
        <div className="relative mb-10 overflow-hidden border-y border-[#525252] py-6">
          <div className="logos-track flex w-max items-center gap-14 pr-14">
            {[...logos, ...logos].map((logo, index) => (
              <div key={`${logo.alt}-${index}`} className="flex h-24 w-56 shrink-0 items-center justify-center border border-[#525252] bg-[#2c2c2c] p-5">
                <img src={logo.src} alt={logo.alt} loading="lazy" className="max-h-full max-w-full object-contain brightness-110" />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {testimonials.map((item) => (
            <figure key={item.name} className="border border-[#525252] bg-[#2c2c2c] p-6">
              <blockquote className="text-sm leading-7 text-white/72">“{item.quote}”</blockquote>
              <figcaption className="mt-6 border-t border-[#525252] pt-4">
                <div className="font-['Space_Grotesk'] text-base font-bold text-white">{item.name}</div>
                <div className="mt-1 text-xs font-semibold uppercase text-[#f97316]">{item.role} - {item.company}</div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const html = document.documentElement
    const prev = html.getAttribute('data-theme')
    html.setAttribute('data-theme', 'dark')
    return () => {
      if (prev) html.setAttribute('data-theme', prev)
      else html.removeAttribute('data-theme')
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSending(true)
    const data = new FormData(event.currentTarget)
    try {
      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: import.meta.env.VITE_WEB3FORMS_KEY ?? 'YOUR_WEB3FORMS_KEY',
          subject: 'Nova solicitação de demonstração - ConstruData',
          from_name: `${data.get('nome')} ${data.get('sobrenome')}`,
          email: data.get('email'),
          empresa: data.get('empresa'),
          cargo: data.get('cargo'),
          message: `Nome: ${data.get('nome')} ${data.get('sobrenome')}\nE-mail: ${data.get('email')}\nEmpresa: ${data.get('empresa')}\nCargo: ${data.get('cargo')}\nPrincipal dor: ${data.get('dor')}`,
        }),
      })
      if (!response.ok) throw new Error('Não foi possível enviar o formulário agora.')
      setSent(true)
      event.currentTarget.reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao enviar o formulário.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#2c2c2c] text-[#f5f5f5] antialiased">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#525252] bg-[#2c2c2c]/94 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <BrandLockup />
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            {[
              ['Ontologia', '#ontologia'],
              ['Plataforma', '#plataforma'],
              ['Módulos', '#modulos'],
              ['Dados', '#fluxo'],
              ['Contato', '#contato'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-xs font-semibold uppercase text-white/62 transition hover:text-white">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href={LOGIN_URL} className="hidden border border-[#525252] px-4 py-2 text-xs font-bold uppercase text-white/78 transition hover:border-[#f97316] hover:text-white sm:inline-flex">
              Acessar
            </a>
            <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#f97316] px-4 py-2 text-xs font-black uppercase text-white transition hover:bg-[#ea580c]">
              Demo <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-screen overflow-hidden pt-28">
          <HeroBackground />
          <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-4 pb-20 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:pb-28 lg:pt-14">
            <div className="flex flex-col justify-center">
              <div className="mb-8 inline-flex w-fit items-center gap-3 border border-[#525252] bg-[#333333]/85 px-4 py-2">
                <span className="h-2 w-2 bg-[#f97316]" />
                <span className="font-mono text-[11px] font-bold uppercase text-white/70">Construção, saneamento e infraestrutura</span>
              </div>
              <h1 className="font-['Space_Grotesk'] text-5xl font-bold leading-[0.98] text-white sm:text-6xl lg:text-7xl">
                ConstruData
                <span className="mt-4 block text-3xl leading-tight text-[#f97316] sm:text-4xl lg:text-5xl">
                  planejamento e gestão da execução da obra.
                </span>
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-8 text-white/78 sm:text-lg">
                Automação alimentada por IA para cada decisão na construção. Traga a inteligência operacional para o mundo real e conecte campo, qualidade, medição, planejamento, suprimentos e gestão em uma única base.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-3 bg-[#f97316] px-7 py-4 text-sm font-black uppercase text-white transition hover:bg-[#ea580c]">
                  Agendar demonstração <ArrowRight size={17} />
                </a>
                <a href={LOGIN_URL} className="inline-flex items-center justify-center border border-[#525252] bg-[#333333]/70 px-7 py-4 text-sm font-black uppercase text-white transition hover:border-[#f97316]">
                  Acessar plataforma
                </a>
              </div>
            </div>
            <div className="self-center">
              <HeroMockup />
            </div>
          </div>
        </section>

        <section id="ontologia" className="border-t border-[#525252] bg-[#333333] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionLabel>01 / Ontologia da Construção</SectionLabel>
            <SectionTitle
              eyebrow="O diferencial técnico"
              title="Todas as funções centrais conectadas por uma camada semântica unificada."
              copy="A Ontologia da Construção padroniza como departamentos interagem com projetos, atividades, equipamentos, materiais, fornecedores e subempreiteiros. O que acontece no canteiro alimenta cronograma, EVM, suprimentos, qualidade e medição sem retrabalho."
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                ['Campo-primeiro', 'O dado nasce no RDO, na FVS, no recebimento ou na medição com origem, evidência e responsável.'],
                ['Low-code operacional', 'Usuários de obra operam fluxos críticos sem depender de times técnicos para cada ajuste.'],
                ['IA com contexto', 'A inteligência artificial atua sobre objetos reais da obra, não sobre planilhas soltas.'],
              ].map(([title, copy]) => (
                <article key={title} className="border border-[#525252] bg-[#2c2c2c] p-6">
                  <DatabaseZap className="mb-5 text-[#f97316]" size={24} />
                  <h3 className="font-['Space_Grotesk'] text-lg font-bold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/68">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="impacto" className="border-t border-[#525252] bg-[#2c2c2c] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionLabel>02 / Impacto real em escala</SectionLabel>
            <SectionTitle
              eyebrow="Execução e resultado"
              title="A plataforma transforma dados operacionais em decisão mensurável."
              copy="Integre campo, qualidade, medição, planejamento, suprimentos e gestão em uma única base operacional. Do RDO com foto e assinatura aos indicadores executivos, cada dado nasce com origem e rastreabilidade."
            />
            <div className="overflow-hidden border border-[#525252]">
              {impactRows.map((row) => (
                <div key={row.code} className="grid gap-4 border-b border-[#525252] bg-[#333333] p-5 last:border-b-0 lg:grid-cols-[90px_0.8fr_0.9fr_1.2fr] lg:items-center">
                  <span className="font-mono text-sm font-black text-[#f97316]">({row.code})</span>
                  <h3 className="font-['Space_Grotesk'] text-lg font-bold text-white">{row.title}</h3>
                  <p className="text-sm font-semibold text-white/82">{row.metric}</p>
                  <p className="text-sm leading-6 text-white/64">{row.how}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ScreenshotShowcase />
        <ModulesExplorer />

        <section id="fluxo" className="border-t border-[#525252] bg-[#2c2c2c] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionLabel>05 / Dados conversando entre si</SectionLabel>
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr]">
              <div>
                <p className="mb-3 font-mono text-[11px] font-bold uppercase text-white/45">Da obra para a decisão</p>
                <h2 className="font-['Space_Grotesk'] text-3xl font-bold leading-tight text-white sm:text-4xl">
                  RDO, qualidade, suprimentos, medição, planejamento e LPS deixam de ser ilhas.
                </h2>
                <p className="mt-5 text-sm leading-7 text-white/70">
                  A chave operacional une contrato, projeto, núcleo, rua/local, serviço e período. Com isso, uma alteração relevante atualiza o que precisa ser visto pelos demais módulos.
                </p>
              </div>
              <div className="grid gap-3">
                {flow.map((item, index) => (
                  <div key={item} className="grid grid-cols-[44px_1fr] gap-4 border border-[#525252] bg-[#333333] p-4">
                    <span className="flex h-11 w-11 items-center justify-center bg-[#f97316] font-mono text-sm font-black text-white">{index + 1}</span>
                    <p className="self-center text-sm leading-6 text-white/76">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <SocialProof />

        <section id="faq" className="border-t border-[#525252] bg-[#2c2c2c] py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <SectionLabel>07 / SAQ</SectionLabel>
            <h2 className="mb-8 font-['Space_Grotesk'] text-3xl font-bold text-white sm:text-4xl">Perguntas antes da demonstração.</h2>
            <div className="grid gap-3">
              {faqs.map((item) => (
                <details key={item.q} className="group border border-[#525252] bg-[#333333] p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                    <span className="font-['Space_Grotesk'] text-base font-bold text-white">{item.q}</span>
                    <span className="text-[#f97316] transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 text-sm leading-7 text-white/68">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="contato" className="border-t border-[#525252] bg-[#333333] py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
            <div>
              <SectionLabel>08 / Demonstração</SectionLabel>
              <h2 className="font-['Space_Grotesk'] text-4xl font-bold leading-tight text-white sm:text-5xl">
                Ganhe uma vantagem competitiva com ConstruData.
              </h2>
              <p className="mt-6 text-sm leading-7 text-white/72">
                Preencha o formulário de qualificação ou agende uma conversa. A demonstração mostra como a obra sai do dado fragmentado para uma operação conectada.
              </p>
              <div className="mt-8 flex items-center gap-3 border border-[#525252] bg-[#2c2c2c] p-4">
                <LockKeyhole className="text-[#f97316]" size={19} />
                <p className="text-xs leading-5 text-white/62">Acesso à plataforma permanece privado por empresa e perfil de usuário.</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="border border-[#525252] bg-[#2c2c2c] p-5 sm:p-7">
              {sent ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <CheckCircle2 className="mb-5 text-[#f97316]" size={42} />
                  <h3 className="font-['Space_Grotesk'] text-2xl font-bold text-white">Solicitação enviada.</h3>
                  <p className="mt-3 max-w-md text-sm leading-7 text-white/68">Nossa equipe entrará em contato para entender o cenário da sua obra e preparar a demonstração.</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input name="nome" label="Nome" required />
                    <Input name="sobrenome" label="Sobrenome" required />
                    <Input name="email" label="E-mail corporativo" type="email" required />
                    <Input name="empresa" label="Empresa" required />
                    <Input name="cargo" label="Cargo" required />
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block font-mono text-[10px] font-bold uppercase text-white/45">Principal dor</span>
                      <textarea name="dor" rows={4} className="w-full border border-[#525252] bg-[#333333] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#f97316]" placeholder="Ex.: RDO incompleto, medição manual, orçamento demorado, falta de integração com planejamento..." />
                    </label>
                  </div>
                  {error && <p className="mt-4 border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
                  <button type="submit" disabled={sending} className="mt-6 flex w-full items-center justify-center gap-3 bg-[#f97316] px-6 py-4 text-sm font-black uppercase text-white transition hover:bg-[#ea580c] disabled:opacity-60">
                    {sending ? 'Enviando...' : 'Solicitar demonstração'} <ArrowRight size={16} />
                  </button>
                </>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#525252] bg-[#2c2c2c] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:px-6 lg:px-8">
          <span className="text-xs text-white/65">© 2026 ConstruData</span>
          <span className="text-xs text-white/50">CONSTRUÇÃO · SANEAMENTO · INFRAESTRUTURA</span>
        </div>
      </footer>

      <style>{`
        .construction-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px);
          background-size: 78px 78px;
          animation: grid-pan 18s linear infinite;
        }
        .draw-line {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: draw 6s ease-in-out infinite alternate;
        }
        .delay-1 { animation-delay: 1.2s; }
        .delay-2 { animation-delay: 2.2s; }
        .pulse-node {
          animation: pulse-node 2.7s ease-in-out infinite;
          transform-origin: center;
        }
        .logos-track {
          animation: logos-scroll 28s linear infinite;
        }
        @keyframes grid-pan {
          from { transform: translate3d(0,0,0); }
          to { transform: translate3d(78px,78px,0); }
        }
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulse-node {
          0%, 100% { opacity: 0.35; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.25); }
        }
        @keyframes logos-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .construction-grid, .draw-line, .pulse-node, .logos-track { animation: none; }
        }
      `}</style>
    </div>
  )
}

function Input({ label, name, type = 'text', required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] font-bold uppercase text-white/45">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="h-12 w-full border border-[#525252] bg-[#333333] px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#f97316]"
      />
    </label>
  )
}
