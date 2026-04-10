/**
 * ImportConsolidadoModal — imports "Consolidado" or "Resumo" supply chain planilhas.
 *
 * Flow:
 *   1. File picker (XLSX / CSV)
 *   2. Auto-detected column mapping with dropdowns for user correction
 *   3. Confirm → creates POs or stock items in the store
 */
import { useState, useRef } from 'react'
import { Upload, X, AlertCircle, CheckCircle, FileSpreadsheet, ChevronDown } from 'lucide-react'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import {
  readConsolidadoWorkbook,
  previewConsolidado,
  applyConsolidadoMapping,
} from '../utils/parseSuprimentosConsolidado'
import type { ConsolidadoPreview } from '../utils/parseSuprimentosConsolidado'

const FIELD_OPTIONS = [
  { value: 'ignorar',       label: '— ignorar —' },
  { value: 'codigo',        label: 'Código / Item' },
  { value: 'descricao',     label: 'Descrição' },
  { value: 'unidade',       label: 'Unidade' },
  { value: 'qtdTotal',      label: 'Qtd. Total / Necessária' },
  { value: 'qtdPedida',     label: 'Qtd. Pedida / Comprada' },
  { value: 'saldo',         label: 'Saldo / Pendente' },
  { value: 'valorUnitario', label: 'Valor Unitário' },
  { value: 'fornecedor',    label: 'Fornecedor' },
  { value: 'status',        label: 'Status' },
]

const IMPORT_TARGET_OPTIONS = [
  { value: 'po',      label: 'Criar Ordens de Compra (OC)' },
  { value: 'estoque', label: 'Atualizar Estoque' },
]

interface Props {
  onClose: () => void
}

export function ImportConsolidadoModal({ onClose }: Props) {
  const { importConsolidado } = useSuprimentosStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<'upload' | 'mapping' | 'done'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [wb, setWb] = useState<import('xlsx').WorkBook | null>(null)
  const [preview, setPreview] = useState<ConsolidadoPreview | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [target, setTarget] = useState<'po' | 'estoque'>('po')
  const [importedCount, setImportedCount] = useState(0)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''
    setError(null)
    setLoading(true)
    try {
      const workbook = await readConsolidadoWorkbook(file)
      const pv = previewConsolidado(workbook)
      if (pv.errors.length > 0 && pv.headers.length === 0) {
        setError(pv.errors.join(' '))
        return
      }
      setWb(workbook)
      setPreview(pv)
      setMapping(pv.suggestedMap)
      setStep('mapping')
    } catch {
      setError('Erro ao ler o arquivo. Certifique-se de que é um .xlsx ou .csv válido.')
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    if (!wb || !preview) return
    const result = applyConsolidadoMapping(wb, mapping)
    if (result.errors.length > 0 && result.items.length === 0) {
      setError(result.errors.join(' '))
      return
    }
    importConsolidado(result.items, target)
    setImportedCount(result.items.length)
    setStep('done')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-[#f97316]" />
            <span className="text-white font-semibold text-sm">
              Importar Planilha de Suprimentos
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
                Importar Consolidado / Resumo
              </h3>
              <p className="text-[#a3a3a3] text-xs mb-6 leading-relaxed max-w-sm mx-auto">
                Aceita planilhas Excel (.xlsx, .xls) ou CSV com colunas de materiais,
                quantidades, fornecedores e status.
              </p>
              {error && (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded-lg p-3 mb-4 text-left">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50"
                style={{ backgroundColor: '#f97316' }}
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

          {/* Step: Column mapping */}
          {step === 'mapping' && preview && (
            <div className="space-y-4">
              <div>
                <p className="text-[#f5f5f5] text-sm font-medium mb-0.5">
                  Mapeamento de Colunas
                </p>
                <p className="text-[#a3a3a3] text-xs">
                  Revise o mapeamento automático e corrija se necessário.
                  Colunas marcadas "ignorar" serão descartadas.
                </p>
              </div>

              {/* Mapping grid */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {preview.headers.map((h) => (
                  <div key={h} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#f5f5f5] truncate font-mono">{h}</div>
                      {preview.rows[0]?.[h] && (
                        <div className="text-[10px] text-[#6b6b6b] truncate">
                          ex.: {preview.rows[0][h]}
                        </div>
                      )}
                    </div>
                    <div className="relative shrink-0">
                      <select
                        value={mapping[h] ?? 'ignorar'}
                        onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value }))}
                        className="appearance-none w-52 bg-[#3a3a3a] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316] pr-7"
                      >
                        {FIELD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6b6b6b] pointer-events-none" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Import target */}
              <div className="border-t border-[#525252] pt-4">
                <p className="text-xs text-[#a3a3a3] font-semibold uppercase mb-2">Destino da Importação</p>
                <div className="flex gap-3">
                  {IMPORT_TARGET_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="importTarget"
                        value={opt.value}
                        checked={target === opt.value}
                        onChange={() => setTarget(opt.value as 'po' | 'estoque')}
                        className="accent-[#f97316]"
                      />
                      <span className="text-xs text-[#f5f5f5]">{opt.label}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-[#6b6b6b] mt-1.5">
                  {target === 'po'
                    ? 'Cria Ordens de Compra pendentes para cada item da planilha.'
                    : 'Atualiza o saldo de estoque dos materiais existentes (ou cria novos).'}
                </p>
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
                {importedCount} {importedCount === 1 ? 'item importado' : 'itens importados'} com sucesso.
                {target === 'po'
                  ? ' As Ordens de Compra foram criadas na aba Conciliação.'
                  : ' O estoque foi atualizado na aba Materiais & Estoque.'}
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
          {step === 'mapping' && (
            <>
              <button
                onClick={() => { setStep('upload'); setError(null) }}
                className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirm}
                className="px-5 py-2 text-xs font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#f97316' }}
              >
                Confirmar Importação
              </button>
            </>
          )}
          {step === 'done' && (
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-white rounded-lg transition-colors"
              style={{ backgroundColor: '#f97316' }}
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
