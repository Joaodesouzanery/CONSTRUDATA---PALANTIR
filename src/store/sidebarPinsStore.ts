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
  movePin:     (path: string, direction: -1 | 1) => void
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

      movePin: (path, direction) =>
        set((s) => {
          const index = s.pinnedPaths.indexOf(path)
          const nextIndex = index + direction
          if (index < 0 || nextIndex < 0 || nextIndex >= s.pinnedPaths.length) return s
          const next = [...s.pinnedPaths]
          const [item] = next.splice(index, 1)
          next.splice(nextIndex, 0, item)
          return { pinnedPaths: next }
        }),
    }),
    { name: 'cdata-sidebar-pins' },
  ),
)
