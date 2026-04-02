/**
 * ConferenciaPanel — Conferencia Contrato x Previsao tab.
 * Compare two sheets (contrato vs previsao), display differences,
 * and allow approved items to be pushed into a new measurement sheet.
 */
import { useState, useCallback, useMemo } from 'react'
import {
  FileSpreadsheet,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Upload,
  ChevronDown,
} from 'lucide-react'
import { useMedicaoStore } from '@/store/medicaoStore'
import { cn, formatCurrency } from '@/lib/utils'
import { previewExcel, autoSuggestMapping, parseMedicaoSheet } from '../utils/parseMedicaoExcel'
import type { ConferenciaResult } from '@/types'

const STATUS_CONFIG: Record<
  ConferenciaResult['matchStatus'],
  { label: string; color: string; bg: string; border: string }
> = {
  matched: {
    label: 'Matched',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/30',
  },
  divergent: {
    label: 'Divergente',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
  },
  missing_contrato: {
    label: 'Sem Contrato',
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/30',
  },
  missing_previsao: {
    label: 'Sem Previsao',
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/30',
  },
}

export function ConferenciaPanel() {
  const {
    sheets,
    conferenciaResults,
    runConferencia,
    clearConferenciaResults,
    addSheet,
    importItems,
  } = useMedicaoStore()

  const [contratoSheetId, setContratoSheetId] = useState('')
  const [previsaoSheetId, setPrevisaoSheetId] = useState('')
  const [contratoFile, setContratoFile] = useState<File | null>(null)
  const [previsaoFile, setPrevisaoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState<'contrato' | 'previsao' | null>(null)

  // Summary counts
  const summary = useMemo(() => {
    const matched = conferenciaResults.filter((r) => r.matchStatus === 'matched').length
    const divergent = conferenciaResults.filter((r) => r.matchStatus === 'divergent').length
    const missingContrato = conferenciaResults.filter(
      (r) => r.matchStatus === 'missing_contrato',
    ).length
    const missingPrevisao = conferenciaResults.filter(
      (r) => r.matchStatus === 'missing_previsao',
    ).length
    return { matched, divergent, missingContrato, missingPrevisao, total: conferenciaResults.length }
  }, [conferenciaResults])

  const handleFileUpload = useCallback(
    async (file: File, target: 'contrato' | 'previsao') => {
      setUploading(target)
      try {
        const { headers } = await previewExcel(file)
        const mapping = autoSuggestMapping(headers)
        const items = await parseMedicaoSheet(file, mapping)

        const sheetId = addSheet({
          tipo: 'conferencia',
          titulo: `${target === 'contrato' ? 'Contrato' : 'Previsao'} - ${file.name}`,
          referencia: new Date().toISOString().slice(0, 7),
          items: items.map((it) => ({
            ...it,
            id: crypto.randomUUID(),
          })),
        })

        if (target === 'contrato') {
          setContratoSheetId(sheetId)
          setContratoFile(file)
        } else {
          setPrevisaoSheetId(sheetId)
          setPrevisaoFile(file)
        }
      } catch {
        // Error handled silently; user can retry
      } finally {
        setUploading(null)
      }
    },
    [addSheet],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, target: 'contrato' | 'previsao') => {
      e.preventDefault()
      const f = e.dataTransfer.files[0]
      if (f) handleFileUpload(f, target)
    },
    [handleFileUpload],
  )

  const handleRunConferencia = useCallback(() => {
    if (!contratoSheetId || !previsaoSheetId) return
    runConferencia(contratoSheetId, previsaoSheetId)
  }, [contratoSheetId, previsaoSheetId, runConferencia])

  const handleApproveToMedicao = useCallback(() => {
    const matchedResults = conferenciaResults.filter(
      (r) => r.matchStatus === 'matched' || r.matchStatus === 'divergent',
    )
    if (matchedResults.length === 0) return

    const contratoSheet = sheets.find((s) => s.id === contratoSheetId)
    if (!contratoSheet) return

    const matchedItems = contratoSheet.items.filter((it) =>
      matchedResults.some((r) => r.itemContrato === it.descricao),
    )

    const newSheetId = addSheet({
      tipo: 'sabesp',
      titulo: `Medicao Aprovada - ${new Date().toISOString().slice(0, 10)}`,
      referencia: new Date().toISOString().slice(0, 7),
      items: [],
    })

    if (matchedItems.length > 0) {
      importItems(
        newSheetId,
        matchedItems.map((it) => ({
          item: it.item,
          descricao: it.descricao,
          unidade: it.unidade,
          qtdContratada: it.qtdContratada,
          qtdMedida: it.qtdMedida,
          qtdAcumulada: it.qtdAcumulada,
          precoUnitario: it.precoUnitario,
          valorMedido: it.valorMedido,
        })),
      )
    }
  }, [conferenciaResults, sheets, contratoSheetId, addSheet, importItems])

  const conferenciaSheets = sheets.filter(
    (s) => s.tipo === 'conferencia' || s.items.length > 0,
  )

  return (
    <div className="p-6 space-y-4">
      {/* Upload / Select area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contrato */}
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
          <h3 className="text-[#f5f5f5] text-sm font-semibold mb-3">Contrato</h3>

          {/* Dropdown to select existing sheet */}
          <div className="mb-3">
            <label className="text-[#a3a3a3] text-xs mb-1 block">
              Selecionar planilha existente:
            </label>
            <div className="relative">
              <select
                value={contratoSheetId}
                onChange={(e) => setContratoSheetId(e.target.value)}
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg text-xs text-[#f5f5f5] px-3 py-2 pr-8 appearance-none"
              >
                <option value="">-- Selecionar --</option>
                {conferenciaSheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titulo} ({s.items.length} itens)
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a3a3a3] pointer-events-none"
              />
            </div>
          </div>

          {/* Or upload */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'contrato')}
            className="border-2 border-dashed border-[#525252] rounded-lg p-6 text-center cursor-pointer hover:border-[#a3a3a3] transition-colors"
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.xlsx,.xls,.csv'
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0]
                if (f) handleFileUpload(f, 'contrato')
              }
              input.click()
            }}
          >
            {uploading === 'contrato' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
                <span className="text-[#a3a3a3] text-xs">Processando...</span>
              </div>
            ) : contratoFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet size={16} className="text-green-400" />
                <span className="text-[#f5f5f5] text-xs">{contratoFile.name}</span>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-[#6b6b6b] mb-2" />
                <p className="text-[#a3a3a3] text-xs">
                  Arraste Excel ou clique para upload
                </p>
              </>
            )}
          </div>
        </div>

        {/* Previsao */}
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
          <h3 className="text-[#f5f5f5] text-sm font-semibold mb-3">Previsao</h3>

          <div className="mb-3">
            <label className="text-[#a3a3a3] text-xs mb-1 block">
              Selecionar planilha existente:
            </label>
            <div className="relative">
              <select
                value={previsaoSheetId}
                onChange={(e) => setPrevisaoSheetId(e.target.value)}
                className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg text-xs text-[#f5f5f5] px-3 py-2 pr-8 appearance-none"
              >
                <option value="">-- Selecionar --</option>
                {conferenciaSheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.titulo} ({s.items.length} itens)
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a3a3a3] pointer-events-none"
              />
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, 'previsao')}
            className="border-2 border-dashed border-[#525252] rounded-lg p-6 text-center cursor-pointer hover:border-[#a3a3a3] transition-colors"
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.xlsx,.xls,.csv'
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0]
                if (f) handleFileUpload(f, 'previsao')
              }
              input.click()
            }}
          >
            {uploading === 'previsao' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
                <span className="text-[#a3a3a3] text-xs">Processando...</span>
              </div>
            ) : previsaoFile ? (
              <div className="flex items-center justify-center gap-2">
                <FileSpreadsheet size={16} className="text-green-400" />
                <span className="text-[#f5f5f5] text-xs">{previsaoFile.name}</span>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-[#6b6b6b] mb-2" />
                <p className="text-[#a3a3a3] text-xs">
                  Arraste Excel ou clique para upload
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Run button */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleRunConferencia}
          disabled={!contratoSheetId || !previsaoSheetId}
          className={cn(
            'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors',
            contratoSheetId && previsaoSheetId
              ? 'bg-[#f97316] text-white hover:bg-[#ea580c]'
              : 'bg-[#484848] text-[#6b6b6b] cursor-not-allowed',
          )}
        >
          <Play size={16} />
          Executar Conferencia
        </button>
        {conferenciaResults.length > 0 && (
          <button
            onClick={clearConferenciaResults}
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-[#484848] text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            Limpar Resultados
          </button>
        )}
      </div>

      {/* Results */}
      {conferenciaResults.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#3d3d3d] border border-green-400/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 size={16} className="text-green-400" />
                <span className="text-[#a3a3a3] text-xs">Matched</span>
              </div>
              <p className="text-green-400 font-mono text-xl font-semibold">
                {summary.matched}
              </p>
            </div>
            <div className="bg-[#3d3d3d] border border-yellow-400/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={16} className="text-yellow-400" />
                <span className="text-[#a3a3a3] text-xs">Divergente</span>
              </div>
              <p className="text-yellow-400 font-mono text-xl font-semibold">
                {summary.divergent}
              </p>
            </div>
            <div className="bg-[#3d3d3d] border border-red-400/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={16} className="text-red-400" />
                <span className="text-[#a3a3a3] text-xs">Sem Contrato</span>
              </div>
              <p className="text-red-400 font-mono text-xl font-semibold">
                {summary.missingContrato}
              </p>
            </div>
            <div className="bg-[#3d3d3d] border border-red-400/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={16} className="text-red-400" />
                <span className="text-[#a3a3a3] text-xs">Sem Previsao</span>
              </div>
              <p className="text-red-400 font-mono text-xl font-semibold">
                {summary.missingPrevisao}
              </p>
            </div>
          </div>

          {/* Results table */}
          <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#525252] flex items-center justify-between">
              <span className="text-[#f5f5f5] text-sm font-medium">
                Resultados da Conferencia ({summary.total} itens)
              </span>
              <button
                onClick={handleApproveToMedicao}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
              >
                <ArrowRight size={14} />
                Aprovar e Levar para Medicao
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#484848]/60">
                    <th className="px-3 py-2.5 text-left text-[#a3a3a3] font-medium">
                      Item Contrato
                    </th>
                    <th className="px-3 py-2.5 text-left text-[#a3a3a3] font-medium">
                      Item Previsao
                    </th>
                    <th className="px-3 py-2.5 text-center text-[#a3a3a3] font-medium w-28">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-28">
                      Valor Contrato
                    </th>
                    <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-28">
                      Valor Previsao
                    </th>
                    <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-24">
                      Diferenca
                    </th>
                    <th className="px-3 py-2.5 text-right text-[#a3a3a3] font-medium w-16">
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {conferenciaResults.map((r, i) => {
                    const cfg = STATUS_CONFIG[r.matchStatus]
                    return (
                      <tr
                        key={i}
                        className="border-t border-[#525252] hover:bg-[#484848] transition-colors"
                      >
                        <td className="px-3 py-2 text-[#f5f5f5] max-w-[200px] truncate">
                          {r.itemContrato}
                        </td>
                        <td className="px-3 py-2 text-[#f5f5f5] max-w-[200px] truncate">
                          {r.itemPrevisao}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                              cfg.color,
                              cfg.bg,
                              cfg.border,
                            )}
                          >
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#f5f5f5] font-mono text-right">
                          {formatCurrency(r.valorContrato)}
                        </td>
                        <td className="px-3 py-2 text-[#f5f5f5] font-mono text-right">
                          {formatCurrency(r.valorPrevisao)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 font-mono text-right',
                            r.diferenca > 0
                              ? 'text-red-400'
                              : r.diferenca < 0
                                ? 'text-yellow-400'
                                : 'text-green-400',
                          )}
                        >
                          {formatCurrency(r.diferenca)}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 font-mono text-right',
                            Math.abs(r.diferencaPct) > 5
                              ? 'text-red-400'
                              : 'text-green-400',
                          )}
                        >
                          {r.diferencaPct.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {conferenciaResults.length === 0 && (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-12 text-center">
          <FileSpreadsheet size={40} className="mx-auto text-[#6b6b6b] mb-3" />
          <p className="text-[#a3a3a3] text-sm">
            Selecione ou importe as planilhas de Contrato e Previsao, depois clique em
            &quot;Executar Conferencia&quot;.
          </p>
        </div>
      )}
    </div>
  )
}
