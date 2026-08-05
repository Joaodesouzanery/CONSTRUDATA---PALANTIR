/**
 * PredialPage — módulo "Predial" (gestão do edificado). 5 abas enxutas:
 * Painel (do síndico) · Ativos · Manutenções · Laudos · CapEx. Ativos e Manutenções
 * reusam o ManutencoesPage com sub-abas filtradas. As antigas Visão Geral (duplicada),
 * Equipamentos/Saúde (frota) e Workbench saíram; Rateio volta em fase 2 atrás de flag.
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PredialHeader } from './components/PredialHeader'
import { PREDIAL_TABS, type PredialTab } from './tabs'
import { ManutencoesPage } from '@/features/manutencoes/index'
import { CapexRoiPanel } from './components/CapexRoiPanel'
import { ComplianceLaudosPanel } from './components/ComplianceLaudosPanel'
import { PainelSindicoPanel } from './components/PainelSindicoPanel'
import { PredialAtivosTab } from './components/PredialAtivosTab'

function isPredialTab(v: string | null): v is PredialTab {
  return !!v && PREDIAL_TABS.some((t) => t.key === v)
}

export function PredialPage() {
  const [params, setParams] = useSearchParams()
  const urlTab = params.get('tab')
  const [tab, setTab] = useState<PredialTab>(isPredialTab(urlTab) ? urlTab : 'painel')

  const goTo = (t: PredialTab) => {
    setTab(t)
    setParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', t); return next }, { replace: true })
  }

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <PredialHeader activeTab={tab} onTabChange={goTo} />
      <div className="flex-1 overflow-auto">
        {tab === 'painel' && <PainelSindicoPanel onNavigate={goTo} />}
        {tab === 'ativos' && <PredialAtivosTab />}
        {tab === 'manutencoes' && <ManutencoesPage allowedTabs={['painel', 'tarefas', 'ordens', 'kanban', 'calendario']} />}
        {tab === 'laudos' && <ComplianceLaudosPanel />}
        {tab === 'capex' && <CapexRoiPanel />}
      </div>
    </div>
  )
}
