/**
 * horasHomemWcr.ts — converter as horas do apontamento WCR em HOMEM-HORA.
 *
 * ─── O QUE FOI MEDIDO, E POR QUE O CONSERTO NÃO É UMA LINHA SÓ ────────────────
 * `rdoStore` alimenta a ponte de apontamentos com `totalHoras`, e a ponte divide esse número pelo
 * efetivo presente (`maoDeObraStore.syncRdoToTimecards`). Isso está certo para o Compizzo, cujo
 * campo é declaradamente **"HH total do dia (nº colab × jornada)"** (`types/index.ts`). Não está
 * certo para o WCR: lá `horas` é validado entre 0 e 24 por apontamento (`apontamentoWcr.ts`) e
 * somado entre apontamentos (`apontamentoWcrDia.ts`) — é a **duração da jornada de cada equipe**,
 * não homem-hora.
 *
 * Passar `wcr.horas` direto para a ponte dividiria a jornada pelo efetivo: 19 pessoas em 2 equipes
 * de 8 h dariam 16 ÷ 19 = 0,84 h por pessoa. Trocaria um erro (zero) por outro.
 *
 * Então a conversão acontece aqui: **HH = Σ (horas da equipe × pessoas daquela equipe)**.
 *
 * ⚠️ Devolve `undefined` quando ninguém informou horas — ausente não é zero. A ponte já sabe lidar
 * com isso (`totalHoras > 0` é a condição para dividir).
 */
import type { RdoWcrData } from '@/types'

/** Normaliza o nome da equipe para casar apontamento com lista de presença ("Equipe A" × "equipe a"). */
function chaveDaEquipe(v?: string): string {
  return (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

export function horasHomemDoWcr(wcr: RdoWcrData | undefined, totalDePresentes: number): number | undefined {
  if (!wcr) return undefined
  const apontamentos = wcr.apontamentos ?? []
  const comHoras = apontamentos.filter((a) => typeof a.horas === 'number')

  // RDO antigo (um apontamento só, sem a lista `apontamentos`): `wcr.horas` é a jornada do dia.
  if (!comHoras.length) {
    return typeof wcr.horas === 'number' && wcr.horas > 0 && totalDePresentes > 0
      ? wcr.horas * totalDePresentes
      : undefined
  }

  const porEquipe = new Map<string, number>()
  for (const p of wcr.presencas ?? []) {
    const k = chaveDaEquipe(p.equipe)
    porEquipe.set(k, (porEquipe.get(k) ?? 0) + p.pessoas.length)
  }

  let hh = 0
  let semEquipe = 0
  for (const a of comHoras) {
    const pessoas = porEquipe.get(chaveDaEquipe(a.equipe))
    if (pessoas && pessoas > 0) hh += (a.horas ?? 0) * pessoas
    else semEquipe += a.horas ?? 0
  }

  // Apontamento cuja equipe não casou com nenhuma lista de presença: em vez de descartar a jornada
  // (o que devolveria HH menor que a realidade) ou de inventar um efetivo, usa o efetivo do dia
  // ainda não contabilizado. Se não sobrou ninguém, a jornada órfã não entra — melhor faltar do
  // que multiplicar a mesma pessoa duas vezes.
  if (semEquipe > 0) {
    const jaContados = [...porEquipe.values()].reduce((s, n) => s + n, 0)
    const restante = Math.max(0, totalDePresentes - jaContados)
    hh += semEquipe * (restante || (jaContados ? 0 : totalDePresentes))
  }

  return hh > 0 ? hh : undefined
}
