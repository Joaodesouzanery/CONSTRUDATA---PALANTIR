import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumoProducaoWcr, tituloWcr, totalTrabalhadores } from './apresentacaoRdo.ts'

test('WCR com 19 nomes e categorias somando 19 não mostra 38', () => {
  const employeeNames = Array.from({ length: 19 }, (_, i) => `Pessoa ${i}`)
  assert.equal(totalTrabalhadores({ template: 'wcr', manpower: { foremanCount: 3, officialCount: 8, helperCount: 7, operatorCount: 1, employeeNames } }), 19)
})

test('produção WCR nunca soma metros com unidades', () => {
  const r = resumoProducaoWcr({ producao: [
    { sigla: 'LA', quantidade: '15', unidade: 'M' },
    { sigla: 'PRE', quantidade: '4', unidade: 'M' },
    { sigla: 'Caixa UMA', quantidade: '5', unidade: 'UN' },
    { sigla: 'PV', quantidade: '2', unidade: 'UN' },
  ] })
  assert.deepEqual(r, { itens: 4, metros: 19, unidades: 7 })
})

test('título WCR remove prefixos e segmentos repetidos', () => {
  assert.equal(tituloWcr(['RDO WCR — WCR — Boi Malhado · Boi Malhado']), 'RDO WCR — Boi Malhado')
  assert.equal(tituloWcr(['WCR — Boi Malhado', 'Boi Malhado', 'Gilvan']), 'RDO WCR — Boi Malhado · Gilvan')
})
