/**
 * MedicaoHeader — top bar for the Medição module.
 */
import { Ruler } from 'lucide-react'
import { useMedicaoStore } from '@/store/medicaoStore'
import type { MedicaoTab } from '@/types'

const TABS: { key: MedicaoTab; label: string }[] = [
  { key: 'servicos',    label: 'Serviços do Contrato' },
  { key: 'boletim',    label: 'Boletim de Medição'   },
  { key: 'comparativo', label: 'Comparativo'          },
]

export function MedicaoHeader() {
  const { activeTab, setActiveTab } = useMedicaoStore()

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      <div className="px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
          <Ruler size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-white font-semibold text-lg leading-tight">Medição</h1>
          <p className="text-[#a3a3a3] text-xs">Medição de Serviços · Boletins · Comparativo</p>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'text-[#f97316] border-[#f97316] bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
