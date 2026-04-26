import { useMemo, useState } from 'react'
import { Camera, FileWarning, Printer, Save, X as XIcon } from 'lucide-react'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { useCompanySettingsStore } from '@/store/companySettingsStore'
import { printQualityNonConformityPDF } from '../utils/nonConformityPdfExport'
import type { QualityNonConformity, QualityNonConformityStatus } from '@/types'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function compressImage(file: File, maxSize = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Erro ao ler imagem.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Erro ao carregar imagem.'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas indisponível para comprimir imagem.'))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

type Draft = Omit<QualityNonConformity, 'id' | 'number' | 'createdAt' | 'updatedAt'>

const statusOptions: { value: QualityNonConformityStatus; label: string }[] = [
  { value: 'aberta', label: 'Aberta' },
  { value: 'em_tratamento', label: 'Em tratamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'ineficaz', label: 'Ineficaz' },
]

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[10px] font-semibold tracking-widest uppercase text-[#a3a3a3] mb-1.5">
        {label}
      </span>
      {children}
    </label>
  )
}

function inputClass() {
  return 'w-full bg-[#242424] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]'
}

export function NaoConformidadePanel() {
  const { addNonConformity, setActiveTab, nonConformities } = useQualidadeStore()
  const { logos, companyName } = useCompanySettingsStore()
  const nextNumber = nonConformities.length > 0
    ? Math.max(...nonConformities.map((nc) => nc.number)) + 1
    : 1

  const [draft, setDraft] = useState<Draft>(() => ({
    documentCode: 'for-q-01',
    revision: '00',
    openedBy: '',
    company: companyName || '',
    engineerResponsible: '',
    location: '',
    ncNumber: String(nextNumber).padStart(2, '0'),
    date: todayStr(),
    lvNumber: 'NA',
    local: '',
    description: '',
    evidencePhotos: [],
    unmetRequirement: '-',
    immediateAction: '',
    deadline: '',
    actionResponsible: '',
    correctiveAction: '',
    correctiveActionDate: '',
    effectivenessResponsible: '',
    status: 'aberta',
    effectivenessDate: '',
  }))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const selectedLogo = logos[0]
  const previewNc: QualityNonConformity = useMemo(() => ({
    ...draft,
    id: 'preview',
    number: nextNumber,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [draft, nextNumber])

  function patch(updates: Partial<Draft>) {
    setDraft((prev) => ({ ...prev, ...updates }))
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return
    const remaining = 12 - draft.evidencePhotos.length
    if (remaining <= 0) return
    try {
      const photos = await Promise.all(Array.from(files).slice(0, remaining).map((file) => compressImage(file)))
      patch({ evidencePhotos: [...draft.evidencePhotos, ...photos] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar evidência.')
    }
  }

  function removePhoto(index: number) {
    patch({ evidencePhotos: draft.evidencePhotos.filter((_, idx) => idx !== index) })
  }

  function validate(): string | null {
    if (!draft.openedBy.trim()) return 'Informe o responsável pela abertura da RNC.'
    if (!draft.company.trim()) return 'Informe a empresa.'
    if (!draft.location.trim()) return 'Informe a localização.'
    if (!draft.ncNumber.trim()) return 'Informe o Nº NC.'
    if (!draft.date) return 'Informe a data.'
    if (!draft.description.trim()) return 'Descreva a não conformidade.'
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const validation = validate()
    if (validation) {
      setError(validation)
      return
    }

    addNonConformity(draft)
    setSuccess(true)
    setTimeout(() => {
      setSuccess(false)
      setActiveTab('historico')
    }, 900)
  }

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 max-w-[1100px] mx-auto">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[110px_1fr_150px] max-sm:grid-cols-1 border-b border-[#525252]">
          <div className="border-r max-sm:border-r-0 max-sm:border-b border-[#525252] p-4 bg-[#1f1f1f] flex items-center justify-center">
            <div className="w-20 h-14 bg-white rounded flex items-center justify-center overflow-hidden p-1">
              {selectedLogo ? (
                <img src={selectedLogo.base64} alt="Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="w-10 h-10 rounded bg-[#f97316] text-white flex items-center justify-center font-black text-lg">Q</div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center p-4 border-r max-sm:border-r-0 max-sm:border-b border-[#525252]">
            <h2 className="text-white text-lg font-bold uppercase tracking-wide text-center">
              Registro de Não Conformidade
            </h2>
          </div>
          <div className="grid grid-rows-2 divide-y divide-[#525252]">
            <Field label="Código" className="p-3">
              <input value={draft.documentCode} onChange={(e) => patch({ documentCode: e.target.value })} className={inputClass()} />
            </Field>
            <Field label="Rev" className="p-3">
              <input value={draft.revision} onChange={(e) => patch({ revision: e.target.value })} className={inputClass()} />
            </Field>
          </div>
        </div>

        <div className="p-4 border-b border-[#525252]">
          <Field label="Responsável pela abertura da RNC">
            <input value={draft.openedBy} onChange={(e) => patch({ openedBy: e.target.value })} className={inputClass()} />
          </Field>
        </div>

        <div className="bg-[#3a3a3a] px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-[#f97316]">
          Identificação da Frente
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border-b border-[#525252]">
          <Field label="Empresa">
            <input value={draft.company} onChange={(e) => patch({ company: e.target.value })} className={inputClass()} />
          </Field>
          <Field label="Eng. responsável">
            <input value={draft.engineerResponsible} onChange={(e) => patch({ engineerResponsible: e.target.value })} className={inputClass()} />
          </Field>
          <Field label="Localização" className="md:col-span-2">
            <input value={draft.location} onChange={(e) => patch({ location: e.target.value })} className={inputClass()} />
          </Field>
        </div>

        <div className="bg-[#3a3a3a] px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-[#f97316]">
          Não Conformidade
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-[#525252]">
          <Field label="Nº NC">
            <input value={draft.ncNumber} onChange={(e) => patch({ ncNumber: e.target.value })} className={inputClass()} />
          </Field>
          <Field label="Data">
            <input type="date" value={draft.date} onChange={(e) => patch({ date: e.target.value })} className={inputClass()} />
          </Field>
          <Field label="LV Nº">
            <input value={draft.lvNumber} onChange={(e) => patch({ lvNumber: e.target.value })} className={inputClass()} />
          </Field>
          <Field label="Local" className="md:col-span-3">
            <input value={draft.local} onChange={(e) => patch({ local: e.target.value })} className={inputClass()} />
          </Field>
          <Field label="Descrição" className="md:col-span-3">
            <textarea rows={5} value={draft.description} onChange={(e) => patch({ description: e.target.value })} className={`${inputClass()} resize-y`} />
          </Field>
          <Field label="Requisito não atendido" className="md:col-span-3">
            <textarea rows={2} value={draft.unmetRequirement} onChange={(e) => patch({ unmetRequirement: e.target.value })} className={`${inputClass()} resize-y`} />
          </Field>
        </div>

        <div className="p-4 border-b border-[#525252]">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#f97316] flex items-center gap-2">
              <Camera size={14} /> Evidência objetiva
            </h3>
            <span className="text-[10px] text-[#6b6b6b]">{draft.evidencePhotos.length}/12 evidências</span>
          </div>
          {draft.evidencePhotos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-3">
              {draft.evidencePhotos.map((src, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-[#525252] group">
                  <img src={src} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    title="Remover evidência"
                  >
                    <XIcon size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {draft.evidencePhotos.length < 12 && (
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#525252] rounded-lg text-xs text-[#a3a3a3] hover:border-[#f97316]/50 hover:text-[#f97316] cursor-pointer transition-colors">
              <Camera size={14} />
              Adicionar evidências
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => addPhotos(e.target.files)}
                onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
              />
            </label>
          )}
        </div>

        <div className="bg-[#3a3a3a] px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-[#f97316]">
          Plano de Ação
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-[#525252]">
          <Field label="Ação imediata" className="md:col-span-2">
            <textarea rows={3} value={draft.immediateAction} onChange={(e) => patch({ immediateAction: e.target.value })} className={`${inputClass()} resize-y`} />
          </Field>
          <Field label="Prazo">
            <input type="date" value={draft.deadline} onChange={(e) => patch({ deadline: e.target.value })} className={inputClass()} />
          </Field>
          <Field label="Responsável" className="md:col-span-3">
            <input value={draft.actionResponsible} onChange={(e) => patch({ actionResponsible: e.target.value })} className={inputClass()} />
          </Field>
          <Field label="Ação corretiva" className="md:col-span-2">
            <textarea rows={3} value={draft.correctiveAction} onChange={(e) => patch({ correctiveAction: e.target.value })} className={`${inputClass()} resize-y`} />
          </Field>
          <Field label="Data">
            <input type="date" value={draft.correctiveActionDate} onChange={(e) => patch({ correctiveActionDate: e.target.value })} className={inputClass()} />
          </Field>
        </div>

        <div className="bg-[#3a3a3a] px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-[#f97316]">
          Avaliação de Eficácia
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
          <Field label="Responsável">
            <input value={draft.effectivenessResponsible} onChange={(e) => patch({ effectivenessResponsible: e.target.value })} className={inputClass()} />
          </Field>
          <Field label="Status">
            <select value={draft.status} onChange={(e) => patch({ status: e.target.value as QualityNonConformityStatus })} className={inputClass()}>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Data final">
            <input type="date" value={draft.effectivenessDate} onChange={(e) => patch({ effectivenessDate: e.target.value })} className={inputClass()} />
          </Field>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
        <div className="text-xs text-[#a3a3a3] flex items-center gap-2">
          <FileWarning size={14} className="text-[#f97316]" />
          NC interna #{nextNumber} · Documento {draft.documentCode} Rev {draft.revision}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {error && <span className="text-red-400 text-sm font-medium">{error}</span>}
          {success && <span className="text-emerald-400 text-sm font-medium">Registro salvo com sucesso.</span>}
          <button
            type="button"
            onClick={() => printQualityNonConformityPDF(previewNc)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] border border-[#525252] rounded-lg font-medium text-sm transition-colors"
          >
            <Printer size={16} />
            Pré-visualizar PDF
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Save size={16} />
            Salvar NC
          </button>
        </div>
      </div>
    </form>
  )
}
