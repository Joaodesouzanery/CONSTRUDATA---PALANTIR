/**
 * A jornada derivada — e os dois falsos positivos que ela cria no motor CLT.
 *
 * ⚠️ Os dois testes 🔴 mais importantes deste arquivo verificam violações que NÃO devem existir.
 * Alimentar `runAllCLTChecks` com jornadas derivadas de batida acusa, sem tratamento, quatro ou
 * cinco violações BLOQUEANTES por pessoa por mês — todas falsas. Um módulo de ponto que grita
 * "sem DSR" para quem folgou todo domingo é pior que nenhum: ensina o gestor a ignorar o alerta.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  jornadasDoPeriodo, jornadaParaShift, folgasSinteticas, conferirJornadasCLT,
  minutosAlemDoPrevisto, TEXTO_DA_PENDENCIA,
} from './jornada'
import { runAllCLTChecks } from '@/features/mao-de-obra/utils/cltEngine'
import type { CLTSettings, RegistroDePonto, Shift, TipoDeBatida, Worker } from '@/types'

// ─── Montagem ─────────────────────────────────────────────────────────────────

/** Uma batida num instante LOCAL, escrito como a pessoa leria no relógio. */
function b(local: string, tipo: TipoDeBatida, data?: string, over: Partial<RegistroDePonto> = {}): RegistroDePonto {
  const dia = local.slice(0, 10)
  return {
    id: `b-${local}-${tipo}`,
    workerId: 'w1',
    authUserId: 'conta-1',
    siteId: 'obra-1',
    tipo,
    data: data ?? dia,
    momentoDispositivo: new Date(local).toISOString(),
    origem: 'app',
    createdAt: new Date(local).toISOString(),
    ...over,
  }
}

const SETTINGS: CLTSettings = {
  maxDailyHours: 8, maxOvertimeHours: 2, maxWeeklyHours: 44, minRestMinutes: 660,
  nightStart: 22, nightEnd: 5, nightDifferential: 20, overtimeRate: 50,
}

const TRABALHADOR: Worker = {
  id: 'w1', name: 'João da Silva', role: 'Pintor', cpfMasked: '***.***.**-**',
  crewId: '', status: 'active', hourlyRate: 12, certifications: [],
}

/** Jornada normal: 8h trabalhadas (5h + 3h) com 1h de intervalo. 07:00 → 16:00. */
function diaNormal(dia: string): RegistroDePonto[] {
  return [
    b(`${dia}T07:00:00`, 'entrada'),
    b(`${dia}T12:00:00`, 'inicio_intervalo'),
    b(`${dia}T13:00:00`, 'fim_intervalo'),
    b(`${dia}T16:00:00`, 'saida'),
  ]
}

// ─── Derivação ────────────────────────────────────────────────────────────────

test('🔴 quatro batidas viram uma jornada com o intervalo certo', () => {
  const [j] = jornadasDoPeriodo(diaNormal('2026-09-14'), '2026-09-01', '2026-09-30')
  assert.equal(j.data, '2026-09-14')
  assert.equal(j.intervaloMin, 60)
  assert.equal(j.minutosTrabalhados, 8 * 60, '9h de relógio (07→16) menos 1h de intervalo')
  assert.deepEqual(j.pendencias, [])
})

test('🔴 turno que vira o dia é UMA jornada, do dia em que começou', () => {
  // Entra 22h de segunda, sai 6h de terça. Pelo dia civil seriam duas metades.
  const batidas = [
    b('2026-09-14T22:00:00', 'entrada', '2026-09-14'),
    b('2026-09-15T02:00:00', 'inicio_intervalo', '2026-09-14'),
    b('2026-09-15T03:00:00', 'fim_intervalo', '2026-09-14'),
    b('2026-09-15T06:00:00', 'saida', '2026-09-14'),
  ]
  const jornadas = jornadasDoPeriodo(batidas, '2026-09-01', '2026-09-30')
  assert.equal(jornadas.length, 1, 'uma jornada, não duas')
  assert.equal(jornadas[0].data, '2026-09-14', 'pertence à segunda, não à terça')
  assert.equal(jornadas[0].minutosTrabalhados, 7 * 60)
})

test('🔴 batida ímpar vira PENDÊNCIA, não hora fantasma', () => {
  const [j] = jornadasDoPeriodo([b('2026-09-14T07:00:00', 'entrada')], '2026-09-01', '2026-09-30')
  assert.ok(j.pendencias.includes('sem-saida'))
  assert.equal(j.minutosTrabalhados, 0, 'sem saída não existe hora trabalhada — nem uma')
  assert.equal(j.saida, undefined)
  assert.equal(jornadaParaShift(j), null, 'jornada aberta não vira turno: não há endTime real')
})

test('saiu para o intervalo e não voltou: conta só o primeiro período', () => {
  const [j] = jornadasDoPeriodo([
    b('2026-09-14T07:00:00', 'entrada'),
    b('2026-09-14T12:00:00', 'inicio_intervalo'),
    b('2026-09-14T13:00:00', 'fim_intervalo'),
  ], '2026-09-01', '2026-09-30')
  assert.ok(j.pendencias.includes('intervalo-incompleto'))
  assert.equal(j.minutosTrabalhados, 5 * 60, 'as 5h antes do almoço; o resto não foi fechado')
})

test('a hora extra chamada à noite entra na mesma jornada', () => {
  // Saiu 17h, foi chamado de volta 19h (2h de folga, menos que o corte de 6h).
  const [j] = jornadasDoPeriodo([
    ...diaNormal('2026-09-14'),
    b('2026-09-14T19:00:00', 'entrada'),
    b('2026-09-14T22:00:00', 'saida'),
  ], '2026-09-01', '2026-09-30')
  assert.equal(j.batidas.length, 6)
  assert.equal(j.minutosTrabalhados, 8 * 60 + 3 * 60, '8h do expediente + 3h de retorno')
  assert.equal(j.intervaloMin, 60 + 180, 'almoço + as 3h em casa entre a saída e o retorno')
})

test('dois dias seguidos são duas jornadas — 14h de folga não colam', () => {
  const jornadas = jornadasDoPeriodo(
    [...diaNormal('2026-09-14'), ...diaNormal('2026-09-15')], '2026-09-01', '2026-09-30')
  assert.equal(jornadas.length, 2)
  assert.deepEqual(jornadas.map((j) => j.data), ['2026-09-14', '2026-09-15'])
})

test('o período recorta pelo dia em que a jornada COMEÇOU', () => {
  const batidas = [...diaNormal('2026-08-31'), ...diaNormal('2026-09-01')]
  const setembro = jornadasDoPeriodo(batidas, '2026-09-01', '2026-09-30')
  assert.equal(setembro.length, 1)
  assert.equal(setembro[0].data, '2026-09-01')
})

test('o id da jornada é estável — React e as violações dependem disso', () => {
  const [a] = jornadasDoPeriodo(diaNormal('2026-09-14'), '2026-09-01', '2026-09-30')
  const [c] = jornadasDoPeriodo(diaNormal('2026-09-14'), '2026-09-01', '2026-09-30')
  assert.equal(a.id, c.id)
  assert.equal(jornadaParaShift(a)!.id, jornadaParaShift(c)!.id)
  assert.match(jornadaParaShift(a)!.id, /^ponto\|w1\|2026-09-14$/)
})

test('o Shift derivado nasce confirmado — a batida é a evidência mais forte que existe', () => {
  const [j] = jornadasDoPeriodo(diaNormal('2026-09-14'), '2026-09-01', '2026-09-30')
  const s = jornadaParaShift(j)!
  assert.equal(s.status, 'confirmed')
  assert.equal(s.startTime, '07:00')
  assert.equal(s.endTime, '16:00')
  assert.equal(s.breakMinutes, 60)
})

// ─── As pendências que o gestor precisa ver ───────────────────────────────────

test('🔴 duas batidas numa jornada longa: intervalo não MARCADO', () => {
  const [j] = jornadasDoPeriodo([
    b('2026-09-14T07:00:00', 'entrada'),
    b('2026-09-14T17:00:00', 'saida'),
  ], '2026-09-01', '2026-09-30')
  assert.ok(j.pendencias.includes('sem-marcacao-de-intervalo'))
  assert.equal(j.intervaloMin, 0)
})

test('jornada curta com duas batidas NÃO vira pendência de intervalo', () => {
  // 3h não exigem intervalo nenhum (art. 71 começa em 4h).
  const [j] = jornadasDoPeriodo([
    b('2026-09-14T07:00:00', 'entrada'),
    b('2026-09-14T10:00:00', 'saida'),
  ], '2026-09-01', '2026-09-30')
  assert.deepEqual(j.pendencias, [])
})

test('batida fora da cerca marca a jornada para conferência', () => {
  const [j] = jornadasDoPeriodo([
    b('2026-09-14T07:00:00', 'entrada', undefined, { dentroDaCerca: false, distanciaM: 8200 }),
    b('2026-09-14T12:00:00', 'inicio_intervalo'),
    b('2026-09-14T13:00:00', 'fim_intervalo'),
    b('2026-09-14T17:00:00', 'saida'),
  ], '2026-09-01', '2026-09-30')
  assert.ok(j.pendencias.includes('batida-a-conferir'))
})

test('🔴 relógio ADIANTADO é suspeito; atrasado é só batida offline', () => {
  const adiantado = jornadasDoPeriodo([
    b('2026-09-14T07:00:00', 'entrada', undefined, { divergenciaRelogioS: -3600 }),
    b('2026-09-14T17:00:00', 'saida'),
  ], '2026-09-01', '2026-09-30')[0]
  assert.ok(adiantado.pendencias.includes('relogio-divergente'))

  // Positivo = o aparelho estava atrasado porque a batida ficou na fila. É o normal do offline.
  const atrasado = jornadasDoPeriodo([
    b('2026-09-15T07:00:00', 'entrada', undefined, { divergenciaRelogioS: 7200 }),
    b('2026-09-15T17:00:00', 'saida'),
  ], '2026-09-01', '2026-09-30')[0]
  assert.ok(!atrasado.pendencias.includes('relogio-divergente'))
})

test('toda pendência tem texto em português', () => {
  for (const [chave, texto] of Object.entries(TEXTO_DA_PENDENCIA)) {
    assert.ok(texto.length > 0, `${chave} sem texto`)
  }
})

// ─── 🔴 Os falsos positivos do motor CLT ──────────────────────────────────────

/** Um mês de trabalho honesto: seg–sex, 8h com 1h de intervalo, folga sábado e domingo. */
function mesHonesto(): RegistroDePonto[] {
  const dias = [
    '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', // seg–sex
    '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12',
    '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19',
    '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26',
  ]
  return dias.flatMap(diaNormal)
}

test('🔴 um mês inteiro de jornada derivada NÃO produz violação de DSR', () => {
  const jornadas = jornadasDoPeriodo(mesHonesto(), '2026-09-01', '2026-09-30')
  assert.equal(jornadas.length, 20)

  const violacoes = conferirJornadasCLT([TRABALHADOR], jornadas, SETTINGS,
    { de: '2026-09-01', ate: '2026-09-30' })

  const dsr = violacoes.filter((v) => v.type === 'missing_dsr')
  assert.equal(dsr.length, 0,
    'sem as folgas sintéticas seriam 4–5 violações BLOQUEANTES, todas falsas — a pessoa folgou '
    + 'todo sábado e domingo, e o sistema estaria acusando a empresa de não dar descanso')
})

test('🔴 sem as folgas sintéticas, o DSR falso APARECE — a prova de que o conserto é necessário', () => {
  // Mesmo mês, mas passando só os turnos derivados ao motor, sem o tratamento.
  const jornadas = jornadasDoPeriodo(mesHonesto(), '2026-09-01', '2026-09-30')
  // O motor CRU, sem as folgas sintéticas — é isso que o conferirJornadasCLT conserta.
  const cru = jornadas.map(jornadaParaShift).filter((s): s is Shift => s !== null)
  const semTratamento = runAllCLTChecks([TRABALHADOR], cru, SETTINGS)
  assert.ok(semTratamento.filter((v) => v.type === 'missing_dsr').length >= 4,
    'este teste existe para falhar no dia em que alguém "simplificar" o conferirJornadasCLT')
})

test('🔴 intervalo NÃO MARCADO não vira violação do art. 71', () => {
  // Uma jornada de 10h com duas batidas: o intervalo existiu, só não foi tocado no botão.
  const jornadas = jornadasDoPeriodo([
    b('2026-09-14T07:00:00', 'entrada'),
    b('2026-09-14T17:00:00', 'saida'),
  ], '2026-09-01', '2026-09-30')

  const violacoes = conferirJornadasCLT([TRABALHADOR], jornadas, SETTINGS,
    { de: '2026-09-14', ate: '2026-09-14' })

  assert.equal(violacoes.filter((v) => v.type === 'break_required').length, 0,
    'marcação faltando não é intervalo não concedido — acusar aqui é afirmar que a empresa negou '
    + 'o descanso quando o que houve foi o funcionário não tocar o botão')
  assert.ok(jornadas[0].pendencias.includes('sem-marcacao-de-intervalo'),
    'mas continua sendo pendência: o gestor precisa resolver')
})

test('🔴 intervalo MARCADO e curto demais VIRA violação do art. 71', () => {
  // 30 minutos de intervalo numa jornada de 9h. Aqui o sistema SABE, porque foi marcado.
  const jornadas = jornadasDoPeriodo([
    b('2026-09-14T07:00:00', 'entrada'),
    b('2026-09-14T12:00:00', 'inicio_intervalo'),
    b('2026-09-14T12:30:00', 'fim_intervalo'),
    b('2026-09-14T17:00:00', 'saida'),
  ], '2026-09-01', '2026-09-30')

  const violacoes = conferirJornadasCLT([TRABALHADOR], jornadas, SETTINGS,
    { de: '2026-09-14', ate: '2026-09-14' })

  const art71 = violacoes.filter((v) => v.type === 'break_required')
  assert.equal(art71.length, 1, 'o filtro não pode engolir a violação de verdade')
  assert.equal(art71[0].severity, 'blocking')
})

test('feriado vira folga de feriado, não de descanso', () => {
  const folgas = folgasSinteticas('w1', '2026-09-07', '2026-09-07', new Set(), new Set(['2026-09-07']))
  assert.equal(folgas.length, 1)
  assert.equal(folgas[0].type, 'holiday')
})

test('dia COM jornada não ganha folga sintética por cima', () => {
  const folgas = folgasSinteticas('w1', '2026-09-14', '2026-09-16', new Set(['2026-09-15']))
  assert.deepEqual(folgas.map((f) => f.date), ['2026-09-14', '2026-09-16'])
})

// ─── Tolerância do art. 58 §1º ────────────────────────────────────────────────

test('🔴 cinco minutos de variação não geram hora extra nem atraso', () => {
  const s = { toleranciaPontoMin: 10 }
  assert.equal(minutosAlemDoPrevisto(485, 480, s), 0, '5 min a mais: dentro da tolerância')
  assert.equal(minutosAlemDoPrevisto(472, 480, s), 0, '8 min a menos: dentro da tolerância')
})

test('🔴 passando da tolerância, conta o período INTEIRO — não só o excedente', () => {
  // Súmula 366 do TST: ultrapassado o limite, a totalidade é tempo de trabalho.
  const s = { toleranciaPontoMin: 10 }
  assert.equal(minutosAlemDoPrevisto(492, 480, s), 12, 'doze, não dois')
  assert.equal(minutosAlemDoPrevisto(465, 480, s), -15)
})

test('sem tolerância configurada, todo minuto conta', () => {
  assert.equal(minutosAlemDoPrevisto(481, 480, {}), 1)
})

