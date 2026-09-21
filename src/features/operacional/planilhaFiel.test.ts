/**
 * A cirurgia no arquivo original — o que ela escreve, e sobretudo o que ela NÃO toca.
 *
 * A exportação anterior reconstruía o `.xlsx` e por isso perdia 50.838 fórmulas, 55 listas, a
 * formatação e metade das linhas. Estes testes travam a promessa contrária: **só a célula que
 * mudou muda**.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  letraDaColuna, indiceDaLetra, refDaCelula, origemDaAba, escreverCelulas, marcarRecalculo,
  ehNumero, escaparXml, linhasDaAbaNaMatriz, celulasAlteradas,
} from '@/features/operacional/planilhaFiel'
import type { AbaNoSistema, LinhaOperacional } from '@/features/operacional/sabespStore'

// ─── Endereço ─────────────────────────────────────────────────────────────────

test('a letra da coluna vai além de Z — a Medição chega em AB', () => {
  assert.equal(letraDaColuna(0), 'A')
  assert.equal(letraDaColuna(25), 'Z')
  assert.equal(letraDaColuna(26), 'AA')
  assert.equal(letraDaColuna(27), 'AB')
  for (const i of [0, 25, 26, 27, 51, 52, 700]) assert.equal(indiceDaLetra(letraDaColuna(i)), i)
  assert.equal(refDaCelula(0, 0), 'A1')
  assert.equal(refDaCelula(1511, 27), 'AB1512')
})

test('🔴 a origem vem do XML, nunca presumida como A1', () => {
  assert.deepEqual(origemDaAba('<worksheet><dimension ref="A1:AB1512"/></worksheet>'), { linha: 0, coluna: 0 })
  assert.deepEqual(origemDaAba('<worksheet><dimension ref="C5:K40"/></worksheet>'), { linha: 4, coluna: 2 })
  assert.deepEqual(origemDaAba('<worksheet><sheetData><row r="3"><c r="A3"/></row></sheetData></worksheet>'),
    { linha: 2, coluna: 0 })
})

// ─── 🔴 Fórmula é intocável ───────────────────────────────────────────────────

const ABA = `<?xml version="1.0"?><worksheet><dimension ref="A1:D10"/><sheetData>`
  + `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>`
  + `<row r="2"><c r="A2" s="7"><v>100</v></c><c r="B2" s="3" t="inlineStr"><is><t>ABERTO</t></is></c>`
  + `<c r="C2" s="9"><f>A2*2</f><v>200</v></c></row>`
  + `<row r="3"/>`
  + `</sheetData><dataValidations count="1"><dataValidation type="list" sqref="B2:B9"/></dataValidations></worksheet>`

test('🔴 célula com <f> NUNCA é sobrescrita — são 50.838 fórmulas neste arquivo', () => {
  const r = escreverCelulas(ABA, [{ ref: 'C2', valor: '999' }])
  assert.equal(r.escritas, 0)
  assert.deepEqual(r.formulas, ['C2'])
  assert.match(r.xml, /<f>A2\*2<\/f>/, 'a conta continua lá')
  assert.equal(r.xml, ABA, 'e o XML saiu byte a byte igual')
})

test('🔴 o resto do arquivo não é tocado — validação, estilos e as outras células ficam', () => {
  const r = escreverCelulas(ABA, [{ ref: 'A2', valor: '250' }])
  assert.equal(r.escritas, 1)
  assert.match(r.xml, /<c r="A2" s="7"><v>250<\/v><\/c>/, 'o estilo s="7" sobreviveu')
  assert.match(r.xml, /<dataValidation type="list" sqref="B2:B9"\/>/, 'a lista continua')
  assert.match(r.xml, /<c r="B2" s="3" t="inlineStr"><is><t>ABERTO<\/t><\/is><\/c>/)
  assert.match(r.xml, /<dimension ref="A1:D10"\/>/)
})

test('🔴 texto não vira número — `0001` é código de serviço, não o número um', () => {
  assert.equal(ehNumero('100'), true)
  assert.equal(ehNumero('-3.5'), true)
  assert.equal(ehNumero('0001'), false)
  assert.equal(ehNumero('09/2026'), false)
  assert.equal(ehNumero(''), false)
  assert.equal(ehNumero('1,5'), false, 'vírgula decimal brasileira não é número para o XML')

  const r = escreverCelulas(ABA, [{ ref: 'A2', valor: 'BER-0001' }])
  assert.match(r.xml, /<c r="A2" s="7" t="inlineStr"><is><t xml:space="preserve">BER-0001<\/t><\/is><\/c>/)
})

test('o texto é escapado — um `&` solto corrompe o arquivo inteiro', () => {
  assert.equal(escaparXml('R&D <teste> "x"'), 'R&amp;D &lt;teste&gt; &quot;x&quot;')
  const r = escreverCelulas(ABA, [{ ref: 'A2', valor: 'ÁGUA & ESGOTO' }])
  assert.match(r.xml, /ÁGUA &amp; ESGOTO/)
  assert.doesNotMatch(r.xml, /ÁGUA & ESGOTO/)
})

test('valor apagado vira célula vazia, mantendo o estilo — não some do arquivo', () => {
  const r = escreverCelulas(ABA, [{ ref: 'A2', valor: '' }])
  assert.match(r.xml, /<c r="A2" s="7"\/>/)
})

test('célula que ainda não existia é INSERIDA em ordem de coluna', () => {
  const r = escreverCelulas(ABA, [{ ref: 'B1', valor: 'x' }, { ref: 'D2', valor: 'novo' }])
  const linha2 = r.xml.match(/<row r="2">([\s\S]*?)<\/row>/)![1]
  const ordem = [...linha2.matchAll(/<c r="([A-Z]+)\d+"/g)].map((m) => m[1])
  assert.deepEqual(ordem, ['A', 'B', 'C', 'D'], 'fora de ordem o Excel recusa o arquivo')
})

test('duas escritas na mesma linha não se atropelam', () => {
  const r = escreverCelulas(ABA, [{ ref: 'A2', valor: '1' }, { ref: 'B2', valor: 'FECHADO' }])
  assert.equal(r.escritas, 2)
  assert.match(r.xml, /<c r="A2" s="7"><v>1<\/v><\/c>/)
  assert.match(r.xml, /<c r="B2" s="3" t="inlineStr"><is><t xml:space="preserve">FECHADO<\/t><\/is><\/c>/)
  assert.match(r.xml, /<f>A2\*2<\/f>/)
})

test('linha declarada vazia é aberta para receber a célula', () => {
  const r = escreverCelulas(ABA, [{ ref: 'A3', valor: 'x' }])
  assert.equal(r.escritas, 1)
  assert.match(r.xml, /<row r="3"><c r="A3" t="inlineStr">/)
  assert.doesNotMatch(r.xml, /<row r="3"\/>/)
})

test('linha que não existe no XML é relatada, não inventada', () => {
  const r = escreverCelulas(ABA, [{ ref: 'A99', valor: 'x' }])
  assert.equal(r.escritas, 0)
  assert.deepEqual(r.semLugar, ['A99'])
})

// ─── 🔴 Recalcular ao abrir ───────────────────────────────────────────────────

test('🔴 o workbook pede recálculo — sem isso o total continua mostrando o valor velho', () => {
  assert.match(marcarRecalculo('<workbook><sheets/></workbook>'), /<calcPr fullCalcOnLoad="1"\/><\/workbook>/)
  assert.match(marcarRecalculo('<workbook><calcPr calcId="191029"/></workbook>'),
    /<calcPr calcId="191029" fullCalcOnLoad="1"\/>/)
  const ja = '<workbook><calcPr calcId="1" fullCalcOnLoad="1"/></workbook>'
  assert.equal(marcarRecalculo(ja), ja, 'idempotente: reexportar não duplica o atributo')
})

// ─── 🔴 Qual linha do arquivo é qual registro ─────────────────────────────────

const colunas = ['Nº', 'CONTRATO', 'DESCRIÇÃO'].map((titulo, indice) => ({ titulo, indice, temTitulo: true }))
const matriz = [
  ['OCORRÊNCIAS', '', ''],          // 0 — título
  ['', '', ''],                     // 1 — vazia
  ['Nº', 'CONTRATO', 'DESCRIÇÃO'],  // 2 — cabeçalho
  ['OC-1', 'BERTIOGA', 'Vazamento'],// 3
  ['', '', 'legenda: A = número'],  // 4 — não é registro (sem a âncora)
  ['OC-2', 'SANTOS', 'Refluxo'],    // 5
]
const meta: AbaNoSistema = { colunas, ordemDasChaves: [], matriz, linhaDoCabecalho: 2 }

test('🔴 o mapa chave → linha pula título, vazia e legenda, e acerta a linha do arquivo', () => {
  const mapa = linhasDaAbaNaMatriz('ocorrencias', colunas, matriz, 2)
  assert.deepEqual([...mapa], [['OC-1|BERTIOGA', 3], ['OC-2|SANTOS', 5]],
    'errar esta conta escreve o valor do usuário na linha errada do arquivo do cliente')
})

test('🔴 só a célula editada entra no diff — o resto da planilha é igual a si mesma', () => {
  const linhas: LinhaOperacional[] = [
    { id: '1', aba: 'ocorrencias', chave: 'OC-1|BERTIOGA', ativa: true, origem: 'planilha',
      valores: { 'Nº': 'OC-1', CONTRATO: 'BERTIOGA', 'DESCRIÇÃO': 'Vazamento resolvido' } },
    { id: '2', aba: 'ocorrencias', chave: 'OC-2|SANTOS', ativa: true, origem: 'planilha',
      valores: { 'Nº': 'OC-2', CONTRATO: 'SANTOS', 'DESCRIÇÃO': 'Refluxo' } },
  ]
  const diff = celulasAlteradas('ocorrencias', meta, linhas)
  assert.equal(diff.length, 1)
  assert.deepEqual(
    { linha: diff[0].linha, coluna: diff[0].coluna, de: diff[0].de, valor: diff[0].valor },
    { linha: 3, coluna: 2, de: 'Vazamento', valor: 'Vazamento resolvido' },
  )
  assert.equal(refDaCelula(diff[0].linha, diff[0].coluna), 'C4')
})

test('linha criada no sistema não tem lugar no arquivo original — e não é forçada lá dentro', () => {
  const diff = celulasAlteradas('ocorrencias', meta, [
    { id: '9', aba: 'ocorrencias', chave: 'LOCAL-123', ativa: true, origem: 'sistema',
      valores: { 'Nº': 'OC-9', CONTRATO: 'BERTIOGA', 'DESCRIÇÃO': 'Nova' } },
  ])
  assert.deepEqual(diff, [],
    'inventar linha no arquivo do cliente deslocaria fórmulas, intervalos nomeados e validações')
})
