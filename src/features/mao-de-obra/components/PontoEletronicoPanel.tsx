/**
 * Ponto Eletrônico — a metade do GESTOR.
 *
 * A outra metade, a do funcionário, mora fora do menu em `/app/ponto`: um botão grande, feito para
 * quem abre o aplicativo só para bater e fechar. Aqui é onde se lê o que aquele botão produziu.
 *
 * ⚠️ **O espelho não é um relatório bonito — é o documento que a CLT art. 74 exige.** Por isso ele
 * mostra o que dá errado com o mesmo destaque que mostra o que deu certo: batida sem saída, sem
 * marcação de intervalo, fora da cerca, com relógio adiantado. Um espelho que só mostra as linhas
 * limpas serve para nada em fiscalização e para nada em juízo.
 */
import { useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Clock, AlertTriangle, MapPin, CheckCircle2, Users, PencilLine } from 'lucide-react'
import { usePontoStore } from '@/store/pontoStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import {
  jornadasDoPeriodo, conferirJornadasCLT, TEXTO_DA_PENDENCIA,
  type Jornada, type PendenciaDaJornada,
} from '@/features/ponto/jornada'
import { RelatoriosDoPontoPanel } from './RelatoriosDoPontoPanel'
import { AjusteDeBatidaDialog } from './AjusteDeBatidaDialog'
import { cn, hojeLocalISO } from '@/lib/utils'
import { saldoDoPeriodo } from '../utils/bancoDeHoras'
import type { CLTSettings, Worker, WorkerAbsence } from '@/types'

type Visao = 'espelho' | 'conferencia' | 'relatorios'

const VISOES: Array<{ id: Visao; rotulo: string; ajuda: string }> = [
  { id: 'espelho',     rotulo: 'Espelho do mês', ajuda: 'Uma pessoa, um mês — o documento do art. 74' },
  { id: 'conferencia', rotulo: 'Conferência',    ajuda: 'O que precisa de decisão do gestor, na obra inteira' },
  { id: 'relatorios',  rotulo: 'Relatórios',     ajuda: 'Espelho e banco de horas em PDF e Excel' },
]

/** `yyyy-MM` → primeiro e último dia. */
function limitesDoMes(mes: string): { de: string; ate: string } {
  const [ano, m] = mes.split('-').map(Number)
  const ultimo = new Date(ano, m, 0).getDate()
  return { de: `${mes}-01`, ate: `${mes}-${String(ultimo).padStart(2, '0')}` }
}

const hhmm = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'

const horas = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`

const diaBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const diaDaSemana = (iso: string) => SEMANA[new Date(iso + 'T00:00:00').getDay()]

export function PontoEletronicoPanel() {
  const [visao, setVisao] = useState<Visao>('espelho')
  const [mes, setMes] = useState(() => hojeLocalISO().slice(0, 7))
  const [workerId, setWorkerId] = useState('')

  const registros = usePontoStore(useShallow((s) => s.registros))
  const { workers, cltSettings, absences } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, cltSettings: s.cltSettings, absences: s.absences })),
  )
  const holidays = usePlanejamentoStore(useShallow((s) => s.holidays))

  const { de, ate } = useMemo(() => limitesDoMes(mes), [mes])
  // Os feriados entram para que `conferirJornadasCLT` marque a folga sintética do dia como
  // 'holiday' e não como descanso semanal — são coisas diferentes para o art. 67/68.
  const feriados = useMemo(() => new Set((holidays ?? []).map((h) => h.date)), [holidays])

  const jornadas = useMemo(() => jornadasDoPeriodo(registros, de, ate), [registros, de, ate])

  /** Só quem tem vínculo com conta — os outros nem aparecem, porque não podem bater. */
  const comPonto = useMemo(
    () => workers.filter((w) => w.authUserId).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [workers],
  )

  const violacoes = useMemo(
    () => conferirJornadasCLT(workers, jornadas, cltSettings, { de, ate, feriados }),
    [workers, jornadas, cltSettings, de, ate, feriados],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1">
        {VISOES.map((v) => (
          <button
            key={v.id} type="button" onClick={() => setVisao(v.id)} title={v.ajuda}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              visao === v.id ? 'bg-[#f97316] text-white' : 'border border-[#525252] text-[#adadad] hover:text-[#f5f5f5]',
            )}
          >
            {v.rotulo}
          </button>
        ))}
        <input
          type="month" value={mes} onChange={(e) => setMes(e.target.value)}
          aria-label="Mês"
          className="ml-auto rounded-lg border border-[#525252] bg-[#333] px-3 py-1.5 text-xs text-[#f5f5f5] focus:border-[#f97316] focus:outline-none"
        />
      </div>

      {comPonto.length === 0 ? <SemVinculo /> : visao === 'espelho' ? (
        <Espelho
          workers={comPonto} workerId={workerId} setWorkerId={setWorkerId}
          jornadas={jornadas} de={de} ate={ate}
        />
      ) : visao === 'conferencia' ? (
        <Conferencia
          workers={comPonto} jornadas={jornadas} violacoes={violacoes} absences={absences}
          cltSettings={cltSettings} feriados={feriados} de={de} ate={ate}
        />
      ) : (
        <RelatoriosDoPontoPanel jornadas={jornadas} workers={comPonto} de={de} ate={ate} />
      )}
    </div>
  )
}

function SemVinculo() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-4 py-3 text-xs leading-5 text-[#fbbf24]">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>
        <b>Nenhum funcionário tem conta de ponto vinculada ainda.</b> Sem o vínculo o sistema não
        sabe de quem é a batida — e cartão de ponto não se atribui por semelhança de nome. O vínculo
        é feito em <b>Funcionários › Contas do Ponto Eletrônico</b>; as contas em si são criadas no
        Supabase, pela receita em <code>docs/PONTO_CRIAR_COLABORADORES.sql</code>.
      </span>
    </div>
  )
}

// ─── Espelho ──────────────────────────────────────────────────────────────────

function Espelho({ workers, workerId, setWorkerId, jornadas, de, ate }: {
  workers: Worker[]
  workerId: string
  setWorkerId: (id: string) => void
  jornadas: Jornada[]
  de: string
  ate: string
}) {
  const escolhido = workerId || workers[0]?.id || ''
  const minhas = useMemo(
    () => jornadas.filter((j) => j.workerId === escolhido),
    [jornadas, escolhido],
  )

  const total = minhas.reduce((s, j) => s + j.minutosTrabalhados, 0)
  const comPendencia = minhas.filter((j) => j.pendencias.length > 0).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={escolhido} onChange={(e) => setWorkerId(e.target.value)}
          aria-label="Funcionário"
          className="rounded-lg border border-[#525252] bg-[#333] px-3 py-1.5 text-xs text-[#f5f5f5] focus:border-[#f97316] focus:outline-none"
        >
          {workers.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <span className="text-xs text-[#adadad]">
          {minhas.length} jornada{minhas.length !== 1 ? 's' : ''} · {horas(total)} no período
        </span>
        {comPendencia > 0 && (
          <span className="rounded bg-[#eab308]/15 px-2 py-0.5 text-[11px] font-bold text-[#fbbf24]">
            {comPendencia} a conferir
          </span>
        )}
      </div>

      {minhas.length === 0 ? (
        <p className="rounded-xl border border-[#525252] bg-[#333] px-4 py-6 text-center text-xs text-[#adadad]">
          Nenhuma batida de {de.slice(8, 10)}/{de.slice(5, 7)} a {ate.slice(8, 10)}/{ate.slice(5, 7)}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#525252] bg-[#3d3d3d]">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-[#525252] bg-[#333] text-[10px] uppercase tracking-wider text-[#adadad]">
                <th className="px-3 py-2 text-left">Dia</th>
                <th className="px-3 py-2 text-left">Entrada</th>
                <th className="px-3 py-2 text-left">Saída</th>
                <th className="px-3 py-2 text-right">Intervalo</th>
                <th className="px-3 py-2 text-right">Trabalhado</th>
                <th className="px-3 py-2 text-left">NSR</th>
                <th className="px-3 py-2 text-left">Conferir</th>
              </tr>
            </thead>
            <tbody>
              {minhas.map((j) => (
                <tr key={j.id} className="border-b border-[#525252]/60 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-[#f5f5f5]">
                    {diaBR(j.data)} <span className="text-[10px] text-[#adadad]">{diaDaSemana(j.data)}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#d4d4d4]">{hhmm(j.entrada?.momentoDispositivo)}</td>
                  <td className="px-3 py-2 tabular-nums text-[#d4d4d4]">{hhmm(j.saida?.momentoDispositivo)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[#d4d4d4]">
                    {j.intervaloMin > 0 ? horas(j.intervaloMin) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-[#f5f5f5]">
                    {horas(j.minutosTrabalhados)}
                  </td>
                  {/* ⚠️ O NSR vai impresso: é o número sequencial que a Portaria 671 exige, e é por
                      ele que uma marcação é localizada numa fiscalização. */}
                  <td className="px-3 py-2 font-mono text-[10px] text-[#6b6b6b]">
                    {j.nsrs.length > 0 ? j.nsrs.join(' · ') : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Pendencias lista={j.pendencias} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ⚠️ Dito na tela, não só aqui: o espelho mostra o que foi BATIDO. */}
      <p className="text-[11px] leading-5 text-[#6b6b6b]">
        Este espelho mostra as marcações como foram registradas. Correção não apaga batida: ela entra
        como registro novo, marcado, com autor e motivo, e a original continua ao lado — é o que a
        CLT art. 74 §2º e a Portaria 671 exigem de um registro de jornada.
      </p>
    </div>
  )
}

function Pendencias({ lista }: { lista: PendenciaDaJornada[] }) {
  if (lista.length === 0) {
    return <span className="flex items-center gap-1 text-[11px] text-[#4ade80]"><CheckCircle2 size={11} /> ok</span>
  }
  return (
    <span className="flex flex-wrap gap-1">
      {lista.map((p) => (
        <span
          key={p}
          title={TEXTO_DA_PENDENCIA[p]}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-bold',
            p === 'sem-saida' || p === 'relogio-divergente'
              ? 'bg-[#ef4444]/15 text-[#fca5a5]'
              : 'bg-[#eab308]/15 text-[#fbbf24]',
          )}
        >
          {TEXTO_DA_PENDENCIA[p]}
        </span>
      ))}
    </span>
  )
}

// ─── Conferência ──────────────────────────────────────────────────────────────

function Conferencia({ workers, jornadas, violacoes, absences, cltSettings, feriados, de, ate }: {
  workers: Worker[]
  jornadas: Jornada[]
  violacoes: ReturnType<typeof conferirJornadasCLT>
  absences: WorkerAbsence[]
  cltSettings: CLTSettings
  feriados: ReadonlySet<string>
  de: string
  ate: string
}) {
  const [ajustando, setAjustando] = useState<Jornada | null>(null)
  const nome = useMemo(() => new Map(workers.map((w) => [w.id, w.name])), [workers])
  const pendentes = useMemo(
    () => jornadas.filter((j) => j.pendencias.length > 0),
    [jornadas],
  )

  // ⚠️ O LEMBRETE possível sem PWA. Jornada aberta de um dia que já passou é alguém que foi embora
  // sem bater a saída — e cada dia que passa torna mais difícil lembrar a hora certa. Notificação
  // com o aplicativo fechado exigiria service worker, que foi decidido ficar de fora; este aviso
  // na tela de quem confere é o que dá para prometer e cumprir.
  const abertasDeOntem = useMemo(
    () => pendentes.filter((j) => j.pendencias.includes('sem-saida') && j.data < hojeLocalISO()),
    [pendentes],
  )

  /** Dia em que a pessoa devia trabalhar, não bateu nada, e ninguém registrou ausência. */
  const semJustificativa = useMemo(() => {
    const comAusencia = new Set(absences.map((a) => `${a.workerId}|${a.date}`))
    const out: Array<{ workerId: string; data: string; previstoMin: number }> = []
    for (const w of workers) {
      const minhas = jornadas.filter((j) => j.workerId === w.id)
      const saldo = saldoDoPeriodo(w, minhas, de, ate, cltSettings, feriados)
      for (const d of saldo.dias) {
        if (d.foraDaConta || d.previstoMin === 0 || d.trabalhadoMin > 0) continue
        if (comAusencia.has(`${w.id}|${d.data}`)) continue
        if (d.data > hojeLocalISO()) continue  // o futuro ainda não faltou
        out.push({ workerId: w.id, data: d.data, previstoMin: d.previstoMin })
      }
    }
    return out.sort((a, b) => a.data.localeCompare(b.data))
  }, [workers, jornadas, absences, cltSettings, feriados, de, ate])

  return (
    <div className="flex flex-col gap-4">
      {abertasDeOntem.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 px-4 py-3 text-xs leading-5 text-[#fca5a5]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            <b>{abertasDeOntem.length} jornada(s) de dias anteriores sem saída registrada.</b>{' '}
            Quanto mais tempo passa, menos alguém lembra a hora certa — e jornada sem saída não
            entra na folha nem no banco de horas. Ajuste abaixo, com o motivo.
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi icone={Users} rotulo="Pessoas com batida" valor={new Set(jornadas.map((j) => j.workerId)).size} />
        <Kpi icone={Clock} rotulo="Jornadas no mês" valor={jornadas.length} />
        <Kpi icone={AlertTriangle} rotulo="A conferir" valor={pendentes.length} alerta={pendentes.length > 0} />
        <Kpi icone={MapPin} rotulo="Violações CLT" valor={violacoes.length} alerta={violacoes.length > 0} />
      </div>

      <Bloco titulo={`Pendências (${pendentes.length})`}>
        {pendentes.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-[#adadad]">
            Nenhuma pendência no período. Toda jornada tem entrada, saída e intervalo marcados.
          </p>
        ) : (
          <ul className="divide-y divide-[#525252]/60">
            {pendentes.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                <span className="w-24 shrink-0 text-[#adadad]">{diaBR(j.data)} {diaDaSemana(j.data)}</span>
                <span className="min-w-[140px] flex-1 font-medium text-[#f5f5f5]">{nome.get(j.workerId) ?? j.workerId}</span>
                <Pendencias lista={j.pendencias} />
                <button
                  type="button" onClick={() => setAjustando(j)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-[#525252] px-2 py-1 text-[11px] text-[#adadad] hover:border-[#f97316]/50 hover:text-[#ffa055]"
                >
                  <PencilLine size={11} /> ajustar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      <Bloco titulo={`Dias sem batida e sem justificativa (${semJustificativa.length})`}>
        {/* ⚠️ Este bloco é a única coisa no sistema que cruza "devia trabalhar" com "não bateu nem
            tem ausência registrada". A aba Faltas mostra as ausências CADASTRADAS; ninguém mostrava
            as que faltam cadastrar. O previsto vem do regime contratual (`bancoDeHoras`), e dia de
            regime sem jornada definida — diarista, personalizado — não entra: o sistema não sabe se
            aquela pessoa devia trabalhar, e acusar falta sem saber é pior que não acusar. */}
        {semJustificativa.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-[#adadad]">
            Nenhum dia útil sem batida e sem ausência registrada no período.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-[#525252]/60">
              {semJustificativa.slice(0, 30).map((f) => (
                <li key={`${f.workerId}|${f.data}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                  <span className="w-24 shrink-0 text-[#adadad]">{diaBR(f.data)} {diaDaSemana(f.data)}</span>
                  <span className="min-w-[140px] flex-1 font-medium text-[#f5f5f5]">{nome.get(f.workerId) ?? f.workerId}</span>
                  <span className="text-[11px] text-[#fbbf24]">{horas(f.previstoMin)} previstos, nada batido</span>
                </li>
              ))}
            </ul>
            {semJustificativa.length > 30 && (
              <p className="px-3 py-2 text-[11px] text-[#adadad]">
                …e mais {semJustificativa.length - 30}. Se a lista está enorme, provavelmente o
                regime de alguém está cadastrado errado — confira em Funcionários.
              </p>
            )}
            <p className="border-t border-[#525252] px-3 py-2 text-[11px] leading-5 text-[#adadad]">
              Para registrar atestado, férias ou falta justificada, use <b>Faltas e Ausências</b> —
              é lá que a ausência é cadastrada, e não aqui, para não existirem dois lugares
              gravando a mesma coisa.
            </p>
          </>
        )}
      </Bloco>

      <Bloco titulo={`Violações CLT nas jornadas batidas (${violacoes.length})`}>
        {/* ⚠️ Estas violações vêm do MESMO motor que confere a escala planejada, mas com dois
            cercos: dia sem batida vira folga sintética (senão o DSR acusaria falso toda semana) e
            jornada sem marcação de intervalo fica fora do art. 71 (marcação faltando não é
            intervalo negado). Ver `conferirJornadasCLT`. */}
        {violacoes.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-[#adadad]">
            Nenhuma violação nas jornadas registradas no período.
          </p>
        ) : (
          <ul className="divide-y divide-[#525252]/60">
            {violacoes.map((v) => (
              <li key={`${v.workerId}|${v.date}|${v.type}`} className="flex flex-wrap items-start gap-2 px-3 py-2 text-xs">
                <span className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold',
                  v.severity === 'blocking' ? 'bg-[#ef4444]/15 text-[#fca5a5]' : 'bg-[#eab308]/15 text-[#fbbf24]',
                )}>
                  {v.severity === 'blocking' ? 'bloqueia' : 'atenção'}
                </span>
                <span className="flex-1 leading-5 text-[#d4d4d4]">{v.description}</span>
              </li>
            ))}
          </ul>
        )}
      </Bloco>

      {ajustando && (
        <AjusteDeBatidaDialog
          jornada={ajustando}
          nomeDoTrabalhador={nome.get(ajustando.workerId) ?? ajustando.workerId}
          onClose={() => setAjustando(null)}
        />
      )}
    </div>
  )
}

function Kpi({ icone: Icone, rotulo, valor, alerta }: {
  icone: typeof Clock
  rotulo: string
  valor: number
  alerta?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#adadad]">
        <Icone size={11} /> {rotulo}
      </p>
      <p className={cn('mt-0.5 text-xl font-bold tabular-nums', alerta ? 'text-[#fbbf24]' : 'text-[#f5f5f5]')}>
        {valor}
      </p>
    </div>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#525252] bg-[#3d3d3d]">
      <p className="border-b border-[#525252] bg-[#333] px-3 py-2 text-xs font-semibold text-[#f5f5f5]">{titulo}</p>
      {children}
    </div>
  )
}
