/**
 * Margem por SERVIÇO no dia — quanto cada serviço rendeu, não quanto a obra rendeu.
 *
 * ─── POR QUE A BASE DO RATEIO É VALOR, E NÃO QUANTIDADE ───────────────────────
 * A intenção é ratear o custo pela mesma base que gera a receita. Só que "quantidade produzida"
 * não tem soma: 200 m² + 150 m + 3 un é um número sem significado — é o que `somarMetragem` e
 * `temUnidadesMistas` existem para impedir. Como receita é quantidade × preço, a base comensurável
 * entre serviços de unidades diferentes é o **valor produzido**.
 *
 * Na prática dá o efeito pretendido: quem produziu mais recebe mais custo. E evita o absurdo do
 * rateio por quantidade bruta — um dia com 3 vagas PCD e 200 m² de pintura daria 97% do custo à
 * pintura por ela ter "o número maior", não por ter consumido mais.
 *
 * ─── ⚠️ O QUE ESTE ARQUIVO NÃO FAZ ───────────────────────────────────────────
 * **Não lança nada.** A margem é derivada em tela. Lançar uma saída por serviço exigiria uma
 * família de ids por `contractServiceId`, e `removeRdoEntries` hoje apaga exatamente DOIS ids
 * conhecidos — despromover um RDO para rascunho deixaria lançamentos órfãos no Financeiro. A ponte
 * `syncRdoToFinanceiro` não é tocada.
 *
 * **Não inclui custo de equipamento**, porque ele não existe: não há cadastro de tarifa de locação
 * no produto. A tela diz isso junto da margem — sem o aviso, "margem de 40%" se lê como número
 * completo quando falta o custo da máquina.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Distribui um total entre pesos, com alocação de MAIOR RESTO em centavos.
 *
 * Mesmo método de `rateioValores` (`src/store/rateioConsumoStore.ts:38-51`), que é o padrão
 * canônico do repositório: cada parte recebe o piso em centavos e os centavos restantes vão aos
 * maiores fracionários, de modo que a soma feche EXATAMENTE no total. Sem isso sobra ou falta
 * centavo, e a margem do dia não bate com o custo do dia.
 */
export function distribuirPorPeso(total: number, pesos: Array<{ id: string; peso: number }>): Record<string, number> {
  const somaDosPesos = pesos.reduce((s, p) => s + (p.peso > 0 ? p.peso : 0), 0)
  if (somaDosPesos <= 0) return Object.fromEntries(pesos.map((p) => [p.id, 0]))
  const totalCents = Math.round(total * 100)
  const partes = pesos.map((p) => {
    const exato = (totalCents * (p.peso > 0 ? p.peso : 0)) / somaDosPesos
    const cents = Math.floor(exato)
    return { id: p.id, cents, frac: exato - cents }
  })
  let resto = totalCents - partes.reduce((s, p) => s + p.cents, 0)
  for (const p of [...partes].sort((a, b) => b.frac - a.frac)) { if (resto <= 0) break; p.cents += 1; resto-- }
  return Object.fromEntries(partes.map((p) => [p.id, p.cents / 100]))
}

/** O que o RDO sabe de custo no dia. Equipamento não entra — ver o docblock do arquivo. */
export interface CustoDoDia {
  materiais: number
  maoDeObra: number
  /** Horas do dia que não produziram nada mensurável (deslocamento, montagem de canteiro). */
  horasIndiretas?: number
  /** Total de horas do dia. Sem ele não dá para saber que FRAÇÃO do dia foi indireta. */
  horasTrabalhadas?: number
}

/** Um serviço com produção lançada hoje. `valorHoje` é a receita — já calculada pela tela. */
export interface ServicoProduzido {
  id: string
  descricao: string
  unidade: string
  qtdHoje: number
  valorHoje: number
}

export interface LinhaDaMargem {
  id: string
  descricao: string
  unidade: string
  qtdHoje: number
  receita: number
  custo: number
  margem: number
  /** `null` quando a receita é zero — dividir por zero daria Infinity, e "sem preço" não é 0%. */
  margemPct: number | null
  /** `true` quando o serviço não tem preço no contrato: sem receita não há base de rateio. */
  foraDoRateio: boolean
}

export interface MargemDoDia {
  linhas: LinhaDaMargem[]
  receitaTotal: number
  /** O custo que foi distribuído entre os serviços. */
  custoRateado: number
  /**
   * O custo que não é de serviço nenhum. `null` = não deu para calcular.
   *
   * ⚠️ `null` e `0` são coisas diferentes: `0` diz "o dia inteiro produziu"; `null` diz "não sei",
   * e é o que acontece quando alguém informou horas indiretas mas não informou o total de horas.
   */
  custoIndireto: number | null
  /** `true` quando há horas indiretas informadas e falta `horasTrabalhadas` para achar a fração. */
  indiretoIndeterminado: boolean
  custoTotal: number
  margemTotal: number
  /** Quantos serviços ficaram fora do rateio por não terem preço. */
  semPreco: number
}

/**
 * A margem do dia, serviço a serviço.
 *
 * ⚠️ Serviço sem preço no contrato fica **fora do rateio**, marcado — não recebe custo nenhum.
 * Distribuir custo por ele exigiria uma base que não existe, e inventar uma faria a margem dos
 * outros encolher por causa de um serviço que ninguém sabe quanto vale.
 */
export function margemPorServico(servicos: ServicoProduzido[], custo: CustoDoDia): MargemDoDia {
  const custoTotal = r2((custo.materiais || 0) + (custo.maoDeObra || 0))

  // ── O balde do indireto ────────────────────────────────────────────────────
  // Só a MÃO DE OBRA é fracionada por hora: material foi consumido produzindo, não deslocando.
  const temHorasIndiretas = (custo.horasIndiretas ?? 0) > 0
  const totalDeHoras = custo.horasTrabalhadas ?? 0
  const indiretoIndeterminado = temHorasIndiretas && totalDeHoras <= 0
  const fracao = temHorasIndiretas && totalDeHoras > 0
    ? Math.min(1, (custo.horasIndiretas ?? 0) / totalDeHoras)
    : 0
  const custoIndireto = indiretoIndeterminado ? null : r2((custo.maoDeObra || 0) * fracao)
  const custoRateavel = r2(custoTotal - (custoIndireto ?? 0))

  const comPreco = servicos.filter((s) => s.valorHoje > 0)
  const rateado = distribuirPorPeso(custoRateavel, comPreco.map((s) => ({ id: s.id, peso: s.valorHoje })))

  const linhas: LinhaDaMargem[] = servicos.map((s) => {
    const foraDoRateio = s.valorHoje <= 0
    const c = foraDoRateio ? 0 : (rateado[s.id] ?? 0)
    const margem = r2(s.valorHoje - c)
    return {
      id: s.id, descricao: s.descricao, unidade: s.unidade, qtdHoje: s.qtdHoje,
      receita: r2(s.valorHoje),
      custo: c,
      margem,
      margemPct: s.valorHoje > 0 ? (margem / s.valorHoje) * 100 : null,
      foraDoRateio,
    }
  }).sort((a, b) => b.receita - a.receita)

  const receitaTotal = r2(linhas.reduce((sum, l) => sum + l.receita, 0))
  return {
    linhas,
    receitaTotal,
    custoRateado: r2(linhas.reduce((sum, l) => sum + l.custo, 0)),
    custoIndireto,
    indiretoIndeterminado,
    custoTotal,
    margemTotal: r2(receitaTotal - custoTotal),
    semPreco: linhas.filter((l) => l.foraDoRateio).length,
  }
}
