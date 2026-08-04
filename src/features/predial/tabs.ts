/** Abas do módulo Predial (definição compartilhada entre o header e o container). */
export type PredialTab = 'sindico' | 'visao-geral' | 'manutencoes' | 'laudos' | 'equipamentos' | 'saude' | 'capex' | 'workbench' | 'rateio'

export const PREDIAL_TABS: { key: PredialTab; label: string }[] = [
  { key: 'sindico',      label: 'Painel do Síndico' },
  { key: 'visao-geral',  label: 'Visão Geral' },
  { key: 'manutencoes',  label: 'Manutenções' },
  { key: 'laudos',       label: 'Laudos & Compliance' },
  { key: 'equipamentos', label: 'Equipamentos & Chamados' },
  { key: 'saude',        label: 'Saúde & Preditiva' },
  { key: 'capex',        label: 'CapEx / ROI' },
  { key: 'workbench',    label: 'Workbench' },
  { key: 'rateio',       label: 'Rateio de Consumo' },
]
