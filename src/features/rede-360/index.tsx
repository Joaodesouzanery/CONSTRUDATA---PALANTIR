/**
 * Rede 360 — Root page component.
 */
import { useRede360Store } from '@/store/rede360Store'
import { Rede360Header } from './components/Rede360Header'
import { MapaOperacionalPanel } from './components/MapaOperacionalPanel'
import { AtivosPanel } from './components/AtivosPanel'
import { OrdensServicoPanel } from './components/OrdensServicoPanel'
import { RiscoPanel } from './components/RiscoPanel'

export function Rede360Page() {
  const activeTab = useRede360Store((s) => s.activeTab)
  return (
    <div className="flex flex-col h-full">
      <Rede360Header />
      <div className="flex-1 overflow-hidden">
        {activeTab === 'mapa'   && <MapaOperacionalPanel />}
        {activeTab === 'ativos' && <AtivosPanel />}
        {activeTab === 'ordens' && <OrdensServicoPanel />}
        {activeTab === 'risco'  && <RiscoPanel />}
      </div>
    </div>
  )
}
