/**
 * MedicaoPage — root of the Medicao (Billing/Measurement) module.
 * Routes between 8 tabs via the store's activeTab state.
 */
import { MedicaoHeader } from './components/MedicaoHeader'
import { MedicaoSabespPanel } from './components/MedicaoSabespPanel'
import { CriterioMedicaoPanel } from './components/CriterioMedicaoPanel'
import { SubempreiteiroPanel } from './components/SubempreiteiroPanel'
import { FornecedorPanel } from './components/FornecedorPanel'
import { ConferenciaPanel } from './components/ConferenciaPanel'
import { ProducaoPanel } from './components/ProducaoPanel'
import { HorasExtrasPanel } from './components/HorasExtrasPanel'
import { MedicaoFinalPanel } from './components/MedicaoFinalPanel'
import { useMedicaoStore } from '@/store/medicaoStore'
import type { MedicaoTab } from '@/types'

const panels: Record<MedicaoTab, () => React.ReactNode> = {
  sabesp: MedicaoSabespPanel,
  criterio: CriterioMedicaoPanel,
  producao: ProducaoPanel,
  conferencia: ConferenciaPanel,
  horasExtras: HorasExtrasPanel,
  subempreiteiro: SubempreiteiroPanel,
  fornecedor: FornecedorPanel,
  medicaoFinal: MedicaoFinalPanel,
}

export function MedicaoPage() {
  const activeTab = useMedicaoStore((s) => s.activeTab)
  const Panel = panels[activeTab] ?? MedicaoSabespPanel

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <MedicaoHeader />
      <div className="flex-1 overflow-auto">
        <Panel />
      </div>
    </div>
  )
}
