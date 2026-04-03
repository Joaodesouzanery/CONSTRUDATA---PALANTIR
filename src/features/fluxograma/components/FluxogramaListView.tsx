import { useFluxogramaStore } from '@/store/fluxogramaStore'
import type { FluxoNodeStatus, FluxoNodeType } from '@/types'

const STATUS_COLOR: Record<FluxoNodeStatus, string> = {
  concluido: '#22c55e',
  em_andamento: '#f97316',
  pendente: '#6b6b6b',
  bloqueado: '#ef4444',
}

const STATUS_LABEL: Record<FluxoNodeStatus, string> = {
  concluido: 'Concluido',
  em_andamento: 'Em Andamento',
  pendente: 'Pendente',
  bloqueado: 'Bloqueado',
}

const TYPE_LABEL: Record<FluxoNodeType, string> = {
  etapa: 'Etapa',
  decisao: 'Decisao',
  marco: 'Marco',
  inicio: 'Inicio',
  fim: 'Fim',
}

export function FluxogramaListView() {
  const { nodes, edges, selectedNodeId, setSelectedNode } = useFluxogramaStore()

  // Build outgoing connections map
  const outgoing = new Map<string, string[]>()
  for (const edge of edges) {
    const list = outgoing.get(edge.from) ?? []
    list.push(edge.to)
    outgoing.set(edge.from, list)
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#6b6b6b] text-sm">
        Nenhuma etapa cadastrada. Clique em "Carregar Demo" para comecar.
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#484848] text-[#a3a3a3] text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3 font-semibold">#</th>
              <th className="text-left px-4 py-3 font-semibold">Etapa</th>
              <th className="text-left px-4 py-3 font-semibold">Tipo</th>
              <th className="text-left px-4 py-3 font-semibold">Status</th>
              <th className="text-left px-4 py-3 font-semibold">Responsavel</th>
              <th className="text-left px-4 py-3 font-semibold">Inicio</th>
              <th className="text-left px-4 py-3 font-semibold">Fim</th>
              <th className="text-left px-4 py-3 font-semibold">Progresso</th>
              <th className="text-left px-4 py-3 font-semibold">Conexoes</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node, idx) => {
              const isSelected = node.id === selectedNodeId
              const connections = outgoing.get(node.id) ?? []

              return (
                <tr
                  key={node.id}
                  onClick={() => setSelectedNode(isSelected ? null : node.id)}
                  className={`
                    border-t border-[#525252] cursor-pointer transition-colors
                    ${isSelected ? 'bg-[#f97316]/10' : 'hover:bg-[#484848]'}
                  `}
                >
                  {/* # */}
                  <td className="px-4 py-3 text-[#6b6b6b] font-mono">{idx + 1}</td>

                  {/* Etapa */}
                  <td className="px-4 py-3 text-[#f5f5f5] font-medium">{node.label}</td>

                  {/* Tipo */}
                  <td className="px-4 py-3 text-[#a3a3a3]">{TYPE_LABEL[node.type]}</td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: STATUS_COLOR[node.status] }}
                      />
                      <span className="text-[#f5f5f5]">{STATUS_LABEL[node.status]}</span>
                    </span>
                  </td>

                  {/* Responsavel */}
                  <td className="px-4 py-3 text-[#a3a3a3]">{node.responsavel ?? '-'}</td>

                  {/* Inicio */}
                  <td className="px-4 py-3 text-[#a3a3a3] font-mono text-xs">{node.dataInicio ?? '-'}</td>

                  {/* Fim */}
                  <td className="px-4 py-3 text-[#a3a3a3] font-mono text-xs">{node.dataFim ?? '-'}</td>

                  {/* Progresso */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-[#484848] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${node.progressoPct ?? 0}%`,
                            backgroundColor: STATUS_COLOR[node.status],
                          }}
                        />
                      </div>
                      <span className="text-[#a3a3a3] text-xs font-mono">{node.progressoPct ?? 0}%</span>
                    </div>
                  </td>

                  {/* Conexoes */}
                  <td className="px-4 py-3 text-[#a3a3a3] text-xs">
                    {connections.length === 0 ? (
                      '-'
                    ) : (
                      connections.map((toId, ci) => {
                        const target = nodeMap.get(toId)
                        return (
                          <span key={toId}>
                            {ci > 0 && ', '}
                            <span className="text-[#f97316]">&rarr;</span>{' '}
                            {target?.label ?? toId}
                          </span>
                        )
                      })
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
