/**
 * PeriodoSelector — a barra de período compartilhada.
 *
 * Controlado: quem usa é dono do estado. As contas todas vivem em `@/lib/periodo`, sem React,
 * para poderem ser conferidas num teste de mesa — semana virando o ano, fevereiro bissexto e o
 * "mês anterior" a partir do dia 31 são exatamente o tipo de coisa que erra em silêncio.
 */
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { periodoDe, deslocar, periodoLivre, diasNoPeriodo, type Periodo, type TipoPeriodo } from '@/lib/periodo'
import { hojeLocalISO } from '@/lib/utils'

const TIPOS: { tipo: TipoPeriodo; rotulo: string }[] = [
  { tipo: 'semana',    rotulo: 'Semana'    },
  { tipo: 'quinzena',  rotulo: 'Quinzena'  },
  { tipo: 'mes',       rotulo: 'Mês'       },
  { tipo: 'trimestre', rotulo: 'Trimestre' },
  { tipo: 'livre',     rotulo: 'Livre'     },
]

interface Props {
  valor: Periodo
  onChange: (p: Periodo) => void
  /** Texto extra à direita — costuma ser a obra em escopo. */
  contexto?: React.ReactNode
  className?: string
}

export function PeriodoSelector({ valor, onChange, contexto, className }: Props) {
  const ehLivre = valor.tipo === 'livre'

  function trocarTipo(tipo: TipoPeriodo) {
    // Ao trocar de granularidade, o período novo é o que CONTÉM a data inicial do atual — assim
    // "semana de 17/08" vira "agosto", e não "o mês em que estamos hoje". Quem estava olhando
    // março não é jogado de volta para o mês corrente.
    if (tipo === 'livre') { onChange(periodoLivre(valor.de, valor.ate)); return }
    onChange(periodoDe(tipo, valor.de))
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex gap-1 rounded-lg border border-[#525252] bg-[#3d3d3d] p-1">
        {TIPOS.map((t) => (
          <button
            key={t.tipo}
            onClick={() => trocarTipo(t.tipo)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              valor.tipo === t.tipo ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            {t.rotulo}
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
        {valor.ate > hojeLocalISO() && <span className="text-[#fbbf24]"> · inclui dias que ainda não aconteceram</span>}
      </span>

      {contexto && <span className="text-[11px] text-[#a3a3a3]">{contexto}</span>}
    </div>
  )
}
