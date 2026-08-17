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

// ─── Espelhos das policies RLS de escrita (gates de UI) ─────────────────────────
// Um papel fora da lista NÃO passa no WITH CHECK do servidor: a escrita otimista
// viraria op presa para sempre no pendingSync (o usuário acha que salvou e o dado
// nunca chega ao Supabase). Estas listas DEVEM casar com as policies:
//   · financeiro_titulos → 20260723120000_financeiro_titulos.sql
//   · rdo               → 0016_rls_batch1.sql (rdo_insert_with_role)

/** Papéis que a RLS deixa criar/editar títulos/boletos (Pagamentos e Cobranças). */
export const ROLES_TITULOS_WRITE: readonly UserRole[] = ['planejador', 'engenheiro', 'gerente', 'diretor', 'owner']
export function canWriteTitulos(role?: string | null): boolean {
  return ROLES_TITULOS_WRITE.includes((role ?? '') as UserRole)
}

/** Papéis que a RLS deixa criar RDO. */
export const ROLES_RDO_WRITE: readonly UserRole[] = ['engenheiro', 'qualidade', 'gerente', 'diretor', 'owner']
export function canWriteRdo(role?: string | null): boolean {
  return ROLES_RDO_WRITE.includes((role ?? '') as UserRole)
}

/**
 * Papéis que a RLS deixa criar posto de trabalho e ocorrência de escala
 * (`20260817140000_work_posts_occurrences.sql`).
 *
 * Faltava o espelho aqui. Das onze opções do enum `user_role`, SEIS não passam no WITH CHECK
 * destas duas tabelas — `qualidade`, `comprador`, `visualizador` e os três papéis prediais. Sem
 * o gate, essas pessoas cadastravam o posto, viam o posto na tela, e a operação ficava presa no
 * `pendingSync` para sempre: o servidor devolve 42501 e o `flush` deste store não tem teto de
 * tentativas. Enquanto as tabelas não existiam o efeito era invisível; com a migration aplicada
 * ele passou a acontecer de verdade.
 */
export const ROLES_MAO_DE_OBRA_WRITE: readonly UserRole[] = ['planejador', 'engenheiro', 'gerente', 'diretor', 'owner']
export function canWriteMaoDeObra(role?: string | null): boolean {
  return ROLES_MAO_DE_OBRA_WRITE.includes((role ?? '') as UserRole)
}
