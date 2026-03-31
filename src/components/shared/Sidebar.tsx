import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ClipboardList, Calendar, FolderKanban, Radio,
  Sun, Moon, Wrench, FileSearch, PackageSearch, Users, FlaskConical,
  FileText, Calculator, Layers, Map, X, Network, BrainCircuit, HardHat,
  LayoutDashboard, CalendarClock, Target,
  ChevronRight, ChevronLeft, Cpu,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { useAppModeStore } from '@/store/appModeStore'
import { useAlertCounts } from '@/hooks/useAlertCounts'

const PANEL_KEY = 'cdata-sidebar-panel'

// ─── Nav groups ───────────────────────────────────────────────────────────────

interface NavItem {
  label: string
  icon: React.ElementType
  to: string
}

interface NavGroup {
  id: string
  label: string
  icon: React.ElementType
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'controle',
    label: 'Controle',
    icon: LayoutDashboard,
    items: [
      { label: 'Gestão 360',      icon: LayoutDashboard, to: '/app/gestao-360'        },
      { label: 'Relatório 360',   icon: ClipboardList,   to: '/app/relatorio360'      },
      { label: 'Torre de Controle', icon: Radio,         to: '/app/torre-de-controle' },
      { label: 'Agenda',          icon: Calendar,        to: '/app/agenda'            },
    ],
  },
  {
    id: 'planejamento',
    label: 'Planejamento',
    icon: BrainCircuit,
    items: [
      { label: 'Plan. Mestre',    icon: BrainCircuit,    to: '/app/planejamento-mestre' },
      { label: 'Plan. Trechos',   icon: CalendarClock,   to: '/app/planejamento'        },
      { label: 'LPS/Lean',        icon: Target,          to: '/app/lps-lean'            },
      { label: 'Operação Campo',  icon: HardHat,         to: '/app/operacao-campo'      },
    ],
  },
  {
    id: 'campo',
    label: 'Campo',
    icon: HardHat,
    items: [
      { label: 'RDO',             icon: FileText,        to: '/app/rdo'                 },
      { label: 'Gest. Equip.',    icon: Wrench,          to: '/app/gestao-equipamentos' },
      { label: 'Frota',           icon: Cpu,             to: '/app/otimizacao-frota'    },
      { label: 'Mapa Interativo', icon: Map,             to: '/app/mapa-interativo'     },
    ],
  },
  {
    id: 'comercial',
    label: 'Comercial',
    icon: PackageSearch,
    items: [
      { label: 'Suprimentos',     icon: PackageSearch,   to: '/app/suprimentos'         },
      { label: 'Mão de Obra',     icon: Users,           to: '/app/mao-de-obra'         },
      { label: 'Pré-Constr.',     icon: FileSearch,      to: '/app/pre-construcao'      },
      { label: 'Projetos',        icon: FolderKanban,    to: '/app/projetos'            },
    ],
  },
  {
    id: 'analise',
    label: 'Análise',
    icon: Layers,
    items: [
      { label: 'Quantitativos',   icon: Calculator,      to: '/app/quantitativos'       },
      { label: 'BIM 3D/4D/5D',   icon: Layers,          to: '/app/bim'                 },
      { label: 'Rede 360',        icon: Network,         to: '/app/rede-360'            },
    ],
  },
]

// Utility: given a path, find which group it belongs to
function groupForPath(pathname: string): string | null {
  for (const g of NAV_GROUPS) {
    if (g.items.some((item) => pathname.startsWith(item.to))) return g.id
  }
  return null
}

// ─── Atlântico water-drop logo ───────────────────────────────────────────────
function WaterDropLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 36 44"
      fill="none"
      stroke="#2abfdc"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={Math.round(size * 44 / 36)}
    >
      <path d="M18 2 C18 2 33 17 33 28 C33 37.2 26.3 43 18 43 C9.7 43 3 37.2 3 28 C3 17 18 2 18 2Z" />
      <path d="M18 12 C18 12 27 23 27 29.5 C27 35.5 23 39.5 18 39.5 C13 39.5 9 35.5 9 29.5 C9 23 18 12 18 12Z" />
    </svg>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  onClose?: () => void
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar({ onClose }: SidebarProps) {
  const { theme, toggleTheme } = useThemeStore(
    useShallow((s) => ({ theme: s.theme, toggleTheme: s.toggleTheme }))
  )
  const { isDemoMode, toggleDemoMode } = useAppModeStore(
    useShallow((s) => ({ isDemoMode: s.isDemoMode, toggleDemoMode: s.toggleDemoMode }))
  )
  const alertCounts = useAlertCounts()
  const location    = useLocation()

  // Active group: prefer user-selected; fall back to group matching current URL
  const [activeGroup, setActiveGroup] = useState<string>(
    () => groupForPath(location.pathname) ?? NAV_GROUPS[0].id
  )

  // Panel open/close (persisted)
  const [isPanelOpen, setIsPanelOpen] = useState(() => {
    try { return localStorage.getItem(PANEL_KEY) !== 'false' } catch { return true }
  })

  function togglePanel() {
    setIsPanelOpen((prev) => {
      const next = !prev
      try { localStorage.setItem(PANEL_KEY, String(next)) } catch { /* noop */ }
      return next
    })
  }

  function handleGroupClick(id: string) {
    if (activeGroup === id && isPanelOpen) {
      togglePanel()
    } else {
      setActiveGroup(id)
      if (!isPanelOpen) {
        setIsPanelOpen(true)
        try { localStorage.setItem(PANEL_KEY, 'true') } catch { /* noop */ }
      }
    }
  }

  const currentGroup = NAV_GROUPS.find((g) => g.id === activeGroup) ?? NAV_GROUPS[0]

  // Total alerts for a group
  function groupAlerts(g: NavGroup) {
    return g.items.reduce((sum, item) => sum + (alertCounts[item.to] ?? 0), 0)
  }

  return (
    <aside className="relative flex h-full shrink-0">
      {/* ── Left Icon Rail (always 48px) ── */}
      <div className="w-12 flex flex-col items-center bg-[#0d2040] border-r border-[#20406a] shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center w-12 h-14 border-b border-[#20406a]">
          <WaterDropLogo size={20} />
        </div>

        {/* Group nav buttons */}
        <nav className="flex flex-col items-center gap-1 p-1.5 pt-2 flex-1">
          {NAV_GROUPS.map((g) => {
            const Icon      = g.icon
            const isActive  = activeGroup === g.id && isPanelOpen
            const alerts    = groupAlerts(g)
            const urlMatch  = g.items.some((item) => location.pathname.startsWith(item.to))

            return (
              <button
                key={g.id}
                onClick={() => handleGroupClick(g.id)}
                title={g.label}
                className={cn(
                  'relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
                  isActive
                    ? 'bg-[#2abfdc]/20 text-[#2abfdc]'
                    : urlMatch
                    ? 'bg-[#14294e] text-[#8fb3c8]'
                    : 'text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8]',
                )}
              >
                <Icon size={18} />
                {alerts > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-[#ef4444] text-white text-[8px] font-bold leading-none">
                    {alerts > 9 ? '9+' : alerts}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Bottom: demo + theme */}
        <div className="flex flex-col items-center gap-1 p-1.5 pb-3 border-t border-[#20406a] w-full">
          <button
            onClick={toggleDemoMode}
            title={isDemoMode ? 'Desativar Modo Demo' : 'Ativar Modo Demo'}
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-lg transition-colors',
              isDemoMode ? 'bg-[#2abfdc]/20 text-[#2abfdc]' : 'text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8]',
            )}
          >
            <FlaskConical size={16} />
          </button>

          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8] transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Mobile close */}
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#e4f2f8] transition-colors md:hidden"
              aria-label="Fechar menu"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Right Detail Panel (collapsible 180px) ── */}
      <div
        className={cn(
          'flex flex-col bg-[#0d2040] border-r border-[#20406a] h-full transition-[width] duration-200 ease-in-out overflow-hidden shrink-0',
          isPanelOpen ? 'w-[180px]' : 'w-0',
        )}
      >
        {/* Panel header: group label + collapse button */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-[#20406a] shrink-0">
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-xs font-bold text-[#e4f2f8] tracking-wide truncate">
              {currentGroup.label}
            </span>
            <span className="text-[9px] font-medium tracking-widest uppercase text-[#2abfdc] opacity-80 mt-0.5">
              Atlântico
            </span>
          </div>
          <button
            onClick={togglePanel}
            title="Recolher painel"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8] transition-colors shrink-0 ml-1"
          >
            <ChevronLeft size={14} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col flex-1 gap-0.5 p-2 overflow-y-auto overflow-x-hidden">
          {currentGroup.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 h-9 px-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-[#2abfdc]/12 text-[#2abfdc]'
                    : 'text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8]',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative shrink-0">
                    <item.icon size={16} />
                    {(alertCounts[item.to] ?? 0) > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#ef4444] text-white text-[8px] font-bold leading-none">
                        {alertCounts[item.to] > 9 ? '9+' : alertCounts[item.to]}
                      </span>
                    )}
                  </span>
                  <span className={cn('text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis', isActive && 'text-[#2abfdc]')}>
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}

          {/* Group section dividers for other groups */}
          <div className="mt-3 pt-2 border-t border-[#20406a]">
            {NAV_GROUPS.filter((g) => g.id !== currentGroup.id).map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[#3f3f3f] hover:text-[#6b6b6b] hover:bg-[#14294e] transition-colors"
              >
                <g.icon size={13} />
                <span className="text-[10px] font-medium truncate">{g.label}</span>
                <ChevronRight size={10} className="ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </nav>

        {/* Expand button when collapsed — shown as a narrow strip */}
      </div>

      {/* ── Expand button (when panel is closed) ── */}
      {!isPanelOpen && (
        <button
          onClick={togglePanel}
          title="Expandir painel"
          className="absolute left-12 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-4 h-8 bg-[#0d2040] border border-[#20406a] border-l-0 rounded-r-md text-[#6b6b6b] hover:text-[#8fb3c8] hover:bg-[#14294e] transition-colors"
        >
          <ChevronRight size={11} />
        </button>
      )}
    </aside>
  )
}
