import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ClipboardList, Calendar, Truck, HardHat, FolderKanban, Radio,
  Sun, Moon, Wrench, FileSearch, PackageSearch, Users, FlaskConical,
  Cpu, ChevronRight, ChevronLeft, LayoutDashboard, CalendarClock, FileText,
  Calculator, Layers,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { useAppModeStore } from '@/store/appModeStore'
import { useAlertCounts } from '@/hooks/useAlertCounts'

const SIDEBAR_KEY = 'cdata-sidebar'

const navItems = [
  { label: 'Relatório 360',   icon: ClipboardList,   to: '/relatorio360'        },
  { label: 'Agenda',          icon: Calendar,         to: '/agenda'              },
  { label: 'Equipamentos',    icon: Truck,            to: '/equipamentos'        },
  { label: 'Gest. Equip.',    icon: Wrench,           to: '/gestao-equipamentos' },
  { label: 'Projetos',        icon: FolderKanban,     to: '/projetos'            },
  { label: 'Torre Control',   icon: Radio,            to: '/torre-de-controle'   },
  { label: 'Pré-Constr.',     icon: FileSearch,       to: '/pre-construcao'      },
  { label: 'Suprimentos',     icon: PackageSearch,    to: '/suprimentos'         },
  { label: 'Mão de Obra',     icon: Users,            to: '/mao-de-obra'         },
  { label: 'Planejamento',    icon: CalendarClock,    to: '/planejamento'        },
  { label: 'RDO',             icon: FileText,         to: '/rdo'                 },
  { label: 'Quantitativos',   icon: Calculator,       to: '/quantitativos'       },
  { label: 'BIM 3D/4D/5D',   icon: Layers,           to: '/bim'                 },
  { label: 'Frota',           icon: Cpu,              to: '/otimizacao-frota'    },
  { label: 'Gestão 360',      icon: LayoutDashboard,  to: '/gestao-360'          },
]

export function Sidebar() {
  const { theme, toggleTheme } = useThemeStore(
    useShallow((s) => ({ theme: s.theme, toggleTheme: s.toggleTheme }))
  )
  const { isDemoMode, toggleDemoMode } = useAppModeStore(
    useShallow((s) => ({ isDemoMode: s.isDemoMode, toggleDemoMode: s.toggleDemoMode }))
  )

  const alertCounts = useAlertCounts()

  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) !== 'false' } catch { return true }
  })

  function toggleSidebar() {
    setIsOpen((prev) => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch { /* noop */ }
      return next
    })
  }

  return (
    <aside
      className={cn(
        'flex flex-col shrink-0 border-r border-[#2a2a2a] bg-[#1a1a1a] h-full',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        isOpen ? 'w-[200px]' : 'w-16',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 border-b border-[#2a2a2a] shrink-0 px-[14px] gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316] shrink-0">
          <HardHat size={18} className="text-white" />
        </div>
        {isOpen && (
          <span className="text-[#f5f5f5] text-sm font-bold whitespace-nowrap leading-tight">
            Atlântico
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col flex-1 gap-0.5 p-2 pt-3 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={isOpen ? undefined : item.label}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg transition-colors',
                'h-10 px-[10px]',
                isActive
                  ? 'bg-[#f97316]/15 text-[#f97316]'
                  : 'text-[#6b6b6b] hover:bg-[#252525] hover:text-[#f5f5f5]',
              )
            }
          >
            <span className="relative shrink-0">
              <item.icon size={20} />
              {(alertCounts[item.to] ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#ef4444] text-white text-[9px] font-bold leading-none">
                  {alertCounts[item.to] > 9 ? '9+' : alertCounts[item.to]}
                </span>
              )}
            </span>
            {isOpen && (
              <span className="text-xs font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                {item.label}
              </span>
            )}
          </NavLink>
        ))}

        {/* Bottom controls */}
        <div className="mt-auto flex flex-col gap-0.5 pt-2 border-t border-[#2a2a2a]">
          {/* Expand/collapse toggle */}
          <button
            onClick={toggleSidebar}
            title={isOpen ? 'Recolher menu' : 'Expandir menu'}
            className="flex items-center gap-3 h-10 px-[10px] rounded-lg text-[#6b6b6b] hover:bg-[#252525] hover:text-[#f5f5f5] transition-colors"
          >
            {isOpen ? <ChevronLeft size={20} className="shrink-0" /> : <ChevronRight size={20} className="shrink-0" />}
            {isOpen && <span className="text-xs font-medium whitespace-nowrap">Recolher</span>}
          </button>

          {/* Demo mode toggle */}
          <button
            onClick={toggleDemoMode}
            title={isDemoMode ? 'Desativar Modo Demo' : 'Ativar Modo Demo'}
            className={cn(
              'flex items-center gap-3 h-10 px-[10px] rounded-lg transition-colors',
              isDemoMode
                ? 'bg-[#f97316]/15 text-[#f97316]'
                : 'text-[#6b6b6b] hover:bg-[#252525] hover:text-[#f5f5f5]',
            )}
          >
            <FlaskConical size={18} className="shrink-0" />
            {isOpen && <span className="text-xs font-medium whitespace-nowrap">Demo</span>}
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            className="flex items-center gap-3 h-10 px-[10px] rounded-lg text-[#6b6b6b] hover:bg-[#252525] hover:text-[#f5f5f5] transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} className="shrink-0" /> : <Moon size={18} className="shrink-0" />}
            {isOpen && <span className="text-xs font-medium whitespace-nowrap">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>}
          </button>
        </div>
      </nav>
    </aside>
  )
}
