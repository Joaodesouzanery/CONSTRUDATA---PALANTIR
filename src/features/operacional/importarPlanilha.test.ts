import assert from 'node:assert/strict'
import test from 'node:test'
import { ehRegistroReal, lerBancoCustos } from '@/features/operacional/importarPlanilha'

test('Tabela de Preços aceita somente chaves contratuais, não notas e títulos', () => {
  assert.equal(ehRegistroReal('tabela_precos', { CHAVE: 'BER-72000053' }), true)
  assert.equal(ehRegistroReal('tabela_precos', { CHAVE: 'SAN-72000053' }), true)
  assert.equal(ehRegistroReal('tabela_precos', { CHAVE: 'COMO PREENCHER' }), false)
  assert.equal(ehRegistroReal('tabela_precos', { CHAVE: 'TOTAL' }), false)
})

test('linhas-modelo com apenas fórmulas não viram movimentos operacionais', () => {
  assert.equal(ehRegistroReal('materiais', { DATA: '', MATERIAL: '', MOVIMENTO: '', 'TOTAL (fórmula)': '0' }), false)
  assert.equal(ehRegistroReal('lookahead', { 'SEMANA (2ª feira)': '', CONTRATO: '', STATUS: 'PENDENTE' }), false)
  assert.equal(ehRegistroReal('ocorrencias', { Nº: 'OC-1', CONTRATO: 'BERTIOGA' }), true)
})

test('Banco de Custos promove o contrato para cada item', () => {
  const linhas = lerBancoCustos([
    ['CUSTO MENSAL — BERTIOGA'],
    ['', 'ITEM', 'QTD', 'VALOR UNIT.', 'TOTAL / MÊS', 'FONTE'],
    ['', 'Caminhão', '2', '10', '20', 'Contrato'],
    ['CUSTO MENSAL — SANTOS'],
    ['', 'ITEM', 'QTD', 'VALOR UNIT.', 'TOTAL / MÊS', 'FONTE'],
    ['', 'Equipe', '1', '30', '30', 'Folha'],
  ])
  assert.deepEqual(linhas.map((l) => [l.Contrato, l.Item]), [['BERTIOGA', 'Caminhão'], ['SANTOS', 'Equipe']])
})
