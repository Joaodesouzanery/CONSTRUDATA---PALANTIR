import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { RDO, RdoCompizzoOcorrencias } from '@/types'
import {
  fraseDasParadas, motivosMarcados, resumirParadas, ROTULO_MOTIVO,
} from './horasParadas'

const OC_VAZIO: RdoCompizzoOcorrencias = {
  semOcorrencias: false, chuva: false, areaNaoLiberada: false,
  interferenciaTerceiros: false, faltaEnergia: false, equipamentoDefeito: false, outros: false,
}

let n = 0
const rdo = (
  ocorrencias: Partial<RdoCompizzoOcorrencias>,
  horasOcorrencia?: Record<string, number>,
): RDO => ({
  id: `r${++n}`, number: n, date: '2026-09-03',
  compizzo: { ocorrencias: { ...OC_VAZIO, ...ocorrencias }, horasOcorrencia },
} as unknown as RDO)

describe('motivosMarcados', () => {
  /** ⚠️ "Sem ocorrências" é a AUSÊNCIA de motivo — nunca pode virar uma barra no gráfico. */
  it('semOcorrencias não é motivo', () => {
    assert.deepEqual(motivosMarcados({ ...OC_VAZIO, semOcorrencias: true }), [])
  })

  it('devolve só o que está marcado', () => {
    assert.deepEqual(motivosMarcados({ ...OC_VAZIO, chuva: true, faltaEnergia: true }),
      ['chuva', 'faltaEnergia'])
  })

  it('nulo não quebra', () => {
    assert.deepEqual(motivosMarcados(null), [])
  })
})

describe('resumirParadas', () => {
  it('soma as horas por motivo e ordena pelo que mais custou', () => {
    const r = resumirParadas([
      rdo({ areaNaoLiberada: true }, { areaNaoLiberada: 6 }),
      rdo({ areaNaoLiberada: true }, { areaNaoLiberada: 8 }),
      rdo({ chuva: true }, { chuva: 3 }),
    ])
    assert.equal(r.porMotivo[0].motivo, 'areaNaoLiberada')
    assert.equal(r.porMotivo[0].horas, 14)
    assert.equal(r.porMotivo[0].ocorrencias, 2)
    assert.equal(r.porMotivo[1].motivo, 'chuva')
    assert.equal(r.horasTotais, 17)
  })

  /**
   * ⚠️ A regra que impede o número de mentir: ocorrência marcada SEM hora preenchida quer dizer
   * "aconteceu, ninguém mediu". Somar como zero faria a obra parecer mais eficiente do que é.
   */
  it('ocorrência sem hora NÃO soma zero — entra em semMedida', () => {
    const r = resumirParadas([
      rdo({ chuva: true }, { chuva: 4 }),
      rdo({ chuva: true }),                     // marcada, sem medida
    ])
    assert.equal(r.horasTotais, 4)
    assert.equal(r.semMedida, 1)
    assert.equal(r.porMotivo[0].ocorrencias, 2)
    assert.equal(r.porMotivo[0].semMedida, 1)
  })

  it('zero preenchido é medida — e é diferente de ausente', () => {
    const r = resumirParadas([rdo({ chuva: true }, { chuva: 0 })])
    assert.equal(r.semMedida, 0, 'zero foi medido')
    assert.equal(r.horasTotais, 0)
    assert.equal(r.porMotivo[0].ocorrencias, 1)
  })

  it('dois motivos no mesmo RDO contam os dois', () => {
    const r = resumirParadas([rdo({ chuva: true, faltaEnergia: true }, { chuva: 2, faltaEnergia: 5 })])
    assert.equal(r.ocorrenciasTotais, 2)
    assert.equal(r.horasTotais, 7)
  })

  it('RDO sem Compizzo é ignorado', () => {
    assert.deepEqual(resumirParadas([{ id: 'x', number: 1 } as RDO]).porMotivo, [])
  })

  it('período sem ocorrência nenhuma devolve tudo zerado, sem inventar motivo', () => {
    const r = resumirParadas([rdo({ semOcorrencias: true })])
    assert.deepEqual(r.porMotivo, [])
    assert.equal(r.ocorrenciasTotais, 0)
  })

  it('hora inválida conta como não medida', () => {
    const r = resumirParadas([rdo({ chuva: true }, { chuva: Number.NaN })])
    assert.equal(r.semMedida, 1)
    assert.equal(r.horasTotais, 0)
  })

  it('todos os motivos têm rótulo em português', () => {
    for (const [k, v] of Object.entries(ROTULO_MOTIVO)) {
      assert.ok(v.length > 2, `${k} sem rótulo`)
      assert.notEqual(v, k)
    }
  })
})

describe('fraseDasParadas', () => {
  it('sem ocorrência, diz isso', () => {
    assert.match(fraseDasParadas(resumirParadas([])), /Nenhuma ocorrência/)
  })

  it('nomeia o motivo que mais custou', () => {
    const f = fraseDasParadas(resumirParadas([
      rdo({ areaNaoLiberada: true }, { areaNaoLiberada: 14 }),
      rdo({ chuva: true }, { chuva: 2 }),
    ]))
    assert.match(f, /16 h paradas/)
    assert.match(f, /área não liberada/)
  })

  /** ⚠️ Um total de horas sem essa ressalva convida a ser lido como se fosse tudo. */
  it('declara quantas ficaram sem medida', () => {
    const f = fraseDasParadas(resumirParadas([
      rdo({ chuva: true }, { chuva: 3 }),
      rdo({ chuva: true }),
      rdo({ faltaEnergia: true }),
    ]))
    assert.match(f, /2 ocorrência\(s\) sem hora preenchida/)
  })

  it('quando NADA foi medido, não finge um total', () => {
    const f = fraseDasParadas(resumirParadas([rdo({ chuva: true }), rdo({ faltaEnergia: true })]))
    assert.match(f, /não dá para dizer quanto custaram/)
    assert.ok(!/0 h paradas/.test(f))
  })
})
