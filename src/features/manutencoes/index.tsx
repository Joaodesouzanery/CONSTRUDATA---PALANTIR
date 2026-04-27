import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit2,
  Filter,
  MapPin,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  Wrench,
  X,
} from 'lucide-react'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'

type MaintenanceTab = 'ativos' | 'tarefas' | 'solicitacoes'
type TaskStatus = 'pendente' | 'em_processo' | 'em_verificacao' | 'concluido'
type Priority = 'baixa' | 'media' | 'alta' | 'critica'
type QrStatus = 'ativo' | 'inativo'

interface AssetRecord {
  id: string
  name: string
  type: string
  location: string
  responsible: string
  project: string
}

interface MaintenanceTask {
  id: string
  title: string
  assetId: string
  assetName: string
  location: string
  responsible: string
  project: string
  priority: Priority
  status: TaskStatus
  dueDate: string
  description: string
}

interface MaintenanceQr {
  id: string
  local: string
  project: string
  description: string
  status: QrStatus
  createdAt: string
}

interface MaintenanceState {
  assets: AssetRecord[]
  tasks: MaintenanceTask[]
  qrs: MaintenanceQr[]
}

interface AssetForm {
  name: string
  type: string
  location: string
  responsible: string
  project: string
}

interface TaskForm {
  title: string
  assetId: string
  location: string
  responsible: string
  project: string
  priority: Priority
  status: TaskStatus
  dueDate: string
  description: string
}

interface QrForm {
  local: string
  project: string
  description: string
  status: QrStatus
}

const STORAGE_KEY = 'cdata-manutencoes'

const statusColumns: { key: TaskStatus; label: string; tone: string }[] = [
  { key: 'pendente', label: 'Pendente', tone: 'border-[#fbbf24]/35 bg-[#ca8a04]/10' },
  { key: 'em_processo', label: 'Em Processo', tone: 'border-[#38bdf8]/35 bg-[#0284c7]/10' },
  { key: 'em_verificacao', label: 'Em Verificacao', tone: 'border-[#a78bfa]/35 bg-[#7c3aed]/10' },
  { key: 'concluido', label: 'Concluido', tone: 'border-[#4ade80]/35 bg-[#16a34a]/10' },
]

const priorityClass: Record<Priority, string> = {
  baixa: 'bg-[#16a34a]/15 text-[#4ade80]',
  media: 'bg-[#0284c7]/15 text-[#38bdf8]',
  alta: 'bg-[#ca8a04]/15 text-[#fbbf24]',
  critica: 'bg-[#dc2626]/15 text-[#f87171]',
}

const inputClass = 'w-full rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]/60'
const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]'

const emptyAssetForm: AssetForm = {
  name: '',
  type: '',
  location: '',
  responsible: '',
  project: '',
}

const emptyTaskForm: TaskForm = {
  title: '',
  assetId: '',
  location: '',
  responsible: '',
  project: '',
  priority: 'media',
  status: 'pendente',
  dueDate: '',
  description: '',
}

const emptyQrForm: QrForm = {
  local: '',
  project: '',
  description: '',
  status: 'ativo',
}

const seedState: MaintenanceState = {
  assets: [
    { id: 'atv-001', name: 'Bomba de recalque BR-02', type: 'Bomba', location: 'Elevatoria Norte', responsible: 'Carlos Lima', project: 'SABESP Lote 03' },
    { id: 'atv-002', name: 'Gerador GG-110', type: 'Gerador', location: 'Canteiro Central', responsible: 'Marina Alves', project: 'SABESP Lote 03' },
    { id: 'atv-003', name: 'Painel eletrico PE-07', type: 'Painel Eletrico', location: 'Rua Sao Manoel', responsible: 'Equipe Eletrica', project: 'Rede Agua Norte' },
  ],
  tasks: [
    { id: 'mnt-001', title: 'Inspecionar vedacao da bomba', assetId: 'atv-001', assetName: 'Bomba de recalque BR-02', location: 'Elevatoria Norte', responsible: 'Carlos Lima', project: 'SABESP Lote 03', priority: 'alta', status: 'pendente', dueDate: '2026-04-30', description: 'Verificar vazamento no selo mecanico e registrar leitura de vibracao.' },
    { id: 'mnt-002', title: 'Troca preventiva de oleo', assetId: 'atv-002', assetName: 'Gerador GG-110', location: 'Canteiro Central', responsible: 'Marina Alves', project: 'SABESP Lote 03', priority: 'media', status: 'em_processo', dueDate: '2026-05-02', description: 'Servico programado apos 250 horas de operacao.' },
    { id: 'mnt-003', title: 'Validar aterramento do painel', assetId: 'atv-003', assetName: 'Painel eletrico PE-07', location: 'Rua Sao Manoel', responsible: 'Equipe Eletrica', project: 'Rede Agua Norte', priority: 'critica', status: 'em_verificacao', dueDate: '2026-04-28', description: 'Conferir continuidade e atualizar checklist eletrico.' },
    { id: 'mnt-004', title: 'Limpeza de filtros', assetId: 'atv-001', assetName: 'Bomba de recalque BR-02', location: 'Elevatoria Norte', responsible: 'Carlos Lima', project: 'SABESP Lote 03', priority: 'baixa', status: 'concluido', dueDate: '2026-04-22', description: 'Filtros limpos e equipamento liberado.' },
  ],
  qrs: [
    { id: 'qr-001', local: 'Elevatoria Norte', project: 'SABESP Lote 03', description: 'Solicitacoes de bombas, valvulas e sala eletrica.', status: 'ativo', createdAt: '2026-04-20' },
    { id: 'qr-002', local: 'Canteiro Central', project: 'SABESP Lote 03', description: 'Chamados de infraestrutura do canteiro.', status: 'ativo', createdAt: '2026-04-21' },
    { id: 'qr-003', local: 'Rua Sao Manoel', project: 'Rede Agua Norte', description: 'Ponto antigo substituido por novo QR.', status: 'inativo', createdAt: '2026-04-15' },
  ],
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function loadState(): MaintenanceState {
  if (typeof window === 'undefined') return seedState
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedState
    const parsed = JSON.parse(raw) as Partial<MaintenanceState>
    return {
      assets: parsed.assets ?? seedState.assets,
      tasks: parsed.tasks ?? seedState.tasks,
      qrs: parsed.qrs ?? seedState.qrs,
    }
  } catch {
    return seedState
  }
}

function qrPayload(qr: MaintenanceQr) {
  return JSON.stringify({
    modulo: 'manutencoes',
    qrId: qr.id,
    local: qr.local,
    projeto: qr.project,
    acao: 'abrir_solicitacao_manutencao',
  })
}

function hashString(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function qrMatrix(value: string) {
  const size = 21
  const cells = Array.from({ length: size }, () => Array.from({ length: size }, () => false))
  const placeFinder = (x: number, y: number) => {
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const edge = row === 0 || row === 6 || col === 0 || col === 6
        const center = row >= 2 && row <= 4 && col >= 2 && col <= 4
        cells[y + row][x + col] = edge || center
      }
    }
  }
  placeFinder(0, 0)
  placeFinder(size - 7, 0)
  placeFinder(0, size - 7)

  let seed = hashString(value)
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const inFinder = (row < 7 && col < 7) || (row < 7 && col >= size - 7) || (row >= size - 7 && col < 7)
      if (inFinder) continue
      seed = Math.imul(seed ^ (row * 31 + col * 17), 1103515245) + 12345
      cells[row][col] = ((seed >>> 4) & 1) === 1 || (row + col + value.length) % 7 === 0
    }
  }
  return cells
}

function qrSvg(qr: MaintenanceQr) {
  const cells = qrMatrix(qrPayload(qr))
  const cell = 8
  const quiet = 4
  const size = (cells.length + quiet * 2) * cell
  const rects = cells.flatMap((row, y) =>
    row.map((active, x) => active ? `<rect x="${(x + quiet) * cell}" y="${(y + quiet) * cell}" width="${cell}" height="${cell}" />` : '')
  ).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="#ffffff"/><g fill="#111827">${rects}</g></svg>`
}

function downloadQr(qr: MaintenanceQr) {
  const blob = new Blob([qrSvg(qr)], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${qr.local.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-qr.svg`
  link.click()
  URL.revokeObjectURL(url)
}

function printQr(qr: MaintenanceQr) {
  const win = window.open('', '_blank', 'width=640,height=720')
  if (!win) return
  win.document.write(`
    <html>
      <head><title>QR Code - ${qr.local}</title></head>
      <body style="font-family: Arial, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0;">
        <main style="text-align: center;">
          ${qrSvg(qr)}
          <h1 style="font-size: 24px; margin: 20px 0 6px;">${qr.local}</h1>
          <p style="font-size: 14px; color: #444; margin: 0;">${qr.project}</p>
          <p style="font-size: 12px; color: #666; max-width: 360px;">Escaneie para abrir uma solicitacao de manutencao.</p>
        </main>
      </body>
    </html>
  `)
  win.document.close()
  win.focus()
  win.print()
}

function MiniQr({ qr }: { qr: MaintenanceQr }) {
  const cells = qrMatrix(qrPayload(qr))
  return (
    <div className="grid h-24 w-24 shrink-0 grid-cols-[repeat(21,minmax(0,1fr))] rounded bg-white p-1">
      {cells.flatMap((row, y) =>
        row.map((active, x) => (
          <span key={`${y}-${x}`} className={active ? 'bg-[#111827]' : 'bg-white'} />
        ))
      )}
    </div>
  )
}

function StatBox({ label, value, icon: Icon, tone }: { label: string; value: string | number; icon: typeof Wrench; tone: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#a3a3a3]">{label}</span>
        <Icon size={18} className={tone} />
      </div>
      <p className="text-2xl font-bold tabular-nums text-[#f5f5f5]">{value}</p>
    </div>
  )
}

function DroppableColumn({ id, children, className }: { id: TaskStatus; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'ring-2 ring-[#f97316]/60')}>
      {children}
    </div>
  )
}

function TaskCard({ task, onEdit, onDelete }: { task: MaintenanceTask; onEdit: (task: MaintenanceTask) => void; onDelete: (task: MaintenanceTask) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-lg border border-[#525252] bg-[#333333] p-3 shadow-sm transition-shadow',
        isDragging && 'z-50 opacity-80 shadow-2xl',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 cursor-grab text-left active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <p className="truncate text-sm font-semibold text-[#f5f5f5]" title={task.title}>{task.title}</p>
          <p className="mt-1 truncate text-xs text-[#a3a3a3]" title={task.assetName}>{task.assetName || 'Sem ativo vinculado'}</p>
        </button>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', priorityClass[task.priority])}>{task.priority}</span>
      </div>
      <div className="space-y-1 text-xs text-[#a3a3a3]">
        <p className="truncate"><MapPin size={12} className="mr-1 inline" />{task.location || 'Sem local'}</p>
        <p className="truncate">Resp.: {task.responsible || '-'}</p>
        <p className="truncate">Prazo: {task.dueDate || '-'}</p>
      </div>
      <div className="mt-3 flex justify-end gap-1 border-t border-[#525252]/60 pt-2">
        <button type="button" onClick={() => onEdit(task)} className="rounded p-1.5 text-[#a3a3a3] hover:bg-[#484848] hover:text-white" title="Editar tarefa">
          <Edit2 size={14} />
        </button>
        <button type="button" onClick={() => onDelete(task)} className="rounded p-1.5 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]" title="Excluir tarefa">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

export function ManutencoesPage() {
  const [state, setState] = useState<MaintenanceState>(() => loadState())
  const [tab, setTab] = useState<MaintenanceTab>('ativos')

  const [assetSearch, setAssetSearch] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState('todos')
  const [assetProjectFilter, setAssetProjectFilter] = useState('todos')
  const [assetResponsibleFilter, setAssetResponsibleFilter] = useState('todos')

  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null)
  const [assetForm, setAssetForm] = useState<AssetForm>(emptyAssetForm)

  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm)

  const [qrSearch, setQrSearch] = useState('')
  const [qrStatusFilter, setQrStatusFilter] = useState('todos')
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [editingQrId, setEditingQrId] = useState<string | null>(null)
  const [qrForm, setQrForm] = useState<QrForm>(emptyQrForm)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const assetTypes = useMemo(() => ['todos', ...Array.from(new Set(state.assets.map((asset) => asset.type || 'Sem tipo')))], [state.assets])
  const assetProjects = useMemo(() => ['todos', ...Array.from(new Set(state.assets.map((asset) => asset.project || 'Sem projeto')))], [state.assets])
  const assetResponsibles = useMemo(() => ['todos', ...Array.from(new Set(state.assets.map((asset) => asset.responsible || 'Sem responsavel')))], [state.assets])

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase()
    return state.assets.filter((asset) => {
      const text = [asset.name, asset.type, asset.location, asset.responsible, asset.project].join(' ').toLowerCase()
      if (q && !text.includes(q)) return false
      if (assetTypeFilter !== 'todos' && (asset.type || 'Sem tipo') !== assetTypeFilter) return false
      if (assetProjectFilter !== 'todos' && (asset.project || 'Sem projeto') !== assetProjectFilter) return false
      if (assetResponsibleFilter !== 'todos' && (asset.responsible || 'Sem responsavel') !== assetResponsibleFilter) return false
      return true
    })
  }, [assetProjectFilter, assetResponsibleFilter, assetSearch, assetTypeFilter, state.assets])

  const filteredQrs = useMemo(() => {
    const q = qrSearch.trim().toLowerCase()
    return state.qrs.filter((qr) => {
      const text = [qr.local, qr.project, qr.description, qr.status].join(' ').toLowerCase()
      if (q && !text.includes(q)) return false
      if (qrStatusFilter !== 'todos' && qr.status !== qrStatusFilter) return false
      return true
    })
  }, [qrSearch, qrStatusFilter, state.qrs])

  const totalTasks = state.tasks.length
  const taskCounts = {
    pendente: state.tasks.filter((task) => task.status === 'pendente').length,
    emProcesso: state.tasks.filter((task) => task.status === 'em_processo').length,
    concluidas: state.tasks.filter((task) => task.status === 'concluido').length,
  }

  const totalAssets = state.assets.length
  const typeCount = new Set(state.assets.map((asset) => asset.type || 'Sem tipo')).size
  const withResponsible = state.assets.filter((asset) => asset.responsible.trim()).length
  const activeQrs = state.qrs.filter((qr) => qr.status === 'ativo').length
  const inactiveQrs = state.qrs.filter((qr) => qr.status === 'inativo').length

  function openAssetModal(asset?: AssetRecord) {
    setEditingAssetId(asset?.id ?? null)
    setAssetForm(asset ? {
      name: asset.name,
      type: asset.type,
      location: asset.location,
      responsible: asset.responsible,
      project: asset.project,
    } : emptyAssetForm)
    setAssetModalOpen(true)
  }

  function saveAsset() {
    if (!assetForm.name.trim()) return
    const payload: AssetRecord = {
      id: editingAssetId ?? makeId('atv'),
      name: assetForm.name.trim(),
      type: assetForm.type.trim() || 'Sem tipo',
      location: assetForm.location.trim(),
      responsible: assetForm.responsible.trim(),
      project: assetForm.project.trim(),
    }
    setState((current) => ({
      ...current,
      assets: editingAssetId
        ? current.assets.map((asset) => asset.id === editingAssetId ? payload : asset)
        : [...current.assets, payload],
      tasks: current.tasks.map((task) => task.assetId === payload.id ? {
        ...task,
        assetName: payload.name,
        location: payload.location,
        responsible: payload.responsible,
        project: payload.project,
      } : task),
    }))
    setAssetModalOpen(false)
  }

  function deleteAsset(asset: AssetRecord) {
    const ok = window.confirm(`Excluir ativo "${asset.name}"? As tarefas existentes ficarao sem vinculo.`)
    if (!ok) return
    setState((current) => ({
      ...current,
      assets: current.assets.filter((item) => item.id !== asset.id),
      tasks: current.tasks.map((task) => task.assetId === asset.id ? { ...task, assetId: '', assetName: 'Ativo removido' } : task),
    }))
  }

  function openTaskModal(task?: MaintenanceTask, status: TaskStatus = 'pendente') {
    setEditingTaskId(task?.id ?? null)
    setTaskForm(task ? {
      title: task.title,
      assetId: task.assetId,
      location: task.location,
      responsible: task.responsible,
      project: task.project,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      description: task.description,
    } : { ...emptyTaskForm, status })
    setTaskModalOpen(true)
  }

  function applyTaskAsset(assetId: string) {
    const asset = state.assets.find((item) => item.id === assetId)
    setTaskForm((current) => ({
      ...current,
      assetId,
      location: asset?.location ?? current.location,
      responsible: asset?.responsible ?? current.responsible,
      project: asset?.project ?? current.project,
    }))
  }

  function saveTask() {
    if (!taskForm.title.trim()) return
    const asset = state.assets.find((item) => item.id === taskForm.assetId)
    const payload: MaintenanceTask = {
      id: editingTaskId ?? makeId('mnt'),
      title: taskForm.title.trim(),
      assetId: taskForm.assetId,
      assetName: asset?.name ?? 'Sem ativo vinculado',
      location: taskForm.location.trim(),
      responsible: taskForm.responsible.trim(),
      project: taskForm.project.trim(),
      priority: taskForm.priority,
      status: taskForm.status,
      dueDate: taskForm.dueDate,
      description: taskForm.description.trim(),
    }
    setState((current) => ({
      ...current,
      tasks: editingTaskId
        ? current.tasks.map((task) => task.id === editingTaskId ? payload : task)
        : [...current.tasks, payload],
    }))
    setTaskModalOpen(false)
  }

  function deleteTask(task: MaintenanceTask) {
    const ok = window.confirm(`Excluir tarefa "${task.title}"?`)
    if (!ok) return
    setState((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== task.id) }))
  }

  function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id)
    const nextStatus = event.over?.id as TaskStatus | undefined
    if (!nextStatus || !statusColumns.some((column) => column.key === nextStatus)) return
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, status: nextStatus } : task),
    }))
  }

  function openQrModal(qr?: MaintenanceQr) {
    setEditingQrId(qr?.id ?? null)
    setQrForm(qr ? {
      local: qr.local,
      project: qr.project,
      description: qr.description,
      status: qr.status,
    } : emptyQrForm)
    setQrModalOpen(true)
  }

  function saveQr() {
    if (!qrForm.local.trim()) return
    const payload: MaintenanceQr = {
      id: editingQrId ?? makeId('qr'),
      local: qrForm.local.trim(),
      project: qrForm.project.trim(),
      description: qrForm.description.trim(),
      status: qrForm.status,
      createdAt: editingQrId
        ? state.qrs.find((qr) => qr.id === editingQrId)?.createdAt ?? new Date().toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    }
    setState((current) => ({
      ...current,
      qrs: editingQrId
        ? current.qrs.map((qr) => qr.id === editingQrId ? payload : qr)
        : [...current.qrs, payload],
    }))
    setQrModalOpen(false)
  }

  function deleteQr(qr: MaintenanceQr) {
    const ok = window.confirm(`Excluir QR Code de "${qr.local}"?`)
    if (!ok) return
    setState((current) => ({ ...current, qrs: current.qrs.filter((item) => item.id !== qr.id) }))
  }

  function openMaintenanceFromQr(qr?: MaintenanceQr) {
    setTaskForm({
      ...emptyTaskForm,
      title: qr ? `Solicitacao - ${qr.local}` : '',
      location: qr?.local ?? '',
      project: qr?.project ?? '',
      description: qr?.description ?? '',
      priority: 'media',
      status: 'pendente',
    })
    setEditingTaskId(null)
    setMaintenanceModalOpen(true)
  }

  function saveMaintenanceRequest() {
    if (!taskForm.title.trim()) return
    const payload: MaintenanceTask = {
      id: makeId('mnt'),
      title: taskForm.title.trim(),
      assetId: taskForm.assetId,
      assetName: state.assets.find((asset) => asset.id === taskForm.assetId)?.name ?? 'Solicitacao avulsa',
      location: taskForm.location.trim(),
      responsible: taskForm.responsible.trim(),
      project: taskForm.project.trim(),
      priority: taskForm.priority,
      status: 'pendente',
      dueDate: taskForm.dueDate,
      description: taskForm.description.trim(),
    }
    setState((current) => ({ ...current, tasks: [...current.tasks, payload] }))
    setMaintenanceModalOpen(false)
    setTab('tarefas')
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#333333] p-5 text-[#f5f5f5]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Manutencoes</h1>
          <p className="text-sm text-[#a3a3a3]">Ativos, tarefas e solicitacoes conectadas por QR Code.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === 'ativos' && (
            <button type="button" onClick={() => openAssetModal()} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]">
              <Plus size={16} />
              Novo Ativo
            </button>
          )}
          {tab === 'tarefas' && (
            <button type="button" onClick={() => openTaskModal()} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]">
              <Plus size={16} />
              Nova Tarefa
            </button>
          )}
          {tab === 'solicitacoes' && (
            <>
              <button type="button" onClick={() => openQrModal()} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3d3d3d] px-4 py-2 text-sm font-semibold text-[#f5f5f5] hover:bg-[#484848]">
                <QrCode size={16} />
                Novo QR Code
              </button>
              <button type="button" onClick={() => openMaintenanceFromQr()} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]">
                <Plus size={16} />
                Nova Manutencao
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg border border-[#525252] bg-[#3d3d3d] p-1">
        {[
          { key: 'ativos' as const, label: 'Catalogo de Ativos' },
          { key: 'tarefas' as const, label: 'Tarefas de Manutencao' },
          { key: 'solicitacoes' as const, label: 'Solicitacoes de Manutencao' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-semibold transition-colors',
              tab === item.key ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:text-white',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'ativos' && (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#525252] bg-[#2f2f2f] p-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <StatBox label="Total de Ativos" value={totalAssets} icon={Wrench} tone="text-[#38bdf8]" />
            <StatBox label="Tipos de Ativos" value={typeCount} icon={Filter} tone="text-[#fbbf24]" />
            <StatBox label="Com Responsavel" value={withResponsible} icon={CheckCircle2} tone="text-[#4ade80]" />
          </div>

          <div className="mb-5 rounded-xl border border-[#525252] bg-[#333333] p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px_auto]">
              <div className="relative">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
                <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Buscar ativo, local, projeto ou responsavel..." className="w-full rounded-lg border border-[#525252] bg-[#3d3d3d] py-2 pl-9 pr-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]/60" />
              </div>
              <select value={assetTypeFilter} onChange={(event) => setAssetTypeFilter(event.target.value)} className={inputClass}>
                {assetTypes.map((type) => <option key={type} value={type}>{type === 'todos' ? 'Todos os tipos' : type}</option>)}
              </select>
              <select value={assetProjectFilter} onChange={(event) => setAssetProjectFilter(event.target.value)} className={inputClass}>
                {assetProjects.map((project) => <option key={project} value={project}>{project === 'todos' ? 'Todos projetos' : project}</option>)}
              </select>
              <select value={assetResponsibleFilter} onChange={(event) => setAssetResponsibleFilter(event.target.value)} className={inputClass}>
                {assetResponsibles.map((responsible) => <option key={responsible} value={responsible}>{responsible === 'todos' ? 'Todos responsaveis' : responsible}</option>)}
              </select>
              <button type="button" onClick={() => { setAssetSearch(''); setAssetTypeFilter('todos'); setAssetProjectFilter('todos'); setAssetResponsibleFilter('todos') }} className="rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#484848]">
                Limpar
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#525252] bg-[#333333]">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-[#525252] text-left text-[#a3a3a3]">
                  {['Nome', 'Tipo', 'Localizacao', 'Responsavel', 'Projeto', 'Acoes'].map((head) => (
                    <th key={head} className="px-4 py-3 font-semibold">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#525252]/50">
                {filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-[#3d3d3d]">
                    <td className="px-4 py-4 font-semibold text-[#f5f5f5]">{asset.name}</td>
                    <td className="px-4 py-4"><span className="rounded-full border border-[#525252] px-3 py-1 text-xs text-[#e5e5e5]">{asset.type}</span></td>
                    <td className="px-4 py-4 text-[#e5e5e5]">{asset.location || '-'}</td>
                    <td className="px-4 py-4 text-[#e5e5e5]">{asset.responsible || '-'}</td>
                    <td className="px-4 py-4 text-[#a3a3a3]">{asset.project || '-'}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => openAssetModal(asset)} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-white" title="Editar ativo"><Edit2 size={16} /></button>
                        <button type="button" onClick={() => deleteAsset(asset)} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]" title="Excluir ativo"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredAssets.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[#a3a3a3]">Nenhum ativo encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'tarefas' && (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#525252] bg-[#2f2f2f] p-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-4">
            <StatBox label="Total de Tarefas" value={totalTasks} icon={Wrench} tone="text-[#38bdf8]" />
            <StatBox label="Pendentes" value={taskCounts.pendente} icon={AlertCircle} tone="text-[#fbbf24]" />
            <StatBox label="Em Processo" value={taskCounts.emProcesso} icon={Filter} tone="text-[#38bdf8]" />
            <StatBox label="Concluidas" value={taskCounts.concluidas} icon={CheckCircle2} tone="text-[#4ade80]" />
          </div>

          <DndContext onDragEnd={handleDragEnd}>
            <div className="grid min-w-[980px] gap-3 xl:grid-cols-4">
              {statusColumns.map((column) => {
                const tasks = state.tasks.filter((task) => task.status === column.key)
                return (
                  <DroppableColumn key={column.key} id={column.key} className={cn('min-h-[420px] rounded-xl border p-3 transition-shadow', column.tone)}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-[#f5f5f5]">{column.label}</h3>
                      <span className="rounded-full border border-[#525252] bg-[#333333] px-2 py-0.5 text-xs text-[#a3a3a3]">{tasks.length}</span>
                    </div>
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <TaskCard key={task.id} task={task} onEdit={openTaskModal} onDelete={deleteTask} />
                      ))}
                      <button type="button" onClick={() => openTaskModal(undefined, column.key)} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#525252] text-xs font-semibold text-[#a3a3a3] hover:border-[#f97316]/50 hover:text-[#f97316]">
                        <Plus size={14} />
                        Nova Tarefa
                      </button>
                    </div>
                  </DroppableColumn>
                )
              })}
            </div>
          </DndContext>
        </div>
      )}

      {tab === 'solicitacoes' && (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#525252] bg-[#2f2f2f] p-5">
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <StatBox label="Total de QR Codes" value={state.qrs.length} icon={QrCode} tone="text-[#38bdf8]" />
            <StatBox label="Ativos" value={activeQrs} icon={CheckCircle2} tone="text-[#4ade80]" />
            <StatBox label="Inativos" value={inactiveQrs} icon={AlertCircle} tone="text-[#f87171]" />
          </div>

          <div className="mb-5 rounded-xl border border-[#525252] bg-[#333333] p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
              <div className="relative">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
                <input value={qrSearch} onChange={(event) => setQrSearch(event.target.value)} placeholder="Buscar local, projeto ou descricao..." className="w-full rounded-lg border border-[#525252] bg-[#3d3d3d] py-2 pl-9 pr-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]/60" />
              </div>
              <select value={qrStatusFilter} onChange={(event) => setQrStatusFilter(event.target.value)} className={inputClass}>
                <option value="todos">Todos status</option>
                <option value="ativo">Ativos</option>
                <option value="inativo">Inativos</option>
              </select>
              <button type="button" onClick={() => { setQrSearch(''); setQrStatusFilter('todos') }} className="rounded-lg border border-[#525252] bg-[#3d3d3d] px-3 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#484848]">
                Limpar
              </button>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {filteredQrs.map((qr) => (
              <div key={qr.id} className="flex gap-4 rounded-xl border border-[#525252] bg-[#333333] p-4">
                <MiniQr qr={qr} />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-base font-bold text-[#f5f5f5]">{qr.local}</p>
                      <p className="truncate text-sm text-[#a3a3a3]">{qr.project || 'Projeto nao informado'}</p>
                    </div>
                    <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase', qr.status === 'ativo' ? 'bg-[#16a34a]/15 text-[#4ade80]' : 'bg-[#dc2626]/15 text-[#f87171]')}>{qr.status}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-[#e5e5e5]">{qr.description || 'Sem descricao.'}</p>
                  <p className="mt-2 text-xs text-[#6b6b6b]">Criado em {qr.createdAt}</p>
                  <div className="mt-4 flex flex-wrap justify-end gap-1">
                    <button type="button" onClick={() => openMaintenanceFromQr(qr)} className="rounded-lg border border-[#525252] px-3 py-2 text-xs font-semibold text-[#e5e5e5] hover:bg-[#484848]">Nova Manutencao</button>
                    <button type="button" onClick={() => downloadQr(qr)} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-white" title="Exportar QR Code"><Download size={16} /></button>
                    <button type="button" onClick={() => printQr(qr)} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-white" title="Imprimir QR Code"><Printer size={16} /></button>
                    <button type="button" onClick={() => openQrModal(qr)} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-white" title="Editar QR Code"><Edit2 size={16} /></button>
                    <button type="button" onClick={() => deleteQr(qr)} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]" title="Excluir QR Code"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
            {filteredQrs.length === 0 && (
              <div className="rounded-xl border border-[#525252] bg-[#333333] p-8 text-center text-sm text-[#a3a3a3]">Nenhum QR Code encontrado.</div>
            )}
          </div>
        </div>
      )}

      {assetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-[#525252] bg-[#2f2f2f] p-5 shadow-2xl">
            <ModalHeader title={editingAssetId ? 'Editar Ativo' : 'Novo Ativo'} onClose={() => setAssetModalOpen(false)} />
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nome"><input value={assetForm.name} onChange={(event) => setAssetForm((formValue) => ({ ...formValue, name: event.target.value }))} className={inputClass} placeholder="Nome do ativo" /></Field>
              <Field label="Tipo"><input value={assetForm.type} onChange={(event) => setAssetForm((formValue) => ({ ...formValue, type: event.target.value }))} className={inputClass} placeholder="Tipo do ativo" /></Field>
              <Field label="Localizacao"><input value={assetForm.location} onChange={(event) => setAssetForm((formValue) => ({ ...formValue, location: event.target.value }))} className={inputClass} placeholder="Localizacao" /></Field>
              <Field label="Responsavel"><input value={assetForm.responsible} onChange={(event) => setAssetForm((formValue) => ({ ...formValue, responsible: event.target.value }))} className={inputClass} placeholder="Responsavel" /></Field>
              <Field label="Projeto"><input value={assetForm.project} onChange={(event) => setAssetForm((formValue) => ({ ...formValue, project: event.target.value }))} className={inputClass} placeholder="Projeto relacionado" /></Field>
            </div>
            <ModalActions onCancel={() => setAssetModalOpen(false)} onSave={saveAsset} />
          </div>
        </div>
      )}

      {taskModalOpen && (
        <TaskModal
          title={editingTaskId ? 'Editar Tarefa' : 'Nova Tarefa'}
          assets={state.assets}
          form={taskForm}
          onChange={setTaskForm}
          onAssetChange={applyTaskAsset}
          onClose={() => setTaskModalOpen(false)}
          onSave={saveTask}
        />
      )}

      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-[#525252] bg-[#2f2f2f] p-5 shadow-2xl">
            <ModalHeader title={editingQrId ? 'Editar QR Code' : 'Novo QR Code'} onClose={() => setQrModalOpen(false)} />
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Local"><input value={qrForm.local} onChange={(event) => setQrForm((formValue) => ({ ...formValue, local: event.target.value }))} className={inputClass} placeholder="Local da obra" /></Field>
              <Field label="Projeto Relacionado"><input value={qrForm.project} onChange={(event) => setQrForm((formValue) => ({ ...formValue, project: event.target.value }))} className={inputClass} placeholder="Projeto" /></Field>
              <Field label="Status">
                <select value={qrForm.status} onChange={(event) => setQrForm((formValue) => ({ ...formValue, status: event.target.value as QrStatus }))} className={inputClass}>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </Field>
              <Field label="Descricao" className="md:col-span-2">
                <textarea value={qrForm.description} onChange={(event) => setQrForm((formValue) => ({ ...formValue, description: event.target.value }))} className={cn(inputClass, 'min-h-24 resize-none')} placeholder="Descricao do ponto ou orientacoes" />
              </Field>
            </div>
            <ModalActions onCancel={() => setQrModalOpen(false)} onSave={saveQr} />
          </div>
        </div>
      )}

      {maintenanceModalOpen && (
        <TaskModal
          title="Nova Manutencao"
          assets={state.assets}
          form={taskForm}
          onChange={setTaskForm}
          onAssetChange={applyTaskAsset}
          onClose={() => setMaintenanceModalOpen(false)}
          onSave={saveMaintenanceRequest}
        />
      )}
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-[#f5f5f5]">{title}</h2>
      <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#a3a3a3] hover:bg-[#3d3d3d] hover:text-white" title="Fechar">
        <X size={16} />
      </button>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('space-y-1.5', className)}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

function ModalActions({ onCancel, onSave }: { onCancel: () => void; onSave: () => void }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-semibold text-[#a3a3a3] hover:bg-[#3d3d3d]">Cancelar</button>
      <button type="button" onClick={onSave} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]">Salvar</button>
    </div>
  )
}

function TaskModal({
  title,
  assets,
  form,
  onChange,
  onAssetChange,
  onClose,
  onSave,
}: {
  title: string
  assets: AssetRecord[]
  form: TaskForm
  onChange: React.Dispatch<React.SetStateAction<TaskForm>>
  onAssetChange: (assetId: string) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-[#525252] bg-[#2f2f2f] p-5 shadow-2xl">
        <ModalHeader title={title} onClose={onClose} />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Titulo">
            <input value={form.title} onChange={(event) => onChange((formValue) => ({ ...formValue, title: event.target.value }))} className={inputClass} placeholder="Titulo da tarefa" />
          </Field>
          <Field label="Ativo">
            <select value={form.assetId} onChange={(event) => onAssetChange(event.target.value)} className={inputClass}>
              <option value="">Sem ativo vinculado</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
            </select>
          </Field>
          <Field label="Localizacao">
            <input value={form.location} onChange={(event) => onChange((formValue) => ({ ...formValue, location: event.target.value }))} className={inputClass} placeholder="Local" />
          </Field>
          <Field label="Responsavel">
            <input value={form.responsible} onChange={(event) => onChange((formValue) => ({ ...formValue, responsible: event.target.value }))} className={inputClass} placeholder="Responsavel" />
          </Field>
          <Field label="Projeto">
            <input value={form.project} onChange={(event) => onChange((formValue) => ({ ...formValue, project: event.target.value }))} className={inputClass} placeholder="Projeto" />
          </Field>
          <Field label="Prazo">
            <input type="date" value={form.dueDate} onChange={(event) => onChange((formValue) => ({ ...formValue, dueDate: event.target.value }))} className={inputClass} />
          </Field>
          <Field label="Prioridade">
            <select value={form.priority} onChange={(event) => onChange((formValue) => ({ ...formValue, priority: event.target.value as Priority }))} className={inputClass}>
              <option value="baixa">Baixa</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="critica">Critica</option>
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(event) => onChange((formValue) => ({ ...formValue, status: event.target.value as TaskStatus }))} className={inputClass}>
              {statusColumns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
            </select>
          </Field>
          <Field label="Descricao" className="md:col-span-2">
            <textarea value={form.description} onChange={(event) => onChange((formValue) => ({ ...formValue, description: event.target.value }))} className={cn(inputClass, 'min-h-24 resize-none')} placeholder="Descricao do servico" />
          </Field>
        </div>
        <ModalActions onCancel={onClose} onSave={onSave} />
      </div>
    </div>
  )
}
