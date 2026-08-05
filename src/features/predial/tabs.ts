/** Abas do módulo Predial (definição compartilhada entre o header e o container). */
export type PredialTab = 'painel' | 'ativos' | 'manutencoes' | 'laudos' | 'capex'

export const PREDIAL_TABS: { key: PredialTab; label: string }[] = [
  { key: 'painel',      label: 'Painel' },
  { key: 'ativos',      label: 'Ativos' },
  { key: 'manutencoes', label: 'Manutenções' },
  { key: 'laudos',      label: 'Laudos & Compliance' },
  { key: 'capex',       label: 'CapEx / ROI' },
]
