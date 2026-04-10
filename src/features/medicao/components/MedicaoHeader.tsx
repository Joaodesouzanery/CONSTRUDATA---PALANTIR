import { Ruler } from 'lucide-react'
import { useMedicaoStore } from '@/store/medicaoStore'
import type { MedicaoTab } from '@/types'

const TABS: { key: MedicaoTab; label: string }[] = [
  { key: 'consolidado', label: 'Consolidado'        },
  { key: 'materiais',   label: 'Materiais Pendentes' },
  { key: 'resumo',      label: 'Resumo por Núcleo'   },
  { key: 'dashboard',   label: 'Dashboard'            },
]

export function MedicaoHeader() {
  const { activeTab, setActiveTab } = useMedicaoStore()

  return (
    <div className="flex items-center gap-4 px-6 py-3 bg-[#111827] border-b border-[#1f2937] shrink-0">
      <div className="flex items-center gap-2">
        <Ruler size={20} className="text-cyan-400" />
        <h1 className="text-sm font-bold text-white tracking-wide uppercase">Medição</h1>
      </div>

      <div className="flex gap-1 ml-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === t.key
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
