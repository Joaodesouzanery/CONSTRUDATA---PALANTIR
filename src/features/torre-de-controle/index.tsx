import { ObrasListPanel }  from './components/ObrasListPanel'
import { ObrasMap }         from './components/ObrasMap'
import { ObraDetailPanel }  from './components/ObraDetailPanel'
import { ObraDialog }       from './components/ObraDialog'
import { RiskDialog }       from './components/RiskDialog'

export function TorreDeControlePage() {
  return (
    <div className="flex h-full overflow-hidden">
      <ObrasListPanel />
      <ObrasMap />
      <ObraDetailPanel />
      <ObraDialog />
      <RiskDialog />
    </div>
  )
}
