const TENANT_CACHE_KEYS = [
  'cdata-rdo',
  'cdata-suprimentos',
  'cdata-agenda',
  'cdata-projetos',
  'cdata-planejamento',
  'cdata-planejamento-restricoes',
  'cdata-quantitativos',
  'cdata-quantitativo-personalizado-v6',
  'cdata-relatorio360',
  'cdata-bim',
  'cdata-torre-controle',
  'cdata-equipamentos',
  'cdata-gestao-equipamentos',
  'cdata-preconstrucao',
  'cdata-mao-de-obra',
  'cdata-otimizacao-frota',
  'cdata-lps',
  'cdata-evm',
  'cdata-mapa-interativo',
  'cdata-gestao-360',
  'cdata-qualidade',
  'cdata-medicao',
  'cdata-medicao-billing',
  'cdata-medicao-unificada',
  'cdata-medicao-assistida',
  'cdata-criterios-custom',
  'cdata-planejamento-mestre',
  'cdata-operacao-campo',
  'cdata-rede-360',
  'cdata-frota-veicular',
  'cdata-financeiro',
  'cdata-company-settings',
  'cdata-contractors',
  'cdata-economia',
  'cdata-rdo-sabesp',
  'cdata-manutencoes',
  'cdata-user-routine',
  'cdata-user-snapshot',
  'cdata-plano-execucao',
  'cdata-servicos',
] as const

const TENANT_MARKER_KEY = 'cdata-active-organization-id'

const SAFE_GLOBAL_CDATA_KEYS = new Set([
  'cdata-auth',
  'cdata-theme',
  'cdata-sidebar',
  'cdata-sidebar-pins',
  'cdata-login-email',
  'cdata-demo',
  'cdata-public-preview',
  TENANT_MARKER_KEY,
])

export function clearTenantScopedCaches(nextOrganizationId?: string): void {
  if (typeof window === 'undefined') return

  for (const key of TENANT_CACHE_KEYS) {
    window.localStorage.removeItem(key)
  }

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith('cdata-')) continue
    if (SAFE_GLOBAL_CDATA_KEYS.has(key)) continue
    window.localStorage.removeItem(key)
  }

  if (nextOrganizationId) {
    window.localStorage.setItem(TENANT_MARKER_KEY, nextOrganizationId)
  } else {
    window.localStorage.removeItem(TENANT_MARKER_KEY)
  }
}

/** Organização cujo cache local está atualmente marcado (ou null). */
export function getTenantMarker(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TENANT_MARKER_KEY)
}

export function ensureTenantScopedCaches(organizationId: string): boolean {
  if (typeof window === 'undefined' || !organizationId) return false

  const cachedOrganizationId = window.localStorage.getItem(TENANT_MARKER_KEY)
  if (cachedOrganizationId === organizationId) return false

  // Marcador AUSENTE (1º login neste aparelho, ou logo após signOut) → NÃO limpar,
  // só marcar a org. O único caminho que remove o marcador (`clearTenantScopedCaches()`
  // no signOut) também limpa todos os caches e sobe as pendências antes — então
  // "marcador ausente" implica "caches já vazios". Limpar aqui só apagaria dados
  // deste mesmo usuário criados antes do perfil carregar (ex.: RDO offline) → perda.
  if (!cachedOrganizationId) {
    window.localStorage.setItem(TENANT_MARKER_KEY, organizationId)
    return false
  }

  // Marcador PRESENTE e DIFERENTE → troca real de organização: limpa o cache do
  // tenant anterior e marca o novo.
  clearTenantScopedCaches(organizationId)
  return true
}
