import { useBimStore } from '@/store/bimStore'
import { Building2, DollarSign, Eye, EyeOff } from 'lucide-react'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function BimLeftPanel() {
  const project = useBimStore((s) => s.project)
  const layers = useBimStore((s) => s.layers)
  const toggleLayer = useBimStore((s) => s.toggleLayer)

  if (!project) {
    return (
      <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col items-center justify-center p-4 shrink-0">
        <Building2 size={32} className="text-gray-700 mb-2" />
        <p className="text-gray-600 text-xs text-center">Importe um Shapefile para visualizar a rede</p>
      </div>
    )
  }

  const totalCost = project.segments.reduce((sum, s) => sum + s.totalCostBRL, 0)
  const totalLength = project.segments.reduce((sum, s) => sum + s.lengthM, 0)

  return (
    <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 overflow-y-auto">
      {/* Project info */}
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <Building2 size={14} className="text-indigo-400 shrink-0" />
          <span className="text-gray-100 text-xs font-semibold truncate">{project.name}</span>
        </div>
        <div className="space-y-1">
          <Row label="Trechos" value={String(project.segments.length)} />
          <Row label="Extensão total" value={`${totalLength.toFixed(0)} m`} />
          <Row label="Fonte" value={project.shapefileSourceName} truncate />
          <Row label="Importado em" value={new Date(project.uploadedAt).toLocaleDateString('pt-BR')} />
        </div>
      </div>

      {/* Budget summary */}
      <div className="p-3 border-b border-gray-800">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign size={14} className="text-green-400 shrink-0" />
          <span className="text-gray-100 text-xs font-semibold">Custo Total</span>
        </div>
        <p className="text-green-400 font-bold text-base">{fmtBRL(totalCost)}</p>
        <p className="text-gray-500 text-xs mt-0.5">
          Custo médio: {fmtBRL(totalLength > 0 ? Math.round(totalCost / totalLength) : 0)}/m
        </p>
      </div>

      {/* Layers */}
      <div className="p-3 flex-1">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Camadas</p>
        <div className="space-y-1">
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => toggleLayer(layer.id)}
              className="flex items-center gap-2 w-full text-left rounded px-2 py-1 hover:bg-gray-800 transition-colors group"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: layer.visible ? layer.color : '#4b5563' }}
              />
              <span className={`text-xs flex-1 truncate ${layer.visible ? 'text-gray-200' : 'text-gray-600'}`}>
                {layer.name}
              </span>
              {layer.visible
                ? <Eye size={12} className="text-gray-500 group-hover:text-gray-300 shrink-0" />
                : <EyeOff size={12} className="text-gray-600 shrink-0" />
              }
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-gray-600 text-xs">{label}</span>
      <span className={`text-gray-300 text-xs font-medium ${truncate ? 'truncate max-w-[100px]' : ''}`}>{value}</span>
    </div>
  )
}
