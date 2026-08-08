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
import { useAuth } from '@/lib/auth'
import { canViewCosts } from '@/lib/roles'

function isPredialTab(v: string | null): v is PredialTab {
  return !!v && PREDIAL_TABS.some((t) => t.key === v)
}

export function PredialPage() {
  const [params, setParams] = useSearchParams()
  const urlTab = params.get('tab')
  const [tab, setTab] = useState<PredialTab>(isPredialTab(urlTab) ? urlTab : 'painel')
  // Gating por papel: zelador/morador não veem valores financeiros → sem a aba CapEx.
  const canCosts = canViewCosts(useAuth((s) => s.profile?.role))
  const effectiveTab: PredialTab = tab === 'capex' && !canCosts ? 'painel' : tab

  const goTo = (t: PredialTab) => {
    setTab(t)
    setParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', t); return next }, { replace: true })
  }

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <PredialHeader activeTab={effectiveTab} onTabChange={goTo} canViewCosts={canCosts} />
      <div className="flex-1 overflow-auto">
        {effectiveTab === 'painel' && <PainelSindicoPanel onNavigate={goTo} />}
        {effectiveTab === 'ativos' && <PredialAtivosTab canViewCosts={canCosts} />}
        {effectiveTab === 'manutencoes' && <ManutencoesPage allowedTabs={['painel', 'tarefas', 'ordens', 'kanban', 'calendario']} canViewCosts={canCosts} />}
        {effectiveTab === 'laudos' && <ComplianceLaudosPanel />}
        {effectiveTab === 'capex' && canCosts && <CapexRoiPanel />}
      </div>
    </div>
  )
}
