/**
 * As tabelas de 2026 e o redutor — os números que o cliente passou, travados por teste.
 *
 * ⚠️ Nomes fictícios; nenhum valor nominal real. Se o contador corrigir uma alíquota, o teste
 * muda junto — ele trava o que foi INFORMADO, não o que é verdade tributária.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calcINSS, tetoINSS, calcIRRF, reducaoDoIRRF, calcEncargosPatronais,
  TABELA_INSS_2026, TABELA_IRRF_2026, REDUTOR_IRRF_2026,
} from './payrollEngine'

test('INSS 2026: teto de R$ 988,09 e faixas progressivas', () => {
  assert.equal(tetoINSS(TABELA_INSS_2026), 988.09)
  // 1.600 × 7,5% (sem meio centavo no caminho — 1.621 dá 121,575 e cai no arredondamento binário)
  assert.equal(calcINSS(1_600, TABELA_INSS_2026), 120)
  // 3.000 já está na 3ª faixa: 1.621 × 7,5% + 1.281,84 × 9% + 97,16 × 12% = 121,575 + 115,37 + 11,66
  assert.equal(calcINSS(3_000, TABELA_INSS_2026), 248.6)
  // acima do teto não cresce
  assert.equal(calcINSS(20_000, TABELA_INSS_2026), 988.09)
})

test('redutor 2026: isento até 5.000, parcial até 7.350, cheio acima', () => {
  const imposto = 300
  assert.equal(reducaoDoIRRF(imposto, 4_000, REDUTOR_IRRF_2026), 300, 'até 5.000 zera o imposto')
  assert.equal(reducaoDoIRRF(imposto, 5_000, REDUTOR_IRRF_2026), 300)
  // 978,62 − 0,133145 × 6.000 = 179,75
  assert.equal(reducaoDoIRRF(imposto, 6_000, REDUTOR_IRRF_2026), 179.75)
  assert.equal(reducaoDoIRRF(imposto, 7_351, REDUTOR_IRRF_2026), 0, 'acima de 7.350 não há redução')
  assert.equal(reducaoDoIRRF(imposto, 6_000, undefined), 0, 'sem redutor configurado não reduz')
  assert.equal(reducaoDoIRRF(50, 6_000, REDUTOR_IRRF_2026), 50, 'nunca reduz mais que o imposto')
})

test('IRRF 2026 continua sendo a tabela progressiva — o redutor é um desconto por cima', () => {
  assert.equal(calcIRRF(2_428.80, TABELA_IRRF_2026), 0)
  // 4.000 × 22,5% − 675,49
  assert.equal(calcIRRF(4_000, TABELA_IRRF_2026), 224.51)
})

test('encargos patronais: 20% + RAT + Sistema S; a CPRB tira só os 20%', () => {
  assert.equal(calcEncargosPatronais(1_000), 268, 'padrão: 20 + 1 + 5,8')
  assert.equal(calcEncargosPatronais(1_000, { ratPct: 3, sistemaSPct: 5.8 }), 288)
  assert.equal(calcEncargosPatronais(1_000, { regimeCprb: true }), 68, 'CPRB: RAT e terceiros continuam')
})
