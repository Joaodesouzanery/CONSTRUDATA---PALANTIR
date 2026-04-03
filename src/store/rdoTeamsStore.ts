import { create } from 'zustand'
import type { RdoSavedTeam } from '@/types'

interface RdoTeamsState {
  teams: RdoSavedTeam[]
  addTeam: (team: Omit<RdoSavedTeam, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateTeam: (id: string, patch: Partial<Omit<RdoSavedTeam, 'id' | 'createdAt'>>) => void
  removeTeam: (id: string) => void
}

export const useRdoTeamsStore = create<RdoTeamsState>((set) => ({
  teams: [],

  addTeam: (team) => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    set((state) => ({
      teams: [...state.teams, { ...team, id, createdAt: now, updatedAt: now }],
    }))
    return id
  },

  updateTeam: (id, patch) =>
    set((state) => ({
      teams: state.teams.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
      ),
    })),

  removeTeam: (id) =>
    set((state) => ({ teams: state.teams.filter((t) => t.id !== id) })),
}))
