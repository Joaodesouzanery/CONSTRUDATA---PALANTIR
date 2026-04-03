import { GitBranch, Download, Trash2, Upload, FileDown, FileSpreadsheet, BookOpen, Search } from 'lucide-react'
import { useFluxogramaStore } from '@/store/fluxogramaStore'
import { cn } from '@/lib/utils'
import { exportFluxogramaExcel, exportFluxogramaTemplate } from '../utils/parseFluxogramaExcel'
import type { FluxogramaTab } from '@/types'

const TABS: { key: FluxogramaTab; label: string }[] = [
  { key: 'canvas', label: 'Canvas' },
  { key: 'lista',  label: 'Lista' },
]

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 min-w-[120px]">
      <p className="text-[#a3a3a3] text-xs mb-1">{label}</p>
      <p className="font-mono text-lg font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}

interface FluxogramaHeaderProps {
  onOpenImport: () => void
  showLegenda: boolean
  onToggleLegenda: () => void
  showConsultas: boolean
  onToggleConsultas: () => void
}

export function FluxogramaHeader({
  onOpenImport,
  showLegenda,
  onToggleLegenda,
  showConsultas,
  onToggleConsultas,
}: FluxogramaHeaderProps) {
  const { activeTab, setActiveTab, nodes, edges, loadDemoData, clearData } = useFluxogramaStore()

  const total       = nodes.filter((n) => n.type === 'etapa' || n.type === 'decisao' || n.type === 'marco').length
  const concluidas  = nodes.filter((n) => n.status === 'concluido').length
  const emAndamento = nodes.filter((n) => n.status === 'em_andamento').length
  const bloqueadas  = nodes.filter((n) => n.status === 'bloqueado').length

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <GitBranch size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">
              Fluxograma da Obra
            </h1>
            <p className="text-[#a3a3a3] text-xs">Workflow de Construcao</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Import Excel */}
          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <Upload size={15} />
            Importar Excel
          </button>

          {/* Export Excel */}
          <button
            onClick={() => exportFluxogramaExcel(nodes, edges)}
            disabled={nodes.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileDown size={15} />
            Exportar Excel
          </button>

          {/* Export Template */}
          <button
            onClick={() => exportFluxogramaTemplate()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <FileSpreadsheet size={15} />
            Exportar Modelo
          </button>

          {/* Legenda toggle */}
          <button
            onClick={onToggleLegenda}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              showLegenda
                ? 'bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/40'
                : 'bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]',
            )}
          >
            <BookOpen size={15} />
            Legenda
          </button>

          {/* Consultas toggle */}
          <button
            onClick={onToggleConsultas}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              showConsultas
                ? 'bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/40'
                : 'bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]',
            )}
          >
            <Search size={15} />
            Consultas
          </button>

          {/* Demo / Clear */}
          <button
            onClick={loadDemoData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] transition-colors hover:bg-[#ea580c]"
          >
            <Download size={15} />
            Carregar Demo
          </button>
          <button
            onClick={clearData}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <Trash2 size={15} />
            Limpar
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        <KpiCard label="Total Etapas"  value={total}       color="#f5f5f5" />
        <KpiCard label="Concluidas"    value={concluidas}  color="#22c55e" />
        <KpiCard label="Em Andamento"  value={emAndamento} color="#f97316" />
        <KpiCard label="Bloqueadas"    value={bloqueadas}  color="#ef4444" />
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2',
                  isActive
                    ? 'text-white border-orange-500 bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
