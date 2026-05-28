export type LaunchSceneId =
  | 'hook'
  | 'pain'
  | 'pivot'
  | 'platform'
  | 'field'
  | 'planning'
  | 'supply'
  | 'cta'

export type LaunchVideoVariant = 'master' | 'landing' | 'vertical'

export type LaunchSceneSpec = {
  id: LaunchSceneId
  durationInFrames: number
  label: string
  eyebrow: string
  title: string
  subtitle: string
  voiceover: string
  onScreen: string[]
  shot: string
  modules: string[]
}

export type LaunchVideoConfig = {
  variant: LaunchVideoVariant
  title: string
  subtitle: string
  audience: string
  claims: string[]
  sceneOrder: LaunchSceneId[]
  ctaLabel: string
  ctaUrl: string
  modules: string[]
  scenes: LaunchSceneSpec[]
}

const MASTER_ORDER: LaunchSceneId[] = [
  'hook',
  'pain',
  'pivot',
  'platform',
  'field',
  'planning',
  'supply',
  'cta',
]

const LANDING_ORDER: LaunchSceneId[] = [
  'hook',
  'pivot',
  'platform',
  'field',
  'planning',
  'supply',
  'cta',
]

const VERTICAL_ORDER: LaunchSceneId[] = [
  'hook',
  'pain',
  'pivot',
  'platform',
  'field',
  'planning',
  'supply',
  'cta',
]

const VARIANT_DURATIONS: Record<LaunchVideoVariant, Record<LaunchSceneId, number>> = {
  master: {
    hook: 180,
    pain: 240,
    pivot: 180,
    platform: 390,
    field: 420,
    planning: 420,
    supply: 420,
    cta: 390,
  },
  landing: {
    hook: 90,
    pain: 0,
    pivot: 90,
    platform: 180,
    field: 240,
    planning: 210,
    supply: 240,
    cta: 300,
  },
  vertical: {
    hook: 120,
    pain: 150,
    pivot: 120,
    platform: 210,
    field: 300,
    planning: 270,
    supply: 300,
    cta: 330,
  },
}

const SCENE_LIBRARY: Record<LaunchSceneId, Omit<LaunchSceneSpec, 'durationInFrames'>> = {
  hook: {
    id: 'hook',
    label: 'Gancho',
    eyebrow: 'Decisao Operacional',
    title: 'Sua obra nao atrasa por falta de esforco.',
    subtitle: 'Atrasa por decidir tarde.',
    voiceover:
      'Sua obra nao atrasa por falta de esforco. Atrasa por decidir tarde.',
    onScreen: [
      'Sua obra nao atrasa por falta de esforco.',
      'Atrasa por decidir tarde.',
    ],
    shot:
      'Grafico travado, cronograma sob pressao e alertas silenciosos em um quadro executivo estagnado.',
    modules: ['Torre de Controle', 'Planejamento', 'Mao de Obra'],
  },
  pain: {
    id: 'pain',
    label: 'Dor Aguda',
    eyebrow: 'Fragmentacao',
    title: 'Onde esta o atraso real?',
    subtitle: 'Planilha, WhatsApp, PDF e foto de campo disputando a mesma decisao.',
    voiceover:
      'Quando a operacao depende de planilha, WhatsApp, PDF e memoria, a pergunta nunca e o que fazer. E descobrir tarde demais onde agir primeiro.',
    onScreen: [
      'Onde esta o atraso real?',
      'Qual frente vai parar?',
      'O material chegou?',
      'Qual obra exige acao agora?',
    ],
    shot:
      'Perguntas surgem em typewriter enquanto fragmentos de operacao flutuam em pilhas desordenadas.',
    modules: ['RDO', 'Suprimentos', 'Planejamento', 'Relatorio 360'],
  },
  pivot: {
    id: 'pivot',
    label: 'Virada',
    eyebrow: 'Atlantico ConstruData',
    title: 'O problema nao e a equipe.',
    subtitle: 'E operar sem contexto unificado.',
    voiceover:
      'O problema nao e a equipe. E operar sem contexto unificado.',
    onScreen: [
      'O problema nao e a equipe.',
      'E operar sem contexto unificado.',
    ],
    shot:
      'Tela escura, pausa curta, wordmark da marca e transicao para o sistema como camada operacional.',
    modules: ['Atlantico ConstruData'],
  },
  platform: {
    id: 'platform',
    label: 'Revelacao',
    eyebrow: 'Camada Operacional',
    title: 'Uma plataforma para construcao, saneamento e infraestrutura.',
    subtitle: 'Do canteiro ao escritorio. Do escritorio a diretoria.',
    voiceover:
      'O Atlantico ConstruData conecta o canteiro, o escritorio e a diretoria em uma camada operacional unica. Torre de Controle, RDO, Suprimentos, Planejamento, Lean, BIM, mapa e relatorios trabalhando na mesma narrativa.',
    onScreen: [
      'Uma camada operacional que conecta o canteiro, o escritorio e a diretoria.',
      'Torre, RDO, Suprimentos, Planejamento, Lean, BIM, Mapa e Relatorio 360.',
    ],
    shot:
      'Muro 3D de interfaces entrando pelo eixo Z, cada uma ancorada nos modulos reais da plataforma.',
    modules: [
      'Torre de Controle',
      'RDO',
      'Suprimentos',
      'Planejamento',
      'LPS / Lean',
      'BIM 3D/4D/5D',
      'Mapa Interativo',
      'Relatorio 360',
    ],
  },
  field: {
    id: 'field',
    label: 'Fluxo 1',
    eyebrow: 'Campo -> Controle',
    title: 'O que acontece hoje na obra nao pode aparecer so no fechamento do mes.',
    subtitle: 'Registro de campo refletindo no controle executivo em tempo real.',
    voiceover:
      'O que acontece hoje na obra nao pode aparecer so no fechamento do mes. O RDO digital captura equipes, fotos, trechos e ocorrencias e transforma o campo em contexto executivo.',
    onScreen: [
      'RDO digital, fotos, equipes e trechos.',
      'Avanco refletido no war room executivo.',
    ],
    shot:
      'Tela do RDO com hotspots e cliques, ligada por fluxo visual a cards executivos da Torre e do Relatorio 360.',
    modules: ['RDO', 'Torre de Controle', 'Relatorio 360'],
  },
  planning: {
    id: 'planning',
    label: 'Fluxo 2',
    eyebrow: 'Planejar -> Prever -> Agir',
    title: 'Planeje, simule e antecipe desvios antes que virem custo e prazo perdidos.',
    subtitle: 'Gantt, look-ahead, restricoes e impacto de atraso na mesma cena.',
    voiceover:
      'Planejamento nao pode ser um documento morto. Com Gantt, look-ahead, PPC e restricoes no mesmo fluxo, a equipe simula impactos e age antes do atraso virar custo e prazo perdidos.',
    onScreen: [
      'Gantt com impacto cascata.',
      'Look-ahead, restricoes e PPC no mesmo fluxo.',
    ],
    shot:
      'Cronograma simplificado, cartoes Lean e cards de impacto se reorganizando conforme o atraso e aplicado.',
    modules: ['Planejamento', 'LPS / Lean', 'Torre de Controle'],
  },
  supply: {
    id: 'supply',
    label: 'Fluxo 3',
    eyebrow: 'Suprimentos -> Execucao',
    title: 'Menos planilha, menos surpresa, mais controle sobre material, fornecedor e faturamento.',
    subtitle: 'Three-way match automatizado e risco operacional visivel antes da ruptura.',
    voiceover:
      'No Suprimentos, pedido, recebimento e nota fiscal deixam de competir em abas separadas. O three-way match automatizado expone divergencia, risco de ruptura e impacto na execucao antes do problema estourar no campo.',
    onScreen: [
      'PO + Recebimento + NF.',
      'Three-way match automatizado.',
      'Impacto operacional antes da ruptura.',
    ],
    shot:
      'Tres documentos convergem para o match engine e liberam alertas de divergencia, fornecedor e frente de obra.',
    modules: ['Suprimentos', 'Torre de Controle', 'Planejamento'],
  },
  cta: {
    id: 'cta',
    label: 'Autoridade + CTA',
    eyebrow: 'Atlantico ConstruData',
    title: 'Mais velocidade para decidir. Mais visibilidade para agir. Mais controle para escalar.',
    subtitle: 'Agendar Demonstracao',
    voiceover:
      'Mais velocidade para decidir. Mais visibilidade para agir. Mais controle para escalar. Agende uma demonstracao do Atlantico ConstruData.',
    onScreen: [
      'Mais velocidade para decidir.',
      'Mais visibilidade para agir.',
      'Mais controle para escalar.',
    ],
    shot:
      'Grid de modulos, claims sustentaveis e CTA final da marca para demonstracao.',
    modules: [
      'Torre de Controle',
      'RDO',
      'Suprimentos',
      'Planejamento',
      'LPS / Lean',
      'BIM 3D/4D/5D',
      'Mapa Interativo',
      'Relatorio 360',
    ],
  },
}

const SCENE_ORDERS: Record<LaunchVideoVariant, LaunchSceneId[]> = {
  master: MASTER_ORDER,
  landing: LANDING_ORDER,
  vertical: VERTICAL_ORDER,
}

const DEFAULT_CLAIMS = [
  'Decisoes em tempo real para operacoes complexas.',
  'Do campo ao escritorio sem perder contexto.',
  'War room executivo para obras, frentes e fornecedores.',
  'Three-way match automatizado para PO, recebimento e NF.',
  'Look-ahead, PPC e restricoes no mesmo fluxo operacional.',
  'BIM, mapa, planejamento e execucao na mesma narrativa visual.',
]

const DEFAULT_MODULES = [
  'Torre de Controle',
  'RDO',
  'Suprimentos',
  'Planejamento',
  'LPS / Lean',
  'BIM 3D/4D/5D',
  'Mapa Interativo',
  'Relatorio 360',
]

export const CALENDLY_URL =
  'https://calendly.com/joaodsouzanery/demonstracao-construdata'

export const buildLaunchVideoConfig = (
  variant: LaunchVideoVariant,
  overrides: Partial<Omit<LaunchVideoConfig, 'variant' | 'scenes'>> = {},
): LaunchVideoConfig => {
  const order = overrides.sceneOrder ?? SCENE_ORDERS[variant]
  const durations = VARIANT_DURATIONS[variant]
  const scenes = order.map((id) => ({
    ...SCENE_LIBRARY[id],
    durationInFrames: durations[id],
  }))

  return {
    variant,
    title: overrides.title ?? 'Atlantico ConstruData',
    subtitle:
      overrides.subtitle ??
      'Inteligencia operacional para construcao, saneamento e infraestrutura.',
    audience:
      overrides.audience ??
      'Executivos e operacao falando a mesma lingua operacional.',
    claims: overrides.claims ?? DEFAULT_CLAIMS,
    sceneOrder: order,
    ctaLabel: overrides.ctaLabel ?? 'Agendar Demonstracao',
    ctaUrl: overrides.ctaUrl ?? CALENDLY_URL,
    modules: overrides.modules ?? DEFAULT_MODULES,
    scenes,
  }
}

export const getLaunchVideoDuration = (variant: LaunchVideoVariant) =>
  buildLaunchVideoConfig(variant).scenes.reduce(
    (total, scene) => total + scene.durationInFrames,
    0,
  )
