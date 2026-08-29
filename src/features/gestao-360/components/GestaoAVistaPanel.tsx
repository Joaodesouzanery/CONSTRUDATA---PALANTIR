/**
 * Gestão à Vista — o quadro do canteiro, dentro do sistema.
 *
 * ─── DE ONDE VEIO ─────────────────────────────────────────────────────────────
 * De uma foto do quadro impresso que a construtora mantém na parede: efetivo por cargo, situação
 * do dia em barras, frequência e absenteísmo com as séries mensais, e o avanço por serviço mês a
 * mês. É o que o gestor de obra realmente olha.
 *
 * Esta aba ocupa o lugar da antiga "Relatório 360", que era permanentemente vazia — nenhuma tela
 * do app cria um `DailyReport`, então ela só sabia dizer "Nenhum relatório encontrado para esta
 * data". Não é tela nova: é uma morta ressuscitada com o que o gestor precisa.
 *
 * ─── O BOTÃO DE IMPRIMIR NÃO É ENFEITE ────────────────────────────────────────
 * O ponto do quadro é ir para a parede. Sem sair em A4, isto é só mais uma tela que ninguém abre.
 */
import { useMemo } from 'react'
import { Printer } from 'lucide-react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useRdoStore } from '@/store/rdoStore'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useActiveObraStore } from '@/store/activeObraStore'
import { useAuth } from '@/lib/auth'
import { useShallow } from 'zustand/react/shallow'
import { hojeLocalISO, fmtDataBR } from '@/lib/utils'
import { isDemoModeEnabled } from '@/lib/runtimeMode'
import { montarGestaoAVista } from '../utils/gestaoAVista'
import { ROTULO_SITUACAO, type SituacaoDoDia } from '@/features/mao-de-obra/utils/frequencia'
import { openGestaoAVistaWindow, printGestaoAVistaInto, printGestaoAVistaViaIframe } from '../utils/gestaoAVistaExport'

/** Cor por situação. Verde só para presente — o resto é ausência de trabalho, em tons neutros. */
const COR: Record<SituacaoDoDia, string> = {
  presente: '#22c55e', folga: '#38bdf8', falta: '#ef4444',
  atestado: '#eab308', ferias: '#a855f7', outros: '#a3a3a3',
}

/** `2026-08` → `ago/26`. */
const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function rotuloMes(m: string): string {
  const [ano, mes] = m.split('-')
  return `${MES_CURTO[Number(mes) - 1]}/${ano.slice(2)}`
}

const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)

export function GestaoAVistaPanel() {
  const activeObraId = useActiveObraStore((s) => s.activeObraId)
  const sites = useTorreStore((s) => s.sites)
  const rdos = useRdoStore((s) => s.rdos)
  const feriados = usePlanejamentoStore((s) => s.holidays)
  const jornada = usePlanejamentoStore((s) => s.scheduleConfig.workWeekMode)
  const profile = useAuth((s) => s.profile)
  const { workers, absences, shifts, timecards } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, absences: s.absences, shifts: s.shifts, timecards: s.timecards })),
  )

  const hoje = hojeLocalISO()
  const site = activeObraId ? sites.find((s) => s.id === activeObraId) ?? null : null

  const dados = useMemo(() => {
    // O recorte de mão de obra é o mesmo do resto do produto: quem tem esta obra, mais quem não
    // tem obra nenhuma (o "geral"). Sem obra selecionada, é a empresa inteira.
    const doEscopo = activeObraId
      ? workers.filter((w) => !w.siteId || w.siteId === activeObraId)
      : workers
    const ids = new Set(doEscopo.map((w) => w.id))
    return montarGestaoAVista({
      site,
      workers: doEscopo,
      absences: absences.filter((a) => ids.has(a.workerId)),
      shifts: shifts.filter((s) => ids.has(s.workerId)),
      timecards: timecards.filter((t) => ids.has(t.workerId)),
      rdos,
      feriados: new Set(feriados.map((f) => f.date)),
      jornada,
      hoje,
    })
  }, [site, activeObraId, workers, absences, shifts, timecards, rdos, feriados, jornada, hoje])

  function imprimir() {
    // `window.open` PRECISA ser síncrono no clique — depois de um `await` o navegador bloqueia.
    const win = openGestaoAVistaWindow()
    const payload = {
      dados,
      empresa: site?.owner || profile?.full_name || 'ConstruData',
      emitidoPor: profile?.full_name ?? undefined,
      hoje,
      demo: isDemoModeEnabled(),
    }
    if (win) void printGestaoAVistaInto(win, payload)
    else void printGestaoAVistaViaIframe(payload)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#f5f5f5]">Gestão à Vista</h2>
          <p className="text-[11px] text-[#a3a3a3]">
            {dados.obraNome} · {fmtDataBR(hoje)}
            {!activeObraId && ' · escolha uma obra na barra lateral para ver o avanço do contrato'}
          </p>
        </div>
        <button
          type="button" onClick={imprimir}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#525252] px-3 text-[12px] font-medium text-[#d4d4d4] hover:text-[#f5f5f5]"
          title="Gera o quadro em A4, para imprimir e afixar no canteiro"
        >
          <Printer size={13} /> Imprimir o quadro
        </button>
      </div>

      {dados.vazio ? (
        <p className="rounded-xl border border-dashed border-[#525252] bg-[#242424] p-8 text-center text-sm text-[#a3a3a3]">
          Sem funcionários cadastrados e sem contrato nesta obra — não há quadro para montar.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <BlocoEfetivo dados={dados} />
            <BlocoSituacao dados={dados} />
          </div>
          <BlocoSeries dados={dados} />
          <BlocoAvanco dados={dados} />
        </div>
      )}
    </div>
  )
}

type Dados = ReturnType<typeof montarGestaoAVista>

function Painel({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#525252] bg-[#333333] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#a3a3a3]">{titulo}</p>
      {sub && <p className="mt-0.5 text-[11px] text-[#a3a3a3]">{sub}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function BlocoEfetivo({ dados }: { dados: Dados }) {
  const { linhas, total } = dados.efetivo
  return (
    <Painel titulo="Efetivo" sub="Quem está na folha hoje, por cargo">
      {linhas.length === 0
        ? <p className="text-[12px] text-[#a3a3a3]">Nenhum funcionário na folha neste escopo.</p>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-[#525252] text-[10px] uppercase tracking-wide text-[#a3a3a3]">
                  <th className="py-1.5 text-left font-medium">Cargo</th>
                  <th className="py-1.5 text-right font-medium">Adm.</th>
                  <th className="py-1.5 text-right font-medium">Produção</th>
                  <th className="py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.cargo} className="border-b border-[#525252]/50">
                    <td className="py-1 text-[#e5e5e5]">{l.cargo}</td>
                    <td className="py-1 text-right font-mono text-[#a3a3a3]">{l.administrativo || '—'}</td>
                    <td className="py-1 text-right font-mono text-[#a3a3a3]">{l.producao || '—'}</td>
                    <td className="py-1 text-right font-mono font-semibold text-[#f5f5f5]">{l.total}</td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-1.5 font-semibold text-[#f5f5f5]">Total</td>
                  <td className="pt-1.5 text-right font-mono text-[#f5f5f5]">{total.administrativo}</td>
                  <td className="pt-1.5 text-right font-mono text-[#f5f5f5]">{total.producao}</td>
                  <td className="pt-1.5 text-right font-mono font-bold text-[#f5f5f5]">{total.total}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-[10px] leading-4 text-[#a3a3a3]">
              A separação entre administrativo e produção vem do campo <b>Departamento</b> do
              cadastro. Quem está em branco conta como produção.
            </p>
          </div>
        )}
    </Painel>
  )
}

function BlocoSituacao({ dados }: { dados: Dados }) {
  const { total, contagem } = dados.situacaoHoje
  const f = dados.frequenciaDoMes
  return (
    <Painel titulo="Situação de hoje" sub={`${total} pessoa${total !== 1 ? 's' : ''} na folha`}>
      <div className="flex flex-col gap-1.5">
        {contagem.filter((c) => c.pessoas > 0).map((c) => (
          <div key={c.situacao} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[11px] text-[#d4d4d4]">{ROTULO_SITUACAO[c.situacao]}</span>
            <div className="h-3.5 flex-1 overflow-hidden rounded bg-[#2c2c2c]">
              <div className="h-full rounded" style={{ width: `${c.pct}%`, backgroundColor: COR[c.situacao] }} />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-[11px] text-[#e5e5e5]">{c.pct}%</span>
          </div>
        ))}
        {total === 0 && <p className="text-[12px] text-[#a3a3a3]">Ninguém na folha neste escopo.</p>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#525252] pt-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">Frequência do mês</p>
          <p className="text-xl font-bold tabular-nums text-[#4ade80]">{pct(f.frequenciaPct)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#a3a3a3]">Absenteísmo</p>
          <p className="text-xl font-bold tabular-nums text-[#fbbf24]">{pct(f.absenteismoPct)}</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[#a3a3a3]">
        Presenças ÷ (pessoas na folha × {f.diasUteis} dia{f.diasUteis !== 1 ? 's' : ''} útil
        {f.diasUteis !== 1 ? 'eis' : ''} do mês). Conta como presença o dia com <b>turno na Escala
        ou apontamento de horas</b> — o RDO finalizado gera apontamento, então quem trabalha por RDO
        aparece aqui sem precisar montar escala. Domingo, sábado fora da jornada e feriado não
        entram. Dia sem nenhum registro conta como <b>Outros</b>, e não como presença: presumir
        presença por falta de dado inflaria este número justamente onde ele é desconhecido.
      </p>
    </Painel>
  )
}

function BlocoSeries({ dados }: { dados: Dados }) {
  const maxFaltas = Math.max(1, ...dados.serie.map((p) => p.faltas))
  return (
    <Painel titulo="Mês a mês" sub="Frequência, absenteísmo e faltas por funcionário">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-[11px]">
          <thead>
            <tr className="border-b border-[#525252] text-[10px] uppercase tracking-wide text-[#a3a3a3]">
              <th className="py-1.5 text-left font-medium">Mês</th>
              <th className="py-1.5 text-right font-medium">Frequência</th>
              <th className="py-1.5 text-right font-medium">Absenteísmo</th>
              <th className="py-1.5 text-right font-medium">Ativos</th>
              <th className="py-1.5 text-right font-medium">Faltas</th>
              <th className="py-1.5 text-right font-medium">Faltas/func.</th>
              <th className="py-1.5 pl-3 text-left font-medium">Faltas</th>
            </tr>
          </thead>
          <tbody>
            {dados.serie.map((p) => (
              <tr key={p.mes} className="border-b border-[#525252]/50">
                <td className="py-1 text-[#e5e5e5]">{rotuloMes(p.mes)}</td>
                <td className="py-1 text-right font-mono text-[#4ade80]">{pct(p.frequenciaPct)}</td>
                <td className="py-1 text-right font-mono text-[#fbbf24]">{pct(p.absenteismoPct)}</td>
                <td className="py-1 text-right font-mono text-[#a3a3a3]">{p.ativos}</td>
                <td className="py-1 text-right font-mono text-[#e5e5e5]">{p.faltas}</td>
                <td className="py-1 text-right font-mono text-[#e5e5e5]">
                  {p.faltasPorFuncionario === null ? '—' : p.faltasPorFuncionario.toLocaleString('pt-BR')}
                </td>
                <td className="py-1 pl-3">
                  <div className="h-2.5 w-full max-w-[160px] overflow-hidden rounded bg-[#2c2c2c]">
                    <div className="h-full rounded bg-[#ef4444]/70" style={{ width: `${(p.faltas / maxFaltas) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Painel>
  )
}

function BlocoAvanco({ dados }: { dados: Dados }) {
  if (dados.semComposicao) {
    return (
      <Painel titulo="Avanço por serviço">
        <p className="text-[12px] leading-5 text-[#a3a3a3]">
          Esta obra ainda não tem a composição do contrato cadastrada — sem ela não há serviço
          contra o qual medir. Cadastre em <b>Torre de Controle → a obra → Contrato → Composição</b>.
        </p>
      </Painel>
    )
  }
  return (
    <Painel titulo="Avanço por serviço" sub="O que foi executado, mês a mês, contra o contratado">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[11px]">
          <thead>
            <tr className="border-b border-[#525252] text-[10px] uppercase tracking-wide text-[#a3a3a3]">
              <th className="py-1.5 text-left font-medium">Serviço</th>
              <th className="py-1.5 text-right font-medium">Contratado</th>
              <th className="py-1.5 text-right font-medium">Medido</th>
              <th className="py-1.5 text-right font-medium">%</th>
              {dados.meses.map((m) => (
                <th key={m} className="py-1.5 text-right font-medium">{rotuloMes(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.avanco.map((l) => (
              <tr key={l.servicoId} className="border-b border-[#525252]/50">
                <td className="max-w-[180px] truncate py-1 text-[#e5e5e5]" title={l.descricao}>{l.descricao}</td>
                <td className="py-1 text-right font-mono text-[#a3a3a3]">
                  {l.contratado ? `${l.contratado.toLocaleString('pt-BR')} ${l.unidade}` : '—'}
                </td>
                <td className="py-1 text-right font-mono text-[#e5e5e5]">{l.medido.toLocaleString('pt-BR')}</td>
                <td className="py-1 text-right font-mono font-semibold text-[#f5f5f5]">
                  {l.pct === null ? '—' : `${l.pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`}
                </td>
                {l.porMes.map((q, i) => (
                  <td key={dados.meses[i]}
                      className={`py-1 text-right font-mono ${q > 0 ? 'bg-[#22c55e]/10 text-[#4ade80]' : 'text-[#525252]'}`}>
                    {q > 0 ? q.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '·'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-[#a3a3a3]">
        Sai dos RDOs <b>finalizados</b> desta obra — rascunho não conta. Este é o <b>executado</b>;
        o quadro impresso da construtora tem também colunas de previsto, que dependem de um
        cronograma por serviço que este sistema ainda não guarda.
      </p>
    </Painel>
  )
}
