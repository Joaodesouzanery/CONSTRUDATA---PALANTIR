import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { RdoCompizzoProducaoRow } from '@/types'
import {
  areaExecutada, ehLinhaDeArea, linhasComQuantidade, metragemDaProducao,
  unidadeDaLinha, unidadeNoNome,
  OPCAO_AVULSO, classificacaoDaLinha, linhaVazia, linhasSemDestino,
} from './producaoCompizzo'
import { FASES_PADRAO } from '../data/fasesPadrao'
import { idDaFasePadrao } from '../data/idDaFase'

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

// ─── 🔴 A classificação da linha ──────────────────────────────────────────────
//
// O `<select>` de fase passou a abrir em "Selecionar Fase", e o serviço avulso foi para o fim da
// lista. Antes disso, `faseId` ausente queria dizer duas coisas ao mesmo tempo — "ainda não
// escolhi" e "é avulso" — e enquanto a primeira opção ERA o avulso, dava na mesma. Agora não dá.

describe('classificacaoDaLinha', () => {
  it('🔴 RDO antigo reabre como AVULSO, com o nome do serviço na tela', () => {
    // Esta é a linha que o RDO de setembro tem gravada: sem `faseId`, sem `classificacao`, com
    // nome. Se ela derivasse para "não escolhida", o documento já assinado reabriria em branco e
    // quem salvasse o apagaria de vez.
    assert.equal(classificacaoDaLinha({ servico: 'Pintura Vermelha (m²)' } as RdoCompizzoProducaoRow), 'avulso')
    assert.equal(classificacaoDaLinha({ servico: '  ' } as RdoCompizzoProducaoRow), 'nao-escolhida')
  })

  it('🔴 a fase manda sobre a classificação — estado inconsistente não tira a linha da meta', () => {
    assert.equal(
      classificacaoDaLinha({ faseId: 'f-1', classificacao: 'avulso', servico: 'x' } as RdoCompizzoProducaoRow),
      'fase',
    )
  })

  it('a escolha explícita vence a derivação pelo nome', () => {
    assert.equal(
      classificacaoDaLinha({ servico: 'Piso epóxi', classificacao: 'nao-escolhida' } as RdoCompizzoProducaoRow),
      'nao-escolhida',
    )
    assert.equal(classificacaoDaLinha({ servico: '', classificacao: 'avulso' } as RdoCompizzoProducaoRow), 'avulso')
  })

  it('🔴 o valor do avulso NUNCA colide com o id de uma fase', () => {
    // Se colidisse, a metragem de uma fase de verdade viraria avulsa — em silêncio, e sem entrar
    // na meta da obra.
    for (const f of FASES_PADRAO) assert.notEqual(idDaFasePadrao(f.nome), OPCAO_AVULSO)
    assert.ok(!OPCAO_AVULSO.startsWith('fase-padrao:'))
  })
})

describe('linhaVazia e linhasSemDestino', () => {
  it('linha sem classificação e sem nada digitado é ruído', () => {
    assert.equal(linhaVazia({ servico: '', quantidade: '' } as RdoCompizzoProducaoRow), true)
  })

  it('🔴 meta digitada com a quantidade em branco NÃO é linha vazia', () => {
    // Descartá-la apagaria a meta da atividade no Planejamento — informação que alguém digitou.
    assert.equal(
      linhaVazia({ servico: '', quantidade: '', quantidadePrevista: 300 } as RdoCompizzoProducaoRow),
      false,
    )
  })

  it('linha com fase ou com nome nunca é vazia', () => {
    assert.equal(linhaVazia({ faseId: 'f-1', servico: 'Primer', quantidade: '' } as RdoCompizzoProducaoRow), false)
    assert.equal(linhaVazia({ servico: 'Piso epóxi', quantidade: '' } as RdoCompizzoProducaoRow), false)
  })

  it('🔴 quantidade SEM destino é apontada — é o caso que o "Selecionar Fase" cria', () => {
    const rows = [
      { servico: '', quantidade: '120', classificacao: 'nao-escolhida' },          // 0 · sem nada
      { faseId: 'f-1', servico: 'Primer', quantidade: '80' },                       // 1 · ok
      { servico: '', quantidade: '40', classificacao: 'avulso' },                   // 2 · avulso sem nome
      { servico: 'Piso epóxi', quantidade: '10', classificacao: 'avulso' },         // 3 · ok
      { servico: '', quantidade: '', classificacao: 'nao-escolhida' },              // 4 · vazia, não acusa
    ] as RdoCompizzoProducaoRow[]
    assert.deepEqual(linhasSemDestino(rows), [0, 2],
      'um número sem fase e sem nome é gravado, impresso, e o sistema não sabe explicá-lo: não '
      + 'entra na meta nem no Planejamento')
  })

  it('serviço avulso COM nome nunca é acusado — o cliente o manteve de propósito', () => {
    const rows = [{ servico: 'Limpeza fina', quantidade: '1', classificacao: 'avulso' }] as RdoCompizzoProducaoRow[]
    assert.deepEqual(linhasSemDestino(rows), [])
  })
})
