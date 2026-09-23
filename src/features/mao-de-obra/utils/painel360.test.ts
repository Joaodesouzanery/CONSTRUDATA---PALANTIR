/**
 * Os indicadores do Dashboard de Mão de Obra.
 *
 * ⚠️ O teste central é o primeiro: **nenhum indicador devolve 0 ou 100% quando o certo é "não
 * sei"**. É a regra que o `EvmHeader` documenta — `0` comunica "péssimo" e `100%` comunica "está
 * tudo em dia", e os dois são AFIRMAÇÕES. Era exatamente esse o defeito do cartão "Certificações
 * OK", que marcava 100% fixo desde sempre porque a função que o alimentava, chamada com `days = 0`,
 * devolve lista vazia por construção.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { montarIndicadoresDeMaoDeObra, certificacoesVencidas, type EntradaDoPainel } from './painel360'
import type { Worker, WorkerCertification } from '@/types'

const VAZIO: EntradaDoPainel = {
  workers: [], absences: [], shifts: [], timecards: [], assessments: [],
  horasExtras: [], workPosts: [], jornadas: [], jornadasDoAno: [], solicitacoes: [],
  cltSettings: { maxWeeklyHours: 44 } as EntradaDoPainel['cltSettings'],
  feriados: new Set(), jornadaSemanal: 'mon_fri',
  de: '2026-09-01', ate: '2026-09-30', hoje: '2026-09-23',
}

const trabalhador = (over: Partial<Worker> = {}): Worker => ({
  id: 'w-1', name: 'Fulano', role: 'Pintor', status: 'active',
  admissionDate: '2026-01-10', scheduleType: '5x2',
  ...over,
} as Worker)

const certificado = (type: string, expiryDate: string): WorkerCertification =>
  ({ id: `c-${type}`, type, issuedDate: '2025-01-01', expiryDate, status: 'valid' })

// ─── 🔴 A regra que o painel inteiro existe para não quebrar ──────────────────

test('🔴 com a base VAZIA, nenhum indicador afirma nada — e todo "—" diz o que falta', () => {
  const ind = montarIndicadoresDeMaoDeObra(VAZIO)
  assert.ok(ind.length >= 10, 'o painel precisa cobrir as abas do módulo')

  for (const i of ind) {
    if (i.tom !== 'sem-dado') continue
    assert.equal(i.valor, '—', `${i.id} está "sem-dado" mas mostra "${i.valor}"`)
    assert.ok(i.explicacao.oQueFalta,
      `${i.id} mostra "—" e não diz o que preencher — um card cinza mudo ensina a pessoa a ignorá-lo`)
  }

  // ⚠️ E nenhum indicador pode estar VERDE com base vazia: verde afirma "está tudo certo".
  const verdesSemBase = ind.filter((i) => i.tom === 'ok' && i.valor === '—')
  assert.deepEqual(verdesSemBase, [], 'valor desconhecido não é "ok"')
})

test('🔴 todo indicador tem explicação em português, e ela não traduz sigla', () => {
  for (const i of montarIndicadoresDeMaoDeObra(VAZIO)) {
    assert.ok(i.explicacao.oQueE.length > 20, `${i.id}: oQueE curto demais`)
    assert.ok(i.explicacao.deOndeVem.length > 15, `${i.id}: deOndeVem curto demais`)
    assert.ok(i.titulo.length > 3)
  }
})

// ─── 🔴 O cartão das certificações, que marcava 100% para sempre ──────────────

test('🔴 certificação vencida ONTEM conta — a função antiga só olhava para frente', () => {
  const w = trabalhador({ certifications: [certificado('NR-35', '2026-09-22'), certificado('NR-10', '2027-01-01')] })
  const vencidas = certificacoesVencidas([w], '2026-09-23')
  assert.equal(vencidas.length, 1, 'a NR-35 venceu ontem')
  assert.equal(vencidas[0].tipo, 'NR-35')
  assert.equal(vencidas[0].diasVencida, 1)
})

test('🔴 SEM nenhuma certificação cadastrada o cartão diz "não sei", nunca "tudo em dia"', () => {
  const ind = montarIndicadoresDeMaoDeObra({ ...VAZIO, workers: [trabalhador()] })
  const cert = ind.find((i) => i.id === 'certificacoes')!
  assert.equal(cert.valor, '—')
  assert.equal(cert.tom, 'sem-dado')
  assert.ok(cert.explicacao.oQueFalta?.includes('Nenhuma certificação'),
    'afirmar que está tudo em dia sem nenhum dado é a pior leitura possível — era o 100% fixo')
})

test('com certificação cadastrada e nenhuma vencida, aí sim é "ok"', () => {
  const w = trabalhador({ certifications: [certificado('NR-35', '2027-01-01')] })
  const cert = montarIndicadoresDeMaoDeObra({ ...VAZIO, workers: [w] }).find((i) => i.id === 'certificacoes')!
  assert.equal(cert.valor, '0')
  assert.equal(cert.tom, 'ok')
})

// ─── 🔴 Horas extras: a coleção certa ─────────────────────────────────────────

test('🔴 as horas extras vêm da COLEÇÃO `horasExtras`, não dos turnos de escala', () => {
  const comTurnoExtra = montarIndicadoresDeMaoDeObra({
    ...VAZIO,
    workers: [trabalhador()],
    // Um turno marcado como "overtime" na escala. O cartão ANTIGO somava isto.
    shifts: [{
      id: 's-1', workerId: 'w-1', date: '2026-09-10', startTime: '18:00', endTime: '22:00',
      breakMinutes: 0, type: 'overtime', status: 'confirmed',
    }] as EntradaDoPainel['shifts'],
  }).find((i) => i.id === 'horas-extras')!
  assert.equal(comTurnoExtra.valor, '—',
    'turno de escala marcado como extra NÃO é hora extra lançada e valorada — são conceitos '
    + 'diferentes, e o cartão antigo confundia os dois')

  const comHE = montarIndicadoresDeMaoDeObra({
    ...VAZIO,
    workers: [trabalhador()],
    horasExtras: [
      { id: 'h-1', workerNome: 'Fulano', data: '2026-09-10', tipo: 'fim-de-semana', valor: 180, pago: false, origem: 'manual', createdAt: '' },
      { id: 'h-2', workerNome: 'Fulano', data: '2026-09-17', tipo: 'fim-de-semana', valor: 180, pago: true, origem: 'manual', createdAt: '' },
    ] as EntradaDoPainel['horasExtras'],
  }).find((i) => i.id === 'horas-extras')!
  assert.match(comHE.valor, /180,00/, 'só o que ainda não foi pago')
  assert.match(comHE.detalhe!, /2 lançamento\(s\) · 1 já pago\(s\)/)
})

// ─── 🔴 Frequência: a conta boa ───────────────────────────────────────────────

test('🔴 a frequência vem de `frequenciaNoPeriodo`, com dias úteis no denominador', () => {
  const ind = montarIndicadoresDeMaoDeObra({
    ...VAZIO, workers: [trabalhador()], de: '2026-09-01', ate: '2026-09-04',
  })
  const freq = ind.find((i) => i.id === 'frequencia')!
  // 1º a 4 de setembro de 2026: terça a sexta = 4 dias úteis, 1 pessoa, nenhuma presença.
  assert.match(freq.detalhe!, /0 de 4 possíveis · 4 dias úteis/,
    'o denominador é efetivo × dias úteis — a conta caseira antiga dividia faltas da semana pelo '
    + 'efetivo de um dia, misturando pessoas com pessoas-dia')
  assert.equal(freq.valor, '0,0%')
  assert.equal(freq.tom, 'grave')
})

test('período sem dia útil devolve "—", não 0%', () => {
  // 5 e 6 de setembro de 2026 caem num fim de semana.
  const freq = montarIndicadoresDeMaoDeObra({
    ...VAZIO, workers: [trabalhador()], de: '2026-09-05', ate: '2026-09-06',
  }).find((i) => i.id === 'frequencia')!
  assert.equal(freq.valor, '—')
  assert.equal(freq.tom, 'sem-dado')
  assert.ok(freq.explicacao.oQueFalta)
})

// ─── 🔴 O Ponto Eletrônico, que não tinha um pixel ────────────────────────────

test('🔴 o painel cobre o Ponto Eletrônico — a aba que não aparecia em lugar nenhum', () => {
  const ids = montarIndicadoresDeMaoDeObra(VAZIO).map((i) => i.id)
  for (const esperado of ['pedidos-de-ponto', 'jornadas-sem-saida', 'batidas-a-conferir', 'banco-de-horas', 'credito-a-vencer']) {
    assert.ok(ids.includes(esperado), `o painel precisa de "${esperado}"`)
  }
})

test('🔴 cada indicador leva para a aba que responde por ele', () => {
  const destinos = new Set(montarIndicadoresDeMaoDeObra(VAZIO).map((i) => i.destino).filter(Boolean))
  for (const aba of ['ponto', 'faltas', 'funcionarios', 'horas-extras', 'escala', 'seguranca', 'produtividade']) {
    assert.ok(destinos.has(aba), `nenhum cartão leva para "${aba}" — a aba fica invisível de novo`)
  }
})
