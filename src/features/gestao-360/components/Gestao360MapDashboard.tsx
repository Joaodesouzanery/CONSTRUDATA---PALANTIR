/**
 * Gestao360MapDashboard — Interactive map of all projects with severity markers.
 * Clicking a marker opens a side panel with Overview / Work Orders / Cronograma.
 */
import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X, MapPin, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { useProjetosStore } from '@/store/projetosStore'
import type { Project, ProjectPhase } from '@/types'

// ─── Severity ─────────────────────────────────────────────────────────────────

type Severity = 'critical' | 'high' | 'medium' | 'ok'

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  ok:       '#22c55e',
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  ok:       'OK',
}

function calcSeverity(project: Project): Severity {
  const today = new Date()
  const end   = new Date(project.endDate + 'T00:00:00')
  const delayDays = Math.max(0, Math.floor((today.getTime() - end.getTime()) / 86_400_000))

  const lines    = project.budgetLines
  const budgeted = lines.reduce((s, l) => s + l.budgeted, 0)
  const eac      = lines.reduce((s, l) => s + l.projected, 0)
  const pctOver  = budgeted > 0 ? ((eac - budgeted) / budgeted) * 100 : 0

  if (delayDays > 30 || pctOver > 20) return 'critical'
  if (delayDays > 15 || pctOver > 10) return 'high'
  if (delayDays > 1  || pctOver > 5)  return 'medium'
  return 'ok'
}

function calcProgress(project: Project): number {
  const phases = project.executionPhases
  if (!phases.length) return 0
  return Math.round(phases.reduce((s, p) => s + p.progress, 0) / phases.length)
}

function calcBudgetDelta(project: Project): number {
  const lines    = project.budgetLines
  const budgeted = lines.reduce((s, l) => s + l.budgeted, 0)
  const eac      = lines.reduce((s, l) => s + l.projected, 0)
  return budgeted > 0 ? ((eac - budgeted) / budgeted) * 100 : 0
}

function makeDivIcon(severity: Severity, selected: boolean) {
  const color = SEVERITY_COLOR[severity]
  const size  = selected ? 20 : 14
  const glow  = selected ? `0 0 0 3px ${color}55, 0 0 12px ${color}66` : `0 2px 6px rgba(0,0,0,0.5)`
  return L.divIcon({
    className: '',
    iconAnchor: [size / 2, size / 2],
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};
      box-shadow:${glow};
      border:2px solid rgba(255,255,255,0.8);
      transition:all 0.15s;
    "></div>`,
  })
}

// ─── Marker layer (imperative Leaflet, bypasses react-leaflet for performance) ─

interface MarkerLayerProps {
  projects: Project[]
  selected: string | null
  onSelect: (id: string) => void
}

function MarkerLayer({ projects, selected, onSelect }: MarkerLayerProps) {
  const map = useMap()
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  useEffect(() => {
    const existing = markersRef.current

    // Remove stale markers
    existing.forEach((m, id) => {
      if (!projects.find((p) => p.id === id)) {
        m.remove()
        existing.delete(id)
      }
    })

    // Add/update markers
    projects.forEach((project) => {
      if (project.lat == null || project.lng == null) return
      const severity = calcSeverity(project)
      const isSel    = project.id === selected

      if (existing.has(project.id)) {
        existing.get(project.id)!.setIcon(makeDivIcon(severity, isSel))
      } else {
        const marker = L.marker([project.lat, project.lng], {
          icon: makeDivIcon(severity, isSel),
        })
          .addTo(map)
          .on('click', () => onSelect(project.id))

        marker.bindTooltip(
          `<div style="font-size:12px;font-weight:600;color:#e4f2f8">${project.name}</div>` +
          `<div style="font-size:10px;color:${SEVERITY_COLOR[severity]}">${SEVERITY_LABEL[severity]}</div>`,
          { direction: 'top', offset: [0, -10], className: 'leaflet-tooltip-gestao360' }
        )
        existing.set(project.id, marker)
      }
    })
  }, [projects, selected, map, onSelect])

  // Pan to selected
  useEffect(() => {
    if (!selected) return
    const project = projects.find((p) => p.id === selected)
    if (project?.lat != null && project.lng != null) {
      map.setView([project.lat, project.lng], Math.max(map.getZoom(), 11), { animate: true })
    }
  }, [selected, projects, map])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current.clear()
    }
  }, [])

  return null
}

// ─── ProjectSidePanel ─────────────────────────────────────────────────────────

type SideTab = 'overview' | 'workorders' | 'cronograma'

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtBRL(n: number) {
  if (n >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `R$${(n / 1_000).toFixed(0)}k`
  return `R$${n.toFixed(0)}`
}

function PhaseStatusBadge({ status }: { status: ProjectPhase['status'] }) {
  const map: Record<string, { label: string; color: string }> = {
    completed:   { label: 'Concluído', color: '#22c55e' },
    in_progress: { label: 'Em andamento', color: '#2abfdc' },
    not_started: { label: 'Não iniciado', color: '#6b6b6b' },
  }
  const cfg = map[status] ?? { label: status, color: '#6b6b6b' }
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
      style={{ color: cfg.color, background: `${cfg.color}20` }}
    >
      {cfg.label}
    </span>
  )
}

function GanttSvg({ project }: { project: Project }) {
  const all: Array<ProjectPhase & { group: string }> = [
    ...project.planningPhases.map((p) => ({ ...p, group: 'Planejamento' })),
    ...project.executionPhases.map((p) => ({ ...p, group: 'Execução' })),
  ]

  const start = new Date(project.startDate + 'T00:00:00').getTime()
  const end   = new Date(project.endDate   + 'T00:00:00').getTime()
  const span  = Math.max(1, end - start)
  const W = 320, ROW = 24, LABEL = 100, BAR_H = 12

  const today     = Date.now()
  const todayX    = LABEL + ((today - start) / span) * (W - LABEL)
  const todayClip = Math.min(Math.max(todayX, LABEL), W)

  return (
    <svg width={W} height={all.length * ROW + 20} style={{ overflow: 'visible', display: 'block' }}>
      {/* Today line */}
      <line x1={todayClip} y1={0} x2={todayClip} y2={all.length * ROW + 4} stroke="#2abfdc" strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />

      {all.map((phase, i) => {
        const ps = new Date(phase.startDate + 'T00:00:00').getTime()
        const pe = new Date(phase.endDate   + 'T00:00:00').getTime()
        const x1 = LABEL + ((ps - start) / span) * (W - LABEL)
        const x2 = LABEL + ((pe - start) / span) * (W - LABEL)
        const bw = Math.max(4, x2 - x1)
        const y  = i * ROW + 6

        const statusColor =
          phase.status === 'completed'   ? '#22c55e' :
          phase.status === 'in_progress' ? '#2abfdc' : '#4a7592'

        const fillW = (phase.progress / 100) * bw

        return (
          <g key={phase.id}>
            <text x={LABEL - 4} y={y + BAR_H / 2 + 4} textAnchor="end" fontSize={9} fill="#8fb3c8"
              style={{ fontFamily: 'Inter, sans-serif' }}>
              {phase.name.length > 14 ? phase.name.slice(0, 13) + '…' : phase.name}
            </text>
            {/* Background bar */}
            <rect x={x1} y={y} width={bw} height={BAR_H} rx={3} fill="#1c3658" />
            {/* Progress fill */}
            <rect x={x1} y={y} width={fillW} height={BAR_H} rx={3} fill={statusColor} opacity={0.7} />
            {/* Progress % */}
            <text x={x1 + bw + 3} y={y + BAR_H / 2 + 4} fontSize={9} fill={statusColor}
              style={{ fontFamily: 'Inter, sans-serif' }}>
              {phase.progress}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

interface ProjectSidePanelProps {
  project: Project
  onClose: () => void
}

function ProjectSidePanel({ project, onClose }: ProjectSidePanelProps) {
  const [tab, setTab] = useState<SideTab>('overview')
  const severity  = calcSeverity(project)
  const progress  = calcProgress(project)
  const delta     = calcBudgetDelta(project)
  const color     = SEVERITY_COLOR[severity]

  const budgeted  = project.budgetLines.reduce((s, l) => s + l.budgeted, 0)
  const eac       = project.budgetLines.reduce((s, l) => s + l.projected, 0)
  const spent     = project.budgetLines.reduce((s, l) => s + l.spent, 0)

  const woInProgress = project.executionPhases.filter((p) => p.status === 'in_progress').length
  const woComplete   = project.executionPhases.filter((p) => p.status === 'completed').length

  const sideTabs: Array<{ id: SideTab; label: string }> = [
    { id: 'overview',   label: 'Overview'     },
    { id: 'workorders', label: 'Work Orders'  },
    { id: 'cronograma', label: 'Cronograma'   },
  ]

  return (
    <div className="w-full md:w-[340px] shrink-0 flex flex-col bg-[#0e1f38] border-t md:border-t-0 md:border-l border-[#1c3658] h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-2 px-4 pt-4 pb-3 border-b border-[#1c3658]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, background: `${color}20` }}>
              {SEVERITY_LABEL[severity]}
            </span>
            <span className="text-[#4a7592] text-xs">{project.code}</span>
          </div>
          <h3 className="text-[#e4f2f8] text-sm font-semibold mt-1 leading-tight">{project.name}</h3>
          {project.address && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={10} className="text-[#4a7592]" />
              <span className="text-[#4a7592] text-[10px]">{project.address}</span>
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-[#4a7592] hover:text-[#e4f2f8] shrink-0 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#1c3658] px-4">
        {sideTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={tab === t.id
              ? 'py-2 text-xs font-semibold border-b-2 border-[#2abfdc] text-[#2abfdc] mr-4'
              : 'py-2 text-xs font-medium border-b-2 border-transparent text-[#6b6b6b] hover:text-[#e4f2f8] mr-4 transition-colors'}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'overview' && (
          <div className="flex flex-col gap-3">
            {/* Dates */}
            <div className="bg-[#112240] rounded-lg px-3 py-3 flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#4a7592]">Início planejado</span>
                <span className="text-[#e4f2f8] font-medium">{fmtDate(project.startDate)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#4a7592]">Fim planejado</span>
                <span className="text-[#e4f2f8] font-medium">{fmtDate(project.endDate)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#4a7592]">Progresso</span>
                <span className="font-bold" style={{ color }}>{progress}%</span>
              </div>
              {/* Progress bar */}
              <div className="mt-1 h-1.5 bg-[#1c3658] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: color }} />
              </div>
            </div>

            {/* Budget */}
            <div className="bg-[#112240] rounded-lg px-3 py-3 flex flex-col gap-1.5">
              <p className="text-[#4a7592] text-[10px] font-semibold uppercase tracking-wider mb-1">Financeiro</p>
              <div className="flex justify-between text-xs">
                <span className="text-[#4a7592]">Orçamento</span>
                <span className="text-[#e4f2f8] font-medium">{fmtBRL(budgeted)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#4a7592]">EAC Projetado</span>
                <span className="font-medium" style={{ color: delta > 5 ? '#ef4444' : '#22c55e' }}>{fmtBRL(eac)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#4a7592]">Gasto até agora</span>
                <span className="text-[#e4f2f8] font-medium">{fmtBRL(spent)}</span>
              </div>
              <div className="flex justify-between text-xs mt-0.5">
                <span className="text-[#4a7592]">Δ Orçamento</span>
                <span className="font-bold flex items-center gap-1"
                  style={{ color: Math.abs(delta) <= 5 ? '#22c55e' : Math.abs(delta) <= 15 ? '#eab308' : '#ef4444' }}>
                  {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Work order summary */}
            <div className="bg-[#112240] rounded-lg px-3 py-3 flex gap-4">
              <div className="flex-1 flex flex-col items-center">
                <span className="text-[#2abfdc] text-xl font-bold">{woInProgress}</span>
                <span className="text-[#4a7592] text-[10px] mt-0.5">Em andamento</span>
              </div>
              <div className="w-px bg-[#1c3658]" />
              <div className="flex-1 flex flex-col items-center">
                <span className="text-[#22c55e] text-xl font-bold">{woComplete}</span>
                <span className="text-[#4a7592] text-[10px] mt-0.5">Concluídas</span>
              </div>
            </div>

            {/* Alerts */}
            <div className="flex flex-col gap-1.5">
              {delta > 10 && (
                <div className="flex items-center gap-2 bg-[#ef444418] border border-[#ef444430] rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="text-[#ef4444] shrink-0" />
                  <span className="text-[#ef4444] text-xs">Orçamento {delta.toFixed(0)}% acima do previsto</span>
                </div>
              )}
              {delta > 5 && delta <= 10 && (
                <div className="flex items-center gap-2 bg-[#eab30818] border border-[#eab30830] rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="text-[#eab308] shrink-0" />
                  <span className="text-[#eab308] text-xs">Custo {delta.toFixed(0)}% acima — atenção</span>
                </div>
              )}
              {severity === 'ok' && (
                <div className="flex items-center gap-2 bg-[#22c55e18] border border-[#22c55e30] rounded-lg px-3 py-2">
                  <CheckCircle2 size={12} className="text-[#22c55e] shrink-0" />
                  <span className="text-[#22c55e] text-xs">Projeto no prazo e dentro do orçamento</span>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'workorders' && (
          <div className="flex flex-col gap-2">
            <p className="text-[#4a7592] text-[10px] font-semibold uppercase tracking-wider mb-1">Fases de Execução</p>
            {project.executionPhases.length === 0 && (
              <p className="text-[#4a7592] text-xs">Nenhuma fase de execução cadastrada.</p>
            )}
            {project.executionPhases.map((phase) => (
              <div key={phase.id} className="bg-[#112240] border border-[#1c3658] rounded-lg px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#e4f2f8] text-xs font-medium">{phase.name}</span>
                  <PhaseStatusBadge status={phase.status} />
                </div>
                <div className="flex gap-3 mt-1.5 text-[10px] text-[#4a7592]">
                  <span className="flex items-center gap-1">
                    <Clock size={9} />
                    {fmtDate(phase.startDate)}
                  </span>
                  <span>→</span>
                  <span>{fmtDate(phase.endDate)}</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1 bg-[#1c3658] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${phase.progress}%`,
                        background:
                          phase.status === 'completed'   ? '#22c55e' :
                          phase.status === 'in_progress' ? '#2abfdc' : '#4a7592',
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-[#8fb3c8] w-7 text-right">{phase.progress}%</span>
                </div>
                {phase.notes && (
                  <p className="text-[#4a7592] text-[10px] mt-1.5 leading-tight">{phase.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'cronograma' && (
          <div className="flex flex-col gap-3">
            <p className="text-[#4a7592] text-[10px] font-semibold uppercase tracking-wider">
              {fmtDate(project.startDate)} → {fmtDate(project.endDate)}
            </p>
            <div className="overflow-x-auto">
              <GanttSvg project={project} />
            </div>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#22c55e] inline-block" />Concluído</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#2abfdc] inline-block" />Em andamento</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#4a7592] inline-block" />Não iniciado</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Basemap config ───────────────────────────────────────────────────────────

type Basemap = 'voyager' | 'satellite' | 'outdoors' | 'dark'

const DASH_TILE_URLS: Record<Basemap, string> = {
  voyager:   'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  outdoors:  'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}

const DASH_TILE_ATTRS: Record<Basemap, string> = {
  voyager:   '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  satellite: '&copy; <a href="https://www.esri.com/">Esri</a>',
  outdoors:  '&copy; <a href="https://opentopomap.org/">OpenTopoMap</a>',
  dark:      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
}

const BASEMAP_LABELS: Record<Basemap, string> = {
  voyager:   'Ruas',
  satellite: 'Satélite',
  outdoors:  'Relevo',
  dark:      'Escuro',
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type Filter = 'all' | Severity

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function Gestao360MapDashboard() {
  const projects = useProjetosStore((s) => s.projects)
  const [filter, setFilter]     = useState<Filter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [basemap, setBasemap]   = useState<Basemap>('voyager')

  const withCoords = projects.filter((p) => p.lat != null && p.lng != null)
  const filtered   = filter === 'all' ? withCoords : withCoords.filter((p) => calcSeverity(p) === filter)
  const selected   = withCoords.find((p) => p.id === selectedId) ?? null

  const counts: Record<Severity, number> = {
    critical: withCoords.filter((p) => calcSeverity(p) === 'critical').length,
    high:     withCoords.filter((p) => calcSeverity(p) === 'high').length,
    medium:   withCoords.filter((p) => calcSeverity(p) === 'medium').length,
    ok:       withCoords.filter((p) => calcSeverity(p) === 'ok').length,
  }

  // Center of Brazil
  const center: [number, number] = [-15.0, -52.0]

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all',      label: `Todos (${withCoords.length})` },
    { id: 'critical', label: `Crítico (${counts.critical})` },
    { id: 'high',     label: `Alto (${counts.high})`        },
    { id: 'medium',   label: `Médio (${counts.medium})`     },
    { id: 'ok',       label: `OK (${counts.ok})`            },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1c3658] bg-[#0a1628] flex-wrap">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={{
              background: filter === f.id
                ? (f.id === 'all' ? '#2abfdc20' : `${SEVERITY_COLOR[f.id as Severity]}25`)
                : 'transparent',
              color: filter === f.id
                ? (f.id === 'all' ? '#2abfdc' : SEVERITY_COLOR[f.id as Severity])
                : '#6b6b6b',
              border: `1px solid ${filter === f.id
                ? (f.id === 'all' ? '#2abfdc50' : `${SEVERITY_COLOR[f.id as Severity]}50`)
                : '#1c3658'}`,
            }}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[#4a7592] text-xs">
          <MapPin size={11} />
          <span>{filtered.length} obra{filtered.length !== 1 ? 's' : ''} no mapa</span>
        </div>
      </div>

      {/* Map + side panel — stack vertically on mobile */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
        <div className={`relative ${selected ? 'h-[50vh] md:h-auto' : ''} flex-1`}>
          <MapContainer
            center={center}
            zoom={5}
            style={{ height: '100%', width: '100%', background: '#0a1628' }}
            zoomControl={true}
          >
            <TileLayer
              key={basemap}
              url={DASH_TILE_URLS[basemap]}
              attribution={DASH_TILE_ATTRS[basemap]}
              subdomains={basemap === 'satellite' ? undefined : 'abcd'}
              maxZoom={19}
            />
            <MarkerLayer
              projects={filtered}
              selected={selectedId}
              onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
            />
          </MapContainer>

          {/* Basemap switcher overlay */}
          <div className="absolute bottom-4 left-4 z-[1000] flex gap-1 bg-[#0e1f38]/90 border border-[#1c3658] rounded-lg p-1 backdrop-blur-sm">
            {(Object.keys(BASEMAP_LABELS) as Basemap[]).map((b) => (
              <button
                key={b}
                onClick={() => setBasemap(b)}
                className="px-2.5 py-1 rounded text-[10px] font-medium transition-colors"
                style={{
                  background: basemap === b ? '#2abfdc20' : 'transparent',
                  color:      basemap === b ? '#2abfdc'   : '#6b6b6b',
                  border:     `1px solid ${basemap === b ? '#2abfdc50' : 'transparent'}`,
                }}
              >
                {BASEMAP_LABELS[b]}
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <ProjectSidePanel
            project={selected}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {/* Tooltip CSS injected once */}
      <style>{`
        .leaflet-tooltip-gestao360 {
          background: #0e1f38 !important;
          border: 1px solid #1c3658 !important;
          border-radius: 6px !important;
          padding: 5px 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
          color: #e4f2f8 !important;
        }
        .leaflet-tooltip-gestao360::before {
          border-top-color: #1c3658 !important;
        }
        .leaflet-control-zoom a {
          background: #0e1f38 !important;
          color: #8fb3c8 !important;
          border-color: #1c3658 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #112240 !important;
          color: #2abfdc !important;
        }
      `}</style>
    </div>
  )
}
