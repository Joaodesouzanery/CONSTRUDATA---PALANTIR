import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Edit2,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Gauge,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  ListChecks,
  Paperclip,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Upload,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { compressImageToBlob } from '@/lib/imageCompression'
import { useProjetosStore } from '@/store/projetosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import {
  type MaintenanceAsset,
  type MaintenanceAssetAnexo,
  type MaintenanceAssetSistema,
  type MaintenanceAssetStatus,
  type MaintenanceFrequency,
  type MaintenanceMonitoringPoint,
  type MaintenancePlan,
  type MaintenancePriority,
  type MaintenanceStatus,
  type MaintenanceWorkOrder,
  type ImpactoUrgencia,
  SISTEMAS_ATIVO,
  useManutencoesStore,
} from '@/store/manutencoesStore'
import { componentesDoSistema, SINTOMAS, IU_LABELS, prioridadeDaMatriz } from './utils/chamadoCatalogo'
import { useActiveObraStore } from '@/store/activeObraStore'
import {
  removePredialAtivoFile,
  signedPredialAtivoUrl,
  uploadPredialAtivoFile,
  uploadPredialAtivoImage,
} from './utils/predialAtivoStorage'
import type { ConstructionSite, Project } from '@/types'

type MaintenanceTab = 'painel' | 'ativos' | 'monitoramento' | 'tarefas' | 'ordens' | 'kanban' | 'calendario'
type ModalState =
  | { type: 'asset'; item?: MaintenanceAsset }
  | { type: 'plan'; item?: MaintenancePlan }
  | { type: 'order'; item?: MaintenanceWorkOrder }
  | { type: 'monitoring'; item?: MaintenanceMonitoringPoint }
  | null

const tabs: { key: MaintenanceTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'painel', label: 'Painel', icon: LayoutDashboard },
  { key: 'ativos', label: 'Ativos', icon: Wrench },
  { key: 'monitoramento', label: 'Monitoramento', icon: Gauge },
  { key: 'tarefas', label: 'Tarefas Manutenções', icon: ListChecks },
  { key: 'ordens', label: 'Ordens de Serviço', icon: Settings2 },
  { key: 'kanban', label: 'Kanban', icon: BarChart3 },
  { key: 'calendario', label: 'Calendário', icon: CalendarDays },
]

const statusColumns: { key: MaintenanceStatus; label: string; color: string }[] = [
  { key: 'pendente', label: 'Tarefas pendentes', color: '#fbbf24' },
  { key: 'em_processo', label: 'OSs em Processo', color: '#f97316' },
  { key: 'em_verificacao', label: 'Aguardando validação', color: '#3b82f6' },
  { key: 'concluida', label: 'OSs Concluídas', color: '#22c55e' },
  { key: 'cancelada', label: 'Canceladas', color: '#737373' },
]

const priorityLabels: Record<MaintenancePriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
}

const statusLabels: Record<MaintenanceStatus, string> = {
  pendente: 'Pendente',
  em_processo: 'Em processo',
  em_verificacao: 'Aguardando validação',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const frequencyLabels: Record<MaintenanceFrequency, string> = {
  unica: 'Única',
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

const inputClass = 'w-full rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#737373] focus:border-[#f97316]/70'
const labelClass = 'text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function splitLines(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

function joinLines(value: string[]) {
  return value.join('\n')
}

function assetScope(asset: MaintenanceAsset) {
  if (asset.constructionSiteId) return 'Obra vinculada'
  if (asset.projectId) return 'Projeto vinculado'
  return 'Corporativo/Geral'
}

function projectLabel(project?: Project) {
  if (!project) return ''
  return `${project.code || 'Projeto'} · ${project.name}`
}

function siteLabel(site?: ConstructionSite) {
  if (!site) return ''
  return `${site.code || 'Obra'} · ${site.name}`
}

function siteProjectId(site?: ConstructionSite) {
  return (site as { projectId?: string } | undefined)?.projectId ?? null
}

function statusTone(status: MaintenanceStatus) {
  if (status === 'concluida') return 'bg-[#16a34a]/15 text-[#4ade80] border-[#16a34a]/30'
  if (status === 'em_verificacao') return 'bg-[#2563eb]/15 text-[#60a5fa] border-[#2563eb]/30'
  if (status === 'em_processo') return 'bg-[#f97316]/15 text-[#fb923c] border-[#f97316]/30'
  if (status === 'cancelada') return 'bg-[#737373]/15 text-[#d4d4d4] border-[#737373]/30'
  return 'bg-[#ca8a04]/15 text-[#fbbf24] border-[#ca8a04]/30'
}

function priorityTone(priority: MaintenancePriority) {
  if (priority === 'critica') return 'bg-[#dc2626]/15 text-[#f87171] border-[#dc2626]/30'
  if (priority === 'alta') return 'bg-[#f97316]/15 text-[#fb923c] border-[#f97316]/30'
  if (priority === 'baixa') return 'bg-[#16a34a]/15 text-[#4ade80] border-[#16a34a]/30'
  return 'bg-[#2563eb]/15 text-[#60a5fa] border-[#2563eb]/30'
}

function StatCard({ label, value, icon: Icon, tone, sub }: { label: string; value: string | number; icon: typeof Wrench; tone: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#3a3a3a] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#a3a3a3]">{label}</span>
        <Icon size={18} className={tone} />
      </div>
      <p className="text-3xl font-bold tabular-nums text-[#f5f5f5]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#737373]">{sub}</p>}
    </div>
  )
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold', className)}>{children}</span>
}

function Donut({ percent, label, color = '#f97316' }: { percent: number; label: string; color?: string }) {
  const value = Math.max(0, Math.min(100, percent))
  return (
    <div className="flex items-center gap-5 rounded-lg border border-[#525252] bg-[#333333] p-4">
      <div
        className="grid h-28 w-28 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${value}%, #4b5563 0)` }}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-[#333333]">
          <span className="text-xl font-bold text-[#f5f5f5]">{value.toFixed(0)}%</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-[#f5f5f5]">{label}</p>
        <p className="mt-1 text-xs text-[#a3a3a3]">Calculado pelas OS da empresa ativa.</p>
      </div>
    </div>
  )
}

function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[#525252] bg-[#333333] p-8 text-center">
      <p className="text-sm font-semibold text-[#f5f5f5]">{title}</p>
      <p className="mt-1 text-xs text-[#a3a3a3]">A organização ativa não possui dados para este filtro.</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

function AssetName({ id, assets }: { id: string; assets: MaintenanceAsset[] }) {
  const asset = assets.find((item) => item.id === id)
  return <span>{asset ? `${asset.code} · ${asset.name}` : 'Ativo removido'}</span>
}

function MultiAssetPicker({ assets, value, onChange }: { assets: MaintenanceAsset[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="max-h-44 overflow-y-auto rounded-lg border border-[#525252] bg-[#333333] p-2">
      {assets.map((asset) => {
        const checked = value.includes(asset.id)
        return (
          <label key={asset.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-[#e5e5e5] hover:bg-[#3f3f3f]">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                onChange(event.target.checked ? [...value, asset.id] : value.filter((id) => id !== asset.id))
              }}
            />
            <span className="min-w-0 flex-1 truncate">{asset.code} · {asset.name}</span>
            <span className="text-xs text-[#a3a3a3]">{assetScope(asset)}</span>
          </label>
        )
      })}
      {assets.length === 0 && <p className="px-2 py-4 text-center text-xs text-[#a3a3a3]">Cadastre ativos antes de vincular.</p>}
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-[#525252] bg-[#2f2f2f] p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#f5f5f5]">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-2 text-[#a3a3a3] hover:bg-[#3f3f3f] hover:text-white" title="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

function ScopeFields({
  projects,
  sites,
  projectId,
  constructionSiteId,
  onChange,
}: {
  projects: Project[]
  sites: ConstructionSite[]
  projectId: string
  constructionSiteId: string
  onChange: (patch: { projectId?: string; constructionSiteId?: string }) => void
}) {
  const selectedProject = projects.find((project) => project.id === projectId)
  const selectedSite = sites.find((site) => site.id === constructionSiteId)
  const scopeText = selectedSite
    ? `Vinculado à obra ${siteLabel(selectedSite)}`
    : selectedProject
      ? `Vinculado ao projeto ${projectLabel(selectedProject)}`
      : 'Corporativo/Geral: ativo disponível para a empresa inteira, sem obra específica.'

  return (
    <>
      <Field label="Projeto">
        <select
          value={projectId}
          onChange={(event) => onChange({ projectId: event.target.value, constructionSiteId })}
          className={inputClass}
        >
          <option value="">Corporativo/Geral</option>
          {projectId && !selectedProject && <option value={projectId}>Projeto salvo ({projectId.slice(0, 8)})</option>}
          {projects.map((project) => <option key={project.id} value={project.id}>{projectLabel(project)}</option>)}
        </select>
      </Field>
      <Field label="Obra">
        <select
          value={constructionSiteId}
          onChange={(event) => {
            const nextSite = sites.find((site) => site.id === event.target.value)
            onChange({
              constructionSiteId: event.target.value,
              projectId: siteProjectId(nextSite) ?? projectId,
            })
          }}
          className={inputClass}
        >
          <option value="">Sem obra específica</option>
          {constructionSiteId && !selectedSite && <option value={constructionSiteId}>Obra salva ({constructionSiteId.slice(0, 8)})</option>}
          {sites.map((site) => <option key={site.id} value={site.id}>{siteLabel(site)}</option>)}
        </select>
      </Field>
      <div className="rounded-lg border border-[#525252] bg-[#333333] px-3 py-2 text-xs text-[#a3a3a3] md:col-span-2">
        {scopeText}
      </div>
    </>
  )
}

function ModalActions({ onCancel, saving }: { onCancel: () => void; saving: boolean }) {
  return (
    <div className="mt-5 flex justify-end gap-2 border-t border-[#525252] pt-4">
      <button type="button" onClick={onCancel} className="rounded-lg border border-[#525252] px-4 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#3f3f3f]">
        Cancelar
      </button>
      <button type="submit" disabled={saving} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:cursor-wait disabled:opacity-70">
        {saving ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  )
}

const ANEXO_TIPOS: { value: NonNullable<MaintenanceAssetAnexo['tipo']>; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'art', label: 'ART' },
  { value: 'nota', label: 'Nota' },
  { value: 'outro', label: 'Outro' },
]

function fmtDateBR(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR')
}

// Helper nomeado (não inline no render) — mesmo idioma do GestaoFrotasPanel.
function daysUntil(iso: string) {
  return Math.floor((new Date(iso + 'T12:00:00').getTime() - Date.now()) / 86_400_000)
}

/** Semáforo da garantia: vermelho vencida / amarelo ≤30 dias / verde ok. */
function GarantiaBadge({ date }: { date?: string }) {
  if (!date) return <span className="text-[#737373]">—</span>
  const days = daysUntil(date)
  const cls = days < 0 ? 'text-[#f87171]' : days <= 30 ? 'text-[#fbbf24]' : 'text-[#4ade80]'
  return <span className={cn('font-semibold tabular-nums', cls)}>{fmtDateBR(date)}{days < 0 ? ' · vencida' : ` · ${days}d`}</span>
}

/** Resolve um caminho do bucket `predial-ativos` para uma URL assinada (1h). */
function useSignedPreview(path?: string) {
  const [state, setState] = useState<{ path?: string; url: string | null }>({ url: null })
  useEffect(() => {
    if (!path) return
    let alive = true
    void signedPredialAtivoUrl(path).then((u) => { if (alive) setState({ path, url: u }) })
    return () => { alive = false }
  }, [path])
  return state.path === path ? state.url : null
}

/** Miniatura da plaqueta (signed URL lazy) para a lista de ativos. */
function PlaquetaThumb({ path }: { path?: string }) {
  const url = useSignedPreview(path)
  if (!path) return <div className="grid h-9 w-9 shrink-0 place-items-center rounded border border-[#525252] bg-[#333]"><ImageIcon size={14} className="text-[#555]" /></div>
  return url
    ? <img src={url} alt="plaqueta" className="h-9 w-9 shrink-0 rounded border border-[#525252] object-cover" />
    : <div className="h-9 w-9 shrink-0 animate-pulse rounded border border-[#525252] bg-[#3a3a3a]" />
}

/** Upload/troca da foto da plaqueta (comprime → sobe → guarda o caminho).
 * onTrash: caminho antigo a remover do bucket SÓ se o modal for salvo (evita apagar
 * um arquivo ainda referenciado caso o usuário cancele). */
function PlaquetaUploader({ path, onChange, onTrash }: { path?: string; onChange: (next?: string) => void; onTrash: (p?: string) => void }) {
  const [busy, setBusy] = useState(false)
  const url = useSignedPreview(path)
  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const blob = await compressImageToBlob(file)
      const newPath = await uploadPredialAtivoImage(blob)
      onTrash(path)   // remove a antiga ao salvar
      onChange(newPath)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar a plaqueta.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex items-center gap-3">
      {path && url
        ? <img src={url} alt="plaqueta" className="h-16 w-16 rounded-lg border border-[#525252] object-cover" />
        : <div className="grid h-16 w-16 place-items-center rounded-lg border border-dashed border-[#525252] bg-[#333]"><ImageIcon size={20} className="text-[#666]" /></div>}
      <div className="flex flex-col gap-1.5">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-1.5 text-xs font-semibold text-[#e5e5e5] hover:bg-[#464646]">
          <Upload size={14} /> {busy ? 'Enviando...' : path ? 'Trocar foto' : 'Enviar foto'}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        </label>
        {path && <button type="button" onClick={() => { onTrash(path); onChange(undefined) }} className="text-left text-xs text-[#a3a3a3] hover:text-[#f87171]">Remover</button>}
      </div>
    </div>
  )
}

/** Lista de documentos anexos (manual/ART/nota) com upload, tipo, abrir e remover.
 * onTrash: exclusão adiada até o save (ver PlaquetaUploader). */
function AnexosManager({ anexos, onChange, onTrash }: { anexos: MaintenanceAssetAnexo[]; onChange: (next: MaintenanceAssetAnexo[]) => void; onTrash: (p?: string) => void }) {
  const [busy, setBusy] = useState(false)
  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const path = await uploadPredialAtivoFile(file)
      onChange([...anexos, { path, nome: file.name, tipo: 'outro', uploadedAt: new Date().toISOString() }])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar o anexo.')
    } finally {
      setBusy(false)
    }
  }
  async function openAnexo(path: string) {
    const u = await signedPredialAtivoUrl(path)
    if (u) window.open(u, '_blank', 'noopener')
    else toast.error('Não foi possível abrir o anexo.')
  }
  return (
    <div className="space-y-2">
      {anexos.length > 0 && (
        <ul className="space-y-1.5">
          {anexos.map((a, i) => (
            <li key={a.path} className="flex items-center gap-2 rounded-lg border border-[#525252] bg-[#333] px-2.5 py-1.5 text-sm">
              <FileText size={15} className="shrink-0 text-[#a3a3a3]" />
              <button type="button" onClick={() => void openAnexo(a.path)} className="flex-1 truncate text-left text-[#e5e5e5] hover:text-[#fb923c]" title={a.nome}>{a.nome}</button>
              <select value={a.tipo ?? 'outro'} onChange={(e) => onChange(anexos.map((x, idx) => idx === i ? { ...x, tipo: e.target.value as MaintenanceAssetAnexo['tipo'] } : x))} className="rounded border border-[#525252] bg-[#3a3a3a] px-1.5 py-1 text-xs text-[#e5e5e5]">
                {ANEXO_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button type="button" onClick={() => void openAnexo(a.path)} className="rounded p-1 text-[#a3a3a3] hover:text-white" title="Abrir"><ExternalLink size={14} /></button>
              <button type="button" onClick={() => { onTrash(a.path); onChange(anexos.filter((_, idx) => idx !== i)) }} className="rounded p-1 text-[#a3a3a3] hover:text-[#f87171]" title="Remover"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-1.5 text-xs font-semibold text-[#e5e5e5] hover:bg-[#464646]">
        <Paperclip size={14} /> {busy ? 'Enviando...' : 'Adicionar anexo'}
        <input type="file" className="hidden" onChange={onFile} disabled={busy} />
      </label>
    </div>
  )
}

function AssetModal({ item, projects, sites, canViewCosts = true, onClose }: { item?: MaintenanceAsset; projects: Project[]; sites: ConstructionSite[]; canViewCosts?: boolean; onClose: () => void }) {
  const addAsset = useManutencoesStore((state) => state.addAsset)
  const updateAsset = useManutencoesStore((state) => state.updateAsset)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: item?.code ?? '',
    name: item?.name ?? '',
    type: item?.type ?? 'Geral',
    status: item?.status ?? 'idle' as MaintenanceAssetStatus,
    criticality: item?.criticality ?? 'media' as MaintenancePriority,
    responsible: item?.responsible ?? '',
    location: item?.location ?? '',
    torre: item?.torre ?? '',
    pavimento: item?.pavimento ?? '',
    ambiente: item?.ambiente ?? '',
    qrCode: item?.qrCode ?? '',
    projectId: item?.projectId ?? '',
    constructionSiteId: item?.constructionSiteId ?? '',
    sistema: (item?.sistema ?? '') as MaintenanceAssetSistema | '',
    fabricante: item?.fabricante ?? '',
    modelo: item?.modelo ?? '',
    serial: item?.serial ?? '',
    areaAtendida: item?.areaAtendida ?? '',
    dataInstalacao: item?.dataInstalacao ?? '',
    garantiaAte: item?.garantiaAte ?? '',
    vidaUtilAnosNBR: item?.vidaUtilAnosNBR != null ? String(item.vidaUtilAnosNBR) : '',
    replacementCostBRL: item?.replacementCostBRL != null ? String(item.replacementCostBRL) : '',
  })
  const [fotoPlaquetaPath, setFotoPlaquetaPath] = useState<string | undefined>(item?.fotoPlaquetaPath)
  const [anexos, setAnexos] = useState<MaintenanceAssetAnexo[]>(item?.anexos ?? [])
  // Caminhos removidos/substituídos: só apagados do bucket se o modal for salvo (cancelar não apaga).
  const trashRef = useRef<string[]>([])
  const trash = (p?: string) => { if (p) trashRef.current.push(p) }

  const toNum = (v: string): number | undefined => {
    const n = Number(v.replace(',', '.'))
    return v.trim() && Number.isFinite(n) ? n : undefined
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      torre: form.torre.trim() || undefined,
      pavimento: form.pavimento.trim() || undefined,
      ambiente: form.ambiente.trim() || undefined,
      // `location` = texto composto dos 3 campos estruturados (para os leitores read-only —
      // Painel/CapEx/Criticidade — continuarem funcionando). Sem os 3, mantém o texto livre legado.
      location: [form.torre, form.pavimento, form.ambiente].map((s) => s.trim()).filter(Boolean).join(' · ') || form.location.trim(),
      sistema: form.sistema || undefined,
      fabricante: form.fabricante.trim() || undefined,
      modelo: form.modelo.trim() || undefined,
      serial: form.serial.trim() || undefined,
      areaAtendida: form.areaAtendida.trim() || undefined,
      dataInstalacao: form.dataInstalacao || undefined,
      garantiaAte: form.garantiaAte || undefined,
      vidaUtilAnosNBR: toNum(form.vidaUtilAnosNBR),
      replacementCostBRL: toNum(form.replacementCostBRL),
      fotoPlaquetaPath: fotoPlaquetaPath || undefined,
      anexos: anexos.length ? anexos : undefined,
      projectId: form.projectId.trim() || null,
      constructionSiteId: form.constructionSiteId.trim() || null,
    }
    if (item) await updateAsset(item.id, payload)
    else await addAsset(payload)
    // Salvo com sucesso: agora sim remove do bucket os arquivos trocados/removidos (best-effort).
    trashRef.current.forEach((p) => void removePredialAtivoFile(p))
    trashRef.current = []
    setSaving(false)
    onClose()
  }

  return (
    <ModalShell title={item ? 'Editar Ativo' : 'Novo Ativo'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Código"><input value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} className={inputClass} placeholder="ATV-001" /></Field>
          <Field label="Nome"><input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className={inputClass} placeholder="Bomba, painel, equipamento..." /></Field>
          <Field label="Tipo"><input value={form.type} onChange={(e) => setForm((s) => ({ ...s, type: e.target.value }))} className={inputClass} placeholder="Bomba, elétrica, civil..." /></Field>
          <Field label="Responsável"><input value={form.responsible} onChange={(e) => setForm((s) => ({ ...s, responsible: e.target.value }))} className={inputClass} /></Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as MaintenanceAssetStatus }))} className={inputClass}>
              <option value="active">Ativo</option>
              <option value="idle">Ocioso</option>
              <option value="maintenance">Em manutenção</option>
              <option value="alert">Em alerta</option>
              <option value="offline">Fora de serviço</option>
            </select>
          </Field>
          <Field label="Criticidade">
            <select value={form.criticality} onChange={(e) => setForm((s) => ({ ...s, criticality: e.target.value as MaintenancePriority }))} className={inputClass}>
              {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <div className="space-y-1.5 md:col-span-2">
            <span className={labelClass}>Localização</span>
            <div className="grid gap-3 sm:grid-cols-3">
              <input value={form.torre} onChange={(e) => setForm((s) => ({ ...s, torre: e.target.value }))} className={inputClass} placeholder="Torre / Bloco" />
              <input value={form.pavimento} onChange={(e) => setForm((s) => ({ ...s, pavimento: e.target.value }))} className={inputClass} placeholder="Pavimento / Andar" />
              <input value={form.ambiente} onChange={(e) => setForm((s) => ({ ...s, ambiente: e.target.value }))} className={inputClass} placeholder="Ambiente / Sala" />
            </div>
            {item?.location && !form.torre.trim() && !form.pavimento.trim() && !form.ambiente.trim() && (
              <p className="text-[11px] text-[#737373]">Local atual: <span className="text-[#a3a3a3]">{item.location}</span> — preencha os campos acima para estruturar (mantido como está se deixar em branco).</p>
            )}
          </div>
          <Field label="QR / Identificador"><input value={form.qrCode} onChange={(e) => setForm((s) => ({ ...s, qrCode: e.target.value }))} className={inputClass} /></Field>
          <ScopeFields projects={projects} sites={sites} projectId={form.projectId} constructionSiteId={form.constructionSiteId} onChange={(patch) => setForm((s) => ({ ...s, ...patch }))} />
        </div>

        <div className="mt-5 mb-2 flex items-center gap-2 border-t border-[#525252] pt-4 text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
          <Wrench size={14} /> Ficha técnica (DNA do ativo)
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Sistema">
            <select value={form.sistema} onChange={(e) => setForm((s) => ({ ...s, sistema: e.target.value as MaintenanceAssetSistema | '' }))} className={inputClass}>
              <option value="">—</option>
              {SISTEMAS_ATIVO.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Fabricante"><input value={form.fabricante} onChange={(e) => setForm((s) => ({ ...s, fabricante: e.target.value }))} className={inputClass} /></Field>
          <Field label="Modelo"><input value={form.modelo} onChange={(e) => setForm((s) => ({ ...s, modelo: e.target.value }))} className={inputClass} /></Field>
          <Field label="Nº de série"><input value={form.serial} onChange={(e) => setForm((s) => ({ ...s, serial: e.target.value }))} className={inputClass} /></Field>
          <Field label="Área atendida"><input value={form.areaAtendida} onChange={(e) => setForm((s) => ({ ...s, areaAtendida: e.target.value }))} className={inputClass} placeholder="2º andar sul, hall..." /></Field>
          <Field label="Data de instalação"><input type="date" value={form.dataInstalacao} onChange={(e) => setForm((s) => ({ ...s, dataInstalacao: e.target.value }))} className={inputClass} /></Field>
          <Field label="Garantia até"><input type="date" value={form.garantiaAte} onChange={(e) => setForm((s) => ({ ...s, garantiaAte: e.target.value }))} className={inputClass} /></Field>
          <Field label="Vida útil NBR (anos)"><input type="number" min={0} value={form.vidaUtilAnosNBR} onChange={(e) => setForm((s) => ({ ...s, vidaUtilAnosNBR: e.target.value }))} className={inputClass} placeholder="ex.: 15" /></Field>
          {canViewCosts && <Field label="Custo de reposição (R$)"><input type="number" min={0} value={form.replacementCostBRL} onChange={(e) => setForm((s) => ({ ...s, replacementCostBRL: e.target.value }))} className={inputClass} /></Field>}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <span className={labelClass}>Foto da plaqueta</span>
            <PlaquetaUploader path={fotoPlaquetaPath} onChange={setFotoPlaquetaPath} onTrash={trash} />
          </div>
          <div className="space-y-1.5">
            <span className={labelClass}>Documentos (manual, ART, nota)</span>
            <AnexosManager anexos={anexos} onChange={setAnexos} onTrash={trash} />
          </div>
        </div>

        <ModalActions onCancel={onClose} saving={saving} />
      </form>
    </ModalShell>
  )
}

function PlanModal({ item, assets, projects, sites, onClose }: { item?: MaintenancePlan; assets: MaintenanceAsset[]; projects: Project[]; sites: ConstructionSite[]; onClose: () => void }) {
  const addPlan = useManutencoesStore((state) => state.addPlan)
  const updatePlan = useManutencoesStore((state) => state.updatePlan)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: item?.code ?? '',
    title: item?.title ?? '',
    description: item?.description ?? '',
    frequency: item?.frequency ?? 'mensal' as MaintenanceFrequency,
    priority: item?.priority ?? 'media' as MaintenancePriority,
    estimatedDurationMinutes: item?.estimatedDurationMinutes ?? 60,
    checklist: joinLines(item?.checklist ?? []),
    nextDueDate: item?.nextDueDate ?? today(),
    active: item?.active ?? true,
    assetIds: item?.assetIds ?? [],
    projectId: item?.projectId ?? '',
    constructionSiteId: item?.constructionSiteId ?? '',
  })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      checklist: splitLines(form.checklist),
      projectId: form.projectId.trim() || null,
      constructionSiteId: form.constructionSiteId.trim() || null,
    }
    if (item) await updatePlan(item.id, payload)
    else await addPlan(payload)
    setSaving(false)
    onClose()
  }

  return (
    <ModalShell title={item ? 'Editar Plano de Manutenção' : 'Novo Plano de Manutenção'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Código"><input value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} className={inputClass} placeholder="PLN-001" /></Field>
          <Field label="Título"><input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} className={inputClass} placeholder="Preventiva mensal de bombas" /></Field>
          <Field label="Frequência">
            <select value={form.frequency} onChange={(e) => setForm((s) => ({ ...s, frequency: e.target.value as MaintenanceFrequency }))} className={inputClass}>
              {Object.entries(frequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Prioridade">
            <select value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value as MaintenancePriority }))} className={inputClass}>
              {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Próxima data"><input type="date" value={form.nextDueDate} onChange={(e) => setForm((s) => ({ ...s, nextDueDate: e.target.value }))} className={inputClass} /></Field>
          <Field label="Duração prevista (min)"><input type="number" min={0} value={form.estimatedDurationMinutes} onChange={(e) => setForm((s) => ({ ...s, estimatedDurationMinutes: Number(e.target.value) }))} className={inputClass} /></Field>
          <ScopeFields projects={projects} sites={sites} projectId={form.projectId} constructionSiteId={form.constructionSiteId} onChange={(patch) => setForm((s) => ({ ...s, ...patch }))} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Descrição"><textarea value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} className={cn(inputClass, 'min-h-28')} /></Field>
          <Field label="Checklist (uma linha por item)"><textarea value={form.checklist} onChange={(e) => setForm((s) => ({ ...s, checklist: e.target.value }))} className={cn(inputClass, 'min-h-28')} /></Field>
        </div>
        <div className="mt-3 space-y-1.5">
          <span className={labelClass}>Ativos vinculados</span>
          <MultiAssetPicker assets={assets} value={form.assetIds} onChange={(assetIds) => setForm((s) => ({ ...s, assetIds }))} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-[#e5e5e5]">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((s) => ({ ...s, active: e.target.checked }))} />
          Plano ativo
        </label>
        <ModalActions onCancel={onClose} saving={saving} />
      </form>
    </ModalShell>
  )
}

function OrderModal({ item, assets, plans, projects, sites, canViewCosts = true, onClose }: { item?: MaintenanceWorkOrder; assets: MaintenanceAsset[]; plans: MaintenancePlan[]; projects: Project[]; sites: ConstructionSite[]; canViewCosts?: boolean; onClose: () => void }) {
  const addWorkOrder = useManutencoesStore((state) => state.addWorkOrder)
  const updateWorkOrder = useManutencoesStore((state) => state.updateWorkOrder)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: item?.code ?? '',
    title: item?.title ?? '',
    description: item?.description ?? '',
    status: item?.status ?? 'pendente' as MaintenanceStatus,
    priority: item?.priority ?? 'media' as MaintenancePriority,
    severity: item?.severity ?? 'media' as MaintenancePriority,
    impacto: item?.impacto ?? 'media' as ImpactoUrgencia,
    urgencia: item?.urgencia ?? 'media' as ImpactoUrgencia,
    planned: item?.planned ?? true,
    progress: item?.progress ?? 0,
    scheduledDate: item?.scheduledDate ?? today(),
    dueDate: item?.dueDate ?? today(),
    assignee: item?.assignee ?? '',
    requester: item?.requester ?? '',
    estimatedDurationMinutes: item?.estimatedDurationMinutes ?? 60,
    actualDurationMinutes: item?.actualDurationMinutes ?? 0,
    estimatedCost: item?.estimatedCost ?? 0,
    actualCost: item?.actualCost ?? 0,
    checklist: joinLines(item?.checklist ?? []),
    evidence: joinLines(item?.evidence ?? []),
    pmbokScope: item?.pmbok.scope ?? '',
    pmbokRisk: item?.pmbok.risk ?? '',
    pmbokLessons: item?.pmbok.lessonsLearned ?? '',
    lpsRestriction: item?.leanLps.restriction ?? '',
    createLookahead: item?.leanLps.createLookahead ?? false,
    assetIds: item?.assetIds ?? [],
    planId: item?.planId ?? '',
    projectId: item?.projectId ?? '',
    constructionSiteId: item?.constructionSiteId ?? '',
  })

  function applyPlan(planId: string) {
    const plan = plans.find((candidate) => candidate.id === planId)
    setForm((s) => ({
      ...s,
      planId,
      title: plan?.title ?? s.title,
      description: plan?.description ?? s.description,
      priority: plan?.priority ?? s.priority,
      severity: plan?.priority ?? s.severity,
      estimatedDurationMinutes: plan?.estimatedDurationMinutes ?? s.estimatedDurationMinutes,
      checklist: plan ? joinLines(plan.checklist) : s.checklist,
      assetIds: plan?.assetIds ?? s.assetIds,
      projectId: plan?.projectId ?? s.projectId,
      constructionSiteId: plan?.constructionSiteId ?? s.constructionSiteId,
    }))
  }

  // A matriz impacto×urgência define a prioridade (que continua editável manualmente).
  function setImpactoUrgencia(next: { impacto?: ImpactoUrgencia; urgencia?: ImpactoUrgencia }) {
    setForm((s) => {
      const impacto = next.impacto ?? s.impacto
      const urgencia = next.urgencia ?? s.urgencia
      return { ...s, impacto, urgencia, priority: prioridadeDaMatriz(impacto, urgencia) }
    })
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.title.trim()) return
    // Custo obrigatório no fechamento (gestão de manutenção: OS não fecha sem custo real).
    // Dispensado p/ papéis sem custo (zelador/morador), que fecham a OS sem informar valor.
    if (canViewCosts && form.status === 'concluida' && Number(form.actualCost) <= 0) {
      window.alert('Informe o custo real (maior que zero) para concluir a OS.')
      return
    }
    setSaving(true)
    const payload = {
      code: form.code,
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      severity: form.severity,
      impacto: form.impacto,
      urgencia: form.urgencia,
      planned: form.planned,
      progress: Number(form.progress),
      scheduledDate: form.scheduledDate,
      dueDate: form.dueDate,
      assignee: form.assignee,
      requester: form.requester,
      estimatedDurationMinutes: Number(form.estimatedDurationMinutes),
      actualDurationMinutes: form.actualDurationMinutes ? Number(form.actualDurationMinutes) : null,
      estimatedCost: Number(form.estimatedCost),
      actualCost: Number(form.actualCost),
      checklist: splitLines(form.checklist),
      evidence: splitLines(form.evidence),
      pmbok: { scope: form.pmbokScope, risk: form.pmbokRisk, lessonsLearned: form.pmbokLessons },
      leanLps: { restriction: form.lpsRestriction, createLookahead: form.createLookahead },
      assetIds: form.assetIds,
      planId: form.planId || null,
      projectId: form.projectId.trim() || null,
      constructionSiteId: form.constructionSiteId.trim() || null,
    }
    if (item) await updateWorkOrder(item.id, payload)
    else await addWorkOrder(payload)
    setSaving(false)
    onClose()
  }

  return (
    <ModalShell title={item ? 'Editar Ordem de Serviço' : 'Nova Ordem de Serviço'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Código"><input value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} className={inputClass} placeholder="OS-0001" /></Field>
          <Field label="Título"><input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} className={inputClass} /></Field>
          <Field label="Plano de origem">
            <select value={form.planId} onChange={(e) => applyPlan(e.target.value)} className={inputClass}>
              <option value="">Sem plano</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.code} · {plan.title}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as MaintenanceStatus }))} className={inputClass}>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Impacto">
            <select value={form.impacto} onChange={(e) => setImpactoUrgencia({ impacto: e.target.value as ImpactoUrgencia })} className={inputClass}>
              {(['baixa', 'media', 'alta'] as ImpactoUrgencia[]).map((v) => <option key={v} value={v}>{IU_LABELS[v]}</option>)}
            </select>
          </Field>
          <Field label="Urgência">
            <select value={form.urgencia} onChange={(e) => setImpactoUrgencia({ urgencia: e.target.value as ImpactoUrgencia })} className={inputClass}>
              {(['baixa', 'media', 'alta'] as ImpactoUrgencia[]).map((v) => <option key={v} value={v}>{IU_LABELS[v]}</option>)}
            </select>
          </Field>
          <Field label="Prioridade (matriz)">
            <select value={form.priority} onChange={(e) => setForm((s) => ({ ...s, priority: e.target.value as MaintenancePriority }))} className={inputClass}>
              {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Severidade">
            <select value={form.severity} onChange={(e) => setForm((s) => ({ ...s, severity: e.target.value as MaintenancePriority }))} className={inputClass}>
              {Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Programada para"><input type="date" value={form.scheduledDate} onChange={(e) => setForm((s) => ({ ...s, scheduledDate: e.target.value }))} className={inputClass} /></Field>
          <Field label="Vencimento"><input type="date" value={form.dueDate} onChange={(e) => setForm((s) => ({ ...s, dueDate: e.target.value }))} className={inputClass} /></Field>
          <Field label="Conclusão (%)"><input type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm((s) => ({ ...s, progress: Number(e.target.value) }))} className={inputClass} /></Field>
          <Field label="Responsável"><input value={form.assignee} onChange={(e) => setForm((s) => ({ ...s, assignee: e.target.value }))} className={inputClass} /></Field>
          <Field label="Solicitante"><input value={form.requester} onChange={(e) => setForm((s) => ({ ...s, requester: e.target.value }))} className={inputClass} /></Field>
          <Field label="Duração prevista (min)"><input type="number" min={0} value={form.estimatedDurationMinutes} onChange={(e) => setForm((s) => ({ ...s, estimatedDurationMinutes: Number(e.target.value) }))} className={inputClass} /></Field>
          {canViewCosts && <Field label="Custo previsto"><input type="number" min={0} value={form.estimatedCost} onChange={(e) => setForm((s) => ({ ...s, estimatedCost: Number(e.target.value) }))} className={inputClass} /></Field>}
          {canViewCosts && <Field label="Custo real"><input type="number" min={0} value={form.actualCost} onChange={(e) => setForm((s) => ({ ...s, actualCost: Number(e.target.value) }))} className={inputClass} /></Field>}
          <ScopeFields projects={projects} sites={sites} projectId={form.projectId} constructionSiteId={form.constructionSiteId} onChange={(patch) => setForm((s) => ({ ...s, ...patch }))} />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Descrição"><textarea value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} className={cn(inputClass, 'min-h-24')} /></Field>
          <Field label="Checklist"><textarea value={form.checklist} onChange={(e) => setForm((s) => ({ ...s, checklist: e.target.value }))} className={cn(inputClass, 'min-h-24')} /></Field>
          <Field label="Evidências / links"><textarea value={form.evidence} onChange={(e) => setForm((s) => ({ ...s, evidence: e.target.value }))} className={cn(inputClass, 'min-h-24')} /></Field>
          <Field label="PMBOK · Escopo"><textarea value={form.pmbokScope} onChange={(e) => setForm((s) => ({ ...s, pmbokScope: e.target.value }))} className={cn(inputClass, 'min-h-24')} /></Field>
          <Field label="PMBOK · Riscos"><textarea value={form.pmbokRisk} onChange={(e) => setForm((s) => ({ ...s, pmbokRisk: e.target.value }))} className={cn(inputClass, 'min-h-24')} /></Field>
          <Field label="Lean/LPS · Restrição opcional"><textarea value={form.lpsRestriction} onChange={(e) => setForm((s) => ({ ...s, lpsRestriction: e.target.value }))} className={cn(inputClass, 'min-h-24')} /></Field>
        </div>
        <div className="mt-3 space-y-1.5">
          <span className={labelClass}>Ativos vinculados</span>
          <MultiAssetPicker assets={assets} value={form.assetIds} onChange={(assetIds) => setForm((s) => ({ ...s, assetIds }))} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#e5e5e5]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.planned} onChange={(e) => setForm((s) => ({ ...s, planned: e.target.checked }))} /> OS planejada</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.createLookahead} onChange={(e) => setForm((s) => ({ ...s, createLookahead: e.target.checked }))} /> Sinalizar para Lean/LPS</label>
        </div>
        <ModalActions onCancel={onClose} saving={saving} />
      </form>
    </ModalShell>
  )
}

function MonitoringModal({ item, assets, projects, sites, onClose }: { item?: MaintenanceMonitoringPoint; assets: MaintenanceAsset[]; projects: Project[]; sites: ConstructionSite[]; onClose: () => void }) {
  const addMonitoringPoint = useManutencoesStore((state) => state.addMonitoringPoint)
  const updateMonitoringPoint = useManutencoesStore((state) => state.updateMonitoringPoint)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: item?.code ?? '',
    locationPart: item?.locationPart ?? '',
    description: item?.description ?? '',
    deviceState: item?.deviceState ?? '--',
    enabled: item?.enabled ?? true,
    serialNumber: item?.serialNumber ?? '',
    isCounter: item?.isCounter ?? false,
    unit: item?.unit ?? '',
    lastReadingDate: item?.lastReadingDate ?? '',
    lastReadingValue: item?.lastReadingValue ?? '',
    minValue: item?.minValue ?? '',
    maxValue: item?.maxValue ?? '',
    notes: item?.notes ?? '',
    assetId: item?.assetId ?? '',
    projectId: item?.projectId ?? '',
    constructionSiteId: item?.constructionSiteId ?? '',
  })

  function applyAsset(assetId: string) {
    const asset = assets.find((candidate) => candidate.id === assetId)
    setForm((s) => ({
      ...s,
      assetId,
      locationPart: asset ? `${asset.name} { ${asset.code} }` : s.locationPart,
      projectId: asset?.projectId ?? s.projectId,
      constructionSiteId: asset?.constructionSiteId ?? s.constructionSiteId,
    }))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!form.description.trim()) return
    setSaving(true)
    const payload = {
      code: form.code,
      locationPart: form.locationPart,
      description: form.description,
      deviceState: form.deviceState,
      enabled: form.enabled,
      serialNumber: form.serialNumber,
      isCounter: form.isCounter,
      unit: form.unit,
      lastReadingDate: form.lastReadingDate,
      lastReadingValue: form.lastReadingValue,
      minValue: form.minValue === '' ? null : Number(form.minValue),
      maxValue: form.maxValue === '' ? null : Number(form.maxValue),
      notes: form.notes,
      assetId: form.assetId || null,
      projectId: form.projectId.trim() || null,
      constructionSiteId: form.constructionSiteId.trim() || null,
    }
    if (item) await updateMonitoringPoint(item.id, payload)
    else await addMonitoringPoint(payload)
    setSaving(false)
    onClose()
  }

  return (
    <ModalShell title={item ? 'Editar Monitoramento' : 'Novo Monitoramento'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Código"><input value={form.code} onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))} className={inputClass} placeholder="MON-001" /></Field>
          <Field label="Ativo vinculado">
            <select value={form.assetId} onChange={(e) => applyAsset(e.target.value)} className={inputClass}>
              <option value="">Sem ativo vinculado</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.code} · {asset.name}</option>)}
            </select>
          </Field>
          <Field label="Localização ou parte de"><input value={form.locationPart} onChange={(e) => setForm((s) => ({ ...s, locationPart: e.target.value }))} className={inputClass} /></Field>
          <Field label="Descrição Sensor / Medidor"><input value={form.description} onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))} className={inputClass} placeholder="Temperatura, pressão, corrente..." /></Field>
          <Field label="Estado do dispositivo"><input value={form.deviceState} onChange={(e) => setForm((s) => ({ ...s, deviceState: e.target.value }))} className={inputClass} placeholder="--, online, alerta..." /></Field>
          <Field label="Número de série"><input value={form.serialNumber} onChange={(e) => setForm((s) => ({ ...s, serialNumber: e.target.value }))} className={inputClass} /></Field>
          <Field label="Unidade"><input value={form.unit} onChange={(e) => setForm((s) => ({ ...s, unit: e.target.value }))} className={inputClass} placeholder="(°C) Celsius, (PSI) Pressão" /></Field>
          <Field label="Última data"><input type="date" value={form.lastReadingDate} onChange={(e) => setForm((s) => ({ ...s, lastReadingDate: e.target.value }))} className={inputClass} /></Field>
          <Field label="Última leitura"><input value={form.lastReadingValue} onChange={(e) => setForm((s) => ({ ...s, lastReadingValue: e.target.value }))} className={inputClass} placeholder="24,1; Máximo: 30" /></Field>
          <Field label="Mínimo"><input type="number" value={form.minValue} onChange={(e) => setForm((s) => ({ ...s, minValue: e.target.value }))} className={inputClass} /></Field>
          <Field label="Máximo"><input type="number" value={form.maxValue} onChange={(e) => setForm((s) => ({ ...s, maxValue: e.target.value }))} className={inputClass} /></Field>
          <ScopeFields projects={projects} sites={sites} projectId={form.projectId} constructionSiteId={form.constructionSiteId} onChange={(patch) => setForm((s) => ({ ...s, ...patch }))} />
        </div>
        <div className="mt-3">
          <Field label="Observações"><textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} className={cn(inputClass, 'min-h-24')} /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#e5e5e5]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.enabled} onChange={(e) => setForm((s) => ({ ...s, enabled: e.target.checked }))} /> Habilitado</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isCounter} onChange={(e) => setForm((s) => ({ ...s, isCounter: e.target.checked }))} /> É contador / acumulado</label>
        </div>
        <ModalActions onCancel={onClose} saving={saving} />
      </form>
    </ModalShell>
  )
}

function DroppableColumn({ id, children }: { id: MaintenanceStatus; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return <div ref={setNodeRef} className={cn('min-h-[480px] rounded-lg border border-[#525252] bg-[#303030] p-3', isOver && 'ring-2 ring-[#f97316]/60')}>{children}</div>
}

function OrderCard({ order, assets, onEdit, onDelete, onOpenAsset }: { order: MaintenanceWorkOrder; assets: MaintenanceAsset[]; onEdit: () => void; onDelete: () => void; onOpenAsset: (assetId: string) => void }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#3a3a3a] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#f5f5f5]">{order.code || 'OS'} · {order.title}</p>
          <p className="mt-1 text-xs text-[#a3a3a3]">Criado por {order.requester || 'não informado'}</p>
        </div>
        <Badge className={priorityTone(order.priority)}>{priorityLabels[order.priority]}</Badge>
      </div>
      <div className="space-y-2 text-xs text-[#d4d4d4]">
        <p className="line-clamp-2">{order.description || 'Sem descrição.'}</p>
        <p>
          <Wrench size={12} className="mr-1 inline" />
          {order.assetIds.length ? order.assetIds.map((id, index) => {
            const asset = assets.find((item) => item.id === id)
            return (
              <span key={id}>
                {index > 0 ? ', ' : ''}
                <button type="button" onClick={() => onOpenAsset(id)} className="font-semibold text-[#fed7aa] hover:text-white">
                  {asset?.name ?? 'Ativo removido'}
                </button>
              </span>
            )
          }) : 'Sem ativo'}
        </p>
        <div className="h-2 rounded-full bg-[#525252]"><div className="h-2 rounded-full bg-[#22c55e]" style={{ width: `${order.progress}%` }} /></div>
        <div className="flex justify-between text-[11px] text-[#a3a3a3]"><span>{order.dueDate || '-'}</span><span>{order.progress}%</span></div>
      </div>
      <div className="mt-3 flex justify-end gap-1 border-t border-[#525252]/70 pt-2">
        <button type="button" onClick={onEdit} className="rounded p-1.5 text-[#a3a3a3] hover:bg-[#484848] hover:text-white" title="Editar"><Edit2 size={14} /></button>
        <button type="button" onClick={onDelete} className="rounded p-1.5 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]" title="Excluir"><Trash2 size={14} /></button>
      </div>
    </div>
  )
}

function DraggableOrderCard(props: { order: MaintenanceWorkOrder; assets: MaintenanceAsset[]; onEdit: () => void; onDelete: () => void; onOpenAsset: (assetId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: props.order.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={isDragging ? 'z-50 opacity-80' : ''} {...attributes} {...listeners}>
      <OrderCard {...props} />
    </div>
  )
}

export function ManutencoesPage({ allowedTabs, canViewCosts = true }: { allowedTabs?: MaintenanceTab[]; canViewCosts?: boolean } = {}) {
  const profileOrgId = useAuth((state) => state.profile?.organization_id)
  const projects = useProjetosStore((state) => state.projects)
  const sites = useTorreStore((state) => state.sites)
  const pullProjetos = useProjetosStore((state) => state.pull)
  const pullTorre = useTorreStore((state) => state.pull)
  const allAssets = useManutencoesStore((state) => state.assets)
  const allPlans = useManutencoesStore((state) => state.plans)
  const allWorkOrders = useManutencoesStore((state) => state.workOrders)
  const allMonitoringPoints = useManutencoesStore((state) => state.monitoringPoints)
  const activeOrgId = useManutencoesStore((state) => state.activeOrgId)
  const activeObraId = useActiveObraStore((state) => state.activeObraId)
  // Escopo por obra ativa (null = todas; legado sem obra aparece só em "Todas as obras")
  const inObra = <T extends { constructionSiteId?: string | null }>(list: T[]) =>
    activeObraId ? list.filter((x) => (x.constructionSiteId ?? null) === activeObraId) : list
  const assets = inObra(allAssets)
  const plans = inObra(allPlans)
  const workOrders = inObra(allWorkOrders)
  const monitoringPoints = inObra(allMonitoringPoints)
  const syncStatus = useManutencoesStore((state) => state.syncStatus)
  const syncError = useManutencoesStore((state) => state.syncError)
  const lastSyncedAt = useManutencoesStore((state) => state.lastSyncedAt)
  const pull = useManutencoesStore((state) => state.pull)
  const ensureTenantScope = useManutencoesStore((state) => state.ensureTenantScope)
  const updateWorkOrder = useManutencoesStore((state) => state.updateWorkOrder)
  const deleteAsset = useManutencoesStore((state) => state.deleteAsset)
  const deletePlan = useManutencoesStore((state) => state.deletePlan)
  const deleteWorkOrder = useManutencoesStore((state) => state.deleteWorkOrder)
  const deleteMonitoringPoint = useManutencoesStore((state) => state.deleteMonitoringPoint)
  const generateWorkOrderFromPlan = useManutencoesStore((state) => state.generateWorkOrderFromPlan)
  const generateDuePreventivas = useManutencoesStore((state) => state.generateDuePreventivas)
  const selectedAssetId = useManutencoesStore((state) => state.selectedAssetId)
  const setSelectedAssetId = useManutencoesStore((state) => state.setSelectedAssetId)

  // Embutido no Predial: só as sub-abas permitidas (Ativos × Manutenções ficam em top-abas separadas).
  const visibleTabs = allowedTabs ? tabs.filter((t) => allowedTabs.includes(t.key)) : tabs
  const [tab, setTab] = useState<MaintenanceTab>(allowedTabs?.[0] ?? 'painel')
  const [query, setQuery] = useState('')
  const [scopeFilter, setScopeFilter] = useState<'todos' | 'geral' | 'vinculados'>('todos')
  const [sistemaFilter, setSistemaFilter] = useState<'todos' | MaintenanceAssetSistema>('todos')
  const [monitoringMode, setMonitoringMode] = useState<'lista' | 'avancado'>('lista')
  const [modal, setModal] = useState<ModalState>(null)
  const [completeOrder, setCompleteOrder] = useState<MaintenanceWorkOrder | null>(null)   // fechamento c/ custo (Kanban)
  const [quickOpen, setQuickOpen] = useState(false)                                       // abertura rápida (QR)
  const [genPrev, setGenPrev] = useState(false)

  useEffect(() => {
    if (!profileOrgId) return
    ensureTenantScope(profileOrgId)
    void pullProjetos()
    void pullTorre()
    void pull()
  }, [ensureTenantScope, profileOrgId, pull, pullProjetos, pullTorre])

  const tenantReady = !!profileOrgId && activeOrgId === profileOrgId
  const q = query.trim().toLowerCase()

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    if (scopeFilter === 'geral' && (asset.projectId || asset.constructionSiteId)) return false
    if (scopeFilter === 'vinculados' && !asset.projectId && !asset.constructionSiteId) return false
    if (sistemaFilter !== 'todos' && (asset.sistema ?? 'Outros') !== sistemaFilter) return false
    if (!q) return true
    return [asset.code, asset.name, asset.type, asset.location, asset.torre, asset.pavimento, asset.ambiente, asset.responsible, asset.fabricante, asset.sistema].filter(Boolean).join(' ').toLowerCase().includes(q)
  }), [assets, q, scopeFilter, sistemaFilter])

  const filteredPlans = useMemo(() => plans.filter((plan) => !q || [plan.code, plan.title, plan.description, plan.frequency].join(' ').toLowerCase().includes(q)), [plans, q])
  const filteredMonitoringPoints = useMemo(() => monitoringPoints.filter((point) => {
    if (selectedAssetId && point.assetId !== selectedAssetId) return false
    if (scopeFilter === 'geral' && (point.projectId || point.constructionSiteId)) return false
    if (scopeFilter === 'vinculados' && !point.projectId && !point.constructionSiteId && !point.assetId) return false
    if (!q) return true
    return [point.code, point.locationPart, point.description, point.deviceState, point.serialNumber, point.unit, point.lastReadingValue].join(' ').toLowerCase().includes(q)
  }), [monitoringPoints, q, scopeFilter, selectedAssetId])
  const filteredOrders = useMemo(() => workOrders.filter((order) => {
    if (selectedAssetId && !order.assetIds.includes(selectedAssetId)) return false
    if (!q) return true
    return [order.code, order.title, order.description, order.assignee, order.requester].join(' ').toLowerCase().includes(q)
  }), [q, selectedAssetId, workOrders])

  const dashboard = useMemo(() => {
    const total = workOrders.length || 1
    const concluded = workOrders.filter((order) => order.status === 'concluida').length
    const overdue = workOrders.filter((order) => order.status !== 'concluida' && order.dueDate && order.dueDate < today()).length
    const planned = workOrders.filter((order) => order.planned).length
    const stopped = assets.filter((asset) => asset.status === 'offline' || asset.status === 'maintenance').length
    return {
      inProgress: workOrders.filter((order) => order.status === 'em_processo').length,
      verification: workOrders.filter((order) => order.status === 'em_verificacao').length,
      concluded,
      overdue,
      stopped,
      monitoringEnabled: monitoringPoints.filter((point) => point.enabled).length,
      plannedStops: workOrders.filter((order) => order.planned && order.status !== 'concluida').length,
      unplannedStops: workOrders.filter((order) => !order.planned && order.status !== 'concluida').length,
      compliance: (concluded / total) * 100,
      plannedPercent: workOrders.length ? (planned / workOrders.length) * 100 : 0,
    }
  }, [assets, monitoringPoints, workOrders])

  function confirmDelete(label: string, onConfirm: () => void) {
    if (window.confirm(`Excluir "${label}"? Esta ação remove o registro da organização ativa.`)) onConfirm()
  }

  async function handleDragEnd(event: DragEndEvent) {
    const orderId = String(event.active.id)
    const status = event.over?.id as MaintenanceStatus | undefined
    if (!status || !statusColumns.some((column) => column.key === status)) return
    if (status === 'concluida') {
      const order = workOrders.find((o) => o.id === orderId)
      // Exige custo p/ fechar — só p/ papéis que veem custo (zelador/morador fecham sem custo).
      if (canViewCosts && order && Number(order.actualCost) <= 0) { setCompleteOrder(order); return }
    }
    const progress = status === 'concluida' ? 100 : status === 'pendente' ? 0 : undefined
    await updateWorkOrder(orderId, { status, ...(progress !== undefined ? { progress } : {}) })
  }

  const duePreventivasCount = useMemo(() => {
    const hoje = today()
    return plans.filter((p) => p.active && p.frequency !== 'unica' && !!p.nextDueDate && p.nextDueDate <= hoje).length
  }, [plans])

  async function runPreventivas() {
    if (genPrev) return
    setGenPrev(true)
    try {
      const n = await generateDuePreventivas(activeObraId)
      window.alert(n > 0 ? `${n} OS de preventiva gerada(s) e reprogramada(s).` : 'Nenhuma preventiva vencida no momento.')
    } finally {
      setGenPrev(false)
    }
  }

  function openAsset(assetId: string) {
    setSelectedAssetId(assetId)
    setTab('ativos')
  }

  const calendarDays = useMemo(() => {
    const base = new Date()
    const year = base.getFullYear()
    const month = base.getMonth()
    const first = new Date(year, month, 1)
    const startOffset = first.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    return Array.from({ length: startOffset + daysInMonth }, (_, index) => {
      if (index < startOffset) return null
      const day = index - startOffset + 1
      const iso = new Date(year, month, day).toISOString().slice(0, 10)
      return { day, iso, orders: filteredOrders.filter((order) => order.scheduledDate === iso || order.dueDate === iso) }
    })
  }, [filteredOrders])

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#303030] p-5 text-[#f5f5f5]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Manutenções</h1>
          <p className="mt-1 text-sm text-[#a3a3a3]">Ativos, planos e ordens de serviço isolados por empresa ativa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!tenantReady && (
            <Badge className="border-[#ca8a04]/30 bg-[#ca8a04]/15 text-[#fbbf24]">Trocando empresa...</Badge>
          )}
          <button type="button" onClick={() => void pull()} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-sm font-semibold hover:bg-[#464646]">
            <RefreshCcw size={15} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button type="button" onClick={() => setQuickOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-sm font-semibold hover:bg-[#464646]">
            <QrCode size={15} />
            Abrir chamado
          </button>
          <button type="button" onClick={() => setModal({ type: 'order' })} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white hover:bg-[#ea580c]">
            <Plus size={15} />
            Nova OS
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#525252] bg-[#383838] p-1">
        {visibleTabs.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                'inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                tab === item.key ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:bg-[#454545] hover:text-white',
              )}
            >
              <Icon size={14} />
              {item.label}
            </button>
          )
        })}
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
        <div className="relative">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-[#525252] bg-[#3a3a3a] py-2 pl-9 pr-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#737373] focus:border-[#f97316]/70" placeholder="Pesquisar ativo, plano, OS, responsável..." />
        </div>
        <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as typeof scopeFilter)} className={inputClass}>
          <option value="todos">Todos os ativos</option>
          <option value="geral">Corporativo/Geral</option>
          <option value="vinculados">Com obra/projeto</option>
        </select>
        <button type="button" onClick={() => { setQuery(''); setScopeFilter('todos'); setSistemaFilter('todos'); setSelectedAssetId(null) }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#525252] bg-[#3a3a3a] px-3 py-2 text-sm font-semibold hover:bg-[#464646]">
          <Filter size={15} />
          Limpar
        </button>
      </div>

      {syncError && <div className="mb-3 rounded-lg border border-[#dc2626]/30 bg-[#dc2626]/10 px-3 py-2 text-sm text-[#fecaca]">{syncError}</div>}

      {!tenantReady ? (
        <div className="grid flex-1 place-items-center rounded-lg border border-[#525252] bg-[#333333] text-sm text-[#a3a3a3]">Preparando dados da empresa ativa...</div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'painel' && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="OSs em Processo" value={dashboard.inProgress} icon={Settings2} tone="text-[#fb923c]" />
                <StatCard label="Aguardando validação" value={dashboard.verification} icon={Clock3} tone="text-[#60a5fa]" />
                <StatCard label="OSs Concluídas" value={dashboard.concluded} icon={CheckCircle2} tone="text-[#4ade80]" />
                <StatCard label="Tarefas atrasadas" value={dashboard.overdue} icon={AlertTriangle} tone="text-[#f87171]" />
                <StatCard label="Ativos cadastrados" value={assets.length} icon={Wrench} tone="text-[#38bdf8]" />
                <StatCard label="Sensores habilitados" value={dashboard.monitoringEnabled} icon={Gauge} tone="text-[#60a5fa]" />
                <StatCard label="Ativos parados" value={dashboard.stopped} icon={AlertTriangle} tone="text-[#fbbf24]" />
                <StatCard label="Paradas planejadas" value={dashboard.plannedStops} icon={CalendarDays} tone="text-[#4ade80]" />
                <StatCard label="Paradas não planejadas" value={dashboard.unplannedStops} icon={AlertTriangle} tone="text-[#f87171]" />
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                <Donut percent={dashboard.plannedPercent} label="Tarefas planejadas vs. não planejadas" color="#38bdf8" />
                <Donut percent={dashboard.compliance} label="Porcentagem do cumprimento" color="#22c55e" />
                <div className="rounded-lg border border-[#525252] bg-[#333333] p-4">
                  <h3 className="mb-4 text-sm font-semibold text-[#f5f5f5]">Ordens de Serviço por status</h3>
                  <div className="space-y-3">
                    {statusColumns.map((column) => {
                      const count = workOrders.filter((order) => order.status === column.key).length
                      const width = workOrders.length ? (count / workOrders.length) * 100 : 0
                      return (
                        <div key={column.key}>
                          <div className="mb-1 flex justify-between text-xs text-[#a3a3a3]"><span>{column.label}</span><span>{count}</span></div>
                          <div className="h-2 rounded-full bg-[#525252]"><div className="h-2 rounded-full" style={{ width: `${width}%`, background: column.color }} /></div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <p className="text-xs text-[#737373]">Última sincronização: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString('pt-BR') : 'ainda não sincronizado'}</p>
            </div>
          )}

          {tab === 'ativos' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['todos', ...SISTEMAS_ATIVO] as const).map((s) => (
                    <button key={s} type="button" onClick={() => setSistemaFilter(s)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', sistemaFilter === s ? 'border-[#f97316]/60 bg-[#f97316]/15 text-[#fb923c]' : 'border-[#525252] bg-[#3a3a3a] text-[#a3a3a3] hover:bg-[#464646]')}>
                      {s === 'todos' ? 'Todos os sistemas' : s}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setModal({ type: 'asset' })} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />Novo Ativo</button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[#525252] bg-[#333333]">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="border-b border-[#525252] text-left text-[#a3a3a3]">
                    <tr>{['Código', 'Ativo', 'Sistema', 'Tipo', 'Localização', 'Responsável', 'Criticidade', 'Garantia', 'Ações'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#525252]/60">
                    {filteredAssets.map((asset) => (
                      <tr key={asset.id} className={cn('hover:bg-[#3c3c3c]', selectedAssetId === asset.id && 'bg-[#f97316]/10')}>
                        <td className="px-4 py-3 font-semibold text-[#f5f5f5]">{asset.code || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <PlaquetaThumb path={asset.fotoPlaquetaPath} />
                            <button type="button" onClick={() => setSelectedAssetId(asset.id)} className="text-left font-semibold text-[#f5f5f5] hover:text-[#fb923c]">{asset.name}</button>
                          </div>
                        </td>
                        <td className="px-4 py-3">{asset.sistema ? <Badge className="border-[#525252] bg-[#2f2f2f] text-[#d4d4d4]">{asset.sistema}</Badge> : <span className="text-[#737373]">-</span>}</td>
                        <td className="px-4 py-3 text-[#d4d4d4]">{asset.type}</td>
                        <td className="px-4 py-3 text-[#d4d4d4]">{[asset.torre, asset.pavimento, asset.ambiente].filter(Boolean).join(' · ') || asset.location || '-'}</td>
                        <td className="px-4 py-3 text-[#d4d4d4]">{asset.responsible || '-'}</td>
                        <td className="px-4 py-3"><Badge className={priorityTone(asset.criticality)}>{priorityLabels[asset.criticality]}</Badge></td>
                        <td className="px-4 py-3 text-xs"><GarantiaBadge date={asset.garantiaAte} /></td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setModal({ type: 'asset', item: asset })} className="rounded p-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-white"><Edit2 size={15} /></button>
                            <button type="button" onClick={() => confirmDelete(asset.name, () => void deleteAsset(asset.id))} className="rounded p-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredAssets.length === 0 && <EmptyState title="Nenhum ativo encontrado" action={<button type="button" onClick={() => setModal({ type: 'asset' })} className="rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white">Cadastrar ativo</button>} />}
            </div>
          )}

          {tab === 'monitoramento' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-full border border-[#3b82f6]/40 bg-[#dbeafe]/5 p-1">
                  <button type="button" onClick={() => setMonitoringMode('lista')} className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold', monitoringMode === 'lista' ? 'bg-[#3b82f6] text-white' : 'text-[#93c5fd] hover:bg-[#3b82f6]/10')}>
                    <ListChecks size={16} />
                    Lista
                  </button>
                  <button type="button" onClick={() => setMonitoringMode('avancado')} className={cn('inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold', monitoringMode === 'avancado' ? 'bg-[#3b82f6] text-white' : 'text-[#93c5fd] hover:bg-[#3b82f6]/10')}>
                    <SlidersHorizontal size={16} />
                    Avançado
                  </button>
                </div>
                <button type="button" onClick={() => setModal({ type: 'monitoring' })} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white">
                  <Plus size={15} />
                  Novo Monitoramento
                </button>
              </div>

              {monitoringMode === 'avancado' && (
                <div className="grid gap-3 md:grid-cols-4">
                  <StatCard label="Pontos monitorados" value={filteredMonitoringPoints.length} icon={Gauge} tone="text-[#60a5fa]" />
                  <StatCard label="Habilitados" value={filteredMonitoringPoints.filter((point) => point.enabled).length} icon={CheckCircle2} tone="text-[#4ade80]" />
                  <StatCard label="Contadores" value={filteredMonitoringPoints.filter((point) => point.isCounter).length} icon={BarChart3} tone="text-[#fbbf24]" />
                  <StatCard label="Sem leitura" value={filteredMonitoringPoints.filter((point) => !point.lastReadingDate).length} icon={AlertTriangle} tone="text-[#f87171]" />
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-[#525252] bg-[#333333] text-[#d4d4d4]">
                <table className="w-full min-w-[1480px] text-sm">
                  <thead className="border-b border-[#525252] text-left text-[#f5f5f5]">
                    <tr>
                      <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Selecionar todos" /></th>
                      <th className="px-3 py-3 font-semibold">Ações</th>
                      <th className="px-3 py-3 font-semibold">Localização ou parte de</th>
                      <th className="px-3 py-3 font-semibold">Descrição Sensor / Medidor</th>
                      <th className="px-3 py-3 font-semibold">Estado do dispositivo</th>
                      <th className="px-3 py-3 font-semibold">Habilitado</th>
                      <th className="px-3 py-3 font-semibold">Número de série</th>
                      <th className="px-3 py-3 font-semibold">É um Contador / Acumulado</th>
                      <th className="px-3 py-3 font-semibold">Unidade</th>
                      <th className="px-3 py-3 font-semibold">Última Data</th>
                      <th className="px-3 py-3 font-semibold">Última leitura</th>
                      {monitoringMode === 'avancado' && (
                        <>
                          <th className="px-3 py-3 font-semibold">Faixa</th>
                          <th className="px-3 py-3 font-semibold">Ativo</th>
                          <th className="px-3 py-3 font-semibold">Observações</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#525252]/60">
                    {filteredMonitoringPoints.map((point) => (
                      <tr key={point.id} className="hover:bg-[#3c3c3c]">
                        <td className="px-4 py-3"><input type="checkbox" aria-label={`Selecionar ${point.description}`} /></td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2 text-[#a3a3a3]">
                            <button type="button" onClick={() => setModal({ type: 'monitoring', item: point })} title="Visualizar / editar" className="hover:text-[#f97316]"><Eye size={17} /></button>
                            <button type="button" onClick={() => setModal({ type: 'monitoring', item: point })} title="Editar" className="hover:text-[#f97316]"><Edit2 size={17} /></button>
                            <button type="button" onClick={() => point.assetId && openAsset(point.assetId)} title="Abrir ativo vinculado" className="hover:text-[#f97316]"><Link2 size={17} /></button>
                            <button type="button" onClick={() => confirmDelete(point.description, () => void deleteMonitoringPoint(point.id))} title="Excluir" className="hover:text-[#dc2626]"><Trash2 size={17} /></button>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium text-[#f5f5f5]">{point.locationPart || '-'}</td>
                        <td className="px-3 py-3 text-[#d4d4d4]">{point.description}</td>
                        <td className="px-3 py-3 text-center text-[#d4d4d4]">{point.deviceState || '--'}</td>
                        <td className="px-3 py-3"><span className={cn('rounded-full px-3 py-1 font-semibold', point.enabled ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#fee2e2] text-[#dc2626]')}>{point.enabled ? 'Sim' : 'Não'}</span></td>
                        <td className="px-3 py-3 text-[#d4d4d4]">{point.serialNumber || '-'}</td>
                        <td className="px-3 py-3"><span className={cn('rounded-full px-3 py-1 font-semibold', point.isCounter ? 'bg-[#dbeafe] text-[#2563eb]' : 'bg-[#fee2e2] text-[#dc2626]')}>{point.isCounter ? 'Sim' : 'Não'}</span></td>
                        <td className="px-3 py-3 text-[#d4d4d4]">{point.unit || '-'}</td>
                        <td className="px-3 py-3 text-[#d4d4d4]">{point.lastReadingDate || '---'}</td>
                        <td className="px-3 py-3 font-semibold text-[#f5f5f5]">{point.lastReadingValue || '---'}</td>
                        {monitoringMode === 'avancado' && (
                          <>
                            <td className="px-3 py-3 text-[#d4d4d4]">{point.minValue ?? '-'} / {point.maxValue ?? '-'}</td>
                            <td className="px-3 py-3 text-[#d4d4d4]">{point.assetId ? <AssetName id={point.assetId} assets={assets} /> : 'Sem ativo'}</td>
                            <td className="px-3 py-3 text-[#d4d4d4]">{point.notes || '-'}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredMonitoringPoints.length === 0 && <EmptyState title="Nenhum ponto de monitoramento encontrado" action={<button type="button" onClick={() => setModal({ type: 'monitoring' })} className="rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white">Cadastrar monitoramento</button>} />}
            </div>
          )}

          {tab === 'tarefas' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => void runPreventivas()} disabled={genPrev} className="inline-flex items-center gap-2 rounded-lg border border-[#f97316]/40 px-3 py-2 text-sm font-semibold text-[#fb923c] hover:bg-[#f97316]/10 disabled:opacity-60" title="Abre OS para todo plano ativo com vencimento até hoje e reprograma a próxima data">
                  <Zap size={15} /> {genPrev ? 'Gerando...' : `Gerar preventivas vencidas${duePreventivasCount > 0 ? ` (${duePreventivasCount})` : ''}`}
                </button>
                <button type="button" onClick={() => setModal({ type: 'plan' })} className="inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-semibold text-white"><Plus size={15} />Novo Plano</button>
              </div>
              <div className="grid gap-3 xl:grid-cols-2">
                {filteredPlans.map((plan) => (
                  <div key={plan.id} className="rounded-lg border border-[#525252] bg-[#333333] p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#a3a3a3]">{plan.code || 'Plano'}</p>
                        <h3 className="mt-1 text-base font-bold text-[#f5f5f5]">{plan.title}</h3>
                      </div>
                      <Badge className={priorityTone(plan.priority)}>{priorityLabels[plan.priority]}</Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-[#d4d4d4]">{plan.description || 'Sem descrição.'}</p>
                    <div className="mt-4 grid gap-2 text-xs text-[#a3a3a3] sm:grid-cols-3">
                      <span>Frequência: {frequencyLabels[plan.frequency]}</span>
                      <span>Próxima: {plan.nextDueDate || '-'}</span>
                      <span>Ativos: {plan.assetIds.length}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-[#525252]/70 pt-3">
                      <button type="button" onClick={() => void generateWorkOrderFromPlan(plan.id)} className="rounded-lg border border-[#f97316]/40 px-3 py-2 text-xs font-semibold text-[#fb923c] hover:bg-[#f97316]/10">Gerar OS</button>
                      <button type="button" onClick={() => setModal({ type: 'plan', item: plan })} className="rounded-lg border border-[#525252] px-3 py-2 text-xs font-semibold text-[#e5e5e5] hover:bg-[#444]">Editar</button>
                      <button type="button" onClick={() => confirmDelete(plan.title, () => void deletePlan(plan.id))} className="rounded-lg border border-[#dc2626]/30 px-3 py-2 text-xs font-semibold text-[#f87171] hover:bg-[#dc2626]/10">Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
              {filteredPlans.length === 0 && <EmptyState title="Nenhum plano de manutenção encontrado" />}
            </div>
          )}

          {tab === 'ordens' && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border border-[#525252] bg-[#333333]">
                <table className="w-full min-w-[1120px] text-sm">
                  <thead className="border-b border-[#525252] text-left text-[#a3a3a3]">
                    <tr>{['OS ID', 'Status', 'Código', 'Ativos', 'Fora de serviço', 'Dependências', 'Tarefa', 'Vencimento', 'Ações'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[#525252]/60">
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-[#3c3c3c]">
                        <td className="px-4 py-3 text-[#d4d4d4]">{order.code || order.id.slice(0, 8)}</td>
                        <td className="px-4 py-3"><Badge className={statusTone(order.status)}>{statusLabels[order.status]}</Badge></td>
                        <td className="px-4 py-3 text-[#d4d4d4]">{order.code || '-'}</td>
                        <td className="px-4 py-3 text-[#d4d4d4]">
                          {order.assetIds.length ? order.assetIds.map((id) => (
                            <button key={id} type="button" onClick={() => openAsset(id)} className="block text-left hover:text-[#fb923c]">
                              <AssetName id={id} assets={assets} />
                            </button>
                          )) : 'Sem ativo'}
                        </td>
                        <td className="px-4 py-3"><Badge className={order.status === 'cancelada' ? 'border-[#dc2626]/30 bg-[#dc2626]/10 text-[#f87171]' : 'border-[#16a34a]/30 bg-[#16a34a]/10 text-[#4ade80]'}>{order.status === 'cancelada' ? 'Sim' : 'Não'}</Badge></td>
                        <td className="px-4 py-3 text-[#d4d4d4]">{order.leanLps.restriction ? '1' : '0'}</td>
                        <td className="px-4 py-3 font-semibold text-[#f5f5f5]">{order.title}</td>
                        <td className="px-4 py-3 text-[#d4d4d4]">{order.dueDate || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => setModal({ type: 'order', item: order })} className="rounded p-2 text-[#a3a3a3] hover:bg-[#484848] hover:text-white"><Edit2 size={15} /></button>
                            <button type="button" onClick={() => confirmDelete(order.title, () => void deleteWorkOrder(order.id))} className="rounded p-2 text-[#a3a3a3] hover:bg-[#dc2626]/20 hover:text-[#f87171]"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredOrders.length === 0 && <EmptyState title="Nenhuma ordem de serviço encontrada" />}
            </div>
          )}

          {tab === 'kanban' && (
            <DndContext onDragEnd={handleDragEnd}>
              <div className="grid min-w-[1180px] gap-3 xl:grid-cols-5">
                {statusColumns.map((column) => {
                  const orders = filteredOrders.filter((order) => order.status === column.key)
                  return (
                    <DroppableColumn key={column.key} id={column.key}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#f5f5f5]">{column.label}</h3>
                        <span className="text-xs text-[#a3a3a3]">{orders.length}</span>
                      </div>
                      <div className="space-y-3">
                        {orders.map((order) => (
                          <DraggableOrderCard key={order.id} order={order} assets={assets} onEdit={() => setModal({ type: 'order', item: order })} onDelete={() => confirmDelete(order.title, () => void deleteWorkOrder(order.id))} onOpenAsset={openAsset} />
                        ))}
                      </div>
                    </DroppableColumn>
                  )
                })}
              </div>
            </DndContext>
          )}

          {tab === 'calendario' && (
            <div className="rounded-lg border border-[#525252] bg-[#333333] p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-[#f5f5f5]">Calendário de OS</h3>
                <p className="text-xs text-[#a3a3a3]">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="grid grid-cols-7 gap-2 text-xs text-[#a3a3a3]">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => <div key={day} className="px-2 py-1 font-semibold">{day}</div>)}
                {calendarDays.map((day, index) => (
                  <div key={index} className="min-h-28 rounded-lg border border-[#525252] bg-[#303030] p-2">
                    {day && (
                      <>
                        <p className="mb-2 text-xs font-bold text-[#f5f5f5]">{day.day}</p>
                        <div className="space-y-1">
                          {day.orders.slice(0, 3).map((order) => (
                            <button key={order.id} type="button" onClick={() => setModal({ type: 'order', item: order })} className="block w-full truncate rounded bg-[#f97316]/15 px-2 py-1 text-left text-[11px] text-[#fed7aa]">
                              {order.code || 'OS'} · {order.title}
                            </button>
                          ))}
                          {day.orders.length > 3 && <p className="text-[11px] text-[#a3a3a3]">+{day.orders.length - 3} OS</p>}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {modal?.type === 'asset' && <AssetModal item={modal.item} projects={projects} sites={sites} canViewCosts={canViewCosts} onClose={() => setModal(null)} />}
      {modal?.type === 'monitoring' && <MonitoringModal item={modal.item} assets={assets} projects={projects} sites={sites} onClose={() => setModal(null)} />}
      {modal?.type === 'plan' && <PlanModal item={modal.item} assets={assets} projects={projects} sites={sites} onClose={() => setModal(null)} />}
      {modal?.type === 'order' && <OrderModal item={modal.item} assets={assets} plans={plans} projects={projects} sites={sites} canViewCosts={canViewCosts} onClose={() => setModal(null)} />}
      {completeOrder && <CompleteOrderModal order={completeOrder} onClose={() => setCompleteOrder(null)} />}
      {quickOpen && <QuickChamadoModal assets={assets} onClose={() => setQuickOpen(false)} />}
    </div>
  )
}

// Fechamento de OS pelo Kanban exigindo o custo real (gestão de manutenção NBR 5674).
function CompleteOrderModal({ order, onClose }: { order: MaintenanceWorkOrder; onClose: () => void }) {
  const updateWorkOrder = useManutencoesStore((s) => s.updateWorkOrder)
  const [custo, setCusto] = useState(order.actualCost || order.estimatedCost || 0)
  const [saving, setSaving] = useState(false)
  async function concluir() {
    if (Number(custo) <= 0) { window.alert('Informe o custo real (maior que zero) para concluir.'); return }
    setSaving(true)
    await updateWorkOrder(order.id, { status: 'concluida', progress: 100, actualCost: Number(custo) })
    setSaving(false)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="w-full max-w-md rounded-lg border border-[#525252] bg-[#2f2f2f] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#f5f5f5]">Concluir OS</h2>
          <button type="button" onClick={onClose} className="rounded p-2 text-[#a3a3a3] hover:bg-[#3f3f3f] hover:text-white"><X size={18} /></button>
        </div>
        <p className="mb-3 text-sm text-[#a3a3a3]">{order.code} · {order.title}</p>
        <label className="block space-y-1.5"><span className={labelClass}>Custo real (R$)</span>
          <input type="number" min={0} autoFocus value={custo} onChange={(e) => setCusto(Number(e.target.value))} className={inputClass} />
        </label>
        <div className="mt-5 flex justify-end gap-2 border-t border-[#525252] pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#525252] px-4 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#3f3f3f]">Cancelar</button>
          <button type="button" onClick={() => void concluir()} disabled={saving} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#16a34a] disabled:opacity-70">{saving ? 'Concluindo...' : 'Concluir OS'}</button>
        </div>
      </div>
    </div>
  )
}

// Abertura rápida de chamado (QR): Ativo → Sistema → Componente → Sintoma + matriz impacto×urgência.
export function QuickChamadoModal({ assets, onClose }: { assets: MaintenanceAsset[]; onClose: () => void }) {
  const addWorkOrder = useManutencoesStore((s) => s.addWorkOrder)
  const [saving, setSaving] = useState(false)
  const [busca, setBusca] = useState('')
  const [assetId, setAssetId] = useState('')
  const asset = assets.find((a) => a.id === assetId)
  const sistemasFallback = SISTEMAS_ATIVO as readonly string[]
  const [sistema, setSistema] = useState('')
  const [componente, setComponente] = useState('')
  const [sintoma, setSintoma] = useState(SINTOMAS[0])
  const [sintomaOutro, setSintomaOutro] = useState('')
  const [impacto, setImpacto] = useState<ImpactoUrgencia>('media')
  const [urgencia, setUrgencia] = useState<ImpactoUrgencia>('media')
  const [requester, setRequester] = useState('')

  // Ao escolher o ativo, herda o sistema dele (editável) e reseta o componente.
  function pickAsset(id: string) {
    setAssetId(id)
    const a = assets.find((x) => x.id === id)
    setSistema(a?.sistema ?? '')
    setComponente('')
  }
  const b = busca.trim().toLowerCase()
  const matches = b
    ? assets.filter((a) => [a.code, a.name, a.qrCode, a.location].filter(Boolean).join(' ').toLowerCase().includes(b)).slice(0, 8)
    : []
  const componentes = componentesDoSistema(sistema)
  const prioridade = prioridadeDaMatriz(impacto, urgencia)
  const sintomaFinal = sintoma === 'Outro' ? (sintomaOutro.trim() || 'Outro') : sintoma
  const titulo = [sistema || asset?.type, componente, sintomaFinal].filter(Boolean).join(' · ') || 'Chamado'

  async function abrir() {
    if (!asset) { window.alert('Selecione o ativo (escaneie/digite o QR ou busque pelo nome).'); return }
    setSaving(true)
    const id = await addWorkOrder({
      title: titulo,
      description: `Chamado aberto via QR. Ativo: ${asset.code || ''} ${asset.name}. Sistema: ${sistema || '—'}. Componente: ${componente || '—'}. Sintoma: ${sintomaFinal}.`,
      status: 'pendente',
      planned: false,
      priority: prioridade,
      severity: prioridade,
      impacto,
      urgencia,
      requester: requester.trim(),
      assetIds: [asset.id],
      projectId: asset.projectId,
      constructionSiteId: asset.constructionSiteId,
    })
    setSaving(false)
    if (id) onClose()
    else window.alert('Não foi possível abrir o chamado. Tente novamente.')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-[#525252] bg-[#2f2f2f] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[#f5f5f5]"><QrCode size={18} className="text-[#f97316]" /> Abrir chamado</h2>
          <button type="button" onClick={onClose} className="rounded p-2 text-[#a3a3a3] hover:bg-[#3f3f3f] hover:text-white"><X size={18} /></button>
        </div>

        {!asset ? (
          <div className="space-y-2">
            <label className="block space-y-1.5"><span className={labelClass}>Ativo (escaneie/digite o QR/código ou busque)</span>
              <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Código, QR, nome ou local do ativo..." className={inputClass} />
            </label>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-[#525252] bg-[#333]">
              {matches.length === 0 ? (
                <p className="px-3 py-3 text-sm text-[#737373]">{b ? 'Nenhum ativo encontrado.' : 'Comece a digitar para localizar o ativo.'}</p>
              ) : matches.map((a) => (
                <button key={a.id} type="button" onClick={() => pickAsset(a.id)} className="flex w-full items-center justify-between gap-3 border-b border-[#525252]/60 px-3 py-2 text-left text-sm hover:bg-[#3c3c3c]">
                  <span><span className="font-semibold text-[#f5f5f5]">{a.name}</span> <span className="text-[#a3a3a3]">{a.code}</span></span>
                  <span className="text-xs text-[#737373]">{a.sistema ?? a.type}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-[#525252] bg-[#333] px-3 py-2 text-sm">
              <span><span className="font-semibold text-[#f5f5f5]">{asset.name}</span> <span className="text-[#a3a3a3]">{asset.code}</span></span>
              <button type="button" onClick={() => { setAssetId(''); setBusca('') }} className="text-xs text-[#a3a3a3] hover:text-[#fb923c]">trocar</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5"><span className={labelClass}>Sistema</span>
                <select value={sistema} onChange={(e) => { setSistema(e.target.value); setComponente('') }} className={inputClass}>
                  <option value="">—</option>
                  {sistemasFallback.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="space-y-1.5"><span className={labelClass}>Componente</span>
                <select value={componente} onChange={(e) => setComponente(e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  {componentes.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label className="space-y-1.5"><span className={labelClass}>Sintoma</span>
                <select value={sintoma} onChange={(e) => setSintoma(e.target.value)} className={inputClass}>
                  {SINTOMAS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              {sintoma === 'Outro' && (
                <label className="space-y-1.5"><span className={labelClass}>Descreva o sintoma</span>
                  <input value={sintomaOutro} onChange={(e) => setSintomaOutro(e.target.value)} className={inputClass} />
                </label>
              )}
              <label className="space-y-1.5"><span className={labelClass}>Impacto</span>
                <select value={impacto} onChange={(e) => setImpacto(e.target.value as ImpactoUrgencia)} className={inputClass}>
                  {(['baixa', 'media', 'alta'] as ImpactoUrgencia[]).map((v) => <option key={v} value={v}>{IU_LABELS[v]}</option>)}
                </select>
              </label>
              <label className="space-y-1.5"><span className={labelClass}>Urgência</span>
                <select value={urgencia} onChange={(e) => setUrgencia(e.target.value as ImpactoUrgencia)} className={inputClass}>
                  {(['baixa', 'media', 'alta'] as ImpactoUrgencia[]).map((v) => <option key={v} value={v}>{IU_LABELS[v]}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 sm:col-span-2"><span className={labelClass}>Solicitante</span>
                <input value={requester} onChange={(e) => setRequester(e.target.value)} className={inputClass} placeholder="Quem abriu o chamado" />
              </label>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-[#525252] bg-[#333] px-3 py-2 text-sm">
              <span className="text-[#a3a3a3]">Prioridade (matriz)</span>
              <Badge className={priorityTone(prioridade)}>{priorityLabels[prioridade]}</Badge>
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-[#525252] pt-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[#525252] px-4 py-2 text-sm font-semibold text-[#e5e5e5] hover:bg-[#3f3f3f]">Cancelar</button>
          <button type="button" onClick={() => void abrir()} disabled={saving || !asset} className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea580c] disabled:opacity-60">{saving ? 'Abrindo...' : 'Abrir chamado'}</button>
        </div>
      </div>
    </div>
  )
}
