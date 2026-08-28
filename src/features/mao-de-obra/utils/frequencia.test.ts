/**
 * Frequência, absenteísmo e efetivo — as contas do quadro de Gestão à Vista.
 *
 * O invariante que mais importa é o primeiro: **a soma das situações é sempre o efetivo inteiro**.
 * Contar alguém duas vezes, ou nenhuma, faz o percentual mentir sem dar nenhum sinal na tela.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  situacaoNoDia, efetivoPorCargo, frequenciaNoPeriodo, serieMensal, ultimoDiaDoMes, ultimosMeses,
} from './frequencia'
import type { Worker, WorkerAbsence, Shift, WorkWeekMode } from '@/types'

const JORNADA: WorkWeekMode = 'mon_fri'
const SEM_FERIADO = new Set<string>()
const QUINTA = '2026-08-20'

const w = (p: Partial<Worker> = {}): Worker => ({
  id: 'w1', name: 'João', role: 'Pintor', cpfMasked: '***', crewId: 'c1', status: 'active',
  certifications: [], hourlyRate: 20, ...p,
} as Worker)

const falta = (p: Partial<WorkerAbsence>): WorkerAbsence => ({
  id: Math.random().toString(36).slice(2), workerId: 'w1', date: QUINTA,
  type: 'unjustified', status: 'open', registeredAt: '', ...p,
} as WorkerAbsence)

const turno = (p: Partial<Shift> = {}): Shift => ({
  id: Math.random().toString(36).slice(2), workerId: 'w1', date: QUINTA,
  startTime: '07:00', endTime: '16:00', breakMinutes: 60, type: 'regular', status: 'completed', ...p,
} as unknown as Shift)

// ── O invariante ──────────────────────────────────────────────────────────────

test('⚠️ a soma das situações é SEMPRE o efetivo inteiro — ninguém conta duas vezes nem some', () => {
  const workers = [w({ id: 'a' }), w({ id: 'b' }), w({ id: 'c' }), w({ id: 'd' }), w({ id: 'e' })]
  const r = situacaoNoDia({
    workers,
    absences: [falta({ workerId: 'b', type: 'sick_leave' }), falta({ workerId: 'c', type: 'vacation' })],
    // 'd' tem turno E falta: a falta vence — se ambos contassem, a soma passaria de 5.
    shifts: [turno({ workerId: 'a' }), turno({ workerId: 'd' }), turno({ workerId: 'e', type: 'day_off' })],
    data: QUINTA,
  })
  assert.equal(r.total, 5)
  assert.equal(r.contagem.reduce((s, c) => s + c.pessoas, 0), 5, 'a soma tem de fechar com o efetivo')
})

test('cada tipo de ausência cai no seu balde, e o que o modelo não tem cai em "outros"', () => {
  const por = (tipo: WorkerAbsence['type']) => situacaoNoDia({
    workers: [w()], absences: [falta({ type: tipo })], shifts: [], data: QUINTA,
  }).contagem.find((c) => c.pessoas === 1)?.situacao

  assert.equal(por('unjustified'), 'falta')
  assert.equal(por('sick_leave'), 'atestado')
  assert.equal(por('vacation'), 'ferias')
  // "Externo", "INSS" e "Bndes" do quadro da construtora não existem no modelo — caem aqui.
  assert.equal(por('justified'), 'outros')
  assert.equal(por('accident'), 'outros')
  assert.equal(por('other'), 'outros')
})

test('sem falta e sem turno NÃO é presença — é dia não registrado', () => {
  // Presumir presença por ausência de dado inflaria a frequência exatamente onde ela é desconhecida.
  const r = situacaoNoDia({ workers: [w()], absences: [], shifts: [], data: QUINTA })
  assert.equal(r.contagem.find((c) => c.situacao === 'presente')?.pessoas, 0)
  assert.equal(r.contagem.find((c) => c.situacao === 'outros')?.pessoas, 1)
})

test('desligado e suspenso não têm situação — saem do efetivo do dia', () => {
  for (const status of ['inactive', 'suspended', 'pending_approval'] as const) {
    const r = situacaoNoDia({ workers: [w({ status })], absences: [], shifts: [turno()], data: QUINTA })
    assert.equal(r.total, 0, `${status} entrou no efetivo`)
  }
})

// ── Efetivo por cargo ─────────────────────────────────────────────────────────

test('agrupa por cargo e separa administrativo de produção pelo departamento', () => {
  const { linhas, total } = efetivoPorCargo([
    w({ id: '1', role: 'Pintor' }),
    w({ id: '2', role: 'Pintor' }),
    w({ id: '3', role: 'Assistente de RH', department: 'Administrativo' }),
  ])
  assert.deepEqual(linhas.map((l) => l.cargo), ['Assistente de RH', 'Pintor'])
  assert.equal(linhas.find((l) => l.cargo === 'Pintor')?.producao, 2)
  assert.equal(linhas.find((l) => l.cargo === 'Assistente de RH')?.administrativo, 1)
  assert.equal(total.total, 3)
})

test('departamento em branco conta como produção — é a resposta certa numa construtora', () => {
  const { total } = efetivoPorCargo([w({ department: undefined }), w({ id: '2', department: '' })])
  assert.equal(total.producao, 2)
  assert.equal(total.administrativo, 0)
})

// ── Frequência ────────────────────────────────────────────────────────────────

test('o denominador é DIAS ÚTEIS, não dias de calendário', () => {
  // 01/08/2026 é sábado; a semana toda tem 7 dias e 5 úteis com jornada mon_fri.
  const f = frequenciaNoPeriodo({
    workers: [w()], absences: [], shifts: [], de: '2026-08-03', ate: '2026-08-09',
    feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(f.diasUteis, 5, 'sábado e domingo fora')
  assert.equal(f.possiveis, 5)
})

test('feriado sai do denominador', () => {
  const f = frequenciaNoPeriodo({
    workers: [w()], absences: [], shifts: [], de: '2026-08-03', ate: '2026-08-07',
    feriados: new Set(['2026-08-05']), jornada: JORNADA,
  })
  assert.equal(f.diasUteis, 4)
})

test('jornada mon_sat inclui o sábado', () => {
  const f = frequenciaNoPeriodo({
    workers: [w()], absences: [], shifts: [], de: '2026-08-03', ate: '2026-08-09',
    feriados: SEM_FERIADO, jornada: 'mon_sat',
  })
  assert.equal(f.diasUteis, 6)
})

test('presença em todos os dias úteis dá 100%, e o absenteísmo é o complemento', () => {
  const dias = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']
  const f = frequenciaNoPeriodo({
    workers: [w()], absences: [], shifts: dias.map((d) => turno({ date: d })),
    de: '2026-08-03', ate: '2026-08-07', feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(f.frequenciaPct, 100)
  assert.equal(f.absenteismoPct, 0)
})

test('período sem dia útil devolve null, não 0% — ausência de dado não é ausência de gente', () => {
  const f = frequenciaNoPeriodo({
    workers: [w()], absences: [], shifts: [], de: '2026-08-08', ate: '2026-08-09',  // sáb + dom
    feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(f.diasUteis, 0)
  assert.equal(f.frequenciaPct, null)
  assert.equal(f.absenteismoPct, null)
})

test('sem ninguém na folha, a frequência é null e não 0%', () => {
  const f = frequenciaNoPeriodo({
    workers: [], absences: [], shifts: [], de: '2026-08-03', ate: '2026-08-07',
    feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(f.frequenciaPct, null)
})

// ── Série mensal ──────────────────────────────────────────────────────────────

test('faltas por funcionário é faltas ÷ ativos, e null sem ninguém', () => {
  const s = serieMensal({
    workers: [w({ id: 'a' }), w({ id: 'b' })],
    absences: [falta({ date: '2026-08-03' }), falta({ date: '2026-08-04' }), falta({ date: '2026-08-05' })],
    shifts: [], meses: ['2026-08'], feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(s[0].faltas, 3)
  assert.equal(s[0].ativos, 2)
  assert.equal(s[0].faltasPorFuncionario, 1.5)

  const vazio = serieMensal({ workers: [], absences: [], shifts: [], meses: ['2026-08'], feriados: SEM_FERIADO, jornada: JORNADA })
  assert.equal(vazio[0].faltasPorFuncionario, null)
})

test('falta de outro mês não entra no ponto do mês', () => {
  const s = serieMensal({
    workers: [w()], absences: [falta({ date: '2026-07-15' })], shifts: [],
    meses: ['2026-08'], feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(s[0].faltas, 0)
})

// ── Datas ─────────────────────────────────────────────────────────────────────

test('o último dia do mês é o de verdade, inclusive em fevereiro bissexto', () => {
  assert.equal(ultimoDiaDoMes('2026-02'), '2026-02-28')
  assert.equal(ultimoDiaDoMes('2028-02'), '2028-02-29')
  assert.equal(ultimoDiaDoMes('2026-04'), '2026-04-30')
  assert.equal(ultimoDiaDoMes('2026-12'), '2026-12-31')
})

test('a série de meses atravessa a virada do ano sem pular nem repetir', () => {
  assert.deepEqual(ultimosMeses('2027-02', 4), ['2026-11', '2026-12', '2027-01', '2027-02'])
  assert.deepEqual(ultimosMeses('2026-08', 1), ['2026-08'])
})
