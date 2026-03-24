/**
 * MapaImportModal — File import modal for the Mapa Interativo module.
 * Supports: .txt/.csv (lat/lng), .dxf (LINE/LWPOLYLINE), .shp (BBox),
 *           .json (platform format), .ifc (message), .dwg (message)
 */
import { useState, useRef } from 'react'
import { Upload, X, FileText, AlertTriangle, CheckCircle } from 'lucide-react'
import { useMapaInterativoStore } from '@/store/mapaInterativoStore'
import type { MapNode, MapSegment, MapNetworkType, MapNodeType } from '@/types'

interface Props {
  onClose: () => void
}

type ParseResult =
  | { ok: true; nodes: MapNode[]; segments: MapSegment[]; message: string }
  | { ok: false; message: string }

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseTxt(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))
  const nodes: MapNode[] = []

  for (const line of lines) {
    const parts = line.split(/[\t,;]+/).map((s) => s.trim())
    if (parts.length < 2) continue
    // Try lat/lng: first two numeric columns
    const nums = parts.map(Number).filter((n) => !isNaN(n))
    if (nums.length < 2) continue
    const [lat, lng] = nums
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
    const label = parts.find((p) => isNaN(Number(p)))
    nodes.push({
      id: crypto.randomUUID(),
      lat,
      lng,
      nodeType: 'junction' as MapNodeType,
      label,
    })
  }

  if (nodes.length === 0) return { ok: false, message: 'Nenhuma coordenada lat/lng válida encontrada.' }
  return { ok: true, nodes, segments: [], message: `${nodes.length} pontos importados.` }
}

function parseDxf(text: string): ParseResult {
  const nodes: MapNode[] = []
  const segments: MapSegment[] = []

  const lines = text.split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const code = lines[i]?.trim()
    const val  = lines[i + 1]?.trim()
    i += 2

    if (code === '0' && val === 'LINE') {
      // Read LINE entity: 10/20 (start), 11/21 (end)
      const coords: number[] = []
      while (i < lines.length) {
        const c = lines[i]?.trim()
        const v = lines[i + 1]?.trim()
        i += 2
        if (c === '0') { i -= 2; break }
        if (['10', '20', '11', '21'].includes(c)) coords.push(parseFloat(v ?? '0'))
      }
      if (coords.length >= 4) {
        const [x1, y1, x2, y2] = coords
        const n1: MapNode = { id: crypto.randomUUID(), lat: y1, lng: x1, nodeType: 'junction' }
        const n2: MapNode = { id: crypto.randomUUID(), lat: y2, lng: x2, nodeType: 'endpoint' }
        nodes.push(n1, n2)
        segments.push({ id: crypto.randomUUID(), fromNodeId: n1.id, toNodeId: n2.id, networkType: 'generic' as MapNetworkType })
      }
    }

    if (code === '0' && val === 'LWPOLYLINE') {
      // Read LWPOLYLINE: repeated 10/20 pairs
      const pts: [number, number][] = []
      while (i < lines.length) {
        const c = lines[i]?.trim()
        const v = lines[i + 1]?.trim()
        i += 2
        if (c === '0') { i -= 2; break }
        if (c === '10') {
          const x = parseFloat(v ?? '0')
          const nextCode = lines[i]?.trim()
          const nextVal  = lines[i + 1]?.trim()
          if (nextCode === '20') {
            pts.push([x, parseFloat(nextVal ?? '0')])
            i += 2
          }
        }
      }
      if (pts.length >= 2) {
        const ptNodes: MapNode[] = pts.map(([x, y]) => ({
          id: crypto.randomUUID(), lat: y, lng: x, nodeType: 'junction' as MapNodeType,
        }))
        nodes.push(...ptNodes)
        for (let pi = 0; pi < ptNodes.length - 1; pi++) {
          segments.push({
            id: crypto.randomUUID(),
            fromNodeId: ptNodes[pi].id,
            toNodeId: ptNodes[pi + 1].id,
            networkType: 'generic' as MapNetworkType,
          })
        }
      }
    }
  }

  if (nodes.length === 0) return { ok: false, message: 'Nenhuma entidade LINE/LWPOLYLINE encontrada no DXF.' }
  return { ok: true, nodes, segments, message: `${nodes.length} nós e ${segments.length} trechos importados do DXF.` }
}

function parseShpBbox(buffer: ArrayBuffer, _fileName: string): ParseResult {
  const view = new DataView(buffer)
  if (view.byteLength < 100) return { ok: false, message: 'Arquivo SHP muito pequeno ou inválido.' }

  const fileCode = view.getInt32(0, false) // big-endian
  if (fileCode !== 9994) return { ok: false, message: 'Código de arquivo SHP inválido (esperado 9994).' }

  // BBox: Xmin=36, Ymin=44, Xmax=52, Ymax=60 (little-endian double)
  const xMin = view.getFloat64(36, true)
  const yMin = view.getFloat64(44, true)
  const xMax = view.getFloat64(52, true)
  const yMax = view.getFloat64(60, true)

  if (isNaN(xMin) || isNaN(yMin) || isNaN(xMax) || isNaN(yMax)) {
    return { ok: false, message: 'Não foi possível ler o bounding box do SHP.' }
  }

  // Create 4 corner nodes + bounding rectangle
  const corners: MapNode[] = [
    { id: crypto.randomUUID(), lat: yMin, lng: xMin, label: 'SHP-SW', nodeType: 'endpoint' },
    { id: crypto.randomUUID(), lat: yMin, lng: xMax, label: 'SHP-SE', nodeType: 'endpoint' },
    { id: crypto.randomUUID(), lat: yMax, lng: xMax, label: 'SHP-NE', nodeType: 'endpoint' },
    { id: crypto.randomUUID(), lat: yMax, lng: xMin, label: 'SHP-NW', nodeType: 'endpoint' },
  ]
  const segs: MapSegment[] = [
    { id: crypto.randomUUID(), fromNodeId: corners[0].id, toNodeId: corners[1].id, networkType: 'generic', label: 'SHP bbox' },
    { id: crypto.randomUUID(), fromNodeId: corners[1].id, toNodeId: corners[2].id, networkType: 'generic', label: 'SHP bbox' },
    { id: crypto.randomUUID(), fromNodeId: corners[2].id, toNodeId: corners[3].id, networkType: 'generic', label: 'SHP bbox' },
    { id: crypto.randomUUID(), fromNodeId: corners[3].id, toNodeId: corners[0].id, networkType: 'generic', label: 'SHP bbox' },
  ]

  return {
    ok: true,
    nodes: corners,
    segments: segs,
    message: `SHP importado como bounding box (${xMin.toFixed(4)}, ${yMin.toFixed(4)}) → (${xMax.toFixed(4)}, ${yMax.toFixed(4)}).`,
  }
}

function parseJson(text: string): ParseResult {
  try {
    const data = JSON.parse(text)
    const nodes: MapNode[]     = Array.isArray(data.nodes)    ? data.nodes    : []
    const segments: MapSegment[] = Array.isArray(data.segments) ? data.segments : []
    if (nodes.length === 0 && segments.length === 0) {
      return { ok: false, message: 'JSON não contém nodes/segments válidos.' }
    }
    return { ok: true, nodes, segments, message: `${nodes.length} nós e ${segments.length} trechos carregados do JSON.` }
  } catch {
    return { ok: false, message: 'Erro ao analisar JSON.' }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapaImportModal({ onClose }: Props) {
  const importNodes    = useMapaInterativoStore((s) => s.importNodes)
  const importSegments = useMapaInterativoStore((s) => s.importSegments)

  const [result, setResult]     = useState<ParseResult | null>(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    setFileName(file.name)
    setResult(null)
    setLoading(true)

    if (ext === 'dwg') {
      setResult({ ok: false, message: 'Formato DWG é binário proprietário da Autodesk. Converta para DXF via AutoCAD, LibreCAD ou FreeCAD antes de importar.' })
      setLoading(false)
      return
    }

    if (ext === 'ifc') {
      setResult({ ok: false, message: 'Formato IFC binário não suportado diretamente. Exporte como IFC-JSON ou DXF no seu software BIM (Revit, ArchiCAD, FreeCAD).' })
      setLoading(false)
      return
    }

    if (ext === 'shp') {
      file.arrayBuffer().then((buf) => {
        setResult(parseShpBbox(buf, file.name))
        setLoading(false)
      })
      return
    }

    file.text().then((text) => {
      let r: ParseResult
      if (ext === 'dxf') r = parseDxf(text)
      else if (ext === 'json') r = parseJson(text)
      else r = parseTxt(text)  // .txt, .csv, and any other text
      setResult(r)
      setLoading(false)
    })
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleConfirm() {
    if (!result || !result.ok) return
    if (result.nodes.length > 0) importNodes(result.nodes)
    if (result.segments.length > 0) importSegments(result.segments)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-sm font-bold text-white">Importar Arquivo</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-orange-500 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <Upload size={28} className="mx-auto text-gray-500 mb-3" />
            <p className="text-sm text-gray-400">Arraste ou clique para selecionar</p>
            <p className="text-[10px] text-gray-600 mt-1">.txt .csv .dxf .shp .json .ifc .dwg</p>
            {fileName && <p className="text-xs text-orange-400 mt-2 font-semibold">{fileName}</p>}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.dxf,.shp,.json,.ifc,.dwg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />

          {/* Result */}
          {loading && <p className="text-xs text-gray-400 text-center">Analisando arquivo...</p>}
          {result && (
            <div className={`flex items-start gap-3 p-3 rounded-lg text-xs ${
              result.ok ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'
            }`}>
              {result.ok
                ? <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
                : <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />}
              <p className={result.ok ? 'text-green-300' : 'text-red-300'}>{result.message}</p>
            </div>
          )}

          {/* Supported formats info */}
          <div className="text-[10px] text-gray-600 space-y-0.5">
            <p><span className="text-gray-500">.txt/.csv</span> — colunas lat, lng (separado por vírgula, tab ou ponto-e-vírgula)</p>
            <p><span className="text-gray-500">.dxf</span> — entidades LINE e LWPOLYLINE → nós e trechos</p>
            <p><span className="text-gray-500">.shp</span> — importa bounding box como 4 nós de canto</p>
            <p><span className="text-gray-500">.json</span> — formato nativo da plataforma &#123; nodes, segments &#125;</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!result?.ok}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <FileText size={13} className="inline mr-1" />
            Importar
          </button>
        </div>
      </div>
    </div>
  )
}
