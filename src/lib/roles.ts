/**
 * roles.ts — rótulos PT-BR dos papéis (user_role) e gating por papel. Os papéis prediais
 * (síndico/zelador/morador) foram adicionados na Fase 3C. `zelador`/`morador` NÃO veem valores
 * financeiros (custo/CapEx) no Predial — o gating é feito no app (o servidor já restringe escrita
 * financeira por has_role nas policies).
 */
import type { UserRole } from '@/types/database'
import { useAuth, type Profile, type OrgMembership } from '@/lib/auth'

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

/**
 * Papéis que a RLS deixa mexer em estoque, depósito e movimentação
 * (`20260518133035_tenant_safe_almoxarifado_isolation.sql:38, :57, :70`).
 *
 * ─── REPARE QUE A LISTA É DIFERENTE ───────────────────────────────────────────
 * Aqui entra `comprador` e NÃO entra `planejador` — o inverso de Mão de Obra. Reaproveitar
 * `ROLES_MAO_DE_OBRA_WRITE` liberaria o planejador para importar a planilha (e a op ficaria presa)
 * e barraria o comprador de cadastrar item (e o botão sumiria de quem mais precisa dele). São dois
 * espelhos de duas policies diferentes, e precisam continuar separados.
 *
 * O `suprimentosStore` não tinha gate NENHUM: qualquer papel importava a planilha, via "23 itens
 * criados" na tela, e cada insert voltava 42501. Depois de cinco tentativas a fila estacionava, e
 * o único botão oferecido era "Descartar" — que apagaria o trabalho.
 */
/**
 * Quem pode cadastrar e editar OBRA (Torre de Controle).
 *
 * Espelho de `sites_insert_with_role` / `sites_update_role` (`0033_sprint6_rls.sql`). Sem este
 * gate, 6 dos 11 papéis viam "obra salva" na tela e o servidor devolvia 42501 — a op ficava presa
 * para sempre na fila, e a obra nunca existia para ninguém além daquele navegador.
 *
 * ⚠️ Inclui `planejador` e NÃO inclui `qualidade` — não é a mesma lista do RDO.
 */
export const ROLES_TORRE_WRITE: readonly UserRole[] = ['engenheiro', 'planejador', 'gerente', 'diretor', 'owner']

/**
 * Quem pode criar, submeter, revisar e excluir ORDEM DE MUDANÇA (Gestão 360).
 *
 * Espelho de `co_insert_with_role` / `co_update_role` (`0033_sprint6_rls.sql`). Nenhuma das quatro
 * escritas tinha gate: a tela dizia "salvo", o servidor devolvia 42501 e a op entupia a fila.
 */
export const ROLES_CHANGE_ORDER_WRITE: readonly UserRole[] = ['engenheiro', 'planejador', 'gerente', 'diretor', 'owner']

export const ROLES_SUPRIMENTOS_WRITE: readonly UserRole[] = ['comprador', 'engenheiro', 'gerente', 'diretor', 'owner']
export function canWriteSuprimentos(role?: string | null): boolean {
  return ROLES_SUPRIMENTOS_WRITE.includes((role ?? '') as UserRole)
}

// ─── O gate do cliente e a RLS do servidor precisam olhar a MESMA coisa ─────────
//
// Este bloco existe por causa de um incidente real, e vale a pena registrar o mecanismo.
//
// As funções `canWrite*` acima recebem um papel — e todo chamador passava `profile.role`. Só que
// a RLS do servidor NÃO olha o profile: `public.has_role()` exige uma linha em `memberships` com
// `status = 'active'`, sem `deleted_at`, e com o papel lá dentro.
//
// As duas fontes divergem em situações banais: membership criada com papel diferente do profile,
// membership desativada, ou membership que simplesmente não existe (e aí o cliente FABRICA uma
// sintética a partir do profile — ver `auth.ts`). Como `user_org()` só exige membership ativa de
// qualquer papel, o usuário continua LENDO tudo normalmente: só as escritas quebram.
//
// O resultado, na tela do cliente: botões habilitados, "salvo com sucesso", e uma fila de
// operações presas com "new row violates row-level security policy" — em inglês, sem dizer quais
// registros, e com um botão "Descartar" que apagaria o dado.


export type MotivoSemEscrita = 'sem_membership' | 'papel_insuficiente' | 'membership_nao_confirmada'

export interface PermissaoEscrita {
  pode: boolean
  motivo?: MotivoSemEscrita
  /** Frase pronta para a tela, em português, dizendo o que fazer. */
  explicacao?: string
}

/**
 * A pergunta que importa: o SERVIDOR vai aceitar esta escrita?
 *
 * Responde pela membership da organização ativa, que é o que a RLS lê — e não pelo `profiles.role`,
 * que é o que o app lia até aqui.
 */
export function podeEscrever(papeisAceitos: readonly UserRole[]): PermissaoEscrita {
  return avaliarPermissao(papeisAceitos, useAuth.getState())
}

/** Versão reativa, para componentes: reavalia quando as memberships chegam do servidor. */
export function usePermissaoEscrita(papeisAceitos: readonly UserRole[]): PermissaoEscrita {
  const profile = useAuth((s) => s.profile)
  const memberships = useAuth((s) => s.memberships)
  const isGlobalAdmin = useAuth((s) => s.isGlobalAdmin)
  return avaliarPermissao(papeisAceitos, { profile, memberships, isGlobalAdmin })
}

/** Pura: recebe o estado, para servir aos dois caminhos acima e ser testável sem renderizar. */
function avaliarPermissao(
  papeisAceitos: readonly UserRole[],
  estado: { profile: Profile | null; memberships: OrgMembership[]; isGlobalAdmin: boolean },
): PermissaoEscrita {
  const { profile, memberships, isGlobalAdmin } = estado
  if (isGlobalAdmin) return { pode: true }
  if (!profile) return { pode: false, motivo: 'sem_membership', explicacao: 'Sessão não carregada.' }

  const daOrg = memberships.find((m) => m.organization_id === profile.organization_id)

  if (!daOrg) {
    return {
      pode: false,
      motivo: 'sem_membership',
      explicacao: 'Você não tem vínculo ativo com esta empresa no servidor. Peça a um administrador '
        + 'para reativar o seu acesso — até lá, o sistema não consegue salvar o que você criar.',
    }
  }

  // A sintética (ver auth.ts) é um palpite do cliente, não um vínculo confirmado pelo servidor.
  // Deixar passar aqui é exatamente o que produzia a fila presa.
  if (daOrg.id.startsWith('profile-')) {
    return {
      pode: false,
      motivo: 'membership_nao_confirmada',
      explicacao: 'Não foi possível confirmar o seu vínculo com esta empresa no servidor. Recarregue '
        + 'a página; se continuar, peça a um administrador para conferir o seu acesso. Enquanto isso '
        + 'o sistema não vai salvar o que você criar.',
    }
  }

  if (daOrg.status !== 'active') {
    return {
      pode: false,
      motivo: 'sem_membership',
      explicacao: `Seu acesso a esta empresa está "${daOrg.status}". Um administrador precisa reativá-lo.`,
    }
  }

  if (!papeisAceitos.includes(daOrg.role)) {
    return {
      pode: false,
      motivo: 'papel_insuficiente',
      explicacao: `Seu perfil (${daOrg.role}) não tem permissão para esta ação.`,
    }
  }

  return { pode: true }
}

/** Atalhos por módulo, para o chamador não repetir a lista de papéis. */
export const podeEscreverMaoDeObra   = () => podeEscrever(ROLES_MAO_DE_OBRA_WRITE)
export const podeEscreverRdo         = () => podeEscrever(ROLES_RDO_WRITE)
export const podeEscreverTitulos     = () => podeEscrever(ROLES_TITULOS_WRITE)
export const podeEscreverSuprimentos = () => podeEscrever(ROLES_SUPRIMENTOS_WRITE)
export const podeEscreverTorre        = () => podeEscrever(ROLES_TORRE_WRITE)
export const podeEscreverChangeOrder  = () => podeEscrever(ROLES_CHANGE_ORDER_WRITE)
