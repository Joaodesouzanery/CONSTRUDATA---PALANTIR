/**
 * Escopo por obra — o que o Economia pode e não pode afirmar sobre UMA obra.
 *
 * ─── A DECISÃO QUE ESTES TESTES TRAVAM ────────────────────────────────────────
 * Dos treze tipos de evento, **quatro** sabem a obra por id: os dois de RDO (`RDO.siteId`), a
 * ruptura de estoque (`ItemEstoque.siteId`) e a previsão de demanda (`DemandForecast.siteId`). Os
 * outros só têm texto livre na origem — `nucleo`, `projectRef`, `obraProjeto`.
 *
 * O cliente escolheu **não adivinhar**: sem id, o evento conta na carteira e em obra nenhuma. O
 * risco que sobra é o oposto do antigo — não é mais atribuir errado, é atribuir de menos e a tela
 * não contar. Por isso a cobertura é um número de primeira classe aqui.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  summarizeEconomy, baselineDaObra, coberturaDeObra, obrasComEventos,
  generateEconomyEvents, defaultEconomyBaseline, SEM_OBRA,
} from './economiaEngine'
import type { EconomyEvent, EconomyBaseline, ItemEstoque, RDO } from '@/types'

const MES = '2026-08'

const ev = (p: Partial<EconomyEvent>): EconomyEvent => ({
  id: 'e1', stableKey: 'k1', sourceModule: 'rdo', sourceId: 's1', category: 'production_stoppage',
  projectId: null, projectName: SEM_OBRA, date: '2026-08-01', period: MES,
  title: 't', description: '', impactBRL: 100, impactEstimadoBRL: 100, formula: '',
  assumptions: {}, confidence: 'medium', status: 'validated', evidence: [],
  createdAt: '', updatedAt: '', ...p,
})

const base = (p: Partial<EconomyBaseline> = {}): EconomyBaseline => ({ ...defaultEconomyBaseline(), ...p })

// ── Os três escopos ───────────────────────────────────────────────────────────

test('undefined = carteira; id = a obra; null = só os sem obra', () => {
  const eventos = [
    ev({ id: 'a', projectId: 'obra-1', impactBRL: 100 }),
    ev({ id: 'b', projectId: 'obra-2', impactBRL: 200 }),
    ev({ id: 'c', projectId: null,     impactBRL: 400 }),
  ]
  assert.equal(summarizeEconomy(eventos, [base()], MES, undefined).avoidedLossBRL, 700, 'carteira')
  assert.equal(summarizeEconomy(eventos, [base()], MES, 'obra-1').avoidedLossBRL, 100, 'uma obra')
  assert.equal(summarizeEconomy(eventos, [base()], MES, null).avoidedLossBRL, 400, 'sem obra')
})

test('as obras mais os sem-obra somam exatamente a carteira', () => {
  // Se algum dia um evento escapar dos três baldes, esta soma para de fechar.
  const eventos = [
    ev({ id: 'a', projectId: 'obra-1', impactBRL: 100 }),
    ev({ id: 'b', projectId: 'obra-1', impactBRL: 50 }),
    ev({ id: 'c', projectId: 'obra-2', impactBRL: 200 }),
    ev({ id: 'd', projectId: null,     impactBRL: 400 }),
  ]
  const carteira = summarizeEconomy(eventos, [base()], MES, undefined).avoidedLossBRL
  const soma = ['obra-1', 'obra-2', null]
    .reduce((s, escopo) => s + summarizeEconomy(eventos, [base()], MES, escopo).avoidedLossBRL, 0)
  assert.equal(soma, carteira)
})

test('projectId ausente conta como sem obra, igual a null', () => {
  // Evento gravado antes deste escopo não tem o campo. Ele é "sem obra", não some.
  const semCampo = { ...ev({ id: 'x', impactBRL: 90 }) } as EconomyEvent
  delete (semCampo as { projectId?: unknown }).projectId
  assert.equal(summarizeEconomy([semCampo], [base()], MES, null).avoidedLossBRL, 90)
  assert.equal(summarizeEconomy([semCampo], [base()], MES, undefined).avoidedLossBRL, 90)
})

test('outro período nunca entra, em escopo nenhum', () => {
  const outro = [ev({ id: 'a', projectId: 'obra-1', period: '2026-07', impactBRL: 999 })]
  assert.equal(summarizeEconomy(outro, [base()], MES, 'obra-1').avoidedLossBRL, 0)
  assert.equal(summarizeEconomy(outro, [base()], MES, undefined).avoidedLossBRL, 0)
})

// ── Linha de base por obra, herdando ──────────────────────────────────────────

test('obra sem linha de base própria herda a da carteira, e o retorno DIZ que herdou', () => {
  const carteira = base({ id: 'b0', projectId: null, costPerPersonDayBRL: 160 })
  const r = baselineDaObra([carteira], 'obra-1')
  assert.equal(r.baseline?.id, 'b0')
  assert.equal(r.herdada, true, 'a tela precisa saber para não apresentar como números da obra')
})

test('obra com linha própria usa a dela, e não é herança', () => {
  const carteira = base({ id: 'b0', projectId: null, costPerPersonDayBRL: 160 })
  const daObra   = base({ id: 'b1', projectId: 'obra-1', costPerPersonDayBRL: 185 })
  const r = baselineDaObra([carteira, daObra], 'obra-1')
  assert.equal(r.baseline?.id, 'b1')
  assert.equal(r.baseline?.costPerPersonDayBRL, 185)
  assert.equal(r.herdada, false)
})

test('a linha de base de OUTRA obra nunca vaza', () => {
  const daOutra = base({ id: 'b2', projectId: 'obra-2', costPerPersonDayBRL: 999 })
  const carteira = base({ id: 'b0', projectId: null, costPerPersonDayBRL: 160 })
  assert.equal(baselineDaObra([daOutra, carteira], 'obra-1').baseline?.id, 'b0')
})

test('na carteira, a linha de base é a sem obra — nunca a de uma obra qualquer', () => {
  const daObra   = base({ id: 'b1', projectId: 'obra-1' })
  const carteira = base({ id: 'b0', projectId: null })
  assert.equal(baselineDaObra([daObra, carteira], null).baseline?.id, 'b0')
  assert.equal(baselineDaObra([daObra, carteira], undefined).baseline?.id, 'b0')
})

test('sem nenhuma linha da carteira, cai na primeira — obra nenhuma fica sem número', () => {
  const daObra = base({ id: 'b1', projectId: 'obra-1' })
  assert.equal(baselineDaObra([daObra], 'obra-9').baseline?.id, 'b1')
  assert.equal(baselineDaObra([], 'obra-9').baseline, undefined)
})

test('o summarize devolve a herança junto — é o que acende o aviso na tela', () => {
  const carteira = base({ id: 'b0', projectId: null })
  assert.equal(summarizeEconomy([], [carteira], MES, 'obra-1').baselineHerdada, true)
  assert.equal(summarizeEconomy([], [carteira], MES, undefined).baselineHerdada, false)
})

// ── Cobertura ─────────────────────────────────────────────────────────────────

test('a cobertura separa o que tem obra do que não tem', () => {
  const c = coberturaDeObra([
    ev({ id: 'a', projectId: 'obra-1', impactBRL: 300 }),
    ev({ id: 'b', projectId: null,     impactBRL: 700 }),
  ])
  assert.equal(c.comObraBRL, 300)
  assert.equal(c.semObraBRL, 700)
  assert.equal(c.percentual, 30)
})

test('período sem evento nenhum é null, não 0% — ausência de dado não é cobertura ruim', () => {
  assert.equal(coberturaDeObra([]).percentual, null)
  // Eventos só detectados também não contam: a cobertura é do valor que entra na conta.
  assert.equal(coberturaDeObra([ev({ status: 'detected', projectId: 'obra-1' })]).percentual, null)
})

test('cobertura total dá 100, e nenhuma dá 0 — os dois extremos existem', () => {
  assert.equal(coberturaDeObra([ev({ projectId: 'obra-1', impactBRL: 10 })]).percentual, 100)
  assert.equal(coberturaDeObra([ev({ projectId: null, impactBRL: 10 })]).percentual, 0)
})

// ── O seletor ─────────────────────────────────────────────────────────────────

test('o seletor lista só obras de verdade, sem repetir e em ordem', () => {
  const lista = obrasComEventos([
    ev({ id: 'a', projectId: 'o2', projectName: 'SUPERA' }),
    ev({ id: 'b', projectId: 'o1', projectName: 'BRASAL' }),
    ev({ id: 'c', projectId: 'o2', projectName: 'SUPERA' }),
    ev({ id: 'd', projectId: null, projectName: SEM_OBRA }),
    ev({ id: 'e', projectId: 'o3', projectName: 'Zzz', period: '2026-07' }),
    ev({ id: 'f', projectId: 'o4', projectName: 'Desc', status: 'dismissed' }),
  ], MES)
  assert.deepEqual(lista, [{ id: 'o1', nome: 'BRASAL' }, { id: 'o2', nome: 'SUPERA' }])
})

// ── A obra chegando nos eventos gerados ───────────────────────────────────────

const entradaVazia = {
  baselines: [base()], existingEvents: [], rules: [], purchaseOrders: [], matches: [],
  forecasts: [], estoqueItens: [], lpsActivities: [], lpsRestrictions: [], rdos: [],
  maintenanceOrders: [],
}

test('a ruptura de estoque carrega o siteId do item, e o NOME vem da obra', () => {
  const item = {
    id: 'i1', descricao: 'Thinner 18L', unidade: 'un', qtdDisponivel: 0, qtdReservada: 0,
    qtdTransito: 0, estoqueMinimo: 10, custoUnitario: 50, depositoId: 'd1', siteId: 'obra-1',
  } as unknown as ItemEstoque
  const eventos = generateEconomyEvents({
    ...entradaVazia,
    estoqueItens: [item],
    sites: [{ id: 'obra-1', name: 'SUPERA' }],
  })
  const ruptura = eventos.find((e) => e.description.includes('Thinner'))
  assert.ok(ruptura, 'o evento de ruptura foi gerado')
  assert.equal(ruptura.projectId, 'obra-1')
  assert.equal(ruptura.projectName, 'SUPERA')
})

test('obra desconhecida vira "Sem obra" — nunca o nome da linha de base', () => {
  // Era isso que acontecia: o evento sem obra herdava `baseline.projectName` e aparecia na tela
  // como se pertencesse à "Carteira de obras", que não é obra nenhuma.
  const item = {
    id: 'i1', descricao: 'Velcro', unidade: 'un', qtdDisponivel: 0, qtdReservada: 0,
    qtdTransito: 0, estoqueMinimo: 5, custoUnitario: 10, depositoId: 'd1',
  } as unknown as ItemEstoque
  const eventos = generateEconomyEvents({ ...entradaVazia, estoqueItens: [item], sites: [] })
  const ruptura = eventos.find((e) => e.description.includes('Velcro'))
  assert.ok(ruptura)
  assert.equal(ruptura.projectId, null)
  assert.equal(ruptura.projectName, SEM_OBRA)
  assert.notEqual(ruptura.projectName, base().projectName)
})

test('o RDO leva a obra pelo siteId — era um cast morto que dava null sempre', () => {
  const rdo = {
    id: 'r1', number: '001', date: '2026-08-10', siteId: 'obra-7', local: 'Bloco A',
    stoppages: [{ type: 'weather', hours: 4, description: 'chuva' }],
    equipment: [], services: [], employeeNames: [], totalHoras: 0,
  } as unknown as RDO
  const eventos = generateEconomyEvents({
    ...entradaVazia, rdos: [rdo], sites: [{ id: 'obra-7', name: 'PARQUE NACIONAL' }],
  })
  const doRdo = eventos.filter((e) => e.sourceModule === 'rdo')
  assert.ok(doRdo.length > 0, 'algum evento de RDO saiu')
  for (const e of doRdo) {
    assert.equal(e.projectId, 'obra-7', `${e.title} ficou sem obra`)
    assert.equal(e.projectName, 'PARQUE NACIONAL')
  }
})

test('id de obra que não existe mais no cadastro não inventa nome, mas mantém o id', () => {
  // Obra apagada: o evento histórico continua apontando para ela. Perder o id seria pior.
  const item = {
    id: 'i1', descricao: 'Luva', unidade: 'un', qtdDisponivel: 0, qtdReservada: 0,
    qtdTransito: 0, estoqueMinimo: 5, custoUnitario: 10, depositoId: 'd1', siteId: 'obra-sumiu',
  } as unknown as ItemEstoque
  const eventos = generateEconomyEvents({ ...entradaVazia, estoqueItens: [item], sites: [] })
  const ruptura = eventos.find((e) => e.description.includes('Luva'))
  assert.equal(ruptura?.projectId, 'obra-sumiu')
  assert.equal(ruptura?.projectName, SEM_OBRA)
})

// ═══════════════════════════════════════════════════════════════════════════════
// O QUE A REVISÃO ADVERSARIAL PEGOU — cada teste aqui fecha um defeito confirmado
// ═══════════════════════════════════════════════════════════════════════════════

test('⚠️ cada evento é valorado pela linha de base da SUA obra', () => {
  // Antes: `generateEconomyEvents` usava `input.baselines[0]` para valorar TUDO. Criar a linha de
  // base de uma obra não mudava um centavo — a tela prometia o contrário em quatro lugares.
  const rdo = {
    id: 'r1', number: '001', date: '2026-08-10', siteId: 'obra-cara',
    equipment: [{ name: 'Escavadeira', hours: 1, quantity: 2 }],
    stoppages: [], services: [], employeeNames: [], totalHoras: 0,
  } as unknown as RDO
  const carteira = base({ id: 'b0', projectId: null, equipmentDailyCostBRL: 1000 })
  const daObra   = base({ id: 'b1', projectId: 'obra-cara', equipmentDailyCostBRL: 4000 })

  const so = generateEconomyEvents({ ...entradaVazia, baselines: [carteira], rdos: [rdo], sites: [] })
  const com = generateEconomyEvents({ ...entradaVazia, baselines: [carteira, daObra], rdos: [rdo], sites: [] })

  const ocioso = (es: typeof so) => es.find((e) => e.category === 'equipment_idle')
  assert.equal(ocioso(so)?.impactBRL, 2000, 'sem linha própria: herda os R$ 1.000 da carteira × 2')
  assert.equal(ocioso(com)?.impactBRL, 8000, 'com linha própria: R$ 4.000 × 2 — o número MUDA')
})

test('⚠️ a ordem do array de linhas de base não muda a valoração da carteira', () => {
  // O `pull` traz `economy_baselines` sem orderBy, e o padrão é `created_at DESC` — então
  // `baselines[0]` viraria a linha de base MAIS RECENTE, a da última obra criada, e ela
  // repricificaria a carteira inteira no login seguinte.
  const carteira = base({ id: 'b0', projectId: null, equipmentDailyCostBRL: 1000 })
  const daObra   = base({ id: 'b1', projectId: 'obra-x', equipmentDailyCostBRL: 9999 })
  const rdoSemObra = {
    id: 'r1', number: '001', date: '2026-08-10',
    equipment: [{ name: 'Betoneira', hours: 1, quantity: 1 }],
    stoppages: [], services: [], employeeNames: [], totalHoras: 0,
  } as unknown as RDO

  const ordemA = generateEconomyEvents({ ...entradaVazia, baselines: [carteira, daObra], rdos: [rdoSemObra], sites: [] })
  const ordemB = generateEconomyEvents({ ...entradaVazia, baselines: [daObra, carteira], rdos: [rdoSemObra], sites: [] })
  const valor = (es: typeof ordemA) => es.find((e) => e.category === 'equipment_idle')?.impactBRL

  assert.equal(valor(ordemA), 1000)
  assert.equal(valor(ordemB), 1000, 'a linha de base de uma obra vazou para o evento da carteira')
})

test('evento de carteira (horas de gestão) não é carimbado em obra nenhuma', () => {
  // Usava `baseline.projectId`, da primeira linha do array. Com linhas por obra, isso carimbaria
  // um evento de operação inteira numa obra arbitrária.
  const daObra = base({ id: 'b1', projectId: 'obra-x', manualReportHoursPerWeek: 6 })
  const rdo = { id: 'r1', number: '1', date: '2026-08-10', stoppages: [], equipment: [], services: [], employeeNames: [], totalHoras: 0 } as unknown as RDO
  const eventos = generateEconomyEvents({ ...entradaVazia, baselines: [daObra], rdos: [rdo], sites: [] })
  const gestao = eventos.find((e) => e.category === 'management_hours')
  assert.ok(gestao, 'o evento de horas de gestão saiu')
  assert.equal(gestao.projectId, null, 'horas de gestão não pertencem a uma obra')
})

test('obra excluída do cadastro não vira uma segunda opção lendo "Sem obra"', () => {
  // O evento guarda o id de uma obra real e apagada; `nomeDaObra` não acha mais o nome. Sem
  // tratamento, o seletor mostrava DUAS opções idênticas — uma com uuid, outra com os eventos que
  // nunca tiveram obra —, indistinguíveis para quem escolhe.
  const lista = obrasComEventos([
    ev({ id: 'a', projectId: 'aaaaaaaa-1111-2222-3333-444444444444', projectName: SEM_OBRA }),
    ev({ id: 'b', projectId: 'o1', projectName: 'BRASAL' }),
  ], MES)
  assert.equal(lista.length, 2)
  const removida = lista.find((o) => o.id.startsWith('aaaaaaaa'))
  assert.equal(removida?.nome, 'Obra removida (aaaaaaaa)')
  assert.ok(!lista.some((o) => o.nome === SEM_OBRA), 'nenhuma opção pode se chamar "Sem obra"')
})

test('o nome de uma obra viva vence o rótulo "Sem obra" de um evento antigo dela', () => {
  // Um evento gerado antes de a obra entrar no cadastro tem projectName "Sem obra"; outro, gerado
  // depois, tem o nome. O seletor precisa mostrar o nome, não o que veio primeiro no array.
  const lista = obrasComEventos([
    ev({ id: 'a', projectId: 'o1', projectName: SEM_OBRA }),
    ev({ id: 'b', projectId: 'o1', projectName: 'SUPERA' }),
  ], MES)
  assert.deepEqual(lista, [{ id: 'o1', nome: 'SUPERA' }])
})
