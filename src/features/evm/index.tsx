/**
 * EvmPage — módulo Financeiro (EVM). Estrutura reorganizada em 7 abas:
 *   Visão Geral · Por Obra · Resultados · Pagamentos e Cobranças ·
 *   Medição Ponderada · Plano de Contas · Distribuição
 * Painéis legados viraram sub-abas (SubTabHost) dentro das abas acima —
 * nenhum store/tabela foi alterado, só a navegação.
 */
import { useState } from 'react'
import { EvmHeader } from './components/EvmHeader'
import type { CombinedTab } from './components/EvmHeader'
import { SubTabHost } from '@/components/shared/SubTabHost'
import { DashboardPanel } from './components/DashboardPanel'
import { MedicaoPonderadaPanel } from './components/MedicaoPonderadaPanel'
import { PlanoContasPanel } from './components/PlanoContasPanel'
import { IndicesPanel } from './components/IndicesPanel'
import { PorObraPanel } from './components/PorObraPanel'
import { DistribuicaoPanel } from './components/DistribuicaoPanel'
import { ComparativoNucleosPanel } from './components/ComparativoNucleosPanel'
import { VisaoGeralPanel } from '@/features/financeiro/components/VisaoGeralPanel'
import { EntradasPanel, SaidasPanel } from '@/features/financeiro/components/EntradasSaidasPanel'
import { FluxoCaixaPanel } from '@/features/financeiro/components/FluxoCaixaPanel'
import { PagamentosPanel } from '@/features/financeiro/components/PagamentosPanel'
import { ManejoFinanceiroPanel } from '@/features/financeiro/components/ManejoFinanceiroPanel'
import { ManejoOrcamentoPanel } from '@/features/financeiro/components/ManejoOrcamentoPanel'

function renderPanel(tab: CombinedTab): React.ReactNode {
  switch (tab) {
    case 'visao-geral':
      return (
        <SubTabHost tabs={[
          { key: 'resumo',      label: 'Resumo',      render: () => <VisaoGeralPanel /> },
          { key: 'dashboard',   label: 'Dashboard',   render: () => <DashboardPanel /> },
          { key: 'comparativo', label: 'Comparativo', render: () => <ComparativoNucleosPanel /> },
        ]} />
      )
    case 'por-obra':
      return <PorObraPanel />
    case 'resultados':
      return (
        <SubTabHost tabs={[
          { key: 'entradas', label: 'Entradas',       render: () => <EntradasPanel /> },
          { key: 'saidas',   label: 'Saídas',         render: () => <SaidasPanel /> },
          { key: 'fluxo',    label: 'Fluxo de Caixa', render: () => <FluxoCaixaPanel /> },
        ]} />
      )
    case 'pagamentos':
      return <PagamentosPanel />
    case 'medicao':
      return (
        <SubTabHost tabs={[
          { key: 'medicao', label: 'Medição', render: () => <MedicaoPonderadaPanel /> },
          { key: 'indices', label: 'Índices', render: () => <IndicesPanel /> },
        ]} />
      )
    case 'plano-contas':
      return <PlanoContasPanel />
    case 'distribuicao':
      return (
        <SubTabHost tabs={[
          { key: 'distribuicao',      label: 'Distribuição',      render: () => <DistribuicaoPanel /> },
          { key: 'manejo-financeiro', label: 'Manejo Financeiro', render: () => <ManejoFinanceiroPanel /> },
          { key: 'manejo-orcamento',  label: 'Manejo Orçamento',  render: () => <ManejoOrcamentoPanel /> },
        ]} />
      )
    default:
      return <VisaoGeralPanel />
  }
}

export function EvmPage() {
  const [activeTab, setActiveTab] = useState<CombinedTab>('visao-geral')

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <EvmHeader activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="flex-1 overflow-auto">
        {renderPanel(activeTab)}
      </div>
    </div>
  )
}
