import { useMemo } from 'react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { buildEventLog } from '../utils/buildEventLog'

export function PlaneadoXExecutadoPanel() {
  const sites = useTorreStore((s) => s.sites) ?? []
  const events = useMemo(() => buildEventLog(), [])

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const data = useMemo(() =>
    sites.map((site) => {
      const siteEvents = events.filter((e) => e.obraId === site.id && e.timestamp >= thirtyDaysAgo)
      const rdoCount = siteEvents.filter((e) => e.tipo === 'rdo').length
      const finCount = siteEvents.filter((e) => e.tipo === 'entrada_financeira' || e.tipo === 'saida_financeira').length

      let status: 'ativo' | 'sem_medicao' | 'parado'
      if (rdoCount > 0 && finCount > 0) status = 'ativo'
      else if (rdoCount > 0) status = 'sem_medicao'
      else status = 'parado'

      return { ...site, rdoCount, finCount, status }
    }),
  [sites, events, thirtyDaysAgo])

  const statusConfig = {
    ativo: { label: 'Ativo', color: '#22c55e', bg: '#22c55e22' },
    sem_medicao: { label: 'Sem medição', color: '#eab308', bg: '#eab30822' },
    parado: { label: 'Parado', color: '#ef4444', bg: '#ef444422' },
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#525252]">
            <th className="text-left py-3 px-4 text-[#a3a3a3] font-medium">Obra</th>
            <th className="text-center py-3 px-4 text-[#a3a3a3] font-medium">RDOs (30d)</th>
            <th className="text-center py-3 px-4 text-[#a3a3a3] font-medium">Lançamentos Fin. (30d)</th>
            <th className="text-center py-3 px-4 text-[#a3a3a3] font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-[#6b6b6b]">
                Nenhuma obra cadastrada
              </td>
            </tr>
          )}
          {data.map((row) => {
            const cfg = statusConfig[row.status]
            return (
              <tr key={row.id} className="border-b border-[#2c2c2c] hover:bg-[#2c2c2c] transition-colors">
                <td className="py-3 px-4 text-[#f5f5f5] font-medium">{row.name}</td>
                <td className="py-3 px-4 text-center text-[#a3a3a3]">{row.rdoCount}</td>
                <td className="py-3 px-4 text-center text-[#a3a3a3]">{row.finCount}</td>
                <td className="py-3 px-4 text-center">
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ color: cfg.color, backgroundColor: cfg.bg }}
                  >
                    {cfg.label}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
