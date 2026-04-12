/**
 * ConferenciaPanel — Step 5: Conferência.
 *
 * Auto-computed cross-check: for each contract item (nPreco),
 * compares Sabesp qty vs. sum of subcontractor qtys.
 * Flags divergências. Allows manual observações.
 */
import { useState } from 'react'
import { CheckCircle, AlertTriangle, Clock, RefreshCw, FileDown, BookOpen, ChevronDown } from 'lucide-react'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import type { ConferenciaItem } from '@/store/medicaoBillingStore'
import { exportConferenciaPdf } from '../utils/exportPdf'
import { getAllCriterios } from '../data/criterios'

function StatusBadge({ status }: { status: ConferenciaItem['status'] }) {
  if (status === 'ok') return (
    <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
      <CheckCircle size={13} /> OK
    </span>
  )
  if (status === 'divergencia') return (
    <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
      <AlertTriangle size={13} /> Divergência
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
      <Clock size={13} /> Pendente
    </span>
  )
}

function CriterioPopover({ nPreco }: { nPreco: string }) {
  const [open, setOpen] = useState(false)
  const criterio = getAllCriterios().find((c) => c.nPreco === nPreco)

  if (!criterio) return (
    <span className="text-[#6b6b6b] text-[10px] italic">Critério não localizado</span>
  )

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[#f97316] hover:text-[#ea580c] text-[10px] font-medium transition-colors"
      >
        <BookOpen size={10} />
        {open ? 'Fechar' : 'Ver critério'}
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 left-0 top-6 w-96 bg-[#1f1f1f] border border-[#525252] rounded-lg shadow-2xl p-3 space-y-2">
          <div>
            <span className="text-[9px] text-[#f97316] font-bold uppercase">Compreende</span>
            <p className="text-[10px] text-[#a3a3a3] leading-relaxed">{criterio.compreende}</p>
          </div>
          <div>
            <span className="text-[9px] text-[#4ade80] font-bold uppercase">Medição</span>
            <p className="text-[10px] text-[#f5f5f5] font-medium">{criterio.medicao}</p>
          </div>
          {criterio.notas && (
            <div>
              <span className="text-[9px] text-[#fbbf24] font-bold uppercase">Notas</span>
              <p className="text-[10px] text-[#a3a3a3]">{criterio.notas}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ConferenciaPanel() {
  const {
    getActiveBoletim,
    computeConferencia,
    updateConferenciaObservacao,
  } = useMedicaoBillingStore()

  const boletim = getActiveBoletim()
  if (!boletim) return (
    <div className="p-8 text-center text-[#6b6b6b] text-sm">Nenhum boletim ativo.</div>
  )

  const conf = boletim.conferencia
  const nOk         = conf.filter((c) => c.status === 'ok').length
  const nDivergencia = conf.filter((c) => c.status === 'divergencia').length
  const nPendente    = conf.filter((c) => c.status === 'pendente').length

  // Financial validation
  const totalMedidoSabesp = boletim.itensContrato.reduce((s, it) => s + it.qtdMedida * it.valorUnitario, 0)
  const totalSubempreiteiros = boletim.subempreiteiros.reduce((s, sub) => s + sub.totalAprovado, 0)
  const totalFornecedores = boletim.fornecedores.reduce((s, f) => s + f.valorAprovado, 0)
  const totalTerceiros = totalSubempreiteiros + totalFornecedores
  const margemBruta = totalMedidoSabesp - totalTerceiros
  const margemPct = totalMedidoSabesp > 0 ? (margemBruta / totalMedidoSabesp) * 100 : 0
  const terceirosExcedem = totalTerceiros > totalMedidoSabesp && totalMedidoSabesp > 0

  // Check if each nPreco has a matching criterio
  const nCriteriosEncontrados = conf.filter((c) => getAllCriterios().some((cr) => cr.nPreco === c.nPreco)).length

  // Check for negative balance (quantity exceeds contract)
  const negSaldoCount = boletim.itensContrato.filter(
    (i) => (i.qtdContrato - i.qtdAcumulada - i.qtdMedida) < 0
  ).length

  return (
    <div className="p-6 space-y-5 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-white font-semibold text-base">Conferência</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">
            Comparativo Sabesp × Subempreiteiros · Período: {boletim.periodo}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {conf.length > 0 && (
            <>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle size={13} /> {nOk} OK
              </span>
              <span className="flex items-center gap-1.5 text-xs text-red-400">
                <AlertTriangle size={13} /> {nDivergencia} divergências
              </span>
              <span className="flex items-center gap-1.5 text-xs text-amber-400">
                <Clock size={13} /> {nPendente} pendentes
              </span>
            </>
          )}
          {conf.length > 0 && (
            <button
              type="button"
              onClick={() => exportConferenciaPdf(conf, boletim.periodo, boletim.contrato, boletim)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
            >
              <FileDown size={13} />
              Exportar PDF
            </button>
          )}
          <button
            type="button"
            onClick={computeConferencia}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#f97316' }}
          >
            <RefreshCw size={14} />
            {conf.length === 0 ? 'Calcular Conferência' : 'Recalcular'}
          </button>
        </div>
      </div>

      {/* Financial validation summary */}
      {conf.length > 0 && (
        <div className="space-y-3">
          {/* Financial cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border rounded-xl p-3 bg-[#3d3d3d] border-[#525252]">
              <p className="text-[#6b6b6b] text-[10px] uppercase">Medido Sabesp</p>
              <p className="text-[#f5f5f5] text-lg font-bold tabular-nums">
                {totalMedidoSabesp.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="border rounded-xl p-3 bg-[#f97316]/10 border-[#f97316]/30">
              <p className="text-[#6b6b6b] text-[10px] uppercase">Terceiros (Sub+Forn)</p>
              <p className="text-[#f97316] text-lg font-bold tabular-nums">
                {totalTerceiros.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className={`border rounded-xl p-3 ${margemBruta >= 0 ? 'bg-[#16a34a]/10 border-[#16a34a]/30' : 'bg-[#dc2626]/10 border-[#dc2626]/30'}`}>
              <p className="text-[#6b6b6b] text-[10px] uppercase">Margem Bruta</p>
              <p className={`text-lg font-bold tabular-nums ${margemBruta >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                {margemBruta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
              </p>
              <p className="text-[10px] text-[#6b6b6b]">{margemPct.toFixed(1)}%</p>
            </div>
            <div className="border rounded-xl p-3 bg-[#3d3d3d] border-[#525252]">
              <p className="text-[#6b6b6b] text-[10px] uppercase">Critérios Vinculados</p>
              <p className="text-[#f5f5f5] text-lg font-bold tabular-nums">{nCriteriosEncontrados}/{conf.length}</p>
            </div>
          </div>

          {/* Checklist de conferência */}
          <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4">
            <p className="text-[10px] text-[#f97316] font-bold uppercase mb-2">Checklist de Conferência</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                {!terceirosExcedem ? <CheckCircle size={13} className="text-[#4ade80]" /> : <AlertTriangle size={13} className="text-[#f87171]" />}
                <span className={!terceirosExcedem ? 'text-[#a3a3a3]' : 'text-[#f87171] font-medium'}>
                  Terceiros {terceirosExcedem ? 'EXCEDEM' : 'dentro do'} valor medido Sabesp
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {nDivergencia === 0 ? <CheckCircle size={13} className="text-[#4ade80]" /> : <AlertTriangle size={13} className="text-[#fbbf24]" />}
                <span className="text-[#a3a3a3]">
                  {nDivergencia === 0 ? 'Nenhuma divergência de quantidade' : `${nDivergencia} divergência(s) de quantidade`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {nCriteriosEncontrados === conf.length ? <CheckCircle size={13} className="text-[#4ade80]" /> : <AlertTriangle size={13} className="text-[#fbbf24]" />}
                <span className="text-[#a3a3a3]">
                  {nCriteriosEncontrados === conf.length ? 'Todos os nPreço possuem critério vinculado' : `${conf.length - nCriteriosEncontrados} item(ns) sem critério localizado`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {negSaldoCount === 0 ? <CheckCircle size={13} className="text-[#4ade80]" /> : <AlertTriangle size={13} className="text-[#f87171]" />}
                <span className={negSaldoCount === 0 ? 'text-[#a3a3a3]' : 'text-[#f87171] font-medium'}>
                  {negSaldoCount === 0 ? 'Nenhum item com saldo negativo' : `${negSaldoCount} item(ns) com saldo negativo (qtd excede contrato)`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {conf.length === 0 ? (
        <div className="py-16 text-center">
          <RefreshCw size={36} className="mx-auto mb-4 text-[#525252]" />
          <p className="text-[#6b6b6b] text-sm">
            Clique em <strong className="text-[#f97316]">Calcular Conferência</strong> para comparar automaticamente
            as quantidades da Planilha Sabesp com as dos Subempreiteiros.
          </p>
          {boletim.itensContrato.length === 0 && (
            <p className="text-amber-400/70 text-xs mt-2">⚠ Adicione itens na Planilha Sabesp (Passo 1) primeiro.</p>
          )}
        </div>
      ) : (
        <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#1f1f1f] text-[#a3a3a3] text-[10px] uppercase">
                  <th className="px-3 py-2 text-left border-r border-[#525252] w-24">Nº Preço</th>
                  <th className="px-3 py-2 text-left border-r border-[#525252]">Descrição</th>
                  <th className="px-3 py-2 text-center border-r border-[#525252] w-12">Un</th>
                  <th className="px-3 py-2 text-right border-r border-[#525252] w-28">Qtd Sabesp</th>
                  <th className="px-3 py-2 text-right border-r border-[#525252] w-28">Qtd Subempreit.</th>
                  <th className="px-3 py-2 text-right border-r border-[#525252] w-24">Diferença</th>
                  <th className="px-3 py-2 text-center border-r border-[#525252] w-28">Status</th>
                  <th className="px-3 py-2 text-left w-40">Observação</th>
                  <th className="px-3 py-2 text-left w-28">Critério</th>
                </tr>
              </thead>
              <tbody>
                {conf.map((c) => (
                  <tr
                    key={c.nPreco}
                    className={`border-b border-[#525252] ${
                      c.status === 'divergencia' ? 'bg-red-950/20' :
                      c.status === 'ok'          ? '' :
                      'bg-amber-950/10'
                    }`}
                  >
                    <td className="px-3 py-2 border-r border-[#525252] font-mono text-[#f97316] text-xs">{c.nPreco}</td>
                    <td className="px-3 py-2 border-r border-[#525252] text-[#f5f5f5] text-xs">{c.descricao}</td>
                    <td className="px-3 py-2 border-r border-[#525252] text-center text-[#a3a3a3] text-xs">{c.unidade}</td>
                    <td className="px-3 py-2 border-r border-[#525252] text-right text-[#f5f5f5] font-mono text-xs">
                      {c.qtdSabesp.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 border-r border-[#525252] text-right text-[#f5f5f5] font-mono text-xs">
                      {c.qtdSubempreiteiros.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-3 py-2 border-r border-[#525252] text-right font-mono font-bold text-xs ${
                      Math.abs(c.diferenca) < 0.001 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {c.diferenca > 0 ? '+' : ''}{c.diferenca.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2 border-r border-[#525252] text-center">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={c.observacao}
                        onChange={(e) => updateConferenciaObservacao(c.nPreco, e.target.value)}
                        placeholder="Obs…"
                        className="w-full bg-transparent text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:bg-[#3a3a3a] rounded px-1 py-0.5"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <CriterioPopover nPreco={c.nPreco} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
