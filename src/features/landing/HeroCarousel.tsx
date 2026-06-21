/**
 * HeroCarousel — carrossel da hero com 3 slides: o slide principal (foto de
 * obra de fundo + texto + cena animada da obra conectada) e dois slides com
 * foto de obra full-bleed, overlay escuro e headline. Autoplay de 7s pausado
 * em hover/foco/toque, em aba oculta e em prefers-reduced-motion; setas, dots
 * e swipe no mobile.
 *
 * Para trocar as fotos: substitua os arquivos em public/obras/
 * (hero-slide-1.webp — fundo do slide principal, em LandingPage.tsx —, e
 * hero-slide-2.webp / hero-slide-3.webp) — sem tocar em código.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

const M_FONT = "font-['IBM_Plex_Mono']"
const H_FONT = "font-['Inter_Tight']"
const DEMO_ANCHOR = '#solicitar'

const PHOTO_SLIDES: Array<{ src: string; eyebrow: string; title: string }> = [
  {
    src: '/obras/hero-slide-2.webp',
    eyebrow: 'Como entramos na sua obra',
    title: 'Não vendemos um sistema. Adaptamos a sua operação e a conectamos.',
  },
  {
    src: '/obras/hero-slide-3.webp',
    eyebrow: 'Diferencial único',
    title: 'Dado de campo virando decisão executiva em segundos, não em dias.',
  },
]

const SLIDE_COUNT = 3
const AUTOPLAY_MS = 7000

export function HeroCarousel({ children }: { children: ReactNode }) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchX = useRef<number | null>(null)

  const next = useCallback(() => setIdx((i) => (i + 1) % SLIDE_COUNT), [])
  const prev = useCallback(() => setIdx((i) => (i - 1 + SLIDE_COUNT) % SLIDE_COUNT), [])

  useEffect(() => {
    if (paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => {
      if (!document.hidden) next()
    }, AUTOPLAY_MS)
    return () => clearInterval(t)
  }, [paused, next])

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Destaques da ConstruData"
      className="relative overflow-hidden bg-[#0d0d0d]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => { setPaused(true); touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        setPaused(false)
        if (touchX.current === null) return
        const delta = e.changedTouches[0].clientX - touchX.current
        if (delta < -50) next()
        else if (delta > 50) prev()
        touchX.current = null
      }}
    >
      {/* trilho: o slide 1 fica no fluxo normal e define a altura do
          carrossel (nunca corta conteúdo); os slides de foto sobrepõem. */}
      <div className="relative">
        {/* Slide 1 — hero principal (texto + cena animada) */}
        <div
          role="group"
          aria-roledescription="slide"
          aria-label="1 de 3"
          aria-hidden={idx !== 0}
          className={`transition-opacity duration-700 ${idx === 0 ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
        >
          {children}
          {/* respiro inferior para os controles do carrossel */}
          <div aria-hidden className="h-16" />
        </div>

        {/* Slides 2 e 3 — foto full-bleed + headline */}
        {PHOTO_SLIDES.map((slide, i) => {
          const slideIdx = i + 1
          const active = idx === slideIdx
          return (
            <div
              key={slide.src}
              role="group"
              aria-roledescription="slide"
              aria-label={`${slideIdx + 1} de 3`}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-700 ${active ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0'}`}
            >
              <img
                src={slide.src}
                alt=""
                width={1408}
                height={768}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/35" />
              <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-24 pt-32 md:px-10">
                <p className={`${M_FONT} text-[10px] font-medium uppercase tracking-[0.18em] text-white/70 sm:text-[11px]`}>
                  [ {slide.eyebrow} ]
                </p>
                <h2 className={`${H_FONT} mt-5 max-w-3xl text-3xl font-medium leading-[1.06] tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl`}>
                  {slide.title}
                </h2>
                <div className="mt-8">
                  <a
                    href={DEMO_ANCHOR}
                    className={`${M_FONT} group inline-flex min-h-12 items-center justify-center gap-3 bg-[#f97316] px-7 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-[#ea580c]`}
                  >
                    Solicitar demonstração <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
                  </a>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Controles */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={prev}
          aria-label="Slide anterior"
          className="pointer-events-auto flex size-9 items-center justify-center border border-white/30 text-white/80 transition hover:border-white hover:text-white"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="pointer-events-auto flex items-center gap-2.5">
          {Array.from({ length: SLIDE_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`Ir para o slide ${i + 1}`}
              aria-current={idx === i}
              className={`h-1.5 transition-all duration-300 ${
                idx === i ? 'w-7 bg-[#f97316]' : 'w-3 bg-white/30 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          aria-label="Próximo slide"
          className="pointer-events-auto flex size-9 items-center justify-center border border-white/30 text-white/80 transition hover:border-white hover:text-white"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  )
}
