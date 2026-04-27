import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Image, MapPin, X } from 'lucide-react'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useShallow } from 'zustand/react/shallow'
import type { ConstructionSite, Project, ProjectPhase } from '@/types'

type Severity = 'critical' | 'high' | 'medium' | 'ok'
type Basemap = 'voyager' | 'satellite' | 'outdoors' | 'dark'
type Filter = 'all' | Severity

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

const SITE_STATUS_COLOR: Record<ConstructionSite['status'], string> = {
  active:    '#3b82f6',
  planning:  '#a855f7',
  paused:    '#eab308',
  completed: '#22c55e',
}

const SITE_STATUS_LABEL: Record<ConstructionSite['status'], string> = {
  active:    'Ativa',
  planning:  'Planejamento',
  paused:    'Pausada',
  completed: 'Concluída',
}

const TILE_CONFIG: Record<Basemap, { url: string; attribution: string; subdomains?: string }> = {
  voyager: {
    url:         'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains:  'abcd',
  },
  satellite: {
    url:         'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar, Earthstar Geographics',
  },
  outdoors: {
    url:         'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    subdomains:  'abc',
  },
  dark: {
    url:         'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains:  'abcd',
  },
}

const BASEMAP_LABELS: Record<Basemap, string> = {
  voyager: 'Ruas', satellite: 'Satélite', outdoors: 'Relevo', dark: 'Escuro',
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

function calcSeverity(project: Project): Severity {
  const today = new Date()
  const end = new Date(project.endDate + 'T00:00:00')
  const delayDays = Math.max(0, Math.floor((today.getTime() - end.getTime()) / 86_400_000))
  const budgeted = project.budgetLines.reduce((s, l) => s + l.budgeted, 0)
  const eac = project.budgetLines.reduce((s, l) => s + l.projected, 0)
  const pctOver = budgeted > 0 ? ((eac - budgeted) / budgeted) * 100 : 0
  if (delayDays > 30 || pctOver > 20) return 'critical'
  if (delayDays > 15 || pctOver > 10) return 'high'
  if (delayDays > 1 || pctOver > 5) return 'medium'
  return 'ok'
}

function calcProgress(project: Project): number {
  return project.executionPhases.length
    ? Math.round(project.executionPhases.reduce((s, p) => s + p.progress, 0) / project.executionPhases.length)
    : 0
}

function calcBudgetDelta(project: Project): number {
  const budgeted = project.budgetLines.reduce((s, l) => s + l.budgeted, 0)
  const eac = project.budgetLines.reduce((s, l) => s + l.projected, 0)
  return budgeted > 0 ? ((eac - budgeted) / budgeted) * 100 : 0
}

function makeProjectIcon(project: Project, selected: boolean) {
  const severity = calcSeverity(project)
  const color = SEVERITY_COLOR[severity]
  const label = project.name.length > 22 ? `${project.name.slice(0, 21)}...` : project.name
  const glow = selected ? `0 0 0 2px ${color}60, 0 0 14px ${color}80` : '0 2px 8px rgba(0,0,0,0.6)'
  return L.divIcon({
    className: '',
    iconAnchor: [44, 38],
    html: `
      <div style="position:relative;display:inline-flex;flex-direction:column;align-items:center;">
        <div style="display:flex;align-items:center;gap:5px;background:#2c2c2cdd;border:1.5px solid ${color};border-radius:8px;padding:4px 8px;box-shadow:${glow};min-width:118px;max-width:178px;justify-content:center;">
          <div style="width:9px;height:9px;border-radius:50%;background:${color};flex-shrink:0;box-shadow:0 0 5px ${color}aa;"></div>
          <span style="color:#f5f5f5;font-size:10px;font-weight:700;font-family:Inter,sans-serif;white-space:nowrap;letter-spacing:0.03em;">${escapeHtml(label)}</span>
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${color};margin-top:-1px;"></div>
      </div>
    `,
  })
}

function makeSiteIcon(site: ConstructionSite, selected: boolean) {
  const color = SITE_STATUS_COLOR[site.status]
  const label = site.name.length > 22 ? `${site.name.slice(0, 21)}...` : site.name
  const glow = selected ? `0 0 0 2px ${color}60, 0 0 14px ${color}80` : '0 2px 8px rgba(0,0,0,0.55)'
  return L.divIcon({
    className: '',
    iconAnchor: [44, 38],
    html: `
      <div style="position:relative;display:inline-flex;flex-direction:column;align-items:center;">
        <div style="display:flex;align-items:center;gap:5px;background:#1f2937dd;border:1.5px dashed ${color};border-radius:8px;padding:4px 8px;box-shadow:${glow};min-width:118px;max-width:178px;justify-content:center;">
          <div style="width:9px;height:9px;border-radius:2px;background:${color};flex-shrink:0;box-shadow:0 0 5px ${color}aa;"></div>
          <span style="color:#f5f5f5;font-size:10px;font-weight:700;font-family:Inter,sans-serif;white-space:nowrap;letter-spacing:0.03em;">${escapeHtml(label)}</span>
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${color};margin-top:-1px;"></div>
      </div>
    `,
  })
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtBRL(n: number) {
  if (n >= 1_000_000) return `R$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `R$${(n / 1_000).toFixed(0)}k`
  return `R$${n.toFixed(0)}`
}

function PhaseStatusBadge({ status }: { status: ProjectPhase['status'] }) {
  const map: Record<string, { label: string; color: string }> = {
    completed: { label: 'Concluído', color: '#22c55e' },
    in_progress: { label: 'Em andamento', color: '#f97316' },
    not_started: { label: 'Não iniciado', color: '#6b6b6b' },
    delayed: { label: 'Atrasado', color: '#ef4444' },
  }
  const cfg = map[status] ?? { label: status, color: '#6b6b6b' }
  return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: cfg.color, background: `${cfg.color}20` }}>{cfg.label}</span>
}

function GanttSvg({ project, W = 540 }: { project: Project; W?: number }) {
  const [today] = useState(() => Date.now())
  const all = [...project.planningPhases, ...project.executionPhases]
  const start = new Date(project.startDate + 'T00:00:00').getTime()
  const end = new Date(project.endDate + 'T00:00:00').getTime()
  const span = Math.max(1, end - start)
  const label = 110
  const todayX = Math.min(Math.max(label + ((today - start) / span) * (W - label), label), W)
  return (
    <svg width={W} height={all.length * 24 + 20} style={{ overflow: 'visible', display: 'block' }}>
      <line x1={todayX} y1={0} x2={todayX} y2={all.length * 24 + 4} stroke="#f97316" strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
      {all.map((phase, i) => {
        const ps = new Date(phase.startDate + 'T00:00:00').getTime()
        const pe = new Date(phase.endDate + 'T00:00:00').getTime()
        const x1 = label + ((ps - start) / span) * (W - label)
        const x2 = label + ((pe - start) / span) * (W - label)
        const bw = Math.max(4, x2 - x1)
        const y = i * 24 + 6
        const color = phase.status === 'completed' ? '#22c55e' : phase.status === 'in_progress' ? '#f97316' : phase.status === 'delayed' ? '#ef4444' : '#6b6b6b'
        return (
          <g key={phase.id}>
            <text x={label - 4} y={y + 10} textAnchor="end" fontSize={9} fill="#a3a3a3">{phase.name.length > 16 ? phase.name.slice(0, 15) + '...' : phase.name}</text>
            <rect x={x1} y={y} width={bw} height={12} rx={3} fill="#525252" />
            <rect x={x1} y={y} width={(phase.progress / 100) * bw} height={12} rx={3} fill={color} opacity={0.75} />
            <text x={x1 + bw + 3} y={y + 10} fontSize={9} fill={color}>{phase.progress}%</text>
          </g>
        )
      })}
    </svg>
  )
}

function Project360Modal({ project, onClose }: { project: Project; onClose: () => void }) {
  const reports = useRelatorio360Store(useShallow((s) => s.reports))
  const severity = calcSeverity(project)
  const progress = calcProgress(project)
  const delta = calcBudgetDelta(project)
  const color = SEVERITY_COLOR[severity]
  const budgeted = project.budgetLines.reduce((s, l) => s + l.budgeted, 0)
  const eac = project.budgetLines.reduce((s, l) => s + l.projected, 0)
  const spent = project.budgetLines.reduce((s, l) => s + l.spent, 0)
  const firstWord = project.name.split(/\s+/)[0].toLowerCase()
  const photos = useMemo(() => Object.values(reports).filter((r) => r.projectName.toLowerCase().includes(firstWord)).flatMap((r) => r.photos).slice(0, 8), [reports, firstWord])

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-[#3d3d3d] border border-[#525252] rounded-2xl shadow-2xl">
        <div className="flex items-start gap-3 px-6 py-4 border-b border-[#525252] shrink-0">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, background: `${color}20` }}>{SEVERITY_LABEL[severity]}</span>
            <h2 className="text-[#f5f5f5] text-lg font-bold mt-2 leading-tight">{project.name}</h2>
            {project.address && <p className="text-[#6b6b6b] text-xs mt-1">{project.address}</p>}
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={20} /></button>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 px-6 py-3 border-b border-[#525252] shrink-0">
          {[
            ['Progresso', `${progress}%`, color],
            ['Orçado', fmtBRL(budgeted), '#a3a3a3'],
            ['EAC', fmtBRL(eac), delta > 5 ? '#ef4444' : '#22c55e'],
            ['Gasto', fmtBRL(spent), '#f97316'],
            ['Desvio', `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`, Math.abs(delta) <= 5 ? '#22c55e' : '#ef4444'],
            ['Severidade', SEVERITY_LABEL[severity], color],
          ].map(([label, value, c]) => (
            <div key={label} className="bg-[#333333] rounded-lg px-3 py-2 text-center">
              <p className="text-[#6b6b6b] text-[10px] truncate">{label}</p>
              <p className="text-sm font-bold" style={{ color: c }}>{value}</p>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div>
            <div className="flex items-center gap-2 mb-3"><Image size={13} className="text-[#6b6b6b]" /><p className="text-[#6b6b6b] text-[10px] font-semibold uppercase tracking-wider">Fotos da Obra</p></div>
            {photos.length === 0 ? <p className="text-[#6b6b6b] text-xs italic">Nenhuma foto disponível no Relatório 360 para este projeto.</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{photos.map((ph) => <img key={ph.id} src={ph.base64} alt={ph.label} className="w-full aspect-video object-cover rounded-lg border border-[#525252]" />)}</div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['Planejamento', project.planningPhases],
              ['Execução', project.executionPhases],
            ].map(([title, phases]) => (
              <div key={title as string}>
                <p className="text-[#6b6b6b] text-[10px] font-semibold mb-2 uppercase tracking-wider">{title as string}</p>
                <div className="flex flex-col gap-2">
                  {(phases as ProjectPhase[]).map((phase) => (
                    <div key={phase.id} className="bg-[#333333] border border-[#525252] rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2"><span className="text-[#f5f5f5] text-xs font-medium truncate">{phase.name}</span><PhaseStatusBadge status={phase.status} /></div>
                      <p className="text-[10px] text-[#6b6b6b] mt-1">{fmtDate(phase.startDate)} {'->'} {fmtDate(phase.endDate)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-[#525252] overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-[#333333] text-[#6b6b6b] text-[10px]"><th className="text-left px-3 py-2">Tipo</th><th className="text-left px-3 py-2">Descrição</th><th className="text-right px-3 py-2">Orçado</th><th className="text-right px-3 py-2">EAC</th><th className="text-right px-3 py-2">Gasto</th></tr></thead>
              <tbody>{project.budgetLines.map((line) => <tr key={line.id} className="border-t border-[#525252]"><td className="px-3 py-2 text-[#6b6b6b] uppercase text-[10px]">{line.type}</td><td className="px-3 py-2 text-[#f5f5f5]">{line.description}</td><td className="px-3 py-2 text-right text-[#a3a3a3] font-mono">{fmtBRL(line.budgeted)}</td><td className="px-3 py-2 text-right text-[#f5f5f5] font-mono">{fmtBRL(line.projected)}</td><td className="px-3 py-2 text-right text-[#f97316] font-mono">{fmtBRL(line.spent)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="overflow-x-auto"><GanttSvg project={project} /></div>
        </div>
      </div>
    </div>
  )
}

function MarkerLayer({
  projects,
  sites,
  selectedProjectId,
  selectedSiteId,
  showProjects,
  showSites,
  onProjectSelect,
  onSiteSelect,
}: {
  projects: Project[]
  sites: ConstructionSite[]
  selectedProjectId: string | null
  selectedSiteId: string | null
  showProjects: boolean
  showSites: boolean
  onProjectSelect: (id: string) => void
  onSiteSelect?: (id: string | null) => void
}) {
  const map = useMap()
  const projectMarkers = useRef<Map<string, L.Marker>>(new Map())
  const siteMarkers = useRef<Map<string, L.Marker>>(new Map())

  useEffect(() => {
    const sync = <T extends { id: string; lat?: number | null; lng?: number | null }>(
      markers: Map<string, L.Marker>,
      rows: T[],
      makeIcon: (row: T) => L.DivIcon,
      onSelect: (id: string) => void,
    ) => {
      markers.forEach((marker, id) => {
        if (!rows.find((row) => row.id === id)) {
          marker.remove()
          markers.delete(id)
        }
      })
      rows.forEach((row) => {
        if (row.lat == null || row.lng == null || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return
        if (markers.has(row.id)) {
          markers.get(row.id)!.setIcon(makeIcon(row))
        } else {
          const marker = L.marker([row.lat, row.lng], { icon: makeIcon(row) }).addTo(map).on('click', () => onSelect(row.id))
          markers.set(row.id, marker)
        }
      })
    }

    sync(projectMarkers.current, showProjects ? projects : [], (p) => makeProjectIcon(p, p.id === selectedProjectId), onProjectSelect)
    sync(siteMarkers.current, showSites ? sites : [], (s) => makeSiteIcon(s, s.id === selectedSiteId), (id) => onSiteSelect?.(id))
  }, [map, onProjectSelect, onSiteSelect, projects, selectedProjectId, selectedSiteId, showProjects, showSites, sites])

  useEffect(() => {
    const targetProject = projects.find((p) => p.id === selectedProjectId)
    const targetSite = sites.find((s) => s.id === selectedSiteId)
    const target = targetProject ?? targetSite
    if (target?.lat != null && target.lng != null) {
      map.setView([target.lat, target.lng], Math.max(map.getZoom(), 11), { animate: true })
    }
  }, [map, projects, selectedProjectId, selectedSiteId, sites])

  useEffect(() => () => {
    projectMarkers.current.forEach((m) => m.remove())
    siteMarkers.current.forEach((m) => m.remove())
    projectMarkers.current.clear()
    siteMarkers.current.clear()
  }, [])

  return null
}

export function ControlMap({
  projects,
  sites = [],
  selectedSiteId = null,
  onSiteSelect,
  onEditSite,
}: {
  projects: Project[]
  sites?: ConstructionSite[]
  selectedSiteId?: string | null
  onSiteSelect?: (id: string | null) => void
  onEditSite?: (id: string) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [basemap, setBasemap] = useState<Basemap>('voyager')
  const [showProjects, setShowProjects] = useState(true)
  const [showSites, setShowSites] = useState(sites.length > 0)

  const projectsWithCoords = projects.filter((p) => p.lat != null && p.lng != null)
  const sitesWithCoords = sites.filter((s) => s.lat != null && s.lng != null)
  const filteredProjects = filter === 'all' ? projectsWithCoords : projectsWithCoords.filter((p) => calcSeverity(p) === filter)
  const selectedProject = projectsWithCoords.find((p) => p.id === selectedProjectId) ?? null
  const selectedSite = sitesWithCoords.find((s) => s.id === selectedSiteId) ?? null
  const counts = {
    critical: projectsWithCoords.filter((p) => calcSeverity(p) === 'critical').length,
    high: projectsWithCoords.filter((p) => calcSeverity(p) === 'high').length,
    medium: projectsWithCoords.filter((p) => calcSeverity(p) === 'medium').length,
    ok: projectsWithCoords.filter((p) => calcSeverity(p) === 'ok').length,
  }
  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: `Todos (${projectsWithCoords.length})` },
    { id: 'critical', label: `Crítico (${counts.critical})` },
    { id: 'high', label: `Alto (${counts.high})` },
    { id: 'medium', label: `Médio (${counts.medium})` },
    { id: 'ok', label: `OK (${counts.ok})` },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#525252] bg-[#2c2c2c] flex-wrap">
        {filters.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className="px-3 py-1 rounded-full text-xs font-medium transition-colors" style={{
            background: filter === f.id ? (f.id === 'all' ? '#f9731620' : `${SEVERITY_COLOR[f.id as Severity]}25`) : 'transparent',
            color: filter === f.id ? (f.id === 'all' ? '#f97316' : SEVERITY_COLOR[f.id as Severity]) : '#6b6b6b',
            border: `1px solid ${filter === f.id ? (f.id === 'all' ? '#f9731650' : `${SEVERITY_COLOR[f.id as Severity]}50`) : '#525252'}`,
          }}>{f.label}</button>
        ))}
        <button onClick={() => setShowProjects((v) => !v)} className={`px-3 py-1 rounded-full text-xs font-medium border ${showProjects ? 'text-[#f97316] border-[#f97316]/50 bg-[#f97316]/10' : 'text-[#6b6b6b] border-[#525252]'}`}>Projetos</button>
        <button onClick={() => setShowSites((v) => !v)} className={`px-3 py-1 rounded-full text-xs font-medium border ${showSites ? 'text-[#3b82f6] border-[#3b82f6]/50 bg-[#3b82f6]/10' : 'text-[#6b6b6b] border-[#525252]'}`}>Obras ({sitesWithCoords.length})</button>
        <div className="ml-auto flex items-center gap-1.5 text-[#6b6b6b] text-xs">
          <MapPin size={11} />
          <span>{(showProjects ? filteredProjects.length : 0) + (showSites ? sitesWithCoords.length : 0)} marcador(es)</span>
        </div>
      </div>
      <div className="relative flex-1">
        <MapContainer center={[-15.0, -52.0]} zoom={5} style={{ height: '100%', width: '100%', background: '#2c2c2c' }} zoomControl>
          <TileLayer key={basemap} url={TILE_CONFIG[basemap].url} attribution={TILE_CONFIG[basemap].attribution} subdomains={TILE_CONFIG[basemap].subdomains ?? 'abc'} maxZoom={19} />
          <MarkerLayer
            projects={filteredProjects}
            sites={sitesWithCoords}
            selectedProjectId={selectedProjectId}
            selectedSiteId={selectedSiteId}
            showProjects={showProjects}
            showSites={showSites}
            onProjectSelect={(id) => setSelectedProjectId((prev) => (prev === id ? null : id))}
            onSiteSelect={(id) => onSiteSelect?.(id)}
          />
        </MapContainer>
        <div className="absolute bottom-4 left-4 z-[1000] flex gap-1 bg-[#333333]/90 border border-[#525252] rounded-lg p-1 backdrop-blur-sm">
          {(Object.keys(BASEMAP_LABELS) as Basemap[]).map((b) => (
            <button key={b} onClick={() => setBasemap(b)} className="px-2.5 py-1 rounded text-[10px] font-medium transition-colors" style={{ background: basemap === b ? '#f9731620' : 'transparent', color: basemap === b ? '#f97316' : '#6b6b6b', border: `1px solid ${basemap === b ? '#f9731650' : 'transparent'}` }}>{BASEMAP_LABELS[b]}</button>
          ))}
        </div>
        {selectedSite && (
          <div className="absolute right-4 top-4 z-[1000] w-72 rounded-lg border border-[#525252] bg-[#333333]/95 p-4 shadow-xl backdrop-blur-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: SITE_STATUS_COLOR[selectedSite.status], background: `${SITE_STATUS_COLOR[selectedSite.status]}20` }}>{SITE_STATUS_LABEL[selectedSite.status]}</span>
                <h3 className="mt-2 text-sm font-bold text-[#f5f5f5] leading-snug">{selectedSite.name}</h3>
              </div>
              <button onClick={() => onSiteSelect?.(null)} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={14} /></button>
            </div>
            <p className="mt-2 text-xs text-[#a3a3a3]">{selectedSite.buildingType || selectedSite.serviceScope || 'Escopo não informado'}</p>
            <p className="mt-1 text-[11px] text-[#6b6b6b]">{selectedSite.city}/{selectedSite.state}</p>
            <p className="mt-2 text-[11px] text-[#6b6b6b]">Gerente: <span className="text-[#a3a3a3]">{selectedSite.manager}</span></p>
            {onEditSite && <button onClick={() => onEditSite(selectedSite.id)} className="mt-3 w-full rounded-md border border-[#525252] px-3 py-2 text-xs font-semibold text-[#f97316] hover:border-[#f97316]/50">Editar Obra</button>}
          </div>
        )}
      </div>
      {selectedProject && <Project360Modal project={selectedProject} onClose={() => setSelectedProjectId(null)} />}
      <style>{`
        .leaflet-control-zoom a { background: #333333 !important; color: #a3a3a3 !important; border-color: #525252 !important; }
        .leaflet-control-zoom a:hover { background: #3d3d3d !important; color: #f97316 !important; }
      `}</style>
    </div>
  )
}
