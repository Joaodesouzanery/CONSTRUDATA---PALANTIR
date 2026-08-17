/**
 * VideoShowcase — o vídeo "A plataforma em operação", logo abaixo da hero.
 *
 * Regra que sustenta o componente: **zero byte de vídeo antes do clique**. Por isso não
 * existe um `<video>` no DOM enquanto ninguém clicou — nem com `preload="none"`. Um
 * `<video>` montado já custa requisição: o padrão de `preload` no Chrome e no Safari é
 * `metadata`, e `loading="lazy"` não vale para mídia (o browser olha geometria, não
 * opacidade — o mesmo motivo documentado em HeroCarousel.tsx:37-39). A única garantia é
 * não montar o elemento.
 *
 * A resolução é escolhida DENTRO do onClick, nunca no render: a landing é pré-renderizada
 * com renderToString (src/prerender.tsx) e hidratada inteira com hydrateRoot (src/main.tsx),
 * então ler `window`/`matchMedia` durante o render quebraria o build ou faria a hidratação
 * divergir e descartar a página toda. Handler só roda no browser e só depois da hidratação.
 *
 * TROCAR O CORTE: rode `node scripts/encodar-video-landing.mjs videos/source/<master>.mp4`,
 * que gera os dois MP4 e o pôster com a receita versionada. Três coisas andam juntas e é fácil
 * esquecer uma:
 *
 *  1. **Suba o número da versão nos nomes** (`-v2` → `-v3`), aqui e no script. O `vercel.json`
 *     serve `/videos/` com `max-age=604800`: regravar por cima do mesmo nome deixa quem já
 *     assistiu vendo o corte velho por sete dias, e parece que a troca não pegou.
 *  2. Confira `DURACAO` abaixo.
 *  3. Reescreva o `<figcaption>` em LandingPage.tsx — é a alternativa em texto do vídeo
 *     (WCAG 1.2.1) e descreve o que se vê, cena a cena. Se o corte muda e ela fica, vira ficção.
 *
 * O master NÃO pode ficar em `public/`: tudo ali é copiado inteiro para o deploy. Guarde em
 * `videos/source/`, que o `videos/.gitignore` já ignora.
 */
import { useCallback, useRef, useState, type SyntheticEvent } from 'react'

const M_FONT = 'font-label'

const POSTER = '/videos/plataforma-poster-v2.webp'
export const DURACAO = '2 min 47 s'

/** Uma resolução por faixa de tela. Sem WebM: os dois MP4 já ficaram enxutos, e um par
 *  extra de arquivos pesaria no repositório mais do que economizaria em banda. */
const FONTES = {
  '720': '/videos/plataforma-720-v2.mp4',
  '1080': '/videos/plataforma-1080-v2.mp4',
} as const

type Qualidade = keyof typeof FONTES

/**
 * Decide a resolução. SÓ pode ser chamada de dentro de um event handler — lê
 * window/navigator, o que quebraria o pré-render se rodasse durante o render.
 * `larguraCaixa` é a largura real já medida do container, não a do viewport.
 */
function escolherQualidade(larguraCaixa: number): Qualidade {
  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection

  // Economia de dados é escolha explícita do usuário: vence qualquer outro critério.
  if (conn?.saveData) return '720'
  if (conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') return '720'
  if (window.matchMedia('(prefers-reduced-data: reduce)').matches) return '720'

  // Celular: 720p sempre (mesmo ponto de corte do breakpoint md do Tailwind).
  if (window.matchMedia('(max-width: 767px)').matches) return '720'

  // Só vale 1080p se a caixa tiver pixels FÍSICOS para isso. O DPR é limitado a 2 —
  // num monitor 3x, triplicar o download não muda nada que o olho perceba em vídeo.
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  return larguraCaixa * dpr >= 900 ? '1080' : '720'
}

export function VideoShowcase() {
  const caixaRef = useRef<HTMLDivElement>(null)
  // null = fachada. É o estado do servidor E o da primeira renderização do cliente:
  // as duas árvores nascem idênticas, então não há o que divergir na hidratação.
  const [qualidade, setQualidade] = useState<Qualidade | null>(null)
  const [precisaTocar, setPrecisaTocar] = useState(false)
  const [falhou, setFalhou] = useState(false)

  const iniciar = useCallback(() => {
    const largura = caixaRef.current?.getBoundingClientRect().width ?? window.innerWidth
    setQualidade(escolherQualidade(largura))
  }, [])

  // O usuário mexeu nos controles: a rede de segurança abaixo perde a vez. Fica em ref,
  // não em state, porque não muda nada na tela e não pode causar re-render no meio do play.
  const usuarioAssumiu = useRef(false)

  const prepararRef = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return
    // A política de autoplay lê a PROPRIEDADE `muted`, não o atributo — garantir as duas.
    el.defaultMuted = true
    el.muted = true
    // O botão que tinha o foco acabou de ser desmontado neste mesmo commit. Sem isto o foco
    // volta para o <body> e quem navega por teclado perde o lugar na página.
    el.focus({ preventScroll: true })
  }, [])

  // `autoPlay` resolve o caso normal; isto é a rede de segurança para quem o ignora
  // (iOS em Modo de Baixo Consumo, Firefox com autoplay bloqueado por site).
  // play() devolve Promise: sem .catch() vira unhandledrejection, que main.tsx loga.
  const tentarTocar = useCallback((e: SyntheticEvent<HTMLVideoElement>) => {
    const el = e.currentTarget
    if (usuarioAssumiu.current || !el.paused) return
    el.play().then(() => setPrecisaTocar(false), () => setPrecisaTocar(true))
  }, [])

  // Uma pausa antes do `loadeddata` só pode ter vindo do usuário — o autoplay não emite
  // `pause`. Sem esta marca, a rede de segurança daria play por cima de quem pausou.
  const marcarPausa = useCallback(() => { usuarioAssumiu.current = true }, [])

  return (
    // aspect-video no WRAPPER e os dois filhos em absolute: a altura nunca vem do filho,
    // então trocar <img> por <video> não desloca nada (CLS 0) e não pisca no tamanho
    // intrínseco padrão de <video>, que é 300×150.
    <div ref={caixaRef} className="relative aspect-video overflow-hidden bg-[#0d0d0d]">
      {qualidade === null ? (
        <>
          <img
            src={POSTER}
            alt=""
            width={1920}
            height={1080}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Botão de verdade: recebe foco no Tab e dispara com Enter e Espaço de graça.
              type="button" é obrigatório — a página tem um <form>, e o padrão é submit. */}
          <button
            type="button"
            onClick={iniciar}
            aria-label={`Assistir ao vídeo: a plataforma ConstruData em operação. Duração ${DURACAO}, sem áudio.`}
            /* O pôster já é escuro (#0d0d0d): um véu forte apagaria o produto que ele mostra.
               25% basta para o botão e o rótulo terem contraste. */
            className="group absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-3 bg-black/25 transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[#e5484d]"
          >
            <span
              aria-hidden
              className="flex size-14 items-center justify-center border border-white/50 bg-black/30 text-white backdrop-blur-[1px] transition-colors group-hover:border-[#e5484d] group-hover:bg-[#e5484d] sm:size-16"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            {/* Duas linhas: numa só, o rótulo com tracking largo ocupava a largura inteira
                de um celular de 390px e competia com o pôster. */}
            <span className={`${M_FONT} flex flex-col items-center gap-1 px-4 text-center text-[10px] font-semibold uppercase tracking-[0.18em]`}>
              <span className="text-white">Assistir</span>
              <span className="text-[9px] tracking-[0.14em] text-white/65">{DURACAO} · sem áudio</span>
            </span>
          </button>
        </>
      ) : (
        <>
          {/* key={qualidade}: se a fonte mudar, o React remonta o elemento em vez de mutar
              o <source>. Mutar <source> de um <video> já montado não tem efeito nenhum —
              o algoritmo de seleção de fonte roda uma vez só. */}
          <video
            key={qualidade}
            ref={prepararRef}
            src={FONTES[qualidade]}
            poster={POSTER}
            width={1920}
            height={1080}
            controls
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-label="A plataforma ConstruData em operação — vídeo sem áudio"
            className="absolute inset-0 h-full w-full bg-[#0d0d0d] object-cover"
            onLoadedData={tentarTocar}
            onPlaying={() => setPrecisaTocar(false)}
            onPause={marcarPausa}
            onError={() => setFalhou(true)}
          />

          {precisaTocar && !falhou && (
            <p className={`${M_FONT} pointer-events-none absolute inset-x-0 top-0 bg-black/70 px-4 py-2 text-center text-[10px] uppercase tracking-[0.14em] text-white/85`}>
              Toque em play para iniciar
            </p>
          )}

          {falhou && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
              <p className="text-sm text-white/80">Não foi possível reproduzir o vídeo neste navegador.</p>
              <a
                href={FONTES[qualidade]}
                className={`${M_FONT} text-[10px] font-semibold uppercase tracking-[0.14em] text-white underline underline-offset-4`}
              >
                Abrir o arquivo diretamente
              </a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
