/**
 * PlanejamentoMestrePage — main page for the Planejamento Mestre module.
 *
 * Empty state quando não há atividades — usuário pode criar do zero (wizard)
 * ou carregar dados de exemplo (loadDemoData).
 */
import { useState, useEffect } from 'react'
import { Sparkles, FlaskConical } from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { PlanejamentoMestreHeader } from './components/PlanejamentoMestreHeader'
import { PlanejamentoMacroPanel } from './components/PlanejamentoMacroPanel'
import { DerivacaoPanel } from './components/DerivacaoPanel'
import { CurtoPrazoPanel } from './components/CurtoPrazoPanel'
import { VisaoIntegradaPanel } from './components/VisaoIntegradaPanel'
import { ProgramacaoSemanalPanel } from './components/ProgramacaoSemanalPanel'
import { CriarCronogramaWizard } from './components/CriarCronogramaWizard'

export function PlanejamentoMestrePage() {
  const activeTab = usePlanejamentoMestreStore((s) => s.activeTab)
  const activities = usePlanejamentoMestreStore((s) => s.activities)
  const loadDemoData = usePlanejamentoMestreStore((s) => s.loadDemoData)
  const pull = usePlanejamentoMestreStore((s) => s.pull)

  const [wizardOpen, setWizardOpen] = useState(false)

  useEffect(() => { void pull() }, [])

  // Empty state — cliente novo, sem cronograma
  if (activities.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-[#1f1f1f]">
        <PlanejamentoMestreHeader onNewProject={() => setWizardOpen(true)} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-[#f97316]/15 flex items-center justify-center">
              <Sparkles size={36} className="text-[#f97316]" />
            </div>
            <h2 className="text-white text-2xl font-bold mb-2">Nenhum cronograma ainda</h2>
            <p className="text-[#a3a3a3] text-sm mb-8 leading-relaxed">
              Comece criando um cronograma macro do zero para sua obra. Em 3 passos rápidos
              você define o nome do projeto, as frentes e a estrutura inicial.
              <br />
              <span className="text-[#6b6b6b]">Tudo é editável depois.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-[#f97316]/20"
              >
                <Sparkles size={16} />
                Criar Cronograma do Zero
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

        <CriarCronogramaWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PlanejamentoMestreHeader onNewProject={() => setWizardOpen(true)} />
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'macro'     && <PlanejamentoMacroPanel onCreateProject={() => setWizardOpen(true)} />}
        {activeTab === 'derivacao' && <DerivacaoPanel />}
        {activeTab === 'whatif'    && <CurtoPrazoPanel />}
        {activeTab === 'integrada' && <VisaoIntegradaPanel />}
        {activeTab === 'semanal'   && <ProgramacaoSemanalPanel />}
      </div>
      <CriarCronogramaWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}
