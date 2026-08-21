/**
 * A planilha "Obras em Andamento - BSB" dentro do sistema.
 *
 * Os números são os da planilha que o cliente mantém à mão. A aritmética foi conferida bloco a
 * bloco antes de modelar, e é ela que estes testes travam:
 *
 *   Obra                 SERVIÇO      MATERIAL     faturado      saldo
 *   SUPERA              592.324,14   607.620,00   138.558,20   453.765,94
 *   BRASAL              236.949,07   252.635,00    21.450,00   215.499,07
 *   PARQUE NACIONAL     254.570,90   272.819,65   101.828,36   152.742,54
 *   CONDOMÍNIO 314 SUL  218.364,65    72.917,80    87.345,86   131.018,79
 *   ─────────────────────────────────────────────────────────────────────
 *   Valor Serviço Restante                                     953.026,34
 *   Retenção Técnica / Contratual                                6.161,92
 *
 * Duas regras que a planilha revela e o modelo tem de respeitar:
 *  - **o saldo é contra o SERVIÇO**; o material é faturado à parte e não entra na conta;
 *  - **a entrada é uma linha do extrato**, não um campo separado.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  valoresDoContrato, resumoFaturamento, totaisCarteira,
  type LinhaCarteira,
} from './obraMedicao'
import type { ObraContrato, ObraFaturamento } from '@/types'

const HOJE = '2026-08-21'
const cent = (n: number) => Number(n.toFixed(2))

const nota = (p: Partial<ObraFaturamento>): ObraFaturamento => ({
  id: Math.random().toString(36).slice(2), data: '2026-01-01', valor: 0, situacao: 'recebido', ...p,
})

const contrato = (p: Partial<ObraContrato>): ObraContrato => ({ services: [], ...p })

// ── Os dois valores do contrato ───────────────────────────────────────────────

test('SERVIÇO e MATERIAL são valores distintos, e o total é a soma', () => {
  const v = valoresDoContrato(contrato({ valorServico: 592324.14, valorMaterial: 607620 }))
  assert.equal(v.servico, 592324.14)
  assert.equal(v.material, 607620)
  assert.equal(cent(v.total), 1199944.14)
})

test('obra antiga não quebra: o valorTotal vira SERVIÇO', () => {
  // Era o que ele sempre representou na prática — o saldo já era calculado contra ele.
  const v = valoresDoContrato(contrato({ valorTotal: 236949.07 }))
  assert.equal(v.servico, 236949.07)
  assert.equal(v.material, 0)
  assert.equal(v.total, 236949.07)
})

test('o campo novo vence o antigo quando os dois existem', () => {
  const v = valoresDoContrato(contrato({ valorTotal: 1, valorServico: 999 }))
  assert.equal(v.servico, 999)
})

test('contrato ausente devolve zeros, não NaN', () => {
  for (const c of [null, undefined, contrato({})]) {
    const v = valoresDoContrato(c)
    assert.equal(v.servico, 0); assert.equal(v.material, 0); assert.equal(v.total, 0)
  }
})

// ── O extrato de faturamento ──────────────────────────────────────────────────

test('SUPERA: saldo = SERVIÇO − faturado, e o MATERIAL fica de fora', () => {
  const c = contrato({
    valorServico: 592324.14,
    valorMaterial: 607620,
    faturamentos: [
      nota({ valor: 118558.20, descricao: 'Entrada Serviço', entrada: true }),
      nota({ valor: 20000.00, situacao: 'a_receber', previsaoRecebimento: '2026-09-05' }),
    ],
  })
  const r = resumoFaturamento(c, HOJE)
  assert.equal(cent(r.faturado), 138558.20)
  assert.equal(cent(r.saldo), 453765.94, 'o saldo da planilha')
  // Se o material entrasse, o saldo daria 1.061.385,94 — e é exatamente o erro a evitar.
  assert.notEqual(cent(r.saldo), 1061385.94)
})

test('BRASAL, PARQUE NACIONAL e CONDOMÍNIO 314 SUL fecham igual', () => {
  const casos = [
    { servico: 236949.07, faturado: 21450.00,  saldo: 215499.07 },
    { servico: 254570.90, faturado: 101828.36, saldo: 152742.54 },
    { servico: 218364.65, faturado: 87345.86,  saldo: 131018.79 },
  ]
  for (const c of casos) {
    const r = resumoFaturamento(
      contrato({ valorServico: c.servico, faturamentos: [nota({ valor: c.faturado })] }),
      HOJE,
    )
    assert.equal(cent(r.saldo), c.saldo, `saldo de ${c.servico}`)
  }
})

test('a entrada sai do extrato — não é um campo separado', () => {
  const r = resumoFaturamento(contrato({
    valorServico: 100000,
    faturamentos: [
      nota({ valor: 40000, descricao: 'entrada 40%', entrada: true }),
      nota({ valor: 10000, descricao: '2ª medição' }),
    ],
  }), HOJE)
  assert.equal(r.entrada, 40000)
  assert.equal(r.faturado, 50000, 'a entrada também conta como faturamento')
})

test('obra sem entrada devolve null, não zero', () => {
  // Zero diria "a entrada foi R$ 0,00"; null diz "esta obra não teve entrada", que é o caso de
  // parte das obras da planilha. A tela precisa saber a diferença para não exibir a linha.
  const r = resumoFaturamento(contrato({ valorServico: 100, faturamentos: [nota({ valor: 50 })] }), HOJE)
  assert.equal(r.entrada, null)
})

test('recebido e a receber se separam, e somam o faturado', () => {
  const r = resumoFaturamento(contrato({
    valorServico: 300000,
    faturamentos: [
      nota({ valor: 100000, situacao: 'recebido' }),
      nota({ valor: 50000,  situacao: 'a_receber', previsaoRecebimento: '2026-09-05' }),
    ],
  }), HOJE)
  assert.equal(r.recebido, 100000)
  assert.equal(r.aReceber, 50000)
  assert.equal(r.faturado, 150000)
})

test('nota prevista para antes de hoje aparece como vencida — a recebida nunca vence', () => {
  const r = resumoFaturamento(contrato({
    valorServico: 100000,
    faturamentos: [
      nota({ id: 'atrasada', valor: 10000, situacao: 'a_receber', previsaoRecebimento: '2026-08-01' }),
      nota({ id: 'futura',   valor: 10000, situacao: 'a_receber', previsaoRecebimento: '2026-09-05' }),
      nota({ id: 'paga',     valor: 10000, situacao: 'recebido',  previsaoRecebimento: '2026-08-01' }),
    ],
  }), HOJE)
  assert.deepEqual(r.vencidas.map((n) => n.id), ['atrasada'])
})

test('a retenção técnica soma, mas NÃO abate do saldo', () => {
  const r = resumoFaturamento(contrato({
    valorServico: 100000,
    faturamentos: [nota({ valor: 50000, retencaoTecnica: 1000 })],
  }), HOJE)
  assert.equal(r.retencao, 1000)
  assert.equal(r.saldo, 50000, 'o saldo é serviço − faturado; a retenção é acompanhada à parte')
})

test('contrato sem extrato: saldo é o serviço inteiro', () => {
  const r = resumoFaturamento(contrato({ valorServico: 218364.65 }), HOJE)
  assert.equal(r.faturado, 0)
  assert.equal(r.saldo, 218364.65)
})

// ── O rodapé da planilha ──────────────────────────────────────────────────────

test('o rodapé fecha: 953.026,34 de serviço restante e 6.161,92 de retenção', () => {
  const linha = (nome: string, servico: number, material: number, faturado: number, retencao: number): LinhaCarteira => ({
    siteId: nome, nome, servico, material, faturado, saldo: servico - faturado, retencao, aReceber: 0,
  })
  const t = totaisCarteira([
    linha('SUPERA',             592324.14, 607620.00, 138558.20, 3080.96),
    linha('BRASAL',             236949.07, 252635.00,  21450.00, 1072.50),
    linha('PARQUE NACIONAL',    254570.90, 272819.65, 101828.36, 1521.46),
    linha('CONDOMÍNIO 314 SUL', 218364.65,  72917.80,  87345.86,  487.00),
  ])
  assert.equal(cent(t.saldo), 953026.34, 'Valor Serviço Restante')
  assert.equal(cent(t.retencao), 6161.92, 'Retenção Técnica / Contratual')
  assert.equal(cent(t.servico), 1302208.76)
  assert.equal(cent(t.material), 1205992.45)
})

test('carteira vazia soma zero em tudo', () => {
  const t = totaisCarteira([])
  assert.deepEqual(t, { servico: 0, material: 0, faturado: 0, saldo: 0, retencao: 0, aReceber: 0 })
})
