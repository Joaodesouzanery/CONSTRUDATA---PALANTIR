/**
 * A ponte FCP ↔ Last Planner.
 *
 * O que estes testes cercam é o risco de o mesmo número existir em dois lugares com valores
 * diferentes: a meta que a diretoria aprovou e a meta que a equipe assumiu na reunião têm de ser
 * a mesma, e o executado tem de voltar sem ninguém redigitar.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  atividadesDoPlano, lerVinculo, mudancasVindasDoLps, realizadoDoLps, semanaIso, trechoDaCidade,
} from './fcpParaLps'
import { BERTIOGA_SANTOS as P } from './premissasBertiogaSantos'
import { producaoPrevistaSemanal, ticketDaCidade } from './motor'

// ─── Semana ISO ───────────────────────────────────────────────────────────────

test('⚠️ a semana é ISO 8601 de verdade — a virada de ano não pode escorregar', () => {
  // Na ISO 8601 a semana 1 é a que contém a primeira quinta-feira do ano. Por isso 01/01 pode
  // cair na semana 52 ou 53 do ano ANTERIOR. `ceil(diaDoAno/7)` erra isso todo ano, e o LPS
  // agrupa por essa string — o erro apareceria como uma semana fantasma em janeiro.
  assert.equal(semanaIso('2026-01-01'), '2026-W01', 'quinta-feira: já é a semana 1 de 2026')
  assert.equal(semanaIso('2027-01-01'), '2026-W53', 'sexta-feira: ainda é 2026')
  assert.equal(semanaIso('2028-01-01'), '2027-W52', 'sábado: ainda é 2027')
})

test('a semana ISO das semanas do plano', () => {
  assert.equal(semanaIso('2026-08-24'), '2026-W35')
  assert.equal(semanaIso('2026-08-30'), '2026-W35', 'domingo ainda é a mesma semana')
  assert.equal(semanaIso('2026-08-31'), '2026-W36', 'segunda já é a seguinte')
})

// ─── Ida: o plano vira atividade ──────────────────────────────────────────────

test('cada cidade × semana vira UMA atividade, não uma por serviço', () => {
  // 96 linhas de "1 ligação de água" por semana afogariam a reunião de planejamento.
  const a = atividadesDoPlano(P, 'plano-1', 12)
  assert.equal(a.length, 24, '2 cidades × 12 semanas')
  assert.equal(new Set(a.map((x) => x.week)).size, 12)
  assert.equal(new Set(a.map((x) => x.trechoCode)).size, 2)
})

test('a meta da atividade é a produção prevista do FCP, na mesma unidade', () => {
  const a = atividadesDoPlano(P, 'plano-1', 1)
  const bertioga = a.find((x) => x.trechoCode === trechoDaCidade('bertioga'))!
  const esperado = Number(producaoPrevistaSemanal(P, P.cidades[0]).toFixed(2))
  assert.equal(bertioga.plannedMeters, esperado)
  assert.match(bertioga.description!, /serviços/, 'a descrição diz a unidade, porque o campo mente')
})

test('⚠️ a atividade nasce VERMELHA — o plano financeiro não libera frente de serviço', () => {
  // Nascer verde seria o plano dizer que material, frente e equipe estão resolvidos sem ninguém
  // ter olhado.
  const a = atividadesDoPlano(P, 'plano-1', 1)
  assert.ok(a.every((x) => x.readyStatus === 'red'))
  assert.ok(a.every((x) => x.planned && !x.completed))
})

test('o vínculo de volta identifica plano, cidade e semana', () => {
  const a = atividadesDoPlano(P, 'plano-1', 3)
  const v = lerVinculo(a[0].sourceFcpId)!
  assert.equal(v.planoId, 'plano-1')
  assert.equal(v.cidadeId, 'bertioga')
  assert.equal(v.semana, 1)
  assert.equal(new Set(a.map((x) => x.sourceFcpId)).size, a.length, 'nenhum vínculo repetido')
})

test('vínculo malformado devolve null em vez de estourar', () => {
  for (const v of [undefined, '', 'só-um-pedaço', 'a:b', 'a:b:c:d', 'a:b:zero']) {
    assert.equal(lerVinculo(v), null, String(v))
  }
})

test('cidade com ticket zero não gera atividade — a meta seria infinita', () => {
  const semTicket = { ...P, cidades: [{ ...P.cidades[0], ticket: 0, mix: undefined }] }
  assert.deepEqual(atividadesDoPlano(semTicket, 'p', 4), [])
})

// ─── Volta: o executado do LPS alimenta o FCP ─────────────────────────────────

const ativ = (source: string, executado?: number) => ({ sourceFcpId: source, executedMeters: executado })

test('o executado do LPS vira a produção realizada do FCP', () => {
  const r = realizadoDoLps([
    ativ('plano-1:bertioga:1', 90),
    ativ('plano-1:bertioga:2', 105),
    ativ('plano-1:santos:1', 70),
  ], 'plano-1')
  assert.equal(r.bertioga[1], 90)
  assert.equal(r.bertioga[2], 105)
  assert.equal(r.santos[1], 70)
})

test('⚠️ atividade SEM executado lançado NÃO vira zero', () => {
  // Zero quer dizer "a equipe não produziu nada"; ausente quer dizer "ninguém lançou ainda". São
  // coisas diferentes, e zerar o não lançado derrubaria a medição de semanas que nem aconteceram.
  const r = realizadoDoLps([ativ('plano-1:bertioga:1', undefined), ativ('plano-1:bertioga:2', 0)], 'plano-1')
  assert.equal(r.bertioga?.[1], undefined, 'não lançado fica de fora')
  assert.equal(r.bertioga?.[2], 0, 'zero lançado é zero de verdade')
})

test('atividade de OUTRO plano nunca contamina', () => {
  const r = realizadoDoLps([ativ('outro-plano:bertioga:1', 999), ativ('plano-1:bertioga:1', 90)], 'plano-1')
  assert.equal(r.bertioga[1], 90)
})

test('atividade sem vínculo com o FCP é ignorada', () => {
  const r = realizadoDoLps([{ executedMeters: 500 }, ativ('plano-1:bertioga:1', 90)], 'plano-1')
  assert.equal(r.bertioga[1], 90)
  assert.equal(Object.keys(r).length, 1)
})

test('duas atividades na mesma semana SOMAM — alguém quebrou a meta em duas linhas', () => {
  const r = realizadoDoLps([ativ('plano-1:bertioga:1', 40), ativ('plano-1:bertioga:1', 50)], 'plano-1')
  assert.equal(r.bertioga[1], 90)
})

// ─── O que muda, antes de gravar ──────────────────────────────────────────────

test('a tela mostra o que muda, com o impacto em reais', () => {
  const m = mudancasVindasDoLps(P, {}, { bertioga: { 1: 90 } })
  assert.equal(m.length, 1)
  assert.equal(m[0].cidadeNome, 'Bertioga')
  assert.equal(m[0].semana, 1)
  assert.equal(m[0].noLps, 90)
  assert.equal(m[0].noFcp, undefined, 'não havia nada lançado no FCP')
  // O impacto é contra o PREVISTO, que é o que a semana usaria sem lançamento.
  const previsto = producaoPrevistaSemanal(P, P.cidades[0])
  const esperado = (90 - previsto) * ticketDaCidade(P.cidades[0])
  assert.ok(Math.abs(m[0].impactoEmReais - esperado) < 0.01)
  assert.ok(m[0].impactoEmReais < 0, 'produzir menos que o previsto tira dinheiro da medição')
})

test('valor igual ao que já está no FCP não vira mudança', () => {
  const m = mudancasVindasDoLps(P, { bertioga: { 1: 90 } }, { bertioga: { 1: 90 } })
  assert.deepEqual(m, [])
})

test('mudança de valor mostra o antes e o depois', () => {
  const m = mudancasVindasDoLps(P, { bertioga: { 1: 80 } }, { bertioga: { 1: 90 } })
  assert.equal(m[0].noFcp, 80)
  assert.equal(m[0].noLps, 90)
  assert.ok(Math.abs(m[0].impactoEmReais - 10 * ticketDaCidade(P.cidades[0])) < 0.01)
})

test('as mudanças vêm ordenadas por semana, para a conferência ficar legível', () => {
  const m = mudancasVindasDoLps(P, {}, { bertioga: { 3: 90, 1: 80 }, santos: { 2: 70 } })
  assert.deepEqual(m.map((x) => x.semana), [1, 2, 3])
})

test('ida e volta fecham: aprovar, lançar no LPS e voltar dá o mesmo número', () => {
  // É o ciclo inteiro. Se ele não fechar, o mesmo número existe em dois lugares com valores
  // diferentes — que é exatamente o problema que a integração existe para resolver.
  const atividades = atividadesDoPlano(P, 'plano-1', 4)
  const comExecutado = atividades.map((a, i) => ({
    sourceFcpId: a.sourceFcpId,
    executedMeters: i % 2 === 0 ? 88 : undefined,
  }))
  const r = realizadoDoLps(comExecutado, 'plano-1')
  const lancados = Object.values(r).flatMap((c) => Object.values(c)).filter((v) => v !== undefined)
  assert.equal(lancados.length, 4, 'metade das 8 atividades tinha executado')
  assert.ok(lancados.every((v) => v === 88))
})
