import { useRef, useState, useCallback, useEffect } from 'react'
import { Trash2, X } from 'lucide-react'
import { useFluxogramaStore } from '@/store/fluxogramaStore'
import type { FluxoNode, FluxoNodeStatus, FluxoNodeType } from '@/types'

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_W = 160
const NODE_H = 60

const STATUS_COLOR: Record<FluxoNodeStatus, string> = {
  concluido: '#22c55e',
  em_andamento: '#f97316',
  pendente: '#6b6b6b',
  bloqueado: '#ef4444',
}

const STATUS_LABELS: Record<FluxoNodeStatus, string> = {
  concluido: 'Concluido',
  em_andamento: 'Em Andamento',
  pendente: 'Pendente',
  bloqueado: 'Bloqueado',
}

const TYPE_LABELS: Record<FluxoNodeType, string> = {
  etapa: 'Etapa',
  decisao: 'Decisao',
  marco: 'Marco',
  inicio: 'Inicio',
  fim: 'Fim',
}

// ─── Tiny SVG icons for node types ───────────────────────────────────────────

function TypeIcon({ type, x, y }: { type: FluxoNodeType; x: number; y: number }) {
  const cx = x + 14
  const cy = y + 14
  switch (type) {
    case 'inicio':
      return <polygon points={`${cx - 4},${cy - 5} ${cx + 5},${cy} ${cx - 4},${cy + 5}`} fill="white" opacity={0.7} />
    case 'fim':
      return <rect x={cx - 4} y={cy - 4} width={8} height={8} fill="white" opacity={0.7} />
    case 'decisao':
      return <polygon points={`${cx},${cy - 5} ${cx + 5},${cy} ${cx},${cy + 5} ${cx - 5},${cy}`} fill="white" opacity={0.7} />
    case 'marco':
      return (
        <g opacity={0.7}>
          <line x1={cx - 1} y1={cy - 5} x2={cx - 1} y2={cy + 5} stroke="white" strokeWidth={1.5} />
          <polygon points={`${cx - 1},${cy - 5} ${cx + 5},${cy - 2} ${cx - 1},${cy + 1}`} fill="white" />
        </g>
      )
    default: // etapa
      return <circle cx={cx} cy={cy} r={4} fill="white" opacity={0.7} />
  }
}

// ─── Edge path computation ───────────────────────────────────────────────────

function computeEdgePath(
  fromNode: FluxoNode,
  toNode: FluxoNode,
): { path: string; midX: number; midY: number } {
  const x1 = fromNode.x + NODE_W / 2
  const y1 = fromNode.y + NODE_H / 2
  const x2 = toNode.x + NODE_W / 2
  const y2 = toNode.y + NODE_H / 2

  const dx = x2 - x1
  const dy = y2 - y1

  // For mostly-vertical connections use straight line, otherwise curve
  if (Math.abs(dx) < 40) {
    return {
      path: `M${x1},${y1} L${x2},${y2}`,
      midX: (x1 + x2) / 2,
      midY: (y1 + y2) / 2,
    }
  }

  // Quadratic bezier with perpendicular offset
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const len = Math.sqrt(dx * dx + dy * dy)
  const perpX = -dy / len
  const perpY = dx / len
  const offset = Math.min(60, len * 0.2)
  const cx = mx + perpX * offset
  const cy = my + perpY * offset

  return {
    path: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`,
    midX: cx,
    midY: cy,
  }
}

// ─── Detail Panel ────────────────────────────────────────────────────────────

function DetailPanel({ node }: { node: FluxoNode }) {
  const { updateNode, removeNode, setSelectedNode, nodes, addEdge, edges } = useFluxogramaStore()

  const otherNodes = nodes.filter((n) => n.id !== node.id)
  const connectedTo = new Set(edges.filter((e) => e.from === node.id).map((e) => e.to))

  return (
    <div className="w-[280px] shrink-0 bg-[#3d3d3d] border-l border-[#525252] p-4 overflow-y-auto flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Detalhes do No</h3>
        <button onClick={() => setSelectedNode(null)} className="text-[#6b6b6b] hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Label */}
      <div>
        <label className="text-[#a3a3a3] text-xs block mb-1">Nome</label>
        <input
          value={node.label}
          onChange={(e) => updateNode(node.id, { label: e.target.value })}
          className="w-full bg-[#484848] border border-[#525252] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[#a3a3a3] text-xs block mb-1">Descricao</label>
        <textarea
          value={node.description ?? ''}
          onChange={(e) => updateNode(node.id, { description: e.target.value })}
          rows={3}
          className="w-full bg-[#484848] border border-[#525252] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316] resize-none"
        />
      </div>

      {/* Type */}
      <div>
        <label className="text-[#a3a3a3] text-xs block mb-1">Tipo</label>
        <select
          value={node.type}
          onChange={(e) => updateNode(node.id, { type: e.target.value as FluxoNodeType })}
          className="w-full bg-[#484848] border border-[#525252] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
        >
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div>
        <label className="text-[#a3a3a3] text-xs block mb-1">Status</label>
        <select
          value={node.status}
          onChange={(e) => updateNode(node.id, { status: e.target.value as FluxoNodeStatus })}
          className="w-full bg-[#484848] border border-[#525252] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
        >
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Responsavel */}
      <div>
        <label className="text-[#a3a3a3] text-xs block mb-1">Responsavel</label>
        <input
          value={node.responsavel ?? ''}
          onChange={(e) => updateNode(node.id, { responsavel: e.target.value })}
          className="w-full bg-[#484848] border border-[#525252] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
        />
      </div>

      {/* Dates */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[#a3a3a3] text-xs block mb-1">Inicio</label>
          <input
            type="date"
            value={node.dataInicio ?? ''}
            onChange={(e) => updateNode(node.id, { dataInicio: e.target.value })}
            className="w-full bg-[#484848] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]"
          />
        </div>
        <div className="flex-1">
          <label className="text-[#a3a3a3] text-xs block mb-1">Fim</label>
          <input
            type="date"
            value={node.dataFim ?? ''}
            onChange={(e) => updateNode(node.id, { dataFim: e.target.value })}
            className="w-full bg-[#484848] border border-[#525252] rounded-lg px-2 py-1.5 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]"
          />
        </div>
      </div>

      {/* Progress */}
      <div>
        <label className="text-[#a3a3a3] text-xs block mb-1">Progresso: {node.progressoPct ?? 0}%</label>
        <input
          type="range"
          min={0}
          max={100}
          value={node.progressoPct ?? 0}
          onChange={(e) => updateNode(node.id, { progressoPct: Number(e.target.value) })}
          className="w-full accent-[#f97316]"
        />
      </div>

      {/* Connect to */}
      <div>
        <label className="text-[#a3a3a3] text-xs block mb-1">Conectar a...</label>
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              addEdge({ from: node.id, to: e.target.value, type: 'sequencia' })
            }
          }}
          className="w-full bg-[#484848] border border-[#525252] rounded-lg px-3 py-1.5 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]"
        >
          <option value="">Selecione...</option>
          {otherNodes
            .filter((n) => !connectedTo.has(n.id))
            .map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
        </select>
      </div>

      {/* Delete */}
      <button
        onClick={() => { removeNode(node.id); setSelectedNode(null) }}
        className="flex items-center justify-center gap-2 mt-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 transition-colors"
      >
        <Trash2 size={14} />
        Excluir No
      </button>
    </div>
  )
}

// ─── Main Canvas ─────────────────────────────────────────────────────────────

export function FluxogramaCanvas() {
  const {
    nodes, edges, selectedNodeId, zoom, panX, panY,
    setSelectedNode, moveNode, setZoom, setPan,
  } = useFluxogramaStore()

  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null)
  const [panning, setPanning] = useState<{ startX: number; startY: number; startPanX: number; startPanY: number } | null>(null)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  // Convert screen coords to SVG coords
  const screenToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      return {
        x: (clientX - rect.left - panX) / zoom,
        y: (clientY - rect.top - panY) / zoom,
      }
    },
    [zoom, panX, panY],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only pan on middle-click or when clicking background
      if (e.button === 1 || (e.button === 0 && (e.target as SVGElement).tagName === 'svg')) {
        setPanning({ startX: e.clientX, startY: e.clientY, startPanX: panX, startPanY: panY })
        setSelectedNode(null)
      }
    },
    [panX, panY, setSelectedNode],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        const pos = screenToSvg(e.clientX, e.clientY)
        moveNode(dragging.nodeId, pos.x - dragging.offsetX, pos.y - dragging.offsetY)
      }
      if (panning) {
        const dx = e.clientX - panning.startX
        const dy = e.clientY - panning.startY
        setPan(panning.startPanX + dx, panning.startPanY + dy)
      }
    },
    [dragging, panning, screenToSvg, moveNode, setPan],
  )

  const handleMouseUp = useCallback(() => {
    setDragging(null)
    setPanning(null)
  }, [])

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(zoom + delta)
    },
    [zoom, setZoom],
  )

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation()
      setSelectedNode(nodeId)
      const pos = screenToSvg(e.clientX, e.clientY)
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return
      setDragging({
        nodeId,
        offsetX: pos.x - node.x,
        offsetY: pos.y - node.y,
      })
    },
    [nodes, screenToSvg, setSelectedNode],
  )

  // Prevent default on wheel to allow zoom
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handler = (e: WheelEvent) => e.preventDefault()
    svg.addEventListener('wheel', handler, { passive: false })
    return () => svg.removeEventListener('wheel', handler)
  }, [])

  // Build node map for edge lookups
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div className="flex h-full overflow-hidden">
      {/* SVG canvas */}
      <div className="flex-1 relative overflow-hidden bg-[#2c2c2c]">
        {/* Zoom indicator */}
        <div className="absolute top-3 left-3 z-10 bg-[#3d3d3d] border border-[#525252] rounded-lg px-3 py-1 text-[#a3a3a3] text-xs font-mono select-none">
          {Math.round(zoom * 100)}%
        </div>

        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Defs */}
          <defs>
            {/* Grid pattern */}
            <pattern id="grid-dots" width={20} height={20} patternUnits="userSpaceOnUse">
              <circle cx={10} cy={10} r={0.8} fill="#3d3d3d" />
            </pattern>
            {/* Arrow marker */}
            <marker id="arrow" viewBox="0 0 10 10" refX={10} refY={5} markerWidth={8} markerHeight={8} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" fill="#525252" />
            </marker>
            <marker id="arrow-selected" viewBox="0 0 10 10" refX={10} refY={5} markerWidth={8} markerHeight={8} orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 Z" fill="#f97316" />
            </marker>
          </defs>

          {/* Background grid */}
          <rect width="100%" height="100%" fill="url(#grid-dots)" />

          {/* Transform group */}
          <g transform={`translate(${panX},${panY}) scale(${zoom})`}>
            {/* Edges */}
            {edges.map((edge) => {
              const fromNode = nodeMap.get(edge.from)
              const toNode = nodeMap.get(edge.to)
              if (!fromNode || !toNode) return null

              const isSelected = edge.from === selectedNodeId || edge.to === selectedNodeId
              const { path, midX, midY } = computeEdgePath(fromNode, toNode)
              const color = isSelected ? '#f97316' : '#525252'

              return (
                <g key={edge.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={isSelected ? 2 : 1.5}
                    markerEnd={isSelected ? 'url(#arrow-selected)' : 'url(#arrow)'}
                    strokeDasharray={edge.type === 'condicional' ? '6,3' : edge.type === 'dependencia' ? '4,2' : undefined}
                  />
                  {edge.label && (
                    <>
                      <rect
                        x={midX - 18}
                        y={midY - 9}
                        width={36}
                        height={18}
                        rx={4}
                        fill="#2c2c2c"
                        stroke={color}
                        strokeWidth={0.5}
                      />
                      <text
                        x={midX}
                        y={midY + 4}
                        textAnchor="middle"
                        fill={color}
                        fontSize={10}
                        fontWeight={600}
                      >
                        {edge.label}
                      </text>
                    </>
                  )}
                </g>
              )
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = node.id === selectedNodeId
              const fill = STATUS_COLOR[node.status]

              return (
                <g
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Selection glow */}
                  {isSelected && (
                    <rect
                      x={node.x - 3}
                      y={node.y - 3}
                      width={NODE_W + 6}
                      height={NODE_H + 6}
                      rx={11}
                      fill="none"
                      stroke="#f97316"
                      strokeWidth={2}
                      opacity={0.8}
                    />
                  )}

                  {/* Node body */}
                  <rect
                    x={node.x}
                    y={node.y}
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill={fill}
                    opacity={0.9}
                  />

                  {/* Type icon */}
                  <TypeIcon type={node.type} x={node.x} y={node.y} />

                  {/* Label */}
                  <text
                    x={node.x + NODE_W / 2}
                    y={node.y + NODE_H / 2 + 4}
                    textAnchor="middle"
                    fill="white"
                    fontSize={12}
                    fontWeight={600}
                  >
                    {node.label.length > 18 ? node.label.slice(0, 16) + '...' : node.label}
                  </text>

                  {/* Progress bar */}
                  {node.progressoPct != null && node.progressoPct > 0 && (
                    <>
                      <rect
                        x={node.x + 8}
                        y={node.y + NODE_H - 10}
                        width={NODE_W - 16}
                        height={4}
                        rx={2}
                        fill="rgba(0,0,0,0.3)"
                      />
                      <rect
                        x={node.x + 8}
                        y={node.y + NODE_H - 10}
                        width={(NODE_W - 16) * (node.progressoPct / 100)}
                        height={4}
                        rx={2}
                        fill="white"
                        opacity={0.7}
                      />
                    </>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Detail panel */}
      {selectedNode && <DetailPanel node={selectedNode} />}
    </div>
  )
}
