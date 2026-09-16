import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Cargo, Worker } from '@/types'
import { cargosSugeridos, chaveDoCargo, diariaSugerida, ehCargoDeVerdade } from './cargosPadrao'

const w = (role: string, extra: Partial<Worker> = {}) => ({ role, ...extra }) as Worker
const cargo = (nome: string, sab?: number, dom?: number): Cargo =>
  ({ id: nome, nome, valorSabado: sab, valorDomingo: dom })

describe('chaveDoCargo', () => {
  /** 🔴 O arquivo real traz o MESMO cargo escrito dos dois jeitos, na mesma coluna. */
  it('acento não cria cargo novo', () => {
    assert.equal(chaveDoCargo('ENCANADOR DE ÁGUA I'), chaveDoCargo('ENCANADOR DE AGUA I'))
    assert.equal(chaveDoCargo('ENCANADOR DE ÁGUA III'), chaveDoCargo('encanador de agua iii'))
  })

  it('caixa e espaço dobrado também não', () => {
    assert.equal(chaveDoCargo('  Pedreiro   I '), chaveDoCargo('PEDREIRO I'))
  })
})

describe('ehCargoDeVerdade', () => {
  it('recusa as três linhas que não são função', () => {
    assert.equal(ehCargoDeVerdade('-'), false)
    assert.equal(ehCargoDeVerdade(''), false)
    assert.equal(ehCargoDeVerdade('MORADOR - RONALDO A. OLIVEIRA'), false)
  })

  it('aceita cargo de verdade', () => {
    assert.equal(ehCargoDeVerdade('AJUDANTE GERAL I'), true)
  })
})

describe('cargosSugeridos', () => {
  it('🔴 "ÁGUA I" e "AGUA I" viram uma sugestão só', () => {
    const s = cargosSugeridos([w('ENCANADOR DE AGUA I'), w('ENCANADOR DE ÁGUA I')], [])
    const agua = s.filter((c) => chaveDoCargo(c.nome) === chaveDoCargo('encanador de agua i'))
    assert.equal(agua.length, 1, 'a mesma função apareceu duas vezes por causa do acento')
  })

  it('não sugere o que já está cadastrado, nem com grafia diferente', () => {
    const s = cargosSugeridos([w('ENCANADOR DE AGUA I')], [cargo('ENCANADOR DE ÁGUA I', 250)])
    assert.equal(s.some((c) => chaveDoCargo(c.nome) === chaveDoCargo('encanador de agua i')), false)
  })

  it('descarta morador e cargo vazio vindos do quadro de pessoal', () => {
    const s = cargosSugeridos([w('MORADOR - RONALDO A. OLIVEIRA'), w(''), w('-')], [])
    assert.equal(s.some((c) => !ehCargoDeVerdade(c.nome)), false)
  })

  it('cargo que só existe no quadro de pessoal entra SEM valor — ausente, não zero', () => {
    const s = cargosSugeridos([w('ENGENHEIRO RESIDENTE')], [])
    const novo = s.find((c) => c.nome === 'ENGENHEIRO RESIDENTE')
    assert.ok(novo, 'o cargo do quadro de pessoal precisa ser oferecido')
    assert.equal(novo!.valorSabado, undefined)
    assert.equal(novo!.valorDomingo, undefined)
  })
})

describe('diariaSugerida — a precedência inteira', () => {
  const cargos = [cargo('AJUDANTE GERAL I', 300, 300)]

  it('sem override, usa o valor do cargo', () => {
    assert.equal(diariaSugerida(w('AJUDANTE GERAL I'), cargos, false), 300)
  })

  it('🔴 o override da pessoa vence o cargo (o caso do Edson Olímpio)', () => {
    const edson = w('AJUDANTE GERAL I', { heSabadoOverride: 250 })
    assert.equal(diariaSugerida(edson, cargos, false), 250)
  })

  it('override de sábado não vaza para domingo', () => {
    const p = w('AJUDANTE GERAL I', { heSabadoOverride: 250 })
    assert.equal(diariaSugerida(p, cargos, true), 300)
  })

  it('🔴 sem cargo cadastrado devolve null — nunca 0', () => {
    assert.equal(diariaSugerida(w('CARGO QUE NINGUÉM CADASTROU'), cargos, false), null)
    assert.equal(diariaSugerida(undefined, cargos, false), null)
  })

  it('cargo cadastrado só com sábado devolve null no domingo', () => {
    assert.equal(diariaSugerida(w('AUX'), [cargo('AUX', 150)], true), null)
  })

  it('zero configurado de propósito é zero, não "sem valor"', () => {
    assert.equal(diariaSugerida(w('X', { heSabadoOverride: 0 }), cargos, false), 0)
  })

  it('acha o cargo mesmo com acento diferente do cadastro', () => {
    const c = [cargo('ENCANADOR DE ÁGUA III', 250, 350)]
    assert.equal(diariaSugerida(w('ENCANADOR DE AGUA III'), c, true), 350)
  })
})
