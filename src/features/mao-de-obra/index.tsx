import { useState } from 'react'
import { MaoDeObraHeader, type MaoDeObraTab } from './components/MaoDeObraHeader'
import { DashboardPanel }    from './components/DashboardPanel'
import { ApontamentosPanel } from './components/ApontamentosPanel'
import { EscalamentoPanel }  from './components/EscalamentoPanel'
import { SegurancaPanel }    from './components/SegurancaPanel'

export function MaoDeObraPage() {
  const [activeTab, setActiveTab] = useState<MaoDeObraTab>('dashboard')

  return (
    <div className="flex flex-col h-full">
      <MaoDeObraHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {activeTab === 'dashboard'    && <DashboardPanel />}
        {activeTab === 'apontamentos' && <ApontamentosPanel />}
        {activeTab === 'escalonamento' && <EscalamentoPanel />}
        {activeTab === 'seguranca'    && <SegurancaPanel />}
      </div>
    </div>
  )
}
