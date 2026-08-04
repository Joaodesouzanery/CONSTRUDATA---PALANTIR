/**
 * PainelSindicoPanel — "Painel do Síndico" (Tela 4). Seis números honestos, cada um
 * CLICÁVEL abrindo embaixo a lista dos registros que o compõem (KPI → evidência), sem
 * gráfico sofisticado. Escopado à obra ativa (um prédio = uma obra). Só lê os stores.
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, ClipboardList, DollarSign, FileWarning, ShieldCheck, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useManutencoesStore } from '@/store/manutencoesStore'
import { useLaudosStore } from '@/store/laudosStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { laudoDiasRestantes, laudoStatus } from '../utils/laudos'
import type { PredialTab } from '../tabs'

const fmtBRL = (n: number) => 'R$ ' + (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtBRLk = (n: number) => (Math.abs(n) >= 1000 ? 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'k' : fmtBRL(n))
const STATUS_LABEL: Record<string, string> = { pendente: 'Pendente', em_processo: 'Em processo', em_verificacao: 'Em verificação', concluida: 'Concluída', cancelada: 'Cancelada' }
type DrillKey = 'abertos' | 'prazo' | 'custo' | 'preventivas' | 'laudos' | 'ativos'

export function PainelSindicoPanel({ onNavigate }: { onNavigate: (tab: PredialTab) => void }) {
  const orgId = useAuth((s) => s.profile?.organization_id ?? null)
  const ensureManut = useManutencoesStore((s) => s.ensureTenantScope)
  const pullManut = useManutencoesStore((s) => s.pull)
  const ensureLaudos = useLaudosStore((s) => s.ensureTenantScope)
  const pullLaudos = useLaudosStore((s) => s.pull)
  const pullTorre = useTorreStore((s) => s.pull)
  const allWorkOrders = useManutencoesStore((s) => s.workOrders)
  const allPlans = useManutencoesStore((s) => s.plans)
  const allAssets = useManutencoesStore((s) => s.assets)
  const allLaudos = useLaudosStore((s) => s.laudos)
  const sites = useTorreStore((s) => s.sites)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)

  useEffect(() => {
    if (!orgId) return
    ensureManut(orgId); void pullManut()
    ensureLaudos(orgId); void pullLaudos()
    void pullTorre()
  }, [orgId, ensureManut, pullManut, ensureLaudos, pullLaudos, pullTorre])

  const [drill, setDrill] = useState<DrillKey | null>(null)
  // Escopo pela obra ativa (null = todas as obras). Inline em cada useMemo p/ deps corretas.
  const wo = useMemo(() => (activeObraId ? allWorkOrders.filter((x) => (x.constructionSiteId ?? null) === activeObraId) : allWorkOrders), [allWorkOrders, activeObraId])
  const plans = useMemo(() => (activeObraId ? allPlans.filter((x) => (x.constructionSiteId ?? null) === activeObraId) : allPlans), [allPlans, activeObraId])
  const assets = useMemo(() => (activeObraId ? allAssets.filter((x) => (x.constructionSiteId ?? null) === activeObraId) : allAssets), [allAssets, activeObraId])
  const laudos = useMemo(() => (activeObraId ? allLaudos.filter((x) => (x.constructionSiteId ?? null) === activeObraId) : allLaudos), [allLaudos, activeObraId])

  const k = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const mesAtual = today.slice(0, 7)
    const now = new Date()
    const limite12m = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().slice(0, 7)

    const abertos = wo.filter((w) => w.status !== 'concluida' && w.status !== 'cancelada')
    const fechadosMes = wo.filter((w) => w.status === 'concluida' && (w.completedAt || '').slice(0, 7) === mesAtual)
    const comPrazo = fechadosMes.filter((w) => !!w.dueDate)
    const noPrazo = comPrazo.filter((w) => (w.completedAt || '').slice(0, 10) <= w.dueDate)
    const pctPrazo = comPrazo.length ? Math.round((noPrazo.length / comPrazo.length) * 100) : null
    const custoMes = fechadosMes.reduce((s, w) => s + (w.actualCost || 0), 0)

    const site = activeObraId ? sites.find((s) => s.id === activeObraId) : null
    const area = activeObraId ? (site?.totalArea || 0) : sites.reduce((s, x) => s + (x.totalArea || 0), 0)
    const custoM2 = area > 0 ? custoMes / area : null

    const planosAtivos = plans.filter((p) => p.active && p.frequency !== 'unica')
    const emDia = planosAtivos.filter((p) => !!p.nextDueDate && p.nextDueDate >= today)
    const pctPrev = planosAtivos.length ? Math.round((emDia.length / planosAtivos.length) * 100) : null

    const laudos90 = laudos.filter((l) => { const d = laudoDiasRestantes(l.validade); return d != null && d <= 90 })
      .sort((a, b) => (a.validade ?? '9999').localeCompare(b.validade ?? '9999'))

    // Custo por ativo: rateia o custo da OS entre os ativos vinculados (não conta cheio em
    // cada) — assim os valores dos ativos somam o gasto real, sem inflar.
    const custoPorAtivo = assets
      .map((a) => ({ a, custo: wo.filter((w) => w.status === 'concluida' && w.assetIds?.includes(a.id) && (w.completedAt || '').slice(0, 7) >= limite12m).reduce((s, w) => s + (w.actualCost || 0) / Math.max(1, w.assetIds?.length || 1), 0) }))
      .filter((x) => x.custo > 0)
      .sort((x, y) => y.custo - x.custo)

    return { today, abertos, fechadosMes, comPrazo, noPrazo, pctPrazo, custoMes, custoM2, area, planosAtivos, emDia, pctPrev, laudos90, top: custoPorAtivo.slice(0, 3) }
  }, [wo, plans, assets, laudos, sites, activeObraId])

  const toggle = (key: DrillKey) => setDrill((cur) => (cur === key ? null : key))

  return (
    <div className="space-y-5 overflow-auto p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Painel do Síndico</h1>
        <p className="mt-1 text-sm text-[#a3a3a3]">Seis números do mês. Clique em qualquer um para ver os registros que o compõem.{!activeObraId && ' (todas as obras — selecione uma no topo para um prédio específico.)'}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi icon={<ClipboardList size={18} className="text-cyan-400" />} label="Chamados abertos" value={String(k.abertos.length)} sub={`${k.fechadosMes.length} fechados no mês`} tone="text-cyan-400" active={drill === 'abertos'} onClick={() => toggle('abertos')} />
        <Kpi icon={<CheckCircle2 size={18} className="text-emerald-400" />} label="No prazo (mês)" value={k.pctPrazo != null ? `${k.pctPrazo}%` : '—'} sub={`${k.noPrazo.length}/${k.comPrazo.length} OS no prazo`} tone="text-emerald-400" active={drill === 'prazo'} onClick={() => toggle('prazo')} />
        <Kpi icon={<DollarSign size={18} className="text-[#f97316]" />} label="Custo realizado (mês)" value={fmtBRLk(k.custoMes)} sub={k.custoM2 != null ? `${fmtBRL(k.custoM2)}/m² · OS concluídas` : 'OS concluídas no mês'} tone="text-[#f97316]" active={drill === 'custo'} onClick={() => toggle('custo')} />
        <Kpi icon={<ShieldCheck size={18} className="text-sky-400" />} label="Preventivas em dia" value={k.pctPrev != null ? `${k.pctPrev}%` : '—'} sub={`${k.emDia.length}/${k.planosAtivos.length} planos ativos`} tone="text-sky-400" active={drill === 'preventivas'} onClick={() => toggle('preventivas')} />
        <Kpi icon={<FileWarning size={18} className="text-amber-400" />} label="Laudos vencendo (90d)" value={String(k.laudos90.length)} sub="inclui vencidos" tone="text-amber-400" active={drill === 'laudos'} onClick={() => toggle('laudos')} />
        <Kpi icon={<TrendingUp size={18} className="text-red-400" />} label="Ativo que + custou (12m)" value={k.top[0] ? (k.top[0].a.name || k.top[0].a.code) : '—'} sub={k.top[0] ? fmtBRLk(k.top[0].custo) : 'sem custo lançado'} tone="text-red-300" small active={drill === 'ativos'} onClick={() => toggle('ativos')} />
      </div>

      {drill === 'abertos' && (
        <Drill title={`Chamados abertos (${k.abertos.length})`} onOpen={() => onNavigate('manutencoes')} empty={k.abertos.length === 0 && 'Nenhum chamado aberto.'}>
          {[...k.abertos].sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).map((w) => (
            <Row key={w.id} left={w.title || w.code} sub={`${w.code} · ${STATUS_LABEL[w.status] ?? w.status}`} right={w.dueDate || '—'} rightClass={w.dueDate && w.dueDate < k.today ? 'text-red-400 font-semibold' : 'text-[#a3a3a3]'} />
          ))}
        </Drill>
      )}
      {drill === 'prazo' && (
        <Drill title={`OS concluídas no mês (${k.fechadosMes.length})`} onOpen={() => onNavigate('manutencoes')} empty={k.fechadosMes.length === 0 && 'Nenhuma OS concluída neste mês.'}>
          {k.fechadosMes.map((w) => {
            const noPrazo = !!w.dueDate && (w.completedAt || '').slice(0, 10) <= w.dueDate
            return <Row key={w.id} left={w.title || w.code} sub={`${w.code} · concluída ${(w.completedAt || '').slice(0, 10)}`} right={!w.dueDate ? 'sem prazo' : noPrazo ? 'No prazo' : 'Atrasada'} rightClass={!w.dueDate ? 'text-[#737373]' : noPrazo ? 'text-emerald-400' : 'text-red-400 font-semibold'} />
          })}
        </Drill>
      )}
      {drill === 'custo' && (
        <Drill title={`Custo do mês — ${fmtBRL(k.custoMes)}${k.custoM2 != null ? ` · ${fmtBRL(k.custoM2)}/m²` : ''}`} onOpen={() => onNavigate('capex')} empty={k.fechadosMes.length === 0 && 'Sem custos lançados neste mês.'}>
          {[...k.fechadosMes].sort((a, b) => (b.actualCost || 0) - (a.actualCost || 0)).map((w) => (
            <Row key={w.id} left={w.title || w.code} sub={w.code} right={fmtBRL(w.actualCost || 0)} rightClass="text-[#f97316] font-mono" />
          ))}
        </Drill>
      )}
      {drill === 'preventivas' && (
        <Drill title={`Planos preventivos ativos (${k.planosAtivos.length})`} onOpen={() => onNavigate('manutencoes')} empty={k.planosAtivos.length === 0 && 'Nenhum plano preventivo ativo.'}>
          {[...k.planosAtivos].sort((a, b) => (a.nextDueDate || '9999').localeCompare(b.nextDueDate || '9999')).map((p) => {
            const emDia = !!p.nextDueDate && p.nextDueDate >= k.today
            return <Row key={p.id} left={p.title} sub={`${p.code || 'plano'} · ${p.nextDueDate || 'sem data'}`} right={!p.nextDueDate ? 'Sem data' : emDia ? 'Em dia' : 'Vencido'} rightClass={!p.nextDueDate ? 'text-[#737373]' : emDia ? 'text-emerald-400' : 'text-red-400 font-semibold'} />
          })}
        </Drill>
      )}
      {drill === 'laudos' && (
        <Drill title={`Laudos vencendo em 90 dias (${k.laudos90.length})`} onOpen={() => onNavigate('laudos')} empty={k.laudos90.length === 0 && 'Nenhum laudo vencendo em 90 dias.'}>
          {k.laudos90.map((l) => { const st = laudoStatus(l.validade); return (
            <Row key={l.id} left={l.tipo} sub={`${l.titulo ? l.titulo + ' · ' : ''}validade ${l.validade ? new Date(l.validade + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}`} right={st.label} rightClass={st.cor === 'vermelho' ? 'text-red-400 font-semibold' : st.cor === 'amarelo' ? 'text-amber-400' : 'text-[#a3a3a3]'} />
          )})}
        </Drill>
      )}
      {drill === 'ativos' && (
        <Drill title="Ativos que mais custaram (12 meses)" onOpen={() => onNavigate('capex')} empty={k.top.length === 0 && 'Sem custo de manutenção lançado por ativo.'}>
          {k.top.map(({ a, custo }, i) => (
            <Row key={a.id} left={`${i + 1}. ${a.name || a.code}`} sub={`${a.sistema ?? a.type}${a.location ? ' · ' + a.location : ''}`} right={fmtBRL(custo)} rightClass="text-red-300 font-mono" />
          ))}
        </Drill>
      )}
    </div>
  )
}

function Kpi({ icon, label, value, sub, tone, active, small, onClick }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: string; active?: boolean; small?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('rounded-xl border bg-[#3d3d3d] p-4 text-left transition-colors', active ? 'border-[#f97316]' : 'border-[#525252] hover:border-[#f97316]/50')}>
      <div className="mb-2 flex items-center gap-2">{icon}<p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p></div>
      <p className={cn('font-bold tabular-nums', small ? 'truncate text-lg' : 'text-2xl', tone || 'text-white')}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#6b6b6b]">{sub}</p>}
    </button>
  )
}

function Drill({ title, onOpen, empty, children }: { title: string; onOpen: () => void; empty?: string | false; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">{title}</p>
        <button onClick={onOpen} className="flex items-center gap-1 text-[11px] text-[#f97316] hover:text-[#fb923c]">abrir aba <ArrowRight size={12} /></button>
      </div>
      {empty ? <p className="py-5 text-center text-xs text-[#6b6b6b]">{empty}</p> : <div className="max-h-80 divide-y divide-[#525252]/40 overflow-y-auto">{children}</div>}
    </div>
  )
}

function Row({ left, sub, right, rightClass }: { left: string; sub?: string; right: string; rightClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm text-white">{left}</p>
        {sub && <p className="truncate text-[10px] text-[#6b6b6b]">{sub}</p>}
      </div>
      <p className={cn('shrink-0 text-right text-xs tabular-nums', rightClass || 'text-[#a3a3a3]')}>{right}</p>
    </div>
  )
}
