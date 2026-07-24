/**
 * PredialWorkbenchPanel — versão code-only (sem IA/LLM) do "Maintenance Workbench":
 * chamado (aba Chamado × Detalhado) + troubleshooting (checklist) + tickets similares
 * (heurística Jaccard, lib/similarity) + repositório de manuais anexados ao ativo, com
 * SEÇÕES/notas navegáveis e busca por palavra-chave. Sem 3D, sem extração por IA.
 * Manuais/seções persistem no payload jsonb do ativo (updateAsset) — sem migração.
 */
import { useMemo, useState } from 'react'
import { Search, FileText, Link2, Plus, Trash2, X, ListChecks, Copy, Wrench, ChevronDown, ChevronRight } from 'lucide-react'
import { useManutencoesStore } from '@/store/manutencoesStore'
import type { MaintenanceAsset, MaintenanceWorkOrder, MaintenanceManual, MaintenanceManualSection } from '@/store/manutencoesStore'
import { rankBySimilarity } from '../lib/similarity'

const uid = () => crypto.randomUUID()
const EMPTY_MANUAIS: MaintenanceManual[] = []
function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export function PredialWorkbenchPanel() {
  const workOrders = useManutencoesStore((s) => s.workOrders)
  const assets = useManutencoesStore((s) => s.assets)
  const updateAsset = useManutencoesStore((s) => s.updateAsset)

  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'chamado' | 'detalhado'>('chamado')

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const list = q ? workOrders.filter((w) => `${w.title} ${w.description} ${w.code}`.toLowerCase().includes(q)) : workOrders
    return [...list].sort((a, b) => (b.scheduledDate || b.createdAt || '').localeCompare(a.scheduledDate || a.createdAt || ''))
  }, [workOrders, busca])

  const selected = workOrders.find((w) => w.id === selectedId) ?? filtered[0] ?? null
  const asset = selected ? (selected.assetIds ?? []).map((id) => assetById.get(id)).find(Boolean) ?? null : null

  const similares = useMemo(() => {
    if (!selected) return []
    const textOf = (w: MaintenanceWorkOrder) => `${w.title} ${w.description} ${(w.assetIds ?? []).map((id) => assetById.get(id)?.type ?? '').join(' ')}`
    return rankBySimilarity(textOf(selected), workOrders.filter((w) => w.id !== selected.id), textOf, { topN: 6 })
  }, [selected, workOrders, assetById])

  const historicoAtivo = useMemo(
    () => (asset ? workOrders.filter((w) => w.id !== selected?.id && w.assetIds?.includes(asset.id)).sort((a, b) => (b.scheduledDate || '').localeCompare(a.scheduledDate || '')) : []),
    [asset, workOrders, selected?.id],
  )

  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6 overflow-auto">
      {/* Lista de chamados */}
      <div className="lg:w-[300px] shrink-0 flex flex-col gap-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar chamado…"
            className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg pl-8 pr-3 py-2 text-xs text-white outline-none focus:border-[#f97316]/60" />
        </div>
        <div className="space-y-1.5 overflow-auto">
          {filtered.length === 0 ? (
            <div className="text-[#6b6b6b] text-xs py-8 text-center rounded-xl border border-dashed border-[#525252]">Sem chamados.</div>
          ) : filtered.slice(0, 60).map((w) => {
            const isSel = selected?.id === w.id
            return (
              <button key={w.id} onClick={() => setSelectedId(w.id)}
                className={`w-full text-left rounded-lg border p-2.5 transition-colors ${isSel ? 'border-[#f97316] bg-[#3d3d3d]' : 'border-[#525252] bg-[#333333] hover:border-[#f97316]/50'}`}>
                <p className="text-white text-xs truncate">{w.title || w.code}</p>
                <p className="text-[10px] text-[#6b6b6b] truncate">{w.code} · {w.scheduledDate || '—'}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Chamado + troubleshooting / detalhado */}
      <div className="flex-1 min-w-0 space-y-5">
        {!selected ? (
          <div className="text-[#6b6b6b] text-sm py-16 text-center rounded-xl border border-dashed border-[#525252]">Selecione um chamado.</div>
        ) : (
          <>
            <div className="inline-flex rounded-lg border border-[#525252] bg-[#1f1f1f] p-1">
              {(['chamado', 'detalhado'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${view === v ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3] hover:text-white'}`}>
                  {v === 'chamado' ? 'Chamado' : 'Detalhado'}
                </button>
              ))}
            </div>

            {view === 'chamado' ? (
              <>
                <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench size={15} className="text-[#f97316]" />
                    <h2 className="text-white font-semibold text-sm">{selected.title || selected.code}</h2>
                  </div>
                  <p className="text-[#a3a3a3] text-sm whitespace-pre-wrap">{selected.description || 'Sem descrição.'}</p>
                  <div className="flex flex-wrap gap-2 mt-3 text-[10px]">
                    <Tag>{selected.code}</Tag><Tag>Status: {selected.status}</Tag><Tag>Prioridade: {selected.priority}</Tag>
                    {asset && <Tag>Ativo: {asset.name || asset.code}</Tag>}
                  </div>
                </div>
                {selected.checklist?.length > 0 && (
                  <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
                    <div className="flex items-center gap-2 mb-3"><ListChecks size={15} className="text-[#a3a3a3]" /><p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">Passos de troubleshooting</p></div>
                    <ol className="space-y-1.5">
                      {selected.checklist.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#d4d4d4]">
                          <span className="w-5 h-5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>{step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            ) : (
              <DetalhadoView wo={selected} asset={asset} historico={historicoAtivo} onSelect={setSelectedId} />
            )}
          </>
        )}
      </div>

      {/* Similares + Manuais */}
      <div className="lg:w-[340px] shrink-0 space-y-5">
        <div className="rounded-2xl border border-[#525252] bg-[#333333] p-4">
          <div className="flex items-center gap-2 mb-3"><Copy size={14} className="text-[#a3a3a3]" /><p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">Chamados similares</p></div>
          {similares.length === 0 ? <p className="text-[#6b6b6b] text-xs py-4 text-center">Nenhum similar encontrado.</p> : (
            <div className="space-y-1.5">
              {similares.map(({ item: w, score }) => (
                <button key={w.id} onClick={() => setSelectedId(w.id)} className="w-full text-left rounded-lg border border-[#525252] bg-[#2c2c2c] p-2.5 hover:border-[#f97316]/50 transition-colors">
                  <div className="flex items-center justify-between gap-2"><p className="text-white text-xs truncate">{w.title || w.code}</p><span className="text-[10px] text-[#f97316] font-mono shrink-0">{Math.round(score * 100)}%</span></div>
                  <p className="text-[10px] text-[#6b6b6b] truncate">{w.status} · {w.scheduledDate || '—'}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <ManuaisSection asset={asset} onSave={(manuais) => asset && void updateAsset(asset.id, { manuais })} />
      </div>
    </div>
  )
}

function DetField({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p><p className="text-sm text-[#f5f5f5]">{value}</p></div>
}

function DetalhadoView({ wo, asset, historico, onSelect }: { wo: MaintenanceWorkOrder; asset: MaintenanceAsset | null; historico: MaintenanceWorkOrder[]; onSelect: (id: string) => void }) {
  const F = DetField
  return (
    <>
      <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
        <h2 className="text-white font-semibold text-sm mb-1">{wo.title || wo.code}</h2>
        <p className="text-[#a3a3a3] text-sm whitespace-pre-wrap mb-4">{wo.description || 'Sem descrição.'}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <F label="Código" value={wo.code} />
          <F label="Status" value={wo.status} />
          <F label="Prioridade" value={wo.priority} />
          <F label="Severidade" value={wo.severity} />
          <F label="Progresso" value={`${wo.progress ?? 0}%`} />
          <F label="Planejada" value={wo.planned ? 'Sim' : 'Não'} />
          <F label="Agendada" value={wo.scheduledDate || '—'} />
          <F label="Vencimento" value={wo.dueDate || '—'} />
          <F label="Concluída" value={wo.completedAt || '—'} />
          <F label="Responsável" value={wo.assignee || '—'} />
          <F label="Solicitante" value={wo.requester || '—'} />
          <F label="Custo (est./real)" value={`${fmtBRL(wo.estimatedCost || 0)} / ${fmtBRL(wo.actualCost || 0)}`} />
          {asset && <F label="Ativo" value={`${asset.name || asset.code}${asset.modelo ? ` · ${asset.modelo}` : ''}`} />}
          {asset?.location && <F label="Localização" value={asset.location} />}
        </div>
      </div>

      <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
        <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider mb-3">Histórico de OS do ativo {asset ? `· ${asset.name || asset.code}` : ''}</p>
        {historico.length === 0 ? <p className="text-[#6b6b6b] text-xs py-3 text-center">Sem outras OS neste ativo.</p> : (
          <div className="divide-y divide-[#525252]/40">
            {historico.slice(0, 12).map((h) => (
              <button key={h.id} onClick={() => onSelect(h.id)} className="w-full text-left flex items-center justify-between gap-3 py-2 hover:bg-white/[0.02]">
                <div className="min-w-0"><p className="text-white text-xs truncate">{h.title || h.code}</p><p className="text-[10px] text-[#6b6b6b]">{h.status} · {h.scheduledDate || '—'}</p></div>
                <span className="text-[10px] text-[#a3a3a3] font-mono shrink-0">{fmtBRL(h.actualCost || 0)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function ManuaisSection({ asset, onSave }: { asset: MaintenanceAsset | null; onSave: (m: MaintenanceManual[]) => void }) {
  const [busca, setBusca] = useState('')
  const [adding, setAdding] = useState(false)
  const [nome, setNome] = useState('')
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState('')
  const [expandido, setExpandido] = useState<Set<string>>(new Set())

  const manuais = asset?.manuais ?? EMPTY_MANUAIS
  const q = busca.trim().toLowerCase()
  const matchSecao = (s: MaintenanceManualSection) => `${s.titulo} ${s.texto}`.toLowerCase().includes(q)
  const hit = (t: string) => t.toLowerCase().includes(q)
  const filtered = !q ? manuais : manuais.filter((m) => hit(`${m.nome} ${(m.tags ?? []).join(' ')}`) || (m.secoes ?? []).some(matchSecao))

  function add() {
    if (!nome.trim() || !asset) return
    onSave([...manuais, { id: uid(), nome: nome.trim(), url: url.trim() || undefined, tags: tags.split(',').map((t) => t.trim()).filter(Boolean), secoes: [] }])
    setNome(''); setUrl(''); setTags(''); setAdding(false)
  }
  const removeManual = (id: string) => onSave(manuais.filter((m) => m.id !== id))
  const patchManual = (id: string, secoes: MaintenanceManualSection[]) => onSave(manuais.map((m) => (m.id === id ? { ...m, secoes } : m)))
  const toggle = (id: string) => setExpandido((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div className="rounded-2xl border border-[#525252] bg-[#333333] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><FileText size={14} className="text-[#a3a3a3]" /><p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">Manuais {asset ? `· ${asset.name || asset.code}` : ''}</p></div>
        {asset && <button onClick={() => setAdding((v) => !v)} className="p-1 rounded text-[#a3a3a3] hover:bg-white/10 hover:text-[#f97316]"><Plus size={14} /></button>}
      </div>

      {!asset ? <p className="text-[#6b6b6b] text-xs py-3 text-center">O chamado não tem ativo vinculado.</p> : (
        <>
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar manual/seção/palavra-chave…"
              className="w-full bg-[#2c2c2c] border border-[#525252] rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-white outline-none focus:border-[#f97316]/60" />
          </div>

          {adding && (
            <div className="space-y-2 mb-3 rounded-lg border border-[#525252] bg-[#2c2c2c] p-2.5">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do manual *" className="w-full bg-[#333333] border border-[#525252] rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#f97316]/60" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Link (URL) — opcional" className="w-full bg-[#333333] border border-[#525252] rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#f97316]/60" />
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (vírgula) — ex.: hvac, compressor" className="w-full bg-[#333333] border border-[#525252] rounded px-2 py-1.5 text-[11px] text-white outline-none focus:border-[#f97316]/60" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setAdding(false)} className="px-2.5 py-1 rounded text-[11px] text-[#a3a3a3] hover:text-white"><X size={12} /></button>
                <button onClick={add} className="px-3 py-1 rounded text-[11px] font-semibold text-white bg-[#f97316] hover:bg-[#ea580c]">Adicionar</button>
              </div>
            </div>
          )}

          {filtered.length === 0 ? <p className="text-[#6b6b6b] text-xs py-3 text-center">{manuais.length === 0 ? 'Nenhum manual anexado.' : 'Nenhum resultado.'}</p> : (
            <div className="space-y-1.5">
              {filtered.map((m) => {
                const secoes = q ? (m.secoes ?? []).filter(matchSecao) : (m.secoes ?? [])
                const isOpen = expandido.has(m.id) || (!!q && secoes.length > 0)
                return (
                  <div key={m.id} className="rounded-lg border border-[#525252] bg-[#2c2c2c]">
                    <div className="group flex items-center justify-between gap-2 p-2">
                      <button onClick={() => toggle(m.id)} className="flex items-center gap-1.5 min-w-0 text-left">
                        {isOpen ? <ChevronDown size={12} className="text-[#6b6b6b] shrink-0" /> : <ChevronRight size={12} className="text-[#6b6b6b] shrink-0" />}
                        <span className="text-white text-xs truncate">{m.nome}</span>
                        {(m.secoes?.length ?? 0) > 0 && <span className="text-[9px] text-[#6b6b6b] shrink-0">({m.secoes!.length})</span>}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.url && <a href={m.url} target="_blank" rel="noreferrer" className="p-1 text-[#a3a3a3] hover:text-[#f97316]"><Link2 size={11} /></a>}
                        <button onClick={() => removeManual(m.id)} className="p-1 text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded"><Trash2 size={11} /></button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="px-2 pb-2 space-y-1.5">
                        {(m.tags?.length ?? 0) > 0 && <p className="text-[9px] text-[#6b6b6b]">{m.tags!.join(' · ')}</p>}
                        {secoes.map((s) => (
                          <div key={s.id} className="rounded border border-[#525252]/60 bg-[#333333] p-2">
                            <p className="text-[11px] font-semibold text-[#f5f5f5]">{s.titulo}</p>
                            <p className="text-[10px] text-[#a3a3a3] whitespace-pre-wrap mt-0.5">{s.texto}</p>
                          </div>
                        ))}
                        <SecaoAdder onAdd={(titulo, texto) => patchManual(m.id, [...(m.secoes ?? []), { id: uid(), titulo, texto }])} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SecaoAdder({ onAdd }: { onAdd: (titulo: string, texto: string) => void }) {
  const [open, setOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [texto, setTexto] = useState('')
  if (!open) return <button onClick={() => setOpen(true)} className="text-[10px] text-[#f97316] hover:text-[#fb923c] flex items-center gap-1"><Plus size={10} /> seção</button>
  return (
    <div className="space-y-1.5 rounded border border-[#525252] bg-[#333333] p-2">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título da seção *" className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-[10px] text-white outline-none focus:border-[#f97316]/60" />
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Texto / passos" rows={3} className="w-full bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-[10px] text-white outline-none focus:border-[#f97316]/60" />
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="px-2 py-0.5 rounded text-[10px] text-[#a3a3a3] hover:text-white"><X size={11} /></button>
        <button onClick={() => { if (titulo.trim()) { onAdd(titulo.trim(), texto.trim()); setTitulo(''); setTexto(''); setOpen(false) } }} className="px-2.5 py-0.5 rounded text-[10px] font-semibold text-white bg-[#f97316] hover:bg-[#ea580c]">Salvar</button>
      </div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 rounded-full bg-[#2c2c2c] border border-[#525252] text-[#a3a3a3]">{children}</span>
}
