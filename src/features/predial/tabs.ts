/** Abas do módulo Predial (definição compartilhada entre o header e o container). */
export type PredialTab = 'visao-geral' | 'manutencoes' | 'equipamentos' | 'saude' | 'capex' | 'workbench'

export const PREDIAL_TABS: { key: PredialTab; label: string }[] = [
  { key: 'visao-geral',  label: 'Visão Geral' },
  { key: 'manutencoes',  label: 'Manutenções' },
  { key: 'equipamentos', label: 'Equipamentos & Chamados' },
  { key: 'saude',        label: 'Saúde & Preditiva' },
  { key: 'capex',        label: 'CapEx / ROI' },
  { key: 'workbench',    label: 'Workbench' },
]
