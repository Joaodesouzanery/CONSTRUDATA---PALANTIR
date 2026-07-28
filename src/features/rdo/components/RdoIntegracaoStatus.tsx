/**
 * RdoIntegracaoStatus — prova, por RDO, do que ele realmente alimentou nos outros
 * módulos (a "camada única"). Respeita o gate `isRdoFinalized`: rascunho não alimenta
 * nada. Para RDO finalizado mostra, com números reais:
 *  • Financeiro  — lançamentos com sourceRdoId (estado local, prova forte)
 *  • Mão de Obra — apontamentos com sourceRdoId (estado local; gerados no fluxo Compizzo)
 *  • Estoque     — LEITURA AO VIVO das baixas no Supabase por rdo_id (o cliente descarta
 *                  esse vínculo); fallback "previsto (offline)" a partir dos materiais
 *  • Planejamento— vínculo (planningActivityId/operationalKey/trecho) + estado atual;
 *                  o Planejamento é agregado (só guarda lastRdoDate), então rotulamos
 *                  como vínculo/estado, sem afirmar o delta exato deste RDO.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DollarSign, Users, Boxes, GanttChartSquare, Lock, CheckCircle2,
  Loader2, AlertTriangle, WifiOff, Link2, Network,
} from 'lucide-react'
import { isRdoFinalized } from '@/store/rdoStore'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { fetchRdoEstoqueMovimentos, type RdoEstoqueMov } from '../utils/rdoEstoqueMovimentos'
import { Row, Empty } from './detailPrimitives'
import { parseLocaleNumber } from '@/lib/numberFormat'
import type { RDO } from '@/types'

const brl = (n?: number) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type EstoqueState = { status: 'loading' | 'ok' | 'error' | 'offline'; movs: RdoEstoqueMov[] }

function ModuleBlock({ icon, title, tone, headline, children }: {
  icon: ReactNode; title: string; tone: 'on' | 'off' | 'warn' | 'info'; headline: ReactNode; children?: ReactNode
}) {
  const dot = tone === 'on' ? 'text-emerald-400' : tone === 'warn' ? 'text-amber-400' : tone === 'info' ? 'text-sky-400' : 'text-[#6b6b6b]'
  return (
    <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={dot}>{icon}</span>
        <span className="text-sm font-semibold text-[#e5e5e5]">{title}</span>
        <span className="ml-auto text-xs text-[#a3a3a3] text-right">{headline}</span>
      </div>
      {children && <div className="space-y-1 pl-6">{children}</div>}
    </div>
  )
}

export function RdoIntegracaoStatus({ rdo }: { rdo: RDO }) {
  const finalized = isRdoFinalized(rdo)

  // Hooks SEMPRE chamados (antes de qualquer return condicional).
  const entries = useFinanceiroStore((s) => s.entries)
  const timecards = useMaoDeObraStore((s) => s.timecards)
  const activities = usePlanejamentoMestreStore((s) => s.activities)
  const trechos = usePlanejamentoStore((s) => s.trechos)
  const estoqueItens = useSuprimentosStore((s) => s.estoqueItens)
  // lastSyncedAt distingue "de fato R$ 0" de "store ainda não sincronizada neste
  // dispositivo" — sem isso o painel afirmaria falso-zero em tablet offline/novo.
  const finSynced = useFinanceiroStore((s) => s.lastSyncedAt)
  const moSynced = useMaoDeObraStore((s) => s.lastSyncedAt)

  const fin = useMemo(() => entries.filter((e) => e.sourceRdoId === rdo.id), [entries, rdo.id])
  const tcs = useMemo(() => timecards.filter((t) => t.sourceRdoId === rdo.id), [timecards, rdo.id])

  const planej = useMemo(() => {
    const actIds = new Set<string>()
    const opKeys = new Set<string>()
    rdo.services.forEach((s) => { if (s.planningActivityId) actIds.add(s.planningActivityId); if (s.operationalKey) opKeys.add(s.operationalKey) })
    if (rdo.compizzo?.planningActivityId) actIds.add(rdo.compizzo.planningActivityId)
    rdo.compizzo?.producao?.forEach((p) => { if (p.planningActivityId) actIds.add(p.planningActivityId) })
    const matchedAct = activities.filter((a) => actIds.has(a.id) || (a.operationalKey ? opKeys.has(a.operationalKey) : false))
    const codes = new Set(rdo.trechos.map((t) => t.trechoCode).filter(Boolean))
    const matchedTre = trechos.filter((t) => codes.has(t.code))
    return { matchedAct, matchedTre, hasLink: actIds.size > 0 || opKeys.size > 0 || codes.size > 0 }
  }, [activities, trechos, rdo])

  // Materiais que DEVERIAM dar baixa (fallback quando offline/erro).
  const intent = useMemo(() => {
    if (rdo.compizzo) {
      return (rdo.compizzo.materiais ?? [])
        .filter((m) => m.stockItemId && parseLocaleNumber(m.quantidade) > 0)
        .map((m) => ({ label: m.material || '—', qty: parseLocaleNumber(m.quantidade) }))
    }
    return (rdo.materials ?? [])
      .filter((m) => m.stockItemId && m.source === 'almoxarifado' && (Number(m.quantity) || 0) > 0)
      .map((m) => ({ label: m.material, qty: Number(m.quantity) || 0 }))
  }, [rdo])

  // Leitura ao vivo do Estoque (só se finalizado e online). Init lazy define o
  // estado inicial (offline/loading) sem setState síncrono dentro do efeito; o
  // efeito só chama setState em callback assíncrono (evita cascading renders).
  const [estoque, setEstoque] = useState<EstoqueState>(() => ({
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'loading',
    movs: [],
  }))
  useEffect(() => {
    if (!finalized) return
    let cancelled = false
    const fetchNow = () => {
      fetchRdoEstoqueMovimentos(rdo.id)
        .then((movs) => { if (!cancelled) setEstoque({ status: 'ok', movs }) })
        .catch(() => { if (!cancelled) setEstoque({ status: 'error', movs: [] }) })
    }
    // Reconectou? refaz a leitura (não fica preso em "offline — previsto").
    const onOnline = () => { if (!cancelled) { setEstoque({ status: 'loading', movs: [] }); fetchNow() } }
    // Init lazy já marcou 'loading' (online) ou 'offline' — sem setState síncrono aqui.
    if (typeof navigator === 'undefined' || navigator.onLine) fetchNow()
    window.addEventListener('online', onOnline)
    return () => { cancelled = true; window.removeEventListener('online', onOnline) }
  }, [finalized, rdo.id])

  // ── Rascunho: não alimenta nada ──────────────────────────────────────────
  if (!finalized) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.06] p-4">
        <div className="flex items-center gap-2 text-amber-300">
          <Lock size={16} />
          <span className="text-sm font-semibold">Rascunho — não alimenta nenhum módulo</span>
        </div>
        <p className="mt-1.5 text-xs text-[#a3a3a3] pl-6">
          Enquanto estiver em rascunho, este RDO não lança custos no Financeiro, não baixa Estoque,
          não gera apontamentos de Mão de Obra nem move o Planejamento. Use <strong>Finalizar</strong> para integrar.
        </p>
      </div>
    )
  }

  const itemName = (id: string) => estoqueItens.find((i) => i.id === id)?.descricao ?? `Item ${id.slice(0, 8)}`
  const finTotal = fin.reduce((s, e) => s + (e.valor || 0), 0)
  const tcHoras = tcs.reduce((s, t) => s + (t.hoursWorked || 0), 0)
  const tcCusto = tcs.reduce((s, t) => s + (t.laborCostBRL || 0), 0)
  // Planejamento agregado: se a store não está carregada neste dispositivo, não dá
  // para distinguir "sem vínculo" de "não carregado" — o texto abaixo diferencia.
  const planejLoaded = activities.length > 0 || trechos.length > 0
  const finLoaded = fin.length > 0 || !!finSynced
  const moLoaded = tcs.length > 0 || !!moSynced

  return (
    <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
      <div className="flex items-center gap-2 mb-1">
        <Network size={16} className="text-[#f97316]" />
        <h3 className="text-[#f5f5f5] font-semibold text-sm">Status de Integração</h3>
      </div>
      <p className="text-[11px] text-[#6b6b6b] mb-3">O que este RDO finalizado gerou nos outros módulos.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">

        {/* Financeiro */}
        <ModuleBlock
          icon={<DollarSign size={15} />}
          title="Financeiro"
          tone={fin.length > 0 ? 'on' : finLoaded ? 'off' : 'warn'}
          headline={fin.length > 0
            ? <span className="text-emerald-400 font-semibold">{brl(finTotal)} lançado</span>
            : finLoaded ? 'sem custo lançado' : <span className="text-amber-400">não carregado</span>}
        >
          {fin.length > 0
            ? fin.map((e) => <Row key={e.id} left={e.descricao} right={brl(e.valor)} tone="text-[#f97316]" />)
            : finLoaded
              ? <Empty>Nenhum custo (materiais/mão de obra deram R$ 0 neste RDO).</Empty>
              : <Empty>Financeiro ainda não sincronizado neste dispositivo — abra o módulo Financeiro para conferir.</Empty>}
        </ModuleBlock>

        {/* Mão de Obra */}
        <ModuleBlock
          icon={<Users size={15} />}
          title="Mão de Obra"
          tone={tcs.length > 0 ? 'on' : moLoaded ? 'off' : 'warn'}
          headline={tcs.length > 0
            ? <span className="text-emerald-400 font-semibold">{tcs.length} apontamento(s) · {tcHoras.toFixed(1)}h</span>
            : moLoaded ? 'sem apontamentos' : <span className="text-amber-400">não carregado</span>}
        >
          {tcs.length > 0
            ? <Row left={`${tcs.length} funcionário(s) · ${tcHoras.toFixed(1)}h`} right={brl(tcCusto)} tone="text-[#f97316]" />
            : moLoaded
              ? <Empty>Apontamentos são gerados pelo fluxo Compizzo; um RDO padrão pode lançar só o custo de MO no Financeiro.</Empty>
              : <Empty>Mão de Obra ainda não sincronizada neste dispositivo — abra o módulo para conferir.</Empty>}
        </ModuleBlock>

        {/* Estoque — leitura ao vivo */}
        <ModuleBlock
          icon={estoque.status === 'loading' ? <Loader2 size={15} className="animate-spin" /> : <Boxes size={15} />}
          title="Estoque"
          tone={estoque.status === 'ok' ? (estoque.movs.length > 0 ? 'on' : 'off') : estoque.status === 'loading' ? 'info' : 'warn'}
          headline={
            estoque.status === 'loading' ? 'verificando…'
              : estoque.status === 'ok' ? (estoque.movs.length > 0
                ? <span className="text-emerald-400 font-semibold">{estoque.movs.length} baixa(s)</span>
                : 'nenhuma baixa')
              : estoque.status === 'offline' ? <span className="text-amber-400">offline — previsto</span>
              : <span className="text-amber-400">não consultado</span>
          }
        >
          {estoque.status === 'ok' && estoque.movs.length > 0 && (
            estoque.movs.map((m) => <Row key={m.id} left={itemName(m.itemId)} right={`${m.quantidade.toLocaleString('pt-BR')} baixado`} tone="text-[#f97316]" />)
          )}
          {estoque.status === 'ok' && estoque.movs.length === 0 && (
            intent.length > 0
              ? <Empty>Materiais previstos ({intent.length}) mas ainda sem baixa — pode ser sincronização pendente, ou material fora do <em>almoxarifado</em>.</Empty>
              : <Empty>Este RDO não tem material de almoxarifado para baixar.</Empty>
          )}
          {(estoque.status === 'offline' || estoque.status === 'error') && (
            <>
              {estoque.status === 'error' && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400 mb-1"><AlertTriangle size={12} /> Não foi possível consultar o servidor.</div>
              )}
              {estoque.status === 'offline' && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400 mb-1"><WifiOff size={12} /> Sem conexão — mostrando o previsto.</div>
              )}
              {intent.length > 0
                ? intent.map((it, i) => <Row key={i} left={it.label} right={`${it.qty.toLocaleString('pt-BR')} previsto`} tone="text-[#a3a3a3]" />)
                : <Empty>Sem material de almoxarifado previsto para baixa.</Empty>}
            </>
          )}
        </ModuleBlock>

        {/* Planejamento */}
        <ModuleBlock
          icon={<GanttChartSquare size={15} />}
          title="Planejamento"
          tone={planej.matchedAct.length + planej.matchedTre.length > 0 ? 'info' : 'off'}
          headline={planej.matchedAct.length + planej.matchedTre.length > 0
            ? <span className="text-sky-400 font-semibold">{planej.matchedAct.length + planej.matchedTre.length} vínculo(s)</span>
            : (planej.hasLink ? 'vínculo sem correspondência' : 'sem vínculo')}
        >
          {planej.matchedAct.map((a) => (
            <Row
              key={a.id}
              left={<span className="inline-flex items-center gap-1"><Link2 size={11} className="text-[#6b6b6b]" />{a.name}{a.lastRdoDate === rdo.date && <CheckCircle2 size={11} className="text-emerald-400" />}</span>}
              right={`${typeof a.executedQuantity === 'number' ? a.executedQuantity.toLocaleString('pt-BR') : Math.round(a.percentComplete)}${typeof a.executedQuantity === 'number' ? (a.unidade ?? '') : '%'}`}
            />
          ))}
          {planej.matchedTre.map((t) => (
            <Row
              key={t.id}
              left={<span className="inline-flex items-center gap-1"><Link2 size={11} className="text-[#6b6b6b] " />Trecho {t.code}{t.lastRdoDate === rdo.date && <CheckCircle2 size={11} className="text-emerald-400" />}</span>}
              right={`${(t.executedMeters ?? 0).toFixed(1)} / ${t.lengthM.toFixed(1)} m`}
            />
          ))}
          {planej.matchedAct.length + planej.matchedTre.length === 0 && (
            <Empty>{!planej.hasLink
              ? 'Este RDO não vincula serviços/trechos a atividades do Planejamento.'
              : planejLoaded
                ? 'Este RDO referencia atividades/trechos que não estão no Planejamento atual.'
                : 'Abra o módulo Planejamento neste dispositivo para conferir os vínculos.'}</Empty>
          )}
          {planej.matchedAct.length + planej.matchedTre.length > 0 && (
            <p className="text-[10px] text-[#6b6b6b] italic pt-0.5">
              Estado atual das atividades vinculadas (agregado). <CheckCircle2 size={9} className="inline text-emerald-400" /> = última data de RDO bate com esta.
            </p>
          )}
        </ModuleBlock>
      </div>
    </div>
  )
}
