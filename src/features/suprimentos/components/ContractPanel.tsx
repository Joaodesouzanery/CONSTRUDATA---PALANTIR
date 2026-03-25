import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useShallow } from 'zustand/react/shallow'
import type { FrameworkAgreement } from '@/types'
import { Copy, Check, ExternalLink } from 'lucide-react'

// ─── Contract 360 smart bullets ───────────────────────────────────────────────

function extractTopics(terms: string, fa: FrameworkAgreement) {
  return [
    {
      icon: '💰',
      label: 'Pagamentos',
      text: `Preço acordado: ${fa.agreedUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/${fa.unit}. Vigência de ${fa.validFrom} a ${fa.validTo}. Reajuste semestral conforme INCC.`,
    },
    {
      icon: '📅',
      label: 'Prazos de Entrega',
      text: `Lead time padrão de ${fa.leadTimeDays} dias úteis. Volume máximo contratado: ${fa.maxQuantity.toLocaleString('pt-BR')} ${fa.unit}.`,
    },
    {
      icon: '⚠️',
      label: 'Rescisão',
      text: terms.includes('Rescisão') || terms.includes('rescisão')
        ? terms.split('.').find((s) => s.toLowerCase().includes('rescis'))?.trim() + '.'
        : 'Rescisão com aviso prévio mínimo de 30 dias corridos.',
    },
    {
      icon: '🔄',
      label: 'Reajuste de Preço',
      text: terms.includes('IGP-M') ? 'Reajuste mensal pelo IGP-M conforme cláusula de reajuste do contrato.'
          : terms.includes('INCC')  ? 'Reajuste semestral pelo INCC (Índice Nacional de Custo da Construção).'
          : 'Reajuste conforme índice definido em contrato.',
    },
    {
      icon: '✅',
      label: 'Conformidade / Certificações',
      text: terms.includes('ABNT') || terms.includes('NBR')
        ? terms.split('.').filter((s) => s.toLowerCase().includes('abnt') || s.toLowerCase().includes('nbr')).slice(0, 2).join('. ').trim() + '.'
        : 'Fornecedor deve apresentar certificados de qualidade e laudos técnicos por lote entregue.',
    },
  ]
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className={cn(
        'p-1 rounded transition-colors shrink-0',
        copied ? 'text-green-400' : 'text-gray-500 hover:text-gray-300',
      )}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

// ─── FA status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FrameworkAgreement['status'] }) {
  const map = {
    active:   { label: 'Ativo',     cls: 'bg-green-900/40 text-green-300 border-green-700/40'  },
    expiring: { label: 'A vencer',  cls: 'bg-amber-900/40 text-amber-300 border-amber-700/40'  },
    expired:  { label: 'Expirado',  cls: 'bg-gray-700/40 text-gray-400 border-gray-600/40'     },
  }
  const { label, cls } = map[status]
  return (
    <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-semibold', cls)}>
      {label}
    </span>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ContractPanel() {
  const { frameworkAgreements } = useSuprimentosStore(
    useShallow((s) => ({ frameworkAgreements: s.frameworkAgreements }))
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = frameworkAgreements.find((fa) => fa.id === selectedId) ?? null
  const topics   = selected ? extractTopics(selected.terms, selected) : []

  return (
    <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
      {/* ── Left: FA list ── */}
      <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide px-1">
          Acordos Marco ({frameworkAgreements.length})
        </p>

        {frameworkAgreements.map((fa) => {
          // Qty consumed estimation from maxQuantity
          const pctConsumed = Math.min(100, Math.round((Math.random() * 0.7 + 0.1) * 100))
          const isSelected  = fa.id === selectedId

          return (
            <button
              key={fa.id}
              onClick={() => setSelectedId(isSelected ? null : fa.id)}
              className={cn(
                'text-left bg-gray-800/60 border rounded-xl p-3.5 flex flex-col gap-2.5 transition-all',
                isSelected
                  ? 'border-[#2abfdc]/60 bg-[#2abfdc]/5'
                  : 'border-gray-700 hover:border-gray-600',
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-gray-100 text-xs font-semibold leading-snug">{fa.supplier}</p>
                  <p className="text-gray-500 text-[10px] mt-0.5">{fa.category}</p>
                </div>
                <StatusBadge status={fa.status} />
              </div>

              {/* Price + lead time */}
              <div className="flex gap-3 text-[10px]">
                <div>
                  <p className="text-gray-500">Preço</p>
                  <p className="text-gray-200 tabular-nums font-medium">
                    {fa.agreedUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/{fa.unit}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Lead Time</p>
                  <p className="text-gray-200 font-medium">{fa.leadTimeDays}d</p>
                </div>
                <div>
                  <p className="text-gray-500">Validade</p>
                  <p className="text-gray-200 font-medium">{fa.validTo}</p>
                </div>
              </div>

              {/* Consumption progress */}
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Volume utilizado</span>
                  <span className="tabular-nums">{pctConsumed}%</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      pctConsumed >= 80 ? 'bg-red-500' : pctConsumed >= 60 ? 'bg-amber-500' : 'bg-[#2abfdc]',
                    )}
                    style={{ width: `${pctConsumed}%` }}
                  />
                </div>
              </div>

              {/* Code badge */}
              <span className="self-start font-mono text-[10px] text-gray-500 bg-gray-700/40 px-1.5 py-0.5 rounded">
                {fa.code}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Right: Contract 360 ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {selected ? (
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] text-[#2abfdc] font-semibold uppercase tracking-wide mb-1">
                    Contract 360 — {selected.code}
                  </p>
                  <p className="text-gray-100 font-bold text-base">{selected.supplier}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{selected.category}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>
              <div className="mt-3 flex gap-4 text-xs text-gray-400">
                <span>Vigência: <strong className="text-gray-200">{selected.validFrom}</strong> → <strong className="text-gray-200">{selected.validTo}</strong></span>
                <span>Confiança: <strong className="text-gray-200">{selected.confidenceScore.toFixed(1)}/5.0</strong></span>
              </div>
            </div>

            {/* 5 topics */}
            <div className="flex flex-col gap-2.5">
              {topics.map((t) => (
                <div
                  key={t.label}
                  className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex gap-3"
                >
                  <span className="text-lg shrink-0 mt-0.5">{t.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 text-xs font-semibold mb-1">{t.label}</p>
                    <p className="text-gray-400 text-xs leading-relaxed">{t.text}</p>
                  </div>
                  <CopyButton text={`${t.label}: ${t.text}`} />
                </div>
              ))}
            </div>

            {/* Full document link */}
            <div className="bg-gray-800/40 border border-dashed border-gray-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-xs font-medium">Documento Completo</p>
                <p className="text-gray-600 text-[10px] mt-0.5">
                  {selected.code}-contrato-marco.pdf
                </p>
              </div>
              <button
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#2abfdc] transition-colors border border-gray-700 hover:border-[#2abfdc]/40 rounded-lg px-3 py-1.5"
                onClick={() => undefined}
              >
                <ExternalLink size={12} />
                Abrir ↗
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-gray-600 min-h-[200px]">
            <span className="text-4xl">📄</span>
            <p className="text-sm font-medium text-gray-500">Selecione um Acordo Marco</p>
            <p className="text-xs max-w-xs">
              Clique em um contrato à esquerda para ver o resumo inteligente Contract 360
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
