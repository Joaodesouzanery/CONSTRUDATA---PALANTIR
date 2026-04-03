import { X } from 'lucide-react'

interface FluxogramaLegendaProps {
  onClose: () => void
  offsetRight?: boolean
}

const STATUS_ITEMS = [
  { label: 'Concluido', color: '#22c55e' },
  { label: 'Em Andamento', color: '#f97316' },
  { label: 'Pendente', color: '#6b6b6b' },
  { label: 'Bloqueado', color: '#ef4444' },
]

const TYPE_ITEMS = [
  { label: 'Inicio', icon: 'play' },
  { label: 'Etapa', icon: 'circle' },
  { label: 'Decisao', icon: 'diamond' },
  { label: 'Marco', icon: 'flag' },
  { label: 'Fim', icon: 'square' },
]

const EDGE_ITEMS = [
  { label: 'Sequencia', dash: '' },
  { label: 'Dependencia', dash: '4,2' },
  { label: 'Condicional', dash: '6,3' },
]

function TypeIconSvg({ icon }: { icon: string }) {
  const size = 16
  const cx = size / 2
  const cy = size / 2
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {icon === 'play' && (
        <polygon points={`${cx - 3},${cy - 4} ${cx + 4},${cy} ${cx - 3},${cy + 4}`} fill="#a3a3a3" />
      )}
      {icon === 'circle' && <circle cx={cx} cy={cy} r={4} fill="#a3a3a3" />}
      {icon === 'diamond' && (
        <polygon points={`${cx},${cy - 5} ${cx + 5},${cy} ${cx},${cy + 5} ${cx - 5},${cy}`} fill="#a3a3a3" />
      )}
      {icon === 'flag' && (
        <g>
          <line x1={cx - 2} y1={cy - 5} x2={cx - 2} y2={cy + 5} stroke="#a3a3a3" strokeWidth={1.5} />
          <polygon points={`${cx - 2},${cy - 5} ${cx + 5},${cy - 2} ${cx - 2},${cy + 1}`} fill="#a3a3a3" />
        </g>
      )}
      {icon === 'square' && <rect x={cx - 4} y={cy - 4} width={8} height={8} fill="#a3a3a3" />}
    </svg>
  )
}

export function FluxogramaLegenda({ onClose, offsetRight }: FluxogramaLegendaProps) {
  return (
    <div
      className="absolute top-3 z-20 w-56 bg-[#3d3d3d] border border-[#525252] rounded-xl shadow-lg overflow-hidden"
      style={{ right: offsetRight ? '304px' : '12px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252]">
        <h3 className="text-[#f5f5f5] text-sm font-semibold">Legenda</h3>
        <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Status */}
        <div>
          <p className="text-[#a3a3a3] text-[10px] uppercase tracking-wider font-semibold mb-2">Status</p>
          <div className="space-y-1.5">
            {STATUS_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[#f5f5f5] text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Node Types */}
        <div>
          <p className="text-[#a3a3a3] text-[10px] uppercase tracking-wider font-semibold mb-2">Tipos de No</p>
          <div className="space-y-1.5">
            {TYPE_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <TypeIconSvg icon={item.icon} />
                <span className="text-[#f5f5f5] text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Edge Types */}
        <div>
          <p className="text-[#a3a3a3] text-[10px] uppercase tracking-wider font-semibold mb-2">Tipos de Conexao</p>
          <div className="space-y-1.5">
            {EDGE_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <svg width={24} height={8} viewBox="0 0 24 8" className="shrink-0">
                  <line
                    x1={0}
                    y1={4}
                    x2={24}
                    y2={4}
                    stroke="#a3a3a3"
                    strokeWidth={1.5}
                    strokeDasharray={item.dash || undefined}
                  />
                </svg>
                <span className="text-[#f5f5f5] text-xs">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
