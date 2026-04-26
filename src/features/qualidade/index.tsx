/**
 * QualidadePage — root do módulo Qualidade.
 *
 * Primeira funcionalidade: Ficha de Verificação de Serviço (FVS).
 * Outras funcionalidades virão em iterações futuras (PIT, NC, etc.).
 */
import { useQualidadeStore } from '@/store/qualidadeStore'
import { QualidadeHeader } from './components/QualidadeHeader'
import { DashboardPanel }  from './components/DashboardPanel'
import { NovaFvsPanel }    from './components/NovaFvsPanel'
import { NaoConformidadePanel } from './components/NaoConformidadePanel'
import { HistoricoPanel }  from './components/HistoricoPanel'

export function QualidadePage() {
  const activeTab = useQualidadeStore((s) => s.activeTab)

  function renderPanel() {
    switch (activeTab) {
      case 'dashboard': return <DashboardPanel />
      case 'novo':      return <NovaFvsPanel />
      case 'nao-conformidade': return <NaoConformidadePanel />
      case 'historico': return <HistoricoPanel />
      default:          return <DashboardPanel />
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#1f1f1f]">
      <QualidadeHeader />
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
    </div>
  )
}
