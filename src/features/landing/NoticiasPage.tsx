import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Loader2, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { sanitationNewsItems, newsComplianceNotes, type NewsItem } from './newsData'

type NewsViewItem = NewsItem & {
  publishedAt?: string
  sourceUrl?: string
}

function getSourceType(item: NewsViewItem) {
  if (item.sourceType) return item.sourceType
  if (item.dateLabel.includes('Google News')) return 'Google News RSS'
  if (item.dateLabel.includes('HTML')) return 'HTML monitorado'
  if (item.dateLabel.toLowerCase().includes('oficial') || item.url.includes('gov.br')) return 'Fonte oficial'
  return 'Fonte setorial'
}

function NewsVisual({ item }: { item: NewsViewItem }) {
  const [imageFailed, setImageFailed] = useState(false)
  const tones: Record<NewsItem['imageTone'], string> = {
    water: 'from-[#0f766e] via-[#0ea5e9] to-[#10251c]',
    policy: 'from-[#10251c] via-[#4d7c0f] to-[#f97316]',
    utility: 'from-[#164e63] via-[#2563eb] to-[#10251c]',
    infra: 'from-[#3f3f46] via-[#f97316] to-[#10251c]',
  }

  return (
    <div className={`relative min-h-44 overflow-hidden bg-gradient-to-br ${tones[item.imageTone]}`}>
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(90deg,rgba(255,255,255,.25)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.2)_1px,transparent_1px)] [background-size:22px_22px]" />
      {item.imageUrl && !imageFailed ? (
        <img
          src={item.imageUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-[#10251c]/90 to-transparent p-5">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-white/72">{item.source}</p>
        <p className="mt-2 font-['Space_Grotesk'] text-2xl font-medium leading-tight text-white">{item.category}</p>
      </div>
    </div>
  )
}

function NewsCard({ item }: { item: NewsViewItem }) {
  const sourceType = getSourceType(item)
  return (
    <article className="flex h-full flex-col border border-[#10251c]/14 bg-[#fffaf0]/72">
      <NewsVisual item={item} />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-[#10251c]/14 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#f97316]">{item.category}</span>
          <span className="border border-[#10251c]/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#10251c]/42">{sourceType}</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#10251c]/42">{item.dateLabel}</span>
        </div>
        <h3 className="mt-5 font-['Space_Grotesk'] text-2xl font-medium leading-tight text-[#10251c]">{item.title}</h3>
        <p className="mt-4 flex-1 text-sm leading-7 text-[#10251c]/68">{item.summary}</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[#10251c]/10 pt-4 text-xs">
          <div>
            <dt className="font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#10251c]/38">Fonte</dt>
            <dd className="mt-1 font-semibold text-[#10251c]/70">{item.source}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#10251c]/38">Monitoramento</dt>
            <dd className="mt-1 font-semibold text-[#10251c]/70">{sourceType}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#10251c]/38">Categoria</dt>
            <dd className="mt-1 font-semibold text-[#10251c]/70">{item.category}</dd>
          </div>
          <div>
            <dt className="font-mono text-[9px] font-black uppercase tracking-[0.14em] text-[#10251c]/38">Atualização</dt>
            <dd className="mt-1 font-semibold text-[#10251c]/70">{item.dateLabel}</dd>
          </div>
        </dl>
        <div className="mt-6 flex items-center justify-between gap-4 border-t border-[#10251c]/14 pt-4">
          <span className="truncate text-xs font-semibold text-[#10251c]/60">{item.source}</span>
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[#f97316] hover:text-[#ea580c]">
            Ler na fonte <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </article>
  )
}

export function NoticiasPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Todas')
  const [source, setSource] = useState('Todas')
  const [sourceType, setSourceType] = useState('Todos')
  const [items, setItems] = useState<NewsViewItem[]>(sanitationNewsItems)
  const [isLoading, setIsLoading] = useState(true)
  const [loadStatus, setLoadStatus] = useState('Curadoria local carregada')

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    fetch('/api/sanitation-news')
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<{ items?: NewsViewItem[]; checkedSources?: number; okSources?: number; failedSources?: number }>
      })
      .then((payload) => {
        if (!isMounted) return
        if (payload.items?.length) {
          setItems(payload.items)
          setLoadStatus(`${payload.items.length} notícias carregadas; ${payload.okSources ?? 0} fontes responderam e ${payload.failedSources ?? 0} falharam.`)
        } else {
          setLoadStatus('API sem itens novos; exibindo curadoria local.')
        }
      })
      .catch(() => {
        if (!isMounted) return
        setLoadStatus('Curadoria local exibida; atualização automática indisponível neste momento.')
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })
    return () => { isMounted = false }
  }, [])

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(items.map((item) => item.category))).sort()], [items])
  const sources = useMemo(() => ['Todas', ...Array.from(new Set(items.map((item) => item.source))).sort()], [items])
  const sourceTypes = useMemo(() => ['Todos', ...Array.from(new Set(items.map((item) => getSourceType(item)))).sort()], [items])
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return items.filter((item) => {
      const matchesCategory = category === 'Todas' || item.category === category
      const matchesSource = source === 'Todas' || item.source === source
      const matchesSourceType = sourceType === 'Todos' || getSourceType(item) === sourceType
      const haystack = `${item.title} ${item.source} ${item.category} ${item.summary} ${getSourceType(item)}`.toLowerCase()
      return matchesCategory && matchesSource && matchesSourceType && (!normalizedQuery || haystack.includes(normalizedQuery))
    })
  }, [category, items, query, source, sourceType])

  return (
    <main className="min-h-screen bg-[#f5f0e5] text-[#10251c]">
      <section className="border-b border-[#10251c]/14 px-5 py-8 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#10251c]/70 hover:text-[#f97316]">
            <ArrowLeft size={16} />
            Voltar para a landing
          </Link>
          <div className="flex flex-wrap gap-2">
            {newsComplianceNotes.map((note) => (
              <span key={note} className="inline-flex items-center gap-1.5 border border-[#10251c]/14 bg-[#fffaf0]/72 px-3 py-1.5 text-[11px] font-semibold text-[#10251c]/62">
                <ShieldCheck size={13} className="text-[#f97316]" />
                {note}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 md:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-[#f97316]">Radar do Saneamento</p>
          <h1 className="mt-6 max-w-4xl font-['Space_Grotesk'] text-5xl font-medium leading-tight text-[#10251c] sm:text-7xl">
            Notícias completas na fonte, com curadoria segura no ConstruData.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#10251c]/68">
            Usamos fontes oficiais, setoriais e RSS como descoberta. Aqui aparecem título, resumo próprio, fonte, categoria e imagem disponível por feed ou OpenGraph; a matéria completa fica sempre no site original.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 border border-[#10251c]/14 bg-[#fffaf0]/72 px-3 py-2 text-xs font-semibold text-[#10251c]/62">
            {isLoading ? <Loader2 size={14} className="animate-spin text-[#f97316]" /> : <ShieldCheck size={14} className="text-[#f97316]" />}
            {loadStatus}
          </div>
          <div className="mt-10 grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem_16rem_16rem]">
            <label className="flex items-center gap-3 border border-[#10251c]/14 bg-[#fffaf0]/80 px-4 py-3">
              <Search size={18} className="text-[#f97316]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por fonte, tema ou palavra-chave"
                className="w-full bg-transparent text-sm font-semibold text-[#10251c] outline-none placeholder:text-[#10251c]/42"
              />
            </label>
            <label className="flex items-center gap-3 border border-[#10251c]/14 bg-[#fffaf0]/80 px-4 py-3">
              <SlidersHorizontal size={16} className="text-[#f97316]" />
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="w-full bg-transparent text-sm font-bold text-[#10251c] outline-none">
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <select value={source} onChange={(event) => setSource(event.target.value)} className="border border-[#10251c]/14 bg-[#fffaf0]/80 px-4 py-3 text-sm font-bold text-[#10251c] outline-none">
              {sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={sourceType} onChange={(event) => setSourceType(event.target.value)} className="border border-[#10251c]/14 bg-[#fffaf0]/80 px-4 py-3 text-sm font-bold text-[#10251c] outline-none">
              {sourceTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="px-5 pb-20 md:px-10">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => <NewsCard key={item.id} item={item} />)}
        </div>
        {!filteredItems.length && (
          <div className="mx-auto max-w-7xl border border-[#10251c]/14 bg-[#fffaf0]/72 p-8 text-sm font-semibold text-[#10251c]/62">
            Nenhuma notícia encontrada com esses filtros.
          </div>
        )}
      </section>
    </main>
  )
}
