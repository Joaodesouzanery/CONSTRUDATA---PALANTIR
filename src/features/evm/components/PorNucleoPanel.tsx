import { AlertTriangle, Plus, Search, Wand2 } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import { cn, formatCurrency } from '@/lib/utils'

function ratioColor(value: number) {
  if (value >= 1) return 'text-emerald-400'
  if (value >= 0.9) return 'text-amber-300'
  return 'text-red-400'
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#343434] p-3">
      <p className="text-[10px] uppercase text-[#8a8a8a]">{label}</p>
      <p className={cn('mt-1 text-lg font-semibold text-[#f5f5f5]', tone)}>{value}</p>
    </div>
  )
}

export function PorNucleoPanel() {
  const {
    contrato,
    nucleos,
    selectedNucleoId,
    setSelectedNucleo,
    addNucleoFinanceiro,
    measurementTemplates,
    applyMeasurementTemplate,
    diagnoseSpi,
    diagnosticNotes,
  } = useEvmStore()
  const selected = nucleos.find((n) => n.id === selectedNucleoId) ?? nucleos[0]
  const latest = selected?.evm.at(-1)
  const pv = latest?.pv ?? 0
  const ev = selected?.workPackages.reduce((sum, wp) => sum + wp.evReconhecido, 0) ?? 0
  const ac = selected?.saidas.reduce((sum, saida) => sum + saida.valor, 0) ?? 0
  const cpi = ac > 0 ? ev / ac : 0
  const spi = pv > 0 ? ev / pv : 0
  const eac = selected && cpi > 0 ? selected.bacAlocado / Math.max(0.35, cpi * (latest?.ppcMedio ?? 0.8)) : 0

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Controle por Nucleo</h2>
          <p className="text-xs text-[#8a8a8a]">{contrato?.descricao ?? 'Carregue a demo ou crie nucleos financeiros.'}</p>
        </div>
        <button
          onClick={() => addNucleoFinanceiro(`Novo Nucleo ${nucleos.length + 1}`)}
          className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-medium text-white hover:bg-[#ea580c]"
        >
          <Plus size={15} />
          Novo Nucleo
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {nucleos.map((n) => (
          <button
            key={n.id}
            onClick={() => setSelectedNucleo(n.id)}
            className={cn(
              'min-w-[150px] rounded-lg border px-3 py-2 text-left transition-colors',
              selected?.id === n.id ? 'border-[#f97316] bg-[#3d3d3d]' : 'border-[#525252] bg-[#343434] hover:border-[#737373]',
            )}
          >
            <span className="block text-[10px] uppercase text-[#8a8a8a]">{n.codigo}</span>
            <span className="block truncate text-sm font-semibold text-[#f5f5f5]">{n.nome}</span>
            <span className="block text-xs text-[#a3a3a3]">{formatCurrency(n.bacAlocado)}</span>
          </button>
        ))}
      </div>

      {selected ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="BAC nucleo" value={formatCurrency(selected.bacAlocado)} />
            <Kpi label="PV" value={formatCurrency(pv)} />
            <Kpi label="EV" value={formatCurrency(ev)} />
            <Kpi label="CPI" value={cpi.toFixed(2)} tone={ratioColor(cpi)} />
            <Kpi label="SPI" value={spi.toFixed(2)} tone={ratioColor(spi)} />
            <Kpi label="EAC por PPC" value={formatCurrency(eac)} />
            <Kpi label="Entradas" value={formatCurrency(selected.entradas.reduce((sum, e) => sum + e.valor, 0))} />
            <Kpi label="Saidas" value={formatCurrency(ac)} />
            <Kpi label="Work packages" value={String(selected.workPackages.length)} />
            <Kpi label="PPC medio" value={`${((latest?.ppcMedio ?? 0) * 100).toFixed(0)}%`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border border-[#525252] bg-[#343434] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#f5f5f5]">Matriz e templates</h3>
                <div className="flex gap-2">
                  {measurementTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => applyMeasurementTemplate(tpl.id, selected.id)}
                      className="flex items-center gap-1 rounded-lg border border-[#525252] px-2.5 py-1.5 text-xs text-[#f5f5f5] hover:border-[#f97316]"
                    >
                      <Wand2 size={13} />
                      {tpl.tipologia}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-[#8a8a8a]">
                    <tr>
                      <th className="py-2 text-left">WP</th>
                      <th className="py-2 text-right">BAC</th>
                      <th className="py-2 text-right">Fisico</th>
                      <th className="py-2 text-right">Peso Fin.</th>
                      <th className="py-2 text-right">EV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.workPackages.map((wp) => (
                      <tr key={wp.id} className="border-t border-[#525252]/60">
                        <td className="py-2 text-[#f5f5f5]">{wp.descricao}</td>
                        <td className="py-2 text-right font-mono text-[#a3a3a3]">{formatCurrency(wp.bacWP)}</td>
                        <td className="py-2 text-right font-mono text-[#a3a3a3]">{wp.progFisico.toFixed(0)}%</td>
                        <td className="py-2 text-right font-mono text-[#a3a3a3]">{(wp.pesoFinanceiro * 100).toFixed(0)}%</td>
                        <td className="py-2 text-right font-mono text-[#f97316]">{formatCurrency(wp.evReconhecido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-[#525252] bg-[#343434] p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#f5f5f5]">Diagnostico CPI/SPI</h3>
                <button
                  onClick={() => diagnoseSpi(selected.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-medium text-white hover:bg-[#ea580c]"
                >
                  <Search size={13} />
                  Por que meu SPI esta baixo?
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {(diagnosticNotes.length ? diagnosticNotes : ['Clique no diagnostico para cruzar Planejamento, PPC, custos e work packages locais.']).map((note) => (
                  <div key={note} className="flex gap-2 rounded-lg bg-[#2c2c2c] p-3 text-sm text-[#d4d4d4]">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#f97316]" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-[#525252] p-10 text-center text-sm text-[#8a8a8a]">
          Nenhum nucleo financeiro cadastrado.
        </div>
      )}
    </div>
  )
}
