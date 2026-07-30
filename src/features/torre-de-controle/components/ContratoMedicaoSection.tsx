/**
 * ContratoMedicaoSection — "Contrato & Medição" por obra (Torre de Controle).
 * Cadastra o contrato da obra (dados + lista de serviços, espelhando a planilha
 * "Solicitação de Medição") e mostra o Controle de Medição (contratado × medido × saldo).
 * Persiste no payload da obra via updateSite (sem migração). O "medido" vem automático das
 * produções dos RDOs Compizzo finalizados (por contractServiceId), com override manual.
 */
import { useState } from 'react'
import { FileSpreadsheet, Pencil, Plus, Trash2, Save, X, Download } from 'lucide-react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useRdoStore } from '@/store/rdoStore'
import { parseLocaleNumber } from '@/lib/numberFormat'
import { medidoAutoPorServico, calcServico, totaisContrato } from '@/features/torre-de-controle/utils/obraMedicao'
import { exportSolicitacaoMedicao } from '@/features/torre-de-controle/utils/solicitacaoMedicaoXlsx'
import type { ConstructionSite, ObraContrato, ObraContratoServico } from '@/types'

const brl = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const emptyContrato = (): ObraContrato => ({ services: [] })
const inCls = 'w-full rounded border border-[#525252] bg-[#2c2c2c] px-2 py-1 text-xs text-[#f5f5f5] outline-none focus:border-[#f97316]/60'
const numCls = inCls + ' text-right tabular-nums'

export function ContratoMedicaoSection({ site }: { site: ConstructionSite }) {
  const updateSite = useTorreStore((s) => s.updateSite)
  const rdos = useRdoStore((s) => s.rdos)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ObraContrato>(emptyContrato)

  const contrato = site.contrato
  const medidoAuto = medidoAutoPorServico(rdos, site.id)

  function open() { setDraft(contrato ? structuredClone(contrato) : emptyContrato()); setEditing(true) }
  function save() { updateSite(site.id, { contrato: draft }); setEditing(false) }
  const setHeader = (patch: Partial<ObraContrato>) => setDraft((d) => ({ ...d, ...patch }))
  const setSvc = (id: string, patch: Partial<ObraContratoServico>) =>
    setDraft((d) => ({ ...d, services: d.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  const addSvc = () => setDraft((d) => ({ ...d, services: [...d.services, { id: crypto.randomUUID(), descricao: '', unidade: 'm²', qtdContrato: 0, valorUnitario: 0 }] }))
  const rmSvc = (id: string) => setDraft((d) => ({ ...d, services: d.services.filter((s) => s.id !== id) }))
  // Campo numérico opcional: '' → undefined; senão parse.
  const optNum = (v: string): number | undefined => (v.trim() === '' ? undefined : parseLocaleNumber(v))

  // ── Modo edição ────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <SectionShell onSave={save} onCancel={() => setEditing(false)}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          <Field label="Contratante" v={draft.contratanteRazao} on={(x) => setHeader({ contratanteRazao: x })} />
          <Field label="CNPJ contratante" v={draft.contratanteCnpj} on={(x) => setHeader({ contratanteCnpj: x })} />
          <Field label="Contratado" v={draft.contratadoRazao} on={(x) => setHeader({ contratadoRazao: x })} />
          <Field label="CNPJ contratado" v={draft.contratadoCnpj} on={(x) => setHeader({ contratadoCnpj: x })} />
          <Field label="Contato" v={draft.contratadoContato} on={(x) => setHeader({ contratadoContato: x })} />
          <Field label="Nº contrato" v={draft.numeroContrato} on={(x) => setHeader({ numeroContrato: x })} />
          <Field label="Aditivo" v={draft.numeroAditivo} on={(x) => setHeader({ numeroAditivo: x })} />
          <Field label="Objeto" v={draft.objetoAditivo} on={(x) => setHeader({ objetoAditivo: x })} />
          <Field label="Valor total (R$)" v={draft.valorTotal != null ? String(draft.valorTotal) : ''} on={(x) => setHeader({ valorTotal: optNum(x) })} num />
          <Field label="Local" v={draft.local} on={(x) => setHeader({ local: x })} />
          <Field label="Medição nº" v={draft.numeroMedicao} on={(x) => setHeader({ numeroMedicao: x })} />
          <Field label="Período" v={draft.periodoReferencia} on={(x) => setHeader({ periodoReferencia: x })} />
          <Field label="Desconto NF materiais (%)" v={draft.descontoNfPct != null ? String(draft.descontoNfPct) : ''} on={(x) => setHeader({ descontoNfPct: optNum(x) })} num />
        </div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold">Serviços do contrato</span>
          <button onClick={addSvc} className="flex items-center gap-1 text-[10px] text-[#6b6b6b] hover:text-[#f97316]"><Plus size={11} /> Adicionar serviço</button>
        </div>
        <div className="flex flex-col gap-2">
          {draft.services.length === 0 && <p className="text-[10px] text-[#3f3f3f] py-2">Nenhum serviço. Clique em "Adicionar serviço".</p>}
          {draft.services.map((s) => {
            const c = calcServico(s, medidoAuto)
            return (
              <div key={s.id} className="rounded-lg border border-[#525252] bg-[#2c2c2c] p-2 flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                  <input className={inCls} value={s.descricao} onChange={(e) => setSvc(s.id, { descricao: e.target.value })} placeholder="Serviço (ex.: Pintura em Epoxi em Piso)" />
                  <input className={inCls + ' w-16'} value={s.unidade} onChange={(e) => setSvc(s.id, { unidade: e.target.value })} placeholder="m²" list="obra-contrato-un" />
                  <button onClick={() => rmSvc(s.id)} className="shrink-0 px-2 rounded text-[#6b6b6b] hover:text-[#ef4444] hover:bg-[#ef4444]/10"><Trash2 size={13} /></button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <NumBox label="Qtd contratada" v={s.qtdContrato} on={(x) => setSvc(s.id, { qtdContrato: parseLocaleNumber(x) })} />
                  <NumBox label="Preço cheio (R$)" v={s.valorUnitario} on={(x) => setSvc(s.id, { valorUnitario: parseLocaleNumber(x) })} />
                  <NumBox label="% aplicado" v={s.pctAplicado ?? 100} on={(x) => setSvc(s.id, { pctAplicado: optNum(x) })} />
                  <NumBox label="Medido anterior" v={s.qtdAnterior} on={(x) => setSvc(s.id, { qtdAnterior: optNum(x) })} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[#6b6b6b]">
                  <span>Preço efetivo: <strong className="text-[#a3a3a3]">{brl(c.precoEfetivo)}</strong></span>
                  <span>Medido (auto RDO): <strong className="text-[#a3a3a3]">{num(medidoAuto.get(s.id) ?? 0)}</strong></span>
                  <label className="flex items-center gap-1">override:
                    <input className={numCls + ' w-20'} value={s.qtdMedidaOverride != null ? String(s.qtdMedidaOverride) : ''} onChange={(e) => setSvc(s.id, { qtdMedidaOverride: optNum(e.target.value) })} placeholder="—" />
                  </label>
                  <span>Saldo: <strong className={c.saldo < 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}>{num(c.saldo)} {s.unidade}</strong></span>
                </div>
              </div>
            )
          })}
        </div>
        <datalist id="obra-contrato-un"><option value="m²" /><option value="m" /><option value="un" /><option value="kg" /><option value="L" /></datalist>
      </SectionShell>
    )
  }

  // ── Modo leitura (Controle de Medição) ───────────────────────────────────────
  const services = contrato?.services ?? []
  const tot = totaisContrato(services, medidoAuto, contrato?.descontoNfPct)

  return (
    <div className="px-4 py-3 border-b border-[#525252] flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[#6b6b6b]"><FileSpreadsheet size={12} /><span className="text-[10px] uppercase tracking-widest font-semibold">Contrato & Medição</span></div>
        <div className="flex items-center gap-1">
          {services.length > 0 && (
            <button onClick={() => exportSolicitacaoMedicao(site, medidoAuto)} className="flex items-center gap-1 rounded-lg border border-[#525252] px-2.5 py-1 text-[10px] text-[#6b6b6b] hover:border-[#22c55e]/30 hover:text-[#22c55e]" title="Exportar a Solicitação de Medição (.xlsx)"><Download size={11} /> Exportar planilha</button>
          )}
          <button onClick={open} className="flex items-center gap-1 rounded-lg border border-[#525252] px-2.5 py-1 text-[10px] text-[#6b6b6b] hover:border-[#f97316]/30 hover:text-[#f97316]"><Pencil size={11} /> {services.length ? 'Editar' : 'Cadastrar'}</button>
        </div>
      </div>
      {services.length === 0 ? (
        <p className="text-[10px] text-[#3f3f3f] py-1">Nenhum contrato cadastrado. Clique em "Cadastrar" para lançar os serviços (qtd contratada, preço, medição).</p>
      ) : (
        <>
          {(contrato?.numeroContrato || contrato?.contratadoRazao || contrato?.numeroMedicao) && (
            <p className="text-[10px] text-[#6b6b6b]">
              {contrato?.contratadoRazao}{contrato?.numeroContrato ? ` · contrato ${contrato.numeroContrato}` : ''}{contrato?.numeroMedicao ? ` · medição ${contrato.numeroMedicao}` : ''}{contrato?.periodoReferencia ? ` · ${contrato.periodoReferencia}` : ''}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-[10px]">
              <thead>
                <tr className="text-[#3f3f3f] uppercase tracking-wider">
                  <th className="text-left pb-1 font-semibold">Serviço</th>
                  <th className="text-right pb-1 font-semibold">Contratada</th>
                  <th className="text-right pb-1 font-semibold">Preço ef.</th>
                  <th className="text-right pb-1 font-semibold">Medido</th>
                  <th className="text-right pb-1 font-semibold">Saldo</th>
                  <th className="text-right pb-1 font-semibold">V. bruto</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => {
                  const c = calcServico(s, medidoAuto)
                  const isOverride = s.qtdMedidaOverride != null
                  return (
                    <tr key={s.id} className="border-t border-[#3d3d3d]">
                      <td className="py-1 pr-2 text-[#f5f5f5]">{s.descricao || '—'}</td>
                      <td className="py-1 text-right font-mono text-[#a3a3a3]">{num(s.qtdContrato)} {s.unidade}</td>
                      <td className="py-1 text-right font-mono text-[#a3a3a3]">{brl(c.precoEfetivo)}</td>
                      <td className="py-1 text-right font-mono text-[#f5f5f5]" title={isOverride ? 'ajuste manual' : 'auto dos RDOs'}>{num(c.medido)}{isOverride ? ' *' : ''}</td>
                      <td className={`py-1 text-right font-mono font-bold ${c.saldo < 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>{num(c.saldo)}</td>
                      <td className="py-1 text-right font-mono text-[#f59e0b]">{brl(c.valorBruto)}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-[#525252] font-bold">
                  <td className="py-1 text-[#f5f5f5]" colSpan={4}>TOTAL (R$) · contrato {brl(tot.valorContrato)}</td>
                  <td className="py-1 text-right text-[#22c55e] font-mono" title="saldo (R$)">{brl(tot.saldo)}</td>
                  <td className="py-1 text-right text-[#f59e0b] font-mono" title="medido bruto (R$)">{brl(tot.medidoBruto)}</td>
                </tr>
                {tot.descontoNfPct > 0 && (
                  <>
                    <tr className="text-[#6b6b6b]">
                      <td className="py-0.5 text-right" colSpan={5}>− NF materiais ({num(tot.descontoNfPct)}%)</td>
                      <td className="py-0.5 text-right font-mono text-[#ef4444]">{brl(-tot.descontoNf)}</td>
                    </tr>
                    <tr className="font-bold">
                      <td className="py-0.5 text-right text-[#f5f5f5]" colSpan={5}>MEDIDO LÍQUIDO (R$)</td>
                      <td className="py-0.5 text-right font-mono text-[#22c55e]">{brl(tot.medidoLiquido)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-[#3f3f3f]">Medido = Σ produções dos RDOs Compizzo finalizados desta obra (vínculo por serviço). "*" = ajuste manual. Esses serviços aparecem no RDO Compizzo da obra.</p>
        </>
      )}
    </div>
  )
}

// ─── sub-componentes ──────────────────────────────────────────────────────────
function SectionShell({ children, onSave, onCancel }: { children: React.ReactNode; onSave: () => void; onCancel: () => void }) {
  return (
    <div className="px-4 py-3 border-b border-[#525252] flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[#6b6b6b]"><FileSpreadsheet size={12} /><span className="text-[10px] uppercase tracking-widest font-semibold">Contrato & Medição — edição</span></div>
        <div className="flex items-center gap-1">
          <button onClick={onSave} className="flex items-center gap-1 rounded-lg bg-[#f97316] px-2.5 py-1 text-[10px] text-white hover:bg-[#ea580c]"><Save size={11} /> Salvar</button>
          <button onClick={onCancel} className="rounded-lg px-2 py-1 text-[10px] text-[#a3a3a3] hover:bg-[#3d3d3d]"><X size={12} /></button>
        </div>
      </div>
      {children}
    </div>
  )
}
function Field({ label, v, on, num }: { label: string; v?: string; on: (x: string) => void; num?: boolean }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wider text-[#6b6b6b]">{label}</span>
      <input className={num ? numCls : inCls} inputMode={num ? 'decimal' : undefined} value={v ?? ''} onChange={(e) => on(e.target.value)} />
    </label>
  )
}
function NumBox({ label, v, on }: { label: string; v?: number; on: (x: string) => void }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-wider text-[#6b6b6b]">{label}</span>
      <input className={numCls} inputMode="decimal" value={v != null ? String(v) : ''} onChange={(e) => on(e.target.value)} placeholder="0" />
    </label>
  )
}
