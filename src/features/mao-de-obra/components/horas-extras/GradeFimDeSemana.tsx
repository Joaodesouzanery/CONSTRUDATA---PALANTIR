/**
 * A grade de hora extra de fim de semana — pessoa × dia, como a planilha do cliente.
 *
 * ⚠️ Duas regras moram na interação, não em texto:
 *
 *  1. **A sugestão nunca preenche sozinha.** O número do cargo aparece cinza dentro da célula
 *     vazia (placeholder) e só vira valor se alguém digitar ou clicar nele. Célula sem valor
 *     configurado mostra "—", nunca R$ 0,00: "não sei" e "zero" são coisas diferentes.
 *  2. **Célula paga não se edita.** O valor já virou despesa no Controle de Caixa; alterá-lo aqui
 *     deixaria os dois números diferentes em silêncio. Para mexer, desmarque o pagamento — o que
 *     estorna a despesa na cara do usuário.
 */
import { useMemo, useState } from 'react'
import { Check, CircleDollarSign } from 'lucide-react'
import type { Cargo, HoraExtra, PlanHoliday, Worker } from '@/types'
import { cn } from '@/lib/utils'
import { diasDePagamentoDoMes, montarGrade } from '../../utils/gradeHoraExtra'
import { chaveDaPessoa, idDaHoraExtra } from '../../utils/horaExtraCalculo'

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ROTULO: Record<string, string> = { sabado: 'sáb', domingo: 'dom', feriado: 'fer' }

interface Props {
  workers: Worker[]
  cargos: Cargo[]
  horasExtras: HoraExtra[]
  feriados: PlanHoliday[]
  mes: number
  ano: number
  podeEscrever: boolean
  upsertHoraExtra: (he: HoraExtra) => void
  removeHoraExtra: (id: string) => void
  marcarPaga: (id: string, opcoes?: { pagoEm?: string }) => void
  desmarcarPaga: (id: string) => void
}

export function GradeFimDeSemana(props: Props) {
  const { workers, cargos, horasExtras, feriados, mes, ano, podeEscrever } = props
  const dias = useMemo(() => diasDePagamentoDoMes(mes, ano, feriados), [mes, ano, feriados])
  const linhas = useMemo(
    () => montarGrade(workers.filter((w) => w.status === 'active'), horasExtras, dias, cargos),
    [workers, horasExtras, dias, cargos],
  )

  const naoPagos = useMemo(
    () => linhas.flatMap((l) => l.celulas).map((c) => c.lancamento).filter((h): h is HoraExtra => !!h && !h.pago),
    [linhas],
  )
  const total = linhas.reduce((s, l) => s + l.total, 0)
  const pago = linhas.reduce((s, l) => s + l.totalPago, 0)

  function gravar(linha: { workerId?: string; nome: string; cargo?: string }, data: string, valor: number | null, atual?: HoraExtra) {
    if (valor === null || valor <= 0) {
      if (atual) props.removeHoraExtra(atual.id)
      return
    }
    const base = atual ?? {
      id: idDaHoraExtra(chaveDaPessoa({ workerId: linha.workerId, workerNome: linha.nome }), data, 'fim-de-semana'),
      workerId: linha.workerId,
      workerNome: linha.nome,
      cargo: linha.cargo,
      data,
      tipo: 'fim-de-semana' as const,
      pago: false,
      origem: 'manual' as const,
      createdAt: new Date().toISOString(),
    }
    props.upsertHoraExtra({ ...base, valor })
  }

  function pagarTudo() {
    if (!naoPagos.length) return
    const soma = naoPagos.reduce((s, h) => s + h.valor, 0)
    if (!confirm(
      `Marcar ${naoPagos.length} lançamento(s) como pagos?\n\n` +
      `Isso gera ${naoPagos.length} despesa(s) no Controle de Caixa, somando ${brl(soma)}.\n` +
      'Desmarcar depois apaga a despesa correspondente.',
    )) return
    for (const h of naoPagos) props.marcarPaga(h.id)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-[#adadad]">Lançado no mês <b className="ml-1 text-[#f5f5f5]">{brl(total)}</b></span>
          <span className="text-[#adadad]">Já pago <b className="ml-1 text-[#4ade80]">{brl(pago)}</b></span>
          <span className="text-[#adadad]">A pagar <b className="ml-1 text-[#fbbf24]">{brl(total - pago)}</b></span>
        </div>
        {podeEscrever && (
          <button
            type="button" onClick={pagarTudo} disabled={!naoPagos.length}
            className="flex items-center gap-2 rounded-lg border border-[#525252] bg-[#484848] px-3 py-1.5 text-xs font-medium text-[#f5f5f5] transition-colors hover:bg-[#525252] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CircleDollarSign size={14} />
            Marcar {naoPagos.length} como pago
          </button>
        )}
      </div>

      {!dias.length ? (
        <p className="rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-6 text-center text-xs text-[#adadad]">
          Nenhum sábado, domingo ou feriado neste mês.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#525252]">
          <table className="w-full min-w-max border-collapse text-xs">
            <thead>
              <tr className="bg-[#484848] text-[#adadad]">
                <th className="sticky left-0 z-10 bg-[#484848] px-3 py-2 text-left font-medium">Nome</th>
                <th className="px-3 py-2 text-left font-medium">Cargo</th>
                {dias.map((d) => (
                  <th key={d.data} title={d.descricao ?? undefined} className="px-2 py-2 text-center font-medium">
                    <span className="block text-[#f5f5f5]">{String(d.dia).padStart(2, '0')}</span>
                    <span className={cn('block text-[10px]', d.tipo === 'feriado' ? 'text-[#ffa055]' : 'text-[#8a8a8a]')}>
                      {ROTULO[d.tipo]}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={`${l.workerId ?? ''}${l.nome}`} className="border-t border-[#525252]">
                  <td className="sticky left-0 z-10 bg-[#3d3d3d] px-3 py-1.5 font-medium text-[#f5f5f5]">{l.nome}</td>
                  <td className="px-3 py-1.5 text-[#adadad]">{l.cargo || '—'}</td>
                  {l.celulas.map((c) => (
                    <td key={c.data} className="px-1 py-1 text-center">
                      <Celula
                        celula={c}
                        podeEscrever={podeEscrever}
                        onGravar={(v) => gravar(l, c.data, v, c.lancamento)}
                        onPagar={() => c.lancamento && props.marcarPaga(c.lancamento.id)}
                        onDesmarcar={() => c.lancamento && props.desmarcarPaga(c.lancamento.id)}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold text-[#f5f5f5]">{l.total ? brl(l.total) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Celula({ celula, podeEscrever, onGravar, onPagar, onDesmarcar }: {
  celula: { lancamento?: HoraExtra; sugestao: number | null }
  podeEscrever: boolean
  onGravar: (valor: number | null) => void
  onPagar: () => void
  onDesmarcar: () => void
}) {
  const { lancamento, sugestao } = celula
  const [rascunho, setRascunho] = useState<string | null>(null)
  const pago = !!lancamento?.pago

  if (pago) {
    return (
      <button
        type="button"
        onClick={() => podeEscrever && confirm(
          `Desmarcar o pagamento de ${brl(lancamento.valor)}?\n\n` +
          'A despesa gerada no Controle de Caixa será apagada.',
        ) && onDesmarcar()}
        title={`Pago${lancamento.pagoPor ? ` por ${lancamento.pagoPor}` : ''}${lancamento.pagoEm ? ` em ${lancamento.pagoEm.split('-').reverse().join('/')}` : ''} — clique para desmarcar`}
        className="flex w-20 items-center justify-center gap-1 rounded border border-[#22c55e]/40 bg-[#22c55e]/10 px-1 py-1 text-[11px] font-semibold text-[#4ade80]"
      >
        <Check size={11} />
        {lancamento.valor.toLocaleString('pt-BR')}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-0.5">
      <input
        type="number" min={0} step={10} inputMode="decimal" disabled={!podeEscrever}
        aria-label="Valor da hora extra do dia"
        value={rascunho ?? (lancamento ? String(lancamento.valor) : '')}
        // Placeholder, não valor: a sugestão do cargo fica visível sem nunca ser gravada sozinha.
        placeholder={sugestao === null ? '—' : String(sugestao)}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={() => {
          if (rascunho === null) return
          const limpo = rascunho.trim()
          onGravar(limpo === '' ? null : Number(limpo.replace(',', '.')))
          setRascunho(null)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        className="w-14 rounded border border-[#525252] bg-[#484848] px-1 py-1 text-center text-[11px] text-[#f5f5f5] placeholder:text-[#7a7a7a] disabled:opacity-50"
      />
      {lancamento && podeEscrever && (
        <button
          type="button" onClick={onPagar} title="Marcar como pago — gera a despesa no Controle de Caixa"
          className="rounded border border-[#525252] p-0.5 text-[#8a8a8a] transition-colors hover:border-[#22c55e]/40 hover:text-[#4ade80]"
        >
          <Check size={11} />
        </button>
      )}
    </div>
  )
}
