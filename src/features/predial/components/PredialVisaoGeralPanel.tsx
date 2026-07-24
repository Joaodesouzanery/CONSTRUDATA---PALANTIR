/**
 * PredialVisaoGeralPanel — "control tower" do Predial (sem agentes de IA): KPIs com
 * mini-tendência, cartão de valor (custo/capex/economia), gráficos (OS por status,
 * custo de manutenção mensal) e listas de status. Só LÊ os stores existentes
 * (manutenções, gestão de equipamentos, otimização de frota) — não altera dados.
 */
import { useMemo } from 'react'
import { AlertTriangle, Wrench, ClipboardList, Activity, DollarSign, ArrowRight, HeartPulse, PiggyBank, TrendingUp } from 'lucide-react'
import { useManutencoesStore } from '@/store/manutencoesStore'
import { useGestaoEquipamentosStore } from '@/store/gestaoEquipamentosStore'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { Donut, LineChart, Sparkline, type Slice } from './charts'
import type { PredialTab } from '../tabs'
import type { MaintenanceWorkOrder } from '@/store/manutencoesStore'

const VIDA_UTIL_ANOS = 5
function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtBRLk(n: number) {
  if (Math.abs(n) >= 1000) return 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k'
  return fmtBRL(n)
}
function woMonth(w: MaintenanceWorkOrder) { return (w.completedAt || w.scheduledDate || w.createdAt || '').slice(0, 7) }
function woCost(w: MaintenanceWorkOrder) { return w.actualCost || 0 }
function mesLabel(ym: string) {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  const [y, mo] = ym.split('-')
  return `${meses[Math.max(0, Math.min(11, Number(mo) - 1))]}/${(y ?? '').slice(2)}`
}

const STATUS_META: { key: string; label: string; color: string }[] = [
  { key: 'pendente',       label: 'Pendente',       color: '#f59e0b' },
  { key: 'em_processo',    label: 'Em processo',    color: '#38bdf8' },
  { key: 'em_verificacao', label: 'Em verificação', color: '#a78bfa' },
  { key: 'concluida',      label: 'Concluída',      color: '#22c55e' },
  { key: 'cancelada',      label: 'Cancelada',      color: '#6b7280' },
]

export function PredialVisaoGeralPanel({ onNavigate }: { onNavigate: (tab: PredialTab) => void }) {
  const workOrders = useManutencoesStore((s) => s.workOrders)
  const assets = useManutencoesStore((s) => s.assets)
  const orders = useGestaoEquipamentosStore((s) => s.orders)
  const healthScores = useOtimizacaoFrotaStore((s) => s.healthScores)

  const today = new Date().toISOString().slice(0, 10)
  const mesAtual = today.slice(0, 7)
  const now = new Date()
  const limite12m = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 7)

  const m = useMemo(() => {
    const abertas = workOrders.filter((w) => w.status !== 'concluida' && w.status !== 'cancelada')
    const vencidas = abertas.filter((w) => w.dueDate && w.dueDate < today)
    const custoManutMes = workOrders.filter((w) => woMonth(w) === mesAtual).reduce((s, w) => s + woCost(w), 0)
    const custoEquipMes = orders.filter((o) => (o.scheduledDate ?? '').slice(0, 7) === mesAtual).reduce((s, o) => s + (o.actualCost || 0), 0)
    const ativosCriticos = assets.filter((a) => a.criticality === 'critica')
    const saudeCritica = healthScores.filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high')
    const equipEmManut = orders.filter((o) => o.status === 'scheduled' || o.status === 'in_progress')
    return { abertas, vencidas, custoMes: custoManutMes + custoEquipMes, ativosCriticos, saudeCritica, equipEmManut }
  }, [workOrders, assets, orders, healthScores, today, mesAtual])

  // Custo de manutenção mensal (últimos ~12 meses com dados) — linha + sparkline do KPI.
  const custoMensal = useMemo(() => {
    const map = new Map<string, number>()
    for (const w of workOrders) { const k = woMonth(w); if (k) map.set(k, (map.get(k) ?? 0) + woCost(w)) }
    for (const o of orders) { const k = (o.scheduledDate ?? '').slice(0, 7); if (k) map.set(k, (map.get(k) ?? 0) + (o.actualCost || 0)) }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([month, valor]) => ({ month, valor }))
  }, [workOrders, orders])

  // OS por status (donut).
  const porStatus = useMemo<Slice[]>(
    () => STATUS_META.map((s) => ({ label: s.label, color: s.color, value: workOrders.filter((w) => w.status === s.key).length })).filter((s) => s.value > 0),
    [workOrders],
  )

  // Cartão de valor: custo (12m), capex em análise e economia estimada (substituir × reparar).
  const valor = useMemo(() => {
    let custoAno = 0, capexEmAnalise = 0, economia = 0
    for (const a of assets) {
      const os = workOrders.filter((w) => w.assetIds?.includes(a.id))
      const repair12m = os.filter((w) => woMonth(w) >= limite12m).reduce((s, w) => s + woCost(w), 0)
      const replacement = a.replacementCostBRL ?? Math.round((repair12m * 3) / 100) * 100
      const econ = repair12m - replacement / VIDA_UTIL_ANOS
      if (econ > 0) { capexEmAnalise += replacement; economia += econ }
    }
    custoAno = workOrders.filter((w) => woMonth(w) >= limite12m).reduce((s, w) => s + woCost(w), 0)
      + orders.filter((o) => (o.scheduledDate ?? '').slice(0, 7) >= limite12m).reduce((s, o) => s + (o.actualCost || 0), 0)
    return { custoAno, capexEmAnalise, economia }
  }, [assets, workOrders, orders, limite12m])

  const proximasOS = useMemo(
    () => [...m.abertas].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).slice(0, 6),
    [m.abertas],
  )
  const custoSpark = custoMensal.map((c) => c.valor)

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi icon={<ClipboardList size={18} className="text-cyan-400" />} label="OS abertas" value={String(m.abertas.length)} tone="text-cyan-400" onClick={() => onNavigate('manutencoes')} />
        <Kpi icon={<AlertTriangle size={18} className="text-red-400" />} label="OS vencidas" value={String(m.vencidas.length)} tone="text-red-400" onClick={() => onNavigate('manutencoes')} />
        <Kpi icon={<DollarSign size={18} className="text-[#f97316]" />} label="Custo manut. (mês)" value={fmtBRLk(m.custoMes)} tone="text-[#f97316]" spark={custoSpark} onClick={() => onNavigate('capex')} />
        <Kpi icon={<HeartPulse size={18} className="text-amber-400" />} label="Saúde crítica" value={String(m.saudeCritica.length)} tone="text-amber-400" onClick={() => onNavigate('saude')} />
        <Kpi icon={<Wrench size={18} className="text-emerald-400" />} label="Equip. em manut." value={String(m.equipEmManut.length)} tone="text-emerald-400" onClick={() => onNavigate('equipamentos')} />
      </div>

      {/* Cartão de valor */}
      <div className="rounded-xl border border-[#525252] bg-gradient-to-br from-[#3d3d3d] to-[#333333] p-5">
        <div className="flex items-center gap-2 mb-3">
          <PiggyBank size={16} className="text-emerald-400" />
          <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">Valor — manutenção &amp; ativos (12 meses)</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ValueCell label="Custo de manutenção" value={fmtBRLk(valor.custoAno)} tone="#ef4444" />
          <ValueCell label="Capex em análise" value={fmtBRLk(valor.capexEmAnalise)} tone="#38bdf8" sub="ativos onde substituir compensa" />
          <ValueCell label="Economia estimada / ano" value={fmtBRLk(valor.economia)} tone="#22c55e" icon={<TrendingUp size={14} className="text-emerald-400" />} sub="trocando os ativos indicados" />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="OS por status" action={{ label: 'Ver OS', onClick: () => onNavigate('manutencoes') }}>
          {porStatus.length === 0 ? <Empty>Sem ordens de serviço.</Empty> : <Donut data={porStatus} centerLabel="OS" />}
        </Card>
        <Card title="Custo de manutenção mensal" action={{ label: 'Ver CapEx', onClick: () => onNavigate('capex') }}>
          <LineChart points={custoMensal.map((c) => ({ label: mesLabel(c.month), value: c.valor }))} color="#ef4444" />
        </Card>
      </div>

      {/* Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Ordens de serviço — próximas e atrasadas" action={{ label: 'Ver todas', onClick: () => onNavigate('manutencoes') }}>
          {proximasOS.length === 0 ? <Empty>Sem ordens de serviço abertas.</Empty> : (
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

        <Card title="Ativos com risco de saúde" action={{ label: 'Ver preditiva', onClick: () => onNavigate('saude') }}>
          {m.saudeCritica.length === 0 ? <Empty>Nenhum ativo em risco alto/crítico.</Empty> : (
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
  return (STATUS_META.find((x) => x.key === s)?.label) ?? s
}
function priorityLabel(p: string): string {
  return ({ baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' } as Record<string, string>)[p] ?? p
}

function Kpi({ icon, label, value, tone, spark, onClick }: { icon: React.ReactNode; label: string; value: string; tone?: string; spark?: number[]; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="text-left bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 hover:border-[#f97316]/50 transition-colors">
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p></div>
      <div className="flex items-end justify-between gap-2">
        <p className={`text-xl font-bold tabular-nums ${tone || 'text-white'}`}>{value}</p>
        {spark && spark.length > 1 && <Sparkline values={spark} color="#f97316" />}
      </div>
    </button>
  )
}

function ValueCell({ label, value, tone, sub, icon }: { label: string; value: string; tone: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-1">{icon}<p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p></div>
      <p className="text-lg font-bold font-mono" style={{ color: tone }}>{value}</p>
      {sub && <p className="text-[10px] text-[#6b6b6b] mt-0.5">{sub}</p>}
    </div>
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
