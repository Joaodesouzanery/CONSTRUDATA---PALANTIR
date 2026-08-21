/**
 * Unidades de medida — o teste que impede alguém de voltar a somar m com m².
 *
 * Os números são os do contrato real de pintura epóxi (cláusulas 3 e 6):
 *   piso 12.794,06 m² · paredes 5.337,40 m² · meio-fio 473,55 m²  → 18.605,01 m²
 *   demarcações e sinalizações 6.962,01 m                          → 6.962,01 m  (LINEAR)
 * Somar tudo daria 25.567,02, que não é área nem comprimento.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classificarUnidade, somarMetragem, formatarMetragem, temUnidadesMistas, ehVerba,
} from './unidadesMedida'

test('metro e metro quadrado são coisas diferentes', () => {
  assert.equal(classificarUnidade('m'), 'linear')
  assert.equal(classificarUnidade('ml'), 'linear')
  assert.equal(classificarUnidade('Metros'), 'linear')
  assert.equal(classificarUnidade('m²'), 'area')
  assert.equal(classificarUnidade('M2'), 'area')
  assert.equal(classificarUnidade('metros quadrados'), 'area')
})

test('milímetro e minuto não viram metragem', () => {
  // Um `/^m/` casaria com os dois. Foi por isso que a regex ancora nos dois lados.
  assert.equal(classificarUnidade('mm'), 'outra')
  assert.equal(classificarUnidade('min'), 'outra')
  assert.equal(classificarUnidade('m³'), 'outra')
  assert.equal(classificarUnidade('kg'), 'outra')
})

test('verba é valor fechado, não metragem', () => {
  assert.ok(ehVerba('vb'))
  assert.ok(ehVerba('VB'))
  assert.equal(classificarUnidade('vb'), 'verba')
  assert.ok(!ehVerba('m²'))
})

test('unidade vazia ou ausente não quebra e não conta como metragem', () => {
  assert.equal(classificarUnidade(''), 'outra')
  assert.equal(classificarUnidade(null), 'outra')
  assert.equal(classificarUnidade(undefined), 'outra')
})

test('o contrato real soma 18.605,01 m² e 6.962,01 m — em parcelas separadas', () => {
  const m = somarMetragem([
    { unidade: 'm²', quantidade: 12794.06 },
    { unidade: 'm²', quantidade: 5337.40 },
    { unidade: 'm',  quantidade: 6962.01 },
    { unidade: 'm²', quantidade: 473.55 },
    { unidade: 'vb', quantidade: 1 },
  ])
  assert.equal(Number(m.area.toFixed(2)), 18605.01)
  assert.equal(Number(m.linear.toFixed(2)), 6962.01)
  assert.equal(m.verbas, 1, 'o faturamento direto não tem metragem')
  assert.equal(m.outra, 0)
})

test('NADA no resultado soma área com comprimento', () => {
  // Este é o teste que importa. 18.605,01 + 6.962,01 = 25.567,02 — se algum campo devolver isso,
  // alguém voltou a juntar metro quadrado com metro linear.
  const m = somarMetragem([
    { unidade: 'm²', quantidade: 12794.06 },
    { unidade: 'm²', quantidade: 5337.40 },
    { unidade: 'm',  quantidade: 6962.01 },
    { unidade: 'm²', quantidade: 473.55 },
  ])
  for (const [campo, valor] of Object.entries(m)) {
    assert.notEqual(Number(Number(valor).toFixed(2)), 25567.02, `${campo} somou m com m²`)
  }
  assert.ok(temUnidadesMistas(m))
})

test('o texto sai em parcelas, e diz qual é qual', () => {
  const m = somarMetragem([
    { unidade: 'm²', quantidade: 18605.01 },
    { unidade: 'm',  quantidade: 6962.01 },
  ])
  assert.equal(formatarMetragem(m), '18.605,01 m² + 6.962,01 m')
})

test('obra só de área mostra uma parcela só, sem sinal de mais', () => {
  const m = somarMetragem([{ unidade: 'm²', quantidade: 1500 }])
  assert.equal(formatarMetragem(m), '1.500,00 m²')
  assert.ok(!temUnidadesMistas(m))
})

test('obra só de verba não finge ter metragem', () => {
  const m = somarMetragem([{ unidade: 'vb', quantidade: 1 }])
  assert.equal(formatarMetragem(m), 'valor fechado')
})

test('sem nada, não inventa zero', () => {
  assert.equal(formatarMetragem(somarMetragem([])), '—')
})
