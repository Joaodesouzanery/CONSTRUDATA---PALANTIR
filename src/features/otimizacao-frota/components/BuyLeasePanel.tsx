import { useShallow } from 'zustand/react/shallow'
import { RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import type { BuyLeaseAnalysis, BuyLeaseRec } from '@/types'

// ─── Recommendation meta ──────────────────────────────────────────────────────

const REC_META: Record<BuyLeaseRec, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  buy:     { label: 'COMPRAR', color: '#22c55e', bg: '#22c55e15', Icon: TrendingDown  },
  lease:   { label: 'ALUGAR',  color: '#3b82f6', bg: '#3b82f615', Icon: TrendingUp   },
  neutral: { label: 'NEUTRO',  color: '#6b6b6b', bg: '#6b6b6b15', Icon: Minus        },
}

// ─── Cost comparison bar ──────────────────────────────────────────────────────

function CostComparisonBar({ analysis }: { analysis: BuyLeaseAnalysis }) {
  const max = Math.max(analysis.annualRentalCostBRL, analysis.annualOwnershipCostBRL, 1)
  const rentalPct   = (analysis.annualRentalCostBRL   / max) * 100
  const ownershipPct = (analysis.annualOwnershipCostBRL / max) * 100

  // Break-even marker position (% of the longer bar duration context, capped 10-90)
  const breakEvenPct = Math.min(90, Math.max(10, (analysis.breakEvenMonths / 120) * 100))

  return (
    <div className="flex flex-col gap-2 mt-3">
      {/* Rental bar */}
      <div className="flex items-center gap-2">
        <span className="w-28 text-[#6b6b6b] text-xs shrink-0 text-right">Custo Aluguel/ano</span>
        <div className="flex-1 h-5 bg-[#1a1a1a] rounded overflow-hidden relative">
          <div
            className="h-full rounded transition-all duration-500"
            style={{ width: `${rentalPct}%`, backgroundColor: '#3b82f6' }}
          />
          {/* break-even marker on rental bar */}
          <div
            className="absolute top-0 h-full w-[2px] bg-[#f97316] opacity-70"
            style={{ left: `${breakEvenPct}%` }}
          />
        </div>
        <span className="w-20 text-[#f5f5f5] text-xs shrink-0 font-mono">
          R${(analysis.annualRentalCostBRL / 1000).toFixed(0)}k
        </span>
      </div>

      {/* Ownership bar */}
      <div className="flex items-center gap-2">
        <span className="w-28 text-[#6b6b6b] text-xs shrink-0 text-right">Custo Propriedade/ano</span>
        <div className="flex-1 h-5 bg-[#1a1a1a] rounded overflow-hidden relative">
          <div
            className="h-full rounded transition-all duration-500"
            style={{ width: `${ownershipPct}%`, backgroundColor: '#22c55e' }}
          />
          <div
            className="absolute top-0 h-full w-[2px] bg-[#f97316] opacity-70"
            style={{ left: `${breakEvenPct}%` }}
          />
        </div>
        <span className="w-20 text-[#f5f5f5] text-xs shrink-0 font-mono">
          R${(analysis.annualOwnershipCostBRL / 1000).toFixed(0)}k
        </span>
      </div>

      {/* Break-even label */}
      <div className="flex items-center gap-1.5 mt-0.5">
        <div className="w-3 h-[2px] bg-[#f97316]" />
        <span className="text-[#f97316] text-[10px]">
          Break-even: {analysis.breakEvenMonths} meses
          {analysis.breakEvenMonths <= 36
            ? ' — payback rápido'
            : analysis.breakEvenMonths <= 60
            ? ' — payback moderado'
            : ' — payback longo'}
        </span>
      </div>
    </div>
  )
}

// ─── Analysis card ────────────────────────────────────────────────────────────

function BuyLeaseCard({ a }: { a: BuyLeaseAnalysis }) {
  const meta = REC_META[a.recommendation]
  const { Icon } = meta

  const savingsDelta = Math.abs(a.annualRentalCostBRL - a.annualOwnershipCostBRL)

  return (
    <div
      className="bg-[#222222] rounded-xl p-4"
      style={{ border: `1px solid ${meta.color}30` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-[#f5f5f5] text-sm font-semibold">{a.equipmentType}</p>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            Status atual:&nbsp;
            <span className="text-[#f5f5f5]">
              {a.currentStatus === 'owned' ? 'Frota própria' : a.currentStatus === 'rented' ? 'Alugado' : 'Sem ativo'}
            </span>
            &nbsp;·&nbsp;
            {a.projectedUsageDays} dias/ano projetados
          </p>
        </div>

        {/* Recommendation badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0"
          style={{ backgroundColor: meta.bg, border: `1px solid ${meta.color}40` }}
        >
          <Icon size={14} style={{ color: meta.color }} />
          <span className="text-xs font-bold" style={{ color: meta.color }}>{meta.label}</span>
        </div>
      </div>

      {/* Cost comparison */}
      <CostComparisonBar analysis={a} />

      {/* Savings delta */}
      <p className="text-xs text-[#6b6b6b] mt-2">
        Diferença anual:&nbsp;
        <span className="font-semibold" style={{ color: meta.color }}>
          R${savingsDelta.toLocaleString('pt-BR')}
        </span>
        &nbsp;a favor de&nbsp;
        <span style={{ color: meta.color }}>
          {a.recommendation === 'buy' ? 'comprar' : a.recommendation === 'lease' ? 'alugar' : 'neutro'}
        </span>
      </p>

      {/* Reasoning */}
      <p className="text-[#6b6b6b] text-xs leading-relaxed mt-2 mb-3 border-t border-[#2a2a2a] pt-2">
        {a.reasoning}
      </p>

      {/* BIM 5D phases + related projects */}
      <div className="flex flex-col gap-1.5">
        {a.bimPhases.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#6b6b6b] text-[10px] shrink-0">BIM 5D:</span>
            {a.bimPhases.map((phase) => (
              <span
                key={phase}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#3b82f6]/15 text-[#3b82f6]"
              >
                {phase}
              </span>
            ))}
          </div>
        )}
        {a.relatedProjects.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#6b6b6b] text-[10px] shrink-0">Projetos:</span>
            {a.relatedProjects.map((proj) => (
              <span
                key={proj}
                className="px-2 py-0.5 rounded text-[10px] bg-[#2a2a2a] text-[#6b6b6b]"
              >
                {proj}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Summary KPI bar ──────────────────────────────────────────────────────────

function SummaryKPIs({ analyses }: { analyses: BuyLeaseAnalysis[] }) {
  const totalMonthlyRental = analyses
    .filter((a) => a.currentStatus === 'rented')
    .reduce((sum, a) => sum + a.monthlyRentalCostBRL, 0)

  const projectedAnnualSavings = analyses.reduce((sum, a) => {
    if (a.recommendation === 'buy')   return sum + (a.annualRentalCostBRL - a.annualOwnershipCostBRL)
    if (a.recommendation === 'lease') return sum + (a.annualOwnershipCostBRL - a.annualRentalCostBRL)
    return sum
  }, 0)

  const buyCount     = analyses.filter((a) => a.recommendation === 'buy').length
  const leaseCount   = analyses.filter((a) => a.recommendation === 'lease').length
  const neutralCount = analyses.filter((a) => a.recommendation === 'neutral').length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        {
          label: 'Gasto Mensal em Aluguel',
          value: totalMonthlyRental > 0 ? `R$${(totalMonthlyRental / 1000).toFixed(0)}k` : '—',
          color: '#ef4444',
        },
        {
          label: 'Economia Anual Projetada',
          value: projectedAnnualSavings > 0 ? `R$${(projectedAnnualSavings / 1000).toFixed(0)}k` : '—',
          color: '#22c55e',
        },
        {
          label: 'Recomendação Comprar',
          value: String(buyCount),
          color: '#22c55e',
        },
        {
          label: 'Recomendação Alugar',
          value: String(leaseCount + neutralCount),
          color: '#3b82f6',
        },
      ].map((kpi) => (
        <div
          key={kpi.label}
          className="bg-[#222222] border border-[#2a2a2a] rounded-xl px-4 py-3"
        >
          <p className="text-[#6b6b6b] text-xs">{kpi.label}</p>
          <p className="text-lg font-bold leading-tight mt-0.5" style={{ color: kpi.color }}>
            {kpi.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function BuyLeasePanel() {
  const { buyLeaseAnalyses, runBuyLeaseEngine } = useOtimizacaoFrotaStore(
    useShallow((s) => ({ buyLeaseAnalyses: s.buyLeaseAnalyses, runBuyLeaseEngine: s.runBuyLeaseEngine }))
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#f5f5f5] text-sm font-semibold">
            Análise Comprar vs Alugar — BIM 5D
          </p>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            Decisão financeira baseada na demanda projetada da carteira de projetos
          </p>
        </div>
        <button
          onClick={runBuyLeaseEngine}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#3a3a3a] text-[#f5f5f5] text-xs font-medium hover:bg-[#252525] transition-colors shrink-0"
        >
          <RefreshCw size={13} /> Rodar Engine
        </button>
      </div>

      {/* Summary KPIs */}
      {buyLeaseAnalyses.length > 0 && <SummaryKPIs analyses={buyLeaseAnalyses} />}

      {/* Analysis cards */}
      {buyLeaseAnalyses.length === 0 ? (
        <div className="bg-[#222222] border border-[#2a2a2a] rounded-xl p-6 text-center">
          <p className="text-[#6b6b6b] text-sm">
            Clique em "Rodar Engine" para calcular a análise financeira.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {buyLeaseAnalyses.map((a) => (
            <BuyLeaseCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  )
}
