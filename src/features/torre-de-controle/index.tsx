import { useSearchParams } from 'react-router-dom'
import { FolderKanban, ListChecks, Map, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ControlMap } from '@/components/shared/ControlMap'
import { ProjetosPage } from '@/features/projetos'
import { useProjetosStore } from '@/store/projetosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { ObrasListPanel }  from './components/ObrasListPanel'
import { ObraDetailPanel }  from './components/ObraDetailPanel'
import { ObraDialog }       from './components/ObraDialog'
import { RiskDialog }       from './components/RiskDialog'

type TorreTab = 'mapa' | 'projetos' | 'detalhes'

const TORRE_TABS: { key: TorreTab; label: string; icon: LucideIcon }[] = [
  { key: 'mapa',     label: 'Mapa Geral',       icon: Map },
  { key: 'projetos', label: 'Projetos',         icon: FolderKanban },
  { key: 'detalhes', label: 'Detalhes da Obra', icon: ListChecks },
]

function parseTorreTab(value: string | null): TorreTab | null {
  return value === 'mapa' || value === 'projetos' || value === 'detalhes' ? value : null
}

export function TorreDeControlePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const projects = useProjetosStore((s) => s.projects)
  const sites = useTorreStore((s) => s.sites)
  const selectedId = useTorreStore((s) => s.selectedId)
  const selectSite = useTorreStore((s) => s.selectSite)
  const setEditing = useTorreStore((s) => s.setEditing)
  const activeTab = parseTorreTab(searchParams.get('aba')) ?? 'mapa'

  function handleTabChange(tab: TorreTab) {
    setSearchParams(tab === 'mapa' ? {} : { aba: tab })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#2c2c2c]">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#525252] bg-[#2c2c2c] px-2 py-2">
        {TORRE_TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                'flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                activeTab === tab.key
                  ? 'bg-[#f97316]/10 text-[#f97316]'
                  : 'text-[#a3a3a3] hover:bg-[#333333] hover:text-[#f5f5f5]'
              )}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'mapa' && (
          <div className="flex h-full flex-col overflow-hidden">
            <div className="h-[160px] shrink-0 lg:h-[180px]">
              <ObrasListPanel orientation="horizontal" />
            </div>
            <div className="relative min-h-[300px] flex-1 border-t border-[#525252]">
              <ControlMap
                projects={projects}
                sites={sites}
                selectedSiteId={selectedId}
                onSiteSelect={selectSite}
                onEditSite={setEditing}
              />
            </div>
          </div>
        )}

        {activeTab === 'projetos' && (
          <div className="flex h-full flex-col overflow-hidden">
            <ProjetosPage />
          </div>
        )}

        {activeTab === 'detalhes' && (
          <div className="flex h-full flex-col overflow-y-auto">
            <ObraDetailPanel />
          </div>
        )}
      </div>

      <ObraDialog />
      <RiskDialog />
    </div>
  )
}
