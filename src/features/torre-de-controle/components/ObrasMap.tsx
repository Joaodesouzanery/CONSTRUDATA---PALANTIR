import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer, TileLayer, Marker, Popup, Tooltip,
  Circle, Polyline, LayersControl, ScaleControl,
  useMap, useMapEvents,
} from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Maximize2, Minimize2, Ruler, X } from 'lucide-react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { haversineKm } from '@/store/otimizacaoFrotaStore'
import { useThemeStore } from '@/store/themeStore'
import type { ConstructionSite, ObraStatus } from '@/types'

// ─── Tile URLs ────────────────────────────────────────────────────────────────

const TILES = {
  voyager:   'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
} as const

const TILE_ATTR = {
  voyager:   '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  dark:      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  satellite: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, GeoEye',
}

// ─── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ObraStatus, string> = {
  active:    '#f97316',
  planning:  '#3b82f6',
  paused:    '#eab308',
  completed: '#22c55e',
}

const STATUS_LABEL: Record<ObraStatus, string> = {
  active:    'Ativa',
  planning:  'Planejamento',
  paused:    'Pausada',
  completed: 'Concluída',
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
}

// ─── Custom SVG construction helmet marker ────────────────────────────────────

function createHelmetIcon(site: ConstructionSite, isSelected: boolean) {
  const size   = isSelected ? 44 : 36
  const color  = STATUS_COLOR[site.status]
  const hasCritical = site.risks.some((r) => r.level === 'critical' && r.status === 'active')

  const pulse = hasCritical ? `
    <div style="position:absolute;top:0;left:0;right:0;bottom:0;border-radius:50%;background:${color};opacity:0.35;
      animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44">
      <rect x="6" y="30" width="32" height="5" rx="2.5" fill="${color}" opacity="0.9"/>
      <path d="M8 30 C8 18 36 18 36 30 Z" fill="${color}"/>
      <path d="M12 24 C12 17 32 17 32 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      <path d="M5 30 Q22 27 39 30" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <rect x="20" y="18" width="4" height="12" rx="1" fill="rgba(0,0,0,0.2)"/>
    </svg>`

  // Short label: trim to 18 chars
  const shortName = site.name.length > 18 ? site.name.slice(0, 17) + '…' : site.name

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.6));">
        ${pulse}${svg}
        ${isSelected ? `<div style="position:absolute;inset:-3px;border-radius:50%;border:2px solid ${color};opacity:0.7;"></div>` : ''}
      </div>
      <div style="background:rgba(13,17,23,0.85);border:1px solid ${color}40;border-radius:3px;
        padding:1px 5px;font-size:9px;font-weight:600;color:${color};white-space:nowrap;
        font-family:Inter,system-ui,sans-serif;line-height:1.4;pointer-events:none;">
        ${shortName}
      </div>
    </div>`

  return L.divIcon({ html, className: '', iconSize: [size, size + 18], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -(size / 2 + 12)] })
}

// ─── MapController — fly-to on selection ─────────────────────────────────────

function MapController() {
  const sites      = useTorreStore((s) => s.sites)
  const selectedId = useTorreStore((s) => s.selectedId)
  const prevId     = useRef<string | null>(null)
  const map        = useMap()

  useEffect(() => {
    if (!selectedId || selectedId === prevId.current) return
    prevId.current = selectedId
    const site = sites.find((s) => s.id === selectedId)
    if (site?.lat != null && site.lng != null) {
      map.flyTo([site.lat, site.lng], Math.max(map.getZoom(), 15), { duration: 0.9 })
    }
  }, [selectedId, sites, map])

  return null
}

// ─── Distance measure controller ─────────────────────────────────────────────

interface MeasurePoint { lat: number; lng: number }

function DistanceMeasureController({
  active,
  points,
  onPoint,
}: {
  active: boolean
  points: MeasurePoint[]
  onPoint: (p: MeasurePoint) => void
}) {
  const map = useMapEvents({
    click(e) {
      if (!active || points.length >= 2) return
      onPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })

  // Change cursor when active
  useEffect(() => {
    if (active) {
      map.getContainer().style.cursor = 'crosshair'
    } else {
      map.getContainer().style.cursor = ''
    }
    return () => { map.getContainer().style.cursor = '' }
  }, [active, map])

  return null
}

// ─── CSS ───────────────────────────────────────────────────────────────────────

function getMapCSS(isDark: boolean) {
  const bg     = isDark ? '#1f1f1f' : '#ffffff'
  const border = isDark ? '#2a2a2a' : '#d4d8df'
  const text   = isDark ? '#f5f5f5' : '#1a1d23'
  const muted  = isDark ? '#6b6b6b' : '#78828f'
  return `
  @keyframes ping { 75%, 100% { transform: scale(1.8); opacity: 0; } }
  .torre-popup .leaflet-popup-content-wrapper {
    background: ${bg}; border: 1px solid ${border};
    border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,${isDark ? '0.6' : '0.15'}); padding: 0;
  }
  .torre-popup .leaflet-popup-content { margin: 0; }
  .torre-popup .leaflet-popup-tip { background: ${bg}; }
  .torre-popup .leaflet-popup-close-button { color: ${muted} !important; font-size: 16px; top: 8px; right: 10px; }
  .leaflet-control-zoom a { background: #fff !important; border-color: #d4d8df !important; color: #505863 !important; }
  .leaflet-control-zoom a:hover { background: #f0f2f5 !important; color: #f97316 !important; }
  .leaflet-control-attribution { background: rgba(255,255,255,0.85) !important; color: #78828f !important; font-size: 9px !important; }
  .leaflet-control-layers { background: ${bg} !important; border: 1px solid ${border} !important; border-radius: 8px !important; color: ${text} !important; }
  .leaflet-control-layers label { color: ${text} !important; }
  .leaflet-tooltip { background: ${bg}; border: 1px solid ${border}; color: ${text}; font-size: 11px; padding: 3px 8px; border-radius: 6px; }
  .leaflet-tooltip-top:before { border-top-color: ${border}; }
`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ObrasMap() {
  const sites         = useTorreStore((s) => s.sites)
  const selectedId    = useTorreStore((s) => s.selectedId)
  const selectSite    = useTorreStore((s) => s.selectSite)
  const setEditing    = useTorreStore((s) => s.setEditing)
  const updateLocation = useTorreStore((s) => s.updateLocation)
  const equipamentos  = useEquipamentosStore((s) => s.equipamentos)
  const routingRecs   = useOtimizacaoFrotaStore((s) => s.routingRecs)
  const isDark        = useThemeStore((s) => s.theme === 'dark')

  const [isFullscreen,   setIsFullscreen]   = useState(false)
  const [measureActive,  setMeasureActive]  = useState(false)
  const [measurePoints,  setMeasurePoints]  = useState<MeasurePoint[]>([])

  // ── Memoized derivations ─────────────────────────────────────────────────────
  const mapCSS     = useMemo(() => getMapCSS(isDark), [isDark])
  const withCoords = useMemo(() => sites.filter((s) => s.lat != null && s.lng != null), [sites])
  const routeLines = useMemo(() => routingRecs.filter(
    (r) => r.accepted !== false && r.fromLat !== null && r.fromLng !== null && r.toLat !== null && r.toLng !== null
  ), [routingRecs])

  // O(1) equipment count lookup instead of O(n) per site per render
  const equipCountBySiteName = useMemo(() => {
    const map = new Map<string, number>()
    equipamentos.forEach((e) => {
      if (e.siteName) map.set(e.siteName, (map.get(e.siteName) ?? 0) + 1)
    })
    return map
  }, [equipamentos])

  const measuredKm = useMemo(() =>
    measurePoints.length === 2
      ? haversineKm(measurePoints[0].lat, measurePoints[0].lng, measurePoints[1].lat, measurePoints[1].lng)
      : null,
    [measurePoints]
  )

  const handleMeasurePoint = useCallback((p: MeasurePoint) => {
    setMeasurePoints((prev) => (prev.length >= 2 ? [p] : [...prev, p]))
  }, [])

  const clearMeasure = useCallback(() => {
    setMeasurePoints([])
    setMeasureActive(false)
  }, [])

  // ── Memoized icon factory ────────────────────────────────────────────────────
  const getIcon = useCallback((site: ConstructionSite, selected: boolean) =>
    createHelmetIcon(site, selected), [])

  // ── Stable event handler factories ───────────────────────────────────────────
  const makeClickHandler  = useCallback((id: string) => () => selectSite(id), [selectSite])
  const makeDragHandler   = useCallback((id: string) => (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => {
    const { lat, lng } = e.target.getLatLng()
    updateLocation(id, lat, lng)
  }, [updateLocation])

  // Circle radius: proportional to totalArea (min 200m, max 800m)
  const siteRadius = useCallback((totalArea: number) =>
    Math.min(800, Math.max(200, Math.sqrt(totalArea) * 3)), [])

  return (
    <div
      className="flex-1 relative overflow-hidden"
      style={{
        background: '#111',
        ...(isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999 } : {}),
      }}
    >
      <style>{mapCSS}</style>

      <MapContainer
        center={[-23.5505, -46.6333]}
        zoom={11}
        style={{ height: '100%', width: '100%', background: '#f5f5f5' }}
        zoomControl
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Voyager">
            <TileLayer url={TILES.voyager} attribution={TILE_ATTR.voyager} subdomains="abcd" maxZoom={20} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Dark Matter">
            <TileLayer url={TILES.dark} attribution={TILE_ATTR.dark} subdomains="abcd" maxZoom={20} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satélite">
            <TileLayer url={TILES.satellite} attribution={TILE_ATTR.satellite} maxZoom={19} />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay checked name="Áreas dos Canteiros">
            <>
              {withCoords.map((site) => (
                <Circle
                  key={`area-${site.id}`}
                  center={[site.lat!, site.lng!]}
                  radius={siteRadius(site.totalArea)}
                  pathOptions={{
                    color:       STATUS_COLOR[site.status],
                    fillColor:   STATUS_COLOR[site.status],
                    fillOpacity: 0.08,
                    weight:      1.5,
                    dashArray:   '6 4',
                  }}
                />
              ))}
            </>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Rotas Sugeridas">
            <>
              {routeLines.map((r) => (
                <Polyline
                  key={`route-${r.id}`}
                  positions={[[r.fromLat!, r.fromLng!], [r.toLat!, r.toLng!]]}
                  pathOptions={{
                    color:     PRIORITY_COLOR[r.priority] ?? '#f97316',
                    weight:    2.5,
                    dashArray: '8 6',
                    opacity:   0.8,
                  }}
                >
                  <Tooltip sticky>
                    {r.equipmentCode} → {r.toSiteName}<br />
                    {r.estimatedDistanceKm}km · +{r.utilizationGainPct}% utilização
                  </Tooltip>
                </Polyline>
              ))}
            </>
          </LayersControl.Overlay>
        </LayersControl>

        <ScaleControl position="bottomleft" imperial={false} />
        <MapController />

        <DistanceMeasureController
          active={measureActive}
          points={measurePoints}
          onPoint={handleMeasurePoint}
        />

        {/* Distance measure polyline */}
        {measurePoints.length === 2 && (
          <Polyline
            positions={measurePoints.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: '#22c55e', weight: 2, dashArray: '6 4' }}
          >
            <Tooltip permanent direction="center">
              {measuredKm} km
            </Tooltip>
          </Polyline>
        )}

        {withCoords.map((site) => (
          <Marker
            key={site.id}
            position={[site.lat!, site.lng!]}
            icon={getIcon(site, site.id === selectedId)}
            draggable
            eventHandlers={{
              click:   makeClickHandler(site.id),
              dragend: makeDragHandler(site.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              {site.code} — {site.name}
            </Tooltip>

            <Popup className="torre-popup">
              <div style={{ padding: '12px 14px', minWidth: 210, fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: STATUS_COLOR[site.status], fontWeight: 700 }}>
                    {site.code}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: STATUS_COLOR[site.status] + '20', color: STATUS_COLOR[site.status],
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {STATUS_LABEL[site.status]}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f5f5f5', marginBottom: 6, lineHeight: 1.3 }}>
                  {site.name}
                </div>
                <div style={{ fontSize: 11, color: '#6b6b6b', marginBottom: 2 }}>📍 {site.street}, {site.number}</div>
                <div style={{ fontSize: 11, color: '#6b6b6b', marginBottom: 8 }}>{site.district} — {site.city}/{site.state}</div>
                <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 4 }}>👷 Gerente: {site.manager}</div>

                {/* Equipment count */}
                {(() => {
                  const cnt = equipCountBySiteName.get(site.name) ?? 0
                  return cnt > 0 ? (
                    <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 8 }}>
                      🚜 {cnt} equipamento{cnt !== 1 ? 's' : ''} no canteiro
                    </div>
                  ) : null
                })()}

                <div style={{ fontSize: 11, color: '#6b6b6b', marginBottom: 8 }}>
                  📐 {site.totalArea.toLocaleString('pt-BR')} m² · {site.floors} {site.floors === 1 ? 'piso' : 'pisos'}
                </div>

                {site.risks.filter((r) => r.status === 'active').length > 0 && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '4px 8px', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
                      ⚠ {site.risks.filter((r) => r.status === 'active').length} risco(s) ativo(s)
                    </span>
                  </div>
                )}
                <button
                  onClick={() => { selectSite(site.id); setEditing(site.id) }}
                  style={{
                    width: '100%', background: 'transparent', border: '1px solid #2a2a2a',
                    borderRadius: 6, color: '#f97316', fontSize: 11, fontWeight: 600,
                    padding: '5px 8px', cursor: 'pointer',
                  }}
                >
                  Editar Obra
                </button>
                <div style={{ textAlign: 'center', fontSize: 9, color: '#3f3f3f', marginTop: 6 }}>
                  Arraste para reposicionar
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Fullscreen toggle */}
      <button
        onClick={() => setIsFullscreen((v) => !v)}
        title={isFullscreen ? 'Sair do modo tela cheia' : 'Tela cheia'}
        style={{
          position: 'absolute', top: 10, left: 10, zIndex: 1000,
          background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 8,
          padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
          color: '#f5f5f5',
        }}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>

      {/* Distance measure toggle */}
      <button
        onClick={() => {
          if (measureActive) { clearMeasure() } else { setMeasureActive(true); setMeasurePoints([]) }
        }}
        title="Medir distância entre dois pontos"
        style={{
          position: 'absolute', top: 50, left: 10, zIndex: 1000,
          background: measureActive ? '#22c55e' : '#1f1f1f',
          border: `1px solid ${measureActive ? '#22c55e' : '#2a2a2a'}`,
          borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', color: '#fff',
        }}
      >
        <Ruler size={14} />
      </button>

      {/* Distance result banner */}
      {measuredKm !== null && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: 'rgba(26,26,26,0.95)', border: '1px solid #22c55e', borderRadius: 8,
          padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>📏 {measuredKm} km</span>
          <button onClick={clearMeasure} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6b6b', display: 'flex' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Measure instructions */}
      {measureActive && measurePoints.length < 2 && measuredKm === null && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: 'rgba(26,26,26,0.9)', border: '1px solid #2a2a2a', borderRadius: 8,
          padding: '6px 14px', fontSize: 11, color: '#a3a3a3',
        }}>
          {measurePoints.length === 0 ? 'Clique no 1º ponto' : 'Clique no 2º ponto'}
        </div>
      )}

      {/* Empty state */}
      {withCoords.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 500, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(26,26,26,0.9)', border: '1px solid #2a2a2a',
            borderRadius: 12, padding: '16px 24px', textAlign: 'center',
          }}>
            <p style={{ color: '#6b6b6b', fontSize: 12, margin: 0 }}>Nenhuma obra com localização definida</p>
            <p style={{ color: '#3f3f3f', fontSize: 10, margin: '4px 0 0' }}>Edite uma obra e preencha as coordenadas</p>
          </div>
        </div>
      )}
    </div>
  )
}
