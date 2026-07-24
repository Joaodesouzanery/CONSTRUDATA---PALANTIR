/**
 * PredialWorkbenchPanel — versão code-only (sem IA/LLM) do "Maintenance Workbench":
 * chamado selecionado + passos de troubleshooting (checklist) + tickets similares
 * (heurística de similaridade textual, Jaccard sobre tokens) + repositório de manuais
 * anexados ao ativo (busca por palavra-chave). Sem 3D, sem extração por IA.
 * Os manuais persistem no payload jsonb do ativo (updateAsset) — sem migração.
 */
import { useMemo, useState } from 'react'
import { Search, FileText, Link2, Plus, Trash2, X, ListChecks, Copy, Wrench } from 'lucide-react'
import { useManutencoesStore } from '@/store/manutencoesStore'
import type { MaintenanceAsset, MaintenanceWorkOrder, MaintenanceManual } from '@/store/manutencoesStore'

const STOP = new Set(['de', 'da', 'do', 'dos', 'das', 'no', 'na', 'nos', 'nas', 'em', 'para', 'por', 'com', 'que', 'os', 'as', 'um', 'uma', 'the', 'and', 'to', 'of', 'in', 'ao', 'se', 'sua', 'seu'])
const DIACRITICS = /[̀-ͯ]/g
function tokenize(s: string): Set<string> {
  const m = (s || '').toLowerCase().normalize('NFD').replace(DIACRITICS, '').match(/[a-z0-9]{3,}/g) ?? []
  return new Set(m.filter((t) => !STOP.has(t)))
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}
const uid = () => crypto.randomUUID()
const EMPTY_MANUAIS: MaintenanceManual[] = []

export function PredialWorkbenchPanel() {
  const workOrders = useManutencoesStore((s) => s.workOrders)
  const assets = useManutencoesStore((s) => s.assets)
  const updateAsset = useManutencoesStore((s) => s.updateAsset)

  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const assetById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const list = q ? workOrders.filter((w) => `${w.title} ${w.description} ${w.code}`.toLowerCase().includes(q)) : workOrders
    return [...list].sort((a, b) => (b.scheduledDate || b.createdAt || '').localeCompare(a.scheduledDate || a.createdAt || ''))
  }, [workOrders, busca])

  const selected = workOrders.find((w) => w.id === selectedId) ?? filtered[0] ?? null

  const similares = useMemo(() => {
    if (!selected) return []
    const woText = (w: MaintenanceWorkOrder) => `${w.title} ${w.description} ${(w.assetIds ?? []).map((id) => assetById.get(id)?.type ?? '').join(' ')}`
    const base = tokenize(woText(selected))
    return workOrders
      .filter((w) => w.id !== selected.id)
      .map((w) => ({ w, score: jaccard(base, tokenize(woText(w))) }))
      .filter((x) => x.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
  }, [selected, workOrders, assetById])

  const asset = selected ? (selected.assetIds ?? []).map((id) => assetById.get(id)).find(Boolean) ?? null : null

  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6 overflow-auto">
      {/* Lista de chamados */}
      <div className="lg:w-[320px] shrink-0 flex flex-col gap-2">
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

      {/* Chamado + troubleshooting */}
      <div className="flex-1 min-w-0 space-y-5">
        {!selected ? (
          <div className="text-[#6b6b6b] text-sm py-16 text-center rounded-xl border border-dashed border-[#525252]">Selecione um chamado.</div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
              <div className="flex items-center gap-2 mb-2">
                <Wrench size={15} className="text-[#f97316]" />
                <h2 className="text-white font-semibold text-sm">{selected.title || selected.code}</h2>
              </div>
              <p className="text-[#a3a3a3] text-sm whitespace-pre-wrap">{selected.description || 'Sem descrição.'}</p>
              <div className="flex flex-wrap gap-2 mt-3 text-[10px]">
                <Tag>{selected.code}</Tag>
                <Tag>Status: {selected.status}</Tag>
                <Tag>Prioridade: {selected.priority}</Tag>
                {asset && <Tag>Ativo: {asset.name || asset.code}</Tag>}
              </div>
            </div>

            {selected.checklist?.length > 0 && (
              <div className="rounded-2xl border border-[#525252] bg-[#333333] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks size={15} className="text-[#a3a3a3]" />
                  <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">Passos de troubleshooting</p>
                </div>
                <ol className="space-y-1.5">
                  {selected.checklist.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#d4d4d4]">
                      <span className="w-5 h-5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </div>

      {/* Similares + Manuais */}
      <div className="lg:w-[340px] shrink-0 space-y-5">
        <div className="rounded-2xl border border-[#525252] bg-[#333333] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Copy size={14} className="text-[#a3a3a3]" />
            <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">Chamados similares</p>
          </div>
          {similares.length === 0 ? (
            <p className="text-[#6b6b6b] text-xs py-4 text-center">Nenhum similar encontrado.</p>
          ) : (
            <div className="space-y-1.5">
              {similares.map(({ w, score }) => (
                <button key={w.id} onClick={() => setSelectedId(w.id)} className="w-full text-left rounded-lg border border-[#525252] bg-[#2c2c2c] p-2.5 hover:border-[#f97316]/50 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white text-xs truncate">{w.title || w.code}</p>
                    <span className="text-[10px] text-[#f97316] font-mono shrink-0">{Math.round(score * 100)}%</span>
                  </div>
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

function ManuaisSection({ asset, onSave }: { asset: MaintenanceAsset | null; onSave: (m: MaintenanceManual[]) => void }) {
  const [busca, setBusca] = useState('')
  const [adding, setAdding] = useState(false)
  const [nome, setNome] = useState('')
  const [url, setUrl] = useState('')
  const [tags, setTags] = useState('')

  const manuais = asset?.manuais ?? EMPTY_MANUAIS
  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return manuais
    return manuais.filter((m) => `${m.nome} ${(m.tags ?? []).join(' ')}`.toLowerCase().includes(q))
  }, [manuais, busca])

  function add() {
    if (!nome.trim() || !asset) return
    const novo: MaintenanceManual = { id: uid(), nome: nome.trim(), url: url.trim() || undefined, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) }
    onSave([...manuais, novo])
    setNome(''); setUrl(''); setTags(''); setAdding(false)
  }
  function remove(id: string) { onSave(manuais.filter((m) => m.id !== id)) }

  return (
    <div className="rounded-2xl border border-[#525252] bg-[#333333] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="text-[#a3a3a3]" />
          <p className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-wider">Manuais {asset ? `· ${asset.name || asset.code}` : ''}</p>
        </div>
        {asset && (
          <button onClick={() => setAdding((v) => !v)} className="p-1 rounded text-[#a3a3a3] hover:bg-white/10 hover:text-[#f97316]"><Plus size={14} /></button>
        )}
      </div>

      {!asset ? (
        <p className="text-[#6b6b6b] text-xs py-3 text-center">O chamado não tem ativo vinculado.</p>
      ) : (
        <>
          <div className="relative mb-2">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar manual/palavra-chave…"
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

          {filtered.length === 0 ? (
            <p className="text-[#6b6b6b] text-xs py-3 text-center">{manuais.length === 0 ? 'Nenhum manual anexado.' : 'Nenhum manual no filtro.'}</p>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((m) => (
                <div key={m.id} className="group flex items-center justify-between gap-2 rounded-lg border border-[#525252] bg-[#2c2c2c] p-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {m.url ? (
                        <a href={m.url} target="_blank" rel="noreferrer" className="text-white text-xs truncate hover:text-[#f97316] flex items-center gap-1"><Link2 size={11} />{m.nome}</a>
                      ) : (
                        <span className="text-white text-xs truncate">{m.nome}</span>
                      )}
                    </div>
                    {(m.tags?.length ?? 0) > 0 && <p className="text-[9px] text-[#6b6b6b] truncate">{m.tags!.join(' · ')}</p>}
                  </div>
                  <button onClick={() => remove(m.id)} className="p-1 rounded text-red-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 shrink-0"><Trash2 size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="px-2 py-0.5 rounded-full bg-[#2c2c2c] border border-[#525252] text-[#a3a3a3]">{children}</span>
}
