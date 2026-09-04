import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { RdoCompizzoProducaoRow } from '@/types'
import {
  areaExecutada, ehLinhaDeArea, linhasComQuantidade, metragemDaProducao,
  unidadeDaLinha, unidadeNoNome,
} from './producaoCompizzo'

const l = (servico: string, quantidade: string, unidade?: string): RdoCompizzoProducaoRow =>
  ({ servico, quantidade, unidade } as RdoCompizzoProducaoRow)

/** As seis linhas que o formulário cria por padrão, com a unidade só no nome. */
const PADRAO = [
  l('Pintura Vermelha (m²)', ''),
  l('Pintura Amarela (m²)', ''),
  l('Faixa Branca (m)', ''),
  l('Faixa Amarela (m)', ''),
  l('Faixa Vermelha (m)', ''),
  l('Vagas PCD (un)', ''),
]

describe('unidadeNoNome', () => {
  it('lê a unidade entre parênteses no fim do nome', () => {
    assert.equal(unidadeNoNome('Faixa Branca (m)'), 'm')
    assert.equal(unidadeNoNome('Pintura Vermelha (m²)'), 'm²')
    assert.equal(unidadeNoNome('Vagas PCD (un)'), 'un')
  })

  it('normaliza m2 para m²', () => {
    assert.equal(unidadeNoNome('Piso (m2)'), 'm²')
  })

  it('parêntese que não é unidade não vira unidade', () => {
    assert.equal(unidadeNoNome('Pintura (fachada)'), undefined)
    assert.equal(unidadeNoNome('Retirada de Piso Epoxi Antigo'), undefined)
  })
})

describe('unidadeDaLinha', () => {
  it('o campo preenchido manda', () => {
    assert.equal(unidadeDaLinha(l('Faixa Branca (m)', '100', 'm²')), 'm²')
  })

  it('vazio, cai para o nome', () => {
    assert.equal(unidadeDaLinha(l('Faixa Branca (m)', '100')), 'm')
  })

  /**
   * ⚠️ O teste que nomeia o defeito. A tela usava `p.unidade || 'm²'`: sem campo e sem parêntese
   * no nome, ela **afirmava metro quadrado**. Aqui a resposta honesta é "não sei".
   */
  it('sem campo e sem pista no nome, devolve undefined — NUNCA "m²"', () => {
    assert.equal(unidadeDaLinha(l('Retirada de Piso Epoxi Antigo', '750')), undefined)
  })
})

describe('metragemDaProducao — nunca soma tipos diferentes', () => {
  /**
   * ⚠️ O número que a tela mostrava: 200 m de faixa + 800 m² de piso = "1.000 m²". Mil de coisa
   * nenhuma, com rótulo errado, e ninguém conseguia conferir.
   */
  it('separa metro linear de metro quadrado', () => {
    const m = metragemDaProducao([
      l('Pintura Vermelha (m²)', '800'),
      l('Faixa Branca (m)', '200'),
    ])
    assert.equal(m.area, 800)
    assert.equal(m.linear, 200)
    assert.notEqual(m.area + m.linear, m.area, 'as parcelas não podem virar um total só')
  })

  it('unidade avulsa fica na terceira parcela', () => {
    const m = metragemDaProducao([l('Vagas PCD (un)', '12')])
    assert.equal(m.outra, 12)
    assert.equal(m.area, 0)
    assert.equal(m.linear, 0)
  })

  it('as linhas padrão em branco não somam nada', () => {
    const m = metragemDaProducao(PADRAO)
    assert.deepEqual([m.area, m.linear, m.outra], [0, 0, 0])
  })

  it('a unidade do CAMPO vence a do nome', () => {
    // Linha renomeada mas com unidade declarada: quem manda é o campo.
    const m = metragemDaProducao([l('Faixa Branca (m)', '300', 'm²')])
    assert.equal(m.area, 300)
    assert.equal(m.linear, 0)
  })

  it('aceita quantidade escrita em pt-BR', () => {
    assert.equal(metragemDaProducao([l('Piso (m²)', '1.234,50')]).area, 1234.5)
  })
})

describe('areaExecutada e ehLinhaDeArea', () => {
  it('só o que é área entra', () => {
    assert.equal(areaExecutada([l('Piso (m²)', '750'), l('Faixa (m)', '200')]), 750)
  })

  /**
   * ⚠️ O caso real do cliente: 750 m² de "Retirada de Piso Epoxi Antigo", com unidade lançada no
   * campo. O filtro antigo (`/m²|m2/i` no NOME) não casava, e os 750 sumiam do executado, do
   * progresso, do ritmo e do RUP.
   */
  it('serviço sem "m²" no nome, mas com unidade lançada, CONTA', () => {
    assert.equal(areaExecutada([l('Retirada de Piso Epoxi Antigo', '750', 'm²')]), 750)
    assert.equal(ehLinhaDeArea(l('Retirada de Piso Epoxi Antigo', '750', 'm²')), true)
  })

  it('e sem unidade nenhuma NÃO conta como área — não se chuta', () => {
    assert.equal(areaExecutada([l('Retirada de Piso Epoxi Antigo', '750')]), 0)
    assert.equal(ehLinhaDeArea(l('Retirada de Piso Epoxi Antigo', '750')), false)
  })

  it('milímetro não vira metro', () => {
    assert.equal(areaExecutada([l('Espessura', '250', 'mm')]), 0)
  })
})

describe('linhasComQuantidade', () => {
  it('descarta as seis linhas padrão em branco', () => {
    assert.equal(linhasComQuantidade(PADRAO).length, 0)
  })

  it('mantém só o que tem número', () => {
    const r = linhasComQuantidade([...PADRAO, l('Retirada de Piso Epoxi Antigo', '750', 'm²')])
    assert.equal(r.length, 1)
    assert.equal(r[0].quantidade, '750')
  })

  it('zero não é produção', () => {
    assert.equal(linhasComQuantidade([l('Piso (m²)', '0')]).length, 0)
  })

  it('undefined não quebra', () => {
    assert.deepEqual(linhasComQuantidade(undefined), [])
  })
})
