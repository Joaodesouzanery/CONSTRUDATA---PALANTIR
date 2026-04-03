import { create } from 'zustand'
import type { FluxogramaTab, FluxoNode, FluxoEdge } from '@/types'

interface FluxogramaState {
  activeTab: FluxogramaTab
  nodes: FluxoNode[]
  edges: FluxoEdge[]
  selectedNodeId: string | null
  zoom: number
  panX: number
  panY: number

  setActiveTab: (tab: FluxogramaTab) => void
  addNode: (node: Omit<FluxoNode, 'id'>) => string
  updateNode: (id: string, patch: Partial<FluxoNode>) => void
  removeNode: (id: string) => void
  moveNode: (id: string, x: number, y: number) => void
  addEdge: (edge: Omit<FluxoEdge, 'id'>) => void
  removeEdge: (id: string) => void
  setSelectedNode: (id: string | null) => void
  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  loadDemoData: () => void
  clearData: () => void
}

let _nextId = 1
function uid(prefix = 'n') {
  return `${prefix}-${Date.now()}-${_nextId++}`
}

export const useFluxogramaStore = create<FluxogramaState>((set) => ({
  activeTab: 'canvas',
  nodes: [],
  edges: [],
  selectedNodeId: null,
  zoom: 1,
  panX: 0,
  panY: 0,

  setActiveTab: (tab) => set({ activeTab: tab }),

  addNode: (node) => {
    const id = uid('n')
    set((s) => ({ nodes: [...s.nodes, { ...node, id }] }))
    return id
  },

  updateNode: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.from !== id && e.to !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    })),

  moveNode: (id, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    })),

  addEdge: (edge) => {
    const id = uid('e')
    set((s) => ({ edges: [...s.edges, { ...edge, id }] }))
  },

  removeEdge: (id) =>
    set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  setZoom: (zoom) => set({ zoom: Math.max(0.2, Math.min(3, zoom)) }),

  setPan: (x, y) => set({ panX: x, panY: y }),

  loadDemoData: () => {
    const nodes: FluxoNode[] = [
      { id: 'demo-1',  label: 'Inicio',              type: 'inicio',  status: 'concluido',    x: 400, y: 40,   progressoPct: 100, responsavel: 'Eng. Silva' },
      { id: 'demo-2',  label: 'Mobilizacao',          type: 'etapa',   status: 'concluido',    x: 400, y: 240,  progressoPct: 100, responsavel: 'Eng. Silva',       description: 'Mobilizacao de equipes e equipamentos', dataInicio: '2026-01-05', dataFim: '2026-01-10' },
      { id: 'demo-3',  label: 'Sinalizacao',          type: 'etapa',   status: 'concluido',    x: 400, y: 440,  progressoPct: 100, responsavel: 'Tec. Santos',      description: 'Sinalizacao viaria e seguranca', dataInicio: '2026-01-11', dataFim: '2026-01-13' },
      { id: 'demo-4',  label: 'Escavacao',            type: 'etapa',   status: 'concluido',    x: 400, y: 640,  progressoPct: 100, responsavel: 'Op. Oliveira',     description: 'Escavacao de vala', dataInicio: '2026-01-14', dataFim: '2026-01-25' },
      { id: 'demo-5',  label: 'Lastro',               type: 'etapa',   status: 'em_andamento', x: 400, y: 840,  progressoPct: 65,  responsavel: 'Op. Oliveira',     description: 'Preparo do lastro de brita', dataInicio: '2026-01-26' },
      { id: 'demo-6',  label: 'Assentamento',         type: 'etapa',   status: 'em_andamento', x: 400, y: 1040, progressoPct: 30,  responsavel: 'Eng. Costa',       description: 'Assentamento de tubulacao', dataInicio: '2026-02-01' },
      { id: 'demo-7',  label: 'Teste Hidrostatico',   type: 'etapa',   status: 'pendente',     x: 400, y: 1240, progressoPct: 0,   responsavel: 'Eng. Costa',       description: 'Teste de estanqueidade' },
      { id: 'demo-8',  label: 'Aprovado?',            type: 'decisao', status: 'pendente',     x: 400, y: 1440, progressoPct: 0,   responsavel: 'Fiscal Sabesp',    description: 'Decisao de aprovacao do teste' },
      { id: 'demo-9',  label: 'Reaterro',             type: 'etapa',   status: 'pendente',     x: 400, y: 1640, progressoPct: 0,   responsavel: 'Op. Oliveira',     description: 'Reaterro compactado da vala' },
      { id: 'demo-10', label: 'Pavimentacao',         type: 'etapa',   status: 'pendente',     x: 400, y: 1840, progressoPct: 0,   responsavel: 'Eq. Pavimentacao', description: 'Recomposicao do pavimento' },
      { id: 'demo-11', label: 'Cadastro',             type: 'marco',   status: 'pendente',     x: 400, y: 2040, progressoPct: 0,   responsavel: 'Eng. Silva',       description: 'Cadastro tecnico as-built' },
      { id: 'demo-12', label: 'Fim',                  type: 'fim',     status: 'pendente',     x: 400, y: 2240, progressoPct: 0 },
      { id: 'demo-13', label: 'Refazer Teste',        type: 'etapa',   status: 'bloqueado',    x: 700, y: 1440, progressoPct: 0,   responsavel: 'Eng. Costa',       description: 'Reteste em caso de reprovacao' },
    ]

    const edges: FluxoEdge[] = [
      { id: 'ed-1',  from: 'demo-1',  to: 'demo-2',  type: 'sequencia' },
      { id: 'ed-2',  from: 'demo-2',  to: 'demo-3',  type: 'sequencia' },
      { id: 'ed-3',  from: 'demo-3',  to: 'demo-4',  type: 'sequencia' },
      { id: 'ed-4',  from: 'demo-4',  to: 'demo-5',  type: 'dependencia' },
      { id: 'ed-5',  from: 'demo-5',  to: 'demo-6',  type: 'dependencia' },
      { id: 'ed-6',  from: 'demo-6',  to: 'demo-7',  type: 'sequencia' },
      { id: 'ed-7',  from: 'demo-7',  to: 'demo-8',  type: 'sequencia' },
      { id: 'ed-8',  from: 'demo-8',  to: 'demo-9',  type: 'condicional', label: 'Sim' },
      { id: 'ed-9',  from: 'demo-8',  to: 'demo-13', type: 'condicional', label: 'Nao' },
      { id: 'ed-10', from: 'demo-13', to: 'demo-7',  type: 'dependencia' },
      { id: 'ed-11', from: 'demo-9',  to: 'demo-10', type: 'sequencia' },
      { id: 'ed-12', from: 'demo-10', to: 'demo-11', type: 'sequencia' },
      { id: 'ed-13', from: 'demo-11', to: 'demo-12', type: 'sequencia' },
    ]

    set({ nodes, edges, selectedNodeId: null, zoom: 1, panX: 0, panY: 0 })
  },

  clearData: () =>
    set({ nodes: [], edges: [], selectedNodeId: null, zoom: 1, panX: 0, panY: 0 }),
}))
