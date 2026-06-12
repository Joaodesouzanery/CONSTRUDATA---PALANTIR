/**
 * ManejoOrcamentoPanel — gestão de autorizações orçamentárias em 4 colunas
 * (Códigos de Fundo, Códigos de Interesse Especial, Elementos de Orçamento e
 * Autorizações de Custo), com totais alocados/não alocados por categoria,
 * vínculos entre itens e CRUD completo.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, Link2, MoreVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isDemoModeEnabled } from '@/lib/runtimeMode'
import { useManejoFinanceiroStore } from '@/store/manejoFinanceiroStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { ManejoOrcamentoItem, OrcamentoCategoria } from '@/types'

function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const CATEGORIAS: { key: OrcamentoCategoria; titulo: string; cor: string }[] = [
  { key: 'fundo', titulo: 'Códigos de Fundo', cor: '#38bdf8' },
  { key: 'interesse-especial', titulo: 'Códigos de Interesse Especial', cor: '#a78bfa' },
  { key: 'elemento-orcamento', titulo: 'Elementos de Orçamento', cor: '#f97316' },
  { key: 'autorizacao-custo', titulo: 'Autorizações de Custo', cor: '#22c55e' },
]

export function ManejoOrcamentoPanel() {
  const store = useManejoFinanceiroStore()
  const { orcamentos } = store
  const profileOrgId = useAuth((s) => s.profile?.organization_id)
  const [criandoEm, setCriandoEm] = useState<OrcamentoCategoria | null>(null)
  const [editando, setEditando] = useState<ManejoOrcamentoItem | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)
  const [menuAberto, setMenuAberto] = useState<OrcamentoCategoria | null>(null)

  useEffect(() => {
    if (!profileOrgId) return
    store.ensureTenantScope(profileOrgId)
    if (isDemoModeEnabled()) return
    void (async () => { await store.flush(); await store.pull() })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileOrgId])

  const porCategoria = useMemo(() => {
    const map = new Map<OrcamentoCategoria, ManejoOrcamentoItem[]>()
    for (const cat of CATEGORIAS) map.set(cat.key, [])
    for (const o of orcamentos) map.get(o.categoria)?.push(o)
    return map
  }, [orcamentos])

  const codigoDe = useMemo(() => new Map(orcamentos.map((o) => [o.id, o.codigo])), [orcamentos])
  const excluindo = orcamentos.find((o) => o.id === excluindoId) ?? null

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Manejo Orçamento — Autorizações</h2>
          <p className="text-[10px] text-[#6b6b6b]">{orcamentos.length} autorizações em 4 categorias</p>
        </div>
        {orcamentos.length === 0 && (
          <button onClick={store.loadDemoData} className="flex items-center gap-1.5 rounded-lg bg-[#484848] px-3 py-2 text-xs font-semibold text-[#f5f5f5] transition-colors hover:bg-[#525252]">
            <Download size={13} /> Carregar Demo
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CATEGORIAS.map((cat) => {
          const itens = porCategoria.get(cat.key) ?? []
          const alocado = itens.reduce((s, o) => s + o.valorAlocado, 0)
          const total = itens.reduce((s, o) => s + o.valorTotal, 0)
          const naoAlocado = total - alocado

          return (
            <section key={cat.key} className="flex min-h-[280px] flex-col rounded-xl border border-[#525252] bg-[#333333]">
              {/* Header da coluna */}
              <div className="flex items-center justify-between gap-2 border-b border-[#525252] px-3 py-2.5" style={{ borderTopWidth: 3, borderTopColor: cat.cor, borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
                <h3 className="min-w-0 truncate text-xs font-bold text-[#f5f5f5]">{cat.titulo}</h3>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setMenuAberto(menuAberto === cat.key ? null : cat.key)}
                    className="rounded p-1 text-[#6b6b6b] transition-colors hover:bg-[#484848] hover:text-white"
                    aria-label={`Ações de ${cat.titulo}`}
                  >
                    <MoreVertical size={14} />
                  </button>
                  {menuAberto === cat.key && (
                    <>
                      <div className="fixed inset-0 z-[90]" onClick={() => setMenuAberto(null)} />
                      <div className="absolute right-0 top-7 z-[100] w-36 overflow-hidden rounded-lg border border-[#525252] bg-[#2c2c2c] shadow-xl">
                        <button
                          onClick={() => { setCriandoEm(cat.key); setMenuAberto(null) }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[#22c55e] transition-colors hover:bg-[#3d3d3d]"
                        >
                          <Plus size={12} /> Criar
                        </button>
                        <p className="border-t border-[#525252] px-3 py-2 text-[9px] leading-snug text-[#6b6b6b]">
                          Modificar/Excluir: use os ícones de cada card.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Card de totais */}
              <div className="border-b border-[#525252] px-3 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-[#a3a3a3]">Autorizações Alocadas</p>
                <p className="font-mono text-lg font-bold leading-tight" style={{ color: cat.cor }}>{fmtBRL(alocado)}</p>
                <p className="mt-0.5 text-[10px] text-[#6b6b6b]">Não alocado: <span className="font-mono">{fmtBRL(naoAlocado)}</span></p>
              </div>

              {/* Lista de cards */}
              <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
                {itens.length === 0 && <p className="px-1 py-3 text-center text-[10px] text-[#6b6b6b]">Nenhuma autorização nesta categoria.</p>}
                {itens.map((o) => (
                  <article key={o.id} className="group rounded-lg border border-[#525252] bg-[#2c2c2c] p-3 transition-colors hover:border-[#6b6b6b]">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold" style={{ color: cat.cor }}>{o.codigo}</span>
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button onClick={() => setEditando(o)} className="text-[#6b6b6b] transition-colors hover:text-[#f97316]" aria-label={`Editar ${o.codigo}`}>
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => setExcluindoId(o.id)} className="text-[#6b6b6b] transition-colors hover:text-red-400" aria-label={`Excluir ${o.codigo}`}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-[#f5f5f5]">{o.descricao}</p>
                    <div className="mt-2 space-y-0.5 text-[10px] text-[#a3a3a3]">
                      <p>Valor total: <span className="font-mono text-[#f5f5f5]">{fmtBRL(o.valorTotal)}</span></p>
                      <p>Alocado: <span className="font-mono text-[#f5f5f5]">{fmtBRL(o.valorAlocado)}</span></p>
                    </div>
                    {o.vinculos.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <Link2 size={10} className="text-[#6b6b6b]" />
                        {o.vinculos.map((v) => (
                          <span key={v} className="rounded border border-[#525252] bg-[#3d3d3d] px-1.5 py-0.5 font-mono text-[9px] text-[#a3a3a3]">
                            {codigoDe.get(v) ?? '—'}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>

              <div className="border-t border-[#525252] p-2.5">
                <button
                  onClick={() => setCriandoEm(cat.key)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#525252] py-2 text-[11px] font-semibold text-[#a3a3a3] transition-colors hover:border-[#f97316] hover:text-[#f97316]"
                >
                  <Plus size={12} /> Nova autorização
                </button>
              </div>
            </section>
          )
        })}
      </div>

      {(criandoEm !== null || editando) && (
        <OrcamentoFormModal
          initial={editando}
          categoriaInicial={criandoEm ?? editando?.categoria ?? 'fundo'}
          todos={orcamentos}
          onClose={() => { setCriandoEm(null); setEditando(null) }}
          onSubmit={(values) => {
            if (editando) store.updateOrcamento(editando.id, values)
            else store.addOrcamento(values)
            setCriandoEm(null)
            setEditando(null)
          }}
        />
      )}

      <ConfirmDialog
        open={excluindoId !== null}
        title="Excluir autorização"
        message={`"${excluindo?.codigo ?? ''} — ${excluindo?.descricao ?? ''}" será removida. Vínculos em outros cards também serão limpos.`}
        confirmLabel="Excluir"
        onConfirm={() => { if (excluindoId) store.removeOrcamento(excluindoId); setExcluindoId(null) }}
        onCancel={() => setExcluindoId(null)}
      />
    </div>
  )
}

/* ── Modal de criação/edição de autorização ───────────────────────────── */

function OrcamentoFormModal({
  initial, categoriaInicial, todos, onClose, onSubmit,
}: {
  initial: ManejoOrcamentoItem | null
  categoriaInicial: OrcamentoCategoria
  todos: ManejoOrcamentoItem[]
  onClose: () => void
  onSubmit: (values: Omit<ManejoOrcamentoItem, 'id' | 'createdAt'>) => void
}) {
  const [categoria, setCategoria] = useState<OrcamentoCategoria>(initial?.categoria ?? categoriaInicial)
  const [codigo, setCodigo] = useState(initial?.codigo ?? '')
  const [descricao, setDescricao] = useState(initial?.descricao ?? '')
  const [valorTotal, setValorTotal] = useState(initial ? String(initial.valorTotal) : '')
  const [valorAlocado, setValorAlocado] = useState(initial ? String(initial.valorAlocado) : '')
  const [vinculos, setVinculos] = useState<string[]>(initial?.vinculos ?? [])

  // Vincula-se a itens de outras categorias (nunca a si mesmo).
  const candidatos = todos.filter((o) => o.categoria !== categoria && o.id !== initial?.id)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const vt = parseFloat(valorTotal)
    const va = parseFloat(valorAlocado)
    if (!codigo.trim() || !descricao.trim() || isNaN(vt) || isNaN(va)) return
    onSubmit({ categoria, codigo: codigo.trim(), descricao: descricao.trim(), valorTotal: vt, valorAlocado: va, vinculos })
  }

  const input = 'w-full h-10 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]'
  const label = 'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4 rounded-xl border border-[#525252] bg-[#333333] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{initial ? 'Modificar Autorização' : 'Criar Autorização'}</h3>
          <button type="button" onClick={onClose} className="text-[#6b6b6b] transition-colors hover:text-white" aria-label="Fechar formulário"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Categoria</label>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value as OrcamentoCategoria)} className={input}>
              {CATEGORIAS.map((c) => <option key={c.key} value={c.key}>{c.titulo}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Código</label>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className={`${input} font-mono`} placeholder="Ex.: FD-2026-004" required />
          </div>
        </div>

        <div>
          <label className={label}>Descrição</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={input} placeholder="Ex.: Materiais hidráulicos e conexões" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Valor total (R$)</label>
            <input type="number" min={0} step={0.01} value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} className={`${input} font-mono`} required />
          </div>
          <div>
            <label className={label}>Valor alocado (R$)</label>
            <input type="number" min={0} step={0.01} value={valorAlocado} onChange={(e) => setValorAlocado(e.target.value)} className={`${input} font-mono`} required />
          </div>
        </div>

        {candidatos.length > 0 && (
          <div>
            <label className={label}>Vínculos (outras categorias)</label>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-[#525252] bg-[#2c2c2c] p-2">
              {candidatos.map((o) => (
                <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-[#a3a3a3] transition-colors hover:bg-[#3d3d3d] hover:text-[#f5f5f5]">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[#f97316]"
                    checked={vinculos.includes(o.id)}
                    onChange={() => setVinculos((v) => (v.includes(o.id) ? v.filter((x) => x !== o.id) : [...v, o.id]))}
                  />
                  <span className="font-mono text-[10px]">{o.codigo}</span>
                  <span className="truncate">{o.descricao}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg bg-[#484848] px-4 py-2 text-sm font-medium text-[#f5f5f5] transition-colors hover:bg-[#525252]">Cancelar</button>
          <button type="submit" className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#ea580c]">{initial ? 'Salvar' : 'Criar'}</button>
        </div>
      </form>
    </div>
  )
}
