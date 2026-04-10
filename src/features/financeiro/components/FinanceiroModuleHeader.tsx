import { DollarSign } from 'lucide-react'
import { useFinanceiroStore } from '@/store/financeiroStore'
import type { FinanceiroTab } from '@/types'

const TABS: { key: FinanceiroTab; label: string }[] = [
  { key: 'visao-geral', label: 'Visão Geral'   },
  { key: 'entradas',    label: 'Entradas'       },
  { key: 'saidas',      label: 'Saídas'         },
  { key: 'fluxo-caixa', label: 'Fluxo de Caixa' },
]

export function FinanceiroModuleHeader() {
  const { activeTab, setActiveTab } = useFinanceiroStore()
  return (
    <div className="flex items-center gap-4 px-6 py-3 bg-[#111827] border-b border-[#1f2937] shrink-0">
      <div className="flex items-center gap-2">
        <DollarSign size={20} className="text-emerald-400" />
        <h1 className="text-sm font-bold text-white tracking-wide uppercase">Financeiro</h1>
      </div>
      <div className="flex gap-1 ml-4">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${activeTab === t.key ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
