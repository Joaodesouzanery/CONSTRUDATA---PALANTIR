/**
 * BomPendentePanel — Bill of Materials derived from pending segments in Medição.
 * Shows aggregated material needs, compares with stock, and allows generating requisitions.
 */
import { useMemo } from 'react'
import { useMedicaoStore } from '@/store/medicaoStore'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { AlertTriangle, CheckCircle2, Package } from 'lucide-react'
import type { ConsolidatedSegment } from '@/types'

function fmt(n: number) { return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }

interface BomLine {
  material: string
  un: string
  qty: number
  category: string
}

function calcGlobalBom(segs: ConsolidatedSegment[]): BomLine[] {
  let esg200 = 0, esg300 = 0, ag63 = 0, ag110 = 0
  let pvCount = 0, esgTotal = 0, agTotal = 0

  for (const seg of segs) {
    const m = seg.extM || 0
    if (seg.tipo === 'ESGOTO') {
      esgTotal += m
      if ((seg.dnMm ?? 0) <= 200) esg200 += m
      else esg300 += m
      pvCount++
    } else {
      agTotal += m
      if ((seg.dnMm ?? 0) <= 63) ag63 += m
      else ag110 += m
    }
  }

  const lines: BomLine[] = []

  // Esgoto materials
  if (esg200 > 0) {
    lines.push({ material: 'Tubo PVC Esgoto JEI DN 200mm - NTS 048', un: 'm', qty: Math.ceil(esg200), category: 'Tubulação' })
    lines.push({ material: 'Anel de Borracha p/ Tubo PVC DN 200mm', un: 'pc', qty: Math.ceil(esg200 / 6), category: 'Conexões' })
    lines.push({ material: 'Pasta Lubrificante p/ Junta Elástica (1kg)', un: 'un', qty: Math.ceil(esg200 / 600), category: 'Conexões' })
    lines.push({ material: 'Luva de Correr PVC Esgoto DN 200mm', un: 'pc', qty: Math.ceil(esg200 / 600), category: 'Conexões' })
  }
  if (esg300 > 0) {
    lines.push({ material: 'Tubo PVC Esgoto JEI DN 300mm - NTS 048', un: 'm', qty: Math.ceil(esg300), category: 'Tubulação' })
    lines.push({ material: 'Anel de Borracha p/ Tubo PVC DN 300mm', un: 'pc', qty: Math.ceil(esg300 / 6), category: 'Conexões' })
  }
  if (esgTotal > 0) {
    lines.push({ material: 'Poço de Visita (PV) Pré-Moldado D=1,20m', un: 'un', qty: pvCount, category: 'Estruturas' })
    lines.push({ material: 'Tampão FoFo Articulado D=600mm T-300', un: 'pç', qty: pvCount, category: 'Estruturas' })
    lines.push({ material: 'Laje de Redução Excêntrica Concreto', un: 'pç', qty: pvCount, category: 'Estruturas' })
    lines.push({ material: 'Degrau de FoFo para PV', un: 'pç', qty: pvCount * 5, category: 'Estruturas' })
    lines.push({ material: 'Anel de Ajuste Concreto', un: 'pç', qty: pvCount * 2, category: 'Estruturas' })
    lines.push({ material: 'Argamassa de Assentamento Traço 1:3', un: 'sc', qty: Math.ceil(pvCount * 1.5), category: 'Insumos' })
    lines.push({ material: 'Escavação mecânica / manual em vala (ESG)', un: 'm³', qty: Math.ceil(esgTotal * 0.9), category: 'Serviços' })
    lines.push({ material: 'Areia Lavada Média (Envoltória)', un: 'm³', qty: Math.ceil(esgTotal * 0.35), category: 'Insumos' })
    lines.push({ material: 'Brita N° 1 ou 2 (Base/Reaterro)', un: 'm³', qty: Math.ceil(esgTotal * 0.25), category: 'Insumos' })
    lines.push({ material: 'Reposição Pavimento Asfáltico (CBUQ)', un: 'm²', qty: Math.ceil(esgTotal * 0.9), category: 'Serviços' })
  }

  // Água materials
  if (ag63 > 0) {
    lines.push({ material: 'Tubo PEAD PE 100 SDR 17 DN 63mm - NTS 194', un: 'm', qty: Math.ceil(ag63), category: 'Tubulação' })
    lines.push({ material: 'Luva Eletrofusão PEAD DN 63mm', un: 'pc', qty: Math.ceil(ag63 / 5.5), category: 'Conexões' })
    lines.push({ material: 'Tê Eletrofusão PEAD DN 63mm', un: 'pc', qty: Math.ceil(ag63 / 200), category: 'Conexões' })
  }
  if (ag110 > 0) {
    lines.push({ material: 'Tubo PEAD PE 100 SDR 17 DN 110mm - NTS 194', un: 'm', qty: Math.ceil(ag110), category: 'Tubulação' })
    lines.push({ material: 'Luva Eletrofusão PEAD DN 110mm', un: 'pc', qty: Math.ceil(ag110 / 5.5), category: 'Conexões' })
    lines.push({ material: 'Tê Eletrofusão PEAD DN 110mm', un: 'pc', qty: Math.ceil(ag110 / 300), category: 'Conexões' })
  }
  if (agTotal > 0) {
    lines.push({ material: 'Escavação mecânica / manual em vala (AG)', un: 'm³', qty: Math.ceil(agTotal * 0.6), category: 'Serviços' })
    lines.push({ material: 'Areia Lavada Média (Envoltória - Água)', un: 'm³', qty: Math.ceil(agTotal * 0.2), category: 'Insumos' })
    lines.push({ material: 'Reposição Pavimento Asfáltico (CBUQ - AG)', un: 'm²', qty: Math.ceil(agTotal * 0.6), category: 'Serviços' })
  }

  return lines.filter((l) => l.qty > 0)
}

export function BomPendentePanel() {
  const segments = useMedicaoStore((s) => s.segments)
  const estoqueItens = useSuprimentosStore((s) => s.estoqueItens)

  const pendentes = useMemo(() => segments.filter((s) => s.status === 'PENDENTE'), [segments])
  const bom = useMemo(() => calcGlobalBom(pendentes), [pendentes])

  const totalMeters = pendentes.reduce((s, seg) => s + seg.extM, 0)

  // Group BOM by category
  const categories = useMemo(() => {
    const map = new Map<string, BomLine[]>()
    for (const line of bom) {
      if (!map.has(line.category)) map.set(line.category, [])
      map.get(line.category)!.push(line)
    }
    return map
  }, [bom])

  // Simple stock comparison (match by substring in description)
  function getStockQty(materialName: string): number {
    const q = materialName.toLowerCase()
    const match = estoqueItens.find((item) => q.includes(item.descricao.toLowerCase()) || item.descricao.toLowerCase().includes(q.slice(0, 20)))
    return match ? match.qtdDisponivel : 0
  }

  if (segments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm p-8 gap-3">
        <Package size={40} className="text-gray-600" />
        <p>Nenhum dado de medição encontrado.</p>
        <p className="text-[11px]">Importe o consolidado no módulo <strong>Medição</strong> primeiro — a lista de compras será gerada automaticamente a partir dos trechos pendentes.</p>
      </div>
    )
  }

  if (pendentes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-emerald-400 text-sm p-6">
        <CheckCircle2 size={18} className="mr-2" /> Todos os trechos estão executados. Nenhuma compra pendente.
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-3">
          <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b] mb-1">Trechos Pendentes</p>
          <p className="text-xl font-bold text-[#f97316]">{pendentes.length}</p>
        </div>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-3">
          <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b] mb-1">Metragem Total</p>
          <p className="text-xl font-bold text-white">{fmt(totalMeters)}m</p>
          <p className="text-[10px] text-[#6b6b6b]">{(totalMeters / 1000).toFixed(1)} km</p>
        </div>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-3">
          <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b] mb-1">Itens de Material</p>
          <p className="text-xl font-bold text-white">{bom.length}</p>
        </div>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-3">
          <p className="text-[9px] uppercase tracking-widest text-[#6b6b6b] mb-1">Categorias</p>
          <p className="text-xl font-bold text-white">{categories.size}</p>
        </div>
      </div>

      {/* BOM Table by category */}
      {[...categories].map(([category, lines]) => (
        <div key={category} className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#525252] bg-[#333]">
            <span className="text-xs font-bold text-[#f5f5f5] uppercase tracking-wider">{category}</span>
            <span className="ml-2 text-[10px] text-[#6b6b6b]">{lines.length} itens</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6b6b6b] text-[10px] uppercase border-b border-[#525252]">
                <th className="px-4 py-2 text-left">Material</th>
                <th className="px-3 py-2 text-center w-14">Un</th>
                <th className="px-3 py-2 text-right w-20">Necessário</th>
                <th className="px-3 py-2 text-right w-20">Em Estoque</th>
                <th className="px-3 py-2 text-right w-20">Comprar</th>
                <th className="px-3 py-2 text-center w-16">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/50">
              {lines.map((line, i) => {
                const stock = getStockQty(line.material)
                const deficit = Math.max(0, line.qty - stock)
                const ok = deficit === 0
                return (
                  <tr key={i} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-[#e5e5e5]">{line.material}</td>
                    <td className="px-3 py-2 text-center text-[#6b6b6b]">{line.un}</td>
                    <td className="px-3 py-2 text-right text-white font-medium tabular-nums">{fmt(line.qty)}</td>
                    <td className="px-3 py-2 text-right text-[#6b6b6b] tabular-nums">{stock > 0 ? fmt(stock) : '—'}</td>
                    <td className={`px-3 py-2 text-right font-bold tabular-nums ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {ok ? '0' : fmt(deficit)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {ok ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400">OK</span>
                      ) : (
                        <span className="flex items-center justify-center gap-0.5 text-amber-400">
                          <AlertTriangle size={11} />
                          <span className="text-[9px] font-semibold">COMPRAR</span>
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      <p className="text-[10px] text-[#6b6b6b] text-right">
        BOM estimado a partir de {pendentes.length} trechos pendentes ({(totalMeters/1000).toFixed(1)} km). Quantidades são estimativas baseadas em regras padrão SABESP.
      </p>
    </div>
  )
}
