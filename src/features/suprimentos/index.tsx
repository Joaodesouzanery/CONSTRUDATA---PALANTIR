import { useState, useEffect } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { SuprimentosHeader }    from './components/SuprimentosHeader'
import { ConciliacaoPanel }     from './components/ConciliacaoPanel'
import { ExcecoesPanel }        from './components/ExcecoesPanel'
import { PrevisaoDemandaPanel } from './components/PrevisaoDemandaPanel'
import { RequisicoesPipeline }  from './components/RequisicoesPipeline'
import { MateriaisOverviewPanel } from './components/MateriaisOverviewPanel'
import { ContractPanel }        from './components/ContractPanel'
import { MapaEstoquePanel }     from './components/MapaEstoquePanel'
import { SemaforoProntidaoPanel } from './components/SemaforoProntidaoPanel'
import { WhatIfLogisticoPanel } from './components/WhatIfLogisticoPanel'
import { ExcelImportModal }     from './components/ExcelImportModal'
import type { SuprimentosTab, SuprimentosSection } from './components/SuprimentosHeader'
import { cn } from '@/lib/utils'

export function SuprimentosPage() {
  const [activeSection, setActiveSection] = useState<SuprimentosSection>('suprimentos')
  const [activeTab, setActiveTab] = useState<SuprimentosTab>('conciliacao')
  const [showImport, setShowImport] = useState(false)

  // Reset tab when section changes
  useEffect(() => {
    setActiveTab(activeSection === 'suprimentos' ? 'conciliacao' : 'materiais')
  }, [activeSection])

  return (
    <div className="flex flex-col h-full p-5 gap-4 overflow-hidden">
      {/* Section switcher + Excel import button */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex gap-1 bg-[#14294e] border border-[#20406a] rounded-xl p-1">
          <button
            onClick={() => setActiveSection('suprimentos')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              activeSection === 'suprimentos' ? 'bg-[#2abfdc] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            Suprimentos
          </button>
          <button
            onClick={() => setActiveSection('materiais')}
            className={cn(
              'px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              activeSection === 'materiais' ? 'bg-[#2abfdc] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            Materiais &amp; Estoque
          </button>
        </div>

        {activeSection === 'materiais' && (
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#20406a] text-[#6b6b6b] hover:text-[#f5f5f5] hover:border-[#2abfdc]/40 transition-colors"
          >
            <FileSpreadsheet size={13} />
            Importar Excel
          </button>
        )}
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
      {activeTab === 'materiais'   && <MateriaisOverviewPanel />}
      {activeTab === 'contratos'   && <ContractPanel />}
      {activeTab === 'estoque'     && <MapaEstoquePanel />}
      {activeTab === 'semaforo'    && <SemaforoProntidaoPanel />}
      {activeTab === 'whatif'      && <WhatIfLogisticoPanel />}

      {showImport && <ExcelImportModal onClose={() => setShowImport(false)} />}
    </div>
  )
}
