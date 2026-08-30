/**
 * periodo.ts — o intervalo de datas que a reunião olha.
 *
 * ─── POR QUE ISTO EXISTE ──────────────────────────────────────────────────────────────────────
 * Cinco telas do produto tinham cada uma o seu jeito de escolher período — mês, semana, "últimos
 * N dias", intervalo livre —, nenhum reaproveitável, e Gestão 360 não tinha nenhum: mostrava o
 * total acumulado desde sempre. Numa reunião semanal, "quanto gastamos" respondido com o acumulado
 * de dois anos não ajuda ninguém.
 *
 * Aqui ficam só as CONTAS. Elas não dependem de React, então dá para conferir as bordas — semana
 * virando o ano, fevereiro bissexto, o dia 15 e o 16 — num teste de mesa.
 *
 * ─── FUSO ─────────────────────────────────────────────────────────────────────────────────────
 * Nada passa por `toISOString()`. No Brasil ele devolve o dia seguinte a partir das 21h, e o
 * projeto já perdeu o dia 1º de um filtro mensal por causa disso. Tudo usa `dataLocalISO`.
 */
import { dataLocalISO, hojeLocalISO } from '@/lib/utils'
import { montarQuinzena, quinzenaDe, deslocarQuinzena, ultimoDiaDoMes } from '@/features/mao-de-obra/utils/quinzena'

/**
 * ⚠️ Duas famílias, e a diferença importa na navegação:
 *
 *  - **GRADE** (`semana`, `quinzena`, `mes`, `trimestre`): o período é uma casa do calendário. As
 *    setas andam de casa em casa — o mês anterior a março é fevereiro inteiro.
 *  - **JANELA MÓVEL** (`hoje`, `ultimos7`, `ultimos30`, `ultimos3meses`): termina HOJE e olha para
 *    trás. As setas deslocam a janela pelo mesmo tamanho dela.
 */
export type TipoPeriodo =
  | 'hoje' | 'ultimos7' | 'ultimos30' | 'ultimos3meses'
  | 'semana' | 'quinzena' | 'mes' | 'trimestre' | 'livre'

/** Quantos dias cada janela móvel cobre. Ausente = não é janela móvel. */
const DIAS_DA_JANELA: Partial<Record<TipoPeriodo, number>> = {
  hoje: 1, ultimos7: 7, ultimos30: 30, ultimos3meses: 90,
}

export function ehJanelaMovel(tipo: TipoPeriodo): boolean {
  return DIAS_DA_JANELA[tipo] !== undefined
}

export interface Periodo {
  tipo: TipoPeriodo
  /** `yyyy-MM-dd`, inclusivo. */
  de: string
  /** `yyyy-MM-dd`, inclusivo. */
  ate: string
  /** "Semana de 17 a 23/08" · "1ª quinzena de agosto/2026" · "3º trimestre de 2026" */
  rotulo: string
}

const p2 = (n: number) => String(n).padStart(2, '0')
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** `yyyy-MM-dd` → `Date` no fuso local (meia-noite). O `T00:00:00` é o que evita o pulo de fuso. */
export function dataDe(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

/** "2026-08-17" → "17/08" */
const curto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

// ─── Semana ────────────────────────────────────────────────────────────────────
//
// Segunda a domingo, como o calendário brasileiro e a ISO 8601. `getDay()` devolve 0 para domingo,
// então o domingo precisa recuar 6 dias, não 0 — é o erro clássico aqui, e ele desloca a semana
// inteira uma vez a cada sete.

export function semanaDe(dataISO: string): Periodo {
  const d = dataDe(dataISO)
  const diaDaSemana = d.getDay()
  const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1
  const segunda = new Date(d)
  segunda.setDate(d.getDate() - recuo)
  const domingo = new Date(segunda)
  domingo.setDate(segunda.getDate() + 6)
  const de = dataLocalISO(segunda)
  const ate = dataLocalISO(domingo)
  return { tipo: 'semana', de, ate, rotulo: `Semana de ${curto(de)} a ${curto(ate)}` }
}

// ─── Mês ───────────────────────────────────────────────────────────────────────

export function mesDe(dataISO: string): Periodo {
  const ano = Number(dataISO.slice(0, 4))
  const mes = Number(dataISO.slice(5, 7))
  return {
    tipo: 'mes',
    de: `${ano}-${p2(mes)}-01`,
    ate: `${ano}-${p2(mes)}-${p2(ultimoDiaDoMes(ano, mes))}`,
    rotulo: `${MESES[mes - 1]} de ${ano}`,
  }
}

// ─── Trimestre ─────────────────────────────────────────────────────────────────
//
// Trimestre civil (jan–mar, abr–jun, jul–set, out–dez), não "os últimos 90 dias": é assim que
// fecham o balanço e a comparação com o mesmo trimestre do ano passado.

export function trimestreDe(dataISO: string): Periodo {
  const ano = Number(dataISO.slice(0, 4))
  const mes = Number(dataISO.slice(5, 7))
  const numero = Math.floor((mes - 1) / 3) + 1
  const primeiroMes = (numero - 1) * 3 + 1
  const ultimoMes = primeiroMes + 2
  return {
    tipo: 'trimestre',
    de: `${ano}-${p2(primeiroMes)}-01`,
    ate: `${ano}-${p2(ultimoMes)}-${p2(ultimoDiaDoMes(ano, ultimoMes))}`,
    rotulo: `${numero}º trimestre de ${ano}`,
  }
}

// ─── Quinzena ──────────────────────────────────────────────────────────────────
// Reusa `quinzena.ts`, que já decidiu (e documentou) por que a quinzena é 1–15 / 16–fim.

export function quinzenaComoPeriodo(dataISO: string): Periodo {
  const q = quinzenaDe(dataISO)
  return { tipo: 'quinzena', de: q.inicio, ate: q.fim, rotulo: q.rotulo }
}

// ─── Construção e navegação ────────────────────────────────────────────────────

/**
 * A janela que TERMINA na data de referência e olha N dias para trás.
 *
 * ⚠️ A janela de 7 dias inclui hoje: 24 a 30, não 23 a 30. Contar `hoje − 7` dá OITO dias, e é o
 * erro clássico — o mesmo que já custou um dia inteiro num filtro deste projeto.
 */
export function janelaDe(tipo: TipoPeriodo, dias: number, fimISO: string): Periodo {
  const fim = dataDe(fimISO)
  const inicio = new Date(fim)
  inicio.setDate(fim.getDate() - (dias - 1))
  const de = dataLocalISO(inicio)
  const rotulo = dias === 1
    ? `Dia ${curto(fimISO)}`
    : `Últimos ${dias} dias · ${curto(de)} a ${curto(fimISO)}`
  return { tipo, de, ate: fimISO, rotulo }
}

export function periodoDe(tipo: TipoPeriodo, dataDeReferencia = hojeLocalISO()): Periodo {
  const dias = DIAS_DA_JANELA[tipo]
  if (dias !== undefined) return janelaDe(tipo, dias, dataDeReferencia)
  switch (tipo) {
    case 'semana':    return semanaDe(dataDeReferencia)
    case 'quinzena':  return quinzenaComoPeriodo(dataDeReferencia)
    case 'mes':       return mesDe(dataDeReferencia)
    case 'trimestre': return trimestreDe(dataDeReferencia)
    case 'livre':     return { tipo: 'livre', de: dataDeReferencia, ate: dataDeReferencia, rotulo: 'Intervalo livre' }
    // As janelas móveis já saíram acima, no `DIAS_DA_JANELA`. O compilador não consegue estreitar
    // o union depois de uma checagem em tempo de execução, então o caminho é declarado aqui.
    default:          return janelaDe(tipo, DIAS_DA_JANELA[tipo] ?? 1, dataDeReferencia)
  }
}

/**
 * O período anterior (`n = -1`) ou o seguinte (`n = 1`).
 *
 * Anda pela GRADE, não por "somar tantos dias": o mês anterior a 31/03 é março inteiro, não
 * 01/03–31/03 deslocado. Somar dias faria fevereiro pular o dia 28 e o trimestre desalinhar.
 */
export function deslocar(periodo: Periodo, n: number): Periodo {
  if (n === 0) return periodo

  // Janela móvel anda pelo próprio tamanho: "últimos 7 dias" recuado uma vez são os 7 anteriores.
  const dias = DIAS_DA_JANELA[periodo.tipo]
  if (dias !== undefined) {
    const fim = dataDe(periodo.ate)
    fim.setDate(fim.getDate() + n * dias)
    return janelaDe(periodo.tipo, dias, dataLocalISO(fim))
  }

  switch (periodo.tipo) {
    case 'semana': {
      const d = dataDe(periodo.de)
      d.setDate(d.getDate() + n * 7)
      return semanaDe(dataLocalISO(d))
    }
    case 'quinzena': {
      const q = deslocarQuinzena(quinzenaDe(periodo.de), n)
      return { tipo: 'quinzena', de: q.inicio, ate: q.fim, rotulo: q.rotulo }
    }
    case 'mes': {
      // Dia 1 sempre: partir de outra data faria `setMonth` estourar (31 de março − 1 mês = 3 de
      // março, porque fevereiro não tem 31).
      const ano = Number(periodo.de.slice(0, 4))
      const mes = Number(periodo.de.slice(5, 7))
      const d = new Date(ano, mes - 1 + n, 1)
      return mesDe(dataLocalISO(d))
    }
    case 'trimestre': {
      const ano = Number(periodo.de.slice(0, 4))
      const mes = Number(periodo.de.slice(5, 7))
      const d = new Date(ano, mes - 1 + n * 3, 1)
      return trimestreDe(dataLocalISO(d))
    }
    // As janelas móveis já saíram acima; o compilador não estreita o union depois de uma
    // checagem em tempo de execução, então o caminho é declarado aqui.
    default:
    case 'livre': {
      // Desloca pelo próprio tamanho do intervalo, que é o único significado razoável de
      // "o anterior" quando quem escolheu as datas foi a pessoa.
      const dias = diasNoPeriodo(periodo)
      const de = dataDe(periodo.de);  de.setDate(de.getDate() + n * dias)
      const ate = dataDe(periodo.ate); ate.setDate(ate.getDate() + n * dias)
      return { ...periodo, de: dataLocalISO(de), ate: dataLocalISO(ate) }
    }
  }
}

/** Quantos dias o período cobre, contando as duas pontas. */
export function diasNoPeriodo(p: Periodo): number {
  const ms = dataDe(p.ate).getTime() - dataDe(p.de).getTime()
  return Math.round(ms / 86_400_000) + 1
}

/** Comparação de string basta: `yyyy-MM-dd` ordena igual à data. */
export function dentroDoPeriodo(dataISO: string | null | undefined, p: Periodo): boolean {
  if (!dataISO) return false
  const d = dataISO.slice(0, 10)
  return d >= p.de && d <= p.ate
}

/** Intervalo livre a partir de duas datas; inverte se vierem trocadas. */
export function periodoLivre(de: string, ate: string): Periodo {
  const [inicio, fim] = de <= ate ? [de, ate] : [ate, de]
  return { tipo: 'livre', de: inicio, ate: fim, rotulo: `${curto(inicio)} a ${curto(fim)}` }
}

/** O mesmo período, um ciclo antes — para comparar "esta semana × a semana passada". */
export function periodoAnterior(p: Periodo): Periodo {
  return deslocar(p, -1)
}

/** Os meses `yyyy-MM` que o período toca — vários agregadores do projeto são por mês. */
export function mesesDoPeriodo(p: Periodo): string[] {
  const meses: string[] = []
  let ano = Number(p.de.slice(0, 4))
  let mes = Number(p.de.slice(5, 7))
  const ultimo = `${p.ate.slice(0, 4)}-${p.ate.slice(5, 7)}`
  for (let guarda = 0; guarda < 240; guarda++) {
    const atual = `${ano}-${p2(mes)}`
    meses.push(atual)
    if (atual >= ultimo) break
    mes++
    if (mes > 12) { mes = 1; ano++ }
  }
  return meses
}

export { montarQuinzena }
