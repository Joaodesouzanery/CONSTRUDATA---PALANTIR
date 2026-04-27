import { AlertTriangle, Layers3, Pencil, Plus, Search, Trash2, Wand2 } from 'lucide-react'
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

function asNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const text = String(value ?? '').trim()
  if (!text) return 0
  const clean = text
    .replace(/R\$\s?/g, '')
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
  if (!clean || clean === '-' || clean === ',' || clean === '.') return 0
  if (clean.includes(',') && clean.includes('.')) {
    return clean.lastIndexOf(',') > clean.lastIndexOf('.')
      ? parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
      : parseFloat(clean.replace(/,/g, '')) || 0
  }
  if (clean.includes(',')) return parseFloat(clean.replace(',', '.')) || 0
  return parseFloat(clean) || 0
}

export function PorNucleoPanel() {
  const {
    contrato,
    nucleos,
    selectedNucleoId,
    setSelectedNucleo,
    addNucleoFinanceiro,
    updateNucleoFinanceiro,
    removeNucleoFinanceiro,
    measurementTemplates,
    applyMeasurementTemplate,
    diagnoseSpi,
    diagnosticNotes,
  } = useEvmStore()
  const activeNucleos = nucleos.filter((n) => n.ativo !== false)
  const selected = selectedNucleoId ? activeNucleos.find((n) => n.id === selectedNucleoId) : null
  const scopedNucleos = selected ? [selected] : activeNucleos
  const totalBac = activeNucleos.reduce((sum, n) => sum + asNumber(n.bacAlocado), 0)
  const latestPeriods = scopedNucleos.flatMap((n) => n.evm.slice(-1))
  const pv = latestPeriods.reduce((sum, p) => sum + asNumber(p.pv), 0)
  const ev = scopedNucleos.reduce((sum, n) => sum + n.workPackages.reduce((wpSum, wp) => wpSum + asNumber(wp.evReconhecido), 0), 0)
  const ac = scopedNucleos.reduce((sum, n) => sum + n.saidas.reduce((saidaSum, saida) => saidaSum + asNumber(saida.valor), 0), 0)
  const bac = scopedNucleos.reduce((sum, n) => sum + asNumber(n.bacAlocado), 0)
  const cpi = ac > 0 ? ev / ac : 0
  const spi = pv > 0 ? ev / pv : 0
  const ppcMedio = latestPeriods.length
    ? latestPeriods.reduce((sum, p) => sum + (p.ppcMedio ?? 0), 0) / latestPeriods.length
    : 0
  const eac = bac > 0 && cpi > 0 ? bac / Math.max(0.35, cpi * (ppcMedio || 0.8)) : 0
  const isAllView = selectedNucleoId === null
  const workPackages = scopedNucleos.flatMap((n) => n.workPackages.map((wp) => ({ ...wp, nucleoNome: n.nome })))

  function handleAddNucleo() {
    addNucleoFinanceiro(`Novo Núcleo ${nucleos.length + 1}`)
  }

  function handleEditNucleo(id: string) {
    const nucleo = nucleos.find((n) => n.id === id)
    if (!nucleo) return
    const nome = window.prompt('Nome do núcleo', nucleo.nome)
    if (nome === null) return
    const codigo = window.prompt('Código do núcleo', nucleo.codigo)
    if (codigo === null) return
    const bacRaw = window.prompt('BAC alocado (R$)', String(nucleo.bacAlocado))
    if (bacRaw === null) return
    const bacAlocado = Number(bacRaw.replace(/\./g, '').replace(',', '.'))
    updateNucleoFinanceiro(id, {
      nome: nome.trim() || nucleo.nome,
      codigo: codigo.trim() || nucleo.codigo,
      bacAlocado: Number.isFinite(bacAlocado) && bacAlocado > 0 ? bacAlocado : nucleo.bacAlocado,
    })
  }

  function handleRemoveNucleo(id: string) {
    const nucleo = nucleos.find((n) => n.id === id)
    if (!nucleo) return
    if (window.confirm(`Excluir o núcleo "${nucleo.nome}"?`)) removeNucleoFinanceiro(id)
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#f5f5f5]">Controle por Núcleo</h2>
          <p className="text-xs text-[#8a8a8a]">{contrato?.descricao ?? 'Carregue a demo ou crie núcleos financeiros.'}</p>
        </div>
        <button
          onClick={handleAddNucleo}
          className="flex items-center gap-2 rounded-lg bg-[#f97316] px-3 py-2 text-sm font-medium text-white hover:bg-[#ea580c]"
        >
          <Plus size={15} />
          Novo Núcleo
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedNucleo(null)}
          className={cn(
            'min-w-[170px] rounded-lg border px-3 py-2 text-left transition-colors',
            isAllView ? 'border-[#f97316] bg-[#3d3d3d]' : 'border-[#525252] bg-[#343434] hover:border-[#737373]',
          )}
        >
          <span className="flex items-center gap-1 text-[10px] uppercase text-[#8a8a8a]"><Layers3 size={12} /> Geral</span>
          <span className="block truncate text-sm font-semibold text-[#f5f5f5]">Todos os núcleos</span>
          <span className="block text-xs text-[#a3a3a3]">{formatCurrency(totalBac)}</span>
        </button>
        {activeNucleos.map((n) => (
          <div
            key={n.id}
            className={cn(
              'min-w-[180px] rounded-lg border px-3 py-2 transition-colors',
              selected?.id === n.id ? 'border-[#f97316] bg-[#3d3d3d]' : 'border-[#525252] bg-[#343434] hover:border-[#737373]',
            )}
          >
            <button type="button" onClick={() => setSelectedNucleo(n.id)} className="w-full text-left">
              <span className="block text-[10px] uppercase text-[#8a8a8a]">{n.codigo}</span>
              <span className="block truncate text-sm font-semibold text-[#f5f5f5]">{n.nome}</span>
              <span className="block text-xs text-[#a3a3a3]">{formatCurrency(n.bacAlocado)}</span>
            </button>
            <div className="mt-2 flex gap-1">
              <button type="button" onClick={() => handleEditNucleo(n.id)} className="rounded-md border border-[#525252] p-1.5 text-[#a3a3a3] hover:border-[#f97316]/50 hover:text-[#f97316]" title="Editar núcleo">
                <Pencil size={12} />
              </button>
              <button type="button" onClick={() => handleRemoveNucleo(n.id)} className="rounded-md border border-[#525252] p-1.5 text-[#a3a3a3] hover:border-red-500/50 hover:text-red-400" title="Excluir núcleo">
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {scopedNucleos.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label={isAllView ? 'BAC total' : 'BAC núcleo'} value={formatCurrency(bac)} />
            <Kpi label="PV" value={formatCurrency(pv)} />
            <Kpi label="EV" value={formatCurrency(ev)} />
            <Kpi label="CPI" value={cpi.toFixed(2)} tone={ratioColor(cpi)} />
            <Kpi label="SPI" value={spi.toFixed(2)} tone={ratioColor(spi)} />
            <Kpi label="EAC por PPC" value={formatCurrency(eac)} />
            <Kpi label="Entradas" value={formatCurrency(scopedNucleos.reduce((sum, n) => sum + n.entradas.reduce((entrySum, e) => entrySum + asNumber(e.valor), 0), 0))} />
            <Kpi label="Saídas" value={formatCurrency(ac)} />
            <Kpi label="Work packages" value={String(workPackages.length)} />
            <Kpi label="PPC médio" value={`${(ppcMedio * 100).toFixed(0)}%`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-xl border border-[#525252] bg-[#343434] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[#f5f5f5]">{isAllView ? 'Matriz consolidada' : 'Matriz e templates'}</h3>
                <div className="flex gap-2">
                  {!isAllView && measurementTemplates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => selected && applyMeasurementTemplate(tpl.id, selected.id)}
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
                      {isAllView && <th className="py-2 text-left">Núcleo</th>}
                      <th className="py-2 text-right">BAC</th>
                      <th className="py-2 text-right">Físico</th>
                      <th className="py-2 text-right">Peso Fin.</th>
                      <th className="py-2 text-right">EV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workPackages.map((wp) => (
                      <tr key={wp.id} className="border-t border-[#525252]/60">
                        <td className="py-2 text-[#f5f5f5]">{wp.descricao}</td>
                        {isAllView && <td className="py-2 text-[#a3a3a3]">{wp.nucleoNome}</td>}
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
                <h3 className="text-sm font-semibold text-[#f5f5f5]">Diagnóstico CPI/SPI</h3>
                <button
                  onClick={() => diagnoseSpi(selected?.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-medium text-white hover:bg-[#ea580c]"
                >
                  <Search size={13} />
                  Por que meu SPI está baixo?
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {(diagnosticNotes.length ? diagnosticNotes : ['Clique no diagnóstico para cruzar Planejamento, PPC, custos e work packages locais.']).map((note) => (
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
          Nenhum núcleo financeiro cadastrado.
        </div>
      )}
    </div>
  )
}
