/**
 * quinzena.ts — a quinzena de calendário brasileira: dia 1 ao 15, e 16 ao fim do mês.
 *
 * ─── POR QUE ESTA DEFINIÇÃO, E NÃO "A CADA 14 DIAS" ───────────────────────────────────────────
 * Um ciclo fixo de 14 dias seria mais justo para comparar produtividade entre períodos, porque
 * todo período teria o mesmo tamanho. Mas ele desalinha do mês — e a folha, a medição e todo
 * relatório mensal deste produto fecham por mês. Uma avaliação quinzenal que não fecha junto com
 * a folha obriga a conciliar duas linhas do tempo a cada fechamento.
 *
 * O preço dessa escolha, dito na cara: a segunda quinzena varia de 13 a 16 dias conforme o mês.
 * Quem comparar produtividade entre quinzenas precisa olhar dias úteis, não o total bruto — por
 * isso `diasNaQuinzena` existe e é exposto.
 *
 * Todas as datas em `yyyy-MM-dd` no fuso LOCAL. Nada aqui passa por `toISOString()`, que no Brasil
 * devolve o dia seguinte depois das 21h — o bug que já custou caro no resto do projeto.
 */
import { hojeLocalISO } from '@/lib/utils'

export interface Quinzena {
  /** Chave estável e ordenável: `2026-08-Q1`. */
  id: string
  ano: number
  /** 1–12. */
  mes: number
  /** 1 = dias 1–15; 2 = dia 16 ao fim do mês. */
  numero: 1 | 2
  inicio: string
  fim: string
  /** "1ª quinzena de agosto/2026" */
  rotulo: string
  diasNaQuinzena: number
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const p2 = (n: number) => String(n).padStart(2, '0')

/** Último dia do mês. `new Date(ano, mes, 0)` devolve o dia 0 do mês seguinte = o último deste. */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate()
}

export function montarQuinzena(ano: number, mes: number, numero: 1 | 2): Quinzena {
  const fimDoMes = ultimoDiaDoMes(ano, mes)
  const inicioDia = numero === 1 ? 1 : 16
  const fimDia = numero === 1 ? 15 : fimDoMes
  return {
    id: `${ano}-${p2(mes)}-Q${numero}`,
    ano, mes, numero,
    inicio: `${ano}-${p2(mes)}-${p2(inicioDia)}`,
    fim: `${ano}-${p2(mes)}-${p2(fimDia)}`,
    rotulo: `${numero}ª quinzena de ${MESES[mes - 1]}/${ano}`,
    diasNaQuinzena: fimDia - inicioDia + 1,
  }
}

/** A quinzena que contém a data (`yyyy-MM-dd`). */
export function quinzenaDe(dataISO: string): Quinzena {
  const [ano, mes, dia] = dataISO.slice(0, 10).split('-').map(Number)
  return montarQuinzena(ano, mes, dia <= 15 ? 1 : 2)
}

export function quinzenaAtual(): Quinzena {
  return quinzenaDe(hojeLocalISO())
}

/** Navega n quinzenas para trás (n negativo) ou para frente, atravessando meses e anos. */
export function deslocarQuinzena(q: Quinzena, n: number): Quinzena {
  // Índice absoluto de quinzenas desde o ano 0 — evita o vaivém de somar mês e corrigir a virada.
  const indice = (q.ano * 12 + (q.mes - 1)) * 2 + (q.numero - 1) + n
  const ano = Math.floor(indice / 24)
  const resto = indice - ano * 24
  return montarQuinzena(ano, Math.floor(resto / 2) + 1, (resto % 2 === 0 ? 1 : 2))
}

/** A data cai dentro desta quinzena? Comparação por string, que é segura em `yyyy-MM-dd`. */
export function dentroDaQuinzena(dataISO: string, q: Quinzena): boolean {
  const d = dataISO.slice(0, 10)
  return d >= q.inicio && d <= q.fim
}

/**
 * A avaliação pertence a esta quinzena?
 *
 * O período da avaliação é um intervalo digitado pelo usuário, não um ciclo. Considera-se da
 * quinzena a avaliação cujo FIM cai dentro dela — é o fim que diz de que período ela fala.
 */
export function avaliacaoNaQuinzena(
  avaliacao: { periodStart?: string; periodEnd?: string },
  q: Quinzena,
): boolean {
  const fim = avaliacao.periodEnd?.slice(0, 10)
  if (fim) return dentroDaQuinzena(fim, q)
  const inicio = avaliacao.periodStart?.slice(0, 10)
  return inicio ? dentroDaQuinzena(inicio, q) : false
}
