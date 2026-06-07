/**
 * Categorias de rede/serviço usadas no Planejamento Mestre.
 * Fonte única para os <select> de Longo/Médio Prazo e agrupamentos.
 */
import type { MasterActivity } from '@/types'

export type NetworkCategory = NonNullable<MasterActivity['networkType']>

export const NETWORK_TYPE_OPTIONS: Array<{ value: NetworkCategory; label: string }> = [
  { value: 'agua', label: 'Água' },
  { value: 'esgoto', label: 'Esgoto' },
  { value: 'civil', label: 'Civil' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'ambiental', label: 'Ambiental' },
  { value: 'outro', label: 'Outro' },
  { value: 'geral', label: 'Geral' },
]

export function networkLabel(value?: string): string {
  return NETWORK_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? '—')
}

export const NETWORK_COLOR: Record<string, string> = {
  agua:       '#f97316',
  esgoto:     '#22c55e',
  civil:      '#f59e0b',
  manutencao: '#38bdf8',
  ambiental:  '#10b981',
  outro:      '#a3a3a3',
  geral:      '#a78bfa',
}

export function networkColor(value?: string): string {
  return value ? (NETWORK_COLOR[value] ?? '#6b7280') : '#6b7280'
}
