/**
 * auth.ts — Helpers de autenticação e perfil.
 *
 * Centraliza o estado de sessão + profile do usuário em um Zustand store
 * leve, com cache de profile (uma única query por sessão) e listeners para
 * mudanças de auth.
 */
import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { clearTenantScopedCaches, ensureTenantScopedCaches } from './tenantCache'
import type { UserRole } from '@/types/database'

export interface Profile {
  id:               string
  organization_id:  string
  full_name:        string
  email:            string
  role:             UserRole
  job_title:        string | null
  mfa_enrolled:     boolean
}

export interface OrgMembership {
  id:              string
  organization_id: string
  role:            UserRole
  status:          'invited' | 'active' | 'blocked' | 'left'
  organization:    {
    id:          string
    name:        string
    slug:        string
    environment?: 'production' | 'homologation' | 'demo'
  } | null
}

interface OrgMembershipRpcRow {
  membership_id: string
  organization_id: string
  organization_name: string | null
  organization_slug: string | null
  organization_environment: 'production' | 'homologation' | 'demo' | null
  role: UserRole
  status: 'invited' | 'active' | 'blocked' | 'left'
  is_active?: boolean
}

interface AuthState {
  session:    Session | null
  user:       User | null
  profile:    Profile | null
  memberships: OrgMembership[]
  /**
   * Esta conta administra a PLATAFORMA (acesso a todas as organizações)?
   *
   * Vem do servidor, via RPC `is_global_admin()`. Antes era decidido no cliente comparando o
   * e-mail com um literal em `src/lib/globalAdmin.ts` — que ia no bundle que qualquer visitante
   * da landing baixa, e ainda era impresso na tela em três páginas. Quem administra a
   * plataforma é dado do banco (`platform_admins`), não constante de código.
   *
   * Isto continua sendo só para a interface decidir o que mostrar; quem de fato autoriza é o
   * `is_global_admin()` dentro das policies. Mentir aqui não dá acesso a nada.
   */
  isGlobalAdmin: boolean
  loading:    boolean
  error:      string | null
  initialized: boolean

  init:       () => Promise<void>
  refreshProfile: () => Promise<void>
  switchOrganization: (organizationId: string) => Promise<void>
  signOut:    () => Promise<void>
  setSession: (s: Session | null) => void
}

async function resetTenantScopedRuntimeStores(organizationId?: string): Promise<void> {
  const stores = await Promise.allSettled([
    import('@/store/activeObraStore').then((m) => m.useActiveObraStore),
    // Faltava: o único `ensureTenantScope` das rotinas era chamado dentro de /app/minha-rotina.
    // Como o painel de indicadores passou a viver também no Gestão 360, trocar de empresa e abrir
    // aquela tela mostrava "Rotinas em dia" da empresa ANTERIOR.
    import('@/store/rotinasStore').then((m) => m.useRotinasStore),
    import('@/store/agendaStore').then((m) => m.useAgendaStore),
    import('@/store/companySettingsStore').then((m) => m.useCompanySettingsStore),
    import('@/store/contractorStore').then((m) => m.useContractorStore),
    import('@/store/equipamentosStore').then((m) => m.useEquipamentosStore),
    import('@/store/evmStore').then((m) => m.useEvmStore),
    import('@/store/financeiroStore').then((m) => m.useFinanceiroStore),
    import('@/store/financeiroTitulosStore').then((m) => m.useFinanceiroTitulosStore),
    import('@/store/notasFiscaisStore').then((m) => m.useNotasFiscaisStore),
    import('@/store/frotaVeicularStore').then((m) => m.useFrotaVeicularStore),
    import('@/store/gestaoEquipamentosStore').then((m) => m.useGestaoEquipamentosStore),
    import('@/store/lpsStore').then((m) => m.useLpsStore),
    import('@/store/maoDeObraStore').then((m) => m.useMaoDeObraStore),
    import('@/store/mapaInterativoStore').then((m) => m.useMapaInterativoStore),
    import('@/store/medicaoAssistidaStore').then((m) => m.useMedicaoAssistidaStore),
    import('@/store/medicaoBillingStore').then((m) => m.useMedicaoBillingStore),
    import('@/store/medicaoStore').then((m) => m.useMedicaoStore),
    import('@/store/operacaoCampoStore').then((m) => m.useOperacaoCampoStore),
    import('@/store/otimizacaoFrotaStore').then((m) => m.useOtimizacaoFrotaStore),
    import('@/store/planejamentoMestreStore').then((m) => m.usePlanejamentoMestreStore),
    import('@/store/planejamentoRestricoesStore').then((m) => m.usePlanejamentoRestricoesStore),
    import('@/store/planejamentoStore').then((m) => m.usePlanejamentoStore),
    import('@/store/planoExecucaoStore').then((m) => m.usePlanoExecucaoStore),
    import('@/store/servicosStore').then((m) => m.useServicosStore),
    import('@/store/preConstrucaoStore').then((m) => m.usePreConstrucaoStore),
    import('@/store/projetosStore').then((m) => m.useProjetosStore),
    import('@/store/qualidadeStore').then((m) => m.useQualidadeStore),
    import('@/store/quantitativosStore').then((m) => m.useQuantitativosStore),
    import('@/store/rateioConsumoStore').then((m) => m.useRateioConsumoStore),
    import('@/store/rdoStore').then((m) => m.useRdoStore),
    import('@/store/rede360Store').then((m) => m.useRede360Store),
    import('@/store/relatorio360Store').then((m) => m.useRelatorio360Store),
    import('@/store/torreDeControleStore').then((m) => m.useTorreStore),
    import('@/store/gestao360Store').then((m) => m.useGestao360Store),
    import('@/store/manutencoesStore').then((m) => m.useManutencoesStore),
    import('@/store/laudosStore').then((m) => m.useLaudosStore),
    import('@/store/diasSemProducaoStore').then((m) => m.useDiasSemProducaoStore),
    import('@/store/economiaStore').then((m) => m.useEconomiaStore),
    import('@/store/manejoFinanceiroStore').then((m) => m.useManejoFinanceiroStore),
    import('@/store/medicaoUnificadaStore').then((m) => m.useMedicaoUnificadaStore),
    import('@/store/suprimentosStore').then((m) => m.useSuprimentosStore),
    import('@/store/userRoutineStore').then((m) => m.useUserRoutineStore),
  ])

  for (const result of stores) {
    if (result.status !== 'fulfilled') continue
    const state = result.value.getState() as {
      ensureTenantScope?: (organizationId: string) => void
      clearData?: () => void
      reset?: () => void
    }
    if (organizationId && state.ensureTenantScope) state.ensureTenantScope(organizationId)
    else if (state.clearData) state.clearData()
    else state.reset?.()
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  session:     null,
  user:        null,
  profile:     null,
  memberships: [],
  isGlobalAdmin: false,
  loading:     false,
  error:       null,
  initialized: false,

  init: async () => {
    if (get().initialized) return
    set({ loading: true })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({ session, user: session?.user ?? null })

      if (session?.user) {
        await get().refreshProfile()
      }

      // Listener para mudanças (login/logout/refresh do JWT)
      //
      // ⚠️ O boot rodava DUAS VEZES. O auth-js emite `INITIAL_SESSION` para todo listener recém
      // inscrito — e este listener chamava `refreshProfile()` de novo, que disparava de novo o
      // pull de 41 stores. Medido: ~170 requisições no boot, metade repetida. E `TOKEN_REFRESHED`
      // (o JWT renova sozinho, a aba volta do fundo) também re-puxava o banco inteiro.
      // Agora: `INITIAL_SESSION` é ignorado (o `init` acima já cuidou), `TOKEN_REFRESHED` só
      // atualiza a sessão, e o perfil só é relido quando a identidade de fato muda.
      supabase.auth.onAuthStateChange((event, newSession) => {
        set({ session: newSession, user: newSession?.user ?? null })
        if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return
        if (newSession?.user) {
          void get().refreshProfile()
        } else {
          set({ profile: null, memberships: [], isGlobalAdmin: false })
        }
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'auth init failed' })
    } finally {
      set({ loading: false, initialized: true })
    }
  },

  refreshProfile: async () => {
    // Lock de "em voo": duas chamadas simultâneas (login + listener, ou duas abas do app
    // montando) esperam a mesma leitura em vez de dobrar as requisições.
    if (refreshEmVoo) return refreshEmVoo
    refreshEmVoo = refreshProfileInterno(get, set).finally(() => { refreshEmVoo = null })
    return refreshEmVoo
  },

  switchOrganization: async (organizationId) => {
    const current = get().profile?.organization_id
    if (!organizationId || organizationId === current) return

    const allowed = get().memberships.some((membership) => membership.organization_id === organizationId)
    if (!allowed) {
      throw new Error('Voce nao tem acesso ativo a esta empresa.')
    }

    // Sobe as pendências da empresa ATUAL antes de trocar (evita perda ao limpar caches).
    try { await (await import('@/store/appModeStore')).flushAllTenantStores() } catch { /* offline: segue */ }

    const { error } = await supabase.rpc('set_default_organization', { p_org_id: organizationId })
    if (error) {
      set({ error: error.message })
      throw error
    }

    clearTenantScopedCaches(organizationId)
    await resetTenantScopedRuntimeStores(organizationId)
    await get().refreshProfile()
  },

  signOut: async () => {
    // Sobe as pendências antes de sair (não perder trabalho não sincronizado).
    try { await (await import('@/store/appModeStore')).flushAllTenantStores() } catch { /* offline: segue */ }
    await supabase.auth.signOut()
    clearTenantScopedCaches()
    await resetTenantScopedRuntimeStores()
    set({ session: null, user: null, profile: null, memberships: [], isGlobalAdmin: false })
  },

  setSession: (s) => set({ session: s, user: s?.user ?? null }),
}))

let refreshEmVoo: Promise<void> | null = null

async function refreshProfileInterno(get: () => AuthState, set: (p: Partial<AuthState>) => void): Promise<void> {
    const user = get().user
    if (!user) {
      set({ profile: null, memberships: [], isGlobalAdmin: false })
      return
    }
    // As três leituras não dependem uma da outra — em série custavam três idas ao servidor
    // antes de a tela liberar. `is_global_admin` falha para `false` de propósito (ver abaixo).
    const [{ data, error }, rpc, admin] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, organization_id, full_name, email, role, job_title, mfa_enrolled')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.rpc('get_my_org_memberships'),
      supabase.rpc('is_global_admin').then((r) => r, () => ({ data: null })),
    ])

    if (error) {
      console.warn('[auth] failed to load profile', error)
      set({ profile: null, memberships: [], isGlobalAdmin: false, error: error.message })
      return
    }

    let memberships: OrgMembership[] = []
    const { data: rpcData, error: rpcError } = rpc
    if (!rpcError && rpcData) {
      memberships = (rpcData as OrgMembershipRpcRow[]).map((row) => ({
        id: row.membership_id,
        organization_id: row.organization_id,
        role: row.role,
        status: row.status,
        organization: {
          id: row.organization_id,
          name: row.organization_name ?? row.organization_id,
          slug: row.organization_slug ?? row.organization_id,
          environment: row.organization_environment ?? 'production',
        },
      }))
    } else {
      const { data: membershipData, error: membershipsError } = await supabase
        .from('memberships')
        .select('id, organization_id, role, status, organizations(id, name, slug, environment)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (membershipsError) {
        console.warn('[auth] failed to load memberships', membershipsError)
        // isGlobalAdmin também zera aqui: era a única saída que preservava o valor, e com ela
        // um administrador de plataforma que saísse deixaria o menu de administração aberto
        // para quem entrasse depois na mesma aba.
        set({ profile: data as Profile | null, memberships: [], isGlobalAdmin: false, error: membershipsError.message })
        return
      }

      memberships = (membershipData ?? []).map((row: any) => ({
        id: row.id,
        organization_id: row.organization_id,
        role: row.role,
        status: row.status,
        organization: Array.isArray(row.organizations) ? row.organizations[0] ?? null : row.organizations ?? null,
      })) as OrgMembership[]
    }

    // Membership SINTÉTICA — e o `id` com prefixo `profile-` é o que a identifica.
    //
    // Ela existe para o app conseguir navegar quando a lista de memberships vem vazia (RPC
    // indisponível, replicação atrasada). Mas ela é uma SUPOSIÇÃO baseada no `profiles.role`, e a
    // RLS do servidor NÃO olha o profile: `has_role()` exige uma linha real em `memberships`, com
    // `status='active'` e sem `deleted_at`.
    //
    // Ou seja: é exatamente esta membership fabricada que faz o app mostrar "owner" e liberar os
    // botões enquanto o servidor rejeita toda escrita — e o usuário só descobre pela fila presa,
    // com uma mensagem de RLS em inglês. Por isso ela serve para navegar, mas `podeEscrever()`
    // (em roles.ts) a trata como "não confirmada" e avisa, em vez de deixar enfileirar.
    if (memberships.length === 0 && data?.organization_id) {
      memberships = [{
        id: `profile-${data.organization_id}`,
        organization_id: data.organization_id,
        role: data.role,
        status: 'active',
        organization: {
          id: data.organization_id,
          name: 'Empresa ativa',
          slug: data.organization_id,
          environment: 'production',
        },
      }]
    }

    const nextProfile = data as Profile | null
    const nextOrgId = nextProfile?.organization_id
    const previousOrgId = get().profile?.organization_id
    const localCacheWasCleared = nextOrgId ? ensureTenantScopedCaches(nextOrgId) : false
    if (nextOrgId && (localCacheWasCleared || (previousOrgId && previousOrgId !== nextOrgId))) {
      await resetTenantScopedRuntimeStores(nextOrgId)
    }

    // Quem administra a plataforma quem diz é o servidor. A RPC responde só sobre quem
    // perguntou e nunca lista ninguém — a tabela `platform_admins` tem RLS sem policy alguma.
    // Se a chamada falhar, o padrão é `false`: perder o menu de administração é um
    // inconveniente; mostrá-lo por engano seria vazar a existência do papel.
    const isGlobalAdmin = admin.data === true

    set({ profile: nextProfile, memberships, isGlobalAdmin, error: null })

    // Com a organização ativa conhecida, sincroniza todos os stores tenant-scoped:
    // flush das ops locais pendentes (recupera dados criados antes do perfil) e
    // pull do servidor. Isso garante que os dados apareçam após reload/login/troca
    // de empresa em TODOS os módulos. No-op no modo demo/homologação.
    if (nextOrgId) {
      void import('@/store/appModeStore').then((m) => m.syncAllTenantStores())
    }
}

/** Helper síncrono: lança se o usuário não tiver um dos roles. */
export function requireRole(...allowed: UserRole[]): void {
  const profile = useAuth.getState().profile
  if (!profile || !allowed.includes(profile.role)) {
    throw new Error(`Permissão negada. Requer: ${allowed.join(', ')}`)
  }
}

/** Helper booleano para componentes. */
export function hasRole(...allowed: UserRole[]): boolean {
  const profile = useAuth.getState().profile
  return !!profile && allowed.includes(profile.role)
}

/**
 * `visualizador` é somente-leitura: não passa nas policies de INSERT/UPDATE (has_role),
 * então uma criação vira op presa para sempre no pendingSync. Use para esconder/guardar
 * ações de criação e edição (evita a armadilha de onboarding). Sem perfil = não escreve.
 */
export function canWrite(): boolean {
  const profile = useAuth.getState().profile
  return !!profile && profile.role !== 'visualizador'
}
