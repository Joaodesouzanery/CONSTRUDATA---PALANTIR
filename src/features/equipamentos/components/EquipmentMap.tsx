import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { EquipmentStatus } from '@/types'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { STATUS_CONFIG } from '../constants'

// ─── Custom SVG pin marker ─────────────────────────────────────────────────────

function createPinIcon(status: EquipmentStatus, selected: boolean): L.DivIcon {
  const color = STATUS_CONFIG[status].color
  const size = selected ? 42 : 34
  const pulse = status === 'alert'
    ? `<div style="
        position:absolute;inset:-6px;border-radius:50%;
        border:2px solid ${color};opacity:0.5;
        animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;
      "></div>`
    : ''

  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:${size}px;height:${size + 10}px;">
        ${pulse}
        <svg xmlns="http://www.w3.org/2000/svg"
          width="${size}" height="${size + 10}"
          viewBox="0 0 34 44" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.55))">
          <path d="M17 0C7.611 0 0 7.611 0 17c0 6.23 3.34 11.68 8.32 14.74L17 44l8.68-12.26C30.66 28.68 34 23.23 34 17 34 7.611 26.389 0 17 0z"
            fill="${color}" />
          <circle cx="17" cy="17" r="8"
            fill="${selected ? '#fff' : 'rgba(255,255,255,0.92)'}"/>
          ${selected
            ? `<circle cx="17" cy="17" r="4" fill="${color}"/>`
            : `<circle cx="17" cy="17" r="3" fill="${color}" opacity="0.7"/>`}
        </svg>
      </div>`,
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 10],
    popupAnchor: [0, -(size + 14)],
  })
}

// ─── Fly-to on selection ───────────────────────────────────────────────────────

function MapController() {
  const map          = useMap()
  const selectedId   = useEquipamentosStore((s) => s.selectedId)
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)
  const prevId       = useRef<string | null>(null)

  useEffect(() => {
    if (selectedId && selectedId !== prevId.current) {
      const eq = equipamentos.find((e) => e.id === selectedId)
      if (eq && eq.lat !== null && eq.lng !== null) {
        map.flyTo([eq.lat, eq.lng], Math.max(map.getZoom(), 16), { duration: 0.9 })
      }
    }
    prevId.current = selectedId
  }, [selectedId, equipamentos, map])

  return null
}

// ─── Main map component ────────────────────────────────────────────────────────

export function EquipmentMap() {
  const equipamentos    = useEquipamentosStore((s) => s.equipamentos)
  const selectedId      = useEquipamentosStore((s) => s.selectedId)
  const selectEquipamento = useEquipamentosStore((s) => s.selectEquipamento)
  const updateLocation  = useEquipamentosStore((s) => s.updateLocation)
  const setEditing      = useEquipamentosStore((s) => s.setEditing)

  const positioned = equipamentos.filter((e) => e.lat !== null && e.lng !== null)

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* CSS for alert pulse animation — injected once */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.8); opacity: 0; }
        }
        /* Light theme for Leaflet UI controls (Voyager tiles) */
        .leaflet-control-zoom a {
          background-color: #ffffff !important;
          border-color: #d4d8df !important;
          color: #505863 !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: #f0f2f5 !important;
          color: #f97316 !important;
        }
        .leaflet-control-attribution {
          background: rgba(255,255,255,0.85) !important;
          color: #78828f !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: #505863 !important; }
        /* Dark popup */
        .equip-popup .leaflet-popup-content-wrapper {
          background: #1f1f1f;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.6);
          color: #f5f5f5;
          padding: 0;
        }
        .equip-popup .leaflet-popup-content { margin: 0; }
        .equip-popup .leaflet-popup-tip { background: #1f1f1f; }
        .equip-popup .leaflet-popup-close-button {
          color: #6b6b6b !important;
          font-size: 16px !important;
          top: 8px !important; right: 10px !important;
        }
        .equip-popup .leaflet-popup-close-button:hover { color: #f5f5f5 !important; }
      `}</style>

      <MapContainer
        center={[-23.5190, -46.6290]}
        zoom={13}
        style={{ height: '100%', width: '100%', background: '#f5f5f5' }}
        zoomControl
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        <MapController />

        {positioned.map((eq) => (
          <Marker
            key={eq.id}
            position={[eq.lat!, eq.lng!]}
            icon={createPinIcon(eq.status, selectedId === eq.id)}
            draggable
            eventHandlers={{
              click: () => selectEquipamento(selectedId === eq.id ? null : eq.id),
              dragend: (e) => {
                const { lat, lng } = e.target.getLatLng()
                updateLocation(eq.id, lat, lng)
              },
            }}
          >
            <Popup className="equip-popup" minWidth={220}>
              <div style={{ padding: '14px 16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                {/* Code + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#f97316', fontWeight: 700 }}>
                    {eq.code}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                    background: STATUS_CONFIG[eq.status].colorMuted,
                    color: STATUS_CONFIG[eq.status].color,
                  }}>
                    {STATUS_CONFIG[eq.status].label}
                  </span>
                </div>

                {/* Name + type */}
                <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13, color: '#f5f5f5' }}>{eq.name}</p>
                <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6b6b6b' }}>{eq.brand} {eq.model} · {eq.year}</p>

                {/* Site */}
                {eq.siteName && (
                  <p style={{ margin: '0 0 6px', fontSize: 11, color: '#a3a3a3' }}>📍 {eq.siteName}</p>
                )}

                {/* Operator */}
                {eq.operator && (
                  <p style={{ margin: '0 0 10px', fontSize: 11, color: '#6b6b6b' }}>
                    👷 {eq.operator}
                  </p>
                )}

                {/* Engine hours */}
                <p style={{ margin: '0 0 12px', fontSize: 11, color: '#6b6b6b' }}>
                  ⏱ {eq.engineHours.toLocaleString('pt-BR')}h de motor
                </p>

                {/* Active alerts */}
                {eq.alerts.filter(a => !a.acknowledged).length > 0 && (
                  <div style={{
                    background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '6px 10px',
                    marginBottom: 10,
                  }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#ef4444' }}>
                      ⚠ {eq.alerts.filter(a => !a.acknowledged).length} alerta(s) ativo(s)
                    </p>
                  </div>
                )}

                {/* Edit button */}
                <button
                  onClick={() => setEditing(eq.id)}
                  style={{
                    width: '100%', padding: '6px', borderRadius: 8, border: '1px solid #2a2a2a',
                    background: 'transparent', color: '#f97316', fontSize: 11, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Editar Equipamento
                </button>

                {/* Drag hint */}
                <p style={{ margin: '8px 0 0', fontSize: 9, color: '#3f3f3f', textAlign: 'center' }}>
                  Arraste o marcador para reposicionar
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Empty state overlay */}
        {positioned.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 1000, pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(17,17,17,0.85)', border: '1px solid #2a2a2a',
              borderRadius: 12, padding: '16px 24px', textAlign: 'center',
            }}>
              <p style={{ margin: 0, color: '#6b6b6b', fontSize: 13 }}>
                Nenhum equipamento com localização definida
              </p>
              <p style={{ margin: '4px 0 0', color: '#3f3f3f', fontSize: 11 }}>
                Edite um equipamento e preencha as coordenadas
              </p>
            </div>
          </div>
        )}
      </MapContainer>
    </div>
  )
}
