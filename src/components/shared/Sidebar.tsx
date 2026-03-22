import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  Users,
  Wrench,
  Package,
  FileText,
  Settings,
  HardHat,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Relatório 360', icon: ClipboardList, to: '/relatorio360' },
  { label: 'Relatórios', icon: FileText, to: '/relatorios' },
  { label: 'Analytics', icon: BarChart3, to: '/analytics' },
  { label: 'Equipes', icon: Users, to: '/equipes' },
  { label: 'Equipamentos', icon: Wrench, to: '/equipamentos' },
  { label: 'Materiais', icon: Package, to: '/materiais' },
]

const bottomItems = [
  { label: 'Configurações', icon: Settings, to: '/configuracoes' },
]

export function Sidebar() {
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
            end={item.to === '/'}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'flex items-center justify-center w-12 h-12 rounded-lg transition-colors group relative',
                isActive
                  ? 'bg-[#f97316]/15 text-[#f97316]'
                  : 'text-[#6b6b6b] hover:bg-[#252525] hover:text-[#f5f5f5]'
              )
            }
          >
            <item.icon size={20} />
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col gap-1 p-2 pb-3 border-t border-[#2a2a2a]">
        {bottomItems.map((item) => (
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
      </div>
    </aside>
  )
}
