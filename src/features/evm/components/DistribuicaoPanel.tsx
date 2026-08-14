/**
 * DistribuicaoPanel — distribui um orçamento (por obra) entre funcionários,
 * terceiros e tarefas, com cálculo ao vivo de alocado, saldo restante, % do
 * orçamento, total por pessoa e totais separados de Funcionários × Terceiros.
 * Persistido no financeiroStore (sincronizado). Pode "lançar como saídas".
 */
import { useMemo, useState } from 'react'
import { Plus, Trash2, Save, Users, HardHat, Wallet, AlertTriangle, Send, FileX2 } from 'lucide-react'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useContractorStore } from '@/store/contractorStore'
import { seededId } from '@/lib/seededId'
import { useAuth } from '@/lib/auth'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useStoreSync } from '@/lib/useStoreSync'
import { formatCurrency } from '@/lib/utils'
import type { Distribuicao, DistribuicaoLinha } from '@/types'

function parseMoney(s: string): number {
  const v = parseFloat(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(v) ? v : 0
}
const uid = () => crypto.randomUUID()

const input = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60'
const labelCls = 'block text-[#a3a3a3] text-xs mb-1'

function emptyDist(): Distribuicao {
  const now = new Date().toISOString()
  return { id: uid(), obraId: undefined, titulo: '', orcamento: 0, linhas: [], createdAt: now, updatedAt: now }
}

export function DistribuicaoPanel() {
  // Carrega listas de apoio (idempotente)
  useStoreSync(useMaoDeObraStore)
  const sites = useTorreStore((s) => s.sites)
  const workers = useMaoDeObraStore((s) => s.workers)
  const contractors = useContractorStore((s) => s.contractors)
  const activities = usePlanejamentoMestreStore((s) => s.activities)
  const distribuicoes = useFinanceiroStore((s) => s.distribuicoes)
  const upsertDistribuicao = useFinanceiroStore((s) => s.upsertDistribuicao)
  const removeDistribuicao = useFinanceiroStore((s) => s.removeDistribuicao)
  const addEntry = useFinanceiroStore((s) => s.addEntry)
  const orgId = useAuth((s) => s.profile?.organization_id)

  const [dist, setDist] = useState<Distribuicao>(emptyDist)
  const [orcamentoStr, setOrcamentoStr] = useState('')
  const [savedFlag, setSavedFlag] = useState(false)

  const activeWorkers = workers.filter((w) => w.status === 'active')
  const activeContractors = contractors.filter((c) => c.status === 'active' && !c.deleted_at)

  const orcamento = dist.orcamento
  const calc = useMemo(() => {
    const alocado = dist.linhas.reduce((s, l) => s + (l.valor || 0), 0)
    const totalFunc = dist.linhas.filter((l) => l.beneficiarioTipo === 'funcionario').reduce((s, l) => s + (l.valor || 0), 0)
    const totalTerc = dist.linhas.filter((l) => l.beneficiarioTipo === 'terceiro').reduce((s, l) => s + (l.valor || 0), 0)
    // por pessoa (mesma pessoa pode ter várias linhas)
    const porPessoa = new Map<string, { nome: string; tipo: DistribuicaoLinha['beneficiarioTipo']; valor: number }>()
    for (const l of dist.linhas) {
      const key = `${l.beneficiarioTipo}:${l.beneficiarioId ?? l.beneficiarioNome}`
      const prev = porPessoa.get(key)
      porPessoa.set(key, { nome: l.beneficiarioNome || '—', tipo: l.beneficiarioTipo, valor: (prev?.valor ?? 0) + (l.valor || 0) })
    }
    return { alocado, restante: orcamento - alocado, totalFunc, totalTerc, porPessoa: [...porPessoa.values()] }
  }, [dist.linhas, orcamento])

  const pct = (v: number) => (orcamento > 0 ? `${((v / orcamento) * 100).toFixed(1)}%` : '—')
  const overBudget = calc.alocado > orcamento && orcamento > 0

  function setObra(obraId: string) {
    const obra = sites.find((o) => o.id === obraId)
    const sugest = obra ? (obra.budgetLines ?? []).reduce((s, b) => s + (b.amount || 0), 0) : 0
    setDist((d) => ({ ...d, obraId: obraId || undefined, titulo: d.titulo || (obra ? `Distribuição — ${obra.name}` : d.titulo) }))
    if (sugest > 0 && !orcamentoStr) { setOrcamentoStr(String(sugest)); setDist((d) => ({ ...d, orcamento: sugest })) }
  }

  function addLinha() {
    setDist((d) => ({ ...d, linhas: [...d.linhas, { id: uid(), beneficiarioTipo: 'funcionario', beneficiarioNome: '', tarefa: '', valor: 0 }] }))
  }
  function patchLinha(id: string, patch: Partial<DistribuicaoLinha>) {
    setDist((d) => ({ ...d, linhas: d.linhas.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  }
  function removeLinha(id: string) {
    setDist((d) => ({ ...d, linhas: d.linhas.filter((l) => l.id !== id) }))
  }

  function handleSave() {
    if (!dist.titulo.trim() && !dist.obraId) {
      setDist((d) => ({ ...d, titulo: 'Distribuição' }))
    }
    const toSave = { ...dist, titulo: dist.titulo.trim() || 'Distribuição', updatedAt: new Date().toISOString() }
    upsertDistribuicao(toSave)
    setDist(toSave)
    setSavedFlag(true)
    setTimeout(() => setSavedFlag(false), 1500)
  }

  function handleLancarSaidas() {
    const today = new Date().toISOString().slice(0, 10)
    for (const l of dist.linhas) {
      if (!l.valor) continue
      addEntry({
        // Id DERIVADO da linha da distribuição, não sorteado: este botão não tinha guard
        // nenhum, então dois cliques (ou dois dispositivos) lançavam a folha inteira duas
        // vezes na DRE. Derivado, o segundo lançamento regrava o mesmo registro.
        id: seededId(orgId, 'distribuicao-saida', dist.id, l.id), tipo: 'saida',
        descricao: `Distribuição: ${l.beneficiarioNome}${l.tarefa ? ` — ${l.tarefa}` : ''}`,
        valor: l.valor, data: today,
        categoria: l.beneficiarioTipo === 'funcionario' ? 'mao_de_obra' : 'subempreiteiros',
        obraId: dist.obraId, referencia: dist.titulo || undefined,
        createdAt: new Date().toISOString(),
      })
    }
    setSavedFlag(true)
    setTimeout(() => setSavedFlag(false), 1500)
  }

  function loadDist(d: Distribuicao) {
    setDist({ ...d })
    setOrcamentoStr(String(d.orcamento || ''))
  }
  function novo() { setDist(emptyDist()); setOrcamentoStr('') }

  const obraLabel = (id?: string) => {
    if (!id) return 'Sem obra'
    const o = sites.find((s) => s.id === id)
    return o ? (o.code ? `${o.code} — ${o.name}` : o.name) : 'Obra'
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]/15">
            <Wallet size={18} className="text-[#f97316]" />
          </div>
          <div>
            <h2 className="text-[#f5f5f5] font-semibold text-base">Distribuição de Orçamento</h2>
            <p className="text-[#6b6b6b] text-xs">Distribua um valor entre funcionários, terceiros e tarefas</p>
          </div>
        </div>
        <button onClick={novo} className="px-3 py-2 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40">Nova distribuição</button>
      </div>

      {/* Setup: obra + orçamento + título */}
      <div className="rounded-xl border border-[#525252] bg-[#333333] p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Obra</label>
          <select className={input} value={dist.obraId ?? ''} onChange={(e) => setObra(e.target.value)}>
            <option value="">— Sem obra —</option>
            {sites.map((o) => <option key={o.id} value={o.id}>{o.code ? `${o.code} — ` : ''}{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Orçamento (R$)</label>
          <input className={input} value={orcamentoStr} onChange={(e) => { setOrcamentoStr(e.target.value); setDist((d) => ({ ...d, orcamento: parseMoney(e.target.value) })) }} placeholder="10.000,00" />
        </div>
        <div>
          <label className={labelCls}>Título</label>
          <input className={input} value={dist.titulo} onChange={(e) => setDist((d) => ({ ...d, titulo: e.target.value }))} placeholder="Ex.: Fechamento Março/2026" />
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Mini label="Orçamento" value={orcamento} color="#a78bfa" />
        <Mini label="Alocado" value={calc.alocado} color="#f97316" sub={pct(calc.alocado)} />
        <Mini label="Restante" value={calc.restante} color={calc.restante < 0 ? '#ef4444' : '#22c55e'} />
        <Mini label="Funcion. × Terceiros" value={calc.totalFunc} value2={calc.totalTerc} color="#38bdf8" />
      </div>
      {overBudget && (
        <div className="flex items-center gap-2 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#ef4444]">
          <AlertTriangle size={14} /> O total alocado ({formatCurrency(calc.alocado)}) passou do orçamento ({formatCurrency(orcamento)}).
        </div>
      )}

      {/* Linhas */}
      <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[#f5f5f5] font-semibold text-sm">Beneficiários</h3>
          <button onClick={addLinha} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c]"><Plus size={14} /> Adicionar linha</button>
        </div>
        {dist.linhas.length === 0 && <p className="text-[#6b6b6b] text-sm italic">Nenhuma linha. Clique em "Adicionar linha".</p>}
        <div className="space-y-2">
          {dist.linhas.map((l) => (
            <div key={l.id} className="grid grid-cols-1 sm:grid-cols-[110px_1fr_1fr_120px_90px_32px] gap-2 items-center">
              {/* tipo */}
              <div className="flex rounded-lg border border-[#525252] overflow-hidden text-[11px]">
                <button onClick={() => patchLinha(l.id, { beneficiarioTipo: 'funcionario', beneficiarioId: undefined })} className={`flex-1 px-2 py-1.5 flex items-center justify-center gap-1 ${l.beneficiarioTipo === 'funcionario' ? 'bg-[#1f6fd1] text-white' : 'text-[#a3a3a3]'}`}><Users size={11} />Func.</button>
                <button onClick={() => patchLinha(l.id, { beneficiarioTipo: 'terceiro', beneficiarioId: undefined })} className={`flex-1 px-2 py-1.5 flex items-center justify-center gap-1 ${l.beneficiarioTipo === 'terceiro' ? 'bg-[#f97316] text-white' : 'text-[#a3a3a3]'}`}><HardHat size={11} />Terc.</button>
              </div>
              {/* beneficiário (select cadastrado OU nome livre) */}
              <div>
                <input
                  className={input}
                  list={`benef-${l.id}`}
                  value={l.beneficiarioNome}
                  onChange={(e) => {
                    const nome = e.target.value
                    const pool = l.beneficiarioTipo === 'funcionario' ? activeWorkers.map((w) => ({ id: w.id, name: w.name })) : activeContractors.map((c) => ({ id: c.id, name: c.name }))
                    const match = pool.find((p) => p.name === nome)
                    patchLinha(l.id, { beneficiarioNome: nome, beneficiarioId: match?.id })
                  }}
                  placeholder={l.beneficiarioTipo === 'funcionario' ? 'Funcionário' : 'Terceiro / empreiteira'}
                />
                <datalist id={`benef-${l.id}`}>
                  {(l.beneficiarioTipo === 'funcionario' ? activeWorkers.map((w) => w.name) : activeContractors.map((c) => c.name)).map((n) => <option key={n} value={n} />)}
                </datalist>
              </div>
              {/* tarefa (opcional) */}
              <div>
                <input className={input} list={`task-${l.id}`} value={l.tarefa ?? ''} onChange={(e) => patchLinha(l.id, { tarefa: e.target.value })} placeholder="Tarefa (opcional)" />
                <datalist id={`task-${l.id}`}>
                  {activities.slice(0, 200).map((a) => <option key={a.id} value={a.name} />)}
                </datalist>
              </div>
              {/* valor */}
              <input className={`${input} text-right`} value={l.valor ? String(l.valor) : ''} onChange={(e) => patchLinha(l.id, { valor: parseMoney(e.target.value) })} placeholder="Valor" />
              {/* % */}
              <div className="text-right text-[11px] text-[#a3a3a3] font-mono">{pct(l.valor || 0)}</div>
              <button onClick={() => removeLinha(l.id)} className="text-red-400 hover:text-red-300 flex items-center justify-center"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>

        {/* por pessoa */}
        {calc.porPessoa.length > 0 && (
          <div className="mt-4 border-t border-[#525252] pt-3">
            <p className="text-[10px] uppercase tracking-wider text-[#6b6b6b] mb-2">Total por pessoa</p>
            <div className="flex flex-wrap gap-2">
              {calc.porPessoa.map((p) => (
                <span key={`${p.tipo}-${p.nome}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2c2c2c] border border-[#525252] text-xs text-[#f5f5f5]">
                  {p.tipo === 'funcionario' ? <Users size={11} className="text-[#1f6fd1]" /> : <HardHat size={11} className="text-[#f97316]" />}
                  {p.nome} · <span className="font-mono">{formatCurrency(p.valor)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#f97316] text-white hover:bg-[#ea580c]"><Save size={14} /> {savedFlag ? 'Salvo!' : 'Salvar distribuição'}</button>
          <button onClick={handleLancarSaidas} disabled={dist.linhas.length === 0} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#f97316]/40 disabled:opacity-50"><Send size={14} /> Lançar como saídas</button>
        </div>
      </div>

      {/* Distribuições salvas */}
      {distribuicoes.length > 0 && (
        <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#6b6b6b] mb-2">Distribuições salvas</p>
          <div className="space-y-1.5">
            {distribuicoes.map((d) => {
              const aloc = d.linhas.reduce((s, l) => s + (l.valor || 0), 0)
              return (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-[#525252]/60 px-3 py-2 hover:bg-[#3d3d3d]/50">
                  <button onClick={() => loadDist(d)} className="flex-1 text-left">
                    <p className="text-[#f5f5f5] text-sm font-medium">{d.titulo || 'Distribuição'}</p>
                    <p className="text-[#6b6b6b] text-xs">{obraLabel(d.obraId)} · {formatCurrency(aloc)} / {formatCurrency(d.orcamento)} · {d.linhas.length} linha(s)</p>
                  </button>
                  <button onClick={() => removeDistribuicao(d.id)} className="text-[#6b6b6b] hover:text-[#ef4444] p-1.5" title="Excluir"><FileX2 size={14} /></button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Mini({ label, value, value2, color, sub }: { label: string; value: number; value2?: number; color: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#333333] p-4">
      <p className="text-[#a3a3a3] text-xs mb-1">{label}</p>
      {value2 === undefined ? (
        <p className="font-mono text-lg font-semibold" style={{ color }}>{formatCurrency(value)}{sub ? <span className="text-[10px] text-[#6b6b6b] ml-1">{sub}</span> : null}</p>
      ) : (
        <p className="font-mono text-sm font-semibold" style={{ color }}>
          {formatCurrency(value)} <span className="text-[#6b6b6b]">×</span> {formatCurrency(value2)}
        </p>
      )}
    </div>
  )
}
