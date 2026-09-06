/**
 * O `?` que explica um indicador na própria tela.
 *
 * ─── POR QUE ISTO É COMPARTILHADO ─────────────────────────────────────────────
 * O produto fala EVM, CPI, SPI, EAC, TCPI, "defasagem", "ticket", "capital recomendado" — e quem
 * abre a tela é um encarregado de obra, não um controller. Um número que a pessoa não sabe ler é
 * um número que ela ignora, e um indicador ignorado é pior que ausente: ele ocupa espaço e dá a
 * impressão de que alguém está olhando.
 *
 * O padrão nasceu dentro de `PainelIndicadores` e estava preso lá. Aqui ele fica onde qualquer
 * tela alcança.
 *
 * ─── AS TRÊS DECISÕES QUE PARECEM DETALHE E NÃO SÃO ───────────────────────────
 * **1. `Popover`, nunca `HoverCard`.** O encarregado usa celular, e `HoverCard` não abre no toque:
 * a explicação simplesmente não existiria para metade das pessoas. O hover é um extra do desktop,
 * ligado só quando `pointerType === 'mouse'` — senão o toque dispara `pointerenter` E `click`, e o
 * popover abre e fecha no mesmo gesto.
 *
 * **2. Quem fecha no hover é o CONTEÚDO, não o botão.** O conteúdo vive num Portal, então não é
 * descendente do botão no DOM. Fechar ao sair do `?` matava o popover no caminho do cursor até
 * ele — e no desktop esse caminho é justamente como se lê a explicação.
 *
 * **3. `onOpenAutoFocus` prevenido.** Sem isso o Radix rouba o foco ao abrir por hover e a página
 * pula.
 *
 * ⚠️ **`oQueFalta` é obrigatório quando o indicador está sem base.** Um card cinza que não diz o
 * que preencher ensina a pessoa a ignorá-lo. É a regra que o `PainelIndicadores` já impunha e que
 * agora vale para todo mundo.
 */
import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Explicacao } from './explicacao'

export function OQueE({ titulo, explicacao, className }: {
  /** O nome do indicador, como ele aparece na tela. */
  titulo: string
  explicacao: Explicacao
  className?: string
}) {
  const [aberto, setAberto] = useState(false)

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`O que é "${titulo}"`}
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') setAberto(true) }}
          className={`shrink-0 rounded text-[#a3a3a3] transition-colors hover:text-[#f5f5f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffa055]/50 ${className ?? ''}`}
        >
          <HelpCircle size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end" className="w-72 border-[#525252] bg-[#333333] p-3"
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setAberto(false) }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-[11px] font-bold text-[#f5f5f5]">{titulo}</p>
        <p className="mt-1.5 text-[11px] leading-5 text-[#d4d4d4]">{explicacao.oQueE}</p>
        <p className="mt-2 text-[11px] leading-5 text-[#a3a3a3]">
          <b className="text-[#d4d4d4]">De onde vem: </b>{explicacao.deOndeVem}
        </p>
        {explicacao.oQueFalta && (
          <p className="mt-2 rounded border border-[#eab308]/40 bg-[#eab308]/10 px-2 py-1.5 text-[11px] leading-5 text-[#fbbf24]">
            {explicacao.oQueFalta}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
