/**
 * Banco de horas — o previsto, o saldo e o prazo que ninguém lembra.
 *
 * ⚠️ O teste mais importante deste arquivo é o do 5x2: jornada diária de OITO horas num regime de
 * 44 semanais produz 4 horas de crédito falso por semana, por pessoa. Numa equipe de 30, é meio
 * mês de folha inventado por trimestre.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  previstoDoDia, saldoDoPeriodo, creditosAVencer,
  MESES_DE_COMPENSACAO_PADRAO, TEXTO_SEM_PREVISTO,
} from './bancoDeHoras'
import type { Jornada } from '@/features/ponto/jornada'
import type { CLTSettings, Worker } from '@/types'

const SETTINGS: Pick<CLTSettings, 'maxWeeklyHours' | 'toleranciaPontoMin'> = {
  maxWeeklyHours: 44,
  toleranciaPontoMin: 10,
}

const trabalhador = (over: Partial<Worker> = {}): Pick<Worker, 'id' | 'scheduleType' | 'admissionDate'> => ({
  id: 'w1', scheduleType: '5x2', admissionDate: '2026-01-05', ...over,
})

function jornada(data: string, minutos: number, workerId = 'w1'): Jornada {
  return {
    id: `${workerId}|${data}`, workerId, data, siteId: null,
    intervaloMin: 60, minutosTrabalhados: minutos, pendencias: [], batidas: [], nsrs: [],
  }
}

// 2026-09-14 é uma segunda-feira.
const SEG = '2026-09-14'
const SAB = '2026-09-19'
const DOM = '2026-09-20'

// ─── O previsto, por regime ───────────────────────────────────────────────────

test('🔴 5x2 de 44h dá 8h48 por dia, NÃO 8h', () => {
  const base = previstoDoDia(trabalhador({ scheduleType: '5x2' }), SEG, SETTINGS)
  assert.equal(base.tipo, 'trabalha')
  assert.equal(base.tipo === 'trabalha' && base.minutos, 528,
    '44h ÷ 5 dias = 8h48 = 528 min. Usar 480 inventaria 4h de crédito por semana, por pessoa')
})

test('🔴 5x2 não gera previsto no sábado nem no domingo', () => {
  assert.equal(previstoDoDia(trabalhador(), SAB, SETTINGS).tipo, 'folga')
  assert.equal(previstoDoDia(trabalhador(), DOM, SETTINGS).tipo, 'folga')
})

test('6x1 trabalha sábado e folga domingo, com o dia mais curto', () => {
  const w = trabalhador({ scheduleType: '6x1' })
  const sabado = previstoDoDia(w, SAB, SETTINGS)
  assert.equal(sabado.tipo, 'trabalha')
  assert.equal(sabado.tipo === 'trabalha' && sabado.minutos, 440, '44h ÷ 6 = 7h20')
  assert.equal(previstoDoDia(w, DOM, SETTINGS).tipo, 'folga')
})

test('🔴 12x36 alterna dia sim, dia não, ancorado na admissão', () => {
  const w = trabalhador({ scheduleType: '12x36', admissionDate: SEG })
  assert.equal(previstoDoDia(w, SEG, SETTINGS).tipo, 'trabalha', 'o dia da admissão é plantão')
  assert.equal(previstoDoDia(w, '2026-09-15', SETTINGS).tipo, 'folga')
  assert.equal(previstoDoDia(w, '2026-09-16', SETTINGS).tipo, 'trabalha')
  const plantao = previstoDoDia(w, '2026-09-16', SETTINGS)
  assert.equal(plantao.tipo === 'trabalha' && plantao.minutos, 720, '12 horas')
})

test('🔴 12x36 SEM data de admissão diz que não sabe — não chuta', () => {
  const w = trabalhador({ scheduleType: '12x36', admissionDate: undefined })
  const base = previstoDoDia(w, SEG, SETTINGS)
  assert.equal(base.tipo, 'indefinido')
  assert.equal(base.tipo === 'indefinido' && base.motivo, 'sem-ancora-12x36',
    'chutar a paridade erraria metade dos plantões — e o erro seria invisível')
})

test('diarista não tem banco de horas, e a razão fica registrada', () => {
  const base = previstoDoDia(trabalhador({ scheduleType: 'daily' }), SEG, SETTINGS)
  assert.equal(base.tipo, 'indefinido')
  assert.equal(base.tipo === 'indefinido' && base.motivo, 'diarista')
})

test('regime em branco ou personalizado também é indefinido', () => {
  for (const regime of [undefined, 'custom' as const]) {
    const base = previstoDoDia(trabalhador({ scheduleType: regime }), SEG, SETTINGS)
    assert.equal(base.tipo, 'indefinido')
  }
})

test('feriado não tem previsto, seja qual for o regime', () => {
  const feriados = new Set([SEG])
  assert.equal(previstoDoDia(trabalhador({ scheduleType: '6x1' }), SEG, SETTINGS, feriados).tipo, 'feriado')
})

test('todo motivo de "sem previsto" tem texto em português', () => {
  for (const texto of Object.values(TEXTO_SEM_PREVISTO)) assert.ok(texto.length > 0)
})

// ─── O saldo ──────────────────────────────────────────────────────────────────

test('🔴 a tolerância entra DIA A DIA, não no total', () => {
  // Cinco dias com 5 minutos a mais cada. Somado no fim daria 25 min de crédito; dia a dia, zero.
  const dias = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18']
  const jornadas = dias.map((d) => jornada(d, 528 + 5))
  const s = saldoDoPeriodo(trabalhador(), jornadas, '2026-09-14', '2026-09-18', SETTINGS)
  assert.equal(s.saldoMin, 0, 'ruído de marcação não é hora extra — art. 58 §1º')
})

test('passando da tolerância, o dia conta inteiro', () => {
  const s = saldoDoPeriodo(trabalhador(), [jornada(SEG, 528 + 60)], SEG, SEG, SETTINGS)
  assert.equal(s.saldoMin, 60)
  assert.equal(s.previstoMin, 528)
  assert.equal(s.trabalhadoMin, 588)
})

test('🔴 dia útil sem batida vira saldo NEGATIVO — é o que o banco existe para mostrar', () => {
  const s = saldoDoPeriodo(trabalhador(), [], SEG, SEG, SETTINGS)
  assert.equal(s.saldoMin, -528)
})

test('sábado trabalhado no 5x2 é crédito integral', () => {
  const s = saldoDoPeriodo(trabalhador(), [jornada(SAB, 240)], SAB, SAB, SETTINGS)
  assert.equal(s.previstoMin, 0, 'sábado não é dia de trabalho neste regime')
  assert.equal(s.saldoMin, 240)
})

test('🔴 dia indefinido fica FORA da conta e é contado à parte', () => {
  const w = trabalhador({ scheduleType: 'daily' })
  const s = saldoDoPeriodo(w, [jornada(SEG, 480)], SEG, '2026-09-16', SETTINGS)
  assert.equal(s.saldoMin, 0, 'sem previsto conhecido não existe saldo — zerar seria mentir')
  assert.equal(s.diasIndefinidos, 3)
  assert.equal(s.semBanco, 'diarista', 'a tela precisa poder DIZER por que não há banco')
})

test('a série por dia acompanha o total', () => {
  const s = saldoDoPeriodo(trabalhador(), [jornada(SEG, 600)], SEG, '2026-09-15', SETTINGS)
  assert.equal(s.dias.length, 2)
  assert.equal(s.dias[0].saldoMin, 600 - 528)
  assert.equal(s.dias[1].saldoMin, -528, 'terça sem batida')
  assert.equal(s.saldoMin, s.dias.reduce((acc, d) => acc + d.saldoMin, 0))
})

// ─── O prazo de compensação ───────────────────────────────────────────────────

test('🔴 crédito vence em seis meses, e o aviso vem ANTES', () => {
  assert.equal(MESES_DE_COMPENSACAO_PADRAO, 6, 'CLT art. 59 §5º — acordo individual')
  // Crédito de março; em setembro ele está no último mês de validade.
  const aVencer = creditosAVencer([{ competencia: '2026-03', saldoMin: 300 }], '2026-09-10')
  assert.equal(aVencer.length, 1)
  assert.equal(aVencer[0].venceEm, '2026-09-30', 'seis meses depois de março')
  assert.equal(aVencer[0].minutos, 300)
})

test('crédito novo não aparece no aviso', () => {
  const aVencer = creditosAVencer([{ competencia: '2026-08', saldoMin: 300 }], '2026-09-10')
  assert.equal(aVencer.length, 0, 'vence em fevereiro; avisar agora seria ruído')
})

test('🔴 mês negativo consome o crédito MAIS ANTIGO primeiro', () => {
  // Março gerou 300; abril consumiu 200. Sobram 100 de março, não 300.
  const aVencer = creditosAVencer([
    { competencia: '2026-03', saldoMin: 300 },
    { competencia: '2026-04', saldoMin: -200 },
  ], '2026-09-10')
  assert.equal(aVencer.length, 1)
  assert.equal(aVencer[0].minutos, 100)
})

test('crédito inteiramente compensado não aparece', () => {
  const aVencer = creditosAVencer([
    { competencia: '2026-03', saldoMin: 300 },
    { competencia: '2026-04', saldoMin: -400 },
  ], '2026-09-10')
  assert.equal(aVencer.length, 0)
})

test('o prazo é configurável — acordo coletivo permite doze meses', () => {
  const aVencer = creditosAVencer([{ competencia: '2026-03', saldoMin: 300 }], '2026-09-10', 12)
  assert.equal(aVencer.length, 0, 'com 12 meses, o de março vence só em março do ano seguinte')
})
