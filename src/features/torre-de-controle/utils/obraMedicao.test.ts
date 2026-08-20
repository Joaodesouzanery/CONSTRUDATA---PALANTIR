/**
 * O contrato por serviço — com os números do contrato real de pintura epóxi.
 *
 * Cláusula 3 (escopo) e cláusula 6 (valores):
 *   a) Pintura epóxi em piso                     12.794,06 m²  ×  R$ 28,94/m²
 *   b) Pintura epóxi em paredes                   5.337,40 m²  ×  R$ 27,65/m²
 *   c) Pintura epóxi demarcações e sinalizações   6.962,01 m   ×  R$  8,75/m     ← metro LINEAR
 *   d) Pintura de meio-fio com poliuretano          473,55 m²  ×  R$ 28,70/m²
 *   e) Faturamento direto                                         R$ 607.620,00  ← sem metragem
 *   Total declarado no contrato:                                  R$ 1.199.944,15
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcServico, totaisContrato, conferirTotal, ehVerba, precoEfetivo, UNIDADE_VERBA } from './obraMedicao'
import type { ObraContratoServico } from '@/types'

const svc = (p: Partial<ObraContratoServico>): ObraContratoServico => ({
  id: 'x', descricao: '', unidade: 'm²', qtdContrato: 0, valorUnitario: 0, ...p,
})

const CONTRATO: ObraContratoServico[] = [
  svc({ id: 'a', descricao: 'Pintura epóxi em piso',      unidade: 'm²', qtdContrato: 12794.06, valorUnitario: 28.94 }),
  svc({ id: 'b', descricao: 'Pintura epóxi em paredes',   unidade: 'm²', qtdContrato: 5337.40,  valorUnitario: 27.65 }),
  svc({ id: 'c', descricao: 'Demarcações e sinalizações', unidade: 'm',  qtdContrato: 6962.01,  valorUnitario: 8.75  }),
  svc({ id: 'd', descricao: 'Meio-fio com poliuretano',   unidade: 'm²', qtdContrato: 473.55,   valorUnitario: 28.70 }),
]

const VERBA = svc({ id: 'e', descricao: 'Faturamento direto', unidade: UNIDADE_VERBA, qtdContrato: 1, valorUnitario: 607620 })

const semMedicao = new Map<string, number>()
const cent = (v: number) => Math.round(v * 100) / 100

test('cada serviço vale quantidade × preço, seja qual for a unidade', () => {
  const [piso, paredes, demarcacao, meioFio] = CONTRATO.map((s) => calcServico(s, semMedicao))
  assert.equal(cent(piso.valorContrato),       370260.10)
  assert.equal(cent(paredes.valorContrato),    147579.11)
  assert.equal(cent(demarcacao.valorContrato),  60917.59, 'metro linear entra na conta igual')
  // 473,55 × 28,70 = 13.590,885 — cai EXATAMENTE em meio centavo. Arredondando para cima, como é
  // o costume em real, dá 13.590,89.
  assert.equal(cent(meioFio.valorContrato),     13590.89)
})

test('o total dos quatro serviços medidos por metragem', () => {
  const tot = totaisContrato(CONTRATO, semMedicao)
  assert.equal(cent(tot.valorContrato), 592347.68)
})

test('o total soma os valores cheios, não as linhas já arredondadas', () => {
  // Detalhe que um contador nota e vale estar fixado: somando as quatro linhas COMO EXIBIDAS dá
  // R$ 592.347,69; somando os valores cheios e arredondando uma vez no fim dá R$ 592.347,68. Um
  // centavo de diferença, e o segundo é o certo — arredondar a cada linha acumula o erro.
  const linhas = CONTRATO.map((s) => cent(calcServico(s, semMedicao).valorContrato))
  assert.equal(cent(linhas.reduce((a, b) => a + b, 0)), 592347.69, 'somando o que a tela mostra')
  assert.equal(cent(totaisContrato(CONTRATO, semMedicao).valorContrato), 592347.68, 'somando cheio')
})

test('o faturamento direto entra como verba, sem metragem', () => {
  assert.equal(ehVerba(VERBA.unidade), true)
  assert.equal(ehVerba('m²'), false)
  assert.equal(ehVerba('VB'), true, 'caixa não importa')
  assert.equal(ehVerba(undefined), false)

  const c = calcServico(VERBA, semMedicao)
  assert.equal(c.valorContrato, 607620, 'qtd 1 × valor fechado')
})

test('com a verba, o contrato inteiro fecha', () => {
  const tot = totaisContrato([...CONTRATO, VERBA], semMedicao)
  assert.equal(cent(tot.valorContrato), 1199967.68)
  // A verba é metade do contrato — um modelo que só soubesse quantidade × preço não representaria
  // 50,6% deste documento.
  assert.equal(Math.round((607620 / 1199967.68) * 1000) / 10, 50.6)
})

// ─── A conferência contra o total declarado ────────────────────────────────────

test('a diferença do contrato real é arredondamento, e é apontada como tal', () => {
  const tot = totaisContrato([...CONTRATO, VERBA], semMedicao)
  const c = conferirTotal(1199944.15, tot.valorContrato)
  assert.ok(c)
  assert.equal(cent(c.diferenca), 23.53, 'a soma dá R$ 23,53 a mais que o declarado')
  assert.equal(c.arredondamento, true, 'R$ 23,53 em R$ 1,2 milhão cabe em arredondamento')
})

test('preço digitado errado NÃO passa como arredondamento', () => {
  // Trocar 28,94 por 289,40 no piso — um zero a mais, o erro de digitação clássico.
  const comErro = CONTRATO.map((s) => (s.id === 'a' ? { ...s, valorUnitario: 289.40 } : s))
  const tot = totaisContrato([...comErro, VERBA], semMedicao)
  const c = conferirTotal(1199944.15, tot.valorContrato)
  assert.ok(c)
  assert.equal(c.arredondamento, false, 'é isto que a conferência existe para pegar')
  assert.equal(c.diferenca > 3_000_000, true)
})

test('serviço faltando aparece como diferença negativa', () => {
  const tot = totaisContrato(CONTRATO, semMedicao)   // sem a verba
  const c = conferirTotal(1199944.15, tot.valorContrato)
  assert.ok(c)
  assert.equal(c.diferenca < 0, true, 'a soma fica menor que o declarado')
  assert.equal(c.arredondamento, false)
})

test('sem total declarado, não há o que conferir', () => {
  assert.equal(conferirTotal(undefined, 592347.68), null)
  assert.equal(conferirTotal(0, 592347.68), null)
})

// ─── % aplicado e medição ──────────────────────────────────────────────────────

test('o % aplicado reduz o preço efetivo, e a conta toda acompanha', () => {
  const meio = svc({ id: 'z', qtdContrato: 100, valorUnitario: 50, pctAplicado: 60 })
  assert.equal(precoEfetivo(meio), 30)
  const c = calcServico(meio, semMedicao)
  assert.equal(c.valorContrato, 3000, '100 × 30')
})

test('o medido vem dos RDOs e o saldo desconta o que já foi', () => {
  const medido = new Map([['a', 1000]])
  const c = calcServico(CONTRATO[0], medido)
  assert.equal(c.medido, 1000)
  assert.equal(cent(c.valorBruto), 28940, '1000 m² × R$ 28,94')
  assert.equal(cent(c.saldo), cent(12794.06 - 1000))
})

test('o override manual vence o que veio dos RDOs', () => {
  const medido = new Map([['a', 1000]])
  const c = calcServico({ ...CONTRATO[0], qtdMedidaOverride: 250 }, medido)
  assert.equal(c.medido, 250)
})

test('desconto de NF de materiais abate do medido bruto', () => {
  const medido = new Map([['a', 1000]])
  const tot = totaisContrato(CONTRATO, medido, 10)
  assert.equal(cent(tot.medidoBruto), 28940)
  assert.equal(cent(tot.descontoNf), 2894)
  assert.equal(cent(tot.medidoLiquido), 26046)
})

// ─── O valor do dia no RDO ─────────────────────────────────────────────────────

test('um dia misto vale a soma por serviço, não a metragem vezes um preço', () => {
  // 200 m² de piso + 150 m² de parede + 80 m de demarcação.
  const dia = [
    { servicoId: 'a', qtd: 200 },
    { servicoId: 'b', qtd: 150 },
    { servicoId: 'c', qtd: 80  },
  ]
  const porId = new Map(CONTRATO.map((s) => [s.id, s]))
  const correto = cent(dia.reduce((soma, l) => soma + l.qtd * precoEfetivo(porId.get(l.servicoId)!), 0))
  assert.equal(correto, 10635.50)

  // Como o RDO calculava antes: soma só os m² e multiplica por UM preço da obra.
  const m2 = 200 + 150   // a demarcação, em metro linear, era descartada
  assert.equal(cent(m2 * 28.94), 10129.00, 'com o preço do piso: R$ 506,50 a menos')
  assert.equal(cent(m2 * 27.65), 9677.50,  'com o preço da parede: R$ 958,00 a menos')
  assert.equal(cent(80 * 8.75), 700, 'e os R$ 700 da demarcação ficavam fora')
})
