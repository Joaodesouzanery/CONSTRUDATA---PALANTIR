import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calcularPontoSaida, fatorDoAdicional, idDaHoraExtra, HORAS_MES_CLT } from './horaExtraCalculo'

/** Arredonda como a planilha exibe, para comparar com o que está impresso nela. */
const c = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * 🔴 Linhas reais da aba "AUSÊNCIA PONTO SAÍDA" (agosto/2026) em que a planilha e a fórmula
 * batem AO CENTAVO nas cinco colunas. São elas que provam o motor.
 */
const LINHAS_QUE_FECHAM = [
  { nome: 'RENAN',             salario: 4000.00, desc: 4.00, extras: 4.50, vh: 18.18, vhAdic: 29.09, vExtras: 130.91, vDesc:  72.73, total: 203.64 },
  { nome: 'CRISTIAN',          salario: 2801.98, desc: 4.00, extras: 4.50, vh: 12.74, vhAdic: 20.38, vExtras:  91.70, vDesc:  50.95, total: 142.65 },
  { nome: 'KAUÊ',              salario: 4000.00, desc: 8.00, extras: 9.50, vh: 18.18, vhAdic: 29.09, vExtras: 276.36, vDesc: 145.45, total: 421.82 },
  { nome: 'ANDERSON DE ASSIS', salario: 2302.75, desc: 4.50, extras: 4.50, vh: 10.47, vhAdic: 16.75, vExtras:  75.36, vDesc:  47.10, total: 122.46 },
  { nome: 'DANILO',            salario: 2302.75, desc: 8.00, extras: 9.50, vh: 10.47, vhAdic: 16.75, vExtras: 159.10, vDesc:  83.74, total: 242.84 },
  { nome: 'PATRICK',           salario: 2302.75, desc: 4.00, extras: 4.50, vh: 10.47, vhAdic: 16.75, vExtras:  75.36, vDesc:  41.87, total: 117.23 },
]

/**
 * ⚠️ As QUATRO linhas em que a planilha NÃO segue a própria fórmula.
 *
 * Em todas as dez, a coluna de horas extras bate — a divergência está só na coluna que devolve a
 * hora descontada. O caso mais claro é o Wellington Luiz: o valor impresso (R$ 47,10) é
 * exatamente o do Anderson de Assis, que tem OUTRO salário — tem cara de célula copiada de uma
 * linha para a outra. Somadas, as quatro divergências deixam R$ 13,93 a MENOS do que a fórmula
 * daria, quase tudo concentrado nele (−R$ 19,57).
 *
 * Este teste existe para o motor NÃO reproduzir o erro: o sistema calcula pela fórmula e a tela
 * aponta a diferença quando o valor importado não bate. Quem fecha a folha decide qual vale —
 * não o código, e não eu.
 */
const LINHAS_QUE_DIVERGEM = [
  { nome: 'MAELSON',         salario: 3259.65, desc: 8.10, extras: 9.50, vDescPlanilha: 121.05, vDescFormula: 120.01 },
  { nome: 'WELLINGTON LUIZ', salario: 3259.65, desc: 4.50, extras: 5.00, vDescPlanilha:  47.10, vDescFormula:  66.67 },
  { nome: 'FELIPE GLEISON',  salario: 2801.98, desc: 4.50, extras: 4.50, vDescPlanilha:  59.61, vDescFormula:  57.31 },
  { nome: 'LEONARDO',        salario: 2801.98, desc: 4.50, extras: 4.50, vDescPlanilha:  59.61, vDescFormula:  57.31 },
]

describe('calcularPontoSaida — contra o arquivo real de agosto', () => {
  for (const l of LINHAS_QUE_FECHAM) {
    it(`${l.nome}: salário ${l.salario} → total ${l.total}`, () => {
      const r = calcularPontoSaida({ salario: l.salario, horasDescontadas: l.desc, horasExtras: l.extras })
      assert.equal(c(r.valorHora), l.vh, 'valor hora')
      assert.equal(c(r.valorHoraComAdicional), l.vhAdic, 'valor hora + 60%')
      assert.equal(c(r.valorHorasExtras), l.vExtras, 'valor das horas extras')
      assert.equal(c(r.valorHorasDescontadas), l.vDesc, 'valor das horas descontadas')
      assert.equal(c(r.total), l.total, 'TOTAL')
    })
  }

  /** A coluna de horas extras fecha nas DEZ linhas, inclusive nas que divergem na devolução. */
  for (const l of LINHAS_QUE_DIVERGEM) {
    it(`${l.nome}: as horas extras fecham; a devolução é que diverge (${l.vDescPlanilha} na planilha)`, () => {
      const r = calcularPontoSaida({ salario: l.salario, horasDescontadas: l.desc, horasExtras: l.extras })
      assert.equal(c(r.valorHorasDescontadas), l.vDescFormula, 'a fórmula precisa continuar dando o valor calculado')
      assert.notEqual(c(r.valorHorasDescontadas), l.vDescPlanilha, 'o motor não pode reproduzir o valor divergente da planilha')
    })
  }

  it('⚠️ o valor do Wellington Luiz na planilha é o do Anderson — salários diferentes, mesma célula', () => {
    const anderson = calcularPontoSaida({ salario: 2302.75, horasDescontadas: 4.5, horasExtras: 4.5 })
    assert.equal(c(anderson.valorHorasDescontadas), 47.10, 'é este o valor que aparece nas duas linhas')
    const wellington = calcularPontoSaida({ salario: 3259.65, horasDescontadas: 4.5, horasExtras: 5.0 })
    assert.equal(c(wellington.valorHorasDescontadas), 66.67, 'o dele, pelo próprio salário, seria outro')
  })

  /** 🔴 A regra que o nome da aba esconde: descontadas ENTRAM no total, não saem dele. */
  it('o TOTAL soma as descontadas — a aba devolve, não desconta', () => {
    const r = calcularPontoSaida({ salario: 4000, horasDescontadas: 4, horasExtras: 4.5 })
    assert.ok(r.total > r.valorHorasExtras, 'subtrair inverteria o sinal da folha')
    assert.equal(c(r.total), c(r.valorHorasExtras + r.valorHorasDescontadas))
  })

  it('a hora descontada é devolvida SEM o adicional — só a extra leva os 60%', () => {
    const r = calcularPontoSaida({ salario: 2200, horasDescontadas: 1, horasExtras: 1 })
    assert.equal(c(r.valorHorasDescontadas), 10)   // 2200/220 = 10
    assert.equal(c(r.valorHorasExtras), 16)        // 10 × 1,6
  })

  it('o divisor é 220, não os dias úteis', () => {
    assert.equal(HORAS_MES_CLT, 220)
    assert.equal(calcularPontoSaida({ salario: 2200, horasDescontadas: 0, horasExtras: 0 }).valorHora, 10)
  })

  it('sem horas, não há nada a pagar', () => {
    assert.equal(calcularPontoSaida({ salario: 4000, horasDescontadas: 0, horasExtras: 0 }).total, 0)
  })

  it('o adicional é parâmetro: 50% da CLT produz outro número', () => {
    const cinquenta = calcularPontoSaida({ salario: 2200, horasDescontadas: 0, horasExtras: 1, fatorAdicional: 1.5 })
    assert.equal(c(cinquenta.valorHorasExtras), 15)
  })
})

describe('fatorDoAdicional', () => {
  it('converte o percentual do CLTSettings em multiplicador', () => {
    assert.equal(fatorDoAdicional(60), 1.6)
    assert.equal(fatorDoAdicional(50), 1.5)
  })
  it('sem configuração, usa o 60% deste cliente', () => {
    assert.equal(fatorDoAdicional(undefined), 1.6)
  })
})

describe('idDaHoraExtra', () => {
  it('🔴 é determinístico — dois aparelhos offline geram o MESMO id, não duplicata', () => {
    assert.equal(
      idDaHoraExtra('w1', '2026-08-01', 'fim-de-semana'),
      idDaHoraExtra('w1', '2026-08-01', 'fim-de-semana'),
    )
  })
  it('dia diferente, pessoa diferente e tipo diferente são registros diferentes', () => {
    const base = idDaHoraExtra('w1', '2026-08-01', 'fim-de-semana')
    assert.notEqual(base, idDaHoraExtra('w1', '2026-08-02', 'fim-de-semana'))
    assert.notEqual(base, idDaHoraExtra('w2', '2026-08-01', 'fim-de-semana'))
    assert.notEqual(base, idDaHoraExtra('w1', '2026-08-01', 'ponto-saida'))
  })
})
