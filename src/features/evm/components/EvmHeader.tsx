/**
 * EvmHeader — top bar with KPI cards and tab navigation for the EVM module.
 */
import { useState } from 'react'
import { DollarSign, Download, RefreshCw, Link } from 'lucide-react'
import { HelpTooltip } from '@/components/shared/HelpTooltip'
import { useEvmStore } from '@/store/evmStore'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import type { EvmTab } from '@/types'

const TABS: { key: EvmTab; label: string }[] = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'medicao',       label: 'Medição Ponderada' },
  { key: 'plano-contas',  label: 'Plano de Contas' },
  { key: 'work-packages', label: 'Work Packages' },
  { key: 'indices',       label: 'Índices' },
]

function KpiCard({
  label,
  value,
  isCurrency = false,
  isIndex = false,
  helpTopic,
  subtitle,
}: {
  label: string
  value: number
  isCurrency?: boolean
  isIndex?: boolean
  helpTopic?: string
  subtitle?: string
}) {
  const formatted = isCurrency
    ? formatCurrency(value)
    : value.toFixed(2)

  const color = isIndex
    ? value >= 1
      ? '#22c55e'
      : '#ef4444'
    : '#f5f5f5'

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 min-w-[140px]">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-[#a3a3a3] text-xs">{label}</p>
        {helpTopic && <HelpTooltip topic={helpTopic} size={12} />}
      </div>
      <p className="font-mono text-lg font-semibold" style={{ color }}>
        {formatted}
      </p>
      {subtitle && (
        <p className="text-[10px] mt-1 leading-tight" style={{ color }}>{subtitle}</p>
      )}
    </div>
  )
}

function tcpiStatus(tcpi: number): { color: string; label: string } {
  if (tcpi <= 0) return { color: '#6b6b6b', label: 'Sem dados' }
  if (tcpi <= 1.0) return { color: '#22c55e', label: 'Viável — manter ritmo' }
  if (tcpi <= 1.2) return { color: '#eab308', label: `Atenção — melhore ${Math.round((tcpi - 1) * 100)}%` }
  return { color: '#ef4444', label: 'Crítico — renegocie escopo' }
}

export function EvmHeader() {
  const { activeTab, setActiveTab, evmMetrics, loadDemoData, recalculateMetrics, syncFromPlanejamento, sCurveData } = useEvmStore()
  const { CPI, SPI, BAC, EAC, VAC, TCPI } = evmMetrics
  const [syncing, setSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      const { usePlanejamentoStore } = await import('@/store/planejamentoStore')
      const { scurvePoints, totalCostBRL } = usePlanejamentoStore.getState() as {
        scurvePoints: Array<{ dayIndex: number; date: string; cumulativePhysicalPct: number; cumulativeFinancialPct: number; cumulativeMeters: number; cumulativeCostBRL: number }>
        totalCostBRL: number
      }

      if (scurvePoints.length === 0) {
        alert('Rode o cronograma no módulo Planejamento primeiro')
        setSyncing(false)
        return
      }

      // Derive PV: find the S-curve point closest to today
      const today = new Date().toISOString().slice(0, 10)
      let closestIdx = 0
      let closestDiff = Infinity
      for (let i = 0; i < scurvePoints.length; i++) {
        const diff = Math.abs(new Date(scurvePoints[i].date).getTime() - new Date(today).getTime())
        if (diff < closestDiff) {
          closestDiff = diff
          closestIdx = i
        }
      }
      const pv = scurvePoints[closestIdx].cumulativeFinancialPct * totalCostBRL

      // Map S-curve points to EVM format, preserving existing actual data
      const existingByDate = new Map(sCurveData.map((p) => [p.date, p]))
      const newSCurve = scurvePoints.map((pt) => {
        const existing = existingByDate.get(pt.date)
        return {
          date: pt.date,
          plannedFinancialPct: pt.cumulativeFinancialPct,
          actualPhysicalPct: existing?.actualPhysicalPct ?? 0,
          earnedValuePct: existing?.earnedValuePct ?? 0,
          actualCostPct: existing?.actualCostPct ?? 0,
        }
      })

      syncFromPlanejamento(totalCostBRL, pv, newSCurve)
      setSyncDone(true)
      setTimeout(() => setSyncDone(false), 2000)
    } catch {
      alert('Erro ao sincronizar com Planejamento')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-white font-semibold text-lg leading-tight">
                Gerenciamento de Valor (EVM)
              </h1>
              <HelpTooltip topic="evm" />
            </div>
            <p className="text-[#a3a3a3] text-xs">Earned Value Management</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadDemoData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] transition-colors hover:bg-[#ea580c]"
          >
            <Download size={15} />
            Carregar Demo
          </button>
          <button
            onClick={recalculateMetrics}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <RefreshCw size={15} />
            Recalcular
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors disabled:opacity-50"
          >
            <Link size={15} className={syncing ? 'animate-spin' : ''} />
            {syncDone ? 'Sincronizado!' : syncing ? 'Sincronizando...' : 'Sincronizar Planejamento'}
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        <KpiCard label="CPI" value={CPI} isIndex helpTopic="cpi" />
        <KpiCard label="SPI" value={SPI} isIndex helpTopic="spi" />
        <KpiCard label="TCPI" value={TCPI} isIndex helpTopic="tcpi" subtitle={tcpiStatus(TCPI).label} />
        <KpiCard label="BAC (R$)" value={BAC} isCurrency />
        <KpiCard label="EAC (R$)" value={EAC} isCurrency />
        <KpiCard label="VAC (R$)" value={VAC} isCurrency />
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2',
                  isActive
                    ? 'text-white border-orange-500 bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
