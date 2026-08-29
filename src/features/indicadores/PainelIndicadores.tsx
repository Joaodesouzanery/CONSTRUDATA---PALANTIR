/**
 * Os quatro cartões da tela de abertura.
 *
 * ─── DUAS DECISÕES DE INTERFACE QUE VALEM DEFENDER ────────────────────────────
 *
 * **1. `sem-dado` é cinza, e o cartão diz o que falta.** O produto vinha mostrando um CPI de 1,00
 * em verde sobre um campo que não existe no modelo. Aqui, indicador que não sabe parece que não
 * sabe — e ensina o que preencher para ele passar a saber.
 *
 * **2. A explicação não é `HoverCard`.** O encarregado usa celular, e `HoverCard` não abre no
 * toque: a explicação simplesmente não existiria para metade das pessoas. É um `Popover` num botão
 * `?`, que abre no clique em qualquer aparelho e também no passar do mouse no desktop — o hover só
 * é ligado quando `pointerType === 'mouse'`, senão o toque dispararia os dois eventos e o popover
 * abriria e fecharia sozinho.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HelpCircle } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useIndicadores } from './useIndicadores'
import type { Indicador, TomIndicador } from './utils/indicadores'

/** Cinza para "não sei". Nunca verde — é a regra que este painel existe para impor. */
const TOM: Record<TomIndicador, { valor: string; borda: string; fundo: string }> = {
  ok:         { valor: 'text-[#4ade80]', borda: 'border-[#525252]',      fundo: 'bg-[#333333]' },
  atencao:    { valor: 'text-[#fbbf24]', borda: 'border-[#eab308]/40',   fundo: 'bg-[#eab308]/[0.06]' },
  grave:      { valor: 'text-[#fca5a5]', borda: 'border-[#ef4444]/40',   fundo: 'bg-[#ef4444]/[0.06]' },
  'sem-dado': { valor: 'text-[#a3a3a3]', borda: 'border-[#525252]',      fundo: 'bg-[#2c2c2c]' },
}

export function PainelIndicadores() {
  const { indicadores, obrasAtivas } = useIndicadores()

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pt-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map((i) => <Cartao key={i.id} indicador={i} />)}
      </div>
      <p className="mt-2 text-[11px] text-[#a3a3a3]">
        {obrasAtivas === 0
          ? 'Nenhuma obra ativa cadastrada.'
          : `Todas as ${obrasAtivas} obra${obrasAtivas !== 1 ? 's' : ''} ativa${obrasAtivas !== 1 ? 's' : ''}. Obra arquivada fica de fora.`}
      </p>
    </section>
  )
}

function Cartao({ indicador }: { indicador: Indicador }) {
  const navigate = useNavigate()
  const [aberto, setAberto] = useState(false)
  const tom = TOM[indicador.tom]

  return (
    <div className={`relative rounded-xl border ${tom.borda} ${tom.fundo} p-3.5`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
          {indicador.titulo}
        </p>

        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`O que é "${indicador.titulo}"`}
              // O hover só no mouse: no toque o navegador dispara pointerenter E click, e o
              // popover abriria e fecharia no mesmo gesto.
              //
              // ⚠️ Só ABRE no hover; quem fecha é o Radix (clique fora, Esc) ou o `onPointerLeave`
              // do conteúdo. O `PopoverContent` vive num Portal, então NÃO é descendente do botão
              // no DOM: fechar aqui ao sair do `?` matava o popover no caminho do cursor até ele —
              // e no desktop o hover é justamente o único caminho para a explicação.
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setAberto(true) }}
              className="shrink-0 rounded text-[#a3a3a3] hover:text-[#f5f5f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffa055]/50"
            >
              <HelpCircle size={13} />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end" className="w-72 border-[#525252] bg-[#333333] p-3"
            // Fecha ao sair do próprio conteúdo — e não ao sair do botão. Assim o cursor pode
            // atravessar o vão entre os dois.
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setAberto(false) }}
            // Sem isto o Radix rouba o foco ao abrir por hover, e a página pula.
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <p className="text-[11px] font-bold text-[#f5f5f5]">{indicador.titulo}</p>
            <p className="mt-1.5 text-[11px] leading-5 text-[#d4d4d4]">{indicador.explicacao.oQueE}</p>
            <p className="mt-2 text-[11px] leading-5 text-[#a3a3a3]">
              <b className="text-[#d4d4d4]">De onde vem: </b>{indicador.explicacao.deOndeVem}
            </p>
            {indicador.explicacao.oQueFalta && (
              <p className="mt-2 rounded border border-[#eab308]/40 bg-[#eab308]/10 px-2 py-1.5 text-[11px] leading-5 text-[#fbbf24]">
                {indicador.explicacao.oQueFalta}
              </p>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <button
        type="button"
        onClick={() => navigate(indicador.destino)}
        className="mt-1.5 block w-full text-left"
      >
        <p className={`text-2xl font-bold tabular-nums ${tom.valor}`}>{indicador.valor}</p>
        <p className="mt-1 text-[11px] leading-4 text-[#d4d4d4]">{indicador.detalhe}</p>
      </button>
    </div>
  )
}
