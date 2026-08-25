/**
 * A faixa de dinheiro do Dashboard de Mão de Obra.
 *
 * ─── POR QUE ISTO EXISTE ──────────────────────────────────────────────────────
 * O cliente perguntou se o Dashboard já tinha as informações de quase todas as abas. A resposta
 * medida foi **não: 7 de 13**. E as três que faltavam são as mais caras — Custo Mensal, Folha de
 * Pagamento e RH Financeiro. Em uma frase: **o Dashboard não mostrava um único valor em reais**,
 * embora o módulo tenha mais de mil linhas de motor de folha.
 *
 * Faltavam também: ocorrências abertas (Escalamento), férias da semana (o KPI de faltas as exclui,
 * então ninguém via quem estava de férias) e faltas DESCOBERTAS — a contagem existia, mas não o
 * dado acionável.
 */
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { custoMesWorker } from '@/features/mao-de-obra/utils/custoMaoObra'
import { hojeLocalISO } from '@/lib/utils'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function Cartao({ rotulo, valor, detalhe, cor }: {
  rotulo: string; valor: string; detalhe?: string; cor?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-3">
      <span className="text-[11px] uppercase tracking-wide text-[#adadad]">{rotulo}</span>
      <span className="font-mono text-lg font-bold tabular-nums" style={{ color: cor ?? '#f5f5f5' }}>{valor}</span>
      {detalhe && <span className="text-[11px] text-[#c9c9c9]">{detalhe}</span>}
    </div>
  )
}

export function FaixaDeCusto() {
  const { workers, payrollHistory, absences, occurrences, timecards } = useMaoDeObraStore(
    useShallow((s) => ({
      workers: s.workers, payrollHistory: s.payrollHistory, absences: s.absences,
      occurrences: s.occurrences, timecards: s.timecards,
    })),
  )

  const hoje = hojeLocalISO()
  const mes = hoje.slice(0, 7)

  const dados = useMemo(() => {
    const ativos = workers.filter((w) => w.status === 'active')

    // Projetado: o custo mensal de quem está ativo. É o mesmo cálculo do Custo Mensal (CMO).
    const projetado = ativos.reduce((s, w) => s + custoMesWorker(w), 0)

    // Realizado: o que os apontamentos do mês registraram de custo de mão de obra.
    const realizado = timecards
      .filter((tc) => tc.date.startsWith(mes))
      .reduce((s, tc) => s + (Number(tc.laborCostBRL) || 0), 0)

    const folha = payrollHistory.find((p) => p.month === mes)

    // Férias da semana — o KPI de faltas as EXCLUI, então elas não apareciam em lugar nenhum.
    const fim = new Date(`${hoje}T12:00:00`)
    fim.setDate(fim.getDate() + 7)
    const fimISO = fim.toISOString().slice(0, 10)
    const deFerias = absences.filter((a) =>
      a.type === 'vacation' && a.date >= hoje && a.date <= fimISO)

    // Faltas descobertas: a contagem de faltas já aparecia; o que não aparecia era esta,
    // que é a acionável — alguém precisa cobrir.
    const descobertas = absences.filter((a) => a.date.startsWith(mes) && a.status === 'uncovered')

    // `LaborOccurrence` não tem status — não há como saber o que foi resolvido. Então mostramos
    // as do mês, que é o que dá para afirmar honestamente.
    const ocorrenciasDoMes = (occurrences ?? []).filter((o) => o.date.startsWith(mes))

    return { projetado, realizado, folha, deFerias, descobertas, ocorrenciasDoMes, ativos: ativos.length }
  }, [workers, payrollHistory, absences, occurrences, timecards, mes, hoje])

  const desvio = dados.projetado > 0 ? ((dados.realizado - dados.projetado) / dados.projetado) * 100 : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao
          rotulo="Custo do mês (projetado)"
          valor={brl(dados.projetado)}
          detalhe={`${dados.ativos} ativo(s), com encargos`}
        />
        <Cartao
          rotulo="Custo realizado"
          valor={brl(dados.realizado)}
          cor={dados.realizado > dados.projetado ? '#fca5a5' : '#4ade80'}
          detalhe={dados.projetado > 0 ? `${desvio >= 0 ? '+' : ''}${desvio.toFixed(0)}% do projetado` : 'dos apontamentos'}
        />
        <Cartao
          rotulo="Folha da competência"
          valor={dados.folha ? brl(dados.folha.totalNet) : '—'}
          detalhe={dados.folha ? `${dados.folha.payslips.length} holerite(s) · ${brl(dados.folha.totalEmployerCost)} com encargos` : 'ainda não gerada'}
        />
        <Cartao
          rotulo="Faltas sem substituto"
          valor={String(dados.descobertas.length)}
          cor={dados.descobertas.length > 0 ? '#fca5a5' : '#4ade80'}
          detalhe={dados.descobertas.length > 0 ? 'alguém precisa cobrir' : 'tudo coberto no mês'}
        />
      </div>

      {(dados.deFerias.length > 0 || dados.ocorrenciasDoMes.length > 0) && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-[#525252] bg-[#3d3d3d] px-4 py-2.5 text-xs">
          {dados.deFerias.length > 0 && (
            <span className="text-[#c9c9c9]">
              <b className="text-[#f5f5f5]">{dados.deFerias.length}</b> de férias nos próximos 7 dias
              {' — '}{[...new Set(dados.deFerias.map((a) => workers.find((w) => w.id === a.workerId)?.name ?? '?'))].slice(0, 4).join(', ')}
            </span>
          )}
          {dados.ocorrenciasDoMes.length > 0 && (
            <span className="text-[#c9c9c9]">
              <b className="text-[#fbbf24]">{dados.ocorrenciasDoMes.length}</b> ocorrência(s) no mês
              {' — '}{dados.ocorrenciasDoMes.reduce((s2, o) => s2 + (Number(o.impactHours) || 0), 0)}h de impacto
            </span>
          )}
        </div>
      )}
    </div>
  )
}
