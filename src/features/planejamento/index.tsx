/**
 * PlanejamentoPage — root of the Planejamento module.
 * Routes between 9 tabs via the store's activeTab state.
 */
import { useState } from 'react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { PlanejamentoHeader } from './components/PlanejamentoHeader'
import { ConfigPanel }      from './components/ConfigPanel'
import { TrechosPanel }     from './components/TrechosPanel'
import { GanttPanel }       from './components/GanttPanel'
import { SCurvePanel }      from './components/SCurvePanel'
import { AbcPanel }         from './components/AbcPanel'
import { HistogramPanel }   from './components/HistogramPanel'
import { DailyPlanPanel }   from './components/DailyPlanPanel'
import { NotesPanel }       from './components/NotesPanel'
import { ScenariosPanel }   from './components/ScenariosPanel'
import { CalendarClock, FileSpreadsheet, Plus } from 'lucide-react'
import { ImportModal } from '@/components/shared/ImportModal'
import { TRECHO_IMPORT_CONFIG } from '@/lib/importConfigs'

// ─── Empty state shown when no trechos exist ──────────────────────────────────
function EmptyStatePlanejamento() {
  const { initBlankPlan, addTrecho } = usePlanejamentoStore()
  const [nomePlano, setNomePlano] = useState('')
  const [showNomeInput, setShowNomeInput] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  function handleCriarDoZero() {
    if (showNomeInput) {
      const nome = nomePlano.trim() || 'Planejamento Principal'
      initBlankPlan(nome)
    } else {
      setShowNomeInput(true)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
        style={{ backgroundColor: '#f97316' }}
      >
        <CalendarClock size={32} className="text-white" />
      </div>
      <h2 className="text-white text-xl font-bold mb-2">Nenhum planejamento criado</h2>
      <p className="text-[#a3a3a3] text-sm max-w-md mb-8">
        Crie um planejamento do zero adicionando trechos manualmente, ou importe uma planilha existente com os dados do projeto.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        {/* Criar do Zero */}
        <div className="flex-1 bg-[#2c2c2c] border border-[#525252] rounded-xl p-5 flex flex-col gap-3 text-left">
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-[#f97316]" />
            <span className="text-white font-semibold text-sm">Criar do Zero</span>
          </div>
          <p className="text-[#a3a3a3] text-xs">
            Defina um nome e comece a adicionar trechos, equipes e configurações de cronograma.
          </p>
          {showNomeInput && (
            <input
              type="text"
              autoFocus
              value={nomePlano}
              onChange={(e) => setNomePlano(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCriarDoZero() }}
              placeholder="Ex.: Planejamento São Manuel — Fev/26"
              className="w-full bg-[#1f1f1f] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]"
            />
          )}
          <button
            onClick={handleCriarDoZero}
            className="w-full py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#f97316' }}
          >
            {showNomeInput ? 'Criar planejamento' : 'Começar'}
          </button>
        </div>

        {/* Importar planilha */}
        <div className="flex-1 bg-[#2c2c2c] border border-[#525252] rounded-xl p-5 flex flex-col gap-3 text-left">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-[#f97316]" />
            <span className="text-white font-semibold text-sm">Importar Planilha</span>
          </div>
          <p className="text-[#a3a3a3] text-xs">
            Já tem um planejamento em Excel ou CSV? Importe diretamente para o sistema.
          </p>
          <button
            onClick={() => setImportOpen(true)}
            className="w-full py-2 rounded-lg text-sm font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors mt-auto"
          >
            Importar XLSX / CSV
          </button>
        </div>
      </div>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar Trechos"
        description="Aceita .xlsx, .xls ou .csv no template Atlântico"
        config={TRECHO_IMPORT_CONFIG}
        templateFilename="atlantico-trechos-template.xlsx"
        commitLabel={(n) => `Importar ${n} ${n === 1 ? 'trecho' : 'trechos'}`}
        onCommit={(rows) => {
          initBlankPlan('Planejamento Importado')
          rows.forEach((t) => addTrecho(t))
        }}
      />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PlanejamentoPage() {
  const { activeTab, trechos } = usePlanejamentoStore()
  const isEmpty = trechos.length === 0

  function renderPanel() {
    switch (activeTab) {
      case 'config':    return <ConfigPanel />
      case 'trechos':   return <TrechosPanel />
      case 'gantt':     return <GanttPanel />
      case 'scurve':    return <SCurvePanel />
      case 'abc':       return <AbcPanel />
      case 'histogram': return <HistogramPanel />
      case 'daily':     return <DailyPlanPanel />
      case 'notes':     return <NotesPanel />
      case 'scenarios': return <ScenariosPanel />
      default:          return <ConfigPanel />
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {!isEmpty && <PlanejamentoHeader />}
      <div className="flex-1 overflow-auto">
        {isEmpty ? <EmptyStatePlanejamento /> : renderPanel()}
      </div>
    </div>
  )
}
