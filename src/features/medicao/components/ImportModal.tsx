/**
 * ImportModal — reusable drag-and-drop import modal for Excel/PDF files.
 * Parses uploaded files, shows a preview, and allows column mapping before import.
 */
import { useState, useCallback, useRef } from 'react'
import { X, Upload, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { previewExcel, autoSuggestMapping, parseMedicaoSheet } from '../utils/parseMedicaoExcel'
import { parseMedicaoPdf } from '../utils/parseMedicaoPdf'
import type { MedicaoItem, MedicaoTab } from '@/types'

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (items: Omit<MedicaoItem, 'id'>[]) => void
  tipo: MedicaoTab
}

const FIELDS = [
  { key: 'item', label: 'Item' },
  { key: 'descricao', label: 'Descricao' },
  { key: 'unidade', label: 'UN' },
  { key: 'qtdContratada', label: 'Qtd Contratada' },
  { key: 'qtdMedida', label: 'Qtd Medida' },
  { key: 'qtdAcumulada', label: 'Acumulada' },
  { key: 'precoUnitario', label: 'PU (R$)' },
  { key: 'valorMedido', label: 'Valor Medido' },
]

export function ImportModal({ isOpen, onClose, onImport, tipo }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [fileType, setFileType] = useState<'excel' | 'pdf' | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [parsedItems, setParsedItems] = useState<Omit<MedicaoItem, 'id'>[]>([])
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setFile(null)
    setFileType(null)
    setHeaders([])
    setPreviewRows([])
    setMapping({})
    setParsedItems([])
    setStep('upload')
    setLoading(false)
    setError(null)
    setDragging(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const detectFileType = (f: File): 'excel' | 'pdf' | null => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'excel'
    if (ext === 'pdf') return 'pdf'
    return null
  }

  const processFile = useCallback(async (f: File) => {
    setError(null)
    setLoading(true)

    const type = detectFileType(f)
    if (!type) {
      setError('Formato nao suportado. Use .xlsx, .xls, .csv ou .pdf')
      setLoading(false)
      return
    }

    setFile(f)
    setFileType(type)

    try {
      if (type === 'pdf') {
        const items = await parseMedicaoPdf(f)
        setParsedItems(items)
        setStep('preview')
      } else {
        const { headers: h, rows } = await previewExcel(f)
        setHeaders(h)
        setPreviewRows(rows.slice(0, 10))
        const suggested = autoSuggestMapping(h)
        setMapping(suggested)
        setStep('mapping')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const f = e.dataTransfer.files[0]
      if (f) processFile(f)
    },
    [processFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) processFile(f)
    },
    [processFile],
  )

  const handleMappingChange = useCallback((field: string, colIdx: number) => {
    setMapping((prev) => ({ ...prev, [field]: colIdx }))
  }, [])

  const handleParseWithMapping = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const items = await parseMedicaoSheet(file, mapping)
      setParsedItems(items)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar arquivo')
    } finally {
      setLoading(false)
    }
  }, [file, mapping])

  const handleImport = useCallback(() => {
    onImport(parsedItems)
    handleClose()
  }, [parsedItems, onImport, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252]">
          <div>
            <h2 className="text-[#f5f5f5] font-semibold text-base">
              Importar Medicao
            </h2>
            <p className="text-[#a3a3a3] text-xs mt-0.5">
              Tipo: {tipo} | {step === 'upload' ? 'Upload' : step === 'mapping' ? 'Mapeamento de Colunas' : 'Preview'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Step: Upload */}
          {step === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors',
                dragging
                  ? 'border-[#f97316] bg-[#f97316]/10'
                  : 'border-[#525252] hover:border-[#a3a3a3] bg-[#3d3d3d]/50',
              )}
            >
              <Upload size={40} className="text-[#a3a3a3] mb-4" />
              <p className="text-[#f5f5f5] text-sm font-medium mb-1">
                Arraste e solte o arquivo aqui
              </p>
              <p className="text-[#a3a3a3] text-xs">
                Aceita: Excel (.xlsx) ou PDF (.pdf)
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          )}

          {/* Step: Column mapping */}
          {step === 'mapping' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                {fileType === 'excel' ? (
                  <FileSpreadsheet size={16} className="text-green-400" />
                ) : (
                  <FileText size={16} className="text-red-400" />
                )}
                <span className="text-[#f5f5f5] text-sm">{file?.name}</span>
              </div>

              <p className="text-[#a3a3a3] text-xs mb-3">
                Mapeie as colunas do arquivo para os campos da medicao:
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-2">
                    <span className="text-[#f5f5f5] text-xs w-28 shrink-0">
                      {field.label}
                    </span>
                    <div className="relative flex-1">
                      <select
                        value={mapping[field.key] ?? -1}
                        onChange={(e) => handleMappingChange(field.key, Number(e.target.value))}
                        className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg text-xs text-[#f5f5f5] px-3 py-2 pr-8 appearance-none"
                      >
                        <option value={-1}>-- Nenhum --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Coluna ${i + 1}`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a3a3a3] pointer-events-none"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Raw preview */}
              {previewRows.length > 0 && (
                <div>
                  <p className="text-[#a3a3a3] text-xs mb-2">
                    Preview das primeiras linhas:
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-[#525252]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#3d3d3d]">
                          {headers.map((h, i) => (
                            <th
                              key={i}
                              className="px-3 py-2 text-left text-[#a3a3a3] font-medium whitespace-nowrap"
                            >
                              {h || `Col ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, ri) => (
                          <tr
                            key={ri}
                            className="border-t border-[#525252] hover:bg-[#484848]"
                          >
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                className="px-3 py-1.5 text-[#f5f5f5] whitespace-nowrap"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Preview parsed items */}
          {step === 'preview' && (
            <div>
              <p className="text-[#a3a3a3] text-xs mb-3">
                {parsedItems.length} itens encontrados. Primeiras 10 linhas:
              </p>

              <div className="overflow-x-auto rounded-lg border border-[#525252]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#3d3d3d]">
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Item</th>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Descricao</th>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">UN</th>
                      <th className="px-3 py-2 text-right text-[#a3a3a3] font-medium">Qtd Med.</th>
                      <th className="px-3 py-2 text-right text-[#a3a3a3] font-medium">PU (R$)</th>
                      <th className="px-3 py-2 text-right text-[#a3a3a3] font-medium">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedItems.slice(0, 10).map((it, i) => (
                      <tr
                        key={i}
                        className="border-t border-[#525252] hover:bg-[#484848]"
                      >
                        <td className="px-3 py-1.5 text-[#f5f5f5] font-mono">{it.item}</td>
                        <td className="px-3 py-1.5 text-[#f5f5f5] max-w-[200px] truncate">
                          {it.descricao}
                        </td>
                        <td className="px-3 py-1.5 text-[#a3a3a3]">{it.unidade}</td>
                        <td className="px-3 py-1.5 text-[#f5f5f5] font-mono text-right">
                          {it.qtdMedida.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-1.5 text-[#f5f5f5] font-mono text-right">
                          {it.precoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-1.5 text-[#f5f5f5] font-mono text-right">
                          {it.valorMedido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-[#a3a3a3] text-sm">Processando...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#525252]">
          {step === 'mapping' && (
            <button
              onClick={() => { reset(); setStep('upload') }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              Voltar
            </button>
          )}
          {step === 'preview' && fileType === 'excel' && (
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              Voltar
            </button>
          )}
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            Cancelar
          </button>
          {step === 'mapping' && (
            <button
              onClick={handleParseWithMapping}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors disabled:opacity-50"
            >
              Analisar
            </button>
          )}
          {step === 'preview' && parsedItems.length > 0 && (
            <button
              onClick={handleImport}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
            >
              Importar {parsedItems.length} itens
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
