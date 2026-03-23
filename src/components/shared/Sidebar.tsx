import { NavLink } from 'react-router-dom'
import { ClipboardList, Calendar, Truck, HardHat, FolderKanban, Radio, Sun, Moon, Wrench, FileSearch, PackageSearch, Users, FlaskConical } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { useAppModeStore } from '@/store/appModeStore'

const navItems = [
  { label: 'Relatório 360',           icon: ClipboardList, to: '/relatorio360'          },
  { label: 'Agenda',                  icon: Calendar,      to: '/agenda'                },
  { label: 'Perfil dos Equipamentos', icon: Truck,         to: '/equipamentos'          },
  { label: 'Gestão de Equipamentos',  icon: Wrench,        to: '/gestao-equipamentos'   },
  { label: 'Projetos',                icon: FolderKanban,  to: '/projetos'              },
  { label: 'Torre de Controle',       icon: Radio,         to: '/torre-de-controle'     },
  { label: 'Pré-Construção',          icon: FileSearch,    to: '/pre-construcao'        },
  { label: 'Suprimentos',             icon: PackageSearch, to: '/suprimentos'           },
  { label: 'Mão de Obra',             icon: Users,         to: '/mao-de-obra'           },
]

export function Sidebar() {
  const { theme, toggleTheme } = useThemeStore(
    useShallow((s) => ({ theme: s.theme, toggleTheme: s.toggleTheme }))
  )
  const { isDemoMode, toggleDemoMode } = useAppModeStore(
    useShallow((s) => ({ isDemoMode: s.isDemoMode, toggleDemoMode: s.toggleDemoMode }))
  )

  return (
    <aside className="flex flex-col w-16 shrink-0 border-r border-[#2a2a2a] bg-[#1a1a1a] h-full">
      {/* Logo */}
      <div className="flex items-center justify-center h-14 border-b border-[#2a2a2a]">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]">
          <HardHat size={18} className="text-white" />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col flex-1 gap-1 p-2 pt-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center w-12 h-12 rounded-lg transition-colors',
                isActive
                  ? 'bg-[#f97316]/15 text-[#f97316]'
                  : 'text-[#6b6b6b] hover:bg-[#252525] hover:text-[#f5f5f5]'
              )
            }
          >
            <item.icon size={20} />
          </NavLink>
        ))}

        {/* Bottom controls */}
        <div className="mt-auto flex flex-col gap-1">
          {/* Demo mode toggle */}
          <button
            onClick={toggleDemoMode}
            title={isDemoMode ? 'Desativar Modo Demo' : 'Ativar Modo Demo'}
            className={cn(
              'flex items-center justify-center w-12 h-12 rounded-lg transition-colors',
              isDemoMode
                ? 'bg-[#f97316]/15 text-[#f97316]'
                : 'text-[#6b6b6b] hover:bg-[#252525] hover:text-[#f5f5f5]',
            )}
          >
            <FlaskConical size={18} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            className="flex items-center justify-center w-12 h-12 rounded-lg text-[#6b6b6b] hover:bg-[#252525] hover:text-[#f5f5f5] transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>
    </aside>
  )
}
