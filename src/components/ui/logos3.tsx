interface Logo {
  id: string
  description: string
  image: string
  className?: string
}

interface Logos3Props {
  heading?: string
  logos?: Logo[]
  className?: string
}

const defaultLogos: Logo[] = [
  {
    id: 'engelfer',
    description: 'Engelfer Engenharia',
    image: '/logos/social-proof/engelfer-horizontal.png',
    className: 'h-20 w-auto md:h-24',
  },
  {
    id: 'atlantico',
    description: 'Atlantico',
    image: '/logos/social-proof/atlantico.jpg',
    className: 'h-24 w-auto md:h-28',
  },
  {
    id: 'cslnr',
    description: 'Consorcio Se Liga na Rede-Santos',
    image: '/logos/social-proof/cslnr.jpg',
    className: 'h-24 w-auto md:h-28',
  },
  {
    id: 'vr',
    description: 'VR',
    image: '/logos/social-proof/vr.jfif',
    className: 'h-20 w-auto md:h-24',
  },
  {
    id: 'engelfer-selo',
    description: 'Engelfer Engenharia',
    image: '/logos/social-proof/engelfer-selo.png',
    className: 'h-28 w-auto md:h-32',
  },
]

function Logos3({
  heading = 'Empresas que confiam no ConstruData',
  logos = defaultLogos,
  className = '',
}: Logos3Props) {
  const carouselLogos = [...logos, ...logos]

  return (
    <section className={`px-0 py-14 ${className}`}>
      <div className="mx-auto max-w-3xl text-center">
        <h3 className="text-3xl font-black uppercase leading-tight text-[#1f2420] sm:text-5xl">
          {heading}
        </h3>
      </div>

      <div className="relative mt-12 overflow-hidden py-5">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#fbf7ee] to-transparent sm:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#fbf7ee] to-transparent sm:w-24" />

        <div className="logos3-track flex w-max items-center gap-16 pr-16">
          {carouselLogos.map((logo, index) => (
            <div
              key={`${logo.id}-${index}`}
              className="flex h-36 w-64 shrink-0 items-center justify-center"
            >
              <img
                src={logo.image}
                alt={logo.description}
                className={`max-h-full max-w-full object-contain ${logo.className ?? 'h-20 w-auto'}`}
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export { Logos3 }
