import { useMemo, useState } from 'react'
import { CheckCircle2, GitPullRequestArrow, ListChecks, ShieldAlert, TrendingUp } from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useLpsStore, computeWeeklyPPC } from '@/store/lpsStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { PlanejamentoMacroPanel } from './PlanejamentoMacroPanel'
import { DerivacaoPanel } from './DerivacaoPanel'
import { ProgramacaoSemanalPanel } from './ProgramacaoSemanalPanel'
import { PlanejamentoRestricoesPanel } from './PlanejamentoRestricoesPanel'
import { LookAheadPanel } from '@/features/lps-lean/components/LookAheadPanel'
import { ReuniaoSemanalPanel } from '@/features/lps-lean/components/ReuniaoSemanalPanel'
import { PpcDashboard } from '@/features/lps-lean/components/PpcDashboard'

type OperationalTab = 'mestre' | 'pull' | 'lookahead' | 'semanal' | 'restricoes' | 'ppc' | 'pareto'

const tabs: Array<{ id: OperationalTab; label: string }> = [
  { id: 'mestre', label: 'Plano Mestre' },
  { id: 'pull', label: 'Pull Planning' },
  { id: 'lookahead', label: 'Lookahead' },
  { id: 'semanal', label: 'Plano Semanal' },
  { id: 'restricoes', label: 'Restrições' },
  { id: 'ppc', label: 'PPC/CNC' },
  { id: 'pareto', label: 'Pareto' },
]

function Kpi({ label, value, tone = 'text-white' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
      <p className="text-xs text-[#a3a3a3]">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

export function PlanejamentoOperacionalPanel() {
  const [active, setActive] = useState<OperationalTab>('mestre')
  const activities = usePlanejamentoMestreStore((state) => state.activities)
  const lpsActivities = useLpsStore((state) => state.activities)
  const restrictions = useLpsStore((state) => state.restrictions)
  const estoqueItens = useSuprimentosStore((state) => state.estoqueItens)
  const purchaseOrders = useSuprimentosStore((state) => state.purchaseOrders)

  const weekly = useMemo(() => computeWeeklyPPC(lpsActivities), [lpsActivities])
  const currentPpc = weekly.at(-1)?.ppc ?? 0
  const materialRisk = estoqueItens.filter((item) => item.qtdDisponivel === 0 || item.qtdDisponivel < item.estoqueMinimo).length
  const openRestrictions = restrictions.filter((item) => item.status !== 'resolvida')

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <GitPullRequestArrow size={18} className="text-[#f97316]" />
              <h2 className="text-base font-bold text-white">Planejamento Operacional Beta</h2>
            </div>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-[#a3a3a3]">
              Integra Plano Mestre, Pull Planning, Lookahead, Plano Semanal, restrições, PPC/CNC e Pareto. O fluxo usa Suprimentos para remover restrições de material e RDO para confirmar execução real.
            </p>
          </div>
          <span className="rounded-full border border-[#f97316]/30 bg-[#f97316]/10 px-3 py-1 text-xs font-semibold text-[#fdba74]">Beta operacional</span>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-5">
        <Kpi label="Atividades mestre" value={activities.length} />
        <Kpi label="PPC atual" value={`${currentPpc}%`} tone={currentPpc >= 80 ? 'text-[#4ade80]' : 'text-[#fbbf24]'} />
        <Kpi label="Restrições abertas" value={openRestrictions.length} tone={openRestrictions.length ? 'text-[#f87171]' : 'text-[#4ade80]'} />
        <Kpi label="Materiais em risco" value={materialRisk} tone={materialRisk ? 'text-[#f87171]' : 'text-[#4ade80]'} />
        <Kpi label="Pedidos ativos" value={purchaseOrders.length} />
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-[#525252] bg-[#2c2c2c] p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${active === tab.id ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:bg-[#3a3a3a] hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === 'mestre' && <PlanejamentoMacroPanel />}
      {active === 'pull' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
            <div className="flex items-center gap-2 text-white"><ListChecks size={16} className="text-[#38bdf8]" /><h3 className="text-sm font-semibold">Pull Planning por fase</h3></div>
            <p className="mt-2 text-xs leading-relaxed text-[#a3a3a3]">Use esta etapa para puxar a sequência a partir do marco final, registrar handoffs, responsáveis e restrições antes de liberar o Lookahead.</p>
          </div>
          <DerivacaoPanel />
        </div>
      )}
      {active === 'lookahead' && <LookAheadPanel />}
      {active === 'semanal' && (
        <div className="space-y-4">
          <ReuniaoSemanalPanel />
          <ProgramacaoSemanalPanel />
        </div>
      )}
      {active === 'restricoes' && <PlanejamentoRestricoesPanel />}
      {active === 'ppc' && <PpcDashboard />}
      {active === 'pareto' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
            <TrendingUp size={18} className="text-[#4ade80]" />
            <h3 className="mt-3 text-sm font-semibold text-white">Pareto 80/20</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#a3a3a3]">Mostra os 20% de causas de não cumprimento que explicam a maior parte dos atrasos e devem virar ação corretiva com responsável e prazo.</p>
          </div>
          <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
            <ShieldAlert size={18} className="text-[#f97316]" />
            <h3 className="mt-3 text-sm font-semibold text-white">Atacar CNC recorrente</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#a3a3a3]">Material, projeto, equipe, equipamento e externos devem virar restrições rastreáveis no Lookahead.</p>
          </div>
          <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4">
            <CheckCircle2 size={18} className="text-[#38bdf8]" />
            <h3 className="mt-3 text-sm font-semibold text-white">Fechar o ciclo com RDO</h3>
            <p className="mt-2 text-xs leading-relaxed text-[#a3a3a3]">O RDO confirma o executado real, alimenta avanço, PPC e a base da medição quando houver vínculo de serviço.</p>
          </div>
          <div className="lg:col-span-3"><PpcDashboard /></div>
        </div>
      )}
    </div>
  )
}
