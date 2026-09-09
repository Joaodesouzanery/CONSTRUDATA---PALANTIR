/**
 * Medição — o boletim de medição do contrato: quanto foi executado, quanto isso vale.
 *
 * ─── POR QUE ESTA ABA NASCE VAZIA ─────────────────────────────────────────────
 * A navegação entra primeiro, sozinha, porque ela é o que se pode conferir na tela sem tocar em
 * dado nenhum. O motor vem nas fatias seguintes, contra o arquivo real do cliente — é a mesma
 * ordem que o Controle de Caixa e o FCP seguiram, e a razão é a mesma: parser escrito sem o
 * arquivo na mão chuta cabeçalho, célula mesclada e onde cada bloco começa.
 *
 * ⚠️ **Não confundir com "Avanço Ponderado"**, ao lado. Aquela aba (que até hoje se chamava
 * "Medição Ponderada") é a matriz de peso do EVM — `0,30·financeiro + 0,25·duração +
 * 0,30·econômico + 0,15·específico` — e responde "quanto da obra andou". Esta responde "quanto
 * disso vira dinheiro, item por item do contrato". São perguntas diferentes, e o nome único que
 * as duas dividiam escondia isso.
 */
import { Ruler } from 'lucide-react'

export function MedicaoPanel() {
  const item = 'flex gap-2 text-[#c9c9c9]'
  const marca = <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#f97316]" />

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl rounded-xl border border-[#525252] bg-[#333333] p-6">
        <div className="flex items-center gap-2">
          <Ruler size={18} className="text-[#f97316]" />
          <h2 className="text-sm font-bold text-[#f5f5f5]">Medição do contrato</h2>
          <span className="rounded-full border border-[#f97316]/40 bg-[#f97316]/10 px-2 py-0.5 text-[10px] font-semibold text-[#ffa055]">
            em construção
          </span>
        </div>

        <p className="mt-3 text-xs leading-6 text-[#c9c9c9]">
          Esta aba vai transformar o que a equipe executou em campo no valor exato da medição —
          item a item do contrato, e não por estimativa. Hoje esse número é digitado à mão como
          uma Entrada no Financeiro.
        </p>

        <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-[#6b6b6b]">O que vem</p>
        <ul className="mt-2 space-y-1.5 text-[11px] leading-5">
          <li className={item}>{marca}<span><strong className="text-[#f5f5f5]">O catálogo do contrato</strong> — os serviços com preço cheio, o repasse aplicado, e o código de cada região.</span></li>
          <li className={item}>{marca}<span><strong className="text-[#f5f5f5]">A planilha de medição</strong>, lida com conferência antes de gravar: o que muda se eu importar isto, nunca só "importar?".</span></li>
          <li className={item}>{marca}<span><strong className="text-[#f5f5f5]">A fila de exceção</strong> — item com preço a conferir não entra na soma. Fica separado, com o motivo escrito, até alguém confirmar.</span></li>
          <li className={item}>{marca}<span><strong className="text-[#f5f5f5]">A Entrada no Financeiro</strong>, gerada por botão a partir da medição fechada — com o valor calculado, não digitado.</span></li>
        </ul>

        <p className="mt-4 rounded-lg border border-[#eab308]/40 bg-[#eab308]/10 px-3 py-2 text-[11px] leading-5 text-[#fbbf24]">
          ⚠️ Uma coisa não vai aparecer no primeiro dia: a coluna <strong>Saldo</strong> (quanto
          falta medir). Ela precisa da quantidade contratada por item, que vem da planilha de
          balanceamento — e essa ainda não chegou. A tela vai mostrar o campo vazio e dizer isso,
          em vez de inventar um número.
        </p>
      </div>
    </div>
  )
}
