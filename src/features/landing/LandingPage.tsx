import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  BrainCircuit,
  Building2,
  Calendar,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Coins,
  DatabaseZap,
  FileText,
  Layers3,
  LineChart,
  Map,
  Milestone,
  PackageCheck,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { BrandLockup } from '@/components/shared/BrandLogo'
import { HeroCarousel } from './HeroCarousel'

const LOGIN_URL = '/login'
const FORM_ANCHOR = '#solicitar'
const HOW_ANCHOR = '#como-entramos'
const MICROCOPY = 'Resposta em até 1 dia útil. Você conversa com quem entende de obra, não com um vendedor de software.'

// CTA primária "Falar com engenharia" → agenda a demonstração no Calendly.
const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'
// Form nativo de qualificação (Web3Forms). Defina VITE_WEB3FORMS_KEY na Vercel; sem a chave,
// o form cai no botão do Calendly (fallback).
const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY as string | undefined

/* ── Tokens visuais da landing (tema técnico claro, somente nesta página) ──
   Base branca alternando com #f4f4f2; hairlines pretas a 10%; rótulos em
   IBM Plex Mono caixa alta com índice entre colchetes; laranja #e5484d em
   superfícies (botões, barras, dots) e #b42318 para texto pequeno laranja
   sobre claro (contraste AA). */
const H_FONT = "font-['Inter_Tight']"
const M_FONT = "font-['IBM_Plex_Mono']"

type ModuleCategory = 'gestao' | 'planejamento' | 'campo' | 'projetos' | 'suprimentos'
type ModulePain = 'avanco' | 'planilhas' | 'custo' | 'diretoria'

interface ModuleItem {
  id: string
  category: ModuleCategory
  icon: LucideIcon
  title: string
  kicker: string
  copy: string
  how: string
  efficiency: string
  features: string[]
  connected: string[]
}

const consequences: Array<[string, string]> = [
  ['Uma única origem', 'O dado nasce no RDO, na medição ou em suprimentos e segue conectado até a diretoria, sem versão paralela.'],
  ['Rastreabilidade total', 'Serviço, local, equipe, evidência, material e custo na mesma base. Toda decisão tem origem auditável.'],
  ['Tempo real', 'A diretoria vê avanço, pendência, custo e risco com contexto de campo. Sem esperar consolidação manual.'],
]

const comoEntramosSteps: Array<{ index: string; title: string; copy: string; icon: LucideIcon }> = [
  { index: '01', title: 'Diagnóstico em campo', icon: Search, copy: 'Engenheiros ConstruData acompanham a operação real, do apontamento no canteiro ao fechamento no escritório. Mapeamos onde a informação nasce, circula e se perde.' },
  { index: '02', title: 'Desenho da operação', icon: Sparkles, copy: 'Identificamos gargalos, retrabalhos e pontos cegos. Desenhamos com sua equipe os fluxos de decisão, ajustados ao seu tipo de obra e de contrato.' },
  { index: '03', title: 'Conexão e ativação', icon: DatabaseZap, copy: 'Ligamos suas fontes — planilhas, ERP, cronograma — em uma única base operacional. Medição, avanço, custo, qualidade e suprimentos passam a falar a mesma língua.' },
]

const modulePainTabs: Array<{
  id: ModulePain
  label: string
  title: string
  challenge: string
  solution: string
  outcome: string
  icon: LucideIcon
  moduleIds: string[]
}> = [
  {
    id: 'avanco',
    label: 'Não sei o avanço real da obra',
    title: 'Avanço real da obra',
    challenge:
      'A obra até produz informação, mas o avanço real demora para aparecer porque RDO, medição, fotos, equipe e gestão executiva ficam separados.',
    solution:
      'RDO, Medição e Gestão 360 conectam produção diária, evidências, critérios de medição e indicadores executivos na mesma leitura operacional.',
    outcome: 'A liderança entende o que foi executado, o que pode ser medido e o que ainda depende de aceite ou evidência.',
    icon: ClipboardCheck,
    moduleIds: ['rdo', 'medicao', 'gestao-360'],
  },
  {
    id: 'planilhas',
    label: 'Tenho retrabalho com planilhas',
    title: 'Menos planilha paralela',
    challenge:
      'Levantamentos, planilhas de medição, compras, cronogramas e relatórios vivem em arquivos diferentes, exigindo conferência manual a cada fechamento.',
    solution:
      'Quantitativos, Planejamento e Suprimentos transformam documentos e controles existentes em base estruturada para execução, compra e acompanhamento.',
    outcome: 'A equipe reduz digitação duplicada, reaproveita dados aprovados e diminui divergência entre escritório e canteiro.',
    icon: DatabaseZap,
    moduleIds: ['quantitativos', 'planejamento'],
  },
  {
    id: 'custo',
    label: 'Perco controle de custo',
    title: 'Custo sob controle operacional',
    challenge:
      'O custo real aparece tarde quando mão de obra, materiais, equipamentos e avanço físico não conversam com orçamento e produção.',
    solution:
      'EVM, Mão de Obra e Almoxarifado conectam produtividade, consumo, estoque, custo previsto e realizado por obra, frente e serviço.',
    outcome: 'A empresa enxerga desvios antes do fechamento mensal e consegue agir sobre consumo, equipe e produtividade.',
    icon: BadgeDollarSign,
    moduleIds: ['gestao-360', 'mao-de-obra', 'suprimentos'],
  },
  {
    id: 'diretoria',
    label: 'Preciso prestar contas para a diretoria',
    title: 'Prestação de contas executiva',
    challenge:
      'Diretoria, cliente e fiscalização precisam de uma visão confiável, mas os dados chegam fragmentados, sem trilha clara de origem e decisão.',
    solution:
      'Torre de Controle e Dashboard Executivo organizam exceções, status, riscos, avanço e decisões em uma rotina de comando por obra.',
    outcome: 'A conversa sai da disputa de planilhas e entra em decisão: onde agir, quem responde e qual impacto em prazo, custo e produção.',
    icon: LineChart,
    moduleIds: ['torre', 'gestao-360', 'mapa'],
  },
]

/** Screenshot da plataforma exibido para cada dor ativa (zona de produto). */
/* Dimensões REAIS por screenshot: com uma proporção fixa para todos, o browser reservava a
   caixa errada (a página pulava) e o corte comia 44% do Gestão 360, que é quase quadrado. */
const painScreens: Record<ModulePain, { src: string; path: string; w: number; h: number }> = {
  avanco: { src: '/screenshots/rdo-dashboard.webp', path: 'construdata / rdo', w: 1600, h: 732 },
  planilhas: { src: '/screenshots/quantitativos.webp', path: 'construdata / quantitativos', w: 1600, h: 722 },
  custo: { src: '/screenshots/gestao360.webp', path: 'construdata / gestão-360', w: 886, h: 895 },
  diretoria: { src: '/screenshots/torre-controle-mapa.webp', path: 'construdata / torre-de-controle', w: 1600, h: 759 },
}

const modules: ModuleItem[] = [
  {
    id: 'gestao-360',
    category: 'gestao',
    icon: Layers3,
    title: 'Gestão 360',
    kicker: 'A diretoria em tempo real',
    copy: 'CPI/SPI, curva S, custo, prazo e avanço físico-financeiro por obra, contrato e frente. Decisão de portfólio antes do fechamento do mês.',
    how: 'Cruza RDO, medição, planejamento, EVM e pendências para formar uma visão executiva única por contrato, obra e frente.',
    efficiency: 'Reduz apuração manual e antecipa decisões de portfólio, caixa, prazo e prioridade antes do fechamento do mês.',
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
    how: 'Organiza alertas, riscos, locais críticos, decisões pendentes e obras fora da curva em uma rotina de comando operacional.',
    efficiency: 'Ajuda líderes a priorizarem exceções reais, reduzindo reuniões improdutivas e atraso por falta de visibilidade.',
    features: ['Mapa de obras', 'Matriz de risco', 'Drill-down por frente'],
    connected: ['Gestão 360', 'Qualidade', 'Suprimentos', 'LPS'],
  },
  {
    id: 'medicao',
    category: 'gestao',
    icon: ClipboardCheck,
    title: 'Medição',
    kicker: 'Memória defensável',
    copy: 'Avanço, evidência, memória de cálculo e critério contratual vinculados antes da aprovação. Menos glosa. Menos divergência entre campo, contrato e cliente.',
    how: 'Vincula avanço, evidência, memória de cálculo, fornecedor e critérios contratuais antes da aprovação humana.',
    efficiency: 'Diminui glosas, retrabalho de conferência e divergência entre campo, contrato, financeiro e cliente.',
    features: ['Memória de cálculo', 'Pendências bloqueantes', 'Aprovação humana'],
    connected: ['RDO', 'Suprimentos', 'Qualidade', 'Planejamento'],
  },
  {
    id: 'relatorio-360',
    category: 'gestao',
    icon: ClipboardList,
    title: 'Relatório 360',
    kicker: 'Relato executivo conectado',
    copy: 'Consolida fotos, atividades, equipamentos e materiais do dia em um relatório executivo rastreável por obra.',
    how: 'Reúne evidências, produção, equipe e ocorrências do campo em um relato único, ligado ao RDO e à medição.',
    efficiency: 'Reduz o tempo de montar relatório gerencial e mantém cada número com origem no campo.',
    features: ['Fotos com contexto', 'Atividades do dia', 'Exportação executiva'],
    connected: ['RDO', 'Medição', 'Gestão 360', 'Torre'],
  },
  {
    id: 'planejamento',
    category: 'planejamento',
    icon: CalendarClock,
    title: 'Planejamento',
    kicker: 'Baseline, avanço e tendência',
    copy: 'Conecta cronograma, WBS, marcos, frente física e avanço aprovado sem alterar baseline automaticamente.',
    how: 'Relaciona atividades planejadas, produção real, restrições, marcos e desvios em uma base operacional auditável.',
    efficiency: 'Aumenta previsibilidade e reduz o tempo gasto reconciliando cronograma, planilhas e reportes de obra.',
    features: ['WBS e marcos', 'Gantt operacional', 'Avanço aprovado'],
    connected: ['RDO', 'Medição', 'LPS', 'EVM'],
  },
  {
    id: 'lps',
    category: 'planejamento',
    icon: BrainCircuit,
    title: 'LPS / Lean',
    kicker: 'Last Planner nativo',
    copy: 'Look-ahead, restrições, compromissos, PPC (programação cumprida) e causas de não cumprimento conectados ao cronograma real.',
    how: 'Transforma restrições, compromissos semanais, causas de falha e PPC em sinais conectados ao planejamento mestre.',
    efficiency: 'Antecipa bloqueios antes que virem atraso e melhora o cumprimento dos pacotes de trabalho no canteiro.',
    features: ['Look-ahead 6 semanas', 'PPC semanal', 'Restrições conectadas'],
    connected: ['Planejamento', 'Suprimentos', 'Mão de Obra', 'Qualidade'],
  },
  {
    id: 'planejamento-mestre',
    category: 'planejamento',
    icon: Milestone,
    title: 'Planejamento Mestre',
    kicker: 'Linha de base e marcos',
    copy: 'Estrutura o plano mestre, marcos contratuais e baselines que orientam trechos, EVM e look-ahead.',
    how: 'Organiza fases, marcos, restrições macro e metas por contrato, servindo de referência para o planejamento de execução.',
    efficiency: 'Dá uma régua única de prazo para toda a obra e reduz divergência entre plano contratual e execução.',
    features: ['Marcos contratuais', 'Baseline auditável', 'Metas por fase'],
    connected: ['Trechos', 'EVM', 'LPS', 'Gestão 360'],
  },
  {
    id: 'agenda',
    category: 'planejamento',
    icon: Calendar,
    title: 'Agenda',
    kicker: 'Cronograma visual da semana',
    copy: 'Transforma atividades planejadas em uma agenda operacional por equipe, frente e período.',
    how: 'Cruza cronograma, equipes e recursos para mostrar o que cada frente executa em cada dia, sem planilha à parte.',
    efficiency: 'Reduz furo de programação e ajuda a equilibrar equipe e recurso ao longo da semana.',
    features: ['Linha do tempo por equipe', 'Recursos alocados', 'Visão semanal'],
    connected: ['Trechos', 'LPS', 'Mão de Obra', 'Planejamento Mestre'],
  },
  {
    id: 'financeiro',
    category: 'gestao',
    icon: TrendingUp,
    title: 'Financeiro / EVM',
    kicker: 'Valor agregado e impostos',
    copy: 'Acompanha custo previsto e realizado, valor agregado (EVM) e impostos de NF por obra, frente e serviço.',
    how: 'Conecta orçamento, medição, suprimentos e avanço físico para calcular CPI/SPI e o resultado financeiro real.',
    efficiency: 'Mostra o desvio de custo e prazo antes do fechamento e dá base para decisão de caixa e contrato.',
    features: ['Valor agregado (EVM)', 'CPI e SPI', 'Impostos de NF'],
    connected: ['Quantitativos', 'Medição', 'Suprimentos', 'Gestão 360'],
  },
  {
    id: 'rdo',
    category: 'campo',
    icon: FileText,
    title: 'RDO',
    kicker: 'O campo que vira decisão',
    copy: 'Serviço, local, equipe, equipamento, material, foto e assinatura, com rastreabilidade de origem. O RDO fechado alimenta medição, qualidade e planejamento. Sem planilha paralela.',
    how: 'Captura a rotina diária com evidências, responsáveis, condições de execução e vínculo com serviços planejados.',
    efficiency: 'Transforma dado de campo em origem de medição, qualidade e planejamento, reduzindo planilhas paralelas.',
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
    how: 'Organiza checklists, fotos, ocorrências, aceite técnico e pendências de liberação por serviço, frente e responsável.',
    efficiency: 'Evita fechamento sem evidência, reduz retrabalho e cria trilha clara para liberar avanço com segurança.',
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
    how: 'Relaciona equipe diária, função, frente, produção, produtividade e certificações necessárias para cada serviço.',
    efficiency: 'Melhora alocação, reduz ociosidade e permite comparar produtividade prevista contra realizada.',
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
    how: 'Acompanha disponibilidade, uso, parada, manutenção preventiva, custo e vínculo com a frente executada.',
    efficiency: 'Aumenta disponibilidade operacional e ajuda a evitar gargalos por equipamento parado ou mal alocado.',
    features: ['Controle de uso', 'Manutenção preventiva', 'Custo operacional'],
    connected: ['RDO', 'LPS', 'Suprimentos', 'EVM'],
  },
  {
    id: 'manutencoes',
    category: 'campo',
    icon: Settings2,
    title: 'Manutenções',
    kicker: 'Ativos e ordens de serviço',
    copy: 'Controla ativos, planos preventivos, ordens de serviço e pontos de monitoramento por obra.',
    how: 'Liga ativo, plano de manutenção, ordem de serviço e evidência ao custo e à disponibilidade no campo.',
    efficiency: 'Antecipa parada por manutenção e reduz custo de corretiva com plano preventivo conectado.',
    features: ['Plano preventivo', 'Ordens de serviço', 'Monitoramento de ativos'],
    connected: ['Equipamentos', 'RDO', 'Suprimentos', 'EVM'],
  },
  {
    id: 'bim',
    category: 'projetos',
    icon: Building2,
    title: 'BIM 3D/4D/5D',
    kicker: 'Modelo, tempo e custo',
    copy: 'Aproxima projeto, cronograma, orçamento e avanço real para transformar modelo em operação.',
    how: 'Conecta modelo, atividades, quantitativos, custos e avanço aprovado para comparar projeto com execução.',
    efficiency: 'Dá contexto visual ao planejamento e reduz desalinhamento entre projeto, orçamento e obra real.',
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
    how: 'Usa localização, frente, trecho, evidências e status como referência comum entre campo, fiscalização e medição.',
    efficiency: 'Reduz perda de informação espacial e acelera decisões em obras distribuídas por rua, núcleo ou lote.',
    features: ['Redes e trechos', 'Status por local', 'Base para RDO e medição'],
    connected: ['RDO', 'Medição', 'Planejamento', 'Torre'],
  },
  {
    id: 'quantitativos',
    category: 'projetos',
    icon: BadgeDollarSign,
    title: 'Quantitativos',
    kicker: 'Orçamento para execução',
    copy: 'Itens, composições, bases SINAPI/SEINFRA e N. Preço viram referência para planejamento, medição e EVM (valor agregado).',
    how: 'Estrutura unidades, composições, memória de cálculo, bases de preço e vínculo com serviços executáveis.',
    efficiency: 'Acelera orçamento, reduz erro de levantamento e cria referência confiável para medir avanço e custo.',
    features: ['SINAPI e SEINFRA', 'BDI e composições', 'Exportação estruturada'],
    connected: ['Medição', 'EVM', 'Planejamento', 'BIM'],
  },
  {
    id: 'economia',
    category: 'gestao',
    icon: Coins,
    title: 'Economia',
    kicker: 'Eficiência medida em R$',
    copy: 'Mede a economia e a eficiência geradas pela operação conectada, por obra e por iniciativa.',
    how: 'Compara baseline e realizado em tempo, retrabalho, compras e produtividade para quantificar o ganho.',
    efficiency: 'Transforma o ganho operacional em número defensável para diretoria e cliente.',
    features: ['Baseline x realizado', 'Ganho por iniciativa', 'Indicadores de eficiência'],
    connected: ['Gestão 360', 'EVM', 'Suprimentos', 'Mão de Obra'],
  },
  {
    id: 'suprimentos',
    category: 'suprimentos',
    icon: PackageCheck,
    title: 'Suprimentos',
    kicker: 'Compra, recebimento e NF',
    copy: 'Vincula requisição, pedido, recebimento, nota fiscal e fornecedor ao planejamento e à medição.',
    how: 'Conecta necessidade planejada, requisição, compra, entrega, nota fiscal, fornecedor e impacto operacional.',
    efficiency: 'Reduz risco de falta de material, divergência de nota e atraso por compra desconectada do cronograma.',
    features: ['Three-Way Match', 'Recebimento e NF', 'Scorecard de fornecedor'],
    connected: ['Medição', 'LPS', 'Planejamento', 'EVM'],
  },
  {
    id: 'predial',
    category: 'campo',
    icon: Building2,
    title: 'Predial',
    kicker: 'Ativos, laudos e chamados do prédio',
    copy: 'Inventário de ativos, manutenções, laudos de compliance, criticidade e chamados por QR: a gestão do edificado na mesma base.',
    how: 'Liga ativo, plano preventivo, laudo obrigatório, chamado e custo por prédio, torre, pavimento e ambiente.',
    efficiency: 'Antecipa laudo vencendo e manutenção crítica, com relatório pronto para a assembleia.',
    features: ['Inventário de ativos', 'Laudos e compliance', 'Chamado por QR'],
    connected: ['Manutenções', 'Equipamentos', 'Financeiro', 'Gestão 360'],
  },
]

const impactRows: Array<[string, string, string]> = [
  ['Custo', '3 a 5% de redução no custo total sobre o faturamento', 'Conferência tripla: pedido × recebimento × nota.'],
  ['RDO', '6 h/dia economizadas por obra só no RDO', 'Medido no Consórcio Se Liga na Rede.'],
  ['Orçamentação', '80% menos tempo de orçamentação', 'O relatório nasce do RDO, não de consolidação manual.'],
  ['Suprimentos', '40% menos risco de falta de material', 'Alertas preditivos sobre a cadeia de suprimentos.'],
  ['Implantação', 'Semanas da assinatura à primeira frente em produção', 'Não meses.'],
]

const differentiators: Array<[string, string, string]> = [
  ['01', 'Campo-primeiro', 'O sistema é construído a partir do canteiro. Quando o engenheiro fecha o RDO, cronograma, medição e suprimentos se ajustam sozinhos.'],
  ['02', 'Decisão antes do relatório', 'A plataforma cruza avanço, custo e restrição e aponta a próxima ação, antes que o problema vire atraso, glosa ou custo oculto.'],
  ['03', 'Lean nativo', 'Last Planner System integrado ao cronograma real: look-ahead de 6 semanas, PPC semanal, restrições e causas de não cumprimento.'],
  ['04', 'Sem ruptura', 'Aproveitamos as planilhas, medições e RDOs que a obra já usa. O controle amadurece sem trocar tudo no primeiro dia.'],
]

const audience: Array<[string, string, string]> = [
  ['Construtoras de médio porte', 'A diretoria vê o resultado tarde demais.', 'Campo, medição, custo e prazo na mesma base, por obra.'],
  ['Saneamento e infraestrutura', 'Serviço por rua, núcleo e OS espalhado entre equipes e fiscais.', 'RDO, mapa, cronograma e medição com os mesmos códigos e locais.'],
  ['EPC e consórcios', 'Várias empresas entregando juntas, governança exigindo rastreabilidade.', 'Aprovações, evidências e auditoria em ambiente multiempresa.'],
  ['Empreiteiras', 'Produção executada demora a virar medição defensável.', 'RDO finalizado gera rascunho de medição por empreiteiro, serviço e evidência.'],
  ['Engenharia ambiental', 'Condicionantes e prazos de órgão exigem evidência rastreável.', 'Evidência com origem e contexto, ligada ao avanço de cada frente.'],
]

const autonomyCards: Array<[string, string, string]> = [
  ['No canteiro', 'O engenheiro', 'vê o impacto de cada registro no cronograma, na medição e na qualidade. Registra o que importa.'],
  ['No escritório', 'O gerente', 'acompanha CPI/SPI sem relatório manual. Realoca equipe e aprova pedido com contexto.'],
  ['No celular', 'O diretor', 'abre a plataforma e entende, em segundos, o que está de pé e o que está caindo.'],
]

const testimonials: Array<{ company: string; segment: string; quote: string; result: string; hasNumber?: boolean }> = [
  {
    company: 'Consórcio Se Liga Na Rede',
    segment: 'Saneamento',
    quote: 'Quando RDO, planejamento e medição conversam, a gestão deixa de discutir planilha e passa a discutir decisão.',
    result: 'Entramos nas obras por todos os setores, ouvindo os colaboradores de diversas áreas e configurando o fluxo de cada equipe. Só nos Relatórios Diários de Obra, economizamos cerca de 6 horas por dia, com um único módulo.',
    hasNumber: true,
  },
  {
    company: 'Engelfer Engenharia',
    segment: 'Edificação',
    quote: 'A plataforma coloca o dado de campo no centro da decisão, sem depender de consolidação manual.',
    result: 'Entramos na obra, ouvimos as equipes e configuramos o fluxo de cada frente, do RDO à medição, antes de conectar tudo.',
  },
  {
    company: 'Vila Rica Engenharia',
    segment: 'Construção civil',
    quote: 'O valor está em rastrear origem, pendência e responsabilidade antes que o problema chegue ao fechamento.',
    result: 'Entramos na obra, mapeamos os processos e identificamos melhorias, ajustando a configuração ao contexto de cada equipe.',
  },
]

/* Clientes em produção. Arquivos otimizados (WebP, recortados); Vila Rica e Atlântico tiveram
   o fundo sólido removido (a marca virou tinta sobre transparente) para funcionar no card claro.
   O nome vive no `alt` — visualmente fica só a marca. */
const logos: Array<{ src: string; nome: string; w: number; h: number }> = [
  { src: '/logos/social-proof/engelfer.webp', nome: 'Engelfer Engenharia', w: 640, h: 155 },
  { src: '/logos/social-proof/cslnr.webp', nome: 'Consórcio Se Liga na Rede', w: 327, h: 288 },
  { src: '/logos/social-proof/wcr.webp', nome: 'WCR Saneamento', w: 340, h: 182 },
  { src: '/logos/social-proof/vila-rica.webp', nome: 'Vila Rica Engenharia', w: 320, h: 320 },
  { src: '/logos/social-proof/compizzo.webp', nome: 'Compizzo', w: 288, h: 53 },
  { src: '/logos/social-proof/atlantico.webp', nome: 'Atlântico Engenharia', w: 168, h: 206 },
]

/* Realizações — obras por empresa. Sem foto: a seção é um ledger técnico
   (obra · cliente · setor · o que mudou). `result` = "Setor · mecanismo". */
const realizacoes: Array<{ obra: string; empresa: string; result: string }> = [
  { obra: 'São Manoel', empresa: 'Consórcio Se Liga Na Rede', result: 'Saneamento · cerca de 6h/dia economizadas só no RDO' },
  { obra: 'Pantanal Baixo', empresa: 'Consórcio Se Liga Na Rede', result: 'Saneamento · RDO, medição e avanço por trecho conectados' },
  { obra: 'João Carlos', empresa: 'Consórcio Se Liga Na Rede', result: 'Saneamento · medição defensável por período e frente' },
  { obra: 'Morro do Tetéu', empresa: 'Consórcio Se Liga Na Rede', result: 'Saneamento · RDO digital configurado por equipe' },
  { obra: 'Vila dos Criadores', empresa: 'Consórcio Se Liga Na Rede', result: 'Saneamento · planejamento e campo na mesma base' },
  { obra: 'Vila Israel', empresa: 'Consórcio Se Liga Na Rede', result: 'Saneamento · cerca de 6h/dia economizadas só no RDO' },
  { obra: 'Obras de edificação', empresa: 'Vila Rica Engenharia', result: 'Edificação · processos mapeados e fluxo configurado por frente' },
  { obra: 'Pisos industriais', empresa: 'Compizzo Epoxi', result: 'Pisos industriais · economia e eficiência medidas por obra' },
  { obra: 'Obras de engenharia', empresa: 'Engelfer', result: 'Engenharia · do RDO à medição numa base única' },
]

const faqs: Array<[string, string]> = [
  ['Quanto tempo leva para implantar?', 'Depende da qualidade dos dados e do escopo inicial. Uma implantação enxuta pode começar por uma obra, um fluxo e poucos módulos críticos. Conforme os dados são validados, a empresa amplia para planejamento, qualidade, suprimentos, EVM, BIM e gestão executiva, em semanas, não meses.'],
  ['O ConstruData substitui minhas planilhas no primeiro dia?', 'Não precisa. A implantação pode começar absorvendo as planilhas, PDFs, fotos e controles que a empresa já usa. Ele organiza essas informações, preserva a origem dos dados e transforma o que antes era planilha solta em base rastreável para medição, planejamento, RDO, qualidade e gestão executiva.'],
  ['Preciso mudar todos os processos antes de usar?', 'Não. A implantação pode ser progressiva. Primeiro entram os dados essenciais e os fluxos mais críticos, como RDO, medição, planejamento ou suprimentos. Depois a empresa amadurece os demais módulos conforme a operação ganha confiança e padronização.'],
  ['Funciona para saneamento, infraestrutura e engenharia ambiental?', 'Sim. A estrutura foi pensada para contratos com núcleos, ruas, trechos, frentes de serviço, OS, equipes, materiais, fotos e medições por período, incluindo condicionantes e relatórios de conformidade ambiental. O mapa, o RDO e a medição usam a mesma chave operacional para reduzir divergência entre campo, fiscalização e escritório.'],
  ['A plataforma conversa com SINAPI, SEINFRA, BIM e cronogramas?', 'Sim. Ele foi desenhado para conectar bases técnicas, composições, orçamento, modelos BIM, cronogramas e execução real. A ideia não é trocar todos os sistemas de uma vez, mas criar uma camada operacional que faça esses dados conversarem com menos retrabalho.'],
  ['Como começa uma obra nova?', 'Uma obra normalmente começa com contrato, proposta, orçamento, cronograma, frentes ou núcleos, responsáveis, fornecedores, subempreiteiros, critérios de medição e modelo de RDO. A partir disso, o sistema cria a base para acompanhar avanço, pendências, evidências, equipe, equipamentos, qualidade e suprimentos.'],
  ['O RDO fecha automaticamente a medição?', 'O RDO pode alimentar a medição quando existe vínculo suficiente entre serviço, local, quantidade, período, equipe e evidência. Mesmo assim, o fechamento continua exigindo revisão humana. A lógica é acelerar a conferência e reduzir retrabalho, sem tirar o controle técnico e financeiro de quem aprova.'],
  ['Quem consegue usar no campo pelo celular?', 'Engenheiros, encarregados, técnicos, fiscais e equipes autorizadas podem registrar informações pelo celular, conforme permissões da empresa. A experiência é pensada para o canteiro: poucos cliques, campos objetivos, fotos, ocorrências, equipe, equipamentos e serviços executados.'],
  ['Como o ConstruData evita dados falsos ou sem origem?', 'Cada informação importante precisa manter vínculo com origem, responsável, data, obra, frente, serviço e evidência quando aplicável. O sistema diferencia rascunho, dado importado, dado validado e dado aprovado, criando uma trilha de auditoria para reduzir discussões no fechamento.'],
  ['É possível controlar várias empresas ou obras na mesma conta?', 'Sim. O ambiente é multiempresa e multiobra. Usuários globais ou administradores podem alternar entre empresas autorizadas, enquanto cada equipe comum acessa apenas o que foi liberado por perfil, organização e permissão.'],
  ['O sistema serve para empreiteiros e subcontratados?', 'Sim. Empreiteiros podem ter controles de produção, evidências, medições, pendências e aprovações vinculadas ao contrato. Isso ajuda a tornar o fechamento mais claro, com menos troca de mensagens e menos divergência sobre o que foi executado.'],
  ['O que acontece quando falta informação para criar uma obra completa?', 'O sistema pode trabalhar com checklist de pendências. O que já existe entra como base, e o que falta fica sinalizado: contrato final, endereço, áreas, quantitativos, cronograma, responsáveis, fornecedores, critérios de aceite, fotos iniciais e regras de medição.'],
  ['O sistema decide sozinho?', 'Não. O ConstruData estrutura o dado, aponta o desvio e recomenda a próxima ação. A decisão é sempre humana, registrada, com responsável e rastreável. A tecnologia amplifica o julgamento da sua equipe. Não o substitui.'],
  ['Como sei se o sistema está gerando eficiência de verdade?', 'A eficiência aparece em indicadores práticos: menos tempo para fechar medição, menos planilhas paralelas, menos RDO incompleto, maior previsibilidade de prazo, menos falta de material, menos retrabalho de conferência e mais decisões tomadas com dado de campo rastreável.'],
]

function useScrollReveal() {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    const root = document.documentElement
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('sr-visible')
            observer.unobserve(e.target)
          }
        }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    )
    const observe = (el: Element) => {
      if (el.classList.contains('sr-visible')) return
      // O que JÁ está na viewport nasce visível: nada de esconder-para-revelar o
      // conteúdo above-the-fold (era o motivo de o hero demorar a aparecer).
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('sr-visible')
      else observer.observe(el)
    }
    document.querySelectorAll('[data-sr]').forEach(observe)
    // Só agora o CSS passa a esconder os [data-sr] ainda não revelados (ver globals.css):
    // sem JS, ou antes dele, a página inteira permanece visível.
    root.classList.add('sr-ready')
    // Conteúdo montado DEPOIS (troca de aba dos módulos, drills, etc.) também precisa ser
    // observado — senão nasceria escondido pelo CSS e nunca receberia `sr-visible`.
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue
          if (node.matches('[data-sr]')) observe(node)
          node.querySelectorAll?.('[data-sr]').forEach(observe)
        }
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mo.disconnect()
      root.classList.remove('sr-ready')
    }
  }, [])
}

/** Número com contagem progressiva ao entrar em viewport (Impacto). */
function CountUpNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  // Em reduced-motion o valor final entra direto, sem animação.
  const [n, setN] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? value : 0,
  )
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        const t0 = performance.now()
        const tick = (t: number) => {
          const p = Math.min((t - t0) / 1200, 1)
          setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value])
  return <span ref={ref}>{n}</span>
}

/** Renderiza o texto intacto, envolvendo cada número em CountUpNumber. */
function AnimatedNumbers({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\d+)/).map((part, i) =>
        /^\d+$/.test(part) ? <CountUpNumber key={i} value={Number(part)} /> : <span key={i}>{part}</span>,
      )}
    </>
  )
}

/** Cantoneiras de 8px nos 4 cantos de um card (motivo de frame técnico). */
function Corners() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 size-2 border-l border-t border-black/30" />
      <span aria-hidden className="pointer-events-none absolute right-0 top-0 size-2 border-r border-t border-black/30" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 size-2 border-b border-l border-black/30" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 size-2 border-b border-r border-black/30" />
    </>
  )
}

/* Section header: eyebrow mono com índice entre colchetes, headline grande
   em Inter Tight à esquerda, copy de apoio à direita, hairline abaixo. */
function SectionHeader({
  index,
  eyebrow,
  title,
  copy,
}: {
  index?: string
  eyebrow: string
  title?: string
  copy?: string
}) {
  return (
    <div data-sr className="mx-auto max-w-7xl px-5 md:px-10">
      <div className="grid gap-6 border-b border-black/10 pb-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div>
          <p className={`${M_FONT} text-[11px] font-medium uppercase tracking-[0.2em] text-black/50`}>
            {index && <span className="mr-3 text-[#b42318]">[ {index} ]</span>}
            {eyebrow}
          </p>
          {title && (
            <h2 className={`${H_FONT} mt-6 max-w-3xl text-3xl font-medium leading-[1.05] tracking-[-0.03em] text-[#0a0a0a] sm:text-5xl lg:text-6xl`}>
              {title}
            </h2>
          )}
        </div>
        {copy && (
          <p className="max-w-xl text-base leading-7 text-black/55 lg:justify-self-end lg:text-right">{copy}</p>
        )}
      </div>
    </div>
  )
}

/* Primary CTA — single label across the page; scrolls to the form. */
function DemoCTA({
  align = 'left',
  microcopy = true,
  tone = 'dark',
}: { align?: 'left' | 'center'; microcopy?: boolean; tone?: 'light' | 'dark' }) {
  const isLight = tone === 'light'
  return (
    <div data-sr className={`flex flex-col gap-3 ${align === 'center' ? 'items-center text-center' : 'items-start'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${M_FONT} group inline-flex min-h-12 items-center justify-center gap-3 bg-[#cc2b33] px-7 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#b3242b]`}
        >
          Falar com engenharia <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
        </a>
        <a
          href={HOW_ANCHOR}
          className={`${M_FONT} group inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${
            isLight ? 'text-white/85 hover:text-[#f87171]' : 'text-[#0a0a0a] hover:text-[#d13b40]'
          }`}
        >
          Ver como funciona <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
        </a>
      </div>
      {microcopy && <p className={`max-w-md text-xs leading-5 ${isLight ? 'text-white/65' : 'text-black/45'}`}>{MICROCOPY}</p>}
    </div>
  )
}

/** Moldura tipo browser para screenshots da plataforma. */
function ScreenFrame({ src, path, alt, w, h }: { src: string; path: string; alt: string; w: number; h: number }) {
  return (
    <figure className="relative overflow-hidden border border-black/15 bg-white">
      <Corners />
      <div className="flex items-center gap-2 border-b border-black/10 px-4 py-2.5">
        <span className="flex gap-1.5">
          {[0, 1, 2].map((d) => (
            <span key={d} className="size-2 rounded-full bg-black/15" />
          ))}
        </span>
        <figcaption className={`${M_FONT} ml-2 truncate text-[10px] uppercase tracking-[0.16em] text-black/40`}>
          {path}
        </figcaption>
      </div>
      {/* Dimensões reais → o browser reserva a caixa exata (zero CLS) e a imagem aparece
          inteira. Antes: 1408×768 fixo para todos = caixa errada + corte. */}
      <img src={src} alt={alt} width={w} height={h} loading="lazy" decoding="async" className="block h-auto w-full bg-[#f4f4f2]" />
    </figure>
  )
}

function ModulesSection() {
  const [activePain, setActivePain] = useState<ModulePain>('avanco')
  const activeDetails = modulePainTabs.find((pain) => pain.id === activePain) ?? modulePainTabs[0]
  const ActiveIcon = activeDetails.icon
  const activeScreen = painScreens[activePain]
  const activeModules = activeDetails.moduleIds
    .map((moduleId) => modules.find((module) => module.id === moduleId))
    .filter((module): module is ModuleItem => Boolean(module))

  return (
    <section id="modulos" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
      <SectionHeader
        index="07"
        eyebrow="Módulos"
        title="Escolha o problema. O módulo é consequência."
        copy="Tudo conversando na mesma base, em tempo real. O dado de campo vira decisão em segundos, e o gestor antecipa o problema antes que ele vire atraso, glosa ou custo oculto."
      />

      <div className="mx-auto mt-12 max-w-7xl px-5 md:px-10">
        {/* Pain-point tabs — underline style */}
        <div className="flex flex-col gap-0 border-b border-black/10 sm:flex-row sm:flex-wrap sm:gap-8">
          {modulePainTabs.map((pain) => (
            <button
              key={pain.id}
              type="button"
              onClick={() => setActivePain(pain.id)}
              className={`group relative min-h-12 border-b-2 py-3 text-left text-sm font-semibold transition-colors sm:border-b-0 sm:pb-5 ${
                activePain === pain.id
                  ? 'border-[#e5484d] text-[#0a0a0a] sm:border-b-2'
                  : 'border-transparent text-black/45 hover:text-[#0a0a0a]'
              }`}
            >
              {pain.label}
              {activePain === pain.id && (
                <span className="absolute -bottom-[2px] left-0 hidden h-[2px] w-full bg-[#e5484d] sm:block" />
              )}
            </button>
          ))}
        </div>

        {/* Active pain: context + screenshot (left) + relevant modules (right) */}
        <div
          key={activePain}
          className="grid animate-[fadeIn_0.4s_ease-out] grid-cols-1 border-b border-black/10 lg:grid-cols-[0.42fr_0.58fr]"
        >
          <aside className="border-b border-black/10 bg-white p-6 sm:p-9 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center bg-[#0a0a0a] text-white">
                <ActiveIcon size={22} />
              </span>
              <h3 className={`${H_FONT} text-2xl font-medium leading-tight tracking-[-0.02em] text-[#0a0a0a] sm:text-3xl`}>
                {activeDetails.title}
              </h3>
            </div>
            <p className="mt-7 text-base font-medium leading-7 text-[#0a0a0a] sm:text-lg">{activeDetails.challenge}</p>
            <p className="mt-5 text-base leading-7 text-black/55 sm:text-lg">{activeDetails.solution}</p>
            <div className="mt-8 border-l-2 border-[#e5484d] pl-5">
              <p className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b42318]`}>Resultado mensurável</p>
              <p className="mt-2 leading-7 text-black/65">{activeDetails.outcome}</p>
            </div>
            <div className="mt-8">
              <ScreenFrame src={activeScreen.src} path={activeScreen.path} w={activeScreen.w} h={activeScreen.h} alt={`Tela da plataforma: ${activeDetails.title}`} />
            </div>
          </aside>

          <div className="divide-y divide-black/10 bg-white">
            {activeModules.map((module) => {
              const Icon = module.icon
              return (
                <div key={module.id} className="group flex items-start gap-5 p-6 transition-colors duration-200 hover:bg-[#f4f4f2] sm:p-9">
                  <div className="flex size-12 shrink-0 items-center justify-center border border-black/15 bg-white text-[#e5484d] transition-colors duration-200 group-hover:border-[#e5484d] group-hover:bg-[#cc2b33] group-hover:text-white">
                    <Icon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className={`${H_FONT} text-xl font-medium leading-tight tracking-[-0.02em] text-[#0a0a0a] sm:text-2xl`}>
                        {module.title}
                      </h4>
                      <span className={`${M_FONT} text-[9px] font-semibold uppercase tracking-[0.14em] text-[#b42318]`}>{module.kicker}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-black/60">{module.copy}</p>
                    <p className="mt-2 text-sm leading-6 text-black/45">
                      <strong className="font-semibold text-black/70">Como faz:</strong> {module.how}
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-black/45">
                      <strong className="font-semibold text-black/70">Resultado:</strong> {module.efficiency}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* All modules grid */}
        <div className="mt-16">
          <p className={`${M_FONT} text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40`}>20 módulos. Uma ontologia.</p>
          <p className={`${H_FONT} mt-2 max-w-2xl text-lg font-medium leading-snug tracking-[-0.02em] text-[#0a0a0a]`}>Uma plataforma, implantada dentro da sua operação. Não imposta a ela.</p>
          <div className="mt-6 grid grid-cols-1 border-t border-l border-black/10 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module, i) => {
              const Icon = module.icon
              return (
                <article
                  key={module.id}
                  data-sr
                  data-sr-delay={String((i % 3) + 1)}
                  className="group relative flex min-h-[230px] flex-col border-b border-r border-black/10 bg-white p-6 transition-colors duration-300 hover:bg-[#f4f4f2] sm:p-7"
                >
                  <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#e5484d] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  <div className="flex items-start justify-between">
                    <div className="flex size-11 items-center justify-center border border-black/15 text-[#e5484d] transition-colors duration-300 group-hover:border-[#e5484d]">
                      <Icon size={20} />
                    </div>
                    <span className={`${M_FONT} text-[9px] font-semibold uppercase tracking-[0.14em] text-[#b42318]`}>{module.kicker}</span>
                  </div>
                  <h4 className={`${H_FONT} mt-7 text-2xl font-medium leading-tight tracking-[-0.02em] text-[#0a0a0a]`}>
                    {module.title}
                  </h4>
                  <p className="mt-3 text-sm leading-6 text-black/55">{module.copy}</p>
                  <div className={`${M_FONT} mt-auto flex items-center gap-2 pt-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35`}>
                    Conecta com {module.connected.slice(0, 2).join(', ')}
                    <ArrowUpRight size={13} className="text-[#e5484d] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </article>
              )
            })}
          </div>

          <div className="mt-12">
            <DemoCTA />
          </div>
        </div>
      </div>
    </section>
  )
}


/* Form nativo de qualificação → Web3Forms. Sem VITE_WEB3FORMS_KEY, cai no botão do Calendly. */
const inputCls = 'w-full border border-black/15 bg-white px-3 py-2.5 text-sm text-[#0a0a0a] outline-none transition focus:border-[#e5484d]'
const inputLabelCls = "mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-black/50"

function LeadField({ name, label, type = 'text', required = false, textarea = false }: { name: string; label: string; type?: string; required?: boolean; textarea?: boolean }) {
  return (
    <label className="block">
      <span className={`${inputLabelCls} font-['IBM_Plex_Mono']`}>{label}{required && <span className="text-[#b42318]"> *</span>}</span>
      {textarea
        ? <textarea name={name} required={required} rows={3} className={inputCls} />
        : <input name={name} type={type} required={required} autoComplete="off" className={inputCls} />}
    </label>
  )
}

function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!WEB3FORMS_KEY) return
    const form = e.currentTarget
    setStatus('sending')
    const data = new FormData(form)
    data.append('access_key', WEB3FORMS_KEY)
    data.append('subject', 'Novo lead — ConstruData')
    data.append('from_name', 'Landing ConstruData')
    try {
      const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: data })
      const json = (await res.json()) as { success?: boolean }
      if (json.success) { form.reset(); setStatus('ok') } else setStatus('error')
    } catch { setStatus('error') }
  }

  if (!WEB3FORMS_KEY) {
    return (
      <div className="border border-black/10 bg-black/[0.02] p-8 text-center">
        <p className="text-sm leading-6 text-black/55">Escolha um horário direto na agenda do nosso time de engenharia.</p>
        <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className={`${M_FONT} mt-5 inline-flex min-h-12 items-center justify-center gap-2 bg-[#cc2b33] px-7 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#b3242b]`}>
          Falar com engenharia <ArrowRight size={15} />
        </a>
      </div>
    )
  }

  if (status === 'ok') {
    return (
      <div role="status" aria-live="polite" className="border border-black/10 bg-[#f4f4f2] p-10 text-center">
        <p className={`${H_FONT} text-2xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>Recebemos o seu contato.</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-black/60">
          Resposta em até 1 dia útil. Prefere marcar agora?{' '}
          <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#b42318] underline underline-offset-2">Agende no Calendly</a>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <p className="sr-only" aria-live="polite">{status === 'sending' ? 'Enviando seu contato…' : ''}</p>
      <LeadField name="nome" label="Nome" required />
      <LeadField name="email" type="email" label="E-mail corporativo" required />
      <LeadField name="empresa" label="Empresa" required />
      <LeadField name="cargo" label="Cargo" />
      <div className="sm:col-span-2"><LeadField name="dor" label="Sua principal dor" textarea /></div>
      {status === 'error' && (
        <p role="alert" className="text-sm text-[#b42318] sm:col-span-2">Não foi possível enviar agora. Tente novamente ou agende direto no Calendly.</p>
      )}
      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={status === 'sending'}
          className={`${M_FONT} group inline-flex min-h-12 items-center justify-center gap-2 bg-[#cc2b33] px-7 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#b3242b] disabled:opacity-60`}
        >
          {status === 'sending' ? 'Enviando…' : 'Falar com engenharia'} <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
        </button>
        <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className={`${M_FONT} inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0a0a0a] transition hover:text-[#d13b40]`}>
          ou agende direto <ArrowRight size={13} />
        </a>
      </div>
    </form>
  )
}

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const topSentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = topSentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), { threshold: 0 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const html = document.documentElement
    const previousTheme = html.getAttribute('data-theme')
    html.removeAttribute('data-theme')
    return () => {
      if (previousTheme) html.setAttribute('data-theme', previousTheme)
      else html.removeAttribute('data-theme')
    }
  }, [])

  useScrollReveal()

  return (
    <div className={`${H_FONT} min-h-screen bg-white text-[#0a0a0a] antialiased`}>

      <div ref={topSentinelRef} aria-hidden className="pointer-events-none h-px w-full" />

      {/* ── Header (claro, fino) ── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled ? 'border-b border-black/10 bg-white' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 md:px-10">
          <a href="/" className="flex items-center gap-3">
            <BrandLockup dark={scrolled} accent="text-[#e5484d]" />
          </a>
          <nav className="hidden items-center gap-7 lg:flex">
            {[
              ['Como funciona', HOW_ANCHOR],
              ['Arquitetura', '#ontologia'],
              ['Impacto', '#impacto'],
              ['Módulos', '#modulos'],
              ['Realizações', '#realizacoes'],
              ['FAQ', '#faq'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className={`${M_FONT} text-[10px] font-medium uppercase tracking-[0.16em] transition ${
                  scrolled ? 'text-black/55 hover:text-[#0a0a0a]' : 'text-white/75 hover:text-white'
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <a
              href={LOGIN_URL}
              className={`hidden text-[11px] font-medium underline-offset-4 transition hover:underline sm:inline-flex ${
                scrolled ? 'text-black/50 hover:text-[#0a0a0a]' : 'text-white/70 hover:text-white'
              }`}
            >
              Acessar plataforma
            </a>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`${M_FONT} group inline-flex items-center gap-2 border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition sm:px-4 ${
                scrolled
                  ? 'border-[#e5484d] text-[#b42318] hover:bg-[#cc2b33] hover:text-white'
                  : 'border-white/40 text-white hover:border-[#e5484d] hover:bg-[#cc2b33]'
              }`}
            >
              Falar com engenharia <ArrowRight size={13} className="hidden transition-transform duration-200 group-hover:translate-x-0.5 sm:inline" />
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero em carrossel: slide principal + 2 slides com foto de obra ── */}
        <HeroCarousel>
          <div className="relative flex min-h-[82vh] flex-col overflow-hidden bg-[#0d0d0d] pt-24 sm:pt-28">
            {/* Fundo do hero. Quando o vídeo chegar, troque este <img> por
                <video autoPlay muted loop playsInline poster="/obras/hero-slide-1.webp" src="/videos/hero-loop.mp4">
                mantendo as mesmas classes. Sem gradiente — só um overlay chapado para legibilidade. */}
            <img
              src="/obras/hero-slide-1.webp"
              alt=""
              width={1408}
              height={768}
              fetchPriority="high"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/60" />
            <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pb-20 pt-8 md:px-10">
              <div data-sr className="max-w-3xl">
                <p className={`${M_FONT} text-[10px] font-medium uppercase tracking-[0.2em] text-white/70 sm:text-[11px]`}>
                  [ Base operacional para obras de missão crítica ]
                </p>
                <h1 className={`${H_FONT} mt-7 text-5xl font-medium leading-[1.02] tracking-[-0.03em] text-white sm:text-6xl lg:text-7xl`}>
                  Sua obra está pronta?
                </h1>
                <p className="mt-7 max-w-2xl text-lg leading-8 text-white/75 sm:text-xl">
                  Cada RDO, cada medição, cada frente de serviço em uma única fonte de verdade. O ConstruData conecta o campo à decisão, em tempo real.
                </p>
                <div className="mt-9">
                  <DemoCTA tone="light" microcopy={false} />
                </div>
                <p className={`${M_FONT} mt-10 text-[10px] uppercase leading-5 tracking-[0.12em] text-white/45 sm:text-[11px]`}>
                  Em produção em obras de saneamento, infraestrutura e edificação · Engelfer · Consórcio Se Liga na Rede · Vila Rica · Atlântico · Compizzo
                </p>
              </div>
            </div>
          </div>
        </HeroCarousel>

        {/* ── Vídeo (placeholder) — quando o vídeo ficar pronto, salve em
            public/videos/hero-loop.mp4 e troque o <img> abaixo por:
            <video autoPlay muted loop playsInline poster="/obras/hero-slide-2.webp"
                   src="/videos/hero-loop.mp4" className="block aspect-video w-full object-cover" />
            (mesmas classes; nada mais muda). ── */}
        <section className="border-t border-black/10 bg-white py-16 sm:py-24">
          <div data-sr className="mx-auto max-w-7xl px-5 md:px-10">
            <p className={`${M_FONT} text-[11px] font-medium uppercase tracking-[0.2em] text-black/50`}>
              <span className="mr-3 text-[#b42318]">[ Vídeo ]</span>A plataforma em operação
            </p>
            <figure className="relative mt-6 overflow-hidden border border-black/10 bg-white p-2 sm:p-3">
              <Corners />
              <div className="relative overflow-hidden">
                <img
                  src="/obras/hero-slide-2.webp"
                  alt="Operação de obra conectada no ConstruData"
                  width={1408}
                  height={792}
                  loading="lazy"
                  decoding="async"
                  className="block aspect-video w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <div className="flex flex-col items-center gap-4">
                    <span aria-hidden className="flex size-16 items-center justify-center border border-white/40 text-white">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                    <span className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80`}>Em produção — disponível em breve</span>
                  </div>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* ── Faixa de logos ── */}
        <section id="empresas" className="border-t border-black/10 bg-white py-14 sm:py-16">
          <p data-sr className="mx-auto max-w-3xl px-5 text-center text-sm leading-6 text-black/55 md:px-10">
            Construtoras, consórcios e empresas de saneamento e infraestrutura já decidem com dados conectados no ConstruData.
          </p>
          {/* Grid estático de hairlines (mesma linguagem de Realizações/Prova social).
              Substituiu um marquee que duplicava 5 logos ×4 = 20 <img> no DOM e mantinha
              uma animação infinita rodando fora da viewport. */}
          <div data-sr className="mx-auto mt-10 grid max-w-6xl grid-cols-2 border-t border-l border-black/10 px-5 sm:grid-cols-3 md:px-10 lg:grid-cols-6">
            {logos.map((logo) => {
              /* Peso óptico: limitar todos pela MESMA altura faz o logo alto/quadrado parecer
                 minúsculo ao lado de um horizontal. A altura máxima acompanha o formato —
                 quanto mais largo o logo, menor a altura (ele já preenche pela largura). */
              const r = logo.w / logo.h
              const alturaMax = r > 3 ? 'max-h-8 sm:max-h-9' : r > 1.6 ? 'max-h-11 sm:max-h-12' : 'max-h-14 sm:max-h-16'
              return (
                <div key={logo.src} className="flex h-24 items-center justify-center border-b border-r border-black/10 bg-white px-4 sm:h-28">
                  <img
                    src={logo.src}
                    alt={logo.nome}
                    width={logo.w}
                    height={logo.h}
                    loading="lazy"
                    decoding="async"
                    className={`${alturaMax} w-auto max-w-[84%] object-contain`}
                  />
                </div>
              )
            })}
          </div>
        </section>

        {/* ── O problema ── */}
        <section id="problema" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
          <SectionHeader index="01" eyebrow="O problema" title="O dado da sua obra existe. Espalhado, ele não decide nada." />
          <div data-sr className="mx-auto mt-10 max-w-4xl px-5 md:px-10">
            <p className="text-lg leading-8 text-black/65">
              O planejamento vive no cronograma. A medição vive na planilha. O campo vive no grupo de mensagens. O custo vive no ERP. Quando os quatro se encontram no fechamento do mês, a janela de decisão já passou. O atraso virou multa. A glosa virou prejuízo. A frente parada virou retrabalho. O problema nunca foi falta de informação. É informação <strong className="font-semibold text-[#0a0a0a]">desconectada da decisão</strong>.
            </p>
          </div>
        </section>

        {/* ── Como entramos na sua obra ── */}
        <section id="como-entramos" className="border-t border-black/10 bg-white py-20 sm:py-32">
          <SectionHeader
            index="02"
            eyebrow="Como entramos na sua obra"
            title="Não vendemos um sistema. Instalamos uma capacidade."
            copy="Software de obra falha por um motivo: ele é configurado no escritório e imposto ao canteiro. Nós fazemos o contrário. Nossos engenheiros entram na obra antes de qualquer tela ser ligada."
          />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-y border-black/10 px-5 md:grid-cols-3 md:px-10">
            {comoEntramosSteps.map((step, i) => {
              const StepIcon = step.icon
              return (
                <article
                  key={step.index}
                  data-sr
                  data-sr-delay={String(i + 1)}
                  className="group relative border-b border-black/10 px-1 py-9 transition-colors duration-300 hover:bg-[#f4f4f2] md:border-b-0 md:border-r md:px-7 md:[&:last-child]:border-r-0"
                >
                  <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#e5484d] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  <div className="flex items-center gap-3">
                    <span className={`${M_FONT} text-sm font-semibold text-[#b42318]`}>[ {step.index} ]</span>
                    <span className="flex size-10 items-center justify-center border border-black/15 text-black/45 transition-colors duration-300 group-hover:text-[#d13b40]"><StepIcon size={20} /></span>
                  </div>
                  <h3 className={`${H_FONT} mt-6 text-2xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>{step.title}</h3>
                  <p className="mt-3 leading-7 text-black/60">{step.copy}</p>
                </article>
              )
            })}
          </div>
          <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-6 px-5 md:flex-row md:items-center md:justify-between md:px-10">
            <p data-sr className={`${H_FONT} max-w-xl text-xl font-medium leading-snug tracking-[-0.02em] text-[#0a0a0a]`}>
              Primeira frente em produção em semanas, não meses. A obra não para para "rodar um projeto de TI". A implantação acompanha o ritmo dela.
            </p>
            <DemoCTA />
          </div>
        </section>

        {/* ── A base operacional única (ontologia) ── */}
        <section id="ontologia" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
          <SectionHeader
            index="03"
            eyebrow="A arquitetura"
            title="A Ontologia da Obra."
            copy="Um modelo operacional único define como obra, frente, serviço, equipe, material, prazo, custo e evidência se relacionam, em todos os módulos, ao mesmo tempo. O dado nasce no campo, atravessa o modelo e volta como ação. Não é dashboard. É operação."
          />
          <div className="mx-auto mt-12 max-w-7xl px-5 md:px-10">
            {/* Diagrama "base operacional" — coloque o arquivo em public/diagramas/base-operacional.webp
                (o container rola na horizontal no mobile, sem estourar a página). */}
            <figure data-sr className="relative border border-black/10 bg-white p-2 sm:p-3">
              <Corners />
              <div className="overflow-x-auto">
                <img
                  src="/diagramas/base-operacional.webp"
                  alt="Base operacional do ConstruData: sistemas da obra → conector → ontologia da obra → modelagem e análise → ação, no ciclo conectar, mapear, analisar e agir."
                  width={1540}
                  height={992}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full min-w-[720px]"
                />
              </div>
            </figure>
            <p data-sr className="mx-auto mt-8 max-w-3xl text-base leading-7 text-black/65">
              Construído numa lógica <strong className="font-semibold text-[#0a0a0a]">campo-primeiro</strong>, o ConstruData conecta o que acontece no canteiro aos sistemas que o sustentam (ERP, BIM, cronograma) <strong className="font-semibold text-[#0a0a0a]">sem trocar o que você já usa</strong>. Quando o engenheiro atualiza o RDO, cronograma, medição e suprimentos se ajustam sozinhos. Sem retrabalho, sem planilha paralela.
            </p>
            <div className="mt-8 grid grid-cols-1 border-t border-l border-black/10 sm:grid-cols-3">
              {consequences.map(([metric, copy], i) => (
                <div key={metric} data-sr data-sr-delay={String(i + 1)} className="border-b border-r border-black/10 bg-white p-7">
                  <div className={`${H_FONT} text-2xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>{metric}</div>
                  <p className="mt-3 text-sm leading-6 text-black/55">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Diferencial único ── */}
        <section id="diferencial" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
          <SectionHeader
            index="04"
            eyebrow="O diferencial"
            title="Tecnologia todo mundo tem. Método, não."
            copy="Dado de campo virando decisão executiva em segundos, não em dias."
          />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 gap-4 px-5 sm:grid-cols-2 md:px-10 lg:grid-cols-4 lg:gap-px">
            {differentiators.map(([number, title, copy], i) => (
              <div
                key={number}
                data-sr
                data-sr-delay={String(i + 1)}
                className="group relative flex flex-col border border-black/10 bg-white px-6 py-9 transition-colors duration-300 hover:border-black/30 lg:min-h-[320px]"
              >
                <Corners />
                <div className="flex items-center justify-between">
                  <div className={`${M_FONT} text-sm font-semibold text-[#b42318]`}>[ {number} ]</div>
                  <ShieldCheck className="size-5 text-black/20 transition-colors duration-300 group-hover:text-[#d13b40]" />
                </div>
                <div className="mt-auto flex flex-col gap-3 pt-16">
                  <h3 className={`${H_FONT} text-2xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>{title}</h3>
                  <p className="leading-7 text-black/60">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Impacto real ── */}
        <section id="impacto" className="border-t border-black/10 bg-white py-20 sm:py-32">
          <SectionHeader
            index="05"
            eyebrow="Impacto"
            title="O que muda quando o dado de campo vira decisão."
            copy="Faixas observadas em obras em produção."
          />
          <div className="mx-auto mt-12 max-w-7xl px-5 md:px-10">
            <div className="border-t border-black/10">
              {impactRows.map(([category, impact, how], i) => (
                <div
                  key={category}
                  data-sr
                  data-sr-delay={String((i % 3) + 1)}
                  className="group grid gap-4 border-b border-black/10 py-8 transition-colors duration-200 hover:bg-[#f4f4f2] lg:grid-cols-[0.7fr_1fr_1.1fr] lg:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span className={`${M_FONT} text-xs font-semibold text-[#b42318]`}>[ {String(i + 1).padStart(2, '0')} ]</span>
                    <h3 className={`${M_FONT} text-xs font-semibold uppercase tracking-[0.14em] text-black/55`}>{category}</h3>
                  </div>
                  <p className={`${H_FONT} text-2xl font-medium leading-[1.08] tracking-[-0.02em] text-[#0a0a0a]`}>
                    <AnimatedNumbers text={impact} />
                  </p>
                  <p className="leading-7 text-black/60">{how}</p>
                </div>
              ))}
            </div>
            <div className="mt-10">
              <DemoCTA />
            </div>
          </div>
        </section>

        {/* ── Autonomia ── */}
        <section id="autonomia" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
          <SectionHeader
            index="06"
            eyebrow="Autonomia"
            title="A obra inteira decide melhor."
            copy="Não porque tem mais dashboards. Porque mais pessoas decidem, na hora certa, com a informação certa."
          />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-y border-black/10 px-5 md:px-10 lg:grid-cols-3">
            {autonomyCards.map(([place, person, copy], i) => (
              <article
                key={place}
                data-sr
                data-sr-delay={String(i + 1)}
                className="group relative flex flex-col border-b border-black/10 bg-white px-7 py-9 transition-colors duration-300 hover:bg-[#ececea] lg:border-r lg:p-10 lg:[&:nth-child(3n)]:border-r-0"
              >
                <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#e5484d] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                <p className={`${M_FONT} text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b42318]`}>{place}</p>
                <h3 className={`${H_FONT} mt-8 text-3xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>{person}</h3>
                <p className="mt-5 leading-7 text-black/60">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Módulos ── */}
        <ModulesSection />

        {/* ── Para quem é ── */}
        <section id="perfis" className="border-t border-black/10 bg-white py-20 sm:py-32">
          <SectionHeader
            index="08"
            eyebrow="Para quem é"
            title="O visitante certo se reconhece em uma linha."
            copy="Cada perfil entra por uma dor diferente, mas todos chegam ao mesmo ponto: dado de campo confiável virando decisão, medição e planejamento."
          />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-y border-black/10 px-5 md:grid-cols-2 md:px-10 lg:grid-cols-3">
            {audience.map(([title, problem, solution], i) => (
              <article
                key={title}
                data-sr
                data-sr-delay={String((i % 3) + 1)}
                className="group relative border-b border-black/10 px-6 py-9 transition-colors duration-300 hover:bg-[#f4f4f2] md:border-r lg:p-9 lg:[&:nth-child(3n)]:border-r-0 md:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r"
              >
                <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#e5484d] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                <Users className="size-8 text-[#d13b40]" />
                <h3 className={`${H_FONT} mt-6 text-2xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>{title}</h3>
                <p className="mt-5 leading-7 text-black/60">
                  <strong className="font-semibold text-[#0a0a0a]">Problema:</strong> {problem}
                </p>
                <p className="mt-3 leading-7 text-black/60">
                  <strong className="font-semibold text-[#0a0a0a]">Resolve:</strong> {solution}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Realizações ── */}
        <section id="realizacoes" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
          <SectionHeader
            index="09"
            eyebrow="Realizações"
            title="Obras que já decidem com dados conectados."
            copy="Obra, cliente, setor e o que mudou na operação."
          />
          {/* Ledger técnico (sem foto): densidade informacional no lugar de imagem decorativa.
              O `result` vem como "Setor · mecanismo" — separado aqui em duas colunas. */}
          <div className="mx-auto mt-12 max-w-7xl px-5 md:px-10">
            <div data-sr className="border-t border-black/10">
              {/* Cabeçalho só no desktop: no mobile cada linha vira bloco rotulado. */}
              <div className={`${M_FONT} hidden border-b border-black/10 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40 lg:grid lg:grid-cols-[3rem_1.1fr_1fr_0.8fr_1.4fr] lg:gap-4`}>
                <span>#</span><span>Obra</span><span>Cliente</span><span>Setor</span><span>O que mudou</span>
              </div>
              {realizacoes.map((item, i) => {
                const [setor, ...resto] = item.result.split(' · ')
                const mecanismo = resto.join(' · ')
                return (
                  <div
                    key={`${item.empresa}-${item.obra}`}
                    className="grid grid-cols-1 gap-1.5 border-b border-black/10 py-5 transition-colors hover:bg-white lg:grid-cols-[3rem_1.1fr_1fr_0.8fr_1.4fr] lg:items-baseline lg:gap-4"
                  >
                    <span className={`${M_FONT} text-xs font-semibold text-[#b42318]`}>[ {String(i + 1).padStart(2, '0')} ]</span>
                    <h3 className={`${H_FONT} text-lg font-medium leading-tight tracking-[-0.02em] text-[#0a0a0a]`}>{item.obra}</h3>
                    <p className="text-sm leading-6 text-black/70">{item.empresa}</p>
                    <p className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.14em] text-black/45`}>{setor}</p>
                    <p className="text-sm leading-6 text-black/55">{mecanismo}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── Prova social ── */}
        <section id="prova" className="border-t border-black/10 bg-white py-20 sm:py-32">
          <SectionHeader index="10" eyebrow="Prova social" title="Quem opera, confirma." />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 gap-4 px-5 md:px-10 lg:grid-cols-3 lg:gap-px">
            {testimonials.map((t, i) => (
              <figure
                key={t.company}
                data-sr
                data-sr-delay={String(i + 1)}
                className="group relative flex flex-col border border-black/10 bg-white px-7 py-9 transition-colors duration-300 hover:border-black/30"
              >
                <Corners />
                <span className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b42318]`}>{t.segment}</span>
                <blockquote className="mt-4 text-lg leading-8 text-[#0a0a0a]">"{t.quote}"</blockquote>
                <p className={`mt-5 text-sm leading-6 ${t.hasNumber ? 'text-[#0a0a0a]' : 'text-black/60'}`}>{t.result}</p>
                <figcaption className="mt-auto border-t border-black/10 pt-5">
                  <div className={`${H_FONT} text-lg font-medium text-[#0a0a0a]`}>{t.company}</div>
                  <div className="mt-0.5 text-xs text-black/50">{t.segment}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── Implantação em obras reais ── */}
        <section className="border-t border-black/10 bg-white py-20 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <div className="grid border border-black/10 lg:grid-cols-[0.85fr_1.15fr]">
              <div data-sr className="border-b border-black/10 bg-[#f4f4f2] p-7 sm:p-10 lg:border-b-0 lg:border-r">
                <p className={`${M_FONT} text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b42318]`}>Implantação em obras reais</p>
                <h2 className={`${H_FONT} mt-7 max-w-xl text-3xl font-medium leading-[1.05] tracking-[-0.03em] text-[#0a0a0a] sm:text-5xl`}>
                  Comece com o que a obra já usa.
                </h2>
              </div>
              <div className="grid gap-0 sm:grid-cols-3">
                {[
                  ['Planilhas, medições e RDOs', 'Viram a base inicial, sem parar a operação.'],
                  ['Fotos, propostas e relatórios', 'Entram com origem, contexto e destino.'],
                  ['Evolução sem ruptura', 'O controle amadurece frente a frente, não tudo no primeiro dia.'],
                ].map(([title, copy], i) => (
                  <article
                    key={title}
                    data-sr
                    data-sr-delay={String(i + 1)}
                    className="group border-b border-black/10 bg-white p-7 transition-colors duration-300 hover:bg-[#f4f4f2] last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
                  >
                    <FileText className="size-7 text-[#e5484d]" />
                    <h3 className={`${H_FONT} mt-7 text-xl font-medium leading-tight tracking-[-0.02em] text-[#0a0a0a]`}>{title}</h3>
                    <p className="mt-4 text-sm leading-7 text-black/55">{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" className="border-t border-black/10 bg-white py-20 sm:py-32">
          <SectionHeader index="11" eyebrow="FAQ" title="Perguntas frequentes." />
          <div className="mx-auto mt-12 max-w-5xl px-5 md:px-10">
            <div className="border-t border-black/10">
              {faqs.map(([question, answer], i) => (
                <details
                  key={question}
                  data-sr
                  data-sr-delay={String((i % 3) + 1)}
                  className="group border-b border-black/10 bg-transparent transition-colors duration-200 open:bg-[#f4f4f2]"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-1 py-5">
                    <span className={`${H_FONT} flex items-center gap-3 text-base font-medium text-[#0a0a0a]`}>
                      <span className={`${M_FONT} text-xs font-semibold text-[#b42318]`}>{String(i + 1).padStart(2, '0')}</span>
                      {question}
                    </span>
                    <Plus className="size-5 shrink-0 text-[#d13b40] transition-transform duration-200 group-open:rotate-45" />
                  </summary>
                  <p className="px-1 pb-5 leading-7 text-black/60">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Fechamento + formulário ── */}
        <section id="solicitar" className="border-t border-black/10 bg-[#f4f4f2] px-5 py-20 sm:py-32 md:px-10">
          <div data-sr className="mx-auto max-w-4xl text-center">
            <h2 className={`${H_FONT} text-4xl font-medium leading-[1.05] tracking-[-0.03em] text-[#0a0a0a] sm:text-5xl`}>
              Veja o ConstruData na sua obra.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-black/60 sm:text-lg">
              Começamos com um diagnóstico. Entendemos o seu contexto e mostramos a plataforma já configurada com o contexto da sua obra. Sem compromisso de compra. Sem implantação de meses.
            </p>
          </div>

          <div data-sr className="relative mx-auto mt-10 max-w-4xl border border-black/10 bg-white p-6 sm:p-9">
            <Corners />
            <div className="mb-6 flex items-center gap-3">
              <CalendarClock className="text-[#b42318]" size={20} />
              <div>
                <h3 className={`${H_FONT} text-2xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>Agende sua demonstração</h3>
                <p className="mt-1 text-sm leading-6 text-black/50">Uma conversa com o time de engenharia, já com o contexto da sua obra.</p>
              </div>
            </div>
            <LeadForm />
            <p className="mt-4 text-center text-xs leading-5 text-black/45">
              A demonstração já vem configurada com o contexto da sua obra. Você conversa com quem entende de obra, não com um vendedor de software.
            </p>
          </div>
        </section>
      </main>

      {/* ── Footer denso ── */}
      <footer className="border-t border-black/10 bg-white pb-8 pt-14">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="grid gap-10 border-b border-black/10 pb-12 lg:grid-cols-[1.4fr_1fr_1fr]">
            {/* Lockup horizontal (BrandLockup é um Fragment: sem `flex` no pai, os dois
                filhos empilhavam). O "ConstruData" gigante que existia aqui era uma
                repetição do próprio lockup — removido. */}
            <div className="flex items-center gap-4">
              <BrandLockup dark accent="text-[#e5484d]" size="lg" />
            </div>
            <nav className="flex flex-col gap-3">
              {[
                ['Como funciona', HOW_ANCHOR],
                ['Arquitetura', '#ontologia'],
                ['Impacto', '#impacto'],
                ['Módulos', '#modulos'],
                ['Realizações', '#realizacoes'],
                ['FAQ', '#faq'],
              ].map(([label, href]) => (
                <a key={href} href={href} className={`${M_FONT} text-[11px] font-medium uppercase tracking-[0.16em] text-black/50 transition hover:text-[#0a0a0a]`}>
                  {label}
                </a>
              ))}
            </nav>
            <nav className="flex flex-col gap-3">
              <a href={CALENDLY_URL} target="_blank" rel="noopener noreferrer" className={`${M_FONT} text-[11px] font-medium uppercase tracking-[0.16em] text-[#b42318] transition hover:text-[#0a0a0a]`}>
                Falar com engenharia
              </a>
              <a href={FORM_ANCHOR} className={`${M_FONT} text-[11px] font-medium uppercase tracking-[0.16em] text-black/50 transition hover:text-[#0a0a0a]`}>
                Deixar contato
              </a>
              <a href={LOGIN_URL} className={`${M_FONT} text-[11px] font-medium uppercase tracking-[0.16em] text-black/50 transition hover:text-[#0a0a0a]`}>
                Acessar plataforma
              </a>
            </nav>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 pt-8 text-center sm:flex-row">
            <span className={`${M_FONT} text-[11px] uppercase tracking-[0.12em] text-black/45`}>© 2026 ConstruData</span>
            <span className={`${M_FONT} text-[11px] uppercase tracking-[0.12em] text-black/30`}>Construção · Saneamento · Infraestrutura · Ambiental</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
