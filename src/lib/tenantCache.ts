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

/**
 * Trabalho que existe SÓ no navegador e que `getPendingSummary` não enxerga.
 *
 * POR QUE PRECISA EXISTIR. `getPendingSummary` (appModeStore) soma a fila `pendingSync` dos
 * stores registrados em `TENANT_STORE_DEFS`. Quem não é um desses stores não tem fila — e
 * portanto some da conta. Só que `clearTenantScopedCaches`, logo abaixo, apaga TODA chave
 * `cdata-*` fora da allow-list. Ou seja: existe trabalho do usuário que o "sair da conta"
 * apagaria com a fila zerada e sem nenhum aviso.
 *
 * O pior caso é o RDO da Sabesp: quando o envio ao servidor falha, o app **diz na tela** que
 * "o RDO continuará disponível neste navegador". Apagar isso em silêncio é quebrar uma
 * promessa escrita.
 *
 * REGRA PARA MEXER AQUI: só entra o que dá para detectar SEM falso positivo. Um aviso que
 * aparece à toa é pior que aviso nenhum — a pessoa aprende a clicar em "sim" sem ler, e no dia
 * em que o aviso for verdadeiro ela vai clicar igual. Por isso o RDO conta apenas os registros
 * marcados `_localOnly` pelo próprio app, e o levantamento personalizado só grava no navegador
 * depois que alguém edita alguma linha (ver `usePersistedRows` em QuantitativoPersonalizadoPanel).
 */
const CHAVES_QUANTITATIVO_PERSONALIZADO = [
  'cdata-quantitativo-personalizado-v6-params',
  'cdata-quantitativo-personalizado-v6-trechos',
  'cdata-quantitativo-personalizado-v6-pvs',
  'cdata-quantitativo-personalizado-v6-acessorios',
  'cdata-quantitativo-personalizado-v6-bdi',
  'cdata-quantitativo-personalizado-v6-base',
]

function lerArray(chave: string): unknown[] {
  try {
    const bruto = window.localStorage.getItem(chave)
    const parsed = bruto ? JSON.parse(bruto) : null
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** O que `clearTenantScopedCaches` vai apagar e não existe em lugar nenhum além deste navegador. */
export function inventarioTrabalhoSoLocal(): { total: number; itens: string[] } {
  if (typeof window === 'undefined') return { total: 0, itens: [] }
  const itens: string[] = []
  let total = 0

  // RDO da Sabesp que não chegou ao servidor — o próprio app marca `_localOnly`.
  const rdosLocais = lerArray('cdata-rdo-sabesp')
    .filter((r) => (r as { _localOnly?: boolean; deleted_at?: string | null })?._localOnly
      && !(r as { deleted_at?: string | null }).deleted_at).length
  if (rdosLocais > 0) { total += rdosLocais; itens.push(`${rdosLocais} RDO(s) da Sabesp que não chegaram ao servidor`) }

  // Critérios de medição criados à mão (a chave só existe se alguém criou algum).
  const criterios = lerArray('cdata-criterios-custom').length
  if (criterios > 0) { total += criterios; itens.push(`${criterios} critério(s) de medição criado(s) por você`) }

  // Levantamento personalizado: as seis abas do assistente.
  const abasComDado = CHAVES_QUANTITATIVO_PERSONALIZADO.filter((k) => lerArray(k).length > 0).length
  if (abasComDado > 0) { total += abasComDado; itens.push('o levantamento quantitativo personalizado') }

  return { total, itens }
}

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
