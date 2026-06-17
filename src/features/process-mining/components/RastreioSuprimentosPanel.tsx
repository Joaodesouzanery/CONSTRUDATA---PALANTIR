import { useMemo } from 'react'
import { useSuprimentosStore } from '@/store/suprimentosStore'

export function RastreioSuprimentosPanel() {
  const movimentacoes = useSuprimentosStore((s) => s.movimentacoes) ?? []
  const estoqueItens = useSuprimentosStore((s) => s.estoqueItens) ?? []

  const summary = useMemo(() => {
    const itemMap = new Map(estoqueItens.map((i) => [i.id, i.descricao]))

    const map = new Map<string, { itemId: string; entradas: number; saidas: number }>()
    for (const mov of movimentacoes) {
      const { itemId, tipo, quantidade } = mov
      const qty = quantidade ?? 0
      if (!map.has(itemId)) map.set(itemId, { itemId, entradas: 0, saidas: 0 })
      const entry = map.get(itemId)!
      if (tipo === 'entrada') entry.entradas += qty
      else if (tipo === 'saida') entry.saidas += qty
    }
    return Array.from(map.entries())
      .map(([itemId, { entradas, saidas }]) => ({
        itemId,
        item: itemMap.get(itemId) ?? itemId,
        entradas,
        saidas,
        saldo: entradas - saidas,
      }))
      .sort((a, b) => b.entradas - a.entradas)
  }, [movimentacoes, estoqueItens])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#525252]">
            <th className="text-left py-3 px-4 text-[#a3a3a3] font-medium">Item</th>
            <th className="text-center py-3 px-4 text-[#a3a3a3] font-medium">Entradas (qtd)</th>
            <th className="text-center py-3 px-4 text-[#a3a3a3] font-medium">Saídas (qtd)</th>
            <th className="text-center py-3 px-4 text-[#a3a3a3] font-medium">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {summary.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-[#6b6b6b]">
                Nenhuma movimentação registrada
              </td>
            </tr>
          )}
          {summary.map((row) => (
            <tr key={row.itemId} className="border-b border-[#2c2c2c] hover:bg-[#2c2c2c] transition-colors">
              <td className="py-3 px-4 text-[#f5f5f5] font-medium">{row.item}</td>
              <td className="py-3 px-4 text-center text-[#22c55e]">{row.entradas}</td>
              <td className="py-3 px-4 text-center text-[#ef4444]">{row.saidas}</td>
              <td className="py-3 px-4 text-center">
                <span
                  className="font-medium"
                  style={{ color: row.saldo >= 0 ? '#22c55e' : '#ef4444' }}
                >
                  {row.saldo >= 0 ? '+' : ''}{row.saldo}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
