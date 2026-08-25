/**
 * Produtividade por serviço — o cruzamento que não existia.
 *
 * Os três ingredientes já estavam no mesmo objeto RDO (produção por serviço, contagem de gente,
 * data) e nenhuma linha de código os juntava. Estes testes cercam as armadilhas da divisão.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { produtividadePorServico, diasParaConcluir } from './produtividadePorServico'
import type { RDO, ObraContratoServico } from '@/types'

const SERVICOS: ObraContratoServico[] = [
  { id: 'piso',   descricao: 'Pintura epóxi em piso', unidade: 'm²', qtdContrato: 12794.06, valorUnitario: 28.94 },
  { id: 'demarc', descricao: 'Demarcações',           unidade: 'm',  qtdContrato: 6962.01,  valorUnitario: 8.75 },
  { id: 'verba',  descricao: 'Faturamento direto',    unidade: 'vb', qtdContrato: 1,        valorUnitario: 607620 },
]

/** Um RDO Compizzo finalizado, com N pessoas e as linhas de produção informadas. */
const rdo = (
  date: string,
  pessoas: number,
  producao: Array<{ contractServiceId: string; quantidade: string }>,
  extra: Partial<RDO> = {},
): RDO => ({
  id: `rdo-${date}`, siteId: 'obra-1', template: 'compizzo', status: 'finalizado', date,
  manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0,
              employeeNames: Array.from({ length: pessoas }, (_, i) => `Pessoa ${i + 1}`) },
  compizzo: { producao: producao.map((p, i) => ({ id: String(i), ...p })) },
  ...extra,
} as unknown as RDO)

test('6 pessoas fazendo 300 m² dão 50 m² por pessoa por dia', () => {
  const [p] = produtividadePorServico([rdo('2026-08-10', 6, [{ contractServiceId: 'piso', quantidade: '300' }])],
    'obra-1', SERVICOS)
  assert.equal(p.servicoId, 'piso')
  assert.equal(p.unidade, 'm²')
  assert.equal(p.dias[0].porPessoa, 50)
  assert.equal(p.mediaPorPessoaDia, 50)
  assert.equal(p.total, 300)
})

test('a média pondera pelo tamanho da equipe, não pela média das médias', () => {
  // Dia A: 2 pessoas × 100 m² = 50/pessoa. Dia B: 10 pessoas × 300 m² = 30/pessoa.
  // Média das médias daria 40. O certo é 400 ÷ 12 = 33,33 — o dia grande pesa mais.
  const [p] = produtividadePorServico([
    rdo('2026-08-10', 2,  [{ contractServiceId: 'piso', quantidade: '100' }]),
    rdo('2026-08-11', 10, [{ contractServiceId: 'piso', quantidade: '300' }]),
  ], 'obra-1', SERVICOS)
  assert.equal(Number(p.mediaPorPessoaDia!.toFixed(2)), 33.33)
  assert.notEqual(Number(p.mediaPorPessoaDia!.toFixed(2)), 40)
})

test('RDO sem ninguém registrado não divide por zero nem entra na média', () => {
  const [p] = produtividadePorServico([
    rdo('2026-08-10', 0, [{ contractServiceId: 'piso', quantidade: '100' }]),
    rdo('2026-08-11', 5, [{ contractServiceId: 'piso', quantidade: '250' }]),
  ], 'obra-1', SERVICOS)
  assert.equal(p.dias[0].porPessoa, null, 'o dia sem gente não inventa produtividade')
  assert.equal(p.total, 350, 'mas a produção dele continua contando no total')
  assert.equal(p.mediaPorPessoaDia, 50, 'a média usa só o dia com gente: 250 ÷ 5')
})

test('duas linhas do mesmo serviço no mesmo dia somam a quantidade, não as pessoas', () => {
  // São as MESMAS 4 pessoas nas duas linhas — contá-las duas vezes daria 8 e metade do ritmo.
  const [p] = produtividadePorServico([
    rdo('2026-08-10', 4, [
      { contractServiceId: 'piso', quantidade: '100' },
      { contractServiceId: 'piso', quantidade: '100' },
    ]),
  ], 'obra-1', SERVICOS)
  assert.equal(p.dias[0].quantidade, 200)
  assert.equal(p.dias[0].pessoas, 4)
  assert.equal(p.dias[0].porPessoa, 50)
})

test('cada serviço fica com a unidade dele — metro linear não vira m²', () => {
  const r = produtividadePorServico([
    rdo('2026-08-10', 5, [
      { contractServiceId: 'piso',   quantidade: '250' },
      { contractServiceId: 'demarc', quantidade: '100' },
    ]),
  ], 'obra-1', SERVICOS)
  assert.equal(r.length, 2)
  assert.equal(r.find((x) => x.servicoId === 'piso')!.unidade, 'm²')
  assert.equal(r.find((x) => x.servicoId === 'demarc')!.unidade, 'm')
})

test('serviço de valor fechado fica de fora — não tem metragem', () => {
  const r = produtividadePorServico([
    rdo('2026-08-10', 5, [{ contractServiceId: 'verba', quantidade: '1' }]),
  ], 'obra-1', SERVICOS)
  assert.deepEqual(r, [])
})

test('RDO em rascunho e de outra obra não entram', () => {
  const r = produtividadePorServico([
    rdo('2026-08-10', 5, [{ contractServiceId: 'piso', quantidade: '999' }], { status: 'rascunho' }),
    rdo('2026-08-11', 5, [{ contractServiceId: 'piso', quantidade: '888' }], { siteId: 'outra-obra' }),
  ], 'obra-1', SERVICOS)
  assert.deepEqual(r, [])
})

test('serviço sem produção nenhuma não aparece na lista', () => {
  const r = produtividadePorServico([
    rdo('2026-08-10', 5, [{ contractServiceId: 'piso', quantidade: '250' }]),
  ], 'obra-1', SERVICOS)
  assert.deepEqual(r.map((x) => x.servicoId), ['piso'], 'demarcação não teve produção')
})

test('o melhor e o pior dia saem pelo ritmo, não pela quantidade', () => {
  const [p] = produtividadePorServico([
    rdo('2026-08-10', 10, [{ contractServiceId: 'piso', quantidade: '400' }]),  // 40/pessoa
    rdo('2026-08-11', 2,  [{ contractServiceId: 'piso', quantidade: '160' }]),  // 80/pessoa
  ], 'obra-1', SERVICOS)
  assert.equal(p.melhorDia!.data, '2026-08-11', 'menos m², mas melhor ritmo')
  assert.equal(p.piorDia!.data, '2026-08-10')
})

test('ordena pelo serviço que domina a obra', () => {
  const r = produtividadePorServico([
    rdo('2026-08-10', 5, [
      { contractServiceId: 'demarc', quantidade: '50' },
      { contractServiceId: 'piso',   quantidade: '500' },
    ]),
  ], 'obra-1', SERVICOS)
  assert.deepEqual(r.map((x) => x.servicoId), ['piso', 'demarc'])
})

test('a previsão de término só responde quando dá para responder', () => {
  const [p] = produtividadePorServico([
    rdo('2026-08-10', 6, [{ contractServiceId: 'piso', quantidade: '300' }]),
  ], 'obra-1', SERVICOS)   // 50 m²/pessoa/dia

  assert.equal(diasParaConcluir(p, 3000, 6), 10, '3.000 ÷ (50 × 6) = 10 dias')
  assert.equal(diasParaConcluir(p, 3001, 6), 11, 'arredonda para cima — dia quebrado é dia inteiro')
  assert.equal(diasParaConcluir(p, 0, 6), null, 'sem saldo não há previsão')
  assert.equal(diasParaConcluir(p, 3000, 0), null, 'sem equipe não há previsão')
  // Devolver um chute aqui seria pior que não responder: vira data prometida ao cliente.
  const semRitmo = { ...p, mediaPorPessoaDia: null }
  assert.equal(diasParaConcluir(semRitmo, 3000, 6), null)
})

test('obra sem contrato ou sem RDO devolve lista vazia, não quebra', () => {
  assert.deepEqual(produtividadePorServico([], 'obra-1', SERVICOS), [])
  assert.deepEqual(produtividadePorServico([rdo('2026-08-10', 5, [])], 'obra-1', []), [])
  assert.deepEqual(produtividadePorServico([rdo('2026-08-10', 5, [])], null, SERVICOS), [])
})
