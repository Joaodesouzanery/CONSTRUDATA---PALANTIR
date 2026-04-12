/**
 * MedicaoFinalPanel — Step 6: Medição Final.
 *
 * Summary of the billing period: totals, subcontractors, suppliers, balance.
 * Generates a printable Boletim de Medição.
 */
import { useState } from 'react'
import { Calculator, Printer, CheckCircle, FileDown, Lock } from 'lucide-react'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import { exportMedicaoFinalPdf } from '../utils/exportPdf'

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(val: number, total: number) {
  if (total === 0) return '0,0%'
  return ((val / total) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

function Row({ label, value, highlight = false, negative = false }: {
  label: string; value: number; highlight?: boolean; negative?: boolean
}) {
  return (
    <div className={`flex items-center justify-between px-5 py-3 border-b border-[#525252] ${highlight ? 'bg-[#f97316]/5' : ''}`}>
      <span className={`text-sm ${highlight ? 'text-white font-semibold' : 'text-[#a3a3a3]'}`}>{label}</span>
      <span className={`font-bold ${
        highlight     ? 'text-[#f97316] text-base' :
        negative      ? 'text-red-400' :
        value < 0     ? 'text-red-400' :
        'text-[#f5f5f5]'
      }`}>
        {fmt(value)}
      </span>
    </div>
  )
}

export function MedicaoFinalPanel() {
  const { getActiveBoletim, computeMedicaoFinal, fecharBoletim } = useMedicaoBillingStore()
  const boletim = getActiveBoletim()
  const [showFecharConfirm, setShowFecharConfirm] = useState(false)

  if (!boletim) return (
    <div className="p-8 text-center text-[#6b6b6b] text-sm">Nenhum boletim ativo.</div>
  )

  const mf = boletim.medicaoFinal

  function handlePrint() {
    window.print()
  }

  return (
    <div className="p-6 space-y-6 max-w-[800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-white font-semibold text-base">Medição Final</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">
            Boletim de Medição · Contrato {boletim.contrato} · {boletim.consorcio} · {boletim.periodo}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!mf && (
            <button
              type="button"
              onClick={computeMedicaoFinal}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: '#f97316' }}
            >
              <Calculator size={15} />
              Gerar Medição Final
            </button>
          )}
          {mf && (
            <>
              <button
                type="button"
                onClick={computeMedicaoFinal}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
              >
                Recalcular
              </button>
              <button
                type="button"
                onClick={() => exportMedicaoFinalPdf(boletim)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
              >
                <FileDown size={15} />
                Exportar PDF
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: '#f97316' }}
              >
                <Printer size={15} />
                Imprimir Boletim
              </button>
              {boletim.status !== 'finalizado' && (
                <button
                  type="button"
                  onClick={() => setShowFecharConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
                >
                  <Lock size={15} />
                  Fechar Boletim
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Fechar Boletim confirmation */}
      {showFecharConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setShowFecharConfirm(false)}>
          <div className="w-full max-w-md bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252]">
              <span className="text-white font-semibold text-sm">Fechar Boletim — {boletim.periodo}</span>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-[#a3a3a3] text-sm">
                Ao fechar este boletim, o sistema irá:
              </p>
              <ul className="text-[#f5f5f5] text-sm space-y-1.5 ml-4 list-disc">
                <li>Transferir <strong>Qtd Acumulada</strong> para <strong>Qtd Anterior</strong></li>
                <li>Zerar a <strong>Qtd Período</strong> de todos os itens</li>
                <li>Marcar o boletim como <strong>Finalizado</strong></li>
              </ul>
              <p className="text-amber-400 text-xs mt-2">
                O próximo período de medição partirá dos valores acumulados atuais.
              </p>
            </div>
            <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
              <button onClick={() => setShowFecharConfirm(false)} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
              <button
                onClick={() => { fecharBoletim(); setShowFecharConfirm(false) }}
                className="px-5 py-2 text-xs font-medium text-white rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors"
              >
                Confirmar e Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {!mf ? (
        <div className="py-16 text-center">
          <Calculator size={36} className="mx-auto mb-4 text-[#525252]" />
          <p className="text-[#6b6b6b] text-sm">
            Clique em <strong className="text-[#f97316]">Gerar Medição Final</strong> para calcular o resumo financeiro do período.
          </p>
        </div>
      ) : (
        <>
          {/* Status */}
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-900/20 border border-emerald-700/40 text-emerald-300 text-sm">
            <CheckCircle size={16} />
            <span className="font-medium">Medição finalizada</span>
            <span className="text-xs text-emerald-400/70 ml-auto">
              Gerado em {new Date(mf.geradoEm).toLocaleString('pt-BR')}
            </span>
          </div>

          {/* Resumo financeiro */}
          <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
            <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252]">
              <h3 className="text-white font-semibold text-sm uppercase tracking-wide">Resumo Financeiro</h3>
            </div>

            <Row label="Valor total do contrato" value={mf.totalContratoValor} />
            <Row label={`Medição do período (${boletim.periodo})`} value={mf.totalMedidoPeriodo} highlight />
            <Row label="Total acumulado" value={mf.totalAcumulado} />

            <div className="px-5 py-2 bg-[#1f1f1f]">
              <div className="text-[10px] font-semibold uppercase text-[#6b6b6b] tracking-widest">Comprometimentos</div>
            </div>

            <Row label="Total subempreiteiros (aprovado)" value={mf.totalSubempreiteiros} negative />
            <Row label="Total fornecedores (aprovado)" value={mf.totalFornecedores} negative />

            <div className={`flex items-center justify-between px-5 py-4 ${
              mf.saldoContratante >= 0 ? 'bg-emerald-900/20' : 'bg-red-900/20'
            }`}>
              <span className="text-white font-bold">Saldo do Contratante</span>
              <span className={`text-xl font-black ${mf.saldoContratante >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(mf.saldoContratante)}
              </span>
            </div>
          </div>

          {/* Proporções */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Subempreiteiros', value: mf.totalSubempreiteiros, color: 'text-[#f97316]', bg: 'bg-[#f97316]/10 border-[#f97316]/30' },
              { label: 'Fornecedores',    value: mf.totalFornecedores,    color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/30' },
              { label: 'Saldo',           value: mf.saldoContratante,     color: mf.saldoContratante >= 0 ? 'text-emerald-400' : 'text-red-400', bg: 'bg-emerald-400/5 border-[#525252]' },
            ].map((item) => (
              <div key={item.label} className={`rounded-xl border p-4 ${item.bg}`}>
                <div className="text-[10px] font-semibold uppercase text-[#a3a3a3] tracking-wider mb-1">{item.label}</div>
                <div className={`text-lg font-bold ${item.color}`}>{fmt(item.value)}</div>
                <div className="text-[10px] text-[#6b6b6b] mt-0.5">
                  {pct(Math.abs(item.value), mf.totalMedidoPeriodo)} da medição
                </div>
              </div>
            ))}
          </div>

          {/* Itens detalhados (para impressão) */}
          <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
            <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252]">
              <h3 className="text-white font-semibold text-sm uppercase tracking-wide">Itens do Período</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#1f1f1f] text-[#a3a3a3] text-[9px] uppercase">
                    <th className="px-3 py-2 text-left border-r border-[#525252]">Nº Preço</th>
                    <th className="px-3 py-2 text-left border-r border-[#525252]">Descrição</th>
                    <th className="px-3 py-2 text-center border-r border-[#525252]">Un</th>
                    <th className="px-3 py-2 text-right border-r border-[#525252]">Qtd</th>
                    <th className="px-3 py-2 text-right border-r border-[#525252]">Vl. Unit.</th>
                    <th className="px-3 py-2 text-right">Vl. Período</th>
                  </tr>
                </thead>
                <tbody>
                  {boletim.itensContrato
                    .filter((i) => i.qtdMedida > 0)
                    .map((item) => (
                    <tr key={item.id} className="border-b border-[#525252]">
                      <td className="px-3 py-2 border-r border-[#525252] font-mono text-[#f97316]">{item.nPreco}</td>
                      <td className="px-3 py-2 border-r border-[#525252] text-[#f5f5f5]">{item.descricao}</td>
                      <td className="px-3 py-2 border-r border-[#525252] text-center text-[#a3a3a3]">{item.unidade}</td>
                      <td className="px-3 py-2 border-r border-[#525252] text-right">{item.qtdMedida.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 border-r border-[#525252] text-right">{fmt(item.valorUnitario)}</td>
                      <td className="px-3 py-2 text-right font-medium text-emerald-400">{fmt(item.qtdMedida * item.valorUnitario)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1f1f1f]">
                    <td colSpan={5} className="px-3 py-2 text-right text-xs font-bold text-[#a3a3a3] border-r border-[#525252]">
                      Total do período
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-[#f97316]">
                      {fmt(mf.totalMedidoPeriodo)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
