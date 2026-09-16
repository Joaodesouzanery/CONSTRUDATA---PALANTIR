/**
 * O RDO sugere hora extra — e não lança nada.
 *
 * O teste mais importante é o último par: sugestão em dia NÃO útil, silêncio em dia útil, e a
 * função não tem como escrever no store (é pura, devolve lista).
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sugestoesDeHoraExtra, horaExtraDaSugestao } from '@/features/mao-de-obra/utils/sugestaoHoraExtraRdo'
import type { Cargo, HoraExtra, RDO, Worker } from '@/types'

const worker = (id: string, name: string, extra: Partial<Worker> = {}): Worker =>
  ({ id, name, role: 'AJUDANTE GERAL I', status: 'active', ...extra } as Worker)

const rdo = (p: Partial<RDO> & Pick<RDO, 'id' | 'date'>): RDO =>
  ({ number: 1, status: 'finalizado', manpower: { employeeNames: [] }, ...p } as unknown as RDO)

const CARGOS: Cargo[] = [{ id: 'c1', nome: 'AJUDANTE GERAL I', valorSabado: 250, valorDomingo: 200 }]
const base = { workers: [worker('w1', 'JOSE')], cargos: CARGOS, horasExtras: [] as HoraExtra[], feriados: [], jornada: 'mon_fri' as const }

const comPresencaWcr = (id: string, date: string, pessoas: Array<{ nome: string; workerId?: string }>) =>
  rdo({ id, date, wcr: { imoveis: [], producao: [], presencas: [{ equipe: 'A', pessoas }] } } as Partial<RDO> & Pick<RDO, 'id' | 'date'>)

test('domingo: sugere uma linha por presente, com o valor do cargo para domingo', () => {
  const s = sugestoesDeHoraExtra({ ...base, rdos: [comPresencaWcr('r1', '2026-08-02', [{ nome: 'JOSE', workerId: 'w1' }])] })
  assert.equal(s.length, 1)
  assert.equal(s[0].valorSugerido, 200)
  assert.equal(s[0].razao, 'domingo')
  assert.equal(s[0].base, 'cargo cadastrado')
})

test('sábado com jornada seg-sex: sugere, e com o valor de SÁBADO', () => {
  const s = sugestoesDeHoraExtra({ ...base, rdos: [comPresencaWcr('r1', '2026-08-01', [{ nome: 'JOSE', workerId: 'w1' }])] })
  assert.equal(s[0].valorSugerido, 250)
  assert.equal(s[0].razao, 'sábado fora da jornada')
})

test('sábado com jornada seg-sáb: NÃO sugere — é dia de trabalho', () => {
  const s = sugestoesDeHoraExtra({ ...base, jornada: 'mon_sat', rdos: [comPresencaWcr('r1', '2026-08-01', [{ nome: 'JOSE', workerId: 'w1' }])] })
  assert.deepEqual(s, [])
})

test('dia útil: silêncio absoluto', () => {
  const s = sugestoesDeHoraExtra({ ...base, rdos: [comPresencaWcr('r1', '2026-08-05', [{ nome: 'JOSE', workerId: 'w1' }])] })
  assert.deepEqual(s, [])
})

test('feriado em dia de semana: sugere, e paga como domingo', () => {
  const s = sugestoesDeHoraExtra({
    ...base,
    feriados: [{ date: '2026-09-07', description: 'Independência' }],
    rdos: [comPresencaWcr('r1', '2026-09-07', [{ nome: 'JOSE', workerId: 'w1' }])],
  })
  assert.equal(s[0].razao, 'feriado')
  assert.equal(s[0].valorSugerido, 200, 'feriado paga como domingo')
})

test('rascunho não sugere nada — o dia e a lista ainda podem mudar', () => {
  const r = comPresencaWcr('r1', '2026-08-02', [{ nome: 'JOSE', workerId: 'w1' }])
  const s = sugestoesDeHoraExtra({ ...base, rdos: [{ ...r, status: 'rascunho' }] })
  assert.deepEqual(s, [])
})

test('o override do funcionário vence o cargo, e a tela sabe dizer de onde veio', () => {
  const s = sugestoesDeHoraExtra({
    ...base,
    workers: [worker('w1', 'JOSE', { heDomingoOverride: 320 })],
    rdos: [comPresencaWcr('r1', '2026-08-02', [{ nome: 'JOSE', workerId: 'w1' }])],
  })
  assert.equal(s[0].valorSugerido, 320)
  assert.equal(s[0].base, 'override do funcionário')
})

test('sem cargo cadastrado o valor é null — nunca 0', () => {
  const s = sugestoesDeHoraExtra({ ...base, cargos: [], rdos: [comPresencaWcr('r1', '2026-08-02', [{ nome: 'JOSE', workerId: 'w1' }])] })
  assert.equal(s[0].valorSugerido, null)
  assert.equal(s[0].base, 'sem valor configurado')
})

test('hora extra JÁ lançada naquele dia some da lista — reabrir o RDO não duplica', () => {
  const primeira = sugestoesDeHoraExtra({ ...base, rdos: [comPresencaWcr('r1', '2026-08-02', [{ nome: 'JOSE', workerId: 'w1' }])] })
  const lancada = horaExtraDaSugestao(primeira[0], 200, '2026-08-02T00:00:00.000Z')
  const segunda = sugestoesDeHoraExtra({ ...base, horasExtras: [lancada], rdos: [comPresencaWcr('r1', '2026-08-02', [{ nome: 'JOSE', workerId: 'w1' }])] })
  assert.deepEqual(segunda, [])
})

test('nome do RDO que não casa com ninguém entra marcado como sem cadastro', () => {
  const s = sugestoesDeHoraExtra({ ...base, rdos: [comPresencaWcr('r1', '2026-08-02', [{ nome: 'FULANO QUE NAO EXISTE' }])] })
  assert.equal(s.length, 1)
  assert.equal(s[0].semCadastro, true)
  assert.equal(s[0].workerId, undefined, 'inventar vínculo põe dinheiro no CPF errado')
})

test('a mesma pessoa em duas listas de presença conta UMA vez', () => {
  const r = rdo({
    id: 'r1', date: '2026-08-02',
    wcr: { imoveis: [], producao: [], presencas: [
      { equipe: 'A', pessoas: [{ nome: 'JOSE', workerId: 'w1' }] },
      { equipe: 'B', pessoas: [{ nome: 'JOSE', workerId: 'w1' }] },
    ] },
  } as Partial<RDO> & Pick<RDO, 'id' | 'date'>)
  assert.equal(sugestoesDeHoraExtra({ ...base, rdos: [r] }).length, 1)
})

test('RDO sem presença WCR cai para employeeNames e casa por nome', () => {
  const r = rdo({ id: 'r1', date: '2026-08-02', manpower: { employeeNames: ['Jose'] } } as Partial<RDO> & Pick<RDO, 'id' | 'date'>)
  const s = sugestoesDeHoraExtra({ ...base, rdos: [r] })
  assert.equal(s.length, 1)
  assert.equal(s[0].workerId, 'w1')
  assert.equal(s[0].semCadastro, false)
})

test('horaExtraDaSugestao: nasce NÃO paga — confirmar a sugestão não mexe no caixa', () => {
  const s = sugestoesDeHoraExtra({ ...base, rdos: [comPresencaWcr('r1', '2026-08-02', [{ nome: 'JOSE', workerId: 'w1' }])] })
  const he = horaExtraDaSugestao(s[0], 200, '2026-08-02T00:00:00.000Z')
  assert.equal(he.pago, false)
  assert.equal(he.entryId, undefined)
  assert.equal(he.origem, 'rdo')
})
