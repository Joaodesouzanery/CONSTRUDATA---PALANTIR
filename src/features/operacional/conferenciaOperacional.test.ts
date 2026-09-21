/**
 * "A planilha manda, mas eu preciso ver o que ela vai desfazer."
 *
 * Esta é a regra que o cliente deu para o Operacional, e os testes abaixo são ela por extenso.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  conferirAba, casarPorSemelhanca, semelhanca, parAceitavel, valorFinalDaLinha, resumir,
  camposInformados, SEMELHANCA_MINIMA, CAMPOS_MINIMOS,
  type LinhaExistente, type LinhaDaPlanilha,
} from '@/features/operacional/conferenciaOperacional'

const COLUNAS = ['STATUS', 'VALOR', 'RESPONSÁVEL']

const daPlanilha = (chave: string, valores: Record<string, string>): LinhaDaPlanilha => ({ chave, valores })
const noSistema = (chave: string, valores: Record<string, string>, extra: Partial<LinhaExistente> = {}): LinhaExistente =>
  ({ chave, valores, origem: 'planilha', ...extra })

test('linha que não existia entra como NOVA', () => {
  const [l] = conferirAba('03', [daPlanilha('a', { STATUS: 'ABERTO' })], [], COLUNAS)
  assert.equal(l.situacao, 'nova')
  assert.deepEqual(l.divergencias, [])
})

test('mesma linha, mesmos valores: INALTERADA — não polui a conferência', () => {
  const [l] = conferirAba('03',
    [daPlanilha('a', { STATUS: 'ABERTO', VALOR: '10' })],
    [noSistema('a', { STATUS: 'ABERTO', VALOR: '10' })], COLUNAS)
  assert.equal(l.situacao, 'inalterada')
})

test('a planilha mudou e ninguém tinha editado: ATUALIZADA (rotina)', () => {
  const [l] = conferirAba('03',
    [daPlanilha('a', { STATUS: 'CONCLUÍDO' })],
    [noSistema('a', { STATUS: 'ABERTO' })], COLUNAS)
  assert.equal(l.situacao, 'atualizada')
  assert.deepEqual(l.divergencias, [{ campo: 'STATUS', naPlanilha: 'CONCLUÍDO', noSistema: 'ABERTO' }])
})

test('🔴 editei no sistema e a planilha discorda: CONFLITO, com nome e data', () => {
  const [l] = conferirAba('03',
    [daPlanilha('a', { STATUS: 'CONCLUÍDO' })],
    [noSistema('a', { STATUS: 'EM ANDAMENTO' }, {
      origem: 'sistema', editadoPor: 'Felipe Nery', editadoEm: '2026-09-16T14:02:00.000Z',
    })], COLUNAS)
  assert.equal(l.situacao, 'conflito',
    'mexer numa linha que a planilha mudou é rotina; mexer numa que EU editei é uma decisão')
  assert.equal(l.editadoPor, 'Felipe Nery')
  assert.equal(l.editadoEm, '2026-09-16T14:02:00.000Z')
})

test('linha que sumiu da planilha é marcada AUSENTE — não some calada', () => {
  const [l] = conferirAba('03', [], [noSistema('a', { STATUS: 'ABERTO' })], COLUNAS)
  assert.equal(l.situacao, 'ausente')
})

test('a comparação ignora espaço em volta — não vira conflito por causa de um espaço', () => {
  const [l] = conferirAba('03',
    [daPlanilha('a', { STATUS: ' ABERTO ' })],
    [noSistema('a', { STATUS: 'ABERTO' })], COLUNAS)
  assert.equal(l.situacao, 'inalterada')
})

// ─── ⚠️ "a planilha não disse" ≠ "a planilha disse vazio" ─────────────────────

test('🔴 coluna que o arquivo NÃO trouxe não vira divergência', () => {
  // O arquivo veio só com STATUS. RESPONSÁVEL existe no sistema e não pode ser tratado como
  // "a planilha mandou apagar".
  const [l] = conferirAba('03',
    [daPlanilha('a', { STATUS: 'ABERTO' })],
    [noSistema('a', { STATUS: 'ABERTO', RESPONSÁVEL: 'Ícaro' })],
    ['STATUS'])
  assert.equal(l.situacao, 'inalterada')
})

test('🔴 coluna que o arquivo não trouxe é PRESERVADA na gravação', () => {
  const final = valorFinalDaLinha(
    { STATUS: 'CONCLUÍDO' },
    { STATUS: 'ABERTO', RESPONSÁVEL: 'Ícaro' },
    ['STATUS'],
  )
  assert.equal(final.STATUS, 'CONCLUÍDO', 'a planilha manda no que ela trouxe')
  assert.equal(final['RESPONSÁVEL'], 'Ícaro',
    'e o sistema mantém o resto — espalhar a linha da planilha inteira apagaria este campo')
})

test('coluna que o arquivo trouxe VAZIA é gravada vazia — isso a planilha disse', () => {
  const final = valorFinalDaLinha({ STATUS: '' }, { STATUS: 'ABERTO' }, ['STATUS'])
  assert.equal(final.STATUS, '', 'vazio informado é uma afirmação; ausente não é')
})

test('linha nova grava só o que a planilha trouxe, sem herdar nada', () => {
  const final = valorFinalDaLinha({ STATUS: 'ABERTO' }, undefined, ['STATUS', 'VALOR'])
  assert.deepEqual(final, { STATUS: 'ABERTO', VALOR: '' })
})

// ─── Resumo ───────────────────────────────────────────────────────────────────

test('o resumo conta cada situação — é o que a tela mostra antes de gravar', () => {
  const linhas = conferirAba('03',
    [daPlanilha('a', { STATUS: 'X' }), daPlanilha('b', { STATUS: 'Y' }), daPlanilha('c', { STATUS: 'Z' })],
    [
      noSistema('a', { STATUS: 'X' }),
      noSistema('b', { STATUS: 'OUTRO' }),
      noSistema('c', { STATUS: 'MEU' }, { origem: 'sistema' }),
      noSistema('d', { STATUS: 'SUMIU' }),
    ], COLUNAS)
  assert.deepEqual(resumir(linhas), { novas: 0, atualizadas: 1, conflitos: 1, inalteradas: 1, ausentes: 1, reidentificadas: 0 })
})

test('camposInformados é exatamente o que o arquivo trouxe', () => {
  assert.deepEqual([...camposInformados(['A', 'B'])], ['A', 'B'])
  assert.equal(camposInformados([]).size, 0, 'arquivo sem coluna nenhuma não autoriza apagar nada')
})

// ─── 🔴 A segunda passada ─────────────────────────────────────────────────────

/** Confere as duas passadas juntas, que é como o importador as usa. */
const conferir = (p: LinhaDaPlanilha[], s: LinhaExistente[], cols = COLUNAS) =>
  casarPorSemelhanca(conferirAba('09', p, s, cols), p, s, cols)

test('🔴 a chave mudou e a linha é a MESMA: RECONHECIDA, nunca nova + sumiu', () => {
  const valores = { STATUS: 'APRESENTADA', VALOR: '1200', 'RESPONSÁVEL': 'João' }
  const r = conferir([daPlanilha('BER-0001|', valores)], [noSistema('BM-09/2026|BER-0001', valores)])
  assert.equal(r.length, 1, 'a linha sumida foi absorvida — ela não sumiu, mudou de nome')
  assert.equal(r[0].situacao, 'inalterada',
    'o dado não mudou: o que mudou foi a identidade, e isso é contado em `reidentificadas`')
  assert.equal(resumir(r).reidentificadas, 1)
  assert.equal(r[0].chaveAnterior, 'BM-09/2026|BER-0001',
    'a tela precisa poder dizer POR QUE esta linha não é nova — e a gravação precisa disto para '
    + 'substituir a linha antiga em vez de criar uma paralela')
})

test('🔴 a chave mudou E o conteúdo mudou: ATUALIZADA com as divergências certas', () => {
  const r = conferir(
    [daPlanilha('BER-0001|BER-72000053', { STATUS: 'APROVADA', VALOR: '1200', 'RESPONSÁVEL': 'João' })],
    [noSistema('BER-0001|', { STATUS: 'APRESENTADA', VALOR: '1200', 'RESPONSÁVEL': 'João' })],
  )
  assert.equal(r.length, 1)
  assert.equal(r[0].situacao, 'atualizada')
  assert.deepEqual(r[0].divergencias, [{ campo: 'STATUS', naPlanilha: 'APROVADA', noSistema: 'APRESENTADA' }])
})

test('🔴 se a linha reconhecida tinha edição no sistema, ela vira CONFLITO — com nome', () => {
  const r = conferir(
    [daPlanilha('nova-chave', { STATUS: 'APROVADA', VALOR: '1200', 'RESPONSÁVEL': 'João' })],
    [noSistema('chave-velha', { STATUS: 'APRESENTADA', VALOR: '1200', 'RESPONSÁVEL': 'João' },
      { origem: 'sistema', editadoPor: 'Maria', editadoEm: '2026-09-20T10:00:00Z' })],
  )
  assert.equal(r[0].situacao, 'conflito')
  assert.equal(r[0].editadoPor, 'Maria',
    'mudar de chave não pode ser uma porta de fuga da conferência: a edição continua por resolver')
})

test('🔴 linha que REALMENTE sumiu continua AUSENTE — a passada não inventa casamento', () => {
  const r = conferir(
    [daPlanilha('a', { STATUS: 'ABERTO', VALOR: '10', 'RESPONSÁVEL': 'João' })],
    [noSistema('b', { STATUS: 'FECHADO', VALOR: '9999', 'RESPONSÁVEL': 'Pedro' })],
  )
  assert.deepEqual(r.map((l) => l.situacao).sort(), ['ausente', 'nova'])
})

test('🔴 uma linha nova não pode consumir DUAS sumidas — o casamento é 1 para 1', () => {
  const iguais = { STATUS: 'ABERTO', VALOR: '10', 'RESPONSÁVEL': 'João' }
  const r = conferir([daPlanilha('nova', iguais)], [noSistema('v1', iguais), noSistema('v2', iguais)])
  assert.equal(r.filter((l) => l.situacao === 'ausente').length, 1,
    'fundir duas linhas de verdade numa só é pior que o defeito que a passada conserta')
  assert.equal(r.filter((l) => l.chaveAnterior).length, 1)
})

test('o par mais parecido ganha, não o primeiro da lista', () => {
  const alvo = { STATUS: 'ABERTO', VALOR: '10', 'RESPONSÁVEL': 'João' }
  const r = conferir(
    [daPlanilha('nova', alvo)],
    [noSistema('parcial', { STATUS: 'ABERTO', VALOR: '99', 'RESPONSÁVEL': 'João' }), noSistema('exata', alvo)],
  )
  assert.equal(r.find((l) => l.chaveAnterior)?.chaveAnterior, 'exata')
})

test('sem nenhuma nova ou sem nenhuma sumida, a passada devolve tudo como estava', () => {
  const p = [daPlanilha('a', { STATUS: 'X', VALOR: '1', 'RESPONSÁVEL': 'J' })]
  assert.deepEqual(conferir(p, []).map((l) => l.situacao), ['nova'])
  assert.deepEqual(conferir([], [noSistema('a', { STATUS: 'X' })]).map((l) => l.situacao), ['ausente'])
})

test('campo vazio dos DOIS lados não conta como acerto', () => {
  const campos = ['A', 'B', 'C', 'D']
  // Um campo igual, um diferente, dois vazios em ambos: 1 de 2, não 3 de 4.
  assert.equal(semelhanca({ A: 'x', B: 'y' }, { A: 'x', B: 'z' }, campos), 0.5,
    'contar os vazios daria 80% de semelhança entre QUAISQUER duas linhas de uma aba larga')
})

test('🔴 com 2 campos comparáveis só o casamento PERFEITO passa', () => {
  assert.equal(parAceitavel(2, 1), true, 'BER-0028 tem só boletim e ID, e bate nos dois')
  assert.equal(parAceitavel(2, 0.5), false, 'mesmo boletim, ID diferente: nunca é a mesma linha')
  assert.equal(parAceitavel(1, 1), false, 'um campo só não é evidência de nada')
  assert.equal(parAceitavel(CAMPOS_MINIMOS, SEMELHANCA_MINIMA), true)
  assert.equal(parAceitavel(CAMPOS_MINIMOS, SEMELHANCA_MINIMA - 0.01), false)
})
