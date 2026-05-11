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
import { Badge } from '@/components/ui/badge'
import { Marquee } from '@/components/ui/marquee'

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

const moduleCategories: Array<{ id: ModuleCategory; label: string }> = [
  { id: 'gestao', label: 'Gestão e Decisão' },
  { id: 'planejamento', label: 'Planejamento' },
  { id: 'campo', label: 'Campo e Execução' },
  { id: 'projetos', label: 'Projetos e BIM' },
  { id: 'suprimentos', label: 'Suprimentos' },
]

const modules: ModuleItem[] = [
  {
    id: 'gestao-360',
    category: 'gestao',
    icon: Layers3,
    title: 'Gestão 360',
    kicker: 'Diretoria em tempo real',
    copy: 'Consolida CPI, SPI, curva S, alertas, custo, prazo e avanço físico-financeiro por obra.',
    screenshot: '/screenshots/gestao360.png',
    features: ['Curva S executiva', 'Indicadores CPI/SPI', 'Alertas por exceção'],
    connected: ['RDO', 'Medição', 'Planejamento', 'EVM'],
  },
  {
    id: 'torre',
    category: 'gestao',
    icon: LineChart,
    title: 'Torre de Controle',
    kicker: 'War room operacional',
    copy: 'Mostra mapa, status, riscos, exceções e decisões urgentes para gerir por prioridade.',
    screenshot: '/screenshots/torre-controle-mapa.png',
    features: ['Mapa de obras', 'Matriz de risco', 'Drill-down por frente'],
    connected: ['Gestão 360', 'Qualidade', 'Suprimentos', 'LPS'],
  },
  {
    id: 'medicao',
    category: 'gestao',
    icon: ClipboardCheck,
    title: 'Medição',
    kicker: 'Memória defensável',
    copy: 'Transforma RDO, planilhas, fornecedores, NFs, descontos e retenções em medição conferível.',
    screenshot: '/screenshots/relatorio-360.png',
    features: ['Memória de cálculo', 'Pendências bloqueantes', 'Aprovação humana'],
    connected: ['RDO', 'Suprimentos', 'Qualidade', 'Planejamento'],
  },
  {
    id: 'planejamento',
    category: 'planejamento',
    icon: CalendarClock,
    title: 'Planejamento',
    kicker: 'Baseline, avanço e tendência',
    copy: 'Conecta cronograma, WBS, marcos, frente física e avanço aprovado sem alterar baseline automaticamente.',
    screenshot: '/screenshots/agenda-gantt.png',
    features: ['WBS e marcos', 'Gantt operacional', 'Avanço aprovado'],
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
    features: ['Look-ahead 6 semanas', 'PPC semanal', 'Restrições conectadas'],
    connected: ['Planejamento', 'Suprimentos', 'Mão de Obra', 'Qualidade'],
  },
  {
    id: 'rdo',
    category: 'campo',
    icon: FileText,
    title: 'RDO',
    kicker: 'Campo que vira decisão',
    copy: 'Registra serviço, local, equipe, equipamento, material, foto, ocorrência e assinatura com rastreabilidade.',
    screenshot: '/screenshots/rdo-dashboard.png',
    features: ['Produção por serviço', 'Fotos e evidências', 'Origem da medição'],
    connected: ['Medição', 'Qualidade', 'Planejamento', 'Torre'],
  },
  {
    id: 'qualidade',
    category: 'campo',
    icon: ShieldCheck,
    title: 'Qualidade',
    kicker: 'FVS e não conformidades',
    copy: 'Conecta inspeção, evidência, não conformidade e liberação ao avanço e ao bloqueio de medição.',
    features: ['FVS digital', 'Tratamento de NC', 'Liberação de fechamento'],
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
    copy: 'Máquinas entram na chave operacional da obra: disponibilidade, uso no campo, manutenção e custo por frente.',
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
    kicker: 'Local físico como chave',
    copy: 'Conecta rua, trecho, rede, núcleo, evidência e status para reduzir retrabalho em obras distribuídas.',
    features: ['Redes e trechos', 'Status por local', 'Base para RDO e medição'],
    connected: ['RDO', 'Medição', 'Planejamento', 'Torre'],
  },
  {
    id: 'quantitativos',
    category: 'projetos',
    icon: BadgeDollarSign,
    title: 'Quantitativos',
    kicker: 'Orçamento para execução',
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
    features: ['Three-Way Match', 'Recebimento e NF', 'Scorecard de fornecedor'],
    connected: ['Medição', 'LPS', 'Planejamento', 'EVM'],
  },
]

const marqueeData = [
  'RDO incompleto vira pendência visível',
  'Medição com origem e evidência',
  'Planejamento atualizado sem planilha paralela',
  'LPS com restrições conectadas',
  'Suprimentos conversa com cronograma',
  'Qualidade bloqueia fechamento quando precisa',
  'CPI/SPI sem relatório manual',
  'BIM, custo e avanço no mesmo contexto',
  'Fornecedor medido com vínculo explícito',
  'Diretoria decide pelo celular',
  'Núcleo, rua, serviço e período na mesma chave',
  'Campo e escritório na mesma fonte de verdade',
]

const impactRows = [
  ['(0.1) Ganhe uma Vantagem Desleal', 'Redução de 3-5% no custo total sobre o faturamento.', 'Otimização de suprimentos e eliminação de perdas por erros de faturamento via Three-Way Match.'],
  ['(0.2) Entregue com Velocidade', 'Controle total da sua obra em dias, não meses.', 'Integração instantânea de cronogramas, planejamento, financeiro e execução do campo na mesma ontologia de dados.'],
  ['(0.3) Economize Tempo', 'Redução de 80% no tempo de orçamentação.', 'Automação de processos de alocação e ciclos de relatórios em tempo real, com RDO digital.'],
  ['(0.4) Fortaleça sua Cadeia', 'Queda de 40% nos riscos de falta de material.', 'Alertas preditivos e monitoramento proativo de interrupções na cadeia de suprimentos.'],
  ['(0.5) Controle do Avanço Físico-Financeiro', 'Controle todas as decisões financeiras dentro da sua obra.', 'Integração dos módulos e das decisões da obra dentro do sistema, para controle financeiro total de cada setor e núcleo.'],
]

const differentiators = [
  ['01', 'Ontologia da construção', 'Obra, frente, serviço, equipe, material, prazo, custo e evidência seguem o mesmo modelo operacional em todos os módulos.'],
  ['02', 'Loop de feedback rápido', 'O que o campo registra no RDO alimenta medição, qualidade, planejamento, gestão e relatórios sem retrabalho.'],
  ['03', 'LPS / Lean nativo', 'Last Planner System com look-ahead de 6 semanas, PPC semanal, restrições, compromissos e causas de não cumprimento conectados ao cronograma real.'],
  ['04', 'Decisão antes do relatório', 'A plataforma cruza dados e aponta a próxima ação antes que o problema vire atraso, glosa ou custo oculto.'],
]

const audience = [
  ['Construtoras de médio porte', 'A diretoria enxerga resultado tarde demais, depois que planilha, RDO e financeiro já divergiram.', 'O ConstruData cria uma base operacional única para acompanhar campo, medição, custo e prazo por obra.'],
  ['Saneamento e infraestrutura', 'Serviços por rua, núcleo, OS e evidência ficam espalhados entre equipes, fiscais e medição.', 'RDO, mapa, cronograma e medição usam os mesmos códigos, locais e evidências para reduzir retrabalho.'],
  ['EPC e consórcios', 'Várias empresas participam da entrega, mas a governança precisa de rastreabilidade e permissão por perfil.', 'A plataforma organiza empresas, usuários, aprovações, evidências e auditoria em ambiente multiempresa.'],
  ['Empreiteiras', 'A produção executada no campo demora para virar medição defensável com memória e anexos.', 'O RDO finalizado gera rascunho de medição por empreiteiro, núcleo, serviço e evidência para conferência.'],
]

const autonomyCards = [
  ['No canteiro', 'O engenheiro', 'decide melhor sobre o que registrar, o que medir e qual restrição abrir, porque vê o impacto da decisão no cronograma, na medição e na qualidade.'],
  ['No escritório', 'O gerente', 'decide melhor sobre realocação de equipe, aprovação de pedido, priorização de obra e risco de prazo, porque acompanha CPI/SPI sem depender de relatório manual.'],
  ['No celular', 'O diretor', 'decide melhor sobre portfólio, novas obras e conversas com clientes, porque abre a plataforma e entende em segundos o que está de pé e o que está caindo.'],
]

const testimonials = [
  ['Felipe Nery', 'Engenheiro Engelfer', 'A plataforma coloca o dado de campo no centro da decisão, sem depender de consolidação manual.'],
  ['Fabrizzio de Paoli', 'Consórcio Se Liga Na Rede', 'Quando RDO, planejamento e medição conversam, a gestão deixa de discutir planilha e passa a discutir decisão.'],
  ['Matheus Marques', 'Vila Rica Engenharia', 'O valor está em rastrear origem, pendência e responsabilidade antes que o problema chegue ao fechamento.'],
]

const logos = [
  ['/logos/social-proof/engelfer-horizontal.png', 'Engelfer Engenharia'],
  ['/logos/social-proof/cslnr.jpg', 'Consórcio Se Liga na Rede'],
  ['/logos/social-proof/vr.jfif', 'Vila Rica Engenharia'],
  ['/logos/social-proof/engelfer-selo.png', 'Engelfer Engenharia'],
]

const faqs = [
  ['O ConstruData substitui minhas planilhas no primeiro dia?', 'Não precisa. A plataforma importa bases existentes, preserva origem e transforma planilhas em dados rastreáveis para medição, planejamento e controle.'],
  ['O RDO fecha automaticamente a medição?', 'Ele gera fonte e rascunho quando há vínculo suficiente. Fechamento e aprovação continuam exigindo revisão humana.'],
  ['Funciona para saneamento e infraestrutura?', 'Sim. A estrutura foi pensada para contrato, núcleo, rua/local, serviço, período, equipes, materiais e evidências.'],
  ['A plataforma conversa com SINAPI, SEINFRA, BIM e cronogramas?', 'Sim. A proposta é conectar bases técnicas, orçamento, modelo, planejamento e execução em uma camada operacional única.'],
  ['Como começa uma obra nova?', 'Começa com contrato, orçamento, cronograma, frentes ou núcleos, fornecedores, subempreiteiros, RDO atual e responsáveis.'],
  ['Preciso mudar todos os processos antes de usar?', 'Não. O ConstruData foi pensado para absorver o que já existe, organizar a operação e amadurecer os fluxos por módulo.'],
]

function SectionHeader({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center justify-center space-y-4 px-5 text-center md:px-10">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#f97316]">{eyebrow}</p>
      <h2 className="max-w-4xl font-['Space_Grotesk'] text-4xl font-medium leading-tight text-white sm:text-5xl lg:text-6xl">{title}</h2>
      {copy && <p className="max-w-3xl text-base leading-8 text-white/70 md:text-lg">{copy}</p>}
    </div>
  )
}

function MarqueeRows() {
  const m1 = marqueeData.slice(0, 4)
  const m2 = marqueeData.slice(4, 8)
  const m3 = marqueeData.slice(8)

  return (
    <div className="relative mx-auto max-w-5xl overflow-hidden">
      <div className="pointer-events-none absolute left-0 z-20 h-full w-20 bg-linear-to-r from-[#2c2c2c]" />
      <div className="pointer-events-none absolute right-0 z-20 h-full w-20 bg-linear-to-l from-[#2c2c2c]" />
      <div className="-mx-6 flex w-screen flex-col md:-mx-10 lg:-mx-16">
        {[m1, m2, m3].map((row, index) => (
          <Marquee key={index} className={`[--duration:${index === 1 ? '52s' : index === 2 ? '44s' : '48s'}] [--gap:0.75rem]`} repeat={4} reverse={index === 1}>
            {row.map((item) => (
              <Badge key={item} variant="outline" className="rounded-none border-[#525252] bg-[#3d3d3d] px-3 py-1 text-white/80">
                {item}
              </Badge>
            ))}
          </Marquee>
        ))}
      </div>
    </div>
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
    <section id="modulos" className="relative bg-[#2c2c2c] pt-20 sm:pt-32">
      <SectionHeader
        eyebrow="Módulos"
        title="Clique em uma frente da operação e veja os módulos relacionados."
        copy="Cada módulo é uma peça da inteligência operacional. Todos compartilham a mesma ontologia de dados."
      />
      <div className="mx-auto mt-12 max-w-7xl px-5 md:px-10">
        <div className="grid grid-cols-1 divide-y divide-dashed divide-[#525252] border-y border-dashed border-[#525252] lg:grid-cols-[0.38fr_0.62fr] lg:divide-x lg:divide-y-0">
          <div className="flex flex-col">
            {moduleCategories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCategory(item.id)}
                className={`border-b border-dashed border-[#525252] px-5 py-5 text-left text-xl font-medium transition last:border-b-0 ${category === item.id ? 'bg-[#f97316] text-white' : 'bg-[#333333] text-white/70 hover:bg-[#3d3d3d] hover:text-white'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div>
            <div className="grid grid-cols-1 divide-y divide-dashed divide-[#525252] md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="flex flex-col divide-y divide-dashed divide-[#525252]">
                {filtered.map((module) => {
                  const Icon = module.icon
                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => setActiveId(module.id)}
                      className={`flex gap-4 px-5 py-5 text-left transition ${activeModule.id === module.id ? 'bg-[#3d3d3d]' : 'bg-[#333333] hover:bg-[#3d3d3d]'}`}
                    >
                      <Icon className="mt-1 size-6 shrink-0 text-[#f97316]" />
                      <span>
                        <span className="block text-lg font-medium text-white">{module.title}</span>
                        <span className="mt-1 block text-sm leading-6 text-white/60">{module.kicker}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <article className="bg-[#333333]">
                {activeModule.screenshot ? (
                  <img src={activeModule.screenshot} alt={`Tela do módulo ${activeModule.title}`} className="h-64 w-full border-b border-dashed border-[#525252] object-cover object-top" />
                ) : (
                  <div className="flex h-64 items-center justify-center border-b border-dashed border-[#525252]">
                    <DatabaseZap className="size-12 text-[#f97316]" />
                  </div>
                )}
                <div className="p-6">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#f97316]">{activeModule.kicker}</p>
                  <h3 className="mt-3 font-['Space_Grotesk'] text-4xl font-medium text-white">{activeModule.title}</h3>
                  <p className="mt-5 text-sm leading-7 text-white/70">{activeModule.copy}</p>
                  <div className="mt-7 flex flex-wrap gap-2">
                    {[...activeModule.features, ...activeModule.connected].map((item) => (
                      <Badge key={item} variant="secondary" className="rounded-none">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              </article>
            </div>
          </div>
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
        className="h-12 w-full rounded-none border border-[#525252] bg-[#333333] px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#f97316]"
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
    <div className="min-h-screen bg-[#2c2c2c] text-white antialiased">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-dashed border-[#525252] bg-[#2c2c2c]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-10">
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
            <a href={LOGIN_URL} className="hidden border border-dashed border-[#525252] px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white/76 transition hover:border-[#f97316] hover:text-white sm:inline-flex">
              Acessar
            </a>
            <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#f97316] px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#ea580c]">
              Demo <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative bg-[#2c2c2c] pt-28 sm:pt-40">
          <div className="mx-auto max-w-full">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-center space-y-6 px-5 text-center md:px-10">
              <Badge className="rounded-none border-[#525252] bg-[#333333] px-4 py-1 text-[#f97316]" variant="outline">
                Plataforma de Planejamento e Gestão da Execução da Obra
              </Badge>
              <h1 className="max-w-5xl font-['Space_Grotesk'] text-6xl font-medium leading-[0.95] text-white sm:text-7xl lg:text-8xl">
                ConstruData
              </h1>
              <h2 className="max-w-4xl font-['Space_Grotesk'] text-3xl font-medium leading-tight text-white sm:text-5xl">
                Automação Alimentada por IA para cada Decisão na Construção.
              </h2>
              <p className="max-w-3xl text-base leading-8 text-white/72 md:text-lg">
                Traga a Inteligência Operacional para o Mundo Real. Codifique as decisões da sua empresa, impulsione a autonomia nas operações centrais e transforme a alavancagem operacional do seu negócio de construção e saneamento.
              </p>
              <p className="max-w-3xl text-base leading-8 text-white/72 md:text-lg">
                Integre campo, qualidade, medição, planejamento, suprimentos e gestão em uma única base operacional. Do RDO com foto e assinatura aos indicadores executivos, cada dado nasce com origem e rastreabilidade.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-3 bg-[#f97316] px-7 py-4 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#ea580c]">
                  Ver como funciona <ArrowRight size={17} />
                </a>
                <a href={LOGIN_URL} className="inline-flex items-center justify-center border border-dashed border-[#525252] bg-[#333333] px-7 py-4 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:border-[#f97316]">
                  Acessar plataforma
                </a>
              </div>
              <MarqueeRows />
            </div>

            <div className="mt-16 grid grid-cols-1 divide-y divide-dashed divide-[#525252] border-y border-dashed border-[#525252] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {[
                ['16+', 'módulos conectados'],
                ['D+0', 'dado de campo'],
                ['100%', 'origem rastreável'],
              ].map(([value, label]) => (
                <div key={label} className="bg-[#333333] px-5 py-8 text-center">
                  <div className="font-['Space_Grotesk'] text-4xl font-medium text-white">{value}</div>
                  <div className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-white/45">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="ontologia" className="bg-[#333333] pt-20 sm:pt-32">
          <SectionHeader
            eyebrow="A Ontologia da Construção"
            title="O Diferencial Técnico"
            copy="A Ontologia da Construção integra todas as funções centrais, da pré-construção ao suprimento, execução no canteiro e encerramento do projeto, através de uma camada semântica unificada."
          />
          <div className="mt-12 grid grid-cols-1 divide-y divide-dashed divide-[#525252] border-y border-dashed border-[#525252] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {[
              'Em sua essência, a Ontologia padroniza como os departamentos interagem com objetos de negócio compartilhados, como projetos, atividades, equipamentos e subempreiteiros.',
              'Construída sob uma perspectiva campo-primeiro, conecta o que acontece no canteiro aos sistemas que o suportam: ERP, BIM e cronogramas.',
              'Na prática: quando o engenheiro atualiza o RDO no campo, cronograma, EVM e suprimentos se ajustam automaticamente, sem retrabalho.',
            ].map((copy, index) => (
              <div key={copy} className="flex flex-col gap-5 bg-[#333333] px-5 py-8 lg:px-8 lg:py-12">
                <DatabaseZap className="size-12 text-[#f97316]" />
                <div className="pt-8 lg:pt-14">
                  <h3 className="font-['Space_Grotesk'] text-3xl font-medium tracking-tight text-white">0{index + 1}</h3>
                  <p className="mt-4 leading-7 text-white/72">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="impacto" className="bg-[#2c2c2c] pt-20 sm:pt-32">
          <SectionHeader
            eyebrow="Impacto real em escala"
            title="ConstruData Impulsiona Impacto Real em Escala"
            copy="Ajudamos empresas de engenharia e construção a dominarem o mercado."
          />
          <div className="mt-12 grid grid-cols-1 divide-y divide-dashed divide-[#525252] border-y border-dashed border-[#525252]">
            {impactRows.map(([category, impact, how]) => (
              <div key={category} className="grid gap-5 bg-[#333333] px-5 py-7 lg:grid-cols-[0.8fr_0.75fr_1.2fr] lg:items-center lg:px-8">
                <h3 className="font-['Space_Grotesk'] text-2xl font-medium text-white">{category}</h3>
                <p className="font-semibold leading-7 text-white/84">{impact}</p>
                <p className="leading-7 text-white/64">{how}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="empresas" className="bg-[#333333] pt-20 sm:pt-32">
          <SectionHeader eyebrow="Empresas que confiam no ConstruData" title="Logotipos em movimento, dados em movimento." />
          <div className="relative mt-12 overflow-hidden border-y border-dashed border-[#525252] py-8">
            <div className="pointer-events-none absolute left-0 z-20 h-full w-20 bg-linear-to-r from-[#333333]" />
            <div className="pointer-events-none absolute right-0 z-20 h-full w-20 bg-linear-to-l from-[#333333]" />
            <Marquee className="[--duration:34s] [--gap:1.5rem]" repeat={4}>
              {logos.map(([src, alt]) => (
                <div key={src} className="flex h-28 w-64 shrink-0 items-center justify-center border border-dashed border-[#525252] bg-[#2c2c2c] p-5">
                  <img src={src} alt={alt} className="max-h-full max-w-full object-contain brightness-110" />
                </div>
              ))}
            </Marquee>
          </div>
        </section>

        <section id="diferencial" className="bg-[#2c2c2c] pt-20 sm:pt-32">
          <SectionHeader
            eyebrow="Diferencial único"
            title="Todo mundo tem acesso a código. Nem todo mundo tem metodologia."
            copy="O ConstruData não é apenas um software de gestão. É uma metodologia operacional para obras de construção civil e saneamento, com dados conectados desde o campo até a decisão executiva."
          />
          <div className="mt-12 grid grid-cols-1 divide-y divide-dashed divide-[#525252] border-y border-dashed border-[#525252] sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
            {differentiators.map(([number, title, copy]) => (
              <div key={number} className="flex flex-col gap-5 bg-[#333333] px-5 py-8 lg:px-6 lg:py-10">
                <div className="font-mono text-sm font-bold text-[#f97316]">{number}</div>
                <div className="flex flex-col gap-3 pt-10 lg:pt-20">
                  <h3 className="font-['Space_Grotesk'] text-2xl font-medium tracking-tight text-white sm:text-3xl">{title}</h3>
                  <p className="leading-7 text-white/68">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <ModulesSection />

        <section id="depoimentos" className="bg-[#333333] pt-20 sm:pt-32">
          <SectionHeader eyebrow="O que os líderes da construção estão dizendo" title="Provas sociais focadas em ROI e transformação digital." />
          <div className="mt-12 grid grid-cols-1 divide-y divide-dashed divide-[#525252] border-y border-dashed border-[#525252] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {testimonials.map(([name, role, quote]) => (
              <figure key={name} className="bg-[#333333] px-5 py-8 lg:px-8 lg:py-12">
                <blockquote className="text-xl leading-9 text-white/80">“{quote}”</blockquote>
                <figcaption className="mt-10 border-t border-dashed border-[#525252] pt-5">
                  <div className="font-['Space_Grotesk'] text-2xl font-medium text-white">{name}</div>
                  <div className="mt-1 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#f97316]">{role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section id="perfis" className="bg-[#2c2c2c] pt-20 sm:pt-32">
          <SectionHeader
            eyebrow="Para quem é o ConstruData?"
            title="O visitante certo se reconhece rápido."
            copy="Cada perfil entra por uma dor diferente, mas todos precisam do mesmo ponto de chegada: dado de campo confiável virando decisão, medição e planejamento."
          />
          <div className="mt-12 grid grid-cols-1 divide-y divide-dashed divide-[#525252] border-y border-dashed border-[#525252] md:grid-cols-2 md:divide-x">
            {audience.map(([title, problem, solution]) => (
              <article key={title} className="bg-[#333333] px-5 py-8 lg:p-10">
                <h3 className="font-['Space_Grotesk'] text-3xl font-medium text-white">{title}</h3>
                <p className="mt-6 leading-7 text-white/68"><strong className="text-white">Problema:</strong> {problem}</p>
                <p className="mt-4 leading-7 text-white/68"><strong className="text-white">Como resolve:</strong> {solution}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="linkedin" className="bg-[#333333] px-5 py-20 sm:py-32 md:px-10">
          <div className="mx-auto grid max-w-6xl gap-8 border border-dashed border-[#525252] bg-[#2c2c2c] p-6 lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#f97316]">Artigo no LinkedIn</p>
              <h2 className="mt-8 font-['Space_Grotesk'] text-5xl font-medium leading-tight text-white">A visão por trás da ConstruData.</h2>
            </div>
            <div>
              <p className="text-lg leading-8 text-white/72">
                Um conteúdo para aprofundar a conversa sobre construção, saneamento, dados conectados e inteligência operacional. A ideia central é simples: a obra ganha velocidade quando campo, escritório e diretoria trabalham na mesma fonte de verdade.
              </p>
              <h3 className="mt-8 font-['Space_Grotesk'] text-3xl font-medium text-white">ConstruData Software</h3>
              <p className="mt-3 leading-7 text-white/68">Dados conectados, automação e decisões melhores para obras reais.</p>
              <a href={LINKEDIN_ARTICLE_URL} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-3 bg-[#f97316] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#ea580c]">
                Ler artigo no LinkedIn <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </section>

        <section id="autonomia" className="bg-[#2c2c2c] pt-20 sm:pt-32">
          <SectionHeader
            eyebrow="Autonomia para a cadeia inteira"
            title="A obra inteira fica mais inteligente."
            copy="Não porque tem mais dashboards. Porque tem mais pessoas decidindo bem, no momento certo, com a informação certa. É isso que distribui autonomia de verdade pela cadeia da sua construção."
          />
          <p className="mx-auto mt-10 max-w-4xl px-5 text-center font-['Space_Grotesk'] text-3xl font-medium leading-tight text-white">
            Você não está comprando um software. Está comprando autonomia para a sua cadeia inteira.
          </p>
          <div className="mt-12 grid grid-cols-1 divide-y divide-dashed divide-[#525252] border-y border-dashed border-[#525252] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {autonomyCards.map(([place, person, copy]) => (
              <article key={place} className="bg-[#333333] px-5 py-8 lg:p-10">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[#f97316]">{place}</p>
                <h3 className="mt-8 font-['Space_Grotesk'] text-4xl font-medium text-white">{person}</h3>
                <p className="mt-5 leading-7 text-white/68">{copy}</p>
                <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.1em] text-[#f97316] transition hover:text-white">
                  Ver como funciona <ArrowRight size={14} />
                </a>
              </article>
            ))}
          </div>
        </section>

        <section id="contato" className="bg-[#333333] px-5 py-20 sm:py-32 md:px-10">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <SectionHeader eyebrow="SAQ" title="Ganhe uma vantagem competitiva com ConstruData." />
              <div className="mt-8 grid gap-3">
                {faqs.map(([question, answer]) => (
                  <details key={question} className="group border border-dashed border-[#525252] bg-[#2c2c2c] p-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                      <span className="font-['Space_Grotesk'] text-base font-medium text-white">{question}</span>
                      <span className="text-[#f97316] transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-4 leading-7 text-white/68">{answer}</p>
                  </details>
                ))}
              </div>
            </div>
            <form onSubmit={handleSubmit} className="border border-dashed border-[#525252] bg-[#2c2c2c] p-5 sm:p-7">
              {sent ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <CheckCircle2 className="mb-5 text-[#f97316]" size={42} />
                  <h3 className="font-['Space_Grotesk'] text-3xl font-medium text-white">Solicitação enviada.</h3>
                  <p className="mt-3 max-w-md leading-7 text-white/68">Nossa equipe entrará em contato para entender o cenário da sua obra e preparar a demonstração.</p>
                </div>
              ) : (
                <>
                  <div className="mb-7 flex items-center gap-3">
                    <LockKeyhole className="text-[#f97316]" size={20} />
                    <div>
                      <h3 className="font-['Space_Grotesk'] text-3xl font-medium text-white">Formulário de Qualificação</h3>
                      <p className="mt-1 text-sm leading-6 text-white/48">Nome, e-mail corporativo, empresa e cargo para preparar a demonstração.</p>
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
                      <textarea name="dor" rows={4} className="w-full rounded-none border border-[#525252] bg-[#333333] px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#f97316]" placeholder="Ex.: RDO incompleto, medição manual, orçamento demorado, falta de integração com planejamento..." />
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

      <footer className="border-t border-dashed border-[#525252] bg-[#2c2c2c] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 text-center sm:flex-row md:px-10">
          <span className="text-xs text-white/62">© 2026 ConstruData</span>
          <span className="text-xs text-white/42">CONSTRUÇÃO · SANEAMENTO · INFRAESTRUTURA</span>
        </div>
      </footer>
    </div>
  )
}
