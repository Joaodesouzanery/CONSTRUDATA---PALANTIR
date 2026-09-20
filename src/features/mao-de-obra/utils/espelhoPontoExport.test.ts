/**
 * O espelho de ponto — o que o papel PRECISA ter para valer alguma coisa.
 *
 * Testar HTML gerado costuma ser inútil (qualquer mudança de classe quebra o teste). Aqui não é:
 * o espelho é documento legal, e estes testes verificam o que a lei exige que esteja na folha —
 * NSR, pendências, assinatura — e a propriedade que torna o documento conferível: ser puro.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildEspelhoHtml, type EspelhoDoTrabalhador, type EspelhoReportData } from './espelhoPontoExport'
import { saldoDoPeriodo } from './bancoDeHoras'
import type { Jornada } from '@/features/ponto/jornada'
import type { RegistroDePonto } from '@/types'

function batida(iso: string, nsr: number): RegistroDePonto {
  return {
    id: `b-${nsr}`, workerId: 'w1', authUserId: 'c1', siteId: null, tipo: 'entrada',
    data: iso.slice(0, 10), momentoDispositivo: new Date(iso).toISOString(),
    nsr, origem: 'app', createdAt: new Date(iso).toISOString(),
  }
}

function jornada(over: Partial<Jornada> = {}): Jornada {
  return {
    id: 'w1|2026-09-14', workerId: 'w1', data: '2026-09-14', siteId: null,
    entrada: batida('2026-09-14T07:00:00', 41),
    saida: batida('2026-09-14T16:00:00', 44),
    intervaloMin: 60, minutosTrabalhados: 480, pendencias: [],
    batidas: [], nsrs: [41, 42, 43, 44], ...over,
  }
}

const TRABALHADOR: EspelhoDoTrabalhador = {
  workerId: 'w1', nome: 'João da Silva', matricula: 'MAT-0042', cargo: 'Pintor',
  regime: '5x2', admissao: '2026-01-05', jornadas: [jornada()],
}

function dados(over: Partial<EspelhoReportData> = {}): EspelhoReportData {
  return {
    empresa: 'WCR Saneamento',
    demo: false,
    hoje: '2026-10-01',
    recorte: ['Período: 14/09/2026 a 14/09/2026', '1 funcionário(s)'],
    de: '2026-09-14',
    ate: '2026-09-14',
    trabalhadores: [TRABALHADOR],
    secoes: { resumo: true, grade: true, banco: true, pendencias: true, assinaturas: true },
    ...over,
  }
}

// ─── A propriedade que torna o documento conferível ───────────────────────────

test('🔴 buildEspelhoHtml é PURO — mesma entrada, mesmo HTML', () => {
  const a = buildEspelhoHtml(dados())
  const b = buildEspelhoHtml(dados())
  assert.equal(a, b,
    'sem isso o documento não pode ser conferido: duas gerações do mesmo mês sairiam diferentes')
})

test('🔴 a data de emissão é INJETADA, não lida do relógio', () => {
  const html = buildEspelhoHtml(dados({ hoje: '2026-10-01' }))
  assert.match(html, /01\/10\/2026/)
  const outro = buildEspelhoHtml(dados({ hoje: '2026-11-20' }))
  assert.match(outro, /20\/11\/2026/)
})

// ─── O que a lei exige na folha ───────────────────────────────────────────────

test('🔴 o NSR de cada marcação vai impresso — é por ele que a batida é localizada', () => {
  const html = buildEspelhoHtml(dados())
  assert.match(html, /41 · 42 · 43 · 44/,
    'sem NSR o papel não prova nada numa fiscalização (Portaria 671)')
})

test('🔴 as pendências APARECEM — espelho que só mostra linha limpa é pior que nenhum', () => {
  const html = buildEspelhoHtml(dados({
    trabalhadores: [{ ...TRABALHADOR, jornadas: [jornada({ pendencias: ['sem-saida'], saida: undefined })] }],
  }))
  assert.match(html, /Sem saída registrada/)
  assert.match(html, /row-pendente/, 'a linha precisa ser visualmente distinta, não só ter um texto')
})

test('🔴 as assinaturas existem, e a declaração diz o que se está assinando', () => {
  const html = buildEspelhoHtml(dados())
  assert.match(html, /João da Silva — trabalhador/)
  assert.match(html, /Responsável pela empresa/)
  assert.match(html, /conferi as marcações acima/,
    'assinar sem declaração é assinar o quê? a concordância é o que dá valor ao documento')
})

test('o recorte vai impresso, por extenso', () => {
  const html = buildEspelhoHtml(dados())
  assert.match(html, /Período: 14\/09\/2026 a 14\/09\/2026/)
  assert.match(html, /1 funcionário/)
})

test('cada pessoa começa em página nova', () => {
  const html = buildEspelhoHtml(dados({
    trabalhadores: [TRABALHADOR, { ...TRABALHADOR, workerId: 'w2', nome: 'Maria Souza' }],
  }))
  assert.match(html, /\.pessoa \{ break-before: page/,
    'o espelho é entregue individualmente — a folha de um não pode ter metade do mês do outro')
  assert.match(html, /\.pessoa:first-of-type \{ break-before: auto/, 'menos o primeiro, que desperdiçaria uma folha')
})

// ─── Seções e casos de borda ──────────────────────────────────────────────────

test('desmarcar uma seção tira ela do papel', () => {
  const html = buildEspelhoHtml(dados({
    secoes: { resumo: false, grade: true, banco: false, pendencias: false, assinaturas: false },
  }))
  assert.doesNotMatch(html, /Resumo do período/)
  assert.doesNotMatch(html, /Responsável pela empresa/)
  assert.match(html, /Marcações/)
})

test('período sem marcação nenhuma diz isso, em vez de sair em branco', () => {
  const html = buildEspelhoHtml(dados({
    trabalhadores: [{ ...TRABALHADOR, jornadas: [] }],
  }))
  assert.match(html, /Nenhuma marcação registrada no período/)
})

test('nenhum trabalhador no recorte também é dito', () => {
  const html = buildEspelhoHtml(dados({ trabalhadores: [] }))
  assert.match(html, /Nenhum trabalhador com marcação/)
})

test('🔴 diarista: o papel DIZ por que não há banco, em vez de mostrar saldo zero', () => {
  const banco = saldoDoPeriodo(
    { id: 'w1', scheduleType: 'daily' }, [jornada()], '2026-09-14', '2026-09-14',
    { maxWeeklyHours: 44, toleranciaPontoMin: 10 },
  )
  const html = buildEspelhoHtml(dados({ trabalhadores: [{ ...TRABALHADOR, banco }] }))
  assert.match(html, /Sem banco de horas: Diarista/,
    'saldo zero pareceria calculado; a verdade é que não há jornada a compensar')
})

test('o saldo negativo sai com sinal de menos legível, não hífen solto', () => {
  const banco = saldoDoPeriodo(
    { id: 'w1', scheduleType: '5x2' }, [], '2026-09-14', '2026-09-14',
    { maxWeeklyHours: 44, toleranciaPontoMin: 10 },
  )
  const html = buildEspelhoHtml(dados({ trabalhadores: [{ ...TRABALHADOR, jornadas: [], banco }] }))
  assert.match(html, /−8h48/, 'segunda-feira inteira sem bater: 44h ÷ 5 de débito')
})

test('modo demonstração carimba o papel', () => {
  assert.match(buildEspelhoHtml(dados({ demo: true })), /DEMONSTRAÇÃO/)
  assert.doesNotMatch(buildEspelhoHtml(dados({ demo: false })), /DEMONSTRAÇÃO/)
})

test('🔴 o HTML escapa o que vem do cadastro', () => {
  const html = buildEspelhoHtml(dados({
    trabalhadores: [{ ...TRABALHADOR, nome: 'José <script>alert(1)</script> Silva' }],
  }))
  assert.doesNotMatch(html, /<script>alert/)
  assert.match(html, /&lt;script&gt;/)
})

test('o documento se declara: CLT art. 74 no rodapé', () => {
  assert.match(buildEspelhoHtml(dados()), /CLT art\. 74/)
})

test('a impressão é blindada contra o modo escuro do sistema', () => {
  const html = buildEspelhoHtml(dados())
  assert.match(html, /prefers-color-scheme: dark/,
    'sem isso o espelho impresso de um celular em modo escuro sai ilegível')
  assert.match(html, /display: table-header-group/, 'o cabeçalho da tabela repete a cada página')
})
