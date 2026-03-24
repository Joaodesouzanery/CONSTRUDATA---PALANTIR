/**
 * MapaInterativoPage — Interactive network map module.
 * Full Leaflet-based editor for sewer/water/civil networks.
 */
import { useState } from 'react'
import { MapaHeader }        from './components/MapaHeader'
import { MapaCanvas }        from './components/MapaCanvas'
import { MapaLayersPanel }   from './components/MapaLayersPanel'
import { MapaAnalyticsPanel } from './components/MapaAnalyticsPanel'

export function MapaInterativoPage() {
  const [showAnalytics, setShowAnalytics] = useState(false)

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden">
      <MapaHeader
        showAnalytics={showAnalytics}
        onToggleAnalytics={() => setShowAnalytics((v) => !v)}
      />
      <div className="relative flex-1 overflow-hidden">
        <MapaCanvas />
        <MapaLayersPanel />
      </div>
      {showAnalytics && <MapaAnalyticsPanel />}
    </div>
  )
}
