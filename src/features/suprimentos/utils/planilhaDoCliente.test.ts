/**
 * A planilha REAL do almoxarifado, exportada pelo cliente em 25/08/2026.
 *
 * Os testes que já existiam usavam uma planilha inventada, com 9 colunas e "Quantidade Crítica" e
 * "Realizar Pedido" SEPARADAS. Passavam verdes e **não descreviam mais a realidade**: o arquivo
 * dele tem 8 colunas, e as duas vêm fundidas numa célula só, com quebra de linha no meio.
 *
 * Três defeitos foram medidos contra este arquivo, e é isto que estes testes travam:
 *
 *  a) CSV UTF-8 sem BOM (o que o Google Sheets exporta) entrava em mojibake — "MÃ¡scaras PFF2".
 *     As colunas de CÓDIGO e DATA deixavam de ser reconhecidas e eram descartadas em silêncio, e
 *     todo item acentuado virava "material novo" por não casar com o que já estava cadastrado.
 *  b) A coluna "Quantidade Critica / Realizar Pedido" tem `FALSE`. Como o nome diz "quantidade",
 *     ela era lida como número, `FALSE` virava 0, e o zero era gravado: **o estoque mínimo de todo
 *     item atualizado ia a zero** e o alerta "abaixo do mínimo" nunca mais disparava.
 *  c) `01/11/2025` era lido como data americana e gravado como 01/10 — um mês e um dia errados.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { autoSuggestField, refinarPorConteudo, applyColumnMapping, selecionarAbaExcel } from './parseExcelEstoque'
import type { ExcelPreview } from './parseExcelEstoque'

/** Os 8 cabeçalhos exatos do arquivo dele — repare na quebra de linha no sexto. */
const CABECALHOS = [
  'Produto', 'Quantidade', 'Unidade', 'Fornecedor Principal', 'Código de Referência',
  'Quantidade Critica\nRealizar Pedido', 'Data do Último Pedido', 'Link do Produto',
]

/** Linhas representativas das 34, com os casos difíceis. */
const LINHAS = [
  ['Thinner 18L',    '0',           'un',    '', 'THN05L',  'FALSE', '01/11/2025', '[URL]'],
  ['Fita 48mm',      '6 cx (24un)', 'cx',    '', 'FT48X24', 'FALSE', '10/12/2025', '[URL]'],
  ['Lona 110M',      '14',          'rolos', '', 'PLP110M', 'FALSE', '20/10/2025', '[URL]'],
  ['Máscaras PFF2',  '20',          'un',    '', 'MSCR',    'FALSE', '',           ''],
  ['Calça (Uniforme)', '12',        'un',    '', 'CLC',     'FALSE', '',           ''],
  ['',               '',            'rolos', '', 'LNS',     'FALSE', '',           ''],
]

const mapa = Object.fromEntries(CABECALHOS.map((h) => [h, autoSuggestField(h)]))
const linhas = LINHAS.map((l) => Object.fromEntries(CABECALHOS.map((h, i) => [h, l[i]])))
const itens = applyColumnMapping(linhas, mapa)
const por = (d: string) => itens.find((i) => i.descricao === d)!

// ── O mapeamento das 8 colunas ────────────────────────────────────────────────

test('as 8 colunas da planilha dele caem nos campos certos', () => {
  assert.deepEqual(mapa, {
    'Produto':                             'descricao',
    'Quantidade':                          'qtdDisponivel',
    'Unidade':                             'unidade',
    'Fornecedor Principal':                'fornecedorPrincipal',
    'Código de Referência':                'codigoReferencia',
    'Quantidade Critica\nRealizar Pedido': 'realizarPedido',
    'Data do Último Pedido':               'dataUltimoPedido',
    'Link do Produto':                     'linkProduto',
  })
})

test('⚠️ (b) o cabeçalho fundido é MARCAÇÃO, não quantidade', () => {
  // Vencia `estoqueMinimo` por 3 pontos de diferença no comprimento da dica — puro acidente.
  assert.equal(autoSuggestField('Quantidade Critica\nRealizar Pedido'), 'realizarPedido')
  // As duas separadas continuam funcionando, para quem tiver a planilha antiga.
  assert.equal(autoSuggestField('Quantidade Crítica'), 'estoqueMinimo')
  assert.equal(autoSuggestField('Realizar Pedido'), 'realizarPedido')
})

test('⚠️ (b) FALSE NÃO zera o estoque mínimo de ninguém', () => {
  // O dano real: `estoqueMinimo: 0` era gravado em todo item atualizado.
  for (const i of itens) {
    assert.equal(i.estoqueMinimo, undefined, `${i.descricao} teve o mínimo mexido`)
  }
})

test('⚠️ (b) rede de segurança: booleano nunca vira número, nem mapeado à mão', () => {
  // Se alguém corrigir o combo para "estoque mínimo" na tela, o FALSE ainda não pode virar 0.
  const forcado = applyColumnMapping(
    [{ 'Produto': 'X', 'Crítico': 'FALSE' }],
    { 'Produto': 'descricao', 'Crítico': 'estoqueMinimo' },
  )
  assert.equal(forcado[0].estoqueMinimo, undefined)

  const comTrue = applyColumnMapping(
    [{ 'Produto': 'Y', 'Crítico': 'TRUE' }],
    { 'Produto': 'descricao', 'Crítico': 'estoqueMinimo' },
  )
  assert.equal(comTrue[0].estoqueMinimo, undefined)

  // E um número de verdade continua passando.
  const numero = applyColumnMapping(
    [{ 'Produto': 'Z', 'Crítico': '5' }],
    { 'Produto': 'descricao', 'Crítico': 'estoqueMinimo' },
  )
  assert.equal(numero[0].estoqueMinimo, 5)
})

test('a marcação de comprar é lida — e nas 34 linhas dele está desmarcada', () => {
  assert.equal(por('Thinner 18L').realizarPedido, false)
  const marcado = applyColumnMapping(
    [{ 'Produto': 'X', 'Realizar Pedido': 'TRUE' }],
    { 'Produto': 'descricao', 'Realizar Pedido': 'realizarPedido' },
  )
  assert.equal(marcado[0].realizarPedido, true)
})

// ── Quantidades ───────────────────────────────────────────────────────────────

test('a caixa com o conteúdo dentro vira unidades, e a caixa vira rótulo', () => {
  const fita = por('Fita 48mm')
  assert.equal(fita.qtdDisponivel, 144, '6 caixas × 24 unidades')
  assert.equal(fita.qtdPorEmbalagem, 24)
  assert.equal(fita.unidadeEmbalagem, 'cx')
  assert.equal(fita.unidade, 'un', 'o saldo fica em unidades')
})

test('a planilha dizendo "0" é diferente de não dizer nada', () => {
  // O Thinner está zerado DE VERDADE — não pode ser confundido com "não informado".
  assert.equal(por('Thinner 18L').qtdDisponivel, 0)
  assert.equal(por('Lona 110M').qtdDisponivel, 14)
  assert.equal(por('Lona 110M').unidade, 'rolos')
})

// ── Acentos ───────────────────────────────────────────────────────────────────

test('⚠️ (a) os acentos chegam inteiros — senão vira tudo material novo', () => {
  assert.ok(itens.some((i) => i.descricao === 'Máscaras PFF2'))
  assert.ok(itens.some((i) => i.descricao === 'Calça (Uniforme)'))
  // Se voltar o mojibake, estes aparecem — e o casamento com o estoque falha.
  assert.ok(!itens.some((i) => i.descricao.includes('Ã')))
})

// ── Datas ─────────────────────────────────────────────────────────────────────

test('⚠️ (c) 01/11/2025 é NOVEMBRO, não outubro', () => {
  assert.equal(por('Thinner 18L').dataUltimoPedido, '2025-11-01')
  assert.equal(por('Fita 48mm').dataUltimoPedido, '2025-12-10')
  // Este escapava do defeito porque dia 20 não existe como mês.
  assert.equal(por('Lona 110M').dataUltimoPedido, '2025-10-20')
  // Sem data continua sem data.
  assert.equal(por('Máscaras PFF2').dataUltimoPedido, undefined)
})

// ── Colunas vazias e lixo ─────────────────────────────────────────────────────

test('fornecedor 100% vazio não apaga o que já está cadastrado', () => {
  for (const i of itens) assert.equal(i.fornecedorPrincipal, undefined)
})

test('o texto "[URL]" não é gravado como se fosse link', () => {
  assert.equal(por('Thinner 18L').linkProduto, undefined)
})

test('a linha sem produto não vira item', () => {
  assert.equal(itens.length, 5, 'as 6 linhas menos a que não tem nome')
  assert.ok(!itens.some((i) => !i.descricao))
})


// ── A coluna crítica lida pelo CONTEÚDO, não só pelo nome ─────────────────────

test('coluna inteira de FALSE vira caixa de seleção, mesmo chamando-se "Quantidade Critica"', () => {
  // O caso do cliente sem a segunda linha do cabeçalho: só "Quantidade Critica". Pelo nome, é
  // mínimo; pelo conteúdo, são 34 células `FALSE`. O conteúdo manda.
  const campoPeloNome = autoSuggestField('Quantidade Critica')
  assert.equal(campoPeloNome, 'estoqueMinimo')
  assert.equal(refinarPorConteudo(campoPeloNome, Array(34).fill('FALSE')), 'realizarPedido')
})

test('coluna com números de verdade continua sendo o mínimo', () => {
  assert.equal(refinarPorConteudo('estoqueMinimo', ['10', '5', '', '20']), 'estoqueMinimo')
})

test('um FALSE perdido no meio de números NÃO transforma a coluna em caixa de seleção', () => {
  // Conservador de propósito: aqui o mínimo dos outros itens vale, e o FALSE isolado é descartado
  // pela rede de segurança na hora de converter.
  assert.equal(refinarPorConteudo('estoqueMinimo', ['10', 'FALSE', '5']), 'estoqueMinimo')
})

test('coluna vazia não muda de campo — vazio não é sim/não', () => {
  assert.equal(refinarPorConteudo('estoqueMinimo', ['', '', '']), 'estoqueMinimo')
})

test('campo de texto nunca é refinado, mesmo contendo sim/não', () => {
  assert.equal(refinarPorConteudo('descricao', ['sim', 'nao']), 'descricao')
})

test('SIM/NAO e VERDADEIRO/FALSO também são reconhecidos', () => {
  assert.equal(refinarPorConteudo('qtdDisponivel', ['Sim', 'Não', 'sim']), 'realizarPedido')
  assert.equal(refinarPorConteudo('estoqueMinimo', ['VERDADEIRO', 'FALSO']), 'realizarPedido')
})

test('arquivo com abas preserva todas e só troca a aba escolhida', () => {
  const arquivo: ExcelPreview = {
    sheetName: 'Controle de Estoque',
    headers: ['Produto', 'Quantidade'],
    rows: [{ Produto: 'Thinner 18L', Quantidade: '0' }],
    sheets: [
      { name: 'Controle de Estoque', headers: ['Produto', 'Quantidade'], rows: [{ Produto: 'Thinner 18L', Quantidade: '0' }] },
      { name: 'Controle de Pedidos', headers: ['Produto', 'Quantidade'], rows: [{ Produto: 'Lona', Quantidade: '5' }] },
    ],
  }

  const pedidos = selecionarAbaExcel(arquivo, 'Controle de Pedidos')
  assert.equal(pedidos.sheetName, 'Controle de Pedidos')
  assert.deepEqual(pedidos.rows, [{ Produto: 'Lona', Quantidade: '5' }])
  assert.equal(pedidos.sheets.length, 2, 'as outras abas não são descartadas')
  assert.equal(selecionarAbaExcel(arquivo, 'não existe'), arquivo, 'nome desconhecido não apaga a prévia atual')
})
