/**
 * PagamentosPanel — Contas a pagar / a receber + lembretes de vencimento.
 * Placeholder da Fase A: a implementação completa (store `financeiroTitulosStore`,
 * tabela `financeiro_titulos`, baixa → lançamento no Financeiro e badge de
 * vencimentos no menu) entra na Fase C.
 */
import { CalendarClock } from 'lucide-react'

export function PagamentosPanel() {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center justify-center text-center gap-3 rounded-2xl border border-dashed border-[#525252] bg-[#333333] py-16 px-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#f97316]/15">
          <CalendarClock size={24} className="text-[#f97316]" />
        </div>
        <h2 className="text-white font-semibold text-lg">Pagamentos e Cobranças</h2>
        <p className="text-[#a3a3a3] text-sm max-w-md">
          Contas a pagar e a receber com controle de vencimentos, parcelas e
          lembretes automáticos no app. A baixa de um título gera o lançamento
          correspondente no Financeiro e alimenta o Fluxo de Caixa previsto.
        </p>
        <span className="mt-1 text-xs font-medium text-[#f97316] bg-[#f97316]/10 rounded-full px-3 py-1">
          Em breve
        </span>
      </div>
    </div>
  )
}
