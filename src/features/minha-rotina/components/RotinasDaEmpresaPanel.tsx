/**
 * RotinasDaEmpresaPanel — a lista de rotinas da empresa, com feito/não feito por ciclo.
 *
 * ─── QUEM MARCOU: DECLARADO, NÃO DEDUZIDO ─────────────────────────────────────────────────────
 * A empresa opera com uma conta só para todo mundo, então gravar `created_by` registraria a CONTA
 * e não a pessoa — a precisão falsa que a decisão original rejeitou, e que continua rejeitada.
 *
 * O que mudou é que agora se PERGUNTA. Ao marcar, quem clicou escolhe ou digita o próprio nome, e
 * ele fica em `quem_fez` — texto declarado, como o `responsavel`, sem fingir autenticação.
 *
 * O padrão oferecido é o ÚLTIMO NOME USADO neste aparelho, e **não** o responsável da rotina: se A
 * marca a tarefa de B e aceita o padrão, o registro passa a dizer que B fez — seria a mesma
 * precisão falsa, agora com o nome errado em vez do genérico. O responsável aparece entre os
 * botões, mas ninguém o escolhe por inércia.
 *
 * Desmarcar continua sendo um clique só, e limpa o nome: cobrar identificação para desfazer torna
 * corrigir mais caro que errar, e aí a marcação errada fica no lugar.
 *
 * ─── O CICLO ──────────────────────────────────────────────────────────────────────────────────
 * Cada frequência tem o seu ciclo corrente (hoje, esta semana, esta quinzena, este mês), e a
 * marcação vale para ele. Fechado o ciclo, a lista reabre sozinha — não é preciso "resetar" nada,
 * porque a etiqueta do ciclo muda e a execução do ciclo anterior continua no histórico.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, Plus, Trash2, Pencil, X, ExternalLink, Sun, CalendarRange, CalendarDays, CalendarCheck,
  Sparkles, AlertTriangle, Printer,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useRotinasStore } from '@/store/rotinasStore'
import type { Rotina } from '@/store/rotinasStore'
import type { WorkWeekMode } from '@/types'
import { useAuth } from '@/lib/auth'
import { FREQUENCIAS, cicloDe, rotuloDoCiclo, diasAteFechar, type FrequenciaRotina } from '../utils/cicloRotina'
import { atrasoDaRotina, frasePendencia, corDaPessoa, iniciaisDe, type AtrasoRotina } from '../utils/atrasoRotina'
import { usePlanejamentoStore } from '@/store/planejamentoStore'

/** O selo do responsável: iniciais + nome, na cor fixa daquela pessoa. */
function SeloPessoa({ nome, tamanho = 'normal' }: { nome: string; tamanho?: 'normal' | 'grande' }) {
  const cor = corDaPessoa(nome)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold',
        tamanho === 'grande' ? 'px-2 py-1 text-[11px]' : 'px-1.5 py-0.5 text-[10px]',
      )}
      style={{ color: cor, borderColor: `${cor}4d`, backgroundColor: `${cor}1a` }}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full font-bold text-[#1f1f1f]',
          tamanho === 'grande' ? 'h-5 w-5 text-[9px]' : 'h-4 w-4 text-[8px]',
        )}
        style={{ backgroundColor: cor }}
      >
        {iniciaisDe(nome)}
      </span>
      {nome}
    </span>
  )
}
import { MODELO_COMPIZZO, ehAOrganizacaoDoModelo } from '../modeloCompizzo'
import { MODULE_REGISTRY } from '../moduleRegistry'
import { cn, hojeLocalISO } from '@/lib/utils'
import { nomesConhecidos } from '../utils/quemFez'
import { adesaoNoPeriodo } from '../utils/adesaoRotina'
import { PeriodoSelector } from '@/components/shared/PeriodoSelector'
import { periodoDe, deslocar, type Periodo } from '@/lib/periodo'
import { isDemoModeEnabled } from '@/lib/runtimeMode'
import { openRotinasWindow, printRotinasInto, printRotinasViaIframe } from '../utils/rotinasReportExport'

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
  const {
    rotinas, execucoes, addRotina, updateRotina, removeRotina, alternarFeita, semear,
    ultimoQuemFez, lembrarQuemFez,
  } = useRotinasStore(
    useShallow((s) => ({
      rotinas: s.rotinas,
      execucoes: s.execucoes,
      ultimoQuemFez: s.ultimoQuemFez,
      lembrarQuemFez: s.lembrarQuemFez,
      addRotina: s.addRotina,
      updateRotina: s.updateRotina,
      removeRotina: s.removeRotina,
      alternarFeita: s.alternarFeita,
      semear: s.semear,
    })),
  )
  const nomeDaOrg = useAuth((s) => s.memberships.find((m) => m.organization_id === s.profile?.organization_id)?.organization?.name)
  // A mesma regra de dia útil do alerta de RDO: rotina diária não pode aparecer atrasada na
  // segunda-feira por causa do fim de semana.
  const feriados = usePlanejamentoStore((s) => s.holidays)
  const jornada = usePlanejamentoStore((s) => s.scheduleConfig.workWeekMode)
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [avisoSemente, setAvisoSemente] = useState<string | null>(null)
  /** A rotina cujo campo de "quem fez" está aberto. `null` = nenhum. */
  const [marcando, setMarcando] = useState<string | null>(null)
  /** O histórico de adesão fica fechado por padrão: o gesto do dia a dia é marcar, não relatar. */
  const [historico, setHistorico] = useState<Periodo | null>(null)

  const hoje = hojeLocalISO()
  const ativas = rotinas.filter((r) => r.ativa)
  const feitaEm = new Set(execucoes.filter((e) => e.feita).map((e) => `${e.rotinaId}|${e.periodo}`))
  const nomes = useMemo(() => nomesConhecidos(rotinas, execucoes), [rotinas, execucoes])
  /** Quem marcou a rotina no ciclo corrente — o crédito que aparece na linha. */
  const quemFezDoCiclo = (r: Rotina) =>
    execucoes.find((e) => e.rotinaId === r.id && e.periodo === cicloDe(r.frequencia, hoje) && e.feita)?.quemFez

  // Atraso por rotina. O aviso que existia antes era por GRUPO inteiro e só disparava quando 100%
  // do grupo tinha falhado — na prática, quase nunca aparecia: bastava uma rotina estar feita para
  // o grupo inteiro ficar mudo. Agora cada linha responde por si.
  const feriadoSet = new Set(feriados.map((f) => f.date))
  const atrasos = new Map<string, AtrasoRotina>()
  for (const r of ativas) {
    const a = atrasoDaRotina(r, { feitas: feitaEm, feriados: feriadoSet, jornada, hoje })
    if (a) atrasos.set(r.id, a)
  }

  // Placar por pessoa, do ciclo corrente de cada rotina. É o que faz olhar a lista e saber de quem
  // cobrar sem ler linha por linha.
  const porPessoa = new Map<string, { feitas: number; total: number; atrasadas: number }>()
  for (const r of ativas) {
    const nome = r.responsavel?.trim()
    if (!nome) continue
    const atual = porPessoa.get(nome) ?? { feitas: 0, total: 0, atrasadas: 0 }
    atual.total++
    if (feitaEm.has(`${r.id}|${cicloDe(r.frequencia, hoje)}`)) atual.feitas++
    if (atrasos.has(r.id)) atual.atrasadas++
    porPessoa.set(nome, atual)
  }
  const pessoas = [...porPessoa.entries()]
    .map(([nome, n]) => ({ nome, ...n }))
    .sort((a, b) => b.atrasadas - a.atrasadas || a.nome.localeCompare(b.nome))

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

      {pessoas.length > 0 && (
        <div className="rounded-xl border border-[#525252] bg-[#2c2c2c] px-4 py-3">
          <p className="text-[10px] uppercase tracking-wide text-[#6b6b6b]">Como está cada um, no ciclo de agora</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            {pessoas.map((p) => (
              <span key={p.nome} className="flex items-center gap-2">
                <SeloPessoa nome={p.nome} tamanho="grande" />
                <span className={cn('font-mono text-xs', p.feitas === p.total ? 'text-[#4ade80]' : 'text-[#a3a3a3]')}>
                  {p.feitas}/{p.total}
                </span>
                {p.atrasadas > 0 && (
                  <span className="rounded bg-[#ef4444]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#fca5a5]">
                    {p.atrasadas} atrasada{p.atrasadas !== 1 ? 's' : ''}
                  </span>
                )}
              </span>
            ))}
          </div>
          {ativas.some((r) => !r.responsavel?.trim()) && (
            <p className="mt-2 text-[10px] text-[#6b6b6b]">
              {ativas.filter((r) => !r.responsavel?.trim()).length} rotina(s) sem dono — sem nome, não há de quem cobrar.
            </p>
          )}
        </div>
      )}

      <BlocoHistorico
        rotinas={rotinas} feitaEm={feitaEm} feriados={feriados} jornada={jornada} hoje={hoje}
        periodo={historico} onPeriodo={setHistorico}
        empresa={nomeDaOrg ?? 'ConstruData'}
      />

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
        const feitas = doGrupo.filter((r) => feitaEm.has(`${r.id}|${ciclo}`)).length
        const atrasadasNoGrupo = doGrupo.filter((r) => atrasos.has(r.id)).length
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
              {atrasadasNoGrupo > 0 && (
                <span className="rounded bg-[#ef4444]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#fca5a5]">
                  {atrasadasNoGrupo} atrasada{atrasadasNoGrupo !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              {doGrupo.map((r) => {
                const feita = feitaEm.has(`${r.id}|${ciclo}`)
                const atraso = atrasos.get(r.id)
                return (
                  <div
                    key={r.id}
                    className={cn(
                      'group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                      feita ? 'border-[#22c55e]/30 bg-[#22c55e]/[0.06]'
                        // Vermelho é "está acumulando"; o âmbar do cabeçalho continua sendo
                        // "fecha hoje". A cor precisa distinguir as duas.
                        : atraso ? 'border-[#ef4444]/40 bg-[#ef4444]/[0.06] hover:border-[#ef4444]/60'
                        : 'border-[#525252] bg-[#2c2c2c] hover:border-[#f97316]/40',
                    )}
                  >
                    <button
                      onClick={() => {
                        // Desmarcar é correção, e continua UM clique: cobrar um nome para desfazer
                        // torna corrigir mais caro que errar — e aí a marcação errada fica.
                        if (feita) { alternarFeita(r.id); return }
                        setMarcando(marcando === r.id ? null : r.id)
                      }}
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
                        {r.responsavel && <SeloPessoa nome={r.responsavel} tamanho="grande" />}
                      </div>
                      {r.descricao && <p className="mt-0.5 text-[11px] leading-relaxed text-[#6b6b6b]">{r.descricao}</p>}
                      {atraso && (
                        <p className="mt-1 flex items-start gap-1.5 text-[11px] font-medium text-[#f87171]">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          <span>{frasePendencia(r, atraso)}</span>
                        </p>
                      )}
                      {/* A recompensa de ter perguntado: o crédito aparece. Sem isto, pedir o nome
                          seria só uma etapa a mais. */}
                      {feita && quemFezDoCiclo(r) && (
                        <p className="mt-0.5 text-[11px] text-[#a3a3a3]">feito por <b className="text-[#d4d4d4]">{quemFezDoCiclo(r)}</b></p>
                      )}
                      {marcando === r.id && (
                        <FaixaQuemFez
                          nomes={nomes}
                          padrao={ultimoQuemFez ?? ''}
                          onConfirmar={(nome) => {
                            alternarFeita(r.id, undefined, { quemFez: nome })
                            if (nome) lembrarQuemFez(nome)
                            setMarcando(null)
                          }}
                          onCancelar={() => setMarcando(null)}
                        />
                      )}
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
              A rotina é da empresa: todo mundo vê e pode marcar. Ao marcar, o sistema pergunta quem fez
              e guarda o nome digitado — como a empresa usa uma conta só, esse nome é declarado, não
              verificado. O responsável aqui diz de quem é a tarefa; "quem fez" diz quem fez.
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


/**
 * O campo de "quem fez", inline na própria linha.
 *
 * Não é modal: o painel já tem um (o formulário de rotina), e empilhar um segundo para o gesto
 * mais banal da tela é exatamente a fricção a evitar. Um clique num nome confirma na hora.
 */
function FaixaQuemFez({ nomes, padrao, onConfirmar, onCancelar }: {
  nomes: string[]
  padrao: string
  onConfirmar: (nome: string) => void
  onCancelar: () => void
}) {
  const [texto, setTexto] = useState(padrao)
  return (
    <div className="mt-2 rounded-lg border border-[#f97316]/40 bg-[#f97316]/[0.06] p-2">
      <p className="text-[11px] text-[#d4d4d4]">Quem fez?</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {nomes.map((n) => (
          <button
            key={n} type="button" onClick={() => onConfirmar(n)}
            className="rounded-full border border-[#525252] px-2.5 py-1 text-[11px] text-[#e5e5e5] hover:border-[#f97316] hover:text-[#ffa055]"
          >
            {n}
          </button>
        ))}
        <input
          autoFocus value={texto} onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirmar(texto.trim())
            if (e.key === 'Escape') onCancelar()
          }}
          placeholder="ou digite o nome"
          className="h-7 min-w-[9rem] flex-1 rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 text-[11px] text-[#f5f5f5] placeholder:text-[#9a9a9a]"
        />
        <button
          type="button" onClick={() => onConfirmar(texto.trim())}
          className="rounded-lg bg-[#f97316] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#ea580c]"
        >
          Marcar
        </button>
        <button type="button" onClick={onCancelar} className="px-1.5 text-[11px] text-[#a3a3a3] hover:text-[#f5f5f5]">
          Cancelar
        </button>
      </div>
      {/* Nome em branco confirma assim mesmo: uma tela que às vezes se recusa a marcar ensina a
          não marcar. Melhor a execução sem dono do que a execução que não aconteceu. */}
      <p className="mt-1 text-[10px] text-[#a3a3a3]">Pode marcar sem preencher — o nome ajuda, mas não é obrigatório.</p>
    </div>
  )
}

/**
 * Histórico de adesão — a memória que faltava.
 *
 * Fechado por padrão, e abrindo no **mês passado**: no dia 3 de setembro "setembro" não tem nenhum
 * ciclo mensal fechado e quase nenhum semanal, então a seção abriria vazia e pareceria quebrada.
 */
function BlocoHistorico({ rotinas, feitaEm, feriados, jornada, hoje, periodo, onPeriodo, empresa }: {
  rotinas: Rotina[]
  feitaEm: Set<string>
  feriados: { date: string }[]
  jornada: WorkWeekMode
  hoje: string
  periodo: Periodo | null
  onPeriodo: (p: Periodo | null) => void
  empresa: string
}) {
  const ctx = useMemo(
    () => ({ feitas: feitaEm, feriados: new Set(feriados.map((f) => f.date)), jornada, hoje }),
    [feitaEm, feriados, jornada, hoje],
  )
  const adesao = useMemo(
    () => (periodo ? adesaoNoPeriodo(rotinas, periodo, ctx) : null),
    [rotinas, ctx, periodo],
  )

  function imprimirRelatorio(p: Periodo) {
    // `window.open` PRECISA ser síncrono no clique — depois de um `await` o navegador bloqueia.
    const win = openRotinasWindow()
    const dados = {
      adesao: adesaoNoPeriodo(rotinas, p, ctx),
      periodo: p, empresa, hoje, demo: isDemoModeEnabled(),
    }
    if (win) void printRotinasInto(win, dados)
    else void printRotinasViaIframe(dados)
  }

  return (
    <div className="mt-3 rounded-xl border border-[#525252] bg-[#2c2c2c]">
      <button
        type="button"
        onClick={() => onPeriodo(periodo ? null : deslocar(periodoDe('mes', hoje), -1))}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
          Histórico de adesão
        </span>
        <span className="text-[11px] text-[#a3a3a3]">{periodo ? 'fechar' : 'abrir'}</span>
      </button>

      {periodo && adesao && (
        <div className="border-t border-[#525252] px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Rotina se cobra por CICLO do calendário — "as rotinas desta semana", "deste mês".
                Uma janela de "últimos 7 dias" atravessaria dois ciclos e a adesão perderia o
                sentido. Por isso esta tela mantém os atalhos de grade. */}
            <PeriodoSelector valor={periodo} onChange={onPeriodo}
                             tipos={['semana', 'quinzena', 'mes', 'trimestre', 'livre']} />
            {/* Um botão por recorte, e não um "exportar" genérico: o gesto da reunião é "quero o
                da semana" ou "quero o do mês", não "quero configurar um período". */}
            <div className="flex gap-1.5">
              {(['semana', 'mes'] as const).map((tipo) => (
                <button
                  key={tipo} type="button"
                  onClick={() => imprimirRelatorio(periodoDe(tipo, hoje))}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#525252] px-2.5 py-1 text-[11px] text-[#d4d4d4] hover:text-[#f5f5f5]"
                  title={`Gera o relatório ${tipo === 'semana' ? 'da semana' : 'do mês'} em A4`}
                >
                  <Printer size={11} /> {tipo === 'semana' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
          </div>

          {adesao.vazio ? (
            <p className="mt-3 text-[11px] leading-5 text-[#a3a3a3]">
              Nenhum ciclo <b>fechado</b> caiu inteiro neste período — não há o que medir ainda. O
              ciclo que está correndo agora não conta: ainda dá tempo de fazer.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-col gap-1.5">
                {adesao.porPessoa.map((p) => (
                  <div key={p.nome} className="flex items-center gap-2">
                    <span className="w-28 shrink-0"><SeloPessoa nome={p.nome} tamanho="grande" /></span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded bg-[#333333]">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${p.percentual ?? 0}%`,
                          backgroundColor: (p.percentual ?? 0) >= 80 ? '#22c55e' : (p.percentual ?? 0) >= 50 ? '#eab308' : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right font-mono text-[11px] text-[#e5e5e5]">
                      {p.cumpridos}/{p.esperados} · {p.percentual === null ? '—' : `${p.percentual}%`}
                    </span>
                  </div>
                ))}
                {adesao.porPessoa.length === 0 && (
                  <p className="text-[11px] text-[#a3a3a3]">Nenhuma rotina com responsável avaliada no período.</p>
                )}
              </div>

              <p className="mt-2.5 border-t border-[#525252] pt-2 text-[10px] leading-4 text-[#a3a3a3]">
                Total do período: <b className="text-[#d4d4d4]">{adesao.total.cumpridos}/{adesao.total.esperados}</b>
                {adesao.total.percentual !== null && ` · ${adesao.total.percentual}%`}. Conta só o
                ciclo que fechou inteiro dentro do período, e rotina criada depois não deve o
                passado. A diária pula fim de semana e feriado.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
