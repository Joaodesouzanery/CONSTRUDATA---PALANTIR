/**
 * A linha de base MEDIDA — o instrumento que falta para provar economia.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────────
 *
 * O pedido foi: "como eu provo ao cliente que economizei?". A resposta honesta, e que o próprio
 * `economiaEngine.ts:863-878` já registrava, é que hoje **não dá**: de treze tipos de evento, um
 * só é medição pura; o resto é `dado real × constante fixa × um formulário de premissas que nasce
 * preenchido com números de exemplo`.
 *
 * ⚠️ **Economia nunca é medida — ela é a diferença entre o que aconteceu e o que TERIA
 * acontecido.** O segundo lado não existe para ser observado. É por isso que o mercado inventou
 * protocolo para o problema (o IPMVP, usado em eficiência energética há trinta anos), e a lição
 * dele é a única coisa que separa uma prova de um número bonito:
 *
 *   **o ajuste tem de ser acordado ANTES, não escolhido depois de ver o resultado.**
 *
 * Este arquivo implementa isso. Ele não calcula economia com constante nenhuma: ele compara dois
 * períodos medidos da MESMA obra, e obriga a declarar — e travar — o que os torna comparáveis.
 *
 * ─── O QUE ELE NÃO FAZ ────────────────────────────────────────────────────────
 *
 * Não substitui o total estimado dos eventos, e não conversa com ele. São duas coisas diferentes,
 * e somá-las seria repetir o erro que o módulo passou uma auditoria inteira para corrigir.
 */
import type { LinhaDeBaseMedida } from '@/types'
import type { RetratoDaObra } from './retratoDaObra'

// ⚠️ As três formas moram em `@/types` porque `EconomyBaseline.medida` as guarda, e
// `src/types/index.ts` é um arquivo sem nenhum import — inverter a direção criaria um ciclo. Aqui
// elas seguem exportadas para quem já as importa deste módulo.
export type { MesDaLinhaDeBase, AjusteAcordado, LinhaDeBaseMedida } from '@/types'

// ─── As contas ────────────────────────────────────────────────────────────────

export interface Indicadores {
  quantidade: number
  custoBRL: number
  homensHora: number | null
  /** ⚠️ `null` quando não há quantidade: dividir por zero daria Infinity na tela. */
  custoPorUnidade: number | null
  /** `null` quando o cliente não registra homens-hora. */
  hhPorUnidade: number | null
  meses: number
}

export function indicadoresDaLinhaDeBase(base: LinhaDeBaseMedida): Indicadores {
  const quantidade = base.meses.reduce((s, m) => s + (Number(m.quantidadeExecutada) || 0), 0)
  const custoBRL = base.meses.reduce((s, m) => s + (Number(m.custoBRL) || 0), 0)
  const comHH = base.meses.filter((m) => typeof m.homensHora === 'number' && m.homensHora > 0)
  // ⚠️ Só soma HH se TODOS os meses têm. Metade dos meses daria um HH/un que parece ótimo e é só
  // metade do trabalho — o erro mais fácil de cometer aqui.
  const homensHora = comHH.length === base.meses.length && base.meses.length > 0
    ? comHH.reduce((s, m) => s + (m.homensHora ?? 0), 0)
    : null

  return {
    quantidade, custoBRL, homensHora,
    custoPorUnidade: quantidade > 0 ? custoBRL / quantidade : null,
    hhPorUnidade: quantidade > 0 && homensHora !== null ? homensHora / quantidade : null,
    meses: base.meses.length,
  }
}

/**
 * Os mesmos indicadores, do lado da plataforma.
 *
 * O custo vem do `retratoDaObra` — que é soma de lançamento, não estimativa —, e a quantidade vem
 * do que os RDOs mediram. Os dois são chão medido.
 */
export function indicadoresDaPlataforma(
  retrato: Pick<RetratoDaObra, 'saidasBRL'>,
  quantidadeExecutada: number,
  homensHora: number | null,
  meses: number,
): Indicadores {
  return {
    quantidade: quantidadeExecutada,
    custoBRL: retrato.saidasBRL,
    homensHora,
    custoPorUnidade: quantidadeExecutada > 0 ? retrato.saidasBRL / quantidadeExecutada : null,
    hhPorUnidade: quantidadeExecutada > 0 && homensHora !== null ? homensHora / quantidadeExecutada : null,
    meses,
  }
}

export type Veredicto = 'melhorou' | 'piorou' | 'igual' | 'nao-comparavel'

export interface Comparacao {
  antes: Indicadores
  depois: Indicadores
  /** O antes corrigido pela inflação acordada — é contra ELE que se compara. */
  custoPorUnidadeAntesCorrigido: number | null
  /** Diferença em R$/unidade. Negativo = ficou mais barato. */
  deltaCustoPorUnidade: number | null
  /** Em fração do antes corrigido. */
  deltaPercentual: number | null
  veredictoCusto: Veredicto
  deltaHhPorUnidade: number | null
  veredictoHh: Veredicto
  /**
   * ⚠️ O que impede a comparação de valer. Vazio = comparável dentro do que foi acordado; **nunca
   * "provado"**, porque o contrafactual continua não sendo observável.
   */
  impedimentos: string[]
}

/** Abaixo disto a diferença é ruído, não resultado. */
const RUIDO = 0.02

function veredicto(antes: number | null, depois: number | null): Veredicto {
  if (antes === null || depois === null || antes === 0) return 'nao-comparavel'
  const delta = (depois - antes) / antes
  if (Math.abs(delta) < RUIDO) return 'igual'
  return delta < 0 ? 'melhorou' : 'piorou'
}

/**
 * A comparação.
 *
 * ⚠️ **Ela devolve `impedimentos` junto com o número, e a tela mostra os dois.** Um resultado que
 * some com a ressalva vira propaganda; com a ressalva do lado, vira argumento.
 */
export function compararComALinhaDeBase(
  base: LinhaDeBaseMedida,
  depois: Indicadores,
): Comparacao {
  const antes = indicadoresDaLinhaDeBase(base)
  const impedimentos: string[] = []

  // Os cortes que invalidam, do mais grave ao menos.
  if (antes.meses === 0) impedimentos.push('A linha de base não tem nenhum mês registrado.')
  if (antes.quantidade <= 0) impedimentos.push('A linha de base não registra quantidade executada — sem ela não há R$/unidade.')
  if (depois.quantidade <= 0) impedimentos.push('O período atual ainda não tem produção medida.')
  // ⚠️ Comparar um mês contra doze é comparar sazonalidade, não desempenho.
  if (antes.meses > 0 && depois.meses > 0 && Math.max(antes.meses, depois.meses) / Math.min(antes.meses, depois.meses) > 2) {
    impedimentos.push(`Os períodos têm tamanhos muito diferentes (${antes.meses} × ${depois.meses} meses) — a comparação mistura sazonalidade com desempenho.`)
  }
  if (antes.meses > 0 && antes.meses < 3) {
    impedimentos.push('A linha de base tem menos de três meses. Um mês atípico domina o resultado.')
  }
  if (!base.ajuste.acordadoPor?.trim()) {
    impedimentos.push('O ajuste não foi acordado com ninguém. Sem isso a comparação não é defensável fora de casa.')
  }
  if (!base.ajuste.ressalvas?.trim()) {
    impedimentos.push('Nenhuma ressalva declarada. O que mudou fora da plataforma no período precisa estar escrito.')
  }
  if (antes.hhPorUnidade === null) {
    impedimentos.push('A linha de base não registra homens-hora — só dá para comparar custo, não produtividade.')
  }

  const custoAntesCorrigido = antes.custoPorUnidade !== null
    ? antes.custoPorUnidade * (1 + (Number(base.ajuste.inflacao) || 0))
    : null

  const deltaCusto = custoAntesCorrigido !== null && depois.custoPorUnidade !== null
    ? depois.custoPorUnidade - custoAntesCorrigido
    : null

  return {
    antes,
    depois,
    custoPorUnidadeAntesCorrigido: custoAntesCorrigido,
    deltaCustoPorUnidade: deltaCusto,
    deltaPercentual: custoAntesCorrigido && deltaCusto !== null && custoAntesCorrigido !== 0
      ? deltaCusto / custoAntesCorrigido
      : null,
    veredictoCusto: veredicto(custoAntesCorrigido, depois.custoPorUnidade),
    deltaHhPorUnidade: antes.hhPorUnidade !== null && depois.hhPorUnidade !== null
      ? depois.hhPorUnidade - antes.hhPorUnidade
      : null,
    veredictoHh: veredicto(antes.hhPorUnidade, depois.hhPorUnidade),
    impedimentos,
  }
}

/**
 * A frase que a tela e o papel usam.
 *
 * ⚠️ Ela **nunca** diz "comprovado" nem "economia comprovada" — há teste no módulo que proíbe
 * essas palavras por regex, e com razão. O que ela diz é o que de fato aconteceu: dois números
 * medidos, e a diferença entre eles.
 */
export function fraseDoResultado(c: Comparacao, unidade: string): string {
  if (c.impedimentos.length > 0) return 'A comparação ainda não se sustenta — veja o que falta abaixo.'
  if (c.veredictoCusto === 'nao-comparavel' || c.deltaPercentual === null) {
    return 'Não há dado suficiente para comparar o custo por unidade.'
  }
  // Vírgula decimal: `toFixed` devolve ponto, e a tela é em português.
  const pct = Math.abs(c.deltaPercentual * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const brl = Math.abs(c.deltaCustoPorUnidade ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  if (c.veredictoCusto === 'igual') {
    return `O custo por ${unidade} ficou praticamente igual ao do período anterior, corrigido pela inflação acordada.`
  }
  const direcao = c.veredictoCusto === 'melhorou' ? 'menor' : 'maior'
  return `O custo por ${unidade} está ${pct}% ${direcao} que no período anterior corrigido — ${brl} por ${unidade}.`
}
