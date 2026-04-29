import { useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { AlertTriangle, Boxes, Building2, CheckCircle2, Factory, Filter, GitBranch, PackageCheck, Plus, Search, Store, Trash2, Truck, Users } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { cn } from '@/lib/utils'
import {
  useSuprimentosStore,
  type SupplyChainAlertPriority,
  type SupplyChainAlertStatus,
  type SupplyChainNode,
  type SupplyChainNodeType,
  type SupplyChainPlan,
  type SupplyChainRiskType,
} from '@/store/suprimentosStore'

type CadeiaTab = 'cadeia_rede' | 'cadeia_alertas' | 'cadeia_planejamento'

interface Props {
  activeTab: CadeiaTab
}

const nodeTypeOptions: SupplyChainNodeType[] = ['cliente', 'centro_distribuicao', 'planta', 'fornecedor']
const statusOptions: SupplyChainNode['status'][] = ['normal', 'atenção', 'crítico']
const alertStatusOptions: SupplyChainAlertStatus[] = ['aberto', 'em_analise', 'mitigado', 'resolvido']
const priorityOptions: SupplyChainAlertPriority[] = ['crítica', 'alta', 'média', 'baixa']
const riskTypeOptions: SupplyChainRiskType[] = ['atraso_fornecedor', 'falha_producao', 'ruptura_estoque', 'logistica', 'custo', 'qualidade']

const typeLabel: Record<SupplyChainNodeType, string> = {
  cliente: 'Cliente',
  centro_distribuicao: 'Centro de Distribuição',
  planta: 'Planta',
  fornecedor: 'Fornecedor',
}

const riskLabel: Record<SupplyChainRiskType, string> = {
  atraso_fornecedor: 'Atraso de fornecedor',
  falha_producao: 'Falha de produção',
  ruptura_estoque: 'Ruptura de estoque',
  logistica: 'Logística',
  custo: 'Custo',
  qualidade: 'Qualidade',
}

const alertStatusLabel: Record<SupplyChainAlertStatus, string> = {
  aberto: 'Aberto',
  em_analise: 'Em análise',
  mitigado: 'Mitigado',
  resolvido: 'Resolvido',
}

const planStatusLabel: Record<SupplyChainPlan['status'], string> = {
  monitorando: 'Monitorando',
  em_execucao: 'Em execução',
  concluido: 'Concluído',
}

const typeColor: Record<SupplyChainNodeType, string> = {
  cliente: '#38bdf8',
  centro_distribuicao: '#a78bfa',
  planta: '#fbbf24',
  fornecedor: '#4ade80',
}

const statusColor: Record<SupplyChainNode['status'], string> = {
  normal: '#4ade80',
  atenção: '#fbbf24',
  crítico: '#f87171',
}

const priorityColor: Record<SupplyChainAlertPriority, string> = {
  crítica: '#f87171',
  alta: '#fb923c',
  média: '#fbbf24',
  baixa: '#4ade80',
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function createNodeIcon(node: SupplyChainNode, selected: boolean) {
  const color = statusColor[node.status]
  const ring = typeColor[node.tipo]
  const abbrev = node.tipo === 'centro_distribuicao' ? 'CD' : typeLabel[node.tipo].slice(0, 1)
  const material = escapeHtml(node.material.slice(0, 18))
  return L.divIcon({
    className: '',
    iconSize: [selected ? 54 : 46, selected ? 62 : 54],
    iconAnchor: [selected ? 27 : 23, selected ? 31 : 27],
    popupAnchor: [0, -26],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;font-family:Inter,system-ui,sans-serif;">
        <div style="width:${selected ? 42 : 34}px;height:${selected ? 42 : 34}px;border-radius:999px;background:${color};border:3px solid ${ring};display:flex;align-items:center;justify-content:center;color:#111827;font-weight:900;font-size:12px;box-shadow:0 8px 18px rgba(0,0,0,.35);">${abbrev}</div>
        <div style="max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:rgba(31,31,31,.92);border:1px solid ${ring}66;border-radius:4px;padding:2px 5px;color:#f5f5f5;font-size:9px;font-weight:700;">${material}</div>
      </div>
    `,
  })
}

function SmallInput({ value, onChange, type = 'text', className }: { value: string | number; onChange: (value: string) => void; type?: string; className?: string }) {
  return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={cn('h-8 w-full rounded border border-[#525252] bg-[#2c2c2c] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/70', className)} />
}

function SmallSelect<T extends string>({ value, options, onChange, labels }: { value: T; options: T[]; onChange: (value: T) => void; labels?: Record<string, string> }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as T)} className="h-8 w-full rounded border border-[#525252] bg-[#2c2c2c] px-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/70">
      {options.map((option) => <option key={option} value={option}>{labels?.[option] ?? option}</option>)}
    </select>
  )
}

function Kpi({ label, value, icon, tone = 'text-[#f5f5f5]' }: { label: string; value: string | number; icon: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#3d3d3d] p-3">
      <div className="flex items-center gap-2 text-[#d4d4d4]">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn('mt-2 text-xl font-bold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

export function CadeiaSuprimentosPanel({ activeTab }: Props) {
  if (activeTab === 'cadeia_alertas') return <AlertasCadeiaPanel />
  if (activeTab === 'cadeia_planejamento') return <PlanejamentoCadeiaPanel />
  return <RedeCadeiaPanel />
}

function RedeCadeiaPanel() {
  const {
    nodes,
    addNode,
    updateNode,
    removeNode,
  } = useSuprimentosStore(
    useShallow((s) => ({
      nodes: s.supplyChainNodes,
      addNode: s.addSupplyChainNode,
      updateNode: s.updateSupplyChainNode,
      removeNode: s.removeSupplyChainNode,
    })),
  )
  const [selectedId, setSelectedId] = useState(nodes[0]?.id ?? '')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | SupplyChainNodeType>('todos')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | SupplyChainNode['status']>('todos')
  const [busca, setBusca] = useState('')

  const filtered = useMemo(() => nodes.filter((node) => {
    const text = `${node.nome} ${node.material} ${node.cidade}`.toLowerCase()
    return (tipoFiltro === 'todos' || node.tipo === tipoFiltro)
      && (statusFiltro === 'todos' || node.status === statusFiltro)
      && (!busca.trim() || text.includes(busca.toLowerCase()))
  }), [nodes, tipoFiltro, statusFiltro, busca])

  const selected = nodes.find((node) => node.id === selectedId) ?? filtered[0]
  const center: [number, number] = selected ? [selected.latitude, selected.longitude] : [-23.55, -46.63]
  const otifMedio = nodes.length > 0 ? Math.round(nodes.reduce((acc, node) => acc + node.otif, 0) / nodes.length) : 0
  const usoMensal = nodes.reduce((acc, node) => acc + node.usoMensal, 0)

  function addDefaultNode() {
    addNode({
      tipo: 'fornecedor',
      nome: 'Novo fornecedor',
      material: 'Material',
      cidade: 'São Paulo/SP',
      latitude: -23.5505,
      longitude: -46.6333,
      status: 'normal',
      otif: 90,
      usoMensal: 0,
      capacidade: 0,
      leadTimeDias: 5,
      contato: '',
      observacoes: '',
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi label="No prazo e completo (OTIF)" value={`${otifMedio}%`} icon={<PackageCheck size={15} className="text-[#4ade80]" />} tone="text-[#4ade80]" />
        <Kpi label="Uso mensal" value={usoMensal.toLocaleString('pt-BR')} icon={<Boxes size={15} className="text-[#38bdf8]" />} tone="text-[#38bdf8]" />
        <Kpi label="Clientes" value={nodes.filter((node) => node.tipo === 'cliente').length} icon={<Users size={15} className="text-[#38bdf8]" />} />
        <Kpi label="Centros de Distribuição" value={nodes.filter((node) => node.tipo === 'centro_distribuicao').length} icon={<Building2 size={15} className="text-[#a78bfa]" />} />
        <Kpi label="Plantas" value={nodes.filter((node) => node.tipo === 'planta').length} icon={<Factory size={15} className="text-[#fbbf24]" />} />
        <Kpi label="Fornecedores" value={nodes.filter((node) => node.tipo === 'fornecedor').length} icon={<Truck size={15} className="text-[#4ade80]" />} />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] p-3">
        <Filter size={15} className="text-[#f97316]" />
        <select value={tipoFiltro} onChange={(event) => setTipoFiltro(event.target.value as 'todos' | SupplyChainNodeType)} className="h-8 rounded border border-[#525252] bg-[#2c2c2c] px-2 text-xs text-[#f5f5f5]">
          <option value="todos">Todos os tipos</option>
          {nodeTypeOptions.map((option) => <option key={option} value={option}>{typeLabel[option]}</option>)}
        </select>
        <select value={statusFiltro} onChange={(event) => setStatusFiltro(event.target.value as 'todos' | SupplyChainNode['status'])} className="h-8 rounded border border-[#525252] bg-[#2c2c2c] px-2 text-xs text-[#f5f5f5]">
          <option value="todos">Todos os status</option>
          {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <div className="relative min-w-[240px] flex-1">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#b8b8b8]" />
          <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar por nome, material ou cidade" className="h-8 w-full rounded border border-[#525252] bg-[#2c2c2c] pl-8 pr-2 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/70" />
        </div>
        <button onClick={addDefaultNode} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ea580c]">
          <Plus size={14} /> Novo nó
        </button>
      </div>

      <div className="grid min-h-[520px] gap-4 xl:grid-cols-[1.25fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-[#525252] bg-[#333333]">
          <div className="flex items-center justify-between border-b border-[#525252] px-4 py-3">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-[#f97316]" />
              <span className="text-sm font-semibold">Rede logística com mapa OpenStreetMap</span>
            </div>
            <span className="text-xs text-[#b8b8b8]">{filtered.length} nó(s)</span>
          </div>
          <div className="h-[455px]">
            <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }} className="leaflet-embedded">
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {filtered.map((node) => (
                <Marker key={node.id} position={[node.latitude, node.longitude]} icon={createNodeIcon(node, node.id === selected?.id)} eventHandlers={{ click: () => setSelectedId(node.id) }}>
                  <Tooltip direction="top">{node.nome} - {node.material}</Tooltip>
                  <Popup>
                    <div style={{ minWidth: 220 }}>
                      <strong>{node.nome}</strong>
                      <div>{typeLabel[node.tipo]} - {node.cidade}</div>
                      <div>Material: {node.material}</div>
                      <div>OTIF: {node.otif}%</div>
                      <button onClick={() => setSelectedId(node.id)} style={{ marginTop: 8, width: '100%', border: '1px solid #ddd', borderRadius: 6, padding: '4px 8px' }}>Editar</button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        <div className="rounded-lg border border-[#525252] bg-[#333333]">
          <div className="border-b border-[#525252] px-4 py-3">
            <p className="text-sm font-semibold">Informações editáveis</p>
            <p className="text-xs text-[#b8b8b8]">Selecione um nó no mapa ou na lista.</p>
          </div>
          <div className="max-h-[500px] overflow-y-auto p-3">
            {filtered.map((node) => (
              <div key={node.id} className={cn('mb-3 rounded-lg border p-3', selected?.id === node.id ? 'border-[#f97316]/60 bg-[#f97316]/10' : 'border-[#525252] bg-[#2f2f2f]')}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button onClick={() => setSelectedId(node.id)} className="flex min-w-0 items-center gap-2 text-left">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: statusColor[node.status] }} />
                    <span className="truncate text-sm font-semibold">{node.nome}</span>
                  </button>
                  <button onClick={() => removeNode(node.id)} className="rounded p-1 text-[#b8b8b8] hover:text-[#f87171]" title="Remover nó"><Trash2 size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SmallSelect value={node.tipo} options={nodeTypeOptions} labels={typeLabel} onChange={(value) => updateNode(node.id, { tipo: value })} />
                  <SmallSelect value={node.status} options={statusOptions} onChange={(value) => updateNode(node.id, { status: value })} />
                  <SmallInput value={node.nome} onChange={(value) => updateNode(node.id, { nome: value })} className="col-span-2" />
                  <SmallInput value={node.material} onChange={(value) => updateNode(node.id, { material: value })} />
                  <SmallInput value={node.cidade} onChange={(value) => updateNode(node.id, { cidade: value })} />
                  <SmallInput type="number" value={node.latitude} onChange={(value) => updateNode(node.id, { latitude: Number(value) })} />
                  <SmallInput type="number" value={node.longitude} onChange={(value) => updateNode(node.id, { longitude: Number(value) })} />
                  <SmallInput type="number" value={node.otif} onChange={(value) => updateNode(node.id, { otif: Number(value) })} />
                  <SmallInput type="number" value={node.usoMensal} onChange={(value) => updateNode(node.id, { usoMensal: Number(value) })} />
                  <SmallInput type="number" value={node.capacidade} onChange={(value) => updateNode(node.id, { capacidade: Number(value) })} />
                  <SmallInput type="number" value={node.leadTimeDias} onChange={(value) => updateNode(node.id, { leadTimeDias: Number(value) })} />
                  <SmallInput value={node.contato} onChange={(value) => updateNode(node.id, { contato: value })} className="col-span-2" />
                  <SmallInput value={node.observacoes} onChange={(value) => updateNode(node.id, { observacoes: value })} className="col-span-2" />
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-[#b8b8b8]">Nenhum nó encontrado com os filtros atuais.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function AlertasCadeiaPanel() {
  const { alerts, updateAlert, removeAlert, addAlert } = useSuprimentosStore(
    useShallow((s) => ({
      alerts: s.supplyChainAlerts,
      updateAlert: s.updateSupplyChainAlert,
      removeAlert: s.removeSupplyChainAlert,
      addAlert: s.addSupplyChainAlert,
    })),
  )
  const [status, setStatus] = useState<'todos' | SupplyChainAlertStatus>('todos')
  const [priority, setPriority] = useState<'todos' | SupplyChainAlertPriority>('todos')
  const [risk, setRisk] = useState<'todos' | SupplyChainRiskType>('todos')

  const filtered = alerts.filter((alert) =>
    (status === 'todos' || alert.status === status)
    && (priority === 'todos' || alert.prioridade === priority)
    && (risk === 'todos' || alert.tipoRisco === risk)
  )

  const overview = {
    abertos: alerts.filter((alert) => alert.status === 'aberto').length,
    criticos: alerts.filter((alert) => alert.prioridade === 'crítica').length,
    mitigados: alerts.filter((alert) => alert.status === 'mitigado' || alert.status === 'resolvido').length,
    fornecedores: new Set(alerts.map((alert) => alert.fornecedor)).size,
  }

  function addDefaultAlert() {
    addAlert({
      titulo: 'Novo alerta de cadeia',
      status: 'aberto',
      prioridade: 'média',
      tipoRisco: 'logistica',
      planta: 'Planta Atlântico Norte',
      fornecedor: 'Fornecedor',
      visaoGeral: 'Descreva o risco, impacto e ação recomendada.',
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Alertas abertos" value={overview.abertos} icon={<AlertTriangle size={15} className="text-[#f87171]" />} tone="text-[#f87171]" />
        <Kpi label="Prioridade crítica" value={overview.criticos} icon={<AlertTriangle size={15} className="text-[#fb923c]" />} tone="text-[#fb923c]" />
        <Kpi label="Mitigados/resolvidos" value={overview.mitigados} icon={<CheckCircle2 size={15} className="text-[#4ade80]" />} tone="text-[#4ade80]" />
        <Kpi label="Fornecedores envolvidos" value={overview.fornecedores} icon={<Truck size={15} className="text-[#38bdf8]" />} tone="text-[#38bdf8]" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] p-3">
        <Filter size={15} className="text-[#f97316]" />
        <select value={status} onChange={(event) => setStatus(event.target.value as 'todos' | SupplyChainAlertStatus)} className="h-8 rounded border border-[#525252] bg-[#2c2c2c] px-2 text-xs text-[#f5f5f5]">
          <option value="todos">Todos os status</option>
          {alertStatusOptions.map((option) => <option key={option} value={option}>{alertStatusLabel[option]}</option>)}
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value as 'todos' | SupplyChainAlertPriority)} className="h-8 rounded border border-[#525252] bg-[#2c2c2c] px-2 text-xs text-[#f5f5f5]">
          <option value="todos">Todas as prioridades</option>
          {priorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={risk} onChange={(event) => setRisk(event.target.value as 'todos' | SupplyChainRiskType)} className="h-8 rounded border border-[#525252] bg-[#2c2c2c] px-2 text-xs text-[#f5f5f5]">
          <option value="todos">Todos os tipos de risco</option>
          {riskTypeOptions.map((option) => <option key={option} value={option}>{riskLabel[option]}</option>)}
        </select>
        <button onClick={addDefaultAlert} className="ml-auto inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ea580c]">
          <Plus size={14} /> Novo alerta
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#525252] bg-[#333333]">
        <table className="w-full min-w-[1100px] text-xs">
          <thead>
            <tr className="border-b border-[#525252] bg-[#3d3d3d] text-left text-[#d4d4d4]">
              {['Título', 'Status', 'Prioridade', 'Tipo de risco', 'Planta', 'Fornecedor', 'Visão geral', 'Criado em', ''].map((head) => <th key={head} className="px-3 py-2 font-semibold">{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((alert) => (
              <tr key={alert.id} className="border-b border-[#525252]/60">
                <td className="px-3 py-2"><SmallInput value={alert.titulo} onChange={(value) => updateAlert(alert.id, { titulo: value })} className="min-w-[220px]" /></td>
                <td className="px-3 py-2"><SmallSelect value={alert.status} options={alertStatusOptions} labels={alertStatusLabel} onChange={(value) => updateAlert(alert.id, { status: value })} /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: priorityColor[alert.prioridade] }} />
                    <SmallSelect value={alert.prioridade} options={priorityOptions} onChange={(value) => updateAlert(alert.id, { prioridade: value })} />
                  </div>
                </td>
                <td className="px-3 py-2"><SmallSelect value={alert.tipoRisco} options={riskTypeOptions} labels={riskLabel} onChange={(value) => updateAlert(alert.id, { tipoRisco: value })} /></td>
                <td className="px-3 py-2"><SmallInput value={alert.planta} onChange={(value) => updateAlert(alert.id, { planta: value })} /></td>
                <td className="px-3 py-2"><SmallInput value={alert.fornecedor} onChange={(value) => updateAlert(alert.id, { fornecedor: value })} /></td>
                <td className="px-3 py-2"><SmallInput value={alert.visaoGeral} onChange={(value) => updateAlert(alert.id, { visaoGeral: value })} className="min-w-[320px]" /></td>
                <td className="px-3 py-2 text-[#d4d4d4]">{new Date(alert.criadoEm).toLocaleDateString('pt-BR')}</td>
                <td className="px-3 py-2"><button onClick={() => removeAlert(alert.id)} className="rounded p-1 text-[#b8b8b8] hover:text-[#f87171]"><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-[#b8b8b8]">Nenhum alerta encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlanejamentoCadeiaPanel() {
  const { plans, updatePlan, addPlan, removePlan } = useSuprimentosStore(
    useShallow((s) => ({
      plans: s.supplyChainPlans,
      updatePlan: s.updateSupplyChainPlan,
      addPlan: s.addSupplyChainPlan,
      removePlan: s.removeSupplyChainPlan,
    })),
  )
  const tools = [
    { title: 'Atendimento omnicanal', icon: <Store size={17} />, text: 'Fonte única da verdade para equipes de comercialização, distribuição e operação colaborarem na entrega certa, no local certo e no momento certo.' },
    { title: 'Gestão de estoque', icon: <Boxes size={17} />, text: 'Antecipe rupturas com mais antecedência, simule decisões de trade-off e redirecione entregas com base na demanda em tempo real.' },
    { title: 'Visibilidade 360 dos dados', icon: <GitBranch size={17} />, text: 'Virtualize a rede de valor com clientes, lojas, produtos, fornecedores, plantas, CDs e ativos críticos em uma visão integrada.' },
    { title: 'Otimização do custo de atendimento', icon: <PackageCheck size={17} />, text: 'Precifique SKUs pelo custo real de atendimento e conecte custos aos eventos e entidades que os geram.' },
    { title: 'Desempenho ponta a ponta do fornecedor', icon: <Truck size={17} />, text: 'Acesse KPIs principais de qualquer fornecedor, incluindo OTIF, lead time, qualidade, custo e tendência de confiabilidade.' },
    { title: 'Interface varejista/fornecedor', icon: <Users size={17} />, text: 'Compartilhe pedidos, solicitações, preços, bônus futuros e informações operacionais em uma ferramenta comum.' },
    { title: 'Negociação com fornecedor', icon: <Factory size={17} />, text: 'Use a visão 360 do fornecedor para negociar preços melhores e aumentar alavancagem nas discussões comerciais.' },
  ]

  function addDefaultPlan() {
    addPlan({
      nome: 'Novo plano autônomo',
      processo: 'S&OE',
      status: 'monitorando',
      gatilho: 'Descreva o evento de risco monitorado.',
      solucao: 'Descreva a solução automática ou recomendada.',
      aderenciaPlano: 90,
      impactoOtif: 2,
      resiliencia: 85,
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-[#525252] bg-[#333333] p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-lg font-bold">Planejamento Autônomo e Execução</h3>
            <p className="mt-1 max-w-4xl text-sm text-[#d4d4d4]">
              Integra processos de S&OE e S&OP, informa o planejamento, gera alertas proativos sobre execução quase em tempo real e recomenda soluções automáticas diante de atraso de fornecedor ou falha produtiva.
            </p>
          </div>
          <button onClick={addDefaultPlan} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white hover:bg-[#ea580c]">
            <Plus size={14} /> Novo plano
          </button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-lg border border-[#525252] bg-[#3d3d3d] p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <SmallInput value={plan.nome} onChange={(value) => updatePlan(plan.id, { nome: value })} className="mb-2 min-w-full font-semibold" />
                <div className="grid grid-cols-2 gap-2">
                  <SmallSelect value={plan.processo} options={['S&OE', 'S&OP']} onChange={(value) => updatePlan(plan.id, { processo: value })} />
                  <SmallSelect value={plan.status} options={['monitorando', 'em_execucao', 'concluido']} labels={planStatusLabel} onChange={(value) => updatePlan(plan.id, { status: value })} />
                </div>
              </div>
              <button onClick={() => removePlan(plan.id)} className="rounded p-1 text-[#b8b8b8] hover:text-[#f87171]"><Trash2 size={14} /></button>
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-[#d4d4d4]">Gatilho</label>
              <SmallInput value={plan.gatilho} onChange={(value) => updatePlan(plan.id, { gatilho: value })} />
              <label className="block text-[11px] font-semibold text-[#d4d4d4]">Solução implantada automaticamente</label>
              <SmallInput value={plan.solucao} onChange={(value) => updatePlan(plan.id, { solucao: value })} />
              <div className="grid grid-cols-3 gap-2 pt-2">
                <MetricInput label="Aderência" value={plan.aderenciaPlano} onChange={(value) => updatePlan(plan.id, { aderenciaPlano: value })} suffix="%" />
                <MetricInput label="Impacto OTIF" value={plan.impactoOtif} onChange={(value) => updatePlan(plan.id, { impactoOtif: value })} suffix="p.p." />
                <MetricInput label="Resiliência" value={plan.resiliencia} onChange={(value) => updatePlan(plan.id, { resiliencia: value })} suffix="%" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-lg font-bold">Ferramentas de decisão</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <div key={tool.title} className="rounded-lg border border-[#525252] bg-[#333333] p-4">
              <div className="mb-2 flex items-center gap-2 text-[#f97316]">
                {tool.icon}
                <p className="font-semibold text-[#f5f5f5]">{tool.title}</p>
              </div>
              <p className="text-sm leading-relaxed text-[#d4d4d4]">{tool.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricInput({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#2f2f2f] p-2">
      <p className="text-[10px] text-[#b8b8b8]">{label}</p>
      <div className="mt-1 flex items-center gap-1">
        <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-7 w-full rounded border border-[#525252] bg-[#2c2c2c] px-2 text-xs font-bold text-[#f5f5f5] outline-none focus:border-[#f97316]/70" />
        <span className="text-[10px] text-[#d4d4d4]">{suffix}</span>
      </div>
    </div>
  )
}
