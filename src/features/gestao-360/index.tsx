import { useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { isDemoModeEnabled } from '@/lib/runtimeMode'
import { useGestao360Store } from '@/store/gestao360Store'
import { useProjetosStore } from '@/store/projetosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { Gestao360Header } from './components/Gestao360Header'
import { Gestao360MapDashboard } from './components/Gestao360MapDashboard'
import { JobCostingPanel } from './components/JobCostingPanel'
import { ChangeOrderPanel } from './components/ChangeOrderPanel'
import { DailyReportPanel } from './components/DailyReportPanel'
import { GestaoAVistaPanel } from './components/GestaoAVistaPanel'

export function Gestao360Page() {
  const activeTab = useGestao360Store((s) => s.activeTab)
  const profileOrgId = useAuth((s) => s.profile?.organization_id)

  const projetosOrgId = useProjetosStore((s) => s.activeOrgId)
  const torreOrgId = useTorreStore((s) => s.activeOrgId)
  const gestaoOrgId = useGestao360Store((s) => s.activeOrgId)

  const ensureProjetosScope = useProjetosStore((s) => s.ensureTenantScope)
  const ensureTorreScope = useTorreStore((s) => s.ensureTenantScope)
  const ensureGestaoScope = useGestao360Store((s) => s.ensureTenantScope)

  const flushProjetos = useProjetosStore((s) => s.flush)
  const flushTorre = useTorreStore((s) => s.flush)
  const flushGestao = useGestao360Store((s) => s.flush)
  const pullProjetos = useProjetosStore((s) => s.pull)
  const pullTorre = useTorreStore((s) => s.pull)
  const pullGestao = useGestao360Store((s) => s.pull)

  useEffect(() => {
    if (!profileOrgId) return
    ensureProjetosScope(profileOrgId)
    ensureTorreScope(profileOrgId)
    ensureGestaoScope(profileOrgId)
    if (isDemoModeEnabled()) return

    void (async () => {
      await Promise.allSettled([flushProjetos(), flushTorre(), flushGestao()])
      await Promise.allSettled([pullProjetos(), pullTorre(), pullGestao()])
    })()
  }, [
    ensureGestaoScope,
    ensureProjetosScope,
    ensureTorreScope,
    flushGestao,
    flushProjetos,
    flushTorre,
    profileOrgId,
    pullGestao,
    pullProjetos,
    pullTorre,
  ])

  if (
    profileOrgId
    && (projetosOrgId !== profileOrgId || torreOrgId !== profileOrgId || gestaoOrgId !== profileOrgId)
  ) {
    return (
      <div className="flex h-full items-center justify-center bg-[#2c2c2c] p-6 text-sm text-[#a3a3a3]">
        Carregando dados da empresa ativa...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#2c2c2c]">
      {/* Sticky header + tab bar */}
      <div className="sticky top-0 z-10 bg-[#2c2c2c] border-b border-[#525252]">
        <Gestao360Header />
      </div>

      {/* Tab content */}
      {activeTab === 'dashboard' ? (
        <Gestao360MapDashboard />
      ) : activeTab === 'gestao-a-vista' ? (
        // Gestão à Vista traz o próprio cabeçalho (obra, período, botão de imprimir), então
        // renderiza full-bleed no seu próprio container de scroll.
        <div className="flex-1 overflow-y-auto">
          <GestaoAVistaPanel />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'jobacosting'  && <JobCostingPanel />}
          {activeTab === 'daily-report' && <DailyReportPanel />}
          {activeTab === 'changeorders' && <ChangeOrderPanel />}
        </div>
      )}
    </div>
  )
}
