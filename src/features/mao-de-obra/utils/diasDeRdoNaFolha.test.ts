/**
 * Os dias de RDO que a folha não pagava.
 *
 * A regra que estes testes cercam é a que protege dinheiro: **nunca contar duas vezes**. Um dia
 * que já tem turno na Escala não pode entrar de novo pelo RDO.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { conferirDiasDeRdo, turnosQueFaltam } from './diasDeRdoNaFolha'
import type { Shift, TimecardEntry, Worker } from '@/types'

const MES = '2026-08'

const worker = (id: string, name: string, extra: Partial<Worker> = {}): Worker => ({
  id, name, status: 'active', grossSalary: 3000, hourlyRate: 0, ...extra,
} as unknown as Worker)

const turno = (workerId: string, date: string, extra: Partial<Shift> = {}): Shift => ({
  id: `t-${workerId}-${date}`, workerId, date,
  startTime: '07:00', endTime: '16:00', breakMinutes: 60,
  type: 'regular', status: 'confirmed', ...extra,
} as unknown as Shift)

/** Apontamento vindo do RDO — o que tem `sourceRdoId`. */
const doRdo = (workerId: string, date: string, horas = 8): TimecardEntry => ({
  id: `tc-${workerId}-${date}`, workerId, date, hoursWorked: horas,
  sourceRdoId: `rdo-${date}`, reportedQty: 0, unit: 'h',
} as unknown as TimecardEntry)

const WORKERS = [worker('w1', 'João'), worker('w2', 'Maria')]

test('dia com RDO e sem turno passa a contar', () => {
  const c = conferirDiasDeRdo(WORKERS, [], [doRdo('w1', '2026-08-10')], MES)
  assert.equal(c.dias.length, 1)
  assert.equal(c.dias[0].workerName, 'João')
  assert.equal(c.pessoas, 1)
  assert.ok(c.diferencaBRL > 0, 'a estimativa em reais aparece antes de mudar qualquer coisa')
})

test('⚠️ dia com RDO E turno NÃO conta duas vezes', () => {
  // É a trava que protege dinheiro. Sem ela, todo dia normal pagaria em dobro.
  const c = conferirDiasDeRdo(WORKERS, [turno('w1', '2026-08-10')], [doRdo('w1', '2026-08-10')], MES)
  assert.deepEqual(c.dias, [])
  assert.equal(c.diferencaBRL, 0)
})

test('turno de folga ou falta NÃO cobre o dia — a divergência tem de aparecer', () => {
  // Marcada ausente na Escala e presente no RDO: alguém errou, e esconder isso é pior.
  for (const naoPago of [{ status: 'absent' as const }, { type: 'day_off' as const }, { status: 'cancelled' as const }]) {
    const c = conferirDiasDeRdo(WORKERS, [turno('w1', '2026-08-10', naoPago)], [doRdo('w1', '2026-08-10')], MES)
    assert.equal(c.dias.length, 1, `${JSON.stringify(naoPago)} não deveria cobrir o dia`)
  }
})

test('apontamento digitado à mão não conta — só o que veio do RDO', () => {
  // Sem `sourceRdoId` não é comprovação independente: é a mesma pessoa dizendo o mesmo em outro
  // lugar. Se contasse, bastaria digitar um apontamento para gerar dia pago.
  const manual = { ...doRdo('w1', '2026-08-10'), sourceRdoId: undefined } as TimecardEntry
  assert.deepEqual(conferirDiasDeRdo(WORKERS, [], [manual], MES).dias, [])
})

test('só o mês pedido entra', () => {
  const c = conferirDiasDeRdo(WORKERS, [], [doRdo('w1', '2026-07-31'), doRdo('w1', '2026-08-01')], MES)
  assert.deepEqual(c.dias.map((d) => d.data), ['2026-08-01'])
})

test('funcionário desligado não entra na folha', () => {
  const desligado = [worker('w1', 'João', { status: 'inactive' } as Partial<Worker>)]
  assert.deepEqual(conferirDiasDeRdo(desligado, [], [doRdo('w1', '2026-08-10')], MES).dias, [])
})

test('o mesmo dia lançado duas vezes no RDO conta uma vez', () => {
  const c = conferirDiasDeRdo(WORKERS, [], [doRdo('w1', '2026-08-10'), doRdo('w1', '2026-08-10')], MES)
  assert.equal(c.dias.length, 1)
})

test('a conferência agrupa por pessoa e ordena pelo maior valor', () => {
  const c = conferirDiasDeRdo(
    [worker('w1', 'João', { grossSalary: 3000 }), worker('w2', 'Maria', { grossSalary: 9000 })],
    [],
    [doRdo('w1', '2026-08-10'), doRdo('w2', '2026-08-10'), doRdo('w2', '2026-08-11')],
    MES,
  )
  assert.equal(c.pessoas, 2)
  assert.equal(c.porFuncionario[0].workerName, 'Maria', 'maior valor primeiro')
  assert.equal(c.porFuncionario[0].dias, 2)
})

test('os turnos sugeridos cobrem exatamente os dias apontados', () => {
  const c = conferirDiasDeRdo(WORKERS, [], [doRdo('w1', '2026-08-10'), doRdo('w2', '2026-08-11')], MES)
  const turnos = turnosQueFaltam(c, 'obra-1')
  assert.equal(turnos.length, 2)
  assert.equal(turnos[0].status, 'confirmed')
  assert.deepEqual(turnos.map((t) => t.date).sort(), ['2026-08-10', '2026-08-11'])
  // Rodar de novo produz os mesmos ids — não duplica se alguém aplicar duas vezes.
  assert.deepEqual(turnosQueFaltam(c, 'obra-1').map((t) => t.id), turnos.map((t) => t.id))
})

test('mês sem nada devolve zero, não quebra', () => {
  const c = conferirDiasDeRdo(WORKERS, [], [], MES)
  assert.deepEqual(c.dias, [])
  assert.equal(c.diferencaBRL, 0)
  assert.deepEqual(turnosQueFaltam(c), [])
})
