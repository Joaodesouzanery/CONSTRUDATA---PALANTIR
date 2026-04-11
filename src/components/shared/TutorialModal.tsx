/**
 * TutorialPanel — Guia completo da plataforma com fluxogramas interativos.
 * Renderizado inline dentro de Minha Rotina (não como modal).
 * Cada módulo pode ser clicado para ver o fluxograma detalhado (diagrama + steps).
 */
import { useState, useMemo } from 'react'
import { Search, ChevronRight, ArrowLeft, ArrowDown } from 'lucide-react'
import { MODULE_REGISTRY } from '@/features/minha-rotina/moduleRegistry'
import { MODULE_FLOWS, type ModuleFlow, type FlowStep } from '@/data/moduleFlowcharts'
import { cn } from '@/lib/utils'

// Extended descriptions for tutorial
const TUTORIAL_CONTENT: Record<string, string> = {
  '/app/gestao-360': 'Dashboard executivo com visão financeira unificada. CPI/SPI, curva S, alertas integrados.',
  '/app/relatorio360': 'Relatório diário com kanban, equipes, equipamentos, fotos. Exporta PDF por período.',
  '/app/torre-de-controle': 'War room digital: drill-down do portfólio à atividade. Alertas críticos em tempo real.',
  '/app/medicao': 'Medições contratuais: planilha Sabesp, subempreiteiros, conferência automática, PDF.',
  '/app/planejamento-mestre': 'WBS, marcos contratuais, baselines. Espinha dorsal do cronograma.',
  '/app/planejamento': 'Gantt interativo, CPM, simulação de atrasos, curva ABC. Planejamento detalhado de trechos.',
  '/app/agenda': 'Calendário operacional unificado. Detecção de conflitos e visualização dia/semana/mês.',
  '/app/lps-lean': 'Last Planner System: look-ahead 6 semanas, PPC semanal, Constraint Register, Pareto de causas.',
  '/app/evm': 'Earned Value Management: EAC, ETC, VAC, TCPI. Gráficos de tendência e projeções.',
  '/app/rdo': 'Relatório Diário de Obra digital: clima, equipes, trechos, fotos, ocorrências. PDF automático.',
  '/app/qualidade': 'FVS digital: checklist de conformidade, fotos, tratamento de NCs com rastreabilidade.',
  '/app/mao-de-obra': 'Cadastro, alocação por frente, certificações, produtividade por equipe.',
  '/app/gestao-equipamentos': 'Frota fixa: cadastro, manutenção preventiva/corretiva, utilização, custo/hora.',
  '/app/otimizacao-frota': 'Veículos: combustível, motoristas, roteirização, custos por km.',
  '/app/projetos': 'Cadastro mestre: fases, orçamento, execução, BIM 3D/4D/5D, documentos.',
  '/app/bim': 'Visualizador BIM: 3D navegável, timeline 4D, heatmap de custos 5D.',
  '/app/pre-construcao': 'Due diligence, viabilidade técnica, geotécnica, matriz de riscos.',
  '/app/mapa-interativo': 'GIS de redes: importação UTM, status por trecho, filtros por tipo/status.',
  '/app/quantitativos': 'Orçamento com base SINAPI/SEINFRA. BDI, composições, exportação Excel.',
  '/app/suprimentos': 'Three-Way Match (PO×GRN×NF), estoque, previsão de demanda, planilhas consolidadas.',
  '/app/rede-360': 'COP para redes de distribuição. Dashboard de progresso por núcleo/frente.',
}

const GROUP_LABELS: Record<string, string> = {
  gestao: 'Gestão', planejamento: 'Planejamento', campo: 'Campo',
  projetos: 'Projetos', analytics: 'Analytics',
}
const GROUP_ORDER = ['gestao', 'planejamento', 'campo', 'projetos', 'analytics']

// ─── Flow Diagram (visual) ──────────────────────────────────────────────────

function FlowDiagram({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-6">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#3d3d3d] border border-[#525252] min-w-[120px]">
            <span className="w-6 h-6 rounded-full bg-[#f97316] text-white text-xs font-bold flex items-center justify-center shrink-0">
              {step.icon || String(i + 1)}
            </span>
            <span className="text-xs font-medium text-[#f5f5f5] whitespace-nowrap">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <ArrowDown size={16} className="text-[#f97316] rotate-[-90deg] shrink-0 hidden sm:block" />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step Detail Card ───────────────────────────────────────────────────────

function StepCard({ step, index }: { step: FlowStep; index: number }) {
  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-5 hover:border-[#f97316]/30 transition-colors">
      <div className="flex items-start gap-4">
        <span className="w-8 h-8 rounded-full bg-[#f97316] text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
          {step.icon || String(index + 1)}
        </span>
        <div className="flex-1 min-w-0">
          <h4 className="text-[#f5f5f5] font-semibold text-sm mb-1">{step.label}</h4>
          <p className="text-[#a3a3a3] text-xs mb-3">{step.description}</p>
          <ul className="space-y-1.5">
            {step.details.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#e5e5e5]">
                <ChevronRight size={10} className="text-[#f97316] mt-0.5 shrink-0" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── Module Flow Detail View ────────────────────────────────────────────────

function FlowDetailView({ flow, onBack }: { flow: ModuleFlow; onBack: () => void }) {
  const mod = MODULE_REGISTRY.find(m => m.path === flow.path)
  const Icon = mod?.icon

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Back + Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#a3a3a3] hover:text-[#f97316] text-xs font-medium transition-colors"
      >
        <ArrowLeft size={14} /> Voltar ao Tutorial
      </button>

      <div className="flex items-center gap-4">
        {Icon && (
          <div className="w-12 h-12 rounded-xl bg-[#f97316]/10 flex items-center justify-center shrink-0">
            <Icon size={24} className="text-[#f97316]" />
          </div>
        )}
        <div>
          <h2 className="text-white text-xl font-bold">{flow.moduleName}</h2>
          <p className="text-[#a3a3a3] text-sm mt-0.5">{flow.summary}</p>
        </div>
      </div>

      {/* Flow Diagram */}
      <div className="border border-[#525252] rounded-xl bg-[#1f1f1f] overflow-x-auto">
        <div className="px-4 py-2 border-b border-[#525252]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#f97316]">Fluxo do Módulo</span>
        </div>
        <FlowDiagram steps={flow.steps} />
      </div>

      {/* Step-by-step details */}
      <div>
        <h3 className="text-[#f5f5f5] font-semibold text-sm mb-4">Passo a Passo Detalhado</h3>
        <div className="space-y-3">
          {flow.steps.map((step, i) => (
            <StepCard key={step.id} step={step} index={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main TutorialPanel ─────────────────────────────────────────────────────

export function TutorialPanel() {
  const [search, setSearch] = useState('')
  const [selectedFlow, setSelectedFlow] = useState<ModuleFlow | null>(null)

  const grouped = useMemo(() => {
    const q = search.toLowerCase().trim()
    return GROUP_ORDER.map((g) => ({
      key: g,
      label: GROUP_LABELS[g] || g,
      modules: MODULE_REGISTRY.filter((m) => {
        if (m.group !== g) return false
        if (!q) return true
        const content = (TUTORIAL_CONTENT[m.path] || m.description).toLowerCase()
        return m.label.toLowerCase().includes(q) || content.includes(q)
      }),
    })).filter((g) => g.modules.length > 0)
  }, [search])

  // If a flow is selected, show detail view
  if (selectedFlow) {
    return <FlowDetailView flow={selectedFlow} onBack={() => setSelectedFlow(null)} />
  }

  const totalModules = grouped.reduce((s, g) => s + g.modules.length, 0)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header + search */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-white text-lg font-bold">Guia da Plataforma</h2>
          <p className="text-[#a3a3a3] text-sm mt-0.5">
            Clique em qualquer módulo para ver o fluxograma completo de como funciona
          </p>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar módulo..."
            className="pl-9 pr-4 py-2 rounded-lg text-sm bg-[#2c2c2c] border border-[#525252] text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316] w-64"
          />
        </div>
      </div>

      <p className="text-[#6b6b6b] text-xs">
        {totalModules} {totalModules === 1 ? 'módulo' : 'módulos'} {search ? 'encontrados' : 'disponíveis'}
      </p>

      {/* Module groups */}
      {grouped.map(({ key, label, modules }) => (
        <section key={key}>
          <h3 className="text-[#f97316] font-bold text-sm uppercase tracking-widest mb-3">{label}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {modules.map((mod) => {
              const hasFlow = MODULE_FLOWS.some(f => f.path === mod.path)
              const flow = MODULE_FLOWS.find(f => f.path === mod.path)
              return (
                <button
                  key={mod.path}
                  onClick={() => flow && setSelectedFlow(flow)}
                  className={cn(
                    'bg-[#2c2c2c] border border-[#525252] rounded-xl p-4 text-left transition-colors group',
                    hasFlow ? 'hover:border-[#f97316]/50 cursor-pointer' : 'opacity-70',
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#f97316]/10 flex items-center justify-center shrink-0">
                      <mod.icon size={16} className="text-[#f97316]" />
                    </div>
                    <h4 className="text-[#f5f5f5] font-semibold text-sm flex-1">{mod.label}</h4>
                    {hasFlow && (
                      <ChevronRight size={14} className="text-[#6b6b6b] group-hover:text-[#f97316] transition-colors shrink-0" />
                    )}
                  </div>
                  <p className="text-[#a3a3a3] text-xs leading-relaxed">
                    {TUTORIAL_CONTENT[mod.path] || mod.description}
                  </p>
                  {hasFlow && (
                    <div className="mt-2 text-[10px] text-[#f97316] font-medium">
                      {flow!.steps.length} passos no fluxograma
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      ))}

      {grouped.length === 0 && (
        <div className="text-center py-12 text-[#6b6b6b] text-sm">
          Nenhum módulo encontrado para "{search}"
        </div>
      )}
    </div>
  )
}
