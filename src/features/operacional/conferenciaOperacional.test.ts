/**
 * "A planilha manda, mas eu preciso ver o que ela vai desfazer."
 *
 * Esta é a regra que o cliente deu para o Operacional, e os testes abaixo são ela por extenso.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  conferirAba, valorFinalDaLinha, resumir, camposInformados,
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
  assert.deepEqual(resumir(linhas), { novas: 0, atualizadas: 1, conflitos: 1, inalteradas: 1, ausentes: 1 })
})

test('camposInformados é exatamente o que o arquivo trouxe', () => {
  assert.deepEqual([...camposInformados(['A', 'B'])], ['A', 'B'])
  assert.equal(camposInformados([]).size, 0, 'arquivo sem coluna nenhuma não autoriza apagar nada')
})
