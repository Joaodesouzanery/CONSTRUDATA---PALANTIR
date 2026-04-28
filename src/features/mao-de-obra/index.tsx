import { Component, useState, type ReactNode } from 'react'
import { MaoDeObraHeader }       from './components/MaoDeObraHeader'
import type { MaoDeObraTab }     from './components/MaoDeObraHeader'
import { DashboardPanel }        from './components/DashboardPanel'
import { ApontamentosPanel }     from './components/ApontamentosPanel'
import { EscalamentoPanel }      from './components/EscalamentoPanel'
import { SegurancaPanel }        from './components/SegurancaPanel'
import { FuncionariosPanel }     from './components/FuncionariosPanel'
import { EscalaInteligentePanel } from './components/EscalaInteligentePanel'
import { PostosPanel }           from './components/PostosPanel'
import { CMOPanel }              from './components/CMOPanel'
import { FaltasSubsPanel }       from './components/FaltasSubsPanel'
import { FolhaPagamentoPanel }   from './components/FolhaPagamentoPanel'
import { RHFinanceiroPanel }     from './components/RHFinanceiroPanel'
import { AusenciasCalendarioPanel } from './components/AusenciasCalendarioPanel'

class MaoDeObraPanelBoundary extends Component<{ children: ReactNode; activeTab: MaoDeObraTab }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[MaoDeObraPanelBoundary]', error)
  }

  componentDidUpdate(prevProps: { activeTab: MaoDeObraTab }) {
    if (prevProps.activeTab !== this.props.activeTab && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-6 text-center">
        <p className="text-sm font-semibold text-[#f5f5f5]">Nao foi possivel abrir esta aba.</p>
        <p className="mt-2 text-xs text-[#a3a3a3]">Os dados locais foram preservados. Tente outra aba ou recarregue a tela.</p>
        <button
          type="button"
          onClick={() => this.setState({ hasError: false })}
          className="mt-4 rounded-lg border border-[#525252] px-3 py-1.5 text-xs font-semibold text-[#f97316] hover:border-[#f97316]/40"
        >
          Tentar novamente
        </button>
      </div>
    )
  }
}

export function MaoDeObraPage() {
  const [activeTab, setActiveTab] = useState<MaoDeObraTab>('dashboard')

  function renderPanel() {
    switch (activeTab) {
      case 'dashboard':     return <DashboardPanel />
      case 'funcionarios':  return <FuncionariosPanel />
      case 'escala':        return <EscalaInteligentePanel />
      case 'postos':        return <PostosPanel />
      case 'cmo':           return <CMOPanel />
      case 'faltas':        return <FaltasSubsPanel />
      case 'folha':         return <FolhaPagamentoPanel />
      case 'rh-financeiro': return <RHFinanceiroPanel />
      case 'ausencias':     return <AusenciasCalendarioPanel />
      case 'apontamentos':  return <ApontamentosPanel />
      case 'escalamento':   return <EscalamentoPanel />
      case 'seguranca':     return <SegurancaPanel />
      default:              return <DashboardPanel />
    }
  }

  return (
    <div className="flex flex-col h-full">
      <MaoDeObraHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <MaoDeObraPanelBoundary activeTab={activeTab}>
          {renderPanel()}
        </MaoDeObraPanelBoundary>
      </div>
    </div>
  )
}
