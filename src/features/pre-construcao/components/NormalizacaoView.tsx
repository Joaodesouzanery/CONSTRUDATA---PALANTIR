import { useMemo, useState } from 'react'
import { Check, X, CheckCheck, XCircle, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { usePreConstrucaoStore } from '@/store/preConstrucaoStore'
import type { TakeoffItem } from '@/types'

interface Suggestion {
  item:                TakeoffItem
  hasSuggestion:       boolean
  suggestedDesc:       string
  suggestedQty:        number
  suggestedUnit:       string
  reason:              string
  acceptedOrRejected:  boolean // normalized=false means already processed
}

function buildSuggestions(items: TakeoffItem[]): Suggestion[] {
  // Find duplicates by first 3 words
  const wordKey = (desc: string) =>
    desc.toLowerCase().trim().split(/\s+/).slice(0, 3).join(' ')

  const groups = new Map<string, TakeoffItem[]>()
  for (const item of items) {
    const k = wordKey(item.description)
    const g = groups.get(k) ?? []
    g.push(item)
    groups.set(k, g)
  }

  return items.map((item): Suggestion => {
    // If item already processed (normalized=false after action), show as done
    if (item.normalized === false && !item.normalizedDescription) {
      return {
        item,
        hasSuggestion:      false,
        suggestedDesc:      item.description,
        suggestedQty:       item.quantity,
        suggestedUnit:      item.unit,
        reason:             '',
        acceptedOrRejected: true,
      }
    }

    // If normalization already applied (normalizedDescription present but normalized=false)
    if (item.normalized === false && item.normalizedDescription) {
      return {
        item,
        hasSuggestion:      false,
        suggestedDesc:      item.description,
        suggestedQty:       item.quantity,
        suggestedUnit:      item.unit,
        reason:             '',
        acceptedOrRejected: true,
      }
    }

    // Unit conversion: cm → m
    if (item.unit.toLowerCase() === 'cm') {
      return {
        item,
        hasSuggestion:  true,
        suggestedDesc:  item.normalizedDescription ?? item.description.replace(/\s+/g, ' ').trim(),
        suggestedQty:   item.normalizedQuantity ?? parseFloat((item.quantity / 100).toFixed(4)),
        suggestedUnit:  item.normalizedUnit ?? 'm',
        reason:         'Conversão de unidade: cm → m',
        acceptedOrRejected: item.normalized === false,
      }
    }

    // Duplicate description merge: if this is NOT the first in its group
    const k = wordKey(item.description)
    const group = groups.get(k) ?? []
    if (group.length >= 2) {
      const isFirst = group[0].id === item.id
      if (!isFirst) {
        const totalQty = group.reduce((acc, i) => acc + i.quantity, 0)
        return {
          item,
          hasSuggestion:  true,
          suggestedDesc:  item.normalizedDescription ?? item.description.replace(/\s+/g, ' ').trim(),
          suggestedQty:   item.normalizedQuantity ?? totalQty,
          suggestedUnit:  item.normalizedUnit ?? item.unit,
          reason:         `Unificação de ${group.length} itens similares (soma das quantidades)`,
          acceptedOrRejected: item.normalized === false,
        }
      }
    }

    // Description cleanup only (extra spaces, case)
    const cleaned = item.description.replace(/\s+/g, ' ').trim()
    const needsCleanup = cleaned !== item.description

    if (needsCleanup) {
      return {
        item,
        hasSuggestion:  true,
        suggestedDesc:  item.normalizedDescription ?? cleaned,
        suggestedQty:   item.normalizedQuantity ?? item.quantity,
        suggestedUnit:  item.normalizedUnit ?? item.unit,
        reason:         'Limpeza de descrição',
        acceptedOrRejected: item.normalized === false,
      }
    }

    return {
      item,
      hasSuggestion:      false,
      suggestedDesc:      item.description,
      suggestedQty:       item.quantity,
      suggestedUnit:      item.unit,
      reason:             '',
      acceptedOrRejected: false,
    }
  })
}

export function NormalizacaoView() {
  const { takeoffItems, acceptNormalization, rejectNormalization, acceptAllNormalizations, rejectAllNormalizations, setStep } =
    usePreConstrucaoStore(useShallow((s) => ({
      takeoffItems:             s.takeoffItems,
      acceptNormalization:      s.acceptNormalization,
      rejectNormalization:      s.rejectNormalization,
      acceptAllNormalizations:  s.acceptAllNormalizations,
      rejectAllNormalizations:  s.rejectAllNormalizations,
      setStep:                  s.setStep,
    })))

  const suggestions = useMemo(() => buildSuggestions(takeoffItems), [takeoffItems])

  // Local edit state: keyed by item id, stores overrides for suggestion cells
  const [edits, setEdits] = useState<Record<string, { desc: string; qty: string; unit: string }>>({})
  const [editingId, setEditingId] = useState<string | null>(null)

  function startEdit(id: string, defaultDesc: string, defaultQty: number, defaultUnit: string) {
    setEditingId(id)
    if (!edits[id]) {
      setEdits((e) => ({ ...e, [id]: { desc: defaultDesc, qty: String(defaultQty), unit: defaultUnit } }))
    }
  }

  function commitEdit(id: string) {
    const e = edits[id]
    if (!e) return
    usePreConstrucaoStore.setState((st) => ({
      takeoffItems: st.takeoffItems.map((i) =>
        i.id === id ? { ...i, normalizedDescription: e.desc, normalizedQuantity: parseFloat(e.qty) || i.quantity, normalizedUnit: e.unit } : i
      ),
    }))
    setEditingId(null)
  }

  // Pre-populate normalized fields on items that have suggestions but no normalized data yet
  // We do this by calling setTakeoffItems once — actually we show it in the UI and only commit on accept.
  // The store's acceptNormalization reads normalizedDescription/Qty/Unit so we need them set.
  // We'll read from the suggestion's computed values when showing and handle the display accordingly.

  const withSuggestions = suggestions.filter((s) => s.hasSuggestion).length
  const accepted        = suggestions.filter((s) => s.acceptedOrRejected && s.hasSuggestion).length

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[#f5f5f5] text-sm font-semibold">Normalização de Itens</span>
        <span className="px-2 py-0.5 rounded-full bg-[#2abfdc]/20 text-[#2abfdc] text-xs">
          {withSuggestions} sugestões
        </span>
        <span className="px-2 py-0.5 rounded-full bg-[#16a34a]/20 text-[#4ade80] text-xs">
          {accepted} aplicadas
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={acceptAllNormalizations}
            disabled={withSuggestions === 0}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#16a34a]/20 hover:bg-[#16a34a]/30 text-[#4ade80] text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <CheckCheck size={11} /> Aprovar Todos
          </button>
          <button
            onClick={rejectAllNormalizations}
            disabled={withSuggestions === 0}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#dc2626]/20 hover:bg-[#dc2626]/30 text-[#f87171] text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <XCircle size={11} /> Rejeitar Todos
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto overflow-x-auto bg-[#0d2040] border border-[#20406a] rounded-xl">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#1a3662]">
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-8"></th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Original</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2">Sugestão</th>
              <th className="text-left text-[#6b6b6b] text-xs font-medium px-3 py-2 w-36">Motivo</th>
              <th className="text-center text-[#6b6b6b] text-xs font-medium px-3 py-2 w-20">Ação</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map(({ item, hasSuggestion, suggestedDesc, suggestedQty, suggestedUnit, reason, acceptedOrRejected }) => {
              const isEditing = editingId === item.id
              const edit = edits[item.id]
              const displayDesc = edit?.desc ?? suggestedDesc
              const displayQty  = edit?.qty  ?? String(suggestedQty)
              const displayUnit = edit?.unit ?? suggestedUnit

              function doAccept() {
                const desc = edit?.desc ?? suggestedDesc
                const qty  = parseFloat(edit?.qty ?? '') || suggestedQty
                const unit = edit?.unit ?? suggestedUnit
                usePreConstrucaoStore.setState((st) => ({
                  takeoffItems: st.takeoffItems.map((i) =>
                    i.id === item.id
                      ? { ...i, normalized: true, normalizedDescription: desc, normalizedQuantity: qty, normalizedUnit: unit }
                      : i
                  ),
                }))
                acceptNormalization(item.id)
                setEditingId(null)
              }

              return (
                <tr
                  key={item.id}
                  className="border-t border-[#20406a] hover:bg-[#1a3662]/50 transition-colors"
                >
                  {/* Status indicator */}
                  <td className="px-3 py-2">
                    {acceptedOrRejected && hasSuggestion && (
                      <Check size={12} className="text-[#4ade80]" />
                    )}
                  </td>

                  {/* Original */}
                  <td className="px-3 py-2">
                    <div className={cn('flex flex-col gap-0.5', acceptedOrRejected && hasSuggestion && 'line-through opacity-50')}>
                      <span className="text-[#f5f5f5] text-xs">{item.description}</span>
                      <span className="text-[#6b6b6b] text-[10px]">
                        {item.quantity.toLocaleString('pt-BR')} {item.unit}
                      </span>
                    </div>
                  </td>

                  {/* Suggestion — editable on click */}
                  <td className="px-3 py-2 min-w-[200px]">
                    {hasSuggestion ? (
                      isEditing ? (
                        <div className="flex flex-col gap-1">
                          <input
                            autoFocus
                            value={displayDesc}
                            onChange={(e) => setEdits((ed) => ({ ...ed, [item.id]: { ...ed[item.id], desc: e.target.value } }))}
                            onBlur={() => commitEdit(item.id)}
                            className="w-full bg-[#14294e] border border-[#2abfdc] rounded px-1.5 py-0.5 text-xs text-[#f5f5f5] focus:outline-none"
                          />
                          <div className="flex gap-1">
                            <input
                              type="number"
                              value={displayQty}
                              step="any"
                              onChange={(e) => setEdits((ed) => ({ ...ed, [item.id]: { ...ed[item.id], qty: e.target.value } }))}
                              onBlur={() => commitEdit(item.id)}
                              className="w-16 bg-[#14294e] border border-[#2abfdc] rounded px-1.5 py-0.5 text-[10px] text-[#f5f5f5] focus:outline-none"
                            />
                            <input
                              value={displayUnit}
                              onChange={(e) => setEdits((ed) => ({ ...ed, [item.id]: { ...ed[item.id], unit: e.target.value } }))}
                              onBlur={() => commitEdit(item.id)}
                              className="w-12 bg-[#14294e] border border-[#2abfdc] rounded px-1.5 py-0.5 text-[10px] text-[#f5f5f5] focus:outline-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div
                          className="flex flex-col gap-0.5 group cursor-pointer"
                          onClick={() => !acceptedOrRejected && startEdit(item.id, suggestedDesc, suggestedQty, suggestedUnit)}
                          title={acceptedOrRejected ? '' : 'Clique para editar'}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-[#2abfdc] text-xs">{displayDesc}</span>
                            {!acceptedOrRejected && (
                              <Pencil size={9} className="text-[#6b6b6b] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                          </div>
                          <span className="text-[#a3a3a3] text-[10px]">
                            {parseFloat(displayQty).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} {displayUnit}
                          </span>
                        </div>
                      )
                    ) : (
                      <span className="text-[#1f3c5e] text-xs">Sem alterações</span>
                    )}
                  </td>

                  {/* Reason */}
                  <td className="px-3 py-2">
                    {reason ? (
                      <span className="text-[#6b6b6b] text-[10px]">{reason}</span>
                    ) : (
                      <span className="text-[#1f3c5e] text-[10px]">—</span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="px-3 py-2 text-center">
                    {hasSuggestion && !acceptedOrRejected ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={doAccept}
                          className="p-1 rounded bg-[#16a34a]/20 hover:bg-[#16a34a]/40 text-[#4ade80] transition-colors"
                          title="Aceitar sugestão"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() => rejectNormalization(item.id)}
                          className="p-1 rounded bg-[#dc2626]/20 hover:bg-[#dc2626]/40 text-[#f87171] transition-colors"
                          title="Rejeitar sugestão"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[#1f3c5e] text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 shrink-0">
        <button
          onClick={() => setStep('extraction')}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[#1f3c5e] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#555] transition-colors"
        >
          ← Voltar
        </button>
        <button
          onClick={() => setStep('matching')}
          className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#2abfdc] hover:bg-[#ea6c0a] text-white transition-colors"
        >
          Avançar → Matching
        </button>
      </div>
    </div>
  )
}
