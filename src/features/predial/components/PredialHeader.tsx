/**
 * PredialHeader — barra de título + abas do módulo Predial (facilities/manutenção).
 * Agrega Manutenções, Equipamentos, Saúde & Preditiva, CapEx/ROI e Workbench como
 * abas (reusando features existentes). CapEx e Workbench entram nas fases B3/B4.
 */
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PREDIAL_TABS, type PredialTab } from '../tabs'

interface Props {
  activeTab: PredialTab
  onTabChange: (tab: PredialTab) => void
}

export function PredialHeader({ activeTab, onTabChange }: Props) {
  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      <div className="px-6 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
          <Building2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-white font-semibold text-lg leading-tight">Predial</h1>
          <p className="text-[#a3a3a3] text-xs">Ativos, manutenções e laudos do prédio sob controle — e um relatório pronto para a assembleia.</p>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {PREDIAL_TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
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
