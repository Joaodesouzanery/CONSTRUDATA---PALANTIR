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

/**
 * ⚠️ SEM `as unknown as Shift`, de propósito.
 *
 * A versão anterior deste helper usava `status: 'completed'` — valor que NÃO existe em
 * `ShiftStatus` — e o cast desligava o type-checker exatamente no campo que escondia o defeito.
 * Com o tipo real, um status inventado não compila.
 */
const turno = (p: Partial<Shift> = {}): Shift => ({
  id: Math.random().toString(36).slice(2), workerId: 'w1', date: QUINTA,
  startTime: '07:00', endTime: '16:00', breakMinutes: 60, type: 'regular', status: 'confirmed', ...p,
})

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
    absences: [
      falta({ workerId: 'a', date: '2026-08-03' }),
      falta({ workerId: 'a', date: '2026-08-04' }),
      falta({ workerId: 'b', date: '2026-08-05' }),
    ],
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

// ── Presença por apontamento: o caso da empresa que opera por RDO ─────────────

const apont = (p: Partial<import('@/types').TimecardEntry> = {}) => ({
  id: Math.random().toString(36).slice(2), workerId: 'w1', date: QUINTA,
  hoursWorked: 8, projectRef: '', phaseRef: '', activityDescription: '', ...p,
} as import('@/types').TimecardEntry)

test('⚠️ apontamento conta como presença — sem isso, quem opera por RDO teria 0% de frequência', () => {
  // A ponte RDO→Mão de Obra grava APONTAMENTO, não turno. Numa empresa que não usa a Escala,
  // olhar só para turnos jogaria a equipe inteira em "Outros" e mostraria absenteísmo de 100%.
  const r = situacaoNoDia({ workers: [w()], absences: [], shifts: [], timecards: [apont()], data: QUINTA })
  assert.equal(r.contagem.find((c) => c.situacao === 'presente')?.pessoas, 1)
  assert.equal(r.contagem.find((c) => c.situacao === 'outros')?.pessoas, 0)
})

test('apontamento com zero hora não é presença', () => {
  const r = situacaoNoDia({ workers: [w()], absences: [], shifts: [], timecards: [apont({ hoursWorked: 0 })], data: QUINTA })
  assert.equal(r.contagem.find((c) => c.situacao === 'presente')?.pessoas, 0)
})

test('falta lançada vence o apontamento — a ausência é o registro mais específico', () => {
  const r = situacaoNoDia({
    workers: [w()], absences: [falta({ type: 'sick_leave' })], shifts: [], timecards: [apont()], data: QUINTA,
  })
  assert.equal(r.contagem.find((c) => c.situacao === 'atestado')?.pessoas, 1)
  assert.equal(r.contagem.find((c) => c.situacao === 'presente')?.pessoas, 0)
})

test('folga marcada vence o apontamento', () => {
  const r = situacaoNoDia({
    workers: [w()], absences: [], shifts: [turno({ type: 'day_off' })], timecards: [apont()], data: QUINTA,
  })
  assert.equal(r.contagem.find((c) => c.situacao === 'folga')?.pessoas, 1)
})

test('turno e apontamento no mesmo dia contam UMA presença, não duas', () => {
  const r = situacaoNoDia({ workers: [w()], absences: [], shifts: [turno()], timecards: [apont()], data: QUINTA })
  assert.equal(r.total, 1)
  assert.equal(r.contagem.reduce((s, c) => s + c.pessoas, 0), 1)
})

test('a frequência do período sobe com apontamento, como sobe com turno', () => {
  const dias = ['2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07']
  const f = frequenciaNoPeriodo({
    workers: [w()], absences: [], shifts: [], timecards: dias.map((d) => apont({ date: d })),
    de: '2026-08-03', ate: '2026-08-07', feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(f.frequenciaPct, 100)
})


// ── O denominador: a população certa, no período certo ───────────────────────

test('⚠️ falta de quem NÃO está no efetivo não entra na conta', () => {
  // Contar a falta de um desligado e dividir só pelos ativos inflava faltas/funcionário sem que
  // nenhum ativo tivesse faltado.
  const s = serieMensal({
    workers: [w({ id: 'a' })],
    absences: [falta({ workerId: 'a' }), falta({ workerId: 'fantasma', date: '2026-08-04' })],
    shifts: [], meses: ['2026-08'], feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(s[0].faltas, 1, 'a falta do fantasma entrou na conta')
})

test('⚠️ quem foi admitido DEPOIS não infla o denominador de um mês passado', () => {
  // Dez admitidos em agosto não podiam ter trabalhado em março — contá-los no denominador de
  // março derrubava a frequência daquele mês sem que nada tivesse acontecido.
  const antigos = [w({ id: 'a', admissionDate: '2025-01-01' })]
  const novos = Array.from({ length: 9 }, (_, i) => w({ id: `n${i}`, admissionDate: '2026-08-01' }))
  const marco = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06']

  const f = frequenciaNoPeriodo({
    workers: [...antigos, ...novos],
    absences: [], shifts: [], timecards: marco.map((d) => apont({ workerId: 'a', date: d })),
    de: '2026-03-02', ate: '2026-03-06', feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(f.frequenciaPct, 100, `${f.frequenciaPct}% — os admitidos em agosto entraram em março`)
})

test('quem foi desligado no meio do mês continua no denominador daquele mês', () => {
  // Ele trabalhou parte dele; sumir do denominador inflaria a frequência dos que ficaram.
  const f = frequenciaNoPeriodo({
    workers: [w({ id: 'a', status: 'inactive', desligamentoData: '2026-03-20' })],
    absences: [], shifts: [], timecards: [],
    de: '2026-03-02', ate: '2026-03-06', feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(f.possiveis, 5, 'o desligado depois do período saiu do denominador')
})

test('quem foi desligado ANTES do período não entra nele', () => {
  const f = frequenciaNoPeriodo({
    workers: [w({ id: 'a', status: 'inactive', desligamentoData: '2026-01-15' })],
    absences: [], shifts: [], timecards: [],
    de: '2026-03-02', ate: '2026-03-06', feriados: SEM_FERIADO, jornada: JORNADA,
  })
  assert.equal(f.possiveis, 0)
  assert.equal(f.frequenciaPct, null)
})

// ── O status do turno ─────────────────────────────────────────────────────────

test('⚠️ turno marcado como Ausente ou Cancelado NÃO é presença', () => {
  // A Escala oferece os dois no seletor e pinta "Ausente" de vermelho como Falta. A folha, o custo
  // mensal, a cobertura de postos e o motor CLT já descontam esse dia — a frequência era a única
  // que ainda o pagava, e o quadro da parede mostrava 0% de absenteísmo no mesmo dia em que o
  // holerite descontava.
  const r = situacaoNoDia({
    workers: [w({ id: 'a' }), w({ id: 'b' }), w({ id: 'c' })],
    absences: [],
    shifts: [
      turno({ workerId: 'a', status: 'confirmed' }),
      turno({ workerId: 'b', status: 'absent' }),
      turno({ workerId: 'c', status: 'cancelled' }),
    ],
    data: QUINTA,
  })
  assert.equal(r.contagem.find((c) => c.situacao === 'presente')?.pessoas, 1)
  assert.equal(r.contagem.find((c) => c.situacao === 'falta')?.pessoas, 1, 'ausente é falta')
  assert.equal(r.contagem.find((c) => c.situacao === 'outros')?.pessoas, 1, 'cancelado não é culpa de ninguém')
  assert.equal(r.contagem.reduce((s, c) => s + c.pessoas, 0), 3, 'o invariante continua fechando')
})

test('⚠️ turno apenas PLANEJADO não conta como presença', () => {
  // `autoGenerateSchedule` gera o mês inteiro como 'scheduled'. Contá-lo faria a frequência de
  // agosto nascer em 100% no dia 1º, antes de ninguém trabalhar.
  const r = situacaoNoDia({
    workers: [w()], absences: [], shifts: [turno({ status: 'scheduled' })], data: QUINTA,
  })
  assert.equal(r.contagem.find((c) => c.situacao === 'presente')?.pessoas, 0)
  assert.equal(r.contagem.find((c) => c.situacao === 'outros')?.pessoas, 1)
})

test('turno ausente vence o apontamento — o declarado é mais forte que o inferido', () => {
  const r = situacaoNoDia({
    workers: [w()], absences: [], shifts: [turno({ status: 'absent' })], timecards: [apont()], data: QUINTA,
  })
  assert.equal(r.contagem.find((c) => c.situacao === 'falta')?.pessoas, 1)
  assert.equal(r.contagem.find((c) => c.situacao === 'presente')?.pessoas, 0)
})
