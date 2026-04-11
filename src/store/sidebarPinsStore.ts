/**
 * sidebarPinsStore.ts — Persists which modules the user pinned to the sidebar top.
 * Separate from userRoutineStore (which is frequency-based for Minha Rotina).
 * This is purely sidebar ordering: pinned items appear in FAVORITOS section.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarPinsState {
  pinnedPaths: string[]
  togglePin:   (path: string) => void
  isPinned:    (path: string) => boolean
}

export const useSidebarPinsStore = create<SidebarPinsState>()(
  persist(
    (set, get) => ({
      pinnedPaths: [],

      togglePin: (path) =>
        set((s) => {
          const exists = s.pinnedPaths.includes(path)
          return {
            pinnedPaths: exists
              ? s.pinnedPaths.filter((p) => p !== path)
              : [...s.pinnedPaths, path],
          }
        }),

      isPinned: (path) => get().pinnedPaths.includes(path),
    }),
    { name: 'cdata-sidebar-pins' },
  ),
)
