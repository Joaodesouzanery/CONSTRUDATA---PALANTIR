import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle, FileSpreadsheet, Loader2, Table2, Upload, X } from 'lucide-react'
import type * as XLSX from 'xlsx'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import {
  parseMateriais,
  parseResumo,
  parseTrechos,
  previewWorkbook,
  readWorkbook,
  type PlanilhaPreview,
  type PlanilhaType,
} from '../utils/parsePlanilhasConsolidadas'
import { cn } from '@/lib/utils'

interface Props {
  onClose: () => void
}

type SlotKey = PlanilhaType

interface SlotState {
  fileName: string
  workbook: XLSX.WorkBook | null
  preview: PlanilhaPreview | null
  count: number
  errors: string[]
}

const SLOT_INFO: Record<SlotKey, { label: string; desc: string; accept: string }> = {
  resumo: {
    label: 'Resumo.xlsx',
    desc: 'Dashboard por nucleo: km exec, km pend, % execucao e ratio.',
    accept: '.xlsx,.xls,.csv',
  },
  consolidado: {
    label: 'Consolidado.xlsx',
    desc: 'Detalhe rua por rua, rede, status e extensao dos trechos.',
    accept: '.xlsx,.xls,.csv',
  },
  materiais: {
    label: 'Materiais Pendentes.xlsx',
    desc: 'Compras por trecho pendente: tubos, metragem e auxiliares.',
    accept: '.xlsx,.xls,.csv',
  },
}

const emptySlot: SlotState = { fileName: '', workbook: null, preview: null, count: 0, errors: [] }

function UploadSlot({
  type,
  state,
  loading,
  onPick,
}: {
  type: SlotKey
  state: SlotState
  loading: boolean
  onPick: (type: SlotKey, file: File) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const info = SLOT_INFO[type]
  return (
    <div className="border border-[#525252] rounded-xl bg-[#333333] overflow-hidden">
      <div className="p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center shrink-0">
          <FileSpreadsheet size={17} className="text-[#f97316]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#f5f5f5]">{info.label}</p>
          <p className="text-[11px] text-[#a3a3a3] leading-relaxed">{info.desc}</p>
          {state.fileName && (
            <p className="text-[11px] text-[#4ade80] mt-1 truncate">{state.fileName}</p>
          )}
        </div>
        <button
          onClick={() => ref.current?.click()}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#484848] border border-[#525252] text-[#f5f5f5] hover:bg-[#525252] disabled:opacity-50"
        >
          {state.fileName ? 'Trocar' : 'Escolher'}
        </button>
        <input
          ref={ref}
          type="file"
          accept={info.accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onPick(type, file)
            e.currentTarget.value = ''
          }}
        />
      </div>

      {state.preview && (
        <div className="border-t border-[#525252] bg-[#2b2b2b] p-3">
          <div className="flex items-center gap-3 text-[11px] mb-2">
            <span className="text-[#a3a3a3]">
              <span className="text-[#f5f5f5] font-semibold">{state.preview.rowCount}</span> linhas
            </span>
            <span className="text-[#a3a3a3]">
              <span className="text-[#f5f5f5] font-semibold">{state.preview.headers.length}</span> colunas
            </span>
            <span className="text-[#4ade80] ml-auto">{state.count.toLocaleString('pt-BR')} registros validos</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {state.preview.headers.slice(0, 12).map((header) => (
              <span key={header} className="px-2 py-1 rounded bg-[#3d3d3d] text-[10px] text-[#a3a3a3] border border-[#525252]">
                {header}
              </span>
            ))}
            {state.preview.headers.length > 12 && (
              <span className="px-2 py-1 rounded bg-[#3d3d3d] text-[10px] text-[#6b6b6b] border border-[#525252]">
                +{state.preview.headers.length - 12}
              </span>
            )}
          </div>
          {state.errors.length > 0 && (
            <div className="flex items-start gap-2 text-amber-300 text-[11px] mt-2">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{state.errors.join(' ')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ImportPlanilhasModal({ onClose }: Props) {
  const importPlanilhasSupabase = useSuprimentosStore((s) => s.importPlanilhasSupabase)
  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>({
    resumo: emptySlot,
    consolidado: emptySlot,
    materiais: emptySlot,
  })
  const [loadingType, setLoadingType] = useState<SlotKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleFile(type: SlotKey, file: File) {
    setLoadingType(type)
    setError(null)
    try {
      const workbook = await readWorkbook(file)
      const preview = previewWorkbook(workbook, 0)
      let count = 0
      let errors: string[] = []
      if (type === 'resumo') {
        const result = parseResumo(workbook, 0)
        count = result.items.length
        errors = result.errors
      } else if (type === 'consolidado') {
        const result = parseTrechos(workbook, 0)
        count = result.items.length
        errors = result.errors
      } else {
        const result = parseMateriais(workbook, 0)
        count = result.items.reduce((s, n) => s + n.ruas.reduce((ss, r) => ss + r.items.length, 0), 0)
        errors = result.errors
      }

      setSlots((prev) => ({
        ...prev,
        [type]: {
          fileName: file.name,
          workbook,
          preview,
          count,
          errors,
        },
      }))
    } catch {
      setError(`Erro ao ler ${file.name}. Confirme se o arquivo e um Excel/CSV valido.`)
    } finally {
      setLoadingType(null)
    }
  }

  async function handleConfirm() {
    setSaving(true)
    setError(null)
    try {
      const resumo = slots.resumo.workbook ? parseResumo(slots.resumo.workbook).items : undefined
      const trechos = slots.consolidado.workbook ? parseTrechos(slots.consolidado.workbook).items : undefined
      const materiais = slots.materiais.workbook ? parseMateriais(slots.materiais.workbook).items : undefined
      if (!resumo?.length && !trechos?.length && !materiais?.length) {
        throw new Error('Escolha pelo menos um arquivo com dados validos.')
      }
      await importPlanilhasSupabase({ resumo, trechos, materiais })
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar as planilhas no Supabase.')
    } finally {
      setSaving(false)
    }
  }

  const totalCount = Object.values(slots).reduce((s, slot) => s + slot.count, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-4xl bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Table2 size={16} className="text-[#f97316]" />
            <span className="text-white font-semibold text-sm">Importar Suprimentos</span>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {done ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-white font-semibold text-base mb-1">Importacao concluida</h3>
              <p className="text-[#a3a3a3] text-xs">
                {totalCount.toLocaleString('pt-BR')} registros processados e salvos no Supabase.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-[#525252] bg-[#1f1f1f] p-3">
                <Upload size={16} className="text-[#f97316] mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#f5f5f5]">Modo A: Importar Excel</p>
                  <p className="text-[11px] text-[#a3a3a3] leading-relaxed">
                    Carregue um, dois ou tres arquivos. As colunas sao mapeadas por palavras-chave flexiveis e as tres visoes sempre leem do Supabase.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {(Object.keys(SLOT_INFO) as SlotKey[]).map((type) => (
                  <UploadSlot
                    key={type}
                    type={type}
                    state={slots[type]}
                    loading={loadingType === type}
                    onPick={handleFile}
                  />
                ))}
              </div>

              {error && (
                <div className="flex items-start gap-2 text-red-400 text-xs bg-red-900/20 border border-red-700/30 rounded-lg p-3">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
            {done ? 'Fechar' : 'Cancelar'}
          </button>
          {!done && (
            <button
              onClick={handleConfirm}
              disabled={saving || loadingType !== null || totalCount === 0}
              className={cn(
                'px-5 py-2 text-xs font-semibold text-white rounded-lg transition-colors bg-[#f97316] hover:bg-[#ea580c]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {saving ? (
                <span className="flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Salvando...</span>
              ) : (
                `Salvar ${totalCount.toLocaleString('pt-BR')} registros`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
