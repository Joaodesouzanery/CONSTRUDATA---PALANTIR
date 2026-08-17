/** Abas do módulo Predial (definição compartilhada entre o header e o container). */
export type PredialTab = 'painel' | 'chamados' | 'ativos' | 'manutencoes' | 'laudos' | 'capex'

// "Chamados" vem logo depois do Painel: é a aba do dia a dia do zelador, e a fila do QR público
// que ela triagem é a coisa mais urgente do módulo. Antes era uma página irmã, fora do Predial.
export const PREDIAL_TABS: { key: PredialTab; label: string }[] = [
  { key: 'painel',      label: 'Painel' },
  { key: 'chamados',    label: 'Chamados' },
  { key: 'ativos',      label: 'Ativos' },
  { key: 'manutencoes', label: 'Manutenções' },
  { key: 'laudos',      label: 'Laudos & Compliance' },
  { key: 'capex',       label: 'CapEx / ROI' },
]
