/**
 * LogoConfigModal — Upload and manage the company logo shown in RDO PDF exports.
 * Logo is stored in companySettingsStore (localStorage) and persists across sessions.
 */
import { useRef } from 'react'
import { X, Upload, Trash2, Building2 } from 'lucide-react'
import { useCompanySettingsStore } from '@/store/companySettingsStore'

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_MB  = 2

interface Props {
  onClose: () => void
}

export function LogoConfigModal({ onClose }: Props) {
  const { logo, companyName, setLogo, setCompanyName } = useCompanySettingsStore()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    if (!ALLOWED_MIME.includes(file.type)) {
      alert('Formato inválido. Use JPG, PNG ou WebP.')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`Arquivo muito grande. Máximo ${MAX_SIZE_MB} MB.`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogo(reader.result as string)
    reader.readAsDataURL(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-[#161616] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-[#f97316]" />
            <h2 className="text-[#f5f5f5] font-bold text-sm">Configurar Logo da Empresa</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#262626] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Company name */}
          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-1.5">
              Nome da Empresa
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Construdata Engenharia"
              className="w-full rounded-lg bg-[#1e1e1e] border border-[#2a2a2a] px-3 py-2 text-sm text-[#f5f5f5] placeholder-[#3a3a3a] focus:outline-none focus:border-[#f97316]/50 transition-colors"
            />
            <p className="text-[10px] text-[#6b6b6b] mt-1">Aparece no rodapé do cabeçalho do PDF.</p>
          </div>

          {/* Current logo preview */}
          {logo && (
            <div>
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-2">
                Logo Atual
              </label>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1e1e1e] border border-[#2a2a2a]">
                <div className="flex-1 flex items-center justify-center bg-white rounded-lg p-2" style={{ maxHeight: 72 }}>
                  <img
                    src={logo}
                    alt="Logo"
                    className="max-h-14 max-w-[160px] object-contain"
                  />
                </div>
                <button
                  onClick={() => setLogo(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#ef4444] hover:bg-[#ef4444]/10 border border-[#ef4444]/20 transition-colors"
                >
                  <Trash2 size={12} />
                  Remover
                </button>
              </div>
            </div>
          )}

          {/* Upload zone */}
          <div>
            <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-2">
              {logo ? 'Substituir Logo' : 'Carregar Logo'}
            </label>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-[#2a2a2a] hover:border-[#f97316]/50 cursor-pointer transition-colors"
            >
              <Upload size={20} className="text-[#6b6b6b]" />
              <p className="text-xs text-[#a3a3a3] text-center">
                Clique ou arraste uma imagem aqui
              </p>
              <p className="text-[10px] text-[#6b6b6b]">JPG, PNG, WebP · Máx. {MAX_SIZE_MB} MB</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ALLOWED_MIME.join(',')}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>

          {!logo && (
            <p className="text-[10px] text-[#6b6b6b] bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2">
              Sem logo configurada — o PDF usará o ícone padrão "R" da Construdata.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#2a2a2a]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#f97316] text-white hover:bg-[#ea580c] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
