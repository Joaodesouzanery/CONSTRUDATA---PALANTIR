/**
 * O leitor do catálogo, em matrizes sintéticas.
 *
 * O arquivo real é coberto pelo `npm run qa:medicao-zn` (284 serviços, 9 regiões, os subtotais do
 * rodapé e as duas tabelas de divergência). Aqui ficam os casos de borda que um arquivo só não
 * exercita — e o principal deles é o do FATOR, que a própria planilha documenta na célula errada.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Matriz } from '../controleDeCaixaPlanilha'
import { lerCatalogoZn, valorDoRotulo, acharAba } from './importarCatalogoZn'

const codigos = (): Matriz => ([
  ['CÓDIGOS DE CADA SERVIÇO POR REGIÃO'],
  [],
  ['DESCRIÇÃO', 'UN', 'PREÇO ZN (R$)', '01-Alfa', '02-Beta', '09-Ômega'],
  ['REDE EXEMPLO', 'M', 100, '0101', '0201', '0901'],
  ['LIGACAO EXEMPLO', 'UN', 50, '0102', '—', '—'],
  ['ITEM DESLOCADO', 'UN', 30, '0103', '0203', '0903'],
] as unknown as Matriz)

const base = (): Matriz => ([
  ['BASE DE MEDIÇÃO – PREÇOS DO CONTRATO A 60%'],
  [null, null, null, null, null, null, null, 'FATOR:', 0.6],
  [],
  ['ITEM', 'CÓDIGO', 'DESCRIÇÃO DO SERVIÇO', 'UN', 'PREÇO CONTRATO', 'PREÇO 60%', 'QTD A', 'QTD B', 'VALOR'],
  ['PARTE 1 – ITENS DO CONTRATO'],
  ['CANTEIRO DE OBRAS'],
  [1, '0101', 'REDE EXEMPLO', 'M', 100, 60, null, null, 0],
  [2, '0102', 'LIGACAO EXEMPLO', 'UN', 50, 30, null, null, 0],
  ['SUBTOTAL – CONTRATO', null, null, null, null, null, null, null, 1000],
  ['PARTE 2'],
  ['SERVIÇOS NOVOS'],
  [3, '0103', 'ITEM DESLOCADO', 'UN', 30, 18, null, null, 0],
  ['SUBTOTAL – APOSTILAMENTO', null, null, null, null, null, null, null, 500],
  ['VALOR TOTAL DA MEDIÇÃO', null, null, null, null, null, null, null, 1500],
] as unknown as Matriz)

const notas = (): Matriz => ([
  ['NOTAS DE MONTAGEM E DIVERGÊNCIAS DE PREÇO'],
  [],
  ['TABELA A – PREÇOS PRÓPRIOS DA REGIÃO 09'],
  ['CÓD. 09', 'DESCRIÇÃO', 'UN', 'PREÇO ZN 09 (R$)', 'PREÇO 60% (R$)', 'PREÇO DEMAIS REGIÕES (R$)'],
  ['0901', 'REDE EXEMPLO', 'M', 80, 48, 100],
  [],
  ['TABELA B – BLOCO 07 COM PREÇOS DESLOCADOS NO PDF'],
  ['CÓD. 07', 'DESCRIÇÃO', 'UN', 'PREÇO ZN 07 (R$)', 'PREÇO DEMAIS REGIÕES (R$)', 'N. PREÇO SAP'],
  ['0203', 'ITEM DESLOCADO', 'UN', 999, 30, '100011908'],
] as unknown as Matriz)

const abas = () => ({ 'BASE MEDIÇÃO  ': base(), 'CÓDIGOS POR REGIÃO': codigos(), 'NOTAS E DIVERGÊNCIAS': notas() })

test('⚠️ o FATOR é achado pelo RÓTULO, não pela coluna', () => {
  // A nota 1 da planilha real diz "célula H2". H2 é o RÓTULO; o valor está em I2. Um parser que
  // fosse na coluna documentada leria a palavra "FATOR:" como número.
  assert.equal(valorDoRotulo(base(), 'FATOR'), 0.6)
  const deslocado = base()
  ;(deslocado[1] as unknown[])[7] = null
  ;(deslocado[1] as unknown[])[3] = 'FATOR:'
  ;(deslocado[1] as unknown[])[4] = 0.55
  assert.equal(valorDoRotulo(deslocado, 'FATOR'), 0.55, 'muda de coluna e continua achando')
})

test('a aba é achada pelo começo do nome — "BASE MEDIÇÃO  " tem espaços no fim', () => {
  assert.ok(acharAba(abas(), 'BASE MEDICAO'))
  assert.ok(acharAba(abas(), 'CODIGOS POR REGIAO'))
  assert.equal(acharAba(abas(), 'NAO EXISTE'), undefined)
})

test('lê serviços, regiões e o fator, e separa contrato de apostilamento', () => {
  const r = lerCatalogoZn(abas(), { numeroContrato: 'CT-1', orgId: 'org' })
  assert.deepEqual(r.problemas, [])
  assert.equal(r.catalogo.fatorPadrao, 0.6)
  assert.equal(r.resumo.servicos, 3)
  assert.deepEqual(r.catalogo.regioes.map((x) => x.codigo), ['01', '02', '09'])
  assert.equal(r.catalogo.regioes[2].nome, 'Ômega')
  assert.deepEqual(r.resumo.porParte, { contrato: 2, apostilamento: 1 })
  assert.deepEqual(r.resumo.subtotaisDeclarados, { contrato: 1000, apostilamento: 500 })
  assert.equal(r.resumo.totalDeclarado, 1500)
})

test('⚠️ "—" na coluna da região significa NÃO EXISTE ali, não preço zero', () => {
  const r = lerCatalogoZn(abas(), { numeroContrato: 'CT-1', orgId: 'org' })
  const ligacao = r.catalogo.servicos.find((s) => s.descricao === 'LIGACAO EXEMPLO')!
  assert.deepEqual(Object.keys(ligacao.porRegiao), ['01'])
})

test('a Tabela A vira preço próprio da região; a Tabela B barra a medição', () => {
  const r = lerCatalogoZn(abas(), { numeroContrato: 'CT-1', orgId: 'org' })
  const rede = r.catalogo.servicos.find((s) => s.descricao === 'REDE EXEMPLO')!
  assert.equal(rede.porRegiao['09'].precoOverride, 80)
  assert.equal(rede.flag, 'preco_regional_divergente')
  assert.equal(rede.bloqueadoParaMedicao, false, 'preço próprio é aviso, não bloqueio')

  const deslocado = r.catalogo.servicos.find((s) => s.descricao === 'ITEM DESLOCADO')!
  assert.equal(deslocado.flag, 'bloco_deslocado_pdf')
  assert.equal(deslocado.bloqueadoParaMedicao, true, 'aqui o preço pode estar errado — não mede')
  assert.ok(deslocado.motivoFlag && deslocado.motivoFlag.includes('fiscalização'))
})

test('🔴 a categoria vem da última seção vista na BASE, não some', () => {
  const r = lerCatalogoZn(abas(), { numeroContrato: 'CT-1', orgId: 'org' })
  assert.equal(r.catalogo.servicos.find((s) => s.descricao === 'REDE EXEMPLO')!.categoria, 'CANTEIRO DE OBRAS')
  assert.equal(r.catalogo.servicos.find((s) => s.descricao === 'ITEM DESLOCADO')!.categoria, 'SERVIÇOS NOVOS')
})

test('descrição repetida com preços diferentes vira "ambígua" — o SAP trunca em 40', () => {
  const cod = codigos()
  ;(cod as unknown[]).push(['REDE EXEMPLO', 'M', 250, '0104', '0204', '0904'])
  const r = lerCatalogoZn({ ...abas(), 'CÓDIGOS POR REGIÃO': cod }, { numeroContrato: 'CT-1', orgId: 'org' })
  const repetidos = r.catalogo.servicos.filter((s) => s.descricao === 'REDE EXEMPLO')
  assert.equal(repetidos.length, 2)
  assert.equal(new Set(repetidos.map((s) => s.id)).size, 2, 'ids distintos: uma não engole a outra')
  assert.ok(repetidos.some((s) => s.flag === 'descricao_truncada_ambigua'))
})

test('aba que falta é REPORTADA, não engolida', () => {
  const r = lerCatalogoZn({ 'CÓDIGOS POR REGIÃO': codigos() }, { numeroContrato: 'CT-1' })
  assert.equal(r.problemas.length, 3, 'BASE ausente, NOTAS ausente, fator não encontrado')
  assert.equal(r.catalogo.fatorPadrao, 0.6, 'cai no padrão, e o problema fica escrito')
  assert.equal(r.resumo.servicos, 3, 'e ainda assim lê o que dá')
})

test('sem a aba de códigos não há catálogo — e a tela precisa saber por quê', () => {
  const r = lerCatalogoZn({ 'BASE MEDIÇÃO  ': base() }, { numeroContrato: 'CT-1' })
  assert.equal(r.resumo.servicos, 0)
  assert.ok(r.problemas.some((p) => p.includes('CÓDIGOS POR REGIÃO')))
})
