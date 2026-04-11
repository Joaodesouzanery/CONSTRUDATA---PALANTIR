/**
 * TutorialModal — Guia completo da plataforma, acessível via menu Suporte.
 * Explica todos os módulos e funcionalidades como referência para o usuário.
 */
import { X } from 'lucide-react'
import { MODULE_REGISTRY } from '@/features/minha-rotina/moduleRegistry'
import { cn } from '@/lib/utils'

// Extended descriptions for tutorial (richer than moduleRegistry.description)
const TUTORIAL_CONTENT: Record<string, string> = {
  '/app/gestao-360':
    'Dashboard executivo com visão financeira unificada. Mostra indicadores CPI (Cost Performance Index) e SPI (Schedule Performance Index), curva S de progresso, e alertas integrados de todos os módulos. Ideal para diretores e gerentes acompanharem a saúde geral do projeto.',
  '/app/relatorio360':
    'Relatórios operacionais com KPIs detalhados, curva S comparativa (previsto × realizado), e matriz RAG (Red/Amber/Green) por projeto. Permite exportar relatórios em PDF para apresentações e reuniões de acompanhamento.',
  '/app/torre-de-controle':
    'War room digital com visão drill-down: do portfólio de obras até a atividade individual. Mostra status em tempo real de cada frente de obra, alertas críticos, e permite gestão por exceção — foque apenas no que precisa de atenção.',
  '/app/medicao':
    'Gestão completa de medições contratuais. Importa planilhas XLSX de medição, calcula quantitativos por período, gera histórico de medições, e exporta boletins em PDF. Suporta múltiplos contratos e períodos simultâneos.',
  '/app/planejamento-mestre':
    'Estrutura macro do projeto: WBS (Work Breakdown Structure), marcos contratuais, e baselines. Define a espinha dorsal do cronograma que alimenta o planejamento detalhado de trechos. Suporta importação de cronogramas existentes.',
  '/app/planejamento':
    'Planejamento detalhado de trechos com Gantt interativo, cálculo de caminho crítico (CPM), simulação de atrasos, e curva ABC de produtividade. Cada trecho tem extensão, diâmetro, material e dependências.',
  '/app/agenda':
    'Calendário operacional unificado que consolida eventos de todos os módulos. Detecta conflitos de agenda (ex.: mesma equipe alocada em dois lugares), e permite visualização por dia, semana ou mês.',
  '/app/lps-lean':
    'Implementação do Last Planner System (LPS): look-ahead de 6 semanas, planejamento semanal com PPC (Percent Plan Complete), e Constraint Register para gestão de restrições. Metodologia Lean Construction integrada.',
  '/app/evm':
    'Earned Value Management completo: calcula EAC (Estimate at Completion), ETC (Estimate to Complete), VAC (Variance at Completion), e TCPI (To-Complete Performance Index). Gráficos de tendência e projeções financeiras.',
  '/app/rdo':
    'Relatório Diário de Obra digital: registra clima, equipes em campo, equipamentos, trechos executados, fotos geolocalizadas, e ocorrências. Gera PDF automaticamente para arquivo. Integra com Qualidade (FVS) e Planejamento.',
  '/app/qualidade':
    'Ficha de Verificação de Serviço (FVS) digital com checklist de conformidade, registro fotográfico, e tratamento de Não Conformidades (NCs). Rastreabilidade completa desde a inspeção até a correção.',
  '/app/mao-de-obra':
    'Cadastro de funcionários e equipes, alocação por frente de obra, controle de certificações e treinamentos, e folha de ponto/pagamento. Dashboard de produtividade por equipe e por período.',
  '/app/gestao-equipamentos':
    'Gestão de frota fixa (escavadeiras, compressores, geradores): cadastro, manutenção preventiva/corretiva, taxas de utilização, e custo operacional por hora. Alertas de manutenção vencida.',
  '/app/otimizacao-frota':
    'Gestão de veículos: cadastro da frota, controle de combustível (abastecimentos e consumo), motoristas habilitados, e roteirização. Dashboard de custos por km e análise de eficiência.',
  '/app/projetos':
    'Cadastro mestre de projetos com escopo, contratos, equipes responsáveis, e documentação. Cada projeto pode ter múltiplos contratos, marcos, e equipes. Ponto central que conecta todos os outros módulos.',
  '/app/bim':
    'Visualização BIM: modelo 3D com navegação interativa, timeline 4D (cronograma sobre o modelo), e heatmap de custo 5D. Importa arquivos DXF/IFC. Permite associar elementos do modelo a itens do orçamento.',
  '/app/pre-construcao':
    'Due diligence e viabilidade técnica para novos projetos. Análise geotécnica, checklist de pré-requisitos, estudo de interferências, e matriz de riscos. Documenta todas as premissas antes do início da obra.',
  '/app/mapa-interativo':
    'GIS de redes de infraestrutura (água, esgoto, drenagem) sobre mapa Leaflet. Importa coordenadas UTM de planilhas, visualiza status por trecho (executado/pendente), e permite filtros por tipo de rede e status.',
  '/app/quantitativos':
    'Composição de orçamento baseada em tabelas oficiais SINAPI e SEINFRA. Calculadora de quantitativos com BDI, comparativo de bases de preço, e exportação para planilha. Suporta composições customizadas.',
  '/app/suprimentos':
    'Gestão de suprimentos com Three-Way Match (PO × GRN × NF), scorecard de fornecedores, previsão de demanda, e mapa de estoque. Inclui importação de planilhas consolidadas de trechos e materiais pendentes.',
  '/app/rede-360':
    'Common Operating Picture (COP) para redes de distribuição. Visão unificada de toda a rede com status de cada segmento, integração com dados de campo, e dashboard de progresso por núcleo/frente.',
}

const GROUP_LABELS: Record<string, string> = {
  gestao:       'Gestão',
  planejamento: 'Planejamento',
  campo:        'Campo',
  projetos:     'Projetos',
  analytics:    'Analytics',
}

const GROUP_ORDER = ['gestao', 'planejamento', 'campo', 'projetos', 'analytics']

interface Props {
  onClose: () => void
}

export function TutorialModal({ onClose }: Props) {
  const grouped = GROUP_ORDER.map((g) => ({
    label: GROUP_LABELS[g] || g,
    modules: MODULE_REGISTRY.filter((m) => m.group === g),
  }))

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#3a3a3a] px-6 py-4 border-b border-[#525252] flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Guia da Plataforma</h2>
            <p className="text-[#a3a3a3] text-xs mt-0.5">
              Referência completa de todos os módulos e funcionalidades do Atlântico ConstruData
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#6b6b6b] hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {grouped.map(({ label, modules }) => (
            <section key={label}>
              <h3 className="text-[#f97316] font-bold text-sm uppercase tracking-widest mb-3">
                {label}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {modules.map((mod) => (
                  <div
                    key={mod.path}
                    className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 hover:border-[#f97316]/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-[#f97316]/10 flex items-center justify-center shrink-0">
                        <mod.icon size={16} className="text-[#f97316]" />
                      </div>
                      <h4 className="text-[#f5f5f5] font-semibold text-sm">{mod.label}</h4>
                    </div>
                    <p className="text-[#a3a3a3] text-xs leading-relaxed">
                      {TUTORIAL_CONTENT[mod.path] || mod.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#525252] bg-[#1f1f1f] shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white rounded-lg bg-[#f97316] hover:bg-[#ea580c] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
