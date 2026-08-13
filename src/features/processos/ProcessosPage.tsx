import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Clock3,
  GitBranch,
  ListTree,
  Search,
  Sparkles,
  Workflow,
} from 'lucide-react'
import { MapaProcessos } from './components/MapaProcessos.tsx'
import type { EvidenciaAgregada, ResultadoDescoberta } from './core/index.ts'
import { useDadosProcessos } from './useDadosProcessos.ts'

type Aba = 'overview' | 'variants' | 'cases' | 'definition'
type Categoria = keyof Pick<ResultadoDescoberta,
  | 'loops'
  | 'rework'
  | 'repeatedActivities'
  | 'forbiddenTransitions'
  | 'incompleteLifecycles'
  | 'ambiguousOrderings'
  | 'possibleConcurrency'
>

const ABAS: Array<{ key: Aba; label: string }> = [
  { key: 'overview', label: 'Visão geral' },
  { key: 'variants', label: 'Variações' },
  { key: 'cases', label: 'Casos' },
  { key: 'definition', label: 'Definição' },
]

const CATEGORIAS: Array<{ key: Categoria; label: string; help: string }> = [
  { key: 'loops', label: 'Loops', help: 'Retornos para atividades já observadas no caso.' },
  { key: 'rework', label: 'Retrabalho', help: 'Retornos classificados por regras configuradas.' },
  { key: 'repeatedActivities', label: 'Repetições', help: 'Atividades repetidas sem presumir retrabalho.' },
  { key: 'forbiddenTransitions', label: 'Desvios', help: 'Transições proibidas pela definição versionada.' },
  { key: 'incompleteLifecycles', label: 'Lifecycle incompleto', help: 'Inícios ou términos sem seu par.' },
  { key: 'ambiguousOrderings', label: 'Ordem ambígua', help: 'Timestamp e sequência não determinam uma relação confiável.' },
  { key: 'possibleConcurrency', label: 'Possível concorrência', help: 'Sobreposição temporal observada; não prova paralelismo estrutural.' },
]

function formatDuration(durationMs: number | null) {
  if (durationMs === null) return 'Em andamento'
  const hours = durationMs / 3_600_000
  return hours >= 48 ? `${(hours / 24).toFixed(1)} dias` : `${hours.toFixed(1)} h`
}

function CartaoMetrica({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Workflow }) {
  return (
    <div className="rounded-2xl border border-[#404040] bg-[#262626] p-4">
      <div className="flex items-center justify-between text-xs text-[#a3a3a3]">
        <span>{label}</span><Icon size={16} className="text-[#f97316]" />
      </div>
      <div className="mt-2 text-2xl font-semibold text-[#fafafa]">{value}</div>
    </div>
  )
}

function VisaoGeral({ result }: { result: ResultadoDescoberta }) {
  const anomalies = result.loops.reduce((sum, item) => sum + item.caseCount, 0)
    + result.forbiddenTransitions.reduce((sum, item) => sum + item.caseCount, 0)
    + result.incompleteLifecycles.reduce((sum, item) => sum + item.caseCount, 0)
    + result.ambiguousOrderings.reduce((sum, item) => sum + item.caseCount, 0)
    + result.possibleConcurrency.reduce((sum, item) => sum + item.caseCount, 0)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CartaoMetrica label="Eventos" value={result.input.eventCount.toLocaleString('pt-BR')} icon={ListTree} />
        <CartaoMetrica label="Casos" value={result.input.caseCount.toLocaleString('pt-BR')} icon={Boxes} />
        <CartaoMetrica label="Atividades" value={result.nodes.length.toLocaleString('pt-BR')} icon={Workflow} />
        <CartaoMetrica label="Variantes" value={result.paths.length.toLocaleString('pt-BR')} icon={GitBranch} />
        <CartaoMetrica label="Sinais analíticos" value={anomalies.toLocaleString('pt-BR')} icon={AlertTriangle} />
      </div>
      <MapaProcessos result={result} />
    </div>
  )
}

function descricaoEvidencia(item: EvidenciaAgregada) {
  const details = item as unknown as Record<string, unknown>
  if (typeof details.from === 'string' && typeof details.to === 'string') return `${details.from} → ${details.to}`
  if (typeof details.activity === 'string') return details.activity
  if (typeof details.firstActivity === 'string' && typeof details.secondActivity === 'string') {
    return `${details.firstActivity} ↔ ${details.secondActivity}`
  }
  if (typeof details.label === 'string') return details.label
  return item.key
}

function Variacoes({ result }: { result: ResultadoDescoberta }) {
  const [category, setCategory] = useState<Categoria>('loops')
  const items: EvidenciaAgregada[] = result[category]
  const selected = CATEGORIAS.find(({ key }) => key === category)!
  return (
    <div className="grid gap-4 xl:grid-cols-[290px_1fr]">
      <div className="space-y-2">
        {CATEGORIAS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setCategory(item.key)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition ${category === item.key ? 'border-[#f97316]/60 bg-[#f97316]/10 text-white' : 'border-[#404040] bg-[#262626] text-[#bdbdbd] hover:border-[#525252]'}`}
          >
            <span>{item.label}</span>
            <span className="rounded-full bg-[#171717] px-2 py-0.5 text-[10px] text-[#f97316]">{result[item.key].length}</span>
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-[#404040] bg-[#262626] p-5">
        <h2 className="text-base font-semibold text-white">{selected.label}</h2>
        <p className="mt-1 text-xs text-[#a3a3a3]">{selected.help}</p>
        <div className="mt-4 space-y-2">
          {items.length === 0 && <div className="rounded-xl border border-dashed border-[#525252] p-6 text-center text-sm text-[#737373]">Nenhuma ocorrência detectada.</div>}
          {items.map((item) => (
            <div key={item.key} className="rounded-xl border border-[#404040] bg-[#1f1f1f] p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm font-medium text-[#f5f5f5]">{descricaoEvidencia(item)}</div>
                <div className="whitespace-nowrap text-xs text-[#f97316]">{item.occurrenceCount.toLocaleString('pt-BR')} ocorrências</div>
              </div>
              <div className="mt-1 text-xs text-[#8a8a8a]">{item.caseCount.toLocaleString('pt-BR')} casos · exemplos: {item.exampleCaseIds.slice(0, 3).join(', ')}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Casos({ data }: { data: ReturnType<typeof useDadosProcessos> }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
      <div className="overflow-hidden rounded-2xl border border-[#404040] bg-[#262626]">
        <div className="border-b border-[#404040] p-3">
          <label className="flex items-center gap-2 rounded-xl border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-[#d4d4d4]">
            <Search size={15} className="text-[#737373]" />
            <input
              value={data.search}
              onChange={(event) => data.setSearch(event.target.value)}
              placeholder="Buscar case_id"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#666]"
            />
          </label>
        </div>
        <div className="divide-y divide-[#383838]">
          {data.caseSummaries.map((summary) => (
            <button
              key={summary.caseId}
              type="button"
              onClick={() => data.selecionarCaso(summary.caseId)}
              className={`grid w-full grid-cols-[1fr_auto] gap-3 p-3 text-left transition hover:bg-[#303030] ${data.selectedCaseId === summary.caseId ? 'bg-[#f97316]/8' : ''}`}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[#ededed]">{summary.caseId}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {summary.hasLoop && <Tag label="loop" />}
                  {summary.hasRework && <Tag label="retrabalho" />}
                  {summary.hasDeviation && <Tag label="desvio" />}
                  {summary.hasPossibleConcurrency && <Tag label="sobreposição" />}
                  {summary.hasAnomaly && <Tag label="anomalia" />}
                </div>
              </div>
              <div className="text-right text-xs text-[#8f8f8f]">
                <div>{formatDuration(summary.durationMs)}</div>
                <div className="mt-1">{summary.eventCount} eventos</div>
              </div>
            </button>
          ))}
          {data.caseSummaries.length === 0 && <div className="p-8 text-center text-sm text-[#737373]">Nenhum caso encontrado.</div>}
        </div>
        <div className="flex items-center justify-between border-t border-[#404040] p-3 text-xs text-[#8f8f8f]">
          <span>{data.totalCases.toLocaleString('pt-BR')} casos</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={data.page === 0} onClick={() => data.setPage(Math.max(0, data.page - 1))} className="rounded-lg border border-[#525252] p-1.5 disabled:opacity-30"><ChevronLeft size={14} /></button>
            <span>Página {data.page + 1}</span>
            <button type="button" disabled={(data.page + 1) * data.pageSize >= data.totalCases} onClick={() => data.setPage(data.page + 1)} className="rounded-lg border border-[#525252] p-1.5 disabled:opacity-30"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-[#404040] bg-[#262626] p-4">
        <h2 className="text-sm font-semibold text-white">Timeline do log original</h2>
        <p className="mt-1 truncate text-xs text-[#737373]">{data.selectedCaseId || 'Selecione um caso'}</p>
        <div className="mt-4 space-y-0">
          {data.caseEvents.map((event, index) => (
            <div key={event.eventId} className="relative flex gap-3 pb-4">
              {index < data.caseEvents.length - 1 && <div className="absolute left-[7px] top-4 h-full w-px bg-[#525252]" />}
              <div className="relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-[#f97316] bg-[#262626]" />
              <div className="min-w-0">
                <div className="text-sm text-[#ededed]">{event.activity} <span className="text-[#f97316]">{event.lifecycle ?? 'instantaneous'}</span></div>
                <div className="mt-0.5 text-[11px] text-[#737373]">{new Date(event.occurredAt).toLocaleString('pt-BR')} · seq. {event.sequenceNumber ?? '—'}</div>
                <div className="truncate text-[10px] text-[#5f5f5f]">{event.objectType}: {event.objectId}</div>
              </div>
            </div>
          ))}
          {data.selectedCaseId && data.caseEvents.length === 0 && <div className="text-sm text-[#737373]">Carregando eventos…</div>}
        </div>
      </div>
    </div>
  )
}

function Tag({ label }: { label: string }) {
  return <span className="rounded-full border border-[#f97316]/25 bg-[#f97316]/8 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#fb923c]">{label}</span>
}

function Definicao({ data }: { data: ReturnType<typeof useDadosProcessos> }) {
  const definition = data.selectedDefinition
  if (!definition) return null
  const sections = [
    ['Mappings de origem', definition.sourceMappings],
    ['Feature mappings', definition.featureMappings],
    ['Modelo configurado', definition.processModel],
    ['KPIs', definition.kpiDefinitions],
    ['SLAs', definition.slaDefinitions],
  ] as const
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <CartaoMetrica label="Versão" value={`v${definition.version}`} icon={GitBranch} />
        <CartaoMetrica label="Timezone" value={definition.timezone} icon={Clock3} />
        <CartaoMetrica label="Objeto de caso" value={definition.caseObjectType} icon={Boxes} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {sections.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#404040] bg-[#262626] p-4">
            <h2 className="text-sm font-semibold text-white">{label}</h2>
            <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-[#171717] p-3 text-[11px] leading-relaxed text-[#b7b7b7]">{JSON.stringify(value, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProcessosPage() {
  const data = useDadosProcessos()
  const [tab, setTab] = useState<Aba>('overview')
  const result = data.selectedSnapshot?.result ?? null
  const emptyMessage = useMemo(() => {
    if (data.definitions.length === 0) return 'Crie uma definição de processo e ingira eventos canônicos para começar.'
    return 'A definição existe, mas ainda não há snapshot de descoberta pronto.'
  }, [data.definitions.length])

  return (
    <div className="min-h-full bg-[#1b1b1b] p-4 text-[#ededed] sm:p-6">
      <div className="mx-auto max-w-[1680px]">
        <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-[#f97316]/30 bg-[#f97316]/10 p-2 text-[#f97316]"><Workflow size={20} /></div>
              <div>
                <h1 className="text-xl font-semibold text-white">Processos</h1>
                <p className="text-xs text-[#8f8f8f]">Descoberta do fluxo real a partir do log de eventos do ConstruData.</p>
              </div>
              {data.isDemoMode && <span className="ml-2 flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold text-cyan-300"><Sparkles size={11} /> DEMO LOCAL</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={data.selectedDefinitionId} onChange={(event) => data.setSelectedDefinitionId(event.target.value)} className="rounded-xl border border-[#525252] bg-[#262626] px-3 py-2 text-xs text-[#ededed] outline-none">
              <option value="">Selecione o processo</option>
              {data.definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.name} · v{definition.version}</option>)}
            </select>
            <select value={data.selectedSnapshotId} onChange={(event) => data.setSelectedSnapshotId(event.target.value)} className="rounded-xl border border-[#525252] bg-[#262626] px-3 py-2 text-xs text-[#ededed] outline-none">
              <option value="">Selecione o snapshot</option>
              {data.snapshots.map((snapshot) => <option key={snapshot.id} value={snapshot.id}>{snapshot.id === 'demo-local' ? 'Fixture canônica local' : new Date(snapshot.generatedAt).toLocaleString('pt-BR')}</option>)}
            </select>
          </div>
        </header>

        {data.error && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{data.error}</div>}
        {data.loading && <div className="mb-4 text-xs text-[#8f8f8f]">Carregando dados do módulo…</div>}

        {!result ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-[#525252] bg-[#222] p-8 text-center">
            <div className="max-w-lg">
              <Workflow size={42} className="mx-auto text-[#f97316]" />
              <h2 className="mt-4 text-lg font-semibold text-white">Processos está pronto para receber dados</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#929292]">{emptyMessage}</p>
              <p className="mt-3 text-xs text-[#666]">O navegador é somente leitura. A ingestão e a materialização acontecem server-side.</p>
            </div>
          </div>
        ) : (
          <>
            <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-[#404040] bg-[#262626] p-1">
              {ABAS.map((item) => (
                <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`rounded-lg px-4 py-2 text-xs font-medium transition ${tab === item.key ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:bg-[#333] hover:text-white'}`}>{item.label}</button>
              ))}
            </nav>
            {tab === 'overview' && <VisaoGeral result={result} />}
            {tab === 'variants' && <Variacoes result={result} />}
            {tab === 'cases' && <Casos data={data} />}
            {tab === 'definition' && <Definicao data={data} />}
          </>
        )}
      </div>
    </div>
  )
}
