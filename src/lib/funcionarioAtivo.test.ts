/**
 * Desligar em vez de excluir — e a conta do que se perde ao excluir.
 *
 * O que estes testes travam é a decisão do cliente: **contar o que se perde e bloquear quando for
 * muito**, com o desligado **sempre visível**. Se algum dia alguém trocar o filtro visual por um
 * filtro no dado, o teste do "continua na lista" cai.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  funcionarioEstaAtivo, separarPorAtividade, contarHistoricoDoFuncionario, decidirExclusao,
  HISTORICO_QUE_BLOQUEIA_EXCLUSAO,
} from './funcionarioAtivo'
import type { Worker, Shift, TimecardEntry, WorkerAbsence, WorkerAssessment } from '@/types'

const w = (p: Partial<Worker>): Worker => ({
  id: 'w1', name: 'João da Silva', role: 'Pintor', cpfMasked: '***.***.***-11',
  crewId: 'c1', status: 'active', certifications: [], hourlyRate: 20, ...p,
} as Worker)

const turno = (p: Partial<Shift>): Shift =>
  ({ id: 's1', workerId: 'w1', date: '2026-08-01', ...p } as Shift)
const apont = (p: Partial<TimecardEntry>): TimecardEntry =>
  ({ id: 't1', workerId: 'w1', date: '2026-08-01', hoursWorked: 8, ...p } as TimecardEntry)
const falta = (p: Partial<WorkerAbsence>): WorkerAbsence =>
  ({ id: 'a1', workerId: 'w1', date: '2026-08-01', ...p } as WorkerAbsence)
const aval = (p: Partial<WorkerAssessment>): WorkerAssessment =>
  ({ id: 'v1', workerId: 'w1', createdAt: '2026-08-01T00:00:00Z', ...p } as WorkerAssessment)

// ── Quem está fora ────────────────────────────────────────────────────────────

test('só "inactive" é desligamento — suspenso é afastamento, a pessoa volta', () => {
  assert.equal(funcionarioEstaAtivo(w({ status: 'active' })), true)
  assert.equal(funcionarioEstaAtivo(w({ status: 'suspended' })), true)
  assert.equal(funcionarioEstaAtivo(w({ status: 'pending_approval' })), true)
  assert.equal(funcionarioEstaAtivo(w({ status: 'inactive' })), false)
})

test('separar preserva a ordem de cada grupo — o desligado NÃO some da lista', () => {
  const lista = [
    w({ id: 'a' }), w({ id: 'b', status: 'inactive' }), w({ id: 'c' }), w({ id: 'd', status: 'inactive' }),
  ]
  const { ativos, desligados } = separarPorAtividade(lista)
  assert.deepEqual(ativos.map((x) => x.id), ['a', 'c'])
  assert.deepEqual(desligados.map((x) => x.id), ['b', 'd'])
  assert.equal(ativos.length + desligados.length, lista.length, 'ninguém se perde no caminho')
})

// ── A conta do que se perde ───────────────────────────────────────────────────

test('conta as quatro coleções que apontam para a pessoa', () => {
  const h = contarHistoricoDoFuncionario('w1', {
    shifts: [turno({ id: 's1' }), turno({ id: 's2' })],
    timecards: [apont({ id: 't1' })],
    absences: [falta({ id: 'a1' }), falta({ id: 'a2' }), falta({ id: 'a3' })],
    assessments: [aval({ id: 'v1' })],
  })
  assert.equal(h.turnos, 2)
  assert.equal(h.apontamentos, 1)
  assert.equal(h.faltas, 3)
  assert.equal(h.avaliacoes, 1)
  assert.equal(h.total, 7)
})

test('o rastro de OUTRA pessoa nunca entra na conta', () => {
  const h = contarHistoricoDoFuncionario('w1', {
    shifts: [turno({ workerId: 'w2' })],
    timecards: [apont({ workerId: 'w2' })],
    absences: [falta({ workerId: 'w2' })],
    assessments: [aval({ workerId: 'w2' })],
  })
  assert.equal(h.total, 0)
})

test('apontamento vindo de RDO é contado à parte — ninguém o digitou, e ninguém o redigita', () => {
  const h = contarHistoricoDoFuncionario('w1', {
    timecards: [apont({ id: 't1' }), apont({ id: 't2', sourceRdoId: 'rdo-9' }), apont({ id: 't3', sourceRdoId: 'rdo-9' })],
  })
  assert.equal(h.apontamentos, 3)
  assert.equal(h.apontamentosDeRdo, 2)
})

test('o período sai da primeira à última data, olhando as três coleções datadas', () => {
  const h = contarHistoricoDoFuncionario('w1', {
    shifts: [turno({ date: '2026-05-10' })],
    timecards: [apont({ date: '2024-03-05' })],
    absences: [falta({ date: '2025-12-31' })],
  })
  assert.equal(h.primeiraData, '2024-03-05')
  assert.equal(h.ultimaData, '2026-05-10')
})

test('sem nenhum registro, o período é null — e não uma data inventada', () => {
  const h = contarHistoricoDoFuncionario('w1', {})
  assert.equal(h.total, 0)
  assert.equal(h.primeiraData, null)
  assert.equal(h.ultimaData, null)
})

// ── A decisão ─────────────────────────────────────────────────────────────────

test('sem histórico nenhum, excluir passa direto: é cadastro duplicado ou erro de digitação', () => {
  assert.equal(decidirExclusao(contarHistoricoDoFuncionario('w1', {})), 'livre')
})

test('com pouco histórico, avisa e ainda deixa excluir', () => {
  const h = contarHistoricoDoFuncionario('w1', { shifts: [turno({ id: 's1' })] })
  assert.equal(decidirExclusao(h), 'avisar')
})

test('a partir do limite, excluir sai da tela — o estrago retroativo é grande demais', () => {
  const muitos = Array.from({ length: HISTORICO_QUE_BLOQUEIA_EXCLUSAO }, (_, i) => turno({ id: `s${i}` }))
  assert.equal(decidirExclusao(contarHistoricoDoFuncionario('w1', { shifts: muitos })), 'bloquear')
  // Um a menos ainda passa: o limite é ≥, não >.
  assert.equal(decidirExclusao(contarHistoricoDoFuncionario('w1', { shifts: muitos.slice(1) })), 'avisar')
})

test('o limite soma as quatro coleções, não uma só', () => {
  const n = HISTORICO_QUE_BLOQUEIA_EXCLUSAO
  const h = contarHistoricoDoFuncionario('w1', {
    shifts:    Array.from({ length: Math.ceil(n / 2) }, (_, i) => turno({ id: `s${i}` })),
    timecards: Array.from({ length: Math.ceil(n / 2) }, (_, i) => apont({ id: `t${i}` })),
  })
  assert.ok(h.total >= n)
  assert.equal(decidirExclusao(h), 'bloquear')
})
