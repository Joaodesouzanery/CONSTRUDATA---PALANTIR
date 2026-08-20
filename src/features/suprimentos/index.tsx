import { useState, useEffect } from 'react'
import { FileSpreadsheet, Plus, PackageMinus } from 'lucide-react'
import { SuprimentosHeader }    from './components/SuprimentosHeader'
import { ConciliacaoPanel }     from './components/ConciliacaoPanel'
import { ExcecoesPanel }        from './components/ExcecoesPanel'
import { PrevisaoDemandaPanel } from './components/PrevisaoDemandaPanel'
import { InteligenciaSuprimentosPanel } from './components/InteligenciaSuprimentosPanel'
import { RequisicoesPipeline }  from './components/RequisicoesPipeline'
import { MateriaisOverviewPanel } from './components/MateriaisOverviewPanel'
import { ContractPanel }        from './components/ContractPanel'
import { MapaEstoquePanel }     from './components/MapaEstoquePanel'
import { AlmoxarifadoPanel }    from './components/AlmoxarifadoPanel'
import { SemaforoProntidaoPanel } from './components/SemaforoProntidaoPanel'
import { WhatIfLogisticoPanel } from './components/WhatIfLogisticoPanel'
import { BomPendentePanel }    from './components/BomPendentePanel'
import { ExcelImportModal }          from './components/ExcelImportModal'
import { FichaRetiradaModal }        from './components/FichaRetiradaModal'
import { NovoMaterialModal }         from './components/NovoMaterialModal'
import { ImportConsolidadoModal }    from './components/ImportConsolidadoModal'
import { ImportPlanilhasModal }      from './components/ImportPlanilhasModal'
import { ResumoNucleoPanel }         from './components/ResumoNucleoPanel'
import { ConsolidadoTrechosPanel }   from './components/ConsolidadoTrechosPanel'
import { MateriaisPendentesPanel }   from './components/MateriaisPendentesPanel'
import { CadastroManualSuprimentosPanel } from './components/CadastroManualSuprimentosPanel'
import { CadeiaSuprimentosPanel } from './components/CadeiaSuprimentosPanel'
import { DashboardSuprimentosPanel } from './components/DashboardSuprimentosPanel'
import type { SuprimentosTab, SuprimentosSection } from './components/SuprimentosHeader'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useAuth } from '@/lib/auth'
import { isDemoModeEnabled } from '@/lib/runtimeMode'

function defaultTabForSection(section: SuprimentosSection): SuprimentosTab {
  if (section === 'suprimentos') return 'fluxo'
  if (section === 'cadeia') return 'cadeia_rede'
  return 'resumo_nucleo'
}

export function SuprimentosPage() {
  const [activeSection, setActiveSection] = useState<SuprimentosSection>('suprimentos')
  const [activeTab, setActiveTab] = useState<SuprimentosTab>('fluxo')
  const [showImport, setShowImport] = useState(false)
  const [showNovoMaterial, setShowNovoMaterial] = useState(false)
  const [showConsolidado, setShowConsolidado] = useState(false)
  const [showPlanilhas, setShowPlanilhas] = useState(false)
  const [showRetirada, setShowRetirada] = useState(false)
  const pullPlanilhasSupabase = useSuprimentosStore((s) => s.pullPlanilhasSupabase)
  const profileOrgId = useAuth((s) => s.profile?.organization_id)
  const loadDemoData = useSuprimentosStore((s) => s.loadDemoData)
  const sanitizeDemoData = useSuprimentosStore((s) => s.sanitizeDemoData)
  const pull = useSuprimentosStore((s) => s.pull)
  const flush = useSuprimentosStore((s) => s.flush)
  const activeStoreOrgId = useSuprimentosStore((s) => s.activeOrgId)
  const ensureTenantScope = useSuprimentosStore((s) => s.ensureTenantScope)

  function selectSection(section: SuprimentosSection) {
    setActiveSection(section)
    setActiveTab(defaultTabForSection(section))
  }

  // Antes: três abas declaradas como `section: 'suprimentos'` eram roteadas para 'materiais', e ao
  // clicar nelas a barra de abas não marcava nenhuma. Com uma seção a menos, a regra cabe em duas
  // listas — e é a MESMA lista do cabeçalho, então não dá para as duas discordarem de novo.
  const ABAS_PLANILHAS: SuprimentosTab[] = ['entrada_dados', 'resumo_nucleo', 'consolidado_trechos', 'materiais_pendentes']
  const ABAS_CADEIA: SuprimentosTab[] = ['cadeia_rede', 'cadeia_alertas', 'cadeia_planejamento']

  function navigateFlow(tab: SuprimentosTab) {
    setActiveSection(
      ABAS_CADEIA.includes(tab) ? 'cadeia'
      : ABAS_PLANILHAS.includes(tab) ? 'planilhas'
      : 'suprimentos',
    )
    setActiveTab(tab)
  }

  useEffect(() => {
    if (!profileOrgId) return
    ensureTenantScope(profileOrgId)
    if (isDemoModeEnabled()) {
      loadDemoData()
      return
    }
    sanitizeDemoData()
    void (async () => {
      await flush().catch(() => undefined)
      await pull().catch(() => undefined)
      await pullPlanilhasSupabase().catch(() => undefined)
    })()
  }, [ensureTenantScope, flush, loadDemoData, profileOrgId, pull, pullPlanilhasSupabase, sanitizeDemoData])

  if (profileOrgId && activeStoreOrgId !== profileOrgId) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-[#a3a3a3]">
        Carregando dados da empresa ativa...
      </div>
    )
  }

  return (
    <div className="suprimentos-readable flex flex-col h-full gap-4 overflow-y-auto overflow-x-hidden p-4 sm:p-5">
      {/* Section switcher + action buttons */}
      <div className="flex shrink-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full gap-1 overflow-x-auto rounded-xl border border-[#525252] bg-[#3d3d3d] p-1 scrollbar-none lg:w-auto lg:flex-wrap">
          <button
            onClick={() => selectSection('suprimentos')}
            className={cn(
              'shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              activeSection === 'suprimentos' ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            Fluxo da Obra
          </button>
          <button
            onClick={() => selectSection('planilhas')}
            className={cn(
              'shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              activeSection === 'planilhas' ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            Importação / Transição
          </button>
          <button
            onClick={() => selectSection('cadeia')}
            className={cn(
              'shrink-0 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              activeSection === 'cadeia' ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            Cadeia de Suprimentos
          </button>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          {activeSection === 'suprimentos' && (
            <>
              <button
                onClick={() => setShowRetirada(true)}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c] sm:flex-none"
              >
                <PackageMinus size={13} />
                Registrar Retirada
              </button>
              <button
                onClick={() => setShowNovoMaterial(true)}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs font-medium text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5] sm:flex-none"
              >
                <Plus size={13} />
                Adicionar Material
              </button>
              <button
                onClick={() => setShowConsolidado(true)}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#525252] px-3 py-1.5 text-xs font-medium text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5] sm:flex-none"
              >
                <FileSpreadsheet size={13} />
                Importar Consolidado
              </button>
            </>
          )}
          {activeSection === 'planilhas' && (
            <button
              onClick={() => setShowPlanilhas(true)}
              className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c] sm:flex-none"
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
        onImportMaterials={() => setShowImport(true)}
      />

      {activeTab === 'fluxo' && <DashboardSuprimentosPanel onNavigate={navigateFlow} onRegistrarRetirada={() => setShowRetirada(true)} />}
      {activeTab === 'conciliacao' && <ConciliacaoPanel />}
      {activeTab === 'excecoes'    && <ExcecoesPanel />}
      {activeTab === 'previsao'    && <PrevisaoDemandaPanel />}
      {activeTab === 'inteligencia' && <InteligenciaSuprimentosPanel />}
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
      {(activeTab === 'cadeia_rede' || activeTab === 'cadeia_alertas' || activeTab === 'cadeia_planejamento') && (
        <CadeiaSuprimentosPanel activeTab={activeTab} />
      )}

      {showImport        && <ExcelImportModal onClose={() => setShowImport(false)} />}
      {showNovoMaterial  && <NovoMaterialModal onClose={() => setShowNovoMaterial(false)} />}
      {showConsolidado   && <ImportConsolidadoModal onClose={() => setShowConsolidado(false)} />}
      {showPlanilhas     && <ImportPlanilhasModal onClose={() => setShowPlanilhas(false)} />}
      {showRetirada      && <FichaRetiradaModal onClose={() => setShowRetirada(false)} />}
    </div>
  )
}
