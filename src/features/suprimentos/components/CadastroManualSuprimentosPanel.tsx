import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Loader2, Plus, Save } from 'lucide-react'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { loadManualOptions, type DbRede, type DbStatus, type ManualOptions } from '../utils/suprimentosPlanilhasSupabase'
import { cn } from '@/lib/utils'

const inputClass = 'w-full px-3 py-2 rounded-lg text-xs bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] outline-none focus:border-[#f97316]/60'

export function CadastroManualSuprimentosPanel() {
  const {
    addManualNucleo,
    addManualRua,
    addManualItem,
    pullPlanilhasSupabase,
    itens,
  } = useSuprimentosStore((s) => ({
    addManualNucleo: s.addManualNucleo,
    addManualRua: s.addManualRua,
    addManualItem: s.addManualItem,
    pullPlanilhasSupabase: s.pullPlanilhasSupabase,
    itens: s.planilhaItensOperacionais,
  }))

  const [options, setOptions] = useState<ManualOptions>({ nucleos: [], ruas: [] })
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [nucleoNome, setNucleoNome] = useState('')
  const [nucleoTipo, setNucleoTipo] = useState<DbRede>('ESG')
  const [ruaNucleoId, setRuaNucleoId] = useState('')
  const [ruaNome, setRuaNome] = useState('')
  const [itemRuaId, setItemRuaId] = useState('')
  const [material, setMaterial] = useState('')
  const [unidade, setUnidade] = useState('m')
  const [quantidade, setQuantidade] = useState(0)
  const [rede, setRede] = useState<DbRede>('ESG')
  const [status, setStatus] = useState<DbStatus>('pend')
  const [kmExec, setKmExec] = useState(0)
  const [kmPend, setKmPend] = useState(0)

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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 overflow-hidden flex-1">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 overflow-auto">
        <section className="border border-[#525252] rounded-xl bg-[#2f2f2f] p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-[#f97316] text-white text-xs font-bold flex items-center justify-center">1</span>
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Nucleo</h3>
          </div>
          <div className="space-y-3">
            <input value={nucleoNome} onChange={(e) => setNucleoNome(e.target.value)} placeholder="Nome do nucleo" className={inputClass} />
            <select value={nucleoTipo} onChange={(e) => setNucleoTipo(e.target.value as DbRede)} className={inputClass}>
              <option value="ESG">ESG</option>
              <option value="AG">AG</option>
            </select>
            <button
              onClick={() => run('nucleo', async () => {
                if (!nucleoNome.trim()) throw new Error('Informe o nome do nucleo.')
                await addManualNucleo({ nome: nucleoNome, tipo: nucleoTipo })
                setNucleoNome('')
              })}
              disabled={saving !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving === 'nucleo' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Salvar Nucleo
            </button>
          </div>
        </section>

        <section className="border border-[#525252] rounded-xl bg-[#2f2f2f] p-4 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-[#f97316] text-white text-xs font-bold flex items-center justify-center">2</span>
            <h3 className="text-sm font-semibold text-[#f5f5f5]">Rua</h3>
          </div>
          <div className="space-y-3">
            <select value={ruaNucleoId} onChange={(e) => setRuaNucleoId(e.target.value)} className={inputClass}>
              <option value="">Selecione um nucleo</option>
              {options.nucleos.map((n) => <option key={n.id} value={n.id}>{n.nome} ({n.tipo})</option>)}
            </select>
            <input value={ruaNome} onChange={(e) => setRuaNome(e.target.value)} placeholder="Nome da rua" className={inputClass} />
            <button
              onClick={() => run('rua', async () => {
                if (!ruaNucleoId) throw new Error('Selecione o nucleo da rua.')
                if (!ruaNome.trim()) throw new Error('Informe o nome da rua.')
                await addManualRua({ nucleoId: ruaNucleoId, nome: ruaNome })
                setRuaNome('')
              })}
              disabled={saving !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving === 'rua' ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Salvar Rua
            </button>
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
              <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="UN" className={inputClass} />
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
              <input type="number" step="0.001" value={kmExec} onChange={(e) => setKmExec(Number(e.target.value))} placeholder="km exec" className={inputClass} />
              <input type="number" step="0.001" value={kmPend} onChange={(e) => setKmPend(Number(e.target.value))} placeholder="km pend" className={inputClass} />
            </div>
            <button
              onClick={() => run('item', async () => {
                if (!itemRuaId) throw new Error('Selecione a rua do item.')
                if (!material.trim()) throw new Error('Informe o material.')
                await addManualItem({ ruaId: itemRuaId, material, unidade, quantidade, rede, status, kmExec, kmPend })
                setMaterial('')
                setQuantidade(0)
                setKmExec(0)
                setKmPend(0)
              })}
              disabled={saving !== null}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold disabled:opacity-50"
            >
              {saving === 'item' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
              Salvar Item
            </button>
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
              <p className="text-xs text-[#f5f5f5] font-medium truncate" title={item.material}>{item.material}</p>
              <p className="text-[11px] text-[#a3a3a3] truncate">{item.nucleo} / {item.rua}</p>
              <p className="text-[10px] text-[#6b6b6b]">{item.rede} | {item.status} | {item.quantidade.toLocaleString('pt-BR')} {item.unidade}</p>
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
