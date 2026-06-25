const NEWS_SOURCES = [
  { id: 'trata-brasil', source: 'Instituto Trata Brasil', category: 'Indicadores', sourceType: 'Fonte setorial', url: 'https://tratabrasil.org.br/' },
  { id: 'ias', source: 'Instituto Água e Saneamento', category: 'Dados públicos', sourceType: 'Fonte setorial', url: 'https://www.aguaesaneamento.org.br/' },
  { id: 'abes', source: 'ABES', category: 'Técnico', sourceType: 'Fonte setorial', url: 'https://abes-dn.org.br/' },
  { id: 'saneamento-hoje', source: 'Saneamento Hoje', category: 'Mercado', sourceType: 'Fonte setorial', url: 'https://saneamentohoje.com.br/' },
  { id: 'aesbe', source: 'AESBE', category: 'Operadoras', sourceType: 'Fonte setorial', url: 'https://aesbe.org.br/' },
  { id: 'sindae', source: 'SINDAE', category: 'Institucional', sourceType: 'Fonte setorial', url: 'https://www.sindae.org.br/' },
  { id: 'cebds', source: 'CEBDS', category: 'Sustentabilidade', sourceType: 'Fonte setorial', url: 'https://cebds.org/' },
  { id: 'o-eco', source: 'O Eco', category: 'Ambiental', sourceType: 'Fonte setorial', url: 'https://oeco.org.br/' },
  { id: 'abha', source: 'ABHA - Águas do Brasil', category: 'Recursos hídricos', sourceType: 'Fonte setorial', url: 'https://agenciaabha.com.br/' },
  { id: 'caesb', source: 'Caesb', category: 'Operadoras', sourceType: 'Fonte oficial', url: 'https://www.caesb.df.gov.br/' },
  { id: 'ana', source: 'ANA', category: 'Regulação', sourceType: 'Fonte oficial', url: 'https://www.gov.br/ana/' },
  { id: 'aegea', source: 'Aegea', category: 'Operadoras', sourceType: 'Fonte oficial', url: 'https://www.aegea.com.br/' },
  { id: 'copasa', source: 'Copasa', category: 'Operadoras', sourceType: 'HTML monitorado', url: 'https://www.copasa.com.br/' },
  { id: 'igua', source: 'Iguá Saneamento', category: 'Operadoras', sourceType: 'HTML monitorado', url: 'https://igua.com.br/' },
  { id: 'funasa', source: 'FUNASA', category: 'Governo', sourceType: 'HTML monitorado', url: 'https://www.gov.br/funasa/' },
  { id: 'cagece', source: 'CAGECE', category: 'Operadoras', sourceType: 'Fonte oficial', url: 'https://www.cagece.com.br/' },
  { id: 'cedae', source: 'CEDAE', category: 'Operadoras', sourceType: 'HTML monitorado', url: 'https://cedae.com.br/' },
  { id: 'corsan', source: 'Corsan', category: 'Operadoras', sourceType: 'Fonte oficial', url: 'https://www.corsan.com.br/' },
  { id: 'casan', source: 'Casan', category: 'Operadoras', sourceType: 'Fonte oficial', url: 'https://www.casan.com.br/' },
  { id: 'gn-sabesp', source: 'Sabesp', category: 'Operadoras', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Sabesp%20saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-embasa', source: 'Embasa', category: 'Operadoras', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Embasa%20saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-saneamento-brasil', source: 'Google News', category: 'Radar RSS', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Saneamento%20Brasil&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-marco-legal', source: 'Google News', category: 'Regulação', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Marco%20Legal%20Saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-tratamento-agua', source: 'Google News', category: 'Tecnologia', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Tratamento%20de%20%C3%81gua&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-esgoto', source: 'Google News', category: 'Esgotamento', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Esgoto%20e%20Saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-concessoes', source: 'Google News', category: 'Mercado', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Concess%C3%B5es%20Saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-recursos-hidricos', source: 'Google News', category: 'Recursos hídricos', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Recursos%20H%C3%ADdricos&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-brk', source: 'Google News', category: 'Operadoras', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=BRK%20Ambiental&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-igua', source: 'Google News', category: 'Operadoras', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Igu%C3%A1%20Saneamento&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-copasa-mg', source: 'Google News', category: 'Operadoras', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Copasa%20MG&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
  { id: 'gn-sanepar-pr', source: 'Google News', category: 'Operadoras', sourceType: 'Google News RSS', url: 'https://news.google.com/rss/search?q=Sanepar%20PR&hl=pt-BR&gl=BR&ceid=BR%3Apt-419' },
]

const ENTITY_MAP = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' }

function decode(value = '') {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&([a-z]+);/gi, (_, key) => ENTITY_MAP[key] ?? `&${key};`)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return match ? decode(match[1]) : ''
}

function attr(block, pattern) {
  const match = block.match(pattern)
  return match ? decode(match[1]) : ''
}

function absoluteUrl(value, base) {
  if (!value) return ''
  try {
    return new URL(value, base).toString()
  } catch {
    return value
  }
}

function canonicalUrl(value) {
  try {
    const url = new URL(value)
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ocid|cmpid)/i.test(key)) url.searchParams.delete(key)
    }
    return url.toString()
  } catch {
    return value
  }
}

function imageFromBlock(block, baseUrl) {
  return absoluteUrl(
    attr(block, /<media:content[^>]+url=["']([^"']+)["']/i) ||
      attr(block, /<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
      attr(block, /<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image\//i) ||
      attr(block, /<img[^>]+src=["']([^"']+)["']/i),
    baseUrl,
  )
}

function toneFor(category) {
  const normalized = category.toLowerCase()
  if (normalized.includes('regul') || normalized.includes('governo')) return 'policy'
  if (normalized.includes('operadora') || normalized.includes('tecnologia')) return 'utility'
  if (normalized.includes('mercado') || normalized.includes('infra') || normalized.includes('esgot')) return 'infra'
  return 'water'
}

function parseRss(xml, source) {
  const blocks = [...xml.matchAll(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi)].map((match) => match[0])
  return blocks.slice(0, 3).map((block, index) => {
    const link = tag(block, 'link') || attr(block, /<link[^>]+href=["']([^"']+)["']/i) || source.url
    const description = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content:encoded')
    const publishedAt = tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published')
    const url = canonicalUrl(absoluteUrl(link, source.url))
    return {
      id: `${source.id}-${index}`,
      title: tag(block, 'title') || source.source,
      source: source.source,
      category: source.category,
      sourceType: source.sourceType,
      dateLabel: publishedAt ? new Date(publishedAt).toLocaleDateString('pt-BR') : source.sourceType,
      publishedAt,
      summary: decode(description).slice(0, 420) || `Atualização monitorada em ${source.source}.`,
      url,
      sourceUrl: source.url,
      imageUrl: imageFromBlock(block, source.url),
      imageTone: toneFor(source.category),
    }
  })
}

function parseHtml(html, source) {
  const title =
    attr(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    attr(html, /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i) ||
    tag(html, 'title') ||
    source.source
  const summary =
    attr(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
    attr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    `Fonte monitorada para notícias e comunicados de saneamento em ${source.source}.`
  const canonical =
    attr(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    attr(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ||
    source.url
  const imageUrl = absoluteUrl(
    attr(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      attr(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i),
    source.url,
  )
  return [{
    id: `${source.id}-home`,
    title,
    source: source.source,
    category: source.category,
    sourceType: source.sourceType,
    dateLabel: source.sourceType,
    summary: decode(summary).slice(0, 420),
    url: canonicalUrl(absoluteUrl(canonical, source.url)),
    sourceUrl: source.url,
    imageUrl,
    imageTone: toneFor(source.category),
  }]
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      accept: 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'ConstrudataNewsQA/1.0 (+https://www.construdata.software/noticias)',
    },
    signal: AbortSignal.timeout(9000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('xml') || text.includes('<rss') || text.includes('<feed')) {
    const items = parseRss(text, source)
    return items.length ? items : parseHtml(text, source)
  }
  return parseHtml(text, source)
}

function dedupeByUrl(items) {
  const seen = new Set()
  return items.filter((item) => {
    const key = canonicalUrl(item.url)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export default async function handler(req, res) {
  // Protege o endpoint contra chamadas externas (cada hit dispara ~30 fetches).
  // O Vercel anexa `Authorization: Bearer <CRON_SECRET>` às execuções de cron
  // quando a env CRON_SECRET está configurada. Sem CRON_SECRET, mantém o
  // comportamento atual (não quebra antes de você configurar o segredo).
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && (req.headers?.authorization || '') !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600')
  try {
    const settled = await Promise.allSettled(NEWS_SOURCES.map(fetchSource))
    const items = dedupeByUrl(settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []))
    const status = settled.map((result, index) => ({
      source: NEWS_SOURCES[index].source,
      ok: result.status === 'fulfilled',
      count: result.status === 'fulfilled' ? result.value.length : 0,
      error: result.status === 'rejected' ? String(result.reason?.message ?? result.reason) : undefined,
    }))
    res.status(200).json({
      checkedSources: NEWS_SOURCES.length,
      okSources: status.filter((item) => item.ok).length,
      failedSources: status.filter((item) => !item.ok).length,
      status,
      items: items.slice(0, 72),
    })
  } catch (error) {
    res.status(500).json({ error: String(error?.message ?? error), items: [] })
  }
}
