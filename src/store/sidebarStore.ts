import { create } from 'zustand'

const FAVORITES_KEY = 'cdata-favorites'

interface SidebarStoreState {
  favorites: string[]  // array of route paths like '/app/evm'
  toggleFavorite: (route: string) => void
  reorderFavorites: (from: number, to: number) => void
}

export const useSidebarStore = create<SidebarStoreState>((set) => ({
  favorites: (() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })(),

  toggleFavorite: (route) =>
    set((state) => {
      const next = state.favorites.includes(route)
        ? state.favorites.filter((r) => r !== route)
        : [...state.favorites, route]
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return { favorites: next }
    }),

  reorderFavorites: (from, to) =>
    set((state) => {
      const next = [...state.favorites]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return { favorites: next }
    }),
}))
