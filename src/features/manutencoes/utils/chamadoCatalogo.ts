/**
 * chamadoCatalogo.ts — catálogo em cascata (Sistema → Componente → Sintoma) da abertura
 * rápida de chamados (QR) + matriz impacto×urgência → prioridade. Determinístico, sem IA.
 */
import type { MaintenancePriority, ImpactoUrgencia } from '@/store/manutencoesStore'

/** Sistemas prediais para o formulário de chamado. Lista plana e sem runtime do store —
 *  reusável na página pública (evita arrastar o manutencoesStore no bundle anônimo). */
export const SISTEMAS_CHAMADO = ['HVAC', 'Elétrico', 'Hidráulico', 'Incêndio', 'Elevadores', 'Outros'] as const

/** Componentes típicos por sistema predial (chave = MaintenanceAsset.sistema). */
export const COMPONENTES_POR_SISTEMA: Record<string, string[]> = {
  HVAC: ['Compressor', 'Ventilador / Fan-coil', 'Termostato', 'Filtro', 'Dreno', 'Gás refrigerante', 'Placa / controle'],
  'Elétrico': ['Disjuntor', 'Quadro / QGBT', 'Tomada', 'Iluminação', 'Cabo / fiação', 'Motor', 'Nobreak / UPS'],
  'Hidráulico': ['Bomba', 'Registro / válvula', 'Tubulação', 'Reservatório', 'Boia', 'Ralo / esgoto'],
  'Incêndio': ['Extintor', 'Hidrante', 'Alarme / central', 'Sprinkler', 'Iluminação de emergência', 'Porta corta-fogo'],
  'Elevadores': ['Cabine', 'Porta', 'Motor / máquina', 'Comando', 'Nivelamento', 'Botoeira'],
  'Outros': ['Estrutura', 'Acabamento', 'Esquadria', 'Cobertura', 'Outro'],
}

/** Componentes de um sistema (fallback para "Outros" quando o sistema é desconhecido/vazio). */
export function componentesDoSistema(sistema?: string): string[] {
  return (sistema && COMPONENTES_POR_SISTEMA[sistema]) || COMPONENTES_POR_SISTEMA['Outros']
}

export const SINTOMAS = [
  'Não liga / não funciona', 'Ruído anormal', 'Vazamento', 'Superaquecimento', 'Vibração',
  'Cheiro / fumaça', 'Desligamento intermitente', 'Baixo desempenho', 'Dano físico', 'Outro',
]

export const IU_LABELS: Record<ImpactoUrgencia, string> = { baixa: 'Baixo', media: 'Médio', alta: 'Alto' }

/** Matriz impacto (linha) × urgência (coluna) → prioridade da OS. */
const MATRIZ: Record<ImpactoUrgencia, Record<ImpactoUrgencia, MaintenancePriority>> = {
  alta:  { alta: 'critica', media: 'alta',  baixa: 'media' },
  media: { alta: 'alta',    media: 'media', baixa: 'baixa' },
  baixa: { alta: 'media',   media: 'baixa', baixa: 'baixa' },
}

export function prioridadeDaMatriz(impacto: ImpactoUrgencia, urgencia: ImpactoUrgencia): MaintenancePriority {
  return MATRIZ[impacto][urgencia]
}
