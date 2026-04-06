/**
 * MinhaRotinaPage — Página inicial personalizada por usuário/persona.
 *
 * Mostra os módulos fixados em 3 frequências (HOJE / SEMANA / MÊS),
 * com fluxograma visual entre elas, e um picker para adicionar/remover
 * módulos. Persona presets disponíveis para começar rápido.
 */
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sun, Calendar as CalendarIcon, CalendarDays, Plus, X, Settings, ChevronRight,
  ArrowDown,
} from 'lucide-react'
import {
  useUserRoutineStore, PERSONA_PRESETS, type RoutineFrequency,
} from '@/store/userRoutineStore'
import { MODULE_REGISTRY, findModule } from './moduleRegistry'

const FREQ_META: Record<RoutineFrequency, { label: string; icon: React.ReactNode; color: string }> = {
  daily: {
    label: 'HOJE',
    icon: <Sun size={16} />,
    color: '#f97316',
  },
  weekly: {
    label: 'ESTA SEMANA',
    icon: <CalendarIcon size={16} />,
    color: '#0ea5e9',
  },
  monthly: {
    label: 'ESTE MÊS',
    icon: <CalendarDays size={16} />,
    color: '#a855f7',
  },
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function fmtToday(): string {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// ─── Module Card ──────────────────────────────────────────────────────────────

interface ModuleCardProps {
  path:        string
  frequency:   RoutineFrequency
  onUnpin:     (path: string) => void
}

function ModuleCard({ path, frequency, onUnpin }: ModuleCardProps) {
  const navigate = useNavigate()
  const mod = findModule(path)
  if (!mod) return null

  const Icon = mod.icon
  const accent = FREQ_META[frequency].color

  return (
    <div className="group relative bg-[#2c2c2c] border border-[#525252] rounded-xl p-4 hover:border-[#f97316]/50 transition-colors">
      {/* Unpin button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onUnpin(path) }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded text-[#a3a3a3] hover:bg-red-900/30 hover:text-red-300 transition-all"
        title="Desafixar"
      >
        <X size={14} />
      </button>

      <button
        type="button"
        onClick={() => navigate(mod.path)}
        className="w-full text-left"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
          style={{ backgroundColor: `${accent}1a`, color: accent }}
        >
          <Icon size={20} />
        </div>
        <div className="text-white font-semibold text-sm mb-1">{mod.label}</div>
        <div className="text-[#a3a3a3] text-xs leading-snug line-clamp-2">{mod.description}</div>
        <div className="mt-3 flex items-center gap-1 text-[#f97316] text-xs font-medium">
          Abrir <ChevronRight size={12} />
        </div>
      </button>
    </div>
  )
}

// ─── Add-module picker (modal) ────────────────────────────────────────────────

interface PickerProps {
  open:       boolean
  frequency:  RoutineFrequency
  onClose:    () => void
}

function ModulePicker({ open, frequency, onClose }: PickerProps) {
  const togglePin = useUserRoutineStore((s) => s.togglePin)
  const isPinned  = useUserRoutineStore((s) => s.isPinned)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return MODULE_REGISTRY
    return MODULE_REGISTRY.filter(
      (m) => m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q),
    )
  }, [search])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#525252] flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-base">
              Adicionar a "{FREQ_META[frequency].label}"
            </h3>
            <p className="text-[#a3a3a3] text-xs mt-0.5">
              Clique em um módulo para fixá-lo na sua rotina
            </p>
          </div>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-[#525252]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar módulo…"
            className="w-full bg-[#1f1f1f] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]"
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto px-5 py-4 space-y-2">
          {filtered.map((m) => {
            const pinned = isPinned(m.path)
            const Icon = m.icon
            return (
              <button
                key={m.path}
                type="button"
                onClick={() => { togglePin(m.path, frequency); onClose() }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-[#3a3a3a] hover:border-[#f97316]/50 hover:bg-[#3a3a3a]/40 transition-colors text-left"
              >
                <div className="w-9 h-9 bg-[#3a3a3a] rounded-lg flex items-center justify-center text-[#f97316] shrink-0">
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-semibold">{m.label}</div>
                  <div className="text-[#a3a3a3] text-xs truncate">{m.description}</div>
                </div>
                {pinned && (
                  <span className="text-[10px] uppercase font-bold text-[#f97316] bg-[#f97316]/10 px-2 py-0.5 rounded">
                    {FREQ_META[pinned].label}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Frequency Section ────────────────────────────────────────────────────────

interface SectionProps {
  frequency: RoutineFrequency
  pinned:    string[]
  onUnpin:   (path: string) => void
  onAdd:     () => void
}

function FrequencySection({ frequency, pinned, onUnpin, onAdd }: SectionProps) {
  const meta = FREQ_META[frequency]
  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
        >
          {meta.icon}
        </div>
        <h2 className="text-white font-bold text-sm tracking-wider uppercase">
          {meta.label}
        </h2>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${meta.color}40, transparent)` }} />
        <span className="text-[#a3a3a3] text-xs">
          {pinned.length} {pinned.length === 1 ? 'módulo' : 'módulos'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {pinned.map((path) => (
          <ModuleCard key={path} path={path} frequency={frequency} onUnpin={onUnpin} />
        ))}

        {/* Add card */}
        <button
          type="button"
          onClick={onAdd}
          className="border-2 border-dashed border-[#525252] hover:border-[#f97316] rounded-xl p-4 flex flex-col items-center justify-center text-[#a3a3a3] hover:text-[#f97316] transition-colors min-h-[140px] gap-2"
        >
          <Plus size={20} />
          <span className="text-xs font-medium">Adicionar</span>
        </button>
      </div>
    </section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MinhaRotinaPage() {
  const persona       = useUserRoutineStore((s) => s.persona)
  const pinnedDaily   = useUserRoutineStore((s) => s.pinnedDaily)
  const pinnedWeekly  = useUserRoutineStore((s) => s.pinnedWeekly)
  const pinnedMonthly = useUserRoutineStore((s) => s.pinnedMonthly)
  const setPersona    = useUserRoutineStore((s) => s.setPersona)
  const togglePin     = useUserRoutineStore((s) => s.togglePin)

  const [pickerFreq, setPickerFreq] = useState<RoutineFrequency | null>(null)
  const [showPersonaMenu, setShowPersonaMenu] = useState(false)

  const currentPreset = PERSONA_PRESETS.find((p) => p.id === persona)
  const personaLabel = persona === 'custom' ? 'Personalizada' : currentPreset?.label ?? 'Engenheiro'
  const personaEmoji = persona === 'custom' ? '⚙️' : currentPreset?.emoji ?? '👷'

  function unpin(path: string) {
    const freq = useUserRoutineStore.getState().isPinned(path)
    if (freq) togglePin(path, freq)
  }

  return (
    <div className="flex flex-col h-full bg-[#1f1f1f]">
      {/* Header */}
      <div className="bg-[#2c2c2c] border-b border-[#525252] px-6 py-5 print:hidden">
        <div className="max-w-6xl mx-auto flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{personaEmoji}</span>
              <h1 className="text-white text-xl font-bold">
                {greeting()}, {personaLabel}
              </h1>
            </div>
            <p className="text-[#a3a3a3] text-sm capitalize">{fmtToday()}</p>
          </div>

          {/* Persona selector */}
          <div className="relative">
            <button
              onClick={() => setShowPersonaMenu((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 bg-[#3a3a3a] hover:bg-[#484848] border border-[#525252] rounded-lg text-sm text-[#f5f5f5] transition-colors"
            >
              <Settings size={14} />
              Trocar persona
            </button>
            {showPersonaMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPersonaMenu(false)} />
                <div className="absolute right-0 mt-2 w-72 bg-[#2c2c2c] border border-[#525252] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-2 border-b border-[#525252] text-[10px] font-bold uppercase tracking-widest text-[#a3a3a3]">
                    Escolha sua persona
                  </div>
                  {PERSONA_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPersona(p.id); setShowPersonaMenu(false) }}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[#3a3a3a] transition-colors ${
                        persona === p.id ? 'bg-[#f97316]/10' : ''
                      }`}
                    >
                      <span className="text-xl">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${persona === p.id ? 'text-[#f97316]' : 'text-white'}`}>
                          {p.label}
                        </div>
                        <div className="text-[#a3a3a3] text-xs">{p.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

          {/* Intro card */}
          <div className="bg-gradient-to-r from-[#f97316]/15 via-[#f97316]/5 to-transparent border border-[#f97316]/30 rounded-xl p-5">
            <h2 className="text-white text-base font-bold mb-1">Sua rotina, sua tela inicial</h2>
            <p className="text-[#e5e5e5] text-sm leading-relaxed">
              Fixe os módulos que você mais usa. A plataforma tem 19 módulos —
              mas você só precisa de 4 ou 5 no dia a dia. <strong className="text-[#f97316]">Personalize.</strong>
            </p>
          </div>

          {/* Daily */}
          <FrequencySection
            frequency="daily"
            pinned={pinnedDaily}
            onUnpin={unpin}
            onAdd={() => setPickerFreq('daily')}
          />

          {/* Flow arrow */}
          <div className="flex justify-center">
            <ArrowDown size={20} className="text-[#525252]" />
          </div>

          {/* Weekly */}
          <FrequencySection
            frequency="weekly"
            pinned={pinnedWeekly}
            onUnpin={unpin}
            onAdd={() => setPickerFreq('weekly')}
          />

          {/* Flow arrow */}
          <div className="flex justify-center">
            <ArrowDown size={20} className="text-[#525252]" />
          </div>

          {/* Monthly */}
          <FrequencySection
            frequency="monthly"
            pinned={pinnedMonthly}
            onUnpin={unpin}
            onAdd={() => setPickerFreq('monthly')}
          />

          {/* Footer note */}
          <div className="text-center text-[#6b6b6b] text-xs pt-4 pb-8">
            Suas preferências ficam salvas automaticamente neste navegador.
          </div>
        </div>
      </div>

      {/* Picker modal */}
      <ModulePicker
        open={pickerFreq !== null}
        frequency={pickerFreq ?? 'daily'}
        onClose={() => setPickerFreq(null)}
      />
    </div>
  )
}
