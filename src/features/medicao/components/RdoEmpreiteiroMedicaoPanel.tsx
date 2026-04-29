import { useEffect, useMemo, useState } from 'react'
import { Calculator, ExternalLink, FileText, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { readLocalRdoSabesp } from '@/features/rdo-sabesp/lib/rdoSabespLocalStore'
import { getCriadouroLabel, getRdoSabespExecutedServices } from '@/features/rdo-sabesp/lib/rdoSabespUtils'
import {
  useContractorStore,
  type ContractorInvoiceStatus,
  type MeasurementAdjustmentKind,
} from '@/store/contractorStore'

interface RdoMeasurementRow {
  id: string
  rdoId: string
  rdoDate: string
  contractorId: string | null
  contractorName: string
  nucleo: string
  code: string
  description: string
  unit: string
  quantity: number
  origin: string
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const adjustmentLabels: Record<MeasurementAdjustmentKind, string> = {
  extra: 'Item extracontratual',
  discount: 'Desconto',
  manual_adjustment: 'Ajuste manual',
}

const invoiceStatuses: ContractorInvoiceStatus[] = ['pendente', 'enviada', 'aprovada', 'paga', 'glosada']
const fieldClass = 'rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]'

export function RdoEmpreiteiroMedicaoPanel() {
  const {
    contractors,
    adjustments,
    invoices,
    invoiceEvents,
    syncError,
    load,
    resolveRdoContractor,
    addAdjustment,
    updateAdjustment,
    removeAdjustment,
    addInvoice,
    updateInvoice,
    removeInvoice,
  } = useContractorStore()
  const [contractorFilter, setContractorFilter] = useState('all')
  const [nucleoFilter, setNucleoFilter] = useState('all')
  const [adjustmentForm, setAdjustmentForm] = useState({
    contractor_id: '',
    nucleo: '',
    kind: 'extra' as MeasurementAdjustmentKind,
    description: '',
    unit: 'UN',
    quantity: 1,
    unit_price: 0,
    amount: 0,
  })
  const [invoiceForm, setInvoiceForm] = useState({
    contractor_id: '',
    nucleo: '',
    invoice_number: '',
    amount: 0,
    status: 'pendente' as ContractorInvoiceStatus,
    issue_date: '',
    payment_date: '',
    notes: '',
  })

  useEffect(() => {
    void load()
  }, [load])

  const activeContractors = contractors.filter((item) => !item.deleted_at)

  const rows = useMemo<RdoMeasurementRow[]>(() => {
    return readLocalRdoSabesp()
      .filter((rdo) => rdo.status !== 'draft')
      .flatMap((rdo) => {
        const contractor = resolveRdoContractor({ rdoId: rdo.id, rdoType: 'sabesp', foremanName: rdo.encarregado })
        const nucleo = getCriadouroLabel(rdo.criadouro, rdo.criadouro_outro)
        return getRdoSabespExecutedServices(rdo).map((service) => ({
          id: `${rdo.id}-${service.service_id}`,
          rdoId: rdo.id,
          rdoDate: String(rdo.report_date || ''),
          contractorId: contractor?.id ?? null,
          contractorName: contractor?.name ?? 'Empreiteira nao identificada',
          nucleo,
          code: service.service_id.split('-')[0] || '',
          description: service.services_catalog.name,
          unit: service.unit || service.services_catalog.unit || '',
          quantity: service.quantity,
          origin: 'RDO Sabesp',
        }))
      })
  }, [contractors, resolveRdoContractor])

  const nucleos = useMemo(() => Array.from(new Set(rows.map((row) => row.nucleo).filter(Boolean))).sort(), [rows])

  const filteredRows = rows.filter((row) => {
    if (contractorFilter !== 'all' && row.contractorId !== contractorFilter) return false
    if (nucleoFilter !== 'all' && row.nucleo !== nucleoFilter) return false
    return true
  })

  const filteredAdjustments = adjustments.filter((item) => {
    if (item.deleted_at) return false
    if (contractorFilter !== 'all' && item.contractor_id !== contractorFilter) return false
    if (nucleoFilter !== 'all' && item.nucleo !== nucleoFilter) return false
    return true
  })

  const summary = filteredRows.reduce(
    (acc, row) => {
      acc.rows += 1
      acc.quantity += row.quantity
      acc.contractors.add(row.contractorName)
      return acc
    },
    { rows: 0, quantity: 0, contractors: new Set<string>() },
  )
  const adjustmentAmount = filteredAdjustments.reduce((sum, item) => sum + (item.kind === 'discount' ? -Math.abs(item.amount) : item.amount), 0)

  async function saveAdjustment() {
    const amount = adjustmentForm.amount || adjustmentForm.quantity * adjustmentForm.unit_price
    if (!adjustmentForm.description.trim()) return
    await addAdjustment({
      contractor_id: adjustmentForm.contractor_id || null,
      nucleo: adjustmentForm.nucleo || null,
      kind: adjustmentForm.kind,
      description: adjustmentForm.description,
      unit: adjustmentForm.unit,
      quantity: Number(adjustmentForm.quantity) || 0,
      unit_price: Number(adjustmentForm.unit_price) || 0,
      amount: Number(amount) || 0,
    })
    setAdjustmentForm((value) => ({ ...value, description: '', amount: 0 }))
  }

  async function saveInvoice() {
    if (!invoiceForm.contractor_id) return
    await addInvoice({
      contractor_id: invoiceForm.contractor_id,
      nucleo: invoiceForm.nucleo || null,
      invoice_number: invoiceForm.invoice_number || null,
      amount: Number(invoiceForm.amount) || 0,
      status: invoiceForm.status,
      issue_date: invoiceForm.issue_date || null,
      payment_date: invoiceForm.payment_date || null,
      notes: invoiceForm.notes || null,
    })
    setInvoiceForm((value) => ({ ...value, invoice_number: '', amount: 0, notes: '' }))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Medicao por RDO e empreiteiro</h2>
          <p className="text-sm text-[#a3a3a3]">
            Consolida quantidades dos RDOs Sabesp finalizados, separando por nucleo, empreiteira ou pelos dois.
          </p>
        </div>
        {syncError && (
          <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Cache local ativo: {syncError}
          </span>
        )}
      </div>

      <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
          <select
            value={contractorFilter}
            onChange={(event) => setContractorFilter(event.target.value)}
            className="rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
          >
            <option value="all">Todas as empreiteiras</option>
            {activeContractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>{contractor.name}</option>
            ))}
          </select>
          <select
            value={nucleoFilter}
            onChange={(event) => setNucleoFilter(event.target.value)}
            className="rounded-lg border border-[#525252] bg-[#1f1f1f] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
          >
            <option value="all">Todos os nucleos</option>
            {nucleos.map((nucleo) => (
              <option key={nucleo} value={nucleo}>{nucleo}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-[#525252] bg-[#484848] px-4 py-2 text-sm font-medium text-white hover:bg-[#525252]"
          >
            Gerar relatorio
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Metric label="Linhas RDO" value={summary.rows} />
          <Metric label="Qtd. executada" value={summary.quantity.toFixed(2)} />
          <Metric label="Empreiteiras" value={summary.contractors.size} />
          <Metric label="Ajustes/descontos" value={money.format(adjustmentAmount)} />
        </div>
      </section>

      <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
        <div className="mb-4 flex items-center gap-2 text-white">
          <FileText size={18} className="text-[#f97316]" />
          <h3 className="font-semibold">Origem das quantidades</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-xs uppercase text-[#a3a3a3]">
              <tr className="border-b border-[#525252]">
                <th className="py-2">Data</th>
                <th>Empreiteira</th>
                <th>Nucleo</th>
                <th>Servico</th>
                <th>Qtd.</th>
                <th>Origem</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-[#3d3d3d] text-[#f5f5f5]">
                  <td className="py-2">{row.rdoDate}</td>
                  <td>{row.contractorName}</td>
                  <td>{row.nucleo}</td>
                  <td>{row.description}</td>
                  <td>{row.quantity} {row.unit}</td>
                  <td><span className="rounded-full bg-[#f97316]/10 px-2 py-1 text-xs text-[#f97316]">{row.origin}</span></td>
                  <td>
                    <button type="button" onClick={() => window.location.assign('/app/rdo-sabesp')} className="text-[#a3a3a3] hover:text-white" title="Abrir RDO Sabesp">
                      <ExternalLink size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-[#6b6b6b]">Nenhuma quantidade de RDO encontrada para o filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
          <div className="mb-4 flex items-center gap-2 text-white">
            <Calculator size={18} className="text-[#f97316]" />
            <h3 className="font-semibold">Itens, extras, descontos e ajustes</h3>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <select value={adjustmentForm.contractor_id} onChange={(event) => setAdjustmentForm((value) => ({ ...value, contractor_id: event.target.value }))} className={fieldClass}>
              <option value="">Empreiteira</option>
              {activeContractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}
            </select>
            <input value={adjustmentForm.nucleo} onChange={(event) => setAdjustmentForm((value) => ({ ...value, nucleo: event.target.value }))} placeholder="Nucleo" className={fieldClass} />
            <select value={adjustmentForm.kind} onChange={(event) => setAdjustmentForm((value) => ({ ...value, kind: event.target.value as MeasurementAdjustmentKind }))} className={fieldClass}>
              <option value="extra">Item extracontratual</option>
              <option value="manual_adjustment">Ajuste manual</option>
              <option value="discount">Desconto</option>
            </select>
            <input value={adjustmentForm.description} onChange={(event) => setAdjustmentForm((value) => ({ ...value, description: event.target.value }))} placeholder="Descricao" className={fieldClass} />
            <input value={adjustmentForm.unit} onChange={(event) => setAdjustmentForm((value) => ({ ...value, unit: event.target.value }))} placeholder="Un." className={fieldClass} />
            <input type="number" value={adjustmentForm.quantity} onChange={(event) => setAdjustmentForm((value) => ({ ...value, quantity: Number(event.target.value) }))} placeholder="Qtd." className={fieldClass} />
            <input type="number" value={adjustmentForm.unit_price} onChange={(event) => setAdjustmentForm((value) => ({ ...value, unit_price: Number(event.target.value) }))} placeholder="Valor unit." className={fieldClass} />
            <input type="number" value={adjustmentForm.amount} onChange={(event) => setAdjustmentForm((value) => ({ ...value, amount: Number(event.target.value) }))} placeholder="Valor total" className={fieldClass} />
          </div>
          <button type="button" onClick={saveAdjustment} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white hover:bg-[#ea580c]">
            <Plus size={14} /> Adicionar
          </button>
          <div className="mt-4 space-y-2">
            {filteredAdjustments.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
                <div>
                  <p className="text-sm font-medium text-white">{item.description}</p>
                  <p className="text-xs text-[#a3a3a3]">
                    {adjustmentLabels[item.kind]} - {item.quantity} {item.unit} - {money.format(item.amount)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void updateAdjustment(item.id, { amount: item.amount })} className="text-[#a3a3a3] hover:text-white">Salvar</button>
                  <button type="button" onClick={() => void removeAdjustment(item.id)} className="text-red-300 hover:text-red-200"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-4">
          <div className="mb-4 flex items-center gap-2 text-white">
            <ReceiptText size={18} className="text-[#f97316]" />
            <h3 className="font-semibold">Notas e pagamentos</h3>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <select value={invoiceForm.contractor_id} onChange={(event) => setInvoiceForm((value) => ({ ...value, contractor_id: event.target.value }))} className={fieldClass}>
              <option value="">Empreiteira</option>
              {activeContractors.map((contractor) => <option key={contractor.id} value={contractor.id}>{contractor.name}</option>)}
            </select>
            <input value={invoiceForm.nucleo} onChange={(event) => setInvoiceForm((value) => ({ ...value, nucleo: event.target.value }))} placeholder="Nucleo" className={fieldClass} />
            <input value={invoiceForm.invoice_number} onChange={(event) => setInvoiceForm((value) => ({ ...value, invoice_number: event.target.value }))} placeholder="Numero NF" className={fieldClass} />
            <input type="number" value={invoiceForm.amount} onChange={(event) => setInvoiceForm((value) => ({ ...value, amount: Number(event.target.value) }))} placeholder="Valor" className={fieldClass} />
            <select value={invoiceForm.status} onChange={(event) => setInvoiceForm((value) => ({ ...value, status: event.target.value as ContractorInvoiceStatus }))} className={fieldClass}>
              {invoiceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <input type="date" value={invoiceForm.issue_date} onChange={(event) => setInvoiceForm((value) => ({ ...value, issue_date: event.target.value }))} className={fieldClass} />
            <input type="date" value={invoiceForm.payment_date} onChange={(event) => setInvoiceForm((value) => ({ ...value, payment_date: event.target.value }))} className={fieldClass} />
            <input value={invoiceForm.notes} onChange={(event) => setInvoiceForm((value) => ({ ...value, notes: event.target.value }))} placeholder="Observacoes" className={fieldClass} />
          </div>
          <button type="button" onClick={saveInvoice} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white hover:bg-[#ea580c]">
            <Plus size={14} /> Criar nota
          </button>
          <div className="mt-4 space-y-2">
            {invoices.filter((item) => !item.deleted_at).map((invoice) => {
              const contractor = activeContractors.find((item) => item.id === invoice.contractor_id)
              const events = invoiceEvents.filter((event) => event.invoice_id === invoice.id)
              return (
                <div key={invoice.id} className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">NF {invoice.invoice_number || '-'} - {contractor?.name || 'Empreiteira'}</p>
                      <p className="text-xs text-[#a3a3a3]">{money.format(invoice.amount)} - {invoice.nucleo || 'Sem nucleo'}</p>
                    </div>
                    <select
                      value={invoice.status}
                      onChange={(event) => void updateInvoice(invoice.id, { status: event.target.value as ContractorInvoiceStatus })}
                      className="rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-xs text-white"
                    >
                      {invoiceStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#6b6b6b]">
                    {events.map((event) => (
                      <span key={event.id} className="rounded-full bg-[#2c2c2c] px-2 py-1">{event.event_date}: {event.status}</span>
                    ))}
                  </div>
                  <button type="button" onClick={() => void removeInvoice(invoice.id)} className="mt-2 text-xs text-red-300 hover:text-red-200">Excluir nota</button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#1f1f1f] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}
