/**
 * companySettingsStore.ts — Persists company branding (logo, name) across sessions.
 * Logo is stored as a base64 data URL and injected into PDF exports.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CompanySettingsState {
  logo: string | null        // data:image/...;base64,...
  companyName: string

  setLogo: (base64: string | null) => void
  setCompanyName: (name: string) => void
}

export const useCompanySettingsStore = create<CompanySettingsState>()(
  persist(
    (set) => ({
      logo: null,
      companyName: 'Construdata Engenharia',

      setLogo: (logo) => set({ logo }),
      setCompanyName: (companyName) => set({ companyName }),
    }),
    { name: 'cdata-company-settings' },
  ),
)
