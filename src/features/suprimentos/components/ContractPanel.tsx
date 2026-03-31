import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useShallow } from 'zustand/react/shallow'
import type { FrameworkAgreement } from '@/types'
import { Copy, Check, ExternalLink, ChevronDown, ChevronUp, Pencil, X } from 'lucide-react'

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
        copied ? 'text-[#4ade80]' : 'text-[#6b6b6b] hover:text-[#a3a3a3]',
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
    expired:  { label: 'Expirado',  cls: 'bg-[#14294e] text-[#6b6b6b] border-[#20406a]'        },
  }
  const { label, cls } = map[status]
  return (
    <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-semibold', cls)}>
      {label}
    </span>
  )
}

// ─── Collapsible accordion section ───────────────────────────────────────────

function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-[#14294e] border border-[#20406a] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#1a3662] transition-colors"
      >
        <span className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp size={14} className="text-[#6b6b6b]" /> : <ChevronDown size={14} className="text-[#6b6b6b]" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ContractPanel() {
  const { frameworkAgreements, updateFrameworkAgreement } = useSuprimentosStore(
    useShallow((s) => ({ frameworkAgreements: s.frameworkAgreements, updateFrameworkAgreement: s.updateFrameworkAgreement }))
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editDraft, setEditDraft] = useState<Partial<FrameworkAgreement>>({})

  const selected = frameworkAgreements.find((fa) => fa.id === selectedId) ?? null

  function startEdit() {
    if (!selected) return
    setEditDraft({
      paymentSchedule:       selected.paymentSchedule ? selected.paymentSchedule.map((p) => ({ ...p })) : undefined,
      deliverySchedule:      selected.deliverySchedule ? selected.deliverySchedule.map((d) => ({ ...d })) : undefined,
      terminationClause:     selected.terminationClause ?? 'Rescisão com aviso prévio mínimo de 30 dias corridos. Em caso de inadimplemento, rescisão imediata com aplicação de multa de 10% sobre o valor restante do contrato.',
      priceAdjustmentIndex:  selected.priceAdjustmentIndex ?? 'INCC',
      priceAdjustmentPct:    selected.priceAdjustmentPct ?? 0,
    })
    setIsEditing(true)
  }

  function saveEdit() {
    if (!selected) return
    updateFrameworkAgreement(selected.id, editDraft)
    setIsEditing(false)
  }

  function cancelEdit() {
    setIsEditing(false)
    setEditDraft({})
  }

  return (
    <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
      {/* ── Left: FA list ── */}
      <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
        <p className="text-[#6b6b6b] text-xs font-semibold uppercase tracking-wide px-1">
          Acordos Marco ({frameworkAgreements.length})
        </p>

        {frameworkAgreements.map((fa) => {
          const pctConsumed = Math.min(100, Math.round((Math.random() * 0.7 + 0.1) * 100))
          const isSelected  = fa.id === selectedId

          return (
            <button
              key={fa.id}
              onClick={() => setSelectedId(isSelected ? null : fa.id)}
              className={cn(
                'text-left bg-[#14294e] border rounded-xl p-3.5 flex flex-col gap-2.5 transition-all',
                isSelected
                  ? 'border-[#2abfdc]/60 bg-[#2abfdc]/5'
                  : 'border-[#20406a] hover:border-[#1a3662]',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[#f5f5f5] text-xs font-semibold leading-snug">{fa.supplier}</p>
                  <p className="text-[#6b6b6b] text-[10px] mt-0.5">{fa.category}</p>
                </div>
                <StatusBadge status={fa.status} />
              </div>

              <div className="flex gap-3 text-[10px]">
                <div>
                  <p className="text-[#6b6b6b]">Preço</p>
                  <p className="text-[#f5f5f5] tabular-nums font-medium">
                    {fa.agreedUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/{fa.unit}
                  </p>
                </div>
                <div>
                  <p className="text-[#6b6b6b]">Lead Time</p>
                  <p className="text-[#f5f5f5] font-medium">{fa.leadTimeDays}d</p>
                </div>
                <div>
                  <p className="text-[#6b6b6b]">Validade</p>
                  <p className="text-[#f5f5f5] font-medium">{fa.validTo}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-[#6b6b6b] mb-1">
                  <span>Volume utilizado</span>
                  <span className="tabular-nums">{pctConsumed}%</span>
                </div>
                <div className="h-1.5 bg-[#0d2040] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      pctConsumed >= 80 ? 'bg-red-500' : pctConsumed >= 60 ? 'bg-amber-500' : 'bg-[#2abfdc]',
                    )}
                    style={{ width: `${pctConsumed}%` }}
                  />
                </div>
              </div>

              <span className="self-start font-mono text-[10px] text-[#6b6b6b] bg-[#0d2040] px-1.5 py-0.5 rounded">
                {fa.code}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Right: Contrato 360 ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {selected ? (
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] text-[#2abfdc] font-semibold uppercase tracking-wide mb-1">
                    Contrato 360 — {selected.code}
                  </p>
                  <p className="text-[#f5f5f5] font-bold text-base">{selected.supplier}</p>
                  <p className="text-[#6b6b6b] text-xs mt-0.5">{selected.category}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  {isEditing ? (
                    <>
                      <button onClick={saveEdit} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#16a34a]/20 hover:bg-[#16a34a]/30 text-[#4ade80] text-xs font-semibold transition-colors">
                        <Check size={12} /> Salvar
                      </button>
                      <button onClick={cancelEdit} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3] text-xs font-medium transition-colors">
                        <X size={12} /> Cancelar
                      </button>
                    </>
                  ) : (
                    <button onClick={startEdit} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#20406a] text-[#6b6b6b] hover:text-[#a3a3a3] text-xs font-medium transition-colors">
                      <Pencil size={12} /> Editar
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-[#6b6b6b]">
                <span>Vigência: <strong className="text-[#f5f5f5]">{selected.validFrom}</strong> → <strong className="text-[#f5f5f5]">{selected.validTo}</strong></span>
                <span>Confiança: <strong className="text-[#f5f5f5]">{selected.confidenceScore.toFixed(1)}/5.0</strong></span>
              </div>
            </div>

            {/* Section 1: Pagamentos */}
            <AccordionSection title="Pagamentos">
              {(isEditing ? (editDraft.paymentSchedule ?? selected.paymentSchedule) : selected.paymentSchedule) && (isEditing ? (editDraft.paymentSchedule ?? selected.paymentSchedule) : selected.paymentSchedule)!.length > 0 ? (
                <div className="overflow-x-auto"><table className="w-full text-xs mt-1">
                  <thead>
                    <tr className="text-[#6b6b6b] border-b border-[#20406a]">
                      <th className="text-left pb-2 font-medium">Vencimento</th>
                      <th className="text-right pb-2 font-medium">Valor</th>
                      <th className="text-center pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing ? (editDraft.paymentSchedule ?? selected.paymentSchedule) : selected.paymentSchedule)!.map((p, i) => (
                      <tr key={i} className="border-b border-[#20406a] last:border-0">
                        <td className="py-2 text-[#f5f5f5]">
                          {isEditing ? (
                            <input type="date" className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-gray-100 text-xs" value={p.dueDate}
                              onChange={(e) => setEditDraft((d) => ({ ...d, paymentSchedule: (d.paymentSchedule ?? selected.paymentSchedule ?? []).map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x) }))} />
                          ) : new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[#f5f5f5]">
                          {isEditing ? (
                            <input type="number" className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-gray-100 text-xs w-28 text-right" value={p.amount}
                              onChange={(e) => setEditDraft((d) => ({ ...d, paymentSchedule: (d.paymentSchedule ?? selected.paymentSchedule ?? []).map((x, j) => j === i ? { ...x, amount: Number(e.target.value) } : x) }))} />
                          ) : p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="py-2 text-center">
                          {isEditing ? (
                            <select className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-gray-100 text-xs" value={p.status}
                              onChange={(e) => setEditDraft((d) => ({ ...d, paymentSchedule: (d.paymentSchedule ?? selected.paymentSchedule ?? []).map((x, j) => j === i ? { ...x, status: e.target.value as typeof p.status } : x) }))}>
                              <option value="pending">Pendente</option>
                              <option value="paid">Pago</option>
                              <option value="overdue">Vencido</option>
                            </select>
                          ) : (
                            <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold',
                              p.status === 'paid'    ? 'bg-[#16a34a]/20 text-[#4ade80]' :
                              p.status === 'overdue' ? 'bg-[#dc2626]/20 text-[#f87171]' :
                              'bg-[#ca8a04]/20 text-[#fbbf24]'
                            )}>
                              {p.status === 'paid' ? 'Pago' : p.status === 'overdue' ? 'Vencido' : 'Pendente'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                <p className="text-[#6b6b6b] text-xs mt-1">
                  Preço acordado: {selected.agreedUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/{selected.unit}.
                  Vigência {selected.validFrom} → {selected.validTo}.
                </p>
              )}
            </AccordionSection>

            {/* Section 2: Prazos de Entrega */}
            <AccordionSection title="Prazos de Entrega">
              {(isEditing ? (editDraft.deliverySchedule ?? selected.deliverySchedule) : selected.deliverySchedule) && (isEditing ? (editDraft.deliverySchedule ?? selected.deliverySchedule) : selected.deliverySchedule)!.length > 0 ? (
                <div className="overflow-x-auto"><table className="w-full text-xs mt-1">
                  <thead>
                    <tr className="text-[#6b6b6b] border-b border-[#20406a]">
                      <th className="text-left pb-2 font-medium">Fase</th>
                      <th className="text-left pb-2 font-medium">Data</th>
                      <th className="text-right pb-2 font-medium">Qtd</th>
                      <th className="text-center pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isEditing ? (editDraft.deliverySchedule ?? selected.deliverySchedule) : selected.deliverySchedule)!.map((d, i) => (
                      <tr key={i} className="border-b border-[#20406a] last:border-0">
                        <td className="py-2 text-[#f5f5f5]">{d.phase}</td>
                        <td className="py-2 text-[#a3a3a3]">
                          {isEditing ? (
                            <input type="date" className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-gray-100 text-xs" value={d.dueDate}
                              onChange={(e) => setEditDraft((dr) => ({ ...dr, deliverySchedule: (dr.deliverySchedule ?? selected.deliverySchedule ?? []).map((x, j) => j === i ? { ...x, dueDate: e.target.value } : x) }))} />
                          ) : new Date(d.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[#f5f5f5]">
                          {isEditing ? (
                            <input type="number" className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-gray-100 text-xs w-20 text-right" value={d.quantity}
                              onChange={(e) => setEditDraft((dr) => ({ ...dr, deliverySchedule: (dr.deliverySchedule ?? selected.deliverySchedule ?? []).map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x) }))} />
                          ) : `${d.quantity.toLocaleString('pt-BR')} ${selected.unit}`}
                        </td>
                        <td className="py-2 text-center">
                          {isEditing ? (
                            <select className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-gray-100 text-xs" value={d.status}
                              onChange={(e) => setEditDraft((dr) => ({ ...dr, deliverySchedule: (dr.deliverySchedule ?? selected.deliverySchedule ?? []).map((x, j) => j === i ? { ...x, status: e.target.value as typeof d.status } : x) }))}>
                              <option value="on_time">No prazo</option>
                              <option value="delayed">Atrasado</option>
                              <option value="delivered">Entregue</option>
                            </select>
                          ) : (
                            <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold',
                              d.status === 'delivered' ? 'bg-[#16a34a]/20 text-[#4ade80]' :
                              d.status === 'delayed'   ? 'bg-[#dc2626]/20 text-[#f87171]' :
                              'bg-[#2563eb]/20 text-[#93c5fd]'
                            )}>
                              {d.status === 'delivered' ? 'Entregue' : d.status === 'delayed' ? 'Atrasado' : 'No prazo'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                <p className="text-[#6b6b6b] text-xs mt-1">
                  Lead time padrão de {selected.leadTimeDays} dias úteis.
                  Volume máximo contratado: {selected.maxQuantity.toLocaleString('pt-BR')} {selected.unit}.
                </p>
              )}
            </AccordionSection>

            {/* Section 3: Rescisão */}
            <AccordionSection title="Rescisão">
              <div className="flex items-start gap-2 mt-1">
                {isEditing ? (
                  <textarea
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-gray-100 text-xs leading-relaxed resize-none h-24"
                    value={editDraft.terminationClause ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, terminationClause: e.target.value }))}
                  />
                ) : (
                  <>
                    <p className="text-[#a3a3a3] text-xs leading-relaxed flex-1">
                      {selected.terminationClause ?? 'Rescisão com aviso prévio mínimo de 30 dias corridos. Em caso de inadimplemento, rescisão imediata com aplicação de multa de 10% sobre o valor restante do contrato.'}
                    </p>
                    <CopyButton text={selected.terminationClause ?? 'Rescisão com aviso prévio mínimo de 30 dias corridos.'} />
                  </>
                )}
              </div>
            </AccordionSection>

            {/* Section 4: Reajuste de Preço */}
            <AccordionSection title="Reajuste de Preço">
              <div className="flex items-center gap-4 mt-1 flex-wrap">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Índice</span>
                  {isEditing ? (
                    <select className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-100 text-xs" value={editDraft.priceAdjustmentIndex ?? 'INCC'}
                      onChange={(e) => setEditDraft((d) => ({ ...d, priceAdjustmentIndex: e.target.value as FrameworkAgreement['priceAdjustmentIndex'] }))}>
                      <option value="IGP-M">IGP-M</option>
                      <option value="INCC">INCC</option>
                      <option value="IPCA">IPCA</option>
                      <option value="Fixo">Fixo</option>
                    </select>
                  ) : (
                    <span className="text-sm font-bold text-[#2abfdc]">
                      {selected.priceAdjustmentIndex ?? (selected.terms.includes('IGP-M') ? 'IGP-M' : 'INCC')}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Percentual</span>
                  {isEditing ? (
                    <input type="number" step={0.1} className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-gray-100 text-xs w-20" value={editDraft.priceAdjustmentPct ?? 0}
                      onChange={(e) => setEditDraft((d) => ({ ...d, priceAdjustmentPct: Number(e.target.value) }))} />
                  ) : selected.priceAdjustmentPct !== undefined ? (
                    <span className="text-sm font-bold text-[#f5f5f5]">{selected.priceAdjustmentPct.toFixed(1)}% a.a.</span>
                  ) : null}
                </div>
                {!isEditing && (
                  <p className="text-xs text-[#6b6b6b] flex-1">
                    {selected.priceAdjustmentIndex === 'Fixo'
                      ? 'Preço fixo durante toda a vigência do contrato.'
                      : 'Reajuste conforme índice definido, aplicado semestralmente.'}
                  </p>
                )}
              </div>
            </AccordionSection>

            {/* Full document link */}
            <div className="bg-[#0d2040] border border-dashed border-[#20406a] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[#6b6b6b] text-xs font-medium">Documento Completo</p>
                <p className="text-[#3f3f3f] text-[10px] mt-0.5">
                  {selected.code}-contrato-marco.pdf
                </p>
              </div>
              <button
                className="flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#2abfdc] transition-colors border border-[#20406a] hover:border-[#2abfdc]/40 rounded-lg px-3 py-1.5"
                onClick={() => undefined}
              >
                <ExternalLink size={12} />
                Abrir ↗
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-[#6b6b6b] min-h-[200px]">
            <span className="text-4xl">📄</span>
            <p className="text-sm font-medium text-[#6b6b6b]">Selecione um Acordo Marco</p>
            <p className="text-xs max-w-xs">
              Clique em um contrato à esquerda para ver o resumo Contrato 360
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
