/**
 * MedicaoFinalPanel — consolidates all measurement data for final report generation.
 * Two-phase flow: selection of sheets, then generated report.
 */
import { useMemo, useState } from 'react'
import { useMedicaoStore } from '@/store/medicaoStore'
import { FileCheck, Printer, Check } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const TYPE_META: Record<string, { label: string; color: string; badgeBg: string }> = {
  sabesp: { label: 'Sabesp', color: 'text-[#f97316]', badgeBg: 'bg-[#f97316]/15 text-[#f97316]' },
  criterio: { label: 'Critério', color: 'text-sky-400', badgeBg: 'bg-sky-400/15 text-sky-400' },
  subempreiteiro: { label: 'Subempreiteiro', color: 'text-emerald-400', badgeBg: 'bg-emerald-400/15 text-emerald-400' },
  fornecedor: { label: 'Fornecedor', color: 'text-purple-400', badgeBg: 'bg-purple-400/15 text-purple-400' },
}

const TYPE_ORDER = ['sabesp', 'criterio', 'subempreiteiro', 'fornecedor'] as const

export function MedicaoFinalPanel() {
  const sheets = useMedicaoStore((s) => s.sheets)

  const [selectedSheetIds, setSelectedSheetIds] = useState<Set<string>>(new Set())
  const [isGenerated, setIsGenerated] = useState(false)

  // ── Selection helpers ───────────────────────────────────────────────────────
  const allSelected = sheets.length > 0 && selectedSheetIds.size === sheets.length

  function toggleAll() {
    if (allSelected) {
      setSelectedSheetIds(new Set())
    } else {
      setSelectedSheetIds(new Set(sheets.map((s) => s.id)))
    }
  }

  function toggleSheet(id: string) {
    setSelectedSheetIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // ── Grouped sheets for selection list ───────────────────────────────────────
  const groupedSheets = useMemo(() => {
    const groups: Record<string, typeof sheets> = {}
    for (const t of TYPE_ORDER) {
      const matching = sheets.filter((s) => s.tipo === t)
      if (matching.length > 0) groups[t] = matching
    }
    // catch any type not in TYPE_ORDER
    const knownTypes = new Set<string>(TYPE_ORDER)
    const other = sheets.filter((s) => !knownTypes.has(s.tipo))
    if (other.length > 0) groups['outro'] = other
    return groups
  }, [sheets])

  // ── Filtered data for the generated report ─────────────────────────────────
  const selectedSheets = useMemo(
    () => sheets.filter((s) => selectedSheetIds.has(s.id)),
    [sheets, selectedSheetIds],
  )
  const sabespSheets = selectedSheets.filter((s) => s.tipo === 'sabesp')
  const criterioSheets = selectedSheets.filter((s) => s.tipo === 'criterio')
  const subSheets = selectedSheets.filter((s) => s.tipo === 'subempreiteiro')
  const fornSheets = selectedSheets.filter((s) => s.tipo === 'fornecedor')

  const totalSabesp = useMemo(
    () => sabespSheets.reduce((s, sh) => s + sh.totalBRL, 0),
    [sabespSheets],
  )
  const totalCriterio = useMemo(
    () => criterioSheets.reduce((s, sh) => s + sh.totalBRL, 0),
    [criterioSheets],
  )
  const totalSub = useMemo(
    () => subSheets.reduce((s, sh) => s + sh.totalBRL, 0),
    [subSheets],
  )
  const totalForn = useMemo(
    () => fornSheets.reduce((s, sh) => s + sh.totalBRL, 0),
    [fornSheets],
  )
  const totalGeral = totalSabesp + totalCriterio + totalSub + totalForn

  const summaryRows = [
    { label: 'Planilha Sabesp', count: sabespSheets.length, total: totalSabesp, color: 'text-[#f97316]' },
    { label: 'Critérios', count: criterioSheets.length, total: totalCriterio, color: 'text-sky-400' },
    { label: 'Subempreiteiros', count: subSheets.length, total: totalSub, color: 'text-emerald-400' },
    { label: 'Fornecedores', count: fornSheets.length, total: totalForn, color: 'text-purple-400' },
  ]

  function handlePrint() {
    window.print()
  }

  function handleGenerate() {
    setIsGenerated(true)
  }

  function handleResetSelection() {
    setIsGenerated(false)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Selection
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isGenerated) {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-white font-semibold text-lg">Medição Final</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">
            Selecione as planilhas que deseja incluir na medição final
          </p>
        </div>

        {/* Toggle all + count */}
        <div className="flex items-center justify-between">
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <Check size={13} />
            {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
          </button>
          <span className="text-[#a3a3a3] text-xs">
            {selectedSheetIds.size} de {sheets.length} selecionada{sheets.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Sheet list grouped by type */}
        <div className="space-y-4">
          {Object.entries(groupedSheets).map(([tipo, group]) => {
            const meta = TYPE_META[tipo] ?? { label: tipo, color: 'text-[#a3a3a3]', badgeBg: 'bg-[#484848] text-[#a3a3a3]' }
            return (
              <div key={tipo}>
                <p className={`text-xs font-semibold mb-2 ${meta.color}`}>{meta.label}</p>
                <div className="space-y-1.5">
                  {group.map((sh) => {
                    const checked = selectedSheetIds.has(sh.id)
                    return (
                      <label
                        key={sh.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[#484848] border-[#f97316]/40'
                            : 'bg-[#3d3d3d] border-[#525252] hover:bg-[#484848]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSheet(sh.id)}
                          className="accent-[#f97316] w-4 h-4 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[#f5f5f5] text-sm truncate">{sh.titulo}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${meta.badgeBg}`}>
                          {meta.label}
                        </span>
                        <span className="text-[#f5f5f5] text-sm font-mono font-semibold whitespace-nowrap">
                          {formatCurrency(sh.totalBRL)}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {sheets.length === 0 && (
            <p className="text-[#6b6b6b] text-sm text-center py-8">
              Nenhuma planilha disponível. Adicione planilhas nas abas correspondentes.
            </p>
          )}
        </div>

        {/* Generate button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleGenerate}
            disabled={selectedSheetIds.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#f97316] text-white hover:bg-[#ea580c]"
          >
            <FileCheck size={16} />
            Gerar Medição Final
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Generated Report
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-semibold text-lg">Medição Final</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">
            Consolidação de {selectedSheets.length} planilha{selectedSheets.length !== 1 ? 's' : ''} selecionada{selectedSheets.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetSelection}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            Refazer Seleção
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <Printer size={13} /> Imprimir
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryRows.map((row) => (
          <div key={row.label} className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
            <p className="text-[#a3a3a3] text-xs mb-1">{row.label}</p>
            <p className={`text-lg font-bold font-mono ${row.color}`}>
              {formatCurrency(row.total)}
            </p>
            <p className="text-[#6b6b6b] text-xs mt-1">
              {row.count} planilha{row.count !== 1 ? 's' : ''}
            </p>
          </div>
        ))}
      </div>

      {/* Grand total */}
      <div className="bg-[#3d3d3d] border border-[#f97316]/30 rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-[#a3a3a3] text-sm">Valor Total da Medição</p>
          <p className="text-white text-2xl font-bold font-mono mt-1">
            {formatCurrency(totalGeral)}
          </p>
        </div>
        <FileCheck size={32} className="text-[#f97316]" />
      </div>

      {/* Detail per sheet */}
      {selectedSheets.length > 0 && (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#525252] bg-[#484848]/40">
            <h3 className="text-white font-medium text-sm">Detalhamento por Planilha</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#484848]/30">
                  <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Planilha</th>
                  <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Tipo</th>
                  <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Referência</th>
                  <th className="px-3 py-2 text-right text-[#a3a3a3] font-medium">Itens</th>
                  <th className="px-3 py-2 text-right text-[#a3a3a3] font-medium">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {selectedSheets.map((sh) => {
                  const meta = TYPE_META[sh.tipo]
                  return (
                    <tr key={sh.id} className="border-t border-[#525252] hover:bg-[#484848] transition-colors">
                      <td className="px-3 py-2 text-[#f5f5f5]">{sh.titulo}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${meta ? meta.badgeBg : 'bg-[#484848] text-[#a3a3a3]'}`}>
                          {meta ? meta.label : sh.tipo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#a3a3a3]">{sh.referencia}</td>
                      <td className="px-3 py-2 text-[#f5f5f5] font-mono text-right">{sh.items.length}</td>
                      <td className="px-3 py-2 text-[#f5f5f5] font-mono text-right font-semibold">
                        {formatCurrency(sh.totalBRL)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-[#525252] bg-[#484848]/40 text-right">
            <span className="text-[#a3a3a3] text-xs">
              Total Geral:{' '}
              <span className="text-[#f97316] font-mono font-semibold text-sm">
                {formatCurrency(totalGeral)}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
