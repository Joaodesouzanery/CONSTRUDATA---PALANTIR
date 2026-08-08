/**
 * roles.ts — rótulos PT-BR dos papéis (user_role) e gating por papel. Os papéis prediais
 * (síndico/zelador/morador) foram adicionados na Fase 3C. `zelador`/`morador` NÃO veem valores
 * financeiros (custo/CapEx) no Predial — o gating é feito no app (o servidor já restringe escrita
 * financeira por has_role nas policies).
 */
import type { UserRole } from '@/types/database'

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner',
  diretor: 'Diretor',
  gerente: 'Gerente',
  engenheiro: 'Engenheiro',
  qualidade: 'Qualidade',
  planejador: 'Planejador',
  comprador: 'Comprador',
  visualizador: 'Visualizador',
  sindico: 'Síndico',
  zelador: 'Zelador',
  morador: 'Morador',
}

/** Rótulo amigável de um papel (aceita string crua/desconhecida com fallback). */
export function roleLabel(role?: string | null): string {
  return (role && ROLE_LABELS[role as UserRole]) || role || '—'
}

/** Papéis que NÃO enxergam valores financeiros (custo/CapEx/ROI) no Predial. */
export const ROLES_SEM_CUSTO: readonly UserRole[] = ['zelador', 'morador']

/** true se o papel pode ver valores financeiros no Predial (todos, exceto zelador/morador). */
export function canViewCosts(role?: string | null): boolean {
  return !ROLES_SEM_CUSTO.includes((role ?? '') as UserRole)
}
