/**
 * Projetado × Realizado — o FCP contra o Controle de Caixa, com total e por obra.
 *
 * ─── O QUE ESTA TELA NÃO FAZ, DE PROPÓSITO ────────────────────────────────────
 * - Não rateia o projetado da cidade entre obras. O FCP projeta por CIDADE; com duas obras na
 *   mesma, a linha da cidade tem o número e as obras dizem por que não têm.
 * - Não soma obra sem vínculo no total. Ela aparece à parte, com o realizado — para o dinheiro não
 *   sumir — e a instrução de onde vincular.
 * - Não põe semáforo no mês. Só no acumulado: o mês isolado tem ruído estrutural (custo lançado em
 *   M+1, "01 A 10" rateado, mês corrente parcial).
 *
 * Toda conta está em `projetadoRealizado.ts` e `indicadoresFinanceiro.ts` — puros e testados. Aqui
 * é só leitura de store e layout.
 */
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useFcpStore } from '@/store/fcpStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useRdoStore } from '@/store/rdoStore'
import { useDiasSemProducaoStore } from '@/store/diasSemProducaoStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { hojeLocalISO } from '@/lib/utils'
import { fmtBRL } from '@/features/financeiro/lib/financeiroCalc'
import { presetDePeriodo } from '@/features/financeiro/lib/financeiroCalc'
import { SubTabHost } from '@/components/shared/SubTabHost'
import { OQueE } from '@/components/shared/OQueE'
import type { Explicacao } from '@/components/shared/explicacao'
import {
  planoDaObra, compararProjetadoRealizado, tomDaAderencia, realizadoPorSemana,
  type Comparacao, type LinhaComparada, type TomAderencia,
} from '../utils/fcp/projetadoRealizado'
import { fluxoSemanal } from '../utils/fcp/motor'
import type { ProducaoRealizada } from '../utils/fcp/motor'
import { montarIndicadoresFinanceiro, type IndicadorFinanceiro, type TomFinanceiro } from '../utils/indicadoresFinanceiro'
import { vinculosDeObra } from '@/features/rdo/utils/wcrParaFcp'

const TOM: Record<TomFinanceiro | TomAderencia, { valor: string; borda: string; fundo: string; rotulo: string }> = {
  ok:         { valor: 'text-[#4ade80]', borda: 'border-[#525252]',    fundo: 'bg-[#333333]',        rotulo: 'ok' },
  atencao:    { valor: 'text-[#fbbf24]', borda: 'border-[#eab308]/40', fundo: 'bg-[#eab308]/[0.06]', rotulo: 'atenção' },
  grave:      { valor: 'text-[#fca5a5]', borda: 'border-[#ef4444]/40', fundo: 'bg-[#ef4444]/[0.06]', rotulo: 'grave' },
  'sem-dado': { valor: 'text-[#a3a3a3]', borda: 'border-[#525252]',    fundo: 'bg-[#2c2c2c]',        rotulo: 'sem base' },
  neutro:     { valor: 'text-[#f5f5f5]', borda: 'border-[#525252]',    fundo: 'bg-[#333333]',        rotulo: '' },
}

const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)
const brlOuTraco = (n: number | null) => (n === null ? '—' : fmtBRL(n))

const EXPLICA: Record<'despesa' | 'receita' | 'aderencia', Explicacao> = {
  despesa: {
    oQueE: 'O que o FCP previu sair do caixa da EMPRESA no período, contra o que de fato saiu pelo Controle de Caixa.',
    deOndeVem: 'Projetado: "sai do caixa" do FCP Mensal, só das cidades vinculadas às obras. O que o consórcio banca não passa por aqui. Realizado: saídas do Controle de Caixa das mesmas obras, com períodos "01 A 10" rateados por dia.',
  },
  receita: {
    oQueE: 'O que o FCP previu entrar (recebimento da medição) contra o que o cliente pagou de verdade.',
    deOndeVem: 'Projetado: "recebimento" do FCP Mensal. Realizado: notas marcadas como recebidas no contrato da obra, pela data do recebimento — ou, se o contrato não tem notas, as entradas de medição do Controle de Caixa.',
  },
  aderencia: {
    oQueE: 'Realizado dividido por projetado, no acumulado do período. Perto de 100% é a obra andando como planejado. Gastar bem MENOS também é aviso: a causa mais comum é caixa incompleto, não economia.',
    deOndeVem: 'Só no acumulado — o mês isolado tem ruído: a folha de um mês é paga no seguinte, e o mês corrente ainda está andando.',
  },
}

export function ProjetadoRealizadoPanel() {
  const planos = useFcpStore((s) => s.planos)
  const sites = useTorreStore((s) => s.sites)
  const entries = useFinanceiroStore((s) => s.entries)
  const rdos = useRdoStore((s) => s.rdos)
  const diasSemProducao = useDiasSemProducaoStore((s) => s.dias)
  const { feriados, jornada } = usePlanejamentoStore(useShallow((s) => ({ feriados: s.holidays, jornada: s.scheduleConfig.workWeekMode })))
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const hoje = hojeLocalISO()

  const [periodo, setPeriodo] = useState<{ from?: string; to?: string }>(() => presetDePeriodo('tudo'))
  const [planoEscolhido, setPlanoEscolhido] = useState<string | null>(null)

  const escolha = useMemo(() => planoDaObra(planos, activeObraId), [planos, activeObraId])
  const plano = (planoEscolhido ? planos.find((p) => p.id === planoEscolhido) : null) ?? escolha.plano
  const obraIds = useMemo(() => (activeObraId ? [activeObraId] : undefined), [activeObraId])

  const comparacao = useMemo(
    () => (plano ? compararProjetadoRealizado({ plano, sites, entries, obraIds, periodo, hoje }) : null),
    [plano, sites, entries, obraIds, periodo, hoje],
  )
  const indicadores = useMemo(
    () => montarIndicadoresFinanceiro({ plano, sites, entries, rdos, diasSemProducao, feriados, jornada, hoje, periodo, obraIds }),
    [plano, sites, entries, rdos, diasSemProducao, feriados, jornada, hoje, periodo, obraIds],
  )

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-[#f5f5f5]">Projetado × Realizado</p>
        {escolha.motivo === 'ambiguo' && (
          <select
            value={plano?.id ?? ''} onChange={(e) => setPlanoEscolhido(e.target.value || null)}
            className="rounded border border-[#525252] bg-[#3a3a3a] px-2 py-1 text-[11px] text-[#f5f5f5]"
          >
            <option value="">escolha o plano…</option>
            {planos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        )}
        {plano && <span className="text-[11px] text-[#6b6b6b]">plano: {plano.nome}{escolha.motivo === 'unico' ? ' (o único da empresa)' : ''}</span>}
        <div className="ml-auto flex items-center gap-1.5">
          {(['mes', 'ano', '12m', 'tudo'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setPeriodo(presetDePeriodo(k))}
              className="rounded border border-[#525252] px-2 py-1 text-[10px] uppercase text-[#a3a3a3] hover:border-[#f97316]/60 hover:text-[#f5f5f5]">
              {k}
            </button>
          ))}
          <input type="date" value={periodo.from ?? ''} onChange={(e) => setPeriodo((p) => ({ ...p, from: e.target.value || undefined }))}
            className="rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-[11px] text-[#f5f5f5]" />
          <input type="date" value={periodo.to ?? ''} onChange={(e) => setPeriodo((p) => ({ ...p, to: e.target.value || undefined }))}
            className="rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-[11px] text-[#f5f5f5]" />
        </div>
      </div>

      <p className="text-[11px] leading-5 text-[#a3a3a3]">
        Compara o que o FCP previu sair e entrar do caixa da <b className="text-[#d4d4d4]">empresa</b> com o
        Controle de Caixa. O que o consórcio banca não passa por aqui. A régua é o mês.
      </p>

      {!plano ? (
        <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] p-4 text-[11px] leading-5 text-[#d4d4d4]">
          {escolha.motivo === 'sem-plano'
            ? 'Nenhum plano de Fluxo de Caixa Projetado importado. Importe a planilha na aba ao lado.'
            : `Há ${'candidatos' in escolha ? escolha.candidatos : planos.length} planos e nenhum é da obra ativa. Escolha um acima, ou informe a obra do plano ao importar.`}
        </div>
      ) : (
        <SubTabHost tabs={[
          { key: 'mes',         label: 'Por mês',      render: () => comparacao && <PorMes c={comparacao} /> },
          { key: 'obra',        label: 'Por obra',     render: () => comparacao && <PorObra c={comparacao} /> },
          { key: 'semana',      label: 'Por semana',   render: () => <PorSemana plano={plano} sites={sites} entries={entries} obraIds={obraIds} /> },
          { key: 'indicadores', label: 'Indicadores',  render: () => <Indicadores lista={indicadores} /> },
        ]} />
      )}
    </div>
  )
}

// ─── Cards do acumulado ───────────────────────────────────────────────────────

function Card({ titulo, explicacao, valor, sub, tom }: { titulo: string; explicacao: Explicacao; valor: string; sub: string; tom: TomAderencia | 'neutro' }) {
  return (
    <div className={`rounded-xl border p-3.5 ${TOM[tom].borda} ${TOM[tom].fundo}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">{titulo}</p>
        <OQueE titulo={titulo} explicacao={explicacao} />
      </div>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${TOM[tom].valor}`}>{valor}</p>
      <p className="mt-1 text-[11px] leading-4 text-[#d4d4d4]">{sub}</p>
    </div>
  )
}

function Cards({ c }: { c: Comparacao }) {
  const d = c.total.despesas, r = c.total.receitas
  const tomD = tomDaAderencia(d.aderencia, 'despesa'), tomR = tomDaAderencia(r.aderencia, 'receita')
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card titulo="Despesa · projetado × realizado" explicacao={EXPLICA.despesa}
        valor={`${brlOuTraco(d.projetado)} / ${brlOuTraco(d.realizado)}`} sub={`diferença ${brlOuTraco(d.diferenca)}${d.parcial ? ' · mês corrente parcial' : ''}`} tom="neutro" />
      <Card titulo="Aderência da despesa" explicacao={EXPLICA.aderencia}
        valor={pct(d.aderencia)} sub={tomD === 'atencao' && (d.aderencia ?? 1) < 0.75 ? 'gastou menos que o previsto — confira se o caixa está completo' : TOM[tomD].rotulo} tom={tomD} />
      <Card titulo="Receita · projetado × realizado" explicacao={EXPLICA.receita}
        valor={`${brlOuTraco(r.projetado)} / ${brlOuTraco(r.realizado)}`}
        sub={`${c.fonteDaReceita === 'contrato' ? 'pelas notas do contrato' : 'pelo Controle de Caixa (contrato sem notas)'}${c.notasRecebidasSemData ? ` · ${c.notasRecebidasSemData} recebida(s) sem data` : ''}`} tom="neutro" />
      <Card titulo="Aderência da receita" explicacao={EXPLICA.aderencia} valor={pct(r.aderencia)} sub={TOM[tomR].rotulo} tom={tomR} />
    </div>
  )
}

const TH = 'px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[#a3a3a3]'
const TD = 'px-3 py-2 text-[11px]'
const NUM = 'px-3 py-2 text-right text-[11px] tabular-nums'

function Tabela({ titulo, linhas }: { titulo: string; linhas: LinhaComparada[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-[#a3a3a3]">{titulo}</p>
      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className="w-full min-w-max">
          <thead><tr className="bg-[#1f1f1f]">
            <th className={TH}>Mês</th><th className={`${TH} text-right`}>Projetado</th><th className={`${TH} text-right`}>Realizado</th>
            <th className={`${TH} text-right`}>Diferença</th><th className={`${TH} text-right`}>%</th>
          </tr></thead>
          <tbody className="divide-y divide-[#1f2937]">
            {linhas.map((l) => (
              <tr key={l.periodo} className="hover:bg-white/[0.02]">
                <td className={`${TD} text-[#f5f5f5]`}>{l.rotulo}{l.parcial && <span className="ml-1 text-[#6b6b6b]">(parcial)</span>}</td>
                <td className={NUM}>{brlOuTraco(l.projetado)}</td>
                <td className={`${NUM} text-[#f5f5f5]`}>{brlOuTraco(l.realizado)}</td>
                <td className={`${NUM} ${l.diferenca === null ? 'text-[#6b6b6b]' : l.diferenca > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {l.diferenca === null ? '—' : `${l.diferenca > 0 ? '+' : ''}${fmtBRL(l.diferenca)}`}
                </td>
                <td className={`${NUM} ${l.parcial ? 'text-[#6b6b6b]' : ''}`}>{pct(l.aderencia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PorMes({ c }: { c: Comparacao }) {
  const [lado, setLado] = useState<'despesas' | 'receitas'>('despesas')
  return (
    <div className="flex flex-col gap-4 pt-3">
      <Cards c={c} />
      <div className="flex gap-1.5">
        {(['despesas', 'receitas'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setLado(k)}
            className={`rounded border px-2 py-1 text-[10px] uppercase ${lado === k ? 'border-[#f97316] text-[#f5f5f5]' : 'border-[#525252] text-[#a3a3a3]'}`}>{k}</button>
        ))}
      </div>
      <Tabela titulo={`${lado === 'despesas' ? 'Despesas' : 'Receitas'} por mês`} linhas={c[lado]} />
    </div>
  )
}

function PorObra({ c }: { c: Comparacao }) {
  const [lado, setLado] = useState<'despesas' | 'receitas'>('despesas')
  return (
    <div className="flex flex-col gap-4 pt-3">
      <Cards c={c} />
      <div className="flex gap-1.5">
        {(['despesas', 'receitas'] as const).map((k) => (
          <button key={k} type="button" onClick={() => setLado(k)}
            className={`rounded border px-2 py-1 text-[10px] uppercase ${lado === k ? 'border-[#f97316] text-[#f5f5f5]' : 'border-[#525252] text-[#a3a3a3]'}`}>{k}</button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className="w-full min-w-max">
          <thead><tr className="bg-[#1f1f1f]">
            <th className={TH}>Cidade / obra</th><th className={`${TH} text-right`}>Projetado</th><th className={`${TH} text-right`}>Realizado</th>
            <th className={`${TH} text-right`}>Diferença</th><th className={`${TH} text-right`}>%</th>
          </tr></thead>
          <tbody className="divide-y divide-[#1f2937]">
            {c.porCidade.map((cid) => {
              const l = cid[lado]
              return (
                <ObraRows key={cid.cidadeId} cidade={cid} linha={l} obras={c.porObra.filter((o) => o.cidadeId === cid.cidadeId).map((o) => ({ ...o, linha: o[lado] }))} />
              )
            })}
            {c.semVinculo.length > 0 && (
              <>
                <tr className="bg-[#2c2c2c]"><td colSpan={5} className={`${TD} font-semibold text-[#a3a3a3]`}>Sem vínculo com o FCP — fora dos totais</td></tr>
                {c.semVinculo.map((o) => (
                  <tr key={o.siteId}>
                    <td className={`${TD} pl-6 text-[#d4d4d4]`}>{o.nome}
                      <span className="ml-2 text-[10px] text-[#fbbf24]">vincule a obra a uma cidade do FCP (Torre de Controle → Contrato → De-para)</span>
                    </td>
                    <td className={`${NUM} text-[#6b6b6b]`}>—</td>
                    <td className={`${NUM} text-[#f5f5f5]`}>{fmtBRL(o.realizadoSaidas)}</td>
                    <td className={`${NUM} text-[#6b6b6b]`}>—</td><td className={`${NUM} text-[#6b6b6b]`}>—</td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ObraRows({ cidade, linha, obras }: {
  cidade: Comparacao['porCidade'][number]; linha: LinhaComparada
  obras: Array<Comparacao['porObra'][number] & { linha: LinhaComparada }>
}) {
  const [aberta, setAberta] = useState(true)
  const tom = tomDaAderencia(linha.aderencia, 'despesa')
  return (
    <>
      <tr className="cursor-pointer bg-[#2c2c2c] hover:bg-white/[0.03]" onClick={() => setAberta((v) => !v)}>
        <td className={`${TD} font-semibold text-[#f5f5f5]`}>
          {aberta ? <ChevronDown size={12} className="mr-1 inline" /> : <ChevronRight size={12} className="mr-1 inline" />}
          {cidade.nome} <span className="font-normal text-[#6b6b6b]">({cidade.obras} obra{cidade.obras > 1 ? 's' : ''})</span>
        </td>
        <td className={NUM}>{brlOuTraco(linha.projetado)}</td>
        <td className={`${NUM} text-[#f5f5f5]`}>{brlOuTraco(linha.realizado)}</td>
        <td className={NUM}>{brlOuTraco(linha.diferenca)}</td>
        <td className={`${NUM} ${TOM[tom].valor}`}>{pct(linha.aderencia)}</td>
      </tr>
      {aberta && obras.map((o) => (
        <tr key={o.siteId} className="hover:bg-white/[0.02]">
          <td className={`${TD} pl-8 text-[#d4d4d4]`}>{o.nome}{o.oQueFalta && <span className="ml-2 text-[10px] text-[#6b6b6b]">ⓘ {o.oQueFalta}</span>}</td>
          <td className={`${NUM} ${o.linha.projetado === null ? 'text-[#6b6b6b]' : ''}`}>{brlOuTraco(o.linha.projetado)}</td>
          <td className={`${NUM} text-[#f5f5f5]`}>{brlOuTraco(o.linha.realizado)}</td>
          <td className={NUM}>{brlOuTraco(o.linha.diferenca)}</td>
          <td className={NUM}>{pct(o.linha.aderencia)}</td>
        </tr>
      ))}
    </>
  )
}

// ─── Por semana: detalhe, sem semáforo ────────────────────────────────────────

function PorSemana({ plano, sites, entries, obraIds }: {
  plano: NonNullable<ReturnType<typeof planoDaObra>['plano']>
  sites: ReturnType<typeof useTorreStore.getState>['sites']
  entries: ReturnType<typeof useFinanceiroStore.getState>['entries']
  obraIds?: string[]
}) {
  const p = plano.premissas
  const cidades = new Set(p.cidades.map((c) => c.id))
  const selecionadas = obraIds ? sites.filter((s) => obraIds.includes(s.id)) : sites
  const vinculos = vinculosDeObra(selecionadas).filter((v) => cidades.has(v.cidadeId))
  const cidadesUsadas = new Set(vinculos.map((v) => v.cidadeId))
  const semanas = fluxoSemanal(p, plano.realizado as ProducaoRealizada, 12)
  const real = new Map(realizadoPorSemana(entries, p, { obraIds: vinculos.map((v) => v.siteId), quantidade: 12 }).map((r) => [r.periodo, r]))
  return (
    <div className="flex flex-col gap-3 pt-3">
      <p className="rounded-lg border border-[#eab308]/40 bg-[#eab308]/[0.08] px-3 py-2 text-[11px] leading-5 text-[#d4d4d4]">
        <b className="text-[#fbbf24]">Sem semáforo aqui, de propósito.</b> O FCP lança o custo de um mês inteiro na primeira
        semana do mês seguinte, e o caixa paga espalhado. A semana serve para localizar, não para julgar.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[#525252]">
        <table className="w-full min-w-max">
          <thead><tr className="bg-[#1f1f1f]">
            <th className={TH}>Semana</th><th className={`${TH} text-right`}>Projetado (empresa)</th><th className={`${TH} text-right`}>Realizado</th><th className={`${TH} text-right`}>Diferença</th>
          </tr></thead>
          <tbody className="divide-y divide-[#1f2937]">
            {semanas.map((s) => {
              const proj = s.porCidade.filter((c) => cidadesUsadas.has(c.cidadeId)).reduce((a, c) => a + c.custosDaEmpresa + c.mobilizacao, 0)
              const r = real.get(String(s.semana.numero))
              return (
                <tr key={s.semana.numero} className="hover:bg-white/[0.02]">
                  <td className={`${TD} text-[#f5f5f5]`}>S{s.semana.numero} <span className="text-[#6b6b6b]">{s.semana.inicio.slice(5).split('-').reverse().join('/')}</span></td>
                  <td className={NUM}>{fmtBRL(proj)}</td>
                  <td className={`${NUM} text-[#f5f5f5]`}>{r ? fmtBRL(r.saidas) : '—'}</td>
                  <td className={NUM}>{r ? fmtBRL(r.saidas - proj) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Indicadores ──────────────────────────────────────────────────────────────

function Indicadores({ lista }: { lista: IndicadorFinanceiro[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 pt-3 md:grid-cols-2 xl:grid-cols-3">
      {lista.map((i) => <CartaoIndicador key={i.id} i={i} />)}
    </div>
  )
}

function CartaoIndicador({ i }: { i: IndicadorFinanceiro }) {
  const [aberto, setAberto] = useState(false)
  const tom = TOM[i.tom]
  return (
    <div className={`rounded-xl border p-3.5 ${tom.borda} ${tom.fundo}`}>
      <div className="flex items-start justify-between gap-2">
        {/* Sigla SEMPRE com a descrição: "A1 · custo por metro executado". */}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">{i.sigla} · {i.titulo}</p>
        <OQueE titulo={`${i.sigla} · ${i.titulo}`} explicacao={i.explicacao} />
      </div>
      <p className={`mt-1.5 text-xl font-bold tabular-nums ${tom.valor}`}>{i.valor}</p>
      {i.tom === 'sem-dado'
        ? <p className="mt-1 rounded border border-[#eab308]/40 bg-[#eab308]/10 px-2 py-1 text-[11px] leading-4 text-[#fbbf24]">{i.explicacao.oQueFalta}</p>
        : <p className="mt-1 text-[11px] leading-4 text-[#d4d4d4]">{i.detalhe}</p>}
      {i.serie && i.serie.length > 1 && (
        <p className="mt-1.5 text-[10px] text-[#6b6b6b]">
          {i.serie.map((s) => `${s.periodo}: ${s.valor === null ? '—' : fmtBRL(s.valor)}`).join(' · ')}
        </p>
      )}
      {i.porObra.length > 0 && (
        <>
          <button type="button" onClick={() => setAberto((v) => !v)} className="mt-2 flex items-center gap-1 text-[10px] text-[#f97316] hover:underline">
            {aberto ? <ChevronDown size={11} /> : <ChevronRight size={11} />} por obra ({i.porObra.length})
          </button>
          {aberto && (
            <ul className="mt-1 divide-y divide-[#1f2937] text-[11px]">
              {i.porObra.map((o) => (
                <li key={o.siteId} className="flex items-baseline justify-between gap-2 py-1">
                  <span className="text-[#d4d4d4]">{o.nome}{o.detalhe && <span className="ml-1 text-[#6b6b6b]">· {o.detalhe}</span>}</span>
                  <span className={`tabular-nums ${TOM[o.tom].valor}`}>{o.valor}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
