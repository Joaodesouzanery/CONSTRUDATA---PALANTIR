import { useMemo, useState } from 'react'
import { useMedicaoStore } from '@/store/medicaoStore'
import type { ConsolidatedSegment } from '@/types'

function fmt(n: number) { return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) }

interface BomLine {
  material: string
  un: string
  qty: number
}

/** Estimate BOM for a group of pending segments */
function calcBom(segs: ConsolidatedSegment[]): BomLine[] {
  let totalMetersEsg200 = 0, totalMetersEsg300 = 0, totalMetersAg63 = 0, totalMetersAg110 = 0, totalMetersOther = 0
  let pvCount = 0

  for (const seg of segs) {
    const m = seg.extM || 0
    if (seg.tipo === 'ESGOTO') {
      if ((seg.dnMm ?? 0) <= 200) totalMetersEsg200 += m
      else if ((seg.dnMm ?? 0) <= 300) totalMetersEsg300 += m
      else totalMetersOther += m
    } else {
      if ((seg.dnMm ?? 0) <= 63) totalMetersAg63 += m
      else if ((seg.dnMm ?? 0) <= 110) totalMetersAg110 += m
      else totalMetersOther += m
    }
    // ~1 PV per segment (simplification)
    pvCount++
  }

  const lines: BomLine[] = []
  if (totalMetersEsg200 > 0) {
    lines.push({ material: 'Tubo PVC Esgoto DN 200mm - NTS 048', un: 'm', qty: Math.ceil(totalMetersEsg200) })
    lines.push({ material: 'Anel de Borracha p/ Tubo PVC DN 200mm', un: 'pc', qty: Math.ceil(totalMetersEsg200 / 6) })
  }
  if (totalMetersEsg300 > 0) {
    lines.push({ material: 'Tubo PVC Esgoto DN 300mm - NTS 048', un: 'm', qty: Math.ceil(totalMetersEsg300) })
    lines.push({ material: 'Anel de Borracha p/ Tubo PVC DN 300mm', un: 'pc', qty: Math.ceil(totalMetersEsg300 / 6) })
  }
  if (totalMetersAg63 > 0) {
    lines.push({ material: 'Tubo PEAD PE 100 DN 63mm - NTS 194', un: 'm', qty: Math.ceil(totalMetersAg63) })
    lines.push({ material: 'Luva Eletrofusão PEAD DN 63mm', un: 'pc', qty: Math.ceil(totalMetersAg63 / 6) })
  }
  if (totalMetersAg110 > 0) {
    lines.push({ material: 'Tubo PEAD PE 100 DN 110mm - NTS 194', un: 'm', qty: Math.ceil(totalMetersAg110) })
    lines.push({ material: 'Luva Eletrofusão PEAD DN 110mm', un: 'pc', qty: Math.ceil(totalMetersAg110 / 6) })
  }

  const esgMeters = totalMetersEsg200 + totalMetersEsg300
  if (esgMeters > 0) {
    lines.push({ material: 'Poço de Visita (PV) D=1,20m', un: 'un', qty: pvCount })
    lines.push({ material: 'Tampão FoFo D=600mm T-300', un: 'pç', qty: pvCount })
    lines.push({ material: 'Escavação mecânica em vala', un: 'm³', qty: Math.ceil(esgMeters * 0.9) })
    lines.push({ material: 'Areia Lavada Média (Envoltória)', un: 'm³', qty: Math.ceil(esgMeters * 0.35) })
    lines.push({ material: 'Brita N° 1 ou 2 (Base/Reaterro)', un: 'm³', qty: Math.ceil(esgMeters * 0.25) })
    lines.push({ material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', qty: Math.ceil(esgMeters * 0.9) })
  }

  const agMeters = totalMetersAg63 + totalMetersAg110
  if (agMeters > 0) {
    lines.push({ material: 'Escavação mecânica em vala (Água)', un: 'm³', qty: Math.ceil(agMeters * 0.6) })
    lines.push({ material: 'Areia Lavada Média (Envoltória - Água)', un: 'm³', qty: Math.ceil(agMeters * 0.2) })
    lines.push({ material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', qty: Math.ceil(agMeters * 0.6) })
  }

  return lines
}

export function MateriaisPendentesPanel() {
  const { segments } = useMedicaoStore()
  const [expandedNucleo, setExpandedNucleo] = useState<string | null>(null)

  const pendentes = useMemo(() => segments.filter((s) => s.status === 'PENDENTE'), [segments])

  // Group by nucleo → rua
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, ConsolidatedSegment[]>>()
    for (const seg of pendentes) {
      if (!map.has(seg.nucleo)) map.set(seg.nucleo, new Map())
      const ruaMap = map.get(seg.nucleo)!
      if (!ruaMap.has(seg.rua)) ruaMap.set(seg.rua, [])
      ruaMap.get(seg.rua)!.push(seg)
    }
    return map
  }, [pendentes])

  if (segments.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-gray-500 text-sm p-6">Importe o consolidado primeiro.</div>
  }
  if (pendentes.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-emerald-400 text-sm p-6">Nenhum trecho pendente. Tudo executado!</div>
  }

  return (
    <div className="p-6 space-y-4 overflow-auto">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Materiais Pendentes por Nucleo</p>
        <span className="text-xs text-red-400 font-bold">{pendentes.length} trechos pendentes ({fmt(pendentes.reduce((s, seg) => s + seg.extM, 0) / 1000)} km)</span>
      </div>

      {[...grouped].map(([nucleo, ruaMap]) => {
        const allSegs = [...ruaMap.values()].flat()
        const totalM = allSegs.reduce((s, seg) => s + seg.extM, 0)
        const isExpanded = expandedNucleo === nucleo

        return (
          <div key={nucleo} className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedNucleo(isExpanded ? null : nucleo)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
            >
              <div>
                <span className="text-sm font-bold text-white">{nucleo}</span>
                <span className="ml-3 text-[10px] text-gray-500">{allSegs.length} trechos | {fmt(totalM)}m</span>
              </div>
              <span className="text-gray-500 text-xs">{isExpanded ? '▼' : '▶'}</span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {[...ruaMap].map(([rua, segs]) => {
                  const bom = calcBom(segs)
                  return (
                    <div key={rua} className="border-t border-[#1f2937] pt-3">
                      <p className="text-xs font-semibold text-cyan-400 mb-2">{rua} ({segs.length} trechos, {fmt(segs.reduce((s, seg) => s + seg.extM, 0))}m)</p>
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-gray-500 text-[9px] uppercase">
                            <th className="text-left pb-1">Material</th>
                            <th className="text-center pb-1 w-12">Un</th>
                            <th className="text-right pb-1 w-16">Qtd</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bom.map((line, i) => (
                            <tr key={i} className="border-t border-[#1f2937]/50">
                              <td className="py-1 text-gray-300">{line.material}</td>
                              <td className="py-1 text-center text-gray-500">{line.un}</td>
                              <td className="py-1 text-right text-white font-medium tabular-nums">{fmt(line.qty)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
