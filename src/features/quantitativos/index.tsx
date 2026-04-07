/**
 * QuantitativosPage — root of the Quantitativos e Orçamento module.
 *
 * Empty state quando não há itens em edição — usuário cria do zero (wizard)
 * ou carrega exemplo via demo mode.
 */
import { useState } from 'react'
import { Sparkles, FlaskConical } from 'lucide-react'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { QuantHeader }     from './components/QuantHeader'
import { ComposicaoPanel } from './components/ComposicaoPanel'
import { ResumoPanel }     from './components/ResumoPanel'
import { BancoDadosPanel } from './components/BancoDadosPanel'
import { HistoricoPanel }  from './components/HistoricoPanel'
import { CriarOrcamentoWizard } from './components/CriarOrcamentoWizard'

export function QuantitativosPage() {
  const activeTab    = useQuantitativosStore((s) => s.activeTab)
  const currentItems = useQuantitativosStore((s) => s.currentItems)
  const loadDemoData = useQuantitativosStore((s) => s.loadDemoData)

  const [wizardOpen, setWizardOpen] = useState(false)

  function renderPanel() {
    switch (activeTab) {
      case 'composicao': return <ComposicaoPanel />
      case 'resumo':     return <ResumoPanel />
      case 'banco':      return <BancoDadosPanel />
      case 'historico':  return <HistoricoPanel />
      default:           return <ComposicaoPanel />
    }
  }

  // Empty state — orçamento ainda não existe
  if (currentItems.length === 0 && activeTab === 'composicao') {
    return (
      <div className="flex flex-col h-full bg-[#1f1f1f]">
        <QuantHeader onCreateBudget={() => setWizardOpen(true)} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[#f97316]/15 flex items-center justify-center">
              <Sparkles size={36} className="text-[#f97316]" />
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">Nenhum orçamento ainda</h2>
            <p className="text-[#a3a3a3] text-sm mb-8 leading-relaxed">
              Comece criando um orçamento do zero. Em 3 passos rápidos
              você escolhe a base de custo, o BDI e o tipo de obra.
              <br />
              <span className="text-[#6b6b6b]">Itens iniciais já vêm prontos para preencher.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-[#f97316]/20"
              >
                <Sparkles size={16} />
                Criar Orçamento do Zero
              </button>
              <button
                onClick={loadDemoData}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#3a3a3a] hover:bg-[#484848] text-[#f5f5f5] border border-[#525252] rounded-xl font-semibold text-sm transition-colors"
              >
                <FlaskConical size={16} />
                Carregar Exemplo
              </button>
            </div>
          </div>
        </div>

        <CriarOrcamentoWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <QuantHeader onCreateBudget={() => setWizardOpen(true)} />
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
      <CriarOrcamentoWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}
