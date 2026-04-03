import { useState, useMemo, useCallback, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { useFluxogramaStore } from '@/store/fluxogramaStore'
import type { FluxoNodeStatus, FluxoNodeType } from '@/types'

interface FluxogramaConsultasProps {
  onClose: () => void
}

const STATUS_OPTIONS: { key: FluxoNodeStatus; label: string; color: string }[] = [
  { key: 'concluido', label: 'Concluido', color: '#22c55e' },
  { key: 'em_andamento', label: 'Em Andamento', color: '#f97316' },
  { key: 'pendente', label: 'Pendente', color: '#6b6b6b' },
  { key: 'bloqueado', label: 'Bloqueado', color: '#ef4444' },
]

const TYPE_OPTIONS: { key: FluxoNodeType; label: string }[] = [
  { key: 'etapa', label: 'Etapa' },
  { key: 'decisao', label: 'Decisao' },
  { key: 'marco', label: 'Marco' },
  { key: 'inicio', label: 'Inicio' },
  { key: 'fim', label: 'Fim' },
]

export function FluxogramaConsultas({ onClose }: FluxogramaConsultasProps) {
  const { nodes, setFilteredNodes, setSelectedNode } = useFluxogramaStore()

  const [searchText, setSearchText] = useState('')
  const [activeStatuses, setActiveStatuses] = useState<Set<FluxoNodeStatus>>(new Set())
  const [activeTypes, setActiveTypes] = useState<Set<FluxoNodeType>>(new Set())
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>('')

  // Unique responsaveis
  const responsaveis = useMemo(() => {
    const set = new Set<string>()
    for (const node of nodes) {
      if (node.responsavel) set.add(node.responsavel)
    }
    return Array.from(set).sort()
  }, [nodes])

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      // Text search
      if (searchText) {
        const term = searchText.toLowerCase()
        const inLabel = node.label.toLowerCase().includes(term)
        const inDesc = node.description?.toLowerCase().includes(term)
        const inResp = node.responsavel?.toLowerCase().includes(term)
        if (!inLabel && !inDesc && !inResp) return false
      }

      // Status filter
      if (activeStatuses.size > 0 && !activeStatuses.has(node.status)) return false

      // Type filter
      if (activeTypes.size > 0 && !activeTypes.has(node.type)) return false

      // Responsavel filter
      if (selectedResponsavel && node.responsavel !== selectedResponsavel) return false

      return true
    })
  }, [nodes, searchText, activeStatuses, activeTypes, selectedResponsavel])

  // Update store filter whenever filteredNodes changes
  const hasActiveFilter = searchText || activeStatuses.size > 0 || activeTypes.size > 0 || selectedResponsavel

  useEffect(() => {
    if (hasActiveFilter) {
      setFilteredNodes(filteredNodes.map((n) => n.id))
    } else {
      setFilteredNodes(null)
    }
  }, [filteredNodes, hasActiveFilter, setFilteredNodes])

  // Clear filters on close
  const handleClose = useCallback(() => {
    setFilteredNodes(null)
    onClose()
  }, [setFilteredNodes, onClose])

  const toggleStatus = useCallback((status: FluxoNodeStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }, [])

  const toggleType = useCallback((type: FluxoNodeType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setSearchText('')
    setActiveStatuses(new Set())
    setActiveTypes(new Set())
    setSelectedResponsavel('')
  }, [])

  return (
    <div className="absolute top-3 right-3 z-20 w-72 bg-[#3d3d3d] border border-[#525252] rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[calc(100%-24px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252] shrink-0">
        <h3 className="text-[#f5f5f5] text-sm font-semibold">Consultas</h3>
        <button onClick={handleClose} className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar etapas..."
            className="w-full bg-[#484848] border border-[#525252] rounded-lg pl-8 pr-3 py-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316] placeholder:text-[#6b6b6b]"
          />
        </div>

        {/* Status filter */}
        <div>
          <p className="text-[#a3a3a3] text-[10px] uppercase tracking-wider font-semibold mb-2">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => {
              const active = activeStatuses.has(opt.key)
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleStatus(opt.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                    active
                      ? 'border-[#f97316] bg-[#f97316]/20 text-[#f5f5f5]'
                      : 'border-[#525252] bg-[#484848] text-[#a3a3a3] hover:text-[#f5f5f5]'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Type filter */}
        <div>
          <p className="text-[#a3a3a3] text-[10px] uppercase tracking-wider font-semibold mb-2">Tipo</p>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_OPTIONS.map((opt) => {
              const active = activeTypes.has(opt.key)
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleType(opt.key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border ${
                    active
                      ? 'border-[#f97316] bg-[#f97316]/20 text-[#f5f5f5]'
                      : 'border-[#525252] bg-[#484848] text-[#a3a3a3] hover:text-[#f5f5f5]'
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Responsavel filter */}
        {responsaveis.length > 0 && (
          <div>
            <p className="text-[#a3a3a3] text-[10px] uppercase tracking-wider font-semibold mb-2">Responsavel</p>
            <select
              value={selectedResponsavel}
              onChange={(e) => setSelectedResponsavel(e.target.value)}
              className="w-full bg-[#484848] border border-[#525252] rounded-lg px-3 py-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]"
            >
              <option value="">Todos</option>
              {responsaveis.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}

        {/* Clear filters */}
        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            className="w-full px-3 py-1.5 rounded-lg text-xs font-medium text-[#a3a3a3] hover:text-[#f5f5f5] bg-[#484848] hover:bg-[#525252] transition-colors"
          >
            Limpar Filtros
          </button>
        )}

        {/* Summary */}
        <div className="text-[#a3a3a3] text-xs">
          <span className="text-[#f97316] font-semibold">{filteredNodes.length}</span> de{' '}
          <span className="font-semibold">{nodes.length}</span> etapas
        </div>

        {/* Results list */}
        <div className="space-y-1">
          {filteredNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => setSelectedNode(node.id)}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#484848] hover:bg-[#525252] transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      node.status === 'concluido' ? '#22c55e'
                      : node.status === 'em_andamento' ? '#f97316'
                      : node.status === 'bloqueado' ? '#ef4444'
                      : '#6b6b6b',
                  }}
                />
                <span className="text-[#f5f5f5] text-xs font-medium truncate">{node.label}</span>
              </div>
              {node.responsavel && (
                <p className="text-[#6b6b6b] text-[10px] ml-4 mt-0.5">{node.responsavel}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
