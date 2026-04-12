/**
 * CriteriosMedicaoPanel — Step 2: Critérios de Medição.
 *
 * Search, view and add Sabesp measurement criteria by service code or description.
 */
import { useState, useCallback } from 'react'
import { Search, BookOpen, Plus, Trash2, X as XIcon } from 'lucide-react'
import { searchCriterios, getAllCriterios, addCustomCriterio, removeCustomCriterio, isCustomCriterio } from '../data/criterios'
import type { CriterioMedicao } from '../data/criterios'

const GRUPO_COLORS: Record<string, string> = {
  '01': 'text-amber-400 bg-amber-400/10 border-amber-500/30',
  '02': 'text-blue-400 bg-blue-400/10 border-blue-500/30',
  '03': 'text-cyan-400 bg-cyan-400/10 border-cyan-500/30',
}

function AddCriterioModal({ onClose, onAdd }: { onClose: () => void; onAdd: (c: CriterioMedicao) => void }) {
  const [nPreco, setNPreco] = useState('')
  const [descricao, setDescricao] = useState('')
  const [unidade, setUnidade] = useState('UN')
  const [grupo, setGrupo] = useState<'01' | '02' | '03'>('03')
  const [compreende, setCompreende] = useState('')
  const [medicao, setMedicao] = useState('')
  const [notas, setNotas] = useState('')

  const grupoNomes: Record<string, string> = { '01': 'Canteiros e Planos', '02': 'Esgoto', '03': 'Água' }

  function handleSubmit() {
    if (!nPreco.trim() || !descricao.trim()) return
    onAdd({
      nPreco: nPreco.trim(),
      descricao: descricao.trim(),
      unidade: unidade.trim() || 'UN',
      grupo,
      grupoNome: grupoNomes[grupo],
      compreende: compreende.trim(),
      medicao: medicao.trim(),
      notas: notas.trim(),
    })
    onClose()
  }

  const inputCls = 'w-full bg-[#1f1f1f] border border-[#525252] rounded px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]'
  const labelCls = 'text-[10px] text-[#a3a3a3] font-semibold uppercase block mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-[#2c2c2c] border border-[#525252] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#3a3a3a] px-5 py-3 border-b border-[#525252] flex items-center justify-between">
          <span className="text-white font-semibold text-sm">Adicionar Critério de Medição</span>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-white"><XIcon size={16} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Nº Preço</label>
              <input value={nPreco} onChange={(e) => setNPreco(e.target.value)} placeholder="ex.: 410002" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Unidade</label>
              <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="UN" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Grupo</label>
              <select value={grupo} onChange={(e) => setGrupo(e.target.value as '01' | '02' | '03')} className={inputCls}>
                <option value="01">01 — Canteiros e Planos</option>
                <option value="02">02 — Esgoto</option>
                <option value="03">03 — Água</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Descrição</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do serviço" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Compreende</label>
            <textarea value={compreende} onChange={(e) => setCompreende(e.target.value)} placeholder="O que o serviço compreende..." rows={4} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Medição</label>
            <textarea value={medicao} onChange={(e) => setMedicao(e.target.value)} placeholder="Como será medido..." rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Notas</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas adicionais (opcional)" rows={2} className={inputCls} />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-[#525252] flex justify-end gap-2 bg-[#1f1f1f]">
          <button onClick={onClose} className="px-4 py-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={!nPreco.trim() || !descricao.trim()}
            className="px-5 py-2 text-xs font-medium text-white rounded-lg disabled:opacity-50 transition-colors" style={{ backgroundColor: '#f97316' }}>
            Salvar Critério
          </button>
        </div>
      </div>
    </div>
  )
}

export function CriteriosMedicaoPanel() {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [ver, setVer] = useState(0) // force re-render after add/remove

  const results = searchCriterios(query)
  const allCriterios = getAllCriterios()
  const selectedCrit = allCriterios.find((c) => c.nPreco === selected)

  const handleAdd = useCallback((c: CriterioMedicao) => {
    addCustomCriterio(c)
    setSelected(c.nPreco)
    setVer((v) => v + 1)
  }, [])

  const handleRemove = useCallback((nPreco: string) => {
    removeCustomCriterio(nPreco)
    if (selected === nPreco) setSelected(null)
    setVer((v) => v + 1)
  }, [selected])

  // suppress unused var warning
  void ver

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left — search + list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-[#525252] bg-[#1f1f1f]">
        <div className="p-3 border-b border-[#525252]">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código ou descrição…"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg pl-8 pr-3 py-2 text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]"
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-[#6b6b6b]">{results.length} critérios</span>
            <button onClick={() => setAddOpen(true)} className="flex items-center gap-1 text-[10px] text-[#f97316] hover:text-[#ea580c] font-medium transition-colors">
              <Plus size={11} /> Adicionar
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.nPreco}
              type="button"
              onClick={() => setSelected(c.nPreco)}
              className={`w-full text-left px-3 py-2.5 border-b border-[#2c2c2c] transition-colors ${
                selected === c.nPreco
                  ? 'bg-[#f97316]/10 border-l-2 border-l-[#f97316]'
                  : 'hover:bg-[#2c2c2c]'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${GRUPO_COLORS[c.grupo] ?? 'text-[#a3a3a3]'}`}>
                  {c.grupo}
                </span>
                <span className="font-mono text-xs text-[#f97316] font-bold">{c.nPreco}</span>
                <span className="text-[10px] text-[#a3a3a3]">{c.unidade}</span>
                {isCustomCriterio(c.nPreco) && (
                  <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">CUSTOM</span>
                )}
              </div>
              <div className="text-xs text-[#f5f5f5] leading-tight line-clamp-2">{c.descricao}</div>
            </button>
          ))}
          {results.length === 0 && (
            <div className="p-6 text-center text-xs text-[#6b6b6b] italic">
              Nenhum critério encontrado para "{query}"
            </div>
          )}
        </div>
      </div>

      {/* Right — detail view */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedCrit ? (
          <div className="max-w-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#f97316' }}>
                <BookOpen size={22} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${GRUPO_COLORS[selectedCrit.grupo] ?? ''}`}>
                    Grupo {selectedCrit.grupo} — {selectedCrit.grupoNome}
                  </span>
                  <span className="text-xs text-[#a3a3a3] font-mono">{selectedCrit.nPreco}</span>
                  <span className="text-xs text-[#6b6b6b]">· {selectedCrit.unidade}</span>
                  {isCustomCriterio(selectedCrit.nPreco) && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">ADICIONADO MANUALMENTE</span>
                  )}
                </div>
                <h2 className="text-white font-bold text-lg leading-snug">{selectedCrit.descricao}</h2>
              </div>
              {isCustomCriterio(selectedCrit.nPreco) && (
                <button onClick={() => handleRemove(selectedCrit.nPreco)} className="text-red-400 hover:bg-red-900/20 rounded p-2 transition-colors shrink-0" title="Remover critério">
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden divide-y divide-[#525252]">
              <div className="p-4">
                <div className="text-[10px] font-semibold uppercase text-[#f97316] tracking-widest mb-2">Compreende</div>
                <p className="text-[#e5e5e5] text-sm leading-relaxed">{selectedCrit.compreende}</p>
              </div>
              <div className="p-4">
                <div className="text-[10px] font-semibold uppercase text-[#f97316] tracking-widest mb-2">Medição</div>
                <p className="text-[#e5e5e5] text-sm leading-relaxed">{selectedCrit.medicao}</p>
              </div>
              {selectedCrit.notas && (
                <div className="p-4 bg-amber-900/10">
                  <div className="text-[10px] font-semibold uppercase text-amber-400 tracking-widest mb-2">Notas</div>
                  <p className="text-amber-200/80 text-sm leading-relaxed">{selectedCrit.notas}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BookOpen size={40} className="text-[#525252] mb-4" />
            <p className="text-[#6b6b6b] text-sm">Selecione um código de serviço à esquerda para ver os critérios de medição.</p>
            <p className="text-[#6b6b6b] text-xs mt-1">
              {allCriterios.length} critérios disponíveis · Contrato 11481051
            </p>
            <button onClick={() => setAddOpen(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium text-[#f97316] border border-[#f97316]/30 hover:bg-[#f97316]/10 transition-colors">
              <Plus size={14} /> Adicionar critério manualmente
            </button>
          </div>
        )}
      </div>

      {addOpen && <AddCriterioModal onClose={() => setAddOpen(false)} onAdd={handleAdd} />}
    </div>
  )
}
