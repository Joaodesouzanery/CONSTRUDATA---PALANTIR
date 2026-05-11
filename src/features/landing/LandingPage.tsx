import { type FormEvent, useEffect, useState } from 'react'
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileText,
  Layers3,
  LineChart,
  Link2,
  LockKeyhole,
  Map,
  PackageCheck,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react'
import { BrandLockup } from '@/components/shared/BrandLogo'

const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'
const LOGIN_URL = '/app/minha-rotina'

const modules = [
  { icon: Layers3, title: 'Gestão 360', copy: 'CPI, SPI, curva S, riscos e decisões executivas em uma tela.' },
  { icon: FileText, title: 'RDO', copy: 'Campo, fotos, equipes, equipamentos, materiais e assinaturas com origem rastreável.' },
  { icon: ClipboardCheck, title: 'Medição', copy: 'RDO e planilhas viram rascunhos de medição por empreiteiro, fornecedor e período.' },
  { icon: CalendarClock, title: 'Planejamento', copy: 'Cronograma, baseline, avanço real, lookahead e simulações conectados à execução.' },
  { icon: BrainCircuit, title: 'LPS / Lean', copy: 'PPC, restrições, compromisso semanal e causas de não cumprimento com dados reais.' },
  { icon: PackageCheck, title: 'Suprimentos', copy: 'Requisição, compra, recebimento, NF e Three-Way Match no mesmo fluxo.' },
  { icon: ShieldCheck, title: 'Qualidade', copy: 'FVS, não conformidades, evidências e bloqueios antes do fechamento.' },
  { icon: Map, title: 'Mapa Interativo', copy: 'Redes, ruas, trechos, status e medições conectados ao local da obra.' },
  { icon: Building2, title: 'BIM 3D/4D/5D', copy: 'Modelo, cronograma e custo trabalhando como base visual da decisão.' },
  { icon: Wrench, title: 'Equipamentos', copy: 'Disponibilidade, manutenção, utilização e custo por frente de serviço.' },
  { icon: Users, title: 'Mão de Obra', copy: 'Cadastro, alocação, produtividade, certificações e custo operacional.' },
  { icon: LineChart, title: 'EVM / Financeiro', copy: 'Valor agregado, tendência de custo e avanço físico-financeiro.' },
]

const impactRows = [
  {
    code: '0.1',
    title: 'Ganhe uma vantagem operacional',
    metric: '3-5% de redução potencial no custo total',
    how: 'Otimização de suprimentos, conferência de medição e eliminação de perdas por erro de faturamento.',
  },
  {
    code: '0.2',
    title: 'Entregue com velocidade',
    metric: 'Controle em dias, não meses',
    how: 'Cronograma, financeiro e execução de campo sincronizados pela mesma ontologia de dados.',
  },
  {
    code: '0.3',
    title: 'Economize tempo',
    metric: 'Até 80% menos tempo em rotinas críticas',
    how: 'RDO digital, orçamento com bases oficiais e relatórios executivos gerados a partir do dado vivo.',
  },
  {
    code: '0.4',
    title: 'Fortaleça sua cadeia',
    metric: 'Menos risco de falta de material',
    how: 'Alertas preditivos, previsões de demanda e monitoramento de fornecedores por frente de obra.',
  },
  {
    code: '0.5',
    title: 'Controle o avanço físico-financeiro',
    metric: 'Decisão financeira por núcleo, rua e serviço',
    how: 'RDO, medição, suprimentos, EVM e planejamento conectados por uma chave operacional comum.',
  },
]

const flow = [
  'O RDO registra serviço, local, equipe, material, máquina, foto e assinatura.',
  'Qualidade libera, bloqueia ou exige evidência antes do fechamento.',
  'Suprimentos confirma material, recebimento, NF e fornecedor.',
  'Medição gera rascunho com memória, descontos, retenções e pendências.',
  'Planejamento, LPS e Torre de Controle recebem avanço, risco e tendência.',
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
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#f97316]">{children}</span>
      <div className="h-px flex-1 bg-[#525252]" />
    </div>
  )
}

function SectionTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div className="mb-10 grid gap-5 lg:grid-cols-[0.88fr_1.12fr] lg:gap-14">
      <div>
        <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">{eyebrow}</p>
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
      <div className="construction-grid absolute inset-0 opacity-60" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#1f1f1f] to-transparent" />
      <div className="absolute inset-y-0 left-0 w-full bg-[radial-gradient(circle_at_72%_34%,rgba(249,115,22,0.24),transparent_32%),radial-gradient(circle_at_28%_78%,rgba(255,255,255,0.08),transparent_28%)]" />
      <div className="absolute right-[-12%] top-20 h-[520px] w-[520px] rounded-full border border-[#f97316]/20" />
      <div className="absolute right-[8%] top-32 h-[380px] w-[380px] rounded-full border border-white/10" />
      <svg className="absolute right-0 top-20 h-[620px] w-[720px] text-[#f97316]/28" viewBox="0 0 720 620" fill="none">
        <path className="draw-line" d="M70 480H580M150 480V180L430 70V480M150 250H430M150 330H430M270 130V480M515 480V250H620V480M515 250L565 170L620 250" stroke="currentColor" strokeWidth="2" />
        <path className="draw-line delay-1" d="M70 520H650M88 520C128 492 174 492 214 520C254 548 300 548 340 520C380 492 426 492 466 520C506 548 552 548 592 520" stroke="white" strokeOpacity="0.18" strokeWidth="2" />
        <circle className="pulse-node" cx="150" cy="250" r="6" fill="currentColor" />
        <circle className="pulse-node delay-1" cx="430" cy="330" r="6" fill="currentColor" />
        <circle className="pulse-node delay-2" cx="565" cy="170" r="6" fill="currentColor" />
      </svg>
      <div className="absolute inset-0 bg-gradient-to-r from-[#2c2c2c] via-[#2c2c2c]/92 to-[#2c2c2c]/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#2c2c2c]" />
    </div>
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
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#525252] bg-[#2c2c2c]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" className="flex items-center gap-3">
            <BrandLockup />
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            {[
              ['Ontologia', '#ontologia'],
              ['Impacto', '#impacto'],
              ['Módulos', '#modulos'],
              ['Casos', '#casos'],
              ['Contato', '#contato'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="text-xs font-semibold uppercase tracking-[0.12em] text-white/62 transition hover:text-white">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a href={LOGIN_URL} className="hidden border border-[#525252] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white/78 transition hover:border-[#f97316] hover:text-white sm:inline-flex">
              Acessar
            </a>
            <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#f97316] px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-[#ea580c]">
              Demo <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-screen overflow-hidden pt-28">
          <HeroBackground />
          <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-4 pb-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-28 lg:pt-14">
            <div className="flex flex-col justify-center">
              <div className="mb-8 inline-flex w-fit items-center gap-3 border border-[#525252] bg-[#333333]/85 px-4 py-2">
                <span className="h-2 w-2 bg-[#f97316]" />
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Construção, saneamento e infraestrutura</span>
              </div>
              <h1 className="font-['Space_Grotesk'] text-5xl font-bold leading-[0.98] tracking-[-0.02em] text-white sm:text-6xl lg:text-7xl">
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
                <a href={LOGIN_URL} className="inline-flex items-center justify-center gap-3 border border-[#525252] bg-[#333333] px-7 py-4 text-sm font-black uppercase text-white transition hover:border-[#f97316]">
                  Acessar plataforma
                </a>
              </div>
            </div>

            <div className="relative">
              <div className="border border-[#525252] bg-[#333333]/90 p-4 shadow-2xl">
                <div className="mb-4 flex items-center justify-between border-b border-[#525252] pb-3">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">Ontologia operacional</span>
                  <span className="text-xs font-bold text-[#f97316]">ao vivo</span>
                </div>
                <div className="grid gap-3">
                  {['RDO finalizado', 'Qualidade liberada', 'Material recebido', 'Medição em revisão', 'LPS atualizado'].map((item, index) => (
                    <div key={item} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 border border-[#525252] bg-[#2c2c2c] p-3">
                      <span className="flex h-9 w-9 items-center justify-center bg-[#f97316]/12 text-xs font-black text-[#f97316]">{index + 1}</span>
                      <span className="text-sm font-semibold text-white/86">{item}</span>
                      <CheckCircle2 size={16} className="text-[#f97316]" />
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    ['16+', 'módulos'],
                    ['D+0', 'campo'],
                    ['100%', 'origem'],
                  ].map(([value, label]) => (
                    <div key={label} className="border border-[#525252] bg-[#3d3d3d] p-4">
                      <div className="font-['Space_Grotesk'] text-xl font-bold text-white">{value}</div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="ontologia" className="border-t border-[#525252] bg-[#333333] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionLabel>01 / Ontologia da Construção</SectionLabel>
            <SectionTitle
              eyebrow="O diferencial técnico"
              title="Todas as funções centrais conectadas por uma camada semântica unificada."
              copy="A Ontologia da Construção padroniza como departamentos interagem com projetos, atividades, equipamentos, materiais, fornecedores e subempreiteiros. O que acontece no canteiro passa a alimentar cronograma, EVM, suprimentos, qualidade e medição sem retrabalho."
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {[
                ['Campo-primeiro', 'O dado nasce no RDO, na FVS, no recebimento ou na medição com origem e evidência.'],
                ['Low-code operacional', 'Usuários de obra conseguem operar fluxos críticos sem depender de times técnicos para cada ajuste.'],
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

        <section id="modulos" className="border-t border-[#525252] bg-[#333333] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionLabel>03 / Módulos conectados</SectionLabel>
            <SectionTitle
              eyebrow="Uma plataforma, muitos fluxos"
              title="Cada módulo é uma peça da mesma operação."
              copy="A landing apresenta os módulos como um sistema integrado, não como uma coleção de telas. O objetivo é mostrar como cada decisão de campo conversa com custo, prazo, qualidade e diretoria."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {modules.map((module) => {
                const Icon = module.icon
                return (
                  <article key={module.title} className="group border border-[#525252] bg-[#2c2c2c] p-5 transition hover:border-[#f97316]/60 hover:bg-[#3d3d3d]">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center bg-[#f97316]/12 text-[#f97316]">
                        <Icon size={21} />
                      </span>
                      <Link2 size={15} className="text-white/25 transition group-hover:text-[#f97316]" />
                    </div>
                    <h3 className="font-['Space_Grotesk'] text-lg font-bold text-white">{module.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/66">{module.copy}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section id="fluxo" className="border-t border-[#525252] bg-[#2c2c2c] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionLabel>04 / Dados conversando entre si</SectionLabel>
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr]">
              <div>
                <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Da obra para a decisão</p>
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

        <section id="casos" className="border-t border-[#525252] bg-[#333333] py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <SectionLabel>05 / Provas sociais</SectionLabel>
            <SectionTitle
              eyebrow="Sem número inventado"
              title="Histórias e depoimentos preparados para validação comercial."
              copy="Esta seção usa nomes indicados no material da landing e evita métricas não confirmadas. O foco é transformação operacional, rastreabilidade e maturidade de dados."
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {testimonials.map((item) => (
                <figure key={item.name} className="border border-[#525252] bg-[#2c2c2c] p-6">
                  <blockquote className="text-sm leading-7 text-white/72">“{item.quote}”</blockquote>
                  <figcaption className="mt-6 border-t border-[#525252] pt-4">
                    <div className="font-['Space_Grotesk'] text-base font-bold text-white">{item.name}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#f97316]">{item.role} - {item.company}</div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-[#525252] bg-[#2c2c2c] py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <SectionLabel>06 / SAQ</SectionLabel>
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
              <SectionLabel>07 / Demonstração</SectionLabel>
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
                      <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-white/45">Principal dor</span>
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
          <span className="text-xs tracking-wide text-white/65">© 2026 ConstruData</span>
          <span className="text-xs tracking-wide text-white/50">CONSTRUÇÃO · SANEAMENTO · INFRAESTRUTURA</span>
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
        @media (prefers-reduced-motion: reduce) {
          .construction-grid, .draw-line, .pulse-node { animation: none; }
        }
      `}</style>
    </div>
  )
}

function Input({ label, name, type = 'text', required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="h-12 w-full border border-[#525252] bg-[#333333] px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#f97316]"
      />
    </label>
  )
}
