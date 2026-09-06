/**
 * A conferência mês a mês.
 *
 * ─── O TESTE QUE MAIS IMPORTA AQUI ────────────────────────────────────────────
 * Não é "achou 89 divergências". É **"não escondeu nenhuma"**. Uma conferência que atribui causa a
 * tudo é indistinguível de uma que carimba causa em cima de tudo — que foi exatamente o defeito da
 * versão anterior (`ABAS_AFETADAS_PELA_SEMANA` colava o mesmo texto em qualquer divergência das
 * duas abas). Por isso o par de testes: `semExplicacao === 0` numa grade que o motor reproduz, e
 * `semExplicacao > 0` assim que uma célula é adulterada. Sem o segundo, o primeiro não prova nada.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BERTIOGA_SANTOS as P } from './premissasBertiogaSantos'
import { fluxoMensal, fluxoEconomico } from './motor'
import { conferirGrade } from './conferirGrade'
import type { Matriz } from '../controleDeCaixaPlanilha'
import type { Abas } from './importarFcp'

/** `2026-08-01` → a `Date` que o xlsx entregaria. */
const data = (iso: string) => new Date(`${iso}T00:00:00`)

/**
 * Monta as duas abas calculadas A PARTIR do próprio motor.
 *
 * É de propósito: uma planilha que reproduz o motor tem de dar zero divergência. É a linha de base
 * contra a qual a adulteração é medida — sem ela, um "achou divergência" não distingue defeito de
 * ruído.
 */
function abasQueEspelhamOMotor(): Abas {
  const mensal = fluxoMensal(P)
  const econ = fluxoEconomico(P)

  const linhaDeMeses = (linhas: Array<{ mes: { mes: string } }>): unknown[] =>
    ['Mês', ...linhas.map((l) => data(l.mes.mes))]

  const linha = <T,>(rotulo: string, linhas: T[], campo: (l: T) => number): unknown[] =>
    [rotulo, ...linhas.map(campo)]

  const FCP_MENSAL: Matriz = [
    ['FCP MENSAL — FINANCEIRO'],
    [],
    [],
    linhaDeMeses(mensal),
    ['Dias de obra no mês', ...mensal.map((m) => m.mes.diasDeObra)],
    [],
    ['GLOBAL — BERTIOGA + SANTOS'],
    linha('Medição bruta', mensal, (m) => m.medicaoBruta),
    linha('Recebimento bruto', mensal, (m) => m.recebimento),
    linha('(–) Desconto do consórcio', mensal, (m) => m.descontoConsorcio),
    linha('(–) Imposto da nota', mensal, (m) => m.imposto),
    linha('ENTRA NO CAIXA DA WCR', mensal, (m) => m.entraNoCaixa),
    linha('(–) Sai do caixa da WCR', mensal, (m) => m.saiDoCaixa),
    linha('Saldo do mês', mensal, (m) => m.saldoDoMes),
    linha('CAIXA ACUMULADO — antes do recebimento', mensal, (m) => m.acumuladoAntesDoRecebimento),
    linha('CAIXA ACUMULADO — após o recebimento', mensal, (m) => m.acumuladoDepois),
  ] as Matriz

  const ECONOMICO: Matriz = [
    ['ECONÔMICO — RESULTADO DO CONTRATO'],
    [],
    [],
    linhaDeMeses(econ),
    ['Dias de obra no mês', ...econ.map((e) => e.mes.diasDeObra)],
    [],
    [],
    linha('Medição bruta', econ, (e) => e.medicaoBruta),
    linha('(–) Imposto da nota', econ, (e) => e.imposto),
    linha('(=) Medição líquida de imposto', econ, (e) => e.medicaoLiquida),
    linha('(–) Folha das equipes', econ, (e) => e.folha),
    linha('(–) Engenheiro', econ, (e) => e.engenheiro),
    linha('(–) Estrutura e locações', econ, (e) => e.estrutura),
    linha('(–) Custos indiretos', econ, (e) => e.indiretos),
    linha('(–) Mobilização / custos iniciais', econ, (e) => e.mobilizacao),
    linha('(=) RESULTADO ECONÔMICO DO MÊS', econ, (e) => e.resultado),
    linha('RESULTADO ACUMULADO', econ, (e) => e.resultadoAcumulado),
    linha('Margem do mês (% da medição)', econ, (e) => e.margem),
  ] as Matriz

  return { 'FCP MENSAL': FCP_MENSAL, 'ECONÔMICO': ECONOMICO }
}

test('grade que espelha o motor: tudo fecha, nenhuma causa, nada sem explicação', () => {
  const g = conferirGrade(P, abasQueEspelhamOMotor())
  assert.ok(g.total > 200, `esperava uma grade grande, veio ${g.total}`)
  assert.equal(g.divergem, 0)
  assert.equal(g.fecham, g.total)
  assert.equal(g.causas.length, 0)
  assert.equal(g.semExplicacao, 0)
})

test('🔴 adulterar UMA célula produz uma divergência SEM EXPLICAÇÃO', () => {
  // Este é o par do teste acima. Sem ele, "explica tudo" seria inverificável: uma função que
  // carimba causa em qualquer coisa passaria no primeiro teste com louvor.
  const abas = abasQueEspelhamOMotor()
  const mensal = abas['FCP MENSAL'] as unknown[][]
  const iSai = mensal.findIndex((l) => String(l?.[0]).includes('Sai do caixa'))
  assert.ok(iSai > 0)
  mensal[iSai][5] = Number(mensal[iSai][5]) + 12_345.67

  const g = conferirGrade(P, abas)
  assert.equal(g.divergem, 1)
  assert.equal(g.semExplicacao, 1, 'uma diferença inventada não pode ganhar causa emprestada')
})

test('a tolerância é de meio centavo, não de meio real', () => {
  // A conferência escalar usa R$ 0,50. Numa grade de 240 células isso deixa passar deriva real em
  // toda célula, e a soma some no total.
  const abas = abasQueEspelhamOMotor()
  const mensal = abas['FCP MENSAL'] as unknown[][]
  const i = mensal.findIndex((l) => String(l?.[0]).includes('Saldo do mês'))
  mensal[i][5] = Number(mensal[i][5]) + 0.4
  assert.equal(conferirGrade(P, abas).divergem > 0, true, 'R$ 0,40 tem de ser divergência')
})

test('linha que a planilha não tem é REPORTADA, não ignorada em silêncio', () => {
  const abas = abasQueEspelhamOMotor()
  const mensal = (abas['FCP MENSAL'] as unknown[][]).filter(
    (l) => !String(l?.[0]).includes('Imposto da nota'),
  )
  const g = conferirGrade(P, { ...abas, 'FCP MENSAL': mensal as Matriz })
  const grade = g.grades.find((x) => x.aba === 'FCP MENSAL')!
  assert.deepEqual(grade.rotulosNaoEncontrados, ['Imposto da nota'])
})

test('mês que só a planilha tem não vira divergência — é grade mais larga', () => {
  const abas = abasQueEspelhamOMotor()
  const mensal = abas['FCP MENSAL'] as unknown[][]
  const iMes = mensal.findIndex((l) => l?.[0] === 'Mês')
  const ultimo = mensal[iMes][mensal[iMes].length - 1] as Date
  const extra = new Date(ultimo); extra.setMonth(extra.getMonth() + 1)
  for (const l of mensal) if (Array.isArray(l) && l.length > 1) l.push(l[0] === 'Mês' ? extra : 0)

  const g = conferirGrade(P, abas)
  const grade = g.grades.find((x) => x.aba === 'FCP MENSAL')!
  assert.equal(grade.mesesSoNaPlanilha.length, 1)
  assert.equal(g.divergem, 0, 'a coluna a mais não pode contar como erro')
})

test('a diferença do acumulado é a soma corrida da linha que o alimenta', () => {
  // É este teste mecânico que distingue arraste de erro novo. Mexer no saldo de um mês tem de
  // arrastar por todos os acumulados seguintes — e todos recebem a causa 'arraste', menos o mês
  // de origem, que fica sem explicação porque a alteração foi inventada.
  const abas = abasQueEspelhamOMotor()
  const mensal = abas['FCP MENSAL'] as unknown[][]
  const iSaldo = mensal.findIndex((l) => String(l?.[0]).includes('Saldo do mês'))
  const iDepois = mensal.findIndex((l) => String(l?.[0]).includes('ACUMULADO — após'))
  mensal[iSaldo][3] = Number(mensal[iSaldo][3]) - 1_000
  for (let c = 3; c < mensal[iDepois].length; c++) {
    mensal[iDepois][c] = Number(mensal[iDepois][c]) - 1_000
  }

  const g = conferirGrade(P, abas)
  const grade = g.grades.find((x) => x.aba === 'FCP MENSAL')!
  const depois = grade.linhas.find((l) => l.campo === 'acumuladoDepois')!
  assert.ok(depois.divergem > 5, 'o acumulado tem de divergir do mês alterado em diante')
  assert.ok(
    depois.celulas.filter((c) => !c.fecha).every((c) => c.causa === 'arraste-do-acumulado'),
    'toda divergência do acumulado é explicada pela soma corrida',
  )
})
