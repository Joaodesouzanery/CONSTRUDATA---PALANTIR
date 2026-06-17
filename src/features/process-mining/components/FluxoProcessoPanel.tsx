import { useMemo } from 'react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { buildEventLog } from '../utils/buildEventLog'

export function FluxoProcessoPanel() {
  const sites = useTorreStore((s) => s.sites) ?? []
  const events = useMemo(() => buildEventLog(), [])
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const cols = [
    { key: 'rdo', label: 'RDO' },
    { key: 'entrada_financeira', label: 'Medição' },
    { key: 'movimentacao_estoque', label: 'Suprimento' },
  ] as const

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#525252]">
            <th className="text-left py-3 px-4 text-[#a3a3a3] font-medium">Obra</th>
            {cols.map((c) => (
              <th key={c.key} className="text-center py-3 px-4 text-[#a3a3a3] font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sites.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-[#6b6b6b]">
                Nenhuma obra cadastrada
              </td>
            </tr>
          )}
          {sites.map((site) => {
            const siteEvents = events.filter(
              (e) => e.obraId === site.id && e.timestamp >= thirtyDaysAgo
            )
            return (
              <tr key={site.id} className="border-b border-[#2c2c2c] hover:bg-[#2c2c2c] transition-colors">
                <td className="py-3 px-4 text-[#f5f5f5] font-medium">{site.name}</td>
                {cols.map((col) => {
                  const count = siteEvents.filter((e) => e.tipo === col.key).length
                  return (
                    <td key={col.key} className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {count === 0 ? (
                          <span className="text-[#6b6b6b] text-xs">—</span>
                        ) : (
                          <>
                            {Array.from({ length: Math.min(count, 10) }).map((_, i) => (
                              <span
                                key={i}
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: col.key === 'rdo' ? '#f97316' : col.key === 'entrada_financeira' ? '#3b82f6' : '#22c55e' }}
                              />
                            ))}
                            {count > 10 && (
                              <span className="text-[#a3a3a3] text-xs">+{count - 10}</span>
                            )}
                          </>
                        )}
                      </div>
                      <div className="text-[#6b6b6b] text-xs mt-1">{count} eventos</div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="flex gap-4 mt-4 px-4">
        <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
          <span className="w-2 h-2 rounded-full bg-[#f97316] inline-block" /> RDO
        </div>
        <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
          <span className="w-2 h-2 rounded-full bg-[#3b82f6] inline-block" /> Medição
        </div>
        <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] inline-block" /> Suprimento
        </div>
      </div>
    </div>
  )
}
