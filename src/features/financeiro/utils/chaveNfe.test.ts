import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  chavesNoTexto, digitosDaChave, dvDaChave, formatarChave, lerChaveNfe,
} from './chaveNfe'

/**
 * A chave do cupom que o dono fotografou: NFC-e de R$ 35,00, restaurante em
 * Brasília, 31/08/2026. Cada campo foi conferido contra o que está impresso no
 * papel — é o que faz dela uma fixture e não um número inventado.
 */
const REAL = '53260855737356000102650020000021871005967012'

describe('lerChaveNfe — a chave real do cupom', () => {
  it('decodifica os nove campos, e cada um bate com o impresso', () => {
    const r = lerChaveNfe(REAL)
    assert.equal(r.ok, true)
    if (!r.ok) return
    assert.equal(r.dados.uf, 'DF')                             // "BRASILIA, DF"
    assert.equal(r.dados.competencia, '2026-08')               // 31/08/2026
    assert.equal(r.dados.cnpjFormatado, '55.737.356/0001-02')  // CNPJ impresso
    assert.equal(r.dados.modelo, '65')
    assert.equal(r.dados.modeloNome, 'NFC-e')
    assert.equal(r.dados.serie, 2)
    assert.equal(r.dados.numero, 2187)                         // "NFC-e nº 2187"
    assert.equal(r.dados.tpEmis, 1)
    assert.equal(r.dados.cNF, '00596701')                      // "(596701)" no rodapé
    assert.equal(r.dados.cDV, 2)
    assert.deepEqual(r.avisos, [])
  })

  it('aceita a chave escrita com espaços e pontos, como o cupom imprime', () => {
    const formatada = '5326 0855 7373 5600 0102 6500 2000 0021 8710 0596 7012'
    const r = lerChaveNfe(formatada)
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.dados.chave, REAL)
  })
})

describe('dvDaChave', () => {
  it('confere o DV da chave real', () => {
    assert.equal(dvDaChave(REAL.slice(0, 43)), 2)
  })

  /**
   * ⚠️ Resto 0 e resto 1 dão os DOIS o dígito 0. É o off-by-one que erra ~2 em
   * cada 11 chaves e só aparece com uma nota de verdade na mão de alguém.
   * Aqui as duas metades da regra ficam travadas.
   */
  it('resto 0 e resto 1 dão os dois DV zero', () => {
    const acharComResto = (alvo: number): string => {
      for (let n = 0; n < 100000; n++) {
        const base = String(n).padStart(43, '0')
        let soma = 0, peso = 2
        for (let i = 42; i >= 0; i--) { soma += Number(base[i]) * peso; peso = peso === 9 ? 2 : peso + 1 }
        if (soma % 11 === alvo && soma > 0) return base
      }
      throw new Error(`não achei chave com resto ${alvo}`)
    }
    assert.equal(dvDaChave(acharComResto(0)), 0)
    assert.equal(dvDaChave(acharComResto(1)), 0)
  })
})

describe('lerChaveNfe — o que ela recusa', () => {
  /**
   * ⚠️ **Este é o modelo de segurança da aba inteira.**
   *
   * Se um dígito mal lido pudesse virar uma chave aceita, a foto borrada de um
   * cupom criaria uma nota fiscal que não existe — com CNPJ plausível, data
   * plausível e número plausível. Todas as 396 mutações de um dígito têm de cair.
   *
   * (Vale saber por que vale AQUI: o resto desta chave é 9. Como o DV manda
   * resto 0 e resto 1 para o mesmo dígito, uma chave cujo resto fosse 0 ou 1
   * teria um ponto cego de uma unidade. Não é o caso desta, e o teste afirma o
   * que de fato acontece, não uma garantia maior do que a conta dá.)
   */
  it('as 396 mutações de um dígito são todas recusadas', () => {
    let testadas = 0
    for (let i = 0; i < 44; i++) {
      for (let d = 0; d <= 9; d++) {
        if (String(d) === REAL[i]) continue
        const mutante = REAL.slice(0, i) + d + REAL.slice(i + 1)
        const r = lerChaveNfe(mutante)
        testadas++
        assert.equal(r.ok, false, `dígito ${i} trocado por ${d} passou: ${mutante}`)
      }
    }
    assert.equal(testadas, 396)
  })

  it('trocar dois dígitos vizinhos diferentes de lugar é recusado', () => {
    let trocas = 0
    for (let i = 0; i < 43; i++) {
      if (REAL[i] === REAL[i + 1]) continue
      const t = REAL.slice(0, i) + REAL[i + 1] + REAL[i] + REAL.slice(i + 2)
      assert.equal(lerChaveNfe(t).ok, false, `transposição em ${i} passou`)
      trocas++
    }
    assert.ok(trocas > 20, 'a fixture precisa ter vizinhos diferentes suficientes')
  })

  it('43 e 45 dígitos são recusados pelo tamanho, não pelo DV', () => {
    for (const [bruta, n] of [[REAL.slice(0, 43), 43], [REAL + '7', 45]] as const) {
      const r = lerChaveNfe(bruta)
      assert.equal(r.ok, false)
      if (!r.ok) {
        assert.equal(r.motivo, 'tamanho')
        assert.match(r.detalhe, new RegExp(String(n)))
      }
    }
  })

  it('texto sem dígito nenhum é "vazia"', () => {
    const r = lerChaveNfe('nota fiscal')
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.motivo, 'vazia')
  })

  it('estado que não existe é recusado', () => {
    // cUF 99 não está na tabela do IBGE; o DV é recalculado para isolar o motivo.
    const semUf = '99' + REAL.slice(2, 43)
    const chave = semUf + dvDaChave(semUf)
    const r = lerChaveNfe(chave)
    assert.equal(r.ok, false)
    if (!r.ok) assert.equal(r.motivo, 'uf')
  })

  /**
   * ⚠️ O CF-e do SAT tem 44 dígitos também. Recusado pelo NOME, não por sorte no
   * DV: se passasse, produziria um CNPJ plausível e errado — pior que não ler.
   */
  it('CF-e do SAT (modelo 59) é recusado dizendo o que é', () => {
    const base = REAL.slice(0, 20) + '59' + REAL.slice(22, 43)
    const r = lerChaveNfe(base + dvDaChave(base))
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.equal(r.motivo, 'modelo-outro-documento')
      assert.match(r.detalhe, /SAT/)
    }
  })

  it('CT-e e MDF-e também são recusados por nome', () => {
    for (const mod of ['57', '58']) {
      const base = REAL.slice(0, 20) + mod + REAL.slice(22, 43)
      const r = lerChaveNfe(base + dvDaChave(base))
      assert.equal(r.ok, false)
      if (!r.ok) assert.equal(r.motivo, 'modelo-outro-documento')
    }
  })

  it('NF-e (modelo 55) passa, com o nome certo', () => {
    const base = REAL.slice(0, 20) + '55' + REAL.slice(22, 43)
    const r = lerChaveNfe(base + dvDaChave(base))
    assert.equal(r.ok, true)
    if (r.ok) assert.equal(r.dados.modeloNome, 'NF-e')
  })
})

describe('lerChaveNfe — avisos que NÃO são recusa', () => {
  it('mês 13 avisa, mas a chave continua válida — o DV passou', () => {
    const base = REAL.slice(0, 4) + '13' + REAL.slice(6, 43)
    const r = lerChaveNfe(base + dvDaChave(base))
    assert.equal(r.ok, true)
    if (r.ok) {
      assert.equal(r.avisos.length, 1)
      assert.match(r.avisos[0], /mês 13/)
    }
  })

  it('ano anterior à NF-e avisa e não recusa', () => {
    const base = REAL.slice(0, 2) + '0508' + REAL.slice(6, 43)
    const r = lerChaveNfe(base + dvDaChave(base))
    assert.equal(r.ok, true)
    if (r.ok) assert.match(r.avisos.join(' '), /2005/)
  })
})

describe('chavesNoTexto', () => {
  it('acha a chave crua', () => {
    assert.deepEqual(chavesNoTexto(`chave: ${REAL} fim`), [REAL])
  })

  it('acha no payload do QR versão 2', () => {
    const payload = `${REAL}|2|1|1|A1B2C3D4E5F6`
    assert.deepEqual(chavesNoTexto(payload), [REAL])
  })

  it('acha na URL de consulta da SEFAZ', () => {
    const url = `https://www.fazenda.df.gov.br/nfce/qrcode?p=${REAL}|2|1|1|9F8E7D`
    assert.deepEqual(chavesNoTexto(url), [REAL])
  })

  it('não devolve a mesma chave duas vezes', () => {
    assert.deepEqual(chavesNoTexto(`${REAL} e de novo ${REAL}`), [REAL])
  })

  /**
   * ⚠️ O hash do QR é hexadecimal e pode ter uma corrida longa só de dígitos.
   * Se varrêssemos com janela deslizante, alguma janela de 44 fecharia o DV por
   * acaso um dia — e uma chave inventada com DV correto é o pior resultado
   * possível aqui. Corrida de 44 exatos, ou nada.
   */
  it('não inventa chave dentro de uma corrida longa de dígitos', () => {
    const hashLongo = '1'.repeat(120)
    assert.deepEqual(chavesNoTexto(hashLongo), [])
  })

  it('corrida de 43 dígitos não vira chave', () => {
    assert.deepEqual(chavesNoTexto(REAL.slice(0, 43)), [])
  })

  it('44 dígitos com DV errado são ignorados em silêncio', () => {
    const errada = REAL.slice(0, 43) + (REAL[43] === '9' ? '8' : '9')
    assert.deepEqual(chavesNoTexto(errada), [])
  })
})

describe('formatarChave e digitosDaChave', () => {
  it('formata em onze grupos de quatro', () => {
    const f = formatarChave(REAL)
    assert.equal(f.split(' ').length, 11)
    assert.equal(f.split(' ')[0], '5326')
  })

  it('formatar e voltar não perde nada', () => {
    assert.equal(digitosDaChave(formatarChave(REAL)), REAL)
  })

  it('o que não tem 44 dígitos sai como veio, só sem pontuação', () => {
    assert.equal(formatarChave('123-456'), '123456')
  })

  it('nulo e indefinido não quebram', () => {
    assert.equal(digitosDaChave(null), '')
    assert.equal(digitosDaChave(undefined), '')
  })
})
