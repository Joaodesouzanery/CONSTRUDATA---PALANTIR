/**
 * Estoque parado é dinheiro parado.
 *
 * ─── O QUE ESTA CONTA RESPONDE ────────────────────────────────────────────────
 * "Quanto dinheiro está deitado no almoxarifado, e há quanto tempo?" Material comprado que não sai
 * é ou compra a mais, ou obra que não andou como planejado — e nos dois casos é capital que já
 * saiu do caixa e ainda não virou serviço.
 *
 * O dado sempre esteve lá: `suprimentos_estoque_movimentacoes` tem `tipo`, `dataMovimento` e o
 * `custoUnitario` congelado no momento do movimento. **Ninguém calculava.** Nenhum lugar do
 * repositório mede giro, dias parado, cobertura ou capital parado.
 *
 * ─── ⚠️ A DISTINÇÃO QUE O RESTO DO SISTEMA MANTÉM E ESTA CONTA TAMBÉM ─────────
 * Item **sem nenhuma saída registrada** é `'nunca-saiu'`, não "parado há 0 dias". São situações
 * opostas: um chegou hoje, o outro está encalhado desde sempre e é o pior caso da lista. Por isso
 * `diasParado` é `number | null`, e `null` quer dizer "não sei desde quando", não zero.
 *
 * E o valor usa o `custoUnitario` do ITEM (o preço de reposição de hoje), não o da última saída:
 * a pergunta aqui é "quanto vale o que está na prateleira", não "quanto custou o que já saiu".
 */
import type { ItemEstoque, MovimentacaoEstoque } from '@/types'

export type SituacaoDoItem = 'girando' | 'parado' | 'nunca-saiu'

export interface ItemParado {
  item: ItemEstoque
  /** Dias desde a última SAÍDA. `null` = nunca saiu — e isso é pior, não neutro. */
  diasParado: number | null
  /** `yyyy-MM-dd` da última saída, quando houve. */
  ultimaSaida: string | null
  /** Data da primeira entrada — desde quando ele está na casa. */
  primeiraEntrada: string | null
  /** `qtdDisponivel × custoUnitario`. Zero quando o item não tem custo cadastrado. */
  valorParado: number
  /** `true` quando o item não tem `custoUnitario` — o valor é desconhecido, não zero. */
  semCusto: boolean
  situacao: SituacaoDoItem
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** Dias entre duas datas `yyyy-MM-dd`, sem fuso: as duas viram meia-noite local. */
export function diasEntre(de: string, ate: string): number {
  const a = new Date(`${de}T00:00:00`)
  const b = new Date(`${ate}T00:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

export interface OpcoesDoEstoqueParado {
  /** A partir de quantos dias sem saída um item conta como parado. Padrão 30. */
  diasParaParar?: number
  /** `yyyy-MM-dd`. Injetável para o teste não depender do relógio. */
  hoje: string
  /** Só esta obra. Ausente = todas. */
  siteId?: string
}

/**
 * A situação de cada item do estoque.
 *
 * ⚠️ Item com `qtdDisponivel <= 0` fica de fora: não há dinheiro parado no que não está lá. Isso
 * também evita que item zerado e sem movimento apareça eternamente como "nunca saiu".
 */
export function situacaoDoEstoque(
  itens: ItemEstoque[],
  movimentacoes: MovimentacaoEstoque[],
  opcoes: OpcoesDoEstoqueParado,
): ItemParado[] {
  const limite = opcoes.diasParaParar ?? 30
  const ultimaSaidaPorItem = new Map<string, string>()
  const primeiraEntradaPorItem = new Map<string, string>()

  for (const m of movimentacoes) {
    if (!m.dataMovimento) continue
    if (m.tipo === 'saida') {
      const atual = ultimaSaidaPorItem.get(m.itemId)
      if (!atual || m.dataMovimento > atual) ultimaSaidaPorItem.set(m.itemId, m.dataMovimento)
    } else if (m.tipo === 'entrada') {
      const atual = primeiraEntradaPorItem.get(m.itemId)
      if (!atual || m.dataMovimento < atual) primeiraEntradaPorItem.set(m.itemId, m.dataMovimento)
    }
  }

  return itens
    .filter((i) => (opcoes.siteId ? i.siteId === opcoes.siteId : true))
    .filter((i) => i.qtdDisponivel > 0)
    .map((item) => {
      const ultimaSaida = ultimaSaidaPorItem.get(item.id) ?? null
      const diasParado = ultimaSaida ? Math.max(0, diasEntre(ultimaSaida, opcoes.hoje)) : null
      const semCusto = item.custoUnitario == null || item.custoUnitario <= 0
      const situacao: SituacaoDoItem = ultimaSaida === null
        ? 'nunca-saiu'
        : (diasParado! >= limite ? 'parado' : 'girando')
      return {
        item,
        diasParado,
        ultimaSaida,
        primeiraEntrada: primeiraEntradaPorItem.get(item.id) ?? null,
        valorParado: semCusto ? 0 : r2(item.qtdDisponivel * item.custoUnitario!),
        semCusto,
        situacao,
      }
    })
}

export interface ResumoDoEstoqueParado {
  /** Só o que está parado ou nunca saiu, do mais caro para o mais barato. */
  fila: ItemParado[]
  valorParado: number
  /** Itens da fila sem `custoUnitario` — o valor deles NÃO entra no total. */
  semCusto: number
  parados: number
  nuncaSairam: number
  /** Tudo que foi olhado, para a tela poder dizer "N de M". */
  total: number
}

/**
 * A fila de exceção do estoque, no molde da fila da Medição: ordenada pelo tamanho da decisão.
 *
 * ⚠️ "Nunca saiu" vem primeiro dentro do mesmo valor: é o caso mais grave, porque o item pode
 * estar encalhado desde a compra. E item sem custo cadastrado entra na fila mesmo assim — ele é um
 * problema conhecido de tamanho DESCONHECIDO, e escondê-lo por não ter preço seria trocar um
 * buraco por outro.
 */
export function estoqueParado(
  itens: ItemEstoque[],
  movimentacoes: MovimentacaoEstoque[],
  opcoes: OpcoesDoEstoqueParado,
): ResumoDoEstoqueParado {
  const todos = situacaoDoEstoque(itens, movimentacoes, opcoes)
  const fila = todos
    .filter((x) => x.situacao !== 'girando')
    .sort((a, b) => {
      if (b.valorParado !== a.valorParado) return b.valorParado - a.valorParado
      if (a.situacao !== b.situacao) return a.situacao === 'nunca-saiu' ? -1 : 1
      return (b.diasParado ?? Infinity) - (a.diasParado ?? Infinity)
    })
  return {
    fila,
    valorParado: r2(fila.reduce((s, x) => s + x.valorParado, 0)),
    semCusto: fila.filter((x) => x.semCusto).length,
    parados: fila.filter((x) => x.situacao === 'parado').length,
    nuncaSairam: fila.filter((x) => x.situacao === 'nunca-saiu').length,
    total: todos.length,
  }
}
