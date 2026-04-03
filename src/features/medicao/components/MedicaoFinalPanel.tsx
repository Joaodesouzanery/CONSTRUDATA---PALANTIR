/**
 * MedicaoFinalPanel — consolidates all measurement data for final report generation.
 */
import { useMemo } from 'react'
import { useMedicaoStore } from '@/store/medicaoStore'
import { FileCheck, Printer } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export function MedicaoFinalPanel() {
  const sheets = useMedicaoStore((s) => s.sheets)

  const sabespSheets = sheets.filter((s) => s.tipo === 'sabesp')
  const criterioSheets = sheets.filter((s) => s.tipo === 'criterio')
  const subSheets = sheets.filter((s) => s.tipo === 'subempreiteiro')
  const fornSheets = sheets.filter((s) => s.tipo === 'fornecedor')

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
    { label: 'Criterios', count: criterioSheets.length, total: totalCriterio, color: 'text-sky-400' },
    { label: 'Subempreiteiros', count: subSheets.length, total: totalSub, color: 'text-emerald-400' },
    { label: 'Fornecedores', count: fornSheets.length, total: totalForn, color: 'text-purple-400' },
  ]

  function handlePrint() {
    window.print()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white font-semibold text-lg">Medicao Final</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">
            Consolidacao de todas as medicoes para geracao do relatorio final
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <p className="text-[#a3a3a3] text-sm">Valor Total da Medicao</p>
          <p className="text-white text-2xl font-bold font-mono mt-1">
            {formatCurrency(totalGeral)}
          </p>
        </div>
        <FileCheck size={32} className="text-[#f97316]" />
      </div>

      {/* Detail per sheet */}
      {sheets.length > 0 && (
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
                  <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Referencia</th>
                  <th className="px-3 py-2 text-right text-[#a3a3a3] font-medium">Itens</th>
                  <th className="px-3 py-2 text-right text-[#a3a3a3] font-medium">Valor (R$)</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sh) => (
                  <tr key={sh.id} className="border-t border-[#525252] hover:bg-[#484848] transition-colors">
                    <td className="px-3 py-2 text-[#f5f5f5]">{sh.titulo}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#484848] text-[#a3a3a3]">
                        {sh.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#a3a3a3]">{sh.referencia}</td>
                    <td className="px-3 py-2 text-[#f5f5f5] font-mono text-right">{sh.items.length}</td>
                    <td className="px-3 py-2 text-[#f5f5f5] font-mono text-right font-semibold">
                      {formatCurrency(sh.totalBRL)}
                    </td>
                  </tr>
                ))}
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
