/**
 * PlanejamentoPage — root of the Planejamento de Trechos module.
 * Routes between 9 tabs via the store's activeTab state.
 */
import { useEffect } from 'react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { PlanejamentoHeader } from './components/PlanejamentoHeader'
import { ConfigPanel }      from './components/ConfigPanel'
import { ExecucaoPanel }    from './components/ExecucaoPanel'
import { TrechosPanel }     from './components/TrechosPanel'
import { GanttPanel }       from './components/GanttPanel'
import { SCurvePanel }      from './components/SCurvePanel'
import { AbcPanel }         from './components/AbcPanel'
import { HistogramPanel }   from './components/HistogramPanel'
import { DailyPlanPanel }   from './components/DailyPlanPanel'
import { NotesPanel }       from './components/NotesPanel'
import { ScenariosPanel }   from './components/ScenariosPanel'
import { IntegracaoPanel as RdoPlanejamentoPanel } from '@/features/rdo/components/IntegracaoPanel'

export function PlanejamentoPage() {
  const { activeTab } = usePlanejamentoStore()
  const runSchedule = usePlanejamentoStore((s) => s.runSchedule)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)

  // Reagenda ao trocar de obra: Gantt/ABC/curva passam a refletir só a obra ativa.
  useEffect(() => {
    runSchedule()
  }, [activeObraId, runSchedule])

  function renderPanel() {
    switch (activeTab) {
      case 'config':    return <ConfigPanel />
      case 'execucao':  return <ExecucaoPanel />
      case 'trechos':   return <TrechosPanel />
      case 'gantt':     return <GanttPanel />
      case 'scurve':    return <SCurvePanel />
      case 'abc':       return <AbcPanel />
      case 'histogram': return <HistogramPanel />
      case 'daily':     return <DailyPlanPanel />
      case 'rdo':       return <RdoPlanejamentoPanel />
      case 'notes':     return <NotesPanel />
      case 'scenarios': return <ScenariosPanel />
      default:          return <ConfigPanel />
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <PlanejamentoHeader />
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
    </div>
  )
}
