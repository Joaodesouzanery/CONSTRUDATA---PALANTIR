import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  ClipboardList, Calendar, FolderKanban, Radio,
  Sun, Moon, Wrench, FileSearch, PackageSearch, Users, FlaskConical,
  Cpu, ChevronRight, ChevronLeft, LayoutDashboard, CalendarClock, FileText,
  Calculator, Layers, Target, Map, X, Network, BrainCircuit, Sparkles,
  Ruler, Star, GripVertical,
} from 'lucide-react'
import {
  DndContext, closestCenter, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/themeStore'
import { useAppModeStore } from '@/store/appModeStore'
import { useAlertCounts } from '@/hooks/useAlertCounts'
import { useSidebarStore } from '@/store/sidebarStore'

const SIDEBAR_KEY = 'cdata-sidebar'

// ─── Nav groups ───────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: 'GESTÃO',
    items: [
      { label: 'Gestão 360',      icon: LayoutDashboard,  to: '/app/gestao-360'          },
      { label: 'Relatório 360',   icon: ClipboardList,    to: '/app/relatorio360'        },
      { label: 'Torre Control',   icon: Radio,            to: '/app/torre-de-controle'   },
    ],
  },
  {
    label: 'PLANEJAMENTO',
    items: [
      { label: 'Plan. Mestre',    icon: BrainCircuit,     to: '/app/planejamento-mestre' },
      { label: 'Plan. Trechos',   icon: CalendarClock,    to: '/app/planejamento'        },
      { label: 'Agenda',          icon: Calendar,         to: '/app/agenda'              },
      { label: 'LPS/Lean',        icon: Target,           to: '/app/lps-lean'            },
    ],
  },
  {
    label: 'CAMPO',
    items: [
      { label: 'RDO',             icon: FileText,         to: '/app/rdo'                 },
      { label: 'Mão de Obra',     icon: Users,            to: '/app/mao-de-obra'         },
      { label: 'Gest. Equip.',    icon: Wrench,           to: '/app/gestao-equipamentos' },
      { label: 'Frota',           icon: Cpu,              to: '/app/otimizacao-frota'    },
    ],
  },
  {
    label: 'PROJETOS',
    items: [
      { label: 'Projetos',        icon: FolderKanban,     to: '/app/projetos'            },
      { label: 'BIM 3D/4D/5D',   icon: Layers,           to: '/app/bim'                 },
      { label: 'Pré-Constr.',     icon: FileSearch,       to: '/app/pre-construcao'      },
      { label: 'Mapa Interativo', icon: Map,              to: '/app/mapa-interativo'     },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { label: 'Quantitativos',   icon: Calculator,       to: '/app/quantitativos'       },
      { label: 'Medição',         icon: Ruler,            to: '/app/medicao'             },
      { label: 'Suprimentos',     icon: PackageSearch,    to: '/app/suprimentos'         },
      { label: 'Rede 360',        icon: Network,          to: '/app/rede-360'            },
      { label: 'AIP',             icon: Sparkles,         to: '/app/aip'                 },
    ],
  },
]

// Flat lookup map
const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

// ─── Atlântico water-drop logo ────────────────────────────────────────────────
function WaterDropLogo({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 36 44"
      fill="none"
      stroke="#f97316"
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

// ─── Sortable favorite item ───────────────────────────────────────────────────

interface SortableItemProps {
  itemTo: string
  isOpen: boolean
  onClose?: () => void
  alertCounts: Record<string, number>
  toggleFavorite: (to: string) => void
}

function SortableFavoriteItem({ itemTo, isOpen, onClose, alertCounts, toggleFavorite }: SortableItemProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: itemTo })

  const item = ALL_NAV_ITEMS.find((i) => i.to === itemTo)
  if (!item) return null

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <NavLink
        to={item.to}
        title={isOpen ? undefined : item.label}
        onClick={onClose}
        className={({ isActive }) =>
          cn(
            'relative flex items-center gap-3 mx-2 rounded-lg transition-all',
            'h-9 px-3',
            isActive
              ? 'bg-[#f97316]/10 text-[#f97316]'
              : 'text-[#9a9a9a] hover:bg-[#333333] hover:text-[#d4d4d4]',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#f97316]" />
            )}
            {/* Drag handle — only when expanded */}
            {isOpen && (
              <span
                {...attributes}
                {...listeners}
                className="absolute left-1 top-1/2 -translate-y-1/2 text-[#3d3d3d] hover:text-[#6b6b6b] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.preventDefault()}
              >
                <GripVertical size={12} />
              </span>
            )}
            <span className="relative shrink-0">
              <item.icon size={18} strokeWidth={isActive ? 2 : 1.5} />
              {(alertCounts[item.to] ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#ef4444] text-white text-[9px] font-bold leading-none">
                  {alertCounts[item.to] > 9 ? '9+' : alertCounts[item.to]}
                </span>
              )}
            </span>
            {isOpen && (
              <span className={cn(
                'flex-1 text-xs whitespace-nowrap overflow-hidden text-ellipsis',
                isActive ? 'font-semibold' : 'font-normal',
              )}>
                {item.label}
              </span>
            )}
            {/* Star (filled, orange) — click to unfavorite */}
            {isOpen && (
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.to) }}
                className="shrink-0 text-[#f97316] hover:text-red-400 transition-colors"
                title="Remover dos favoritos"
              >
                <Star size={12} fill="currentColor" />
              </button>
            )}
          </>
        )}
      </NavLink>
    </div>
  )
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const { theme, toggleTheme } = useThemeStore(
    useShallow((s) => ({ theme: s.theme, toggleTheme: s.toggleTheme }))
  )
  const { isDemoMode, toggleDemoMode } = useAppModeStore(
    useShallow((s) => ({ isDemoMode: s.isDemoMode, toggleDemoMode: s.toggleDemoMode }))
  )
  const { favorites, toggleFavorite, reorderFavorites } = useSidebarStore()

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIdx = favorites.indexOf(String(active.id))
      const newIdx = favorites.indexOf(String(over.id))
      reorderFavorites(arrayMove(favorites, oldIdx, newIdx))
    }
  }

  // Only keep favorites that still exist in nav
  const validFavorites = favorites.filter((f) => ALL_NAV_ITEMS.some((i) => i.to === f))

  return (
    <aside
      className={cn(
        'flex flex-col shrink-0 border-r border-[#525252] bg-[#2c2c2c] h-full',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        isOpen ? 'w-[220px]' : 'w-16',
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 border-b border-[#525252] shrink-0 px-4 gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
          style={{
            background: 'radial-gradient(circle at 40% 35%, #333333 0%, #222222 100%)',
            boxShadow: '0 0 12px rgba(249,115,22,0.25), inset 0 1px 0 rgba(249,115,22,0.15)',
            border: '1px solid rgba(249,115,22,0.3)',
          }}
        >
          <WaterDropLogo size={20} />
        </div>
        {isOpen && (
          <div className="flex flex-col leading-none">
            <span
              className="text-sm font-bold whitespace-nowrap"
              style={{ color: '#f5f5f5', letterSpacing: '0.02em' }}
            >
              Atlântico
            </span>
            <span className="text-[8px] font-semibold tracking-[0.16em] uppercase" style={{ color: '#9a9a9a' }}>
              ConstruData
            </span>
          </div>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors md:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col flex-1 gap-0 py-2 overflow-y-auto overflow-x-hidden sidebar-scroll">

        {/* ── Favorites section ──────────────────────────────────────────────── */}
        {validFavorites.length > 0 && (
          <div className="flex flex-col mb-1">
            {isOpen ? (
              <span className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest uppercase select-none" style={{ color: '#f97316', opacity: 0.8 }}>
                Favoritos
              </span>
            ) : (
              <div className="mx-3 my-1.5 border-t border-[#f97316]/20" />
            )}
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={validFavorites} strategy={verticalListSortingStrategy}>
                {validFavorites.map((to) => (
                  <SortableFavoriteItem
                    key={to}
                    itemTo={to}
                    isOpen={isOpen}
                    onClose={onClose}
                    alertCounts={alertCounts}
                    toggleFavorite={toggleFavorite}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <div className="mx-3 mt-1 border-t border-[#525252]" />
          </div>
        )}

        {/* ── Main nav groups ────────────────────────────────────────────────── */}
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn('flex flex-col', gi > 0 && 'mt-1')}>
            {/* Group label — only shown when expanded */}
            {isOpen ? (
              <span className="px-4 pt-3 pb-1 text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] select-none">
                {group.label}
              </span>
            ) : (
              <div className="mx-3 my-1.5 border-t border-[#525252]" />
            )}

            {/* Nav items in this group */}
            {group.items.map((item) => {
              const isFav = favorites.includes(item.to)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={isOpen ? undefined : item.label}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-3 mx-2 rounded-lg transition-all group/item',
                      'h-9 px-3',
                      isActive
                        ? 'bg-[#f97316]/10 text-[#f97316]'
                        : 'text-[#9a9a9a] hover:bg-[#333333] hover:text-[#d4d4d4]',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Left orange bar indicator for active item */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#f97316]" />
                      )}

                      {/* Icon with alert badge */}
                      <span className="relative shrink-0">
                        <item.icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                        {(alertCounts[item.to] ?? 0) > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-[#ef4444] text-white text-[9px] font-bold leading-none">
                            {alertCounts[item.to] > 9 ? '9+' : alertCounts[item.to]}
                          </span>
                        )}
                      </span>

                      {/* Label */}
                      {isOpen && (
                        <span className={cn(
                          'flex-1 text-xs whitespace-nowrap overflow-hidden text-ellipsis',
                          isActive ? 'font-semibold' : 'font-normal',
                        )}>
                          {item.label}
                        </span>
                      )}

                      {/* Star button — visible on hover or if favorited */}
                      {isOpen && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(item.to) }}
                          className={cn(
                            'shrink-0 transition-colors',
                            isFav
                              ? 'text-[#f97316] opacity-100'
                              : 'text-[#525252] opacity-0 group-hover/item:opacity-100 hover:text-[#f97316]',
                          )}
                          title={isFav ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                        >
                          <Star size={12} fill={isFav ? 'currentColor' : 'none'} />
                        </button>
                      )}
                    </>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}

        {/* Bottom controls */}
        <div className="mt-auto flex flex-col gap-0.5 pt-2 mx-2 border-t border-[#525252]">
          <button
            onClick={toggleSidebar}
            title={isOpen ? 'Recolher menu' : 'Expandir menu'}
            className="flex items-center gap-3 h-9 px-3 rounded-lg text-[#9a9a9a] hover:bg-[#333333] hover:text-[#d4d4d4] transition-colors"
          >
            {isOpen ? <ChevronLeft size={18} className="shrink-0" /> : <ChevronRight size={18} className="shrink-0" />}
            {isOpen && <span className="text-xs font-normal whitespace-nowrap">Recolher</span>}
          </button>

          <button
            onClick={toggleDemoMode}
            title={isDemoMode ? 'Desativar Modo Demo' : 'Ativar Modo Demo'}
            className={cn(
              'relative flex items-center gap-3 h-9 px-3 rounded-lg transition-colors',
              isDemoMode
                ? 'bg-[#f97316]/10 text-[#f97316]'
                : 'text-[#9a9a9a] hover:bg-[#333333] hover:text-[#d4d4d4]',
            )}
          >
            {isDemoMode && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-[#f97316]" />
            )}
            <FlaskConical size={18} className="shrink-0" strokeWidth={isDemoMode ? 2 : 1.5} />
            {isOpen && <span className={cn('text-xs whitespace-nowrap', isDemoMode ? 'font-semibold' : 'font-normal')}>Demo</span>}
          </button>

          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            className="flex items-center gap-3 h-9 px-3 rounded-lg text-[#9a9a9a] hover:bg-[#333333] hover:text-[#d4d4d4] transition-colors"
          >
            {theme === 'dark' ? <Sun size={18} className="shrink-0" strokeWidth={1.5} /> : <Moon size={18} className="shrink-0" strokeWidth={1.5} />}
            {isOpen && <span className="text-xs font-normal whitespace-nowrap">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>}
          </button>
        </div>
      </nav>
    </aside>
  )
}
