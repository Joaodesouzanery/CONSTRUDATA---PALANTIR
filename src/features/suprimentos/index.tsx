import { useState, useEffect } from 'react'
import { FileSpreadsheet, Plus } from 'lucide-react'
import { SuprimentosHeader }    from './components/SuprimentosHeader'
import { ConciliacaoPanel }     from './components/ConciliacaoPanel'
import { ExcecoesPanel }        from './components/ExcecoesPanel'
import { PrevisaoDemandaPanel } from './components/PrevisaoDemandaPanel'
import { RequisicoesPipeline }  from './components/RequisicoesPipeline'
import { MateriaisOverviewPanel } from './components/MateriaisOverviewPanel'
import { ContractPanel }        from './components/ContractPanel'
import { MapaEstoquePanel }     from './components/MapaEstoquePanel'
import { AlmoxarifadoPanel }    from './components/AlmoxarifadoPanel'
import { SemaforoProntidaoPanel } from './components/SemaforoProntidaoPanel'
import { WhatIfLogisticoPanel } from './components/WhatIfLogisticoPanel'
import { BomPendentePanel }    from './components/BomPendentePanel'
import { ExcelImportModal }          from './components/ExcelImportModal'
import { NovoMaterialModal }         from './components/NovoMaterialModal'
import { ImportConsolidadoModal }    from './components/ImportConsolidadoModal'
import { ImportPlanilhasModal }      from './components/ImportPlanilhasModal'
import { ResumoNucleoPanel }         from './components/ResumoNucleoPanel'
import { ConsolidadoTrechosPanel }   from './components/ConsolidadoTrechosPanel'
import { MateriaisPendentesPanel }   from './components/MateriaisPendentesPanel'
import { CadastroManualSuprimentosPanel } from './components/CadastroManualSuprimentosPanel'
import type { SuprimentosTab, SuprimentosSection } from './components/SuprimentosHeader'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'

export function SuprimentosPage() {
  const [activeSection, setActiveSection] = useState<SuprimentosSection>('suprimentos')
  const [activeTab, setActiveTab] = useState<SuprimentosTab>('conciliacao')
  const [showImport, setShowImport] = useState(false)
  const [showNovoMaterial, setShowNovoMaterial] = useState(false)
  const [showConsolidado, setShowConsolidado] = useState(false)
  const [showPlanilhas, setShowPlanilhas] = useState(false)
  const pullPlanilhasSupabase = useSuprimentosStore((s) => s.pullPlanilhasSupabase)

  // Reset tab when section changes
  useEffect(() => {
    setActiveTab(
      activeSection === 'suprimentos' ? 'conciliacao'
      : activeSection === 'materiais' ? 'materiais'
      : 'resumo_nucleo'
    )
  }, [activeSection])

  useEffect(() => {
    if (activeSection === 'planilhas') {
      void pullPlanilhasSupabase().catch(() => undefined)
    }
  }, [activeSection, pullPlanilhasSupabase])

  return (
    <div className="suprimentos-readable flex flex-col h-full p-5 gap-4 overflow-hidden">
      {/* Section switcher + action buttons */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex gap-1 bg-[#3d3d3d] border border-[#525252] rounded-xl p-1">
          <button
            onClick={() => setActiveSection('suprimentos')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              activeSection === 'suprimentos' ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            Suprimentos
          </button>
          <button
            onClick={() => setActiveSection('materiais')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              activeSection === 'materiais' ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            Materiais &amp; Estoque
          </button>
          <button
            onClick={() => setActiveSection('planilhas')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              activeSection === 'planilhas' ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            Planilhas Consolidadas
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSection === 'suprimentos' && (
            <button
              onClick={() => setShowConsolidado(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#525252] text-[#6b6b6b] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors"
            >
              <FileSpreadsheet size={13} />
              Importar Consolidado
            </button>
          )}
          {activeSection === 'materiais' && (
            <>
              <button
                onClick={() => setShowNovoMaterial(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
              >
                <Plus size={13} />
                Adicionar Material
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#525252] text-[#6b6b6b] hover:text-[#f5f5f5] hover:border-[#f97316]/40 transition-colors"
              >
                <FileSpreadsheet size={13} />
                Importar Excel
              </button>
            </>
          )}
          {activeSection === 'planilhas' && (
            <button
              onClick={() => setShowPlanilhas(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
            >
              <FileSpreadsheet size={13} />
              Importar Excel
            </button>
          )}
        </div>
      </div>

      <SuprimentosHeader
        section={activeSection}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'conciliacao' && <ConciliacaoPanel />}
      {activeTab === 'excecoes'    && <ExcecoesPanel />}
      {activeTab === 'previsao'    && <PrevisaoDemandaPanel />}
      {activeTab === 'requisicoes' && <RequisicoesPipeline />}
      {activeTab === 'bom'         && <BomPendentePanel />}
      {activeTab === 'materiais'   && <MateriaisOverviewPanel />}
      {activeTab === 'contratos'   && <ContractPanel />}
      {activeTab === 'estoque'     && <MapaEstoquePanel />}
      {activeTab === 'almoxarifado' && <AlmoxarifadoPanel />}
      {activeTab === 'semaforo'    && <SemaforoProntidaoPanel />}
      {activeTab === 'whatif'      && <WhatIfLogisticoPanel />}
      {activeTab === 'entrada_dados'       && <CadastroManualSuprimentosPanel />}
      {activeTab === 'resumo_nucleo'       && <ResumoNucleoPanel />}
      {activeTab === 'consolidado_trechos' && <ConsolidadoTrechosPanel />}
      {activeTab === 'materiais_pendentes' && <MateriaisPendentesPanel />}

      {showImport        && <ExcelImportModal onClose={() => setShowImport(false)} />}
      {showNovoMaterial  && <NovoMaterialModal onClose={() => setShowNovoMaterial(false)} />}
      {showConsolidado   && <ImportConsolidadoModal onClose={() => setShowConsolidado(false)} />}
      {showPlanilhas     && <ImportPlanilhasModal onClose={() => setShowPlanilhas(false)} />}
    </div>
  )
}
