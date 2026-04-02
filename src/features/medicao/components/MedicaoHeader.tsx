/**
 * MedicaoHeader — top bar with title and tab navigation for the Medicao module.
 */
import { ClipboardCheck, Download } from 'lucide-react'
import { useMedicaoStore } from '@/store/medicaoStore'
import { cn } from '@/lib/utils'
import type { MedicaoTab } from '@/types'

const TABS: { key: MedicaoTab; label: string }[] = [
  { key: 'sabesp', label: 'Sabesp' },
  { key: 'criterio', label: 'Criterio' },
  { key: 'subempreiteiro', label: 'Subempreiteiro' },
  { key: 'fornecedor', label: 'Fornecedor' },
  { key: 'conferencia', label: 'Conferencia' },
]

export function MedicaoHeader() {
  const { activeTab, setActiveTab, loadDemoData } = useMedicaoStore()

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <ClipboardCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">
              Medicao
            </h1>
            <p className="text-[#a3a3a3] text-xs">
              Gestao de Medicoes e Conferencia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadDemoData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] transition-colors hover:bg-[#ea580c]"
          >
            <Download size={15} />
            Carregar Demo
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2',
                  isActive
                    ? 'text-white border-orange-500 bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50',
                )}
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
