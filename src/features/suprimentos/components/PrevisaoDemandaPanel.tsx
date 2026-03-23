import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { PODialog } from './PODialog'
import { useState } from 'react'
import type { DemandForecast } from '@/types'

const STATUS_CLS: Record<DemandForecast['status'], string> = {
  suggested: 'bg-[#2563eb]/20 text-[#93c5fd]',
  ordered:   'bg-[#16a34a]/20 text-[#4ade80]',
  dismissed: 'bg-[#3a3a3a] text-[#6b6b6b]',
}
const STATUS_LABELS: Record<DemandForecast['status'], string> = {
  suggested: 'Sugerida',
  ordered:   'Pedido Criado',
  dismissed: 'Descartada',
}

export function PrevisaoDemandaPanel() {
  const { forecasts, updateForecast } = useSuprimentosStore(
    useShallow((s) => ({ forecasts: s.forecasts, updateForecast: s.updateForecast }))
  )
  const [showNewPO, setShowNewPO] = useState(false)

  const suggested  = forecasts.filter((f) => f.status === 'suggested').length
  const totalValue = forecasts.filter((f) => f.status === 'suggested').reduce((acc, f) => acc + f.estimatedValue, 0)
  const nextCritical = forecasts
    .filter((f) => f.status === 'suggested')
    .sort((a, b) => a.suggestedOrderDate.localeCompare(b.suggestedOrderDate))[0]
  const daysToNext = nextCritical
    ? Math.ceil((new Date(nextCritical.suggestedOrderDate).getTime() - Date.now()) / 86_400_000)
    : null

  const kpis = [
    { label: 'Sugestões Pendentes',        value: String(suggested),                                           color: 'text-[#f97316]' },
    { label: 'Valor Total Previsto',        value: totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), color: 'text-[#f5f5f5]' },
    { label: 'Dias até Próxima Compra',    value: daysToNext !== null ? `${daysToNext}d` : '—',               color: daysToNext !== null && daysToNext <= 7 ? 'text-[#f87171]' : 'text-[#fbbf24]' },
  ]

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl p-4 flex flex-col gap-1">
            <p className="text-[#6b6b6b] text-xs">{label}</p>
            <p className={cn('text-xl font-bold tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#252525]">
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Semana</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Categoria</th>
              <th className="text-right text-[#6b6b6b] text-xs font-medium px-3 py-2 w-24">Qtd Estimada</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-10">Un</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Fase Relacionada</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-32">Data Pedido Sugerida</th>
              <th className="text-right text-[#6b6b6b] text-xs font-medium px-3 py-2 w-28">Valor Estimado</th>
              <th className="text-center text-[#6b6b6b] text-xs font-medium px-3 py-2 w-24">Status</th>
              <th className="text-center text-[#6b6b6b] text-xs font-medium px-3 py-2 w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((f) => {
              const daysLeft = Math.ceil(
                (new Date(f.suggestedOrderDate).getTime() - Date.now()) / 86_400_000
              )
              return (
                <tr key={f.id} className="border-t border-[#2a2a2a] hover:bg-[#252525]/50 transition-colors">
                  <td className="px-3 py-2.5 text-[#f5f5f5] text-xs">{f.weekLabel}</td>
                  <td className="px-3 py-2.5 text-[#f5f5f5] text-xs font-medium">{f.materialCategory}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#f5f5f5] text-xs">{f.estimatedQty.toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2.5 text-[#a3a3a3] text-xs">{f.unit}</td>
                  <td className="px-3 py-2.5 text-[#a3a3a3] text-xs">{f.relatedPhase}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[#f5f5f5] text-xs">{new Date(f.suggestedOrderDate).toLocaleDateString('pt-BR')}</span>
                      {f.status === 'suggested' && (
                        <span className={cn('text-[10px]', daysLeft <= 3 ? 'text-[#f87171]' : daysLeft <= 7 ? 'text-[#fbbf24]' : 'text-[#6b6b6b]')}>
                          {daysLeft > 0 ? `em ${daysLeft}d` : 'vencido'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#f5f5f5] text-xs">
                    {f.estimatedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_CLS[f.status])}>
                      {STATUS_LABELS[f.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {f.status === 'suggested' ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => { updateForecast(f.id, 'ordered'); setShowNewPO(true) }}
                          className="px-2 py-0.5 rounded bg-[#f97316]/20 hover:bg-[#f97316]/30 text-[#f97316] text-[10px] font-semibold transition-colors"
                        >
                          Criar OC
                        </button>
                        <button
                          onClick={() => updateForecast(f.id, 'dismissed')}
                          className="px-2 py-0.5 rounded bg-[#3a3a3a] hover:bg-[#444] text-[#6b6b6b] text-[10px] font-semibold transition-colors"
                        >
                          Descartar
                        </button>
                      </div>
                    ) : (
                      <span className="text-[#3a3a3a] text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showNewPO && <PODialog onClose={() => setShowNewPO(false)} />}
    </div>
  )
}
