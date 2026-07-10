/**
 * blobSync — sincroniza "fatias" de estado que hoje ficam só no navegador
 * (contrato/núcleos do Planejamento, restrições, etc.) para a tabela genérica
 * `app_state` (1 blob jsonb por organização + store_key). Sem uma tabela por store.
 *
 * Modelo: push acontece ao EDITAR (debounced) e só depois do primeiro pull, para
 * não sobrescrever o servidor com estado local vazio num dispositivo novo.
 * Conflito: last-write-wins por updated_at (cenário 1 usuário por empresa).
 */
import { supabase } from './supabase'
import { useAuth } from './auth'
import { isNonProductionDataMode } from './runtimeMode'

export async function pushBlob(storeKey: string, payload: unknown): Promise<void> {
  if (isNonProductionDataMode()) return
  const { profile, user } = useAuth.getState()
  const orgId = profile?.organization_id
  if (!orgId || orgId === 'pending') return
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
  if (error) console.warn(`[blobSync:${storeKey}] push falhou`, error.message)
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
 * chamar no seu `pull()` (login/troca de empresa). O push é automático (debounced)
 * ao editar a fatia, e só depois do primeiro pull (evita apagar o servidor).
 */
export function attachBlobSync<T>(
  store: StoreApi<T>,
  opts: { key: string; getSlice: (s: T) => Record<string, unknown>; applySlice: (slice: Record<string, unknown>) => void; debounceMs?: number },
) {
  let last = JSON.stringify(opts.getSlice(store.getState()))
  let timer: ReturnType<typeof setTimeout> | null = null
  let ready = false           // só empurra depois do primeiro pull
  let applying = false        // não reempurra o que acabou de vir do servidor

  store.subscribe((state) => {
    if (applying || !ready) { last = JSON.stringify(opts.getSlice(state)); return }
    const now = JSON.stringify(opts.getSlice(state))
    if (now === last) return
    last = now
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void pushBlob(opts.key, JSON.parse(now)) }, opts.debounceMs ?? 800)
  })

  return {
    pullInto: async () => {
      const res = await pullBlob<Record<string, unknown>>(opts.key)
      if (res) {
        applying = true
        try { opts.applySlice(res.payload) } finally { applying = false }
        last = JSON.stringify(opts.getSlice(store.getState()))
      }
      ready = true
    },
  }
}
