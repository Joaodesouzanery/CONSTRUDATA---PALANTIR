/**
 * A SUPERA de ponta a ponta — o teste que decide.
 *
 * Os três números da planilha do cliente já passavam, mas em testes SEPARADOS, cada um chamando
 * uma função isolada. O caminho inteiro nunca tinha corrido junto, e foi essa a cobrança:
 * *"isso ainda não está provado"*.
 *
 * Aqui o percurso é o mesmo que a pessoa faz na tela, na mesma ordem:
 *
 *   obra vazia
 *     → cola a composição do Excel        (lerTabelaColada + aplicarMapeamento)
 *     → grava os itens no contrato
 *     → cadastra serviço 592.324,14 · material 607.620,00
 *     → lança as duas notas               (59.232,45 + 79.325,75)
 *     → confere na tela
 *
 * Se qualquer elo quebrar — o importador normalizando a unidade errado, a linha de material
 * caindo no lado do serviço, a nota abatendo do saldo errado, o título saindo duplicado — este
 * teste falha e diz onde. É a diferença entre "a função está certa" e "o sistema está certo".
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lerTabelaColada, aplicarMapeamento, mapearAutomatico } from './composicaoImport'
import {
  valoresDoContrato, subtotaisComposicao, conferirContrato, resumoFaturamento,
  totaisCarteira, metragemContratada, type LinhaCarteira,
} from './obraMedicao'
import { titulosDoFaturamento } from './faturamentoParaFinanceiro'
import { formatarMetragem } from '@/lib/unidadesMedida'
import type { ConstructionSite, ObraContrato, ObraContratoServico, ObraFaturamento } from '@/types'

const HOJE = '2026-08-25'
const cent = (n: number) => Number(n.toFixed(2))

/**
 * A composição da SUPERA como ela sai do Excel: TAB entre colunas, vírgula decimal, e a linha de
 * material sem quantidade. Nenhum cabeçalho foi "arrumado" para o teste — são os nomes que a
 * planilha real usa.
 */
const COLADO_DO_EXCEL = [
  'ITEM\tDESCRIÇÃO\tUN\tQTD\tMão de obra\tMaterial',
  '1\tPintura epóxi em piso\tm²\t12.794,06\t28,94\t',
  '2\tPintura epóxi em paredes\tm²\t5.337,40\t27,65\t',
  '3\tPintura epóxi demarcações e sinalizações\tm\t6.962,01\t8,75\t',
  '4\tPintura de meio-fio com poliuretano\tm²\t473,55\t28,70\t',
  '5\tFaturamento direto\tvb\t1,00\t\t607.620,00',
].join('\n')

/** As duas notas que somam os R$ 138.558,20 faturados. */
const NOTAS: ObraFaturamento[] = [
  { id: 'nf-1', data: '2026-06-10', nf: '1041', descricao: 'Entrada Serviço',
    valor: 59232.45, situacao: 'recebido', dataRecebimento: '2026-06-12', entrada: true, categoria: 'servico' },
  { id: 'nf-2', data: '2026-07-15', nf: '1088', descricao: '2ª medição',
    valor: 79325.75, situacao: 'a_receber', previsaoRecebimento: '2026-09-05', categoria: 'servico' },
]

/** Reproduz o que a tela faz: cola → mapeia → vira item de contrato com id. */
function importarComposicao(colado: string): ObraContratoServico[] {
  const tabela = lerTabelaColada(colado)
  const itens = aplicarMapeamento(tabela.rows, mapearAutomatico(tabela.headers))
  return itens.map((i, idx) => {
    const { aviso: _a, ...item } = i
    void _a
    return { ...item, id: `item-${idx + 1}` }
  })
}

const obraSupera = (contrato: ObraContrato): ConstructionSite => ({
  id: 'obra-supera', name: 'SUPERA', owner: 'SUPERA EMPREENDIMENTOS', company: 'Compizzo', contrato,
} as unknown as ConstructionSite)

// ─────────────────────────────────────────────────────────────────────────────

test('PASSO 1 · colar do Excel produz os 5 itens, com a unidade certa', () => {
  const itens = importarComposicao(COLADO_DO_EXCEL)
  assert.equal(itens.length, 5)

  assert.deepEqual(itens.map((i) => i.unidade), ['m²', 'm²', 'm', 'm²', 'vb'])
  assert.equal(itens[0].qtdContrato, 12794.06, 'o separador de milhar do Excel foi entendido')
  assert.equal(itens[0].valorUnitario, 28.94)
  assert.equal(itens[2].unidade, 'm', 'demarcação é metro LINEAR, não m²')
  assert.equal(itens[4].qtdContrato, 1, 'verba trava a quantidade em 1')
  assert.equal(itens[4].valorMaterialUnit, 607620, 'o faturamento direto entrou como material')
})

test('PASSO 2 · a composição separa serviço de material — o bug de 22/08', () => {
  const itens = importarComposicao(COLADO_DO_EXCEL)
  const sub = subtotaisComposicao(itens)

  assert.equal(cent(sub.servico), 592347.68, 'soma de quantidade × preço das 4 linhas de serviço')
  assert.equal(cent(sub.material), 607620.00, 'o faturamento direto, inteiro, do lado do material')
  // Se o material voltar a contar como serviço, o subtotal daria 1.199.967,68 e o Δ, R$ 607.643,54.
  assert.notEqual(cent(sub.servico), 1199967.68)
})

test('PASSO 3 · a Área/Extensão sai em duas parcelas, sem somar m com m²', () => {
  const m = metragemContratada(importarComposicao(COLADO_DO_EXCEL))
  assert.equal(formatarMetragem(m), '18.605,01 m² + 6.962,01 m')
  // 18.605,01 + 6.962,01 = 25.567,02 — o número que não significa nada.
  assert.notEqual(cent(m.area + m.linear), 0)
  assert.equal(cent(m.area), 18605.01)
  assert.equal(cent(m.linear), 6962.01)
})

test('PASSO 4 · ⚠️ o Δ de serviço é R$ 23,54 e o de material é zero', () => {
  const services = importarComposicao(COLADO_DO_EXCEL)
  const contrato: ObraContrato = { services, valorServico: 592324.14, valorMaterial: 607620 }
  const c = conferirContrato(contrato, services)

  assert.equal(cent(c.servico!.diferenca), 23.54)
  assert.ok(c.servico!.arredondamento, 'R$ 23,54 em R$ 592 mil é arredondamento, não alerta')
  assert.equal(cent(c.material!.diferenca), 0.00)
  // A trava do bug: nunca mais R$ 607.643,54.
  assert.notEqual(cent(c.servico!.diferenca), 607643.54)
})

test('PASSO 5 · o saldo fecha em R$ 453.765,94 — o número da planilha', () => {
  const services = importarComposicao(COLADO_DO_EXCEL)
  const contrato: ObraContrato = {
    services, valorServico: 592324.14, valorMaterial: 607620, faturamentos: NOTAS,
  }
  const fat = resumoFaturamento(contrato, HOJE)

  assert.equal(cent(fat.faturado), 138558.20)
  assert.equal(cent(fat.saldo), 453765.94)
  assert.equal(cent(fat.entrada!), 59232.45, 'a entrada é a linha marcada do extrato')
  assert.equal(cent(fat.recebido), 59232.45)
  assert.equal(cent(fat.aReceber), 79325.75)
  // Se o material entrasse na conta do saldo, daria 1.061.385,94.
  assert.notEqual(cent(fat.saldo), 1061385.94)
})

test('PASSO 6 · o Financeiro recebe duas cobranças, uma paga e uma pendente', () => {
  const services = importarComposicao(COLADO_DO_EXCEL)
  const site = obraSupera({ services, valorServico: 592324.14, valorMaterial: 607620, faturamentos: NOTAS })
  const titulos = titulosDoFaturamento(site)

  assert.equal(titulos.length, 2)
  const paga = titulos.find((t) => t.valor === 59232.45)!
  assert.equal(paga.status, 'pago')
  assert.equal(paga.dataPagamento, '2026-06-12')
  assert.equal(paga.categoria, 'adiantamento', 'a entrada é adiantamento')

  const pendente = titulos.find((t) => t.valor === 79325.75)!
  assert.equal(pendente.status, 'pendente')
  assert.equal(pendente.vencimento, '2026-09-05')
  assert.equal(pendente.categoria, 'medicao')

  // Reprocessar o mesmo extrato não pode gerar uma terceira cobrança.
  const denovo = titulosDoFaturamento(site)
  assert.deepEqual(denovo.map((t) => t.id).sort(), titulos.map((t) => t.id).sort())
})

test('PASSO 7 · a obra entra na Carteira com o contrato, e nunca com o orçamento do cadastro', () => {
  const services = importarComposicao(COLADO_DO_EXCEL)
  const contrato: ObraContrato = {
    services, valorServico: 592324.14, valorMaterial: 607620, faturamentos: NOTAS,
  }
  const v = valoresDoContrato(contrato)
  const fat = resumoFaturamento(contrato, HOJE)

  const linha: LinhaCarteira = {
    siteId: 'obra-supera', nome: 'SUPERA',
    servico: v.servico, material: v.material,
    faturado: fat.faturado, saldo: fat.saldo, retencao: fat.retencao, aReceber: fat.aReceber,
  }
  const t = totaisCarteira([linha])

  assert.equal(cent(t.servico), 592324.14)
  assert.equal(cent(t.material), 607620.00)
  assert.equal(cent(t.saldo), 453765.94)
  assert.equal(cent(t.aReceber), 79325.75)
  // O contrato cheio é 1.199.944,14 — os R$ 12.000 do campo antigo do modal não entram em nada.
  assert.equal(cent(v.total), 1199944.14)
})

test('PASSO 8 · a nota vencida é apontada, a que está no prazo não', () => {
  const services = importarComposicao(COLADO_DO_EXCEL)
  const contrato: ObraContrato = { services, valorServico: 592324.14, faturamentos: NOTAS }

  // Hoje (25/08) a 2ª medição vence só em 05/09 — está no prazo.
  assert.equal(resumoFaturamento(contrato, HOJE).vencidas.length, 0)
  // Em 10/09 ela venceu.
  const depois = resumoFaturamento(contrato, '2026-09-10')
  assert.deepEqual(depois.vencidas.map((n) => n.nf), ['1088'])
})

test('a proposta Compizzo/Concrecor, com os dois preços por linha, também fecha', () => {
  // O outro formato do cliente: 183.624,55 de mão de obra + 180.030,00 de material.
  const colado = [
    'ITEM\tDESCRIÇÃO\tUN\tQTD\tMão de obra\tMaterial',
    '1\tPintura epóxi\tm²\t1,00\t183.624,55\t178.030,00',
    '2\tLombadas\tun\t4,00\t\t250,00',
    '3\tFrete Previsto\tvb\t1,00\t\t1.000,00',
  ].join('\n')
  const sub = subtotaisComposicao(importarComposicao(colado))
  assert.equal(cent(sub.servico), 183624.55)
  assert.equal(cent(sub.material), 180030.00)
  assert.equal(cent(sub.total), 363654.55)
})
