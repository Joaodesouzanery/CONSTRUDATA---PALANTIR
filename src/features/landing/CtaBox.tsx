/**
 * CtaBox — o botão em quadro da landing. Um componente para os nove CTAs da página.
 *
 * A REGRA DE DESENHO: **nenhum botão é preenchido**. Todos são contornados, do mesmo tamanho,
 * e o vermelho marca *qual é o caminho preferido* — não "qual é o botão importante desta
 * seção". O preenchimento só aparece no hover, como recompensa.
 *
 * O escopo do vermelho é o CARD, não a seção. Dentro de um card há no máximo uma caixa
 * vermelha, e ela é a ação daquele card. Na seção final isso dá duas: a agenda no card do
 * Calendly e o envio no card do formulário nativo — que são ações diferentes, em cartões
 * separados, e nenhuma delas compete pelo mesmo clique. Onde os CTAs dividem a mesma linha
 * (o trio de `DemoCTA`), aí sim vale uma só, e é sempre agendar.
 *
 * `surface` é a cor do FUNDO onde a caixa está, não a cor dela. Cuidado ao migrar código
 * antigo: a prop `tone` do `DemoCTA` era invertida — `tone="light"` queria dizer *texto claro
 * sobre fundo escuro*, ou seja, `surface="dark"`.
 *
 * ── CONTRASTE: por que estas classes e não as óbvias ──────────────────────────────────────
 * Sem preenchimento, o contorno *é* o componente: ele precisa passar 3:1 (WCAG 1.4.11), e o
 * rótulo 4,5:1. Os valores abaixo foram medidos, e vários dos "naturais" reprovam:
 *
 *   - `border-black/30`, o hairline padrão da landing, dá 2,10:1 — reprova. O piso é `black/45`.
 *   - `#e5484d` como TEXTO sobre fundo claro dá 3,91:1 — reprova. Serve de borda, nunca de
 *     rótulo; para texto vermelho sobre claro o único que passa é `#b42318` (6,57:1).
 *   - No hero o fundo NÃO é `#0d0d0d`: é uma fotografia sob um véu preto, com estouros de
 *     branco. Medido no pior slide, `text-white/85` dá 4,15:1 (reprova) e `border-white/40` dá
 *     2,20:1 (reprova). Daí texto branco puro e `border-white/70`.
 *   - Sobre essa mesma foto, nenhum vermelho passa 3:1 sozinho. O `bg-black/30` das variantes
 *     escuras é o que leva a borda a 3,16:1. Ele NÃO é preenchimento de botão: é o mesmo véu
 *     nas duas variantes, então não cria hierarquia — existe só para o contorno ser visível.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CtaVariant = 'primary' | 'neutral'
/** Cor do FUNDO onde a caixa está — não a cor da caixa. */
export type CtaSurface = 'light' | 'dark'
export type CtaSize = 'md' | 'sm'
export type CtaIcon = 'right' | 'external' | 'anchor' | 'none'

const BASE = 'font-label group inline-flex items-center justify-center border text-center font-semibold uppercase '
  + 'tracking-[0.14em] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 [&_svg]:shrink-0'

const TAMANHO: Record<CtaSize, string> = {
  md: 'min-h-12 gap-2.5 px-4 py-3.5 text-[10px] sm:px-6 sm:text-[11px]',
  sm: 'min-h-9 gap-2 px-3 py-2 text-[10px] sm:px-4',
}

// As chaves são strings literais inteiras de propósito: o Tailwind v4 lê o texto-fonte, e uma
// classe montada como `border-${cor}` simplesmente não gera CSS nenhum.
const APARENCIA: Record<`${CtaSurface}-${CtaVariant}`, string> = {
  'light-primary': 'border-[#cc2b33] text-[#b42318] hover:bg-[#cc2b33] hover:text-white focus-visible:outline-[#b42318]',
  'light-neutral': 'border-black/45 text-[#0a0a0a] hover:border-[#0a0a0a] hover:bg-black/[0.04] focus-visible:outline-[#0a0a0a]',
  'dark-primary':  'border-[#f87171] bg-black/30 text-white hover:bg-[#cc2b33] focus-visible:outline-white',
  'dark-neutral':  'border-white/70 bg-black/30 text-white hover:border-white hover:bg-white/10 focus-visible:outline-white',
}

/** Opacidade apagaria o contorno junto com o texto, e a caixa sumiria da tela. */
const DESABILITADO = 'disabled:cursor-not-allowed disabled:border-black/25 disabled:text-black/40 '
  + 'disabled:hover:bg-transparent disabled:hover:border-black/25'

type Comum = {
  children: ReactNode
  variant?: CtaVariant
  surface?: CtaSurface
  size?: CtaSize
  icon?: CtaIcon
  /** Rótulo alternativo para telas estreitas. Os DOIS são renderizados; o CSS esconde um. */
  shortLabel?: string
  shortLabelUntil?: 'sm' | 'md'
  className?: string
}

type ComoLink = Comum & { href: string; external?: boolean }
  & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className' | 'children'>
type ComoBotao = Comum & { href?: undefined; external?: never }
  & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>

function Icone({ tipo, size }: { tipo: CtaIcon; size: CtaSize }) {
  const g = size === 'sm' ? 13 : 15
  if (tipo === 'none') return null
  // Setas diferentes por SIGNIFICADO, não por peso: sai do site × rola a página.
  if (tipo === 'external') return <ArrowUpRight size={g} className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
  if (tipo === 'anchor') return <ArrowDown size={g} className="transition-transform duration-200 group-hover:translate-y-0.5" />
  return <ArrowRight size={g} className="transition-transform duration-200 group-hover:translate-x-1" />
}

export function CtaBox(props: ComoLink | ComoBotao) {
  const {
    children, variant = 'neutral', surface = 'light', size = 'md',
    icon, shortLabel, shortLabelUntil = 'sm', className, ...resto
  } = props as Comum & { href?: string; external?: boolean } & Record<string, unknown>

  const ehLink = typeof props.href === 'string'
  const externo = ehLink && (props as ComoLink).external === true
  const tipoIcone: CtaIcon = icon ?? (externo ? 'external' : 'right')

  const bp = shortLabelUntil === 'md'
    ? { curto: 'md:hidden', longo: 'hidden md:inline', semIcone: 'max-md:hidden' }
    : { curto: 'sm:hidden', longo: 'hidden sm:inline', semIcone: 'max-sm:hidden' }

  const classes = cn(BASE, TAMANHO[size], APARENCIA[`${surface}-${variant}`], !ehLink && DESABILITADO, className)

  const conteudo = (
    <>
      {shortLabel
        ? (<><span className={bp.curto}>{shortLabel}</span><span className={bp.longo}>{children}</span></>)
        : children}
      <span className={shortLabel ? bp.semIcone : undefined}><Icone tipo={tipoIcone} size={size} /></span>
    </>
  )

  // `external` é prop nossa e não existe no DOM: precisa sair antes do spread, senão o React
  // avisa no console sobre atributo desconhecido em toda renderização.
  const { external: _, href, ...atributos } = resto as { external?: boolean; href?: string }
  void _

  if (ehLink) {
    return (
      <a
        href={href}
        {...(externo ? { target: '_blank', rel: 'noopener noreferrer' } : null)}
        {...(atributos as AnchorHTMLAttributes<HTMLAnchorElement>)}
        className={classes}
      >
        {conteudo}
      </a>
    )
  }

  return (
    <button type="button" {...(atributos as ButtonHTMLAttributes<HTMLButtonElement>)} className={classes}>
      {conteudo}
    </button>
  )
}
