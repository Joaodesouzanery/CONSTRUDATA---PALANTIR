/**
 * AlertasRdoHoje — o RDO de hoje foi feito, em cada obra da empresa?
 *
 * Fica no topo do Dashboard do RDO. É o único lugar do app que IGNORA de propósito o seletor de
 * obra da Sidebar: é painel de supervisão, e esconder sete de oito obras destruiria o que ele
 * serve. Para não virar bug reportado, a tela diz isso explicitamente; a obra ativa vai fixada no
 * topo e destacada.
 *
 * As regras (dia útil, feriado, obra parada, precedência dos estados) moram em `statusRdoDia.ts`,
 * fora daqui, porque são testáveis sem renderizar — e são elas que decidem se o painel presta.
 */
import { useMemo, useState } from 'react'
import { AlertTriangle, BellRing, CheckCircle2, CloudOff, FileWarning } from 'lucide-react'
import { cn, hojeLocalISO, fmtDataBR } from '@/lib/utils'
import { useRdoStore } from '@/store/rdoStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useDiasSemProducaoStore, MOTIVOS_SEM_PRODUCAO, rotuloMotivo, type MotivoSemProducao } from '@/store/diasSemProducaoStore'
import { useAuth } from '@/lib/auth'
import { canWriteRdo } from '@/lib/roles'
import { calcularStatusDoDia, ordenarLinhas, lacunaDeRdo, type LinhaStatusObra, type LacunaRdo } from '../utils/statusRdoDia'

/** "quinta, 14/08" — o dia da semana ajuda a lembrar o que aconteceu naquele dia. */
function diaComSemana(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '')
  return `${semana}, ${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** Acima disto a lista completa vira ruído no topo do Dashboard e colapsa em resumo. */
const LIMITE_EXPANDIDO = 8

const CORES: Record<LinhaStatusObra['status'], { ponto: string; texto: string }> = {
  pendente:     { ponto: 'bg-[#ef4444]', texto: 'text-[#fca5a5]' },
  rascunho:     { ponto: 'bg-[#f59e0b]', texto: 'text-[#fbbf24]' },
  sem_producao: { ponto: 'bg-[#38bdf8]', texto: 'text-[#7dd3fc]' },
  ok:           { ponto: 'bg-[#22c55e]', texto: 'text-[#4ade80]' },
  nao_cobravel: { ponto: 'bg-[#525252]', texto: 'text-[#6b6b6b]' },
}

export function AlertasRdoHoje() {
  const rdos = useRdoStore((s) => s.rdos)
  const setActiveTab = useRdoStore((s) => s.setActiveTab)
  const setEditingRdoId = useRdoStore((s) => s.setEditingRdoId)
  const sites = useTorreStore((s) => s.sites)
  const torreSincronizada = useTorreStore((s) => s.lastSyncedAt)
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const setActiveObra = useActiveObraStore((s) => s.setActiveObra)
  const feriados = usePlanejamentoStore((s) => s.holidays)
  const jornada = usePlanejamentoStore((s) => s.scheduleConfig.workWeekMode)
  const dias = useDiasSemProducaoStore((s) => s.dias)
  const marcar = useDiasSemProducaoStore((s) => s.marcar)
  const desmarcar = useDiasSemProducaoStore((s) => s.desmarcar)
  const podeEscrever = canWriteRdo(useAuth((s) => s.profile?.role))

  const [expandido, setExpandido] = useState(false)
  const [marcando, setMarcando] = useState<LinhaStatusObra | null>(null)

  const hoje = hojeLocalISO()

  // UM único memo varrendo os RDOs uma vez. O caminho ingênuo (um filter por obra) é
  // O(obras × RDOs) a cada render — o projeto já apanhou disso no useAlertCounts.
  const resultado = useMemo(() => {
    const semProducao = new Map<string, string>()
    for (const d of dias) {
      semProducao.set(
        `${d.siteId}|${d.data}`,
        d.categoria === 'outros' && d.motivo ? d.motivo : rotuloMotivo(d.categoria),
      )
    }
    return calcularStatusDoDia({ sites, rdos, semProducao, dataISO: hoje, feriados, jornada })
  }, [sites, rdos, dias, hoje, feriados, jornada])

  const linhas = useMemo(() => ordenarLinhas(resultado.linhas, activeObraId), [resultado.linhas, activeObraId])

  /**
   * Há quantos dias cada obra está sem RDO.
   *
   * "Sem RDO hoje" e "3 dias sem RDO, o mais antigo é quinta, 14/08" pedem ações diferentes — o
   * segundo é o que faz o encarregado cobrar. Calculado só para as obras que estão pendentes: o
   * resto já está resolvido, e varrer 90 dias por obra à toa custaria caro com muitas obras.
   */
  const lacunas = useMemo(() => {
    const semProducao = new Map<string, string>()
    for (const d of dias) semProducao.set(`${d.siteId}|${d.data}`, rotuloMotivo(d.categoria))
    const mapa = new Map<string, LacunaRdo>()
    for (const linha of resultado.linhas) {
      if (linha.status !== 'pendente') continue
      const l = lacunaDeRdo({ site: linha.site, rdos, semProducao, hoje, feriados, jornada })
      if (l) mapa.set(linha.site.id, l)
    }
    return mapa
  }, [resultado.linhas, rdos, dias, hoje, feriados, jornada])

  /** A obra com a lacuna mais antiga — é o que o cabeçalho precisa gritar. */
  const piorLacuna = useMemo(() => {
    let pior: { nome: string; lacuna: LacunaRdo } | null = null
    for (const linha of resultado.linhas) {
      const l = lacunas.get(linha.site.id)
      if (l && (!pior || l.diasDesde > pior.lacuna.diasDesde)) pior = { nome: linha.site.name, lacuna: l }
    }
    return pior
  }, [resultado.linhas, lacunas])

  // Sem obra cadastrada não há o que cobrar — mesma regra do ObraSwitcher.
  if (sites.length === 0) return null

  // Torre ainda não sincronizou NESTE aparelho: `sites` pode estar incompleto, e pintar verde
  // seria afirmar que está tudo em dia sem base para isso. Cinza informativo.
  if (!torreSincronizada) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#525252] bg-[#333333] px-4 py-3 text-xs text-[#6b6b6b]">
        <CloudOff size={14} className="shrink-0" />
        Ainda sincronizando as obras neste aparelho — o quadro de RDOs do dia aparece em seguida.
      </div>
    )
  }

  const precisaAcao = resultado.pendentes + resultado.rascunhos
  const mostrarTodas = expandido || linhas.length <= LIMITE_EXPANDIDO
  const visiveis = mostrarTodas
    ? linhas
    : linhas.filter((l) => l.status === 'pendente' || l.status === 'rascunho').slice(0, 10)

  function irParaRdo(linha: LinhaStatusObra) {
    setActiveObra(linha.site.id)
    if (linha.rdoId) { setEditingRdoId(linha.rdoId); setActiveTab('historico'); return }
    setActiveTab('compizzo')
  }

  return (
    <div
      className={cn(
        'rounded-xl border',
        // Lacuna de mais de um dia é vermelha, não âmbar: âmbar é "falta fazer hoje", vermelho é
        // "isto está acumulando". A cor precisa distinguir as duas, senão o painel fica sempre
        // do mesmo tom e para de comunicar.
        (piorLacuna?.lacuna.diasEmAberto ?? 0) > 1
          ? 'border-[#ef4444]/50 bg-[#ef4444]/[0.07]'
          : precisaAcao > 0 ? 'border-[#f59e0b]/40 bg-[#f59e0b]/[0.07]' : 'border-[#525252] bg-[#333333]',
      )}
    >
      {/* Cabeçalho: o número que importa primeiro, o contexto depois. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        {precisaAcao > 0
          ? <AlertTriangle size={15} className={cn('shrink-0', (piorLacuna?.lacuna.diasEmAberto ?? 0) > 1 ? 'text-[#f87171]' : 'text-[#fbbf24]')} />
          : <BellRing size={15} className="shrink-0 text-[#4ade80]" />}
        <span className="text-sm font-bold text-[#f5f5f5]">
          RDO de hoje · {fmtDataBR(hoje)}
        </span>
        {piorLacuna && piorLacuna.lacuna.diasEmAberto > 1 && (
          <span className="rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-2.5 py-1 text-xs font-semibold text-[#fca5a5]">
            {piorLacuna.nome} está há {piorLacuna.lacuna.diasEmAberto} dias sem RDO
          </span>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ['pendente', resultado.pendentes, 'sem RDO'],
            ['rascunho', resultado.rascunhos, 'em rascunho'],
            ['sem_producao', resultado.semProducao, 'sem produção'],
            ['ok', resultado.ok, 'feito'],
            ['nao_cobravel', resultado.naoCobraveis, 'não cobra hoje'],
          ] as const).filter(([, n]) => n > 0).map(([estado, n, rotulo]) => (
            <span key={estado} className="inline-flex items-center gap-1.5 rounded-lg border border-[#525252] bg-[#333333]/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#d4d4d4]">
              <span className={cn('h-2 w-2 rounded-full', CORES[estado].ponto)} />
              {n} {rotulo}
            </span>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-[#6b6b6b]">
          todas as {sites.length} obra{sites.length !== 1 ? 's' : ''}
          {activeObraId && ` · ativa: ${sites.find((s) => s.id === activeObraId)?.name ?? '—'}`}
        </span>
      </div>

      {precisaAcao === 0 && resultado.ok === 0 && resultado.semProducao === 0 ? null : (
        <div className="border-t border-[#525252]/60">
          {visiveis.map((linha) => {
            const cor = CORES[linha.status]
            const ehAtiva = linha.site.id === activeObraId
            return (
              <div
                key={linha.site.id}
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[#525252]/40 px-4 py-2 last:border-b-0',
                  ehAtiva && 'bg-[#3b82f6]/[0.06]',
                )}
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', cor.ponto)} />
                <span className="min-w-0 truncate text-xs font-semibold text-[#f5f5f5]">
                  {linha.site.name}
                  {ehAtiva && <span className="ml-1.5 text-[9px] font-normal text-[#7dd3fc]">obra ativa</span>}
                </span>
                <span className={cn('text-[11px]', cor.texto)}>
                  {linha.status === 'ok' && `RDO #${linha.numero} finalizado`}
                  {linha.status === 'rascunho' && `RDO #${linha.numero} em rascunho — não alimenta nada até finalizar`}
                  {linha.status === 'sem_producao' && `sem produção: ${linha.motivo}`}
                  {linha.status === 'nao_cobravel' && linha.razaoNaoCobravel}
                  {linha.status === 'pendente' && (() => {
                    const l = lacunas.get(linha.site.id)
                    // Um dia só em aberto continua sendo "sem RDO hoje" — dizer "1 dia sem RDO"
                    // para o próprio dia de hoje soaria como atraso quando ainda dá tempo.
                    if (!l || l.diasEmAberto <= 1) return 'sem RDO hoje'
                    return `${l.diasEmAberto} dias sem RDO${l.truncado ? '+' : ''} — o mais antigo é ${diaComSemana(l.maisAntigo)}`
                  })()}
                </span>

                {podeEscrever && (
                  <div className="ml-auto flex shrink-0 items-center gap-1.5">
                    {(linha.status === 'pendente' || linha.status === 'rascunho') && (
                      <>
                        <button
                          onClick={() => irParaRdo(linha)}
                          className="rounded-md border border-[#525252] px-2 py-1 text-[10px] font-semibold text-[#f97316] hover:border-[#f97316]/50"
                        >
                          {linha.status === 'rascunho' ? 'Finalizar' : 'Fazer RDO'}
                        </button>
                        {linha.status === 'pendente' && (
                          <button
                            onClick={() => setMarcando(linha)}
                            className="rounded-md border border-[#525252] px-2 py-1 text-[10px] font-semibold text-[#a3a3a3] hover:border-[#a3a3a3] hover:text-[#f5f5f5]"
                          >
                            Não teve produção
                          </button>
                        )}
                      </>
                    )}
                    {linha.status === 'sem_producao' && (
                      <button
                        onClick={() => {
                          // O status desta linha é o de HOJE, então o registro a desfazer é o de
                          // hoje — mas dito explicitamente, porque o modal agora marca dia passado
                          // e um `hoje` solto aqui viraria a linha errada na primeira mudança.
                          const registro = dias.find((d) => d.siteId === linha.site.id && d.data === hoje)
                          if (registro) desmarcar(registro.id)
                        }}
                        className="rounded-md border border-[#525252] px-2 py-1 text-[10px] font-semibold text-[#6b6b6b] hover:border-[#a3a3a3] hover:text-[#f5f5f5]"
                      >
                        Desfazer
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {!mostrarTodas && (
            <button
              onClick={() => setExpandido(true)}
              className="w-full border-t border-[#525252]/40 px-4 py-2 text-[11px] font-semibold text-[#a3a3a3] hover:text-[#f5f5f5]"
            >
              Ver todas as {linhas.length} obras
            </button>
          )}
        </div>
      )}

      {/* RDO sem obra: não conta para obra nenhuma, e por isso não pode sumir em silêncio.
          Enquanto existir RDO órfão, o painel acusa obras "sem RDO" que na verdade apontaram. */}
      {resultado.rdosSemObra.length > 0 && (
        <div className="flex items-start gap-2 border-t border-[#525252]/60 px-4 py-2.5 text-[11px] text-[#fdba74]">
          <FileWarning size={13} className="mt-0.5 shrink-0" />
          <span>
            {resultado.rdosSemObra.length} RDO(s) de hoje <strong>sem obra vinculada</strong> — não contam
            para nenhuma obra deste quadro. Abra o RDO no Histórico e informe a obra.
          </span>
        </div>
      )}

      {/* Limite declarado, em vez de fingir cobertura: a tabela do RDO Sabesp não tem vínculo com
          obra da Torre, só com projeto. Uma obra 100% Sabesp ficaria eternamente vermelha aqui. */}
      <div className="border-t border-[#525252]/60 px-4 py-1.5 text-[10px] text-[#525252]">
        Considera RDO padrão e Compizzo. O RDO Sabesp não é vinculado a obra da Torre e fica fora deste quadro.
      </div>

      {marcando && (
        <ModalSemProducao
          linha={marcando}
          // Os dias que estão em aberto nesta obra. Sem isto o modal só sabia marcar HOJE — e uma
          // lacuna aberta em 14/08 não tinha como ser justificada, então ficava vermelha para
          // sempre. Cair em `[hoje]` cobre a obra sem lacuna calculada.
          diasEmAberto={lacunas.get(marcando.site.id)?.dias ?? [hoje]}
          onFechar={() => setMarcando(null)}
          onConfirmar={(data, categoria, motivo) => {
            marcar({ siteId: marcando.site.id, data, categoria, motivo })
            setMarcando(null)
          }}
        />
      )}
    </div>
  )
}

function ModalSemProducao({
  linha, diasEmAberto, onFechar, onConfirmar,
}: {
  linha: LinhaStatusObra
  /** Dias cobráveis em aberto nesta obra, do mais recente para o mais antigo. */
  diasEmAberto: string[]
  onFechar: () => void
  onConfirmar: (data: string, categoria: MotivoSemProducao, motivo?: string) => void
}) {
  const [categoria, setCategoria] = useState<MotivoSemProducao>('chuva')
  const [texto, setTexto] = useState('')
  const [data, setData] = useState(diasEmAberto[0] ?? hojeLocalISO())
  // "Outro" sem descrição não explica nada a quem lê o relatório daqui a três meses.
  const faltaTexto = categoria === 'outros' && texto.trim().length < 3
  const varios = diasEmAberto.length > 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onFechar}>
      <div className="w-full max-w-md rounded-xl border border-[#525252] bg-[#333333] p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-[#f5f5f5]">Dia sem produção</h3>
        <p className="mt-1 text-xs text-[#a3a3a3]">{linha.site.name}</p>
        <p className="mt-2 text-[11px] text-[#6b6b6b]">
          Fica registrado com data, obra e autor. É o que permite explicar depois por que a obra
          parou em X dias do mês — e não é RDO, então não entra em nenhum indicador de produção.
        </p>

        {/* Um dia de cada vez, de propósito: cada dia teve o seu motivo, e marcar cinco de uma vez
            com "chuva" produziria um histórico que ninguém pode defender numa medição. */}
        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
          Qual dia
        </label>
        {varios ? (
          <select
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
          >
            {diasEmAberto.map((d) => (
              <option key={d} value={d}>
                {diaComSemana(d)}{d === hojeLocalISO() ? ' (hoje)' : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-1 text-sm text-[#f5f5f5]">{fmtDataBR(data)}</p>
        )}
        {varios && (
          <p className="mt-1 text-[10px] text-[#6b6b6b]">
            Esta obra tem {diasEmAberto.length} dias em aberto. Marque um; os outros continuam na lista.
          </p>
        )}

        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3]">Motivo</label>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as MotivoSemProducao)}
          className="mt-1 w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
        >
          {MOTIVOS_SEM_PRODUCAO.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>

        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
          Observação {categoria === 'outros' ? '(obrigatória)' : '(opcional)'}
        </label>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={categoria === 'outros' ? 'Descreva o motivo' : 'Detalhe, se quiser'}
          className="mt-1 w-full rounded-lg border border-[#525252] bg-[#2c2c2c] px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#f97316]/60"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onFechar} className="rounded-lg border border-[#525252] px-3 py-2 text-xs font-semibold text-[#a3a3a3] hover:text-[#f5f5f5]">
            Cancelar
          </button>
          <button
            disabled={faltaTexto}
            onClick={() => onConfirmar(data, categoria, texto.trim() || undefined)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-xs font-bold text-white hover:bg-[#ea580c] disabled:cursor-not-allowed disabled:bg-[#484848] disabled:text-[#6b6b6b]"
          >
            <CheckCircle2 size={13} /> Registrar
          </button>
        </div>
      </div>
    </div>
  )
}
