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
  type LucideIcon,
} from 'lucide-react'
import { BrandLockup } from '@/components/shared/BrandLogo'

const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'
const LOGIN_URL = '/app/minha-rotina'
const LINKEDIN_ARTICLE_URL =
  'https://www.linkedin.com/posts/construdatasoftware_activity-7454469394803531776-O9rE?utm_source=share&utm_medium=member_desktop&rcm=ACoAAErBDOwBwdLxQtMem1Gp0OBHExuydnHDjKg'

type ModuleCategory = 'gestao' | 'planejamento' | 'campo' | 'projetos' | 'suprimentos'

interface ModuleItem {
  id: string
  category: ModuleCategory
  icon: LucideIcon
  title: string
  kicker: string
  copy: string
  screenshot?: string
  features: string[]
  connected: string[]
}

const categories: Array<{ id: ModuleCategory; label: string; description: string }> = [
  { id: 'gestao', label: 'Gestão e decisão', description: 'Diretoria, controle, medição e financeiro.' },
  { id: 'planejamento', label: 'Planejamento', description: 'Cronograma, LPS, EVM, agenda e restrições.' },
  { id: 'campo', label: 'Campo e execução', description: 'RDO, qualidade, mão de obra e equipamentos.' },
  { id: 'projetos', label: 'Projetos e BIM', description: 'BIM, mapa, quantitativos e frente física.' },
  { id: 'suprimentos', label: 'Suprimentos', description: 'Fornecedores, compras, recebimento e NF.' },
]

const modules: ModuleItem[] = [
  {
    id: 'gestao-360',
    category: 'gestao',
    icon: Layers3,
    title: 'Gestão 360',
    kicker: 'Visão executiva em tempo real',
    copy: 'Consolida CPI, SPI, curva S, alertas e avanço físico-financeiro para a diretoria entender onde agir primeiro.',
    screenshot: '/screenshots/gestao360.png',
    features: ['Curva S e avanço consolidado', 'Custo, prazo e risco no mesmo painel', 'Drill-down por obra, núcleo e frente'],
    connected: ['RDO', 'Medição', 'Planejamento', 'EVM'],
  },
  {
    id: 'torre',
    category: 'gestao',
    icon: LineChart,
    title: 'Torre de Controle',
    kicker: 'War room para portfólio e obra',
    copy: 'Mostra status, mapa, alertas e exceções para gerir por risco e não por reunião manual de acompanhamento.',
    screenshot: '/screenshots/torre-controle-mapa.png',
    features: ['Mapa com status operacional', 'Alertas por exceção', 'Risco e tendência por obra'],
    connected: ['Gestão 360', 'Qualidade', 'Suprimentos', 'LPS'],
  },
  {
    id: 'medicao',
    category: 'gestao',
    icon: ClipboardCheck,
    title: 'Medição',
    kicker: 'Rascunho defensável com origem',
    copy: 'Transforma RDO, planilhas, fornecedores, NFs, descontos e retenções em medição conferível por período.',
    screenshot: '/screenshots/relatorio-360.png',
    features: ['Memória de cálculo', 'Pendências bloqueantes', 'Aprovação humana antes do fechamento'],
    connected: ['RDO', 'Suprimentos', 'Qualidade', 'Planejamento'],
  },
  {
    id: 'planejamento',
    category: 'planejamento',
    icon: CalendarClock,
    title: 'Planejamento',
    kicker: 'Baseline, avanço e tendência',
    copy: 'Conecta cronograma, WBS, marcos, frente física e avanço aprovado sem mexer na baseline oficial automaticamente.',
    screenshot: '/screenshots/agenda-gantt.png',
    features: ['WBS e marcos', 'Gantt operacional', 'Atualização por avanço aprovado'],
    connected: ['RDO', 'Medição', 'LPS', 'EVM'],
  },
  {
    id: 'lps',
    category: 'planejamento',
    icon: BrainCircuit,
    title: 'LPS / Lean',
    kicker: 'Last Planner nativo',
    copy: 'Look-ahead, restrições, compromissos, PPC e causas de não cumprimento conectados ao cronograma real.',
    screenshot: '/screenshots/lps-lookahead.png',
    features: ['Look-ahead de 6 semanas', 'Registro de restrições', 'PPC e causas de não cumprimento'],
    connected: ['Planejamento', 'Suprimentos', 'Mão de Obra', 'Qualidade'],
  },
  {
    id: 'rdo',
    category: 'campo',
    icon: FileText,
    title: 'RDO',
    kicker: 'Dado de campo que vira decisão',
    copy: 'Registra serviço, local, equipe, equipamento, material, foto, ocorrência e assinatura com rastreabilidade.',
    screenshot: '/screenshots/rdo-dashboard.png',
    features: ['Produção por local e serviço', 'Fotos e evidências', 'Origem para medição'],
    connected: ['Medição', 'Qualidade', 'Planejamento', 'Torre'],
  },
  {
    id: 'qualidade',
    category: 'campo',
    icon: ShieldCheck,
    title: 'Qualidade',
    kicker: 'FVS e não conformidades',
    copy: 'Conecta inspeção, evidência, não conformidade e liberação ao avanço físico e ao bloqueio de medição.',
    features: ['FVS digital', 'Tratamento de NC', 'Liberação ou bloqueio de fechamento'],
    connected: ['RDO', 'Medição', 'LPS', 'Torre'],
  },
  {
    id: 'mao-de-obra',
    category: 'campo',
    icon: Users,
    title: 'Mão de Obra',
    kicker: 'Equipe, função e produtividade',
    copy: 'Organiza cadastro, alocação, certificações e produtividade por frente para orientar planejamento e custo.',
    features: ['Alocação diária', 'Certificações', 'Produtividade por equipe'],
    connected: ['RDO', 'LPS', 'EVM', 'Planejamento'],
  },
  {
    id: 'equipamentos',
    category: 'campo',
    icon: Wrench,
    title: 'Equipamentos',
    kicker: 'Uso, manutenção e custo',
    copy: 'Torna máquina e equipamento parte da operação: disponibilidade, uso em campo, manutenção e custo por frente.',
    features: ['Controle de uso', 'Manutenção preventiva', 'Custo operacional'],
    connected: ['RDO', 'LPS', 'Suprimentos', 'EVM'],
  },
  {
    id: 'bim',
    category: 'projetos',
    icon: Building2,
    title: 'BIM 3D/4D/5D',
    kicker: 'Modelo, tempo e custo',
    copy: 'Aproxima projeto, cronograma, orçamento e avanço real para transformar modelo em operação.',
    screenshot: '/screenshots/bim-5d.png',
    features: ['Visualização 3D', 'Simulação 4D', 'Análise 5D'],
    connected: ['Planejamento', 'Quantitativos', 'EVM', 'Torre'],
  },
  {
    id: 'mapa',
    category: 'projetos',
    icon: Map,
    title: 'Mapa Interativo',
    kicker: 'Local físico como chave da operação',
    copy: 'Conecta rua, trecho, rede, núcleo, evidência e status para reduzir retrabalho em obras distribuídas.',
    features: ['Redes e trechos', 'Status por local', 'Base para RDO e medição'],
    connected: ['RDO', 'Medição', 'Planejamento', 'Torre'],
  },
  {
    id: 'quantitativos',
    category: 'projetos',
    icon: BadgeDollarSign,
    title: 'Quantitativos',
    kicker: 'Orçamento que alimenta execução',
    copy: 'Itens, composições, bases SINAPI/SEINFRA e N. Preço viram referência para planejamento, medição e EVM.',
    screenshot: '/screenshots/quantitativos.png',
    features: ['SINAPI e SEINFRA', 'BDI e composições', 'Exportação estruturada'],
    connected: ['Medição', 'EVM', 'Planejamento', 'BIM'],
  },
  {
    id: 'suprimentos',
    category: 'suprimentos',
    icon: PackageCheck,
    title: 'Suprimentos',
    kicker: 'Compra, recebimento e NF',
    copy: 'Vincula requisição, pedido, recebimento, nota fiscal e fornecedor ao planejamento e à medição.',
    features: ['Three-Way Match', 'Recebimento e NF', 'Scorecard de fornecedores'],
    connected: ['Medição', 'LPS', 'Planejamento', 'EVM'],
  },
]

const impactRows = [
  {
    category: '(0.1) Ganhe uma Vantagem Desleal',
    impact: 'Redução de 3-5% no custo total sobre o faturamento.',
    how: 'Otimização de suprimentos e eliminação de perdas por erros de faturamento via Three-Way Match.',
  },
  {
    category: '(0.2) Entregue com Velocidade',
    impact: 'Controle total da sua obra em dias, não meses.',
    how: 'Integração instantânea de cronogramas, planejamento, financeiro e execução do campo na mesma ontologia de dados.',
  },
  {
    category: '(0.3) Economize Tempo',
    impact: 'Redução de 80% no tempo de orçamentação.',
    how: 'Automação de processos de alocação e ciclos de relatórios em tempo real, com RDO digital.',
  },
  {
    category: '(0.4) Fortaleça sua Cadeia',
    impact: 'Queda de 40% nos riscos de falta de material.',
    how: 'Alertas preditivos e monitoramento proativo de interrupções na cadeia de suprimentos.',
  },
  {
    category: '(0.5) Controle do Avanço Físico-Financeiro',
    impact: 'Controle todas as decisões financeiras dentro da sua obra.',
    how: 'Integração dos módulos e das decisões da obra dentro do sistema, para controle financeiro total de cada setor e núcleo.',
  },
]

const differentiators = [
  {
    number: '01',
    title: 'Ontologia da construção',
    copy: 'Obra, frente, serviço, equipe, material, prazo, custo e evidência seguem o mesmo modelo operacional em todos os módulos.',
  },
  {
    number: '02',
    title: 'Loop de feedback rápido',
    copy: 'O que o campo registra no RDO alimenta medição, qualidade, planejamento, gestão e relatórios sem retrabalho.',
  },
  {
    number: '03',
    title: 'LPS / Lean nativo',
    copy: 'Last Planner System com look-ahead de 6 semanas, PPC semanal, restrições, compromissos e causas de não cumprimento conectados ao cronograma real.',
  },
  {
    number: '04',
    title: 'Decisão antes do relatório',
    copy: 'A plataforma cruza dados e aponta a próxima ação antes que o problema vire atraso, glosa ou custo oculto.',
  },
]

const audience = [
  {
    title: 'Construtoras de médio porte',
    problem: 'A diretoria enxerga resultado tarde demais, depois que planilha, RDO e financeiro já divergiram.',
    solution: 'O ConstruData cria uma base operacional única para acompanhar campo, medição, custo e prazo por obra.',
  },
  {
    title: 'Saneamento e infraestrutura',
    problem: 'Serviços por rua, núcleo, OS e evidência ficam espalhados entre equipes, fiscais e medição.',
    solution: 'RDO, mapa, cronograma e medição usam os mesmos códigos, locais e evidências para reduzir retrabalho.',
  },
  {
    title: 'EPC e consórcios',
    problem: 'Várias empresas participam da entrega, mas a governança precisa de rastreabilidade e permissão por perfil.',
    solution: 'A plataforma organiza empresas, usuários, aprovações, evidências e auditoria em ambiente multiempresa.',
  },
  {
    title: 'Empreiteiras',
    problem: 'A produção executada no campo demora para virar medição defensável com memória e anexos.',
    solution: 'O RDO finalizado gera rascunho de medição por empreiteiro, núcleo, serviço e evidência para conferência.',
  },
]

const autonomyCards = [
  {
    place: 'No canteiro',
    person: 'O engenheiro',
    copy: 'decide melhor sobre o que registrar, o que medir e qual restrição abrir, porque vê o impacto da decisão no cronograma, na medição e na qualidade.',
  },
  {
    place: 'No escritório',
    person: 'O gerente',
    copy: 'decide melhor sobre realocação de equipe, aprovação de pedido, priorização de obra e risco de prazo, porque acompanha CPI/SPI sem depender de relatório manual.',
  },
  {
    place: 'No celular',
    person: 'O diretor',
    copy: 'decide melhor sobre portfólio, novas obras e conversas com clientes, porque abre a plataforma e entende em segundos o que está de pé e o que está caindo.',
  },
]

const testimonials = [
  { name: 'Felipe Nery', role: 'Engenheiro Engelfer', quote: 'A plataforma coloca o dado de campo no centro da decisão, sem depender de consolidação manual.' },
  { name: 'Fabrizzio de Paoli', role: 'Consórcio Se Liga Na Rede', quote: 'Quando RDO, planejamento e medição conversam, a gestão deixa de discutir planilha e passa a discutir decisão.' },
  { name: 'Matheus Marques', role: 'Vila Rica Engenharia', quote: 'O valor está em rastrear origem, pendência e responsabilidade antes que o problema chegue ao fechamento.' },
]

const logos = [
  { src: '/logos/social-proof/engelfer-horizontal.png', alt: 'Engelfer Engenharia' },
  { src: '/logos/social-proof/cslnr.jpg', alt: 'Consórcio Se Liga na Rede' },
  { src: '/logos/social-proof/vr.jfif', alt: 'Vila Rica Engenharia' },
  { src: '/logos/social-proof/engelfer-selo.png', alt: 'Engelfer Engenharia' },
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
  {
    q: 'Como começa uma obra nova?',
    a: 'Começa com contrato, orçamento, cronograma, frentes ou núcleos, fornecedores, subempreiteiros, RDO atual e responsáveis. A partir disso a base operacional é estruturada.',
  },
  {
    q: 'Preciso mudar todos os processos antes de usar?',
    a: 'Não. O ConstruData foi pensado para absorver o que já existe, organizar a operação e amadurecer os fluxos por módulo.',
  },
]

function SectionIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="grid gap-5 border-t border-white/12 pt-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#f97316]">{eyebrow}</p>
      <div>
        <h2 className="font-['Space_Grotesk'] text-3xl font-bold leading-tight text-white sm:text-5xl">{title}</h2>
        {copy && <p className="mt-6 max-w-3xl text-base leading-8 text-white/70">{copy}</p>}
      </div>
    </div>
  )
}

function HeroAnimation() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[#070707]" />
      <div className="hero-grid absolute inset-0 opacity-45" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_28%,rgba(249,115,22,0.22),transparent_30%),radial-gradient(circle_at_28%_74%,rgba(255,255,255,0.08),transparent_34%)]" />
      <svg className="absolute right-[-6%] top-24 h-[620px] w-[760px] text-[#f97316]/35" viewBox="0 0 760 620" fill="none">
        <path className="draw-path" d="M82 498H615M170 498V175L438 72V498M170 250H438M170 334H438M298 124V498M538 498V254H650V498M538 254L594 168L650 254" stroke="currentColor" strokeWidth="2" />
        <path className="draw-path delay-1" d="M84 540H680M108 540C150 508 198 508 240 540C282 572 330 572 372 540C414 508 462 508 504 540C546 572 594 572 636 540" stroke="white" strokeOpacity="0.18" strokeWidth="2" />
        <circle className="pulse-node" cx="170" cy="250" r="6" fill="currentColor" />
        <circle className="pulse-node delay-1" cx="438" cy="334" r="6" fill="currentColor" />
        <circle className="pulse-node delay-2" cx="594" cy="168" r="6" fill="currentColor" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-r from-[#070707] via-[#070707]/92 to-[#070707]/48" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#111111]" />
    </div>
  )
}

function HeroSystemPanel() {
  return (
    <div className="relative border border-white/14 bg-[#181818]/92 p-4 shadow-2xl shadow-black/50">
      <div className="mb-4 flex items-center justify-between border-b border-white/12 pb-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">ConstruData OS</span>
        <span className="flex items-center gap-2 font-mono text-[11px] text-[#f97316]">
          <span className="h-2 w-2 animate-pulse bg-[#f97316]" />
          operação ao vivo
        </span>
      </div>
      <img src="/screenshots/gestao360.png" alt="Dashboard ConstruData" className="h-64 w-full border border-white/10 object-cover object-top sm:h-80" />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          ['RDO', 'origem'],
          ['Medição', 'conferência'],
          ['LPS', 'restrição'],
        ].map(([title, label]) => (
          <div key={title} className="border border-white/12 bg-[#111111] p-4">
            <div className="font-['Space_Grotesk'] text-lg font-bold text-white">{title}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/44">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CompaniesStrip() {
  return (
    <section id="empresas" className="border-t border-white/12 bg-[#111111] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 font-mono text-xs font-bold uppercase tracking-[0.18em] text-white/45">Empresas que confiam no ConstruData</p>
        <div className="relative overflow-hidden border-y border-white/12 py-6">
          <div className="logos-track flex w-max items-center gap-14 pr-14">
            {[...logos, ...logos].map((logo, index) => (
              <div key={`${logo.alt}-${index}`} className="flex h-24 w-56 shrink-0 items-center justify-center border border-white/12 bg-[#181818] p-5">
                <img src={logo.src} alt={logo.alt} loading="lazy" className="max-h-full max-w-full object-contain brightness-110" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ModulesSection() {
  const [category, setCategory] = useState<ModuleCategory>('gestao')
  const filtered = useMemo(() => modules.filter((module) => module.category === category), [category])
  const [activeId, setActiveId] = useState(filtered[0]?.id ?? modules[0].id)
  const activeModule = modules.find((module) => module.id === activeId) ?? filtered[0] ?? modules[0]

  function selectCategory(next: ModuleCategory) {
    setCategory(next)
    const first = modules.find((module) => module.category === next)
    if (first) setActiveId(first.id)
  }

  return (
    <section id="modulos" className="bg-[#111111] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionIntro
          eyebrow="Módulos"
          title="Clique em uma frente da operação e veja os módulos relacionados."
          copy="Cada módulo tem sua própria interface, mas todos usam a mesma ontologia para manter campo, planejamento, medição, qualidade, suprimentos e gestão na mesma fonte de verdade."
        />
        <div className="mt-12 grid gap-8 lg:grid-cols-[0.44fr_0.56fr]">
          <div>
            <div className="grid gap-2">
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectCategory(item.id)}
                  className={`group border p-5 text-left transition ${category === item.id ? 'border-[#f97316] bg-[#f97316] text-white' : 'border-white/12 bg-[#181818] text-white hover:border-white/32'}`}
                >
                  <span className="block font-['Space_Grotesk'] text-xl font-bold">{item.label}</span>
                  <span className={`mt-2 block text-sm leading-6 ${category === item.id ? 'text-white/78' : 'text-white/52'}`}>{item.description}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-2">
              {filtered.map((module) => {
                const Icon = module.icon
                const selected = activeModule.id === module.id
                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => setActiveId(module.id)}
                    className={`grid grid-cols-[42px_1fr] gap-3 border p-3 text-left transition ${selected ? 'border-[#f97316]/70 bg-[#2a1d14]' : 'border-white/12 bg-[#181818] hover:border-[#f97316]/50'}`}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center ${selected ? 'bg-[#f97316] text-white' : 'bg-[#0d0d0d] text-[#f97316]'}`}>
                      <Icon size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-white">{module.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-white/50">{module.kicker}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          <article className="border border-white/12 bg-[#181818]">
            {activeModule.screenshot ? (
              <img src={activeModule.screenshot} alt={`Tela do módulo ${activeModule.title}`} className="h-72 w-full border-b border-white/12 object-cover object-top" />
            ) : (
              <div className="flex h-72 items-center justify-center border-b border-white/12 bg-[#0c0c0c]">
                <DatabaseZap className="text-[#f97316]" size={46} />
              </div>
            )}
            <div className="p-6 sm:p-8">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#f97316]">{activeModule.kicker}</p>
              <h3 className="mt-3 font-['Space_Grotesk'] text-4xl font-bold text-white">{activeModule.title}</h3>
              <p className="mt-5 max-w-3xl text-sm leading-7 text-white/70">{activeModule.copy}</p>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/45">Funcionalidades</h4>
                  <div className="grid gap-2">
                    {activeModule.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-3 border border-white/12 bg-[#111111] p-3 text-sm text-white/78">
                        <CheckCircle2 size={16} className="text-[#f97316]" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/45">Conecta com</h4>
                  <div className="flex flex-wrap gap-2">
                    {activeModule.connected.map((item) => (
                      <span key={item} className="border border-white/12 bg-[#111111] px-3 py-2 text-xs font-semibold text-white/72">
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

function Input({ label, name, type = 'text', required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="h-12 w-full border border-white/12 bg-[#111111] px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#f97316]"
      />
    </label>
  )
}

export function LandingPage() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const html = document.documentElement
    const previousTheme = html.getAttribute('data-theme')
    html.setAttribute('data-theme', 'dark')
    return () => {
      if (previousTheme) html.setAttribute('data-theme', previousTheme)
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
    <div className="min-h-screen bg-[#070707] text-white antialiased">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/12 bg-[#070707]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <BrandLockup />
          </a>
          <nav className="hidden items-center gap-7 lg:flex">
            {[
              ['Ontologia', '#ontologia'],
              ['Impacto', '#impacto'],
              ['Módulos', '#modulos'],
              ['Perfis', '#perfis'],
              ['Contato', '#contato'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-xs font-semibold uppercase tracking-[0.12em] text-white/58 transition hover:text-white">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href={LOGIN_URL} className="hidden border border-white/16 px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white/76 transition hover:border-[#f97316] hover:text-white sm:inline-flex">
              Acessar
            </a>
            <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#f97316] px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#ea580c]">
              Demo <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-screen overflow-hidden pt-28">
          <HeroAnimation />
          <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-4 pb-24 sm:px-6 lg:grid-cols-[0.98fr_1.02fr] lg:px-8 lg:pb-32 lg:pt-20">
            <div className="flex flex-col justify-center">
              <p className="mb-8 max-w-fit border-l-2 border-[#f97316] pl-4 font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#f97316]">
                Plataforma de Planejamento e Gestão da Execução da Obra
              </p>
              <h1 className="font-['Space_Grotesk'] text-6xl font-bold leading-[0.92] text-white sm:text-7xl lg:text-8xl">
                ConstruData
              </h1>
              <p className="mt-7 max-w-3xl font-['Space_Grotesk'] text-2xl font-semibold leading-tight text-white sm:text-4xl">
                Automação Alimentada por IA para cada Decisão na Construção.
              </p>
              <div className="mt-8 max-w-2xl space-y-5 text-base leading-8 text-white/72">
                <p>
                  Traga a Inteligência Operacional para o Mundo Real. Codifique as decisões da sua empresa, impulsione a autonomia nas operações centrais e transforme a alavancagem operacional do seu negócio de construção e saneamento.
                </p>
                <p>
                  Integre campo, qualidade, medição, planejamento, suprimentos e gestão em uma única base operacional. Do RDO com foto e assinatura aos indicadores executivos, cada dado nasce com origem e rastreabilidade.
                </p>
              </div>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-3 bg-[#f97316] px-7 py-4 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#ea580c]">
                  Ver como funciona <ArrowRight size={17} />
                </a>
                <a href={LOGIN_URL} className="inline-flex items-center justify-center border border-white/16 bg-white/[0.03] px-7 py-4 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:border-[#f97316]">
                  Acessar plataforma
                </a>
              </div>
            </div>
            <div className="self-center">
              <HeroSystemPanel />
            </div>
          </div>
        </section>

        <section id="ontologia" className="bg-[#111111] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="A Ontologia da Construção"
              title="O Diferencial Técnico"
              copy="A Ontologia da Construção integra todas as funções centrais, da pré-construção ao suprimento, execução no canteiro e encerramento do projeto, através de uma camada semântica unificada."
            />
            <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border border-white/12 bg-[#181818] p-6 sm:p-8">
                <DatabaseZap className="mb-6 text-[#f97316]" size={32} />
                <p className="text-base leading-8 text-white/72">
                  Em sua essência, a Ontologia padroniza como os departamentos interagem com objetos de negócio compartilhados, como projetos, atividades, equipamentos e subempreiteiros, garantindo definições consistentes e sincronização em tempo real em toda a empresa.
                </p>
              </div>
              <div className="space-y-6 text-base leading-8 text-white/72">
                <p>
                  Construída sob uma perspectiva "campo-primeiro", a Ontologia conecta o que acontece no canteiro de obras aos sistemas que o suportam (ERP, BIM, Cronogramas) em um ambiente low-code acessível a todos os usuários, independentemente do background técnico.
                </p>
                <p>
                  O ConstruData faz a ponte entre plataformas fundamentais e casos de uso críticos. Ela permite decisões baseadas em IA que preveem atrasos no cronograma antes que ocorram, aceleram o alinhamento de fornecedores e sintetizam a entrega do projeto com metas de segurança, orçamento e prazo, reduzindo o risco em toda a execução, enquanto preserva seus investimentos tecnológicos existentes.
                </p>
                <p className="border-l-2 border-[#f97316] pl-5 font-semibold text-white">
                  Na prática: quando o engenheiro atualiza o RDO no campo, o cronograma, o EVM e os suprimentos se ajustam automaticamente — sem retrabalho, sem planilhas paralelas.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="impacto" className="bg-[#070707] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="Impacto real em escala"
              title="ConstruData Impulsiona Impacto Real em Escala"
              copy="Ajudamos empresas de engenharia e construção a dominarem o mercado."
            />
            <div className="mt-12 overflow-hidden border border-white/12">
              <div className="hidden grid-cols-[0.9fr_0.9fr_1.2fr] border-b border-white/12 bg-white/[0.04] px-5 py-4 font-mono text-xs font-bold uppercase tracking-[0.16em] text-white/42 lg:grid">
                <span>Categoria</span>
                <span>Impacto Mensurável</span>
                <span>Como Acontece</span>
              </div>
              {impactRows.map((row) => (
                <div key={row.category} className="grid gap-4 border-b border-white/12 bg-[#111111] p-5 last:border-b-0 lg:grid-cols-[0.9fr_0.9fr_1.2fr] lg:items-center">
                  <h3 className="font-['Space_Grotesk'] text-xl font-bold text-white">{row.category}</h3>
                  <p className="text-sm font-semibold leading-6 text-white/84">{row.impact}</p>
                  <p className="text-sm leading-7 text-white/64">{row.how}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CompaniesStrip />

        <section id="diferencial" className="bg-[#111111] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="Diferencial único"
              title="Todo mundo tem acesso a código. Nem todo mundo tem metodologia."
              copy="O ConstruData não é apenas um software de gestão. É uma metodologia operacional para obras de construção civil e saneamento, com dados conectados desde o campo até a decisão executiva."
            />
            <div className="mt-12 grid gap-px bg-white/12 md:grid-cols-2">
              {differentiators.map((item) => (
                <article key={item.number} className="bg-[#181818] p-6 transition hover:bg-[#202020] sm:p-8">
                  <span className="font-mono text-sm font-bold text-[#f97316]">{item.number}</span>
                  <h3 className="mt-8 font-['Space_Grotesk'] text-2xl font-bold text-white">{item.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-white/68">{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ModulesSection />

        <section id="depoimentos" className="bg-[#070707] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="O que os líderes da construção estão dizendo"
              title="Provas sociais focadas em ROI e transformação digital."
              copy="Logotipos em movimento e depoimentos preparados para conversar com decisores, operação e engenharia."
            />
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {testimonials.map((item) => (
                <figure key={item.name} className="border border-white/12 bg-[#111111] p-6">
                  <blockquote className="text-base leading-8 text-white/72">“{item.quote}”</blockquote>
                  <figcaption className="mt-8 border-t border-white/12 pt-5">
                    <div className="font-['Space_Grotesk'] text-xl font-bold text-white">{item.name}</div>
                    <div className="mt-1 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#f97316]">{item.role}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="perfis" className="bg-[#111111] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="Para quem é o ConstruData?"
              title="O visitante certo se reconhece rápido."
              copy="Cada perfil entra por uma dor diferente, mas todos precisam do mesmo ponto de chegada: dado de campo confiável virando decisão, medição e planejamento."
            />
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {audience.map((item) => (
                <article key={item.title} className="border border-white/12 bg-[#181818] p-6">
                  <h3 className="font-['Space_Grotesk'] text-2xl font-bold text-white">{item.title}</h3>
                  <p className="mt-5 text-sm leading-7 text-white/66">
                    <strong className="text-white">Problema:</strong> {item.problem}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-white/66">
                    <strong className="text-white">Como resolve:</strong> {item.solution}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="linkedin" className="bg-[#070707] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 border border-white/12 bg-[#111111] p-6 sm:p-8 lg:grid-cols-[0.75fr_1.25fr]">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#f97316]">Artigo no LinkedIn</p>
                <h2 className="mt-8 font-['Space_Grotesk'] text-4xl font-bold leading-tight text-white">A visão por trás da ConstruData.</h2>
              </div>
              <div>
                <p className="text-base leading-8 text-white/72">
                  Um conteúdo para aprofundar a conversa sobre construção, saneamento, dados conectados e inteligência operacional. A ideia central é simples: a obra ganha velocidade quando campo, escritório e diretoria trabalham na mesma fonte de verdade.
                </p>
                <div className="mt-8 border-l-2 border-[#f97316] pl-5">
                  <p className="font-['Space_Grotesk'] text-2xl font-bold text-white">ConstruData Software</p>
                  <p className="mt-2 text-sm leading-7 text-white/68">
                    Dados conectados, automação e decisões melhores para obras reais.
                  </p>
                </div>
                <p className="mt-6 text-sm leading-7 text-white/68">
                  Leia o artigo publicado no LinkedIn e veja como a plataforma posiciona RDO, planejamento, suprimentos, medição, qualidade e gestão como uma camada única de operação.
                </p>
                <a href={LINKEDIN_ARTICLE_URL} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-3 bg-[#f97316] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#ea580c]">
                  Ler artigo no LinkedIn <ArrowRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="autonomia" className="bg-[#111111] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionIntro
              eyebrow="Autonomia para a cadeia inteira"
              title="A obra inteira fica mais inteligente."
              copy="Não porque tem mais dashboards. Porque tem mais pessoas decidindo bem, no momento certo, com a informação certa. É isso que distribui autonomia de verdade pela cadeia da sua construção."
            />
            <p className="mt-10 max-w-3xl font-['Space_Grotesk'] text-2xl font-bold leading-tight text-white">
              Você não está comprando um software. Está comprando autonomia para a sua cadeia inteira.
            </p>
            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {autonomyCards.map((item) => (
                <article key={item.place} className="border border-white/12 bg-[#181818] p-6">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#f97316]">{item.place}</p>
                  <h3 className="mt-8 font-['Space_Grotesk'] text-3xl font-bold text-white">{item.person}</h3>
                  <p className="mt-5 text-sm leading-7 text-white/68">{item.copy}</p>
                  <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-[#f97316] transition hover:text-white">
                    Ver como funciona <ArrowRight size={14} />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contato" className="bg-[#070707] py-20 sm:py-28">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
            <div>
              <SectionIntro eyebrow="SAQ" title="Ganhe uma vantagem competitiva com ConstruData." />
              <div className="mt-8 grid gap-3">
                {faqs.map((item) => (
                  <details key={item.q} className="group border border-white/12 bg-[#111111] p-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <span className="font-['Space_Grotesk'] text-base font-bold text-white">{item.q}</span>
                      <span className="text-[#f97316] transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-4 text-sm leading-7 text-white/68">{item.a}</p>
                  </details>
                ))}
              </div>
            </div>
            <form onSubmit={handleSubmit} className="border border-white/12 bg-[#111111] p-5 sm:p-7">
              {sent ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <CheckCircle2 className="mb-5 text-[#f97316]" size={42} />
                  <h3 className="font-['Space_Grotesk'] text-2xl font-bold text-white">Solicitação enviada.</h3>
                  <p className="mt-3 max-w-md text-sm leading-7 text-white/68">Nossa equipe entrará em contato para entender o cenário da sua obra e preparar a demonstração.</p>
                </div>
              ) : (
                <>
                  <div className="mb-7 flex items-center gap-3">
                    <LockKeyhole className="text-[#f97316]" size={20} />
                    <div>
                      <h3 className="font-['Space_Grotesk'] text-2xl font-bold text-white">Formulário de Qualificação</h3>
                      <p className="mt-1 text-xs leading-5 text-white/48">Nome, e-mail corporativo, empresa e cargo para preparar a demonstração.</p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input name="nome" label="Nome" required />
                    <Input name="sobrenome" label="Sobrenome" required />
                    <Input name="email" label="E-mail corporativo" type="email" required />
                    <Input name="empresa" label="Nome da empresa" required />
                    <Input name="cargo" label="Cargo" required />
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Principal dor</span>
                      <textarea name="dor" rows={4} className="w-full border border-white/12 bg-[#111111] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#f97316]" placeholder="Ex.: RDO incompleto, medição manual, orçamento demorado, falta de integração com planejamento..." />
                    </label>
                  </div>
                  {error && <p className="mt-4 border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">{error}</p>}
                  <button type="submit" disabled={sending} className="mt-6 flex w-full items-center justify-center gap-3 bg-[#f97316] px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#ea580c] disabled:opacity-60">
                    {sending ? 'Enviando...' : 'Solicitar demonstração'} <ArrowRight size={16} />
                  </button>
                </>
              )}
            </form>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/12 bg-[#070707] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center sm:flex-row sm:px-6 lg:px-8">
          <span className="text-xs text-white/62">© 2026 ConstruData</span>
          <span className="text-xs text-white/42">CONSTRUÇÃO · SANEAMENTO · INFRAESTRUTURA</span>
        </div>
      </footer>

      <style>{`
        .hero-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px);
          background-size: 84px 84px;
          animation: grid-pan 18s linear infinite;
        }
        .draw-path {
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
          to { transform: translate3d(84px,84px,0); }
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
          .hero-grid, .draw-path, .pulse-node, .logos-track { animation: none; }
        }
      `}</style>
    </div>
  )
}
