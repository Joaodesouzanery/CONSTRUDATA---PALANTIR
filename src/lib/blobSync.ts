/**
 * blobSync — sincroniza "fatias" de estado que hoje ficam só no navegador
 * (contrato/núcleos do Planejamento, restrições, financeiro do RDO, etc.) para a
 * tabela genérica `app_state` (1 blob jsonb por organização + store_key).
 *
 * Modelo: push acontece ao EDITAR (debounced) e só depois do primeiro pull, para
 * não sobrescrever o servidor com estado local vazio num dispositivo novo.
 * Conflito: last-write-wins por updated_at (cenário 1 usuário por empresa).
 *
 * Robustez (Fase 3):
 *  - `pushBlob` não tenta offline e devolve sucesso/erro (nada de perda silenciosa).
 *  - fatia com mudança não confirmada fica "dirty" e é reenviada ao voltar online.
 *  - o pull inicial roda quando a organização carrega — independente da fila de
 *    tabela — para destravar o `ready` (senão o push nunca aconteceria se o `pull()`
 *    do store fosse pulado por ter op pendente).
 */
import { supabase } from './supabase'
import { useAuth } from './auth'
import { isNonProductionDataMode } from './runtimeMode'

/** Sobe uma fatia para `app_state`. Retorna true se salvou (ou se é no-op em demo). */
export async function pushBlob(storeKey: string, payload: unknown): Promise<boolean> {
  if (isNonProductionDataMode()) return true
  const { profile, user } = useAuth.getState()
  const orgId = profile?.organization_id
  if (!orgId || orgId === 'pending') return false
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false
  const { error } = await supabase.from('app_state').upsert(
    {
      organization_id: orgId,
      store_key: storeKey,
      payload: (payload ?? {}) as Record<string, unknown>,
      updated_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    } as never,
    { onConflict: 'organization_id,store_key' },
  )
  if (error) {
    console.warn(`[blobSync:${storeKey}] push falhou`, error.message)
    return false
  }
  return true
}

export async function pullBlob<T = Record<string, unknown>>(storeKey: string): Promise<{ payload: T; updatedAt: string } | null> {
  if (isNonProductionDataMode()) return null
  const { profile } = useAuth.getState()
  const orgId = profile?.organization_id
  if (!orgId || orgId === 'pending') return null
  const { data, error } = await supabase
    .from('app_state')
    .select('payload, updated_at')
    .eq('organization_id', orgId)
    .eq('store_key', storeKey)
    .maybeSingle()
  if (error || !data) return null
  return { payload: (data as { payload: T }).payload, updatedAt: (data as { updated_at: string }).updated_at }
}

interface StoreApi<T> {
  getState: () => T
  subscribe: (listener: (state: T, prev: T) => void) => () => void
}

/**
 * Liga uma fatia de um store ao app_state. Retorna `pullInto()` para o store
 * chamar no seu `pull()` (troca de empresa). O push é automático (debounced) ao
 * editar, e o pull inicial é disparado sozinho quando a organização carrega.
 */
export function attachBlobSync<T>(
  store: StoreApi<T>,
  opts: { key: string; getSlice: (s: T) => Record<string, unknown>; applySlice: (slice: Record<string, unknown>) => void; debounceMs?: number },
) {
  let last = JSON.stringify(opts.getSlice(store.getState()))
  let timer: ReturnType<typeof setTimeout> | null = null
  let ready = false           // só empurra depois do primeiro pull
  let applying = false        // não reempurra o que acabou de vir do servidor
  let dirty = false           // mudança local ainda não confirmada no servidor
  let pulling = false         // evita pull concorrente (auto-init + pull() do store)

  const doPush = async () => {
    const payload = opts.getSlice(store.getState())
    const ok = await pushBlob(opts.key, payload)
    if (ok) { dirty = false; last = JSON.stringify(payload) }
    // Falhou/offline → dirty continua true e reenvia no 'online'.
  }

  store.subscribe((state) => {
    if (applying || !ready) { last = JSON.stringify(opts.getSlice(state)); return }
    const now = JSON.stringify(opts.getSlice(state))
    if (now === last) return
    last = now
    dirty = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void doPush() }, opts.debounceMs ?? 800)
  })

  const pullInto = async () => {
    if (pulling) return          // pull inicial e pull() do store não corrida
    pulling = true
    try {
      const res = await pullBlob<Record<string, unknown>>(opts.key)
      if (res) {
        applying = true
        try { opts.applySlice(res.payload) } finally { applying = false }
        last = JSON.stringify(opts.getSlice(store.getState()))
      }
      ready = true
    } finally {
      pulling = false
    }
    // Se havia mudança local pendente antes do pull, tenta subir agora.
    if (dirty) void doPush()
  }

  if (typeof window !== 'undefined') {
    // Pull inicial independente da fila de tabela: assim o `ready` destrava e o
    // push volta a funcionar mesmo quando o `pull()` do store é pulado por op pendente.
    let inited = false
    const tryInit = () => {
      if (inited) return
      const orgId = useAuth.getState().profile?.organization_id
      if (!orgId || orgId === 'pending') return
      inited = true
      void pullInto()
    }
    tryInit()
    useAuth.subscribe(tryInit)   // dispara quando o perfil/organização carrega
    // Reenvia fatia suja quando a conexão voltar.
    window.addEventListener('online', () => { if (ready && dirty) void doPush() })
  }

  return { pullInto }
}
