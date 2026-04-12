/**
 * moduleRegistry.ts — Lista única de todos os módulos da plataforma
 * disponíveis para fixar na "Minha Rotina".
 *
 * Este registro é a fonte de verdade para a página Minha Rotina e
 * para o picker de "+ Adicionar". Mantém ícones e descrições curtas.
 */
import {
  ClipboardList, Calendar, FolderKanban, Radio, Wrench, FileSearch,
  PackageSearch, Users, Cpu, LayoutDashboard, CalendarClock, FileText,
  Calculator, Layers, Target, Map, Network, BrainCircuit, TrendingUp,
  ShieldCheck, Ruler, type LucideIcon,
} from 'lucide-react'

export interface ModuleInfo {
  path:        string
  label:       string
  icon:        LucideIcon
  group:       'gestao' | 'planejamento' | 'campo' | 'projetos' | 'analytics'
  description: string
}

export const MODULE_REGISTRY: ModuleInfo[] = [
  // ── GESTÃO ─────────────────────────────────────────────────────────────
  {
    path: '/app/gestao-360',
    label: 'Gestão 360',
    icon: LayoutDashboard,
    group: 'gestao',
    description: 'Visão financeira (CPI/SPI), curva S e alertas integrados.',
  },
  {
    path: '/app/relatorio360',
    label: 'Relatório 360',
    icon: ClipboardList,
    group: 'gestao',
    description: 'KPIs operacionais, S-curve e matriz RAG por projeto.',
  },
  {
    path: '/app/torre-de-controle',
    label: 'Torre de Controle',
    icon: Radio,
    group: 'gestao',
    description: 'War room executivo com drill-down até a atividade.',
  },
  {
    path: '/app/medicao',
    label: 'Medição',
    icon: Ruler,
    group: 'gestao',
    description: 'Medição contratual com conferência automática e PDF.',
  },

  // ── PLANEJAMENTO ───────────────────────────────────────────────────────
  {
    path: '/app/planejamento-mestre',
    label: 'Planejamento Mestre',
    icon: BrainCircuit,
    group: 'planejamento',
    description: 'WBS, marcos contratuais e estrutura macro do projeto.',
  },
  {
    path: '/app/planejamento',
    label: 'Planejamento (Trechos)',
    icon: CalendarClock,
    group: 'planejamento',
    description: 'Gantt, CPM, simulação de atrasos e ABC de trechos.',
  },
  {
    path: '/app/agenda',
    label: 'Agenda',
    icon: Calendar,
    group: 'planejamento',
    description: 'Calendário operacional com detecção de conflitos.',
  },
  {
    path: '/app/lps-lean',
    label: 'LPS / Lean',
    icon: Target,
    group: 'planejamento',
    description: 'Last Planner: look-ahead, PPC, Constraint Register.',
  },
  {
    path: '/app/evm',
    label: 'EVM',
    icon: TrendingUp,
    group: 'planejamento',
    description: 'Earned Value Management com EAC, ETC, VAC, TCPI.',
  },

  // ── CAMPO ───────────────────────────────────────────────────────────────
  {
    path: '/app/rdo',
    label: 'RDO',
    icon: FileText,
    group: 'campo',
    description: 'Relatório Diário de Obra com fotos, mão de obra e trechos.',
  },
  {
    path: '/app/qualidade',
    label: 'Qualidade',
    icon: ShieldCheck,
    group: 'campo',
    description: 'Ficha de Verificação de Serviço (FVS) e tratamento de NCs.',
  },
  {
    path: '/app/mao-de-obra',
    label: 'Mão de Obra',
    icon: Users,
    group: 'campo',
    description: 'Cadastro, alocação, certificações e folha de pagamento.',
  },
  {
    path: '/app/gestao-equipamentos',
    label: 'Gestão de Equipamentos',
    icon: Wrench,
    group: 'campo',
    description: 'Frota fixa, manutenção preventiva e utilização.',
  },
  {
    path: '/app/otimizacao-frota',
    label: 'Frota',
    icon: Cpu,
    group: 'campo',
    description: 'Veículos, combustível, motoristas e roteirização.',
  },

  // ── PROJETOS ────────────────────────────────────────────────────────────
  {
    path: '/app/projetos',
    label: 'Projetos',
    icon: FolderKanban,
    group: 'projetos',
    description: 'Cadastro mestre de projetos, escopo, contratos e equipes.',
  },
  {
    path: '/app/bim',
    label: 'BIM 3D/4D/5D',
    icon: Layers,
    group: 'projetos',
    description: 'Visualização 3D, timeline 4D e heatmap de custo 5D.',
  },
  {
    path: '/app/pre-construcao',
    label: 'Pré-Construção',
    icon: FileSearch,
    group: 'projetos',
    description: 'Due diligence, viabilidade técnica e geotécnica.',
  },
  {
    path: '/app/mapa-interativo',
    label: 'Mapa Interativo',
    icon: Map,
    group: 'projetos',
    description: 'GIS de redes (água, esgoto, drenagem) com import UTM.',
  },

  // ── ANALYTICS ───────────────────────────────────────────────────────────
  {
    path: '/app/quantitativos',
    label: 'Quantitativos',
    icon: Calculator,
    group: 'analytics',
    description: 'Composição de orçamento com base SINAPI/SEINFRA.',
  },
  {
    path: '/app/suprimentos',
    label: 'Suprimentos',
    icon: PackageSearch,
    group: 'analytics',
    description: 'Three-Way Match (PO × GRN × NF) e supplier scorecard.',
  },
  {
    path: '/app/rede-360',
    label: 'Rede 360',
    icon: Network,
    group: 'analytics',
    description: 'Common Operating Picture de redes de distribuição.',
  },
]

export function findModule(path: string): ModuleInfo | undefined {
  return MODULE_REGISTRY.find((m) => m.path === path)
}
