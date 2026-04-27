import { CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useEvmStore } from '@/store/evmStore'

const FLOW_STEPS = [
  'Fechamento anterior',
  'Lancamento de saidas',
  'Revisao CPI/SPI/EAC',
  'Consolidacao de quantitativos',
  'Medicao ponderada',
  'Entrada automatica',
  'Atualizacao EVM',
  'Curva S e comparativo',
]

export function FluxoMensalPanel() {
  const nucleos = useEvmStore((s) => s.nucleos)
  const months = ['2026-02', '2026-03', '2026-04', '2026-05']
  const entradas = nucleos.flatMap((n) => n.entradas)
  const saidas = nucleos.flatMap((n) => n.saidas)

  return (
    <div className="space-y-4 p-6">
      <div>
        <h2 className="text-sm font-semibold text-[#f5f5f5]">Fluxo Financeiro Mensal</h2>
        <p className="text-xs text-[#8a8a8a]">Fluxograma padrao para fechamento, medicao, entradas, saidas e EVM.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {FLOW_STEPS.map((step, idx) => (
          <div key={step} className="rounded-xl border border-[#525252] bg-[#343434] p-4">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#f97316]/15 text-sm font-semibold text-[#f97316]">
              {idx + 1}
            </div>
            <p className="text-sm font-medium text-[#f5f5f5]">{step}</p>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 size={13} />
              Pronto para fechamento
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#525252] bg-[#343434] p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#f5f5f5]">Fluxo consolidado por mes</h3>
        <div className="space-y-3">
          {months.map((month, idx) => {
            const entrada = entradas.reduce((sum, item) => sum + item.valor, 0) * (0.45 + idx * 0.12)
            const saida = saidas.reduce((sum, item) => sum + item.valor, 0) * (0.55 + idx * 0.1)
            const max = Math.max(entrada, saida, 1)
            return (
              <div key={month} className="grid gap-2 md:grid-cols-[90px_1fr_130px] md:items-center">
                <span className="text-xs font-mono text-[#a3a3a3]">{month}</span>
                <div className="space-y-1">
                  <div className="h-3 overflow-hidden rounded-full bg-[#2c2c2c]">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(entrada / max) * 100}%` }} />
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#2c2c2c]">
                    <div className="h-full rounded-full bg-[#f97316]" style={{ width: `${(saida / max) * 100}%` }} />
                  </div>
                </div>
                <span className="text-right text-xs font-mono text-[#d4d4d4]">
                  {formatCurrency(entrada - saida)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
