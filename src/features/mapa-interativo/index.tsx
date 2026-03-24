/**
 * MapaInterativoPage — Interactive network map module.
 * Full Leaflet-based editor for sewer/water/civil networks.
 */
import { MapaHeader }      from './components/MapaHeader'
import { MapaCanvas }      from './components/MapaCanvas'
import { MapaLayersPanel } from './components/MapaLayersPanel'

export function MapaInterativoPage() {
  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden">
      <MapaHeader />
      <div className="relative flex-1 overflow-hidden">
        <MapaCanvas />
        <MapaLayersPanel />
      </div>
    </div>
  )
}
