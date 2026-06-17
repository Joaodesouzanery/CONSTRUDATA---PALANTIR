import { useFinanceiroStore } from '@/store/financeiroStore'
import { FinanceiroModuleHeader } from './components/FinanceiroModuleHeader'
import { VisaoGeralPanel }        from './components/VisaoGeralPanel'
import { EntradasPanel, SaidasPanel } from './components/EntradasSaidasPanel'
import { FluxoCaixaPanel }        from './components/FluxoCaixaPanel'
import { DistribuicaoPanel }      from './components/DistribuicaoPanel'

export function FinanceiroPage() {
  const activeTab = useFinanceiroStore((s) => s.activeTab)

  function renderPanel() {
    switch (activeTab) {
      case 'visao-geral':  return <VisaoGeralPanel />
      case 'entradas':     return <EntradasPanel />
      case 'saidas':       return <SaidasPanel />
      case 'fluxo-caixa':  return <FluxoCaixaPanel />
      case 'distribuicao': return <DistribuicaoPanel />
      default:             return <VisaoGeralPanel />
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <FinanceiroModuleHeader />
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
    </div>
  )
}
