/**
 * O id da linha da composição precisa sobreviver a uma reimportação.
 *
 * ⚠️ Era `crypto.randomUUID()`. Reimportar a MESMA planilha trocava o id de TODOS os itens, e o
 * `deParaSiglas` do WCR e o `contractServiceId` dos RDOs ficavam órfãos em silêncio — o "Medido"
 * da obra voltava a zero sem ninguém entender por quê.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { idDoItemDeComposicao } from '@/features/torre-de-controle/utils/idDoItemDeComposicao'

test('a mesma linha, importada duas vezes, tem o MESMO id', () => {
  const a = idDoItemDeComposicao(1, 'Rede de água DN 50', 'm')
  const b = idDoItemDeComposicao(1, 'Rede de água DN 50', 'm')
  assert.equal(a, b)
})

test('corrigir o PREÇO não muda o id — é a mesma linha', () => {
  // O preço não entra na chave, então nem aparece aqui: é exatamente esse o ponto.
  assert.equal(
    idDoItemDeComposicao(3, 'Poço de visita pré-moldado', 'un'),
    idDoItemDeComposicao(3, 'Poço de visita pré-moldado', 'un'),
  )
})

test('acento e caixa não criam linha nova', () => {
  assert.equal(
    idDoItemDeComposicao(2, 'REDE DE ÁGUA', 'M'),
    idDoItemDeComposicao(2, 'rede de agua', 'm'),
  )
})

test('espaço a mais não cria linha nova', () => {
  assert.equal(
    idDoItemDeComposicao(2, 'Rede  de   água', 'm'),
    idDoItemDeComposicao(2, 'Rede de água', 'm'),
  )
})

test('descrição diferente É outra linha — o de-para precisa saber', () => {
  assert.notEqual(
    idDoItemDeComposicao(2, 'Rede de água', 'm'),
    idDoItemDeComposicao(2, 'Rede de esgoto', 'm'),
  )
})

test('unidade diferente É outra linha — metro e unidade não se somam', () => {
  assert.notEqual(
    idDoItemDeComposicao(2, 'Rede de água', 'm'),
    idDoItemDeComposicao(2, 'Rede de água', 'un'),
  )
})

test('a mesma descrição em posições diferentes da proposta são linhas diferentes', () => {
  assert.notEqual(
    idDoItemDeComposicao(1, 'Escavação', 'm³'),
    idDoItemDeComposicao(9, 'Escavação', 'm³'),
  )
})

test('o id é um uuid — a coluna do banco não aceita outra coisa', () => {
  assert.match(idDoItemDeComposicao(1, 'Rede de água', 'm'),
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
})
