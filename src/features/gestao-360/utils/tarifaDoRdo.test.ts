/**
 * O custo da equipe de um RDO.
 *
 * ⚠️ Estas fórmulas de dinheiro **não tinham um único teste**, e valoravam a equipe com tarifas
 * chumbadas no código que iam para o PDF da reunião sem rótulo. O que os testes cercam agora é a
 * regra que substituiu isso: **dado real quando existe, e a marca de "estimado" quando não**.
 *
 * O risco que eles cobrem não é a aritmética — é um número estimado se passar por medido.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  custoDaEquipeDoRdo, custoDoEquipamentoNoRdo, funcaoDoCargo, tarifasDoCadastro,
  TARIFA_REFERENCIA, TARIFA_EQUIPAMENTO_REFERENCIA,
} from './tarifaDoRdo'
import type { RdoManpower, Worker } from '@/types'

type W = Pick<Worker, 'name' | 'role' | 'hourlyRate' | 'status'>
const w = (name: string, role: string, hourlyRate: number, status: Worker['status'] = 'active'): W =>
  ({ name, role, hourlyRate, status })

const equipe = (p: Partial<RdoManpower>): RdoManpower => ({
  foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0, ...p,
})

// ─── Reconhecer a função ──────────────────────────────────────────────────────

test('o cargo cadastrado vira função do RDO, sem acento e sem caixa', () => {
  assert.equal(funcaoDoCargo('Encarregado de Obra I'), 'encarregado')
  assert.equal(funcaoDoCargo('ENCANADOR DE ESGOTO III'), 'oficial')
  assert.equal(funcaoDoCargo('Ajudante Geral I'), 'ajudante')
  assert.equal(funcaoDoCargo('Operador de Retro'), 'operador')
  assert.equal(funcaoDoCargo('Líder de Equipe'), 'encarregado', 'com acento')
  assert.equal(funcaoDoCargo('Auxiliar de Cadastro II'), 'ajudante')
})

test('cargo que não é nenhuma das quatro devolve null, não chuta', () => {
  assert.equal(funcaoDoCargo('Programador'), null)
  assert.equal(funcaoDoCargo(''), null)
})

// ─── A tarifa vinda do cadastro ───────────────────────────────────────────────

test('a tarifa por função é a MEDIANA, não a média', () => {
  // A média é sequestrada por um outlier. Um encanador cadastrado com R$ 500/h por erro de
  // digitação puxaria a tarifa de toda a função.
  const t = tarifasDoCadastro([
    w('A', 'Encanador', 20), w('B', 'Pedreiro', 22), w('C', 'Soldador', 500),
  ])
  assert.equal(t.oficial, 22, 'mediana de [20, 22, 500]')
})

test('desligado não entra na tarifa', () => {
  const t = tarifasDoCadastro([
    w('A', 'Ajudante Geral', 100, 'inactive'),
    w('B', 'Ajudante Geral', 15),
  ])
  assert.equal(t.ajudante, 15)
})

test('função sem ninguém cadastrado simplesmente não aparece', () => {
  const t = tarifasDoCadastro([w('A', 'Ajudante Geral', 15)])
  assert.equal(t.ajudante, 15)
  assert.equal(t.encarregado, undefined, 'não inventa')
})

// ─── O caminho medido ─────────────────────────────────────────────────────────

test('⚠️ NOME no RDO com cadastro completo = MEDIÇÃO, não estimativa', () => {
  // É o único caminho que não é estimativa nenhuma, e o teste existe para ele não regredir.
  const r = custoDaEquipeDoRdo(
    equipe({ officialCount: 2, employeeNames: ['José da Silva', 'Maria Souza'] }),
    [w('José da Silva', 'Encanador', 20), w('Maria Souza', 'Pedreiro', 25)],
  )
  assert.equal(r.valorBRL, (20 + 25) * 8)
  assert.equal(r.estimado, false, 'com todos cadastrados, NÃO é estimativa')
  assert.match(r.base, /cadastro/)
})

test('o nome casa sem depender de acento nem de caixa', () => {
  const r = custoDaEquipeDoRdo(
    equipe({ helperCount: 1, employeeNames: ['jose da silva'] }),
    [w('José da Silva', 'Ajudante Geral', 15)],
  )
  assert.equal(r.valorBRL, 15 * 8)
  assert.equal(r.estimado, false)
})

test('⚠️ nome que NÃO está no cadastro marca o total como estimado', () => {
  // Metade medido não é medido. O total inteiro sai marcado, porque é ele que vai para a tela.
  const r = custoDaEquipeDoRdo(
    equipe({ officialCount: 2, employeeNames: ['José da Silva', 'Fulano Desconhecido'] }),
    [w('José da Silva', 'Encanador', 20)],
  )
  assert.equal(r.estimado, true)
  assert.match(r.base, /sem cadastro/)
  assert.ok(r.valorBRL > 20 * 8, 'o desconhecido entra por referência, não some')
})

// ─── O caminho pela contagem ──────────────────────────────────────────────────

test('sem nomes, a contagem usa a tarifa mediana do cadastro — e não é estimativa', () => {
  const r = custoDaEquipeDoRdo(
    equipe({ helperCount: 3 }),
    [w('A', 'Ajudante Geral', 10), w('B', 'Ajudante Geral', 20)],
  )
  assert.equal(r.valorBRL, 3 * 8 * 15, 'mediana de [10,20] = 15')
  assert.equal(r.estimado, false)
})

test('⚠️ função SEM ninguém cadastrado cai na referência, e o total é marcado', () => {
  const r = custoDaEquipeDoRdo(equipe({ foremanCount: 1 }), [w('A', 'Ajudante Geral', 15)])
  assert.equal(r.valorBRL, 1 * 8 * TARIFA_REFERENCIA.encarregado)
  assert.equal(r.estimado, true)
  assert.match(r.base, /REFER/i)
})

test('⚠️ cadastro vazio: tudo por referência, e a frase diz isso na cara', () => {
  // É o estado de quem acabou de entrar no sistema — e era exatamente o caso em que o número
  // saía sem rótulo nenhum no PDF da reunião.
  const r = custoDaEquipeDoRdo(equipe({ foremanCount: 1, officialCount: 2, helperCount: 3 }), [])
  const esperado = 8 * (TARIFA_REFERENCIA.encarregado + 2 * TARIFA_REFERENCIA.oficial + 3 * TARIFA_REFERENCIA.ajudante)
  assert.equal(r.valorBRL, esperado)
  assert.equal(r.estimado, true)
  assert.match(r.base, /ningu[ée]m cadastrado/i)
})

test('parte do cadastro e parte por referência: marcado, com as duas contagens', () => {
  const r = custoDaEquipeDoRdo(
    equipe({ helperCount: 2, foremanCount: 1 }),
    [w('A', 'Ajudante Geral', 15)],
  )
  assert.equal(r.estimado, true)
  assert.match(r.base, /2 pelo cadastro/)
  assert.match(r.base, /1 por tarifa de refer/i)
})

test('RDO sem equipe é zero, e zero não é estimativa', () => {
  const r = custoDaEquipeDoRdo(equipe({}), [])
  assert.equal(r.valorBRL, 0)
  assert.equal(r.estimado, false, 'zero medido é zero — não precisa de ressalva')
})

// ─── Equipamento ──────────────────────────────────────────────────────────────

test('⚠️ equipamento é SEMPRE estimado — não existe cadastro de locação no produto', () => {
  const r = custoDoEquipamentoNoRdo(2, 6)
  assert.equal(r.valorBRL, 2 * 6 * TARIFA_EQUIPAMENTO_REFERENCIA)
  assert.equal(r.estimado, true)
  assert.match(r.base, /REFER/i)
  assert.match(r.base, /não há cadastro/i)
})

test('equipamento com zero hora não vira linha estimada', () => {
  assert.equal(custoDoEquipamentoNoRdo(3, 0).estimado, false)
  assert.equal(custoDoEquipamentoNoRdo(0, 8).valorBRL, 0)
})

// ─── A regra que não pode quebrar ─────────────────────────────────────────────

test('⚠️ TODO valor que passa por tarifa de referência sai marcado — sem exceção', () => {
  // É a invariante do módulo. Se alguém acrescentar um caminho novo e esquecer a marca, isto pega.
  const casos: Array<[string, ReturnType<typeof custoDaEquipeDoRdo>]> = [
    ['cadastro vazio',      custoDaEquipeDoRdo(equipe({ helperCount: 1 }), [])],
    ['função sem cadastro', custoDaEquipeDoRdo(equipe({ operatorCount: 1 }), [w('A', 'Ajudante', 15)])],
    ['nome desconhecido',   custoDaEquipeDoRdo(equipe({ officialCount: 1, employeeNames: ['X'] }), [])],
    ['equipamento',         custoDoEquipamentoNoRdo(1, 1)],
  ]
  for (const [rotulo, r] of casos) {
    assert.equal(r.estimado, true, `"${rotulo}" produziu ${r.valorBRL} sem a marca de estimado`)
    assert.ok(r.base.length > 10, `"${rotulo}" não explica de onde veio o número`)
  }
})
