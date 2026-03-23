import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTorreStore } from '@/store/torreDeControleStore'
import type { ConstructionSite, ObraStatus } from '@/types'

// ─── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ObraStatus, string> = {
  active:    '#f97316',
  planning:  '#3b82f6',
  paused:    '#eab308',
  completed: '#22c55e',
}

// ─── Custom SVG construction helmet marker ────────────────────────────────────

function createHelmetIcon(site: ConstructionSite, isSelected: boolean) {
  const size   = isSelected ? 44 : 36
  const color  = STATUS_COLOR[site.status]
  const hasCritical = site.risks.some((r) => r.level === 'critical' && r.status === 'active')

  const pulse = hasCritical ? `
    <div style="
      position:absolute;
      inset:-6px;
      border-radius:50%;
      background:${color};
      opacity:0.35;
      animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;
    "></div>` : ''

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 44 44">
      <!-- Base plate -->
      <rect x="6" y="30" width="32" height="5" rx="2.5" fill="${color}" opacity="0.9"/>
      <!-- Helmet dome -->
      <path d="M8 30 C8 18 36 18 36 30 Z" fill="${color}"/>
      <!-- Helmet highlight -->
      <path d="M12 24 C12 17 32 17 32 24" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
      <!-- Hard hat brim detail -->
      <path d="M5 30 Q22 27 39 30" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
      <!-- Center strap -->
      <rect x="20" y="18" width="4" height="12" rx="1" fill="rgba(0,0,0,0.2)"/>
    </svg>
  `

  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.6));">
      ${pulse}
      ${svg}
      ${isSelected ? `<div style="position:absolute;inset:-3px;border-radius:50%;border:2px solid ${color};opacity:0.7;"></div>` : ''}
    </div>
  `

  return L.divIcon({
    html,
    className: '',
    iconSize:  [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 8)],
  })
}

// ─── MapController — fly-to when selectedId changes ───────────────────────────

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

// ─── Map CSS ──────────────────────────────────────────────────────────────────

const MAP_CSS = `
  @keyframes ping {
    75%, 100% { transform: scale(1.8); opacity: 0; }
  }
  .torre-popup .leaflet-popup-content-wrapper {
    background: #1f1f1f;
    border: 1px solid #2a2a2a;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.6);
    padding: 0;
  }
  .torre-popup .leaflet-popup-content { margin: 0; }
  .torre-popup .leaflet-popup-tip { background: #1f1f1f; }
  .torre-popup .leaflet-popup-close-button { color: #6b6b6b !important; font-size: 16px; top: 8px; right: 10px; }
  .leaflet-control-zoom a { background: #1f1f1f !important; border-color: #2a2a2a !important; color: #a3a3a3 !important; }
  .leaflet-control-zoom a:hover { background: #252525 !important; color: #f97316 !important; }
  .leaflet-control-attribution { background: rgba(17,17,17,0.8) !important; color: #3f3f3f !important; font-size: 9px !important; }
`

// ─── Main Component ───────────────────────────────────────────────────────────

export function ObrasMap() {
  const sites      = useTorreStore((s) => s.sites)
  const selectedId = useTorreStore((s) => s.selectedId)
  const selectSite = useTorreStore((s) => s.selectSite)
  const setEditing = useTorreStore((s) => s.setEditing)
  const updateLocation = useTorreStore((s) => s.updateLocation)

  const withCoords = sites.filter((s) => s.lat != null && s.lng != null)

  return (
    <div className="flex-1 relative overflow-hidden" style={{ background: '#111' }}>
      <style>{MAP_CSS}</style>

      <MapContainer
        center={[-23.5505, -46.6333]}
        zoom={11}
        style={{ height: '100%', width: '100%', background: '#111111' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <MapController />

        {withCoords.map((site) => (
          <Marker
            key={site.id}
            position={[site.lat!, site.lng!]}
            icon={createHelmetIcon(site, site.id === selectedId)}
            draggable
            eventHandlers={{
              click: () => selectSite(site.id),
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng()
                updateLocation(site.id, lat, lng)
              },
            }}
          >
            <Popup className="torre-popup">
              <div style={{ padding: '12px 14px', minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: STATUS_COLOR[site.status], fontWeight: 700 }}>
                    {site.code}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: STATUS_COLOR[site.status] + '20', color: STATUS_COLOR[site.status],
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {site.status === 'active' ? 'Ativa' : site.status === 'planning' ? 'Planejamento' : site.status === 'paused' ? 'Pausada' : 'Concluída'}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f5f5f5', marginBottom: 6, lineHeight: 1.3 }}>
                  {site.name}
                </div>
                <div style={{ fontSize: 11, color: '#6b6b6b', marginBottom: 2 }}>
                  📍 {site.street}, {site.number}
                </div>
                <div style={{ fontSize: 11, color: '#6b6b6b', marginBottom: 8 }}>
                  {site.district} — {site.city}/{site.state}
                </div>
                <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 8 }}>
                  👷 Gerente: {site.manager}
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

      {withCoords.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1000, pointerEvents: 'none',
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
