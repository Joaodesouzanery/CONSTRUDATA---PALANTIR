/**
 * PredialPage — módulo "Predial" (facilities/manutenção do edificado). Container
 * que agrega, como abas, features existentes: Manutenções, Gestão de Equipamentos e
 * a Manutenção Preditiva (health scores). CapEx/ROI e Workbench entram nas fases B3/B4.
 * A reorg é de apresentação — nenhum store/tabela é alterado.
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PredialHeader } from './components/PredialHeader'
import { PREDIAL_TABS, type PredialTab } from './tabs'
import { PredialVisaoGeralPanel } from './components/PredialVisaoGeralPanel'
import { ManutencoesPage } from '@/features/manutencoes/index'
import { GestaoEquipamentosPage } from '@/features/gestao-equipamentos/index'
import { ManutencaoPreditivaPanel } from '@/features/otimizacao-frota/components/ManutencaoPreditivaPanel'
import { CapexRoiPanel } from './components/CapexRoiPanel'

function isPredialTab(v: string | null): v is PredialTab {
  return !!v && PREDIAL_TABS.some((t) => t.key === v)
}

export function PredialPage() {
  const [params, setParams] = useSearchParams()
  const urlTab = params.get('tab')
  const [tab, setTab] = useState<PredialTab>(isPredialTab(urlTab) ? urlTab : 'visao-geral')

  const goTo = (t: PredialTab) => {
    setTab(t)
    setParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', t); return next }, { replace: true })
  }

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <PredialHeader activeTab={tab} onTabChange={goTo} />
      <div className="flex-1 overflow-auto">
        {tab === 'visao-geral' && <PredialVisaoGeralPanel onNavigate={goTo} />}
        {tab === 'manutencoes' && <ManutencoesPage />}
        {tab === 'equipamentos' && <GestaoEquipamentosPage />}
        {tab === 'saude' && <div className="p-6"><ManutencaoPreditivaPanel /></div>}
        {tab === 'capex' && <CapexRoiPanel />}
        {tab === 'workbench' && <EmBreve titulo="Workbench de chamados" descricao="Chamado + tickets similares + manuais/troubleshooting (heurística, sem IA externa). Chega na próxima entrega." />}
      </div>
    </div>
  )
}

function EmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center justify-center text-center gap-3 rounded-2xl border border-dashed border-[#525252] bg-[#333333] py-16 px-6">
        <h2 className="text-white font-semibold text-lg">{titulo}</h2>
        <p className="text-[#a3a3a3] text-sm max-w-md">{descricao}</p>
        <span className="mt-1 text-xs font-medium text-[#f97316] bg-[#f97316]/10 rounded-full px-3 py-1">Em breve</span>
      </div>
    </div>
  )
}
