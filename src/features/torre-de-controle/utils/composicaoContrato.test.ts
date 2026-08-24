/**
 * A composição do contrato, separada por categoria — e o bug que ela conserta.
 *
 * ⚠️ O CASO CENTRAL: até 24/08/2026 a conferência comparava o valor de SERVIÇO declarado contra
 * a soma de TODAS as linhas, inclusive a de material. No contrato da SUPERA isso acusava uma
 * divergência de R$ 607.643,54 que não existe — era o material sendo contado no lado errado.
 *
 * Os dois formatos reais do cliente:
 *  - CONTRATO SUPERA: 4 linhas só de mão de obra + 1 linha `vb` só de material (R$ 607.620,00,
 *    o "Faturamento direto" da cláusula 6).
 *  - PROPOSTA Compizzo/Concrecor: 20 linhas com os dois preços, fechando R$ 183.624,55 de mão de
 *    obra + R$ 180.030,00 de material = R$ 363.654,55.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  categoriaDoItem, valoresDaLinha, subtotaisComposicao, conferirContrato, itensOrdenados,
  TOLERANCIA_BRL,
} from './obraMedicao'
import type { ObraContrato, ObraContratoServico } from '@/types'

const cent = (n: number) => Number(n.toFixed(2))
const svc = (p: Partial<ObraContratoServico>): ObraContratoServico => ({
  id: Math.random().toString(36).slice(2), descricao: '', unidade: 'm²',
  qtdContrato: 0, valorUnitario: 0, ...p,
})

// ── O contrato da SUPERA, como está cadastrado hoje ───────────────────────────
const SUPERA: ObraContratoServico[] = [
  svc({ descricao: 'Pintura epóxi em piso',      unidade: 'm²', qtdContrato: 12794.06, valorUnitario: 28.94 }),
  svc({ descricao: 'Pintura epóxi em paredes',   unidade: 'm²', qtdContrato: 5337.40,  valorUnitario: 27.65 }),
  svc({ descricao: 'Demarcações e sinalizações', unidade: 'm',  qtdContrato: 6962.01,  valorUnitario: 8.75  }),
  svc({ descricao: 'Meio-fio com poliuretano',   unidade: 'm²', qtdContrato: 473.55,   valorUnitario: 28.70 }),
  // Como eu cadastrei na sexta: verba, sem categoria explícita.
  svc({ descricao: 'Faturamento direto',         unidade: 'vb', qtdContrato: 1,        valorUnitario: 607620 }),
]

const contrato = (p: Partial<ObraContrato>): ObraContrato => ({ services: [], ...p })

// ── Categoria ─────────────────────────────────────────────────────────────────

test('linha `vb` sem categoria é lida como MATERIAL — sem reeditar contrato nenhum', () => {
  // É a compatibilidade que faz o "Faturamento direto" cair no lado certo sozinho.
  assert.equal(categoriaDoItem(svc({ unidade: 'vb', valorUnitario: 607620 })), 'material')
})

test('linha comum sem categoria é serviço', () => {
  assert.equal(categoriaDoItem(svc({ unidade: 'm²' })), 'servico')
})

test('categoria explícita vence a dedução pela unidade', () => {
  assert.equal(categoriaDoItem(svc({ unidade: 'vb', categoria: 'frete' })), 'frete')
  assert.equal(categoriaDoItem(svc({ unidade: 'm²', categoria: 'material' })), 'material')
})

// ── Valor da linha ────────────────────────────────────────────────────────────

test('linha só de mão de obra não gera material', () => {
  const v = valoresDaLinha(svc({ unidade: 'm²', qtdContrato: 100, valorUnitario: 10 }))
  assert.deepEqual(v, { maoDeObra: 1000, material: 0, total: 1000 })
})

test('linha com os dois preços soma os dois (formato da proposta)', () => {
  const v = valoresDaLinha(svc({ unidade: 'm²', qtdContrato: 100, valorUnitario: 10, valorMaterialUnit: 4 }))
  assert.deepEqual(v, { maoDeObra: 1000, material: 400, total: 1400 })
})

test('linha de material sem preço de material usa o valorUnitario como material', () => {
  // O "Faturamento direto": R$ 607.620 tem de ir para o lado do MATERIAL, não do serviço.
  const v = valoresDaLinha(svc({ unidade: 'vb', qtdContrato: 1, valorUnitario: 607620 }))
  assert.deepEqual(v, { maoDeObra: 0, material: 607620, total: 607620 })
})

test('o % aplicado reduz os dois preços', () => {
  const v = valoresDaLinha(svc({ qtdContrato: 100, valorUnitario: 10, valorMaterialUnit: 10, pctAplicado: 50 }))
  assert.deepEqual(v, { maoDeObra: 500, material: 500, total: 1000 })
})

// ── Subtotais ─────────────────────────────────────────────────────────────────

test('SUPERA: serviço e material saem separados, cada um do seu lado', () => {
  const sub = subtotaisComposicao(SUPERA)
  assert.equal(cent(sub.servico), 592347.68, 'soma de quantidade × preço das 4 linhas de serviço')
  assert.equal(cent(sub.material), 607620.00, 'o faturamento direto, inteiro, do lado do material')
  assert.equal(cent(sub.total), 1199967.68)
})

test('a proposta de 20 linhas fecha 183.624,55 + 180.030,00', () => {
  // Uma linha de frete em `vb` e uma de lombadas em `un` no meio, como no documento real.
  const linhas: ObraContratoServico[] = [
    svc({ descricao: 'Mão de obra e material', unidade: 'm²', qtdContrato: 1, valorUnitario: 183624.55, valorMaterialUnit: 178030 }),
    svc({ descricao: 'Lombadas',               unidade: 'un', qtdContrato: 4, valorUnitario: 250, categoria: 'material' }),
    svc({ descricao: 'Frete Previsto',         unidade: 'vb', qtdContrato: 1, valorUnitario: 1000, categoria: 'frete' }),
  ]
  const sub = subtotaisComposicao(linhas)
  assert.equal(cent(sub.servico), 183624.55, 'só a mão de obra')
  // Frete entra do lado do material: o contrato tem duas caixas, e frete é insumo, não trabalho.
  assert.equal(cent(sub.material), 180030.00, '178.030 + 1.000 de lombadas + 1.000 de frete')
  assert.equal(cent(sub.porCategoria.frete), 1000, 'e continua visível separado')
  assert.equal(cent(sub.total), 363654.55)
})

// ── A conferência: o bug ──────────────────────────────────────────────────────

test('⚠️ SUPERA: o Δ de serviço é R$ 23,54 — NÃO R$ 607.643,54', () => {
  // Este é o teste que trava o bug de 22/08.
  const c = conferirContrato(
    contrato({ valorServico: 592324.14, valorMaterial: 607620, services: SUPERA }),
    SUPERA,
  )
  assert.equal(cent(c.servico!.diferenca), 23.54)
  assert.notEqual(cent(c.servico!.diferenca), 607643.54, 'o material voltou a contar como serviço')
  assert.ok(c.servico!.arredondamento, 'R$ 23,54 em R$ 592 mil é arredondamento, não alerta')
})

test('SUPERA: o material confere exato', () => {
  const c = conferirContrato(
    contrato({ valorServico: 592324.14, valorMaterial: 607620, services: SUPERA }),
    SUPERA,
  )
  assert.equal(c.material!.diferenca, 0)
  assert.ok(c.material!.arredondamento)
})

test('o limite novo: 0,004% é arredondamento; 0,6% e R$ 1.500 são alerta', () => {
  const nada = conferirContrato(contrato({ valorServico: 592324.14 }),
    [svc({ qtdContrato: 1, valorUnitario: 592347.68 })])
  assert.ok(nada.servico!.arredondamento, '23,54 em 592 mil')

  // O limite é o MAIOR entre 0,5% e R$ 1.000 — em contrato pequeno manda o piso em reais, em
  // contrato grande manda o percentual. R$ 600 em R$ 100 mil é 0,6%, mas ainda cabe no piso.
  const seiscentos = conferirContrato(contrato({ valorServico: 100000 }),
    [svc({ qtdContrato: 1, valorUnitario: 100600 })])
  assert.ok(seiscentos.servico!.arredondamento, 'R$ 600 não passa do piso de R$ 1.000')

  const doisMil = conferirContrato(contrato({ valorServico: 100000 }),
    [svc({ qtdContrato: 1, valorUnitario: 102000 })])
  assert.ok(!doisMil.servico!.arredondamento, 'R$ 2.000 (2%) passa dos dois limites — é alerta')

  // Em contrato grande, o piso em reais é que manda.
  const milEQuinhentos = conferirContrato(contrato({ valorServico: 10_000_000 }),
    [svc({ qtdContrato: 1, valorUnitario: 10_001_500 })])
  assert.ok(milEQuinhentos.servico!.arredondamento, `R$ 1.500 é 0,015% — abaixo dos 0,5%`)
  assert.equal(TOLERANCIA_BRL, 1000)
})

test('sem valor declarado não há o que conferir', () => {
  const c = conferirContrato(contrato({}), SUPERA)
  assert.equal(c.servico, null)
  assert.equal(c.material, null)
})

// ── Ordem ─────────────────────────────────────────────────────────────────────

test('a composição respeita o ITEM numerado da proposta', () => {
  const linhas = [
    svc({ descricao: 'terceiro', ordem: 3 }),
    svc({ descricao: 'primeiro', ordem: 1 }),
    svc({ descricao: 'segundo',  ordem: 2 }),
  ]
  assert.deepEqual(itensOrdenados(linhas).map((l) => l.descricao), ['primeiro', 'segundo', 'terceiro'])
})

test('sem ITEM numerado, vale a ordem de cadastro', () => {
  const linhas = [svc({ descricao: 'a' }), svc({ descricao: 'b' }), svc({ descricao: 'c' })]
  assert.deepEqual(itensOrdenados(linhas).map((l) => l.descricao), ['a', 'b', 'c'])
})
