/**
 * A ausência de dado não é zero.
 *
 * ─── POR QUE ESTE ARQUIVO EXISTE ──────────────────────────────────────────────
 * A DRE pintava **"0.0%" de verde esmeralda** num mês só com saídas e nenhuma receita — prejuízo
 * puro exibido como o melhor cenário possível —, porque a margem devolvia `0` quando não havia
 * denominador e a tela testava `margem >= 0`. Não era erro de arredondamento: era o número mais
 * caro da tela dizendo o contrário do que acontecia.
 *
 * A regra que passa a valer é a que o `indicadores.ts` já declarava em outro módulo: *dado ausente
 * é cinza com "—", nunca verde*. Estes testes travam as duas metades — o cálculo devolvendo `null`,
 * e os formatadores traduzindo `null` sem inventar zero.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { FinanceiroEntry } from '@/types'
import {
  computeDre, corDaMargem, filterEntries, fmtPct, presetDePeriodo,
} from './financeiroCalc'

const lanc = (p: Partial<FinanceiroEntry> & { valor: number }): FinanceiroEntry => ({
  id: `e-${Math.abs(p.valor)}-${p.data ?? 'x'}-${p.tipo ?? 'saida'}`,
  tipo: 'saida',
  descricao: 'x',
  data: '2026-09-10',
  categoria: 'materiais',
  createdAt: '',
  ...p,
} as FinanceiroEntry)

const DRE_CONFIG = { deducaoPct: 0, mapping: {} } as Parameters<typeof computeDre>[1]

describe('computeDre — margem sem receita', () => {
  /**
   * ⚠️ O teste que nomeia o defeito: mês só com saída. A margem NÃO pode ser 0 —
   * `0 >= 0` fazia a tela pintar de verde o pior mês possível.
   */
  it('mês só com saídas devolve margem null, não zero', () => {
    const dre = computeDre([lanc({ valor: 5000 })], DRE_CONFIG)
    assert.equal(dre.receitaBruta, 0)
    assert.equal(dre.custos, 5000)
    assert.equal(dre.resultado, -5000)
    assert.equal(dre.margemBruta, null)
    assert.equal(dre.margemLiquida, null)
  })

  it('sem lançamento nenhum, também é null', () => {
    const dre = computeDre([], DRE_CONFIG)
    assert.equal(dre.margemLiquida, null)
  })

  it('com receita, a margem volta a ser número', () => {
    const dre = computeDre(
      [lanc({ tipo: 'entrada', categoria: 'medicao', valor: 10000 }), lanc({ valor: 4000 })],
      DRE_CONFIG,
    )
    assert.equal(dre.receitaBruta, 10000)
    assert.equal(dre.margemBruta, 60)
    assert.equal(dre.margemLiquida, 60)
  })

  it('receita menor que o custo dá margem negativa — e negativa é diferente de ausente', () => {
    const dre = computeDre(
      [lanc({ tipo: 'entrada', categoria: 'medicao', valor: 1000 }), lanc({ valor: 3000 })],
      DRE_CONFIG,
    )
    assert.equal(dre.margemLiquida, -200)
    assert.notEqual(dre.margemLiquida, null)
  })
})

describe('fmtPct e corDaMargem', () => {
  it('null vira travessão, não "0.0%"', () => {
    assert.equal(fmtPct(null), '—')
    assert.equal(fmtPct(undefined), '—')
  })

  it('NaN e infinito também são ausência, não número', () => {
    assert.equal(fmtPct(Number.NaN), '—')
    assert.equal(fmtPct(Number.POSITIVE_INFINITY), '—')
  })

  it('número formata em pt-BR com uma casa', () => {
    assert.equal(fmtPct(60), '60.0%')
    assert.equal(fmtPct(-12.34), '-12.3%')
    assert.equal(fmtPct(0), '0.0%')
  })

  /** ⚠️ O par que impedia o defeito: zero de verdade é verde; ausência é cinza. */
  it('a cor separa zero de ausência', () => {
    assert.equal(corDaMargem(null), 'text-[#6b6b6b]')
    assert.equal(corDaMargem(0), 'text-emerald-400')
    assert.equal(corDaMargem(-1), 'text-red-400')
    assert.notEqual(corDaMargem(null), corDaMargem(0))
  })
})

describe('presetDePeriodo', () => {
  it('"mes" devolve um intervalo fechado dentro do mesmo mês', () => {
    const p = presetDePeriodo('mes')
    assert.ok(p.from && p.to)
    assert.equal(p.from!.slice(0, 7), p.to!.slice(0, 7))
    assert.ok(p.from! <= p.to!)
    assert.match(p.from!, /^\d{4}-\d{2}-01$/)
  })

  it('"12m" cobre doze meses e termina hoje', () => {
    const p = presetDePeriodo('12m')
    assert.ok(p.from && p.to)
    const meses = (Number(p.to!.slice(0, 4)) - Number(p.from!.slice(0, 4))) * 12
      + (Number(p.to!.slice(5, 7)) - Number(p.from!.slice(5, 7)))
    assert.equal(meses, 11, 'do primeiro dia de 11 meses atrás até hoje')
  })

  it('"ano" é o ano civil inteiro', () => {
    const p = presetDePeriodo('ano')
    assert.match(p.from!, /^\d{4}-01-01$/)
    assert.match(p.to!, /^\d{4}-12-31$/)
  })

  /**
   * ⚠️ "Tudo" continua existindo — é escolha legítima. O que mudou é que ele deixou de ser o
   * PADRÃO das telas, e que a barra avisa quando está ligado.
   */
  it('"tudo" não tem limite — e é por isso que a barra avisa', () => {
    assert.deepEqual(presetDePeriodo('tudo'), { from: undefined, to: undefined })
  })
})

describe('filterEntries — a janela vale igual para os dois lados', () => {
  const dentro = lanc({ tipo: 'entrada', categoria: 'medicao', valor: 100, data: '2026-09-15' })
  const foraAntes = lanc({ tipo: 'entrada', categoria: 'medicao', valor: 900, data: '2026-01-15' })
  const saida = lanc({ valor: 80, data: '2026-09-20' })

  /**
   * ⚠️ O caso que o dono do produto descreveu: uma receita antiga confrontada com despesas de
   * agora faz o resultado parecer bom. Com a janela, ela fica de fora — dos DOIS lados.
   */
  it('entrada antiga fica de fora da janela do mês', () => {
    const r = filterEntries([dentro, foraAntes, saida], { from: '2026-09-01', to: '2026-09-30' })
    assert.equal(r.length, 2)
    assert.ok(!r.includes(foraAntes))
  })

  it('sem from/to, tudo entra — inclusive a receita de janeiro', () => {
    assert.equal(filterEntries([dentro, foraAntes, saida], {}).length, 3)
  })

  it('o corte é o mesmo para entrada e para saída', () => {
    const so = { from: '2026-09-01', to: '2026-09-16' }
    const r = filterEntries([dentro, saida], so)
    assert.equal(r.length, 1, 'a saída do dia 20 sai pela mesma regra que a entrada do dia 15 entrou')
    assert.equal(r[0].tipo, 'entrada')
  })
})
