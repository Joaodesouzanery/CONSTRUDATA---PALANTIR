import { useState } from 'react'
import {
  BarChart3, Calendar, Truck, Building2, Monitor, Map, HardHat,
  Package, Users, ListChecks, ClipboardList, FileText, Calculator,
  Box, Car, Layers3, Target, TrendingUp, ShieldCheck, Wrench, BrainCircuit,
  Ruler, type LucideIcon,
} from 'lucide-react'

// ─── Module data with categories ────────────────────────────────────────────

interface ModuleData {
  icon: LucideIcon
  label: string
  desc: string
  details: string
  category: string
}

const CATEGORIES = [
  { key: 'gestao',       label: 'Gestão & Decisão' },
  { key: 'planejamento', label: 'Planejamento' },
  { key: 'campo',        label: 'Campo & Execução' },
  { key: 'projetos',     label: 'Projetos & BIM' },
  { key: 'suprimentos',  label: 'Suprimentos' },
  { key: 'analytics',    label: 'Analytics' },
]

const MODULOS: ModuleData[] = [
  // Gestão & Decisão
  { icon: Layers3,       label: 'Gestão 360',         category: 'gestao',
    desc: 'Dashboard executivo com CPI/SPI, curva S e alertas integrados.',
    details: 'Visão financeira unificada de todos os projetos. Indicadores de desempenho (CPI/SPI) calculados em tempo real a partir de RDO, Planejamento e Suprimentos. Curva S de progresso, alertas integrados de todos os módulos, e drill-down por projeto.' },
  { icon: BarChart3,     label: 'Relatório 360',      category: 'gestao',
    desc: 'Relatório diário com kanban, equipes, equipamentos e fotos.',
    details: 'Kanban de atividades (Planejado → Concluído), apontamento de equipes com horas e custos, log de equipamentos, consumo de materiais, e galeria de fotos. Exporta PDF customizável: selecione período e áreas desejadas. De 8 horas de compilação para 30 segundos.' },
  { icon: Monitor,       label: 'Torre de Controle',   category: 'gestao',
    desc: 'War room digital com drill-down do portfólio à atividade.',
    details: 'Visão multiportfólio em uma tela: status RAG (Red/Amber/Green) por obra. Clique para drill-down: portfólio → projeto → frente → atividade. Feed de alertas em tempo real, matriz de risco, e KPIs executivos (CPI, SPI, EAC). Ideal para gestão por exceção — foque no que precisa de atenção.' },
  { icon: Ruler,         label: 'Medição',             category: 'gestao',
    desc: 'Medição contratual em 6 passos com conferência automática.',
    details: 'Stepper de 6 etapas: Planilha Sabesp → Critérios → Subempreiteiros → Fornecedores → Conferência Automática → PDF Final. Auto-lookup de itens por nPreço, cruzamento automático de quantidades, identificação de divergências. Histórico completo de boletins para auditoria.' },

  // Planejamento
  { icon: BrainCircuit,  label: 'Plan. Mestre',        category: 'planejamento',
    desc: 'WBS, marcos contratuais, baselines e 3 horizontes de planejamento.',
    details: 'Estrutura macro do projeto em 3 horizontes: Longo Prazo (Gantt WBS com caminho crítico), Médio Prazo (look-ahead 6 semanas por tipo de rede), Curto Prazo (quadro de 15 dias com PPC). Crie do zero com wizard ou importe planilha. Template padronizado disponível. Salve baselines para comparar versões.' },
  { icon: ListChecks,    label: 'Plan. Trechos',       category: 'planejamento',
    desc: 'Gantt interativo com CPM, curva S, curva ABC e simulação.',
    details: 'Planejamento detalhado por trecho: importe Excel com código, extensão, diâmetro. O sistema calcula o caminho crítico (CPM), gera Gantt visual, e permite simular atrasos arrastando barras. Curva S (previsto vs real), Curva ABC (priorização 20/80), Histograma de recursos.' },
  { icon: Calendar,      label: 'Agenda',              category: 'planejamento',
    desc: 'Calendário operacional com detecção automática de conflitos.',
    details: 'Consolida eventos de todos os módulos em um calendário (dia/semana/mês). Detecta conflitos automaticamente: mesma equipe alocada em dois lugares, equipamento com manutenção agendada. Exporta iCal para Google Calendar/Outlook.' },
  { icon: Target,        label: 'LPS / Lean',          category: 'planejamento',
    desc: 'Last Planner System: PPC, look-ahead, restrições, Pareto de causas.',
    details: 'Lean Construction nativo: Semáforo de atividades (pronto/risco/bloqueado), Look-ahead de 4-6 semanas, Plano semanal com compromisso da equipe, PPC automático com tendência de 8 semanas, Pareto de causas de não-cumprimento (CNC). Case real: PPC de 38% para 72% em 4 meses.' },
  { icon: TrendingUp,    label: 'Financeiro / EVM',    category: 'planejamento',
    desc: 'Earned Value Management: CPI, SPI, EAC, ETC, TCPI.',
    details: 'Gestão de Valor Agregado completa: CPI (Cost Performance Index), SPI (Schedule Performance Index), EAC (Estimate at Completion), ETC (Estimate to Complete), VAC (Variance at Completion), TCPI (To-Complete Performance Index). Gráficos de tendência e projeções financeiras calculados em tempo real.' },

  // Campo & Execução
  { icon: FileText,      label: 'RDO',                 category: 'campo',
    desc: 'Relatório Diário de Obra digital com fotos e integração IA.',
    details: 'Substitui o RDO em papel: clima, equipes em campo (horas e funções), trechos executados (metros, material), equipamentos utilizados, fotos geolocalizadas, e ocorrências. Gera PDF automaticamente. Integra com Qualidade (FVS) e Planejamento. Reduz tempo de fechamento de 72h para menos de 2h.' },
  { icon: ShieldCheck,   label: 'Qualidade (FVS)',     category: 'campo',
    desc: 'Ficha de Verificação de Serviço com tratamento de NCs.',
    details: 'Checklist digital de conformidade por serviço/trecho: para cada item, marque Conforme ou Não Conforme com foto como evidência. NCs geram automaticamente registro com ação corretiva, responsável e prazo. NC aberta bloqueia fechamento do RDO. Rastreabilidade completa da inspeção à correção.' },
  { icon: Users,         label: 'Mão de Obra',         category: 'campo',
    desc: 'Cadastro, alocação diária, certificações e produtividade.',
    details: 'Cadastro de funcionários com CPF, função, equipe, certificações (com validade). Alocação diária por frente de obra com dashboard visual. Alertas de NR (certificações vencidas). Dashboard de produtividade: m/equipe/dia, custo por hora. Importação em massa via Excel.' },
  { icon: Wrench,        label: 'Gest. Equipamentos',  category: 'campo',
    desc: 'Frota fixa: manutenção preventiva, utilização e custos.',
    details: 'Cadastro de equipamentos fixos (escavadeiras, compressores, geradores). Manutenção preventiva com alertas de vencimento. Taxa de utilização por hora com custo operacional. Histórico de manutenções corretivas. Dashboard de disponibilidade por período.' },
  { icon: Car,           label: 'Frota Veicular',      category: 'campo',
    desc: 'Veículos: combustível, motoristas e roteirização.',
    details: 'Gestão de frota (própria e alugada): cadastro de veículos, controle de abastecimentos e consumo, motoristas habilitados, planejamento de rotas. Dashboard de custos por km, alertas de manutenção, e análise de eficiência de consumo.' },

  // Projetos & BIM
  { icon: Building2,     label: 'Projetos',            category: 'projetos',
    desc: 'Cadastro mestre com fases, orçamento, execução e documentos.',
    details: 'Ponto central que conecta todos os módulos: crie projetos com código, nome, gerente. 6 abas: Visão Geral (KPIs), Planejamento (fases e marcos), Execução (progresso), Orçamento (linhas de custo vs realizado), BIM 3D/4D/5D, Documentos (repositório centralizado com versionamento).' },
  { icon: Box,           label: 'BIM 3D/4D/5D',       category: 'projetos',
    desc: 'Visualizador 3D com timeline 4D e heatmap de custos 5D.',
    details: 'Modelo 3D navegável (importa DXF/IFC): rotacione, aproxime, selecione elementos. 4D: sobreponha o cronograma ao modelo — veja a obra sendo construída no tempo. 5D: heatmap de custos por elemento (verde = no orçamento, vermelho = estouro). Tudo no navegador, sem software instalado.' },
  { icon: HardHat,       label: 'Pré-Construção',      category: 'projetos',
    desc: 'Due diligence, viabilidade técnica e matriz de riscos.',
    details: 'Checklist completo de pré-construção: viabilidade técnica, análise geotécnica, estudo de interferências, licenças necessárias, e matriz de riscos. Documenta todas as premissas antes do início da obra. Relatórios exportáveis para apresentação a stakeholders.' },
  { icon: Map,           label: 'Mapa Interativo',     category: 'projetos',
    desc: 'GIS de redes: importação UTM, status por trecho.',
    details: 'Mapa Leaflet com redes de infraestrutura (água, esgoto, drenagem). Importa coordenadas UTM de planilhas Excel. Visualiza status por trecho (executado/pendente) com cores. Filtros por tipo de rede e status. Perfil de elevação 3D e análise de custo por segmento.' },

  // Suprimentos
  { icon: Package,       label: 'Suprimentos',         category: 'suprimentos',
    desc: 'Three-Way Match automático: PO × Recebimento × NF.',
    details: 'Gestão completa da cadeia: Previsão de Demanda → Requisições → OC → Recebimento → NF → Conciliação automática (3-Way Match). Exceções sinalizadas com R$ de variância. Mapa de estoque por depósito, semáforo de prontidão, e simulação what-if logística. Importação de planilhas consolidadas.' },

  // Analytics
  { icon: Calculator,    label: 'Quantitativos',       category: 'analytics',
    desc: 'Orçamento com base SINAPI/SEINFRA, BDI e exportação.',
    details: 'Composição de orçamento baseada em tabelas oficiais SINAPI (federal) e SEINFRA (estadual). Wizard para criar do zero: busque por código ou descrição, informe quantidades, defina BDI. O sistema calcula custos automaticamente. Exporta Excel com fórmulas e CSV. Reduz tempo de orçamentação de 40-80h para 8-16h.' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function ModulosOverviewSection() {
  const [activeCategory, setActiveCategory] = useState('gestao')
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  const filtered = MODULOS.filter((m) => m.category === activeCategory)

  return (
    <section id="modulos" style={{ background: '#2c2c2c', borderTop: '1px solid rgba(255,255,255,0.10)' }} className="py-16 sm:py-24 lg:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-10 sm:mb-16">
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.15em' }} className="text-white/60 text-xs uppercase font-mono">02 / Módulos</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.10)' }} />
        </div>

        <div className="grid lg:grid-cols-2 gap-x-10 lg:gap-x-20 gap-y-4 mb-10 sm:mb-16">
          <div>
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                lineHeight: 1.15,
                letterSpacing: '-0.01em',
              }}
              className="text-white mb-4"
            >
              {MODULOS.length} Módulos, Uma Plataforma
            </h2>
          </div>
          <div>
            <p className="text-white/75 text-sm leading-relaxed">
              Clique em uma categoria para explorar os módulos. Cada módulo é uma peça da inteligência operacional — todos conectados pela mesma ontologia de dados.
            </p>
          </div>
        </div>

        {/* Category tabs — Palantir AIP style */}
        <div className="flex flex-wrap gap-2 mb-10">
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setActiveCategory(key); setExpandedModule(null) }}
              className="transition-all text-sm font-medium px-4 py-2 rounded-full border"
              style={{
                borderColor: activeCategory === key ? '#f97316' : 'rgba(255,255,255,0.15)',
                background: activeCategory === key ? 'rgba(249,115,22,0.10)' : 'transparent',
                color: activeCategory === key ? '#f97316' : 'rgba(255,255,255,0.65)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Modules for selected category */}
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((mod) => {
            const isExpanded = expandedModule === mod.label
            const Icon = mod.icon
            return (
              <button
                key={mod.label}
                onClick={() => setExpandedModule(isExpanded ? null : mod.label)}
                className="text-left p-6 transition-all group"
                style={{
                  background: isExpanded ? 'rgba(249,115,22,0.05)' : '#333333',
                  border: `1px solid ${isExpanded ? 'rgba(249,115,22,0.30)' : 'rgba(255,255,255,0.10)'}`,
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      background: isExpanded ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <Icon size={18} className={isExpanded ? 'text-[#f97316]' : 'text-white/60 group-hover:text-[#f97316]'} style={{ transition: 'color 0.2s' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                      className="text-white font-semibold text-sm mb-1 group-hover:text-white transition-colors"
                    >
                      {mod.label}
                    </div>
                    <div className="text-white/65 text-xs leading-relaxed">{mod.desc}</div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(249,115,22,0.15)' }}>
                        <p className="text-white/80 text-xs leading-relaxed">{mod.details}</p>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <a
            href="https://calendly.com/joaodsouzanery/demonstracao-construdata"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-lg text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: '#f97316' }}
          >
            Agendar Demonstração dos Módulos
          </a>
          <p className="text-white/40 text-xs mt-2">20 minutos. Sem compromisso.</p>
        </div>
      </div>
    </section>
  )
}
