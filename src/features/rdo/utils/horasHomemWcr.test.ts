/**
 * A conversão jornada → homem-hora do WCR.
 *
 * ⚠️ O teste que mais importa é o da DIVISÃO: a ponte de apontamentos divide `totalHoras` pelo
 * efetivo. Passar a jornada crua faria cada pessoa receber 0,84 h por um dia de 8 h.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { horasHomemDoWcr } from '@/features/rdo/utils/horasHomemWcr'
import type { RdoWcrData } from '@/types'

const wcr = (p: Partial<RdoWcrData>): RdoWcrData => ({ imoveis: [], producao: [], ...p } as RdoWcrData)
const pessoas = (n: number) => Array.from({ length: n }, (_, i) => ({ nome: `P${i}` }))

test('duas equipes de 8 h: HH é a soma de horas × pessoas de CADA equipe', () => {
  const d = wcr({
    apontamentos: [
      { equipe: 'Equipe A', horas: 8, imoveis: [], producao: [] },
      { equipe: 'Equipe B', horas: 8, imoveis: [], producao: [] },
    ],
    presencas: [
      { equipe: 'Equipe A', pessoas: pessoas(10) },
      { equipe: 'Equipe B', pessoas: pessoas(9) },
    ],
  })
  assert.equal(horasHomemDoWcr(d, 19), 152, '10×8 + 9×8')
})

test('a divisão da ponte devolve a jornada de volta — não 0,84 h', () => {
  const d = wcr({
    apontamentos: [
      { equipe: 'Equipe A', horas: 8, imoveis: [], producao: [] },
      { equipe: 'Equipe B', horas: 8, imoveis: [], producao: [] },
    ],
    presencas: [
      { equipe: 'Equipe A', pessoas: pessoas(10) },
      { equipe: 'Equipe B', pessoas: pessoas(9) },
    ],
  })
  const hh = horasHomemDoWcr(d, 19)!
  assert.equal(hh / 19, 8, 'cada pessoa trabalhou 8 h; passar `wcr.horas` cru daria 16 ÷ 19 = 0,84')
})

test('equipes com jornadas diferentes: a média por cabeça reflete o peso de cada uma', () => {
  const d = wcr({
    apontamentos: [
      { equipe: 'A', horas: 10, imoveis: [], producao: [] },
      { equipe: 'B', horas: 6, imoveis: [], producao: [] },
    ],
    presencas: [{ equipe: 'A', pessoas: pessoas(2) }, { equipe: 'B', pessoas: pessoas(8) }],
  })
  assert.equal(horasHomemDoWcr(d, 10), 68, '2×10 + 8×6')
})

test('ninguém informou horas: devolve undefined — ausente não é zero', () => {
  const d = wcr({ apontamentos: [{ equipe: 'A', imoveis: [], producao: [] }], presencas: [{ equipe: 'A', pessoas: pessoas(5) }] })
  assert.equal(horasHomemDoWcr(d, 5), undefined)
  assert.equal(horasHomemDoWcr(undefined, 5), undefined)
})

test('RDO antigo, sem a lista de apontamentos: wcr.horas é a jornada do dia', () => {
  const d = wcr({ horas: 8 })
  assert.equal(horasHomemDoWcr(d, 12), 96)
})

test('nome de equipe com acento e caixa diferentes casa com a lista de presença', () => {
  const d = wcr({
    apontamentos: [{ equipe: 'núcleo são josé', horas: 8, imoveis: [], producao: [] }],
    presencas: [{ equipe: 'NUCLEO SAO JOSE', pessoas: pessoas(4) }],
  })
  assert.equal(horasHomemDoWcr(d, 4), 32)
})

test('apontamento sem lista de presença correspondente usa o efetivo que sobrou', () => {
  const d = wcr({
    apontamentos: [
      { equipe: 'A', horas: 8, imoveis: [], producao: [] },
      { equipe: 'Z', horas: 8, imoveis: [], producao: [] },  // sem lista própria
    ],
    presencas: [{ equipe: 'A', pessoas: pessoas(6) }],
  })
  assert.equal(horasHomemDoWcr(d, 10), 48 + 32, '6 da equipe A + os 4 restantes na equipe órfã')
})

test('equipe órfã sem efetivo sobrando não multiplica ninguém duas vezes', () => {
  const d = wcr({
    apontamentos: [
      { equipe: 'A', horas: 8, imoveis: [], producao: [] },
      { equipe: 'Z', horas: 8, imoveis: [], producao: [] },
    ],
    presencas: [{ equipe: 'A', pessoas: pessoas(10) }],
  })
  assert.equal(horasHomemDoWcr(d, 10), 80, 'melhor faltar jornada do que contar a mesma pessoa duas vezes')
})
