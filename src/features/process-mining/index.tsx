import { useState } from 'react'
import { Activity } from 'lucide-react'
import { FluxoProcessoPanel } from './components/FluxoProcessoPanel'
import { GargalosPanel } from './components/GargalosPanel'
import { PlaneadoXExecutadoPanel } from './components/PlaneadoXExecutadoPanel'
import { RastreioSuprimentosPanel } from './components/RastreioSuprimentosPanel'
import { AnomaliasFeed } from './components/AnomaliasFeed'

type Tab = 'fluxo' | 'gargalos' | 'planejado' | 'suprimentos' | 'anomalias'

const TABS: { id: Tab; label: string }[] = [
  { id: 'fluxo', label: 'Fluxo' },
  { id: 'gargalos', label: 'Gargalos' },
  { id: 'planejado', label: 'Plan. × Exec.' },
  { id: 'suprimentos', label: 'Suprimentos' },
  { id: 'anomalias', label: 'Anomalias' },
]

export function ProcessMiningPage() {
  const [activeTab, setActiveTab] = useState<Tab>('fluxo')

  return (
    <div className="min-h-screen bg-gray-950 text-[#f5f5f5]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#f97316]/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#f97316]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#f5f5f5]">Process Mining</h1>
            <p className="text-sm text-[#a3a3a3]">Análise de processos e gargalos da operação</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#525252]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-[#f97316] text-[#f97316]'
                  : 'border-transparent text-[#a3a3a3] hover:text-[#f5f5f5]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="bg-[#1c1c1c] rounded-xl border border-[#525252] p-6">
          {activeTab === 'fluxo' && <FluxoProcessoPanel />}
          {activeTab === 'gargalos' && <GargalosPanel />}
          {activeTab === 'planejado' && <PlaneadoXExecutadoPanel />}
          {activeTab === 'suprimentos' && <RastreioSuprimentosPanel />}
          {activeTab === 'anomalias' && <AnomaliasFeed />}
        </div>
      </div>
    </div>
  )
}
