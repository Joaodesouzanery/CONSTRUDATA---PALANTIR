import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { FinanceiroEntry, RDO, Shift } from '@/types'
import {
  janelaDeMeses, limitesDaJanela, producaoDaPlataforma, unidadeComparavel,
} from './producaoDaPlataforma'

const OBRA = 'obra-1'

function rdo(p: Partial<RDO> & { date: string }): RDO {
  return {
    id: `r-${p.date}-${p.number ?? 1}`, number: 1, responsible: 'Fulano',
    weather: {} as RDO['weather'], manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 },
    equipment: [], services: [], trechos: [], geolocation: null, observations: '', incidents: '',
    photos: [], siteId: OBRA, createdAt: '', updatedAt: '', ...p,
  } as RDO
}

function servico(quantity: number, unit: string) {
  return { id: `s-${quantity}-${unit}`, description: 'Piso', quantity, unit }
}

function saida(data: string, valor: number, obraId: string | null = OBRA): FinanceiroEntry {
  return {
    id: `e-${data}-${valor}`, tipo: 'saida', data, valor, categoria: 'material',
    descricao: 'x', obraId, status: 'pago',
  } as unknown as FinanceiroEntry
}

function turno(date: string, startTime = '07:00', endTime = '17:00'): Shift {
  return { id: `t-${date}`, workerId: 'w1', date, startTime, endTime, breakMinutes: 60, type: 'regular' } as Shift
}

const BASE = { obraId: OBRA, unidade: 'm²', rdos: [], entries: [], shifts: [] as Shift[] }

describe('janelaDeMeses', () => {
  it('devolve a janela terminando no mês pedido', () => {
    assert.deepEqual(janelaDeMeses('2026-08', 3), ['2026-06', '2026-07', '2026-08'])
  })

  it('atravessa a virada do ano', () => {
    assert.deepEqual(janelaDeMeses('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('recusa mês inválido e quantidade zero', () => {
    assert.deepEqual(janelaDeMeses('2026-13', 3), [])
    assert.deepEqual(janelaDeMeses('agosto', 3), [])
    assert.deepEqual(janelaDeMeses('2026-08', 0), [])
  })
})

describe('limitesDaJanela', () => {
  it('vai do dia 1 do primeiro ao último dia do último', () => {
    assert.deepEqual(limitesDaJanela(['2026-06', '2026-07', '2026-08']), { de: '2026-06-01', ate: '2026-08-31' })
  })

  it('acerta fevereiro bissexto', () => {
    assert.deepEqual(limitesDaJanela(['2024-02']), { de: '2024-02-01', ate: '2024-02-29' })
  })

  it('acerta fevereiro comum', () => {
    assert.deepEqual(limitesDaJanela(['2026-02']), { de: '2026-02-01', ate: '2026-02-28' })
  })
})

describe('unidadeComparavel', () => {
  it('junta as escritas da mesma unidade', () => {
    assert.equal(unidadeComparavel('m2'), unidadeComparavel('M²'))
    assert.equal(unidadeComparavel(' m² '), unidadeComparavel('m2'))
  })

  it('NUNCA junta metro com metro quadrado', () => {
    // Esta é a asserção que protege o R$/unidade de sair diluído.
    assert.notEqual(unidadeComparavel('m'), unidadeComparavel('m2'))
    assert.notEqual(unidadeComparavel('m2'), unidadeComparavel('m3'))
  })

  it('tira acento sem juntar unidades diferentes', () => {
    assert.equal(unidadeComparavel('UNIDADE'), 'UNIDADE')
    assert.equal(unidadeComparavel('un'), 'UN')
  })
})

describe('producaoDaPlataforma', () => {
  it('soma só o serviço da unidade declarada, e devolve o resto separado', () => {
    const r = producaoDaPlataforma({
      ...BASE,
      meses: ['2026-08'],
      rdos: [rdo({ date: '2026-08-10', services: [servico(100, 'm²'), servico(30, 'm'), servico(50, 'm2')] })],
    })
    assert.equal(r.quantidade, 150)
    assert.deepEqual(r.ignoradoPorUnidade, [{ unidade: 'M', quantidade: 30 }])
  })

  it('ignora RDO em rascunho, e conta quantos são', () => {
    const r = producaoDaPlataforma({
      ...BASE,
      meses: ['2026-08'],
      rdos: [
        rdo({ date: '2026-08-10', services: [servico(100, 'm²')] }),
        rdo({ date: '2026-08-11', number: 2, status: 'rascunho', services: [servico(999, 'm²')] }),
      ],
    })
    assert.equal(r.quantidade, 100)
    assert.equal(r.rdosLidos, 1)
    assert.equal(r.rdosRascunho, 1)
  })

  it('ignora RDO de outra obra e fora da janela', () => {
    const r = producaoDaPlataforma({
      ...BASE,
      meses: ['2026-08'],
      rdos: [
        rdo({ date: '2026-08-10', services: [servico(100, 'm²')] }),
        rdo({ date: '2026-08-10', number: 2, siteId: 'outra', services: [servico(500, 'm²')] }),
        rdo({ date: '2026-07-31', number: 3, services: [servico(500, 'm²')] }),
        rdo({ date: '2026-09-01', number: 4, services: [servico(500, 'm²')] }),
      ],
    })
    assert.equal(r.quantidade, 100)
    assert.equal(r.rdosLidos, 1)
  })

  it('soma o custo só das saídas desta obra na janela', () => {
    const r = producaoDaPlataforma({
      ...BASE,
      meses: ['2026-07', '2026-08'],
      entries: [
        saida('2026-07-05', 1000),
        saida('2026-08-20', 500),
        saida('2026-08-20', 9999, 'outra'),
        saida('2026-06-30', 7777),
        { ...saida('2026-08-01', 300), tipo: 'entrada' } as FinanceiroEntry,
      ],
    })
    assert.equal(r.custoBRL, 1500)
  })

  it('homens-hora é null quando não há turno — ausência não é zero', () => {
    const r = producaoDaPlataforma({ ...BASE, meses: ['2026-08'] })
    assert.equal(r.homensHora, null)
  })

  it('homens-hora desconta o intervalo', () => {
    const r = producaoDaPlataforma({
      ...BASE, meses: ['2026-08'],
      shifts: [turno('2026-08-03'), turno('2026-08-04')],
    })
    // 07:00 → 17:00 são 10h de relógio, menos 1h de intervalo = 9h por turno.
    assert.equal(r.homensHora, 18)
  })

  it('turno fora da janela não entra', () => {
    const r = producaoDaPlataforma({
      ...BASE, meses: ['2026-08'],
      shifts: [turno('2026-08-03'), turno('2026-07-31')],
    })
    assert.equal(r.homensHora, 9)
  })

  it('sem obra escolhida não inventa produção', () => {
    const r = producaoDaPlataforma({
      ...BASE, obraId: '', meses: ['2026-08'],
      rdos: [rdo({ date: '2026-08-10', services: [servico(100, 'm²')] })],
    })
    assert.equal(r.quantidade, 0)
    assert.equal(r.rdosLidos, 0)
  })

  it('conta os meses da janela, que é o que a comparação usa para o corte de tamanho', () => {
    const r = producaoDaPlataforma({ ...BASE, meses: janelaDeMeses('2026-08', 3) })
    assert.equal(r.meses, 3)
  })

  it('serviço sem unidade não é confundido com a unidade declarada', () => {
    const r = producaoDaPlataforma({
      ...BASE, meses: ['2026-08'],
      rdos: [rdo({ date: '2026-08-10', services: [servico(100, '')] })],
    })
    assert.equal(r.quantidade, 0)
    assert.deepEqual(r.ignoradoPorUnidade, [{ unidade: '(sem unidade)', quantidade: 100 }])
  })
})
