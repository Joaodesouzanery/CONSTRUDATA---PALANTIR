/**
 * companySettingsStore.ts — Persists company branding (logo gallery, name) across sessions.
 * Logos are stored as base64 data URLs and can be selected per-RDO for PDF exports.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SavedLogo {
  id:        string   // crypto.randomUUID()
  name:      string   // display name, e.g. "Construtora X"
  base64:    string   // data:image/...;base64,...
  createdAt: string   // ISO date string
}

interface CompanySettingsState {
  logos:       SavedLogo[]
  companyName: string

  addLogo:        (name: string, base64: string) => void
  removeLogo:     (id: string) => void
  updateLogoName: (id: string, name: string) => void
  setCompanyName: (name: string) => void
}

export const useCompanySettingsStore = create<CompanySettingsState>()(
  persist(
    (set) => ({
      logos:       [],
      companyName: 'Construdata Engenharia',

      addLogo: (name, base64) =>
        set((s) => ({
          logos: [
            ...s.logos,
            { id: crypto.randomUUID(), name, base64, createdAt: new Date().toISOString() },
          ],
        })),

      removeLogo: (id) =>
        set((s) => ({ logos: s.logos.filter((l) => l.id !== id) })),

      updateLogoName: (id, name) =>
        set((s) => ({ logos: s.logos.map((l) => (l.id === id ? { ...l, name } : l)) })),

      setCompanyName: (companyName) => set({ companyName }),
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
