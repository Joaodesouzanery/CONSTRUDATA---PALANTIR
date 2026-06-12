import { type FormEvent, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  BrainCircuit,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileText,
  Layers3,
  LineChart,
  LockKeyhole,
  Map,
  PackageCheck,
  Plus,
  Ruler,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { BrandLockup } from '@/components/shared/BrandLogo'
import { Marquee } from '@/components/ui/marquee'
import { HeroCarousel } from './HeroCarousel'
import { ObraFoundryScene } from './ObraFoundryScene'

const LOGIN_URL = '/login'
const DEMO_ANCHOR = '#solicitar'
const HOW_ANCHOR = '#como-entramos'
const MICROCOPY = 'A demonstração já vem adaptada à sua obra. Resposta em até 1 dia útil, sem compromisso.'

/* ── Tokens visuais da landing (tema técnico claro, somente nesta página) ──
   Base branca alternando com #f4f4f2; hairlines pretas a 10%; rótulos em
   IBM Plex Mono caixa alta com índice entre colchetes; laranja #f97316 em
   superfícies (botões, barras, dots) e #c2410c para texto pequeno laranja
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
  ['20+ módulos conectados', 'O dado nasce no RDO, na medição, no planejamento ou em suprimentos e segue conectado até a diretoria.'],
  ['Origem 100% rastreável', 'Serviço, local, equipe, evidência, material e custo na mesma base, sem versões paralelas.'],
  ['Tempo real', 'A diretoria acompanha avanço, pendência, custo e risco com contexto de campo, sem esperar consolidação manual.'],
]

const comoEntramosSteps: Array<{ index: string; title: string; copy: string; icon: LucideIcon }> = [
  { index: '01', title: 'Diagnóstico', icon: Search, copy: 'Acompanhamos os processos reais, do canteiro ao escritório, e mapeamos onde a informação nasce, circula e se perde hoje.' },
  { index: '02', title: 'Otimização', icon: Sparkles, copy: 'Identificamos gargalos, retrabalhos e pontos cegos e desenhamos com você os processos de melhoria, ajustados ao seu tipo de obra e contrato.' },
  { index: '03', title: 'Conexão', icon: DatabaseZap, copy: 'Ligamos suas fontes em uma única base operacional e ativamos as decisões: medição, avanço, custo, qualidade e suprimentos falando a mesma língua.' },
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
    moduleIds: ['levantamento', 'quantitativos', 'planejamento'],
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
const painScreens: Record<ModulePain, { src: string; path: string }> = {
  avanco: { src: '/screenshots/rdo-dashboard.png', path: 'construdata / rdo' },
  planilhas: { src: '/screenshots/quantitativos.png', path: 'construdata / quantitativos' },
  custo: { src: '/screenshots/gestao360.png', path: 'construdata / gestão-360' },
  diretoria: { src: '/screenshots/torre-controle-mapa.png', path: 'construdata / torre-de-controle' },
}

const modules: ModuleItem[] = [
  {
    id: 'gestao-360',
    category: 'gestao',
    icon: Layers3,
    title: 'Gestão 360',
    kicker: 'Diretoria em tempo real',
    copy: 'Consolida CPI/SPI (índices de custo e prazo), curva S, alertas, custo, prazo e avanço físico-financeiro por obra.',
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
    copy: 'Transforma RDO, planilhas, fornecedores, NFs, descontos e retenções em medição conferível.',
    how: 'Vincula avanço, evidência, memória de cálculo, fornecedor e critérios contratuais antes da aprovação humana.',
    efficiency: 'Diminui glosas, retrabalho de conferência e divergência entre campo, contrato, financeiro e cliente.',
    features: ['Memória de cálculo', 'Pendências bloqueantes', 'Aprovação humana'],
    connected: ['RDO', 'Suprimentos', 'Qualidade', 'Planejamento'],
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
    id: 'rdo',
    category: 'campo',
    icon: FileText,
    title: 'RDO',
    kicker: 'Campo que vira decisão',
    copy: 'Registra serviço, local, equipe, equipamento, material, foto, ocorrência e assinatura com rastreabilidade.',
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
    id: 'levantamento',
    category: 'projetos',
    icon: Ruler,
    title: 'Levantamento de Obra',
    kicker: 'Planilha técnica dentro do sistema',
    copy: 'Importa levantamentos de campo, medidas, custos, orçamento e registro fotográfico para uma base editável por obra.',
    how: 'Transforma a planilha de levantamento em abas estruturadas com cálculo de medidas, mão de obra, orçamento, fotos e resumo.',
    efficiency: 'Reduz retrabalho entre Excel, orçamento, medição e gestão, mantendo cada levantamento separado por empresa e obra.',
    features: ['Importação Excel', 'Cálculo de medidas', 'Resumo e aprovação'],
    connected: ['Quantitativos', 'Medição', 'Planejamento', 'Gestão 360'],
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
]

const impactRows: Array<[string, string, string]> = [
  ['Custo sob controle', 'Redução observada de 3–5% no custo total sobre o faturamento', 'Otimização de suprimentos e fim de perdas por erro de faturamento via conferência tripla (pedido × recebimento × nota).'],
  ['Entrega com velocidade', 'Controle total da obra em dias, não em meses', 'Cronograma, planejamento, financeiro e campo na mesma base operacional, em tempo real.'],
  ['Tempo economizado', 'Até 80% menos tempo de orçamentação', 'Automação de alocação e ciclos de relatórios em tempo real a partir do RDO digital.'],
  ['Cadeia mais forte', 'Até 40% menos risco de falta de material', 'Alertas preditivos e monitoramento proativo de interrupções na cadeia de suprimentos.'],
  ['Avanço físico-financeiro', 'Cada decisão financeira sob controle, por setor e núcleo', 'As decisões da obra acontecem dentro do sistema, com rastreabilidade por frente.'],
]

const differentiators: Array<[string, string, string]> = [
  ['01', 'Base operacional única', 'Obra, frente, serviço, equipe, material, prazo, custo e evidência seguem o mesmo modelo em todos os módulos.'],
  ['02', 'Loop de feedback rápido', 'O que o campo registra no RDO alimenta medição, qualidade, planejamento e relatórios sem retrabalho.'],
  ['03', 'LPS / Lean nativo', 'Last Planner System com look-ahead de 6 semanas, PPC semanal (percentual de programação cumprida), restrições e causas de não cumprimento ligados ao cronograma real.'],
  ['04', 'Decisão antes do relatório', 'A plataforma cruza dados e aponta a próxima ação antes que o problema vire atraso, glosa ou custo oculto.'],
]

const audience: Array<[string, string, string]> = [
  ['Construtoras de médio porte', 'A diretoria vê o resultado tarde, depois que planilha, RDO e financeiro já divergiram.', 'Uma base operacional única para acompanhar campo, medição, custo e prazo por obra.'],
  ['Saneamento e infraestrutura', 'Serviços por rua, núcleo, OS e evidência ficam espalhados entre equipes, fiscais e medição.', 'RDO, mapa, cronograma e medição usam os mesmos códigos, locais e evidências para reduzir retrabalho.'],
  ['Engenharia ambiental', 'Condicionantes, monitoramento e prazos de órgão dependem de evidência rastreável e relatórios de conformidade.', 'Evidências com origem e contexto, ligadas a avanço, qualidade e prazo de cada frente.'],
  ['EPC e consórcios', 'Várias empresas entregam juntas e a governança precisa de rastreabilidade e permissão por perfil.', 'Empresas, usuários, aprovações, evidências e auditoria organizados em ambiente multiempresa.'],
  ['Empreiteiras', 'A produção executada no campo demora para virar medição defensável com memória e anexos.', 'O RDO finalizado gera rascunho de medição por empreiteiro, núcleo, serviço e evidência para conferência.'],
]

const autonomyCards: Array<[string, string, string]> = [
  ['No canteiro', 'O engenheiro', 'decide melhor o que registrar, o que medir e qual restrição abrir, porque vê o impacto da decisão no cronograma, na medição e na qualidade.'],
  ['No escritório', 'O gerente', 'decide melhor sobre realocação de equipe, aprovação de pedido e risco de prazo, porque acompanha CPI/SPI sem depender de relatório manual.'],
  ['No celular', 'O diretor', 'decide melhor sobre portfólio, novas obras e conversas com clientes, porque abre a plataforma e entende em segundos o que está de pé e o que está caindo.'],
]

const testimonials: Array<{ company: string; segment: string; quote: string; result: string; hasNumber?: boolean }> = [
  {
    company: 'Consórcio Se Liga Na Rede',
    segment: 'Saneamento',
    quote: 'Quando RDO, planejamento e medição conversam, a gestão deixa de discutir planilha e passa a discutir decisão.',
    result: 'Entramos nas obras por todos os setores, ouvindo os colaboradores de diversas áreas e adaptando o sistema a cada equipe. Só nos Relatórios Diários de Obra, economizamos cerca de 6 horas por dia — com um único módulo.',
    hasNumber: true,
  },
  {
    company: 'Engelfer Engenharia',
    segment: 'Edificação',
    quote: 'A plataforma coloca o dado de campo no centro da decisão, sem depender de consolidação manual.',
    result: 'Entramos na obra, ouvimos as equipes e adaptamos o sistema a cada frente — do RDO à medição — antes de conectar tudo.',
  },
  {
    company: 'Vila Rica Engenharia',
    segment: 'Construção civil',
    quote: 'O valor está em rastrear origem, pendência e responsabilidade antes que o problema chegue ao fechamento.',
    result: 'Entramos na obra, mapeamos os processos e identificamos melhorias, adaptando a plataforma ao contexto de cada equipe.',
  },
]

const logos = [
  ['/logos/social-proof/engelfer-horizontal.png', 'Engelfer Engenharia'],
  ['/logos/social-proof/cslnr.jpg', 'Consórcio Se Liga na Rede'],
  ['/logos/social-proof/vr.jfif', 'Vila Rica Engenharia'],
  ['/logos/social-proof/atlantico.jpg', 'Atlântico Engenharia'],
  ['/logos/social-proof/engelfer-selo.png', 'Engelfer Engenharia'],
]

/* Realizações — obras por empresa. Fotos em public/obras/ (trocar o arquivo
   substitui a imagem do card, sem mexer em código). */
const realizacoes: Array<{ obra: string; empresa: string; img: string }> = [
  { obra: 'São Manoel', empresa: 'Consórcio Se Liga Na Rede', img: '/obras/sao-manoel.webp' },
  { obra: 'Pantanal Baixo', empresa: 'Consórcio Se Liga Na Rede', img: '/obras/pantanal-baixo.webp' },
  { obra: 'João Carlos', empresa: 'Consórcio Se Liga Na Rede', img: '/obras/joao-carlos.webp' },
  { obra: 'Morro do Tetéu', empresa: 'Consórcio Se Liga Na Rede', img: '/obras/morro-do-teteu.webp' },
  { obra: 'Vila dos Criadores', empresa: 'Consórcio Se Liga Na Rede', img: '/obras/vila-dos-criadores.webp' },
  { obra: 'Vila Israel', empresa: 'Consórcio Se Liga Na Rede', img: '/obras/vila-israel.webp' },
  { obra: 'Obras de edificação', empresa: 'Vila Rica Engenharia', img: '/obras/vila-rica.webp' },
  { obra: 'Pisos industriais', empresa: 'Compizzo Epoxi', img: '/obras/compizzo.webp' },
  { obra: 'Obras de engenharia', empresa: 'Engelfer', img: '/obras/engelfer.webp' },
]

const faqs: Array<[string, string]> = [
  ['Quanto tempo leva para implantar?', 'Depende da qualidade dos dados e do escopo inicial. Uma implantação enxuta pode começar por uma obra, um fluxo e poucos módulos críticos. Conforme os dados são validados, a empresa amplia para planejamento, qualidade, suprimentos, EVM, BIM e gestão executiva — em semanas, não meses.'],
  ['O ConstruData substitui minhas planilhas no primeiro dia?', 'Não precisa. A implantação pode começar absorvendo as planilhas, PDFs, fotos e controles que a empresa já usa. Ele organiza essas informações, preserva a origem dos dados e transforma o que antes era planilha solta em base rastreável para medição, planejamento, RDO, qualidade e gestão executiva.'],
  ['Preciso mudar todos os processos antes de usar?', 'Não. A implantação pode ser progressiva. Primeiro entram os dados essenciais e os fluxos mais críticos, como RDO, medição, planejamento ou suprimentos. Depois a empresa amadurece os demais módulos conforme a operação ganha confiança e padronização.'],
  ['Funciona para saneamento, infraestrutura e engenharia ambiental?', 'Sim. A estrutura foi pensada para contratos com núcleos, ruas, trechos, frentes de serviço, OS, equipes, materiais, fotos e medições por período — incluindo condicionantes e relatórios de conformidade ambiental. O mapa, o RDO e a medição usam a mesma chave operacional para reduzir divergência entre campo, fiscalização e escritório.'],
  ['A plataforma conversa com SINAPI, SEINFRA, BIM e cronogramas?', 'Sim. Ele foi desenhado para conectar bases técnicas, composições, orçamento, modelos BIM, cronogramas e execução real. A ideia não é trocar todos os sistemas de uma vez, mas criar uma camada operacional que faça esses dados conversarem com menos retrabalho.'],
  ['Como começa uma obra nova?', 'Uma obra normalmente começa com contrato, proposta, orçamento, cronograma, frentes ou núcleos, responsáveis, fornecedores, subempreiteiros, critérios de medição e modelo de RDO. A partir disso, o sistema cria a base para acompanhar avanço, pendências, evidências, equipe, equipamentos, qualidade e suprimentos.'],
  ['O RDO fecha automaticamente a medição?', 'O RDO pode alimentar a medição quando existe vínculo suficiente entre serviço, local, quantidade, período, equipe e evidência. Mesmo assim, o fechamento continua exigindo revisão humana. A lógica é acelerar a conferência e reduzir retrabalho, sem tirar o controle técnico e financeiro de quem aprova.'],
  ['Quem consegue usar no campo pelo celular?', 'Engenheiros, encarregados, técnicos, fiscais e equipes autorizadas podem registrar informações pelo celular, conforme permissões da empresa. A experiência é pensada para o canteiro: poucos cliques, campos objetivos, fotos, ocorrências, equipe, equipamentos e serviços executados.'],
  ['Como o ConstruData evita dados falsos ou sem origem?', 'Cada informação importante precisa manter vínculo com origem, responsável, data, obra, frente, serviço e evidência quando aplicável. O sistema diferencia rascunho, dado importado, dado validado e dado aprovado, criando uma trilha de auditoria para reduzir discussões no fechamento.'],
  ['É possível controlar várias empresas ou obras na mesma conta?', 'Sim. O ambiente é multiempresa e multiobra. Usuários globais ou administradores podem alternar entre empresas autorizadas, enquanto cada equipe comum acessa apenas o que foi liberado por perfil, organização e permissão.'],
  ['O sistema serve para empreiteiros e subcontratados?', 'Sim. Empreiteiros podem ter controles de produção, evidências, medições, pendências e aprovações vinculadas ao contrato. Isso ajuda a tornar o fechamento mais claro, com menos troca de mensagens e menos divergência sobre o que foi executado.'],
  ['O que acontece quando falta informação para criar uma obra completa?', 'O sistema pode trabalhar com checklist de pendências. O que já existe entra como base, e o que falta fica sinalizado: contrato final, endereço, áreas, quantitativos, cronograma, responsáveis, fornecedores, critérios de aceite, fotos iniciais e regras de medição.'],
  ['O ConstruData usa IA para tomar decisões sozinho?', 'Não. A IA ajuda a organizar dados, identificar riscos, sugerir pendências, resumir documentos e apontar inconsistências. Decisões críticas, aprovações, medições e alterações contratuais continuam passando por confirmação humana.'],
  ['Como sei se o sistema está gerando eficiência de verdade?', 'A eficiência aparece em indicadores práticos: menos tempo para fechar medição, menos planilhas paralelas, menos RDO incompleto, maior previsibilidade de prazo, menos falta de material, menos retrabalho de conferência e mais decisões tomadas com dado de campo rastreável.'],
]

function useScrollReveal() {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
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
    const els = document.querySelectorAll('[data-sr]')
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
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
            {index && <span className="mr-3 text-[#c2410c]">[ {index} ]</span>}
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
function DemoCTA({ align = 'left', microcopy = true }: { align?: 'left' | 'center'; microcopy?: boolean }) {
  return (
    <div data-sr className={`flex flex-col gap-3 ${align === 'center' ? 'items-center text-center' : 'items-start'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={DEMO_ANCHOR}
          className={`${M_FONT} group inline-flex min-h-12 items-center justify-center gap-3 bg-[#f97316] px-7 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#ea580c]`}
        >
          Solicitar demonstração <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
        </a>
        <a
          href={HOW_ANCHOR}
          className={`${M_FONT} group inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0a0a0a] transition hover:text-[#ea580c]`}
        >
          Ver como funciona <ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-1" />
        </a>
      </div>
      {microcopy && <p className="max-w-md text-xs leading-5 text-black/45">{MICROCOPY}</p>}
    </div>
  )
}

/** Moldura tipo browser para screenshots da plataforma. */
function ScreenFrame({ src, path, alt }: { src: string; path: string; alt: string }) {
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
      <img src={src} alt={alt} width={1408} height={768} loading="lazy" decoding="async" className="block h-auto w-full" />
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
        index="06"
        eyebrow="Módulos"
        title="Escolha o problema. Veja o módulo que resolve."
        copy="Tudo conversando na mesma base, em tempo real. O dado de campo vira decisão em segundos — e o gestor antecipa o problema antes que ele vire atraso, glosa ou custo oculto."
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
                  ? 'border-[#f97316] text-[#0a0a0a] sm:border-b-2'
                  : 'border-transparent text-black/45 hover:text-[#0a0a0a]'
              }`}
            >
              {pain.label}
              {activePain === pain.id && (
                <span className="absolute -bottom-[2px] left-0 hidden h-[2px] w-full bg-[#f97316] sm:block" />
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
            <div className="mt-8 border-l-2 border-[#f97316] pl-5">
              <p className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.18em] text-[#c2410c]`}>Resultado mensurável</p>
              <p className="mt-2 leading-7 text-black/65">{activeDetails.outcome}</p>
            </div>
            <div className="mt-8">
              <ScreenFrame src={activeScreen.src} path={activeScreen.path} alt={`Tela da plataforma: ${activeDetails.title}`} />
            </div>
          </aside>

          <div className="divide-y divide-black/10 bg-white">
            {activeModules.map((module) => {
              const Icon = module.icon
              return (
                <div key={module.id} className="group flex items-start gap-5 p-6 transition-colors duration-200 hover:bg-[#f4f4f2] sm:p-9">
                  <div className="flex size-12 shrink-0 items-center justify-center border border-black/15 bg-white text-[#f97316] transition-colors duration-200 group-hover:border-[#f97316] group-hover:bg-[#f97316] group-hover:text-white">
                    <Icon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className={`${H_FONT} text-xl font-medium leading-tight tracking-[-0.02em] text-[#0a0a0a] sm:text-2xl`}>
                        {module.title}
                      </h4>
                      <span className={`${M_FONT} text-[9px] font-semibold uppercase tracking-[0.14em] text-[#c2410c]`}>{module.kicker}</span>
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
          <p className={`${M_FONT} text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40`}>A plataforma completa — 14 módulos conectados</p>
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
                  <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#f97316] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  <div className="flex items-start justify-between">
                    <div className="flex size-11 items-center justify-center border border-black/15 text-[#f97316] transition-colors duration-300 group-hover:border-[#f97316]">
                      <Icon size={20} />
                    </div>
                    <span className={`${M_FONT} text-[9px] font-semibold uppercase tracking-[0.14em] text-[#c2410c]`}>{module.kicker}</span>
                  </div>
                  <h4 className={`${H_FONT} mt-7 text-2xl font-medium leading-tight tracking-[-0.02em] text-[#0a0a0a]`}>
                    {module.title}
                  </h4>
                  <p className="mt-3 text-sm leading-6 text-black/55">{module.copy}</p>
                  <div className={`${M_FONT} mt-auto flex items-center gap-2 pt-6 text-[10px] font-semibold uppercase tracking-[0.14em] text-black/35`}>
                    Conecta com {module.connected.slice(0, 2).join(', ')}
                    <ArrowUpRight size={13} className="text-[#f97316] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
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

function Input({
  label,
  name,
  type = 'text',
  required = false,
  icon: Icon,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  icon?: LucideIcon
}) {
  return (
    <label className="block">
      <span className={`${M_FONT} mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/50`}>
        {Icon && <Icon size={13} className="text-[#ea580c]" />}
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        className="h-12 w-full rounded-none border border-black/15 bg-white px-3 text-sm text-[#0a0a0a] outline-none transition placeholder:text-black/30 focus:border-[#f97316]"
      />
    </label>
  )
}

export function LandingPage() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    <div className={`${H_FONT} min-h-screen bg-white text-[#0a0a0a] antialiased`}>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }`}</style>

      <div ref={topSentinelRef} aria-hidden className="pointer-events-none h-px w-full" />

      {/* ── Header (claro, fino) ── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled ? 'border-b border-black/10 bg-white/85 backdrop-blur-xl' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 md:px-10">
          <a href="/" className="flex items-center gap-3">
            <BrandLockup dark />
          </a>
          <nav className="hidden items-center gap-7 lg:flex">
            {[
              ['Como funciona', HOW_ANCHOR],
              ['Base operacional', '#ontologia'],
              ['Impacto', '#impacto'],
              ['Módulos', '#modulos'],
              ['Perfis', '#perfis'],
              ['Realizações', '#realizacoes'],
              ['FAQ', '#faq'],
            ].map(([label, href]) => (
              <a key={href} href={href} className={`${M_FONT} text-[10px] font-medium uppercase tracking-[0.16em] text-black/55 transition hover:text-[#0a0a0a]`}>
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <a href={LOGIN_URL} className="hidden text-[11px] font-medium text-black/50 underline-offset-4 transition hover:text-[#0a0a0a] hover:underline sm:inline-flex">
              Acessar plataforma
            </a>
            <a
              href={DEMO_ANCHOR}
              className={`${M_FONT} group inline-flex items-center gap-2 border border-[#f97316] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c2410c] transition hover:bg-[#f97316] hover:text-white sm:px-4`}
            >
              Solicitar demonstração <ArrowRight size={13} className="hidden transition-transform duration-200 group-hover:translate-x-0.5 sm:inline" />
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero em carrossel: slide principal + 2 slides com foto de obra ── */}
        <HeroCarousel>
          <div className="relative h-full overflow-hidden bg-white pt-24 sm:pt-28">
            <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-10 md:px-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-6 lg:pb-12">
              <div data-sr>
                <p className={`${M_FONT} text-[10px] font-medium uppercase tracking-[0.18em] text-black/50 sm:text-[11px]`}>
                  [ Plataforma de planejamento e gestão da execução de obras ]
                </p>
                <h1 className={`${H_FONT} mt-6 max-w-2xl text-4xl font-medium leading-[1.04] tracking-[-0.03em] text-[#0a0a0a] sm:text-5xl lg:text-6xl`}>
                  Cada decisão da obra movida a <span className="text-[#ea580c]">dados conectados</span>, não a planilhas soltas.
                </h1>
                <p className="mt-6 max-w-xl text-base leading-7 text-black/60 sm:text-lg">
                  Campo, medição, suprimentos, planejamento e gestão executiva na mesma base operacional, em tempo real. Antes de qualquer sistema, nossa equipe entra na sua obra, entende cada processo e adapta a plataforma ao seu contexto. Você antecipa o problema antes que ele vire atraso, glosa ou custo oculto.
                </p>
                <div className={`${M_FONT} mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c2410c] sm:text-[11px]`}>
                  <span>Adaptada à sua obra antes de tudo</span>
                  <span className="text-black/30">/</span>
                  <span>Implantação em semanas, não meses</span>
                </div>
                <div className="mt-9">
                  <DemoCTA />
                </div>
              </div>
              <div data-sr data-sr-delay="2" className="relative hidden border border-black/10 bg-[#fdfdfc] p-3 lg:block">
                <Corners />
                <ObraFoundryScene variant="modules" />
              </div>
            </div>
          </div>
        </HeroCarousel>

        {/* ── Faixa de logos ── */}
        <section id="empresas" className="border-t border-black/10 bg-white py-14 sm:py-16">
          <p data-sr className="mx-auto max-w-3xl px-5 text-center text-sm leading-6 text-black/55 md:px-10">
            Construtoras, consórcios e empresas de saneamento e infraestrutura já decidem com dados conectados na ConstruData.
          </p>
          <div className="relative mt-8 overflow-hidden">
            <div className="pointer-events-none absolute left-0 z-20 h-full w-24 bg-gradient-to-r from-white" />
            <div className="pointer-events-none absolute right-0 z-20 h-full w-24 bg-gradient-to-l from-white" />
            <Marquee className="[--duration:34s] [--gap:4rem]" repeat={4}>
              {logos.map(([src, alt]) => (
                <img
                  key={src}
                  src={src}
                  alt={alt}
                  width={160}
                  height={56}
                  loading="lazy"
                  className="h-10 w-auto max-w-[150px] shrink-0 object-contain sm:h-14"
                />
              ))}
            </Marquee>
          </div>
        </section>

        {/* ── O problema ── */}
        <section id="problema" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
          <SectionHeader index="01" eyebrow="O problema" title="O dado da sua obra existe. Espalhado, ele não decide nada." />
          <div data-sr className="mx-auto mt-10 max-w-4xl px-5 md:px-10">
            <p className="text-lg leading-8 text-black/65">
              RDO num lugar, medição em planilha, suprimentos no e-mail, avanço no grupo de mensagens, custo no ERP. Quando alguém consolida tudo, a janela de decisão já passou — o atraso virou multa, a glosa virou prejuízo, a frente parada virou retrabalho. O problema raramente é falta de informação. É informação <strong className="font-semibold text-[#0a0a0a]">fragmentada, atrasada e desconectada da decisão</strong>.
            </p>
          </div>
        </section>

        {/* ── Como entramos na sua obra ── */}
        <section id="como-entramos" className="border-t border-black/10 bg-white py-20 sm:py-32">
          <SectionHeader
            index="02"
            eyebrow="Como entramos na sua obra"
            title="Não vendemos um sistema. Adaptamos a sua operação e a conectamos."
            copy="A ConstruData não é um software que você configura sozinho e torce para dar certo. Nossa equipe entra na obra, entende como ela funciona de verdade e transforma isso em decisão — rápido."
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
                  <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#f97316] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  <div className="flex items-center gap-3">
                    <span className={`${M_FONT} text-sm font-semibold text-[#c2410c]`}>[ {step.index} ]</span>
                    <span className="flex size-10 items-center justify-center border border-black/15 text-black/45 transition-colors duration-300 group-hover:text-[#ea580c]"><StepIcon size={20} /></span>
                  </div>
                  <h3 className={`${H_FONT} mt-6 text-2xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>{step.title}</h3>
                  <p className="mt-3 leading-7 text-black/60">{step.copy}</p>
                </article>
              )
            })}
          </div>
          <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-6 px-5 md:flex-row md:items-center md:justify-between md:px-10">
            <p data-sr className={`${H_FONT} max-w-xl text-xl font-medium leading-snug tracking-[-0.02em] text-[#0a0a0a]`}>
              Implantação em semanas, não em meses. Você não para a obra para "rodar um projeto de TI" — a ConstruData se adapta ao seu ritmo.
            </p>
            <DemoCTA />
          </div>
        </section>

        {/* ── A base operacional única (ontologia) ── */}
        <section id="ontologia" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
          <SectionHeader
            index="03"
            eyebrow="O diferencial técnico"
            title="Uma base única onde campo, projeto, custo e prazo falam a mesma língua — em tempo real."
            copy="No núcleo da ConstruData há um modelo operacional único — a ontologia da construção — que padroniza como obra, frente, serviço, equipe, material, prazo, custo e evidência se relacionam, em todos os módulos."
          />
          <div className="mx-auto mt-12 max-w-7xl px-5 md:px-10">
            <div data-sr className="relative grid items-center gap-8 border border-black/10 bg-white p-6 lg:grid-cols-[0.55fr_0.45fr] lg:p-10">
              <Corners />
              <ScreenFrame src="/screenshots/gestao360.png" path="construdata / gestão-360" alt="Tela da plataforma: Gestão 360" />
              <div>
                <p className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.2em] text-black/40`}>
                  Ontologia da construção · Base operacional
                </p>
                <p className="mt-4 text-base leading-7 text-black/65">
                  Construído numa lógica <strong className="font-semibold text-[#0a0a0a]">campo-primeiro</strong>, ele conecta o que acontece no canteiro aos sistemas que o sustentam (ERP, BIM, cronograma) <strong className="font-semibold text-[#0a0a0a]">sem trocar o que você já usa</strong>. Quando o engenheiro atualiza o RDO, cronograma, medição e suprimentos se ajustam sozinhos — sem retrabalho, sem planilha paralela.
                </p>
              </div>
            </div>
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

        {/* ── Impacto real ── */}
        <section id="impacto" className="border-t border-black/10 bg-white py-20 sm:py-32">
          <SectionHeader
            index="04"
            eyebrow="Impacto real"
            title="O que muda quando o dado de campo vira decisão."
            copy="Ajudamos empresas de engenharia e construção a ganhar vantagem competitiva real com dados conectados. Números rotulados como faixa observada."
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
                    <span className={`${M_FONT} text-xs font-semibold text-[#c2410c]`}>[ {String(i + 1).padStart(2, '0')} ]</span>
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

        {/* ── Diferencial único ── */}
        <section id="diferencial" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
          <SectionHeader
            index="05"
            eyebrow="Diferencial único"
            title="Todo mundo tem acesso a tecnologia. Nem todo mundo tem método."
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
                  <div className={`${M_FONT} text-sm font-semibold text-[#c2410c]`}>[ {number} ]</div>
                  <ShieldCheck className="size-5 text-black/20 transition-colors duration-300 group-hover:text-[#ea580c]" />
                </div>
                <div className="mt-auto flex flex-col gap-3 pt-16">
                  <h3 className={`${H_FONT} text-2xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>{title}</h3>
                  <p className="leading-7 text-black/60">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Implantação em obras reais ── */}
        <section className="border-t border-black/10 bg-white py-20 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <div className="grid border border-black/10 lg:grid-cols-[0.85fr_1.15fr]">
              <div data-sr className="border-b border-black/10 bg-[#f4f4f2] p-7 sm:p-10 lg:border-b-0 lg:border-r">
                <p className={`${M_FONT} text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c2410c]`}>Implantação em obras reais</p>
                <h2 className={`${H_FONT} mt-7 max-w-xl text-3xl font-medium leading-[1.05] tracking-[-0.03em] text-[#0a0a0a] sm:text-5xl`}>
                  Comece com o que a obra já usa.
                </h2>
              </div>
              <div className="grid gap-0 sm:grid-cols-3">
                {[
                  ['Planilhas, medições e RDOs', 'A plataforma aproveita seus controles atuais para criar uma base inicial sem parar a operação.'],
                  ['Fotos, propostas e relatórios', 'Cada evidência entra com origem, contexto e o módulo de destino recomendado.'],
                  ['Evolução sem ruptura', 'Os dados são organizados por módulo e o controle amadurece sem trocar tudo no primeiro dia.'],
                ].map(([title, copy], i) => (
                  <article
                    key={title}
                    data-sr
                    data-sr-delay={String(i + 1)}
                    className="group border-b border-black/10 bg-white p-7 transition-colors duration-300 hover:bg-[#f4f4f2] last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
                  >
                    <FileText className="size-7 text-[#f97316]" />
                    <h3 className={`${H_FONT} mt-7 text-xl font-medium leading-tight tracking-[-0.02em] text-[#0a0a0a]`}>{title}</h3>
                    <p className="mt-4 text-sm leading-7 text-black/55">{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Módulos ── */}
        <ModulesSection />

        {/* ── Para quem é ── */}
        <section id="perfis" className="border-t border-black/10 bg-white py-20 sm:py-32">
          <SectionHeader
            index="07"
            eyebrow="Para quem é"
            title="O visitante certo se reconhece rápido."
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
                <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#f97316] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                <Users className="size-8 text-[#ea580c]" />
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

        {/* ── Prova social ── */}
        {/* ── Realizações ── */}
        <section id="realizacoes" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
          <SectionHeader
            index="08"
            eyebrow="Realizações"
            title="Realizações"
            copy="Conheça nossos trabalhos realizados. Grandes obras que transformam a sociedade à sua volta são fruto de uma visão técnica completa. De orçamentos até os gerenciamentos mais complexos, garantimos minúcia no conhecimento e máxima confiabilidade em cada decisão."
          />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-t border-l border-black/10 px-5 sm:grid-cols-2 md:px-10 lg:grid-cols-3">
            {realizacoes.map((item, i) => (
              <figure
                key={`${item.empresa}-${item.obra}`}
                data-sr
                data-sr-delay={String((i % 3) + 1)}
                className="group relative border-b border-r border-black/10 bg-white"
              >
                <div className="overflow-hidden">
                  <img
                    src={item.img}
                    alt={`Obra ${item.obra} — ${item.empresa}`}
                    width={704}
                    height={528}
                    loading="lazy"
                    decoding="async"
                    className="aspect-[4/3] w-full object-cover grayscale transition duration-500 group-hover:scale-[1.03] group-hover:grayscale-0"
                  />
                </div>
                <figcaption className="p-5">
                  <p className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c2410c]`}>
                    [ {item.empresa} ]
                  </p>
                  <h3 className={`${H_FONT} mt-2 text-xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>{item.obra}</h3>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── Prova social ── */}
        <section id="prova" className="border-t border-black/10 bg-white py-20 sm:py-32">
          <SectionHeader index="09" eyebrow="Prova social" title="O que os líderes da construção estão dizendo." />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 gap-4 px-5 md:px-10 lg:grid-cols-3 lg:gap-px">
            {testimonials.map((t, i) => (
              <figure
                key={t.company}
                data-sr
                data-sr-delay={String(i + 1)}
                className="group relative flex flex-col border border-black/10 bg-white px-7 py-9 transition-colors duration-300 hover:border-black/30"
              >
                <Corners />
                <span className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c2410c]`}>{t.segment}</span>
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

        {/* ── Autonomia ── */}
        <section id="autonomia" className="border-t border-black/10 bg-[#f4f4f2] py-20 sm:py-32">
          <SectionHeader
            index="10"
            eyebrow="Autonomia para a cadeia inteira"
            title="A obra inteira fica mais inteligente."
            copy="Não porque tem mais dashboards. Porque mais pessoas decidem bem, na hora certa, com a informação certa. Você não está comprando um software — está dando autonomia para a sua cadeia inteira."
          />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-y border-black/10 px-5 md:px-10 lg:grid-cols-3">
            {autonomyCards.map(([place, person, copy], i) => (
              <article
                key={place}
                data-sr
                data-sr-delay={String(i + 1)}
                className="group relative flex flex-col border-b border-black/10 bg-white px-7 py-9 transition-colors duration-300 hover:bg-[#ececea] lg:border-r lg:p-10 lg:[&:nth-child(3n)]:border-r-0"
              >
                <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#f97316] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                <p className={`${M_FONT} text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c2410c]`}>{place}</p>
                <h3 className={`${H_FONT} mt-8 text-3xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>{person}</h3>
                <p className="mt-5 leading-7 text-black/60">{copy}</p>
              </article>
            ))}
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
                      <span className={`${M_FONT} text-xs font-semibold text-[#c2410c]`}>{String(i + 1).padStart(2, '0')}</span>
                      {question}
                    </span>
                    <Plus className="size-5 shrink-0 text-[#ea580c] transition-transform duration-200 group-open:rotate-45" />
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
              Veja a ConstruData na sua obra.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-black/60 sm:text-lg">
              Comece com um diagnóstico. Entendemos o seu contexto, mostramos a plataforma adaptada à sua realidade e você decide com clareza — sem compromisso de compra e sem implantação de meses.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="relative mx-auto mt-10 max-w-4xl border border-black/10 bg-white p-6 sm:p-9">
            <Corners />
            {sent ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <CheckCircle2 className="mb-5 text-[#ea580c]" size={42} />
                <h3 className={`${H_FONT} text-3xl font-medium text-[#0a0a0a]`}>Solicitação enviada.</h3>
                <p className="mt-3 max-w-md leading-7 text-black/60">
                  Nossa equipe entra em contato em até 1 dia útil para entender o cenário da sua obra e preparar a demonstração.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8 flex items-center gap-3">
                  <LockKeyhole className="text-[#ea580c]" size={20} />
                  <div>
                    <h3 className={`${H_FONT} text-2xl font-medium tracking-[-0.02em] text-[#0a0a0a]`}>Formulário de qualificação</h3>
                    <p className="mt-1 text-sm leading-6 text-black/50">Nome, e-mail corporativo, empresa, cargo e a sua principal dor.</p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input name="nome" label="Nome" required icon={Users} />
                  <Input name="sobrenome" label="Sobrenome" required icon={Users} />
                  <Input name="email" label="E-mail corporativo" type="email" required icon={FileText} />
                  <Input name="empresa" label="Nome da empresa" required icon={Building2} />
                  <Input name="cargo" label="Cargo" required icon={ClipboardCheck} />
                  <label className="block sm:col-span-2">
                    <span className={`${M_FONT} mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/50`}>
                      <BrainCircuit size={13} className="text-[#ea580c]" />
                      Principal dor
                    </span>
                    <textarea
                      name="dor"
                      rows={4}
                      className="w-full rounded-none border border-black/15 bg-white px-3 py-3 text-sm text-[#0a0a0a] outline-none transition placeholder:text-black/30 focus:border-[#f97316]"
                      placeholder="Ex.: RDO incompleto, medição manual, orçamento demorado, falta de integração com planejamento..."
                    />
                  </label>
                </div>
                {error && <p className="mt-4 border border-red-500/35 bg-red-500/[0.06] p-3 text-xs text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className={`${M_FONT} group mt-6 flex w-full items-center justify-center gap-3 bg-[#f97316] px-6 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#ea580c] disabled:opacity-60`}
                >
                  {sending ? 'Enviando...' : 'Solicitar demonstração'}
                  <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
                </button>
                <p className="mt-4 text-center text-xs leading-5 text-black/45">
                  A demonstração já vem adaptada à sua obra. Resposta em até 1 dia útil. Você conversa com quem entende de obra, não com um vendedor de software.
                </p>
              </>
            )}
          </form>
        </section>
      </main>

      {/* ── Footer denso ── */}
      <footer className="border-t border-black/10 bg-white pb-8 pt-14">
        <div className="mx-auto max-w-7xl px-5 md:px-10">
          <div className="grid gap-10 border-b border-black/10 pb-12 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <BrandLockup dark />
              <p className={`${H_FONT} mt-6 text-4xl font-medium tracking-[-0.04em] text-[#0a0a0a]/90 sm:text-6xl`}>ConstruData</p>
            </div>
            <nav className="flex flex-col gap-3">
              {[
                ['Como funciona', HOW_ANCHOR],
                ['Base operacional', '#ontologia'],
                ['Impacto', '#impacto'],
                ['Módulos', '#modulos'],
                ['Perfis', '#perfis'],
                ['Realizações', '#realizacoes'],
                ['FAQ', '#faq'],
              ].map(([label, href]) => (
                <a key={href} href={href} className={`${M_FONT} text-[11px] font-medium uppercase tracking-[0.16em] text-black/50 transition hover:text-[#0a0a0a]`}>
                  {label}
                </a>
              ))}
            </nav>
            <nav className="flex flex-col gap-3">
              <a href={DEMO_ANCHOR} className={`${M_FONT} text-[11px] font-medium uppercase tracking-[0.16em] text-[#c2410c] transition hover:text-[#0a0a0a]`}>
                Solicitar demonstração
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
