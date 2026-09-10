/**
 * As regras do Lançamento Rápido.
 *
 * Os testes 🔴 são os da mesma família: **"não informado" não é "zero"**. Se qualquer um deles
 * cair, a grade passa a afirmar produção que ninguém declarou — e essa afirmação vira número na
 * medição, no FCP e na conferência do dia.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  producaoDasQuantidades, horasInformadas, linhaTemConteudo, pecasDoTexto,
  lerRascunho, gravarRascunho, limparRascunho, CHAVE_RASCUNHO,
} from './lancamentoRapido'

const linha = (p: Partial<Parameters<typeof linhaTemConteudo>[0]> = {}) => ({
  obraId: 'obra-1', quantidades: {}, observacoes: '', textoOriginal: '', semProducao: false, ...p,
})

test('🔴 sigla não digitada NÃO vira linha de produção', () => {
  const p = producaoDasQuantidades({ LA: '15' })
  assert.equal(p.length, 1, 'as outras 12 siglas ficaram de fora')
  assert.deepEqual(p[0], { sigla: 'LA', quantidade: '15', unidade: 'UN' })
})

test('🔴 mas um ZERO digitado à mão ENTRA — é uma afirmação, não silêncio', () => {
  const p = producaoDasQuantidades({ LA: '0' })
  assert.equal(p.length, 1)
  assert.equal(p[0].quantidade, '0', '"produzi zero disto" é diferente de "não falei disto"')
})

test('espaço em branco é silêncio, não zero', () => {
  assert.equal(producaoDasQuantidades({ LA: '   ' }).length, 0)
})

test('a unidade vem da sigla — metro e unidade nunca se somam', () => {
  const p = producaoDasQuantidades({ PRA: '120', LA: '3', PRE: '45' })
  assert.equal(p.find((x) => x.sigla === 'PRA')!.unidade, 'M')
  assert.equal(p.find((x) => x.sigla === 'PRE')!.unidade, 'M')
  assert.equal(p.find((x) => x.sigla === 'LA')!.unidade, 'UN')
})

test('a quantidade é preservada como TEXTO — nada de arredondar na entrada', () => {
  assert.equal(producaoDasQuantidades({ PRA: '12,5' })[0].quantidade, '12,5')
})

test('🔴 horas em branco é undefined, nunca 0', () => {
  assert.equal(horasInformadas(''), undefined)
  assert.equal(horasInformadas('   '), undefined)
  // Um 0 aqui faria o custo/hora dividir por uma jornada que ninguém declarou.
})

test('horas aceita vírgula e recusa o que não é jornada', () => {
  assert.equal(horasInformadas('8'), 8)
  assert.equal(horasInformadas('7,5'), 7.5)
  assert.equal(horasInformadas('0'), undefined, 'zero hora não é jornada')
  assert.equal(horasInformadas('25'), undefined, 'mais que o dia é digitação errada')
  assert.equal(horasInformadas('oito'), undefined)
})

test('linha sem obra nunca vira lançamento', () => {
  assert.equal(linhaTemConteudo(linha({ obraId: '', quantidades: { LA: '10' } })), false)
})

test('linha com obra e mais nada é ignorada — RDO vazio afirmaria que ninguém fez nada', () => {
  assert.equal(linhaTemConteudo(linha()), false)
})

test('quantidade, observação OU o texto colado bastam para a linha valer', () => {
  assert.equal(linhaTemConteudo(linha({ quantidades: { LA: '10' } })), true)
  assert.equal(linhaTemConteudo(linha({ observacoes: 'limpeza de travessa' })), true)
  assert.equal(linhaTemConteudo(linha({ textoOriginal: 'EQUIPE - Gilvan' })), true,
    'colar a mensagem já é registro, mesmo antes de digitar número')
})

test('"não houve produção" basta sozinho — é uma afirmação', () => {
  assert.equal(linhaTemConteudo(linha({ semProducao: true })), true)
})

test('as peças da OS saem uma por linha, sem linha em branco', () => {
  assert.deepEqual(pecasDoTexto('2 tubetes\n 1 registro \n\n1 cotovelo de metal\n'),
    ['2 tubetes', '1 registro', '1 cotovelo de metal'])
  assert.deepEqual(pecasDoTexto(''), [])
  assert.deepEqual(pecasDoTexto('   \n  '), [])
})

test('linha de ordem de serviço vale pelo endereço, pelo serviço ou pelas peças', () => {
  assert.equal(linhaTemConteudo(linha({ endereco: 'Rua Manoel Gago, 1426' })), true)
  assert.equal(linhaTemConteudo(linha({ servico: 'troca de ramal' })), true)
  assert.equal(linhaTemConteudo(linha({ pecas: '2 tubetes' })), true)
  assert.equal(linhaTemConteudo(linha({ pecas: '   ' })), false, 'espaço em branco não é peça')
})

// ─── O rascunho local ─────────────────────────────────────────────────────────

test('🔴 o rascunho volta no mesmo dia, e some depois de gravar', () => {
  limparRascunho()
  gravarRascunho({ data: '2026-09-10', linhas: [{ obraId: 'o1', equipe: 'Gilvan' }] })
  const r = lerRascunho<{ obraId: string; equipe: string }>('2026-09-10')
  assert.equal(r?.linhas[0].equipe, 'Gilvan', 'telefone tocou, aba fechou — a digitação está lá')

  limparRascunho()
  assert.equal(lerRascunho('2026-09-10'), null,
    'rascunho que sobrevive à gravação viraria lançamento em dobro na próxima abertura')
})

test('⚠️ rascunho de OUTRO dia não volta', () => {
  limparRascunho()
  gravarRascunho({ data: '2026-09-09', linhas: [{ obraId: 'o1' }] })
  assert.equal(lerRascunho('2026-09-10'), null, 'ver o lançamento de ontem meio digitado convida a gravar data errada')
  limparRascunho()
})

test('lixo no localStorage não derruba a tela', () => {
  localStorage.setItem(CHAVE_RASCUNHO, 'isto não é json')
  assert.equal(lerRascunho('2026-09-10'), null)
  localStorage.setItem(CHAVE_RASCUNHO, '{"data":"2026-09-10"}')   // sem `linhas`
  assert.equal(lerRascunho('2026-09-10'), null)
  limparRascunho()
})
