/**
 * O motor da medição: quantidade executada × preço do contrato na região = quanto vale.
 *
 * ─── A REGRA QUE ESTE ARQUIVO EXISTE PARA GARANTIR ────────────────────────────
 * ⚠️ **Item com preço a conferir NUNCA entra na soma.** Ele sai numa lista à parte, com o valor
 * que teria e o motivo escrito. É o mesmo princípio do de-para de siglas do RDO WCR — *"sigla sem
 * mapa não recebe valor: a quantidade é gravada do mesmo jeito; o que não acontece é a conversão
 * em reais"* — e existe pelo mesmo motivo: preço não confirmado virando dinheiro por descuido é o
 * erro caro, e ele não dá erro na tela.
 *
 * Por isso `total` e `totalPendente` são campos SEPARADOS, e nunca há um `total` que "inclui tudo".
 * Somá-los é decisão de quem lê, depois de resolver a pendência.
 *
 * ─── O QUE ELE NÃO FAZ ────────────────────────────────────────────────────────
 * Não escreve nada. Não fecha medição, não gera lançamento no Financeiro, não muda o catálogo.
 * É só conta — mesmo desenho da ponte `wcrParaFcp`, e pelo mesmo motivo: número que muda sozinho
 * entre uma reunião e outra é número em que ninguém confia.
 */
import type { CatalogoDoContrato, FlagDoServico, ServicoDoCatalogo } from '@/types'
import { precoDoServico } from './catalogoContrato'
import type { QuantidadeMedida } from './importarCatalogoZn'

const r2 = (n: number) => Math.round(n * 100) / 100

/** Por que uma linha não entrou na soma. */
export type MotivoDePendencia = 'preco_a_conferir' | 'servico_fora_da_regiao'

export interface LinhaDaMedicao {
  servicoCatalogoId: string
  descricao: string
  unidade: string
  categoria?: string
  codigoRegional?: string
  quantidade: number
  /** Preço do contrato antes do repasse, já resolvido para a região. */
  precoCheio: number
  fator: number
  /** `ROUND(precoCheio × fator, 2)` — o que a executora recebe por unidade. */
  precoComFator: number
  /** `quantidade × precoComFator`. Nas pendentes, é o valor que a linha TERIA. */
  valor: number
  flag: FlagDoServico
  pendencia?: MotivoDePendencia
  motivo?: string
}

export interface ResultadoDaMedicao {
  obra: string
  regiao: string
  /** As linhas que contam. */
  linhas: LinhaDaMedicao[]
  /** ⚠️ As barradas. Nunca entram em `total`. */
  pendentes: LinhaDaMedicao[]
  total: number
  /** Quanto as pendentes valeriam, se liberadas. É o tamanho da decisão que falta. */
  totalPendente: number
  /** `true` quando não há nada barrado — a condição para a medição poder fechar. */
  podeFechar: boolean
}

function linhaDe(
  servico: ServicoDoCatalogo,
  catalogo: CatalogoDoContrato,
  regiao: string,
  quantidade: number,
): LinhaDaMedicao {
  const p = precoDoServico(catalogo, servico, regiao)
  const base: LinhaDaMedicao = {
    servicoCatalogoId: servico.id,
    descricao: servico.descricao,
    unidade: servico.unidade,
    categoria: servico.categoria,
    codigoRegional: p.codigo,
    quantidade,
    precoCheio: p.precoCheio,
    fator: p.fator,
    precoComFator: p.precoComFator,
    valor: r2(quantidade * p.precoComFator),
    flag: servico.flag,
  }
  if (!p.disponivel) {
    return {
      ...base,
      pendencia: 'servico_fora_da_regiao',
      motivo: `Há quantidade medida, mas este serviço não existe na região ${regiao} do contrato. Confira a região da obra ou o item medido.`,
    }
  }
  if (servico.bloqueadoParaMedicao) {
    return { ...base, pendencia: 'preco_a_conferir', motivo: servico.motivoFlag ?? 'Preço a conferir antes de medir.' }
  }
  return base
}

/**
 * A medição de UMA obra.
 *
 * `quantidades` já vem filtrada pela obra (ou não — o filtro por `obra` acontece aqui). Quantidade
 * de serviço que não está no catálogo é ignorada: quem reporta isso é o leitor da planilha, que é
 * quem sabe a linha de origem.
 */
export function calcularMedicao(
  catalogo: CatalogoDoContrato,
  obra: string,
  regiao: string,
  quantidades: QuantidadeMedida[],
): ResultadoDaMedicao {
  const porId = new Map(catalogo.servicos.map((s) => [s.id, s]))
  // Mesma obra + mesmo serviço em duas linhas somam — a planilha pode repetir o item.
  const somadas = new Map<string, number>()
  for (const q of quantidades) {
    if (q.obra !== obra) continue
    somadas.set(q.servicoCatalogoId, (somadas.get(q.servicoCatalogoId) ?? 0) + q.quantidade)
  }

  const linhas: LinhaDaMedicao[] = []
  const pendentes: LinhaDaMedicao[] = []
  for (const [id, quantidade] of somadas) {
    const servico = porId.get(id)
    if (!servico) continue
    const l = linhaDe(servico, catalogo, regiao, quantidade)
    if (l.pendencia) pendentes.push(l); else linhas.push(l)
  }

  const ordenar = (a: LinhaDaMedicao, b: LinhaDaMedicao) => b.valor - a.valor
  linhas.sort(ordenar)
  pendentes.sort(ordenar)

  return {
    obra,
    regiao,
    linhas,
    pendentes,
    total: r2(linhas.reduce((s, l) => s + l.valor, 0)),
    totalPendente: r2(pendentes.reduce((s, l) => s + l.valor, 0)),
    podeFechar: pendentes.length === 0,
  }
}

export interface ResumoPorCategoria { categoria: string; itens: number; valor: number }

/** O total quebrado por categoria do contrato — é como a planilha se organiza. */
export function porCategoria(r: ResultadoDaMedicao): ResumoPorCategoria[] {
  const mapa = new Map<string, ResumoPorCategoria>()
  for (const l of r.linhas) {
    const chave = l.categoria ?? 'Sem categoria'
    const atual = mapa.get(chave) ?? { categoria: chave, itens: 0, valor: 0 }
    atual.itens += 1
    atual.valor = r2(atual.valor + l.valor)
    mapa.set(chave, atual)
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor)
}

/**
 * A cadeia Sabesp → Consórcio → executora, para UMA medição.
 *
 * ⚠️ O bruto é `medido ÷ fator`, e não `medido × (1 + algo)`: o fator é a fração que a executora
 * recebe do que o consórcio recebe. Com fator 0 a conta não existe — devolve `null` em vez de
 * dividir por zero e mostrar Infinity na tela.
 */
export function cadeiaDeRepasse(total: number, fator: number): { brutoConsorcio: number; repasse: number; retido: number } | null {
  if (!Number.isFinite(fator) || fator <= 0) return null
  const brutoConsorcio = r2(total / fator)
  return { brutoConsorcio, repasse: r2(total), retido: r2(brutoConsorcio - total) }
}
