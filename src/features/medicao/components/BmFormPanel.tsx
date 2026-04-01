/**
 * BmFormPanel — Boletim de Medição creation, editing and history.
 */
import { useState } from 'react'
import { Plus, Save, Download, Trash2, CheckCircle2, Clock, ChevronRight } from 'lucide-react'
import { useMedicaoStore } from '@/store/medicaoStore'
import type { BoletimMedicao, MedicaoServico } from '@/types'
import { OBRAS_LIST } from '@/types'

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function makeDefaultBm(): Omit<BoletimMedicao, 'id' | 'numero' | 'createdAt'> {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'
  return {
    obra: OBRAS_LIST[0],
    periodoInicio: firstOfMonth,
    periodoFim: today,
    dataEmissao: today,
    itens: [],
    valorTotal: 0,
    status: 'rascunho',
    observacoes: '',
  }
}

const inp = 'w-full bg-[#1a1a1a] border border-[#525252] rounded px-2 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50'

export function BmFormPanel() {
  const { boletins, activeBmId, addBoletim, removeBoletim, setActiveBm, importFromQuantitativos } = useMedicaoStore()
  const [form, setForm] = useState<Omit<BoletimMedicao, 'id' | 'numero' | 'createdAt'>>(makeDefaultBm)
  const [saved, setSaved] = useState(false)

  function patchForm(patch: Partial<typeof form>) {
    setSaved(false)
    setForm((prev) => {
      const updated = { ...prev, ...patch }
      updated.valorTotal = updated.itens.reduce((s, i) => s + i.qtdMesAtual * i.valorUnitario, 0)
      return updated
    })
  }

  function patchItem(id: string, field: keyof MedicaoServico, value: number | string) {
    const updated = form.itens.map((i) => {
      if (i.id !== id) return i
      const item = { ...i, [field]: value }
      item.valorTotal = item.qtdMesAtual * item.valorUnitario
      return item
    })
    patchForm({ itens: updated })
  }

  function handleImportItems() {
    const imported = importFromQuantitativos()
    patchForm({ itens: imported })
  }

  function handleSave() {
    addBoletim(form)
    setSaved(true)
    setForm(makeDefaultBm())
    setTimeout(() => setSaved(false), 3000)
  }

  function handleExportCsv(bm: BoletimMedicao) {
    const BOM = '\uFEFF'
    const header = `Boletim de Medição Nº ${bm.numero} - ${bm.obra}\r\nPeríodo: ${bm.periodoInicio} a ${bm.periodoFim}\r\nEmissão: ${bm.dataEmissao}\r\n\r\n`
    const cols = 'Código,Descrição,Un.,Qtd Medida,Valor Unit.,Valor Total\r\n'
    const rows = bm.itens.map((i) =>
      [i.codigo, `"${i.descricao}"`, i.unidade, i.qtdMesAtual, i.valorUnitario.toFixed(2), i.valorTotal.toFixed(2)].join(',')
    ).join('\r\n')
    const footer = `\r\n\r\nVALOR TOTAL,,,,,${bm.valorTotal.toFixed(2)}`
    const blob = new Blob([BOM + header + cols + rows + footer], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `BM-${String(bm.numero).padStart(3, '0')}-${bm.obra.replace(/\s+/g, '-')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="flex gap-4 h-full overflow-hidden p-4">

      {/* ── Form ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">

        {/* Identification */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Identificação do BM</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-[10px] text-[#6b6b6b] mb-1">Obra</label>
              <select value={form.obra} onChange={(e) => patchForm({ obra: e.target.value })} className={inp}>
                {OBRAS_LIST.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] mb-1">Período — Início</label>
              <input type="date" value={form.periodoInicio} onChange={(e) => patchForm({ periodoInicio: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] mb-1">Período — Fim</label>
              <input type="date" value={form.periodoFim} onChange={(e) => patchForm({ periodoFim: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] mb-1">Data de Emissão</label>
              <input type="date" value={form.dataEmissao} onChange={(e) => patchForm({ dataEmissao: e.target.value })} className={inp} />
            </div>
            <div>
              <label className="block text-[10px] text-[#6b6b6b] mb-1">Status</label>
              <div className="flex gap-2">
                {(['rascunho', 'emitido'] as const).map((s) => (
                  <button key={s} onClick={() => patchForm({ status: s })}
                    className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
                      form.status === s ? 'bg-[#f97316] text-white' : 'bg-[#3d3d3d] text-[#a3a3a3] hover:bg-[#525252]'
                    }`}
                  >
                    {s === 'rascunho' ? 'Rascunho' : 'Emitido'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Items */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252] flex items-center justify-between">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Itens Medidos</span>
            <button
              onClick={handleImportItems}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-[#f97316]/20 text-[#f97316] hover:bg-[#f97316]/30 transition-colors"
            >
              <Plus size={11} /> Importar do Orçamento
            </button>
          </div>
          {form.itens.length === 0 ? (
            <div className="p-6 text-center text-[#6b6b6b] text-xs">
              Clique em "Importar do Orçamento" ou adicione itens manualmente.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="bg-[#1f1f1f]">
                    {['Código', 'Descrição', 'Un.', 'Qtd Medida', 'Valor Unit.', 'Valor Total'].map((h) => (
                      <th key={h} className="px-2 py-2 text-left text-[#6b6b6b] font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.itens.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-[#2c2c2c]' : 'bg-[#252525]'}>
                      <td className="px-2 py-1.5 text-[#a3a3a3] font-mono">{item.codigo}</td>
                      <td className="px-2 py-1.5 text-[#f5f5f5] max-w-[200px] truncate" title={item.descricao}>{item.descricao}</td>
                      <td className="px-2 py-1.5 text-[#a3a3a3] text-center">{item.unidade}</td>
                      <td className="px-2 py-1.5">
                        <input type="number" min={0} step={0.01} value={item.qtdMesAtual}
                          onChange={(e) => patchItem(item.id, 'qtdMesAtual', Number(e.target.value))}
                          className="w-20 bg-[#1a1a1a] border border-[#525252] rounded px-1.5 py-0.5 text-right text-[10px] text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50" />
                      </td>
                      <td className="px-2 py-1.5 text-right text-[#a3a3a3]">{fmtBRL(item.valorUnitario)}</td>
                      <td className="px-2 py-1.5 text-right text-[#f97316] font-semibold">{fmtBRL(item.valorTotal)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#3d3d3d] border-t border-[#525252]">
                    <td colSpan={5} className="px-2 py-1.5 text-xs font-semibold text-[#f5f5f5] text-right">TOTAL DO BM</td>
                    <td className="px-2 py-1.5 text-right text-[#f97316] font-bold text-xs">{fmtBRL(form.valorTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Observations */}
        <section className="bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
          <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252]">
            <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Observações</span>
          </div>
          <div className="p-4">
            <textarea rows={3} value={form.observacoes}
              onChange={(e) => patchForm({ observacoes: e.target.value })}
              placeholder="Observações do boletim..."
              className={`${inp} resize-none`} />
          </div>
        </section>

        {/* Save */}
        <div className="flex items-center gap-3 pb-4">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#f97316] text-white text-sm font-medium hover:bg-[#ea6c0a] transition-colors"
          >
            <Save size={15} /> Salvar Boletim
          </button>
          <button
            onClick={() => setForm(makeDefaultBm())}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3d3d3d] text-[#a3a3a3] text-sm hover:bg-[#525252] hover:text-[#f5f5f5] transition-colors"
          >
            <Plus size={15} /> Novo
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-green-400 text-sm">
              <CheckCircle2 size={15} /> Boletim salvo!
            </span>
          )}
        </div>
      </div>

      {/* ── History sidebar ───────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col bg-[#2c2c2c] rounded-lg border border-[#525252] overflow-hidden">
        <div className="px-4 py-2 bg-[#3d3d3d] border-b border-[#525252] flex items-center justify-between shrink-0">
          <span className="text-xs font-semibold text-[#f97316] uppercase tracking-wide">Boletins</span>
          <span className="text-[10px] text-[#6b6b6b]">{boletins.length} BM{boletins.length !== 1 ? 's' : ''}</span>
        </div>
        {boletins.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[#6b6b6b] text-xs p-4 text-center">
            Nenhum boletim salvo ainda.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {[...boletins].reverse().map((bm) => (
              <div
                key={bm.id}
                onClick={() => setActiveBm(bm.id === activeBmId ? null : bm.id)}
                className={`flex items-center gap-2 px-3 py-2.5 border-b border-[#3d3d3d] last:border-0 cursor-pointer transition-colors group ${
                  bm.id === activeBmId ? 'bg-[#f97316]/10' : 'hover:bg-[#333333]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {bm.status === 'emitido'
                      ? <CheckCircle2 size={12} className="text-green-400 shrink-0" />
                      : <Clock size={12} className="text-yellow-400 shrink-0" />
                    }
                    <span className="text-[11px] text-[#f5f5f5] font-medium">BM #{bm.numero}</span>
                  </div>
                  <div className="text-[10px] text-[#6b6b6b] truncate">{bm.obra}</div>
                  <div className="text-[9px] text-[#525252]">
                    {bm.periodoInicio} → {bm.periodoFim}
                  </div>
                  <div className="text-[10px] text-[#f97316] font-semibold mt-0.5">{fmtBRL(bm.valorTotal)}</div>
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExportCsv(bm) }}
                    className="p-1 rounded text-[#6b6b6b] hover:text-[#f97316] transition-colors"
                    title="Exportar CSV"
                  >
                    <Download size={12} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeBoletim(bm.id) }}
                    className="p-1 rounded text-[#6b6b6b] hover:text-red-400 transition-colors"
                    title="Remover"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <ChevronRight size={12} className={`text-[#525252] shrink-0 transition-transform ${bm.id === activeBmId ? 'rotate-90 text-[#f97316]' : ''}`} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
