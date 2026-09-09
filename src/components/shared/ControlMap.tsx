import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Image, MapPin, X, Search, BoxSelect, Radar, ChevronLeft, ChevronRight, Layers } from 'lucide-react'
import { useRelatorio360Store } from '@/store/relatorio360Store'
import { useShallow } from 'zustand/react/shallow'
import type { ConstructionSite, Project, ProjectPhase } from '@/types'
import { obraEstaAtiva } from '@/lib/obraAtiva'
import { BASE, ROTULOS, OSM } from '@/lib/basemaps'

type Severity = 'critical' | 'high' | 'medium' | 'ok'
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

/**
 * ⚠️ O mapa é ESCURO, e só — o visual da imagem de referência, em Leaflet.
 *
 * São DUAS camadas do Esri: a base cinza-escura sem texto e, por cima, `ROTULOS.escuro` com os
 * nomes de cidade e bairro. A camada de rótulos existia em `basemaps.ts` e NÃO era renderizada
 * aqui — era isso que fazia o mapa parecer vazio ("não íamos deixar igual à referência?").
 *
 * Antes havia quatro estilos num seletor no canto. Foram embora por dois motivos: o CARTO passou a
 * exigir chave e carimbava "API KEY REQUIRED" dentro do tile (por isso o aviso de falha nunca
 * disparava — o tile volta 200, com a marca d'água pintada), e a escolha entre quatro fundos não
 * mudava decisão nenhuma de quem olha obra num mapa. Uma tela a menos para poluir.
 *
 * O que a referência tem e está aqui: painel de legenda à esquerda (camadas, cor por status,
 * busca), nome sempre visível ao lado do pino, **Selecionar** por área, **Buscar ao redor** por
 * raio, bússola e zoom no canto inferior esquerdo. Sem Mapbox: tudo é Leaflet e Esri sem chave.
 */
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
          <span style="color:#f5f5f5;font-size:10px;font-weight:700;font-family:system-ui,sans-serif;white-space:nowrap;letter-spacing:0.03em;">${escapeHtml(label)}</span>
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:7px solid ${color};margin-top:-1px;"></div>
      </div>
    `,
  })
}

/** Capacete de obra, em SVG inline — sem dependência de fonte de ícone. */
const SVG_CAPACETE =
  '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" '
  + 'stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M2 18h20"/><path d="M4 18v-3a8 8 0 0 1 16 0v3"/><path d="M10 18V7.5a2 2 0 0 1 4 0V18"/></svg>'

/**
 * Marcador de obra: capacete com o nome AO LADO, sempre visível.
 *
 * O nome ficava embaixo e só aparecia a partir do zoom 11, porque oito obras em Brasília viravam
 * uma mancha. A referência mostra o rótulo sempre — e ao lado do pino ele colide menos do que
 * embaixo (os pinos se empilham na vertical quando estão na mesma rua). O chip escuro com borda na
 * cor do status é o que deixa o texto legível sobre qualquer fundo.
 */
const LARGURA_ROTULO = 150
const LARGURA_ICONE = 28

function makeSiteIcon(site: ConstructionSite, selected: boolean) {
  const color = SITE_STATUS_COLOR[site.status]
  const label = site.name.length > 22 ? `${site.name.slice(0, 21)}…` : site.name
  const glow = selected ? `0 0 0 3px ${color}55, 0 0 12px ${color}90` : '0 2px 6px rgba(0,0,0,0.6)'

  // ⚠️ `white-space:nowrap` + largura no ROTULO (não no capacete): sem isso o nome quebrava letra a
  // letra — "BAS / E - / Parq / ue". O corte em 22 caracteres é o freio; a elipse diz que cortou.
  return L.divIcon({
    className: '',
    // `iconSize` declarado: sem ele o Leaflet aplica [12,12] e o conteúdo transborda. A âncora fica
    // na BASE DO CAPACETE — a ponta é que aponta o lugar, não o meio do rótulo.
    iconSize: [LARGURA_ICONE + 6 + LARGURA_ROTULO, 30],
    iconAnchor: [LARGURA_ICONE / 2, 30],
    html: `
      <div style="display:flex;align-items:center;gap:6px;pointer-events:none;height:30px;">
        <div style="width:${LARGURA_ICONE}px;height:${LARGURA_ICONE}px;border-radius:50%;background:#1f2937ee;border:2px solid ${color};
                    box-shadow:${glow};display:flex;align-items:center;justify-content:center;color:${color};
                    pointer-events:auto;cursor:pointer;flex-shrink:0;">
          ${SVG_CAPACETE}
        </div>
        <span title="${escapeHtml(site.name)}" style="max-width:${LARGURA_ROTULO}px;padding:2px 7px;border-radius:6px;background:#111827dd;
                     border:1px solid ${color}88;color:#f5f5f5;font-size:11px;font-weight:600;font-family:system-ui,sans-serif;line-height:1.3;
                     white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;cursor:pointer;
                     box-shadow:0 1px 4px rgba(0,0,0,0.6);">${escapeHtml(label)}</span>
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

/** Tem coordenada utilizável? `!= null` não basta: `NaN` passa e o Leaflet quebra. */
function temCoordenada(r: { lat?: number | null; lng?: number | null }): boolean {
  return r.lat != null && r.lng != null && Number.isFinite(r.lat) && Number.isFinite(r.lng)
}

/**
 * Enquadra o mapa nas obras assim que elas chegam.
 *
 * O `center`/`zoom` do `MapContainer` era `[-15, -52]` no zoom 5 — o centro geográfico do Brasil
 * num zoom continental. Abria mostrando a América do Sul inteira e parte da África, com as obras
 * viradas uma mancha no meio. E `center`/`zoom` do react-leaflet só valem na montagem: mudá-los
 * depois não move nada, então tinha de ser `fitBounds`.
 *
 * Três cuidados, copiados do enquadramento que já existia no projeto:
 *  - **enquadra UMA vez** (`jaEnquadrou`): sem isso, trocar de filtro jogaria o usuário de volta
 *    para longe, desfazendo o zoom que ele mesmo deu;
 *  - **não enquadra se já há obra selecionada** — quem abriu numa obra quer ficar nela;
 *  - **obra única vai a zoom 15**, não ao máximo: `fitBounds` de um ponto só aproxima até a calçada.
 */
function EnquadrarAoAbrir({ pontos, selecionado }: {
  pontos: Array<{ lat?: number | null; lng?: number | null }>
  selecionado: string | null
}) {
  const map = useMap()
  const jaEnquadrou = useRef(false)

  useEffect(() => {
    if (jaEnquadrou.current || selecionado) return
    const validos = pontos.filter(temCoordenada)
    if (validos.length === 0) return
    jaEnquadrou.current = true
    try {
      map.invalidateSize()
      if (validos.length === 1) {
        map.setView([validos[0].lat!, validos[0].lng!], 15)
      } else {
        map.fitBounds(
          L.latLngBounds(validos.map((p) => [p.lat!, p.lng!] as [number, number])),
          { padding: [48, 48], maxZoom: 15 },
        )
      }
    } catch (err) {
      console.warn('[ControlMap] enquadramento inicial falhou:', err)
    }
  }, [map, pontos, selecionado])

  return null
}

function MarkerLayer({
  projects,
  sites,
  selectedProjectId,
  selectedSiteId,
  showProjects,
  showSites,
  destacados,
  onProjectSelect,
  onSiteSelect,
}: {
  projects: Project[]
  sites: ConstructionSite[]
  selectedProjectId: string | null
  selectedSiteId: string | null
  showProjects: boolean
  showSites: boolean
  /** Obras dentro da área selecionada / do raio — ganham o mesmo brilho da selecionada. */
  destacados: Set<string>
  onProjectSelect: (id: string) => void
  onSiteSelect?: (id: string | null) => void
}) {
  const map = useMap()
  const projectMarkers = useRef<Map<string, L.Marker>>(new Map())
  const siteMarkers = useRef<Map<string, L.Marker>>(new Map())

  /**
   * ⚠️ O AGRUPAMENTO SAIU.
   *
   * Havia um círculo com o número de obras (`markerClusterGroup`) para resolver a sobreposição das
   * oito obras de Brasília em zoom baixo. Foi removido a pedido: ele escondia justamente o que a
   * tela existe para mostrar — quais obras, e onde.
   *
   * O que continua resolvendo a sobreposição: `EnquadrarAoAbrir` já abre o mapa com `fitBounds`
   * nas obras, num zoom em que elas se separam, e o nome só aparece a partir do zoom 11.
   *
   * O marcador vai direto ao mapa (`marker.addTo(map)`) — o caminho alternativo já existia.
   */

  const safeRemove = (marker: L.Marker) => {
    try {
      marker.remove()
    } catch (error) {
      console.warn('[ControlMap] marker cleanup ignored', error)
    }
  }

  useEffect(() => {
    const sync = <T extends { id: string; lat?: number | null; lng?: number | null }>(
      markers: Map<string, L.Marker>,
      rows: T[],
      makeIcon: (row: T) => L.DivIcon,
      onSelect: (id: string) => void,
    ) => {
      markers.forEach((marker, id) => {
        if (!rows.find((row) => row.id === id)) {
          safeRemove(marker)
          markers.delete(id)
        }
      })
      rows.forEach((row) => {
        if (row.lat == null || row.lng == null || !Number.isFinite(row.lat) || !Number.isFinite(row.lng)) return
        if (markers.has(row.id)) {
          markers.get(row.id)!.setIcon(makeIcon(row))
        } else {
          const marker = L.marker([row.lat, row.lng], { icon: makeIcon(row) }).on('click', () => onSelect(row.id))
          marker.addTo(map)
          markers.set(row.id, marker)
        }
      })
    }

    sync(projectMarkers.current, showProjects ? projects : [], (p) => makeProjectIcon(p, p.id === selectedProjectId), onProjectSelect)
    sync(siteMarkers.current, showSites ? sites : [], (s) => makeSiteIcon(s, s.id === selectedSiteId || destacados.has(s.id)), (id) => onSiteSelect?.(id))
  }, [map, destacados, onProjectSelect, onSiteSelect, projects, selectedProjectId, selectedSiteId, showProjects, showSites, sites])

  useEffect(() => {
    const targetProject = projects.find((p) => p.id === selectedProjectId)
    const targetSite = sites.find((s) => s.id === selectedSiteId)
    const target = targetProject ?? targetSite
    if (target?.lat != null && target.lng != null) {
      try {
        map.setView([target.lat, target.lng], Math.max(map.getZoom(), 11), { animate: true })
      } catch (error) {
        console.warn('[ControlMap] setView ignored', error)
      }
    }
  }, [map, projects, selectedProjectId, selectedSiteId, sites])

  useEffect(() => () => {
    projectMarkers.current.forEach(safeRemove)
    siteMarkers.current.forEach(safeRemove)
    projectMarkers.current.clear()
    siteMarkers.current.clear()
  }, [])

  return null
}

/** Distância em km entre dois pontos. Basta para "a 3,2 km" — não precisa de geodésia. */
function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/**
 * Selecionar por área: arrasta um retângulo sobre o mapa, e as obras dentro dele viram lista.
 *
 * Enquanto a ferramenta está ligada o arrasto do mapa é desligado — senão o gesto move o mapa em
 * vez de desenhar. O retângulo fica desenhado até a ferramenta ser desligada ou outro ser feito,
 * para a pessoa ver o que selecionou.
 */
function SelecaoPorArea({ ativa, onSelecionar }: { ativa: boolean; onSelecionar: (bounds: L.LatLngBounds | null) => void }) {
  const map = useMap()
  const retangulo = useRef<L.Rectangle | null>(null)

  useEffect(() => {
    if (!ativa) {
      retangulo.current?.remove(); retangulo.current = null
      return
    }
    map.dragging.disable()
    const container = map.getContainer()
    container.style.cursor = 'crosshair'
    let inicio: L.LatLng | null = null

    const aoIniciar = (e: L.LeafletMouseEvent) => {
      inicio = e.latlng
      retangulo.current?.remove()
      retangulo.current = L.rectangle(L.latLngBounds(inicio, inicio), { color: '#f97316', weight: 1.5, dashArray: '4 3', fillOpacity: 0.08 }).addTo(map)
    }
    const aoMover = (e: L.LeafletMouseEvent) => {
      if (!inicio || !retangulo.current) return
      retangulo.current.setBounds(L.latLngBounds(inicio, e.latlng))
    }
    const aoSoltar = (e: L.LeafletMouseEvent) => {
      if (!inicio) return
      const bounds = L.latLngBounds(inicio, e.latlng)
      inicio = null
      // Um clique sem arrasto não é seleção — limpa em vez de selecionar "nada" com cara de algo.
      if (bounds.getNorth() === bounds.getSouth() && bounds.getEast() === bounds.getWest()) {
        retangulo.current?.remove(); retangulo.current = null
        onSelecionar(null)
        return
      }
      onSelecionar(bounds)
    }
    // ⚠️ O `mouseup` TAMBÉM no documento: o Leaflet só escuta no próprio container, e o painel
    // de Legenda fica POR CIMA do mapa. Soltar o botão sobre o painel (ou fora da janela) nunca
    // disparava `aoSoltar`, o `inicio` do closure continuava preenchido, e ao voltar o ponteiro
    // o retângulo seguia o cursor sem botão nenhum apertado — cara de ferramenta travada.
    const aoSoltarNoDocumento = () => { if (inicio) { inicio = null; onSelecionar(retangulo.current ? retangulo.current.getBounds() : null) } }
    map.on('mousedown', aoIniciar); map.on('mousemove', aoMover); map.on('mouseup', aoSoltar)
    const doc = container.ownerDocument
    doc.addEventListener('mouseup', aoSoltarNoDocumento)
    return () => {
      map.off('mousedown', aoIniciar); map.off('mousemove', aoMover); map.off('mouseup', aoSoltar)
      doc.removeEventListener('mouseup', aoSoltarNoDocumento)
      map.dragging.enable()
      container.style.cursor = ''
    }
  }, [map, ativa, onSelecionar])

  return null
}

/**
 * Buscar ao redor: um clique define o centro; o raio (km) vem do painel. O círculo acompanha o
 * raio ao vivo — é como a pessoa acha "quantas obras a 5 km do escritório".
 */
function BuscaAoRedor({ ativa, centro, raioKm, onCentro }: {
  ativa: boolean
  centro: L.LatLng | null
  raioKm: number
  onCentro: (c: L.LatLng) => void
}) {
  const map = useMap()
  const circulo = useRef<L.Circle | null>(null)

  useEffect(() => {
    if (!ativa) return
    const container = map.getContainer()
    container.style.cursor = 'crosshair'
    const aoClicar = (e: L.LeafletMouseEvent) => onCentro(e.latlng)
    map.on('click', aoClicar)
    return () => { map.off('click', aoClicar); container.style.cursor = '' }
  }, [map, ativa, onCentro])

  useEffect(() => {
    circulo.current?.remove(); circulo.current = null
    if (!ativa || !centro) return
    circulo.current = L.circle(centro, { radius: raioKm * 1000, color: '#38bdf8', weight: 1.5, fillOpacity: 0.07 }).addTo(map)
    return () => { circulo.current?.remove(); circulo.current = null }
  }, [map, ativa, centro, raioKm])

  return null
}

/** Norte para cima, sempre — o Leaflet não gira o mapa; a bússola é referência, não controle. */
function Bussola() {
  return (
    // ⚠️ À DIREITA: o painel de Legenda ocupa a esquerda inteira e é opaco — bússola à esquerda
    // ficava coberta. O zoom continua embaixo à esquerda (tem 36px de altura e o painel para
    // antes dele), que é onde a referência o coloca.
    <div className="pointer-events-none absolute bottom-6 right-4 z-[1000] flex h-11 w-11 items-center justify-center rounded-full border border-[#525252] bg-[#333333]/90 shadow-lg" title="Norte">
      <svg viewBox="0 0 24 24" width="26" height="26">
        <polygon points="12,3 15,12 12,10.5 9,12" fill="#f97316" />
        <polygon points="12,21 15,12 12,13.5 9,12" fill="#6b6b6b" />
        <text x="12" y="2.6" textAnchor="middle" fontSize="5" fill="#f5f5f5" fontFamily="system-ui" fontWeight="700">N</text>
      </svg>
    </div>
  )
}

function MapResizeHandler() {
  const map = useMap()

  useEffect(() => {
    let active = true
    let frame: number | null = null

    const safeInvalidate = () => {
      if (!active) return
      try {
        const container = map.getContainer()
        if (!container?.isConnected || container.offsetWidth === 0 || container.offsetHeight === 0) return
        map.invalidateSize({ animate: false, pan: false })
      } catch (error) {
        console.warn('[ControlMap] resize ignored', error)
      }
    }

    const invalidate = () => {
      if (frame != null) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        frame = null
        safeInvalidate()
      })
    }
    invalidate()
    // Um único reflow tardio cobre o "settle" do layout (flex/abas); o
    // ResizeObserver abaixo cuida de mudanças reais de tamanho. Antes eram 3
    // invalidateSize seguidos, que amplificavam o flicker.
    const timers = [300].map((ms) => window.setTimeout(invalidate, ms))
    const container = map.getContainer().parentElement ?? map.getContainer()
    const observer = typeof ResizeObserver !== 'undefined' && container
      ? new ResizeObserver(invalidate)
      : null
    observer?.observe(container)
    window.addEventListener('resize', invalidate)
    return () => {
      active = false
      if (frame != null) window.cancelAnimationFrame(frame)
      timers.forEach((t) => window.clearTimeout(t))
      observer?.disconnect()
      window.removeEventListener('resize', invalidate)
    }
  }, [map])

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
  const [showProjects, setShowProjects] = useState(true)
  // ⚠️ Isto era `useState(sites.length > 0)`, avaliado UMA vez. As obras chegam do servidor depois
  // do mapa montar, então a camada nascia desligada e nunca se corrigia — o usuário abria a Torre
  // e simplesmente não havia obra no mapa, sem nenhum aviso. Agora começa ligada e só muda se a
  // pessoa desligar.
  const [showSites, setShowSites] = useState(true)
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false)
  /** Status de obra que a pessoa escondeu clicando na legenda. */
  const [statusOcultos, setStatusOcultos] = useState<Set<ConstructionSite['status']>>(new Set())
  const [painelAberto, setPainelAberto] = useState(true)
  const [busca, setBusca] = useState('')
  const [ferramenta, setFerramenta] = useState<'nenhuma' | 'area' | 'raio'>('nenhuma')
  const [areaBounds, setAreaBounds] = useState<L.LatLngBounds | null>(null)
  const [centroRaio, setCentroRaio] = useState<L.LatLng | null>(null)
  const [raioKm, setRaioKm] = useState(5)
  /**
   * ⚠️ O mapa base cai no reserva sozinho.
   *
   * Três tiles com erro bastam: um tile solto falha por rede, três seguidos é o provedor. O
   * principal é o escuro do Esri (duas camadas); o reserva é o OpenStreetMap — feio no escuro, mas
   * melhor do que o mapa em branco na tela do cliente.
   */
  const [tilesComErro, setTilesComErro] = useState(0)
  const usandoReserva = tilesComErro >= 3

  // Derivações memoizadas: props/deps estáveis evitam o re-render em cascata que
  // fazia o mapa "piscar" (MarkerLayer re-sincronizava markers a cada render).
  const projectsWithCoords = useMemo(() => projects.filter(temCoordenada), [projects])
  // `temCoordenada`, e não `!= null`: uma obra com `lat: NaN` passava neste filtro, entrava na
  // contagem do selo "N marcador(es)" e não gerava marcador nenhum — o contador mentia.
  const sitesWithCoords = useMemo(() => sites.filter(temCoordenada), [sites])
  // As que ficam de fora do mapa por não terem endereço no cadastro. Antes sumiam em silêncio:
  // a lista dizia "9 canteiros" e o mapa "8 marcador(es)", sem explicar o nono.
  const sitesSemCoordenada = useMemo(() => sites.filter((s) => !temCoordenada(s) && obraEstaAtiva(s)), [sites])
  // Filtro VISUAL: obra arquivada some do mapa, mas continua em `sitesWithCoords` para o card
  // lateral conseguir resolvê-la se ela estiver selecionada — senão, ao arquivar a obra aberta,
  // o card sumiria junto e não haveria caminho de volta.
  const sitesVisiveis = useMemo(
    () => (mostrarArquivadas ? sitesWithCoords : sitesWithCoords.filter(obraEstaAtiva)).filter((s) => !statusOcultos.has(s.status)),
    [sitesWithCoords, mostrarArquivadas, statusOcultos],
  )
  const totalArquivadas = useMemo(
    () => sitesWithCoords.length - sitesWithCoords.filter(obraEstaAtiva).length,
    [sitesWithCoords],
  )
  const contagemPorStatus = useMemo(() => {
    const base = mostrarArquivadas ? sitesWithCoords : sitesWithCoords.filter(obraEstaAtiva)
    const c: Record<ConstructionSite['status'], number> = { active: 0, planning: 0, paused: 0, completed: 0 }
    for (const s of base) c[s.status]++
    return c
  }, [sitesWithCoords, mostrarArquivadas])
  const filteredProjects = useMemo(
    () => (filter === 'all' ? projectsWithCoords : projectsWithCoords.filter((p) => calcSeverity(p) === filter)),
    [filter, projectsWithCoords],
  )
  const selectedProject = projectsWithCoords.find((p) => p.id === selectedProjectId) ?? null
  const selectedSite = sitesWithCoords.find((s) => s.id === selectedSiteId) ?? null
  const counts = useMemo(() => ({
    critical: projectsWithCoords.filter((p) => calcSeverity(p) === 'critical').length,
    high: projectsWithCoords.filter((p) => calcSeverity(p) === 'high').length,
    medium: projectsWithCoords.filter((p) => calcSeverity(p) === 'medium').length,
    ok: projectsWithCoords.filter((p) => calcSeverity(p) === 'ok').length,
  }), [projectsWithCoords])

  // ── Busca por nome ──────────────────────────────────────────────────────────
  const resultadosBusca = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return []
    const obras = sitesWithCoords.filter((s) => `${s.code} ${s.name} ${s.city}`.toLowerCase().includes(q)).map((s) => ({ tipo: 'obra' as const, id: s.id, nome: s.name, sub: `${s.code} · ${s.city}/${s.state}`, cor: SITE_STATUS_COLOR[s.status] }))
    const projs = projectsWithCoords.filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({ tipo: 'projeto' as const, id: p.id, nome: p.name, sub: 'projeto', cor: SEVERITY_COLOR[calcSeverity(p)] }))
    return [...obras, ...projs].slice(0, 8)
  }, [busca, sitesWithCoords, projectsWithCoords])

  // ── Selecionar por área / buscar ao redor ───────────────────────────────────
  const dentroDaArea = useMemo(
    () => (areaBounds ? sitesVisiveis.filter((s) => areaBounds.contains([s.lat!, s.lng!])) : []),
    [areaBounds, sitesVisiveis],
  )
  const aoRedor = useMemo(() => {
    if (!centroRaio) return []
    return sitesVisiveis
      .map((s) => ({ site: s, km: distanciaKm(centroRaio.lat, centroRaio.lng, s.lat!, s.lng!) }))
      .filter((x) => x.km <= raioKm)
      .sort((a, b) => a.km - b.km)
  }, [centroRaio, raioKm, sitesVisiveis])
  const destacados = useMemo(
    () => new Set([...dentroDaArea.map((s) => s.id), ...aoRedor.map((x) => x.site.id)]),
    [dentroDaArea, aoRedor],
  )
  const trocarFerramenta = (f: 'area' | 'raio') => {
    setFerramenta((atual) => (atual === f ? 'nenhuma' : f))
    setAreaBounds(null); setCentroRaio(null)
  }
  const aoSelecionarArea = useCallback((b: L.LatLngBounds | null) => setAreaBounds(b), [])
  const aoDefinirCentro = useCallback((c: L.LatLng) => setCentroRaio(c), [])

  const tileEventHandlers = useMemo(() => ({
    // Um lote que carrega inteiro zera a contagem: falha passageira não derruba o provedor bom.
    load: () => setTilesComErro(0),
    tileerror: () => setTilesComErro((n) => n + 1),
  }), [])
  const handleProjectSelect = useCallback((id: string) => setSelectedProjectId((prev) => (prev === id ? null : id)), [])
  const handleSiteSelect = useCallback((id: string | null) => onSiteSelect?.(id), [onSiteSelect])

  const totalMarcadores = (showProjects ? filteredProjects.length : 0) + (showSites ? sitesVisiveis.length : 0)
  const linhaLegenda = 'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] hover:bg-white/5'

  return (
    <div className="flex h-full min-h-[480px] flex-1 flex-col overflow-hidden bg-[#2c2c2c]">
      <div className="relative min-h-[360px] flex-1 overflow-hidden bg-[#1f1f1f]">
        <MapContainer center={[-15.0, -52.0]} zoom={5} style={{ height: '100%', width: '100%', background: '#1f1f1f' }} zoomControl={false}>
          <MapResizeHandler />
          {/* A atribuição do provedor fica visível no canto — exigência de uso, não cortesia. */}
          {usandoReserva ? (
            <TileLayer key="reserva" url={OSM.url} attribution={OSM.attribution} maxZoom={OSM.maxZoom} eventHandlers={tileEventHandlers} />
          ) : (
            <>
              <TileLayer key="base" url={BASE.escuro.url} attribution={BASE.escuro.attribution} maxZoom={BASE.escuro.maxZoom} eventHandlers={tileEventHandlers} />
              {/* ⚠️ É esta camada que dá nome às cidades. Sem ela o escuro é um breu sem referência. */}
              <TileLayer key="rotulos" url={ROTULOS.escuro!.url} attribution="" maxZoom={ROTULOS.escuro!.maxZoom} pane="overlayPane" />
            </>
          )}
          <ZoomControl position="bottomleft" />
          <EnquadrarAoAbrir
            pontos={[...(showSites ? sitesVisiveis : []), ...(showProjects ? filteredProjects : [])]}
            selecionado={selectedSiteId ?? selectedProjectId}
          />
          <MarkerLayer
            projects={filteredProjects}
            sites={sitesVisiveis}
            selectedProjectId={selectedProjectId}
            selectedSiteId={selectedSiteId}
            showProjects={showProjects}
            showSites={showSites}
            destacados={destacados}
            onProjectSelect={handleProjectSelect}
            onSiteSelect={handleSiteSelect}
          />
          <SelecaoPorArea ativa={ferramenta === 'area'} onSelecionar={aoSelecionarArea} />
          <BuscaAoRedor ativa={ferramenta === 'raio'} centro={centroRaio} raioKm={raioKm} onCentro={aoDefinirCentro} />
        </MapContainer>
        <Bussola />

        {/* ── Painel Legenda (esquerda) ─────────────────────────────────────── */}
        <div className={`absolute left-3 top-3 z-[1000] flex max-h-[calc(100%-4.5rem)] flex-col rounded-lg border border-[#525252] bg-[#333333]/95 shadow-xl backdrop-blur-sm transition-all ${painelAberto ? 'w-64' : 'w-10'}`}>
          <div className="flex items-center gap-2 border-b border-[#525252] px-2 py-2">
            <button onClick={() => setPainelAberto((v) => !v)} className="text-[#a3a3a3] hover:text-[#f5f5f5]" title={painelAberto ? 'Recolher' : 'Legenda'}>
              {painelAberto ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
            {painelAberto && (
              <>
                <Layers size={13} className="text-[#f97316]" />
                <span className="text-xs font-semibold text-[#f5f5f5]">Legenda</span>
                <span className="ml-auto flex items-center gap-1 text-[10px] text-[#a3a3a3]"><MapPin size={10} />{totalMarcadores}</span>
              </>
            )}
          </div>
          {painelAberto && (
            <div className="flex-1 overflow-y-auto p-2 space-y-3">
              {/* Busca */}
              <div>
                <div className="flex items-center gap-1.5 rounded-md border border-[#525252] bg-[#1f1f1f] px-2 py-1">
                  <Search size={12} className="text-[#6b6b6b]" />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar obra ou projeto"
                         className="w-full bg-transparent text-[11px] text-[#f5f5f5] placeholder:text-[#525252] focus:outline-none" />
                  {busca && <button onClick={() => setBusca('')} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={11} /></button>}
                </div>
                {resultadosBusca.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {resultadosBusca.map((r) => (
                      <li key={`${r.tipo}-${r.id}`}>
                        <button className={linhaLegenda} onClick={() => { if (r.tipo === 'obra') onSiteSelect?.(r.id); else handleProjectSelect(r.id); setBusca('') }}>
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.cor }} />
                          <span className="truncate text-[#f5f5f5]">{r.nome}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-[#6b6b6b]">{r.sub}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {busca && resultadosBusca.length === 0 && <p className="mt-1 px-1 text-[10px] text-[#6b6b6b]">Nada com esse nome no mapa.</p>}
              </div>

              {/* Obras por status */}
              <div>
                <label className="flex cursor-pointer items-center gap-2 px-1 text-[11px] font-semibold text-[#f5f5f5]">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-[#3b82f6]" checked={showSites} onChange={(e) => setShowSites(e.target.checked)} />
                  Obras <span className="font-normal text-[#6b6b6b]">({sitesVisiveis.length})</span>
                </label>
                <ul className="mt-1">
                  {(Object.keys(SITE_STATUS_LABEL) as ConstructionSite['status'][]).map((st) => {
                    const oculto = statusOcultos.has(st)
                    return (
                      <li key={st}>
                        <button className={`${linhaLegenda} ${oculto ? 'opacity-40' : ''}`} title={oculto ? 'Mostrar' : 'Ocultar'}
                                onClick={() => setStatusOcultos((atual) => { const n = new Set(atual); if (n.has(st)) n.delete(st); else n.add(st); return n })}>
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SITE_STATUS_COLOR[st], boxShadow: `0 0 5px ${SITE_STATUS_COLOR[st]}aa` }} />
                          <span className="text-[#c9c9c9]">{SITE_STATUS_LABEL[st]}</span>
                          <span className="ml-auto text-[10px] text-[#6b6b6b]">{contagemPorStatus[st]}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {totalArquivadas > 0 && (
                  <label className="mt-1 flex cursor-pointer items-center gap-2 px-1 text-[11px] text-[#a3a3a3]" title="Obras arquivadas continuam com todo o histórico; ficam fora do mapa só para não poluir">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-[#a3a3a3]" checked={mostrarArquivadas} onChange={(e) => setMostrarArquivadas(e.target.checked)} />
                    Arquivadas ({totalArquivadas})
                  </label>
                )}
                {sitesSemCoordenada.length > 0 && (
                  <p className="mt-1 rounded border border-[#eab308]/40 bg-[#eab308]/10 px-1.5 py-1 text-[10px] text-[#fbbf24]"
                     title={`Sem endereço no cadastro: ${sitesSemCoordenada.map((s) => s.name).join(', ')}. Abra a obra em Detalhes → Editar e preencha as coordenadas.`}>
                    {sitesSemCoordenada.length} obra(s) sem endereço — fora do mapa
                  </p>
                )}
              </div>

              {/* Projetos por severidade */}
              {projectsWithCoords.length > 0 && (
                <div>
                  <label className="flex cursor-pointer items-center gap-2 px-1 text-[11px] font-semibold text-[#f5f5f5]">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-[#f97316]" checked={showProjects} onChange={(e) => setShowProjects(e.target.checked)} />
                    Projetos <span className="font-normal text-[#6b6b6b]">({filteredProjects.length})</span>
                  </label>
                  <ul className="mt-1">
                    {(['critical', 'high', 'medium', 'ok'] as Severity[]).map((sev) => (
                      <li key={sev}>
                        <button className={`${linhaLegenda} ${filter !== 'all' && filter !== sev ? 'opacity-40' : ''}`}
                                onClick={() => setFilter((f) => (f === sev ? 'all' : sev))} title="Clique para ver só este nível">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[sev] }} />
                          <span className="text-[#c9c9c9]">{SEVERITY_LABEL[sev]}</span>
                          <span className="ml-auto text-[10px] text-[#6b6b6b]">{counts[sev]}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ferramentas */}
              <div>
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">Ferramentas</p>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <button onClick={() => trocarFerramenta('area')} title="Arraste um retângulo sobre o mapa"
                          className={`flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] ${ferramenta === 'area' ? 'border-[#f97316] bg-[#f97316]/15 text-[#f97316]' : 'border-[#525252] text-[#c9c9c9] hover:text-[#f5f5f5]'}`}>
                    <BoxSelect size={12} /> Selecionar
                  </button>
                  <button onClick={() => trocarFerramenta('raio')} title="Clique no mapa para o centro; ajuste o raio"
                          className={`flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] ${ferramenta === 'raio' ? 'border-[#38bdf8] bg-[#38bdf8]/15 text-[#38bdf8]' : 'border-[#525252] text-[#c9c9c9] hover:text-[#f5f5f5]'}`}>
                    <Radar size={12} /> Ao redor
                  </button>
                </div>
                {ferramenta === 'area' && (
                  <div className="mt-2">
                    <p className="px-1 text-[10px] text-[#a3a3a3]">{areaBounds ? `${dentroDaArea.length} obra(s) na área` : 'Arraste um retângulo sobre o mapa.'}</p>
                    <ul className="mt-1 max-h-40 overflow-y-auto">
                      {dentroDaArea.map((s) => (
                        <li key={s.id}><button className={linhaLegenda} onClick={() => onSiteSelect?.(s.id)}>
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SITE_STATUS_COLOR[s.status] }} />
                          <span className="truncate text-[#f5f5f5]">{s.name}</span>
                        </button></li>
                      ))}
                    </ul>
                  </div>
                )}
                {ferramenta === 'raio' && (
                  <div className="mt-2">
                    <label className="flex items-center gap-2 px-1 text-[10px] text-[#a3a3a3]">
                      Raio
                      <input type="range" min={0.5} max={50} step={0.5} value={raioKm} onChange={(e) => setRaioKm(Number(e.target.value))} className="flex-1 accent-[#38bdf8]" />
                      <span className="w-12 text-right tabular-nums text-[#f5f5f5]">{raioKm} km</span>
                    </label>
                    <p className="mt-1 px-1 text-[10px] text-[#a3a3a3]">{centroRaio ? `${aoRedor.length} obra(s) a até ${raioKm} km` : 'Clique no mapa para marcar o centro.'}</p>
                    <ul className="mt-1 max-h-40 overflow-y-auto">
                      {aoRedor.map(({ site: s, km }) => (
                        <li key={s.id}><button className={linhaLegenda} onClick={() => onSiteSelect?.(s.id)}>
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SITE_STATUS_COLOR[s.status] }} />
                          <span className="truncate text-[#f5f5f5]">{s.name}</span>
                          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-[#6b6b6b]">{km < 10 ? km.toFixed(1) : km.toFixed(0)} km</span>
                        </button></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {usandoReserva && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-[1000] rounded-lg border border-[#525252] bg-[#2c2c2c]/90 px-3 py-2 text-xs text-[#d4d4d4] shadow-lg">
            O mapa escuro não respondeu — usando o mapa reserva. As obras continuam no lugar.
          </div>
        )}
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
        .leaflet-control-attribution { background: rgba(31,31,31,0.8) !important; color: #6b6b6b !important; font-size: 9px !important; }
        .leaflet-control-attribution a { color: #a3a3a3 !important; }
      `}</style>
    </div>
  )
}
