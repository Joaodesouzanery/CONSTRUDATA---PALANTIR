/**
 * A cerca virtual — e os casos em que ela NÃO pode decidir.
 *
 * ⚠️ A regra central: `dentro: false` só sai quando o sistema SABE que a pessoa está fora. Não
 * saber onde ela está é diferente de saber que está longe, e tratar os dois igual criaria buraco
 * no registro de jornada — que numa reclamação trabalhista pesa contra a empresa.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { distanciaM, avaliarCerca, motivoDoErroDeGeo, distanciaLegivel } from '@/lib/geo'

// Coordenadas reais das duas obras do cliente.
const BERTIOGA = { lat: -23.8531, lng: -46.1390 }
const SANTOS   = { lat: -23.9608, lng: -46.3336 }

test('a distância entre Bertioga e Santos bate com a realidade', () => {
  const m = distanciaM(BERTIOGA, SANTOS)
  // ~22 km em linha reta. Tolerância de 1 km cobre a escolha do ponto exato de cada cidade.
  assert.ok(m > 21_000 && m < 23_500, `esperava ~22 km, deu ${Math.round(m)} m`)
})

test('distância de um ponto para ele mesmo é zero', () => {
  assert.equal(distanciaM(BERTIOGA, BERTIOGA), 0)
})

test('🔴 a distância NÃO é arredondada — a de frota arredondava para 100 m', () => {
  // 0,001° de latitude ≈ 111 m. Com o arredondamento da versão antiga isso viraria 100 m.
  const m = distanciaM(BERTIOGA, { lat: BERTIOGA.lat + 0.001, lng: BERTIOGA.lng })
  assert.ok(m > 110 && m < 112, `esperava ~111 m cheios, deu ${m}`)
  assert.notEqual(m, Math.round(m / 100) * 100)
})

// ─── A cerca decide ───────────────────────────────────────────────────────────

test('dentro do raio: pode bater', () => {
  const r = avaliarCerca({ lat: BERTIOGA.lat + 0.002, lng: BERTIOGA.lng, precisaoM: 20 }, BERTIOGA, 5000)
  assert.equal(r.dentro, true)
  assert.ok(r.distanciaM! < 300)
  assert.equal(r.motivo, undefined)
})

test('fora do raio: NÃO pode — e a distância vai junto para a tela', () => {
  const r = avaliarCerca({ lat: SANTOS.lat, lng: SANTOS.lng, precisaoM: 20 }, BERTIOGA, 5000)
  assert.equal(r.dentro, false)
  assert.ok(r.distanciaM! > 20_000)
})

test('o raio é respeitado — 300 m recusa o que 5 km aceita', () => {
  const leitura = { lat: BERTIOGA.lat + 0.01, lng: BERTIOGA.lng, precisaoM: 10 }  // ~1,1 km
  assert.equal(avaliarCerca(leitura, BERTIOGA, 5000).dentro, true)
  assert.equal(avaliarCerca(leitura, BERTIOGA, 300).dentro, false)
})

// ─── 🔴 Os casos em que NÃO dá para decidir ───────────────────────────────────

test('🔴 obra sem coordenada: não avalia, não recusa', () => {
  const r = avaliarCerca({ lat: -23.9, lng: -46.3 }, null, 5000)
  assert.equal(r.dentro, null, 'null = "não sei"; false significaria "sei que está fora"')
  assert.equal(r.motivo, 'obra-sem-coordenada')
})

test('🔴 sem leitura de GPS: não avalia, não recusa', () => {
  const r = avaliarCerca(null, BERTIOGA, 5000)
  assert.equal(r.dentro, null)
  assert.equal(r.motivo, 'posicao-indisponivel')
})

test('🔴 precisão pior que o raio: não avalia — um fix de Wi-Fi erra quilômetros', () => {
  // Está a ~111 m da obra, mas o aparelho admite erro de 2 km. Numa cerca de 300 m isso não decide
  // nada — e aceitar seria deixar qualquer aparelho sem GPS "passar" na cerca.
  const r = avaliarCerca({ lat: BERTIOGA.lat + 0.001, lng: BERTIOGA.lng, precisaoM: 2000 }, BERTIOGA, 300)
  assert.equal(r.dentro, null)
  assert.equal(r.motivo, 'precisao-insuficiente')
  assert.ok(r.distanciaM !== null, 'a distância medida continua indo junto, para conferência')
})

test('a MESMA precisão é aceitável numa cerca grande', () => {
  // 2 km de erro numa cerca de 5 km ainda decide; numa de 300 m, não. Por isso a comparação é com
  // o raio, e não com um número fixo.
  const r = avaliarCerca({ lat: BERTIOGA.lat + 0.001, lng: BERTIOGA.lng, precisaoM: 2000 }, BERTIOGA, 5000)
  assert.equal(r.dentro, true)
})

test('precisão ausente não impede a avaliação', () => {
  assert.equal(avaliarCerca({ lat: BERTIOGA.lat, lng: BERTIOGA.lng }, BERTIOGA, 300).dentro, true)
})

// ─── Tradução do erro do navegador ────────────────────────────────────────────

test('o erro do navegador vira motivo — os três códigos do padrão W3C', () => {
  assert.equal(motivoDoErroDeGeo(1), 'permissao-negada')
  assert.equal(motivoDoErroDeGeo(2), 'posicao-indisponivel')
  assert.equal(motivoDoErroDeGeo(3), 'tempo-esgotado')
  assert.equal(motivoDoErroDeGeo(undefined), 'posicao-indisponivel')
})

test('a distância na tela troca de unidade no quilômetro', () => {
  assert.equal(distanciaLegivel(250), '250 m')
  assert.equal(distanciaLegivel(999), '999 m')
  assert.equal(distanciaLegivel(1000), '1 km')
  assert.equal(distanciaLegivel(7240), '7,2 km')
})
