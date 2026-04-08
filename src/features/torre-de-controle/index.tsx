import { useState } from 'react'
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

      {/* ─── Mobile: only the active panel (vertical fallback) ─── */}
      <div className="flex lg:hidden flex-col h-full overflow-hidden">
        <div className={`${mobileTab === 'lista' ? 'flex flex-1' : 'hidden'} flex-col`}>
          <ObrasListPanel orientation="vertical" />
        </div>
        <div className={`${mobileTab === 'mapa' ? 'flex flex-1 relative' : 'hidden'}`}>
          <ObrasMap />
        </div>
        <div className={`${mobileTab === 'detalhes' ? 'flex flex-1' : 'hidden'} flex-col`}>
          <ObraDetailPanel />
        </div>
      </div>

      {/* ─── Desktop (lg+): vertical stack — Projetos topo / Mapa meio / Detalhes embaixo ─── */}
      {/* Alturas FIXAS por seção para garantir que o mapa sempre tenha tamanho
          conhecido ANTES do Leaflet inicializar. Sem isso, flex-1 com irmão
          shrink-0 grande pode resolver para 0 e crashear o Leaflet. */}
      <div className="hidden lg:flex lg:flex-col h-full overflow-hidden">
        {/* TOPO — Lista horizontal de projetos (180px fixo) */}
        <div className="shrink-0 h-[180px]">
          <ObrasListPanel orientation="horizontal" />
        </div>

        {/* MEIO — Mapa (flex grow, com altura mínima de segurança) */}
        <div className="flex-1 min-h-[300px] border-y border-[#525252] relative">
          <ObrasMap />
        </div>

        {/* EMBAIXO — Detalhes do projeto selecionado (260px fixo, scroll interno) */}
        <div className="shrink-0 h-[260px] overflow-y-auto">
          <ObraDetailPanel />
        </div>
      </div>

      <ObraDialog />
      <RiskDialog />
    </>
  )
}
