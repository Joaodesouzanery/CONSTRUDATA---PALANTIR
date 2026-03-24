import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Wrench, Cpu, ArrowRight,
  HardHat, Radio,
} from 'lucide-react'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useGestao360Store } from '@/store/gestao360Store'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useShallow } from 'zustand/react/shallow'
import { ModuleQuickLinks } from '@/components/shared/ModuleQuickLinks'

// ─── Feed item type ────────────────────────────────────────────────────────────

interface FeedItem {
  id:       string
  severity: 'critical' | 'high' | 'medium' | 'low'
  module:   string
  icon:     React.ElementType
  title:    string
  detail:   string
  link:     string
  date:     string
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
const SEVERITY_COLOR = {
  critical: '#ef4444',
  high:     '#2abfdc',
  medium:   '#eab308',
  low:      '#22c55e',
}
const SEVERITY_LABEL = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  low:      'Baixo',
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function CommandCenterPanel() {
  const { healthScores, routingRecs } = useOtimizacaoFrotaStore(
    useShallow((s) => ({ healthScores: s.healthScores, routingRecs: s.routingRecs }))
  )
  const sites = useTorreStore((s) => s.sites)
  const changeOrders = useGestao360Store((s) => s.changeOrders)
  const maintenanceOrders = useGestaoEquipamentosStore((s) => s.orders)

  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = []

    // ─ Equipment health alerts (critical / high)
    healthScores
      .filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high')
      .forEach((h) => {
        items.push({
          id:       `health-${h.equipmentId}`,
          severity: h.riskLevel,
          module:   'Frota',
          icon:     Cpu,
          title:    `${h.equipmentCode} — Saúde ${h.healthScore}/100`,
          detail:   `${h.predictedFailureWindow} · ${h.recommendedAction}`,
          link:     '/otimizacao-frota',
          date:     new Date().toISOString(),
        })
      })

    // ─ Critical routing pending
    routingRecs
      .filter((r) => r.accepted === undefined && r.priority === 'critical')
      .forEach((r) => {
        items.push({
          id:       `route-${r.id}`,
          severity: 'high',
          module:   'Frota',
          icon:     Cpu,
          title:    `${r.equipmentCode} — Realocação pendente`,
          detail:   `${r.fromSiteName} → ${r.toSiteName} · +${r.utilizationGainPct}% utilização`,
          link:     '/otimizacao-frota',
          date:     r.suggestedDate + 'T00:00:00Z',
        })
      })

    // ─ Active critical / high risks in construction sites
    sites.forEach((site) => {
      site.risks
        .filter((r) => r.status === 'active' && (r.level === 'critical' || r.level === 'high'))
        .forEach((r) => {
          items.push({
            id:       `risk-${r.id}`,
            severity: r.level,
            module:   'Torre de Controle',
            icon:     Radio,
            title:    `${site.code} — ${r.title}`,
            detail:   r.description.slice(0, 90) + (r.description.length > 90 ? '…' : ''),
            link:     '/torre-de-controle',
            date:     r.identifiedAt,
          })
        })
    })

    // ─ Submitted change orders awaiting approval
    changeOrders
      .filter((co) => co.status === 'submitted')
      .forEach((co) => {
        items.push({
          id:       `co-${co.id}`,
          severity: co.impactCostBRL > 50_000 ? 'high' : 'medium',
          module:   'Gestão 360',
          icon:     HardHat,
          title:    `OM: ${co.title}`,
          detail:   `+R$${(co.impactCostBRL / 1000).toFixed(0)}k · ${co.impactDays > 0 ? `+${co.impactDays}d` : `${co.impactDays}d`} · Aguardando aprovação`,
          link:     '/gestao-360',
          date:     co.submittedAt,
        })
      })

    // ─ Overdue maintenance orders
    const today = new Date()
    maintenanceOrders
      .filter((o) => {
        if (o.status === 'completed' || o.status === 'cancelled') return false
        const scheduled = new Date(o.scheduledDate + 'T00:00:00')
        return scheduled < today
      })
      .forEach((o) => {
        items.push({
          id:       `maint-${o.id}`,
          severity: 'high',
          module:   'Gest. Equip.',
          icon:     Wrench,
          title:    `Manutenção vencida — ${o.id}`,
          detail:   `Tipo: ${o.type} · Responsável: ${o.responsible}`,
          link:     '/gestao-equipamentos',
          date:     o.scheduledDate + 'T00:00:00Z',
        })
      })

    // Sort: severity first, then date descending
    return items.sort((a, b) => {
      const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      if (sevDiff !== 0) return sevDiff
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [healthScores, routingRecs, sites, changeOrders, maintenanceOrders])

  return (
    <div className="flex flex-col gap-5">
      {/* Feed header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#f5f5f5] text-sm font-semibold">
            Centro de Comando — Feed Unificado
          </p>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            {feed.length} ocorrência{feed.length !== 1 ? 's' : ''} ativa{feed.length !== 1 ? 's' : ''} em todos os módulos
          </p>
        </div>
        {/* Severity summary chips */}
        <div className="flex gap-2">
          {(['critical', 'high', 'medium'] as const).map((sev) => {
            const count = feed.filter((f) => f.severity === sev).length
            if (count === 0) return null
            return (
              <span
                key={sev}
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{ backgroundColor: `${SEVERITY_COLOR[sev]}18`, color: SEVERITY_COLOR[sev] }}
              >
                {SEVERITY_LABEL[sev]}: {count}
              </span>
            )
          })}
        </div>
      </div>

      {/* Feed list */}
      {feed.length === 0 ? (
        <div className="bg-[#112240] border border-[#1c3658] rounded-xl p-8 text-center">
          <p className="text-[#22c55e] text-sm font-semibold mb-1">Tudo sob controle!</p>
          <p className="text-[#6b6b6b] text-xs">Nenhuma ocorrência crítica ou pendente em todos os módulos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {feed.map((item) => {
            const Icon = item.icon
            const color = SEVERITY_COLOR[item.severity]
            return (
              <div
                key={item.id}
                className="bg-[#112240] border border-[#1c3658] rounded-xl p-3 flex items-start gap-3"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon size={15} style={{ color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0"
                      style={{ backgroundColor: `${color}18`, color }}
                    >
                      {SEVERITY_LABEL[item.severity]}
                    </span>
                    <span className="text-[#6b6b6b] text-[10px] shrink-0">{item.module}</span>
                  </div>
                  <p className="text-[#f5f5f5] text-xs font-semibold">{item.title}</p>
                  <p className="text-[#6b6b6b] text-[11px] mt-0.5 leading-relaxed">{item.detail}</p>
                </div>

                <Link
                  to={item.link}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg shrink-0 text-[#6b6b6b] text-[10px] font-semibold border border-[#1c3658] hover:border-[#2abfdc]/50 hover:text-[#2abfdc] transition-colors"
                >
                  Ver módulo <ArrowRight size={10} />
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/* Module quick links */}
      <div className="bg-[#112240] border border-[#1c3658] rounded-xl p-4">
        <ModuleQuickLinks exclude={['/gestao-360']} />
      </div>
    </div>
  )
}
