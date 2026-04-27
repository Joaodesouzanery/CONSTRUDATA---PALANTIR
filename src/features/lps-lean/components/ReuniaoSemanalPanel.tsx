/**
 * ReuniaoSemanalPanel - guided weekly Last Planner ritual.
 */
import { CheckCircle, ClipboardList, AlertTriangle, Users, ArrowRight } from 'lucide-react'
import { useLpsStore, computeWeeklyPPC, weekLabel } from '@/store/lpsStore'

const steps = [
  { title: '1. Revisar semana anterior', tab: 'ppc' as const, icon: CheckCircle },
  { title: '2. Registrar CNC', tab: 'semaforo' as const, icon: AlertTriangle },
  { title: '3. Planejar proxima semana', tab: 'lookahead' as const, icon: ClipboardList },
  { title: '4. Confirmar compromissos', tab: 'lookahead' as const, icon: Users },
]

export function ReuniaoSemanalPanel() {
  const activities = useLpsStore((s) => s.activities)
  const setActiveTab = useLpsStore((s) => s.setActiveTab)
  const weekly = computeWeeklyPPC(activities)
  const lastWeek = weekly[weekly.length - 1]
  const pendingCnc = activities.filter((a) => a.planned && !a.completed && !a.cncCategory).length
  const uncommitted = activities.filter((a) => a.planned && !a.completed && !a.committed).length
  const committed = activities.filter((a) => a.planned && !a.completed && a.committed).length

  return (
    <div className="p-6 flex flex-col gap-5">
      <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-5">
        <p className="text-sm font-semibold text-white">Reuniao semanal LPS</p>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Ultimo PPC" value={lastWeek ? `${lastWeek.ppc}%` : '--'} detail={lastWeek ? weekLabel(lastWeek.week) : 'sem semana'} />
          <Metric label="CNC pendente" value={String(pendingCnc)} detail="nao concluidas sem causa" tone={pendingCnc > 0 ? 'warn' : 'ok'} />
          <Metric label="Comprometidas" value={String(committed)} detail="planejadas abertas" tone="ok" />
          <Metric label="Sem compromisso" value={String(uncommitted)} detail="precisam aceite da equipe" tone={uncommitted > 0 ? 'warn' : 'ok'} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {steps.map((step) => {
          const Icon = step.icon
          return (
            <button
              key={step.title}
              onClick={() => setActiveTab(step.tab)}
              className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4 text-left hover:border-[#f97316]/60 hover:bg-[#343434] transition-colors"
            >
              <Icon size={18} className="text-[#f97316]" />
              <p className="mt-3 text-sm font-semibold text-white">{step.title}</p>
              <div className="mt-4 flex items-center gap-1 text-xs text-[#f97316]">
                Abrir etapa <ArrowRight size={12} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Metric({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'text-green-400' : tone === 'warn' ? 'text-yellow-400' : 'text-[#f5f5f5]'
  return (
    <div className="rounded-lg border border-[#3d3d3d] bg-[#1f1f1f] p-3">
      <p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-[#6b6b6b]">{detail}</p>
    </div>
  )
}
