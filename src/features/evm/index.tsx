/**
 * EvmPage — módulo Financeiro (a rota é `/app/evm`; `/app/financeiro` redireciona para cá).
 *
 * Nove abas: Visão Geral · Por Obra · DRE e Resultado · **Medição** · Pagamentos e Cobranças ·
 * **Documentos** · **Avanço Ponderado** · Distribuição · **Configuração**.
 * Painéis legados são sub-abas (`SubTabHost`) — nenhum store nem tabela mudou, só a navegação.
 *
 * ⚠️ Continuam sendo NOVE, não oito: Boletos + Nota Fiscal viraram uma (−1), mas Medição entrou
 * (+1). O ganho não é o número — é que dois assuntos pararam de disputar a barra e o nome
 * "Medição" parou de apontar para a matriz de peso do EVM.
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
import { DrePanel } from '@/features/financeiro/components/DrePanel'
import { FluxoCaixaPanel } from '@/features/financeiro/components/FluxoCaixaPanel'
import { ProjetadoRealizadoPanel } from '@/features/financeiro/components/ProjetadoRealizadoPanel'
import { ControleDeCaixaPanel } from '@/features/financeiro/components/ControleDeCaixaPanel'
import { FcpPanel } from '@/features/financeiro/components/FcpPanel'
import { PagamentosPanel } from '@/features/financeiro/components/PagamentosPanel'
import { BoletosPanel } from '@/features/financeiro/components/BoletosPanel'
import { NotasFiscaisPanel } from '@/features/financeiro/components/NotasFiscaisPanel'
import { NotasPainelPanel } from '@/features/financeiro/components/NotasPainelPanel'
import { ManejoFinanceiroPanel } from '@/features/financeiro/components/ManejoFinanceiroPanel'
import { ManejoOrcamentoPanel } from '@/features/financeiro/components/ManejoOrcamentoPanel'
import { DreConfigPanel } from '@/features/financeiro/components/DrePanel'
import { useFinanceiroStore } from '@/store/financeiroStore'

/**
 * O mapeamento categoria → linha da DRE, na aba Configuração.
 *
 * ⚠️ Dois seletores separados, nunca um objeto literal: seletor que devolve objeto novo a cada
 * render sem `useShallow` re-renderiza sem parar e derruba a rota inteira — já aconteceu neste
 * repositório.
 */
function ConfiguracaoDaDre() {
  const dreConfig = useFinanceiroStore((s) => s.dreConfig)
  const setDreConfig = useFinanceiroStore((s) => s.setDreConfig)
  return (
    <div className="p-4 sm:p-6">
      <DreConfigPanel config={dreConfig} onChange={setDreConfig} />
    </div>
  )
}

function renderPanel(tab: CombinedTab): React.ReactNode {
  switch (tab) {
    case 'visao-geral':
      return (
        <SubTabHost tabs={[
          { key: 'analise',     label: 'Análise',      render: () => <VisaoGeralPanel /> },
          { key: 'dashboard',   label: 'Dashboard EVM', render: () => <DashboardPanel /> },
          { key: 'comparativo', label: 'Comparativo',  render: () => <ComparativoNucleosPanel /> },
        ]} />
      )
    case 'por-obra':
      return <PorObraPanel />
    case 'resultados':
      return (
        <SubTabHost tabs={[
          { key: 'dre',      label: 'DRE',            render: () => <DrePanel /> },
          { key: 'entradas', label: 'Entradas',       render: () => <EntradasPanel /> },
          { key: 'saidas',   label: 'Saídas',         render: () => <SaidasPanel /> },
          // O Fluxo de Caixa aqui é o REALIZADO; o Projetado (FCP) entra ao lado dele, e cada um
          // diz qual é qual — é a mesma distinção entre medido e estimado que o Economia faz.
          { key: 'fluxo',    label: 'Fluxo de Caixa', render: () => <FluxoCaixaPanel /> },
          { key: 'fcp',      label: 'Fluxo de Caixa Projetado', render: () => <FcpPanel /> },
          // O cruzamento dos dois: "a obra está gastando o que a gente planejou?", total e por obra.
          { key: 'projetado-realizado', label: 'Projetado × Realizado', render: () => <ProjetadoRealizadoPanel /> },
          { key: 'caixa',    label: 'Controle de Caixa', render: () => <ControleDeCaixaPanel /> },
        ]} />
      )
    case 'pagamentos':
      return <PagamentosPanel />
    case 'documentos':
      return (
        <SubTabHost tabs={[
          { key: 'boletos', label: 'Boletos', render: () => <BoletosPanel /> },
          { key: 'notas',   label: 'Notas',   render: () => <NotasFiscaisPanel /> },
          { key: 'painel',  label: 'Painel',  render: () => <NotasPainelPanel /> },
        ]} />
      )
    case 'avanco-ponderado':
      return (
        <SubTabHost tabs={[
          // A sub-aba não pode se chamar "Medição": é justamente a confusão que o rename desfaz.
          { key: 'matriz',  label: 'Matriz de pesos', render: () => <MedicaoPonderadaPanel /> },
          { key: 'indices', label: 'Índices',         render: () => <IndicesPanel /> },
        ]} />
      )
    case 'configuracao':
      return (
        <SubTabHost tabs={[
          { key: 'plano-contas', label: 'Plano de Contas', render: () => <PlanoContasPanel /> },
          { key: 'dre',          label: 'Categorias da DRE', render: () => <ConfiguracaoDaDre /> },
        ]} />
      )
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
        {/* ⚠️ `key` obrigatório: o SubTabHost guarda a sub-aba ativa em estado LOCAL e não reseta
            ao trocar de aba principal. Sem isto, ir de "Visão Geral" (sub-aba 'analise') para
            "Medição" mantém `active='analise'`, o conteúdo cai no fallback e NENHUMA pill acende —
            as quatro listas de sub-abas não têm nenhuma chave em comum. */}
        <div key={activeTab} className="h-full">
          {renderPanel(activeTab)}
        </div>
      </div>
    </div>
  )
}
