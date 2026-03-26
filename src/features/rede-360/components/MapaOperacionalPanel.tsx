/**
 * MapaOperacionalPanel — Leaflet map with asset markers, service order markers, and outage overlays.
 */
import { useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useShallow } from 'zustand/react/shallow'
import { useRede360Store } from '@/store/rede360Store'
import { AtivoDrillDownPanel } from './AtivoDrillDownPanel'
import type { RiskLevel } from '@/types'

const RISK_COLORS: Record<RiskLevel, string> = {
  low:      '#22c55e',
  medium:   '#eab308',
  high:     '#f97316',
  critical: '#ef4444',
}

const PRIORITY_COLORS: Record<string, string> = {
  low:       '#94a3b8',
  medium:    '#eab308',
  high:      '#f97316',
  emergency: '#ef4444',
}

const BASEMAPS: Record<string, string> = {
  streets:   'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light:     'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
}

const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

const NETWORK_TYPE_LABELS: Record<string, string> = {
  sewer:    'Esgoto',
  water:    'Água',
  drainage: 'Drenagem',
  civil:    'Civil',
  generic:  'Genérico',
}

export function MapaOperacionalPanel() {
  const { assets, serviceOrders, outages, layerVisibility, setLayerVisibility, setSelectedAssetId } =
    useRede360Store(
      useShallow((s) => ({
        assets:             s.assets,
        serviceOrders:      s.serviceOrders,
        outages:            s.outages,
        layerVisibility:    s.layerVisibility,
        setLayerVisibility: s.setLayerVisibility,
        setSelectedAssetId: s.setSelectedAssetId,
      }))
    )

  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('dark')

  return (
    <div className="relative flex h-full">
      {/* Layer toggle panel */}
      <div className="absolute top-3 left-3 z-[1000] bg-[#112645]/90 border border-[#20406a] rounded-lg p-3 backdrop-blur-sm min-w-[140px]">
        <div className="text-[#f5f5f5] text-xs font-semibold mb-2">Camadas</div>
        {[
          { key: 'assets',  label: 'Ativos'           },
          { key: 'orders',  label: 'Ordens de Serviço' },
          { key: 'outages', label: 'Interrupções'      },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer mb-1">
            <input
              type="checkbox"
              checked={layerVisibility[key] ?? true}
              onChange={(e) => setLayerVisibility(key, e.target.checked)}
              className="w-3.5 h-3.5 accent-[#2abfdc]"
            />
            <span className="text-[#8fb3c8] text-xs">{label}</span>
          </label>
        ))}
        <div className="border-t border-[#20406a] mt-2 pt-2">
          <div className="text-[#6b6b6b] text-xs mb-1">Redes</div>
          {Object.entries(NETWORK_TYPE_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer mb-1">
              <input
                type="checkbox"
                checked={layerVisibility[key] ?? true}
                onChange={(e) => setLayerVisibility(key, e.target.checked)}
                className="w-3.5 h-3.5 accent-[#2abfdc]"
              />
              <span className="text-[#8fb3c8] text-xs">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Basemap selector */}
      <div className="absolute top-3 right-3 z-[1000]">
        <select
          value={basemap}
          onChange={(e) => setBasemap(e.target.value as keyof typeof BASEMAPS)}
          className="bg-[#112645] border border-[#20406a] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none"
        >
          <option value="streets">Ruas</option>
          <option value="satellite">Satélite</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>

      {/* Map */}
      <MapContainer
        center={[-23.55, -46.63]}
        zoom={13}
        className="flex-1 h-full w-full"
        style={{ background: '#0d2040' }}
      >
        <TileLayer
          url={BASEMAPS[basemap]}
          attribution={ATTRIBUTION}
        />

        {/* Assets */}
        {layerVisibility.assets && assets
          .filter((a) => layerVisibility[a.networkType] !== false)
          .map((asset) => (
            <CircleMarker
              key={asset.id}
              center={[asset.lat, asset.lng]}
              radius={10}
              pathOptions={{
                fillColor: RISK_COLORS[asset.riskLevel],
                color: 'white',
                weight: 2,
                fillOpacity: 0.9,
              }}
              eventHandlers={{
                click: () => setSelectedAssetId(asset.id),
              }}
            >
              <Tooltip>
                <div>
                  <strong>{asset.code}</strong> — {asset.name}<br />
                  Status: {asset.status} | Risco: {asset.riskLevel}
                </div>
              </Tooltip>
            </CircleMarker>
          ))
        }

        {/* Service orders */}
        {layerVisibility.orders && serviceOrders.map((order) => {
          const asset = assets.find((a) => a.id === order.assetId)
          if (!asset) return null
          return (
            <CircleMarker
              key={order.id}
              center={[asset.lat + 0.0005, asset.lng + 0.0005]}
              radius={6}
              pathOptions={{
                fillColor: PRIORITY_COLORS[order.priority] ?? '#94a3b8',
                color: 'white',
                weight: 1,
                fillOpacity: 0.8,
                dashArray: '4',
              }}
            >
              <Tooltip>
                <div>
                  <strong>{order.code}</strong><br />
                  {order.type} — {order.priority}
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}

        {/* Outages */}
        {layerVisibility.outages && outages
          .filter((o) => o.status !== 'resolved')
          .map((outage) => {
            const asset = assets.find((a) => outage.affectedAssetIds.includes(a.id))
            if (!asset) return null
            return (
              <CircleMarker
                key={outage.id}
                center={[asset.lat, asset.lng]}
                radius={18}
                pathOptions={{
                  fillColor: '#ef4444',
                  color: '#ef4444',
                  weight: 2,
                  fillOpacity: 0.25,
                }}
              >
                <Tooltip>
                  <div>
                    <strong>Interrupção</strong><br />
                    {outage.type} — {outage.status}<br />
                    {outage.affectedCustomers ? `${outage.affectedCustomers} clientes afetados` : ''}
                  </div>
                </Tooltip>
              </CircleMarker>
            )
          })
        }
      </MapContainer>

      {/* DrillDown panel overlaid on right */}
      <AtivoDrillDownPanel />
    </div>
  )
}
