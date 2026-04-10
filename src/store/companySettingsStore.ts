/**
 * companySettingsStore.ts — Sprint 6: migrado para Supabase.
 *
 * Divisão:
 *   - companyName → organizations.settings.company_name (JSONB existente)
 *   - logos       → tabela company_logos + binário no Storage bucket project-documents/ prefix logos/
 *
 * Mantém persist localStorage como cache offline.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { uploadFile, removeFile, type UploadResult } from '@/lib/storage'
import { flushQueue, makeOp, pullTable, type PendingOp, type SyncStatus } from '@/lib/storeSync'

export interface SavedLogo {
  id:           string
  name:         string
  base64:       string   // legado — vazio para logos novos (use storagePath)
  storagePath?: string   // novo — path no bucket
  createdAt:    string
}

interface CompanySettingsState {
  logos:       SavedLogo[]
  companyName: string

  pendingSync:  PendingOp[]
  syncStatus:   SyncStatus
  lastSyncedAt: string | null
  syncError:    string | null

  /** Faz upload do file pro Storage e enfileira insert em company_logos. */
  uploadLogo:     (name: string, file: File) => Promise<void>
  /** Versão legada (mantém base64 local sem sync). */
  addLogo:        (name: string, base64: string) => void
  removeLogo:     (id: string) => void
  updateLogoName: (id: string, name: string) => void
  setCompanyName: (name: string) => void
  flush: () => Promise<void>
  pull:  () => Promise<void>
}

function ctxAuth() {
  const { profile, user } = useAuth.getState()
  return { orgId: profile?.organization_id ?? 'pending', userId: user?.id ?? 'pending' }
}

let nameDebounce: ReturnType<typeof setTimeout> | null = null

export const useCompanySettingsStore = create<CompanySettingsState>()(
  persist(
    (set, get) => ({
      logos:       [],
      companyName: 'Construdata Engenharia',
      pendingSync:  [],
      syncStatus:   'idle',
      lastSyncedAt: null,
      syncError:    null,

      uploadLogo: async (name, file) => {
        const result: UploadResult | null = await uploadFile('project-documents', file, 'logos')
        if (!result) return
        const id = crypto.randomUUID()
        const newLogo: SavedLogo = {
          id,
          name,
          base64: '',
          storagePath: result.path,
          createdAt: new Date().toISOString(),
        }
        const { orgId, userId } = ctxAuth()
        set((s) => ({
          logos: [...s.logos, newLogo],
          pendingSync: [
            ...s.pendingSync,
            makeOp({
              entity: 'company_logo',
              type:   'insert',
              recordId: id,
              row: {
                id,
                organization_id: orgId,
                name,
                storage_path: result.path,
                payload: { createdAt: newLogo.createdAt },
                created_by: userId,
              },
              table: 'company_logos',
            }),
          ],
        }))
        void get().flush()
      },

      addLogo: (name, base64) => {
        // Versão legada (base64 inline) — sem sync. Use uploadLogo para sync real.
        set((s) => ({
          logos: [
            ...s.logos,
            { id: crypto.randomUUID(), name, base64, createdAt: new Date().toISOString() },
          ],
        }))
      },

      removeLogo: (id) => {
        const target = get().logos.find((l) => l.id === id)
        if (target?.storagePath) void removeFile('project-documents', target.storagePath)
        set((s) => ({
          logos: s.logos.filter((l) => l.id !== id),
          pendingSync: [
            ...s.pendingSync,
            makeOp({ entity: 'company_logo', type: 'delete', recordId: id, table: 'company_logos', approvalActionType: 'delete_company_logo' }),
          ],
        }))
        void get().flush()
      },

      updateLogoName: (id, name) => {
        set((s) => ({ logos: s.logos.map((l) => (l.id === id ? { ...l, name } : l)) }))
        const { orgId, userId } = ctxAuth()
        set((s) => ({
          pendingSync: [
            ...s.pendingSync,
            makeOp({
              entity: 'company_logo', type: 'update', recordId: id,
              patch: { name, payload: { updatedAt: new Date().toISOString() } },
              table: 'company_logos',
              row: { id, organization_id: orgId, created_by: userId },  // ignored for update
            }),
          ],
        }))
        void get().flush()
      },

      setCompanyName: (companyName) => {
        set({ companyName })
        // Debounce do upsert pra organizations.settings.company_name
        if (nameDebounce) clearTimeout(nameDebounce)
        nameDebounce = setTimeout(async () => {
          const { profile } = useAuth.getState()
          if (!profile) return
          const { data: org } = await supabase
            .from('organizations')
            .select('settings')
            .eq('id', profile.organization_id)
            .maybeSingle()
          const currentSettings = (org as { settings?: Record<string, unknown> } | null)?.settings ?? {}
          const newSettings = { ...currentSettings, company_name: companyName }
          const { error } = await supabase
            .from('organizations')
            .update({ settings: newSettings } as never)
            .eq('id', profile.organization_id)
          if (error) {
            console.warn('[company_name] update failed', error.message)
            set({ syncError: error.message })
            return
          }
          set({ lastSyncedAt: new Date().toISOString(), syncError: null })
        }, 800)
      },

      flush: async () => {
        const queue = get().pendingSync
        if (queue.length === 0) return
        if (typeof navigator !== 'undefined' && !navigator.onLine) { set({ syncStatus: 'offline' }); return }
        const { profile } = useAuth.getState()
        if (!profile) { set({ syncStatus: 'unauth' }); return }
        set({ syncStatus: 'syncing', syncError: null })
        const result = await flushQueue(queue)
        set((s) => ({
          pendingSync: s.pendingSync
            .filter((p) => !result.completed.includes(p.id))
            .map((p) => result.errored.includes(p.id) ? { ...p, retries: p.retries + 1 } : p),
          syncStatus:   result.lastError ? 'error' : 'idle',
          lastSyncedAt: new Date().toISOString(),
          syncError:    result.lastError ?? null,
        }))
      },

      pull: async () => {
        // Pull logos
        const rows = await pullTable<{ id: string; name: string; storage_path: string; payload: { createdAt?: string } }>('company_logos')
        if (rows) {
          set({
            logos: rows.map((r) => ({
              id:          r.id,
              name:        r.name,
              base64:      '',
              storagePath: r.storage_path,
              createdAt:   r.payload?.createdAt ?? new Date().toISOString(),
            })),
          })
        }
        // Pull company_name from org settings
        const { profile } = useAuth.getState()
        if (profile) {
          const { data: org } = await supabase
            .from('organizations')
            .select('settings')
            .eq('id', profile.organization_id)
            .maybeSingle()
          const settings = (org as { settings?: { company_name?: string } } | null)?.settings
          if (settings?.company_name) set({ companyName: settings.company_name })
        }
        set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
      },
    }),
    {
      name: 'cdata-company-settings',
      // Migration: drop old single-logo shape if it exists in localStorage
      merge: (persisted, current) => {
        const p = persisted as Record<string, unknown>
        if ('logo' in p) {
          const { logo: _dropped, ...rest } = p
          void _dropped
          return { ...current, ...rest } as CompanySettingsState
        }
        return { ...current, ...p } as CompanySettingsState
      },
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useCompanySettingsStore.getState().flush()
  })
}
