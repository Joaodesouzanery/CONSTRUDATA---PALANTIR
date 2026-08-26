/**
 * O retrato da obra — a ligação com contrato, financeiro e custo real de mão de obra.
 *
 * O que estes testes protegem não é aritmética: é a **separação**. O módulo Economia estima; este
 * arquivo mede. Somar as duas coisas, ou somar a folha com a saída de caixa que já contém a folha,
 * produziria um número maior e mais bonito — e errado. É o erro que a auditoria de 25/08/2026
 * encontrou em outra forma, e o que mais provavelmente voltaria.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { retratoDaObra, limitesDoMes } from './retratoDaObra'
import { MOCK_CLT_SETTINGS } from '@/data/mockMaoDeObra'
import type { ConstructionSite, FinanceiroEntry, Worker, Shift } from '@/types'

const HOJE = '2026-08-25'
const MES = '2026-08'

const obra = (p: Partial<ConstructionSite> = {}): ConstructionSite => ({
  id: 'obra-1', name: 'SUPERA', owner: 'Cliente', company: 'Compizzo', ...p,
} as unknown as ConstructionSite)

const saida = (p: Partial<FinanceiroEntry>): FinanceiroEntry => ({
  id: Math.random().toString(36).slice(2), tipo: 'saida', descricao: 'x', valor: 0,
  data: '2026-08-10', categoria: 'materiais', obraId: 'obra-1', createdAt: '', ...p,
} as FinanceiroEntry)

const trab = (p: Partial<Worker> = {}): Worker => ({
  id: 'w1', name: 'João', role: 'Pintor', cpfMasked: '***', crewId: 'c1', status: 'active',
  certifications: [], hourlyRate: 20, grossSalary: 3000, ...p,
} as Worker)

const turno = (p: Partial<Shift> = {}): Shift => ({
  id: Math.random().toString(36).slice(2), workerId: 'w1', date: '2026-08-03',
  startTime: '07:00', endTime: '16:00', breakMinutes: 60, type: 'regular', status: 'completed', ...p,
} as unknown as Shift)

const montar = (p: Partial<Parameters<typeof retratoDaObra>[0]> = {}) => retratoDaObra({
  site: obra(), period: MES, entries: [], workers: [], shifts: [],
  cltSettings: MOCK_CLT_SETTINGS, hoje: HOJE, ...p,
})

// ── Os limites do mês ─────────────────────────────────────────────────────────

test('o último dia do mês é o de verdade, inclusive em fevereiro bissexto', () => {
  // O código antigo do módulo usava `${yearMonth}-31` como fim de período. Em fevereiro isso é uma
  // data que não existe; funciona por acaso na comparação de texto, e é armadilha para o próximo.
  assert.deepEqual(limitesDoMes('2026-08'), { de: '2026-08-01', ate: '2026-08-31' })
  assert.deepEqual(limitesDoMes('2026-02'), { de: '2026-02-01', ate: '2026-02-28' })
  assert.deepEqual(limitesDoMes('2028-02'), { de: '2028-02-01', ate: '2028-02-29' })
  assert.deepEqual(limitesDoMes('2026-04'), { de: '2026-04-01', ate: '2026-04-30' })
})

// ── Contrato ──────────────────────────────────────────────────────────────────

test('serviço e material vêm do contrato, e o saldo desconta só o serviço', () => {
  // A regra da carteira BSB: o material é faturado à parte. Ver carteiraObras.test.ts.
  const r = montar({ site: obra({ contrato: {
    services: [], valorServico: 592324.14, valorMaterial: 607620,
    faturamentos: [{ id: 'n1', data: '2026-01-10', valor: 138558.20, situacao: 'recebido' }],
  } }) })
  assert.equal(r.contratoServicoBRL, 592324.14)
  assert.equal(r.contratoMaterialBRL, 607620)
  assert.equal(r.saldoServicoBRL, 453765.94, 'o saldo da planilha do cliente')
  assert.equal(r.temContrato, true)
})

test('obra sem contrato não inventa valor', () => {
  const r = montar()
  assert.equal(r.contratoServicoBRL, 0)
  assert.equal(r.temContrato, false)
})

// ── Financeiro ────────────────────────────────────────────────────────────────

test('só entram lançamentos DESTA obra e DESTE mês', () => {
  const r = montar({ entries: [
    saida({ valor: 1000 }),
    saida({ valor: 9999, obraId: 'obra-2' }),          // outra obra
    saida({ valor: 8888, data: '2026-07-31' }),        // mês anterior
    saida({ valor: 7777, data: '2026-09-01' }),        // mês seguinte
  ] })
  assert.equal(r.saidasBRL, 1000)
})

test('lançamento SEM obra não é rateado — fica de fora', () => {
  // Ratear despesa administrativa entre obras é decisão de negócio que ninguém tomou. Distribuir
  // por conta própria mudaria o custo de cada obra sem ninguém pedir.
  const r = montar({ entries: [saida({ valor: 5000, obraId: undefined, categoria: 'administrativo' })] })
  assert.equal(r.saidasBRL, 0)
})

test('as saídas saem quebradas por categoria, da maior para a menor', () => {
  const r = montar({ entries: [
    saida({ valor: 300, categoria: 'materiais' }),
    saida({ valor: 900, categoria: 'mao_de_obra' }),
    saida({ valor: 100, categoria: 'materiais' }),
  ] })
  assert.deepEqual(r.saidasPorCategoria, [
    { categoria: 'mao_de_obra', valorBRL: 900, lancamentos: 1 },
    { categoria: 'materiais',   valorBRL: 400, lancamentos: 2 },
  ])
  assert.equal(r.saidaMaoDeObraBRL, 900)
})

test('entrada não é confundida com saída', () => {
  const r = montar({ entries: [
    saida({ valor: 500 }),
    saida({ valor: 2000, tipo: 'entrada', categoria: 'medicao' }),
  ] })
  assert.equal(r.saidasBRL, 500)
  assert.equal(r.entradasBRL, 2000)
})

// ── A conferência que NÃO é soma ──────────────────────────────────────────────

test('⚠️ a conferência é contra o que o RDO lançou, NUNCA contra a categoria inteira', () => {
  // ─── O DEFEITO QUE ESTE TESTE FECHA ─────────────────────────────────────────
  // A categoria `mao_de_obra` tem pelo menos CINCO produtores independentes do mesmo custo: a
  // ponte do RDO, a Execução do Planejamento ("Bonificação" e "Mão de obra estimada"), a baixa de
  // título de folha, a distribuição do EVM e o lançamento manual. Comparar a folha contra a soma
  // de todos acusa um rombo permanente que é, na verdade, o mesmo trabalho lançado várias vezes —
  // e a tela escrevia "saiu X a mais do que a folha explica" em cima disso.
  const r = montar({
    entries: [
      saida({ valor: 2000, categoria: 'mao_de_obra', sourceRdoId: 'rdo-1' }),  // a ponte
      saida({ valor: 3500, categoria: 'mao_de_obra' }),                        // plano de execução
      saida({ valor: 2000, categoria: 'mao_de_obra' }),                        // baixa do título
    ],
    workers: [trab()],
    shifts:  [turno(), turno({ date: '2026-08-04' })],
  })
  assert.ok(r.folhaDaObraBRL > 0, 'a folha foi calculada')
  assert.equal(r.saidaMaoDeObraBRL, 7500, 'a categoria inteira continua visível no bloco de saídas')
  assert.equal(r.saidaMaoDeObraRdoBRL, 2000, 'mas só a ponte entra na conferência')
  assert.equal(r.saidaMaoDeObraOutrasBRL, 5500)
  assert.equal(r.diferencaFolhaCaixaBRL, Math.round((r.folhaDaObraBRL - 2000) * 100) / 100)
  // O retrato NÃO expõe nenhum campo que some folha com lançamento.
  assert.ok(!('custoTotalBRL' in r), 'apareceu um total somando folha com caixa')
})

test('sem lançamento do RDO, a conferência é contra zero — e não contra o plano', () => {
  const r = montar({
    entries: [saida({ valor: 9999, categoria: 'mao_de_obra' })],
    workers: [trab()], shifts: [turno()],
  })
  assert.equal(r.saidaMaoDeObraRdoBRL, 0)
  assert.equal(r.saidaMaoDeObraOutrasBRL, 9999)
  assert.equal(r.diferencaFolhaCaixaBRL, r.folhaDaObraBRL, 'a folha inteira fica sem contrapartida do RDO')
})

test('a folha só conta turnos do mês pedido', () => {
  const doMes  = montar({ workers: [trab()], shifts: [turno({ date: '2026-08-05' })] })
  const deOutro = montar({ workers: [trab()], shifts: [turno({ date: '2026-07-05' })] })
  assert.ok(doMes.folhaDaObraBRL > 0)
  assert.equal(deOutro.folhaDaObraBRL, 0, 'turno de julho não entra em agosto')
})

test('quem não está na folha não custa — desligado e suspenso ficam de fora', () => {
  for (const status of ['inactive', 'suspended', 'pending_approval'] as const) {
    const r = montar({ workers: [trab({ status })], shifts: [turno()] })
    assert.equal(r.folhaDaObraBRL, 0, `${status} entrou no custo`)
  }
})

// ── O estado vazio ────────────────────────────────────────────────────────────

test('obra sem contrato, sem lançamento e sem folha diz que não tem dado', () => {
  assert.equal(montar().temDados, false)
})

test('qualquer uma das três fontes já basta para haver retrato', () => {
  assert.equal(montar({ entries: [saida({ valor: 1 })] }).temDados, true)
  assert.equal(montar({ site: obra({ contrato: { services: [], valorServico: 1 } }) }).temDados, true)
  assert.equal(montar({ workers: [trab()], shifts: [turno()] }).temDados, true)
})

// ── Período malformado ────────────────────────────────────────────────────────

test('⚠️ período inválido devolve janela vazia — não o ano inteiro', () => {
  // `<input type="month">` vira caixa de texto no Firefox e no Safari de desktop, e o valor é
  // persistido. Com '2026', a versão anterior devolvia `ate: '2026-NaN'`; como `filterEntries`
  // compara STRING, '2026-03-15' <= '2026-NaN' é verdadeiro e o ANO INTEIRO entrava na soma.
  for (const ruim of ['2026', '', '2026-13', '2026-00', 'agosto', '2026-8', '2026-08-01']) {
    assert.deepEqual(limitesDoMes(ruim), { de: '', ate: '' }, `"${ruim}" passou`)
  }
})

test('com período inválido, o retrato não soma nada — nem lançamento, nem folha', () => {
  const r = montar({
    period: '2026',
    entries: [saida({ valor: 5000, data: '2026-03-15' }), saida({ valor: 7000, data: '2026-11-02' })],
    workers: [trab()], shifts: [turno()],
  })
  assert.equal(r.saidasBRL, 0, 'o ano inteiro entrou na soma de um mês')
  assert.equal(r.folhaDaObraBRL, 0)
  assert.deepEqual(r.saidasPorCategoria, [])
})

// ── O contrato fechando a conta ───────────────────────────────────────────────

test('o faturado sai quebrado: serviço − faturado de serviço = saldo', () => {
  // Antes só existia `faturadoBRL` (serviço + material) ao lado do saldo de serviço. O leitor
  // subtraía e achava uma diferença do tamanho do material faturado.
  const r = montar({ site: obra({ contrato: {
    services: [], valorServico: 592324.14, valorMaterial: 607620,
    faturamentos: [
      { id: 'n1', data: '2026-01-10', valor: 138558.20, situacao: 'recebido', categoria: 'servico' },
      { id: 'n2', data: '2026-02-10', valor: 200000.00, situacao: 'recebido', categoria: 'material' },
    ],
  } }) })
  assert.equal(r.faturadoBRL, 338558.20, 'o total continua disponível')
  assert.equal(r.faturadoServicoBRL, 138558.20)
  assert.equal(r.faturadoMaterialBRL, 200000)
  assert.equal(
    Math.round((r.contratoServicoBRL - r.faturadoServicoBRL) * 100) / 100,
    r.saldoServicoBRL,
    'a conta que o leitor faz de cabeça tem de fechar',
  )
})
