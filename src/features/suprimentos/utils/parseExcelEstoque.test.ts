/**
 * O mapeamento de colunas da planilha do almoxarifado.
 *
 * ─── O DEFEITO QUE ESTE ARQUIVO EXISTE PARA IMPEDIR ───────────────────────────────────────────
 * A regra antiga devolvia o PRIMEIRO campo cuja dica estivesse contida no cabeçalho. Com a
 * planilha real do cliente, "Quantidade Crítica" caía em `qtdDisponivel` (a dica 'quantidade' está
 * contida nela) e "Link do Produto" caía em `descricao` (a dica 'produto'). Como o mapa invertido
 * deixava a última coluna vencer, os 23 produtos eram gravados chamados "[URL]" com saldo zero.
 *
 * Os nove cabeçalhos abaixo são os do arquivo do cliente, na ordem em que aparecem nele.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { autoSuggestField, applyColumnMapping, detectarConflitos } from './parseExcelEstoque'

/** Os cabeçalhos exatos da planilha "Controle de Estoque" da Compizzo. */
const CABECALHOS = [
  'Produto', 'Quantidade', 'Unidade', 'Fornecedor Principal', 'Código de Referência',
  'Quantidade Crítica', 'Realizar Pedido', 'Data do Último Pedido', 'Link do Produto',
] as const

const mapearTudo = () =>
  Object.fromEntries(CABECALHOS.map((h) => [h, autoSuggestField(h)])) as Record<string, string>

test('a planilha real do cliente mapeia as nove colunas para os campos certos', () => {
  assert.deepEqual(mapearTudo(), {
    'Produto':               'descricao',
    'Quantidade':            'qtdDisponivel',
    'Unidade':               'unidade',
    'Fornecedor Principal':  'fornecedorPrincipal',
    'Código de Referência':  'codigoReferencia',
    'Quantidade Crítica':    'estoqueMinimo',
    'Realizar Pedido':       'realizarPedido',
    'Data do Último Pedido': 'dataUltimoPedido',
    'Link do Produto':       'linkProduto',
  })
})

test('a dica mais específica vence a mais curta', () => {
  // 'quantidade critica' (18 chars) tem de ganhar de 'quantidade' (10).
  assert.equal(autoSuggestField('Quantidade Crítica'), 'estoqueMinimo')
  assert.equal(autoSuggestField('Qtd Crítica'), 'estoqueMinimo')
  // E o caso simples continua indo para o saldo.
  assert.equal(autoSuggestField('Quantidade'), 'qtdDisponivel')
  assert.equal(autoSuggestField('Saldo'), 'qtdDisponivel')
})

test('"Link do Produto" não rouba o lugar de "Produto"', () => {
  assert.equal(autoSuggestField('Link do Produto'), 'linkProduto')
  assert.equal(autoSuggestField('Produto'), 'descricao')
  assert.equal(autoSuggestField('URL'), 'linkProduto')
})

test('acento e caixa não mudam o resultado', () => {
  for (const variacao of ['CÓDIGO DE REFERÊNCIA', 'codigo de referencia', 'Código De Referencia']) {
    assert.equal(autoSuggestField(variacao), 'codigoReferencia', variacao)
  }
})

test('cabeçalho desconhecido é ignorado em vez de cair em qualquer campo', () => {
  assert.equal(autoSuggestField('Observações do almoxarife'), 'ignorar')
  assert.equal(autoSuggestField(''), 'ignorar')
})

// ─── A gravação ────────────────────────────────────────────────────────────────

/** A primeira linha real do arquivo do cliente, com as células vazias que ele tem de verdade. */
const LINHA_REAL = {
  'Produto': 'Base cinza N6,5 autonivelante (5,5kg)',
  'Quantidade': '31un',
  'Unidade': 'un',
  'Fornecedor Principal': '',
  'Código de Referência': '',
  'Quantidade Crítica': '',
  'Realizar Pedido': '',
  'Data do Último Pedido': 'dd/mm/yyyy',
  'Link do Produto': 'https://fornecedor.exemplo/base-cinza',
}

test('a primeira linha da planilha real sai com nome, saldo e link corretos', () => {
  const [item] = applyColumnMapping([LINHA_REAL], mapearTudo())
  assert.equal(item.descricao, 'Base cinza N6,5 autonivelante (5,5kg)')
  assert.equal(item.qtdDisponivel, 31, 'o "31un" precisa virar 31, não 0')
  assert.equal(item.unidade, 'un')
  assert.equal(item.linkProduto, 'https://fornecedor.exemplo/base-cinza')
})

test('célula em branco é "não informado", não zero', () => {
  const [item] = applyColumnMapping([LINHA_REAL], mapearTudo())
  // Quantidade Crítica está vazia nas 23 linhas do arquivo. Se virasse 0, a gravação apagaria o
  // estoque mínimo que já existia no sistema.
  assert.equal(item.estoqueMinimo, undefined)
  assert.equal(item.fornecedorPrincipal, undefined)
  assert.equal(item.codigoReferencia, undefined)
  // "dd/mm/yyyy" é o texto-modelo da planilha, não uma data.
  assert.equal(item.dataUltimoPedido, undefined)
})

test('quantidade em branco não zera o saldo', () => {
  const [item] = applyColumnMapping([{ ...LINHA_REAL, 'Quantidade': '' }], mapearTudo())
  assert.equal(item.qtdDisponivel, undefined, 'sem quantidade na planilha, o saldo do sistema manda')
})

test('a planilha dizendo zero é diferente de não dizer nada', () => {
  const [item] = applyColumnMapping([{ ...LINHA_REAL, 'Quantidade': '0', 'Quantidade Crítica': '0' }], mapearTudo())
  assert.equal(item.qtdDisponivel, 0)
  assert.equal(item.estoqueMinimo, 0)
})

test('"Realizar Pedido" liga e DESLIGA', () => {
  const mapping = mapearTudo()
  const ligado = applyColumnMapping([{ ...LINHA_REAL, 'Realizar Pedido': 'SIM' }], mapping)[0]
  assert.equal(ligado.realizarPedido, true)
  // Com a coluna presente e a célula limpa, `false` precisa CHEGAR ao patch — senão a marcação
  // fica acesa para sempre depois que o pedido é feito.
  const desligado = applyColumnMapping([{ ...LINHA_REAL, 'Realizar Pedido': '' }], mapping)[0]
  assert.equal(desligado.realizarPedido, false)
  // Sem a coluna, o sistema não tem opinião — e não pode apagar o que já estava marcado.
  const semColuna = applyColumnMapping([{ 'Produto': 'X', 'Quantidade': '1' }], { 'Produto': 'descricao', 'Quantidade': 'qtdDisponivel' })[0]
  assert.equal(semColuna.realizarPedido, undefined)
})

test('as 23 linhas do arquivo saem com nome de produto, nenhuma com "[URL]"', () => {
  const produtos = [
    'Base cinza N6,5 autonivelante (5,5kg)', 'Base cinza 7047', 'Base cinza 7037', 'Base cinza 7035',
    'Endurecedor incolor de lapidação', 'Impermeabilizante 18kg', 'Base verde limão 612',
    'Endurecedor ANV 2', 'UT 500 Cinza', 'Diluentes (Galão)', 'Tinta PU Vermelho 3009',
    'Tinta PU Branco', '11 PU esquilo cinza', 'PU Cinza 7042', 'Tinta PU verde 6005',
    'PCT agregado (Cinza) 7kg', 'Bisnaga de hiperflex', 'Agregados cinza (3kg)',
    'Catalisadores de prime', 'Rejumassa', 'Catalisadores de tinta', 'Agregado branco (3kg)',
    'Catalisadores de tinta PU',
  ]
  const quantidades = ['31un', '18un', '11un', '2un', '7un', '2un', '7un', '21un', '5un', '2un',
    '4un', '5un', '11un', '1un', '1un', '3un', '12un', '32un', '24un', '6un', '21', '7un', '17un']

  const linhas = produtos.map((nome, i) => ({ ...LINHA_REAL, 'Produto': nome, 'Quantidade': quantidades[i] }))
  const itens = applyColumnMapping(linhas, mapearTudo())

  assert.equal(itens.length, 23)
  assert.deepEqual(itens.map((i) => i.descricao), produtos)
  assert.deepEqual(itens.map((i) => i.qtdDisponivel), [31, 18, 11, 2, 7, 2, 7, 21, 5, 2, 4, 5, 11, 1, 1, 3, 12, 32, 24, 6, 21, 7, 17])
  assert.equal(itens.filter((i) => i.descricao.startsWith('http')).length, 0)
  assert.equal(itens.filter((i) => i.qtdDisponivel === 0).length, 0)
})

// ─── Conflito de coluna ────────────────────────────────────────────────────────

test('duas colunas no mesmo campo são apontadas, e a primeira vence', () => {
  const mapping = { 'Produto': 'descricao', 'Nome do item': 'descricao', 'Quantidade': 'qtdDisponivel' }
  const conflitos = detectarConflitos(mapping)
  assert.equal(conflitos.length, 1)
  assert.equal(conflitos[0].campo, 'descricao')
  assert.deepEqual(conflitos[0].cabecalhos, ['Produto', 'Nome do item'])

  // A PRIMEIRA coluna do arquivo vence. Antes vencia a última — e era assim que "Link do Produto",
  // que vem depois de "Produto", roubava o nome do item.
  const [item] = applyColumnMapping(
    [{ 'Produto': 'Tinta PU Branco', 'Nome do item': 'ERRADO', 'Quantidade': '5' }],
    mapping,
  )
  assert.equal(item.descricao, 'Tinta PU Branco')
})

test('sem conflito, a lista sai vazia', () => {
  assert.deepEqual(detectarConflitos(mapearTudo()), [])
  assert.deepEqual(detectarConflitos({ 'A': 'ignorar', 'B': 'ignorar' }), [], 'ignorar não conflita com ignorar')
})

// ─── Embalagem (o caminho que já existia, para não quebrar) ────────────────────

test('quantidade com embalagem embutida continua funcionando', () => {
  const mapping = { 'Produto': 'descricao', 'Quantidade': 'qtdDisponivel' }
  const [item] = applyColumnMapping([{ 'Produto': 'Fita', 'Quantidade': '9 cx (24un)' }], mapping)
  assert.equal(item.qtdDisponivel, 9 * 24)
  assert.equal(item.qtdPorEmbalagem, 24)
  assert.equal(item.unidade, 'un')
})
