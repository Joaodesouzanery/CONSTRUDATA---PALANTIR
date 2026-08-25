/**
 * diffEstoque.ts — o que mudou entre a planilha e o que o sistema tem.
 *
 * ─── POR QUE ISTO EXISTE ──────────────────────────────────────────────────────────────────────
 * O importador só sabia INSERIR. Subir a mesma planilha duas vezes criava o estoque inteiro de
 * novo, duplicado — e como o almoxarife atualiza a planilha e reenvia, essa é a operação normal
 * dele, não um caso raro.
 *
 * Além de não duplicar, o cliente quer saber **o que mudou, quanto mudou e quanto isso custou**.
 * É a mesma pergunta que a reconciliação de folha responde para holerites
 * (`mao-de-obra/utils/reconciliacaoFolha.ts`), e o formato aqui segue aquele molde: linha a linha,
 * valor antes e depois, e um total no fim.
 *
 * Função PURA: recebe as duas listas, devolve o diagnóstico. Nada de store, nada de rede — dá
 * para conferir a conta sem abrir a tela.
 */
import type { ItemEstoque } from '@/types'
import type { ItemImportado } from './parseExcelEstoque'

export type { ItemImportado }

/** O que aconteceu com uma linha da planilha em relação ao sistema. */
export type TipoMudanca = 'novo' | 'quantidade' | 'custo' | 'dados' | 'inalterado'

export interface LinhaDiff {
  /** Chave de casamento usada (código de referência ou descrição normalizada). */
  chave: string
  descricao: string
  /** Preenchido quando casou com um item que já existe. */
  itemId?: string
  tipo: TipoMudanca
  qtdAntes: number | null
  qtdDepois: number
  deltaQtd: number
  custoUnitario: number
  /** `deltaQtd × custoUnitário`. Negativo = saiu do estoque. */
  impactoBRL: number
  estoqueMinimo: number
  /**
   * O mínimo que o sistema já tinha — `null` quando o item é novo.
   *
   * Existe para a conferência mostrar antes → depois. Foi o mínimo sumindo em silêncio que fez a
   * coluna "Quantidade Critica / Realizar Pedido" zerar o alerta de todo item atualizado sem
   * ninguém ver.
   */
  minimoAntes: number | null
  /** A quantidade nova fica abaixo (ou no limite) do mínimo. */
  abaixoDoMinimo: boolean
  /**
   * A planilha DISSE alguma coisa sobre a quantidade deste item?
   *
   * Coluna não mapeada ou célula em branco = não disse. Nesse caso o saldo do sistema é mantido e
   * a linha não conta como mudança de quantidade — antes, uma célula vazia zerava o saldo.
   */
  qtdInformada: boolean
  fornecedor?: string
}

export interface ItemAusente {
  id: string
  descricao: string
  qtdDisponivel: number
}

export interface ResumoDiff {
  linhas: LinhaDiff[]
  novos: number
  alterados: number
  inalterados: number
  /** Soma dos impactos. Negativo = o estoque encolheu, ou seja, consumo. */
  impactoTotalBRL: number
  impactoPorFornecedor: { fornecedor: string; impactoBRL: number }[]
  abaixoDoMinimo: LinhaDiff[]
  /**
   * Itens que o sistema tem e a planilha NÃO trouxe.
   *
   * Nunca são apagados automaticamente: a planilha pode ser parcial (um depósito só, uma
   * categoria), e apagar por ausência destruiria estoque real por causa de um recorte. São
   * listados para a pessoa decidir.
   */
  ausentesNaPlanilha: ItemAusente[]
  /**
   * Itens que o SISTEMA tem repetidos — duas linhas para o mesmo produto.
   *
   * É herança do importador antigo, que só inseria: quem subiu a planilha duas vezes ficou com o
   * estoque inteiro em dobro. A planilha casa com a primeira linha, e as demais ficariam invisíveis
   * no relatório se não fossem listadas aqui. Não são apagadas sozinhas — o saldo de cada uma pode
   * ser real (dois depósitos, por exemplo).
   */
  duplicadosNoSistema: ItemAusente[]
  /**
   * Linhas da PLANILHA que repetem um produto já lido acima.
   *
   * Sem isto elas viravam duas alterações do mesmo item: o impacto em R$ contava em dobro e a
   * gravação escrevia duas vezes, ficando com a última. Vale a primeira e as demais são listadas —
   * somar os saldos seria um palpite (a coluna é saldo, não movimento).
   */
  duplicadosNaPlanilha: { descricao: string; qtdDisponivel: number }[]
}

/**
 * Marca que identifica uma movimentação nascida da conferência de planilha.
 *
 * Fica na observação porque `suprimentos_depositos` não tem coluna `payload` — guardar a data da
 * última conferência exigiria migração, e a própria movimentação já é o registro. Achar a última
 * conferência é procurar a movimentação mais recente com esta marca.
 */
export const MARCA_CONFERENCIA = 'Conferência de planilha'

export interface MovimentacaoParaConferencia {
  itemId: string
  tipo: string
  quantidade: number
  dataMovimento: string
  observacoes?: string
  retiradoPor?: string
}

/** A data da última conferência de planilha, ou `null` se nunca houve uma. */
export function ultimaConferencia(movs: MovimentacaoParaConferencia[]): string | null {
  let ultima: string | null = null
  for (const m of movs) {
    if (!m.observacoes?.startsWith(MARCA_CONFERENCIA)) continue
    if (!ultima || m.dataMovimento > ultima) ultima = m.dataMovimento
  }
  return ultima
}

/**
 * Quanto saiu COM ficha de retirada, por item, desde a última conferência.
 *
 * É o outro lado da conta que dá sentido a rodar as duas coisas: a planilha diz quanto saiu no
 * total; a ficha diz quanto saiu com nome. A diferença entre as duas é o material que saiu sem
 * registro — o número mais útil do módulo, e o único jeito de saber se a ficha está sendo usada.
 *
 * Só conta saída COM `retiradoPor`: uma saída lançada pelo RDO ou por ajuste não é ficha.
 */
export function retiradasComFicha(
  movs: MovimentacaoParaConferencia[],
  desde: string | null,
): Map<string, number> {
  const porItem = new Map<string, number>()
  for (const m of movs) {
    if (m.tipo !== 'saida') continue
    if (!m.retiradoPor?.trim()) continue
    if (desde && m.dataMovimento <= desde) continue
    porItem.set(m.itemId, (porItem.get(m.itemId) ?? 0) + (Number(m.quantidade) || 0))
  }
  return porItem
}

/** Sem acento, sem caixa, sem espaço dobrado — para "Base Cinza  7047" casar com "base cinza 7047". */
export function normalizarChave(s: string): string {
  return (s ?? '')
    .toLowerCase()
    // Escapado de propósito: o intervalo literal de acentos combinantes fica invisível no editor.
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A chave de casamento de um item.
 *
 * O código de referência vence quando existe — é o identificador que o fornecedor usa e sobrevive
 * a mudança de nome do produto. Sem ele, a descrição normalizada é o que resta.
 */
export function chaveDoItem(item: { codigoReferencia?: string; descricao?: string }): string {
  const codigo = normalizarChave(item.codigoReferencia ?? '')
  if (codigo) return `cod:${codigo}`
  return `desc:${normalizarChave(item.descricao ?? '')}`
}

const r2 = (n: number) => Math.round(n * 100) / 100 + 0

const resumirItem = (item: ItemEstoque): ItemAusente => ({
  id: item.id,
  descricao: item.descricao,
  qtdDisponivel: Number(item.qtdDisponivel) || 0,
})

export function compararComEstoque(
  importados: ItemImportado[],
  existentes: ItemEstoque[],
): ResumoDiff {
  // Índice do que já existe. Quando o estoque tem duas linhas para o mesmo produto — herança do
  // importador antigo, que só inseria —, a planilha casa com a PRIMEIRA e as demais vão para
  // `duplicadosNoSistema`. Sem isso elas não apareceriam em canto nenhum do relatório.
  const porChave = new Map<string, ItemEstoque>()
  // Índice reserva pela DESCRIÇÃO, para o caso em que as duas planilhas não trazem o mesmo
  // identificador. Sem ele: o sistema tem o item COM código (chave `cod:thn05l`), a planilha nova
  // vem SEM a coluna de código (chave `desc:thinner 18l`), as chaves não batem e o item vira
  // "material novo" — duplicando o estoque inteiro. Era o pior desdobramento do problema de
  // codificação, em que a coluna de código deixava de ser reconhecida.
  const porDescricao = new Map<string, ItemEstoque>()
  const duplicadosNoSistema: ItemAusente[] = []
  for (const item of existentes) {
    const k = chaveDoItem(item)
    if (porChave.has(k)) duplicadosNoSistema.push(resumirItem(item))
    else porChave.set(k, item)
    const kd = `desc:${normalizarChave(item.descricao ?? '')}`
    if (kd !== 'desc:' && !porDescricao.has(kd)) porDescricao.set(kd, item)
  }

  const linhas: LinhaDiff[] = []
  const casados = new Set<string>()
  const duplicadosNaPlanilha: { descricao: string; qtdDisponivel: number }[] = []

  for (const imp of importados) {
    const chave = chaveDoItem(imp)
    // Linha sem descrição nem código não tem como casar nem como virar item — é ruído de planilha
    // (linha em branco, subtotal, cabeçalho repetido).
    if (chave === 'desc:') continue

    if (casados.has(chave)) {
      duplicadosNaPlanilha.push({ descricao: imp.descricao || chave, qtdDisponivel: Number(imp.qtdDisponivel) || 0 })
      continue
    }

    // Casa pela chave; se não achar, tenta pela descrição (ver o índice reserva acima).
    const atual = porChave.get(chave)
      ?? porDescricao.get(`desc:${normalizarChave(imp.descricao ?? '')}`)
    casados.add(chave)
    // Marca também a chave real do item encontrado, para a mesma linha não casar duas vezes por
    // caminhos diferentes numa planilha com o produto repetido.
    if (atual) casados.add(chaveDoItem(atual))

    const qtdAntes = atual ? Number(atual.qtdDisponivel) || 0 : null
    // Quantidade não informada = fica como está. Só vira zero quando o item é novo, porque aí não
    // existe saldo anterior para preservar.
    const qtdInformada = imp.qtdDisponivel != null
    const qtdDepois = qtdInformada ? Number(imp.qtdDisponivel) || 0 : (qtdAntes ?? 0)
    const deltaQtd = r2(qtdDepois - (qtdAntes ?? 0))
    // O custo da planilha vence; sem ele, mantém o que o sistema já sabia.
    const custoUnitario = Number(imp.custoUnitario ?? atual?.custoUnitario ?? 0) || 0
    const estoqueMinimo = Number(imp.estoqueMinimo ?? atual?.estoqueMinimo ?? 0) || 0

    let tipo: TipoMudanca
    if (!atual) tipo = 'novo'
    else if (deltaQtd !== 0) tipo = 'quantidade'
    else if (custoUnitario !== (Number(atual.custoUnitario) || 0)) tipo = 'custo'
    // Só conta como mudança de cadastro o que a planilha DE FATO disse. É a mesma regra do
    // `qtdInformada` logo acima, estendida aos outros campos — sem ela, uma coluna não mapeada ou
    // 100% em branco marcava TODOS os itens como "cadastro alterado". Acontece de verdade: na
    // planilha do cliente a coluna "Fornecedor Principal" está inteiramente vazia, e todo item que
    // já tivesse fornecedor cadastrado apareceria como alterado, sem nada ter mudado.
    else if (
      (imp.unidade !== undefined && (imp.unidade ?? '') !== (atual.unidade ?? ''))
      || (imp.estoqueMinimo !== undefined && estoqueMinimo !== (Number(atual.estoqueMinimo) || 0))
      || (imp.fornecedorPrincipal !== undefined
          && (imp.fornecedorPrincipal ?? '') !== (atual.fornecedorPrincipal ?? ''))
    ) tipo = 'dados'
    else tipo = 'inalterado'

    linhas.push({
      chave,
      descricao: imp.descricao || atual?.descricao || '(sem descrição)',
      itemId: atual?.id,
      tipo,
      qtdAntes,
      qtdDepois,
      deltaQtd,
      custoUnitario,
      // Item novo não é "impacto de caixa": é o estoque sendo cadastrado, não comprado agora.
      // Contar a carga inicial como compra inflaria o número em milhares na primeira importação.
      impactoBRL: atual ? r2(deltaQtd * custoUnitario) : 0,
      estoqueMinimo,
      minimoAntes: atual ? Number(atual.estoqueMinimo) || 0 : null,
      abaixoDoMinimo: estoqueMinimo > 0 && qtdDepois <= estoqueMinimo,
      qtdInformada,
      fornecedor: imp.fornecedorPrincipal || atual?.fornecedorPrincipal || undefined,
    })
  }

  const ausentesNaPlanilha: ItemAusente[] = [...porChave.values()]
    .filter((item) => !casados.has(chaveDoItem(item)))
    .map(resumirItem)

  const comImpacto = linhas.filter((l) => l.impactoBRL !== 0)
  const porFornecedor = new Map<string, number>()
  for (const l of comImpacto) {
    const f = l.fornecedor || 'Sem fornecedor'
    porFornecedor.set(f, r2((porFornecedor.get(f) ?? 0) + l.impactoBRL))
  }

  return {
    linhas,
    novos: linhas.filter((l) => l.tipo === 'novo').length,
    alterados: linhas.filter((l) => l.tipo !== 'novo' && l.tipo !== 'inalterado').length,
    inalterados: linhas.filter((l) => l.tipo === 'inalterado').length,
    impactoTotalBRL: r2(comImpacto.reduce((s, l) => s + l.impactoBRL, 0)),
    impactoPorFornecedor: [...porFornecedor.entries()]
      .map(([fornecedor, impactoBRL]) => ({ fornecedor, impactoBRL }))
      .sort((a, b) => a.impactoBRL - b.impactoBRL),
    abaixoDoMinimo: linhas.filter((l) => l.abaixoDoMinimo),
    ausentesNaPlanilha,
    duplicadosNoSistema,
    duplicadosNaPlanilha,
  }
}
