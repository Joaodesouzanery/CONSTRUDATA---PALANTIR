/**
 * Projetado × Realizado.
 *
 * O teste que dá sentido aos outros: a obra SEM vínculo com o FCP aparece — e não soma no total.
 * Sem ele, o painel faria a coisa mais fácil e mais errada: ratear o projetado da cidade pelo
 * número de obras e apresentar como se fosse medição.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BERTIOGA_SANTOS as P } from './premissasBertiogaSantos'
import { fluxoMensal } from './motor'
import {
  ratearPorDia, realizadoPorMes, recebidoPorMes, compararProjetadoRealizado, planoDaObra,
  tomDaAderencia, acumuladoPorCenarioAteMes, cenarioMaisProximo,
} from './projetadoRealizado'
import type { PlanoFcp } from '@/store/fcpStore'
import type { ConstructionSite, FinanceiroEntry } from '@/types'

const plano: PlanoFcp = { id: 'p1', nome: 'FCP', status: 'rascunho', premissas: P, realizado: {}, criadoEm: '2026-08-01T00:00:00.000Z' }
const site = (id: string, name: string, fcpCidadeId?: string, faturamentos: unknown[] = []): ConstructionSite =>
  ({ id, name, contrato: { fcpCidadeId, faturamentos } }) as unknown as ConstructionSite
const A = site('a', 'Obra A', 'bertioga')
const B = site('b', 'Obra B', 'santos')
const C = site('c', 'Obra C')   // sem vínculo
const saida = (obraId: string, data: string, valor: number, extra: Partial<FinanceiroEntry> = {}): FinanceiroEntry =>
  ({ id: `${obraId}-${data}-${valor}`, tipo: 'saida', descricao: 'x', valor, data, categoria: 'mao_de_obra', obraId, origem: 'planilha', createdAt: data, ...extra }) as FinanceiroEntry

test('ratearPorDia: "01 A 10" vira dez partes iguais que somam o total', () => {
  const partes = ratearPorDia({ valor: 1000, data: '2026-07-01', dataFim: '2026-07-10' })
  assert.equal(partes.length, 10)
  assert.equal(partes[0].data, '2026-07-01')
  assert.equal(partes[9].data, '2026-07-10')
  assert.ok(Math.abs(partes.reduce((a, p) => a + p.valor, 0) - 1000) < 1e-6)
  assert.deepEqual(ratearPorDia({ valor: 50, data: '2026-07-01' }), [{ data: '2026-07-01', valor: 50 }])
  assert.equal(ratearPorDia({ valor: 50, data: '2026-07-10', dataFim: '2026-07-01' }).length, 1, 'fim antes do início não rateia')
})

test('realizadoPorMes: só o que é do caixa, e o período que cruza mês divide entre os dois', () => {
  const entries = [
    saida('a', '2026-08-25', 100),
    saida('a', '2026-08-30', 300, { dataFim: '2026-09-02' }),          // 4 dias: 2 em ago, 2 em set
    saida('a', '2026-08-26', 999, { origem: undefined, sourceRdoId: 'rdo' }),  // Compizzo — fora
    saida('b', '2026-08-26', 5),                                        // outra obra — fora
  ]
  const r = realizadoPorMes(entries, { obraIds: ['a'] })
  assert.equal(r.length, 2)
  assert.ok(Math.abs(r[0].saidas - 250) < 1e-6, 'ago: 100 + 150')
  assert.ok(Math.abs(r[1].saidas - 150) < 1e-6, 'set: 150')
})

test('recebidoPorMes: nota recebida sem data não cabe em mês nenhum, e é contada', () => {
  const s = site('a', 'A', 'bertioga', [
    { id: 'n1', data: '2026-09-01', valor: 1000, situacao: 'recebido', dataRecebimento: '2026-09-21' },
    { id: 'n2', data: '2026-09-01', valor: 500, situacao: 'recebido' },
    { id: 'n3', data: '2026-09-01', valor: 700, situacao: 'a_receber' },
  ])
  const r = recebidoPorMes([s], ['a'])
  assert.deepEqual(r.meses, [{ periodo: '2026-09', valor: 1000, notas: 1 }])
  assert.equal(r.semData, 1)
  assert.equal(r.temNotas, true)
})

test('🔴 obra sem vínculo aparece à parte e NUNCA soma no total', () => {
  const entries = [saida('a', '2026-09-10', 1000), saida('c', '2026-09-10', 45_000)]
  const cmp = compararProjetadoRealizado({ plano, sites: [A, B, C], entries, periodo: {}, hoje: '2026-10-15' })
  assert.equal(cmp.semVinculo.length, 1)
  assert.equal(cmp.semVinculo[0].siteId, 'c')
  assert.equal(cmp.semVinculo[0].realizadoSaidas, 45_000)
  assert.equal(cmp.total.despesas.realizado, 1000, 'os 45.000 da obra C não entram')
  assert.ok(cmp.porObra.every((o) => o.siteId !== 'c'))
})

test('o total projetado é a soma de saiDoCaixa das cidades vinculadas, só nos meses até hoje', () => {
  const cmp = compararProjetadoRealizado({ plano, sites: [A, B], entries: [], periodo: {}, hoje: '2026-10-15' })
  const esperado = fluxoMensal(P).filter((c) => c.mes.mes.slice(0, 7) <= '2026-10')
    .reduce((a, c) => a + c.porCidade.reduce((b, x) => b + x.saiDoCaixa, 0), 0)
  assert.ok(Math.abs((cmp.total.despesas.projetado ?? 0) - esperado) < 0.01)
})

test('mês futuro fica sem realizado e sem aderência; mês corrente é parcial', () => {
  const cmp = compararProjetadoRealizado({ plano, sites: [A, B], entries: [], periodo: {}, hoje: '2026-10-15' })
  const nov = cmp.despesas.find((l) => l.periodo === '2026-11')!
  assert.equal(nov.realizado, null)
  assert.equal(nov.aderencia, null)
  const out = cmp.despesas.find((l) => l.periodo === '2026-10')!
  assert.equal(out.parcial, true)
  // agosto/26 o motor projeta saída 0 (o custo cai em setembro): aderência não pode ser divisão por zero
  const ago = cmp.despesas.find((l) => l.periodo === '2026-08')!
  assert.equal(ago.projetado, 0)
  assert.equal(ago.aderencia, null)
})

test('cidade com duas obras: projetado na cidade, "—" nas obras; com uma obra, igual ao da cidade', () => {
  const A2 = site('a2', 'Obra A2', 'bertioga')
  const cmp = compararProjetadoRealizado({ plano, sites: [A, A2, B], entries: [], periodo: {}, hoje: '2026-10-15' })
  const bertioga = cmp.porCidade.find((c) => c.cidadeId === 'bertioga')!
  assert.equal(bertioga.obras, 2)
  assert.ok(bertioga.despesas.projetado! > 0)
  for (const o of cmp.porObra.filter((o) => o.cidadeId === 'bertioga')) {
    assert.equal(o.despesas.projetado, null)
    assert.match(o.oQueFalta ?? '', /2 obras/)
  }
  const santos = cmp.porObra.find((o) => o.siteId === 'b')!
  assert.equal(santos.despesas.projetado, cmp.porCidade.find((c) => c.cidadeId === 'santos')!.despesas.projetado)
})

test('planoDaObra: o da obra vence; aprovado vence rascunho; sem obra e um plano só → único', () => {
  const r1 = { ...plano, id: 'r', obraId: 'a', status: 'rascunho' as const, criadoEm: '2026-09-01' }
  const ap = { ...plano, id: 'ap', obraId: 'a', status: 'aprovado' as const, criadoEm: '2026-08-01' }
  assert.equal(planoDaObra([r1, ap], 'a').plano?.id, 'ap')
  assert.equal(planoDaObra([plano], 'zzz').motivo, 'unico')
  assert.equal(planoDaObra([r1, ap], 'zzz').motivo, 'ambiguo')
  assert.equal(planoDaObra([], 'a').motivo, 'sem-plano')
})

test('tomDaAderencia: gastar menos também é atenção — caixa incompleto é a causa mais provável', () => {
  assert.equal(tomDaAderencia(1.05, 'despesa'), 'ok')
  assert.equal(tomDaAderencia(1.2, 'despesa'), 'atencao')
  assert.equal(tomDaAderencia(1.3, 'despesa'), 'grave')
  assert.equal(tomDaAderencia(0.7, 'despesa'), 'atencao')
  assert.equal(tomDaAderencia(0.95, 'receita'), 'ok')
  assert.equal(tomDaAderencia(0.6, 'receita'), 'grave')
  assert.equal(tomDaAderencia(null, 'despesa'), 'sem-dado')
})

test('cenário mais próximo: o caixa que bate com MÉDIA escolhe MÉDIA', () => {
  const cidades = new Set(['bertioga', 'santos'])
  const por = acumuladoPorCenarioAteMes(P, {}, '2027-03-01', cidades)
  assert.ok(por.MEDIA !== null && por.OTIMA !== null && por.MEDIA !== por.OTIMA)
  assert.equal(cenarioMaisProximo(por.MEDIA!, por)?.cenario, 'MEDIA')
  assert.equal(acumuladoPorCenarioAteMes(P, {}, '2031-01-01', cidades).OTIMA, null, 'fora do horizonte')
})
