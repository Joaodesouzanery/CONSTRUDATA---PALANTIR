/**
 * Editar e excluir — um componente só, para as 17 ocorrências que existiam soltas.
 *
 * ─── O QUE HAVIA ANTES ────────────────────────────────────────────────────────
 * Dezessete botões, **cinco padrões visuais diferentes**, nenhum componente compartilhado:
 *
 *  - 8 deles em `#6b6b6b` — 2,0:1 sobre o card do módulo. Estavam pintados e praticamente
 *    invisíveis; o cliente disse "estão difíceis de visualizar", e o problema não era o ícone,
 *    era o cinza.
 *  - Ícones de 12px e texto de 10px, com área de clique de ~20×20px.
 *  - **Os dois piores:** os de Equipes eram `opacity-0` até o hover. Em tablet no canteiro não
 *    existe hover — eram literalmente inalcançáveis. E usavam engrenagem e "X" no lugar de lápis
 *    e lixeira.
 *  - Três palavras para a mesma ação: "Excluir", "Remover", "Apagar".
 *  - Só 6 dos 17 tinham `title`. E um deles apagava sem perguntar nada.
 *
 * ─── O QUE VALE AGORA ─────────────────────────────────────────────────────────
 * Ícone de 15px em área de 32×32 (alvo de toque), cor que passa 4,5:1, **sempre visível**,
 * `title` e `aria-label` obrigatórios, e uma palavra só: **Excluir**. A confirmação é padrão e
 * não dá para esquecer — quem não quiser passa `confirmar={false}`.
 */
import { Pencil, Trash2 } from 'lucide-react'

interface Props {
  /** O que está sendo mexido: "a falta de João em 12/08", "o posto Bloco A". Vai no aviso. */
  descricao: string
  onEditar?: () => void
  onExcluir?: () => void
  /** Some com os botões quando o papel do usuário não autoriza escrever. */
  podeEscrever?: boolean
  /**
   * Texto extra da confirmação — para dizer o que mais vai junto.
   * Ex.: "O desconto do dia na folha será desfeito."
   */
  consequencia?: string
  /** `false` só para o que é trivialmente refazível. O padrão é perguntar. */
  confirmar?: boolean
}

export function AcoesDaLinha({
  descricao, onEditar, onExcluir, podeEscrever = true, consequencia, confirmar = true,
}: Props) {
  if (!podeEscrever) return null

  function excluir() {
    if (!onExcluir) return
    if (confirmar) {
      const msg = `Excluir ${descricao}?` + (consequencia ? `\n\n${consequencia}` : '')
      if (!window.confirm(msg)) return
    }
    onExcluir()
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {onEditar && (
        <button
          type="button" onClick={onEditar}
          title={`Editar ${descricao}`} aria-label={`Editar ${descricao}`}
          className="flex size-8 items-center justify-center rounded-lg text-[#c9c9c9]
                     hover:bg-[#ffa055]/15 hover:text-[#ffa055] focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-[#ffa055]/50"
        >
          <Pencil size={15} />
        </button>
      )}
      {onExcluir && (
        <button
          type="button" onClick={excluir}
          title={`Excluir ${descricao}`} aria-label={`Excluir ${descricao}`}
          className="flex size-8 items-center justify-center rounded-lg text-[#c9c9c9]
                     hover:bg-[#fca5a5]/15 hover:text-[#fca5a5] focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-[#fca5a5]/50"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}
