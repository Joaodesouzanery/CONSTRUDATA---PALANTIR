/**
 * A ponte extrato → Financeiro. O risco aqui é cobrança duplicada, então é ele que os testes
 * cercam: o mesmo extrato processado duas vezes tem de produzir UM título, não dois.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { titulosDoFaturamento, titulosObsoletos, idTituloDaNota } from './faturamentoParaFinanceiro'
import type { ConstructionSite, FinanceiroTitulo, ObraFaturamento } from '@/types'

const nota = (p: Partial<ObraFaturamento>): ObraFaturamento => ({
  id: 'n1', data: '2026-08-01', valor: 1000, situacao: 'a_receber', ...p,
})

const obra = (faturamentos: ObraFaturamento[]): ConstructionSite => ({
  id: 'obra-1', name: 'SUPERA', owner: 'Cliente X', company: 'Compizzo',
  contrato: { services: [], contratanteRazao: 'SUPERA EMPREENDIMENTOS', faturamentos },
} as unknown as ConstructionSite)

test('só a nota "a receber" vira título — a recebida é histórico, não cobrança', () => {
  const t = titulosDoFaturamento(obra([
    nota({ id: 'a', valor: 10000, situacao: 'a_receber', previsaoRecebimento: '2026-09-05' }),
    nota({ id: 'b', valor: 20000, situacao: 'recebido' }),
  ]))
  assert.equal(t.length, 1)
  assert.equal(t[0].valor, 10000)
  assert.equal(t[0].tipo, 'receber')
  assert.equal(t[0].status, 'pendente')
  assert.equal(t[0].obraId, 'obra-1')
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

test('nota que passou a "recebido" tem a cobrança removida', () => {
  // Sem isto, dar baixa no contrato deixaria o título vivo no Financeiro para sempre.
  const antes = obra([nota({ id: 'a', valor: 10000, situacao: 'a_receber', previsaoRecebimento: '2026-09-05' })])
  const titulos = titulosDoFaturamento(antes) as FinanceiroTitulo[]

  const depois = obra([nota({ id: 'a', valor: 10000, situacao: 'recebido' })])
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
