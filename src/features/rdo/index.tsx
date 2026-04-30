/**
 * RdoPage — root of the RDO module.
 */
import { useRdoStore } from '@/store/rdoStore'
import { RdoHeader }      from './components/RdoHeader'
import { DashboardPanel } from './components/DashboardPanel'
import { NovoRdoPanel }   from './components/NovoRdoPanel'
import { HistoricoPanel } from './components/HistoricoPanel'
import { EmpreiteirosPanel } from './components/EmpreiteirosPanel'

export function RdoPage() {
  const activeTab = useRdoStore((s) => s.activeTab)

  function renderPanel() {
    switch (activeTab) {
      case 'dashboard':  return <DashboardPanel />
      case 'novo':       return <NovoRdoPanel />
      case 'empreiteiros': return <EmpreiteirosPanel />
      case 'historico':  return <HistoricoPanel />
      default:           return <DashboardPanel />
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <RdoHeader />
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
    </div>
  )
}
