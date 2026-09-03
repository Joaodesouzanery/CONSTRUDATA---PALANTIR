import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  acharDataEmissao, acharItens, acharTributos, acharValorTotal,
  conferirSomaDosItens, normalizarDigitosDeOcr, valorBRLDeTexto,
} from './notaFiscalCupom'

/**
 * As fixtures são transcrições no formato que o OCR de papel térmico devolve —
 * inclusive as embaralhadas. Nenhum tesseract roda aqui: o miolo é puro, e é
 * exatamente por isso que ele é conferível.
 *
 * O cupom de referência é o que o dono fotografou: restaurante em Brasília,
 * R$ 35,00, com R$ 10,65 de tributos impressos logo abaixo do total.
 */
const CUPOM_REAL = [
  'CNPJ: 55.737.356/0001-02 RESTAURANTE HORA EXTRA',
  'Documento Auxiliar da Nota Fiscal de Consumidor Eletronica',
  'Codigo Descricao UN Qtde VL.Unit VL.Total',
  'REFEICAO',
  '1,00 UN 35,00 35,00',
  'Qtde. Total de Itens 1',
  'Valor Total R$ 35,00',
  'Descontos R$ 0,00',
  'Acrescimos R$ 0,00',
  'Valor a Pagar R$ 35,00',
  'FORMA DE PAGAMENTO VALOR PAGO R$',
  'Cartao de Credito 35,00',
  'Tributos Incidentes (Lei Federal 12.741/2012): R$ 10,65',
  '31/08/2026 13:47:44',
]

describe('valorBRLDeTexto', () => {
  it('lê a forma normal', () => {
    assert.equal(valorBRLDeTexto('R$ 47,90'), 47.9)
    assert.equal(valorBRLDeTexto('35,00'), 35)
  })

  it('lê milhar com ponto e com espaço', () => {
    assert.equal(valorBRLDeTexto('1.234,50'), 1234.5)
    assert.equal(valorBRLDeTexto('1 234,50'), 1234.5)
    assert.equal(valorBRLDeTexto('12.345,67'), 12345.67)
  })

  it('aceita ponto como decimal quando não há vírgula nenhuma', () => {
    assert.equal(valorBRLDeTexto('47.90'), 47.9)
  })

  /**
   * ⚠️ A regra que impede o erro de 100×: sem separador decimal com dois dígitos,
   * recusa. `4790` não vira R$ 47,90.
   */
  it('recusa número sem centavos', () => {
    assert.equal(valorBRLDeTexto('4790'), null)
    assert.equal(valorBRLDeTexto('R$ 35'), null)
    assert.equal(valorBRLDeTexto('3'), null)
  })

  it('recusa três casas decimais', () => {
    assert.equal(valorBRLDeTexto('47,901'), null)
  })

  it('não confunde 1.234,50 com 1,23', () => {
    assert.notEqual(valorBRLDeTexto('1.234,50'), 1.23)
  })

  it('texto sem número nenhum devolve null', () => {
    assert.equal(valorBRLDeTexto('REFEICAO'), null)
  })
})

describe('normalizarDigitosDeOcr', () => {
  it('conserta as confusões clássicas do papel térmico', () => {
    assert.equal(normalizarDigitosDeOcr('4?,9O'), '4?,90')
    assert.equal(normalizarDigitosDeOcr('3S,OO'), '35,00')
    assert.equal(normalizarDigitosDeOcr('l2,80'), '12,80')
  })
})

describe('acharValorTotal — o cupom real', () => {
  it('acha os R$ 35,00 pelo rótulo "Valor a Pagar"', () => {
    const r = acharValorTotal(CUPOM_REAL)
    assert.equal(r.valor, 35)
    assert.equal(r.ancora, 'VALOR A PAGAR')
    assert.match(r.bruto, /Valor a Pagar/)
  })

  /**
   * ⚠️ **A armadilha mais cara de um cupom brasileiro.** A linha de tributos é
   * impressa por lei logo abaixo do total, com formato idêntico. Aqui ela diz
   * R$ 10,65 num total de R$ 35,00 — um erro de 70% que passaria despercebido.
   */
  it('NUNCA confunde o total com a linha de tributos da Lei 12.741', () => {
    assert.equal(acharValorTotal(CUPOM_REAL).valor, 35)
    // E mesmo sem nenhuma âncora, a linha de tributos fica fora do recurso.
    const soTributos = ['Tributos Incidentes (Lei Federal 12.741/2012): R$ 10,65']
    assert.equal(acharValorTotal(soTributos).valor, null)
  })

  it('não confunde "Qtde. Total de Itens 1" com R$ 1,00', () => {
    const r = acharValorTotal(['Qtde. Total de Itens 3', 'Valor a Pagar R$ 47,90'])
    assert.equal(r.valor, 47.9)
  })

  it('ignora troco, dinheiro e forma de pagamento', () => {
    const r = acharValorTotal([
      'Valor a Pagar R$ 47,90', 'DINHEIRO 100,00', 'TROCO 52,10',
    ])
    assert.equal(r.valor, 47.9)
  })

  it('ignora desconto e acréscimo', () => {
    assert.equal(acharValorTotal(CUPOM_REAL).valor, 35)
  })
})

describe('acharValorTotal — rótulo e número em linhas separadas', () => {
  it('acha o número na linha seguinte quando o rótulo ficou sozinho', () => {
    const r = acharValorTotal(['VALOR TOTAL R$', '47,90'])
    assert.equal(r.valor, 47.9)
    assert.equal(r.bruto, '47,90')
  })

  it('não pula para a linha seguinte se ela for anti-âncora', () => {
    const r = acharValorTotal(['TOTAL', 'Tributos R$ 6,12', 'Valor a Pagar 47,90'])
    assert.equal(r.valor, 47.9)
  })
})

describe('acharValorTotal — o OCR embaralhado', () => {
  /**
   * ⚠️ O OCR erra nos DOIS sentidos, e as duas metades precisam funcionar juntas:
   * o rótulo veio embaralhado ("VAL0R A PA6AR") E os centavos também ("9O").
   */
  it('acha a âncora embaralhada e conserta os dígitos do valor', () => {
    const r = acharValorTotal(['VAL0R A PA6AR R$ 47,9O'])
    assert.equal(r.valor, 47.9)
    assert.equal(r.ancora, 'VALOR A PAGAR')
  })

  it('conserta letras trocadas por dígitos na parte inteira', () => {
    assert.equal(acharValorTotal(['VALOR A PAGAR R$ 3S,OO']).valor, 35)
  })

  /**
   * ⚠️ E a guarda que impede o desastre silencioso: a descrição do item NÃO pode
   * ser tocada pelo mapa de confusões. Sem ela, "REFEICAO 35,00" vira
   * "REFE1C40 35,00" e o parser lê R$ 4.035,00.
   */
  it('a descrição do item nunca vira dígito', () => {
    assert.equal(valorBRLDeTexto('REFEICAO 35,00'), 35)
    assert.equal(valorBRLDeTexto('SOLDA ELETRODO 12,80'), 12.8)
  })

  /**
   * ⚠️ Recusar é a funcionalidade. Um valor sem centavos é quase nunca dinheiro,
   * e propor R$ 47,90 a partir de "479O" põe um erro de 100× na DRE.
   */
  it('recusa quando os centavos se perderam, e explica', () => {
    const r = acharValorTotal(['VALOR A PAGAR R$ 479O'])
    assert.equal(r.valor, null)
    assert.equal(r.confianca, 'nao-li')
  })

  it('recusa valor absurdo e diz que dois números se juntaram', () => {
    const r = acharValorTotal(['VALOR A PAGAR R$ 4790000,00'])
    assert.equal(r.valor, null)
    assert.match(r.avisos.join(' '), /juntaram/)
  })
})

describe('acharValorTotal — o recurso do maior valor', () => {
  it('sem âncora nenhuma, propõe o maior com centavos, rotulado como palpite', () => {
    const r = acharValorTotal(['REFEICAO 35,00', 'BEBIDA 12,50'])
    assert.equal(r.valor, 35)
    assert.equal(r.ancora, null)
    assert.equal(r.confianca, 'baixa')
    assert.match(r.avisos.join(' '), /confira/i)
  })

  it('sem nada legível, devolve nao-li em vez de chutar', () => {
    const r = acharValorTotal(['REFEICAO', 'OBRIGADO E VOLTE SEMPRE'])
    assert.equal(r.valor, null)
    assert.equal(r.confianca, 'nao-li')
  })

  it('lista vazia não quebra', () => {
    assert.equal(acharValorTotal([]).valor, null)
  })
})

describe('acharItens e a conferência da soma', () => {
  it('lê os itens do cupom sem confundir com o total', () => {
    const itens = acharItens(['REFEICAO 35,00', 'REFRIGERANTE 8,50', 'Valor a Pagar R$ 43,50'])
    assert.equal(itens.length, 2)
    assert.equal(itens[0].descricao, 'REFEICAO')
    assert.equal(itens[1].valor, 8.5)
  })

  it('a soma dos itens confere com o total', () => {
    const itens = acharItens(['REFEICAO 35,00', 'REFRIGERANTE 8,50'])
    assert.deepEqual(conferirSomaDosItens(43.5, itens), { bate: true, soma: 43.5 })
  })

  it('quando a soma não bate, quem vale é o total — o resultado só avisa', () => {
    const itens = acharItens(['REFEICAO 35,00'])
    const c = conferirSomaDosItens(43.5, itens)
    assert.equal(c?.bate, false)
    assert.equal(c?.soma, 35)
  })

  it('sem itens, não há o que conferir', () => {
    assert.equal(conferirSomaDosItens(43.5, []), null)
  })
})

describe('acharDataEmissao e acharTributos', () => {
  it('lê a data impressa no cupom real', () => {
    assert.equal(acharDataEmissao(CUPOM_REAL), '2026-08-31')
  })

  it('recusa data impossível', () => {
    assert.equal(acharDataEmissao(['45/13/2026']), null)
  })

  it('lê os tributos da Lei 12.741 — o número que ninguém olha', () => {
    assert.equal(acharTributos(CUPOM_REAL), 10.65)
  })

  it('sem linha de tributos, devolve null em vez de zero', () => {
    assert.equal(acharTributos(['Valor a Pagar R$ 35,00']), null)
  })
})
