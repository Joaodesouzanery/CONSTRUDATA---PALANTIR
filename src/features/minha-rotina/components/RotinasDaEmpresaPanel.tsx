/**
 * RotinasDaEmpresaPanel — a lista de rotinas da empresa, com feito/não feito por ciclo.
 *
 * ─── O QUE ISTO NÃO FAZ, DE PROPÓSITO ─────────────────────────────────────────────────────────
 * Não rastreia QUEM marcou. A empresa opera com uma conta só para todo mundo, então gravar
 * "concluído por" registraria a conta, não a pessoa — uma precisão falsa que alguém acabaria
 * usando para cobrar a pessoa errada. O responsável é um rótulo: diz de quem é a tarefa.
 *
 * ─── O CICLO ──────────────────────────────────────────────────────────────────────────────────
 * Cada frequência tem o seu ciclo corrente (hoje, esta semana, esta quinzena, este mês), e a
 * marcação vale para ele. Fechado o ciclo, a lista reabre sozinha — não é preciso "resetar" nada,
 * porque a etiqueta do ciclo muda e a execução do ciclo anterior continua no histórico.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, Plus, Trash2, Pencil, X, ExternalLink, Sun, CalendarRange, CalendarDays, CalendarCheck,
  Sparkles, AlertTriangle,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useRotinasStore } from '@/store/rotinasStore'
import { useAuth } from '@/lib/auth'
import { FREQUENCIAS, cicloDe, rotuloDoCiclo, diasAteFechar, cicloAnterior, type FrequenciaRotina } from '../utils/cicloRotina'
import { MODELO_COMPIZZO, ehAOrganizacaoDoModelo } from '../modeloCompizzo'
import { MODULE_REGISTRY } from '../moduleRegistry'
import { cn, hojeLocalISO } from '@/lib/utils'

const ICONE: Record<FrequenciaRotina, typeof Sun> = {
  diaria: Sun, semanal: CalendarRange, quinzenal: CalendarDays, mensal: CalendarCheck,
}
const COR: Record<FrequenciaRotina, string> = {
  diaria: '#f97316', semanal: '#0ea5e9', quinzenal: '#22c55e', mensal: '#a855f7',
}

interface Rascunho {
  id?: string
  titulo: string
  descricao: string
  modulo: string
  frequencia: FrequenciaRotina
  responsavel: string
}

const VAZIO: Rascunho = { titulo: '', descricao: '', modulo: '', frequencia: 'diaria', responsavel: '' }

export function RotinasDaEmpresaPanel() {
  const navigate = useNavigate()
  const { rotinas, execucoes, addRotina, updateRotina, removeRotina, alternarFeita, semear } = useRotinasStore(
    useShallow((s) => ({
      rotinas: s.rotinas,
      execucoes: s.execucoes,
      addRotina: s.addRotina,
      updateRotina: s.updateRotina,
      removeRotina: s.removeRotina,
      alternarFeita: s.alternarFeita,
      semear: s.semear,
    })),
  )
  const nomeDaOrg = useAuth((s) => s.memberships.find((m) => m.organization_id === s.profile?.organization_id)?.organization?.name)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [avisoSemente, setAvisoSemente] = useState<string | null>(null)

  const hoje = hojeLocalISO()
  const ativas = rotinas.filter((r) => r.ativa)
  const feitaEm = new Set(execucoes.filter((e) => e.feita).map((e) => `${e.rotinaId}|${e.periodo}`))

  const podeCarregarModelo = ehAOrganizacaoDoModelo(nomeDaOrg)

  function salvar() {
    if (!rascunho || !rascunho.titulo.trim()) return
    const dados = {
      titulo: rascunho.titulo.trim(),
      descricao: rascunho.descricao.trim() || undefined,
      modulo: rascunho.modulo || undefined,
      frequencia: rascunho.frequencia,
      responsavel: rascunho.responsavel.trim() || undefined,
      ativa: true,
    }
    if (rascunho.id) updateRotina(rascunho.id, dados)
    else addRotina(dados)
    setRascunho(null)
  }

  function carregarModelo() {
    const criadas = semear(MODELO_COMPIZZO)
    setAvisoSemente(
      criadas === 0
        ? 'O modelo já está carregado — nenhuma rotina foi duplicada.'
        : `${criadas} rotina${criadas !== 1 ? 's' : ''} do modelo ${criadas !== 1 ? 'foram adicionadas' : 'foi adicionada'}. Edite à vontade: a partir daqui a lista é da empresa.`,
    )
  }

  const campo = 'w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-2.5 py-2 text-sm text-[#f5f5f5] focus:border-[#f97316]/50 focus:outline-none'
  const rotulo = 'mb-1 block text-[10px] uppercase tracking-wide text-[#6b6b6b]'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">Rotinas da empresa</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#a3a3a3]">
            O que precisa ser feito, com que frequência e de quem é. Todo mundo da empresa vê a mesma lista —
            marcar aqui é o registro de que aquele ciclo foi cumprido.
          </p>
        </div>
        <div className="flex gap-2">
          {podeCarregarModelo && rotinas.length === 0 && (
            <button
              onClick={carregarModelo}
              className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-3 py-2 text-xs font-medium text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5]"
            >
              <Sparkles size={13} /> Carregar o modelo
            </button>
          )}
          <button
            onClick={() => setRascunho({ ...VAZIO })}
            className="flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c]"
          >
            <Plus size={13} /> Nova rotina
          </button>
        </div>
      </div>

      {avisoSemente && (
        <div className="flex items-start gap-2 rounded-lg border border-[#22c55e]/40 bg-[#22c55e]/[0.08] px-3 py-2.5 text-[11px] text-[#4ade80]">
          <Check size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{avisoSemente}</span>
          <button onClick={() => setAvisoSemente(null)} className="text-[#4ade80]/70 hover:text-[#4ade80]"><X size={13} /></button>
        </div>
      )}

      {rotinas.length === 0 && !rascunho && (
        <div className="rounded-xl border border-dashed border-[#525252] px-5 py-8 text-center">
          <p className="text-sm text-[#a3a3a3]">Nenhuma rotina cadastrada ainda.</p>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[#6b6b6b]">
            {podeCarregarModelo
              ? 'Carregue o modelo para começar com as rotinas já mapeadas, ou cadastre a primeira do zero. Tudo fica editável.'
              : 'Cadastre a primeira. A lista é da empresa: todo mundo vê a mesma, e marcar é feito/não feito, sem burocracia.'}
          </p>
        </div>
      )}

      {FREQUENCIAS.map(({ id: freq, rotulo: nomeFreq, plural }) => {
        const doGrupo = ativas.filter((r) => r.frequencia === freq).sort((a, b) => a.ordem - b.ordem)
        if (doGrupo.length === 0) return null

        const ciclo = cicloDe(freq, hoje)
        const anterior = cicloAnterior(freq, hoje)
        const feitas = doGrupo.filter((r) => feitaEm.has(`${r.id}|${ciclo}`)).length
        const pendentesAntes = doGrupo.filter((r) => !feitaEm.has(`${r.id}|${anterior}`)).length
        const faltamDias = diasAteFechar(freq, hoje)
        const Icone = ICONE[freq]
        const cor = COR[freq]

        return (
          <section key={freq}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${cor}1a`, color: cor }}>
                <Icone size={15} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">{nomeFreq}</h3>
              <span className="text-xs text-[#6b6b6b]">{plural} · {rotuloDoCiclo(freq, hoje)}</span>
              <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${cor}40, transparent)` }} />
              <span className={cn('text-xs font-medium', feitas === doGrupo.length ? 'text-[#4ade80]' : 'text-[#a3a3a3]')}>
                {feitas}/{doGrupo.length} {feitas === doGrupo.length ? '· tudo feito' : ''}
              </span>
              {feitas < doGrupo.length && faltamDias >= 0 && (
                <span className="text-[11px] text-[#6b6b6b]">
                  {faltamDias === 0 ? 'fecha hoje' : `fecha em ${faltamDias} dia${faltamDias !== 1 ? 's' : ''}`}
                </span>
              )}
            </div>

            {pendentesAntes > 0 && pendentesAntes === doGrupo.length && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/[0.06] px-3 py-2 text-[11px] text-[#d4a44c]">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>Nenhuma destas foi marcada no ciclo anterior ({anterior}). Ou não foi feito, ou não foi registrado — vale conferir qual dos dois.</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {doGrupo.map((r) => {
                const feita = feitaEm.has(`${r.id}|${ciclo}`)
                return (
                  <div
                    key={r.id}
                    className={cn(
                      'group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                      feita ? 'border-[#22c55e]/30 bg-[#22c55e]/[0.06]' : 'border-[#525252] bg-[#2c2c2c] hover:border-[#f97316]/40',
                    )}
                  >
                    <button
                      onClick={() => alternarFeita(r.id)}
                      title={feita ? 'Desmarcar' : 'Marcar como feita'}
                      className={cn(
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                        feita ? 'border-[#22c55e] bg-[#22c55e] text-white' : 'border-[#6b6b6b] text-transparent hover:border-[#f97316]',
                      )}
                    >
                      <Check size={13} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('text-sm', feita ? 'text-[#a3a3a3] line-through' : 'text-[#f5f5f5]')}>{r.titulo}</span>
                        {r.responsavel && (
                          <span className="rounded bg-[#525252]/50 px-1.5 py-0.5 text-[10px] text-[#a3a3a3]">{r.responsavel}</span>
                        )}
                      </div>
                      {r.descricao && <p className="mt-0.5 text-[11px] leading-relaxed text-[#6b6b6b]">{r.descricao}</p>}
                    </div>

                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {r.modulo && (
                        <button
                          onClick={() => navigate(r.modulo!)}
                          title="Abrir o módulo"
                          className="rounded p-1.5 text-[#6b6b6b] transition-colors hover:bg-[#484848] hover:text-[#f97316]"
                        >
                          <ExternalLink size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => setRascunho({
                          id: r.id, titulo: r.titulo, descricao: r.descricao ?? '',
                          modulo: r.modulo ?? '', frequencia: r.frequencia, responsavel: r.responsavel ?? '',
                        })}
                        title="Editar"
                        className="rounded p-1.5 text-[#6b6b6b] transition-colors hover:bg-[#484848] hover:text-[#f5f5f5]"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => { if (window.confirm(`Excluir a rotina "${r.titulo}"? O histórico do que já foi feito continua guardado.`)) removeRotina(r.id) }}
                        title="Excluir"
                        className="rounded p-1.5 text-[#6b6b6b] transition-colors hover:bg-[#dc2626]/20 hover:text-[#f87171]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* Formulário */}
      {rascunho && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setRascunho(null) }}>
          <div className="flex w-full max-w-md flex-col gap-3.5 rounded-2xl border border-[#525252] bg-[#3d3d3d] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#f5f5f5]">{rascunho.id ? 'Editar rotina' : 'Nova rotina'}</h3>
              <button onClick={() => setRascunho(null)} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
            </div>

            <div>
              <label className={rotulo}>O que precisa ser feito</label>
              <input autoFocus value={rascunho.titulo} onChange={(e) => setRascunho({ ...rascunho, titulo: e.target.value })} placeholder="Ex.: Lançar o RDO de cada obra" className={campo} />
            </div>

            <div>
              <label className={rotulo}>Detalhe (opcional)</label>
              <input value={rascunho.descricao} onChange={(e) => setRascunho({ ...rascunho, descricao: e.target.value })} placeholder="O porquê, ou o cuidado que a tarefa exige" className={campo} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={rotulo}>Com que frequência</label>
                <select value={rascunho.frequencia} onChange={(e) => setRascunho({ ...rascunho, frequencia: e.target.value as FrequenciaRotina })} className={campo}>
                  {FREQUENCIAS.map((f) => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
                </select>
              </div>
              <div>
                <label className={rotulo}>De quem é</label>
                <input value={rascunho.responsavel} onChange={(e) => setRascunho({ ...rascunho, responsavel: e.target.value })} placeholder="Nome" className={campo} />
              </div>
            </div>

            <div>
              <label className={rotulo}>Onde no sistema (opcional)</label>
              <select value={rascunho.modulo} onChange={(e) => setRascunho({ ...rascunho, modulo: e.target.value })} className={campo}>
                <option value="">— sem atalho —</option>
                {MODULE_REGISTRY.map((m) => <option key={m.path} value={m.path}>{m.label}</option>)}
              </select>
            </div>

            <p className="text-[10px] leading-relaxed text-[#6b6b6b]">
              A rotina é da empresa: todo mundo vê e pode marcar. Não guardamos quem marcou — a empresa usa
              uma conta só, e registrar "feito por" apontaria a conta, não a pessoa.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setRascunho(null)} className="px-3 py-2 text-xs text-[#6b6b6b] transition-colors hover:text-[#f5f5f5]">Cancelar</button>
              <button
                onClick={salvar}
                disabled={!rascunho.titulo.trim()}
                className="rounded-lg bg-[#f97316] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {rascunho.id ? 'Salvar' : 'Criar rotina'}
              </button>
            </div>
          </div>
        </div>
      )}

      {rotinas.length > 0 && (
        <p className="pb-6 text-center text-[11px] text-[#6b6b6b]">
          Cada frequência tem o seu ciclo. Quando o ciclo fecha, a lista reabre sozinha — e o que foi
          marcado antes fica no histórico.
        </p>
      )}
    </div>
  )
}
