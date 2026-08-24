/**
 * Importar a composição — planilha e colar do Excel.
 *
 * O formato real: proposta com ITEM · DESCRIÇÃO · UN · QTD · Mão de obra · TOTAL, com linha em
 * `vb` (frete) e em `un` (lombadas) no meio.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  sugerirCampo, mapearAutomatico, detectarConflitos, lerTabelaColada, aplicarMapeamento,
} from './composicaoImport'

// ── Adivinhar a coluna ────────────────────────────────────────────────────────

test('os cabeçalhos da proposta caem nos campos certos', () => {
  assert.equal(sugerirCampo('ITEM'), 'ordem')
  assert.equal(sugerirCampo('DESCRIÇÃO'), 'descricao')
  assert.equal(sugerirCampo('UN'), 'unidade')
  assert.equal(sugerirCampo('QTD'), 'qtdContrato')
  assert.equal(sugerirCampo('Mão de obra'), 'valorUnitario')
  assert.equal(sugerirCampo('TOTAL'), 'total')
})

test('acento e caixa não atrapalham', () => {
  assert.equal(sugerirCampo('descricao'), 'descricao')
  assert.equal(sugerirCampo('Descrição do Serviço'), 'descricao')
  assert.equal(sugerirCampo('QUANTIDADE'), 'qtdContrato')
})

test('"Preço de material" não é confundido com o preço de mão de obra', () => {
  assert.equal(sugerirCampo('Preço de material'), 'valorMaterialUnit')
  assert.equal(sugerirCampo('Material'), 'valorMaterialUnit')
  assert.equal(sugerirCampo('Preço unitário'), 'valorUnitario')
})

test('"mo" não casa dentro de "montante" — a fronteira de palavra segura isso', () => {
  assert.notEqual(sugerirCampo('Montante'), 'valorUnitario')
})

test('coluna desconhecida é ignorada, não chutada', () => {
  assert.equal(sugerirCampo('Observações do fiscal'), 'ignorar')
  assert.equal(sugerirCampo(''), 'ignorar')
})

test('duas colunas para o mesmo campo viram conflito para o usuário desempatar', () => {
  const mapa = mapearAutomatico(['Descrição', 'Descricao', 'QTD'])
  const conflitos = detectarConflitos(mapa)
  assert.equal(conflitos.length, 1)
  assert.equal(conflitos[0].campo, 'descricao')
  assert.equal(conflitos[0].cabecalhos.length, 2)
  // 'ignorar' nunca é conflito, por mais colunas que apontem para ele.
  assert.deepEqual(detectarConflitos({ a: 'ignorar', b: 'ignorar' }), [])
})

// ── Colar do Excel ────────────────────────────────────────────────────────────

test('colar TSV do Excel vira tabela', () => {
  const t = lerTabelaColada('ITEM\tDESCRIÇÃO\tQTD\n1\tPintura\t100\n2\tLombada\t4')
  assert.deepEqual(t.headers, ['ITEM', 'DESCRIÇÃO', 'QTD'])
  assert.equal(t.rows.length, 2)
  assert.equal(t.rows[0]['DESCRIÇÃO'], 'Pintura')
})

test('CSV com ponto-e-vírgula também funciona (é o que o Excel em português salva)', () => {
  const t = lerTabelaColada('ITEM;DESCRIÇÃO;QTD\n1;Pintura;100')
  assert.deepEqual(t.headers, ['ITEM', 'DESCRIÇÃO', 'QTD'])
  assert.equal(t.rows[0]['QTD'], '100')
})

test('linha em branco no meio não vira linha', () => {
  const t = lerTabelaColada('A\tB\n1\t2\n\n3\t4\n')
  assert.equal(t.rows.length, 2)
})

test('coluna sem título ganha nome, para não colidir com outra vazia', () => {
  const t = lerTabelaColada('A\t\t\n1\t2\t3')
  assert.equal(new Set(t.headers).size, 3, 'três chaves distintas')
})

test('texto vazio não quebra', () => {
  assert.deepEqual(lerTabelaColada(''), { headers: [], rows: [] })
  assert.deepEqual(lerTabelaColada('   \n  '), { headers: [], rows: [] })
})

// ── Converter em itens do contrato ────────────────────────────────────────────

const PROPOSTA = lerTabelaColada([
  'ITEM\tDESCRIÇÃO\tUN\tQTD\tMão de obra\tMaterial\tTOTAL',
  '1\tPintura epóxi em piso\tm²\t100\t28,94\t10,00\t3894,00',
  '2\tLombadas\tun\t4\t0\t250,00\t1000,00',
  '3\tFrete Previsto\tvb\t1,00\t1000,00\t0\t1000,00',
].join('\n'))

test('a proposta inteira entra com os dois preços por linha', () => {
  const itens = aplicarMapeamento(PROPOSTA.rows, mapearAutomatico(PROPOSTA.headers))
  assert.equal(itens.length, 3)
  const piso = itens[0]
  assert.equal(piso.descricao, 'Pintura epóxi em piso')
  assert.equal(piso.unidade, 'm²')
  assert.equal(piso.qtdContrato, 100)
  assert.equal(piso.valorUnitario, 28.94)
  assert.equal(piso.valorMaterialUnit, 10)
  assert.equal(piso.ordem, 1)
})

test('a unidade é normalizada para o vocabulário do sistema', () => {
  const t = lerTabelaColada('DESCRIÇÃO\tUN\nA\tM2\nB\tmetros\nC\tUN\nD\tvb')
  const itens = aplicarMapeamento(t.rows, mapearAutomatico(t.headers))
  assert.equal(itens[0].unidade, 'm²', 'M2 vira m²')
  assert.equal(itens[1].unidade, 'm', 'metros vira m')
  assert.equal(itens[2].unidade, 'un', 'un é preservado')
  assert.equal(itens[3].unidade, 'vb')
})

test('verba trava a quantidade em 1, mesmo se a planilha disser outra coisa', () => {
  const t = lerTabelaColada('DESCRIÇÃO\tUN\tQTD\tMão de obra\nFrete\tvb\t7\t1000')
  const [item] = aplicarMapeamento(t.rows, mapearAutomatico(t.headers))
  assert.equal(item.qtdContrato, 1, 'verba é valor fechado — qtd 1 faz qtd × preço dar o valor')
  assert.equal(item.valorUnitario, 1000)
})

test('linha sem descrição é descartada (subtotal, linha em branco)', () => {
  const t = lerTabelaColada('DESCRIÇÃO\tQTD\nPintura\t10\n\t99\nSUBTOTAL\t0')
  const itens = aplicarMapeamento(t.rows, mapearAutomatico(t.headers))
  assert.deepEqual(itens.map((i) => i.descricao), ['Pintura', 'SUBTOTAL'],
    'só a linha realmente vazia sai; "SUBTOTAL" tem texto e fica para o usuário decidir')
})

test('o TOTAL da planilha é conferência, não é gravado', () => {
  const t = lerTabelaColada('DESCRIÇÃO\tQTD\tMão de obra\tTOTAL\nPintura\t10\t5,00\t50,00')
  const [ok] = aplicarMapeamento(t.rows, mapearAutomatico(t.headers))
  assert.equal(ok.aviso, undefined, '10 × 5 = 50, bate')
  assert.ok(!('total' in ok), 'o total não vira campo do item')

  const t2 = lerTabelaColada('DESCRIÇÃO\tQTD\tMão de obra\tTOTAL\nPintura\t10\t5,00\t999,00')
  const [erro] = aplicarMapeamento(t2.rows, mapearAutomatico(t2.headers))
  assert.match(erro.aviso ?? '', /999\.00.*50\.00/, 'a divergência é apontada, mas não bloqueia')
})

test('a categoria vem por texto, em português', () => {
  const t = lerTabelaColada('DESCRIÇÃO\tCategoria\nA\tMaterial\nB\tFrete\nC\tServiço\nD\tEquipamento\nE\tqualquer coisa')
  const itens = aplicarMapeamento(t.rows, mapearAutomatico(t.headers))
  assert.equal(itens[0].categoria, 'material')
  assert.equal(itens[1].categoria, 'frete')
  assert.equal(itens[2].categoria, 'servico')
  assert.equal(itens[3].categoria, 'equipamento')
  assert.equal(itens[4].categoria, undefined, 'texto que não reconheço não vira categoria chutada')
})

test('sem coluna nenhuma mapeada, nada é importado — em vez de linhas vazias', () => {
  const t = lerTabelaColada('A\tB\n1\t2')
  assert.deepEqual(aplicarMapeamento(t.rows, { A: 'ignorar', B: 'ignorar' }), [])
})
