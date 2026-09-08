/**
 * A asserção transversal é a que importa: entrada vazia → TODOS cinza, com `oQueFalta`. Nenhum
 * indicador pode devolver "R$ 0,00" onde a verdade é "não sei".
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BERTIOGA_SANTOS as P } from './fcp/premissasBertiogaSantos'
import {
  montarIndicadoresFinanceiro, custoPorMetro, diasComDespesaSemRdo, custoDoDiaParado, defasagemReal,
  velocidadeDeConferencia, ticketEfetivo, type EntradaIndicadores,
} from './indicadoresFinanceiro'
import type { ConstructionSite, FinanceiroEntry, RDO } from '@/types'
import type { PlanoFcp } from '@/store/fcpStore'
import type { DiaSemProducao } from '@/store/diasSemProducaoStore'

const plano: PlanoFcp = { id: 'p', nome: 'FCP', status: 'rascunho', premissas: P, realizado: {}, criadoEm: '2026-08-01' }
const site = (id: string, fcpCidadeId?: string, faturamentos: unknown[] = []): ConstructionSite =>
  ({ id, name: `Obra ${id}`, status: 'em_andamento', ativa: true, startDate: '2026-08-24', contrato: { fcpCidadeId, faturamentos } }) as unknown as ConstructionSite
const mo = (obraId: string, data: string, valor: number, extra: Partial<FinanceiroEntry> = {}): FinanceiroEntry =>
  ({ id: `${obraId}-${data}-${valor}-${Math.random()}`, tipo: 'saida', descricao: 'MO', valor, data, categoria: 'mao_de_obra', obraId, origem: 'planilha', createdAt: `${data}T10:00:00.000Z`, ...extra }) as FinanceiroEntry
const rdoWcr = (siteId: string, date: string, metros: number, unidades = 0): RDO =>
  ({ id: `r-${siteId}-${date}`, siteId, date, status: 'finalizado', template: 'wcr',
     wcr: { producao: [{ sigla: 'PRA', quantidade: String(metros), unidade: 'M' }, { sigla: 'LA', quantidade: String(unidades), unidade: 'UN' }] } }) as unknown as RDO

const vazia: EntradaIndicadores = { plano: null, sites: [], entries: [], rdos: [], diasSemProducao: [], feriados: [], jornada: 'mon_fri', hoje: '2026-10-15', periodo: {} }
const base = (extra: Partial<EntradaIndicadores>): EntradaIndicadores => ({ ...vazia, plano, sites: [site('a', 'bertioga')], ...extra })

test('🔴 entrada vazia: todos cinza, todos com oQueFalta, nenhum "0"', () => {
  const todos = montarIndicadoresFinanceiro(vazia)
  assert.ok(todos.length >= 16)
  for (const i of todos) {
    assert.equal(i.tom, 'sem-dado', `${i.sigla} deveria ser sem-dado`)
    assert.equal(i.valor, '—', `${i.sigla} devolveu "${i.valor}"`)
    assert.ok(i.explicacao.oQueFalta, `${i.sigla} sem oQueFalta`)
    assert.match(`${i.sigla} · ${i.titulo}`, /^\S+ · .+/, 'rótulo = sigla · nome')
  }
})

test('A1: razão das somas, e o dia sem metros fica fora', () => {
  const e = base({
    entries: [mo('a', '2026-09-01', 1000), mo('a', '2026-09-02', 500), mo('a', '2026-09-03', 9999)],
    rdos: [rdoWcr('a', '2026-09-01', 200), rdoWcr('a', '2026-09-02', 100)],
  })
  const i = custoPorMetro(e)
  assert.equal(i.tom, 'neutro')
  assert.match(i.valor, /R\$\s?5,00\/m/)
  assert.equal(i.porObra[0].valor, i.valor)
  assert.equal(custoPorMetro(base({ entries: [mo('a', '2026-09-01', 1000)] })).tom, 'sem-dado')
})

test('A2: dia útil com MO e sem RDO conta; fim de semana, dia parado e rascunho não', () => {
  const parado: DiaSemProducao = { id: 'x', siteId: 'a', data: '2026-09-03', categoria: 'chuva', createdAt: '', updatedAt: '' }
  const e = base({
    entries: [mo('a', '2026-09-01', 100), mo('a', '2026-09-05', 100), mo('a', '2026-09-03', 100), mo('a', '2026-09-02', 100)],
    rdos: [rdoWcr('a', '2026-09-02', 10)],
    diasSemProducao: [parado],
  })
  // 01/09 (ter) sem RDO → conta · 05/09 (sáb) → não · 03/09 parado → não · 02/09 tem RDO → não
  const i = diasComDespesaSemRdo(e)
  assert.equal(i.valor, '1')
  assert.equal(i.tom, 'atencao')
})

test('A3: "01 A 10" com dois dias parados custa 2/10 do valor, por motivo', () => {
  const dias: DiaSemProducao[] = [
    { id: '1', siteId: 'a', data: '2026-09-03', categoria: 'chuva', createdAt: '', updatedAt: '' },
    { id: '2', siteId: 'a', data: '2026-09-04', categoria: 'chuva', createdAt: '', updatedAt: '' },
  ]
  const e = base({ entries: [mo('a', '2026-09-01', 1000, { dataFim: '2026-09-10' })], diasSemProducao: dias })
  const i = custoDoDiaParado(e)
  assert.match(i.valor, /200,00/)
  assert.match(i.detalhe, /Chuva/)
  assert.equal(custoDoDiaParado(base({})).tom, 'sem-dado')
})

test('C1: média por nota, tom contra a premissa, nota sem data não entra', () => {
  const s = site('a', 'bertioga', [
    { id: '1', data: '2026-09-01', valor: 1, situacao: 'recebido', dataRecebimento: '2026-09-21' },
    { id: '2', data: '2026-09-01', valor: 1, situacao: 'recebido', dataRecebimento: '2026-10-01' },
    { id: '3', data: '2026-09-01', valor: 1, situacao: 'recebido' },
  ])
  const i = defasagemReal(base({ sites: [s] }))
  assert.equal(i.valor, '25 dias')          // (20 + 30) / 2, premissa 20 → ok
  assert.equal(i.tom, 'ok')
  assert.match(i.detalhe, /1 recebida\(s\) sem data/)
})

test('C3: hora extra nasce conferida e fica fora; pendente antigo é grave', () => {
  const e = base({ entries: [
    mo('a', '2026-08-01', 1, { conferido: false }),
    mo('a', '2026-09-01', 1, { conferido: true, conferidoEm: '2026-09-03T10:00:00.000Z' }),
    mo('a', '2026-09-01', 1, { origem: 'horas-extras', conferido: true, conferidoEm: '2026-09-01T10:00:00.000Z' }),
  ] })
  const i = velocidadeDeConferencia(e)
  assert.equal(i.tom, 'grave')
  assert.match(i.detalhe, /1 conferido\(s\) · 1 pendente\(s\)/)
})

test('E3: duas obras na mesma cidade agregam na cidade; sem UN é cinza', () => {
  const s1 = site('a', 'bertioga', [{ id: '1', data: '2026-09-10', valor: 1000, situacao: 'a_receber', categoria: 'servico' }])
  const s2 = site('b', 'bertioga', [{ id: '2', data: '2026-09-11', valor: 1000, situacao: 'a_receber', categoria: 'servico' }])
  const i = ticketEfetivo(base({ sites: [s1, s2], rdos: [rdoWcr('a', '2026-09-10', 0, 1), rdoWcr('b', '2026-09-11', 0, 1)] }))
  assert.match(i.valor, /1\.000,00/)
  assert.equal(i.porObra.length, 1)
  assert.match(i.porObra[0].nome, /2 obras/)
  assert.equal(ticketEfetivo(base({ sites: [s1] })).tom, 'sem-dado')
})
