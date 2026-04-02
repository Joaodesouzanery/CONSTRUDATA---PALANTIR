import { useState } from 'react'
import { Shield } from 'lucide-react'
import { HelpTooltip } from '@/components/shared/HelpTooltip'
import { ObrasListPanel }  from './components/ObrasListPanel'
import { ObrasMap }         from './components/ObrasMap'
import { ObraDetailPanel }  from './components/ObraDetailPanel'
import { ObraDialog }       from './components/ObraDialog'
import { RiskDialog }       from './components/RiskDialog'

type MobileTab = 'lista' | 'mapa' | 'detalhes'

const MOBILE_TABS: { key: MobileTab; label: string }[] = [
  { key: 'lista',    label: 'Lista' },
  { key: 'mapa',     label: 'Mapa' },
  { key: 'detalhes', label: 'Detalhes' },
]

export function TorreDeControlePage() {
  const [mobileTab, setMobileTab] = useState<MobileTab>('lista')

  return (
    <>
      {/* Module header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#525252] bg-[#2c2c2c] shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#f97316]/15">
          <Shield size={15} className="text-[#f97316]" />
        </div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-[#f5f5f5] text-base font-bold tracking-tight">Torre de Controle</h1>
          <HelpTooltip topic="torre-de-controle" />
        </div>
      </div>

      {/* Mobile tab switcher — only visible on small screens */}
      <div className="flex lg:hidden border-b border-[#525252] bg-[#2c2c2c] shrink-0">
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMobileTab(tab.key)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              mobileTab === tab.key
                ? 'text-[#f97316] border-b-2 border-[#f97316]'
                : 'text-[#6b6b6b] hover:text-[#a3a3a3]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop: all three panels side-by-side */}
      {/* Mobile: only the active panel */}
      <div className="flex h-full overflow-hidden">
        <div className={`${mobileTab === 'lista' ? 'flex flex-1 lg:flex-initial' : 'hidden'} lg:flex flex-col`}>
          <ObrasListPanel />
        </div>
        <div className={`${mobileTab === 'mapa' ? 'flex flex-1' : 'hidden'} lg:flex lg:flex-1`}>
          <ObrasMap />
        </div>
        <div className={`${mobileTab === 'detalhes' ? 'flex flex-1 lg:flex-initial' : 'hidden'} lg:flex flex-col`}>
          <ObraDetailPanel />
        </div>
      </div>

      <ObraDialog />
      <RiskDialog />
    </>
  )
}
