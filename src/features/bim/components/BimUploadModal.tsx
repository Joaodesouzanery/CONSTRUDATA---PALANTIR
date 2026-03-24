import { useRef, useState, type DragEvent } from 'react'
import { X, Upload, FileCheck } from 'lucide-react'
import { useBimStore } from '@/store/bimStore'

interface Props {
  onClose: () => void
}

interface PickedFiles {
  shp: File | null
  dbf: File | null
  shx: File | null
}

export function BimUploadModal({ onClose }: Props) {
  const loadShapefile = useBimStore((s) => s.loadShapefile)
  const isLoading = useBimStore((s) => s.isLoading)
  const loadError = useBimStore((s) => s.loadError)

  const [files, setFiles] = useState<PickedFiles>({ shp: null, dbf: null, shx: null })
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function assignFiles(fileList: FileList | File[]) {
    const arr = Array.from(fileList)
    const next: PickedFiles = { ...files }
    arr.forEach((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      if (ext === 'shp') next.shp = f
      else if (ext === 'dbf') next.dbf = f
      else if (ext === 'shx') next.shx = f
    })
    setFiles(next)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    assignFiles(e.dataTransfer.files)
  }

  async function handleLoad() {
    if (!files.shp || !files.dbf) return
    const [shpBuf, dbfBuf] = await Promise.all([
      files.shp.arrayBuffer(),
      files.dbf.arrayBuffer(),
    ])
    await loadShapefile(shpBuf, dbfBuf)
    if (!loadError) onClose()
  }

  const ready = !!files.shp && !!files.dbf

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-[480px] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-100 font-semibold">Importar Shapefile</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 hover:border-gray-500'
          }`}
        >
          <Upload size={32} className="mx-auto text-gray-500 mb-2" />
          <p className="text-gray-300 text-sm font-medium">Arraste os arquivos aqui</p>
          <p className="text-gray-500 text-xs mt-1">ou clique para selecionar</p>
          <p className="text-gray-600 text-xs mt-2">.shp + .dbf (obrigatórios) + .shx (opcional)</p>
          <input
            ref={inputRef}
            type="file"
            accept=".shp,.dbf,.shx"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && assignFiles(e.target.files)}
          />
        </div>

        {/* Selected files */}
        <div className="mt-4 space-y-2">
          {(['shp', 'dbf', 'shx'] as const).map((ext) => (
            <div key={ext} className="flex items-center gap-2 text-xs">
              <FileCheck
                size={14}
                className={files[ext] ? 'text-green-400' : 'text-gray-600'}
              />
              <span className={files[ext] ? 'text-gray-300' : 'text-gray-600'}>
                .{ext.toUpperCase()} — {files[ext] ? files[ext]!.name : 'não selecionado'}
                {ext === 'shx' && ' (opcional)'}
              </span>
            </div>
          ))}
        </div>

        {loadError && (
          <p className="mt-3 text-red-400 text-xs bg-red-900/20 border border-red-800 rounded p-2">
            Erro: {loadError}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-400 hover:text-gray-200 text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleLoad}
            disabled={!ready || isLoading}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Carregando…' : 'Carregar Rede'}
          </button>
        </div>
      </div>
    </div>
  )
}
