/**
 * ExecucaoPanel — "Planejamento de Execução" (modo Compizzo).
 * Lista de planos por obra + editor com 5 seções (cabeçalho, cronograma, equipe,
 * bonificação, condições). Cálculos automáticos + export PDF branded.
 * Edição por papel; demais em modo visualização. Inputs de texto/número commitam no blur.
 */
import { useMemo } from 'react'
import { ArrowLeft, Plus, Trash2, FileDown, Copy, CalendarRange, AlertTriangle, Send, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useStoreSync } from '@/lib/useStoreSync'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { usePlanoExecucaoStore } from '@/store/planoExecucaoStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useRdoStore } from '@/store/rdoStore'
import { useFinanceiroStore } from '@/store/financeiroStore'
import { parseLocaleNumber } from '@/lib/numberFormat'
import type { PlanoExecucao } from '@/types'
import {
  bonificacaoValor, bonificacaoTotal, bonusDiario, diasCorridos, dayOfWeekLabel,
  eachDay, faturamento, fmtBRL, fmtDataCurta, fmtDataLonga, isWeekend,
  alertasDoPlano, faltasNoPeriodo,
} from '../utils/planoExecucao'
import { printPlanoExecucaoPdf } from '../utils/planoExecucaoPdf'

const EDIT_ROLES = ['owner', 'diretor', 'gerente', 'engenheiro', 'planejador']

const inp = 'bg-[#2d2d2d] border border-[#525252] rounded px-2 py-1.5 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316] w-full'
const lbl = 'text-[10px] font-semibold uppercase tracking-wider text-[#9a9a9a] mb-1 block'
const bar = 'flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white bg-[#2b2c6b] px-3 py-2 rounded-t'

const STATUS_LABEL: Record<PlanoExecucao['status'], string> = {
  rascunho: 'Rascunho', ativo: 'Ativo', concluido: 'Concluído',
}

export function ExecucaoPanel() {
  useStoreSync(usePlanoExecucaoStore)
  const role = useAuth((s) => s.profile?.role)
  const canEdit = !!role && EDIT_ROLES.includes(role)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const sites = useTorreStore((s) => s.sites)

  const allPlanos = usePlanoExecucaoStore((s) => s.planos)
  const editingId = usePlanoExecucaoStore((s) => s.editingId)
  const setEditing = usePlanoExecucaoStore((s) => s.setEditing)
  const addPlano = usePlanoExecucaoStore((s) => s.addPlano)

  const planos = useMemo(
    () => (activeObraId ? allPlanos.filter((p) => (p.siteId ?? null) === activeObraId) : allPlanos),
    [allPlanos, activeObraId],
  )
  const editing = editingId ? allPlanos.find((p) => p.id === editingId) ?? null : null

  if (editing) return <PlanoEditor plano={editing} canEdit={canEdit} onBack={() => setEditing(null)} />

  function novoPlano() {
    const site = activeObraId ? sites.find((s) => s.id === activeObraId) : null
    addPlano({ obraNome: site?.name ?? '' })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#f5f5f5]">Planejamento de Execução</h2>
          <p className="text-xs text-[#9a9a9a]">Plano por obra e período, com cronograma, equipe e bonificação por m².</p>
        </div>
        {canEdit && (
          <button onClick={novoPlano} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-[#f97316] hover:bg-[#ea580c] text-white transition-colors">
            <Plus size={15} /> Novo plano de execução
          </button>
        )}
      </div>

      {planos.length === 0 ? (
        <div className="border border-dashed border-[#525252] rounded-xl p-10 text-center text-sm text-[#9a9a9a]">
          Nenhum plano de execução {activeObraId ? 'nesta obra' : ''} ainda.{canEdit ? ' Clique em "Novo plano de execução" para começar.' : ''}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {planos.map((p) => (
            <button key={p.id} onClick={() => setEditing(p.id)}
              className="text-left bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 hover:border-[#f97316] transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#f5f5f5] truncate">{p.obraNome || 'Sem obra'}</span>
                <span className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded ${p.status === 'ativo' ? 'bg-emerald-600/30 text-emerald-300' : p.status === 'concluido' ? 'bg-blue-600/30 text-blue-300' : 'bg-[#525252] text-[#c9c9c9]'}`}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              <div className="mt-2 text-xs text-[#a3a3a3]">{p.servico}</div>
              <div className="mt-2 text-[11px] text-[#9a9a9a]">
                {p.periodoInicio && p.periodoFim ? `${fmtDataLonga(p.periodoInicio)} a ${fmtDataLonga(p.periodoFim)}` : 'Sem período'} · {p.areaM2.toLocaleString('pt-BR')} m²
              </div>
              <div className="mt-1 text-sm font-bold text-[#f59e0b]">{fmtBRL(faturamento(p))}</div>
              {!p.precoConfirmado && <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-400"><AlertTriangle size={11} /> Preço a confirmar</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Editor ─────────────────────────────────────────────────────────────────
function PlanoEditor({ plano, canEdit, onBack }: { plano: PlanoExecucao; canEdit: boolean; onBack: () => void }) {
  const update = usePlanoExecucaoStore((s) => s.updatePlano)
  const duplicate = usePlanoExecucaoStore((s) => s.duplicatePlano)
  const remove = usePlanoExecucaoStore((s) => s.removePlano)
  const id = plano.id
  const ro = !canEdit

  const set = (patch: Partial<Omit<PlanoExecucao, 'id'>>) => update(id, patch)
  const fat = faturamento(plano)
  const total = bonificacaoTotal(plano)
  const dias = diasCorridos(plano)

  // ── Fase 2/3: integrações ──
  const workers = useMaoDeObraStore((s) => s.workers)
  const absences = useMaoDeObraStore((s) => s.absences)
  const rdos = useRdoStore((s) => s.rdos)
  const addEntry = useFinanceiroStore((s) => s.addEntry)
  const hoje = new Date().toISOString().slice(0, 10)
  const alertas = alertasDoPlano(plano, absences, hoje)
  const faltas = faltasNoPeriodo(plano, absences)
  const obraWorkers = useMemo(
    () => workers.filter((w) => (w.siteId || null) === (plano.siteId || null) && w.status === 'active'),
    [workers, plano.siteId],
  )
  const temRdo = (data: string) =>
    rdos.some((r) => (r as { template?: string }).template === 'compizzo'
      && (((r as { siteId?: string | null }).siteId) || null) === (plano.siteId || null)
      && (r as { date?: string }).date === data)

  function enviarFinanceiro() {
    if (plano.financeiroEnviadoEm && !confirm('Este plano já foi enviado ao Financeiro. Enviar novamente pode duplicar os lançamentos. Continuar?')) return
    const now = new Date().toISOString()
    const ref = `Plano Execução ${id.slice(0, 8)}`
    const dataRef = plano.periodoFim || hoje
    addEntry({ id: crypto.randomUUID(), tipo: 'entrada', descricao: `Faturamento — ${plano.servico} (${plano.areaM2} m²)`, valor: fat, data: dataRef, categoria: 'medicao', referencia: ref, obraId: plano.siteId ?? undefined, notas: plano.obraNome, createdAt: now })
    if (total > 0) addEntry({ id: crypto.randomUUID(), tipo: 'saida', descricao: `Bonificação — ${plano.servico}`, valor: total, data: dataRef, categoria: 'mao_de_obra', referencia: ref, obraId: plano.siteId ?? undefined, notas: `Bônus distribuído entre ${plano.bonificacao.length} colaborador(es)`, createdAt: now })
    set({ financeiroEnviadoEm: now })
    alert('Lançado no Financeiro: faturamento (entrada) e bonificação (saída) desta obra.')
  }

  const addFromWorker = (kind: 'equipe' | 'bonif', workerId: string) => {
    const w = obraWorkers.find((x) => x.id === workerId)
    if (!w) return
    if (kind === 'equipe') {
      if (plano.equipe.some((m) => m.workerId === w.id)) return
      set({ equipe: [...plano.equipe, { id: crypto.randomUUID(), workerId: w.id, nome: w.name, funcao: w.role || 'Execução' }] })
    } else {
      if (plano.bonificacao.some((b) => b.workerId === w.id)) return
      set({ bonificacao: [...plano.bonificacao, { id: crypto.randomUUID(), workerId: w.id, nome: w.name, rPorM2: 0 }] })
    }
  }

  function gerarDias() {
    const cronograma = eachDay(plano.periodoInicio, plano.periodoFim).map((data) => {
      const ex = plano.cronograma.find((c) => c.data === data)
      const padrao = isWeekend(data) ? (dayOfWeekLabel(data) === 'DOM' ? 'DOMINGO' : 'SÁBADO') : ''
      return { data, atividade: ex?.atividade ?? padrao }
    })
    set({ cronograma })
  }

  return (
    <div className="p-6 max-w-5xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#c9c9c9] hover:text-white">
          <ArrowLeft size={16} /> Voltar aos planos
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => printPlanoExecucaoPdf(plano)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5]">
            <FileDown size={14} /> Exportar PDF
          </button>
          {canEdit && (
            <>
              <button onClick={() => duplicate(id)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5]">
                <Copy size={14} /> Duplicar
              </button>
              <button onClick={enviarFinanceiro} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5]">
                {plano.financeiroEnviadoEm ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Send size={14} />} {plano.financeiroEnviadoEm ? 'Financeiro enviado' : 'Enviar p/ Financeiro'}
              </button>
              <button onClick={() => { if (confirm('Excluir este plano de execução?')) { remove(id); onBack() } }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-red-900/40 hover:bg-red-900/70 text-red-300">
                <Trash2 size={14} /> Excluir
              </button>
            </>
          )}
        </div>
      </div>

      {ro && <div className="mb-4 text-xs text-[#9a9a9a] bg-[#3d3d3d] border border-[#525252] rounded px-3 py-2">Modo visualização — seu perfil não pode editar planos.</div>}

      {alertas.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {alertas.map((a, i) => (
            <span key={i} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded ${a.severidade === 'vermelho' ? 'bg-red-900/40 text-red-300' : 'bg-amber-900/40 text-amber-300'}`}>
              <AlertTriangle size={12} /> {a.msg}
            </span>
          ))}
        </div>
      )}

      {/* 1. Cabeçalho */}
      <section className="mb-5 bg-[#333] border border-[#525252] rounded-lg overflow-hidden">
        <div className={bar}>Cabeçalho</div>
        <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={lbl}>Obra</label>
            <input className={inp} defaultValue={plano.obraNome} disabled={ro} key={`obra-${id}`} onBlur={(e) => set({ obraNome: e.target.value })} placeholder="Nome da obra" />
          </div>
          <div><label className={lbl}>Meta — início</label><input type="date" className={inp} defaultValue={plano.periodoInicio} disabled={ro} key={`ini-${id}`} onBlur={(e) => set({ periodoInicio: e.target.value })} /></div>
          <div><label className={lbl}>Meta — fim</label><input type="date" className={inp} defaultValue={plano.periodoFim} disabled={ro} key={`fim-${id}`} onBlur={(e) => set({ periodoFim: e.target.value })} /></div>
          <div><label className={lbl}>Área (m²)</label><input className={inp} defaultValue={plano.areaM2 || ''} disabled={ro} key={`area-${id}`} onBlur={(e) => set({ areaM2: parseLocaleNumber(e.target.value) })} placeholder="0" /></div>
          <div className="sm:col-span-2"><label className={lbl}>Serviço</label><input className={inp} defaultValue={plano.servico} disabled={ro} key={`serv-${id}`} onBlur={(e) => set({ servico: e.target.value })} placeholder="Piso Epóxi + Demarcação" /></div>
          <div><label className={lbl}>Preço / m² (R$)</label><input className={inp} defaultValue={plano.precoM2 || ''} disabled={ro} key={`preco-${id}`} onBlur={(e) => set({ precoM2: parseLocaleNumber(e.target.value) })} placeholder="0,00" /></div>
          <div>
            <label className={lbl}>Status</label>
            <select className={inp} value={plano.status} disabled={ro} onChange={(e) => set({ status: e.target.value as PlanoExecucao['status'] })}>
              <option value="rascunho">Rascunho</option><option value="ativo">Ativo</option><option value="concluido">Concluído</option>
            </select>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-xs text-[#c9c9c9]">
              <input type="checkbox" checked={plano.precoConfirmado} disabled={ro} onChange={(e) => set({ precoConfirmado: e.target.checked })} /> Preço confirmado
            </label>
          </div>
        </div>
        <div className="px-4 pb-4 flex items-center gap-6 flex-wrap text-sm">
          <span className="text-[#9a9a9a]">Faturamento previsto: <strong className="text-[#f59e0b] text-base">{fmtBRL(fat)}</strong></span>
          {!plano.precoConfirmado && <span className="flex items-center gap-1 text-amber-400 text-xs"><AlertTriangle size={13} /> confirmar preço fechado</span>}
        </div>
      </section>

      {/* 2. Cronograma */}
      <section className="mb-5 bg-[#333] border border-[#525252] rounded-lg overflow-hidden">
        <div className={bar}>
          Cronograma de execução
          <span className="ml-auto font-normal normal-case text-[10px] text-white/70">{dias} dias corridos</span>
        </div>
        <div className="p-4">
          {canEdit && (
            <div className="flex gap-2 mb-3">
              <button onClick={gerarDias} className="flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5]">
                <CalendarRange size={14} /> Gerar dias do período
              </button>
              <button onClick={() => set({ cronograma: [...plano.cronograma, { data: plano.periodoInicio || '', atividade: '' }] })}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5]">
                <Plus size={14} /> Adicionar dia
              </button>
            </div>
          )}
          {plano.cronograma.length === 0 ? (
            <p className="text-xs text-[#9a9a9a]">Sem dias. {canEdit && 'Defina o período e clique em "Gerar dias do período".'}</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase text-[#9a9a9a] border-b border-[#525252]">
                <th className="text-left py-1.5 w-24">Data</th><th className="text-left w-14">Dia</th><th className="text-left">Atividade</th><th className="w-8" />
              </tr></thead>
              <tbody>
                {plano.cronograma.map((d, i) => {
                  const wknd = isWeekend(d.data)
                  return (
                    <tr key={`${id}-cr-${i}`} className={`border-b border-[#484848] ${wknd ? 'text-[#8a8a8a] italic' : 'text-[#e5e5e5]'}`}>
                      <td className="py-1.5">
                        {canEdit
                          ? <input type="date" className="bg-[#2d2d2d] border border-[#525252] rounded px-1.5 py-1 text-xs text-[#f5f5f5] outline-none" defaultValue={d.data} onBlur={(e) => { const cr = [...plano.cronograma]; cr[i] = { ...cr[i], data: e.target.value }; set({ cronograma: cr }) }} />
                          : fmtDataCurta(d.data)}
                      </td>
                      <td className="text-xs font-semibold">{dayOfWeekLabel(d.data)}{temRdo(d.data) && <span title="Há RDO Compizzo neste dia (executado)" className="ml-1 text-emerald-400 text-[9px]">•RDO</span>}</td>
                      <td>
                        {canEdit
                          ? <input className="bg-[#2d2d2d] border border-[#525252] rounded px-2 py-1 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316] w-full" defaultValue={d.atividade} key={`${id}-atv-${i}`} onBlur={(e) => { const cr = [...plano.cronograma]; cr[i] = { ...cr[i], atividade: e.target.value }; set({ cronograma: cr }) }} placeholder={wknd ? (dayOfWeekLabel(d.data) === 'DOM' ? 'DOMINGO' : 'SÁBADO') : 'Atividade do dia'} />
                          : (d.atividade || (wknd ? '—' : ''))}
                      </td>
                      <td>{canEdit && <button onClick={() => set({ cronograma: plano.cronograma.filter((_, j) => j !== i) })} className="text-[#8a8a8a] hover:text-red-400"><Trash2 size={13} /></button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 3. Equipe */}
      <section className="mb-5 bg-[#333] border border-[#525252] rounded-lg overflow-hidden">
        <div className={bar}>Equipe executora</div>
        <div className="p-4">
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button onClick={() => set({ equipe: [...plano.equipe, { id: crypto.randomUUID(), nome: '', funcao: 'Execução' }] })}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5]">
                <Plus size={14} /> Adicionar funcionário
              </button>
              {obraWorkers.length > 0 && (
                <select value="" onChange={(e) => { if (e.target.value) addFromWorker('equipe', e.target.value) }}
                  className="bg-[#2d2d2d] border border-[#525252] rounded px-2 py-1.5 text-xs text-[#f5f5f5] outline-none">
                  <option value="">+ da Mão de Obra…</option>
                  {obraWorkers.map((w) => <option key={w.id} value={w.id}>{w.name}{w.role ? ` — ${w.role}` : ''}</option>)}
                </select>
              )}
            </div>
          )}
          {plano.equipe.length === 0 ? <p className="text-xs text-[#9a9a9a]">Sem funcionários.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase text-[#9a9a9a] border-b border-[#525252]"><th className="text-left py-1.5">Funcionário</th><th className="text-left w-40">Função</th><th className="w-8" /></tr></thead>
              <tbody>
                {plano.equipe.map((m, i) => (
                  <tr key={m.id} className="border-b border-[#484848] text-[#e5e5e5]">
                    <td className="py-1.5 pr-2">{canEdit ? <input className="bg-[#2d2d2d] border border-[#525252] rounded px-2 py-1 text-sm text-[#f5f5f5] outline-none w-full" defaultValue={m.nome} onBlur={(e) => { const eq = [...plano.equipe]; eq[i] = { ...eq[i], nome: e.target.value }; set({ equipe: eq }) }} placeholder="Nome" /> : m.nome}</td>
                    <td className="pr-2">{canEdit ? <input className="bg-[#2d2d2d] border border-[#525252] rounded px-2 py-1 text-sm text-[#f5f5f5] outline-none w-full" defaultValue={m.funcao} onBlur={(e) => { const eq = [...plano.equipe]; eq[i] = { ...eq[i], funcao: e.target.value }; set({ equipe: eq }) }} placeholder="Execução" /> : m.funcao}</td>
                    <td>{canEdit && <button onClick={() => set({ equipe: plano.equipe.filter((_, j) => j !== i) })} className="text-[#8a8a8a] hover:text-red-400"><Trash2 size={13} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 4. Bonificação */}
      <section className="mb-5 bg-[#333] border border-[#525252] rounded-lg overflow-hidden">
        <div className={bar}>Distribuição de tarefa (bonificação)</div>
        <div className="p-4">
          <p className="text-xs text-[#9a9a9a] mb-3">Área base: <strong className="text-[#e5e5e5]">{plano.areaM2.toLocaleString('pt-BR')} m²</strong></p>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button onClick={() => set({ bonificacao: [...plano.bonificacao, { id: crypto.randomUUID(), nome: '', rPorM2: 0 }] })}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5]">
                <Plus size={14} /> Adicionar colaborador
              </button>
              {obraWorkers.length > 0 && (
                <select value="" onChange={(e) => { if (e.target.value) addFromWorker('bonif', e.target.value) }}
                  className="bg-[#2d2d2d] border border-[#525252] rounded px-2 py-1.5 text-xs text-[#f5f5f5] outline-none">
                  <option value="">+ da Mão de Obra…</option>
                  {obraWorkers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              )}
            </div>
          )}
          {plano.bonificacao.length === 0 ? <p className="text-xs text-[#9a9a9a]">Sem colaboradores na bonificação.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] uppercase text-[#9a9a9a] border-b border-[#525252]"><th className="text-left py-1.5">Colaborador</th><th className="text-right w-32">R$/m²</th><th className="text-right w-36">Valor total</th><th className="w-8" /></tr></thead>
              <tbody>
                {plano.bonificacao.map((b, i) => (
                  <tr key={b.id} className="border-b border-[#484848] text-[#e5e5e5]">
                    <td className="py-1.5 pr-2">{canEdit ? <input className="bg-[#2d2d2d] border border-[#525252] rounded px-2 py-1 text-sm text-[#f5f5f5] outline-none w-full" defaultValue={b.nome} onBlur={(e) => { const bo = [...plano.bonificacao]; bo[i] = { ...bo[i], nome: e.target.value }; set({ bonificacao: bo }) }} placeholder="Nome" /> : b.nome}</td>
                    <td className="text-right pr-2">{canEdit ? <input className="bg-[#2d2d2d] border border-[#525252] rounded px-2 py-1 text-sm text-[#f5f5f5] outline-none w-full text-right" defaultValue={b.rPorM2 || ''} onBlur={(e) => { const bo = [...plano.bonificacao]; bo[i] = { ...bo[i], rPorM2: parseLocaleNumber(e.target.value) }; set({ bonificacao: bo }) }} placeholder="0,00" /> : fmtBRL(b.rPorM2)}</td>
                    <td className="text-right pr-2 font-semibold text-[#f5f5f5]">{fmtBRL(bonificacaoValor(b.rPorM2, plano.areaM2))}</td>
                    <td>{canEdit && <button onClick={() => set({ bonificacao: plano.bonificacao.filter((_, j) => j !== i) })} className="text-[#8a8a8a] hover:text-red-400"><Trash2 size={13} /></button>}</td>
                  </tr>
                ))}
                <tr className="text-[#f59e0b] font-bold border-t-2 border-[#2b2c6b]">
                  <td className="py-2">TOTAL</td><td /><td className="text-right pr-2">{fmtBRL(total)}</td><td />
                </tr>
              </tbody>
            </table>
          )}
          <div className="mt-3 text-sm text-[#9a9a9a]">Bônus diário = {fmtBRL(total)} ÷ {dias} dias corridos = <strong className="text-[#e5e5e5]">{fmtBRL(bonusDiario(plano))}</strong> / dia</div>
          {faltas.length > 0 && (
            <div className="mt-2 text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle size={12} /> {faltas.length} falta(s) da equipe no período — nos dias com falta, o bônus diário é redistribuído entre os presentes.</div>
          )}
        </div>
      </section>

      {/* 5. Condições */}
      <section className="mb-5 bg-[#333] border border-[#525252] rounded-lg overflow-hidden">
        <div className={bar}>Condições da tarefa</div>
        <div className="p-4">
          {canEdit
            ? <textarea className={`${inp} resize-y`} rows={6} defaultValue={plano.condicoes} key={`cond-${id}`} onBlur={(e) => set({ condicoes: e.target.value })} />
            : <div className="text-sm text-[#c9c9c9] whitespace-pre-wrap">{plano.condicoes || '—'}</div>}
        </div>
      </section>
    </div>
  )
}
