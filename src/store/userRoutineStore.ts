/**
 * userRoutineStore.ts
 *
 * Sprint 6: rotina pessoal do usuário sincroniza com Supabase tabela `user_routines`
 * (1 row por user, RLS por user_id). Mantém persist localStorage como cache offline.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import type { SyncStatus } from '@/lib/storeSync'

export type Persona =
  | 'engenheiro'
  | 'gerente'
  | 'diretor'
  | 'planejador'
  | 'qualidade'
  | 'comprador'
  | 'custom'

export type RoutineFrequency = 'daily' | 'weekly' | 'monthly'

export interface PersonaPreset {
  id:      Persona
  label:   string
  emoji:   string
  desc:    string
  daily:   string[]
  weekly:  string[]
  monthly: string[]
}

export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    id: 'engenheiro',
    label: 'Engenheiro de Obra',
    emoji: '👷',
    desc: 'Quem fica no canteiro, registra RDOs e FVS, cuida da execução.',
    daily:   ['/app/rdo', '/app/qualidade', '/app/lps-lean'],
    weekly:  ['/app/mao-de-obra', '/app/suprimentos', '/app/planejamento'],
    monthly: ['/app/bim', '/app/quantitativos'],
  },
  {
    id: 'gerente',
    label: 'Gerente de Obra',
    emoji: '👔',
    desc: 'Acompanha CPI/SPI, prazos e custo de várias frentes.',
    daily:   ['/app/gestao-360', '/app/torre-de-controle', '/app/rdo'],
    weekly:  ['/app/planejamento', '/app/lps-lean', '/app/evm'],
    monthly: ['/app/quantitativos', '/app/bim'],
  },
  {
    id: 'diretor',
    label: 'Diretor / Dono',
    emoji: '🎯',
    desc: 'Visão executiva do portfólio inteiro de obras.',
    daily:   ['/app/torre-de-controle', '/app/relatorio360'],
    weekly:  ['/app/gestao-360', '/app/evm'],
    monthly: ['/app/quantitativos'],
  },
  {
    id: 'planejador',
    label: 'Planejador',
    emoji: '📐',
    desc: 'Constrói cronogramas, simula cenários, faz EVM.',
    daily:   ['/app/planejamento-mestre', '/app/planejamento'],
    weekly:  ['/app/lps-lean', '/app/agenda', '/app/evm'],
    monthly: ['/app/mapa-interativo', '/app/quantitativos'],
  },
  {
    id: 'qualidade',
    label: 'Qualidade / Fiscal',
    emoji: '✅',
    desc: 'Inspeciona, abre FVS, registra NCs.',
    daily:   ['/app/qualidade', '/app/rdo'],
    weekly:  ['/app/mapa-interativo', '/app/projetos'],
    monthly: ['/app/relatorio360'],
  },
  {
    id: 'comprador',
    label: 'Comprador / Almoxarife',
    emoji: '📦',
    desc: 'Cuida de pedidos, recebimentos, fornecedores e estoque.',
    daily:   ['/app/suprimentos'],
    weekly:  ['/app/gestao-equipamentos', '/app/otimizacao-frota'],
    monthly: ['/app/quantitativos'],
  },
]

interface UserRoutineState {
  persona:        Persona
  pinnedDaily:    string[]
  pinnedWeekly:   string[]
  pinnedMonthly:  string[]
  hasOnboarded:   boolean

  syncStatus:     SyncStatus
  lastSyncedAt:   string | null
  syncError:      string | null

  setPersona:     (p: Persona) => void
  togglePin:      (path: string, frequency: RoutineFrequency) => void
  isPinned:       (path: string) => RoutineFrequency | null
  resetToPreset:  (persona: Persona) => void
  markOnboarded:  () => void

  flush: () => Promise<void>
  pull:  () => Promise<void>
}

function getPreset(persona: Persona): PersonaPreset | undefined {
  return PERSONA_PRESETS.find((p) => p.id === persona)
}

// Debounce do upsert (rotina muda muito quando o usuário arrasta vários pins)
let routineDebounce: ReturnType<typeof setTimeout> | null = null
function scheduleSync(get: () => UserRoutineState) {
  if (routineDebounce) clearTimeout(routineDebounce)
  routineDebounce = setTimeout(() => {
    void get().flush()
  }, 800)
}

export const useUserRoutineStore = create<UserRoutineState>()(
  persist(
    (set, get) => ({
      persona:       'engenheiro',
      pinnedDaily:   PERSONA_PRESETS[0].daily,
      pinnedWeekly:  PERSONA_PRESETS[0].weekly,
      pinnedMonthly: PERSONA_PRESETS[0].monthly,
      hasOnboarded:  false,

      syncStatus:    'idle',
      lastSyncedAt:  null,
      syncError:     null,

      setPersona: (persona) => {
        set(() => {
          const preset = getPreset(persona)
          if (!preset || persona === 'custom') return { persona }
          return {
            persona,
            pinnedDaily:   preset.daily,
            pinnedWeekly:  preset.weekly,
            pinnedMonthly: preset.monthly,
          }
        })
        scheduleSync(get)
      },

      togglePin: (path, frequency) => {
        set((s) => {
          const cleanDaily   = s.pinnedDaily.filter((p) => p !== path)
          const cleanWeekly  = s.pinnedWeekly.filter((p) => p !== path)
          const cleanMonthly = s.pinnedMonthly.filter((p) => p !== path)

          const wasInTarget =
            (frequency === 'daily'   && s.pinnedDaily.includes(path))   ||
            (frequency === 'weekly'  && s.pinnedWeekly.includes(path))  ||
            (frequency === 'monthly' && s.pinnedMonthly.includes(path))

          if (wasInTarget) {
            return {
              persona:       'custom',
              pinnedDaily:   cleanDaily,
              pinnedWeekly:  cleanWeekly,
              pinnedMonthly: cleanMonthly,
            }
          }

          return {
            persona:       'custom',
            pinnedDaily:   frequency === 'daily'   ? [...cleanDaily, path]   : cleanDaily,
            pinnedWeekly:  frequency === 'weekly'  ? [...cleanWeekly, path]  : cleanWeekly,
            pinnedMonthly: frequency === 'monthly' ? [...cleanMonthly, path] : cleanMonthly,
          }
        })
        scheduleSync(get)
      },

      isPinned: (path) => {
        const s = get()
        if (s.pinnedDaily.includes(path))   return 'daily'
        if (s.pinnedWeekly.includes(path))  return 'weekly'
        if (s.pinnedMonthly.includes(path)) return 'monthly'
        return null
      },

      resetToPreset: (persona) => {
        set(() => {
          const preset = getPreset(persona)
          if (!preset) return {}
          return {
            persona,
            pinnedDaily:   preset.daily,
            pinnedWeekly:  preset.weekly,
            pinnedMonthly: preset.monthly,
          }
        })
        scheduleSync(get)
      },

      markOnboarded: () => {
        set({ hasOnboarded: true })
        scheduleSync(get)
      },

      flush: async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          set({ syncStatus: 'offline' }); return
        }
        const { profile, user } = useAuth.getState()
        if (!profile || !user) { set({ syncStatus: 'unauth' }); return }
        set({ syncStatus: 'syncing', syncError: null })

        const s = get()
        const { error } = await supabase.from('user_routines').upsert({
          user_id:         user.id,
          organization_id: profile.organization_id,
          persona:         s.persona,
          payload: {
            pinnedDaily:   s.pinnedDaily,
            pinnedWeekly:  s.pinnedWeekly,
            pinnedMonthly: s.pinnedMonthly,
            hasOnboarded:  s.hasOnboarded,
          },
          updated_at: new Date().toISOString(),
        } as never)

        if (error) {
          console.warn('[user_routines] upsert failed', error.message)
          set({ syncStatus: 'error', syncError: error.message })
          return
        }
        set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString(), syncError: null })
      },

      pull: async () => {
        const { user } = useAuth.getState()
        if (!user) return
        const { data, error } = await supabase
          .from('user_routines')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        if (error) {
          console.warn('[user_routines] pull failed', error.message)
          return
        }
        if (data) {
          const row = data as { persona: string; payload: { pinnedDaily?: string[]; pinnedWeekly?: string[]; pinnedMonthly?: string[]; hasOnboarded?: boolean } }
          set({
            persona:       row.persona as Persona,
            pinnedDaily:   row.payload?.pinnedDaily ?? [],
            pinnedWeekly:  row.payload?.pinnedWeekly ?? [],
            pinnedMonthly: row.payload?.pinnedMonthly ?? [],
            hasOnboarded:  row.payload?.hasOnboarded ?? false,
          })
        }
        set({ syncStatus: 'idle', lastSyncedAt: new Date().toISOString() })
      },
    }),
    {
      name: 'cdata-user-routine',
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void useUserRoutineStore.getState().flush()
  })
}
