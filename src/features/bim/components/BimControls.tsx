import { RotateCcw, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBimStore } from '@/store/bimStore'
import type { BimColorMode } from '@/types'

const COLOR_MODES: { key: BimColorMode; label: string; dot: string }[] = [
  { key: 'default', label: 'Material', dot: '#6366f1' },
  { key: 'depth',   label: 'Profundidade', dot: '#3b82f6' },
  { key: 'date',    label: 'Prazo (4D)', dot: '#f59e0b' },
  { key: 'cost',    label: 'Custo (5D)', dot: '#ef4444' },
]

export function BimControls() {
  const colorMode = useBimStore((s) => s.colorMode)
  const setColorMode = useBimStore((s) => s.setColorMode)

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/80 border-b border-gray-700">
      {/* Color mode selector */}
      <span className="text-gray-500 text-xs font-medium mr-1">Coloração:</span>
      {COLOR_MODES.map((m) => (
        <button
          key={m.key}
          onClick={() => setColorMode(m.key)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
            colorMode === m.key
              ? 'bg-gray-700 text-gray-100'
              : 'text-gray-500 hover:text-gray-300',
          )}
        >
          <Circle size={8} fill={m.dot} stroke="none" />
          {m.label}
        </button>
      ))}

      {/* Reset button placeholder — actual camera reset handled by OrbitControls target reset */}
      <button
        onClick={() => window.location.reload()}
        title="Resetar câmera (recarregar)"
        className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 text-xs transition-colors"
      >
        <RotateCcw size={13} />
        Reset
      </button>
    </div>
  )
}
