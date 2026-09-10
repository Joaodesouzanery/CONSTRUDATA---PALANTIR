/**
 * Margem por serviço no dia.
 *
 * Os testes 🔴 travam as três decisões que dão sentido ao número: o rateio fecha ao centavo, o
 * indireto ausente é `null` e nunca zero, e serviço sem preço não recebe custo emprestado.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { margemPorServico, distribuirPorPeso, type ServicoProduzido } from './margemPorServico'

const sv = (id: string, valorHoje: number, qtdHoje = 1, unidade = 'm²'): ServicoProduzido =>
  ({ id, descricao: id, unidade, qtdHoje, valorHoje })

test('🔴 o rateio fecha EXATAMENTE no total, mesmo com centavo quebrado', () => {
  // 100 ÷ 3 dá dízima. Sem o maior resto, sobra ou falta centavo e a margem do dia não bate.
  const r = distribuirPorPeso(100, [{ id: 'a', peso: 1 }, { id: 'b', peso: 1 }, { id: 'c', peso: 1 }])
  const soma = Object.values(r).reduce((s, v) => s + v, 0)
  assert.equal(Math.round(soma * 100), 10_000)
  assert.deepEqual(Object.values(r).sort(), [33.33, 33.33, 33.34])
})

test('peso zero ou negativo não recebe nada, e não quebra a soma', () => {
  const r = distribuirPorPeso(50, [{ id: 'a', peso: 3 }, { id: 'b', peso: 0 }, { id: 'c', peso: -5 }])
  assert.equal(r.a, 50)
  assert.equal(r.b, 0)
  assert.equal(r.c, 0)
})

test('sem peso nenhum, ninguém recebe — não distribui igualmente por desespero', () => {
  assert.deepEqual(distribuirPorPeso(90, [{ id: 'a', peso: 0 }]), { a: 0 })
})

test('🔴 O RATEIO É POR VALOR, não por quantidade bruta', () => {
  // 3 vagas PCD (R$ 900) e 200 m² de pintura (R$ 300). Por QUANTIDADE, a pintura levaria 200/203
  // = 98,5% do custo por ter "o número maior". Por VALOR, ela leva 25% — que é o que produziu.
  const r = margemPorServico(
    [sv('vagas', 900, 3, 'un'), sv('pintura', 300, 200, 'm²')],
    { materiais: 100, maoDeObra: 300 },
  )
  const vagas = r.linhas.find((l) => l.id === 'vagas')!
  const pintura = r.linhas.find((l) => l.id === 'pintura')!
  assert.equal(vagas.custo, 300, '75% de R$ 400')
  assert.equal(pintura.custo, 100, '25% de R$ 400')
  assert.equal(r.custoRateado, 400)
})

test('a margem é receita − custo, e o percentual sai sobre a receita', () => {
  const r = margemPorServico([sv('a', 1000)], { materiais: 200, maoDeObra: 400 })
  assert.equal(r.linhas[0].receita, 1000)
  assert.equal(r.linhas[0].custo, 600)
  assert.equal(r.linhas[0].margem, 400)
  assert.equal(r.linhas[0].margemPct, 40)
  assert.equal(r.margemTotal, 400)
})

test('🔴 serviço SEM PREÇO fica fora do rateio — não recebe custo emprestado', () => {
  // Distribuir custo por ele exigiria uma base que não existe; inventar uma faria a margem dos
  // outros encolher por causa de um serviço que ninguém sabe quanto vale.
  const r = margemPorServico([sv('com', 1000), sv('sem', 0, 5, 'un')], { materiais: 0, maoDeObra: 400 })
  const sem = r.linhas.find((l) => l.id === 'sem')!
  assert.equal(sem.foraDoRateio, true)
  assert.equal(sem.custo, 0)
  assert.equal(sem.margemPct, null, 'sem receita não é 0% — é indefinido')
  assert.equal(r.linhas.find((l) => l.id === 'com')!.custo, 400, 'o custo inteiro foi para quem tem preço')
  assert.equal(r.semPreco, 1)
})

test('🔴 horas indiretas sem o TOTAL de horas: o indireto é null, nunca zero', () => {
  // Zero diria "o dia inteiro produziu". Null diz "não sei que fração do dia foi indireta".
  const r = margemPorServico([sv('a', 1000)], {
    materiais: 0, maoDeObra: 800, horasIndiretas: 2,   // e sem horasTrabalhadas
  })
  assert.equal(r.custoIndireto, null)
  assert.equal(r.indiretoIndeterminado, true)
  assert.equal(r.custoRateado, 800, 'na dúvida, tudo é rateado — e a tela avisa')
})

test('com as duas horas informadas, o indireto sai do rateio', () => {
  // 2h de 8h = 25% da mão de obra não produziu nada mensurável.
  const r = margemPorServico([sv('a', 1000)], {
    materiais: 100, maoDeObra: 800, horasIndiretas: 2, horasTrabalhadas: 8,
  })
  assert.equal(r.custoIndireto, 200, '25% de 800')
  assert.equal(r.custoRateado, 700, '900 − 200')
  assert.equal(r.custoTotal, 900, 'o total do dia não muda — só passa a ser explicado')
  assert.equal(r.indiretoIndeterminado, false)
})

test('⚠️ só a MÃO DE OBRA é fracionada — material foi consumido produzindo, não deslocando', () => {
  const r = margemPorServico([sv('a', 1000)], {
    materiais: 500, maoDeObra: 400, horasIndiretas: 4, horasTrabalhadas: 8,
  })
  assert.equal(r.custoIndireto, 200, 'metade da mão de obra, e nada do material')
})

test('hora indireta maior que o dia é limitada — não vira custo indireto negativo', () => {
  const r = margemPorServico([sv('a', 1000)], {
    materiais: 0, maoDeObra: 400, horasIndiretas: 99, horasTrabalhadas: 8,
  })
  assert.equal(r.custoIndireto, 400)
  assert.equal(r.custoRateado, 0)
})

test('sem horas indiretas informadas, o indireto é ZERO — e isso é uma afirmação', () => {
  const r = margemPorServico([sv('a', 1000)], { materiais: 0, maoDeObra: 400 })
  assert.equal(r.custoIndireto, 0)
  assert.equal(r.indiretoIndeterminado, false)
})

test('o dia sem serviço nenhum não estoura', () => {
  const r = margemPorServico([], { materiais: 100, maoDeObra: 200 })
  assert.deepEqual(r.linhas, [])
  assert.equal(r.receitaTotal, 0)
  assert.equal(r.custoTotal, 300)
  assert.equal(r.margemTotal, -300, 'custo sem produção é prejuízo do dia, e aparece')
})

test('as linhas saem da maior receita para a menor', () => {
  const r = margemPorServico([sv('c', 10), sv('a', 900), sv('b', 100)], { materiais: 0, maoDeObra: 0 })
  assert.deepEqual(r.linhas.map((l) => l.id), ['a', 'b', 'c'])
})
