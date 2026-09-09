/**
 * PrevistoRealizadoPanel — visão única "Previsto × Realizado" do Compizzo, por obra.
 * Cruza o Plano de Execução (previsto) com os RDOs Compizzo finalizados (realizado) e
 * o avanço das atividades do Planejamento Mestre. Reaproveita o motor de cálculo de
 * planoExecucao (m²/ritmo/RUP/faturamento) — a mesma fonte da aba Execução.
 */
import { useMemo } from 'react'
import { Building2, Target, TrendingUp, Gauge, CalendarClock, DollarSign, Users, PackageSearch } from 'lucide-react'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { usePlanoExecucaoStore } from '@/store/planoExecucaoStore'
import { useRdoStore } from '@/store/rdoStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useStoreSync } from '@/lib/useStoreSync'
import { custoDiaWorker } from '@/features/mao-de-obra/utils/custoMaoObra'
import { planejadoVsExecutado, faturamento, custoTotalEstimado, ritmoDiarioMeta, TCPO_RUP_PADRAO, fmtBRL } from '@/features/planejamento/utils/planoExecucao'

const num = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-5 text-sm text-[#a3a3a3]">{children}</div>
    </div>
  )
}

function Kpi({ icon, label, prev, real, sub, tone }: { icon: React.ReactNode; label: string; prev: string; real: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#6b6b6b]">{icon}{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className={`text-lg font-bold tabular-nums ${tone ?? 'text-[#f5f5f5]'}`}>{real}</span>
        <span className="text-[11px] text-[#6b6b6b]">/ {prev}</span>
      </div>
      {sub && <p className="mt-0.5 text-[10px] text-[#6b6b6b]">{sub}</p>}
    </div>
  )
}

export function PrevistoRealizadoPanel() {
  useStoreSync(usePlanoExecucaoStore)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const sites = useTorreStore((s) => s.sites)
  const planos = usePlanoExecucaoStore((s) => s.planos)
  const rdos = useRdoStore((s) => s.rdos)
  const activities = usePlanejamentoMestreStore((s) => s.activities)
  const workers = useMaoDeObraStore((s) => s.workers)
  const cltSettings = useMaoDeObraStore((s) => s.cltSettings)
  const reservas = useSuprimentosStore((s) => s.reservas)
  const estoqueItens = useSuprimentosStore((s) => s.estoqueItens)

  const site = activeObraId ? sites.find((s) => s.id === activeObraId) ?? null : null
  const plano = useMemo(() => {
    const list = planos.filter((p) => (p.siteId ?? null) === activeObraId)
    return list.find((p) => p.status === 'ativo')
      ?? [...list].sort((a, b) => (b.periodoInicio || '').localeCompare(a.periodoInicio || ''))[0]
      ?? null
  }, [planos, activeObraId])

  const obraActs = useMemo(
    () => activities.filter((a) => (a.obraId ?? null) === activeObraId && a.level >= 1 && !a.isMilestone),
    [activities, activeObraId],
  )

  const pxe = useMemo(() => (plano ? planejadoVsExecutado(plano, rdos) : null), [plano, rdos])

  if (!activeObraId) return <Aviso>Selecione uma obra no seletor de obras (topo) para ver o Previsto × Realizado dela.</Aviso>
  if (!plano || !pxe) {
    return (
      <Aviso>
        <span className="inline-flex items-center gap-2 font-semibold text-[#f5f5f5]"><Building2 size={14} className="text-[#f97316]" /> {site?.name ?? 'Obra selecionada'}</span>
        <p className="mt-2">Cadastre o <strong>Plano de Execução</strong> desta obra (Planejamento → aba Execução) para comparar previsto × realizado com todas as variáveis.</p>
      </Aviso>
    )
  }

  const fatPrev = faturamento(plano)
  const fatReal = pxe.m2Executado * (plano.precoM2 || 0)
  const custoMoPrev = custoTotalEstimado(plano)
  const custoMoReal = plano.equipe.reduce((s, m) => {
    const w = m.workerId ? workers.find((x) => x.id === m.workerId) : undefined
    return s + (m.diasTrabalhados?.length ?? 0) * (w ? custoDiaWorker(w, { settings: cltSettings }) : 0)
  }, 0)
  const ritmoMeta = ritmoDiarioMeta(plano)

  // Material: consumido (RDOs Compizzo da obra no período) × reservado (Suprimentos).
  const rdosObra = rdos.filter((r) =>
    r.template === 'compizzo' && (r.siteId ?? null) === activeObraId
    && (!plano.periodoInicio || r.date >= plano.periodoInicio)
    && (!plano.periodoFim || r.date <= plano.periodoFim))
  const materialConsumidoBRL = rdosObra.reduce((s, r) => s + (r.materials ?? []).reduce((ss, m) => ss + (m.totalCostBRL ?? 0), 0), 0)
  const reservasObra = reservas.filter((r) => (r.siteId ?? estoqueItens.find((i) => i.id === r.itemId)?.siteId ?? null) === activeObraId)

  const rupTone = pxe.rupReal > 0 ? (pxe.rupReal > TCPO_RUP_PADRAO ? 'text-[#ef4444]' : 'text-[#22c55e]') : 'text-[#f5f5f5]'
  const ritmoTone = pxe.ritmoReal > 0 ? (pxe.ritmoReal >= ritmoMeta ? 'text-[#22c55e]' : 'text-[#fdba74]') : 'text-[#f5f5f5]'

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]/15"><TrendingUp size={18} className="text-[#f97316]" /></div>
        <div>
          <h2 className="text-[#f5f5f5] font-semibold text-base flex items-center gap-2"><Building2 size={15} className="text-[#f97316]" /> {site?.name ?? plano.obraNome}</h2>
          <p className="text-[#6b6b6b] text-xs">Previsto × Realizado · período {plano.periodoInicio || '—'} a {plano.periodoFim || '—'} · {pxe.diasComRdo} dia(s) com RDO</p>
        </div>
      </div>

      {/* KPIs previsto × realizado */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi icon={<Target size={11} className="mr-1" />} label="m² (real / previsto)" real={num(pxe.m2Executado)} prev={num(pxe.m2Planejado)} sub={`${pxe.progressoPct.toFixed(0)}% concluído`} tone="text-[#f97316]" />
        <Kpi icon={<Gauge size={11} className="mr-1" />} label="Ritmo m²/dia (real / meta)" real={num(pxe.ritmoReal)} prev={num(ritmoMeta)} tone={ritmoTone} />
        <Kpi icon={<Gauge size={11} className="mr-1" />} label="RUP HH/m² (real / TCPO)" real={pxe.rupReal > 0 ? pxe.rupReal.toFixed(2) : '—'} prev={TCPO_RUP_PADRAO.toFixed(2)} tone={rupTone} />
        <Kpi icon={<CalendarClock size={11} className="mr-1" />} label="Projeção conclusão" real={pxe.projecaoConclusaoDias > 0 ? `${pxe.projecaoConclusaoDias} d` : '—'} prev={`${num(Math.max(0, pxe.m2Planejado - pxe.m2Executado))} m² rest.`} />
        <Kpi icon={<DollarSign size={11} className="mr-1" />} label="Faturamento (real / previsto)" real={fmtBRL(fatReal)} prev={fmtBRL(fatPrev)} tone="text-[#22c55e]" />
        <Kpi icon={<Users size={11} className="mr-1" />} label="Custo M.O. (real / previsto)" real={fmtBRL(custoMoReal)} prev={fmtBRL(custoMoPrev)} tone={custoMoReal > custoMoPrev && custoMoPrev > 0 ? 'text-[#ef4444]' : 'text-[#f5f5f5]'} />
      </div>

      {/* % avanço por atividade do Planejamento */}
      <div className="rounded-xl border border-[#525252] bg-[#333] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#525252] bg-[#2c2c2c]">
          <h3 className="text-sm font-bold text-[#f5f5f5]">Avanço por atividade (Planejamento)</h3>
          <p className="text-[11px] text-[#a3a3a3]">Executado acumulado dos RDOs vinculados vs. quantidade prevista de cada atividade.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[620px]">
            <thead>
              <tr className="border-b border-[#525252] bg-[#2c2c2c] text-[10px] uppercase tracking-wider text-[#6b6b6b]">
                <th className="text-left px-3 py-2">Atividade</th>
                <th className="text-right px-3 py-2">Previsto</th>
                <th className="text-right px-3 py-2">Realizado</th>
                <th className="text-right px-3 py-2">% Concl.</th>
                <th className="text-left px-3 py-2">Último RDO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#484848]">
              {obraActs.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-[#6b6b6b]">Sem atividades no Planejamento desta obra.</td></tr>
              )}
              {obraActs.map((a) => {
                const pct = Math.round(a.percentComplete ?? 0)
                const tone = pct >= 100 ? 'text-[#22c55e]' : pct > 0 ? 'text-[#f97316]' : 'text-[#6b6b6b]'
                return (
                  <tr key={a.id} className="hover:bg-[#3d3d3d]">
                    <td className="px-3 py-2 text-[#f5f5f5]"><span className="text-[#6b6b6b] mr-1">{a.wbsCode}</span>{a.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#c9c9c9]">{a.plannedQuantity ? num(a.plannedQuantity) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[#c9c9c9]">{a.executedQuantity ? num(a.executedQuantity) : '—'}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${tone}`}>{pct}%</td>
                    <td className="px-3 py-2 text-[#a3a3a3]">{a.lastRdoDate ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Material previsto × consumido */}
      <div className="rounded-xl border border-[#525252] bg-[#333] p-4">
        <h3 className="text-sm font-bold text-[#f5f5f5] flex items-center gap-2 mb-2"><PackageSearch size={15} className="text-[#f97316]" /> Material (Suprimentos)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div><p className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">Consumido (RDOs, R$)</p><p className="text-[#f5f5f5] font-semibold tabular-nums">{fmtBRL(materialConsumidoBRL)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">RDOs no período</p><p className="text-[#f5f5f5] font-semibold tabular-nums">{rdosObra.length}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-[#6b6b6b]">Reservas ativas</p><p className="text-[#f5f5f5] font-semibold tabular-nums">{reservasObra.length}</p></div>
        </div>
        <p className="mt-2 text-[10px] text-[#6b6b6b]">Consumo dá baixa automática no estoque ao finalizar cada RDO. Reservas e previsão de demanda são geridas no módulo Suprimentos.</p>
      </div>
    </div>
  )
}
