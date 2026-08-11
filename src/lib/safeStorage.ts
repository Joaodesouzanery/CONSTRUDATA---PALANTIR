/**
 * safeStorage.ts — persist storage do zustand à prova de estouro de cota.
 *
 * O `localStorage` tem ~5 MB por origem. Quando o blob de um store não cabe
 * (ex.: RDO com fotos), `setItem` lança `QuotaExceededError` e o zustand-persist
 * **falha em silêncio** — o dado fica só na memória e some ao atualizar a página.
 *
 * Este wrapper captura o estouro e, como último recurso, regrava o blob **sem os
 * arrays de foto pesados** (`state.rdos[*].photos` e `state.pendingSync[*].row
 * .payload.photos`). Assim o texto do RDO (o que não dá pra refazer) nunca se
 * perde; no pior caso perde-se só a foto — que a Fase 2 leva pro Supabase Storage.
 */
import { createJSONStorage, type StateStorage } from 'zustand/middleware'

interface PersistedBlob {
  state?: {
    rdos?: unknown[]
    pendingSync?: unknown[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' ||
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22)
  )
}

/** Remove os arrays de foto pesados do blob serializado, preservando o resto. */
function stripHeavyPhotos(json: string): string {
  const parsed = JSON.parse(json) as PersistedBlob
  const state = parsed.state
  if (state && typeof state === 'object') {
    if (Array.isArray(state.rdos)) {
      state.rdos = state.rdos.map((r) => {
        if (r && typeof r === 'object' && 'photos' in r) {
          return { ...(r as Record<string, unknown>), photos: [] }
        }
        return r
      })
    }
    if (Array.isArray(state.pendingSync)) {
      state.pendingSync = state.pendingSync.map((op) => {
        let out = op as Record<string, unknown>
        // op de INSERT: fotos em row.payload.photos
        const row = (op as { row?: { payload?: Record<string, unknown> } })?.row
        const rowPayload = row?.payload
        if (rowPayload && typeof rowPayload === 'object' && 'photos' in rowPayload) {
          out = { ...out, row: { ...(row as Record<string, unknown>), payload: { ...rowPayload, photos: [] } } }
        }
        // op de UPDATE (edição/retry de fotos): fotos em patch.payload.photos — sem este
        // strip, um update com base64 estourava a cota e o snapshot inteiro se perdia.
        const patch = (op as { patch?: { payload?: Record<string, unknown> } })?.patch
        const patchPayload = patch?.payload
        if (patchPayload && typeof patchPayload === 'object' && 'photos' in patchPayload) {
          out = { ...out, patch: { ...(patch as Record<string, unknown>), payload: { ...patchPayload, photos: [] } } }
        }
        return out
      })
    }
  }
  return JSON.stringify(parsed)
}

const safeStateStorage: StateStorage = {
  getItem: (name) => (typeof window !== 'undefined' ? window.localStorage.getItem(name) : null),
  setItem: (name, value) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(name, value)
    } catch (e) {
      if (!isQuotaError(e)) throw e
      // Último recurso: regrava sem as fotos para não perder o restante dos dados.
      try {
        window.localStorage.setItem(name, stripHeavyPhotos(value))
        console.warn(
          `[safeStorage] Cota do navegador excedida em "${name}" — fotos removidas do cache local para preservar o restante. (O texto do RDO está salvo; as fotos sobem pra nuvem.)`,
        )
      } catch (e2) {
        console.error(`[safeStorage] Não foi possível gravar "${name}" nem sem fotos.`, e2)
      }
    }
  },
  removeItem: (name) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(name)
  },
}

/** Storage do zustand-persist com proteção contra QuotaExceededError. */
export function createSafeJSONStorage<S>() {
  return createJSONStorage<S>(() => safeStateStorage)
}
