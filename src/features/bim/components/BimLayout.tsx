import { BimLeftPanel }       from './BimLeftPanel'
import { BimCanvas }          from './BimCanvas'
import { BimControls }        from './BimControls'
import { BimPropertiesPanel } from './BimPropertiesPanel'
import { BimForgeViewer }     from './BimForgeViewer'
import { BimSaneamentoPanel } from './BimSaneamentoPanel'
import { Bim4DPanel }         from './Bim4DPanel'
import { Bim5DPanel }         from './Bim5DPanel'
import { useBimStore }        from '@/store/bimStore'

export function BimLayout() {
  const activeTab  = useBimStore((s) => s.activeTab)
  const viewerMode = useBimStore((s) => s.viewerMode)
  const project    = useBimStore((s) => s.project)

  const isSanitation = project?.type === 'sanitation'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Main area: left panel | canvas+controls | right panel(s) */}
      <div className="flex flex-1 min-h-0">
        <BimLeftPanel />

        {/* Center: controls toolbar + canvas / forge viewer */}
        <div className="flex flex-col flex-1 min-w-0">
          <BimControls />
          {viewerMode === 'forge' ? (
            <BimForgeViewer />
          ) : (
            <BimCanvas />
          )}
        </div>

        {/* Right panels */}
        {viewerMode === 'threejs' && isSanitation && <BimSaneamentoPanel />}
        {viewerMode === 'threejs' && !isSanitation && <BimPropertiesPanel />}
        {viewerMode === 'forge'   && <BimPropertiesPanel />}
      </div>

      {/* Bottom panel: 4D or 5D */}
      {activeTab === '4d' && <Bim4DPanel />}
      {activeTab === '5d' && <Bim5DPanel />}
      {activeTab === 'viewer' && (
        <div className="h-8 bg-gray-900 border-t border-gray-800 flex items-center px-4">
          <p className="text-gray-600 text-xs">
            {viewerMode === 'forge'
              ? 'Autodesk APS Viewer — Visualização nativa de modelos BIM'
              : 'Modo Visualizador 3D — Use as abas 4D/5D para análise temporal e de custos'}
          </p>
        </div>
      )}
    </div>
  )
}
