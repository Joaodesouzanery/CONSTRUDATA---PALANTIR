import { useGestao360Store } from '@/store/gestao360Store'
import { Gestao360Header } from './components/Gestao360Header'
import { JobCostingPanel } from './components/JobCostingPanel'
import { ChangeOrderPanel } from './components/ChangeOrderPanel'
import { CommandCenterPanel } from './components/CommandCenterPanel'
import { SimulacaoAtrasoPanel } from './components/SimulacaoAtrasoPanel'

export function Gestao360Page() {
  const activeTab = useGestao360Store((s) => s.activeTab)

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#171717]">
      {/* Sticky header + tab bar */}
      <div className="sticky top-0 z-10 bg-[#171717] border-b border-[#2a2a2a]">
        <Gestao360Header />
      </div>

      {/* Tab content */}
      <div className="flex-1 px-6 py-5">
        {activeTab === 'jobacosting'  && <JobCostingPanel />}
        {activeTab === 'changeorders' && <ChangeOrderPanel />}
        {activeTab === 'command'      && <CommandCenterPanel />}
        {activeTab === 'simulation'   && <SimulacaoAtrasoPanel />}
      </div>
    </div>
  )
}
