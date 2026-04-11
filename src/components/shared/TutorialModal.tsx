/**
 * TutorialPanel — Guia completo da plataforma.
 * Renderizado inline dentro de Minha Rotina (não como modal).
 * Explica todos os módulos e funcionalidades como referência para o usuário.
 */
import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { MODULE_REGISTRY } from '@/features/minha-rotina/moduleRegistry'

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

export function TutorialPanel() {
  const [search, setSearch] = useState('')

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

  const totalModules = grouped.reduce((s, g) => s + g.modules.length, 0)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header + search */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-white text-lg font-bold">Guia da Plataforma</h2>
          <p className="text-[#a3a3a3] text-sm mt-0.5">
            Referência completa de todos os módulos e funcionalidades do Atlântico ConstruData
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

      {/* Count */}
      <p className="text-[#6b6b6b] text-xs">
        {totalModules} {totalModules === 1 ? 'módulo' : 'módulos'} {search ? 'encontrados' : 'disponíveis'}
      </p>

      {/* Module groups */}
      {grouped.map(({ key, label, modules }) => (
        <section key={key}>
          <h3 className="text-[#f97316] font-bold text-sm uppercase tracking-widest mb-3">
            {label}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {modules.map((mod) => (
              <div
                key={mod.path}
                className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4 hover:border-[#f97316]/30 transition-colors"
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

      {grouped.length === 0 && (
        <div className="text-center py-12 text-[#6b6b6b] text-sm">
          Nenhum módulo encontrado para "{search}"
        </div>
      )}
    </div>
  )
}
