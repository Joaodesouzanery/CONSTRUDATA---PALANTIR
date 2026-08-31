/**
 * PeriodoSelector — a barra de período compartilhada.
 *
 * Controlado: quem usa é dono do estado. As contas todas vivem em `@/lib/periodo`, sem React,
 * para poderem ser conferidas num teste de mesa — semana virando o ano, fevereiro bissexto e o
 * "mês anterior" a partir do dia 31 são exatamente o tipo de coisa que erra em silêncio.
 */
import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { periodoDe, deslocar, periodoLivre, diasNoPeriodo, trocarParaTipo, contem, type Periodo, type TipoPeriodo } from '@/lib/periodo'
import { hojeLocalISO } from '@/lib/utils'

const ROTULO: Record<TipoPeriodo, string> = {
  hoje: 'Hoje', ultimos7: '7 dias', ultimos30: '30 dias', ultimos3meses: '3 meses',
  semana: 'Semana', quinzena: 'Quinzena', mes: 'Mês', trimestre: 'Trimestre', livre: 'Livre',
}

/** Os atalhos que aparecem quando quem usa não pede uma lista própria. */
const PADRAO: TipoPeriodo[] = ['hoje', 'ultimos7', 'ultimos30', 'mes', 'trimestre', 'ultimos3meses', 'livre']

interface Props {
  valor: Periodo
  onChange: (p: Periodo) => void
  /**
   * Quais atalhos mostrar. Cada tela escolhe os seus — a reunião semanal e o fechamento mensal não
   * fazem as mesmas perguntas.
   *
   * ⚠️ Se o período salvo for de um tipo que NÃO está nesta lista, nenhuma pílula acenderia. O
   * componente resolve isso sozinho: ao montar, ele salta para o primeiro tipo da lista.
   */
  tipos?: TipoPeriodo[]
  /** Texto extra à direita — costuma ser a obra em escopo. */
  contexto?: React.ReactNode
  className?: string
}

export function PeriodoSelector({ valor, onChange, contexto, className, tipos = PADRAO }: Props) {
  const ehLivre = valor.tipo === 'livre'

  /**
   * ⚠️ Duas correções, e as duas vêm do mesmo relato: a tela abriu na semana de 29/06 com a data
   * de hoje em 30/08.
   *
   *  1. **Período que não contém hoje volta para o ciclo corrente.** Havia lógica parecida no
   *     `merge` do store, mas ela só pega o que já VENCEU e só na reidratação. Aqui pega qualquer
   *     descolamento e roda toda vez que a barra monta.
   *  2. **Tipo fora da lista de atalhos** salta para o primeiro — senão nenhuma pílula acende e a
   *     pessoa não sabe onde está.
   *
   * O intervalo LIVRE é preservado: ali a data foi escolhida à mão, e mexer nela seria desfazer o
   * que a pessoa pediu.
   */
  useEffect(() => {
    if (valor.tipo === 'livre') return
    const hoje = hojeLocalISO()
    const foraDaLista = !tipos.includes(valor.tipo)
    const naoContemHoje = !contem(valor, hoje)
    if (foraDaLista) onChange(periodoDe(tipos[0] === 'livre' ? 'hoje' : tipos[0]))
    else if (naoContemHoje) onChange(periodoDe(valor.tipo))
    // Só na montagem: depois disso, navegar para trás com as setas é o que a pessoa pediu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function trocarTipo(tipo: TipoPeriodo) {
    // ⚠️ `trocarParaTipo` existe por causa de um defeito real: aqui havia
    // `periodoDe(tipo, valor.de)`, passando o INÍCIO do período atual como âncora. Para a grade
    // isso está certo ("semana de 17/08" vira "agosto"), mas para janela móvel a âncora é o FIM —
    // e a janela passava a terminar no início do período anterior. Cada clique arrastava a data
    // para trás, acumulando: Trimestre → 3 meses → Hoje levava de 31/08 para 03/04.
    if (tipo === 'livre') { onChange(periodoLivre(valor.de, valor.ate)); return }
    onChange(trocarParaTipo(valor, tipo))
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex gap-1 rounded-lg border border-[#525252] bg-[#3d3d3d] p-1">
        {tipos.map((t) => (
          <button
            key={t}
            onClick={() => trocarTipo(t)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              valor.tipo === t ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            {ROTULO[t]}
          </button>
        ))}
      </div>

      {ehLivre ? (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={valor.de}
            onChange={(e) => onChange(periodoLivre(e.target.value, valor.ate))}
            className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1.5 text-xs text-[#f5f5f5] focus:border-[#f97316]/50 focus:outline-none"
          />
          <span className="text-xs text-[#6b6b6b]">até</span>
          <input
            type="date"
            value={valor.ate}
            onChange={(e) => onChange(periodoLivre(valor.de, e.target.value))}
            className="rounded-lg border border-[#525252] bg-[#2c2c2c] px-2 py-1.5 text-xs text-[#f5f5f5] focus:border-[#f97316]/50 focus:outline-none"
          />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onChange(deslocar(valor, -1))}
            title="Período anterior"
            className="rounded-lg border border-[#525252] p-1.5 text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5]"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="min-w-[190px] text-center text-xs font-medium text-[#f5f5f5]">
            {valor.rotulo}
          </span>
          <button
            onClick={() => onChange(deslocar(valor, 1))}
            title="Próximo período"
            className="rounded-lg border border-[#525252] p-1.5 text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5]"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      <button
        onClick={() => onChange(periodoDe(valor.tipo === 'livre' ? 'semana' : valor.tipo))}
        title="Voltar para o período atual"
        className="flex items-center gap-1.5 rounded-lg border border-[#525252] px-2.5 py-1.5 text-xs text-[#a3a3a3] transition-colors hover:border-[#f97316]/40 hover:text-[#f5f5f5]"
      >
        <CalendarDays size={12} /> Hoje
      </button>

      <span className="text-[11px] text-[#6b6b6b]">
        {valor.de.split('-').reverse().join('/')} a {valor.ate.split('-').reverse().join('/')} · {diasNoPeriodo(valor)} dia{diasNoPeriodo(valor) !== 1 ? 's' : ''}
        {/* ⚠️ Avisa nos DOIS sentidos. Antes só o futuro acendia — um período PASSADO e descolado
            ficava mudo, que é exatamente o caso em que a pessoa lê o número errado sem perceber. */}
        {valor.ate > hojeLocalISO() && <span className="text-[#fbbf24]"> · inclui dias que ainda não aconteceram</span>}
        {valor.ate < hojeLocalISO() && <span className="text-[#fbbf24]"> · período encerrado, não inclui hoje</span>}
      </span>

      {contexto && <span className="text-[11px] text-[#a3a3a3]">{contexto}</span>}
    </div>
  )
}
