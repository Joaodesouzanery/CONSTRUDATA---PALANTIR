import { Wrench } from 'lucide-react'
import { SabespPanel } from './SabespPanel'

/** Operacional é a cópia funcional do workbook Sabesp; Manutenções genéricas vivem no Predial. */
export function OperacionalPage() {
  return (
    <div className="flex h-full flex-col overflow-auto bg-gray-950">
      <header className="flex items-center gap-3 border-b border-[#525252] bg-[#2c2c2c] px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f97316] text-white">
          <Wrench size={20} />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Operacional</h1>
          <p className="text-xs text-[#a3a3a3]">Controle operacional e financeiro contratual Sabesp</p>
        </div>
      </header>
      <SabespPanel />
    </div>
  )
}
