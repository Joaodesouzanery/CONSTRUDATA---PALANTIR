import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chavesDosPrecos, estaConfirmado, reconciliarConfirmacoes } from './precosConfirmados'
import type { PrecoDoContrato } from './importarFcp'

const preco = (numeroPreco: string, descricao: string, valorUnitario: number, item?: string): PrecoDoContrato =>
  ({ numeroPreco, descricao, valorUnitario, item, unidade: 'UN', precisaConferir: false })

test('linhas gêmeas ganham chaves diferentes pela ocorrência', () => {
  const lista = [preco('10', 'Ligação', 60.95), preco('10', 'Ligação', 60.95), preco('11', 'Outra', 1)]
  const k = chavesDosPrecos('BERTIOGA', lista)
  assert.equal(new Set(k).size, 3)
  assert.ok(k[0].endsWith('#0') && k[1].endsWith('#1'))
  assert.deepEqual(chavesDosPrecos('BERTIOGA', lista), k, 'determinística')
})

test('a confirmação vale só para o valor confirmado', () => {
  const c = { confirmadoEm: '2026-09-08', confirmadoPor: 'X', valorConfirmado: 247.93 }
  assert.ok(estaConfirmado({ k: c }, 'k', 247.93))
  assert.equal(estaConfirmado({ k: c }, 'k', 274.93), null, 'valor diferente caduca')
  assert.equal(estaConfirmado(undefined, 'k', 247.93), null)
})

test('🔴 reimportar com o valor mudado caduca a confirmação; com o mesmo valor, sobrevive', () => {
  const antes = [preco('10', 'Ligação', 247.93)]
  const [k] = chavesDosPrecos('SANTOS', antes)
  const mapa = { [k]: { confirmadoEm: '2026-09-08', confirmadoPor: 'X', valorConfirmado: 247.93 } }

  const igual = reconciliarConfirmacoes(mapa, { SANTOS: antes })
  assert.equal(Object.keys(igual.mantidas).length, 1)
  assert.equal(igual.caducadas, 0)

  const mudou = reconciliarConfirmacoes(mapa, { SANTOS: [preco('10', 'Ligação', 274.93)] })
  assert.equal(Object.keys(mudou.mantidas).length, 0)
  assert.equal(mudou.caducadas, 1)

  const sumiu = reconciliarConfirmacoes(mapa, { SANTOS: [] })
  assert.equal(sumiu.caducadas, 1)
})
