/**
 * userRoutineStore.ts
 *
 * Persiste a rotina personalizada do usuário: persona, módulos fixados
 * por frequência (diário/semanal/mensal) e flag de onboarding.
 *
 * Persistência: localStorage via zustand persist.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

/**
 * Presets de persona — cada preset define os módulos que mais
 * fazem sentido para aquele cargo, em cada frequência de uso.
 */
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

  setPersona:     (p: Persona) => void
  togglePin:      (path: string, frequency: RoutineFrequency) => void
  isPinned:       (path: string) => RoutineFrequency | null
  resetToPreset:  (persona: Persona) => void
  markOnboarded:  () => void
}

function getPreset(persona: Persona): PersonaPreset | undefined {
  return PERSONA_PRESETS.find((p) => p.id === persona)
}

export const useUserRoutineStore = create<UserRoutineState>()(
  persist(
    (set, get) => ({
      persona:       'engenheiro',
      pinnedDaily:   PERSONA_PRESETS[0].daily,
      pinnedWeekly:  PERSONA_PRESETS[0].weekly,
      pinnedMonthly: PERSONA_PRESETS[0].monthly,
      hasOnboarded:  false,

      setPersona: (persona) =>
        set(() => {
          const preset = getPreset(persona)
          if (!preset || persona === 'custom') return { persona }
          return {
            persona,
            pinnedDaily:   preset.daily,
            pinnedWeekly:  preset.weekly,
            pinnedMonthly: preset.monthly,
          }
        }),

      togglePin: (path, frequency) =>
        set((s) => {
          // Remove de qualquer frequência primeiro
          const cleanDaily   = s.pinnedDaily.filter((p) => p !== path)
          const cleanWeekly  = s.pinnedWeekly.filter((p) => p !== path)
          const cleanMonthly = s.pinnedMonthly.filter((p) => p !== path)

          // Verifica se já estava na frequência alvo (toggle off)
          const wasInTarget =
            (frequency === 'daily'   && s.pinnedDaily.includes(path))   ||
            (frequency === 'weekly'  && s.pinnedWeekly.includes(path))  ||
            (frequency === 'monthly' && s.pinnedMonthly.includes(path))

          if (wasInTarget) {
            // Apenas remove
            return {
              persona:       'custom',
              pinnedDaily:   cleanDaily,
              pinnedWeekly:  cleanWeekly,
              pinnedMonthly: cleanMonthly,
            }
          }

          // Adiciona na frequência alvo (e remove das outras)
          return {
            persona:       'custom',
            pinnedDaily:   frequency === 'daily'   ? [...cleanDaily, path]   : cleanDaily,
            pinnedWeekly:  frequency === 'weekly'  ? [...cleanWeekly, path]  : cleanWeekly,
            pinnedMonthly: frequency === 'monthly' ? [...cleanMonthly, path] : cleanMonthly,
          }
        }),

      isPinned: (path) => {
        const s = get()
        if (s.pinnedDaily.includes(path))   return 'daily'
        if (s.pinnedWeekly.includes(path))  return 'weekly'
        if (s.pinnedMonthly.includes(path)) return 'monthly'
        return null
      },

      resetToPreset: (persona) =>
        set(() => {
          const preset = getPreset(persona)
          if (!preset) return {}
          return {
            persona,
            pinnedDaily:   preset.daily,
            pinnedWeekly:  preset.weekly,
            pinnedMonthly: preset.monthly,
          }
        }),

      markOnboarded: () => set({ hasOnboarded: true }),
    }),
    {
      name: 'cdata-user-routine',
    },
  ),
)
