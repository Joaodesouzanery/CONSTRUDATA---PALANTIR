/**
 * A linha de base medida.
 *
 * ⚠️ O que estes testes protegem não é a aritmética — é a **honestidade**. O módulo Economia já
 * passou por uma auditoria inteira por apresentar estimativa como medição, e tem um arquivo de
 * teste que proíbe a palavra "comprovado" por regex. Esta comparação é a primeira coisa do módulo
 * que pode virar prova, e por isso ela tem de recusar comparar quando não dá.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  compararComALinhaDeBase, fraseDoResultado, indicadoresDaLinhaDeBase, indicadoresDaPlataforma,
  type LinhaDeBaseMedida, type MesDaLinhaDeBase,
} from './linhaDeBaseMedida'

const mes = (periodo: string, qtd: number, custo: number, hh?: number): MesDaLinhaDeBase =>
  ({ periodo, quantidadeExecutada: qtd, custoBRL: custo, homensHora: hh })

const base = (meses: MesDaLinhaDeBase[], p: Partial<LinhaDeBaseMedida['ajuste']> = {}): LinhaDeBaseMedida => ({
  id: 'b1', obraId: 'obra-1', obraNome: 'SUPERA', meses,
  ajuste: {
    unidade: 'm²', servicos: [], inflacao: 0,
    ressalvas: 'Mesma equipe e mesmo escopo nos dois períodos.',
    acordadoPor: 'Ana Diretora', acordadoEm: '2026-08-01T00:00:00.000Z', ...p,
  },
  fonte: 'Controle da obra em planilha', criadoEm: '2026-08-01T00:00:00.000Z',
})

const TRES_MESES = [mes('2026-01', 1000, 50000, 800), mes('2026-02', 1200, 58000, 950), mes('2026-03', 900, 47000, 720)]

// ─── Os indicadores ───────────────────────────────────────────────────────────

test('R$/unidade e HH/unidade saem da soma dos meses', () => {
  const i = indicadoresDaLinhaDeBase(base(TRES_MESES))
  assert.equal(i.quantidade, 3100)
  assert.equal(i.custoBRL, 155000)
  assert.equal(i.homensHora, 2470)
  assert.ok(Math.abs(i.custoPorUnidade! - 50) < 0.01, `${i.custoPorUnidade}`)
  assert.ok(Math.abs(i.hhPorUnidade! - 0.7968) < 0.001)
})

test('⚠️ HH só soma se TODOS os meses tiverem — metade seria metade do trabalho', () => {
  // O erro mais fácil aqui: dois meses com HH e um sem produziriam um HH/m² ótimo e falso.
  const i = indicadoresDaLinhaDeBase(base([mes('2026-01', 1000, 50000, 800), mes('2026-02', 1000, 50000)]))
  assert.equal(i.homensHora, null)
  assert.equal(i.hhPorUnidade, null)
  assert.equal(i.custoPorUnidade, 50, 'mas o custo continua valendo')
})

test('quantidade zero devolve null, não Infinity', () => {
  const i = indicadoresDaLinhaDeBase(base([mes('2026-01', 0, 50000)]))
  assert.equal(i.custoPorUnidade, null)
  assert.equal(i.hhPorUnidade, null)
})

test('linha de base vazia não estoura', () => {
  const i = indicadoresDaLinhaDeBase(base([]))
  assert.equal(i.meses, 0)
  assert.equal(i.custoPorUnidade, null)
})

// ─── A comparação ─────────────────────────────────────────────────────────────

const depois = (qtd: number, custo: number, hh: number | null = null, meses = 3) =>
  indicadoresDaPlataforma({ saidasBRL: custo }, qtd, hh, meses)

test('ficou mais barato: o veredicto é "melhorou" e o percentual bate', () => {
  const c = compararComALinhaDeBase(base(TRES_MESES), depois(3000, 135000, 2300))
  assert.deepEqual(c.impedimentos, [])
  assert.equal(c.veredictoCusto, 'melhorou')
  assert.ok(Math.abs(c.deltaPercentual! + 0.10) < 0.001, `${c.deltaPercentual}`)  // 45 contra 50
  assert.match(fraseDoResultado(c, 'm²'), /10,0% menor/)
})

test('ficou mais caro: o resultado NÃO é escondido', () => {
  // Um instrumento que só sabe dizer "melhorou" não é instrumento, é propaganda.
  const c = compararComALinhaDeBase(base(TRES_MESES), depois(3000, 180000, 2300))
  assert.equal(c.veredictoCusto, 'piorou')
  assert.ok(c.deltaCustoPorUnidade! > 0)
  assert.match(fraseDoResultado(c, 'm²'), /maior/)
})

test('⚠️ a INFLAÇÃO acordada corrige o antes — senão ela vira "economia"', () => {
  // Sem a correção, 8% de inflação num custo idêntico apareceria como 8% de piora; e um custo 8%
  // maior apareceria como empate. O ajuste é acordado ANTES justamente para não ser escolhido
  // depois de ver o resultado.
  const semCorrecao = compararComALinhaDeBase(base(TRES_MESES), depois(3000, 150000))
  assert.equal(semCorrecao.veredictoCusto, 'igual', '50/m² contra 50/m²')

  const com8 = compararComALinhaDeBase(base(TRES_MESES, { inflacao: 0.08 }), depois(3000, 150000))
  assert.ok(Math.abs(com8.custoPorUnidadeAntesCorrigido! - 54) < 0.01)
  assert.equal(com8.veredictoCusto, 'melhorou', 'o mesmo custo nominal, com 8% de inflação, é ganho real')
})

test('diferença abaixo de 2% é ruído, não resultado', () => {
  const c = compararComALinhaDeBase(base(TRES_MESES), depois(3000, 150450))  // 50,15/m²
  assert.equal(c.veredictoCusto, 'igual')
  assert.match(fraseDoResultado(c, 'm²'), /praticamente igual/)
})

// ─── O que IMPEDE a comparação — o coração do arquivo ─────────────────────────

test('⚠️ período de UM mês contra três: a comparação é recusada', () => {
  const c = compararComALinhaDeBase(base([mes('2026-01', 1000, 50000, 800)]), depois(3000, 135000, 2300))
  assert.ok(c.impedimentos.some((i) => /menos de três meses/.test(i)))
  assert.match(fraseDoResultado(c, 'm²'), /não se sustenta/)
})

test('⚠️ períodos de tamanhos muito diferentes misturam sazonalidade com desempenho', () => {
  const doze = Array.from({ length: 12 }, (_, i) => mes(`2026-${String(i + 1).padStart(2, '0')}`, 1000, 50000, 800))
  const c = compararComALinhaDeBase(base(doze), depois(1000, 45000, 800, 2))
  assert.ok(c.impedimentos.some((i) => /tamanhos muito diferentes/.test(i)), JSON.stringify(c.impedimentos))
})

test('⚠️ ajuste sem alguém que o acordou não é defensável fora de casa', () => {
  const c = compararComALinhaDeBase(base(TRES_MESES, { acordadoPor: '' }), depois(3000, 135000, 2300))
  assert.ok(c.impedimentos.some((i) => /não foi acordado/.test(i)))
})

test('⚠️ sem ressalva declarada, a comparação não passa', () => {
  // "O que mudou fora da plataforma" é a pergunta que derruba a maioria das provas de economia.
  const c = compararComALinhaDeBase(base(TRES_MESES, { ressalvas: '   ' }), depois(3000, 135000, 2300))
  assert.ok(c.impedimentos.some((i) => /ressalva/.test(i)))
})

test('sem homens-hora, o custo ainda compara — mas a produtividade não', () => {
  const semHH = [mes('2026-01', 1000, 50000), mes('2026-02', 1200, 58000), mes('2026-03', 900, 47000)]
  const c = compararComALinhaDeBase(base(semHH), depois(3000, 135000))
  assert.ok(c.impedimentos.some((i) => /homens-hora/.test(i)))
  assert.equal(c.veredictoHh, 'nao-comparavel')
  assert.equal(c.veredictoCusto, 'melhorou', 'o custo continua comparável')
})

test('período atual sem produção medida é recusado', () => {
  const c = compararComALinhaDeBase(base(TRES_MESES), depois(0, 100000))
  assert.ok(c.impedimentos.some((i) => /ainda não tem produção/.test(i)))
})

test('linha de base vazia acumula os impedimentos, sem estourar', () => {
  const c = compararComALinhaDeBase(base([]), depois(3000, 135000, 2300))
  assert.ok(c.impedimentos.length >= 2)
  assert.doesNotThrow(() => fraseDoResultado(c, 'm²'))
})

// ─── A regra que o módulo inteiro segue ───────────────────────────────────────

test('⚠️ a frase NUNCA diz "comprovado" — há teste no módulo que proíbe, e com razão', () => {
  const casos = [
    compararComALinhaDeBase(base(TRES_MESES), depois(3000, 135000, 2300)),
    compararComALinhaDeBase(base(TRES_MESES), depois(3000, 180000, 2300)),
    compararComALinhaDeBase(base([]), depois(0, 0)),
  ]
  for (const c of casos) {
    const frase = fraseDoResultado(c, 'm²')
    for (const proibida of [/comprovad/i, /economia comprovada/i, /garantid/i]) {
      assert.ok(!proibida.test(frase), `a frase "${frase}" usa uma palavra que o módulo proíbe`)
    }
  }
})

test('produtividade melhora e custo piora podem coexistir — e os dois aparecem', () => {
  // Acontece de verdade: equipe mais cara produzindo mais rápido. Esconder um dos dois seria
  // escolher a narrativa.
  const c = compararComALinhaDeBase(base(TRES_MESES), depois(3000, 165000, 1800))
  assert.equal(c.veredictoCusto, 'piorou')
  assert.equal(c.veredictoHh, 'melhorou')
})
