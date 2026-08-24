/**
 * A ponte extrato → Financeiro. O risco aqui é cobrança duplicada, então é ele que os testes
 * cercam: o mesmo extrato processado duas vezes tem de produzir UM título, não dois.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  titulosDoFaturamento, titulosObsoletos, idTituloDaNota, notaGeraTitulo, lancamentosDuplicados,
} from './faturamentoParaFinanceiro'
import type { ConstructionSite, FinanceiroEntry, FinanceiroTitulo, ObraFaturamento } from '@/types'

const nota = (p: Partial<ObraFaturamento>): ObraFaturamento => ({
  id: 'n1', data: '2026-08-01', valor: 1000, situacao: 'a_receber', ...p,
})

const obra = (faturamentos: ObraFaturamento[]): ConstructionSite => ({
  id: 'obra-1', name: 'SUPERA', owner: 'Cliente X', company: 'Compizzo',
  contrato: { services: [], contratanteRazao: 'SUPERA EMPREENDIMENTOS', faturamentos },
} as unknown as ConstructionSite)

test('nota a receber vira título pendente; nota recebida vira título JÁ BAIXADO', () => {
  // Mudou em 24/08/2026. Antes a nota recebida simplesmente sumia, e por isso o extrato da obra
  // nunca produzia receita no Fluxo de Caixa nem no DRE.
  const t = titulosDoFaturamento(obra([
    nota({ id: 'a', valor: 10000, situacao: 'a_receber', previsaoRecebimento: '2026-09-05' }),
    nota({ id: 'b', valor: 20000, situacao: 'recebido', data: '2026-08-10', dataRecebimento: '2026-08-12' }),
  ]))
  assert.equal(t.length, 2)

  const pendente = t.find((x) => x.valor === 10000)!
  assert.equal(pendente.status, 'pendente')
  assert.equal(pendente.tipo, 'receber')
  assert.equal(pendente.obraId, 'obra-1')

  const pago = t.find((x) => x.valor === 20000)!
  assert.equal(pago.status, 'pago')
  assert.equal(pago.dataPagamento, '2026-08-12', 'a receita entra na data do recebimento')
})

test('nota que NASCE recebida cria e baixa num passo só — um lançamento, nunca dois', () => {
  const t = titulosDoFaturamento(obra([nota({ id: 'a', valor: 5000, situacao: 'recebido', data: '2026-08-01' })]))
  assert.equal(t.length, 1)
  assert.equal(t[0].status, 'pago')
  assert.equal(t[0].dataPagamento, '2026-08-01', 'sem data de recebimento, usa a da nota')
})

test('nota de MATERIAL não gera título nenhum — o dinheiro não passa pela empresa', () => {
  assert.ok(!notaGeraTitulo(nota({ valor: 100, categoria: 'material' })))
  assert.ok(notaGeraTitulo(nota({ valor: 100, categoria: 'servico' })))
  assert.ok(notaGeraTitulo(nota({ valor: 100 })), 'sem categoria é serviço')

  const t = titulosDoFaturamento(obra([
    nota({ id: 'a', valor: 10000, categoria: 'servico' }),
    nota({ id: 'b', valor: 99999, categoria: 'material' }),
  ]))
  assert.deepEqual(t.map((x) => x.valor), [10000])
})

test('o mesmo extrato processado duas vezes produz UM título, não dois', () => {
  // É o teste que importa: sem id determinístico, cada abertura da tela criaria outra cobrança.
  const site = obra([nota({ id: 'a', valor: 10000, previsaoRecebimento: '2026-09-05' })])
  const primeira = titulosDoFaturamento(site)
  const segunda  = titulosDoFaturamento(site)
  assert.equal(primeira[0].id, segunda[0].id)
})

test('notas diferentes nunca colidem, nem entre obras', () => {
  const ids = new Set([
    idTituloDaNota('obra-1', nota({ id: 'a' })),
    idTituloDaNota('obra-1', nota({ id: 'b' })),
    idTituloDaNota('obra-2', nota({ id: 'a' })),
  ])
  assert.equal(ids.size, 3)
})

test('o vencimento é a previsão; sem previsão, cai na data de emissão', () => {
  const comPrevisao = titulosDoFaturamento(obra([nota({ id: 'a', data: '2026-08-01', previsaoRecebimento: '2026-09-05' })]))
  assert.equal(comPrevisao[0].vencimento, '2026-09-05')
  // Título sem vencimento não aparece em nenhum relatório de fluxo de caixa — a data de emissão
  // é imprecisa, mas visível, que é melhor do que sumir.
  const semPrevisao = titulosDoFaturamento(obra([nota({ id: 'a', data: '2026-08-01', previsaoRecebimento: undefined })]))
  assert.equal(semPrevisao[0].vencimento, '2026-08-01')
})

test('a entrada é categorizada como adiantamento; as demais, como medição', () => {
  const t = titulosDoFaturamento(obra([
    nota({ id: 'a', descricao: 'Entrada Serviço', entrada: true, previsaoRecebimento: '2026-09-01' }),
    nota({ id: 'b', descricao: '2ª medição', previsaoRecebimento: '2026-10-01' }),
  ]))
  assert.equal(t.find((x) => x.numeroDoc === undefined && x.descricao === 'Entrada Serviço')?.categoria, 'adiantamento')
  assert.equal(t.find((x) => x.descricao === '2ª medição')?.categoria, 'medicao')
})

test('nota de valor zero ou negativo não vira cobrança', () => {
  assert.equal(titulosDoFaturamento(obra([nota({ id: 'a', valor: 0 })])).length, 0)
  assert.equal(titulosDoFaturamento(obra([nota({ id: 'a', valor: -50 })])).length, 0)
})

test('o parceiro é o contratante do contrato', () => {
  const t = titulosDoFaturamento(obra([nota({ id: 'a', previsaoRecebimento: '2026-09-05' })]))
  assert.equal(t[0].parceiro, 'SUPERA EMPREENDIMENTOS')
})

// ── Baixa e exclusão ──────────────────────────────────────────────────────────

test('nota que passou a "recebido" NÃO some — o mesmo título é baixado', () => {
  // O id é determinístico, então o upsert atualiza o título existente em vez de criar outro.
  const antes = obra([nota({ id: 'a', valor: 10000, situacao: 'a_receber', previsaoRecebimento: '2026-09-05' })])
  const titulos = titulosDoFaturamento(antes) as FinanceiroTitulo[]
  assert.equal(titulos[0].status, 'pendente')

  const depois = obra([nota({ id: 'a', valor: 10000, situacao: 'recebido', dataRecebimento: '2026-09-04' })])
  assert.deepEqual(titulosObsoletos(depois, titulos), [], 'nada a remover')
  const novos = titulosDoFaturamento(depois)
  assert.equal(novos[0].id, titulos[0].id, 'é o MESMO título')
  assert.equal(novos[0].status, 'pago')
})

test('nota que vira MATERIAL tem a cobrança removida', () => {
  // Aqui sim: o título deixou de fazer sentido, porque material de terceiro não é receita.
  const antes = obra([nota({ id: 'a', valor: 10000, categoria: 'servico' })])
  const titulos = titulosDoFaturamento(antes) as FinanceiroTitulo[]
  const depois = obra([nota({ id: 'a', valor: 10000, categoria: 'material' })])
  assert.deepEqual(titulosObsoletos(depois, titulos), [titulos[0].id])
})

test('nota apagada do extrato NÃO derruba a cobrança que ela gerou', () => {
  // Escolha deliberada: apagar a linha do contrato pode ser correção de digitação, mas o título
  // já pode ter sido conciliado no Financeiro. Some da carteira, não do caixa — quem apaga uma
  // cobrança é o módulo financeiro, com a conferência dele.
  const antes = obra([nota({ id: 'a', valor: 10000, previsaoRecebimento: '2026-09-05' })])
  const titulos = titulosDoFaturamento(antes) as FinanceiroTitulo[]
  assert.deepEqual(titulosObsoletos(obra([]), titulos), [])
})

test('título de outra obra nunca é tocado', () => {
  const alheio: FinanceiroTitulo = {
    id: 'x', tipo: 'receber', descricao: 'outro', parceiro: 'y', valor: 1,
    vencimento: '2026-09-01', obraId: 'obra-2', status: 'pendente', createdAt: '',
  }
  assert.deepEqual(titulosObsoletos(obra([]), [alheio]), [])
})

test('obra sem extrato não gera nem remove nada', () => {
  assert.deepEqual(titulosDoFaturamento(obra([])), [])
  assert.deepEqual(titulosObsoletos(obra([]), []), [])
})


// ── A trava contra receita dobrada ────────────────────────────────────────────

const entry = (p: Partial<FinanceiroEntry>): FinanceiroEntry => ({
  id: Math.random().toString(36).slice(2), tipo: 'entrada', data: '2026-08-12',
  valor: 0, descricao: 'recebimento', categoria: 'medicao', ...p,
} as FinanceiroEntry)

test('acha o lançamento manual que é o mesmo dinheiro da nota', () => {
  // O cenário real: o cliente já lançava esses recebimentos à mão em Entradas/Saídas. Ao passar a
  // gerar receita pelo contrato, sem esta trava a receita entraria duas vezes.
  const site = obra([nota({ id: 'a', valor: 20000, situacao: 'recebido', dataRecebimento: '2026-08-12' })])
  const achados = lancamentosDuplicados(site, [
    entry({ valor: 20000, data: '2026-08-13', obraId: 'obra-1' }),
  ])
  assert.equal(achados.length, 1)
  assert.equal(achados[0].dias, 1)
})

test('valor diferente não é duplicata, por mais perto que esteja a data', () => {
  const site = obra([nota({ id: 'a', valor: 20000, situacao: 'recebido', dataRecebimento: '2026-08-12' })])
  assert.deepEqual(lancamentosDuplicados(site, [entry({ valor: 20500, data: '2026-08-12', obraId: 'obra-1' })]), [])
})

test('lançamento de OUTRA obra nunca é apontado', () => {
  const site = obra([nota({ id: 'a', valor: 20000, situacao: 'recebido', dataRecebimento: '2026-08-12' })])
  assert.deepEqual(lancamentosDuplicados(site, [entry({ valor: 20000, data: '2026-08-12', obraId: 'obra-2' })]), [])
})

test('lançamento longe no tempo não é duplicata', () => {
  const site = obra([nota({ id: 'a', valor: 20000, situacao: 'recebido', dataRecebimento: '2026-08-12' })])
  assert.deepEqual(lancamentosDuplicados(site, [entry({ valor: 20000, data: '2026-09-30', obraId: 'obra-1' })]), [])
})

test('lançamento que o PRÓPRIO sistema gerou não conta como duplicata', () => {
  // Ele tem `sourceTituloId` — não é digitação manual, é o nosso. Sem esta exceção, todo
  // recebimento acusaria duplicidade contra si mesmo.
  const site = obra([nota({ id: 'a', valor: 20000, situacao: 'recebido', dataRecebimento: '2026-08-12' })])
  assert.deepEqual(
    lancamentosDuplicados(site, [entry({ valor: 20000, data: '2026-08-12', obraId: 'obra-1', sourceTituloId: 'x' })]),
    [],
  )
})

test('nota ainda a receber não dispara a trava — não virou receita', () => {
  const site = obra([nota({ id: 'a', valor: 20000, situacao: 'a_receber', previsaoRecebimento: '2026-08-12' })])
  assert.deepEqual(lancamentosDuplicados(site, [entry({ valor: 20000, data: '2026-08-12', obraId: 'obra-1' })]), [])
})

test('saída nunca é confundida com recebimento', () => {
  const site = obra([nota({ id: 'a', valor: 20000, situacao: 'recebido', dataRecebimento: '2026-08-12' })])
  assert.deepEqual(
    lancamentosDuplicados(site, [entry({ tipo: 'saida', valor: 20000, data: '2026-08-12', obraId: 'obra-1' })]),
    [],
  )
})
