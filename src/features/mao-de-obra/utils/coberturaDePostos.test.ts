/**
 * A cobertura de posto — uma regra só, no lugar de quatro.
 *
 * Antes: PostosPanel, cltEngine (morta), DashboardPanel e MaoDeObraHeader tinham cada um a sua, e
 * as duas últimas **não checavam o cargo** — o KPI da tela de abertura podia dizer "coberto" onde
 * a matriz da aba Postos dizia "descoberto".
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  turnoAtivo, turnoCobrePosto, coberturaDoPosto, postosDescobertos, HORARIO_DO_TURNO,
} from './coberturaDePostos'
import type { Shift, WorkPost, Worker } from '@/types'

const post = (p: Partial<WorkPost> = {}): WorkPost => ({
  id: 'p1', name: 'Pintura Bloco A', workFront: 'Bloco A', role: 'Pintor',
  minWorkers: 2, shift: 'morning', ...p,
})
const worker = (id: string, role: string): Worker => ({ id, name: id, role, status: 'active' } as unknown as Worker)
const turno = (workerId: string, p: Partial<Shift> = {}): Shift => ({
  id: `s-${workerId}`, workerId, date: '2026-08-25', startTime: '07:00', endTime: '16:00',
  breakMinutes: 60, type: 'regular', status: 'scheduled', workFront: 'Bloco A', ...p,
} as unknown as Shift)

const PINTORES = [worker('w1', 'Pintor'), worker('w2', 'Pintor'), worker('w3', 'Servente')]

test('⚠️ o CARGO conta — era o que Dashboard e cabeçalho ignoravam', () => {
  // Dois serventes na frente do posto de pintor: a tela de abertura dizia "coberto".
  const c = coberturaDoPosto(post(), '2026-08-25',
    [turno('w3'), turno('w3b')], [worker('w3', 'Servente'), worker('w3b', 'Servente')])
  assert.equal(c.escalados, 0)
  assert.ok(!c.coberto)
})

test('dois pintores cobrem um posto que pede dois', () => {
  const c = coberturaDoPosto(post({ minWorkers: 2 }), '2026-08-25', [turno('w1'), turno('w2')], PINTORES)
  assert.equal(c.escalados, 2)
  assert.ok(c.coberto)
  assert.deepEqual(c.nomes.sort(), ['w1', 'w2'])
})

test('⚠️ renomear a frente NÃO quebra mais a cobertura', () => {
  // Era o defeito estrutural: "Bloco A" → "Bloco-A" em um dos lados deixava a célula vermelha sem
  // nada ter mudado na obra. Com o id, o vínculo sobrevive ao nome.
  const p = post({ workFront: 'Bloco-A' })
  const t = turno('w1', { workPostId: 'p1', workFront: 'Bloco A' })
  assert.ok(turnoCobrePosto(t, p, worker('w1', 'Pintor')))
})

test('turno antigo, sem id, ainda casa pelo texto — com tolerância', () => {
  const w = worker('w1', 'Pintor')
  for (const frente of ['Bloco A', 'bloco a', 'BLOCO-A', 'bloco_a', 'Bloco  A']) {
    assert.ok(turnoCobrePosto(turno('w1', { workFront: frente }), post(), w), `falhou em "${frente}"`)
  }
  assert.ok(!turnoCobrePosto(turno('w1', { workFront: 'Bloco B' }), post(), w))
})

test('quando há id, é ele que manda — mesmo com a frente igual', () => {
  // Turno apontando para OUTRO posto não cobre este, ainda que a frente coincida.
  const t = turno('w1', { workPostId: 'outro-posto', workFront: 'Bloco A' })
  assert.ok(!turnoCobrePosto(t, post(), worker('w1', 'Pintor')))
})

test('folga, feriado, falta e cancelado não cobrem nada', () => {
  const w = worker('w1', 'Pintor')
  for (const inativo of [{ type: 'day_off' }, { type: 'holiday' }, { status: 'absent' }, { status: 'cancelled' }]) {
    const t = turno('w1', inativo as Partial<Shift>)
    assert.ok(!turnoAtivo(t), `${JSON.stringify(inativo)} deveria ser inativo`)
    assert.ok(!turnoCobrePosto(t, post(), w))
  }
})

test('posto sem ninguém é descoberto; a contagem bate', () => {
  const posts = [post({ id: 'p1' }), post({ id: 'p2', workFront: 'Bloco B' })]
  const shifts = [turno('w1', { workPostId: 'p1' }), turno('w2', { workPostId: 'p1' })]
  assert.equal(postosDescobertos(posts, '2026-08-25', shifts, PINTORES), 1, 'só o Bloco B está descoberto')
})

test('turno de outro dia não cobre', () => {
  const c = coberturaDoPosto(post(), '2026-08-25', [turno('w1', { date: '2026-08-26' })], PINTORES)
  assert.equal(c.escalados, 0)
})

test('cada turno do posto tem o seu horário — o campo deixou de ser cadastro morto', () => {
  assert.deepEqual(HORARIO_DO_TURNO.morning,   { inicio: '07:00', fim: '16:00' })
  assert.deepEqual(HORARIO_DO_TURNO.afternoon, { inicio: '13:00', fim: '22:00' })
  assert.deepEqual(HORARIO_DO_TURNO.night,     { inicio: '22:00', fim: '06:00' })
  // Os quatro existem — antes o gerador cravava 07:00–16:00 em todos.
  assert.equal(Object.keys(HORARIO_DO_TURNO).length, 4)
})

test('sem posto e sem turno não quebra', () => {
  assert.equal(postosDescobertos([], '2026-08-25', [], []), 0)
  const c = coberturaDoPosto(post(), '2026-08-25', [], [])
  assert.equal(c.escalados, 0)
  assert.ok(!c.coberto)
})

// ── Desligado não cobre posto daqui para a frente ─────────────────────────────

/** Desligado numa data. Cargo certo — o que muda é só o momento em que ele saiu. */
const desligado = (id: string, role: string, data: string): Worker =>
  ({ id, name: id, role, status: 'inactive', desligamentoData: data } as unknown as Worker)

test('turno agendado DEPOIS do desligamento não cobre — o posto está descoberto', () => {
  // Sem esta regra, um turno de semana que vem em nome de quem saiu ontem aparecia como coberto e
  // ninguém era escalado no lugar.
  const c = coberturaDoPosto(
    post({ minWorkers: 1 }), '2026-09-10',
    [turno('w1', { date: '2026-09-10' })],
    [desligado('w1', 'Pintor', '2026-09-01')],
  )
  assert.equal(c.escalados, 0)
  assert.equal(c.coberto, false)
})

test('o que ele cobriu ANTES de sair continua valendo — o passado não se reescreve', () => {
  const c = coberturaDoPosto(
    post({ minWorkers: 1 }), '2026-08-20',
    [turno('w1', { date: '2026-08-20' })],
    [desligado('w1', 'Pintor', '2026-09-01')],
  )
  assert.equal(c.escalados, 1)
  assert.equal(c.coberto, true)
})

test('o próprio dia da saída já não conta — ele saiu, não trabalhou', () => {
  const c = coberturaDoPosto(
    post({ minWorkers: 1 }), '2026-09-01',
    [turno('w1', { date: '2026-09-01' })],
    [desligado('w1', 'Pintor', '2026-09-01')],
  )
  assert.equal(c.coberto, false)
})

test('desligado sem data registrada não muda nada — sem saber quando saiu, adivinhar seria pior', () => {
  const semData = { id: 'w1', name: 'w1', role: 'Pintor', status: 'inactive' } as unknown as Worker
  const c = coberturaDoPosto(post({ minWorkers: 1 }), '2026-08-25', [turno('w1')], [semData])
  assert.equal(c.coberto, true)
})

test('quem está na ativa cobre em qualquer data, com ou sem campo de desligamento', () => {
  const c = coberturaDoPosto(post({ minWorkers: 1 }), '2027-01-15',
    [turno('w1', { date: '2027-01-15' })], [worker('w1', 'Pintor')])
  assert.equal(c.coberto, true)
})
