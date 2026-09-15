/** Nomes fictícios. O que importa é a regra: exato entra, provável marca, ambíguo NUNCA decide. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { casarNome } from './casarNome'

const W = [
  { id: '1', name: 'Felipe Andrade' },
  { id: '2', name: 'Felipe Andrade Souza' },
  { id: '3', name: 'Marcos de Oliveira' },
  { id: '4', name: 'João Silva' },
  { id: '5', name: 'João Silva' },
  { id: '6', name: 'Carla Mendes' },
]

test('exato: o nome inteiro bate com um só cadastro', () => {
  const r = casarNome('  marcos DE oliveira ', W)
  assert.equal(r.tipo, 'exato'); assert.equal(r.tipo === 'exato' && r.worker.id, '3')
})

test('provável: primeiro nome + sobrenome parcial num só candidato', () => {
  const r = casarNome('Carla M.', W)
  assert.equal(r.tipo, 'provavel'); assert.equal(r.tipo === 'provavel' && r.worker.id, '6')
})

test('ambíguo: o primeiro nome sozinho com dois cadastros — a máquina não escolhe', () => {
  const r = casarNome('Felipe', W)
  assert.equal(r.tipo, 'ambiguo')
  assert.deepEqual(r.tipo === 'ambiguo' && r.candidatos.map((c) => c.id).sort(), ['1', '2'])
})

test('🔴 homônimo exato é ambíguo, não "o primeiro"', () => {
  // matchWorkerByName devolvia o '4' em silêncio. Aqui o salário da pessoa errada não entra.
  const r = casarNome('João Silva', W)
  assert.equal(r.tipo, 'ambiguo')
})

test('"Felipe Andrade" completo é exato mesmo havendo "Felipe Andrade Souza"', () => {
  const r = casarNome('Felipe Andrade', W)
  assert.equal(r.tipo, 'exato'); assert.equal(r.tipo === 'exato' && r.worker.id, '1')
})

test('nenhum: nome que não cabe em ninguém, e vazio', () => {
  assert.equal(casarNome('Zuleide', W).tipo, 'nenhum')
  assert.equal(casarNome('', W).tipo, 'nenhum')
  assert.equal(casarNome('Andrade', W).tipo, 'nenhum', 'sobrenome sozinho não casa: o primeiro nome manda')
})

test('cargo desempata os dois Damião, e sem cargo continua ambíguo', () => {
  const pessoas = [
    { name: 'DAMIÃO ALVES DA SILVA', role: 'ENCARREGADO DE OBRA I' },
    { name: 'DAMIÃO FIRMINO DOS SANTOS', role: 'PEDREIRO I' },
  ]
  const encarregado = casarNome('Damião', pessoas, 'encarregado')
  const pedreiro = casarNome('Damião', pessoas, 'pedreiro')
  assert.equal(encarregado.tipo === 'provavel' && encarregado.worker.name, pessoas[0].name)
  assert.equal(pedreiro.tipo === 'provavel' && pedreiro.worker.name, pessoas[1].name)
  assert.equal(casarNome('Damião', pessoas).tipo, 'ambiguo')
})

test('Cristian e Cristiano permanecem pessoas distintas', () => {
  const pessoas = [
    { name: 'CRISTIAN RICHARD SIMONETO DE ARAUJO', role: 'ENCANADOR DE ESGOTO I' },
    { name: 'CRISTIANO DOS SANTOS', role: 'AJUDANTE GERAL I' },
  ]
  const cristian = casarNome('Cristian', pessoas, 'encanador')
  const cristiano = casarNome('Cristiano', pessoas, 'ajudante')
  assert.equal(cristian.tipo === 'provavel' && cristian.worker.name, pessoas[0].name)
  assert.equal(cristiano.tipo === 'provavel' && cristiano.worker.name, pessoas[1].name)
})
