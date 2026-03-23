import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { usePreConstrucaoStore } from '@/store/preConstrucaoStore'
import type { ClauseSeverity } from '@/types'

function ConfidenceBadge({ value }: { value: number }) {
  const color =
    value >= 80 ? 'bg-[#16a34a]/20 text-[#4ade80]' :
    value >= 60 ? 'bg-[#ca8a04]/20 text-[#fbbf24]' :
                  'bg-[#dc2626]/20 text-[#f87171]'
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-semibold', color)}>
      {value}%
    </span>
  )
}

function SeverityBadge({ severity }: { severity: ClauseSeverity }) {
  if (severity === 'critical') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#dc2626]/20 text-[#f87171]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] inline-block" />
        Crítico
      </span>
    )
  }
  if (severity === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#ca8a04]/20 text-[#fbbf24]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] inline-block" />
        Atenção
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#2563eb]/20 text-[#93c5fd]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] inline-block" />
      Info
    </span>
  )
}

export function ExtractionView() {
  const [clausesOpen, setClausesOpen] = useState(true)

  const { takeoffItems, clauses, setStep } = usePreConstrucaoStore(useShallow((s) => ({
    takeoffItems: s.takeoffItems,
    clauses:      s.clauses,
    setStep:      s.setStep,
  })))

  return (
    <div className="flex gap-4 h-full">
      {/* LEFT — Takeoff items table */}
      <div className="flex flex-col flex-1 min-w-0 bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
          <h2 className="text-[#f5f5f5] font-semibold text-sm">Itens Extraídos</h2>
          {takeoffItems.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#f97316]/20 text-[#f97316] text-xs font-semibold">
              {takeoffItems.length} itens
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {takeoffItems.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[#6b6b6b] text-sm">
              Nenhum item extraído ainda
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#252525]">
                  <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-10">#</th>
                  <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Descrição</th>
                  <th className="text-right text-[#6b6b6b] text-xs font-medium px-3 py-2">Quantidade</th>
                  <th className="text-left  text-[#6b6b6b] text-xs font-medium px-3 py-2">Unidade</th>
                  <th className="text-center text-[#6b6b6b] text-xs font-medium px-3 py-2">Confiança</th>
                  <th className="text-left  text-[#6b6b6b] text-xs font-medium px-3 py-2">Arquivo</th>
                </tr>
              </thead>
              <tbody>
                {takeoffItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="border-t border-[#2a2a2a] hover:bg-[#252525] transition-colors"
                  >
                    <td className="px-3 py-2 text-[#6b6b6b] text-xs">{idx + 1}</td>
                    <td className="px-3 py-2 text-[#f5f5f5]">{item.description}</td>
                    <td className="px-3 py-2 text-[#f5f5f5] text-right tabular-nums">
                      {item.quantity.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-[#a3a3a3]">{item.unit}</td>
                    <td className="px-3 py-2 text-center">
                      <ConfidenceBadge value={item.confidence} />
                    </td>
                    <td className="px-3 py-2 text-[#6b6b6b] text-xs truncate max-w-[120px]">
                      {item.source}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[#2a2a2a]">
          <button
            onClick={() => setStep('normalization')}
            disabled={takeoffItems.length === 0}
            className={cn(
              'w-full py-2 rounded-lg text-sm font-semibold transition-colors',
              takeoffItems.length > 0
                ? 'bg-[#f97316] hover:bg-[#ea6c0a] text-white'
                : 'bg-[#2a2a2a] text-[#6b6b6b] cursor-not-allowed',
            )}
          >
            Avançar → Normalização
          </button>
        </div>
      </div>

      {/* RIGHT — Contract clauses */}
      <div className="w-80 shrink-0 flex flex-col bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl overflow-hidden">
        <button
          onClick={() => setClausesOpen((v) => !v)}
          className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] hover:bg-[#252525] transition-colors"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-[#f5f5f5] font-semibold text-sm">Cláusulas de Risco</h2>
            {clauses.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#dc2626]/20 text-[#f87171] text-xs font-semibold">
                {clauses.length}
              </span>
            )}
          </div>
          {clausesOpen ? (
            <ChevronUp size={14} className="text-[#6b6b6b]" />
          ) : (
            <ChevronDown size={14} className="text-[#6b6b6b]" />
          )}
        </button>

        {clausesOpen && (
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {clauses.length === 0 ? (
              <p className="text-[#6b6b6b] text-sm text-center py-6">
                Nenhuma cláusula de risco identificada
              </p>
            ) : (
              clauses.map((clause) => (
                <div
                  key={clause.id}
                  className="bg-[#252525] border border-[#2a2a2a] rounded-lg p-3 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <SeverityBadge severity={clause.severity} />
                  </div>
                  <p className="text-[#f5f5f5] text-xs font-bold">{clause.type}</p>
                  {clause.excerpt && (
                    <p className="text-[#a3a3a3] text-[10px] font-mono bg-[#1a1a1a] rounded px-2 py-1 break-words">
                      "{clause.excerpt}"
                    </p>
                  )}
                  <p className="text-[#a3a3a3] text-xs leading-relaxed">{clause.explanation}</p>
                  <p className="text-[#f97316] text-xs italic leading-relaxed">
                    {clause.recommendation}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
