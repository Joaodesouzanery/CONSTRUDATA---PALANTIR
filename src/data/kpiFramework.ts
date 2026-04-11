/**
 * kpiFramework.ts — Framework de KPIs "Antes vs Depois" do Atlântico ConstruData.
 *
 * Usado para:
 * 1. Onboarding: coletar baseline do cliente (antes)
 * 2. Relatório de ROI em 90 dias (depois)
 * 3. Dashboard de impacto na plataforma
 */

export interface KpiDefinition {
  id: string
  category: string
  name: string
  description: string
  howToMeasureBefore: string
  howToMeasureAfter: string
  unit: string
  typicalBefore: string
  targetAfter: string
  dataSource: string
  frequency: 'diário' | 'semanal' | 'mensal' | 'por medição'
}

export const KPI_CATEGORIES = [
  'Planejamento & Cronograma',
  'Financeiro & Orçamento',
  'Campo & Execução',
  'Suprimentos & Materiais',
  'Qualidade',
  'Comunicação & Decisão',
  'Produtividade',
] as const

export const KPI_FRAMEWORK: KpiDefinition[] = [
  // ─── PLANEJAMENTO & CRONOGRAMA ──────────────────────────────────────────
  {
    id: 'ppc',
    category: 'Planejamento & Cronograma',
    name: 'PPC (Percent Plan Complete)',
    description: 'Percentual de atividades planejadas que foram concluídas na semana. Indicador central do Last Planner System.',
    howToMeasureBefore: 'Se o cliente não mede: pedir para listar as 10 principais atividades planejadas da semana passada e verificar quantas foram concluídas. Se mede: pegar o histórico das últimas 8 semanas.',
    howToMeasureAfter: 'Calculado automaticamente pelo módulo LPS/Lean. Dashboard mostra PPC semanal, tendência 8 semanas, e categorias de não-cumprimento (CNC).',
    unit: '%',
    typicalBefore: '35-45%',
    targetAfter: '70-85%',
    dataSource: 'LPS/Lean → PPC Dashboard',
    frequency: 'semanal',
  },
  {
    id: 'spi',
    category: 'Planejamento & Cronograma',
    name: 'SPI (Schedule Performance Index)',
    description: 'Índice de performance de prazo. SPI < 1.0 significa atraso. Calculado via Earned Value Management.',
    howToMeasureBefore: 'Se não tem EVM: comparar % executado vs % planejado do cronograma. Se tem: pegar SPI atual do MS Project ou Primavera.',
    howToMeasureAfter: 'Calculado em tempo real no módulo Financeiro/EVM a partir dos dados de avanço do RDO e planejamento.',
    unit: 'índice',
    typicalBefore: '0.65-0.85',
    targetAfter: '0.90-1.05',
    dataSource: 'Financeiro/EVM → Dashboard',
    frequency: 'semanal',
  },
  {
    id: 'replanejamentos',
    category: 'Planejamento & Cronograma',
    name: 'Frequência de Replanejamento',
    description: 'Quantas vezes por mês o cronograma precisa ser completamente refeito (não ajustes, mas replanejamento completo).',
    howToMeasureBefore: 'Perguntar ao planejador: "Quantas vezes por mês vocês refazem o cronograma do zero?"',
    howToMeasureAfter: 'Registrado automaticamente via histórico de versões de planejamento no módulo Planejamento (cenários salvos).',
    unit: 'vezes/mês',
    typicalBefore: '3-5x/mês',
    targetAfter: '0-1x/mês',
    dataSource: 'Planejamento → Cenários Salvos',
    frequency: 'mensal',
  },

  // ─── FINANCEIRO & ORÇAMENTO ──────────────────────────────────────────────
  {
    id: 'cpi',
    category: 'Financeiro & Orçamento',
    name: 'CPI (Cost Performance Index)',
    description: 'Índice de performance de custo. CPI < 1.0 significa estouro. Cada 0.01 de melhoria pode representar milhares de reais.',
    howToMeasureBefore: 'Se não tem EVM: comparar custo real acumulado vs custo orçado para o avanço atual. Se tem: pegar CPI do sistema existente.',
    howToMeasureAfter: 'Calculado em tempo real no módulo Financeiro/EVM, cruzando dados de medição, mão de obra e suprimentos.',
    unit: 'índice',
    typicalBefore: '0.70-0.90',
    targetAfter: '0.95-1.05',
    dataSource: 'Financeiro/EVM → CPI/SPI Cards',
    frequency: 'semanal',
  },
  {
    id: 'tempo_orcamento',
    category: 'Financeiro & Orçamento',
    name: 'Tempo de Orçamentação',
    description: 'Tempo necessário para criar um orçamento completo de uma nova obra ou aditivo.',
    howToMeasureBefore: 'Perguntar ao orçamentista: "Quanto tempo leva para montar um orçamento de obra nova?" Medir em horas.',
    howToMeasureAfter: 'Medido pelo módulo Quantitativos (wizard "Criar do Zero" com base SINAPI). Tempo entre abertura e conclusão do orçamento.',
    unit: 'horas',
    typicalBefore: '40-80h (1-2 semanas)',
    targetAfter: '8-16h (1-2 dias)',
    dataSource: 'Quantitativos → Orçamentos Salvos',
    frequency: 'por medição',
  },
  {
    id: 'divergencia_faturamento',
    category: 'Financeiro & Orçamento',
    name: 'Divergência de Faturamento',
    description: 'Percentual de discrepância entre PO, recebimento e NF na conciliação de suprimentos.',
    howToMeasureBefore: 'Pegar últimas 20 NFs e verificar quantas tinham divergência vs PO. Se não controla: assumir que NÃO faz 3-way match.',
    howToMeasureAfter: 'Calculado automaticamente no módulo Suprimentos → Conciliação (Three-Way Match). Mostra % matched, parcial e divergente.',
    unit: '%',
    typicalBefore: '15-25% com divergência',
    targetAfter: '<5% com divergência',
    dataSource: 'Suprimentos → Conciliação',
    frequency: 'mensal',
  },

  // ─── CAMPO & EXECUÇÃO ────────────────────────────────────────────────────
  {
    id: 'tempo_rdo',
    category: 'Campo & Execução',
    name: 'Tempo para Fechar RDO',
    description: 'Tempo entre o fim do dia de trabalho e o RDO estar completo e disponível para consulta.',
    howToMeasureBefore: 'Perguntar ao engenheiro de campo: "Quanto tempo leva para preencher o RDO do dia?" Se é em papel, contar até a digitalização.',
    howToMeasureAfter: 'Medido pelo timestamp de criação vs fechamento do RDO no módulo RDO. Dado disponível em tempo real.',
    unit: 'horas',
    typicalBefore: '24-72h (papel → digitação)',
    targetAfter: '<2h (digital nativo)',
    dataSource: 'RDO → Relatórios',
    frequency: 'diário',
  },
  {
    id: 'visibilidade_campo',
    category: 'Campo & Execução',
    name: 'Visibilidade do Campo para Escritório',
    description: 'Tempo entre uma ocorrência no campo e o gerente/diretor ter conhecimento dela.',
    howToMeasureBefore: 'Perguntar: "Quanto tempo leva para o diretor saber de um problema no campo?" Se por WhatsApp: imediato mas sem rastreabilidade.',
    howToMeasureAfter: 'Tempo real via Torre de Controle + alertas automáticos. Rastreável e auditável.',
    unit: 'horas',
    typicalBefore: '24-48h (ou via WhatsApp informal)',
    targetAfter: 'Tempo real (<1h)',
    dataSource: 'Torre de Controle → Alertas',
    frequency: 'diário',
  },
  {
    id: 'retrabalho',
    category: 'Campo & Execução',
    name: 'Taxa de Retrabalho',
    description: 'Percentual de serviços que precisam ser refeitos por erro de execução, material errado, ou falta de conformidade.',
    howToMeasureBefore: 'Perguntar: "Quantos trechos/serviços foram refeitos nos últimos 3 meses?" Dividir pelo total executado.',
    howToMeasureAfter: 'Rastreado via FVS (Qualidade) → NCs abertas vs trechos executados. Integrado com RDO.',
    unit: '%',
    typicalBefore: '5-15%',
    targetAfter: '<3%',
    dataSource: 'Qualidade → FVS + NCs',
    frequency: 'mensal',
  },

  // ─── SUPRIMENTOS & MATERIAIS ─────────────────────────────────────────────
  {
    id: 'ruptura_estoque',
    category: 'Suprimentos & Materiais',
    name: 'Paradas por Falta de Material',
    description: 'Número de dias/ocorrências em que a obra parou ou reduziu produtividade por falta de material.',
    howToMeasureBefore: 'Perguntar: "Quantas vezes nos últimos 3 meses a obra parou por falta de material?" Verificar RDOs se existirem.',
    howToMeasureAfter: 'Registrado no LPS como restrição tipo "Material". Contabilizado automaticamente no Constraint Register.',
    unit: 'ocorrências/mês',
    typicalBefore: '3-8x/mês',
    targetAfter: '<1x/mês',
    dataSource: 'LPS/Lean → Restrições + Suprimentos → Semáforo',
    frequency: 'mensal',
  },
  {
    id: 'lead_time_compra',
    category: 'Suprimentos & Materiais',
    name: 'Lead Time de Compra',
    description: 'Tempo entre a identificação da necessidade e a chegada do material na obra.',
    howToMeasureBefore: 'Pegar últimas 10 OCs: data da requisição vs data de entrega efetiva.',
    howToMeasureAfter: 'Calculado automaticamente no módulo Suprimentos via pipeline de Requisições (data submitted → data delivered).',
    unit: 'dias',
    typicalBefore: '15-30 dias',
    targetAfter: '7-15 dias',
    dataSource: 'Suprimentos → Requisições Pipeline',
    frequency: 'mensal',
  },

  // ─── QUALIDADE ───────────────────────────────────────────────────────────
  {
    id: 'fvs_conformidade',
    category: 'Qualidade',
    name: 'Taxa de Conformidade FVS',
    description: 'Percentual de itens de verificação que passaram na primeira inspeção (sem NC).',
    howToMeasureBefore: 'Se faz FVS em papel: contar NCs dos últimos 3 meses vs total de verificações. Se não faz FVS: baseline é 0% (não mede).',
    howToMeasureAfter: 'Calculado automaticamente no módulo Qualidade → Dashboard de FVS. % conforme vs total inspecionado.',
    unit: '%',
    typicalBefore: '60-75% (ou não mede)',
    targetAfter: '85-95%',
    dataSource: 'Qualidade → FVS Dashboard',
    frequency: 'semanal',
  },
  {
    id: 'tempo_nc',
    category: 'Qualidade',
    name: 'Tempo de Resolução de NC',
    description: 'Tempo entre abertura de uma Não Conformidade e sua resolução/fechamento.',
    howToMeasureBefore: 'Se registra NCs: pegar tempo médio de resolução. Se não: perguntar "Quanto tempo leva para corrigir um problema de qualidade identificado?"',
    howToMeasureAfter: 'Medido automaticamente no módulo Qualidade → NCs. Timestamp de abertura vs fechamento.',
    unit: 'dias',
    typicalBefore: '7-30 dias',
    targetAfter: '2-5 dias',
    dataSource: 'Qualidade → NCs',
    frequency: 'mensal',
  },

  // ─── COMUNICAÇÃO & DECISÃO ───────────────────────────────────────────────
  {
    id: 'tempo_relatorio',
    category: 'Comunicação & Decisão',
    name: 'Tempo para Gerar Relatório Gerencial',
    description: 'Tempo necessário para consolidar dados de diferentes áreas e gerar um relatório para diretoria.',
    howToMeasureBefore: 'Perguntar: "Quanto tempo leva para preparar o relatório mensal da obra para a diretoria?"',
    howToMeasureAfter: 'Gerado em <30 segundos no módulo Relatório 360 → Exportar PDF (período customizável).',
    unit: 'horas',
    typicalBefore: '8-24h (compilar planilhas)',
    targetAfter: '<0.5h (1 clique)',
    dataSource: 'Relatório 360 → PDF Export',
    frequency: 'mensal',
  },
  {
    id: 'reunioes_status',
    category: 'Comunicação & Decisão',
    name: 'Reuniões de Status Necessárias',
    description: 'Número de reuniões semanais necessárias apenas para alinhamento de status (não decisão).',
    howToMeasureBefore: 'Contar reuniões semanais que existem SÓ para "saber o que está acontecendo" (não para decidir algo).',
    howToMeasureAfter: 'Torre de Controle + Relatório 360 substituem reuniões de status. Decisões podem ser tomadas diretamente.',
    unit: 'reuniões/semana',
    typicalBefore: '3-5/semana',
    targetAfter: '1-2/semana',
    dataSource: 'Torre de Controle',
    frequency: 'semanal',
  },

  // ─── PRODUTIVIDADE ───────────────────────────────────────────────────────
  {
    id: 'produtividade_equipe',
    category: 'Produtividade',
    name: 'Metros Executados por Equipe/Dia',
    description: 'Produtividade média diária de cada equipe em metros lineares de rede executada.',
    howToMeasureBefore: 'Pegar total de metros executados no mês ÷ dias úteis ÷ número de equipes. Se não tem: estimar com engenheiro.',
    howToMeasureAfter: 'Calculado automaticamente via RDO (metros por trecho por dia) cruzado com Mão de Obra (equipes alocadas).',
    unit: 'm/equipe/dia',
    typicalBefore: 'Variável (não medido)',
    targetAfter: 'Medido com precisão diária',
    dataSource: 'RDO + Mão de Obra',
    frequency: 'diário',
  },
  {
    id: 'utilizacao_equipamento',
    category: 'Produtividade',
    name: 'Taxa de Utilização de Equipamentos',
    description: 'Percentual do tempo em que os equipamentos estão efetivamente em uso vs disponíveis/ociosos.',
    howToMeasureBefore: 'Se controla: pegar horímetro. Se não: estimar com encarregado "De 10h disponível, quanto tempo a escavadeira trabalha efetivamente?"',
    howToMeasureAfter: 'Registrado no módulo Gestão de Equipamentos via logs de utilização diários.',
    unit: '%',
    typicalBefore: '40-60%',
    targetAfter: '70-85%',
    dataSource: 'Gestão de Equipamentos → Dashboard',
    frequency: 'semanal',
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────

export function getKpisByCategory(category: string): KpiDefinition[] {
  return KPI_FRAMEWORK.filter(k => k.category === category)
}

export function getAllCategories(): string[] {
  return [...new Set(KPI_FRAMEWORK.map(k => k.category))]
}
