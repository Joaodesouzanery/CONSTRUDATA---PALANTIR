/**
 * PredialAtivosTab — aba "Ativos" do Predial: alterna entre o Inventário (DNA dos ativos,
 * reusa o ManutencoesPage focado em ativos/monitoramento) e a Criticidade de Ativos (regra +
 * memória de cálculo). Mantém Ativos como uma top-aba única, sem inflar o menu.
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ManutencoesPage } from '@/features/manutencoes/index'
import { CriticidadeAtivosPanel } from './CriticidadeAtivosPanel'

export function PredialAtivosTab() {
  const [view, setView] = useState<'inventario' | 'criticidade'>('inventario')
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-[#525252] bg-[#2c2c2c] px-6 py-2">
        {([['inventario', 'Inventário'], ['criticidade', 'Criticidade']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', view === k ? 'bg-[#3d3d3d] text-white' : 'text-[#a3a3a3] hover:text-white')}>{label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {view === 'inventario' ? <ManutencoesPage allowedTabs={['ativos', 'monitoramento']} /> : <CriticidadeAtivosPanel />}
      </div>
    </div>
  )
}
