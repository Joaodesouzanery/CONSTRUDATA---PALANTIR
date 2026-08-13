import { useEffect, useMemo, useState } from 'react'
import ELK from 'elkjs/lib/elk.bundled.js'
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ResultadoDescoberta } from '../core/index.ts'

interface DadosNo extends Record<string, unknown> {
  label: string
  occurrences: number
  cases: number
}

const elk = new ELK()

async function criarLayout(result: ResultadoDescoberta) {
  const concurrencyPairs = new Set(
    result.possibleConcurrency.map(({ firstActivity, secondActivity }) => (
      [firstActivity, secondActivity].sort().join('\u001f')
    )),
  )
  const graph = await elk.layout({
    id: 'processos',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '52',
      'elk.layered.spacing.nodeNodeBetweenLayers': '86',
    },
    children: result.nodes.map((node) => ({ id: node.key, width: 176, height: 68 })),
    edges: result.edges
      .filter(({ from, to }) => from !== to)
      .map((edge) => ({ id: edge.key, sources: [edge.from], targets: [edge.to] })),
  })
  const positions = new Map(graph.children?.map((node) => [node.id, node]) ?? [])
  const nodes: Node<DadosNo>[] = result.nodes.map((node) => {
    const position = positions.get(node.key)
    return {
      id: node.key,
      position: { x: position?.x ?? 0, y: position?.y ?? 0 },
      data: { label: node.activity, occurrences: node.occurrenceCount, cases: node.caseCount },
      style: {
        width: 176,
        minHeight: 68,
        borderRadius: 12,
        border: '1px solid rgba(249,115,22,.55)',
        background: '#262626',
        color: '#f5f5f5',
        fontSize: 12,
        fontWeight: 650,
        boxShadow: '0 10px 24px rgba(0,0,0,.22)',
      },
    }
  })
  const maxFrequency = Math.max(1, ...result.edges.map(({ occurrenceCount }) => occurrenceCount))
  const edges: Edge[] = result.edges.map((edge) => ({
    id: `flow:${edge.key}`,
    source: edge.from,
    target: edge.to,
    label: edge.occurrenceCount.toLocaleString('pt-BR'),
    markerEnd: { type: MarkerType.ArrowClosed, color: edge.isForbidden ? '#ef4444' : '#f97316' },
    animated: edge.isForbidden,
    style: {
      stroke: edge.isForbidden ? '#ef4444' : edge.isLoop ? '#f59e0b' : '#f97316',
      strokeWidth: 1.5 + (edge.occurrenceCount / maxFrequency) * 4,
      strokeDasharray: edge.isForbidden ? '7 5' : undefined,
    },
    labelStyle: { fill: '#d4d4d4', fontSize: 10 },
    labelBgStyle: { fill: '#171717', fillOpacity: 0.85 },
  }))
  for (const relation of result.possibleConcurrency) {
    const pairKey = [relation.firstActivity, relation.secondActivity].sort().join('\u001f')
    if (!concurrencyPairs.has(pairKey)) continue
    edges.push({
      id: `concurrency:${pairKey}`,
      source: relation.firstActivity,
      target: relation.secondActivity,
      label: 'sobreposição observada',
      style: { stroke: '#a78bfa', strokeWidth: 2, strokeDasharray: '3 6' },
      labelStyle: { fill: '#c4b5fd', fontSize: 9 },
      labelBgStyle: { fill: '#171717', fillOpacity: 0.9 },
    })
  }
  return { nodes, edges }
}

export function MapaProcessos({ result }: { result: ResultadoDescoberta }) {
  const [nodes, setNodes] = useState<Node<DadosNo>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selected, setSelected] = useState<DadosNo | null>(null)
  const layoutIdentity = useMemo(
    () => `${result.input.inputChecksum}:${result.nodes.length}:${result.edges.length}`,
    [result],
  )

  useEffect(() => {
    let active = true
    void criarLayout(result).then((layout) => {
      if (!active) return
      setNodes(layout.nodes)
      setEdges(layout.edges)
    })
    return () => { active = false }
  }, [layoutIdentity, result])

  return (
    <div className="relative h-[520px] overflow-hidden rounded-2xl border border-[#404040] bg-[#171717]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        minZoom={0.2}
        maxZoom={2}
        onNodeClick={(_, node) => setSelected(node.data)}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#404040" gap={22} size={1} />
        <Controls className="!border-[#525252] !bg-[#262626] !text-white" />
        <MiniMap
          nodeColor="#f97316"
          maskColor="rgba(12,12,12,.72)"
          className="!border !border-[#404040] !bg-[#262626]"
        />
      </ReactFlow>
      <div className="pointer-events-none absolute left-3 top-3 max-w-[290px] rounded-xl border border-[#404040] bg-[#171717]/95 p-3 text-[10px] text-[#a3a3a3] shadow-xl">
        <div className="mb-2 font-semibold uppercase tracking-wider text-[#e5e5e5]">Legenda</div>
        <div><span className="text-[#f97316]">━━</span> transição observada</div>
        <div><span className="text-[#ef4444]">┅┅</span> transição proibida observada</div>
        <div><span className="text-[#a78bfa]">┅┅</span> possível concorrência por sobreposição temporal</div>
        <p className="mt-2 leading-relaxed text-[#737373]">
          Sobreposição não prova paralelismo estrutural, causalidade ou fork/join.
        </p>
      </div>
      {selected && (
        <div className="absolute bottom-3 left-3 rounded-xl border border-[#525252] bg-[#262626]/95 p-3 text-xs text-[#d4d4d4] shadow-xl">
          <div className="font-semibold text-white">{selected.label}</div>
          <div className="mt-1">{selected.occurrences.toLocaleString('pt-BR')} ocorrências</div>
          <div>{selected.cases.toLocaleString('pt-BR')} casos</div>
        </div>
      )}
    </div>
  )
}
