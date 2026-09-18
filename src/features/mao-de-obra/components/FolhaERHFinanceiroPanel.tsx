/**
 * Folha e RH Financeiro.
 *
 * ─── ⚠️ A DIVERGÊNCIA QUE A FUSÃO OBRIGOU A RESOLVER ──────────────────────────
 * As duas telas liam `payrollHistory` de formas incompatíveis, e ninguém tinha notado:
 *
 *  · **Folha** procurava `payrollHistory.find(p => p.month === mes)` e, não achando, mostrava o
 *    estado vazio *"nenhuma folha gerada"*;
 *  · **RH Financeiro** não achava e **calculava na hora**, com `generateMonthPayroll` — a mesma
 *    função que o store usa ao gerar.
 *
 * Ou seja: no mês corrente, antes de alguém apertar "Gerar Folha", uma tela dizia que não havia
 * folha e a outra já mostrava o valor. Duas respostas para a mesma pergunta, a uma aba de
 * distância.
 *
 * **A semântica escolhida é a do RH Financeiro:** o cálculo aparece sempre, marcado como
 * **prévia** enquanto a folha não foi fechada. "Gerar Folha" deixa de significar "calcular" e passa
 * a significar **congelar** — que é o que ela sempre fez de fato (grava em `payrollHistory`).
 */
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { FolhaPagamentoPanel } from './FolhaPagamentoPanel'
import { RHFinanceiroPanel } from './RHFinanceiroPanel'

type Visao = 'folha' | 'financeiro'

export function FolhaERHFinanceiroPanel() {
  const [visao, setVisao] = useState<Visao>('folha')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1">
        {([['folha', 'Folha de Pagamento', 'Holerites do mês, encargos e conferências'],
           ['financeiro', 'RH Financeiro', 'Custo por departamento, orçamento e tendência']] as const).map(([id, rotulo, ajuda]) => (
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

      {visao === 'folha' ? <FolhaPagamentoPanel /> : <RHFinanceiroPanel />}
    </div>
  )
}
