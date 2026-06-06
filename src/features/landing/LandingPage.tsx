import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
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
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { BrandLockup } from '@/components/shared/BrandLogo'
import { Badge } from '@/components/ui/badge'
import { Marquee } from '@/components/ui/marquee'
import hero1Img from '@/assets/hero1.png'
import hero2Img from '@/assets/hero2.png'
import hero3Img from '@/assets/hero3.png'

const CALENDLY_URL = 'https://calendly.com/joaodsouzanery/demonstracao-construdata'
const LOGIN_URL = '/login'
const LINKEDIN_ARTICLE_URL =
  'https://www.linkedin.com/posts/construdatasoftware_activity-7454469394803531776-O9rE?utm_source=share&utm_medium=member_desktop&rcm=ACoAAErBDOwBwdLxQtMem1Gp0OBHExuydnHDjKg'

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

const heroImages = [hero1Img, hero2Img, hero3Img]

const valueProofCards = [
  {
    metric: '20+ Módulos Conectados',
    title: 'Reduza retrabalho entre campo e escritório',
    copy: 'O dado nasce no RDO, na medição, no planejamento ou em suprimentos e segue conectado até a gestão executiva.',
  },
  {
    metric: '100% Origem Rastreável',
    title: 'Conecte RDO, medição, planejamento e suprimentos',
    copy: 'Serviço, local, equipe, evidência, material e custo usam a mesma base operacional para evitar versões paralelas.',
  },
  {
    metric: 'Dados em Tempo Real',
    title: 'Tenha rastreabilidade executiva por obra',
    copy: 'A diretoria acompanha avanço, pendências, custo e risco com contexto de campo, sem esperar consolidação manual.',
  },
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
    label: 'Preciso prestar contas para diretoria',
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

const modules: ModuleItem[] = [
  {
    id: 'gestao-360',
    category: 'gestao',
    icon: Layers3,
    title: 'Gestão 360',
    kicker: 'Diretoria em tempo real',
    copy: 'Consolida CPI, SPI, curva S, alertas, custo, prazo e avanço físico-financeiro por obra.',
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
    copy: 'Look-ahead, restrições, compromissos, PPC e causas de não cumprimento conectados ao cronograma real.',
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
    copy: 'Itens, composições, bases SINAPI/SEINFRA e N. Preço viram referência para planejamento, medição e EVM.',
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

const impactRows = [
  ['(0.1) Ganhe uma Vantagem Desleal', 'Redução de 3-5% no custo total sobre o faturamento.', 'Otimização de suprimentos e eliminação de perdas por erros de faturamento via Three-Way Match.'],
  ['(0.2) Entregue com Velocidade', 'Controle total da sua obra em dias, não meses.', 'Integração instantânea de cronogramas, planejamento, financeiro e execução do campo na mesma ontologia de dados.'],
  ['(0.3) Economize Tempo', 'Redução de 80% no tempo de orçamentação.', 'Automação de processos de alocação e ciclos de relatórios em tempo real, com RDO digital.'],
  ['(0.4) Fortaleça sua Cadeia', 'Queda de 40% nos riscos de falta de material.', 'Alertas preditivos e monitoramento proativo de interrupções na cadeia de suprimentos.'],
  ['(0.5) Controle do Avanço Físico-Financeiro', 'Controle todas as decisões financeiras dentro da sua obra.', 'Integração dos módulos e das decisões da obra dentro do sistema, para controle financeiro total de cada setor e núcleo.'],
]

const differentiators = [
  ['01', 'Ontologia da construção', 'Obra, frente, serviço, equipe, material, prazo, custo e evidência seguem o mesmo modelo operacional em todos os módulos.'],
  ['02', 'Loop de feedback rápido', 'O que o campo registra no RDO alimenta medição, qualidade, planejamento, gestão e relatórios sem retrabalho.'],
  ['03', 'LPS / Lean nativo', 'Last Planner System com look-ahead de 6 semanas, PPC semanal, restrições, compromissos e causas de não cumprimento conectados ao cronograma real.'],
  ['04', 'Decisão antes do relatório', 'A plataforma cruza dados e aponta a próxima ação antes que o problema vire atraso, glosa ou custo oculto.'],
]

const audience = [
  ['Construtoras de médio porte', 'A diretoria enxerga resultado tarde demais, depois que planilha, RDO e financeiro já divergiram.', 'O ConstruData cria uma base operacional única para acompanhar campo, medição, custo e prazo por obra.'],
  ['Saneamento e infraestrutura', 'Serviços por rua, núcleo, OS e evidência ficam espalhados entre equipes, fiscais e medição.', 'RDO, mapa, cronograma e medição usam os mesmos códigos, locais e evidências para reduzir retrabalho.'],
  ['EPC e consórcios', 'Várias empresas participam da entrega, mas a governança precisa de rastreabilidade e permissão por perfil.', 'A plataforma organiza empresas, usuários, aprovações, evidências e auditoria em ambiente multiempresa.'],
  ['Empreiteiras', 'A produção executada no campo demora para virar medição defensável com memória e anexos.', 'O RDO finalizado gera rascunho de medição por empreiteiro, núcleo, serviço e evidência para conferência.'],
]

const autonomyCards = [
  ['No canteiro', 'O engenheiro', 'decide melhor sobre o que registrar, o que medir e qual restrição abrir, porque vê o impacto da decisão no cronograma, na medição e na qualidade.'],
  ['No escritório', 'O gerente', 'decide melhor sobre realocação de equipe, aprovação de pedido, priorização de obra e risco de prazo, porque acompanha CPI/SPI sem depender de relatório manual.'],
  ['No celular', 'O diretor', 'decide melhor sobre portfólio, novas obras e conversas com clientes, porque abre a plataforma e entende em segundos o que está de pé e o que está caindo.'],
]

const testimonials = [
  ['Felipe Nery', 'Engenheiro Engelfer', 'A plataforma coloca o dado de campo no centro da decisão, sem depender de consolidação manual.'],
  ['Fabrizzio de Paoli', 'Consórcio Se Liga Na Rede', 'Quando RDO, planejamento e medição conversam, a gestão deixa de discutir planilha e passa a discutir decisão.'],
  ['Matheus Marques', 'Vila Rica Engenharia', 'O valor está em rastrear origem, pendência e responsabilidade antes que o problema chegue ao fechamento.'],
]

const logos = [
  ['/logos/social-proof/engelfer-horizontal.png', 'Engelfer Engenharia'],
  ['/logos/social-proof/cslnr.jpg', 'Consórcio Se Liga na Rede'],
  ['/logos/social-proof/vr.jfif', 'Vila Rica Engenharia'],
  ['/logos/social-proof/engelfer-selo.png', 'Engelfer Engenharia'],
]

const faqs = [
  ['O ConstruData substitui minhas planilhas no primeiro dia?', 'Não precisa. A implantação pode começar absorvendo as planilhas, PDFs, fotos e controles que a empresa já usa. O sistema organiza essas informações, preserva a origem dos dados e transforma o que antes era planilha solta em base rastreável para medição, planejamento, RDO, qualidade e gestão executiva.'],
  ['O RDO fecha automaticamente a medição?', 'O RDO pode alimentar a medição quando existe vínculo suficiente entre serviço, local, quantidade, período, equipe e evidência. Mesmo assim, o fechamento continua exigindo revisão humana. A lógica é acelerar a conferência e reduzir retrabalho, sem tirar o controle técnico e financeiro de quem aprova.'],
  ['Funciona para saneamento e infraestrutura?', 'Sim. A estrutura foi pensada para contratos com núcleos, ruas, trechos, frentes de serviço, OS, equipes, materiais, fotos e medições por período. O mapa, o RDO e a medição usam a mesma chave operacional para reduzir divergência entre campo, fiscalização e escritório.'],
  ['A plataforma conversa com SINAPI, SEINFRA, BIM e cronogramas?', 'Sim. O ConstruData foi desenhado para conectar bases técnicas, composições, orçamento, modelos BIM, cronogramas e execução real. A ideia não é trocar todos os sistemas de uma vez, mas criar uma camada operacional que faça esses dados conversarem com menos retrabalho.'],
  ['Como começa uma obra nova?', 'Uma obra normalmente começa com contrato, proposta, orçamento, cronograma, frentes ou núcleos, responsáveis, fornecedores, subempreiteiros, critérios de medição e modelo de RDO. A partir disso, o sistema cria a base para acompanhar avanço, pendências, evidências, equipe, equipamentos, qualidade e suprimentos.'],
  ['Preciso mudar todos os processos antes de usar?', 'Não. A implantação pode ser progressiva. Primeiro entram os dados essenciais e os fluxos mais críticos, como RDO, medição, planejamento ou suprimentos. Depois a empresa amadurece os demais módulos conforme a operação ganha confiança e padronização.'],
  ['Quem consegue usar no campo pelo celular?', 'Engenheiros, encarregados, técnicos, fiscais e equipes autorizadas podem registrar informações pelo celular, conforme permissões da empresa. A experiência é pensada para o canteiro: poucos cliques, campos objetivos, fotos, ocorrências, equipe, equipamentos e serviços executados.'],
  ['Como o ConstruData evita dados falsos ou sem origem?', 'Cada informação importante precisa manter vínculo com origem, responsável, data, obra, frente, serviço e evidência quando aplicável. O sistema diferencia rascunho, dado importado, dado validado e dado aprovado, criando uma trilha de auditoria para reduzir discussões no fechamento.'],
  ['É possível controlar várias empresas ou obras na mesma conta?', 'Sim. O ambiente é multiempresa e multiobra. Usuários globais ou administradores podem alternar entre empresas autorizadas, enquanto cada equipe comum acessa apenas o que foi liberado por perfil, organização e permissão.'],
  ['O sistema serve para empreiteiros e subcontratados?', 'Sim. Empreiteiros podem ter controles de produção, evidências, medições, pendências e aprovações vinculadas ao contrato. Isso ajuda a tornar o fechamento mais claro, com menos troca de mensagens e menos divergência sobre o que foi executado.'],
  ['O que acontece quando falta informação para criar uma obra completa?', 'O sistema pode trabalhar com checklist de pendências. O que já existe entra como base, e o que falta fica sinalizado: contrato final, endereço, áreas, quantitativos, cronograma, responsáveis, fornecedores, critérios de aceite, fotos iniciais e regras de medição.'],
  ['Quanto tempo leva para implantar?', 'Depende da qualidade dos dados e do escopo inicial. Uma implantação enxuta pode começar por uma obra, um fluxo e poucos módulos críticos. Conforme os dados são validados, a empresa amplia para planejamento, qualidade, suprimentos, EVM, BIM e gestão executiva.'],
  ['O ConstruData usa IA para tomar decisões sozinho?', 'Não. A IA ajuda a organizar dados, identificar riscos, sugerir pendências, resumir documentos e apontar inconsistências. Decisões críticas, aprovações, medições e alterações contratuais continuam passando por confirmação humana.'],
  ['Como sei se o sistema está gerando eficiência de verdade?', 'A eficiência aparece em indicadores práticos: menos tempo para fechar medição, menos planilhas paralelas, menos RDO incompleto, maior previsibilidade de prazo, menos falta de material, menos retrabalho de conferência e mais decisões tomadas com dado de campo rastreável.'],
]

const ontologyCards: Array<{ icon: LucideIcon; title: string; copy: string }> = [
  {
    icon: Layers3,
    title: 'Funções centrais conectadas',
    copy: 'A Ontologia da Construção integra todas as funções centrais, da pré-construção ao suprimento, execução no canteiro e encerramento do projeto, através de uma camada semântica unificada.',
  },
  {
    icon: DatabaseZap,
    title: 'Objetos de negócio compartilhados',
    copy: 'Em sua essência, a Ontologia padroniza como os departamentos interagem com objetos de negócio compartilhados, como projetos, atividades, equipamentos e subempreiteiros, garantindo definições consistentes e sincronização em tempo real em toda a empresa.',
  },
  {
    icon: FileText,
    title: 'Campo-primeiro',
    copy: 'Construída sob uma perspectiva "campo-primeiro", a Ontologia conecta o que acontece no canteiro de obras aos sistemas que o suportam (ERP, BIM, Cronogramas) em um ambiente low-code acessível a todos os usuários, independentemente do background técnico.',
  },
  {
    icon: BrainCircuit,
    title: 'IA aplicada à execução',
    copy: 'O ConstruData faz a ponte entre plataformas fundamentais e casos de uso críticos. Ela permite decisões baseadas em IA que preveem atrasos no cronograma antes que ocorram, aceleram o alinhamento de fornecedores e sintetizam a entrega do projeto com metas de segurança, orçamento e prazo, reduzindo o risco em toda a execução, enquanto preserva seus investimentos tecnológicos existentes.',
  },
  {
    icon: Sparkles,
    title: 'Na prática',
    copy: 'Quando o engenheiro atualiza o RDO no campo, o cronograma, o EVM e os suprimentos se ajustam automaticamente - sem retrabalho, sem planilhas paralelas.',
  },
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

/* Palantir-style section header: numbered monospace eyebrow, large grotesque
   headline left-aligned, supporting copy on the right, thin hairline below. */
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
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#f97316]">
            {index ? `${index} — ` : ''}
            {eyebrow}
          </p>
          {title && (
            <h2 className="mt-5 max-w-3xl font-['Space_Grotesk'] text-4xl font-medium leading-[1.02] tracking-[-0.02em] text-[#0a0a0a] sm:text-5xl lg:text-6xl">
              {title}
            </h2>
          )}
        </div>
        {copy && <p className="max-w-xl text-base leading-7 text-black/55 lg:justify-self-end lg:text-right">{copy}</p>}
      </div>
    </div>
  )
}

/* Palantir-style arrow link: arrow slides on hover */
function ArrowLink({
  href,
  children,
  external = false,
  variant = 'text',
}: {
  href: string
  children: ReactNode
  external?: boolean
  variant?: 'text' | 'solid' | 'outline'
}) {
  const base = 'group inline-flex items-center gap-2.5 transition-colors'
  const styles =
    variant === 'solid'
      ? 'min-h-12 bg-[#0a0a0a] px-6 py-3.5 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-[#f97316]'
      : variant === 'outline'
        ? 'min-h-12 border border-black/20 px-6 py-3.5 text-xs font-bold uppercase tracking-[0.12em] text-[#0a0a0a] hover:border-[#0a0a0a]'
        : 'text-xs font-bold uppercase tracking-[0.12em] text-[#0a0a0a] hover:text-[#f97316]'
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`${base} ${styles}`}
    >
      {children}
      <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
    </a>
  )
}

function ModulesSection() {
  const [activePain, setActivePain] = useState<ModulePain>('avanco')
  const activeDetails = modulePainTabs.find((pain) => pain.id === activePain) ?? modulePainTabs[0]
  const ActiveIcon = activeDetails.icon
  const activeModules = activeDetails.moduleIds
    .map((moduleId) => modules.find((module) => module.id === moduleId))
    .filter((module): module is ModuleItem => Boolean(module))

  return (
    <section id="modulos" className="bg-[#f6f5f2] py-20 sm:py-32">
      <SectionHeader
        index="05"
        eyebrow="Módulos"
        title="Escolha o problema. Veja o módulo que resolve."
        copy="Tudo conversando na mesma base, em tempo real. O dado de campo vira decisão executiva em segundos — e o gestor antecipa o problema antes que ele vire atraso, glosa ou custo oculto."
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

        {/* Active pain: context (left) + relevant modules (right) */}
        <div
          key={activePain}
          className="grid animate-[fadeIn_0.4s_ease-out] grid-cols-1 border-b border-black/10 lg:grid-cols-[0.42fr_0.58fr]"
        >
          <aside className="border-b border-black/10 bg-white p-7 sm:p-9 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center bg-[#0a0a0a] text-white">
                <ActiveIcon size={22} />
              </span>
              <h3 className="font-['Space_Grotesk'] text-2xl font-medium leading-tight tracking-[-0.01em] text-[#0a0a0a] sm:text-3xl">
                {activeDetails.title}
              </h3>
            </div>
            <p className="mt-7 text-base font-medium leading-7 text-[#0a0a0a] sm:text-lg">{activeDetails.challenge}</p>
            <p className="mt-5 text-base leading-7 text-black/55 sm:text-lg">{activeDetails.solution}</p>
            <div className="mt-8 border-l-2 border-[#f97316] pl-5">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#f97316]">Resultado mensurável</p>
              <p className="mt-2 leading-7 text-black/65">{activeDetails.outcome}</p>
            </div>
          </aside>

          <div className="divide-y divide-black/10 bg-white">
            {activeModules.map((module) => {
              const Icon = module.icon
              return (
                <div key={module.id} className="group flex items-start gap-5 p-7 transition-colors duration-200 hover:bg-[#f6f5f2] sm:p-9">
                  <div className="flex size-12 shrink-0 items-center justify-center border border-black/15 bg-white text-[#f97316] transition-colors duration-200 group-hover:border-[#f97316] group-hover:bg-[#f97316] group-hover:text-white">
                    <Icon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-['Space_Grotesk'] text-xl font-medium leading-tight tracking-[-0.01em] text-[#0a0a0a] sm:text-2xl">
                        {module.title}
                      </h4>
                      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#f97316]">{module.kicker}</span>
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

        {/* All modules grid — invert-to-black on hover */}
        <div className="mt-16">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-black/40">A plataforma completa — 14 módulos conectados</p>
          <div className="mt-6 grid grid-cols-1 border-t border-l border-black/10 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module, i) => {
              const Icon = module.icon
              return (
                <article
                  key={module.id}
                  data-sr
                  data-sr-delay={String((i % 3) + 1)}
                  className="group relative flex min-h-[230px] flex-col border-b border-r border-black/10 bg-white p-6 transition-colors duration-300 hover:bg-[#f6f5f2] sm:p-7"
                >
                  <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#f97316] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                  <div className="flex items-start justify-between">
                    <div className="flex size-11 items-center justify-center border border-black/15 text-[#f97316] transition-colors duration-300 group-hover:border-[#f97316]">
                      <Icon size={20} />
                    </div>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#f97316]">{module.kicker}</span>
                  </div>
                  <h4 className="mt-7 font-['Space_Grotesk'] text-2xl font-medium leading-tight tracking-[-0.01em] text-[#0a0a0a]">
                    {module.title}
                  </h4>
                  <p className="mt-3 text-sm leading-6 text-black/55">{module.copy}</p>
                  <div className="mt-auto flex items-center gap-2 pt-6 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">
                    Conecta com {module.connected.slice(0, 2).join(', ')}
                    <ArrowUpRight size={13} className="text-[#f97316] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </article>
              )
            })}
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
      <span className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-black/45">
        {Icon && <Icon size={13} className="text-[#f97316]" />}
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

function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  const [previous, setPrevious] = useState<number | null>(null)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrent((index) => {
        setPrevious(index)
        return (index + 1) % heroImages.length
      })
    }, 5000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (previous === null) return
    const timeout = window.setTimeout(() => setPrevious(null), 1100)
    return () => window.clearTimeout(timeout)
  }, [previous])

  return (
    <div className="absolute inset-0">
      {previous !== null && previous !== current && (
        <div
          key={`previous-${heroImages[previous]}`}
          className="absolute inset-0 bg-cover bg-[position:56%_center] sm:bg-center"
          style={{ backgroundImage: `url(${heroImages[previous]})` }}
        />
      )}
      <div
        key={`current-${heroImages[current]}`}
        className="absolute inset-0 animate-[heroFade_1s_ease-out] bg-cover bg-[position:56%_center] sm:bg-center"
        style={{ backgroundImage: `url(${heroImages[current]})` }}
      />
    </div>
  )
}

export function LandingPage() {
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const topSentinelRef = useRef<HTMLDivElement>(null)

  // The landing may render inside a scroll container (not the window), so a
  // window scroll listener never fires. An IntersectionObserver on a top
  // sentinel works regardless of which element actually scrolls.
  useEffect(() => {
    const el = topSentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      threshold: 0,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const html = document.documentElement
    const previousTheme = html.getAttribute('data-theme')
    // The landing paints every surface with explicit colors. Remove the app
    // theme attribute so [data-theme] overrides in globals.css don't rewrite
    // bg-white (dark mode) or text-white (light mode) on our own markup.
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
    <div className="min-h-screen bg-white text-[#0a0a0a] antialiased">
      <style>{`
        @keyframes heroFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* Sentinel: when it scrolls out the top, the header switches to solid white. */}
      <div ref={topSentinelRef} aria-hidden className="pointer-events-none h-px w-full" />

      {/* ── Header (transparent over hero → solid white on scroll) ── */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled ? 'border-b border-black/[0.08] bg-white/85 backdrop-blur-xl' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-10">
          <a href="/" className="flex items-center gap-3">
            <BrandLockup dark={scrolled} />
          </a>
          <nav className="hidden items-center gap-8 lg:flex">
            {[
              ['Ontologia', '#ontologia'],
              ['Impacto', '#impacto'],
              ['Módulos', '#modulos'],
              ['Perfis', '#perfis'],
              ['Contato', '#contato'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className={`font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                  scrolled ? 'text-black/50 hover:text-[#0a0a0a]' : 'text-white/70 hover:text-white'
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <a
              href={LOGIN_URL}
              className={`hidden border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition sm:inline-flex ${
                scrolled
                  ? 'border-black/15 text-black/65 hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                  : 'border-white/30 text-white/85 hover:border-white hover:text-white'
              }`}
            >
              Acessar
            </a>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`group inline-flex items-center gap-2 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition sm:px-4 ${
                scrolled ? 'bg-[#0a0a0a] text-white hover:bg-[#f97316]' : 'bg-white text-[#0a0a0a] hover:bg-white/90'
              }`}
            >
              Demo <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero (kept dark — striking construction imagery) ── */}
        <section className="landing-hero relative flex min-h-[100svh] flex-col overflow-hidden bg-[#0d0d0d] pt-16 lg:min-h-screen">
          <HeroCarousel />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,10,0.12)_0%,rgba(10,10,10,0.48)_42%,rgba(10,10,10,0.98)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,10,10,0.9)_0%,rgba(10,10,10,0.56)_46%,rgba(10,10,10,0.08)_100%)]" />
          <div className="pointer-events-none absolute right-[4%] top-[14%] hidden h-72 w-72 rounded-full border border-white/18 lg:block" />
          <div className="pointer-events-none absolute right-[10%] top-[20%] hidden h-[28rem] w-[28rem] rounded-full border border-white/10 lg:block" />
          <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-end px-4 pb-0 pt-6 sm:px-5 md:px-10 lg:pt-24">
            <div className="grid flex-1 items-end gap-10 py-7 sm:py-10 lg:grid-cols-[0.58fr_0.42fr] lg:py-16">
              <div className="flex max-w-3xl animate-[fadeIn_0.7s_ease-out] flex-col items-start justify-end space-y-4 text-left sm:space-y-5">
                <Badge
                  className="max-w-full rounded-none border-white/18 bg-white/10 px-3 py-1 text-left text-[10px] leading-4 text-[#f97316] backdrop-blur-md sm:px-4 sm:text-xs"
                  variant="outline"
                >
                  Plataforma de Planejamento e Gestão da Execução da Obra
                </Badge>
                <h1 className="font-['Space_Grotesk'] text-4xl font-medium leading-[0.95] tracking-[-0.02em] text-white sm:text-6xl lg:text-7xl">
                  ConstruData
                </h1>
                <p className="max-w-3xl font-['Space_Grotesk'] text-xl font-medium leading-[1.15] tracking-[-0.01em] text-white sm:text-3xl lg:text-[2.5rem]">
                  Tecnologia boa consegue realizar tarefas que você precisa fazer mais rápido. Mas excelentes tecnologias te permitem realizar coisas que você não conseguia antes.
                </p>
                <p className="max-w-2xl text-base font-semibold leading-7 text-[#f97316] sm:text-lg">
                  Automação Alimentada por IA para cada Decisão na Construção.
                </p>
                <p className="max-w-2xl text-sm leading-7 text-white/75 sm:text-base md:leading-7">
                  Todos os dados da sua obra conversando em tempo real — campo, medição, suprimentos, planejamento e gestão executiva na mesma base operacional. O tomador de decisões antecipa problemas antes que virem atraso, glosa ou custo oculto.
                </p>
                <div className="h-[2px] w-14 bg-[#f97316]" />
                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                  <a
                    href={CALENDLY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex min-h-12 items-center justify-center gap-3 bg-[#f97316] px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-white shadow-[0_0_34px_rgba(249,115,22,0.28)] transition hover:-translate-y-0.5 hover:bg-[#ea580c] sm:px-7 sm:py-4 sm:text-sm sm:tracking-[0.1em]"
                  >
                    Ver como funciona <ArrowRight size={17} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </a>
                  <a
                    href={LOGIN_URL}
                    className="inline-flex min-h-12 items-center justify-center border border-white/24 bg-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-white backdrop-blur-md transition hover:-translate-y-0.5 hover:border-[#f97316] sm:px-7 sm:py-4 sm:text-sm sm:tracking-[0.1em]"
                  >
                    Acessar plataforma
                  </a>
                </div>
              </div>

              <div className="hidden lg:block">
                <div className="ml-auto max-w-sm space-y-6 pb-14">
                  {[
                    {
                      icon: Building2,
                      name: 'Obra Orla Marítima',
                      role: 'Saneamento · 6 frentes ativas',
                      offset: '',
                      rows: [
                        ['RDO de hoje', 5, '12 frentes'],
                        ['Medição', 4, '87% conferido'],
                        ['Qualidade', 5, 'sem NC'],
                      ] as Array<[string, number, string]>,
                    },
                    {
                      icon: Layers3,
                      name: 'Núcleo Vila Nova',
                      role: 'Infraestrutura · 5 equipes',
                      offset: 'translate-x-8',
                      rows: [
                        ['Planejamento', 5, 'no prazo'],
                        ['Suprimentos', 4, '2 alertas'],
                        ['Avanço físico', 5, '93%'],
                      ] as Array<[string, number, string]>,
                    },
                  ].map(({ icon: CardIcon, name, role, offset, rows }) => (
                    <div
                      key={name}
                      className={`border border-white/12 bg-[#161616]/85 p-4 shadow-2xl backdrop-blur-md transition hover:-translate-y-1 hover:border-[#f97316]/40 ${offset}`}
                    >
                      <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f97316]/15 text-[#f97316]">
                          <CardIcon size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{name}</p>
                          <p className="truncate text-[11px] text-white/55">{role}</p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2.5">
                        {rows.map(([label, filled, metric]) => (
                          <div key={label} className="flex items-center justify-between gap-3">
                            <span className="text-xs text-white/80">{label}</span>
                            <div className="flex items-center gap-2.5">
                              <div className="flex gap-1">
                                {[0, 1, 2, 3, 4].map((d) => (
                                  <span key={d} className={`size-2 rounded-full ${d < filled ? 'bg-[#22c55e]' : 'bg-white/15'}`} />
                                ))}
                              </div>
                              <span className="w-20 text-right text-[10px] text-white/45">{metric}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 border-t border-white/14 bg-[#0a0a0a]/82 backdrop-blur-md sm:grid-cols-3 sm:divide-x sm:divide-white/14">
              {valueProofCards.map((card, i) => (
                <div key={card.metric} className="flex items-start gap-4 px-4 py-5 text-left sm:px-6 sm:py-7">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/25 font-mono text-[11px] font-bold text-white/70">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#f97316]">{card.metric}</p>
                    <p className="mt-1.5 text-sm leading-6 text-white/85">{card.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Ontologia ── */}
        <section id="ontologia" className="bg-white py-20 sm:py-32">
          <SectionHeader index="01" eyebrow="A Ontologia da Construção" title="O Diferencial Técnico" copy="Uma camada semântica única faz campo, projeto, custo e prazo falarem a mesma língua — em tempo real." />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-y border-black/10 px-5 md:px-10 lg:grid-cols-2 xl:grid-cols-3">
            {ontologyCards.map(({ icon: Icon, title, copy }, i) => (
              <article
                key={title}
                data-sr
                data-sr-delay={String((i % 3) + 1)}
                className="group relative border-b border-black/10 bg-white p-7 transition-colors duration-300 hover:bg-[#f6f5f2] lg:border-r lg:p-9 xl:[&:nth-child(3n)]:border-r-0"
              >
                <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#f97316] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                <div className="flex size-12 items-center justify-center border border-black/15 text-[#f97316] transition-colors duration-300 group-hover:border-[#f97316]">
                  <Icon size={24} />
                </div>
                <h3 className="mt-9 font-['Space_Grotesk'] text-2xl font-medium tracking-[-0.01em] text-[#0a0a0a]">{title}</h3>
                <p className="mt-4 leading-7 text-black/55">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ── Impacto ── */}
        <section id="impacto" className="bg-[#f6f5f2] py-20 sm:py-32">
          <SectionHeader
            index="02"
            eyebrow="Impacto real em escala"
            title="Impacto Real em Escala"
            copy="Ajudamos empresas de engenharia e construção a dominarem o mercado com dados conectados."
          />
          <div className="mx-auto mt-12 max-w-7xl px-5 md:px-10">
            <div className="border-t border-black/10">
              {impactRows.map(([category, impact, how], i) => (
                <div
                  key={category}
                  data-sr
                  data-sr-delay={String((i % 3) + 1)}
                  className="group grid gap-4 border-b border-black/10 py-8 transition-colors duration-200 hover:bg-white lg:grid-cols-[0.8fr_0.85fr_1.1fr] lg:items-center"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-[#f97316]">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-black/55">{category}</h3>
                  </div>
                  <p className="font-['Space_Grotesk'] text-2xl font-medium leading-[1.05] tracking-[-0.01em] text-[#0a0a0a] sm:text-3xl">{impact}</p>
                  <p className="leading-7 text-black/55">{how}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Empresas ── */}
        <section id="empresas" className="bg-white py-20 sm:py-32">
          <SectionHeader index="03" eyebrow="Empresas que confiam no ConstruData" />
          <div className="relative mt-12 overflow-hidden border-y border-black/10 py-10">
            <div className="pointer-events-none absolute left-0 z-20 h-full w-24 bg-gradient-to-r from-white" />
            <div className="pointer-events-none absolute right-0 z-20 h-full w-24 bg-gradient-to-l from-white" />
            <Marquee className="[--duration:34s] [--gap:1.5rem]" repeat={4}>
              {logos.map(([src, alt]) => (
                <div
                  key={src}
                  className="flex h-28 w-64 shrink-0 items-center justify-center border border-black/10 bg-white p-5 transition-colors duration-300 hover:border-black/30"
                >
                  <img src={src} alt={alt} className="max-h-full max-w-full object-contain opacity-50 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0" />
                </div>
              ))}
            </Marquee>
          </div>
        </section>

        {/* ── Diferencial ── */}
        <section id="diferencial" className="bg-[#0a0a0a] py-20 text-white sm:py-32">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <div data-sr className="grid gap-6 border-b border-white/12 pb-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#f97316]">04 — Diferencial único</p>
                <h2 className="mt-5 max-w-3xl font-['Space_Grotesk'] text-4xl font-medium leading-[1.02] tracking-[-0.02em] text-white sm:text-5xl lg:text-6xl">
                  Todo mundo tem acesso a código. Nem todo mundo tem metodologia.
                </h2>
              </div>
              <p className="max-w-xl text-base leading-7 text-white/55 lg:justify-self-end lg:text-right">
                Dados de campo virando decisão executiva em segundos, não dias.
              </p>
            </div>
          </div>
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-y border-white/12 px-5 sm:grid-cols-2 md:px-10 lg:grid-cols-4">
            {differentiators.map(([number, title, copy], i) => (
              <div
                key={number}
                data-sr
                data-sr-delay={String(i + 1)}
                className="group flex flex-col border-b border-white/12 p-7 transition-colors duration-300 hover:bg-white/[0.04] sm:border-r lg:min-h-[330px] lg:p-9 lg:[&:nth-child(4n)]:border-r-0"
              >
                <div className="flex items-center justify-between">
                  <div className="font-mono text-sm font-bold text-[#f97316]">{number}</div>
                  <ShieldCheck className="size-5 text-white/25 transition-colors duration-300 group-hover:text-[#f97316]" />
                </div>
                <div className="mt-auto flex flex-col gap-3 pt-16">
                  <h3 className="font-['Space_Grotesk'] text-2xl font-medium tracking-[-0.01em] text-white sm:text-3xl">{title}</h3>
                  <p className="leading-7 text-white/55">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Implementação ── */}
        <section className="bg-white py-20 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <div className="grid border border-black/10 lg:grid-cols-[0.85fr_1.15fr]">
              <div data-sr className="border-b border-black/10 bg-[#f6f5f2] p-7 sm:p-10 lg:border-b-0 lg:border-r">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#f97316]">Implantação em obras reais</p>
                <h2 className="mt-7 max-w-xl font-['Space_Grotesk'] text-3xl font-medium leading-[1.05] tracking-[-0.02em] text-[#0a0a0a] sm:text-5xl">
                  Comece com os documentos que a obra já usa.
                </h2>
              </div>
              <div className="grid gap-0 sm:grid-cols-3">
                {[
                  ['Planilhas, medições e RDOs', 'O sistema aproveita controles existentes para criar uma base inicial sem parar a operação.'],
                  ['Fotos, propostas e relatórios', 'Cada evidência entra com contexto, origem e destino recomendado nos módulos corretos.'],
                  ['Evolução sem ruptura', 'O ConstruData organiza os dados por módulo e permite amadurecer o controle sem trocar tudo no primeiro dia.'],
                ].map(([title, copy], i) => (
                  <article
                    key={title}
                    data-sr
                    data-sr-delay={String(i + 1)}
                    className="group border-b border-black/10 p-7 transition-colors duration-300 hover:bg-[#f6f5f2] last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
                  >
                    <FileText className="size-7 text-[#f97316]" />
                    <h3 className="mt-7 font-['Space_Grotesk'] text-xl font-medium leading-tight tracking-[-0.01em] text-[#0a0a0a]">{title}</h3>
                    <p className="mt-4 text-sm leading-7 text-black/55">{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Modules ── */}
        <ModulesSection />

        {/* ── Depoimentos ── */}
        <section id="depoimentos" className="bg-white py-20 sm:py-32">
          <SectionHeader index="06" eyebrow="O que os líderes da construção estão dizendo" />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-y border-black/10 px-5 md:px-10 lg:grid-cols-3">
            {testimonials.map(([name, role, quote], i) => (
              <figure
                key={name}
                data-sr
                data-sr-delay={String(i + 1)}
                className="group relative flex flex-col border-b border-black/10 bg-white px-7 py-9 transition-colors duration-300 hover:bg-[#f6f5f2] lg:border-r lg:px-9 lg:py-12 lg:[&:nth-child(3n)]:border-r-0"
              >
                <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#f97316] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                <blockquote className="text-xl leading-9 text-[#0a0a0a]">"{quote}"</blockquote>
                <figcaption className="mt-auto border-t border-black/10 pt-6">
                  <div className="font-['Space_Grotesk'] text-xl font-medium text-[#0a0a0a]">{name}</div>
                  <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#f97316]">{role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── Perfis ── */}
        <section id="perfis" className="bg-[#f6f5f2] py-20 sm:py-32">
          <SectionHeader
            index="07"
            eyebrow="Para quem é o ConstruData?"
            title="O visitante certo se reconhece rápido."
            copy="Cada perfil entra por uma dor diferente, mas todos chegam ao mesmo ponto: dado de campo confiável virando decisão, medição e planejamento."
          />
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-y border-black/10 px-5 md:grid-cols-2 md:px-10">
            {audience.map(([title, problem, solution], i) => (
              <article
                key={title}
                data-sr
                data-sr-delay={String((i % 2) + 1)}
                className="group relative border-b border-black/10 bg-white px-7 py-9 transition-colors duration-300 hover:bg-[#f6f5f2] md:border-r lg:p-10 md:[&:nth-child(2n)]:border-r-0"
              >
                <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#f97316] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                <Users className="size-9 text-[#f97316]" />
                <h3 className="mt-7 font-['Space_Grotesk'] text-2xl font-medium tracking-[-0.01em] text-[#0a0a0a] sm:text-3xl">
                  {title}
                </h3>
                <p className="mt-6 leading-7 text-black/55">
                  <strong className="font-semibold text-[#0a0a0a]">Problema:</strong> {problem}
                </p>
                <p className="mt-4 leading-7 text-black/55">
                  <strong className="font-semibold text-[#0a0a0a]">Como resolve:</strong> {solution}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ── LinkedIn ── */}
        <section id="linkedin" className="bg-white py-20 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 md:px-10">
            <div data-sr className="grid gap-8 border border-black/10 bg-[#f6f5f2] p-7 lg:grid-cols-[0.8fr_1.2fr] lg:p-12">
              <div>
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#f97316]">Artigo no LinkedIn</p>
                <h2 className="mt-7 font-['Space_Grotesk'] text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-[#0a0a0a] sm:text-5xl">
                  A visão por trás da ConstruData.
                </h2>
              </div>
              <div>
                <p className="text-lg leading-8 text-black/60">
                  Um conteúdo para aprofundar a conversa sobre construção, saneamento, dados conectados e inteligência operacional. A ideia central é simples: a obra ganha velocidade quando campo, escritório e diretoria trabalham na mesma fonte de verdade.
                </p>
                <h3 className="mt-8 font-['Space_Grotesk'] text-2xl font-medium text-[#0a0a0a]">ConstruData Software</h3>
                <p className="mt-3 leading-7 text-black/55">Dados conectados, automação e decisões melhores para obras reais.</p>
                <div className="mt-8">
                  <ArrowLink href={LINKEDIN_ARTICLE_URL} external variant="solid">
                    Ler artigo no LinkedIn
                  </ArrowLink>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Autonomia ── */}
        <section id="autonomia" className="bg-white pb-4 pt-20 sm:pt-32">
          <SectionHeader
            index="08"
            eyebrow="Autonomia para a cadeia inteira"
            title="A obra inteira fica mais inteligente."
            copy="Não porque tem mais dashboards. Porque mais pessoas decidem bem, no momento certo, com a informação certa — em tempo real."
          />
          <p data-sr className="mx-auto mt-12 max-w-4xl px-5 text-center font-['Space_Grotesk'] text-3xl font-medium leading-tight tracking-[-0.01em] text-[#0a0a0a] sm:text-4xl">
            Você não está comprando um software. Está comprando autonomia para a sua cadeia inteira.
          </p>
          <div className="mx-auto mt-12 grid max-w-7xl grid-cols-1 border-y border-black/10 px-5 md:px-10 lg:grid-cols-3">
            {autonomyCards.map(([place, person, copy], i) => (
              <article
                key={place}
                data-sr
                data-sr-delay={String(i + 1)}
                className="group relative flex flex-col border-b border-black/10 bg-white px-7 py-9 transition-colors duration-300 hover:bg-[#f6f5f2] lg:border-r lg:p-10 lg:[&:nth-child(3n)]:border-r-0"
              >
                <span className="absolute inset-x-0 top-0 h-[2px] origin-left scale-x-0 bg-[#f97316] transition-transform duration-300 ease-out group-hover:scale-x-100" />
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#f97316]">{place}</p>
                <h3 className="mt-8 font-['Space_Grotesk'] text-3xl font-medium tracking-[-0.01em] text-[#0a0a0a]">{person}</h3>
                <p className="mt-5 leading-7 text-black/55">{copy}</p>
                <div className="mt-7">
                  <ArrowLink href={CALENDLY_URL} external>
                    Ver como funciona
                  </ArrowLink>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section id="contato" className="bg-[#f6f5f2] py-20 sm:py-32">
          <SectionHeader index="09" eyebrow="SAQ" title="Ganhe uma vantagem competitiva com ConstruData." />
          <div className="mx-auto mt-12 max-w-5xl px-5 md:px-10">
            <div className="border-t border-black/10">
              {faqs.map(([question, answer], i) => (
                <details
                  key={question}
                  data-sr
                  data-sr-delay={String((i % 3) + 1)}
                  className="group border-b border-black/10 bg-transparent transition-colors duration-200 open:bg-white"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5">
                    <span className="flex items-center gap-3 font-['Space_Grotesk'] text-base font-medium text-[#0a0a0a]">
                      <span className="font-mono text-xs font-bold text-[#f97316]">{String(i + 1).padStart(2, '0')}</span>
                      {question}
                    </span>
                    <Plus className="size-5 shrink-0 text-[#f97316] transition-transform duration-200 group-open:rotate-45" />
                  </summary>
                  <p className="px-0 pb-5 leading-7 text-black/55">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Qualificação ── */}
        <section id="qualificacao" className="bg-white px-5 pb-20 sm:pb-32 md:px-10">
          <form onSubmit={handleSubmit} className="mx-auto max-w-4xl border border-black/10 bg-[#f6f5f2] p-6 sm:p-9">
            {sent ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                <CheckCircle2 className="mb-5 text-[#f97316]" size={42} />
                <h3 className="font-['Space_Grotesk'] text-3xl font-medium text-[#0a0a0a]">Solicitação enviada.</h3>
                <p className="mt-3 max-w-md leading-7 text-black/55">
                  Nossa equipe entrará em contato para entender o cenário da sua obra e preparar a demonstração.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-8 flex items-center gap-3">
                  <LockKeyhole className="text-[#f97316]" size={20} />
                  <div>
                    <h3 className="font-['Space_Grotesk'] text-3xl font-medium tracking-[-0.01em] text-[#0a0a0a]">Formulário de Qualificação</h3>
                    <p className="mt-1 text-sm leading-6 text-black/45">
                      Nome, e-mail corporativo, empresa e cargo para preparar a demonstração.
                    </p>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input name="nome" label="Nome" required icon={Users} />
                  <Input name="sobrenome" label="Sobrenome" required icon={Users} />
                  <Input name="email" label="E-mail corporativo" type="email" required icon={FileText} />
                  <Input name="empresa" label="Nome da empresa" required icon={Building2} />
                  <Input name="cargo" label="Cargo" required icon={ClipboardCheck} />
                  <label className="block sm:col-span-2">
                    <span className="mb-2 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-black/45">
                      <BrainCircuit size={13} className="text-[#f97316]" />
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
                {error && <p className="mt-4 border border-red-500/40 bg-red-500/[0.06] p-3 text-xs text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={sending}
                  className="group mt-6 flex w-full items-center justify-center gap-3 bg-[#0a0a0a] px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-white transition hover:bg-[#f97316] disabled:opacity-60"
                >
                  {sending ? 'Enviando...' : 'Solicitar demonstração'}
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
                </button>
              </>
            )}
          </form>
        </section>
      </main>

      <footer className="border-t border-black/10 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 text-center sm:flex-row md:px-10">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-black/45">© 2026 ConstruData</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-black/30">Construção · Saneamento · Infraestrutura</span>
        </div>
      </footer>
    </div>
  )
}
