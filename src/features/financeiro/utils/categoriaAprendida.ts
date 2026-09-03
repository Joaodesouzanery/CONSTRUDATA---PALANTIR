/**
 * A categoria sugerida pelo seu próprio histórico — sem schema novo, sem IA.
 *
 * ─── A IDEIA ──────────────────────────────────────────────────────────────────
 * Na primeira nota de um fornecedor, alguém escolhe a categoria. Da segunda em
 * diante o sistema já sabe. Não é chute nem classificação de texto: é **memória
 * da sua operação**, e ela melhora sozinha com o uso.
 *
 * O casamento é pelo **CNPJ**, que veio da chave conferida pelo dígito
 * verificador — então é exato. É por isso que isto cabe em poucas linhas em vez
 * de virar um zoológico de heurísticas de similaridade de nome.
 *
 * ⚠️ **Só contam notas cuja categoria um humano confirmou** (`categoriaConfirmadaEm`).
 * Sem essa regra a sugestão vira evidência de si mesma: alguém aceita por inércia,
 * isso conta como voto, o voto reforça a sugestão, e um erro calcifica para
 * sempre. É a regra mais importante deste arquivo.
 *
 * ⚠️ E a sugestão **nunca se aplica em silêncio**. Ela chega na tela com a frase
 * que diz em quantas notas se baseia, para a pessoa julgar a força sozinha.
 */
import type { NotaFiscal, SaidaCategoria } from '@/types'

export interface SugestaoDeClassificacao {
  categoria: SaidaCategoria
  /** A etiqueta mais frequente, quando há. Calculada à parte — ver abaixo. */
  etiqueta?: string
  /** Quantas notas confirmadas deste CNPJ entraram na conta. */
  baseadoEm: number
  /** Quantas delas concordam com a categoria sugerida. É a força da sugestão. */
  concordam: number
  /** Frase pronta para a tela. */
  motivo: string
}

export interface OpcoesDaSugestao {
  /**
   * Quantas notas recentes olhar.
   *
   * A janela existe para uma mudança de hábito fazer efeito em poucas notas, em
   * vez de ser derrotada para sempre por dois anos de histórico.
   */
  janela?: number
}

const JANELA_PADRAO = 20

/** Moda com desempate pelo mais recente — quem apareceu por último ganha o empate. */
function maisFrequente<T extends string>(valores: T[]): { valor: T; contagem: number } | null {
  if (!valores.length) return null
  const conta = new Map<T, number>()
  for (const v of valores) conta.set(v, (conta.get(v) ?? 0) + 1)
  let melhor: T = valores[0]
  let melhorContagem = 0
  // `valores` chega do mais recente para o mais antigo, e o `>` (não `>=`) faz o
  // primeiro a atingir a contagem vencer — ou seja, o mais recente.
  for (const v of valores) {
    const c = conta.get(v) ?? 0
    if (c > melhorContagem) { melhor = v; melhorContagem = c }
  }
  return { valor: melhor, contagem: melhorContagem }
}

export function sugerirClassificacao(
  cnpj: string,
  historico: NotaFiscal[],
  opcoes: OpcoesDaSugestao = {},
): SugestaoDeClassificacao | null {
  const alvo = (cnpj ?? '').replace(/\D/g, '')
  if (!alvo) return null

  const doFornecedor = historico
    .filter((n) => n.cnpjEmitente === alvo && !!n.categoriaConfirmadaEm && n.status !== 'cancelada')
    .sort((a, b) => (b.categoriaConfirmadaEm ?? '').localeCompare(a.categoriaConfirmadaEm ?? ''))
    .slice(0, opcoes.janela ?? JANELA_PADRAO)

  if (!doFornecedor.length) return null

  const categoria = maisFrequente(doFornecedor.map((n) => n.categoria))
  if (!categoria) return null

  /**
   * ⚠️ Etiqueta e categoria são calculadas **independentemente**, e isso não é
   * detalhe: um posto de combustível é `equipamentos·combustível` para o caminhão
   * e `administrativo·combustível` para o carro do gerente. A etiqueta é estável
   * mesmo quando a categoria não é. Sugerir o par mais frequente perderia a
   * etiqueta boa junto com a categoria dividida.
   */
  const etiquetas = doFornecedor.map((n) => n.etiqueta).filter((e): e is string => !!e)
  const etiqueta = maisFrequente(etiquetas)

  const total = doFornecedor.length
  const motivo = total === 1
    ? 'sugerido pela nota anterior deste fornecedor'
    : `sugerido por ${categoria.contagem} de ${total} notas anteriores deste fornecedor`

  return {
    categoria: categoria.valor,
    etiqueta: etiqueta?.valor,
    baseadoEm: total,
    concordam: categoria.contagem,
    motivo,
  }
}

/**
 * As etiquetas já usadas na empresa, das mais frequentes para as menos.
 *
 * Alimenta o `<datalist>` do campo livre — sem isso, "combustível", "Combustivel"
 * e "COMBUSTÍVEL" viram três baldes diferentes no painel.
 */
export function etiquetasUsadas(historico: NotaFiscal[]): string[] {
  const conta = new Map<string, number>()
  for (const n of historico) {
    const e = n.etiqueta?.trim()
    if (e) conta.set(e, (conta.get(e) ?? 0) + 1)
  }
  return [...conta].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([e]) => e)
}

/**
 * Normaliza a etiqueta para o painel agrupar direito.
 *
 * Minúscula e sem acento, porque é assim que ela vira chave de agrupamento. A
 * exibição faz o capitalize de volta — o dado guardado é o normalizado.
 */
export function normalizarEtiqueta(bruta: string): string {
  return (bruta ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}
