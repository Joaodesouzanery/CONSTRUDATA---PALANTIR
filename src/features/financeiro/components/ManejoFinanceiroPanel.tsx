/**
 * ManejoFinanceiroPanel — inbox de obrigações financeiras de contratos.
 * Layout em 3 zonas: filtros (esquerda), estatísticas + gráfico (topo) e
 * tabela de contratos com drawer de detalhes (direita). CRUD completo.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, FileText, Filter, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { isDemoModeEnabled } from '@/lib/runtimeMode'
import { useManejoFinanceiroStore } from '@/store/manejoFinanceiroStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { ManejoContrato, ManejoContratoStatus, ManejoMotivoSinalizacao } from '@/types'

function fmtBRL(n: number) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtBRLShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return 'R$ ' + (n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi'
  if (Math.abs(n) >= 1_000) return 'R$ ' + (n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil'
  return fmtBRL(n)
}
function fmtData(d: string | null) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

/** Dias decorridos desde o fim do período de execução (null = sem fim definido ou ainda dentro do período). */
function diasAposFim(c: ManejoContrato): number | null {
  if (!c.fimPeriodoExecucao) return null
  const diff = Math.floor((Date.now() - new Date(`${c.fimPeriodoExecucao}T00:00:00`).getTime()) / 86_400_000)
  return diff > 0 ? diff : null
}

const STATUS_LABEL: Record<ManejoContratoStatus, string> = {
  ativo: 'Ativo', encerrado: 'Encerrado', desobrigado: 'Desobrigado',
}
const MOTIVO_LABEL: Record<ManejoMotivoSinalizacao, string> = {
  'periodo-encerrado': 'Período de execução encerrado',
  'sem-movimentacao': 'Sem movimentação recente',
  'saldo-residual': 'Saldo residual baixo',
}

type FaixaValor = 'ate-500k' | '500k-2mi' | 'acima-2mi'
const FAIXAS: { key: FaixaValor; label: string; test: (v: number) => boolean }[] = [
  { key: 'ate-500k', label: 'Até R$ 500 mil', test: (v) => v <= 500_000 },
  { key: '500k-2mi', label: 'R$ 500 mil – 2 mi', test: (v) => v > 500_000 && v <= 2_000_000 },
  { key: 'acima-2mi', label: 'Acima de R$ 2 mi', test: (v) => v > 2_000_000 },
]
type FaixaDias = '30' | '90' | '180'
const FAIXAS_DIAS: { key: FaixaDias; label: string; min: number }[] = [
  { key: '30', label: 'Mais de 30 dias', min: 30 },
  { key: '90', label: 'Mais de 90 dias', min: 90 },
  { key: '180', label: 'Mais de 180 dias', min: 180 },
]

interface Filtros {
  status: ManejoContratoStatus[]
  faixas: FaixaValor[]
  dias: FaixaDias[]
  motivos: ManejoMotivoSinalizacao[]
}
const FILTROS_VAZIOS: Filtros = { status: [], faixas: [], dias: [], motivos: [] }

function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] }

export function ManejoFinanceiroPanel() {
  const store = useManejoFinanceiroStore()
  const { contratos } = store
  const profileOrgId = useAuth((s) => s.profile?.organization_id)
  const [filtros, setFiltros] = useState<Filtros>({ ...FILTROS_VAZIOS })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<ManejoContrato | null>(null)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [desobrigandoId, setDesobrigandoId] = useState<string | null>(null)

  useEffect(() => {
    if (!profileOrgId) return
    store.ensureTenantScope(profileOrgId)
    if (isDemoModeEnabled()) return
    void (async () => { await store.flush(); await store.pull() })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileOrgId])

  const filtrados = useMemo(() => {
    return contratos.filter((c) => {
      if (filtros.status.length && !filtros.status.includes(c.status)) return false
      if (filtros.faixas.length && !filtros.faixas.some((f) => FAIXAS.find((x) => x.key === f)?.test(c.valorRestante))) return false
      if (filtros.dias.length) {
        const dias = diasAposFim(c)
        if (dias === null || !filtros.dias.some((d) => dias > (FAIXAS_DIAS.find((x) => x.key === d)?.min ?? 0))) return false
      }
      if (filtros.motivos.length && (!c.motivoSinalizacao || !filtros.motivos.includes(c.motivoSinalizacao))) return false
      return true
    })
  }, [contratos, filtros])

  // ── Estatísticas ──
  const totalRestanteAtivos = contratos.filter((c) => c.status === 'ativo').reduce((s, c) => s + c.valorRestante, 0)
  const desobrigadoPorAno = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of contratos) {
      if (c.status !== 'desobrigado' || !c.desobrigadoEm) continue
      const ano = c.desobrigadoEm.slice(0, 4)
      map.set(ano, (map.get(ano) ?? 0) + c.valorTotalObrigado)
    }
    return map
  }, [contratos])
  const anos = [...desobrigadoPorAno.keys()].sort()
  const anoRecente = anos[anos.length - 1]
  const anoAnterior = anos[anos.length - 2]
  const maxAno = Math.max(1, ...desobrigadoPorAno.values())

  const selected = contratos.find((c) => c.id === selectedId) ?? null
  const deleting = contratos.find((c) => c.id === deletingId) ?? null
  const desobrigando = contratos.find((c) => c.id === desobrigandoId) ?? null

  function countStatus(s: ManejoContratoStatus) { return contratos.filter((c) => c.status === s).length }
  function countFaixa(f: FaixaValor) { return contratos.filter((c) => FAIXAS.find((x) => x.key === f)?.test(c.valorRestante)).length }
  function countDias(d: FaixaDias) {
    const min = FAIXAS_DIAS.find((x) => x.key === d)?.min ?? 0
    return contratos.filter((c) => { const dias = diasAposFim(c); return dias !== null && dias > min }).length
  }
  function countMotivo(m: ManejoMotivoSinalizacao) { return contratos.filter((c) => c.motivoSinalizacao === m).length }

  const checkbox = 'h-3.5 w-3.5 accent-[#f97316]'
  const filtroRow = 'flex items-center justify-between gap-2 text-xs text-[#a3a3a3] hover:text-[#f5f5f5] cursor-pointer'

  return (
    <div className="flex h-full min-h-0">
      {/* ── Filtros ── */}
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-[#525252] bg-[#2c2c2c] p-4 lg:block">
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f5f5f5]"><Filter size={13} /> Filtros</span>
          {(filtros.status.length + filtros.faixas.length + filtros.dias.length + filtros.motivos.length) > 0 && (
            <button onClick={() => setFiltros({ ...FILTROS_VAZIOS })} className="text-[10px] text-[#f97316] hover:underline">Limpar</button>
          )}
        </div>

        <FiltroGrupo titulo="Status">
          {(Object.keys(STATUS_LABEL) as ManejoContratoStatus[]).map((s) => (
            <label key={s} className={filtroRow}>
              <span className="flex items-center gap-2">
                <input type="checkbox" className={checkbox} checked={filtros.status.includes(s)} onChange={() => setFiltros({ ...filtros, status: toggle(filtros.status, s) })} />
                {STATUS_LABEL[s]}
              </span>
              <span className="font-mono text-[10px] text-[#6b6b6b]">{countStatus(s)}</span>
            </label>
          ))}
        </FiltroGrupo>

        <FiltroGrupo titulo="Valor restante">
          {FAIXAS.map((f) => (
            <label key={f.key} className={filtroRow}>
              <span className="flex items-center gap-2">
                <input type="checkbox" className={checkbox} checked={filtros.faixas.includes(f.key)} onChange={() => setFiltros({ ...filtros, faixas: toggle(filtros.faixas, f.key) })} />
                {f.label}
              </span>
              <span className="font-mono text-[10px] text-[#6b6b6b]">{countFaixa(f.key)}</span>
            </label>
          ))}
        </FiltroGrupo>

        <FiltroGrupo titulo="Dias após o fim do período">
          {FAIXAS_DIAS.map((d) => (
            <label key={d.key} className={filtroRow}>
              <span className="flex items-center gap-2">
                <input type="checkbox" className={checkbox} checked={filtros.dias.includes(d.key)} onChange={() => setFiltros({ ...filtros, dias: toggle(filtros.dias, d.key) })} />
                {d.label}
              </span>
              <span className="font-mono text-[10px] text-[#6b6b6b]">{countDias(d.key)}</span>
            </label>
          ))}
        </FiltroGrupo>

        <FiltroGrupo titulo="Motivo da sinalização">
          {(Object.keys(MOTIVO_LABEL) as ManejoMotivoSinalizacao[]).map((m) => (
            <label key={m} className={filtroRow}>
              <span className="flex items-center gap-2">
                <input type="checkbox" className={checkbox} checked={filtros.motivos.includes(m)} onChange={() => setFiltros({ ...filtros, motivos: toggle(filtros.motivos, m) })} />
                {MOTIVO_LABEL[m]}
              </span>
              <span className="font-mono text-[10px] text-[#6b6b6b]">{countMotivo(m)}</span>
            </label>
          ))}
        </FiltroGrupo>
      </aside>

      {/* ── Conteúdo principal ── */}
      <div className="min-w-0 flex-1 overflow-y-auto p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">Manejo Financeiro — Obrigações de Contratos</h2>
            <p className="text-[10px] text-[#6b6b6b]">{filtrados.length} de {contratos.length} contratos exibidos</p>
          </div>
          <div className="flex items-center gap-2">
            {contratos.length === 0 && (
              <button onClick={store.loadDemoData} className="flex items-center gap-1.5 rounded-lg bg-[#484848] px-3 py-2 text-xs font-semibold text-[#f5f5f5] transition-colors hover:bg-[#525252]">
                <Download size={13} /> Carregar Demo
              </button>
            )}
            <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c]">
              <Plus size={14} /> Novo Contrato
            </button>
          </div>
        </div>

        {/* Stat cards + gráfico */}
        <div className="grid gap-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_1.4fr]">
          <StatCard label="Não gasto — total restante" value={totalRestanteAtivos} accent="#f97316" />
          <StatCard label={`Desobrigado ${anoAnterior ?? '—'}`} value={anoAnterior ? desobrigadoPorAno.get(anoAnterior) ?? 0 : 0} accent="#38bdf8" />
          <StatCard label={`Desobrigado ${anoRecente ?? '—'}`} value={anoRecente ? desobrigadoPorAno.get(anoRecente) ?? 0 : 0} accent="#22c55e" />
          <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">Desobrigações por ano</p>
            {anos.length === 0 ? (
              <p className="text-xs text-[#6b6b6b]">Sem desobrigações registradas.</p>
            ) : (
              <div className="flex h-20 items-end gap-3">
                {anos.map((ano) => {
                  const v = desobrigadoPorAno.get(ano) ?? 0
                  return (
                    <div key={ano} className="flex flex-1 flex-col items-center gap-1">
                      <span className="font-mono text-[9px] text-[#a3a3a3]">{fmtBRLShort(v)}</span>
                      <div className="w-full max-w-[48px] rounded-t bg-[#22c55e]/80" style={{ height: `${Math.max(6, (v / maxAno) * 56)}px` }} />
                      <span className="font-mono text-[10px] text-[#6b6b6b]">{ano}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tabela de contratos */}
        {filtrados.length === 0 ? (
          <div className="rounded-xl border border-[#525252] py-12 text-center text-sm text-[#6b6b6b]">
            {contratos.length === 0 ? 'Nenhum contrato cadastrado. Crie o primeiro ou carregue os dados demo.' : 'Nenhum contrato corresponde aos filtros.'}
          </div>
        ) : (
          <div className="overflow-auto rounded-xl border border-[#525252]">
            <table className="w-full min-w-[860px] text-xs">
              <thead>
                <tr className="bg-[#1f1f1f] text-[10px] uppercase tracking-wider text-[#a3a3a3]">
                  <th className="px-3 py-2 text-left">Título</th>
                  <th className="px-3 py-2 text-left">Início do Contrato</th>
                  <th className="px-3 py-2 text-right">Valor Total Obrigado</th>
                  <th className="px-3 py-2 text-right">Valor Restante</th>
                  <th className="px-3 py-2 text-left">Fim do Período</th>
                  <th className="px-3 py-2 text-right">Dias Após o Fim</th>
                  <th className="px-3 py-2 text-center">Sinalizado?</th>
                  <th className="px-3 py-2 text-left">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2937]">
                {filtrados.map((c) => {
                  const dias = diasAposFim(c)
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`cursor-pointer transition-colors hover:bg-white/[0.04] ${selectedId === c.id ? 'bg-[#f97316]/[0.08]' : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2 text-white">
                          <FileText size={12} className="shrink-0 text-[#f97316]" />
                          {c.titulo}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-[#a3a3a3]">{fmtData(c.inicioContrato)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-white">{fmtBRL(c.valorTotalObrigado)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#a3a3a3]">{fmtBRL(c.valorRestante)}</td>
                      <td className="px-3 py-2.5 tabular-nums text-[#a3a3a3]">{fmtData(c.fimPeriodoExecucao)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-[#a3a3a3]">{dias ?? '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${c.sinalizadoPeloModelo ? 'border-red-400/40 bg-red-500/10 text-red-300' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'}`}>
                          {c.sinalizadoPeloModelo ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[#6b6b6b]">{c.motivoSinalizacao ? MOTIVO_LABEL[c.motivoSinalizacao] : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Drawer de detalhes ── */}
      {selected && (
        <ContratoDetalhesDrawer
          contrato={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditing(selected)}
          onDelete={() => setDeletingId(selected.id)}
          onDesobrigar={() => setDesobrigandoId(selected.id)}
        />
      )}

      {/* ── Modais ── */}
      {(creating || editing) && (
        <ContratoFormModal
          initial={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSubmit={(values) => {
            if (editing) store.updateContrato(editing.id, values)
            else store.addContrato({ ...values, anexos: [], desobrigadoEm: null })
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      <ConfirmDialog
        open={deletingId !== null}
        title="Excluir contrato"
        message={`"${deleting?.titulo ?? ''}" será removido do manejo financeiro. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        onConfirm={() => { if (deletingId) { store.removeContrato(deletingId); if (selectedId === deletingId) setSelectedId(null) } setDeletingId(null) }}
        onCancel={() => setDeletingId(null)}
      />

      <ConfirmDialog
        open={desobrigandoId !== null}
        destructive={false}
        title="Desobrigar contrato"
        message={`Confirmar a desobrigação de "${desobrigando?.titulo ?? ''}"? O status passa a "Desobrigado" com a data de hoje.`}
        confirmLabel="Desobrigar"
        onConfirm={() => { if (desobrigandoId) store.desobrigarContrato(desobrigandoId); setDesobrigandoId(null) }}
        onCancel={() => setDesobrigandoId(null)}
      />
    </div>
  )
}

function FiltroGrupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#6b6b6b]">{titulo}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">{label}</p>
      <p className="mt-2 font-mono text-xl font-bold leading-tight" style={{ color: accent }}>{fmtBRL(value)}</p>
    </div>
  )
}

/* ── Drawer lateral com os detalhes do contrato ───────────────────────── */

function ContratoDetalhesDrawer({
  contrato, onClose, onEdit, onDelete, onDesobrigar,
}: {
  contrato: ManejoContrato
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  onDesobrigar: () => void
}) {
  const { updateContrato } = useManejoFinanceiroStore()
  const [novoAnexo, setNovoAnexo] = useState('')
  const dias = diasAposFim(contrato)

  function addAnexo() {
    const nome = novoAnexo.trim()
    if (!nome) return
    updateContrato(contrato.id, { anexos: [...contrato.anexos, { id: crypto.randomUUID(), nome }] })
    setNovoAnexo('')
  }

  function removeAnexo(id: string) {
    updateContrato(contrato.id, { anexos: contrato.anexos.filter((a) => a.id !== id) })
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-[150] flex w-full max-w-md flex-col border-l border-[#525252] bg-[#333333] shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-[#525252] px-5 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#f97316]">Detalhes do Contrato</p>
          <h3 className="mt-1 text-sm font-bold leading-snug text-white">{contrato.titulo}</h3>
        </div>
        <button onClick={onClose} className="shrink-0 text-[#6b6b6b] transition-colors hover:text-white" aria-label="Fechar detalhes">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
        {/* Visão geral */}
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Status" valor={STATUS_LABEL[contrato.status]} destaque={contrato.status === 'desobrigado' ? '#22c55e' : contrato.status === 'ativo' ? '#38bdf8' : undefined} />
          <Campo label="Sinalizado pelo modelo" valor={contrato.sinalizadoPeloModelo ? 'Sim' : 'Não'} destaque={contrato.sinalizadoPeloModelo ? '#ef4444' : undefined} />
          <Campo label="Início do contrato" valor={fmtData(contrato.inicioContrato)} />
          <Campo label="Fim do período de execução" valor={fmtData(contrato.fimPeriodoExecucao)} />
          <Campo label="Valor total obrigado" valor={fmtBRL(contrato.valorTotalObrigado)} mono />
          <Campo label="Valor restante" valor={fmtBRL(contrato.valorRestante)} mono destaque="#f97316" />
          <Campo label="Dias após o fim do período" valor={dias !== null ? String(dias) : '—'} mono />
          <Campo label="Desobrigado em" valor={fmtData(contrato.desobrigadoEm)} />
        </div>
        {contrato.motivoSinalizacao && (
          <div className="rounded-lg border border-red-400/30 bg-red-500/[0.06] px-3 py-2 text-xs text-red-300">
            Motivo da sinalização: {MOTIVO_LABEL[contrato.motivoSinalizacao]}
          </div>
        )}

        {/* Anexos */}
        <div>
          <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]">
            <Paperclip size={12} /> Anexos / Documentos ({contrato.anexos.length})
          </p>
          <div className="space-y-1.5">
            {contrato.anexos.map((a) => (
              <div key={a.id} className="group flex items-center justify-between gap-2 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-xs text-[#f5f5f5]">
                  <FileText size={12} className="shrink-0 text-[#f97316]" />
                  <span className="truncate">{a.nome}</span>
                </span>
                <button onClick={() => removeAnexo(a.id)} className="text-[#6b6b6b] opacity-0 transition-all hover:text-red-400 group-hover:opacity-100" aria-label={`Remover anexo ${a.nome}`}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {contrato.anexos.length === 0 && <p className="text-xs text-[#6b6b6b]">Nenhum documento anexado.</p>}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={novoAnexo}
              onChange={(e) => setNovoAnexo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addAnexo() }}
              placeholder="Nome do documento (ex.: Aditivo-02.pdf)"
              className="h-9 flex-1 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 text-xs text-[#f5f5f5] outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]"
            />
            <button onClick={addAnexo} className="rounded-lg bg-[#484848] px-3 text-xs font-semibold text-[#f5f5f5] transition-colors hover:bg-[#525252]">
              Anexar
            </button>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="space-y-2 border-t border-[#525252] px-5 py-4">
        {contrato.status !== 'desobrigado' && (
          <button onClick={onDesobrigar} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#22c55e] text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-[#16a34a]">
            Desobrigar
          </button>
        )}
        <div className="flex gap-2">
          <button onClick={onEdit} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#484848] text-xs font-semibold text-[#f5f5f5] transition-colors hover:bg-[#525252]">
            <Pencil size={13} /> Editar
          </button>
          <button onClick={onDelete} className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-red-400/40 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/10">
            <Trash2 size={13} /> Excluir
          </button>
        </div>
      </div>
    </aside>
  )
}

function Campo({ label, valor, mono = false, destaque }: { label: string; valor: string; mono?: boolean; destaque?: string }) {
  return (
    <div className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#6b6b6b]">{label}</p>
      <p className={`mt-0.5 text-xs font-semibold ${mono ? 'font-mono tabular-nums' : ''}`} style={{ color: destaque ?? '#f5f5f5' }}>{valor}</p>
    </div>
  )
}

/* ── Modal de criação/edição de contrato ──────────────────────────────── */

function ContratoFormModal({
  initial, onClose, onSubmit,
}: {
  initial: ManejoContrato | null
  onClose: () => void
  onSubmit: (values: Omit<ManejoContrato, 'id' | 'createdAt' | 'anexos' | 'desobrigadoEm'>) => void
}) {
  const [titulo, setTitulo] = useState(initial?.titulo ?? '')
  const [inicio, setInicio] = useState(initial?.inicioContrato ?? '')
  const [fim, setFim] = useState(initial?.fimPeriodoExecucao ?? '')
  const [valorTotal, setValorTotal] = useState(initial ? String(initial.valorTotalObrigado) : '')
  const [valorRestante, setValorRestante] = useState(initial ? String(initial.valorRestante) : '')
  const [status, setStatus] = useState<ManejoContratoStatus>(initial?.status ?? 'ativo')
  const [sinalizado, setSinalizado] = useState(initial?.sinalizadoPeloModelo ?? false)
  const [motivo, setMotivo] = useState<ManejoMotivoSinalizacao | ''>(initial?.motivoSinalizacao ?? '')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const vt = parseFloat(valorTotal)
    const vr = parseFloat(valorRestante)
    if (!titulo.trim() || !inicio || isNaN(vt) || isNaN(vr)) return
    onSubmit({
      titulo: titulo.trim(),
      inicioContrato: inicio,
      fimPeriodoExecucao: fim || null,
      valorTotalObrigado: vt,
      valorRestante: vr,
      status,
      sinalizadoPeloModelo: sinalizado,
      motivoSinalizacao: sinalizado && motivo ? motivo : null,
    })
  }

  const input = 'w-full h-10 rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 text-sm text-[#f5f5f5] outline-none placeholder:text-[#6b6b6b] focus:border-[#f97316]'
  const label = 'mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#a3a3a3]'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4 rounded-xl border border-[#525252] bg-[#333333] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{initial ? 'Editar Contrato' : 'Novo Contrato'}</h3>
          <button type="button" onClick={onClose} className="text-[#6b6b6b] transition-colors hover:text-white" aria-label="Fechar formulário"><X size={16} /></button>
        </div>

        <div>
          <label className={label}>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={input} placeholder="Ex.: Execução de rede coletora — Bacia Norte" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Início do contrato</label>
            <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className={input} required />
          </div>
          <div>
            <label className={label}>Fim do período de execução</label>
            <input type="date" value={fim ?? ''} onChange={(e) => setFim(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Valor total obrigado (R$)</label>
            <input type="number" min={0} step={0.01} value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} className={`${input} font-mono`} required />
          </div>
          <div>
            <label className={label}>Valor restante (R$)</label>
            <input type="number" min={0} step={0.01} value={valorRestante} onChange={(e) => setValorRestante(e.target.value)} className={`${input} font-mono`} required />
          </div>
          <div>
            <label className={label}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as ManejoContratoStatus)} className={input}>
              {(Object.keys(STATUS_LABEL) as ManejoContratoStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Sinalizado pelo modelo?</label>
            <select value={sinalizado ? 'sim' : 'nao'} onChange={(e) => setSinalizado(e.target.value === 'sim')} className={input}>
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </div>
        </div>

        {sinalizado && (
          <div>
            <label className={label}>Motivo da sinalização</label>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value as ManejoMotivoSinalizacao | '')} className={input}>
              <option value="">Selecione...</option>
              {(Object.keys(MOTIVO_LABEL) as ManejoMotivoSinalizacao[]).map((m) => <option key={m} value={m}>{MOTIVO_LABEL[m]}</option>)}
            </select>
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
