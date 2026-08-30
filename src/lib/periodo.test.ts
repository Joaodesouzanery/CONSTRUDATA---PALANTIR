/**
 * As contas de período.
 *
 * ⚠️ Este arquivo NÃO tinha teste, e ele é o que decide o recorte de tempo de cinco telas. Os
 * casos aqui são os que erram em silêncio: semana virando o ano, fevereiro bissexto, o dia 31, e
 * a janela de 7 dias que na verdade cobre 8.
 *
 * A data do relato do cliente está aqui de propósito: ele abriu a tela em 30/08/2026 e viu a
 * semana de 29/06 a 05/07.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  deslocar, diasNoPeriodo, ehJanelaMovel, janelaDe, periodoDe, semanaDe, type Periodo,
} from './periodo'

// ─── Janelas móveis ───────────────────────────────────────────────────────────

test('⚠️ "7 dias" cobre SETE dias, incluindo hoje — não oito', () => {
  // `hoje − 7` daria 8 dias contando as duas pontas. É o erro clássico, e ele infla todo total.
  const p = janelaDe('ultimos7', 7, '2026-08-30')
  assert.equal(p.de, '2026-08-24')
  assert.equal(p.ate, '2026-08-30')
  assert.equal(diasNoPeriodo(p), 7)
})

test('"Hoje" é um dia só', () => {
  const p = janelaDe('hoje', 1, '2026-08-30')
  assert.equal(p.de, '2026-08-30')
  assert.equal(p.ate, '2026-08-30')
  assert.equal(diasNoPeriodo(p), 1)
  assert.match(p.rotulo, /30\/08/)
})

test('30 dias e 3 meses fecham a contagem', () => {
  assert.equal(diasNoPeriodo(janelaDe('ultimos30', 30, '2026-08-30')), 30)
  assert.equal(diasNoPeriodo(janelaDe('ultimos3meses', 90, '2026-08-30')), 90)
})

test('a janela atravessa o mês e o ano sem escorregar', () => {
  assert.equal(janelaDe('ultimos7', 7, '2026-03-03').de, '2026-02-25')
  assert.equal(janelaDe('ultimos7', 7, '2026-01-03').de, '2025-12-28')
  // 2028 é bissexto: 1º de março menos 7 dias passa pelo 29 de fevereiro.
  assert.equal(janelaDe('ultimos7', 7, '2028-03-01').de, '2028-02-24')
})

test('a janela anda pelo PRÓPRIO tamanho, sem buraco e sem sobreposição', () => {
  const atual = janelaDe('ultimos7', 7, '2026-08-30')
  const anterior = deslocar(atual, -1)
  assert.equal(anterior.ate, '2026-08-23')
  assert.equal(anterior.de, '2026-08-17')
  // A ponta de uma encosta na da outra: 23 e 24, sem pular nem repetir dia.
  assert.equal(diasNoPeriodo(anterior), 7)
  assert.equal(deslocar(anterior, 1).de, atual.de, 'ida e volta chega no mesmo lugar')
})

test('quem é janela móvel e quem é grade', () => {
  for (const t of ['hoje', 'ultimos7', 'ultimos30', 'ultimos3meses'] as const) {
    assert.equal(ehJanelaMovel(t), true, t)
  }
  for (const t of ['semana', 'quinzena', 'mes', 'trimestre', 'livre'] as const) {
    assert.equal(ehJanelaMovel(t), false, t)
  }
})

// ─── A grade ──────────────────────────────────────────────────────────────────

test('a semana é de segunda a domingo — e o DOMINGO recua 6 dias, não 0', () => {
  // É o erro que desloca a semana inteira uma vez a cada sete: `getDay()` devolve 0 no domingo.
  assert.deepEqual(
    [semanaDe('2026-08-30').de, semanaDe('2026-08-30').ate],
    ['2026-08-24', '2026-08-30'],
    '30/08/2026 é um domingo: pertence à semana que começou em 24',
  )
  assert.equal(semanaDe('2026-08-31').de, '2026-08-31', 'segunda começa a semana')
})

test('o mês anterior a 31/03 é março inteiro, não uma data deslocada', () => {
  // Somar dias faria fevereiro pular o 28 e o mês desalinhar.
  const marco = periodoDe('mes', '2026-03-31')
  const fevereiro = deslocar(marco, -1)
  assert.equal(fevereiro.de, '2026-02-01')
  assert.equal(fevereiro.ate, '2026-02-28')
  assert.equal(deslocar(periodoDe('mes', '2028-03-31'), -1).ate, '2028-02-29', 'bissexto')
})

test('o intervalo livre anda pelo próprio tamanho', () => {
  const livre: Periodo = { tipo: 'livre', de: '2026-08-01', ate: '2026-08-10', rotulo: 'Livre' }
  const anterior = deslocar(livre, -1)
  assert.equal(diasNoPeriodo(anterior), diasNoPeriodo(livre))
  // 01 a 10/08 são 10 dias; recuar 10 põe o fim em 31/07 e o início em 22/07.
  assert.equal(anterior.ate, '2026-07-31')
  assert.equal(anterior.de, '2026-07-22')
})

// ─── O caso do cliente ────────────────────────────────────────────────────────

test('⚠️ O RELATO: em 30/08 a tela mostrava a semana de 29/06 — o período tem de conter hoje', () => {
  // A regra que a barra aplica ao montar: período que não contém hoje volta para o ciclo corrente.
  const salvo = semanaDe('2026-06-29')
  const hoje = '2026-08-30'
  assert.ok(salvo.ate < hoje, 'o salvo terminou muito antes de hoje')

  const corrigido = periodoDe(salvo.tipo, hoje)
  assert.ok(corrigido.de <= hoje && corrigido.ate >= hoje, 'o corrigido contém hoje')
  assert.equal(corrigido.de, '2026-08-24')
})

test('período que CONTÉM hoje não é mexido', () => {
  const hoje = '2026-08-30'
  const atual = periodoDe('semana', hoje)
  assert.ok(atual.de <= hoje && atual.ate >= hoje)
})

test('período FUTURO também não contém hoje, e também precisa voltar', () => {
  // Menos comum que o vencido, mas acontece quando alguém navega para a frente e sai da tela.
  const futuro = semanaDe('2026-12-25')
  const hoje = '2026-08-30'
  assert.ok(futuro.de > hoje, 'começa depois de hoje')
  assert.ok(!(futuro.de <= hoje && futuro.ate >= hoje), 'não contém hoje')
})

test('periodoDe monta qualquer tipo sem estourar', () => {
  for (const t of ['hoje', 'ultimos7', 'ultimos30', 'ultimos3meses', 'semana', 'quinzena', 'mes', 'trimestre', 'livre'] as const) {
    const p = periodoDe(t, '2026-08-30')
    assert.equal(p.tipo, t)
    assert.ok(p.de <= p.ate, `${t}: ${p.de} > ${p.ate}`)
    assert.ok(p.rotulo.length > 0, `${t} sem rótulo`)
  }
})
