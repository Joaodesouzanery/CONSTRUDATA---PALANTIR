import { FluxogramaHeader } from './components/FluxogramaHeader'
import { FluxogramaCanvas } from './components/FluxogramaCanvas'
import { FluxogramaListView } from './components/FluxogramaListView'
import { useFluxogramaStore } from '@/store/fluxogramaStore'

export function FluxogramaPage() {
  const activeTab = useFluxogramaStore((s) => s.activeTab)
  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <FluxogramaHeader />
      <div className="flex-1 overflow-hidden">
        {activeTab === 'canvas' ? <FluxogramaCanvas /> : <FluxogramaListView />}
      </div>
    </div>
  )
}
