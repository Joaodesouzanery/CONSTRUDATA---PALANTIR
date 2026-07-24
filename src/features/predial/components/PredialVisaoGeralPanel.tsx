/**
 * PredialVisaoGeralPanel — "control tower" do Predial (sem agentes de IA): cards de
 * métricas + listas de status de manutenção/ativos/saúde. Só lê os stores existentes
 * (manutenções, gestão de equipamentos, otimização de frota) — não altera dados.
 */
import { useMemo } from 'react'
import { AlertTriangle, Wrench, ClipboardList, Activity, DollarSign, ArrowRight, HeartPulse } from 'lucide-react'
import { useManutencoesStore } from '@/store/manutencoesStore'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import type { PredialTab } from '../tabs'

function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtBRLk(n: number) {
  if (Math.abs(n) >= 1000) return 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k'
  return fmtBRL(n)
}

export function PredialVisaoGeralPanel({ onNavigate }: { onNavigate: (tab: PredialTab) => void }) {
  const workOrders = useManutencoesStore((s) => s.workOrders)
  const assets = useManutencoesStore((s) => s.assets)
  const orders = useGestaoEquipamentosStore((s) => s.orders)
  const healthScores = useOtimizacaoFrotaStore((s) => s.healthScores)

  const today = new Date().toISOString().slice(0, 10)
  const mesAtual = today.slice(0, 7)

  const m = useMemo(() => {
    const abertas = workOrders.filter((w) => w.status !== 'concluida' && w.status !== 'cancelada')
    const vencidas = abertas.filter((w) => w.dueDate && w.dueDate < today)
    const custoManutMes = workOrders
      .filter((w) => (w.completedAt ?? w.scheduledDate ?? '').slice(0, 7) === mesAtual)
      .reduce((s, w) => s + (w.actualCost || 0), 0)
    const custoEquipMes = orders
      .filter((o) => (o.scheduledDate ?? '').slice(0, 7) === mesAtual)
      .reduce((s, o) => s + (o.actualCost || 0), 0)
    const ativosCriticos = assets.filter((a) => a.criticality === 'critica')
    const saudeCritica = healthScores.filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high')
    const equipEmManut = orders.filter((o) => o.status === 'scheduled' || o.status === 'in_progress')
    return { abertas, vencidas, custoMes: custoManutMes + custoEquipMes, ativosCriticos, saudeCritica, equipEmManut }
  }, [workOrders, assets, orders, healthScores, today, mesAtual])

  const proximasOS = useMemo(
    () => [...m.abertas].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).slice(0, 6),
    [m.abertas],
  )

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi icon={<ClipboardList size={18} className="text-cyan-400" />} label="OS abertas" value={String(m.abertas.length)} tone="text-cyan-400" onClick={() => onNavigate('manutencoes')} />
        <Kpi icon={<AlertTriangle size={18} className="text-red-400" />} label="OS vencidas" value={String(m.vencidas.length)} tone="text-red-400" onClick={() => onNavigate('manutencoes')} />
        <Kpi icon={<DollarSign size={18} className="text-[#f97316]" />} label="Custo manut. (mês)" value={fmtBRLk(m.custoMes)} tone="text-[#f97316]" onClick={() => onNavigate('capex')} />
        <Kpi icon={<HeartPulse size={18} className="text-amber-400" />} label="Saúde crítica" value={String(m.saudeCritica.length)} tone="text-amber-400" onClick={() => onNavigate('saude')} />
        <Kpi icon={<Wrench size={18} className="text-emerald-400" />} label="Equip. em manut." value={String(m.equipEmManut.length)} tone="text-emerald-400" onClick={() => onNavigate('equipamentos')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximas / atrasadas OS */}
        <Card title="Ordens de serviço — próximas e atrasadas" action={{ label: 'Ver todas', onClick: () => onNavigate('manutencoes') }}>
          {proximasOS.length === 0 ? (
            <Empty>Sem ordens de serviço abertas.</Empty>
          ) : (
            <div className="divide-y divide-[#525252]/40">
              {proximasOS.map((w) => {
                const atrasada = w.dueDate && w.dueDate < today
                return (
                  <div key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{w.title || w.code}</p>
                      <p className="text-[10px] text-[#6b6b6b]">{w.code} · {statusLabel(w.status)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs tabular-nums ${atrasada ? 'text-red-400 font-semibold' : 'text-[#a3a3a3]'}`}>{w.dueDate || '—'}</p>
                      <p className="text-[10px] text-[#6b6b6b]">{priorityLabel(w.priority)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Saúde crítica / preditiva */}
        <Card title="Ativos com risco de saúde" action={{ label: 'Ver preditiva', onClick: () => onNavigate('saude') }}>
          {m.saudeCritica.length === 0 ? (
            <Empty>Nenhum ativo em risco alto/crítico.</Empty>
          ) : (
            <div className="divide-y divide-[#525252]/40">
              {m.saudeCritica.slice(0, 6).map((h) => (
                <div key={h.equipmentId ?? h.equipmentName} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{h.equipmentName}</p>
                    <p className="text-[10px] text-[#6b6b6b] truncate">{h.recommendedAction}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-semibold ${h.riskLevel === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>{h.riskLevel === 'critical' ? 'Crítico' : 'Alto'} · {Math.round(h.healthScore)}%</p>
                    <p className="text-[10px] text-[#6b6b6b] tabular-nums">reparo ~{fmtBRLk(h.estimatedRepairCostBRL)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Ativos críticos */}
      {m.ativosCriticos.length > 0 && (
        <Card title={`Ativos críticos (${m.ativosCriticos.length})`} action={{ label: 'Ver ativos', onClick: () => onNavigate('manutencoes') }}>
          <div className="flex flex-wrap gap-2">
            {m.ativosCriticos.slice(0, 20).map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-red-500/10 text-red-300 border border-red-400/30">
                <Activity size={11} /> {a.name || a.code}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function statusLabel(s: string): string {
  return ({ pendente: 'Pendente', em_processo: 'Em processo', em_verificacao: 'Em verificação', concluida: 'Concluída', cancelada: 'Cancelada' } as Record<string, string>)[s] ?? s
}
function priorityLabel(p: string): string {
  return ({ baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' } as Record<string, string>)[p] ?? p
}

function Kpi({ icon, label, value, tone, onClick }: { icon: React.ReactNode; label: string; value: string; tone?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="text-left bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 hover:border-[#f97316]/50 transition-colors">
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p></div>
      <p className={`text-xl font-bold tabular-nums ${tone || 'text-white'}`}>{value}</p>
    </button>
  )
}

function Card({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">{title}</p>
        {action && (
          <button onClick={action.onClick} className="flex items-center gap-1 text-[11px] text-[#f97316] hover:text-[#fb923c]">
            {action.label} <ArrowRight size={12} />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[#6b6b6b] text-xs py-6 text-center">{children}</p>
}
