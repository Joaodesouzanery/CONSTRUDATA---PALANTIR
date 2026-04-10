/**
 * EvmPage — EVM + Financeiro combined module.
 * Renders 5 EVM tabs + 4 Financeiro tabs in a single unified view.
 */
import { useState } from 'react'
import { EvmHeader } from './components/EvmHeader'
import type { CombinedTab } from './components/EvmHeader'
import { DashboardPanel } from './components/DashboardPanel'
import { MedicaoPonderadaPanel } from './components/MedicaoPonderadaPanel'
import { PlanoContasPanel } from './components/PlanoContasPanel'
import { WorkPackagesPanel } from './components/WorkPackagesPanel'
import { IndicesPanel } from './components/IndicesPanel'
import { VisaoGeralPanel } from '@/features/financeiro/components/VisaoGeralPanel'
import { EntradasPanel, SaidasPanel } from '@/features/financeiro/components/EntradasSaidasPanel'
import { FluxoCaixaPanel } from '@/features/financeiro/components/FluxoCaixaPanel'

function renderPanel(tab: CombinedTab): React.ReactNode {
  switch (tab) {
    case 'dashboard':     return <DashboardPanel />
    case 'medicao':       return <MedicaoPonderadaPanel />
    case 'plano-contas':  return <PlanoContasPanel />
    case 'work-packages': return <WorkPackagesPanel />
    case 'indices':       return <IndicesPanel />
    case 'visao-geral':   return <VisaoGeralPanel />
    case 'entradas':      return <EntradasPanel />
    case 'saidas':        return <SaidasPanel />
    case 'fluxo-caixa':  return <FluxoCaixaPanel />
    default:              return <DashboardPanel />
  }
}

export function EvmPage() {
  const [activeTab, setActiveTab] = useState<CombinedTab>('dashboard')

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <EvmHeader activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {renderPanel(activeTab)}
      </div>
    </div>
  )
}
