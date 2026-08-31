import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Gauge,
  RefreshCw,
  Ruler,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { useEconomiaStore } from '@/store/economiaStore'
import { useLpsStore } from '@/store/lpsStore'
import type { EconomyBaseline, EconomyEvent, EconomyEventStatus, EconomyReport, EconomySourceModule, LinhaDeBaseMedida } from '@/types'
import {
  brl,
  ECONOMY_CATEGORY_LABELS,
  ECONOMY_SOURCE_LABELS,
  ECONOMY_SOURCE_ROUTE,
  latestPpc,
  methodologyFor,
  monthlySeries,
  monthPeriod,
  summarizeEconomy,
  ehAjusteManual,
  baselineFoiConfirmada,
  baselineDaObra,
  premissasDoEvento,
  totaisPorOrigem,
  coberturaDeObra,
  obrasComEventos,
  SEM_OBRA,
  type TotaisPorOrigem,
} from './utils/economiaEngine'
import { retratoDaObra } from './utils/retratoDaObra'
import { indicadoresDaProducao, janelaDeMeses, producaoDaPlataforma } from './utils/producaoDaPlataforma'
import { compararComALinhaDeBase, fraseDoResultado } from './utils/linhaDeBaseMedida'
import { LinhaDeBasePanel } from './components/LinhaDeBasePanel'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useRdoStore } from '@/store/rdoStore'
import { printEconomyDossier, printEconomyReport } from './utils/economiaReportExport'

type EconomiaTab = 'overview' | 'medida' | 'events' | 'baseline' | 'report' | 'qbr'

const TABS: { id: EconomiaTab; label: string; icon: typeof Gauge }[] = [
  { id: 'overview', label: 'Prova de valor', icon: ShieldCheck },
  { id: 'medida', label: 'Linha de base medida', icon: Ruler },
  { id: 'events', label: 'Eventos', icon: BadgeDollarSign },
  { id: 'baseline', label: 'Baseline', icon: SlidersHorizontal },
  { id: 'report', label: 'Relatorio mensal', icon: FileText },
  { id: 'qbr', label: 'QBR', icon: CalendarDays },
]

const STATUS_LABELS: Record<EconomyEventStatus, string> = {
  detected: 'Detectado',
  validated: 'Validado',
  dismissed: 'Descartado',
  reported: 'Reportado',
}

export function EconomiaPage() {
  const store = useEconomiaStore()
  const lpsActivities = useLpsStore((state) => state.activities)
  // As três fontes que faltavam para responder "esta obra gastou menos do que gastaria?".
  const sites = useTorreStore((s) => s.sites)
  const entries = useFinanceiroStore((s) => s.entries)
  const workers = useMaoDeObraStore((s) => s.workers)
  const shifts = useMaoDeObraStore((s) => s.shifts)
  const cltSettings = useMaoDeObraStore((s) => s.cltSettings)
  const rdos = useRdoStore((s) => s.rdos)
  const [activeTab, setActiveTab] = useState<EconomiaTab>('overview')
  const [obra, setObra] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<EconomySourceModule | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<EconomyEventStatus | 'all'>('all')
  /** A janela do lado 'depois' e a unidade comparada — vivem aqui porque a produção depende das duas. */
  const [mesesDaJanela, setMesesDaJanela] = useState(3)
  const [unidade, setUnidade] = useState('m²')

  useEffect(() => {
    if (store.baselines.length === 0) store.addBaseline()
    if (store.events.length === 0 && store.baselines.length > 0) store.scanEvents()
    // Run once when the module opens; explicit refresh remains available in the header.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── ESCOPO POR OBRA ────────────────────────────────────────────────────────
  // O filtro é pelo **id** da obra, não pelo nome. Era por nome — comparação de string contra o
  // `projectName` do evento — e isso quebrava ao renomear uma obra e confundia nomes parecidos.
  //
  // `obra` tem três valores, e os três significam coisas diferentes no `summarizeEconomy`:
  //   'all'        → a carteira inteira (passa `undefined`)
  //   '<uuid>'     → só aquela obra
  //   'sem-obra'   → só os eventos que não sabem a obra (passa `null`)
  const obraOptions = useMemo(
    () => obrasComEventos(store.events, store.selectedPeriod),
    [store.events, store.selectedPeriod],
  )

  /** O que vai para o `summarizeEconomy`: `undefined` = tudo, `null` = sem obra, id = a obra. */
  const escopo: string | null | undefined =
    obra === 'all' ? undefined : obra === 'sem-obra' ? null : obra

  const summary = useMemo(
    () => summarizeEconomy(store.events, store.baselines, store.selectedPeriod, escopo),
    [store.events, store.baselines, store.selectedPeriod, escopo],
  )

  /** A tendência e o dossiê seguem o escopo escolhido. */
  const eventsForObra = useMemo(
    () => (escopo === undefined ? store.events : store.events.filter((e) => (e.projectId ?? null) === escopo)),
    [store.events, escopo],
  )

  /** Quantos eventos do período não sabem a obra, em qualquer status — para o seletor. */
  const semObraNoPeriodo = useMemo(
    () => store.events.filter((e) => e.period === store.selectedPeriod && e.status !== 'dismissed' && !e.projectId).length,
    [store.events, store.selectedPeriod],
  )

  /** Quanto do mês tem obra conhecida — sempre sobre a CARTEIRA, não sobre o recorte. */
  const cobertura = useMemo(
    () => coberturaDeObra(store.events.filter((e) => e.period === store.selectedPeriod)),
    [store.events, store.selectedPeriod],
  )

  /**
   * Trocar o mês pode tirar do ar a obra escolhida.
   *
   * `obraOptions` é recalculado por período. Se a obra selecionada não tem evento no mês novo, a
   * `<option>` some, o `<select>` controlado fica com `selectedIndex = -1` e a caixa renderiza
   * VAZIA — enquanto o conteúdo continua filtrado por ela. O cabeçalho dizia uma coisa e a tela
   * mostrava outra. Volta para a carteira, que é o estado que o seletor consegue exibir.
   */
  useEffect(() => {
    if (obra === 'all' || obra === 'sem-obra') return
    if (!obraOptions.some((o) => o.id === obra)) setObra('all')
  }, [obra, obraOptions])

  /** A obra selecionada de verdade (nem 'all' nem 'sem-obra'), para o retrato financeiro. */
  const siteSelecionado = useMemo(
    () => (typeof escopo === 'string' ? sites.find((s) => s.id === escopo) ?? null : null),
    [escopo, sites],
  )

  /**
   * O retrato medido da obra: contrato + financeiro + custo real de mão de obra.
   *
   * ─── POR QUE O RECORTE AQUI NÃO É O DO `useObraScopedLabor` ──────────────────
   * O hook usa a regra "trabalhador **sem** obra é geral e entra em todas". Para uma LISTA isso é
   * generoso e certo — o sujeito pode mesmo ter trabalhado ali. Para uma SOMA DE DINHEIRO por obra
   * é errado, e o erro é grande: o custo dele não se reparte entre as obras, ele se **repete**
   * inteiro em cada uma. Com três obras e dez funcionários sem vínculo, a folha de cada obra
   * carrega os dez, e somar as três daria três vezes a folha da empresa.
   *
   * Aqui a regra é a estrita: **só conta o que está carimbado nesta obra.**
   *  - turno com `siteId` desta obra, sempre — o carimbo é a evidência de onde o trabalho ocorreu;
   *  - turno sem carimbo entra só se o trabalhador tem `siteId` DESTA obra (turno legado, anterior
   *    ao carimbo, de gente vinculada);
   *  - trabalhador sem obra e turno sem carimbo ficam de fora, e a tela conta quantos são.
   *
   * O que fica de fora não some: aparece como aviso, para o número não parecer completo quando não é.
   */
  const retrato = useMemo(() => {
    if (!siteSelecionado) return null
    const id = siteSelecionado.id
    const daObra = new Set(workers.filter((w) => w.siteId === id).map((w) => w.id))
    const shiftsDaObra = shifts.filter((sh) => (sh.siteId != null ? sh.siteId === id : daObra.has(sh.workerId)))
    const idsComTurno = new Set(shiftsDaObra.map((sh) => sh.workerId))
    // Só quem tem turno nesta obra entra na folha dela — senão o headcount conta gente que não
    // trabalhou aqui e produziu R$ 0.
    const workersDaObra = workers.filter((w) => idsComTurno.has(w.id))
    return retratoDaObra({
      site: siteSelecionado,
      period: store.selectedPeriod,
      entries,
      workers: workersDaObra,
      shifts: shiftsDaObra,
      cltSettings,
      hoje: new Date().toISOString().slice(0, 10),
    })
  }, [siteSelecionado, store.selectedPeriod, entries, workers, shifts, cltSettings])

  /**
   * O lado "depois" da linha de base medida.
   *
   * ⚠️ **Não é o mês selecionado, é uma JANELA.** Comparar um mês contra os seis do
   * período-espelho compara sazonalidade, não desempenho — e `compararComALinhaDeBase` recusa
   * quando os tamanhos diferem mais que o dobro. Por isso a janela é escolhida na tela, e o padrão
   * são três meses terminando no período selecionado.
   *
   * O recorte de turnos é o ESTRITO, o mesmo do retrato: só o que está carimbado nesta obra. A
   * regra generosa ("quem não tem obra entra em todas") serve para lista, não para uma conta em
   * que o mesmo custo se repetiria inteiro em cada obra.
   */
  const janela = useMemo(() => janelaDeMeses(store.selectedPeriod, mesesDaJanela), [store.selectedPeriod, mesesDaJanela])

  const producao = useMemo(() => {
    const id = siteSelecionado?.id ?? ''
    const daObra = new Set(workers.filter((w) => w.siteId === id).map((w) => w.id))
    const shiftsDaObra = id ? shifts.filter((sh) => (sh.siteId != null ? sh.siteId === id : daObra.has(sh.workerId))) : []
    return producaoDaPlataforma({ obraId: id, meses: janela, unidade, rdos, entries, shifts: shiftsDaObra })
  }, [siteSelecionado?.id, janela, unidade, rdos, entries, shifts, workers])

  /**
   * A linha de base MEDIDA da obra — procurada pelo id da obra, **sem herdar a da carteira**.
   *
   * `baselineDaObra` cai na baseline geral quando a obra não tem a sua, e para as premissas isso é
   * certo. Aqui seria errado: um período-espelho medido pertence a UMA obra, e emprestá-lo a outra
   * mostraria o custo por m² de um canteiro no cabeçalho de outro.
   */
  const baselineDaObraPropria = useMemo(
    () => (siteSelecionado ? store.baselines.find((b) => b.projectId === siteSelecionado.id) : undefined),
    [store.baselines, siteSelecionado],
  )
  const linhaDeBaseMedida = baselineDaObraPropria?.medida ?? null

  /**
   * A comparação que a manchete usa — e ela olha só o que está SALVO.
   *
   * Não depende de nada que a aba da linha de base tenha na tela no momento: a janela tem o mesmo
   * número de meses do período-espelho (é o que faz o corte de tamanho passar) e a unidade é a que
   * foi acordada, não a que alguém está digitando agora. Rascunho não vira manchete.
   */
  const comparacaoSalva = useMemo(() => {
    if (!linhaDeBaseMedida || !siteSelecionado || linhaDeBaseMedida.meses.length === 0) return null
    const id = siteSelecionado.id
    const daObra = new Set(workers.filter((w) => w.siteId === id).map((w) => w.id))
    const shiftsDaObra = shifts.filter((sh) => (sh.siteId != null ? sh.siteId === id : daObra.has(sh.workerId)))
    const medido = producaoDaPlataforma({
      obraId: id,
      meses: janelaDeMeses(store.selectedPeriod, linhaDeBaseMedida.meses.length),
      unidade: linhaDeBaseMedida.ajuste.unidade,
      rdos, entries, shifts: shiftsDaObra,
    })
    return {
      c: compararComALinhaDeBase(linhaDeBaseMedida, indicadoresDaProducao(medido)),
      unidade: linhaDeBaseMedida.ajuste.unidade,
    }
  }, [linhaDeBaseMedida, siteSelecionado, store.selectedPeriod, rdos, entries, shifts, workers])

  const addBaseline = store.addBaseline
  const updateBaseline = store.updateBaseline
  const salvarLinhaDeBase = (medida: LinhaDeBaseMedida) => {
    const alvo = baselineDaObraPropria
      ?? addBaseline({ projectId: siteSelecionado?.id ?? null, projectName: siteSelecionado?.name ?? '' })
    updateBaseline(alvo.id, { medida })
  }

  const series = useMemo(() => monthlySeries(eventsForObra, 6), [eventsForObra])
  const currentPpc = useMemo(() => latestPpc(lpsActivities), [lpsActivities])

  const filteredEvents = useMemo(() => {
    return summary.events.filter((event) => {
      if (sourceFilter !== 'all' && event.sourceModule !== sourceFilter) return false
      if (statusFilter !== 'all' && event.status !== statusFilter) return false
      return true
    })
  }, [sourceFilter, statusFilter, summary.events])

  /**
   * O seletor do topo passa a valer para o módulo inteiro.
   *
   * `store.setSelectedProject` existia e **nunca era chamado por ninguém** (grep no repositório:
   * só a definição). Resultado: com "SUPERA" escolhida no cabeçalho, a aba Relatório procurava o
   * relatório da carteira, gerava o da carteira e o "Marcar enviado" mexia no status de eventos de
   * todas as obras. A tela dizia uma coisa e o documento saía outra.
   *
   * "Sem obra" cai na carteira aqui de propósito: um relatório mensal só dos eventos que não sabem
   * a obra não é documento que se entregue a alguém.
   */
  const setSelectedProject = store.setSelectedProject
  useEffect(() => {
    setSelectedProject(siteSelecionado?.id ?? null)
  }, [siteSelecionado?.id, setSelectedProject])

  const currentReport = store.reports.find((report) =>
    report.period === store.selectedPeriod &&
    report.projectId === (siteSelecionado?.id ?? null)
  )

  // Exporta o dossiê com exatamente o que está na tela (obra + período selecionados),
  // sem precisar gerar/persistir um relatório antes.
  const exportDossier = () => {
    const baseline = summary.baseline
    const liveReport: EconomyReport = {
      id: 'live',
      period: store.selectedPeriod,
      // O escopo real vai no id; o nome é para o cabeçalho do documento. Aqui estava
      // `: obra`, que antes era o NOME da obra (o filtro era por string) e depois desta rodada
      // passou a ser o UUID — o PDF entregue a uma diretoria abria com `3f8c1a94-…` no título.
      projectId: typeof escopo === 'string' ? escopo : null,
      projectName: siteSelecionado?.name
        ?? (escopo === null ? `${SEM_OBRA} (eventos sem obra identificada)` : (baseline?.projectName ?? 'Carteira de obras')),
      baselineId: baseline?.id ?? null,
      eventIds: summary.events.map((event) => event.id),
      detectedEvents: summary.detectedEvents,
      avoidedLossBRL: summary.avoidedLossBRL,
      platformFeeBRL: summary.platformFeeBRL,
      roiPercent: summary.roiPercent,
      ppcBefore: baseline?.ppcPercent ?? 0,
      ppcAfter: currentPpc || (baseline?.ppcPercent ?? 0),
      materialDeviationBefore: baseline?.materialDeviationPercent ?? 0,
      materialDeviationAfter: baseline?.targetMaterialDeviationPercent ?? 0,
      materialSavingsBRL: Math.max(0, ((baseline?.materialDeviationPercent ?? 0) - (baseline?.targetMaterialDeviationPercent ?? 0)) / 100) * (baseline?.materialMonthlyBudgetBRL ?? 0),
      status: 'draft',
      generatedAt: new Date().toISOString(),
    }
    printEconomyDossier(liveReport, eventsForObra, baseline)
  }

  const renderPanel = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <ProvaDeValorPanel
            summary={summary} series={series} currentPpc={currentPpc} lastScanAt={store.lastScanAt}
            cobertura={cobertura} retrato={retrato} medido={comparacaoSalva}
          />
        )
      case 'medida':
        return (
          <LinhaDeBasePanel
            obraId={siteSelecionado?.id ?? null}
            obraNome={siteSelecionado?.name ?? ''}
            producao={producao}
            mesesDaJanela={mesesDaJanela}
            setMesesDaJanela={setMesesDaJanela}
            janela={janela}
            linhaDeBase={linhaDeBaseMedida}
            onSalvar={salvarLinhaDeBase}
            unidade={unidade}
            setUnidade={setUnidade}
          />
        )
      case 'events':
        return (
          <EventsPanel
            events={filteredEvents}
            sourceFilter={sourceFilter}
            statusFilter={statusFilter}
            setSourceFilter={setSourceFilter}
            setStatusFilter={setStatusFilter}
            updateEvent={store.updateEvent}
            validateEvent={store.validateEvent}
            dismissEvent={store.dismissEvent}
          />
        )
      case 'baseline':
        return (
          <BaselinePanel
            baselines={store.baselines}
            updateBaseline={store.updateBaseline}
            addBaseline={store.addBaseline}
            obraSelecionada={siteSelecionado ? { id: siteSelecionado.id, nome: siteSelecionado.name } : null}
            escopoTemObra={typeof escopo === 'string'}
          />
        )
      case 'report':
        return (
          <ReportPanel
            report={currentReport}
            events={store.events}
            baseline={summary.baseline}
            generateReport={() => store.generateMonthlyReport(store.selectedPeriod, siteSelecionado?.id ?? null)}
            markSent={store.markReportSent}
          />
        )
      case 'qbr':
        return <QbrPanel events={store.events} baseline={summary.baseline} />
      default:
        return (
          <ProvaDeValorPanel
            summary={summary} series={series} currentPpc={currentPpc} lastScanAt={store.lastScanAt}
            cobertura={cobertura} retrato={retrato} medido={comparacaoSalva}
          />
        )
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#2c2c2c] text-[#f5f5f5]">
      <header className="border-b border-[#525252] bg-[#242424] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#f97316]">
              <BadgeDollarSign size={16} />
              Economia
            </div>
            <h1 className="mt-1 text-xl font-semibold text-white">ROI e valor entregue</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={obra}
              onChange={(event) => setObra(event.target.value)}
              className="h-9 max-w-[14rem] rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-white outline-none focus:border-[#f97316]"
              title="Obra / carteira"
            >
              <option value="all">Carteira (todas as obras)</option>
              {obraOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
              {/* Sete dos treze tipos de evento não gravam a obra na origem. Eles precisam de um
                  lugar onde possam ser vistos — escondê-los faria a soma das obras não bater com
                  a carteira, sem explicação nenhuma. */}
              {/* Contado sobre os eventos do período, e não sobre a cobertura: a cobertura só
                  soma validados, e num mês recém-varrido todo evento nasce `detected`. A opção
                  sumia justamente quando havia mais para ver. */}
              {semObraNoPeriodo > 0 && (
                <option value="sem-obra">{SEM_OBRA} ({semObraNoPeriodo})</option>
              )}
            </select>
            <input
              type="month"
              value={store.selectedPeriod}
              onChange={(event) => store.setSelectedPeriod(event.target.value || monthPeriod())}
              className="h-9 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-white outline-none focus:border-[#f97316]"
            />
            <FreshnessBadge lastScanAt={store.lastScanAt} />
            <button
              type="button"
              onClick={store.scanEvents}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#525252] px-3 text-sm font-medium text-[#e5e5e5] hover:border-[#f97316]/60 hover:text-white"
            >
              <RefreshCw size={15} />
              Atualizar eventos
            </button>
            <button
              type="button"
              onClick={exportDossier}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#f97316] px-3 text-sm font-semibold text-white hover:bg-[#ea580c]"
            >
              <Download size={15} />
              Dossiê PDF
            </button>
          </div>
        </div>

        <nav className="mt-4 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition ${
                  active
                    ? 'bg-[#f97316]/15 text-[#f97316]'
                    : 'text-[#a3a3a3] hover:bg-[#333333] hover:text-white'
                }`}
              >
                <Icon size={15} />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="flex-1 overflow-auto p-5">
        {renderPanel()}
      </main>
    </div>
  )
}

function ProvaDeValorPanel({
  summary,
  series,
  currentPpc,
  lastScanAt,
  cobertura,
  retrato,
  medido,
}: {
  summary: ReturnType<typeof summarizeEconomy>
  series: Array<{ period: string; validatedBRL: number }>
  currentPpc: number
  lastScanAt: string | null
  cobertura: ReturnType<typeof coberturaDeObra>
  retrato: ReturnType<typeof retratoDaObra> | null
  medido: { c: ReturnType<typeof compararComALinhaDeBase>; unidade: string } | null
}) {
  const events = summary.events
  const baseline = summary.baseline
  const valued = events.filter((event) => event.impactBRL > 0)
  const bySource = groupValue(valued, (event) => ECONOMY_SOURCE_LABELS[event.sourceModule])
  const byCategory = groupValue(valued, (event) => ECONOMY_CATEGORY_LABELS[event.category])
  const topEvents = [...valued]
    .sort((a, b) => proofRank(b) - proofRank(a) || b.impactBRL - a.impactBRL)
    .slice(0, 6)

  if (events.length === 0) return <ProofEmptyState />

  return (
    <div className="space-y-6">
      <HeroProof summary={summary} origem={totaisPorOrigem(events)} baselineConfirmada={baselineFoiConfirmada(baseline)} medido={medido} />

      {/* Quanto do mês tem obra conhecida. Sem isto, "SUPERA economizou R$ 38.400" esconde que
          outro tanto do mesmo mês não pôde ser atribuído a obra nenhuma. */}
      <CoberturaDeObraAviso cobertura={cobertura} />

      {/* O lado MEDIDO — só aparece quando há uma obra escolhida. Na carteira não faz sentido:
          somar contrato de quatro obras não responde pergunta nenhuma. */}
      {retrato && (
        <RetratoDaObraPanel retrato={retrato} economiaEstimadaBRL={summary.avoidedLossBRL} />
      )}

      {summary.baselineHerdada && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2 text-[11px] leading-5 text-amber-300">
          Esta obra ainda não tem linha de base própria — os valores acima usam as premissas da
          carteira. Preencha as dela em <b>Linha de base</b> para o número passar a ser sobre esta obra.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="De onde vem a economia (por módulo)">
          <div className="space-y-3">
            {bySource.map((row) => <HorizontalBar key={row.label} label={row.label} value={row.value} max={bySource[0]?.value || 1} />)}
            {bySource.length === 0 && <EmptyText text="Sem valor financeiro consolidado no período." />}
          </div>
        </Panel>
        <Panel title="Por tipo de ganho">
          <div className="space-y-3">
            {byCategory.map((row) => <HorizontalBar key={row.label} label={row.label} value={row.value} max={byCategory[0]?.value || 1} />)}
            {byCategory.length === 0 && <EmptyText text="Sem valor financeiro consolidado no período." />}
          </div>
        </Panel>
      </div>

      <Panel title="Antes e depois (baseline → atual)">
        <div className="grid gap-3 sm:grid-cols-3">
          <BeforeAfterRow
            label="PPC (cumprimento do plano)"
            before={`${Math.round(baseline?.ppcPercent ?? 0)}%`}
            after={currentPpc > 0 ? `${currentPpc}%` : '—'}
            good={currentPpc >= (baseline?.ppcPercent ?? 0)}
          />
          <BeforeAfterRow
            label="Desvio de material"
            before={`${baseline?.materialDeviationPercent ?? 0}%`}
            after={`${baseline?.targetMaterialDeviationPercent ?? 0}% (meta)`}
            good
          />
          <BeforeAfterRow
            label="Horas em relatório manual"
            before={`${baseline?.manualReportHoursPerWeek ?? 0}h/sem`}
            after="automatizado"
            good
          />
        </div>
      </Panel>

      <Panel title="Economia validada por mês">
        <TrendBars series={series} />
      </Panel>

      <Panel title="Evidências de maior impacto">
        <div className="grid gap-3 lg:grid-cols-2">
          {topEvents.map((event) => <EvidenceCard key={event.id} event={event} />)}
          {topEvents.length === 0 && <EmptyText text="Ainda sem eventos com valor financeiro. Os indicadores sem R$ aparecem na aba Eventos." />}
        </div>
      </Panel>

      <DisclosureNote summary={summary} lastScanAt={lastScanAt} />
    </div>
  )
}

function proofRank(event: EconomyEvent) {
  return event.status === 'validated' || event.status === 'reported' ? 1 : 0
}

/**
 * O cabeçalho da prova de valor.
 *
 * ─── ⚠️ A INVERSÃO QUE ESTE COMPONENTE FAZ, E POR QUÊ ─────────────────────────
 * Até aqui a manchete — quatro a seis vezes maior que tudo o resto — era o total ESTIMADO: dado
 * real multiplicado por constante fixa, vezes um formulário de premissas que nasce preenchido com
 * números de exemplo. O rótulo dizia "estimativa" em letra miúda, e ninguém lê letra miúda embaixo
 * de um número de sessenta pixels.
 *
 * Agora a manchete é **o que foi medido**: a comparação entre dois períodos reais da mesma obra.
 * O total estimado não some — continua no cabeçalho, rotulado, num corpo menor, do lado. Quando
 * não há nada medido, a manchete diz isso, em vez de promover a estimativa ao lugar vago.
 */
function HeroProof({ summary, origem, baselineConfirmada, medido }: {
  summary: ReturnType<typeof summarizeEconomy>
  origem: TotaisPorOrigem
  baselineConfirmada: boolean
  medido: { c: ReturnType<typeof compararComALinhaDeBase>; unidade: string } | null
}) {
  const temMedido = !!medido && medido.c.impedimentos.length === 0
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#525252] bg-gradient-to-br from-[#1d2a23] via-[#242424] to-[#1f1f1f] p-6 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative">
        {temMedido && medido ? (
          <>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
              <Ruler size={15} /> Medido — dois períodos reais da mesma obra
            </p>
            <p className="mt-3 max-w-3xl text-2xl font-bold leading-snug text-[#f5f5f5] sm:text-3xl">
              {fraseDoResultado(medido.c, medido.unidade)}
            </p>
            <p className="mt-2 text-xs text-[#a3a3a3]">
              {brl(medido.c.antes.custoPorUnidade ?? 0)}/{medido.unidade} ({medido.c.antes.meses} mês(es) antes)
              {' → '}{brl(medido.c.depois.custoPorUnidade ?? 0)}/{medido.unidade} ({medido.c.depois.meses} mês(es) com a plataforma)
              {medido.c.antes.hhPorUnidade !== null && medido.c.depois.hhPorUnidade !== null && (
                <> · {medido.c.antes.hhPorUnidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}
                  {' → '}{medido.c.depois.hhPorUnidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} HH/{medido.unidade}</>
              )}
            </p>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#a3a3a3]">
              <Ruler size={15} /> Ainda não há resultado medido
            </p>
            <p className="mt-3 max-w-3xl text-xl font-semibold leading-snug text-[#f5f5f5] sm:text-2xl">
              O número abaixo é estimativa, não medição.
            </p>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-[#a3a3a3]">
              Para ter um resultado medido, escolha uma obra e monte o período-espelho em
              <b> Linha de base medida</b>: são dois períodos reais da mesma obra, comparados com um
              critério acordado antes.
              {medido && medido.c.impedimentos.length > 0 && (
                <> Falta: {medido.c.impedimentos[0].toLowerCase()}</>
              )}
            </p>
          </>
        )}

        <div className={`flex flex-wrap items-end gap-x-8 gap-y-3 ${temMedido ? 'mt-5 border-t border-white/10 pt-4' : 'mt-4'}`}>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#a3a3a3]">Potencial de perda evitada · estimativa</p>
            <p className={`mt-0.5 font-bold tabular-nums text-emerald-300 ${temMedido ? 'text-2xl' : 'text-3xl sm:text-4xl'}`}>
              {brl(summary.avoidedLossBRL)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 pb-1">
            <Stat icon={TrendingUp} label="Retorno estimado no mês" value={`${Math.round(summary.roiPercent)}%`} positive={summary.roiPercent >= 0} />
            <Stat label="Por R$ investido" value={`${summary.paybackRatio.toFixed(1)}x`} positive={summary.paybackRatio >= 1} />
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-xs leading-5 text-[#a3a3a3]">
          {summary.validatedEvents} de {summary.detectedEvents} eventos validados · investimento na plataforma {brl(summary.platformFeeBRL)}/mês
          {summary.estimatedPipelineBRL > 0 && <> · {brl(summary.estimatedPipelineBRL)} em potencial ainda em análise (não somado)</>}
        </p>
        {/* O total mistura duas coisas de naturezas diferentes; dizer isso é o mínimo. */}
        {origem.ajustadoAMaoBRL > 0 && (
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-amber-300/90">
            Deste total, <b>{brl(origem.ajustadoAMaoBRL)}</b> em {origem.eventosAjustados} evento(s)
            foi digitado à mão, não calculado pela plataforma.
          </p>
        )}
        {!baselineConfirmada && (
          <p className="mt-1.5 max-w-2xl text-xs leading-5 text-amber-300/90">
            A linha de base ainda é a de exemplo. Quase todo valor aqui depende dela — confirme os
            números em <b>Linha de base</b> antes de levar isto a uma reunião.
          </p>
        )}
      </div>
    </section>
  )
}

function Stat({ label, value, positive = true, icon: Icon }: { label: string; value: string; positive?: boolean; icon?: typeof TrendingUp }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[#a3a3a3]">{label}</p>
      <p className={`mt-0.5 flex items-center gap-1.5 text-xl font-semibold tabular-nums ${positive ? 'text-emerald-300' : 'text-red-300'}`}>
        {Icon && <Icon size={16} />}{value}
      </p>
    </div>
  )
}

function BeforeAfterRow({ label, before, after, good = true }: { label: string; before: string; after: string; good?: boolean }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
      <p className="text-xs text-[#a3a3a3]">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-sm">
        <span className="text-[#9a9a9a] line-through decoration-[#5a5a5a]">{before}</span>
        <ArrowRight size={13} className="shrink-0 text-[#737373]" />
        <span className={`font-semibold ${good ? 'text-emerald-300' : 'text-amber-300'}`}>{after}</span>
      </div>
    </div>
  )
}

function TrendBars({ series }: { series: Array<{ period: string; validatedBRL: number }> }) {
  const max = Math.max(1, ...series.map((row) => row.validatedBRL))
  if (!series.some((row) => row.validatedBRL > 0)) {
    return <EmptyText text="Sem histórico de economia validada nos últimos meses." />
  }
  return (
    <div className="flex h-44 items-end gap-3">
      {series.map((row) => (
        <div key={row.period} className="flex h-full flex-1 flex-col items-center">
          <span className="mb-1 text-[10px] font-semibold tabular-nums text-emerald-300/80">{row.validatedBRL > 0 ? brlShort(row.validatedBRL) : ''}</span>
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t bg-gradient-to-t from-emerald-500/40 to-emerald-400/80" style={{ height: `${Math.max(2, (row.validatedBRL / max) * 100)}%` }} />
          </div>
          <span className="mt-2 text-[10px] text-[#a3a3a3]">{monthShort(row.period)}</span>
        </div>
      ))}
    </div>
  )
}

function EvidenceCard({ event }: { event: EconomyEvent }) {
  const route = ECONOMY_SOURCE_ROUTE[event.sourceModule]
  return (
    <article className="rounded-lg border border-[#525252] bg-[#242424] p-4 transition hover:border-emerald-500/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#f97316]/10 px-2 py-0.5 text-[11px] font-semibold text-[#f97316]">{ECONOMY_SOURCE_LABELS[event.sourceModule]}</span>
            <ConfidencePill confidence={event.confidence} />
          </div>
          <h3 className="mt-2 text-sm font-semibold text-white">{event.title}</h3>
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums text-emerald-300">{event.impactBRL > 0 ? brl(event.impactBRL) : 'indicador'}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#a3a3a3]">{methodologyFor(event.category)}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="truncate text-[11px] text-[#a3a3a3]">{event.projectName}</span>
        {route && (
          <Link to={route} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-cyan-300 transition hover:text-cyan-200">
            Ver evidência <ArrowUpRight size={12} />
          </Link>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] text-[#737373] transition hover:text-[#a3a3a3]">Como calculamos</summary>
        <div className="mt-2 rounded-md bg-[#1f1f1f] p-2 text-[11px] text-[#a3a3a3]">
          <p className="font-mono text-[#d4d4d4]">{event.formula}</p>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
            {Object.entries(event.assumptions).map(([key, value]) => (
              <span key={key}>{key}: <span className="text-[#d4d4d4]">{typeof value === 'number' ? value.toLocaleString('pt-BR') : String(value)}</span></span>
            ))}
          </div>
        </div>
      </details>
    </article>
  )
}

function ConfidencePill({ confidence }: { confidence: EconomyEvent['confidence'] }) {
  const map: Record<EconomyEvent['confidence'], [string, string]> = {
    high: ['Alta', 'bg-emerald-500/10 text-emerald-300'],
    medium: ['Média', 'bg-amber-500/10 text-amber-300'],
    low: ['Baixa', 'bg-[#333333] text-[#a3a3a3]'],
  }
  const [label, cls] = map[confidence] ?? map.low
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${cls}`}>Confiança {label}</span>
}

function DisclosureNote({ summary, lastScanAt }: { summary: ReturnType<typeof summarizeEconomy>; lastScanAt: string | null }) {
  return (
    <p className="text-[11px] leading-5 text-[#a3a3a3]">
      <b className="text-[#d4d4d4]">Como ler estes números.</b> Os eventos são detectados a partir dos
      dados reais dos módulos operacionais — RDO, Suprimentos, LPS, Medição e EVM. O <b>valor em reais</b> de
      cada um é uma <b>estimativa</b>: o dado real multiplicado por um fator do método e pelos números da
      linha de base que você preencheu. Trocar o custo por pessoa-dia muda o total na mesma proporção.
      Cada evento mostra as premissas que usou. Só entram na conta os validados ({summary.validatedEvents} de{' '}
      {summary.detectedEvents}); indicadores sem R$ direto ficam de fora para não contar duas vezes.
      {lastScanAt && <> Última atualização: {new Date(lastScanAt).toLocaleString('pt-BR')}.</>}
    </p>
  )
}

function ProofEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-[#525252] bg-[#242424] p-10 text-center">
      <ShieldCheck className="mx-auto text-[#525252]" size={40} />
      <h2 className="mt-4 text-lg font-semibold text-white">Nenhum evento de economia neste período</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#a3a3a3]">
        Alimente RDO, Suprimentos, LPS, Medição e EVM e clique em <span className="text-[#e5e5e5]">"Atualizar eventos"</span>.
        Os eventos saem dos seus dados; o valor em reais de cada um é estimado com as premissas da
        linha de base, e cada evento mostra quais usou.
      </p>
    </div>
  )
}

function FreshnessBadge({ lastScanAt }: { lastScanAt: string | null }) {
  if (!lastScanAt) return null
  return (
    <span className="hidden h-9 items-center gap-1.5 rounded-lg border border-[#525252] px-3 text-[11px] text-[#a3a3a3] sm:inline-flex">
      <Clock size={13} /> {new Date(lastScanAt).toLocaleDateString('pt-BR')}
    </span>
  )
}

function brlShort(value: number): string {
  if (value >= 1000000) return `R$ ${(value / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`
  if (value >= 1000) return `R$ ${Math.round(value / 1000)}k`
  return brl(value)
}

function monthShort(period: string): string {
  const [year, month] = period.split('-')
  const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${names[Number(month) - 1] ?? month}/${(year ?? '').slice(2)}`
}

function EventsPanel({
  events,
  sourceFilter,
  statusFilter,
  setSourceFilter,
  setStatusFilter,
  updateEvent,
  validateEvent,
  dismissEvent,
}: {
  events: EconomyEvent[]
  sourceFilter: EconomySourceModule | 'all'
  statusFilter: EconomyEventStatus | 'all'
  setSourceFilter: (value: EconomySourceModule | 'all') => void
  setStatusFilter: (value: EconomyEventStatus | 'all') => void
  updateEvent: (id: string, patch: Partial<EconomyEvent>) => void
  validateEvent: (id: string) => void
  dismissEvent: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as EconomySourceModule | 'all')} className={selectClass}>
          <option value="all">Todos os modulos</option>
          {Object.entries(ECONOMY_SOURCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as EconomyEventStatus | 'all')} className={selectClass}>
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="grid gap-3">
        {events.map((event) => (
          <EventEditor
            key={event.id}
            event={event}
            updateEvent={updateEvent}
            validateEvent={validateEvent}
            dismissEvent={dismissEvent}
          />
        ))}
        {events.length === 0 && <Panel title="Eventos"><EmptyText text="Nenhum evento encontrado com os filtros atuais." /></Panel>}
      </div>
    </div>
  )
}

function EventEditor({
  event,
  updateEvent,
  validateEvent,
  dismissEvent,
}: {
  event: EconomyEvent
  updateEvent: (id: string, patch: Partial<EconomyEvent>) => void
  validateEvent: (id: string) => void
  dismissEvent: (id: string) => void
}) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#242424] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#f97316]/10 px-2 py-1 text-[11px] font-semibold text-[#f97316]">
              {ECONOMY_SOURCE_LABELS[event.sourceModule]}
            </span>
            <span className="rounded-md bg-[#333333] px-2 py-1 text-[11px] text-[#d4d4d4]">
              {ECONOMY_CATEGORY_LABELS[event.category]}
            </span>
            <StatusPill status={event.status} />
          </div>
          <h3 className="mt-2 text-sm font-semibold text-white">{event.title}</h3>
          <p className="mt-1 text-xs leading-5 text-[#a3a3a3]">{event.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={event.impactBRL}
            onChange={(input) => updateEvent(event.id, { impactBRL: Number(input.target.value) || 0 })}
            className="h-9 w-32 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-right text-sm font-semibold text-emerald-300 outline-none focus:border-[#22c55e]"
          />
          <button type="button" onClick={() => validateEvent(event.id)} className="rounded-lg border border-emerald-500/40 p-2 text-emerald-300 hover:bg-emerald-500/10" title="Validar">
            <CheckCircle2 size={16} />
          </button>
          <button type="button" onClick={() => dismissEvent(event.id)} className="rounded-lg border border-red-500/40 p-2 text-red-300 hover:bg-red-500/10" title="Descartar">
            <XCircle size={16} />
          </button>
        </div>
      </div>
      {/* As premissas por extenso. Antes o número aparecia sozinho, e as constantes do cálculo
          (0,35 · 0,12 · 0,08 · 0,02 · 0,25 · 4,33) não estavam em lugar nenhum da tela — dava para
          discordar do total, mas não de nenhum número em particular. */}
      <Premissas event={event} />
      <div className="mt-3 grid gap-2 text-xs text-[#d4d4d4] md:grid-cols-3">
        <span>Obra: {event.projectName}</span>
        <span>Fórmula: {event.formula}</span>
        <span>Confiança: {event.confidence}</span>
      </div>
    </div>
  )
}

/** A conta por extenso: premissas usadas e, quando houver, o quanto o valor foi mexido à mão. */
function Premissas({ event }: { event: EconomyEvent }) {
  const premissas = premissasDoEvento(event)
  const manual = ehAjusteManual(event)
  if (premissas.length === 0 && !manual) return null
  return (
    <div className="mt-3 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2">
      {premissas.length > 0 && (
        <p className="text-[11px] leading-5 text-[#a3a3a3]">
          <span className="font-semibold text-[#d4d4d4]">Premissas: </span>
          {premissas.map((p, i) => (
            <span key={p.rotulo}>
              {i > 0 && ' · '}{p.rotulo} <b className="text-[#e5e5e5]">{p.valor}</b>
            </span>
          ))}
        </p>
      )}
      {manual && (
        <p className="mt-1 text-[11px] leading-5 text-amber-300">
          <b>Valor ajustado à mão.</b> O cálculo estimava{' '}
          {brl(event.impactEstimadoBRL ?? 0)} com estas premissas.
        </p>
      )}
    </div>
  )
}

function BaselinePanel({
  baselines,
  updateBaseline,
  addBaseline,
  obraSelecionada,
  escopoTemObra,
}: {
  baselines: EconomyBaseline[]
  updateBaseline: (id: string, patch: Partial<EconomyBaseline>) => void
  addBaseline: (baseline?: Partial<EconomyBaseline>) => EconomyBaseline
  /** A obra do seletor do topo, ou `null` na carteira. */
  obraSelecionada: { id: string; nome: string } | null
  /** O seletor aponta para uma obra, mesmo que ela não esteja mais no cadastro. */
  escopoTemObra: boolean
}) {
  // A linha de base que vale para o escopo atual — a da obra, ou a da carteira por herança.
  const { baseline: escolhida, herdada } = baselineDaObra(baselines, obraSelecionada?.id ?? null)
  const baseline = escolhida
  if (!baseline) {
    return (
      <Panel title="Baseline semana 0">
        <button type="button" onClick={() => addBaseline()} className={primaryButtonClass}>Criar baseline</button>
      </Panel>
    )
  }

  const confirmada = baselineFoiConfirmada(baseline)

  return (
    <Panel title={obraSelecionada ? `Linha de base — ${obraSelecionada.nome}` : 'Linha de base — carteira'}>
      {/* Uma por obra, herdando a da carteira (escolha do cliente). Quem nunca abrir isto continua
          exatamente como antes: um número só para tudo. */}
      {obraSelecionada && herdada && (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2.5">
          <p className="text-[11px] leading-5 text-amber-300">
            <b>{obraSelecionada.nome} está usando os números da carteira.</b> Editar os campos abaixo
            mudaria a carteira inteira e todas as outras obras junto. Crie a linha de base desta obra
            para que os valores dela passem a sair das premissas dela.
          </p>
          <button
            type="button"
            onClick={() => addBaseline({
              ...baseline,
              id: undefined,
              projectId: obraSelecionada.id,
              projectName: obraSelecionada.nome,
              // Herdou os números, mas herdar não é conferir: quem copiou não olhou.
              confirmadaPeloUsuario: false,
            })}
            className="mt-2 rounded-lg border border-amber-400/50 px-3 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/10"
          >
            Criar linha de base para {obraSelecionada.nome}
          </button>
        </div>
      )}
      {/* Obra que está nos eventos mas não no cadastro (excluída na Torre). Sem este aviso, a aba
          cai silenciosamente na carteira e QUALQUER edição aqui muda todas as obras. */}
      {!obraSelecionada && escopoTemObra && (
        <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2.5 text-[11px] leading-5 text-amber-300">
          <b>Esta obra não está mais no cadastro</b> — foi excluída na Torre de Controle, e os
          eventos dela continuam no histórico. Os campos abaixo são os da <b>carteira</b>: editar
          aqui muda todas as obras.
        </p>
      )}
      {obraSelecionada && !herdada && (
        <p className="mb-3 text-[11px] leading-5 text-[#a3a3a3]">
          Números próprios desta obra. A carteira e as outras obras não mudam com o que for editado aqui.
        </p>
      )}
      {/* A linha de base é criada sozinha na primeira abertura, com números de exemplo. Como quase
          todo valor em reais do módulo depende dela, apresentá-la como fato é o que transformava
          uma estimativa em "comprovação". */}
      {confirmada ? (
        <p className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3 py-2 text-[11px] leading-5 text-emerald-300">
          <b>Números confirmados.</b> As estimativas do módulo usam estes valores. Ao alterá-los, o
          total muda na mesma proporção.
        </p>
      ) : (
        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/[0.08] px-3 py-2.5">
          <p className="text-[11px] leading-5 text-amber-300">
            <b>Estes números são de exemplo</b> — foram preenchidos automaticamente quando o módulo
            abriu pela primeira vez, e ninguém os confirmou. Quase todo valor em reais da tela de
            Prova de valor depende deles: dobrar o custo por pessoa-dia dobra a economia declarada.
            Ajuste o que for diferente e confirme.
          </p>
          <button type="button" onClick={() => updateBaseline(baseline.id, { confirmadaPeloUsuario: true })}
                  className="mt-2 rounded-lg border border-amber-400/50 px-3 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/10">
            Conferi — estes são os números da operação
          </button>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Obra / carteira" value={baseline.projectName} onChange={(value) => updateBaseline(baseline.id, { projectName: value })} />
        <Field label="PPC atual (%)" type="number" value={baseline.ppcPercent} onChange={(value) => updateBaseline(baseline.id, { ppcPercent: num(value) })} />
        <Field label="Desvio material (%)" type="number" value={baseline.materialDeviationPercent} onChange={(value) => updateBaseline(baseline.id, { materialDeviationPercent: num(value) })} />
        <Field label="Horas relatorios/sem" type="number" value={baseline.manualReportHoursPerWeek} onChange={(value) => updateBaseline(baseline.id, { manualReportHoursPerWeek: num(value) })} />
        <Field label="Paralisacoes trimestre" type="number" value={baseline.stoppagesLastQuarter} onChange={(value) => updateBaseline(baseline.id, { stoppagesLastQuarter: num(value) })} />
        <Field label="Trabalhadores" type="number" value={baseline.workersCount} onChange={(value) => updateBaseline(baseline.id, { workersCount: num(value) })} />
        <Field label="Custo/dia por pessoa" type="number" value={baseline.costPerPersonDayBRL} onChange={(value) => updateBaseline(baseline.id, { costPerPersonDayBRL: num(value) })} />
        <Field label="Orcamento material/mes" type="number" value={baseline.materialMonthlyBudgetBRL} onChange={(value) => updateBaseline(baseline.id, { materialMonthlyBudgetBRL: num(value) })} />
        <Field label="Meta desvio material (%)" type="number" value={baseline.targetMaterialDeviationPercent} onChange={(value) => updateBaseline(baseline.id, { targetMaterialDeviationPercent: num(value) })} />
        <Field label="Mensalidade plataforma" type="number" value={baseline.platformMonthlyFeeBRL} onChange={(value) => updateBaseline(baseline.id, { platformMonthlyFeeBRL: num(value) })} />
        <Field label="Custo hora gestor" type="number" value={baseline.managerHourlyCostBRL} onChange={(value) => updateBaseline(baseline.id, { managerHourlyCostBRL: num(value) })} />
        <Field label="Custo diario equipamento" type="number" value={baseline.equipmentDailyCostBRL} onChange={(value) => updateBaseline(baseline.id, { equipmentDailyCostBRL: num(value) })} />
      </div>
    </Panel>
  )
}

function ReportPanel({
  report,
  events,
  baseline,
  generateReport,
  markSent,
}: {
  report?: EconomyReport
  events: EconomyEvent[]
  baseline?: EconomyBaseline
  generateReport: () => EconomyReport
  markSent: (id: string) => void
}) {
  const activeReport = report
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={generateReport} className={primaryButtonClass}>Gerar relatorio do mes</button>
        {activeReport && (
          <>
            <button type="button" onClick={() => printEconomyReport(activeReport, events, baseline)} className={secondaryButtonClass}>Imprimir PDF</button>
            <button type="button" onClick={() => markSent(activeReport.id)} className={secondaryButtonClass}>Marcar enviado</button>
          </>
        )}
      </div>
      {activeReport ? (
        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard label="Eventos" value={String(activeReport.detectedEvents)} />
          <KpiCard label="Valor evitado" value={brl(activeReport.avoidedLossBRL)} tone="green" />
          <KpiCard label="ROI" value={`${Math.round(activeReport.roiPercent)}%`} tone="green" />
          <KpiCard label="Status" value={activeReport.status} />
        </div>
      ) : (
        <Panel title="Relatorio mensal"><EmptyText text="Nenhum relatorio gerado para o periodo selecionado." /></Panel>
      )}
    </div>
  )
}

function QbrPanel({ events, baseline }: { events: EconomyEvent[]; baseline?: EconomyBaseline }) {
  const quarterEvents = events.filter((event) => event.status !== 'dismissed').slice(0, 30)
  const total = quarterEvents.reduce((sum, event) => sum + event.impactBRL, 0)
  const fee = (baseline?.platformMonthlyFeeBRL ?? 5000) * 3
  return (
    <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <div className="grid gap-3">
        <KpiCard label="Valor no trimestre" value={brl(total)} tone="green" />
        <KpiCard label="Custo no trimestre" value={brl(fee)} />
        <KpiCard label="ROI trimestral" value={`${Math.round(fee > 0 ? ((total - fee) / fee) * 100 : 0)}%`} tone="green" />
      </div>
      <Panel title="Base para renovacao e upsell">
        <div className="grid gap-3 md:grid-cols-3">
          <QbrItem label="Baseline PPC" before={`${baseline?.ppcPercent ?? 0}%`} after="resultado atual no relatorio" />
          <QbrItem label="Desvio de material" before={`${baseline?.materialDeviationPercent ?? 0}%`} after={`${baseline?.targetMaterialDeviationPercent ?? 0}% meta`} />
          <QbrItem label="Eventos validados" before="0" after={String(quarterEvents.filter((event) => event.status === 'validated' || event.status === 'reported').length)} />
        </div>
      </Panel>
    </div>
  )
}

function KpiCard({ label, value, tone, icon: Icon = BadgeDollarSign }: { label: string; value: string; tone?: 'green' | 'red'; icon?: typeof BadgeDollarSign }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#242424] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-[#a3a3a3]">{label}</span>
        <Icon size={16} className="text-[#f97316]" />
      </div>
      <p className={`mt-3 text-2xl font-semibold ${tone === 'green' ? 'text-emerald-300' : tone === 'red' ? 'text-red-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}

const CATEGORIA_ROTULO: Record<string, string> = {
  materiais: 'Materiais', mao_de_obra: 'Mão de obra', equipamentos: 'Equipamentos',
  subempreiteiros: 'Subempreiteiros', administrativo: 'Administrativo', outro: 'Outros',
}

/**
 * O retrato financeiro da obra — o lado MEDIDO, ao lado do estimado.
 *
 * Cada linha aqui é soma de lançamento que alguém registrou, com a fonte dita em voz alta. É o que
 * faltava para a pergunta do cliente ("uma métrica de economia para a obra") ter chão: sem
 * contrato, financeiro e custo real de mão de obra, o módulo só sabia multiplicar constantes.
 *
 * A folha aparece **ao lado** da saída de mão de obra, nunca somada a ela: a ponte RDO→Financeiro
 * já lança esse custo como saída, e somar contaria o mesmo dinheiro duas vezes.
 */
function RetratoDaObraPanel({ retrato, economiaEstimadaBRL }: {
  retrato: ReturnType<typeof retratoDaObra>
  economiaEstimadaBRL: number
}) {
  if (!retrato.temDados) {
    return (
      <Panel title={`${retrato.obraNome} — o que o sistema sabe`}>
        <EmptyText text="Esta obra ainda não tem contrato cadastrado, lançamento financeiro no mês nem folha calculada. Sem nenhuma das três, não há o que medir." />
      </Panel>
    )
  }
  const dif = retrato.diferencaFolhaCaixaBRL
  return (
    <Panel title={`${retrato.obraNome} — o que o sistema sabe, e de onde`}>
      <div className="space-y-4">
        {retrato.temContrato && (
          <Bloco fonte="Contrato · Torre de Controle">
            <LinhaValor rotulo="Valor de serviço" valor={retrato.contratoServicoBRL} />
            {retrato.contratoMaterialBRL > 0 && (
              <LinhaValor rotulo="Valor de material" valor={retrato.contratoMaterialBRL}
                          nota="faturado à parte; não entra no saldo" />
            )}
            {/* Serviço e material separados: o saldo desconta só o serviço, e mostrar um
                "faturado" único ao lado dele convidava a uma subtração que não fecha. */}
            <LinhaValor rotulo="Faturado — serviço" valor={retrato.faturadoServicoBRL} />
            {retrato.faturadoMaterialBRL > 0 && (
              <LinhaValor rotulo="Faturado — material" valor={retrato.faturadoMaterialBRL}
                          nota="não abate do saldo de serviço" />
            )}
            <LinhaValor rotulo="Saldo de serviço" valor={retrato.saldoServicoBRL} destaque />
          </Bloco>
        )}

        <Bloco fonte="Financeiro · o que está lançado para esta obra no mês">
          {retrato.saidasPorCategoria.length === 0
            ? <EmptyText text="Nenhuma saída lançada para esta obra neste mês." />
            : retrato.saidasPorCategoria.map((c) => (
                <LinhaValor key={c.categoria}
                            rotulo={CATEGORIA_ROTULO[c.categoria] ?? c.categoria}
                            valor={c.valorBRL}
                            nota={`${c.lancamentos} lançamento${c.lancamentos !== 1 ? 's' : ''}`} />
              ))}
          {retrato.saidasBRL > 0 && <LinhaValor rotulo="Soma dos lançamentos" valor={retrato.saidasBRL} destaque />}
          <p className="mt-1.5 text-[11px] leading-5 text-[#a3a3a3]">
            É o que está <b>lançado</b>, e não necessariamente o que saiu do banco. Duas ressalvas
            que valem antes de usar este total: o Financeiro aceita lançamento <b>previsto</b> (a
            Execução do Planejamento posta "mão de obra estimada" aqui), e o <b>mesmo</b> insumo
            pode aparecer duas vezes — o RDO lança o consumo, a baixa da nota lança o pagamento.
            Só entra o que tem esta obra no lançamento: despesa sem obra não é rateada, porque
            dividir administrativo entre obras é decisão de negócio e não conta automática.
          </p>
        </Bloco>

        <Bloco fonte="Mão de obra · apontamentos e turnos, com encargos">
          <LinhaValor rotulo="Folha da obra no mês" valor={retrato.folhaDaObraBRL}
                      nota={`${retrato.folhaHeadcount} pessoa${retrato.folhaHeadcount !== 1 ? 's' : ''} na folha`} />
          {/* A conferência: Escala × RDO. NUNCA contra a categoria inteira — ela tem cinco
              produtores do mesmo custo, e o "rombo" seria só repetição. */}
          {(retrato.saidaMaoDeObraRdoBRL > 0 || retrato.folhaDaObraBRL > 0) && (
            <div className="mt-1.5 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2">
              <p className="text-[11px] leading-5 text-[#d4d4d4]">
                <b>Escala × RDO.</b> Os turnos da Escala dão {brl(retrato.folhaDaObraBRL)}; o que o
                RDO lançou no Financeiro dá {brl(retrato.saidaMaoDeObraRdoBRL)}.{' '}
                {Math.abs(dif) < 0.01
                  ? <span className="text-emerald-300">Batem.</span>
                  : <span className="text-[#e5e5e5]">Diferença de <b>{brl(Math.abs(dif))}</b>.</span>}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[#a3a3a3]">
                São dois registros do mesmo trabalho, por caminhos diferentes — e com fórmulas
                diferentes: a Escala usa valor-hora × horas, o RDO usa custo/dia de quem esteve
                presente. <b>Não se somam, e a diferença não é erro:</b> serve para procurar turno
                sem RDO, RDO sem turno, ou cadastro sem salário bruto.
              </p>
              {retrato.saidaMaoDeObraOutrasBRL > 0 && (
                <p className="mt-1 text-[11px] leading-5 text-[#a3a3a3]">
                  Há outros <b>{brl(retrato.saidaMaoDeObraOutrasBRL)}</b> lançados em mão de obra por
                  outras origens — plano de execução, baixa de título, distribuição, lançamento
                  manual. Ficam fora desta comparação de propósito: podem ser o mesmo trabalho.
                </p>
              )}
            </div>
          )}
        </Bloco>

        {/* O estimado, separado do medido por uma linha e por um rótulo. */}
        <div className="rounded-lg border border-dashed border-[#525252] bg-[#242424] px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">Economia · estimativa</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-emerald-300">{brl(economiaEstimadaBRL)}</p>
          <p className="mt-1 text-[11px] leading-5 text-[#a3a3a3]">
            Este é o único número desta tela que <b>não</b> é soma de lançamento: sai dos eventos do
            período multiplicados pelas premissas da linha de base. Fica aqui embaixo, e à parte, de
            propósito — ele não se soma com nada acima.
          </p>
        </div>
      </div>
    </Panel>
  )
}

/**
 * Quanto do valor do mês tem obra conhecida.
 *
 * Sete dos treze tipos de evento não gravam a obra na origem — o three-way match, as restrições do
 * LPS, as medições e o EVM só têm texto livre. A decisão foi **não adivinhar**: eles contam na
 * carteira e em obra nenhuma. Isso é honesto, mas só se a tela disser — senão o número de uma obra
 * parece o total do mês, e a soma das obras não bate com a carteira sem explicação.
 */
function CoberturaDeObraAviso({ cobertura }: { cobertura: ReturnType<typeof coberturaDeObra> }) {
  if (cobertura.percentual === null || cobertura.semObraEventos === 0) return null
  return (
    <div className="rounded-lg border border-[#525252] bg-[#242424] px-3 py-2.5">
      <p className="text-[11px] leading-5 text-[#d4d4d4]">
        <b>{cobertura.percentual}% do valor deste mês tem obra identificada</b> ({brl(cobertura.comObraBRL)} em{' '}
        {cobertura.comObraEventos} evento{cobertura.comObraEventos !== 1 ? 's' : ''}).
        Os outros {brl(cobertura.semObraBRL)} — {cobertura.semObraEventos} evento
        {cobertura.semObraEventos !== 1 ? 's' : ''} — contam no total da carteira e em obra nenhuma.
      </p>
      <p className="mt-1 text-[11px] leading-5 text-[#a3a3a3]">
        Restrições do LPS, medições, three-way match e EVM não gravam a obra na origem, só texto
        livre. Atribuir obra por semelhança de nome daria número errado sem avisar; para contarem
        por obra, a obra precisa ser preenchida no módulo de origem.
      </p>
    </div>
  )
}

function Bloco({ fonte, children }: { fonte: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#f97316]">{fonte}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function LinhaValor({ rotulo, valor, nota, destaque }: {
  rotulo: string; valor: number; nota?: string; destaque?: boolean
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${destaque ? 'border-t border-[#525252] pt-1.5' : ''}`}>
      <span className={`text-xs ${destaque ? 'font-semibold text-[#f5f5f5]' : 'text-[#d4d4d4]'}`}>
        {rotulo}
        {nota && <span className="ml-1.5 text-[11px] text-[#a3a3a3]">({nota})</span>}
      </span>
      <span className={`shrink-0 tabular-nums ${destaque ? 'text-sm font-bold text-[#f5f5f5]' : 'text-xs text-[#e5e5e5]'}`}>
        {brl(valor)}
      </span>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#525252] bg-[#242424]">
      <div className="border-b border-[#525252] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function HorizontalBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = Math.max(4, Math.min(100, (value / max) * 100))
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-[#d4d4d4]">{label}</span>
        <span className="font-semibold text-emerald-300">{brl(value)}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#333333]">
        <div className="h-full rounded-full bg-[#22c55e]" style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-[#a3a3a3]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-white outline-none focus:border-[#f97316]"
      />
    </label>
  )
}

function StatusPill({ status }: { status: EconomyEventStatus }) {
  const cls = status === 'validated' || status === 'reported'
    ? 'bg-emerald-500/10 text-emerald-300'
    : status === 'dismissed'
      ? 'bg-red-500/10 text-red-300'
      : 'bg-amber-500/10 text-amber-300'
  return <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${cls}`}>{STATUS_LABELS[status]}</span>
}

function QbrItem({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
      <p className="text-xs text-[#a3a3a3]">{label}</p>
      <p className="mt-2 text-sm text-[#d4d4d4]">Antes: {before}</p>
      <p className="mt-1 text-sm font-semibold text-emerald-300">Depois: {after}</p>
    </div>
  )
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-[#a3a3a3]">{text}</p>
}

function groupValue(events: EconomyEvent[], label: (event: EconomyEvent) => string) {
  const map = new Map<string, number>()
  for (const event of events) map.set(label(event), (map.get(label(event)) ?? 0) + event.impactBRL)
  return Array.from(map.entries())
    .map(([rowLabel, value]) => ({ label: rowLabel, value }))
    .sort((a, b) => b.value - a.value)
}

function num(value: string) {
  return Number(value) || 0
}

const selectClass = 'h-9 rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 text-sm text-white outline-none focus:border-[#f97316]'
const primaryButtonClass = 'inline-flex h-9 items-center rounded-lg bg-[#f97316] px-3 text-sm font-semibold text-white hover:bg-[#ea580c]'
const secondaryButtonClass = 'inline-flex h-9 items-center rounded-lg border border-[#525252] px-3 text-sm font-medium text-[#e5e5e5] hover:border-[#f97316]/60 hover:text-white'
