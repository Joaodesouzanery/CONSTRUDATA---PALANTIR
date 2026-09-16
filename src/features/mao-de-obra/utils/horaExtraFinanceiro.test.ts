/**
 * A ponte "marquei Pago" → despesa: o que precisa ser verdade para o caixa não pagar duas vezes.
 *
 * `lancamentoDaHoraExtra` é pura e é testada de verdade. O wiring do store (marcar/desmarcar) é
 * verificado no texto do arquivo — mesmo padrão de `financeiroTitulosStore.test.ts`: montar
 * zustand + persist + auth + fila de sync só para checar uma guarda custa mais do que vale.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { lancamentoDaHoraExtra, descricaoDaHoraExtra, idDoLancamentoDaHoraExtra } from '@/features/mao-de-obra/utils/horaExtraFinanceiro'
import type { HoraExtra } from '@/types'

const base: HoraExtra = {
  id: 'he-1',
  workerId: 'w-1',
  workerNome: 'ANDERSON DE ASSIS',
  cargo: 'ENCANADOR DE ÁGUA I',
  data: '2026-08-01',
  tipo: 'fim-de-semana',
  valor: 350,
  pago: true,
  pagoEm: '2026-08-05',
  pagoPor: 'Raquel',
  origem: 'manual',
  createdAt: '2026-08-01T00:00:00.000Z',
}

async function codigoDoStore(): Promise<string> {
  const bruto = await readFile(new URL('../../../store/maoDeObraStore.ts', import.meta.url), 'utf8')
  return bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * ⚠️ Os marcos precisam ser a assinatura da IMPLEMENTAÇÃO (`nome: (id) => {`), nunca só `nome:` —
 * a interface declara os mesmos nomes bem antes, e um marco de fim que casa com a interface
 * devolve um corte vazio, que passa como se tivesse conferido. Já aconteceu em
 * `financeiroTitulosStore.test.ts` com `addBoleto:`.
 */
function corpoDaAcao(codigo: string, de: string, ate: string): string {
  const inicio = codigo.indexOf(de)
  const fim = codigo.indexOf(ate)
  assert.ok(inicio >= 0, `não achei a implementação de ${de}`)
  assert.ok(fim > inicio, `o marco de fim (${ate}) casou antes do início — corte vazio`)
  return codigo.slice(inicio, fim)
}

test('lancamentoDaHoraExtra: vira SAÍDA em mão de obra, subcategoria horas_extras', () => {
  const e = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  assert.equal(e.tipo, 'saida')
  assert.equal(e.categoria, 'mao_de_obra')
  assert.equal(e.subcategoria, 'horas_extras')
  assert.equal(e.origem, 'horas-extras')
  assert.equal(e.valor, 350)
  assert.equal(e.funcionarioNome, 'ANDERSON DE ASSIS')
})

test('lancamentoDaHoraExtra: a data é a do PAGAMENTO, não a do trabalho', () => {
  const e = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  assert.equal(e.data, '2026-08-05', 'o dinheiro saiu no dia 05 — é esse mês que o caixa enxerga')
  // Sem data de pagamento, cai na data do trabalho: melhor a competência certa do que hoje.
  const semPagamento = lancamentoDaHoraExtra({ ...base, pagoEm: undefined }, 'org-1', { agora: '2026-09-30T12:00:00.000Z' })
  assert.equal(semPagamento.data, '2026-08-01')
})

test('lancamentoDaHoraExtra: o id é derivado — marcar duas vezes escreve a MESMA linha', () => {
  const a = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  const b = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-09-01T12:00:00.000Z' })
  assert.equal(a.id, b.id, 'id sorteado duplicaria a despesa a cada clique')
  assert.equal(a.id, idDoLancamentoDaHoraExtra('org-1', 'he-1'))
})

test('lancamentoDaHoraExtra: empresas diferentes nunca compartilham o id do lançamento', () => {
  assert.notEqual(idDoLancamentoDaHoraExtra('org-1', 'he-1'), idDoLancamentoDaHoraExtra('org-2', 'he-1'))
})

test('descricaoDaHoraExtra: o extrato diz quem e quando, sem abrir o sistema', () => {
  assert.equal(descricaoDaHoraExtra(base), 'Hora extra — ANDERSON DE ASSIS (01/08/2026)')
})

test('descricaoDaHoraExtra: ponto-saída usa os dias que a linha de fato cobre', () => {
  const agregada: HoraExtra = {
    ...base, tipo: 'ponto-saida', valor: 203.64,
    detalhe: { horasDescontadas: 8, horasExtras: 9, salario: 2000, fatorAdicional: 1.6, diasTexto: '13 e 20/08' },
  }
  assert.equal(descricaoDaHoraExtra(agregada), 'Ponto saída — devolução + HE — ANDERSON DE ASSIS (13 e 20/08)')
})

test('marcarHoraExtraPaga: a guarda é por entryId, NÃO por pago (ARMADILHA #5)', async () => {
  const s = await codigoDoStore()
  const corpo = corpoDaAcao(s, 'marcarHoraExtraPaga: (id, opcoes) => {', 'desmarcarHoraExtraPaga: (id) => {')
  assert.match(corpo, /if \(he\.entryId\) return/, 'guardar por entryId é o que torna o clique idempotente')
  assert.doesNotMatch(
    corpo, /if \(he\.pago\) return/,
    'guardar por `pago` travaria para sempre o registro que ficou pago-sem-lançamento — foi ' +
      'exatamente o bug do título "Recebido"',
  )
})

test('marcarHoraExtraPaga: gera a despesa; desmarcar a REMOVE', async () => {
  const s = await codigoDoStore()
  const marcar = corpoDaAcao(s, 'marcarHoraExtraPaga: (id, opcoes) => {', 'desmarcarHoraExtraPaga: (id) => {')
  assert.match(marcar, /lancamentoDaHoraExtra\(/)
  assert.match(marcar, /addEntry\(lancamento, \{ respectObra: true \}\)/,
    'sem respectObra a barra lateral carimbaria a obra ativa numa HE que não é de obra nenhuma')

  const desmarcar = corpoDaAcao(s, 'desmarcarHoraExtraPaga: (id) => {', 'addTimecard: (entry) => {')
  assert.match(desmarcar, /removeEntry\(entryId\)/, 'desmarcar tem que estornar — nunca sumir calado')
  assert.match(desmarcar, /entryId: undefined/, 'e limpar o vínculo, senão a remarcação não gera nada')
})

test('removeHoraExtra: apagar uma HE paga leva a despesa junto', async () => {
  const s = await codigoDoStore()
  const corpo = corpoDaAcao(s, 'removeHoraExtra: (id) => {', 'marcarHoraExtraPaga: (id, opcoes) => {')
  assert.match(corpo, /desmarcarHoraExtraPaga\(id\)/, 'senão fica lançamento no caixa sem origem nenhuma')
})
