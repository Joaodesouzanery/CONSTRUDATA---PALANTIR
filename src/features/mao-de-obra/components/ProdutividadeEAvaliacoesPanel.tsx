/**
 * Produtividade e Avaliações.
 *
 * ⚠️ SUB-ABAS, e não uma tela só — de propósito. Medi antes de juntar: não há **nenhuma**
 * referência cruzada entre os dois no código, e eles têm ESCOPOS DIFERENTES:
 *
 *  · Produtividade é RUP (homem-hora ÷ m²), filtrada pela **obra ativa** (`useObraScopedLabor`);
 *  · Avaliações é a ficha quinzenal por pessoa, **global**, sem recorte de obra.
 *
 * Numa tela contínua, a metade de cima falaria de uma obra e a de baixo da empresa inteira, com os
 * dois números lado a lado parecendo comparáveis. É exatamente o defeito que o CMO já teve e
 * corrigiu. Separados por sub-aba, cada um diz de onde fala.
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ProdutividadePanel } from './ProdutividadePanel'
import { AvaliacoesPanel } from './AvaliacoesPanel'
import type { MaoDeObraTab } from '@/store/maoDeObraStore'

type Visao = 'produtividade' | 'avaliacoes'

export function ProdutividadeEAvaliacoesPanel({ onNavigate }: { onNavigate: (tab: MaoDeObraTab) => void }) {
  const [visao, setVisao] = useState<Visao>('produtividade')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1">
        {([['produtividade', 'Produtividade', 'RUP por serviço — recortada pela obra ativa'],
           ['avaliacoes', 'Avaliações', 'Ficha quinzenal por pessoa — todas as obras']] as const).map(([id, rotulo, ajuda]) => (
          <button
            key={id} type="button" onClick={() => setVisao(id)} title={ajuda}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              visao === id ? 'bg-[#f97316] text-white' : 'border border-[#525252] text-[#adadad] hover:text-[#f5f5f5]',
            )}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {/* O recorte de cada um fica dito na tela, não só no título da sub-aba. */}
      <p className="text-[11px] text-[#6b6b6b]">
        {visao === 'produtividade'
          ? 'Os números abaixo são da obra selecionada na barra lateral.'
          : 'As avaliações são de todas as obras — não seguem a obra selecionada.'}
      </p>

      {visao === 'produtividade' ? <ProdutividadePanel onNavigate={onNavigate} /> : <AvaliacoesPanel />}
    </div>
  )
}
