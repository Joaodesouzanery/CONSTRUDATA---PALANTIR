/**
 * Help content dictionary used by HelpTooltip component.
 * Covers ALL modules, tabs, KPIs, and technical terms of the CONSTRUDATA platform.
 */

export interface HelpEntry {
  title: string
  description: string
  terms?: { term: string; def: string }[]
}

export const HELP_CONTENT: Record<string, HelpEntry> = {
  // ── GESTÃO ─────────────────────────────────────────────────────────────────
  'gestao-360': {
    title: 'Gestão de Projeto 360°',
    description: 'Visão integrada de todas as frentes da obra, incluindo Job Costing, Change Orders, Centro de Comando e Simulação de Atrasos.',
    terms: [
      { term: 'Job Costing', def: 'Custeio por atividade — compara orçamento vs realizado por linha de custo.' },
      { term: 'Change Order', def: 'Alteração contratual com impacto em custo e/ou prazo.' },
    ],
  },
  'relatorio-360': {
    title: 'Relatório 360',
    description: 'Consolidação diária de todas as atividades da obra. Registre o progresso, observações e fotos de cada frente de trabalho.',
  },
  'torre-de-controle': {
    title: 'Torre de Controle',
    description: 'Monitoramento centralizado de todas as obras com visualização de riscos, status e alertas em tempo real.',
    terms: [
      { term: 'Risco', def: 'Evento incerto que pode impactar o projeto. Classificado por severidade (baixo, médio, alto, crítico).' },
    ],
  },
  'change-orders': {
    title: 'Change Orders',
    description: 'Alterações contratuais que impactam custo ou prazo. Fluxo: Rascunho → Submetido → Aprovado/Rejeitado.',
  },
  'job-costing': {
    title: 'Job Costing',
    description: 'Custeio por atividade mostrando BAC (orçado), AC (realizado) e EAC (projetado) por linha de custo.',
  },
  'simulacao-atraso': {
    title: 'Simulação de Atrasos',
    description: 'Ferramenta what-if para simular o impacto de atrasos em trechos específicos no cronograma e custo total do projeto.',
  },

  // ── PLANEJAMENTO ───────────────────────────────────────────────────────────
  'planejamento-mestre': {
    title: 'Planejamento Mestre',
    description: 'WBS hierárquico do projeto com 5 visões: Longo Prazo (Gantt), Médio Prazo (Look-ahead 6 semanas), Curto Prazo (15 dias), Visão Integrada e Programação Semanal.',
    terms: [
      { term: 'WBS', def: 'Work Breakdown Structure — decomposição hierárquica do trabalho em atividades gerenciáveis.' },
    ],
  },
  'longo-prazo': {
    title: 'Longo Prazo (Macro)',
    description: 'Gantt macro do projeto mostrando barras de Previsto (baseline) vs Tendência (forecast) por atividade. Permite salvar baselines e exportar.',
  },
  'medio-prazo': {
    title: 'Médio Prazo (Look-ahead)',
    description: 'Derivação automática das próximas 6 semanas a partir do cronograma mestre. Mostra status: Planejado, Pronto, Bloqueado, Executado.',
    terms: [
      { term: 'Look-ahead', def: 'Janela de planejamento de 6 semanas que permite antecipar restrições e preparar recursos.' },
    ],
  },
  'curto-prazo': {
    title: 'Curto Prazo (15 dias)',
    description: 'Painel de produção diária para os próximos 15 dias. Inclui Curva S de comparação Previsto vs Realizado e PPC semanal.',
  },
  'visao-integrada': {
    title: 'Visão Integrada',
    description: 'Consolidação das 4 visões de planejamento num único painel para análise comparativa.',
  },
  'prog-semanal': {
    title: 'Programação Semanal',
    description: 'Tabela de Previsto × Realizado por atividade por dia da semana. Permite editar valores diários e campos de identificação (Núcleo, Local, Coordenador).',
    terms: [
      { term: 'Núcleo', def: 'Setor ou área de responsabilidade dentro da obra.' },
      { term: 'Acum. Ant.', def: 'Acumulado anterior — soma de todas as semanas anteriores.' },
    ],
  },
  'planejamento-trechos': {
    title: 'Planejamento de Trechos',
    description: 'Detalhamento do cronograma por trecho de rede, com dimensionamento de equipes, cálculo de produtividade e custos.',
  },
  'wbs': {
    title: 'WBS (Work Breakdown Structure)',
    description: 'Decomposição hierárquica do escopo do projeto em atividades menores e gerenciáveis. Cada nível representa um grau de detalhe maior.',
  },
  'baseline': {
    title: 'Baseline (Linha Base)',
    description: 'Foto do cronograma original aprovado. Serve como referência para medir desvios. Pode-se salvar múltiplas baselines para comparação.',
  },
  'curva-s': {
    title: 'Curva S',
    description: 'Gráfico cumulativo em formato de "S" que mostra o avanço do projeto ao longo do tempo. Permite comparar planejado vs realizado.',
  },
  'ppc': {
    title: 'PPC (Percentual de Planos Concluídos)',
    description: 'Métrica Lean que mede a aderência ao planejamento. PPC = (Atividades concluídas ÷ Atividades planejadas) × 100%.',
  },
  'what-if': {
    title: 'Simulação What-If',
    description: 'Ferramenta para testar cenários alternativos no cronograma. Aplique ajustes de dias e duração e veja o impacto na Curva S.',
  },
  'gantt': {
    title: 'Gráfico de Gantt',
    description: 'Visualização de barras temporais das atividades do projeto. Barras superiores (cinza) = Previsto, barras inferiores (coloridas) = Tendência.',
  },
  'atividades': {
    title: 'Atividades',
    description: 'Total de itens na WBS do planejamento. Inclui todos os níveis hierárquicos (consórcio, comunidades, tipos de serviço, sub-serviços).',
  },
  'pct-concluido': {
    title: '% Concluído',
    description: 'Progresso ponderado do projeto. Calculado pela média ponderada (por peso) do percentual de conclusão de cada atividade.',
  },
  'dias-p-fim': {
    title: 'Dias para Fim',
    description: 'Diferença em dias entre hoje e a data de término prevista (tendência) do projeto.',
  },

  // ── CAMPO ──────────────────────────────────────────────────────────────────
  'rdo': {
    title: 'RDO (Relatório Diário de Obra)',
    description: 'Documento que registra diariamente as atividades, condições climáticas, mão de obra, equipamentos e avanço por trecho na obra.',
    terms: [
      { term: 'Mão de Obra', def: 'Efetivo diário por função: Encarregado, Oficial, Ajudante, Operador.' },
      { term: 'Trechos', def: 'Segmentos da rede com medição de metros planejados vs executados.' },
    ],
  },
  'mao-de-obra': {
    title: 'Gestão de Mão de Obra',
    description: 'Controle de funcionários, escalas, apontamentos de horas, produtividade, segurança e custos de pessoal.',
    terms: [
      { term: 'HH', def: 'Homem-Hora — unidade de medida de esforço (1 trabalhador × 1 hora).' },
      { term: 'CLT', def: 'Consolidação das Leis do Trabalho — regime de contratação formal.' },
    ],
  },
  'gestao-equipamentos': {
    title: 'Gestão de Equipamentos',
    description: 'Rastreamento de máquinas e equipamentos, manutenção preventiva/corretiva, alertas de status e localização.',
  },
  'frota': {
    title: 'Otimização de Frota',
    description: 'Gestão de veículos, rotas, consumo de combustível e eficiência operacional da frota.',
  },
  'hh': {
    title: 'HH (Homem-Hora)',
    description: 'Unidade de medida de esforço de trabalho. 1 HH = 1 trabalhador trabalhando por 1 hora. Usado para medir produtividade e dimensionar equipes.',
  },
  'produtividade': {
    title: 'Produtividade',
    description: 'Quantidade produzida por unidade de tempo ou recurso. Ex: metros de rede assentados por dia por equipe.',
  },

  // ── PROJETOS ───────────────────────────────────────────────────────────────
  'projetos': {
    title: 'Gestão de Projetos',
    description: 'Portfólio de projetos com fases, orçamento, documentos e equipe. Acompanhe o ciclo de vida do projeto.',
  },
  'bim': {
    title: 'BIM 3D/4D/5D',
    description: 'Building Information Modeling — modelagem 3D da construção integrada com cronograma (4D) e custos (5D).',
    terms: [
      { term: '3D', def: 'Modelo geométrico tridimensional da obra.' },
      { term: '4D', def: 'Modelo 3D + cronograma (sequência temporal de construção).' },
      { term: '5D', def: 'Modelo 4D + custos (estimativa integrada ao modelo).' },
    ],
  },
  'pre-construcao': {
    title: 'Pré-Construção',
    description: 'Análise de contratos, extração de quantitativos de PDFs/planilhas e comparação com bases de preço (SINAPI/SEINFRA).',
  },
  'mapa-interativo': {
    title: 'Mapa Interativo',
    description: 'Visualização georreferenciada das obras, equipamentos e trechos no mapa. Permite acompanhar a localização em tempo real.',
  },

  // ── ANALYTICS ──────────────────────────────────────────────────────────────
  'quantitativos': {
    title: 'Quantitativos e Orçamento',
    description: 'Levantamento de quantidades de serviços e materiais com custos unitários das bases SINAPI/SEINFRA. Gere orçamentos completos com BDI.',
  },
  'suprimentos': {
    title: 'Suprimentos',
    description: 'Gestão de compras, estoque, recebimento e conciliação 3-way match (PO × Recebimento × Nota Fiscal).',
    terms: [
      { term: 'Three-Way Match', def: 'Conciliação entre Pedido de Compra, Recebimento Físico e Nota Fiscal para validar pagamentos.' },
      { term: 'Lead Time', def: 'Tempo entre o pedido e a entrega do fornecedor.' },
    ],
  },
  'rede-360': {
    title: 'Rede 360',
    description: 'Visualização topológica da rede de saneamento (água e esgoto) com nós, trechos e status de execução.',
  },
  'aip': {
    title: 'AIP (Assistente de Inteligência)',
    description: 'Assistente IA que consulta todos os dados da plataforma em tempo real. Faça perguntas em português sobre RDOs, projetos, EVM, planejamento e mais.',
  },
  'bdi': {
    title: 'BDI (Benefícios e Despesas Indiretas)',
    description: 'Percentual aplicado sobre o custo direto para cobrir: administração central, despesas financeiras, seguros, garantias, lucro e impostos.',
  },
  'sinapi': {
    title: 'SINAPI',
    description: 'Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil. Base de preços de referência mantida pelo IBGE e Caixa Econômica Federal.',
  },
  'seinfra': {
    title: 'SEINFRA',
    description: 'Tabela de referência de custos da Secretaria de Infraestrutura estadual. Usada em orçamentos de obras públicas.',
  },
  'three-way-match': {
    title: 'Three-Way Match',
    description: 'Processo de conciliação entre: 1) Pedido de Compra (PO), 2) Recebimento Físico (GR), e 3) Nota Fiscal (NF). Tolerância padrão: 2%.',
  },

  // ── EVM ────────────────────────────────────────────────────────────────────
  'evm': {
    title: 'EVM (Earned Value Management)',
    description: 'Gerenciamento de Valor Agregado — metodologia que integra escopo, cronograma e custo para medir a saúde do projeto.',
    terms: [
      { term: 'CPI < 1', def: 'Gastando mais do que produzindo (prejuízo).' },
      { term: 'SPI < 1', def: 'Produzindo menos do que planejado (atraso).' },
    ],
  },
  'cpi': {
    title: 'CPI / IDC (Índice de Desempenho de Custos)',
    description: 'CPI = EV ÷ AC. Mede a eficiência de custo. Se < 1.0, o projeto está gastando mais que o valor do trabalho entregue.',
  },
  'spi': {
    title: 'SPI / IDP (Índice de Desempenho de Prazo)',
    description: 'SPI = EV ÷ PV. Mede a eficiência de prazo. Se < 1.0, o projeto está atrasado em relação ao cronograma.',
  },
  'bac': {
    title: 'BAC (Budget at Completion)',
    description: 'Orçamento total planejado do projeto. É o valor que se espera gastar para concluir todo o escopo.',
  },
  'eac': {
    title: 'EAC (Estimate at Completion)',
    description: 'Estimativa do custo final do projeto baseada no desempenho atual. EAC = BAC ÷ CPI.',
  },
  'vac': {
    title: 'VAC (Variance at Completion)',
    description: 'Variação projetada ao término. VAC = BAC - EAC. Positivo = economia, Negativo = estouro.',
  },
  'ev': {
    title: 'EV (Earned Value)',
    description: 'Valor Agregado — valor do trabalho efetivamente realizado até a data. Mede o progresso em termos financeiros.',
  },
  'pv': {
    title: 'PV (Planned Value)',
    description: 'Valor Planejado — valor do trabalho que deveria ter sido concluído até a data, conforme o cronograma original.',
  },
  'ac': {
    title: 'AC (Actual Cost)',
    description: 'Custo Real — valor efetivamente gasto até a data para realizar o trabalho.',
  },
  'curva-s-multi': {
    title: 'Curva S Multidimensional',
    description: 'Gráfico com 4 linhas: PV (planejado financeiro), EV (valor agregado), AC físico (realizado) e AC custo (custo real). Permite identificar se o gasto condiz com a produção.',
  },
  'medicao-ponderada': {
    title: 'Medição Ponderada',
    description: 'Matriz de pesos por atividade com 4 dimensões: Financeiro (CAPEX), Duração (criticidade), Econômico (geração de valor) e Específico (complexidade/risco).',
  },
  'plano-contas': {
    title: 'Plano de Contas Industrial (4 Pilares)',
    description: 'Decomposição de custos em 4 grupos: Material, Equipamentos, Mão de Obra (HH) e Impostos/Indiretos.',
  },
  'work-packages': {
    title: 'Work Packages (Pacotes de Trabalho)',
    description: 'Pacotes padronizados reutilizáveis com plano de contas e pesos pré-configurados. Templates podem ser "instalados" em qualquer atividade.',
  },
  'semaforo-evm': {
    title: 'Semáforo EVM',
    description: 'Indicador visual de saúde do projeto: 🔵 Azul (CPI≥1 e SPI≥1), 🟡 Amarelo (atrasado mas dentro do orçamento), 🔴 Vermelho (atrasado e estourando orçamento).',
  },
  'causa-raiz': {
    title: 'Análise de Causa Raiz',
    description: 'Identificação automática do pilar de custo (Material, Equipamento, MO, Impostos) que mais contribui para o desvio orçamentário.',
  },
  'cenarios-eac': {
    title: 'Cenários EAC',
    description: 'Três projeções de custo final: Otimista (plano original), Tendência (mantendo desempenho atual), Pessimista (considerando fatores de risco).',
  },

  // ── LPS / LEAN ─────────────────────────────────────────────────────────────
  'lps': {
    title: 'LPS (Last Planner System)',
    description: 'Sistema de planejamento colaborativo Lean. Foco em remover restrições antes da execução e medir PPC semanalmente.',
    terms: [
      { term: 'Restrição', def: 'Impedimento que bloqueia uma atividade (material, mão de obra, projeto, etc.).' },
    ],
  },
  'restricoes': {
    title: 'Gestão de Restrições',
    description: 'Identificação e resolução de impedimentos que bloqueiam atividades. Status: Identificada, Em Resolução, Resolvida.',
  },
  'ppc-semanal': {
    title: 'PPC Semanal',
    description: 'Percentual de Planos Concluídos na semana. Meta: ≥80%. Abaixo de 60% indica problemas sérios de aderência ao planejamento.',
  },
  'takt-time': {
    title: 'Takt Time',
    description: 'Ritmo de produção alinhado à demanda. Calcula o tempo necessário para completar cada unidade de trabalho no ritmo requerido pelo cronograma.',
  },
  'lean': {
    title: 'Lean Construction',
    description: 'Filosofia de eliminação de desperdícios na construção. Foco em fluxo contínuo, pull planning e melhoria contínua.',
  },

  // ── AGENDA ─────────────────────────────────────────────────────────────────
  'agenda': {
    title: 'Agenda',
    description: 'Cronograma visual com eventos, marcos e tarefas. Visualize atividades por dia, semana ou mês com filtros por responsável e status.',
  },

  // ── MEDIÇÃO ────────────────────────────────────────────────────────────────
  'medicao': {
    title: 'Módulo de Medição',
    description: 'Gestão de medições contratuais: Sabesp, Critério de Medição, Subempreiteiro, Fornecedor e Conferência Contrato × Previsão.',
    terms: [
      { term: 'Medição', def: 'Levantamento de quantidades executadas para faturamento/pagamento conforme contrato.' },
      { term: 'Boletim de Medição', def: 'Documento formal que registra as quantidades medidas no período.' },
    ],
  },
  'medicao-sabesp': {
    title: 'Medição Sabesp',
    description: 'Medição no formato padrão da Sabesp (Companhia de Saneamento do Estado de São Paulo). Inclui item, descrição, unidade, quantidade contratada, medida e acumulada.',
  },
  'medicao-criterio': {
    title: 'Critério de Medição',
    description: 'Define os critérios e pesos para cálculo do avanço físico-financeiro. Cada item pode ter um peso diferente na composição do avanço total.',
  },
  'medicao-subempreiteiro': {
    title: 'Medição Subempreiteiro',
    description: 'Medição dos serviços executados por subempreiteiros/subcontratados. Permite filtrar por empresa e comparar com o contrato principal.',
  },
  'medicao-fornecedor': {
    title: 'Medição Fornecedor',
    description: 'Medição de materiais/serviços fornecidos por fornecedores. Rastreia quantidades contratadas vs entregues vs medidas.',
  },
  'medicao-conferencia': {
    title: 'Conferência Contrato × Previsão',
    description: 'Comparação automática entre planilha de previsão e contrato inserido. O sistema faz matching de itens e identifica divergências para aprovação.',
    terms: [
      { term: 'Matching', def: 'Cruzamento automático de itens por descrição/código entre contrato e previsão.' },
      { term: 'Divergência', def: 'Item com diferença entre valor contratado e valor previsto.' },
    ],
  },
}
