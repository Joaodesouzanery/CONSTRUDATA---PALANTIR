/**
 * DashboardPanel — KPIs e visão geral do módulo Qualidade.
 */
import { useMemo } from 'react'
import {
  ShieldCheck, AlertTriangle, ClipboardCheck, FileWarning,
} from 'lucide-react'
import { useQualidadeStore } from '@/store/qualidadeStore'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accent: string
}

function KpiCard({ label, value, sub, icon, accent }: KpiCardProps) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</span>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

export function DashboardPanel() {
  const fvss = useQualidadeStore((s) => s.fvss)

  const stats = useMemo(() => {
    const totalFvs = fvss.length
    let totalItems = 0
    let conformes = 0
    let naoConformes = 0
    let reinspecaoOk = 0

    fvss.forEach((f) => {
      f.items.forEach((i) => {
        totalItems++
        if (i.conformity === 'conforme')      conformes++
        else if (i.conformity === 'nao_conforme')  naoConformes++
        else if (i.conformity === 'reinspecao_ok') reinspecaoOk++
      })
    })

    const ncAbertas = fvss.filter((f) => f.ncRequired).length
    const conformityRate = totalItems > 0
      ? Math.round(((conformes + reinspecaoOk) / totalItems) * 100)
      : 0

    return { totalFvs, totalItems, conformes, naoConformes, reinspecaoOk, ncAbertas, conformityRate }
  }, [fvss])

  // Distribution per FVS
  const recentFvss = useMemo(
    () => [...fvss].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    [fvss],
  )

  return (
    <div className="p-6 space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total de FVS"
          value={stats.totalFvs}
          sub="Fichas registradas"
          icon={<ClipboardCheck size={18} className="text-white" />}
          accent="#14b8a6"
        />
        <KpiCard
          label="Taxa de Conformidade"
          value={`${stats.conformityRate}%`}
          sub={`${stats.conformes + stats.reinspecaoOk} de ${stats.totalItems} itens`}
          icon={<ShieldCheck size={18} className="text-white" />}
          accent="#22c55e"
        />
        <KpiCard
          label="Não Conformidades"
          value={stats.naoConformes}
          sub="Itens em desacordo"
          icon={<AlertTriangle size={18} className="text-white" />}
          accent="#f59e0b"
        />
        <KpiCard
          label="NCs Abertas"
          value={stats.ncAbertas}
          sub="Pendentes de tratamento"
          icon={<FileWarning size={18} className="text-white" />}
          accent="#ef4444"
        />
      </div>

      {/* Conformity Bar */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-teal-400" />
          Distribuição de Conformidade (Itens)
        </h3>
        {stats.totalItems > 0 ? (
          <>
            <div className="flex h-6 rounded-lg overflow-hidden">
              <div
                className="bg-emerald-500 flex items-center justify-center text-xs font-bold text-white"
                style={{ width: `${(stats.conformes / stats.totalItems) * 100}%` }}
              >
                {stats.conformes > 0 && stats.conformes}
              </div>
              <div
                className="bg-blue-500 flex items-center justify-center text-xs font-bold text-white"
                style={{ width: `${(stats.reinspecaoOk / stats.totalItems) * 100}%` }}
              >
                {stats.reinspecaoOk > 0 && stats.reinspecaoOk}
              </div>
              <div
                className="bg-red-500 flex items-center justify-center text-xs font-bold text-white"
                style={{ width: `${(stats.naoConformes / stats.totalItems) * 100}%` }}
              >
                {stats.naoConformes > 0 && stats.naoConformes}
              </div>
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-2 text-gray-300">
                <span className="w-3 h-3 rounded-sm bg-emerald-500"></span> Conforme ({stats.conformes})
              </span>
              <span className="flex items-center gap-2 text-gray-300">
                <span className="w-3 h-3 rounded-sm bg-blue-500"></span> Conforme após reinspeção ({stats.reinspecaoOk})
              </span>
              <span className="flex items-center gap-2 text-gray-300">
                <span className="w-3 h-3 rounded-sm bg-red-500"></span> Não Conforme ({stats.naoConformes})
              </span>
            </div>
          </>
        ) : (
          <p className="text-gray-500 text-sm italic">Nenhuma FVS registrada ainda.</p>
        )}
      </div>

      {/* Recent FVSs */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <h3 className="text-white font-semibold text-sm mb-4">FVS Recentes</h3>
        {recentFvss.length === 0 ? (
          <p className="text-gray-500 text-sm italic">Nenhuma FVS registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {recentFvss.map((f) => {
              const conformes = f.items.filter((i) => i.conformity === 'conforme' || i.conformity === 'reinspecao_ok').length
              const total = f.items.length
              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-900/50 text-teal-300">
                      #{f.number}
                    </span>
                    <div>
                      <div className="text-white text-sm font-medium">{f.identificationNo}</div>
                      <div className="text-gray-400 text-xs">
                        {f.responsibleLeader} · {f.date.split('-').reverse().join('/')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">
                      {conformes}/{total} conformes
                    </span>
                    {f.ncRequired && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-900/50 text-red-300">
                        NC {f.ncNumber}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
