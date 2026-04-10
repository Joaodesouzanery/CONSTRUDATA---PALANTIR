/**
 * auth.ts — Helpers de autenticação e perfil.
 *
 * Centraliza o estado de sessão + profile do usuário em um Zustand store
 * leve, com cache de profile (uma única query por sessão) e listeners para
 * mudanças de auth.
 */
import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { UserRole } from '@/types/database'

export interface Profile {
  id:               string
  organization_id:  string
  full_name:        string
  email:            string
  role:             UserRole
  job_title:        string | null
  mfa_enrolled:     boolean
}

interface AuthState {
  session:    Session | null
  user:       User | null
  profile:    Profile | null
  loading:    boolean
  error:      string | null
  initialized: boolean

  init:       () => Promise<void>
  refreshProfile: () => Promise<void>
  signOut:    () => Promise<void>
  setSession: (s: Session | null) => void
}

export const useAuth = create<AuthState>((set, get) => ({
  session:     null,
  user:        null,
  profile:     null,
  loading:     false,
  error:       null,
  initialized: false,

  init: async () => {
    if (get().initialized) return
    set({ loading: true })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      set({ session, user: session?.user ?? null })

      if (session?.user) {
        await get().refreshProfile()
      }

      // Listener para mudanças (login/logout/refresh do JWT)
      supabase.auth.onAuthStateChange((_event, newSession) => {
        set({ session: newSession, user: newSession?.user ?? null })
        if (newSession?.user) {
          void get().refreshProfile()
        } else {
          set({ profile: null })
        }
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'auth init failed' })
    } finally {
      set({ loading: false, initialized: true })
    }
  },

  refreshProfile: async () => {
    const user = get().user
    if (!user) {
      set({ profile: null })
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, organization_id, full_name, email, role, job_title, mfa_enrolled')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.warn('[auth] failed to load profile', error)
      set({ profile: null, error: error.message })
      return
    }
    set({ profile: data as Profile | null, error: null })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null })
  },

  setSession: (s) => set({ session: s, user: s?.user ?? null }),
}))

/** Helper síncrono: lança se o usuário não tiver um dos roles. */
export function requireRole(...allowed: UserRole[]): void {
  const profile = useAuth.getState().profile
  if (!profile || !allowed.includes(profile.role)) {
    throw new Error(`Permissão negada. Requer: ${allowed.join(', ')}`)
  }
}

/** Helper booleano para componentes. */
export function hasRole(...allowed: UserRole[]): boolean {
  const profile = useAuth.getState().profile
  return !!profile && allowed.includes(profile.role)
}
