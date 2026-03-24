import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { ExcecaoRoutingDialog } from './ExcecaoRoutingDialog'
import type { MatchException, ExceptionStatus, ExceptionType } from '@/types'

const TYPE_LABELS: Record<ExceptionType, string> = {
  price_diff:    'Divergência de Preço',
  quantity_diff: 'Entrega Parcial',
  item_missing:  'Item Não Entregue',
  duplicate:     'Possível Duplicata',
}

const STATUS_LABELS: Record<ExceptionStatus, string> = {
  open:       'Aberta',
  in_review:  'Em Análise',
  resolved:   'Resolvida',
  escalated:  'Escalada',
}

const STATUS_CLS: Record<ExceptionStatus, string> = {
  open:       'bg-[#dc2626]/20 text-[#f87171]',
  in_review:  'bg-[#ca8a04]/20 text-[#fbbf24]',
  resolved:   'bg-[#16a34a]/20 text-[#4ade80]',
  escalated:  'bg-[#7c3aed]/20 text-[#c4b5fd]',
}

const TYPE_CLS: Record<ExceptionType, string> = {
  price_diff:    'bg-[#ca8a04]/20 text-[#fbbf24]',
  quantity_diff: 'bg-[#2563eb]/20 text-[#93c5fd]',
  item_missing:  'bg-[#dc2626]/20 text-[#f87171]',
  duplicate:     'bg-[#7c3aed]/20 text-[#c4b5fd]',
}

const ALL_STATUSES: (ExceptionStatus | 'all')[] = ['all', 'open', 'in_review', 'escalated', 'resolved']
const ALL_TYPES: (ExceptionType | 'all')[] = ['all', 'price_diff', 'quantity_diff', 'item_missing', 'duplicate']

export function ExcecoesPanel() {
  const { exceptions, purchaseOrders, updateException } = useSuprimentosStore(
    useShallow((s) => ({
      exceptions:      s.exceptions,
      purchaseOrders:  s.purchaseOrders,
      updateException: s.updateException,
    }))
  )

  const [filterStatus, setFilterStatus] = useState<ExceptionStatus | 'all'>('all')
  const [filterType,   setFilterType]   = useState<ExceptionType | 'all'>('all')
  const [routing, setRouting] = useState<MatchException | undefined>()

  const filtered = exceptions.filter((e) => {
    if (filterStatus !== 'all' && e.status !== filterStatus) return false
    if (filterType   !== 'all' && e.type   !== filterType)   return false
    return true
  })

  const filterBtnCls = (active: boolean) =>
    cn(
      'px-2.5 py-1 rounded text-xs font-medium transition-colors',
      active ? 'bg-[#2abfdc] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]'
    )

  return (
    <div className="flex flex-col gap-4 flex-1 overflow-hidden">
      {/* Filters */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="flex gap-1 flex-wrap">
          <span className="text-[#6b6b6b] text-xs self-center mr-1">Status:</span>
          {ALL_STATUSES.map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)} className={filterBtnCls(filterStatus === s)}>
              {s === 'all' ? 'Todos' : STATUS_LABELS[s as ExceptionStatus]}
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          <span className="text-[#6b6b6b] text-xs self-center mr-1">Tipo:</span>
          {ALL_TYPES.map((t) => (
            <button key={t} onClick={() => setFilterType(t)} className={filterBtnCls(filterType === t)}>
              {t === 'all' ? 'Todos' : TYPE_LABELS[t as ExceptionType]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-[#1e1e1e] border border-[#1c3658] rounded-xl">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#162e50]">
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">OC</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Fornecedor</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-36">Tipo</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Descrição</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-28">Responsáveis</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-24">Status</th>
              <th className="text-center text-[#6b6b6b] text-xs font-medium px-3 py-2 w-28">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-[#6b6b6b] text-sm py-10">
                  Nenhuma exceção encontrada
                </td>
              </tr>
            ) : (
              filtered.map((ex) => {
                const po = purchaseOrders.find((p) => p.id === ex.poId)
                return (
                  <tr key={ex.id} className="border-t border-[#1c3658] hover:bg-[#162e50]/50 transition-colors">
                    <td className="px-3 py-3">
                      <span className="font-mono text-[#a3a3a3] text-xs">{po?.code ?? ex.poId}</span>
                    </td>
                    <td className="px-3 py-3 text-[#f5f5f5] text-xs">{po?.supplier ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', TYPE_CLS[ex.type])}>
                        {TYPE_LABELS[ex.type]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[#a3a3a3] text-xs leading-relaxed max-w-xs">
                      <p className="line-clamp-2">{ex.description}</p>
                      <p className="text-[#2abfdc] text-[10px] italic mt-0.5 line-clamp-1">{ex.suggestedAction}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        {ex.assignedTo.map((name) => (
                          <span key={name} className="text-[#f5f5f5] text-[10px]">{name}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', STATUS_CLS[ex.status])}>
                        {STATUS_LABELS[ex.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {ex.status !== 'resolved' && (
                          <>
                            <button
                              onClick={() => setRouting(ex)}
                              className="px-2 py-1 rounded bg-[#2abfdc]/20 hover:bg-[#2abfdc]/30 text-[#2abfdc] text-[10px] font-semibold transition-colors"
                            >
                              Rotear
                            </button>
                            <button
                              onClick={() => updateException(ex.id, { status: 'resolved', resolvedAt: new Date().toISOString() })}
                              className="px-2 py-1 rounded bg-[#16a34a]/20 hover:bg-[#16a34a]/30 text-[#4ade80] text-[10px] font-semibold transition-colors"
                            >
                              Resolver
                            </button>
                          </>
                        )}
                        {ex.status === 'resolved' && (
                          <span className="text-[#1f3c5e] text-xs">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {routing && (
        <ExcecaoRoutingDialog exception={routing} onClose={() => setRouting(undefined)} />
      )}
    </div>
  )
}
