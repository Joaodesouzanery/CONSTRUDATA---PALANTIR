/**
 * HistoricoPanel — list of all boletins de medição.
 * Allows opening, duplicating, and deleting past boletins.
 */
import { useState } from 'react'
import { Plus, FolderOpen, Copy, Trash2 } from 'lucide-react'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'

function fmtBRL(n: number) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function StatusBadge({ status }: { status: 'rascunho' | 'em_conferencia' | 'finalizado' }) {
  if (status === 'finalizado')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Finalizado</span>
  if (status === 'em_conferencia')
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">Em Conferência</span>
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#525252]/50 text-[#a3a3a3] border border-[#525252]">Rascunho</span>
}

function NewBoletimModal({ onClose }: { onClose: () => void }) {
  const { createBoletim } = useMedicaoBillingStore()
  const [periodo,   setPeriodo]   = useState('')
  const [contrato,  setContrato]  = useState('11481051')
  const [consorcio, setConsorcio] = useState('SE LIGA NA REDE - SANTOS')

  function handleCreate() {
    if (!periodo.trim()) return
    createBoletim(periodo.trim(), contrato.trim(), consorcio.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
          <span className="text-white font-semibold text-sm">Novo Boletim de Medição</span>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Período de Medição *</label>
            <input autoFocus value={periodo} onChange={(e) => setPeriodo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="ex.: mar/26"
              className="w-full bg-[#1f1f1f] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Número do Contrato</label>
            <input value={contrato} onChange={(e) => setContrato(e.target.value)}
              className="w-full bg-[#1f1f1f] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Consórcio / Empresa</label>
            <input value={consorcio} onChange={(e) => setConsorcio(e.target.value)}
              className="w-full bg-[#1f1f1f] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
          <button onClick={handleCreate} disabled={!periodo.trim()}
            className="px-5 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
            style={{ backgroundColor: '#f97316' }}>
            Criar Boletim
          </button>
        </div>
      </div>
    </div>
  )
}

export function HistoricoPanel({ onOpenBoletim }: { onOpenBoletim: () => void }) {
  const { boletins, setActiveBoletim, removeBoletim, createBoletim } = useMedicaoBillingStore()
  const [newOpen, setNewOpen] = useState(false)

  const sorted = [...boletins].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  function handleOpen(id: string) {
    setActiveBoletim(id)
    onOpenBoletim()
  }

  function handleDuplicate(id: string) {
    const src = boletins.find((b) => b.id === id)
    if (!src) return
    const newId = createBoletim(`${src.periodo} (cópia)`, src.contrato, src.consorcio)
    // Copy items from source to new boletim (via store's importItensContrato)
    const { importItensContrato, importFornecedores } = useMedicaoBillingStore.getState()
    importItensContrato(src.itensContrato.map(({ id: _id, ...rest }) => rest), true)
    importFornecedores(src.fornecedores.map(({ id: _id, ...rest }) => rest), true)
    setActiveBoletim(newId)
    onOpenBoletim()
  }

  function handleDelete(id: string) {
    if (window.confirm('Excluir este boletim permanentemente?')) {
      removeBoletim(id)
    }
  }

  return (
    <div className="p-6 space-y-5 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">Histórico de Medições</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">{boletins.length} boletim{boletins.length !== 1 ? 's' : ''} registrado{boletins.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: '#f97316' }}
        >
          <Plus size={14} />
          Novo Boletim
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-[#6b6b6b] text-sm">
          Nenhum boletim criado ainda.
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border border-[#525252]">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#1f1f1f] text-[#a3a3a3] uppercase tracking-wider text-[10px]">
                <th className="px-4 py-2.5 text-left">Período</th>
                <th className="px-4 py-2.5 text-left">Contrato</th>
                <th className="px-4 py-2.5 text-left">Consórcio</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5 text-right">Itens</th>
                <th className="px-4 py-2.5 text-right">Total Período</th>
                <th className="px-4 py-2.5 text-center">Criado em</th>
                <th className="px-4 py-2.5 w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]">
              {sorted.map((b) => {
                const totalPeriodo = b.itensContrato.reduce((s, i) => s + i.qtdMedida * i.valorUnitario, 0)
                return (
                  <tr key={b.id} className="hover:bg-white/[0.02] group">
                    <td className="px-4 py-3 text-white font-semibold">{b.periodo}</td>
                    <td className="px-4 py-3 text-[#a3a3a3] font-mono">{b.contrato}</td>
                    <td className="px-4 py-3 text-[#a3a3a3] max-w-[200px] truncate">{b.consorcio}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={b.status} /></td>
                    <td className="px-4 py-3 text-right text-[#a3a3a3]">{b.itensContrato.length}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-400 tabular-nums">{totalPeriodo > 0 ? fmtBRL(totalPeriodo) : '—'}</td>
                    <td className="px-4 py-3 text-center text-[#6b6b6b]">{new Date(b.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleOpen(b.id)}
                          title="Abrir"
                          className="p-1.5 rounded text-[#a3a3a3] hover:bg-[#f97316]/10 hover:text-[#f97316] transition-colors"
                        >
                          <FolderOpen size={13} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(b.id)}
                          title="Duplicar"
                          className="p-1.5 rounded text-[#a3a3a3] hover:bg-white/10 hover:text-white transition-colors"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(b.id)}
                          title="Excluir"
                          className="p-1.5 rounded text-[#a3a3a3] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {newOpen && <NewBoletimModal onClose={() => { setNewOpen(false); if (boletins.length > 0) onOpenBoletim() }} />}
    </div>
  )
}
