import { Layers, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBimStore } from '@/store/bimStore'
import type { BimTab } from '@/types'

const TABS: { key: BimTab; label: string }[] = [
  { key: 'viewer', label: 'Visualizador 3D' },
  { key: '4d',     label: 'Análise 4D (Prazo)' },
  { key: '5d',     label: 'Análise 5D (Custo)' },
]

interface Props {
  onUploadClick: () => void
}

export function BimHeader({ onUploadClick }: Props) {
  const activeTab = useBimStore((s) => s.activeTab)
  const setActiveTab = useBimStore((s) => s.setActiveTab)

  return (
    <div className="flex items-center justify-between h-14 px-4 bg-gray-900 border-b border-gray-800 shrink-0">
      {/* Logo + title */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shrink-0">
          <Layers size={16} className="text-white" />
        </div>
        <span className="text-gray-100 font-semibold text-sm">BIM 3D / 4D / 5D</span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              activeTab === t.key
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-gray-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Upload SHP */}
      <button
        onClick={onUploadClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
      >
        <Upload size={14} />
        Importar Shapefile
      </button>
    </div>
  )
}
