/**
 * FornecedoresPanel — Step 4: Planilhas dos Fornecedores.
 *
 * Add/edit supplier billing (e.g., WERT AMBIENTAL - R$ 86.200,00 fev/26).
 */
import { useState } from 'react'
import { Plus, Trash2, Package } from 'lucide-react'
import { useMedicaoBillingStore } from '@/store/medicaoBillingStore'
import type { Fornecedor } from '@/store/medicaoBillingStore'

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

interface AddFornecedorFormProps {
  onAdd:   (f: Omit<Fornecedor, 'id'>) => void
  periodo: string
}

function AddFornecedorForm({ onAdd, periodo }: AddFornecedorFormProps) {
  const [open, setOpen] = useState(false)
  const [nome,         setNome]         = useState('')
  const [per,          setPer]          = useState(periodo)
  const [descricao,    setDescricao]    = useState('')
  const [valorAprovado, setValorAprovado] = useState('')

  function handleAdd() {
    if (!nome.trim()) return
    onAdd({
      nome:          nome.trim(),
      periodo:       per.trim(),
      descricao:     descricao.trim(),
      valorAprovado: parseFloat(valorAprovado.replace(',', '.')) || 0,
    })
    setNome(''); setDescricao(''); setValorAprovado('')
    setOpen(false)
  }

  return (
    <div className="border border-dashed border-[#525252] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[#f97316] hover:bg-[#f97316]/5 transition-colors"
      >
        <Plus size={15} />
        Adicionar fornecedor
      </button>
      {open && (
        <div className="p-4 border-t border-[#525252] bg-[#1f1f1f] grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Nome / Empresa</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: WERT AMBIENTAL"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Período</label>
            <input value={per} onChange={(e) => setPer(e.target.value)} placeholder="fev/26"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Descrição dos Serviços</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Descreva os trabalhos executados e aprovados…"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316] resize-none" />
          </div>
          <div>
            <label className="text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1">Valor Aprovado (R$)</label>
            <input value={valorAprovado} onChange={(e) => setValorAprovado(e.target.value)}
              placeholder="86.200,00"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]" />
          </div>
          <div className="flex items-end justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">
              Cancelar
            </button>
            <button onClick={handleAdd} disabled={!nome.trim()}
              className="px-4 py-1.5 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#f97316' }}>
              Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function FornecedoresPanel() {
  const { getActiveBoletim, addFornecedor, removeFornecedor } = useMedicaoBillingStore()
  const boletim = getActiveBoletim()

  if (!boletim) return (
    <div className="p-8 text-center text-[#6b6b6b] text-sm">Nenhum boletim ativo.</div>
  )

  const totalAprovado = boletim.fornecedores.reduce((s, f) => s + f.valorAprovado, 0)

  return (
    <div className="p-6 space-y-4 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-base">Planilhas dos Fornecedores</h2>
          <p className="text-[#a3a3a3] text-xs mt-0.5">
            {boletim.fornecedores.length} fornecedores · Período: {boletim.periodo}
          </p>
        </div>
        {boletim.fornecedores.length > 0 && (
          <div className="text-right">
            <div className="text-[10px] text-[#a3a3a3]">Total fornecedores</div>
            <div className="text-blue-400 font-bold text-base">{fmt(totalAprovado)}</div>
          </div>
        )}
      </div>

      {boletim.fornecedores.length === 0 && (
        <div className="py-12 text-center text-[#6b6b6b] text-sm">
          <Package size={32} className="mx-auto mb-3 text-[#525252]" />
          Nenhum fornecedor adicionado ainda.
        </div>
      )}

      <div className="space-y-3">
        {boletim.fornecedores.map((f) => (
          <div key={f.id} className="bg-[#2c2c2c] border border-[#525252] rounded-xl px-4 py-4 flex items-start gap-4">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Package size={17} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-white font-semibold text-sm">{f.nome}</div>
                  <div className="text-[#a3a3a3] text-xs">{f.periodo}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-blue-400 font-bold text-sm">{fmt(f.valorAprovado)}</div>
                  <div className="text-[10px] text-[#6b6b6b]">aprovado</div>
                </div>
              </div>
              {f.descricao && (
                <p className="text-[#a3a3a3] text-xs mt-2 leading-relaxed">{f.descricao}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeFornecedor(f.id)}
              className="text-red-400 hover:bg-red-900/20 rounded p-1 transition-colors shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <AddFornecedorForm onAdd={addFornecedor} periodo={boletim.periodo} />
    </div>
  )
}
