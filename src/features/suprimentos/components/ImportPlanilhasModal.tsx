/**
 * ImportPlanilhasModal — Import XLSX for Planilhas Consolidadas.
 *
 * Flow:
 *   1. User picks a file
 *   2. Auto-detect sheet type (Resumo / Consolidado / Materiais) or user selects
 *   3. Preview headers + first rows
 *   4. Confirm → parse all rows → store
 */
import { useState, useRef } from 'react'
import { Upload, X, AlertCircle, CheckCircle, Table2, ChevronDown } from 'lucide-react'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import {
  readWorkbook,
  previewWorkbook,
  detectSheetType,
  parseResumo,
  parseTrechos,
  parseMateriais,
} from '../utils/parsePlanilhasConsolidadas'
import type { PlanilhaType, PlanilhaPreview } from '../utils/parsePlanilhasConsolidadas'
import { cn } from '@/lib/utils'

const TYPE_INFO: Record<PlanilhaType, { label: string; desc: string; color: string }> = {
  resumo:       { label: 'Resumo por Núcleo',   desc: 'Núcleos com trechos/km por status',       color: '#3b82f6' },
  consolidado:  { label: 'Consolidado Trechos',  desc: 'Todos os trechos com PV, DN, extensão',   color: '#22c55e' },
  materiais:    { label: 'Materiais Pendentes',   desc: 'Materiais por núcleo/rua com quantidades', color: '#f59e0b' },
}

interface Props {
  onClose: () => void
}

export function ImportPlanilhasModal({ onClose }: Props) {
  const {
    importPlanilhaResumo,
    importPlanilhaTrechos,
    importPlanilhaMateriais,
    setPlanilhaMetadata,
  } = useSuprimentosStore()

  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [wb, setWb] = useState<import('xlsx').WorkBook | null>(null)
  const [preview, setPreview] = useState<PlanilhaPreview | null>(null)
  const [selectedType, setSelectedType] = useState<PlanilhaType>('consolidado')
  const [detectedType, setDetectedType] = useState<PlanilhaType | null>(null)
  const [selectedSheet, setSelectedSheet] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const [importedType, setImportedType] = useState<PlanilhaType>('consolidado')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''
    setError(null)
    setLoading(true)
    try {
      const workbook = await readWorkbook(file)
      setWb(workbook)

      const pv = previewWorkbook(workbook, 0)
      setPreview(pv)

      // Auto-detect type
      const detected = detectSheetType(pv.headers)
      setDetectedType(detected)
      if (detected) setSelectedType(detected)

      setSelectedSheet(0)
      setStep('preview')
    } catch {
      setError('Erro ao ler o arquivo. Certifique-se de que é um .xlsx ou .csv válido.')
    } finally {
      setLoading(false)
    }
  }

  function handleSheetChange(idx: number) {
    if (!wb) return
    setSelectedSheet(idx)
    const pv = previewWorkbook(wb, idx)
    setPreview(pv)
    const detected = detectSheetType(pv.headers)
    setDetectedType(detected)
    if (detected) setSelectedType(detected)
  }

  function handleConfirm() {
    if (!wb) return
    setError(null)

    if (selectedType === 'resumo') {
      const result = parseResumo(wb, selectedSheet)
      if (result.errors.length > 0 && result.items.length === 0) {
        setError(result.errors.join(' '))
        return
      }
      importPlanilhaResumo(result.items)
      setImportedCount(result.items.length)
      setPlanilhaMetadata({ dataRef: new Date().toISOString().slice(0, 10), contrato: '' })
    } else if (selectedType === 'consolidado') {
      const result = parseTrechos(wb, selectedSheet)
      if (result.errors.length > 0 && result.items.length === 0) {
        setError(result.errors.join(' '))
        return
      }
      importPlanilhaTrechos(result.items)
      setImportedCount(result.items.length)
      setPlanilhaMetadata({ dataRef: new Date().toISOString().slice(0, 10), contrato: '' })
    } else {
      const result = parseMateriais(wb, selectedSheet)
      if (result.errors.length > 0 && result.items.length === 0) {
        setError(result.errors.join(' '))
        return
      }
      importPlanilhaMateriais(result.items)
      const totalItems = result.items.reduce((s, n) => s + n.ruas.reduce((ss, r) => ss + r.items.length, 0), 0)
      setImportedCount(totalItems)
      setPlanilhaMetadata({ dataRef: new Date().toISOString().slice(0, 10), contrato: '' })
    }

    setImportedType(selectedType)
    setStep('done')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2 size={16} className="text-[#f97316]" />
            <span className="text-white font-semibold text-sm">
              Importar Planilha Consolidada
            </span>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center">
                <Upload size={28} className="text-[#f97316]" />
              </div>
              <h3 className="text-white font-semibold text-base mb-1">
                Importar Planilha Consolidada
              </h3>
              <p className="text-[#a3a3a3] text-xs mb-2 leading-relaxed max-w-md mx-auto">
                Aceita planilhas Excel (.xlsx, .xls) ou CSV. O sistema detecta automaticamente
                o tipo de planilha (Resumo, Consolidado, ou Materiais Pendentes).
              </p>
              <div className="flex justify-center gap-3 mb-6">
                {(Object.entries(TYPE_INFO) as [PlanilhaType, typeof TYPE_INFO[PlanilhaType]][]).map(([key, info]) => (
                  <div key={key} className="px-3 py-2 rounded-lg bg-[#3d3d3d] border border-[#525252] text-left">
                    <p className="text-xs font-semibold" style={{ color: info.color }}>{info.label}</p>
                    <p className="text-[10px] text-[#6b6b6b]">{info.desc}</p>
                  </div>
                ))}
              </div>
              {error && (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4 text-left max-w-md mx-auto">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 bg-[#f97316] hover:bg-[#ea580c]"
              >
                {loading ? 'Lendo arquivo…' : 'Selecionar Arquivo'}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              {/* Sheet selector (if multiple sheets) */}
              {preview.sheetNames.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#a3a3a3]">Aba:</span>
                  <div className="relative">
                    <select
                      value={selectedSheet}
                      onChange={(e) => handleSheetChange(Number(e.target.value))}
                      className="appearance-none bg-[#3a3a3a] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] outline-none pr-7"
                    >
                      {preview.sheetNames.map((name, idx) => (
                        <option key={idx} value={idx}>{name}</option>
                      ))}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b6b6b] pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Type selector */}
              <div>
                <p className="text-xs text-[#a3a3a3] font-semibold mb-2">
                  Tipo de Planilha
                  {detectedType && (
                    <span className="ml-2 text-[#4ade80] font-normal">(detectado: {TYPE_INFO[detectedType].label})</span>
                  )}
                </p>
                <div className="flex gap-2">
                  {(Object.entries(TYPE_INFO) as [PlanilhaType, typeof TYPE_INFO[PlanilhaType]][]).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedType(key)}
                      className={cn(
                        'px-3 py-2 rounded-lg border text-xs font-medium transition-colors',
                        selectedType === key
                          ? 'border-[#f97316] bg-[#f97316]/10 text-[#f97316]'
                          : 'border-[#525252] text-[#6b6b6b] hover:text-[#f5f5f5]',
                      )}
                    >
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs">
                <span className="text-[#a3a3a3]">
                  <span className="font-semibold text-[#f5f5f5]">{preview.rowCount}</span> linhas encontradas
                </span>
                <span className="text-[#a3a3a3]">
                  <span className="font-semibold text-[#f5f5f5]">{preview.headers.length}</span> colunas
                </span>
              </div>

              {/* Headers + sample data */}
              <div className="border border-[#525252] rounded-xl overflow-hidden">
                <div className="overflow-auto max-h-52">
                  <table className="w-full text-[10px]">
                    <thead className="bg-[#3d3d3d] sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left text-[#f97316] font-semibold">#</th>
                        {preview.headers.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-left text-[#a3a3a3] font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row, i) => (
                        <tr key={i} className="border-t border-[#525252]/30 hover:bg-[#484848]/30">
                          <td className="px-2 py-1 text-[#6b6b6b]">{i + 1}</td>
                          {preview.headers.map((h) => (
                            <td key={h} className="px-2 py-1 text-[#f5f5f5] max-w-[150px] truncate" title={row[h]}>
                              {row[h] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-white font-semibold text-base mb-1">Importação concluída</h3>
              <p className="text-[#a3a3a3] text-xs">
                {importedCount.toLocaleString('pt-BR')} {
                  importedType === 'resumo' ? (importedCount === 1 ? 'núcleo importado' : 'núcleos importados')
                  : importedType === 'consolidado' ? (importedCount === 1 ? 'trecho importado' : 'trechos importados')
                  : (importedCount === 1 ? 'material importado' : 'materiais importados')
                } com sucesso para a aba {TYPE_INFO[importedType].label}.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
          {step === 'upload' && (
            <button onClick={onClose} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
              Cancelar
            </button>
          )}
          {step === 'preview' && (
            <>
              <button
                onClick={() => { setStep('upload'); setError(null); setWb(null); setPreview(null) }}
                className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirm}
                className="px-5 py-2 text-xs font-semibold text-white rounded-lg transition-colors bg-[#f97316] hover:bg-[#ea580c]"
              >
                Importar {preview?.rowCount.toLocaleString('pt-BR')} linhas
              </button>
            </>
          )}
          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-white rounded-lg transition-colors bg-[#f97316] hover:bg-[#ea580c]"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
