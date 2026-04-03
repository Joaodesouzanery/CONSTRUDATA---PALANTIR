import { useState, useCallback } from 'react'
import { FluxogramaHeader } from './components/FluxogramaHeader'
import { FluxogramaCanvas } from './components/FluxogramaCanvas'
import { FluxogramaListView } from './components/FluxogramaListView'
import { FluxogramaImportModal } from './components/FluxogramaImportModal'
import { FluxogramaLegenda } from './components/FluxogramaLegenda'
import { FluxogramaConsultas } from './components/FluxogramaConsultas'
import { useFluxogramaStore } from '@/store/fluxogramaStore'

export function FluxogramaPage() {
  const activeTab = useFluxogramaStore((s) => s.activeTab)
  const importFromExcel = useFluxogramaStore((s) => s.importFromExcel)

  const [showImport, setShowImport] = useState(false)
  const [showLegenda, setShowLegenda] = useState(false)
  const [showConsultas, setShowConsultas] = useState(false)

  const handleToggleLegenda = useCallback(() => {
    setShowLegenda((v) => !v)
  }, [])

  const handleToggleConsultas = useCallback(() => {
    setShowConsultas((v) => !v)
  }, [])

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <FluxogramaHeader
        onOpenImport={() => setShowImport(true)}
        showLegenda={showLegenda}
        onToggleLegenda={handleToggleLegenda}
        showConsultas={showConsultas}
        onToggleConsultas={handleToggleConsultas}
      />
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'canvas' ? <FluxogramaCanvas /> : <FluxogramaListView />}

        {/* Overlay panels — Legenda shifts left when Consultas is also open */}
        {showLegenda && activeTab === 'canvas' && (
          <FluxogramaLegenda onClose={() => setShowLegenda(false)} offsetRight={showConsultas} />
        )}
        {showConsultas && activeTab === 'canvas' && (
          <FluxogramaConsultas onClose={() => setShowConsultas(false)} />
        )}
      </div>

      {/* Import modal */}
      <FluxogramaImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={importFromExcel}
      />
    </div>
  )
}
