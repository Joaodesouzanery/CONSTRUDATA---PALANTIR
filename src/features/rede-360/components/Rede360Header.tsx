/**
 * Rede360Header — Tab navigation bar for Rede 360 module.
 */
import { useRede360Store } from '@/store/rede360Store'
import type { Rede360Tab } from '@/types'
import { Plus } from 'lucide-react'

const TABS: { id: Rede360Tab; label: string }[] = [
  { id: 'mapa',   label: 'Mapa Operacional'   },
  { id: 'ativos', label: 'Ativos'              },
  { id: 'ordens', label: 'Ordens de Serviço'  },
  { id: 'risco',  label: 'Análise de Risco'   },
]

export function Rede360Header() {
  const { activeTab, setActiveTab } = useRede360Store((s) => ({
    activeTab: s.activeTab,
    setActiveTab: s.setActiveTab,
  }))

  return (
    <div className="bg-[#112645] border-b border-[#20406a] shrink-0 flex items-center justify-between px-4">
      {/* Tabs */}
      <div className="flex items-center">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={[
              'h-12 px-4 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-[#2abfdc] text-[#f5f5f5]'
                : 'text-[#6b6b6b] hover:text-[#8fb3c8]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <button
        onClick={() => setActiveTab('ordens')}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2abfdc] hover:bg-[#1a9ab8] text-white text-xs font-semibold transition-colors"
      >
        <Plus size={14} />
        Nova OS
      </button>
    </div>
  )
}
