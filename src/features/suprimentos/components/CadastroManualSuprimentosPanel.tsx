import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, ClipboardList, Loader2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { loadManualOptions, type DbRede, type DbStatus, type ManualOptions } from '../utils/suprimentosPlanilhasSupabase'
import { cn } from '@/lib/utils'

const inputClass = 'w-full px-3 py-2 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none focus:border-[#f97316]/60'

export function CadastroManualSuprimentosPanel() {
  const {
    addManualNucleo,
    updateManualNucleo,
    removeManualNucleo,
    addManualRua,
    updateManualRua,
    removeManualRua,
    addManualItem,
    updateManualItem,
    removeManualItem,
    pullPlanilhasSupabase,
    itens,
  } = useSuprimentosStore(
    useShallow((s) => ({
      addManualNucleo: s.addManualNucleo,
      updateManualNucleo: s.updateManualNucleo,
      removeManualNucleo: s.removeManualNucleo,
      addManualRua: s.addManualRua,
      updateManualRua: s.updateManualRua,
      removeManualRua: s.removeManualRua,
      addManualItem: s.addManualItem,
      updateManualItem: s.updateManualItem,
      removeManualItem: s.removeManualItem,
      pullPlanilhasSupabase: s.pullPlanilhasSupabase,
      itens: s.planilhaItensOperacionais ?? [],
    })),
  )

  const [options, setOptions] = useState<ManualOptions>({ nucleos: [], ruas: [] })
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [nucleoNome, setNucleoNome] = useState('')
  const [nucleoTipo, setNucleoTipo] = useState<DbRede>('ESG')
  const [editingNucleoId, setEditingNucleoId] = useState<string | null>(null)

  const [ruaNucleoId, setRuaNucleoId] = useState('')
  const [ruaNome, setRuaNome] = useState('')
  const [editingRuaId, setEditingRuaId] = useState<string | null>(null)

  const [itemRuaId, setItemRuaId] = useState('')
  const [material, setMaterial] = useState('')
  const [unidade, setUnidade] = useState('m')
  const [quantidade, setQuantidade] = useState(0)
  const [rede, setRede] = useState<DbRede>('ESG')
  const [status, setStatus] = useState<DbStatus>('pend')
  const [kmExec, setKmExec] = useState(0)
  const [kmPend, setKmPend] = useState(0)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  async function refreshOptions() {
    const loaded = await loadManualOptions()
    setOptions(loaded)
    if (!ruaNucleoId && loaded.nucleos[0]) setRuaNucleoId(loaded.nucleos[0].id)
    if (!itemRuaId && loaded.ruas[0]) setItemRuaId(loaded.ruas[0].id)
  }

  useEffect(() => {
    void pullPlanilhasSupabase().catch(() => undefined)
    void refreshOptions().catch((err) => setError(err instanceof Error ? err.message : 'Falha ao carregar cadastros.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ruasFiltradas = useMemo(
    () => options.ruas.filter((r) => !ruaNucleoId || r.nucleoId === ruaNucleoId),
    [options.ruas, ruaNucleoId],
  )

  async function run(label: string, fn: () => Promise<void>) {
    setSaving(label)
    setError(null)
    setMessage(null)
    try {
      await fn()
      await refreshOptions()
      setMessage('Cadastro salvo no Supabase.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar cadastro.')
    } finally {
      setSaving(null)
    }
  }

  function resetNucleoForm() {
    setEditingNucleoId(null)
    setNucleoNome('')
    setNucleoTipo('ESG')
  }

  function startEditNucleo(nucleo: ManualOptions['nucleos'][number]) {
    setEditingNucleoId(nucleo.id)
    setNucleoNome(nucleo.nome)
    setNucleoTipo(nucleo.tipo)
  }

  function resetRuaForm() {
    setEditingRuaId(null)
    setRuaNome('')
  }

  function startEditRua(rua: ManualOptions['ruas'][number]) {
    setEditingRuaId(rua.id)
    setRuaNucleoId(rua.nucleoId)
    setRuaNome(rua.nome)
  }

  function startEditItem(item: typeof itens[number]) {
    const rua = options.ruas.find((option) => option.nome === item.rua && option.nucleo === item.nucleo)
    setEditingItemId(item.id)
    setItemRuaId(rua?.id || itemRuaId)
    setMaterial(item.material)
    setUnidade(item.unidade)
    setQuantidade(item.quantidade)
    setRede(item.rede)
    setStatus(item.status)
    setKmExec(item.kmExec)
    setKmPend(item.kmPend)
  }

  function resetItemForm() {
    setEditingItemId(null)
    setMaterial('')
    setQuantidade(0)
    setKmExec(0)
    setKmPend(0)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 overflow-hidden flex-1">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 overflow-auto">
        <section className="lg:col-span-3 border border-[#525252] rounded-xl bg-[#2f2f2f] p-4">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList size={16} className="text-[#f97316]" />
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Referência rápida Compizzo / Brasal</h3>
          </div>
          <div className="grid gap-3 text-xs text-[#d4d4d4] md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-[#525252] bg-[#262626] p-3">
              <p className="font-semibold text-white">Obra</p>
              <p>Brasal Inc24 · Brasal · Brasília - DF</p>
              <p>Técnico: VINICIUS · Orçamento: 109.2026 · Prazo: 90 dias</p>
            </div>
            <div className="rounded-lg border border-[#525252] bg-[#262626] p-3">
              <p className="font-semibold text-white">Quantitativos</p>
              <p>Piso: 5.902 m² · Paredes: 228,55 m²</p>
              <p>Demarcação: 3.140 ml · Seca piso/metal: 344 m²</p>
            </div>
            <div className="rounded-lg border border-[#525252] bg-[#262626] p-3">
              <p className="font-semibold text-white">Financeiro / Mão de obra</p>
              <p>MO total: R$ 30.812,07 · MO citada: R$ 33,98/m²</p>
              <p>Faturamento: R$ 489.586,06 · Impostos: R$ 71.085,32</p>
            </div>
            <div className="rounded-lg border border-[#525252] bg-[#262626] p-3">
              <p className="font-semibold text-white">Suprimentos das fotos</p>
              <p>SPIN 04/26: R$ 1.889,86</p>
              <p>Insumos: 408 itens / R$ 3.116,29 ou 372 itens / R$ 2.353,45</p>
            </div>
          </div>
        </section>

        <section className="border border-[#525252] rounded-xl bg-[#2f2f2f] p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-[#f97316] text-white text-xs font-bold flex items-center justify-center">1</span>
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Núcleo</h3>
          </div>
          <div className="space-y-3">
            <input value={nucleoNome} onChange={(e) => setNucleoNome(e.target.value)} placeholder="Nome do núcleo" className={inputClass} />
            <select value={nucleoTipo} onChange={(e) => setNucleoTipo(e.target.value as DbRede)} className={inputClass}>
              <option value="ESG">ESG</option>
              <option value="AG">AG</option>
            </select>
            <button
              onClick={() => run('nucleo', async () => {
                if (!nucleoNome.trim()) throw new Error('Informe o nome do núcleo.')
                if (editingNucleoId) await updateManualNucleo({ id: editingNucleoId, nome: nucleoNome, tipo: nucleoTipo })
                else await addManualNucleo({ nome: nucleoNome, tipo: nucleoTipo })
                resetNucleoForm()
              })}
              disabled={saving !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving === 'nucleo' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {editingNucleoId ? 'Salvar edição' : 'Salvar núcleo'}
            </button>
            {editingNucleoId && (
              <button onClick={resetNucleoForm} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs font-semibold">
                <X size={13} /> Cancelar edição
              </button>
            )}
            <div className="max-h-40 overflow-auto rounded-lg border border-[#525252]/70">
              {options.nucleos.map((nucleo) => (
                <div key={nucleo.id} className="flex items-center justify-between gap-2 border-b border-[#525252]/40 px-3 py-2 last:border-b-0">
                  <span className="min-w-0 truncate text-xs text-[#d4d4d4]">{nucleo.nome} <span className="text-[#737373]">({nucleo.tipo})</span></span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => startEditNucleo(nucleo)} className="rounded border border-[#525252] p-1 text-[#a3a3a3] hover:border-[#f97316]/50 hover:text-[#f97316]" title="Editar núcleo"><Pencil size={12} /></button>
                    <button type="button" onClick={() => {
                      if (window.confirm(`Excluir núcleo "${nucleo.nome}" e suas ruas/itens?`)) void run('remove-nucleo', async () => removeManualNucleo(nucleo.id))
                    }} className="rounded border border-[#525252] p-1 text-[#a3a3a3] hover:border-red-500/50 hover:text-red-300" title="Excluir núcleo"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border border-[#525252] rounded-xl bg-[#2f2f2f] p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-[#f97316] text-white text-xs font-bold flex items-center justify-center">2</span>
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Rua</h3>
          </div>
          <div className="space-y-3">
            <select value={ruaNucleoId} onChange={(e) => setRuaNucleoId(e.target.value)} className={inputClass}>
              <option value="">Selecione um núcleo</option>
              {options.nucleos.map((n) => <option key={n.id} value={n.id}>{n.nome} ({n.tipo})</option>)}
            </select>
            <input value={ruaNome} onChange={(e) => setRuaNome(e.target.value)} placeholder="Nome da rua" className={inputClass} />
            <button
              onClick={() => run('rua', async () => {
                if (!ruaNucleoId) throw new Error('Selecione o núcleo da rua.')
                if (!ruaNome.trim()) throw new Error('Informe o nome da rua.')
                if (editingRuaId) await updateManualRua({ id: editingRuaId, nucleoId: ruaNucleoId, nome: ruaNome })
                else await addManualRua({ nucleoId: ruaNucleoId, nome: ruaNome })
                resetRuaForm()
              })}
              disabled={saving !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving === 'rua' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {editingRuaId ? 'Salvar edição' : 'Salvar rua'}
            </button>
            {editingRuaId && (
              <button onClick={resetRuaForm} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs font-semibold">
                <X size={13} /> Cancelar edição
              </button>
            )}
            <div className="max-h-40 overflow-auto rounded-lg border border-[#525252]/70">
              {options.ruas.map((rua) => (
                <div key={rua.id} className="flex items-center justify-between gap-2 border-b border-[#525252]/40 px-3 py-2 last:border-b-0">
                  <span className="min-w-0 truncate text-xs text-[#d4d4d4]">{rua.nucleo} / {rua.nome}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => startEditRua(rua)} className="rounded border border-[#525252] p-1 text-[#a3a3a3] hover:border-[#f97316]/50 hover:text-[#f97316]" title="Editar rua"><Pencil size={12} /></button>
                    <button type="button" onClick={() => {
                      if (window.confirm(`Excluir rua "${rua.nome}" e seus itens?`)) void run('remove-rua', async () => removeManualRua(rua.id))
                    }} className="rounded border border-[#525252] p-1 text-[#a3a3a3] hover:border-red-500/50 hover:text-red-300" title="Excluir rua"><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border border-[#525252] rounded-xl bg-[#2f2f2f] p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-[#f97316] text-white text-xs font-bold flex items-center justify-center">3</span>
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Item</h3>
          </div>
          <div className="space-y-3">
            <select value={itemRuaId} onChange={(e) => setItemRuaId(e.target.value)} className={inputClass}>
              <option value="">Selecione a rua</option>
              {ruasFiltradas.map((r) => <option key={r.id} value={r.id}>{r.nucleo} - {r.nome}</option>)}
            </select>
            <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Material" className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Unidade" className={inputClass} />
              <input type="number" value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} placeholder="Quantidade" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={rede} onChange={(e) => setRede(e.target.value as DbRede)} className={inputClass}>
                <option value="ESG">ESG</option>
                <option value="AG">AG</option>
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value as DbStatus)} className={inputClass}>
                <option value="pend">Pendente</option>
                <option value="exec">Executado</option>
                <option value="cad">Cadastro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" step="0.001" value={kmExec} onChange={(e) => setKmExec(Number(e.target.value))} placeholder="km exec." className={inputClass} />
              <input type="number" step="0.001" value={kmPend} onChange={(e) => setKmPend(Number(e.target.value))} placeholder="km pend." className={inputClass} />
            </div>
            <button
              onClick={() => run('item', async () => {
                if (!itemRuaId) throw new Error('Selecione a rua do item.')
                if (!material.trim()) throw new Error('Informe o material.')
                if (editingItemId) await updateManualItem({ id: editingItemId, ruaId: itemRuaId, material, unidade, quantidade, rede, status, kmExec, kmPend })
                else await addManualItem({ ruaId: itemRuaId, material, unidade, quantidade, rede, status, kmExec, kmPend })
                resetItemForm()
              })}
              disabled={saving !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving === 'item' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
              {editingItemId ? 'Salvar edição' : 'Salvar item'}
            </button>
            {editingItemId && (
              <button onClick={resetItemForm} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs font-semibold">
                <X size={13} /> Cancelar edição
              </button>
            )}
          </div>
        </section>

        {(message || error) && (
          <div className={cn(
            'lg:col-span-3 px-3 py-2 rounded-lg text-xs border',
            error ? 'bg-red-900/20 border-red-700/30 text-red-300' : 'bg-emerald-900/20 border-emerald-700/30 text-emerald-300',
          )}>
            {error ?? message}
          </div>
        )}
      </div>

      <aside className="border border-[#525252] rounded-xl bg-[#2f2f2f] overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-3 bg-[#3d3d3d] border-b border-[#525252]">
          <p className="text-sm font-semibold text-[#f5f5f5]">Itens cadastrados</p>
          <p className="text-[11px] text-[#a3a3a3]">{itens.length.toLocaleString('pt-BR')} registros no Supabase</p>
        </div>
        <div className="overflow-auto">
          {itens.slice(0, 80).map((item) => (
            <div key={item.id} className="px-4 py-2 border-b border-[#525252]/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-[#f5f5f5] font-medium truncate" title={item.material}>{item.material}</p>
                  <p className="text-[11px] text-[#a3a3a3] truncate">{item.nucleo} / {item.rua}</p>
                  <p className="text-[10px] text-[#6b6b6b]">{item.rede} | {item.status} | {item.quantidade.toLocaleString('pt-BR')} {item.unidade || '-'}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => startEditItem(item)} className="rounded border border-[#525252] p-1 text-[#a3a3a3] hover:border-[#f97316]/50 hover:text-[#f97316]" title="Editar item">
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Excluir "${item.material}"?`)) void run('remove-item', async () => removeManualItem(item.id))
                    }}
                    className="rounded border border-[#525252] p-1 text-[#a3a3a3] hover:border-red-500/50 hover:text-red-300"
                    title="Excluir item"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {itens.length === 0 && (
            <div className="p-6 text-center text-xs text-[#6b6b6b]">Nenhum item cadastrado ainda.</div>
          )}
        </div>
      </aside>
    </div>
  )
}
