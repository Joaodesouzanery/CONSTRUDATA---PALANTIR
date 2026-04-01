/**
 * sidebarStore.ts — Persisted favorites for the sidebar.
 * Favorites are stored as an ordered array of route `to` values.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  favorites: string[]
  toggleFavorite: (to: string) => void
  reorderFavorites: (newOrder: string[]) => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      favorites: [],

      toggleFavorite: (to) =>
        set((s) => ({
          favorites: s.favorites.includes(to)
            ? s.favorites.filter((f) => f !== to)
            : [...s.favorites, to],
        })),

      reorderFavorites: (newOrder) => set({ favorites: newOrder }),
    }),
    { name: 'cdata-sidebar-favorites' },
  ),
)
