/**
 * A produção do RDO Compizzo — a unidade de cada linha, e a metragem sem mentira.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────────
 * As linhas padrão do RDO Compizzo trazem a unidade **dentro do nome do serviço** —
 * "Pintura Vermelha (m²)", "Faixa Branca (m)", "Vagas PCD (un)" — e deixam o campo `unidade`
 * vazio. Quatro lugares diferentes lidaram com isso de quatro jeitos, e três estavam errados:
 *
 *   · a tela de detalhe usava `p.unidade || 'm²'` — literal como recurso. Metro linear de faixa
 *     saía rotulado **m²**, e o total somava m, m² e unidade num número só, também chamado de m²;
 *   · `planoExecucao.ts` filtrava por REGEX NO NOME (`/m²|m2/i`), então "Retirada de Piso Epoxi
 *     Antigo" — 750 m² de verdade — ficava fora do executado, do progresso, do ritmo e do RUP;
 *   · o gerador de PDF nem imprimia a unidade.
 *
 * Puro, sem React: dá para conferir de mesa que 200 m de faixa nunca viram 200 m² de piso.
 */
import type { RdoCompizzoProducaoRow } from '@/types'
import { classificarUnidade, somarMetragem, type Metragem } from '@/lib/unidadesMedida'
import { parseLocaleNumber } from '@/lib/numberFormat'

/**
 * A unidade escrita entre parênteses no nome do serviço: `"Faixa Branca (m)"` → `"m"`.
 *
 * Só o que está entre parênteses, e só as unidades conhecidas — "Pintura (fachada)" não vira
 * unidade nenhuma.
 */
export function unidadeNoNome(servico: string | null | undefined): string | undefined {
  const m = /\(\s*(m²|m2|ml|m|un|kg|l|h|vb)\s*\)\s*$/i.exec((servico ?? '').trim())
  if (!m) return undefined
  return m[1].toLowerCase().replace('m2', 'm²')
}

/**
 * A unidade de uma linha de produção: o campo quando preenchido, o nome como recurso.
 *
 * ⚠️ Devolve `undefined` quando não dá para saber — **nunca "m²" por padrão**. Um recurso que
 * chuta área é pior que nenhum: ele faz metro linear parecer metro quadrado, e o número resultante
 * não pode ser conferido por ninguém.
 */
export function unidadeDaLinha(row: Pick<RdoCompizzoProducaoRow, 'unidade' | 'servico'>): string | undefined {
  const declarada = (row.unidade ?? '').trim()
  if (declarada) return declarada
  return unidadeNoNome(row.servico)
}

/** As linhas que de fato têm quantidade lançada. As padrão em branco não contam. */
export function linhasComQuantidade(rows: RdoCompizzoProducaoRow[] | undefined): RdoCompizzoProducaoRow[] {
  return (rows ?? []).filter((r) => (r.quantidade ?? '').trim() !== '' && parseLocaleNumber(r.quantidade) !== 0)
}

/** A metragem do dia, separada por tipo de unidade. Nunca um total só. */
export function metragemDaProducao(rows: RdoCompizzoProducaoRow[] | undefined): Metragem {
  return somarMetragem(
    (rows ?? []).map((r) => ({ unidade: unidadeDaLinha(r), quantidade: parseLocaleNumber(r.quantidade) })),
  )
}

/**
 * Só o que é ÁREA, que é o denominador do RUP.
 *
 * RUP é homem-hora por metro quadrado. Num dia só de faixa linear não existe RUP em m² — e é por
 * isso que isto devolve 0 em vez de somar o que houver.
 */
export function areaExecutada(rows: RdoCompizzoProducaoRow[] | undefined): number {
  return metragemDaProducao(rows).area
}

/** `true` quando a linha mede área — o que `planoExecucao` precisava e resolvia por regex no nome. */
export function ehLinhaDeArea(row: Pick<RdoCompizzoProducaoRow, 'unidade' | 'servico'>): boolean {
  return classificarUnidade(unidadeDaLinha(row)) === 'area'
}

// ─── A classificação da linha ─────────────────────────────────────────────────

/**
 * O valor do `<option>` de serviço avulso.
 *
 * ⚠️ NUNCA é gravado em `faseId`. Ver o docblock de `RdoCompizzoProducaoRow.classificacao`: um
 * sentinela ali faria `ehPorFase` valer para todo RDO e criaria uma chave fantasma na meta.
 */
export const OPCAO_AVULSO = '__avulso__'

export type ClassificacaoDaLinha = 'fase' | 'avulso' | 'nao-escolhida'

/**
 * O que esta linha é — inclusive nos RDO salvos antes de o campo existir.
 *
 * ⚠️ A derivação pelo `servico` é o que faz o RDO de agosto reabrir intacto. Antes desta mudança,
 * `faseId` vazio com `servico` escrito era a ÚNICA forma de avulso que a tela oferecia; sem a
 * última linha daqui, aquele documento reabriria com o nome do serviço sumido da tela — e quem
 * salvasse o apagaria de vez.
 */
export function classificacaoDaLinha(
  row: Pick<RdoCompizzoProducaoRow, 'faseId' | 'classificacao' | 'servico'>,
): ClassificacaoDaLinha {
  if (row.faseId) return 'fase'                      // a fase manda sobre tudo
  if (row.classificacao) return row.classificacao    // a escolha explícita de quem digitou
  return (row.servico ?? '').trim() !== '' ? 'avulso' : 'nao-escolhida'
}

/**
 * Linha sem classificação e sem nada digitado — ruído de tela, não vai para o documento.
 *
 * ⚠️ `quantidadePrevista` sozinha CONTA como conteúdo: meta digitada com a quantidade do dia ainda
 * em branco é informação, e descartá-la apagaria a meta da atividade no Planejamento.
 */
export function linhaVazia(row: RdoCompizzoProducaoRow): boolean {
  return classificacaoDaLinha(row) === 'nao-escolhida'
    && (row.quantidade ?? '').trim() === ''
    && row.quantidadePrevista == null
}

/**
 * Os índices das linhas com quantidade e sem nada a que atribuí-la.
 *
 * ⚠️ É o caso que o "Selecionar Fase" como padrão cria: alguém digita 120 e não escolhe a fase.
 * Esse número seria gravado, impresso e não entraria nem na meta (`realizadoPorFaseNoPeriodo`
 * exige `faseId`) nem no Planejamento (`buildProducaoFinal` exige nome) — um valor que o sistema
 * mostra e não sabe explicar.
 */
export function linhasSemDestino(rows: readonly RdoCompizzoProducaoRow[]): number[] {
  return rows.flatMap((r, i) => {
    const cls = classificacaoDaLinha(r)
    const temQtd = (r.quantidade ?? '').trim() !== ''
    if (cls === 'nao-escolhida' && temQtd) return [i]
    if (cls === 'avulso' && temQtd && !(r.servico ?? '').trim()) return [i]
    return []
  })
}
