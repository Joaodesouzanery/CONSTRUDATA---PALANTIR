import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseApontamentoWcr } from './apontamentoWcr.ts'
import {
  apontamentoParaRdo, somarProducao, resumoDoDia, ehListaDePresenca, parseListaDePresenca,
  manpowerDaPresenca, funcaoCanonica, presencaParaRdo,
} from './apontamentoWcrDia.ts'
import { producaoDosRdos } from './wcrParaFcp.ts'
import type { RDO } from '@/types'

// Os dois apontamentos do mesmo dia, como chegam: equipes e núcleos diferentes, siglas em branco.
const A = `📋 APONTAMENTO DIÁRIO — MODELO

Produção - 31/08
Equipe - Fulano
Núcleo - Boi Malhado
Imóvel - rua santa rosa de goiás / rua santa rosa do sul

SERVIÇO ÁGUA
PRA -
LA -
HM -

SERVIÇO ESGOTO
PRE -
LE - 1
PV -

obs: 3 reparo de PV`

const B = `📋 APONTAMENTO DIÁRIO — MODELO

Produção - 31/08
Equipe - Beltrano
Núcleo - Boi Malhado
Imóvel - rua santa rosa de sul
Imóvel - rua um

SERVIÇO ÁGUA
PRA - 12,5
HM - 100

SERVIÇO ESGOTO
LE -`

const HOJE = '2026-09-08'
const a = apontamentoParaRdo(parseApontamentoWcr(A, { hoje: HOJE }), A)
const b = apontamentoParaRdo(parseApontamentoWcr(B, { hoje: HOJE }), B)

test('somar: um pôs 100 e o outro deixou em branco → 100; ninguém informou → continua vazio', () => {
  const soma = somarProducao([a, b])
  const q = (sigla: string) => soma.find((l) => l.sigla === sigla)!.quantidade
  assert.equal(q('HM'), '100')
  assert.equal(q('LE'), '1')
  assert.equal(q('PRA'), '12.5')
  assert.equal(q('PV'), '', 'PV ficou em branco nos dois — não é zero')
  assert.equal(q('CI'), '', 'sigla que nenhum apontamento citou')
})

test('resumo do dia: equipes e núcleos juntam, imóveis viram união sem repetir', () => {
  const r = resumoDoDia([a, b])
  assert.equal(r.equipe, 'Fulano · Beltrano')
  assert.equal(r.nucleo, 'Boi Malhado')
  assert.ok(r.imoveis.length >= 3 && new Set(r.imoveis).size === r.imoveis.length)
  assert.equal(r.anoInferido, true)
  assert.match(r.observacoes ?? '', /reparo de PV/)
})

test('um apontamento só: o resumo é ele mesmo', () => {
  const r = resumoDoDia([a])
  assert.equal(r.equipe, 'Fulano')
  assert.deepEqual(r.imoveis, a.imoveis)
})

const LISTA = `LISTA DE PRESENÇA 31/08

EQUIPE- FULANO

Fulano- líder
Sicrano - soldador
Beltrano- líder
Ciclano - ajudantan
Anderson Assis - ajudante
Patrick -lider`

test('lista de presença: reconhece o cabeçalho e lê "nome - função" com o hífen de qualquer lado', () => {
  assert.equal(ehListaDePresenca(LISTA), true)
  assert.equal(ehListaDePresenca(A), false)
  const p = parseListaDePresenca(LISTA, { hoje: HOJE })
  assert.equal(p.data, '2026-08-31')
  assert.equal(p.anoInferido, true)
  assert.equal(p.equipe, 'FULANO')
  assert.equal(p.pessoas.length, 6)
  assert.deepEqual(p.pessoas[0], { nome: 'Fulano', funcao: 'líder' })
  assert.deepEqual(p.pessoas[4], { nome: 'Anderson Assis', funcao: 'ajudante' })
  assert.equal(p.naoEntendidas.length, 0)
})

test('lista sem "EQUIPE": só os nomes, e a linha estranha vai para não entendidas', () => {
  const p = parseListaDePresenca(`LISTA DE PRESENÇA 31/08\n\nRodrigo - líder\nEdson - líder\nqualquer coisa sem hífen`)
  assert.equal(p.equipe, undefined)
  assert.equal(p.pessoas.length, 2)
  assert.deepEqual(p.naoEntendidas, ['qualquer coisa sem hífen'])
})

test('função canônica: líder/encarregado → encarregado; ajudantan → ajudante; encanador → oficial', () => {
  assert.equal(funcaoCanonica('líder'), 'encarregado')
  assert.equal(funcaoCanonica('lider'), 'encarregado')
  assert.equal(funcaoCanonica('ajudantan'), 'ajudante')
  assert.equal(funcaoCanonica('Pedreiro'), 'oficial')
  assert.equal(funcaoCanonica('encanador'), 'oficial')
  assert.equal(funcaoCanonica(undefined), 'oficial')
})

test('manpower: conta por função e a mesma pessoa em duas listas conta uma vez', () => {
  const l1 = presencaParaRdo(parseListaDePresenca(LISTA, { hoje: HOJE }))
  const l2 = presencaParaRdo(parseListaDePresenca(`LISTA DE PRESENÇA 31/08\nEquipe Outra\nFulano - líder\nMaurício - Pedreiro`, { hoje: HOJE }))
  const m = manpowerDaPresenca([l1, l2])
  assert.equal(m.employeeNames!.length, 7, 'Fulano está nas duas e conta uma')
  assert.equal(m.foremanCount, 3)   // Fulano, Beltrano, Patrick
  assert.equal(m.helperCount, 2)    // Ciclano, Anderson Assis
  assert.equal(m.officialCount, 2)  // Sicrano (soldador), Maurício (pedreiro)
  assert.equal(m.operatorCount, 0)
})

test('🔴 12,5 m de rede são 12,5 — não 125 (a ponte com o FCP lia o ponto como milhar)', () => {
  const rdo = { id: 'r', template: 'wcr', status: 'finalizado', wcr: { imoveis: [], producao: [
    { sigla: 'PRA', quantidade: '12.5', unidade: 'M' },
    { sigla: 'LA', quantidade: '1000', unidade: 'UN' },    // o RDO grava String(número): sem milhar
    { sigla: 'LE', quantidade: '2,5', unidade: 'UN' },     // texto que não é número JS: vírgula decimal
  ] } } as unknown as RDO
  const p = producaoDosRdos([rdo])
  assert.equal(p.metros, 12.5)
  assert.equal(p.unidades, 1002.5)
})

// ─────────────────────────────────────────────────────────────────────────────
// Presença colada × cadastro (nomes fictícios)
// ─────────────────────────────────────────────────────────────────────────────
import { casarPresenca, idsPreMarcados, piorClima } from './apontamentoWcrDia.ts'

const CADASTRO = [
  { id: 'a', name: 'Mario Teixeira', status: 'active' as const },
  { id: 'b', name: 'Mario Teixeira Neto', status: 'active' as const },
  { id: 'c', name: 'Renata Prado', status: 'active' as const },
  { id: 'd', name: 'Cristiano Alves', status: 'inactive' as const },
]

test('presença: exato e provável pré-marcam; ambíguo NUNCA', () => {
  const casadas = casarPresenca(
    [{ nome: 'Renata Prado', funcao: 'líder' }, { nome: 'Mario', funcao: 'ajudante' }, { nome: 'Mario Teixeira Neto' }, { nome: 'Cristiano Alves' }],
    CADASTRO,
  )
  assert.equal(casadas[0].veredito.tipo, 'exato')
  assert.equal(casadas[1].veredito.tipo, 'ambiguo', 'dois Marios: a máquina não escolhe')
  assert.equal(casadas[2].veredito.tipo, 'exato')
  assert.equal(casadas[3].veredito.tipo, 'nenhum', 'desligado não é candidato')
  assert.deepEqual([...idsPreMarcados(casadas)].sort(), ['b', 'c'])
})

test('o dia é tão ruim quanto o pior apontamento', () => {
  assert.equal(piorClima(['good', 'rain', 'cloudy']), 'rain')
  assert.equal(piorClima([undefined, undefined]), undefined)
  assert.equal(piorClima(['good', undefined]), 'good')
})
