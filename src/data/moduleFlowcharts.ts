/**
 * moduleFlowcharts.ts — Fluxogramas completos de cada módulo.
 * Usado no Tutorial (Minha Rotina) para mostrar diagrama + steps detalhados.
 */

export interface FlowStep {
  id: string
  label: string
  description: string
  details: string[]
  icon?: string // emoji
}

export interface ModuleFlow {
  path: string
  moduleName: string
  summary: string
  steps: FlowStep[]
}

export const MODULE_FLOWS: ModuleFlow[] = [
  // ─── PLANEJAMENTO (TRECHOS) ──────────────────────────────────────────
  {
    path: '/app/planejamento',
    moduleName: 'Planejamento (Trechos)',
    summary: 'Cronograma detalhado de trechos com Gantt, CPM e simulação de atrasos. Fluxo: importar trechos, configurar parâmetros, gerar cronograma, acompanhar execução.',
    steps: [
      {
        id: 'plan-1', label: 'Configurar Projeto', icon: '1',
        description: 'Defina os parâmetros base do planejamento.',
        details: [
          'Abra a aba "Configuração"',
          'Informe: nome do projeto, data de início, data limite',
          'Defina as equipes disponíveis e produtividade média',
          'Salve a configuração',
        ],
      },
      {
        id: 'plan-2', label: 'Importar Trechos', icon: '2',
        description: 'Carregue os trechos da obra via planilha Excel.',
        details: [
          'Clique em "Importar Excel" na aba Trechos',
          'Use o template atlantico-trechos-template.xlsx',
          'Colunas obrigatórias: código, descrição, extensão (m), diâmetro (mm)',
          'O sistema valida e mapeia automaticamente as colunas',
          'Confirme a importação → trechos aparecem na tabela',
        ],
      },
      {
        id: 'plan-3', label: 'Gerar Cronograma', icon: '3',
        description: 'O sistema calcula automaticamente o cronograma via CPM.',
        details: [
          'Clique no botão "Gerar Planejamento"',
          'O algoritmo ordena trechos por dependências e recursos',
          'Calcula caminho crítico (CPM) automaticamente',
          'Resultado: Gantt visual com datas de início/fim por trecho',
        ],
      },
      {
        id: 'plan-4', label: 'Analisar e Ajustar', icon: '4',
        description: 'Use as ferramentas analíticas para otimizar.',
        details: [
          'Curva S: compare previsto vs realizado acumulado',
          'Curva ABC: identifique os 20% de trechos que representam 80% do esforço',
          'Histograma: verifique distribuição de recursos no tempo',
          'Simule atrasos: arraste datas no Gantt para ver impacto',
        ],
      },
      {
        id: 'plan-5', label: 'Acompanhar Execução', icon: '5',
        description: 'Registre o avanço diário e compare com o planejado.',
        details: [
          'Aba "Plano Diário": registre trechos executados por dia',
          'Aba "Notas de Serviço": documente ocorrências',
          'O Gantt se atualiza com cores (verde=no prazo, vermelho=atrasado)',
          'Salve cenários para comparar versões do planejamento',
        ],
      },
      {
        id: 'plan-6', label: 'Exportar', icon: '6',
        description: 'Exporte o planejamento em diferentes formatos.',
        details: [
          'CSV: dados tabulares para Excel/BI',
          'PDF: cronograma visual para impressão',
          'Cenário salvo: para comparar com versões futuras',
        ],
      },
    ],
  },

  // ─── MEDIÇÃO ─────────────────────────────────────────────────────────
  {
    path: '/app/medicao',
    moduleName: 'Medição',
    summary: 'Gestão de medições contratuais em 6 passos sequenciais. Fluxo: criar boletim, preencher planilha, verificar conferência, gerar relatório final.',
    steps: [
      {
        id: 'med-1', label: 'Criar Boletim', icon: '1',
        description: 'Inicie um novo período de medição.',
        details: [
          'Clique em "Novo Boletim"',
          'Informe: período (mês/ano), contrato, consórcio',
          'Defina o número do boletim (sequencial)',
          'O sistema cria a estrutura para preenchimento',
        ],
      },
      {
        id: 'med-2', label: 'Planilha Sabesp', icon: '2',
        description: 'Preencha os itens de medição do contrato.',
        details: [
          'Passo 1 do stepper: "Planilha Sabesp"',
          'Adicione itens por nPreco (número de preço)',
          'O sistema busca automaticamente a descrição e unidade do catálogo',
          'Informe: quantidade contratada, quantidade medida, valor unitário',
          'Itens agrupados por: 01-Canteiros, 02-Esgoto, 03-Água',
          'Ou importe de Excel com as mesmas colunas',
        ],
      },
      {
        id: 'med-3', label: 'Critérios + Subempreiteiros', icon: '3',
        description: 'Consulte critérios e registre medições de terceiros.',
        details: [
          'Passo 2: Consulte critérios de medição (referência, não editável)',
          'Passo 3: Registre quantidades medidas por subempreiteiros',
          'Passo 4: Registre notas fiscais de fornecedores',
        ],
      },
      {
        id: 'med-4', label: 'Conferência Automática', icon: '4',
        description: 'O sistema valida os dados automaticamente.',
        details: [
          'Passo 5: "Conferência"',
          'Cruza: Planilha Sabesp vs Subempreiteiros vs Fornecedores',
          'Identifica divergências automaticamente',
          'Sinaliza itens com diferença > tolerância',
          'Corrija itens sinalizados antes de prosseguir',
        ],
      },
      {
        id: 'med-5', label: 'Medição Final + PDF', icon: '5',
        description: 'Gere o relatório final em PDF.',
        details: [
          'Passo 6: "Medição Final"',
          'Resumo completo com totais por grupo',
          'Clique "Exportar PDF" para gerar boletim em modo claro',
          'PDF inclui: capa, itens, totais, assinaturas',
          'Arquivo disponível no histórico de boletins',
        ],
      },
      {
        id: 'med-6', label: 'Histórico', icon: '6',
        description: 'Consulte e compare boletins anteriores.',
        details: [
          'Aba "Boletins" mostra todos os períodos anteriores',
          'Compare evolução mês a mês',
          'Re-exporte PDFs de boletins passados',
        ],
      },
    ],
  },

  // ─── SUPRIMENTOS ─────────────────────────────────────────────────────
  {
    path: '/app/suprimentos',
    moduleName: 'Suprimentos',
    summary: 'Gestão completa da cadeia de suprimentos: da demanda ao pagamento. Three-Way Match (PO x Recebimento x NF), estoque e materiais.',
    steps: [
      {
        id: 'sup-1', label: 'Previsão de Demanda', icon: '1',
        description: 'Planeje o que será necessário comprar.',
        details: [
          'Aba "Previsão de Demanda" na seção Suprimentos',
          'Visualize necessidades futuras baseadas no cronograma',
          'Identifique materiais críticos e prazos',
        ],
      },
      {
        id: 'sup-2', label: 'Requisição de Compra', icon: '2',
        description: 'Crie requisições para os materiais necessários.',
        details: [
          'Aba "Requisições": crie nova requisição',
          'Pipeline visual: Submetida → Parsing → Cotação → Pedida',
          'Defina prioridade, prazo desejado, especificações',
        ],
      },
      {
        id: 'sup-3', label: 'Ordem de Compra (OC/PO)', icon: '3',
        description: 'Emita ordens de compra para fornecedores.',
        details: [
          'Crie OC com: fornecedor, itens, quantidades, preços',
          'Ou importe via "Importar Consolidado" (planilha Excel)',
          'Status: Aberta → Parcial → Fechada',
        ],
      },
      {
        id: 'sup-4', label: 'Recebimento + NF', icon: '4',
        description: 'Registre o recebimento e a nota fiscal.',
        details: [
          'Registre o recebimento físico (quantidade recebida)',
          'Registre a nota fiscal (número, valor, itens)',
          'Os dados alimentam automaticamente o Three-Way Match',
        ],
      },
      {
        id: 'sup-5', label: 'Conciliação (3-Way Match)', icon: '5',
        description: 'O sistema compara automaticamente PO x Recebimento x NF.',
        details: [
          'Aba "Conciliação": veja o status de cada match',
          'Verde: tudo confere (matched)',
          'Amarelo: divergência parcial (< 5%)',
          'Vermelho: discrepância (> 5%)',
          'Exceções são criadas automaticamente para divergências',
        ],
      },
      {
        id: 'sup-6', label: 'Resolver Exceções', icon: '6',
        description: 'Trate divergências identificadas na conciliação.',
        details: [
          'Aba "Exceções": lista todas as discrepâncias',
          'Para cada exceção: analise, resolva ou escale',
          'Documente a resolução para auditoria',
        ],
      },
      {
        id: 'sup-7', label: 'Gestão de Estoque', icon: '7',
        description: 'Acompanhe materiais em estoque e trânsito.',
        details: [
          'Seção "Materiais & Estoque": mapa de estoque por depósito',
          'Semáforo de Prontidão: verde/amarelo/vermelho por material',
          'What-if Logístico: simule cenários de consumo',
          'Alertas automáticos de ruptura de estoque',
        ],
      },
    ],
  },

  // ─── PROJETOS ─────────────────────────────────────────────────────────
  {
    path: '/app/projetos',
    moduleName: 'Projetos',
    summary: 'Cadastro mestre de projetos com visão completa: fases, orçamento, execução, BIM e documentos.',
    steps: [
      {
        id: 'proj-1', label: 'Criar Projeto', icon: '1',
        description: 'Registre um novo projeto na plataforma.',
        details: [
          'Clique em "Novo Projeto" na sidebar de projetos',
          'Informe: código, nome, gerente responsável',
          'O projeto aparece na lista com status "Planejamento"',
        ],
      },
      {
        id: 'proj-2', label: 'Definir Fases e Marcos', icon: '2',
        description: 'Estruture o projeto em fases com datas.',
        details: [
          'Aba "Planejamento" do projeto',
          'Adicione fases: pré-obra, mobilização, execução, desmobilização',
          'Defina marcos contratuais com datas obrigatórias',
          'Vincule entregáveis a cada fase',
        ],
      },
      {
        id: 'proj-3', label: 'Configurar Orçamento', icon: '3',
        description: 'Defina as linhas de orçamento do projeto.',
        details: [
          'Aba "Orçamento": adicione linhas de custo',
          'Categorias: mão de obra, materiais, equipamentos, terceiros',
          'Defina valor previsto e acompanhe realizado',
          'Integra com módulo Financeiro/EVM para CPI',
        ],
      },
      {
        id: 'proj-4', label: 'Acompanhar Execução', icon: '4',
        description: 'Monitore o andamento diário do projeto.',
        details: [
          'Aba "Execução": progresso por fase',
          'Dados alimentados automaticamente pelo RDO',
          'Visualize % concluído, pendências, bloqueios',
          'Status automático: Planejamento → Ativo → Concluído',
        ],
      },
      {
        id: 'proj-5', label: 'Visualização 3D/4D/5D', icon: '5',
        description: 'Veja o projeto em modelo tridimensional.',
        details: [
          'Aba "3D/4D/5D": visualizador BIM integrado',
          '3D: modelo geométrico navegável',
          '4D: cronograma sobreposto ao modelo (timeline)',
          '5D: heatmap de custos por elemento',
        ],
      },
      {
        id: 'proj-6', label: 'Documentos', icon: '6',
        description: 'Gerencie toda a documentação do projeto.',
        details: [
          'Aba "Documentos": repositório centralizado',
          'Upload de plantas, contratos, licenças, ART',
          'Versionamento automático',
          'Filtro por tipo e data',
        ],
      },
    ],
  },

  // ─── LPS / LEAN ──────────────────────────────────────────────────────
  {
    path: '/app/lps-lean',
    moduleName: 'LPS / Lean Construction',
    summary: 'Last Planner System completo: do look-ahead ao PPC semanal. Gestão de restrições, semáforo de atividades, e melhoria contínua.',
    steps: [
      {
        id: 'lps-1', label: 'Criar Atividades', icon: '1',
        description: 'Defina as atividades que serão planejadas.',
        details: [
          'Aba "Semáforo": crie atividades com nome e descrição',
          'Defina responsável (mestre/encarregado)',
          'Status inicial: pendente (vermelho no semáforo)',
          'Atividades representam pacotes de trabalho semanais',
        ],
      },
      {
        id: 'lps-2', label: 'Identificar Restrições', icon: '2',
        description: 'Catalogue todas as restrições que impedem o trabalho.',
        details: [
          'Aba "Restrições": registre cada bloqueio',
          'Categorias CNC: Clima, Equipamento, Mão de Obra, Material, Projeto, Outro',
          'Defina responsável pela remoção e prazo',
          'Timeline visual mostra evolução das restrições',
        ],
      },
      {
        id: 'lps-3', label: 'Look-ahead (4-6 semanas)', icon: '3',
        description: 'Planeje as próximas 4-6 semanas de trabalho.',
        details: [
          'Aba "Look-ahead": visão de médio prazo',
          'Distribua atividades pelas próximas semanas',
          'Identifique quais restrições precisam ser removidas ANTES',
          'Priorize pela urgência e dependências',
        ],
      },
      {
        id: 'lps-4', label: 'Planejamento Semanal', icon: '4',
        description: 'Defina o compromisso da semana com a equipe.',
        details: [
          'Selecione as atividades do look-ahead que SÃO executáveis esta semana',
          'Critério: só entra se TODAS as restrições foram removidas',
          'Este é o "compromisso" da equipe — o que será medido no PPC',
          'Registre na reunião semanal com mestres e encarregados',
        ],
      },
      {
        id: 'lps-5', label: 'Executar e Registrar', icon: '5',
        description: 'Execute o plano semanal e registre o resultado.',
        details: [
          'Durante a semana: execute as atividades planejadas',
          'No fim da semana: marque cada atividade como concluída ou não',
          'Para não concluídas: registre o motivo (categoria CNC)',
          'Esses dados alimentam automaticamente o PPC',
        ],
      },
      {
        id: 'lps-6', label: 'Medir PPC e Melhorar', icon: '6',
        description: 'Analise o PPC semanal e identifique padrões.',
        details: [
          'Aba "PPC Dashboard": PPC semanal calculado automaticamente',
          'Meta: PPC > 80% (benchmark Lean Construction)',
          'Tendência: gráfico das últimas 8 semanas',
          'Pareto de causas: qual CNC mais aparece?',
          'Use o Pareto para atacar a causa raiz principal',
          'Ciclo: a cada semana o PPC deve subir progressivamente',
        ],
      },
    ],
  },

  // ─── GESTÃO 360 ──────────────────────────────────────────────────────
  {
    path: '/app/gestao-360',
    moduleName: 'Gestão 360',
    summary: 'Dashboard executivo com visão financeira unificada. Não requer fluxo sequencial — é um módulo de consulta e monitoramento.',
    steps: [
      {
        id: 'g360-1', label: 'Acessar Dashboard', icon: '1',
        description: 'Visualize todos os indicadores em uma tela.',
        details: [
          'CPI/SPI em tempo real',
          'Curva S de progresso',
          'Alertas integrados de todos os módulos',
          'Dados alimentados automaticamente por RDO, Planejamento, Suprimentos',
        ],
      },
    ],
  },

  // ─── RELATÓRIO 360 ───────────────────────────────────────────────────
  {
    path: '/app/relatorio360',
    moduleName: 'Relatório 360',
    summary: 'Relatório diário completo com kanban de atividades, equipes, equipamentos e fotos. Exporta PDF por dia ou período.',
    steps: [
      {
        id: 'rel-1', label: 'Navegar para o Dia', icon: '1',
        description: 'Selecione a data do relatório.',
        details: [
          'Use as setas de navegação ou clique no calendário',
          'Cada dia tem seu próprio relatório',
        ],
      },
      {
        id: 'rel-2', label: 'Registrar Atividades', icon: '2',
        description: 'Use o Kanban para gerenciar atividades do dia.',
        details: [
          'Arraste cards entre colunas: Planejado → Em Andamento → Concluído',
          'Edite cada atividade: nome, quantidade planejada/real, equipe',
        ],
      },
      {
        id: 'rel-3', label: 'Registrar Equipes e Recursos', icon: '3',
        description: 'Documente mão de obra, equipamentos e materiais.',
        details: [
          'Equipes: apontamentos de horas por trabalhador',
          'Equipamentos: horas de utilização',
          'Materiais: consumo do dia',
        ],
      },
      {
        id: 'rel-4', label: 'Adicionar Fotos', icon: '4',
        description: 'Documente visualmente o progresso.',
        details: [
          'Upload de fotos com legenda',
          'Grid visual com até 18 fotos por dia',
        ],
      },
      {
        id: 'rel-5', label: 'Exportar PDF', icon: '5',
        description: 'Gere o relatório em PDF.',
        details: [
          'PDF por dia: botão "Exportar PDF" no header',
          'PDF por período: selecione data inicial e final',
          'Inclui: KPIs, atividades, equipes, equipamentos, materiais, fotos',
        ],
      },
    ],
  },

  // ─── RDO ─────────────────────────────────────────────────────────────
  {
    path: '/app/rdo',
    moduleName: 'RDO (Relatório Diário de Obra)',
    summary: 'Registro diário digital do canteiro: clima, equipes, trechos executados, fotos e ocorrências.',
    steps: [
      {
        id: 'rdo-1', label: 'Criar RDO do Dia', icon: '1',
        description: 'Abra o RDO para a data atual.',
        details: [
          'Clique em "Novo RDO" ou selecione a data',
          'Registre condições climáticas (manhã/tarde)',
          'O RDO fica disponível para preenchimento durante todo o dia',
        ],
      },
      {
        id: 'rdo-2', label: 'Registrar Equipes e Trechos', icon: '2',
        description: 'Documente quem trabalhou e o que foi executado.',
        details: [
          'Equipes em campo: nome, função, horas',
          'Trechos executados: código do trecho, metros, material',
          'Equipamentos utilizados',
        ],
      },
      {
        id: 'rdo-3', label: 'Fotos e Ocorrências', icon: '3',
        description: 'Adicione evidências e registre eventos.',
        details: [
          'Upload de fotos geolocalizadas',
          'Registre ocorrências (chuva, acidente, parada)',
          'Todas as evidências ficam rastreáveis',
        ],
      },
      {
        id: 'rdo-4', label: 'Fechar e Exportar', icon: '4',
        description: 'Feche o RDO e gere o PDF.',
        details: [
          'Revise todos os dados preenchidos',
          'Feche o RDO (requer que não haja FVS pendente)',
          'Exporte PDF automaticamente gerado',
        ],
      },
    ],
  },

  // ─── QUALIDADE ───────────────────────────────────────────────────────
  {
    path: '/app/qualidade',
    moduleName: 'Qualidade (FVS)',
    summary: 'Ficha de Verificação de Serviço digital. Inspecione, registre conformidade, trate não-conformidades.',
    steps: [
      {
        id: 'qual-1', label: 'Criar FVS', icon: '1',
        description: 'Inicie uma nova ficha de verificação.',
        details: [
          'Selecione o serviço e o trecho a inspecionar',
          'Defina responsável e data da inspeção',
        ],
      },
      {
        id: 'qual-2', label: 'Preencher Checklist', icon: '2',
        description: 'Verifique cada item de conformidade.',
        details: [
          'Para cada item: Conforme ou Não Conforme',
          'Adicione fotos como evidência',
          'Itens NC geram automaticamente registro de não-conformidade',
        ],
      },
      {
        id: 'qual-3', label: 'Tratar NCs', icon: '3',
        description: 'Resolva as não-conformidades identificadas.',
        details: [
          'Cada NC tem: descrição, ação corretiva, responsável, prazo',
          'Acompanhe resolução até fechamento',
          'NC aberta bloqueia fechamento do RDO do dia',
        ],
      },
    ],
  },

  // ─── QUANTITATIVOS ───────────────────────────────────────────────────
  {
    path: '/app/quantitativos',
    moduleName: 'Quantitativos',
    summary: 'Composição de orçamento com base SINAPI/SEINFRA. Wizard para criar do zero ou importar.',
    steps: [
      {
        id: 'quant-1', label: 'Selecionar Base de Preços', icon: '1',
        description: 'Escolha a tabela de referência.',
        details: [
          'SINAPI (federal) ou SEINFRA (estadual)',
          'Base customizada também disponível',
        ],
      },
      {
        id: 'quant-2', label: 'Montar Orçamento', icon: '2',
        description: 'Adicione itens ao orçamento.',
        details: [
          'Busque por código ou descrição na base',
          'Informe quantidades e BDI',
          'O sistema calcula automaticamente custos totais',
        ],
      },
      {
        id: 'quant-3', label: 'Exportar', icon: '3',
        description: 'Exporte o orçamento finalizado.',
        details: [
          'Excel (.xlsx) com formatação completa',
          'CSV para integração com outros sistemas',
          'Salve como template para reutilização',
        ],
      },
    ],
  },

  // ─── MÃO DE OBRA ────────────────────────────────────────────────────
  {
    path: '/app/mao-de-obra',
    moduleName: 'Mão de Obra',
    summary: 'Cadastro de funcionários, alocação por frente, controle de certificações e produtividade.',
    steps: [
      {
        id: 'mo-1', label: 'Cadastrar Funcionários', icon: '1',
        description: 'Registre os colaboradores.',
        details: [
          'Nome, CPF, função, equipe, departamento',
          'Importação em massa via Excel',
          'Certificações e treinamentos',
        ],
      },
      {
        id: 'mo-2', label: 'Alocar por Frente', icon: '2',
        description: 'Distribua a mão de obra.',
        details: [
          'Aloque trabalhadores por frente de obra',
          'Dashboard de alocação diária',
          'Alertas de NR (certificações vencidas)',
        ],
      },
      {
        id: 'mo-3', label: 'Acompanhar Produtividade', icon: '3',
        description: 'Monitore horas e custos.',
        details: [
          'Horas trabalhadas por equipe/dia',
          'Custo de mão de obra integrado com EVM',
          'Relatórios de produtividade por período',
        ],
      },
    ],
  },

  // ─── PLANEJAMENTO MESTRE ────────────────────────────────────────────
  {
    path: '/app/planejamento-mestre',
    moduleName: 'Planejamento Mestre',
    summary: 'Estrutura macro do projeto em 3 horizontes: longo prazo (Gantt WBS), médio prazo (look-ahead), curto prazo (PPC 15 dias).',
    steps: [
      { id: 'pm-1', label: 'Criar Cronograma', icon: '1', description: 'Crie do zero com wizard ou importe planilha.', details: ['Wizard de 3 passos: tipo de rede, frentes, datas', 'Ou importe Excel com template padronizado (14 colunas)', 'Template disponível para download na tela inicial'] },
      { id: 'pm-2', label: 'Estruturar WBS', icon: '2', description: 'Organize atividades em hierarquia.', details: ['Gantt visual com barras planejadas vs tendência', 'Cores por tipo: Água (azul), Esgoto (roxo), Civil (amarelo)', 'Drag para reorganizar'] },
      { id: 'pm-3', label: 'Salvar Baseline', icon: '3', description: 'Registre a versão oficial do cronograma.', details: ['Snapshot completo para comparação futura', 'Compare baseline vs situação atual a qualquer momento'] },
      { id: 'pm-4', label: 'Look-ahead 6 Semanas', icon: '4', description: 'Planejamento de médio prazo.', details: ['Aba "Médio Prazo": atividades por semana ISO', 'Agrupadas por tipo de rede', 'Status: Planejado, Pronto, Bloqueado, Concluído'] },
      { id: 'pm-5', label: 'Programação Semanal', icon: '5', description: 'Detalhe diário previsto vs realizado.', details: ['Tabela Seg-Dom com Previsto/Realizado por atividade', 'Exportável para Excel'] },
      { id: 'pm-6', label: 'Simulação What-if', icon: '6', description: 'Teste cenários no curto prazo.', details: ['Quadro de 15 dias com curva S dual', 'Adicione ajustes (atrasar, estender duração)', 'Veja impacto imediato na curva'] },
    ],
  },

  // ─── AGENDA ────────────────────────────────────────────────────────
  {
    path: '/app/agenda',
    moduleName: 'Agenda',
    summary: 'Calendário operacional unificado com detecção de conflitos e visualização multi-escala.',
    steps: [
      { id: 'ag-1', label: 'Visualizar Calendário', icon: '1', description: 'Escolha a escala de visualização.', details: ['Dia, Semana, Mês, Trimestre, Semestre, Ano', 'Gantt de recursos com barras coloridas por tipo', 'Busca por recurso (equipe, equipamento)'] },
      { id: 'ag-2', label: 'Criar Tarefas', icon: '2', description: 'Adicione eventos e alocações.', details: ['Clique "+ Nova Tarefa"', 'Defina: recurso, datas, descrição, cor', 'Arraste para reposicionar no Gantt'] },
      { id: 'ag-3', label: 'Detectar Conflitos', icon: '3', description: 'O sistema identifica sobreposições.', details: ['Mesma equipe em dois lugares = alerta', 'Equipamento com manutenção agendada = bloqueio', 'Conflitos visíveis como sobreposição no Gantt'] },
      { id: 'ag-4', label: 'Executar Cenários', icon: '4', description: 'Simule realocações.', details: ['Botão "Executar Cenários" no header', 'Teste movimentos antes de confirmar', '"Visão do Modelo" para ver impacto integrado'] },
    ],
  },

  // ─── FINANCEIRO / EVM ──────────────────────────────────────────────
  {
    path: '/app/evm',
    moduleName: 'Financeiro / EVM',
    summary: 'Earned Value Management com controle financeiro de entradas e saídas. CPI, SPI, EAC, ETC calculados automaticamente.',
    steps: [
      { id: 'evm-1', label: 'Registrar Entradas', icon: '1', description: 'Registre receitas (medições, adiantamentos).', details: ['Aba "Entradas": adicione por categoria (medição, reajuste, etc.)', 'Valor, data, referência, notas'] },
      { id: 'evm-2', label: 'Registrar Saídas', icon: '2', description: 'Registre custos (materiais, M.O., equipamentos).', details: ['Aba "Saídas": adicione por categoria', 'Materiais, mão de obra, equipamentos, subempreiteiros, administrativo'] },
      { id: 'evm-3', label: 'Analisar Fluxo de Caixa', icon: '3', description: 'Visualize entradas vs saídas ao longo do tempo.', details: ['Aba "Fluxo de Caixa": gráfico mensal', 'Saldo acumulado', 'Identifique meses com déficit'] },
      { id: 'evm-4', label: 'Acompanhar EVM', icon: '4', description: 'KPIs calculados automaticamente.', details: ['CPI (Cost Performance Index): custo vs orçado', 'SPI (Schedule Performance Index): prazo vs planejado', 'EAC, ETC, VAC, TCPI para projeções'] },
    ],
  },

  // ─── GESTÃO DE EQUIPAMENTOS ────────────────────────────────────────
  {
    path: '/app/gestao-equipamentos',
    moduleName: 'Gestão de Equipamentos',
    summary: 'Cadastro de frota fixa, manutenção preventiva/corretiva, e monitoramento de utilização.',
    steps: [
      { id: 'geq-1', label: 'Cadastrar Equipamentos', icon: '1', description: 'Registre a frota fixa.', details: ['Nome, tipo, modelo, número de série', 'Status: Disponível, Em Uso, Manutenção'] },
      { id: 'geq-2', label: 'Agendar Manutenção', icon: '2', description: 'Preventiva e corretiva.', details: ['Manutenção preventiva com intervalo programado', 'Alertas de vencimento', 'Histórico de manutenções'] },
      { id: 'geq-3', label: 'Registrar Utilização', icon: '3', description: 'Controle de horas por equipamento.', details: ['Horas de utilização diárias', 'Taxa de utilização (disponível vs ativo)', 'Custo operacional por hora'] },
    ],
  },

  // ─── FROTA VEICULAR ────────────────────────────────────────────────
  {
    path: '/app/otimizacao-frota',
    moduleName: 'Frota Veicular',
    summary: 'Gestão de veículos: combustível, motoristas, manutenção e roteirização.',
    steps: [
      { id: 'fr-1', label: 'Cadastrar Veículos', icon: '1', description: 'Registre a frota (própria e alugada).', details: ['Placa, modelo, tipo, km atual', 'Status: Ativo, Manutenção, Inativo'] },
      { id: 'fr-2', label: 'Controlar Combustível', icon: '2', description: 'Registre abastecimentos.', details: ['Litros, km, custo por litro', 'Dashboard de consumo médio', 'Alertas de consumo anormal'] },
      { id: 'fr-3', label: 'Gerenciar Motoristas', icon: '3', description: 'Vincule motoristas a veículos.', details: ['CNH, categoria, vencimento', 'Histórico de viagens por motorista'] },
      { id: 'fr-4', label: 'Planejar Rotas', icon: '4', description: 'Otimize deslocamentos.', details: ['Mapa com pontos de parada', 'Cálculo de distância e tempo', 'Custo estimado por rota'] },
    ],
  },

  // ─── BIM 3D/4D/5D ─────────────────────────────────────────────────
  {
    path: '/app/bim',
    moduleName: 'BIM 3D/4D/5D',
    summary: 'Visualizador BIM no navegador: modelo 3D, timeline 4D e heatmap de custos 5D.',
    steps: [
      { id: 'bim-1', label: 'Importar Modelo', icon: '1', description: 'Carregue o modelo 3D.', details: ['Aceita arquivos DXF e IFC', 'Upload direto no navegador', 'Modelo renderizado via Three.js/WebGL'] },
      { id: 'bim-2', label: 'Navegar em 3D', icon: '2', description: 'Explore o modelo interativamente.', details: ['Rotação, zoom, pan com mouse/touch', 'Vistas: Topo, Frente, Isométrica', 'Seleção de elementos individuais'] },
      { id: 'bim-3', label: 'Timeline 4D', icon: '3', description: 'Sobreponha o cronograma ao modelo.', details: ['Animação temporal: veja a obra sendo construída', 'Vincule elementos do modelo a atividades do planejamento', 'Play/pause/seek na timeline'] },
      { id: 'bim-4', label: 'Heatmap 5D', icon: '4', description: 'Visualize custos por elemento.', details: ['Cores: verde (no orçamento) → vermelho (estouro)', 'Custo por material e por elemento', 'Integra com módulo Quantitativos (SINAPI)'] },
    ],
  },

  // ─── PRÉ-CONSTRUÇÃO ───────────────────────────────────────────────
  {
    path: '/app/pre-construcao',
    moduleName: 'Pré-Construção',
    summary: 'Due diligence e viabilidade técnica antes do início da obra.',
    steps: [
      { id: 'pre-1', label: 'Análise de Viabilidade', icon: '1', description: 'Avalie a viabilidade do projeto.', details: ['Checklist técnico e econômico', 'Estudo de interferências', 'Análise geotécnica'] },
      { id: 'pre-2', label: 'Documentação', icon: '2', description: 'Organize licenças e permissões.', details: ['Licenças ambientais, alvarás, ART', 'Status de cada documento', 'Alertas de vencimento'] },
      { id: 'pre-3', label: 'Matriz de Riscos', icon: '3', description: 'Identifique e classifique riscos.', details: ['Probabilidade × Impacto', 'Plano de mitigação por risco', 'Exportável para apresentação'] },
    ],
  },

  // ─── MAPA INTERATIVO ──────────────────────────────────────────────
  {
    path: '/app/mapa-interativo',
    moduleName: 'Mapa Interativo',
    summary: 'GIS de redes de infraestrutura sobre mapa Leaflet com importação UTM.',
    steps: [
      { id: 'map-1', label: 'Importar Coordenadas', icon: '1', description: 'Carregue trechos via planilha UTM.', details: ['Upload Excel com coordenadas UTM', 'O sistema converte e plota no mapa', 'Aceita formato E/N ou Lat/Lng'] },
      { id: 'map-2', label: 'Visualizar Redes', icon: '2', description: 'Veja a rede sobre o mapa.', details: ['Trechos coloridos por status (executado/pendente)', 'Filtros: tipo de rede (água, esgoto, drenagem)', 'Camadas: Ruas, Satélite, Relevo, Escuro'] },
      { id: 'map-3', label: 'Analisar por Trecho', icon: '3', description: 'Clique em um trecho para detalhes.', details: ['Extensão, diâmetro, material, status', 'Perfil de elevação 3D', 'Custo por segmento'] },
    ],
  },

  // ─── REDE 360 ─────────────────────────────────────────────────────
  {
    path: '/app/rede-360',
    moduleName: 'Rede 360',
    summary: 'Common Operating Picture para redes de distribuição. Dashboard de progresso por núcleo.',
    steps: [
      { id: 'r360-1', label: 'Visão da Rede', icon: '1', description: 'Dashboard unificado de toda a rede.', details: ['Status por segmento: executado, pendente, cadastro', 'Progresso por núcleo/frente', 'KPIs globais: km executados, km pendentes'] },
      { id: 'r360-2', label: 'Filtrar e Analisar', icon: '2', description: 'Foque em áreas específicas.', details: ['Filtros por núcleo, tipo de rede, status', 'Drill-down por frente de obra', 'Integração com dados de campo (RDO)'] },
    ],
  },

]

export function getFlowForModule(path: string): ModuleFlow | undefined {
  return MODULE_FLOWS.find(f => f.path === path)
}
