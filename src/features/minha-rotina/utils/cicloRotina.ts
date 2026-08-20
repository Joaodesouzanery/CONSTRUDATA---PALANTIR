/**
 * cicloRotina.ts — a etiqueta do ciclo em que uma rotina cai.
 *
 * ─── POR QUE ISTO É UMA ETIQUETA, E NÃO UMA DATA ──────────────────────────────────────────────
 * Uma rotina semanal não é "feita no dia 20": é "feita na semana 34". Guardar a data solta obriga
 * a perguntar "existe alguma execução entre segunda e domingo?" toda vez que a tela desenha, e
 * abre a porta para duas execuções da mesma semana em datas diferentes.
 *
 * Com a etiqueta — `2026-W34` — a pergunta vira uma igualdade, e o índice único do banco
 * (`ux_rotina_execucoes_ciclo`) garante uma execução por ciclo mesmo com duas abas abertas.
 *
 * As quatro etiquetas:
 *
 *     diaria     2026-08-20     um dia
 *     semanal    2026-W34       segunda a domingo (ISO)
 *     quinzenal  2026-08-Q1     dia 1 ao 15, e 16 ao fim do mês
 *     mensal     2026-08        o mês
 *
 * Tudo no fuso LOCAL. `toISOString()` no Brasil devolve o dia seguinte a partir das 21h, e uma
 * rotina marcada às 21h30 de sexta cairia no sábado — ou, pior, na semana seguinte.
 */
import { dataLocalISO, hojeLocalISO } from '@/lib/utils'
import { quinzenaDe } from '@/features/mao-de-obra/utils/quinzena'
import { semanaDe, mesDe, dataDe } from '@/lib/periodo'

export type FrequenciaRotina = 'diaria' | 'semanal' | 'quinzenal' | 'mensal'

export const FREQUENCIAS: { id: FrequenciaRotina; rotulo: string; plural: string }[] = [
  { id: 'diaria',    rotulo: 'Diária',    plural: 'Todo dia'        },
  { id: 'semanal',   rotulo: 'Semanal',   plural: 'Toda semana'     },
  { id: 'quinzenal', rotulo: 'Quinzenal', plural: 'A cada quinzena' },
  { id: 'mensal',    rotulo: 'Mensal',    plural: 'Todo mês'        },
]

/**
 * Semana ISO como `2026-W34`.
 *
 * A ISO 8601 diz que a semana 1 é a que contém a primeira quinta-feira do ano — por isso o
 * `+ 4 - (dia || 7)`, que empurra qualquer data para a quinta da semana dela. Sem esse ajuste, os
 * primeiros dias de janeiro caem numa "semana 0" que não existe, e os últimos de dezembro ficam
 * na semana 53 quando já pertencem à semana 1 do ano seguinte.
 */
export function semanaISO(dataISO: string): string {
  const d = dataDe(dataISO)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const inicioDoAno = new Date(d.getFullYear(), 0, 1)
  const semana = Math.ceil(((d.getTime() - inicioDoAno.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getFullYear()}-W${String(semana).padStart(2, '0')}`
}

/** A etiqueta do ciclo em que `dataISO` cai, para uma rotina daquela frequência. */
export function cicloDe(frequencia: FrequenciaRotina, dataISO: string = hojeLocalISO()): string {
  switch (frequencia) {
    case 'diaria':    return dataISO.slice(0, 10)
    case 'semanal':   return semanaISO(dataISO)
    case 'quinzenal': return quinzenaDe(dataISO).id
    case 'mensal':    return dataISO.slice(0, 7)
  }
}

/** Como o ciclo aparece na tela: "hoje", "esta semana", "1ª quinzena de agosto"… */
export function rotuloDoCiclo(frequencia: FrequenciaRotina, dataISO: string = hojeLocalISO()): string {
  switch (frequencia) {
    case 'diaria':
      return dataISO === hojeLocalISO() ? 'hoje' : dataISO.split('-').reverse().join('/')
    case 'semanal': {
      const s = semanaDe(dataISO)
      return `semana de ${s.de.slice(8, 10)}/${s.de.slice(5, 7)} a ${s.ate.slice(8, 10)}/${s.ate.slice(5, 7)}`
    }
    case 'quinzenal':
      return quinzenaDe(dataISO).rotulo.toLowerCase()
    case 'mensal':
      return mesDe(dataISO).rotulo
  }
}

/** O primeiro e o último dia do ciclo — para mostrar "vence domingo". */
export function limitesDoCiclo(frequencia: FrequenciaRotina, dataISO: string = hojeLocalISO()): { de: string; ate: string } {
  switch (frequencia) {
    case 'diaria':    return { de: dataISO, ate: dataISO }
    case 'semanal':   { const s = semanaDe(dataISO); return { de: s.de, ate: s.ate } }
    case 'quinzenal': { const q = quinzenaDe(dataISO); return { de: q.inicio, ate: q.fim } }
    case 'mensal':    { const m = mesDe(dataISO); return { de: m.de, ate: m.ate } }
  }
}

/**
 * Quantos dias faltam para o ciclo fechar, contando hoje.
 *
 * `0` = fecha hoje. Negativo não acontece para o ciclo corrente, mas acontece quando a tela olha
 * um ciclo passado — e aí a resposta certa é que ele já fechou.
 */
export function diasAteFechar(frequencia: FrequenciaRotina, dataISO: string = hojeLocalISO()): number {
  const { ate } = limitesDoCiclo(frequencia, dataISO)
  const ms = dataDe(ate).getTime() - dataDe(dataISO).getTime()
  return Math.round(ms / 86_400_000)
}

/** O ciclo anterior ao corrente — para "a semana passada ficou por fazer". */
export function cicloAnterior(frequencia: FrequenciaRotina, dataISO: string = hojeLocalISO()): string {
  const { de } = limitesDoCiclo(frequencia, dataISO)
  const d = dataDe(de)
  d.setDate(d.getDate() - 1)   // um dia antes do início = dentro do ciclo anterior
  return cicloDe(frequencia, dataLocalISO(d))
}
