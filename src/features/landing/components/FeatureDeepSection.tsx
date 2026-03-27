import { CheckCircle2 } from 'lucide-react'
import { GlobeLive } from '@/components/ui/globe-live'

interface FeatureItem {
  id: string
  tag: string
  title: string
  copy: string
  highlights: { label: string; desc: string }[]
  visual: React.ReactNode
  reverse?: boolean
}

function FeatureBlock({ id, tag, title, copy, highlights, visual, reverse }: FeatureItem) {
  return (
    <div id={id} className="py-24 scroll-mt-16">
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-16 items-center`}>
        <div className={reverse ? 'lg:order-2' : ''}>
          <p className="text-[#2abfdc] text-sm font-semibold tracking-wide uppercase mb-3">{tag}</p>
          <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">{title}</h2>
          <p className="text-gray-600 leading-relaxed mb-6">{copy}</p>
          <ul className="space-y-4">
            {highlights.map((h) => (
              <li key={h.label} className="flex gap-3">
                <CheckCircle2 size={18} className="text-[#2abfdc] mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-gray-900 text-sm">{h.label}: </span>
                  <span className="text-gray-600 text-sm">{h.desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className={reverse ? 'lg:order-1' : ''}>
          {visual}
        </div>
      </div>
    </div>
  )
}

function BimVisual() {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl bg-[#0a1628]">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <span className="text-white/80 text-xs font-semibold">BIM 3D/4D/5D — Esgoto Sanitário</span>
        <div className="ml-auto flex gap-2">
          {['Visualizador 3D', 'Análise 4D', 'Análise 5D'].map((t, i) => (
            <span key={t} className={`text-xs px-2 py-0.5 rounded ${i === 0 ? 'bg-[#2abfdc] text-[#0a1628]' : 'text-white/40 border border-white/10'}`}>{t}</span>
          ))}
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[{l:'Trechos',v:'18'},{l:'Extensão',v:'910m'},{l:'Custo Total',v:'R$ 62k'}].map(k => (
            <div key={k.l} className="bg-white/5 rounded p-2 border border-white/10 text-center">
              <div className="text-white/40 mb-0.5">{k.l}</div>
              <div className="text-white font-bold">{k.v}</div>
            </div>
          ))}
        </div>
        <div className="relative rounded-lg bg-black flex items-center justify-center" style={{ height: 160 }}>
          <svg width="100%" height="100%" viewBox="0 0 400 160">
            {[0,1,2,3,4].map(i => (
              <line key={`h${i}`} x1={50+i*60} y1={20} x2={50+i*60} y2={140} stroke="#1f3c5e" strokeWidth="0.5" />
            ))}
            {[0,1,2,3].map(i => (
              <line key={`v${i}`} x1={50} y1={30+i*36} x2={290} y2={30+i*36} stroke="#1f3c5e" strokeWidth="0.5" />
            ))}
            <path d="M80,80 L140,60 L200,80 L260,60" stroke="#2abfdc" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M140,60 L140,100 L170,100" stroke="#2abfdc" strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d="M200,80 L200,110 L240,110" stroke="#38bdf8" strokeWidth="2" fill="none" strokeLinecap="round" />
            {[[80,80],[140,60],[200,80],[260,60]].map(([x,y],i) => (
              <circle key={i} cx={x} cy={y} r="5" fill="#2abfdc" />
            ))}
          </svg>
          <span className="absolute bottom-2 right-2 text-white/30 text-xs">Three.js Renderer</span>
        </div>
      </div>
    </div>
  )
}

function TorreVisual() {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl">
      <div className="bg-white p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-gray-900 text-sm">Torre de Controle</span>
          <span className="text-xs text-gray-500">PRJ-001 — Torre Residencial Premium ▼</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{l:'EAC Projetado',v:'R$12.4M',c:'text-blue-600'},{l:'CPI',v:'0.59',c:'text-red-500'},{l:'SPI',v:'0.39',c:'text-orange-500'}].map(k => (
            <div key={k.l} className="border border-gray-100 rounded-lg p-3">
              <div className="text-gray-400 text-xs">{k.l}</div>
              <div className={`font-bold text-lg ${k.c}`}>{k.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-gray-50 p-4">
        <div className="text-xs font-semibold text-gray-500 mb-2">STATUS DO PORTFÓLIO</div>
        <div className="space-y-2">
          {[
            { name: 'PRJ-001 Torre Residencial', status: 'Crítico', color: 'bg-red-100 text-red-700 border-red-200' },
            { name: 'PRJ-002 Galpão Industrial', status: 'Alerta', color: 'bg-orange-100 text-orange-700 border-orange-200' },
            { name: 'PRJ-004 Rede Drenagem SP', status: 'OK', color: 'bg-green-100 text-green-700 border-green-200' },
          ].map((p) => (
            <div key={p.name} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
              <span className="text-gray-700 text-xs font-medium">{p.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${p.color}`}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MapaGlobeVisual() {
  return (
    <div className="flex flex-col items-center">
      <GlobeLive className="w-full max-w-sm mx-auto" projectCount={247} />
      <p className="text-gray-400 text-xs mt-3 text-center">Arraste para explorar • São Paulo, Rio, Brasília e mais</p>
    </div>
  )
}

function SuprimentosVisual() {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl bg-white">
      <div className="px-4 py-3 border-b border-gray-100 bg-[#0a1628]">
        <span className="text-white/80 text-xs font-semibold">Suprimentos — Three-Way Match</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[{l:'PO #1047',v:'R$84k',c:'bg-blue-50 border-blue-200 text-blue-700'},{l:'GRN Recebido',v:'R$84k',c:'bg-green-50 border-green-200 text-green-700'},{l:'NF 000134',v:'R$84k',c:'bg-green-50 border-green-200 text-green-700'}].map(k => (
            <div key={k.l} className={`border rounded-lg p-2 text-center text-xs ${k.c}`}>
              <div className="font-semibold">{k.l}</div>
              <div className="text-lg font-bold mt-0.5">{k.v}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 py-2 bg-green-50 rounded-lg border border-green-200">
          <span className="text-green-600 font-bold text-sm">✓ Three-Way Match — Aprovado</span>
        </div>
        <div className="space-y-1">
          {[
            { supplier: 'Votorantim Cimentos', ontime: '98%', status: 'bg-green-500' },
            { supplier: 'TubPlast DN200', ontime: '85%', status: 'bg-yellow-500' },
            { supplier: 'Ferro & Aço Ltda', ontime: '72%', status: 'bg-red-500' },
          ].map((s) => (
            <div key={s.supplier} className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${s.status}`} />
              <span className="text-gray-600 flex-1">{s.supplier}</span>
              <span className="font-semibold text-gray-900">{s.ontime}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MaoDeObraVisual() {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl bg-white">
      <div className="px-4 py-3 border-b border-gray-100 bg-[#0a1628]">
        <span className="text-white/80 text-xs font-semibold">Mão de Obra — Alocação Diária</span>
      </div>
      <div className="p-4 space-y-3">
        {[
          { name: 'Carlos M.', role: 'Encanador', cert: 'NR-10 ✓', team: 'Equipe A', hours: '8h normal', color: 'bg-green-100' },
          { name: 'João S.', role: 'Operador', cert: 'NR-35 ✓', team: 'Equipe A', hours: '8h normal', color: 'bg-green-100' },
          { name: 'Ana R.', role: 'Auxiliar', cert: 'ASO ⚠ venc.', team: 'Equipe B', hours: '—', color: 'bg-red-100' },
        ].map((w) => (
          <div key={w.name} className={`flex items-center gap-3 p-3 rounded-lg border border-gray-100 ${w.color}`}>
            <div className="w-8 h-8 rounded-full bg-[#0a1628] flex items-center justify-center text-white text-xs font-bold">
              {w.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-900 text-xs font-semibold">{w.name} — {w.role}</div>
              <div className="text-gray-500 text-xs">{w.cert} · {w.team}</div>
            </div>
            <span className="text-xs text-gray-600 font-medium">{w.hours}</span>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-[#0a1628] text-white rounded-lg p-2 text-center">
            <div className="font-bold text-lg">24</div>
            <div className="text-white/60">Colaboradores</div>
          </div>
          <div className="bg-[#2abfdc]/10 border border-[#2abfdc]/20 rounded-lg p-2 text-center">
            <div className="font-bold text-lg text-[#2abfdc]">192h</div>
            <div className="text-gray-500">Horas Hoje</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RdoVisual() {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl bg-white">
      <div className="px-4 py-3 border-b border-gray-100 bg-[#0a1628]">
        <span className="text-white/80 text-xs font-semibold">RDO — 27/03/2026 · OBR-001</span>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[{l:'Clima',v:'☀️ Ensolarado'},{l:'Equipes',v:'4 ativas'},{l:'Responsável',v:'Eng. Carlos'}].map(k => (
            <div key={k.l} className="bg-gray-50 rounded-lg p-2 border border-gray-100 text-center">
              <div className="text-gray-400 text-xs">{k.l}</div>
              <div className="font-semibold text-gray-800 text-xs mt-0.5">{k.v}</div>
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div className="text-xs font-semibold text-gray-500 uppercase">Atividades do Dia</div>
          {[
            { code: 'T01', desc: 'Escavação Av. Principal', qty: '42m', progress: 65 },
            { code: 'T02', desc: 'Assentamento DN200', qty: '28m', progress: 45 },
          ].map((a) => (
            <div key={a.code} className="p-2 rounded border border-gray-100">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-gray-700">{a.code} — {a.desc}</span>
                <span className="text-[#2abfdc] font-bold">{a.qty}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#2abfdc] rounded-full" style={{ width: `${a.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200">
          <span className="text-blue-600 text-xs">🤖 IA: Progresso 2h à frente do planejado. Sugestão: manter ritmo para compensar atraso de amanhã.</span>
        </div>
      </div>
    </div>
  )
}

function AiVisual() {
  const messages = [
    { role: 'system', text: 'Analisando dados de RDO, BIM e Suprimentos...', time: '09:14' },
    { role: 'alert', text: '⚠ Detectado atraso de 15% na armação do T07. Sugestão: Realocar equipe de hidráulica para suporte imediato e ajustar pedido de concreto para evitar sobrecarga no próximo turno.', time: '09:14' },
    { role: 'user', text: 'Qual o impacto no prazo final?', time: '09:15' },
    { role: 'assistant', text: 'Com a realocação sugerida, o impacto é de +2 dias. Sem intervenção: +8 dias e R$ 24.000 em multa contratual.', time: '09:15' },
  ]
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl bg-[#0a1628]">
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#2abfdc] animate-pulse" />
        <span className="text-white/80 text-xs font-semibold">Atlântico AI — Copiloto de Obra</span>
      </div>
      <div className="p-4 space-y-3 min-h-[200px]">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
              m.role === 'user' ? 'bg-[#2abfdc] text-[#0a1628] font-medium' :
              m.role === 'alert' ? 'bg-amber-900/40 border border-amber-700/50 text-amber-200' :
              m.role === 'system' ? 'bg-white/5 text-white/40 italic' :
              'bg-white/10 text-white/80'
            }`}>
              {m.text}
              <div className="text-right mt-1 opacity-50">{m.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const FEATURES: FeatureItem[] = [
  {
    id: 'bim',
    tag: 'BIM 3D / 4D / 5D',
    title: 'BIM 3D/4D/5D: Visualize, Simule, Otimize.',
    copy: 'Transforme a gestão do ciclo de vida do projeto com o BIM integrado da Atlântico. Vá além da visualização 3D: simule o cronograma (4D) e analise custos em tempo real (5D) diretamente no modelo. Uma ferramenta poderosa que democratiza o BIM, tornando-o acessível a todos os stakeholders.',
    highlights: [
      { label: 'Simulação 4D Dinâmica', desc: 'Teste cenários de cronograma e veja a obra evoluir virtualmente antes da execução física.' },
      { label: 'Heatmap 5D de Custos', desc: 'Identifique e mitigue gargalos financeiros visualmente no modelo 3D.' },
      { label: 'Acessibilidade Universal', desc: 'BIM na web, sem softwares pesados, para engenheiros e clientes.' },
    ],
    visual: <BimVisual />,
    reverse: false,
  },
  {
    id: 'torre',
    tag: 'Torre de Controle',
    title: 'Torre de Controle: Visão Estratégica, Decisão Instantânea.',
    copy: 'Elimine a dependência de relatórios estáticos. A Torre de Controle da Atlântico oferece uma visão de "War Room" para gerenciar seu portfólio de projetos com inteligência executiva. Monitore múltiplos projetos simultaneamente, identifique riscos e tome decisões proativas com base em dados em tempo real.',
    highlights: [
      { label: 'KPIs em Tempo Real', desc: 'Curva-S, CPI, SPI e alertas críticos atualizados instantaneamente.' },
      { label: 'Matriz de Risco RAG', desc: 'Identifique projetos em alerta (Vermelho/Amarelo/Verde) num relance.' },
      { label: 'Feed de Alertas Inteligente', desc: 'Incidentes climáticos, atrasos e estouros de orçamento priorizados por IA.' },
    ],
    visual: <TorreVisual />,
    reverse: true,
  },
  {
    id: 'mapa',
    tag: 'Mapa Interativo',
    title: 'Mapa Interativo: Projetando e Gerenciando Redes com Precisão.',
    copy: 'Revolucione o planejamento e a execução de projetos de infraestrutura. O Mapa Interativo da Atlântico permite importar dados topográficos (UTM) e visualizar redes de esgoto, água e drenagem com análises automáticas de elevação, custo e cronograma. Uma ferramenta GIS poderosa, acessível e integrada.',
    highlights: [
      { label: 'Importação UTM Inteligente', desc: 'Converta dados de campo em redes digitais em segundos, com auto-detecção de coordenadas.' },
      { label: 'Perfil de Elevação 3D', desc: 'Gere gráficos automáticos de declividade e profundidade ao longo das redes.' },
      { label: 'Análise de Custo por Trecho', desc: 'Obtenha estimativas financeiras precisas baseadas na extensão real do mapa.' },
    ],
    visual: <MapaGlobeVisual />,
    reverse: false,
  },
  {
    id: 'suprimentos',
    tag: 'Suprimentos',
    title: 'Suprimentos Inteligentes: Automação e Conformidade.',
    copy: 'Simplifique e automatize todo o ciclo de suprimentos com a Atlântico. Nossa funcionalidade de Three-Way Match valida automaticamente Pedidos de Compra, Recebimentos e Notas Fiscais, eliminando erros manuais e garantindo conformidade. Preveja necessidades, otimize estoques e gerencie fornecedores com inteligência.',
    highlights: [
      { label: 'Three-Way Match Automatizado', desc: 'Validação instantânea PO × GRN × NF, com detecção de discrepâncias por IA.' },
      { label: 'Previsão de Necessidades', desc: 'Modelagem dinâmica de estoque e recomendações de compra inteligentes.' },
      { label: 'Scorecard de Fornecedores', desc: 'Avalie a performance de entrega e qualidade de cada parceiro para decisões estratégicas.' },
    ],
    visual: <SuprimentosVisual />,
    reverse: true,
  },
  {
    id: 'mao-de-obra',
    tag: 'Mão de Obra',
    title: 'Mão de Obra: Otimização e Segurança no Canteiro.',
    copy: 'A gestão de equipes é um dos maiores desafios da construção. A Atlântico empodera sua força de trabalho com ferramentas digitais que vão do registro à alocação diária, garantindo conformidade, otimizando a produtividade e elevando a segurança.',
    highlights: [
      { label: 'Registro Completo de Colaboradores', desc: 'Perfis detalhados, certificações e alertas de vencimento (NR-10, NR-35, ASO).' },
      { label: 'Alocação Diária Inteligente', desc: 'Atribua equipes e recursos a projetos e atividades com base na demanda e disponibilidade.' },
      { label: 'Digitalização de Processos', desc: 'Reduza a burocracia e melhore a comunicação entre campo e escritório.' },
    ],
    visual: <MaoDeObraVisual />,
    reverse: false,
  },
  {
    id: 'rdo',
    tag: 'RDO Inteligente',
    title: 'RDO Inteligente: Dados do Campo, Decisões no Escritório.',
    copy: 'O Relatório Diário de Obra da Atlântico transcende o registro manual. Ele é a fonte primária de dados para nossa ontologia, alimentando análises preditivas e garantindo que cada informação do canteiro se traduza em inteligência acionável para a gestão.',
    highlights: [
      { label: 'Coleta de Dados Estruturada', desc: 'Registre atividades, equipes, equipamentos, materiais e ocorrências de forma padronizada.' },
      { label: 'Integração com IA', desc: 'Dados do RDO alimentam o Copiloto de Obra para sugestões e alertas preditivos.' },
      { label: 'Evidências Fotográficas Inteligentes', desc: 'Análise de fotos com IA para validação de progresso e conformidade.' },
    ],
    visual: <RdoVisual />,
    reverse: true,
  },
  {
    id: 'ai',
    tag: 'Atlântico AI',
    title: 'Atlântico AI: A IA que Antecipa o Futuro da Sua Obra.',
    copy: 'A Atlântico não apenas registra o que aconteceu; ela prevê o que vai acontecer. Nosso motor de Inteligência Artificial (AIP) analisa dados em tempo real do RDO, BIM e ERP para identificar riscos, otimizar recursos e sugerir mitigações antes que o problema escale. Deixe a IA trabalhar para você, transformando dados em decisões estratégicas.',
    highlights: [
      { label: 'Detecção Preditiva de Riscos', desc: 'Identifica padrões de atraso e desvio orçamentário antes que se tornem problemas críticos.' },
      { label: 'Sugestões de Mitigação', desc: 'Recomenda realocação de recursos e ajustes de cronograma com base em dados históricos.' },
      { label: 'Integração Total', desc: 'Conectado ao RDO, BIM, Suprimentos e Mão de Obra para uma visão 360° do projeto.' },
    ],
    visual: <AiVisual />,
    reverse: false,
  },
]

export function FeatureDeepSection() {
  return (
    <section id="funcionalidades" className="bg-white">
      {FEATURES.map((feature, i) => (
        <div key={feature.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
          <FeatureBlock {...feature} />
        </div>
      ))}
    </section>
  )
}
