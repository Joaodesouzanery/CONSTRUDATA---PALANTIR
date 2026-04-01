/**
 * MedicaoPage — Módulo de Medição de Serviços.
 */
import { useMedicaoStore } from '@/store/medicaoStore'
import { MedicaoHeader }   from './components/MedicaoHeader'
import { ServicosPanel }   from './components/ServicosPanel'
import { BmFormPanel }     from './components/BmFormPanel'
import { ComparativoPanel } from './components/ComparativoPanel'

export function MedicaoPage() {
  const activeTab = useMedicaoStore((s) => s.activeTab)

  function renderPanel() {
    switch (activeTab) {
      case 'servicos':    return <ServicosPanel />
      case 'boletim':     return <BmFormPanel />
      case 'comparativo': return <ComparativoPanel />
      default:            return <ServicosPanel />
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      <MedicaoHeader />
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
    </div>
  )
}
