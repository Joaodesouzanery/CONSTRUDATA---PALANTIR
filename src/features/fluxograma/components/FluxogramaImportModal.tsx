import { useState, useCallback, useRef } from 'react'
import { X, Upload, FileSpreadsheet, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  previewFluxogramaExcel,
  autoSuggestFluxogramaMapping,
  parseFluxogramaSheet,
} from '../utils/parseFluxogramaExcel'
import type { FluxoEdgeHint } from '../utils/parseFluxogramaExcel'
import type { FluxoNode } from '@/types'

interface FluxogramaImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (nodes: Omit<FluxoNode, 'id'>[], edgeHints: FluxoEdgeHint[]) => void
}

const FIELDS = [
  { key: 'etapa', label: 'Etapa / Nome' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'status', label: 'Status' },
  { key: 'responsavel', label: 'Responsavel' },
  { key: 'dependencia', label: 'Dependencia' },
  { key: 'dataInicio', label: 'Data Inicio' },
  { key: 'dataFim', label: 'Data Fim' },
  { key: 'progresso', label: 'Progresso (%)' },
  { key: 'descricao', label: 'Descricao' },
]

export function FluxogramaImportModal({ isOpen, onClose, onImport }: FluxogramaImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [parsedNodes, setParsedNodes] = useState<Omit<FluxoNode, 'id'>[]>([])
  const [parsedEdgeHints, setParsedEdgeHints] = useState<FluxoEdgeHint[]>([])
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'confirm'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [headerRow, setHeaderRow] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setFile(null)
    setHeaders([])
    setPreviewRows([])
    setMapping({})
    setParsedNodes([])
    setParsedEdgeHints([])
    setStep('upload')
    setLoading(false)
    setError(null)
    setDragging(false)
    setHeaderRow(0)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const processFile = useCallback(async (f: File) => {
    setError(null)
    setLoading(true)

    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') {
      setError('Formato nao suportado. Use .xlsx, .xls ou .csv')
      setLoading(false)
      return
    }

    setFile(f)

    try {
      const { headers: h, rows, headerRow: hr } = await previewFluxogramaExcel(f)
      setHeaders(h)
      setHeaderRow(hr)
      setPreviewRows(rows.slice(0, 30))
      const suggested = autoSuggestFluxogramaMapping(h)
      setMapping(suggested)
      setStep('mapping')
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
      const { nodes, edgeHints } = await parseFluxogramaSheet(file, mapping, headerRow)
      setParsedNodes(nodes)
      setParsedEdgeHints(edgeHints)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao analisar arquivo')
    } finally {
      setLoading(false)
    }
  }, [file, mapping, headerRow])

  const handleConfirm = useCallback(() => {
    setStep('confirm')
  }, [])

  const handleImport = useCallback(() => {
    onImport(parsedNodes, parsedEdgeHints)
    handleClose()
  }, [parsedNodes, parsedEdgeHints, onImport, handleClose])

  if (!isOpen) return null

  const STATUS_COLORS: Record<string, string> = {
    concluido: '#22c55e',
    em_andamento: '#f97316',
    pendente: '#6b6b6b',
    bloqueado: '#ef4444',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#525252]">
          <div>
            <h2 className="text-[#f5f5f5] font-semibold text-base">Importar Fluxograma</h2>
            <p className="text-[#a3a3a3] text-xs mt-0.5">
              {step === 'upload' && 'Passo 1: Upload do arquivo'}
              {step === 'mapping' && 'Passo 2: Mapeamento de colunas'}
              {step === 'preview' && 'Passo 3: Preview dos dados'}
              {step === 'confirm' && 'Passo 4: Confirmar importacao'}
            </p>
          </div>
          <button onClick={handleClose} className="text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors p-1">
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
              <p className="text-[#f5f5f5] text-sm font-medium mb-1">Arraste e solte o arquivo aqui</p>
              <p className="text-[#a3a3a3] text-xs">Aceita: Excel (.xlsx, .xls, .csv)</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          )}

          {/* Step: Column mapping */}
          {step === 'mapping' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileSpreadsheet size={16} className="text-green-400" />
                <span className="text-[#f5f5f5] text-sm">{file?.name}</span>
              </div>

              <p className="text-[#a3a3a3] text-xs mb-3">
                Mapeie as colunas do arquivo para os campos do fluxograma:
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-2">
                    <span className="text-[#f5f5f5] text-xs w-28 shrink-0">{field.label}</span>
                    <div className="relative flex-1">
                      <select
                        value={mapping[field.key] ?? -1}
                        onChange={(e) => handleMappingChange(field.key, Number(e.target.value))}
                        className="w-full bg-[#3d3d3d] border border-[#525252] rounded-lg text-xs text-[#f5f5f5] px-3 py-2 pr-8 appearance-none"
                      >
                        <option value={-1}>-- Nenhum --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
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
                  <p className="text-[#a3a3a3] text-xs mb-2">Preview das primeiras linhas:</p>
                  <div className="overflow-x-auto rounded-lg border border-[#525252]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[#3d3d3d]">
                          {headers.map((h, i) => (
                            <th key={i} className="px-3 py-2 text-left text-[#a3a3a3] font-medium whitespace-nowrap">
                              {h || `Col ${i + 1}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, ri) => (
                          <tr key={ri} className="border-t border-[#525252] hover:bg-[#484848]">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-3 py-1.5 text-[#f5f5f5] whitespace-nowrap">{cell}</td>
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

          {/* Step: Preview parsed nodes */}
          {step === 'preview' && (
            <div>
              <div className="flex items-center gap-4 mb-4">
                <p className="text-[#a3a3a3] text-xs">
                  <span className="text-[#f97316] font-semibold text-sm">{parsedNodes.length}</span> etapas encontradas
                </p>
                <p className="text-[#a3a3a3] text-xs">
                  <span className="text-[#f97316] font-semibold text-sm">{parsedEdgeHints.length}</span> conexoes detectadas
                </p>
              </div>

              <div className="overflow-x-auto rounded-lg border border-[#525252] max-h-[50vh] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#3d3d3d] z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">#</th>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Etapa</th>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Tipo</th>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Status</th>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Responsavel</th>
                      <th className="px-3 py-2 text-left text-[#a3a3a3] font-medium">Progresso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedNodes.map((node, i) => (
                      <tr key={i} className="border-t border-[#525252] hover:bg-[#484848]">
                        <td className="px-3 py-1.5 text-[#6b6b6b] font-mono">{i + 1}</td>
                        <td className="px-3 py-1.5 text-[#f5f5f5] font-medium">{node.label}</td>
                        <td className="px-3 py-1.5 text-[#a3a3a3]">{node.type}</td>
                        <td className="px-3 py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: STATUS_COLORS[node.status] ?? '#6b6b6b' }}
                            />
                            <span className="text-[#f5f5f5]">{node.status}</span>
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-[#a3a3a3]">{node.responsavel ?? '-'}</td>
                        <td className="px-3 py-1.5 text-[#a3a3a3] font-mono">{node.progressoPct ?? 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && (
            <div className="flex flex-col items-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#f97316]/20 flex items-center justify-center mb-4">
                <FileSpreadsheet size={28} className="text-[#f97316]" />
              </div>
              <h3 className="text-[#f5f5f5] font-semibold text-lg mb-2">Confirmar Importacao</h3>
              <p className="text-[#a3a3a3] text-sm text-center max-w-md mb-6">
                Serao importadas <span className="text-[#f97316] font-semibold">{parsedNodes.length}</span> etapas
                e <span className="text-[#f97316] font-semibold">{parsedEdgeHints.length}</span> conexoes para o fluxograma.
                Os nos serao posicionados automaticamente no canvas.
              </p>
              <button
                onClick={handleImport}
                className="px-6 py-3 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
              >
                Importar Agora
              </button>
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
              onClick={() => { reset() }}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              Voltar
            </button>
          )}
          {step === 'preview' && (
            <button
              onClick={() => setStep('mapping')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              Voltar
            </button>
          )}
          {step === 'confirm' && (
            <button
              onClick={() => setStep('preview')}
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
          {step === 'preview' && parsedNodes.length > 0 && (
            <button
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors"
            >
              Continuar ({parsedNodes.length} etapas)
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
