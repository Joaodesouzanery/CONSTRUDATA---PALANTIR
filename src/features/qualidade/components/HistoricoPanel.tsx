/**
 * HistoricoPanel — Lista de FVSs com busca, filtro de data, expansão de detalhe,
 * impressão e exclusão (com confirmação).
 * Mesma identidade visual do RDO (#2c2c2c / #f97316).
 */
import { useState, useMemo } from 'react'
import {
  Search, Printer, Trash2, ChevronDown, ChevronRight,
  ShieldCheck, AlertTriangle, FileWarning, X,
} from 'lucide-react'
import { useQualidadeStore } from '@/store/qualidadeStore'
import { printFvsPDF } from '../utils/fvsPdfExport'
import type { FVS, FvsConformity } from '@/types'

function fmtDate(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function conformityBadge(c: FvsConformity) {
  if (c === 'conforme')      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-900/50 text-emerald-300">Conforme</span>
  if (c === 'nao_conforme')  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-900/50 text-red-300">Não Conforme</span>
  if (c === 'reinspecao_ok') return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-900/50 text-blue-300">Reinsp. OK</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3a3a3a] text-[#a3a3a3]">—</span>
}

export function HistoricoPanel() {
  const { fvss, removeFvs } = useQualidadeStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return [...fvss]
      .filter((f) => {
        const term = searchTerm.toLowerCase()
        const matchSearch = !term ||
          f.responsibleLeader.toLowerCase().includes(term) ||
          f.identificationNo.toLowerCase().includes(term) ||
          f.contractNo.toLowerCase().includes(term) ||
          f.ncNumber.toLowerCase().includes(term)
        const matchDate = !dateFilter || f.date.startsWith(dateFilter)
        return matchSearch && matchDate
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [fvss, searchTerm, dateFilter])

  function summary(f: FVS) {
    const conformes    = f.items.filter((i) => i.conformity === 'conforme').length
    const naoConformes = f.items.filter((i) => i.conformity === 'nao_conforme').length
    const reinspecao   = f.items.filter((i) => i.conformity === 'reinspecao_ok').length
    return { conformes, naoConformes, reinspecao, total: f.items.length }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por líder, identificação, contrato ou NC…"
            className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg pl-10 pr-3 py-2 text-sm text-[#f5f5f5] placeholder-[#a3a3a3] focus:outline-none focus:border-[#f97316]"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
        />
        {dateFilter && (
          <button
            onClick={() => setDateFilter('')}
            className="text-[#a3a3a3] hover:text-white text-sm flex items-center gap-1"
          >
            <X size={14} /> Limpar data
          </button>
        )}
        <span className="text-xs text-[#a3a3a3] ml-auto">
          {filtered.length} de {fvss.length} FVS
        </span>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-10 text-center">
          <ShieldCheck size={32} className="text-[#525252] mx-auto mb-3" />
          <p className="text-[#a3a3a3]">Nenhuma FVS encontrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((f) => {
            const s = summary(f)
            const isExpanded = expandedId === f.id
            const isDeleting = deleteConfirm === f.id

            return (
              <div
                key={f.id}
                className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden"
              >
                {/* Row principal */}
                <div className="flex items-center gap-3 p-4 flex-wrap">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : f.id)}
                    className="text-[#a3a3a3] hover:text-white"
                  >
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>

                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#f97316]/15 text-[#f97316]">
                    #{f.number}
                  </span>

                  <div className="flex-1 min-w-[150px]">
                    <div className="text-white text-sm font-semibold truncate">
                      {f.identificationNo}
                    </div>
                    <div className="text-[#a3a3a3] text-xs">
                      {f.responsibleLeader || '—'} · Contrato {f.contractNo} · {fmtDate(f.date)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-emerald-400 font-bold" title="Conformes">{s.conformes}</span>
                    <span className="text-[#a3a3a3]">/</span>
                    <span className="text-red-400 font-bold" title="Não conformes">{s.naoConformes}</span>
                    <span className="text-[#a3a3a3]">/</span>
                    <span className="text-blue-400 font-bold" title="Reinspeção OK">{s.reinspecao}</span>
                  </div>

                  {f.ncRequired && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-900/50 text-red-300 flex items-center gap-1">
                      <FileWarning size={11} /> {f.ncNumber || 'NC'}
                    </span>
                  )}

                  <button
                    onClick={() => printFvsPDF(f)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-white rounded-lg text-xs font-medium transition-colors"
                    title="Imprimir / Exportar PDF"
                  >
                    <Printer size={13} /> PDF
                  </button>

                  {isDeleting ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { removeFvs(f.id); setDeleteConfirm(null); }}
                        className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-2.5 py-1.5 bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] rounded-lg text-xs font-medium"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(f.id)}
                      className="p-1.5 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                {/* Detalhe expandido */}
                {isExpanded && (
                  <div className="border-t border-[#525252] bg-[#1f1f1f] p-5 space-y-4">
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-[#a3a3a3] font-bold mb-2">
                        Verificação de Solda PEAD
                      </h4>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[#a3a3a3] border-b border-[#525252]">
                            <th className="text-left py-1 px-2 w-10">Item</th>
                            <th className="text-left py-1 px-2">Verificação</th>
                            <th className="text-left py-1 px-2">Critérios</th>
                            <th className="text-center py-1 px-2 w-32">Conformidade</th>
                            <th className="text-left py-1 px-2 w-24">Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.items
                            .filter((i) => i.group === 'verificacao_solda')
                            .map((i) => (
                              <tr key={i.id} className="border-b border-[#3a3a3a]">
                                <td className="py-1.5 px-2 text-[#a3a3a3] font-bold">{i.number}</td>
                                <td className="py-1.5 px-2 text-[#f5f5f5]">{i.description}</td>
                                <td className="py-1.5 px-2 text-[#a3a3a3]">{i.criteria || '—'}</td>
                                <td className="py-1.5 px-2 text-center">{conformityBadge(i.conformity)}</td>
                                <td className="py-1.5 px-2 text-[#a3a3a3]">{fmtDate(i.date ?? '')}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-[#a3a3a3] font-bold mb-2">
                        Controle de Parâmetros de Solda
                      </h4>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-[#a3a3a3] border-b border-[#525252]">
                            <th className="text-left py-1 px-2 w-10">Item</th>
                            <th className="text-left py-1 px-2">Verificação</th>
                            <th className="text-left py-1 px-2">Critérios</th>
                            <th className="text-center py-1 px-2 w-32">Conformidade</th>
                            <th className="text-left py-1 px-2 w-24">Data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.items
                            .filter((i) => i.group === 'controle_parametros')
                            .map((i) => (
                              <tr key={i.id} className="border-b border-[#3a3a3a]">
                                <td className="py-1.5 px-2 text-[#a3a3a3] font-bold">{i.number}</td>
                                <td className="py-1.5 px-2 text-[#f5f5f5]">{i.description}</td>
                                <td className="py-1.5 px-2 text-[#a3a3a3]">{i.criteria || '—'}</td>
                                <td className="py-1.5 px-2 text-center">{conformityBadge(i.conformity)}</td>
                                <td className="py-1.5 px-2 text-[#a3a3a3]">{fmtDate(i.date ?? '')}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {f.problems.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase tracking-wider text-[#a3a3a3] font-bold mb-2 flex items-center gap-1.5">
                          <AlertTriangle size={12} className="text-[#f97316]" /> Problemas e Ações
                        </h4>
                        <div className="space-y-2">
                          {f.problems.map((p) => (
                            <div key={p.id} className="bg-[#2c2c2c] rounded-lg p-3 border-l-2 border-[#f97316]">
                              <div className="text-xs text-[#a3a3a3] mb-1">Item {p.itemNumber}</div>
                              <div className="text-sm text-[#f5f5f5] mb-1"><strong>Problema:</strong> {p.description}</div>
                              <div className="text-sm text-[#e5e5e5]"><strong>Ação:</strong> {p.action}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[#a3a3a3]">Líder Responsável:</span>{' '}
                        <span className="text-[#f5f5f5] font-medium">{f.responsibleLeader || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[#a3a3a3]">Nº Rastreio da Solda:</span>{' '}
                        <span className="text-[#f5f5f5] font-medium">{f.weldTrackingNo || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[#a3a3a3]">Assinatura Soldador:</span>{' '}
                        <span className="text-[#f5f5f5] font-medium">{f.welderSignature || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[#a3a3a3]">Assinatura Resp. Qualidade:</span>{' '}
                        <span className="text-[#f5f5f5] font-medium">{f.qualitySignature || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
