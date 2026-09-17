/**
 * A ponte "marquei Pago" → despesa: o que precisa ser verdade para o caixa não pagar duas vezes.
 *
 * `lancamentoDaHoraExtra` é pura e é testada de verdade. O wiring do store (marcar/desmarcar) é
 * verificado no texto do arquivo — mesmo padrão de `financeiroTitulosStore.test.ts`: montar
 * zustand + persist + auth + fila de sync só para checar uma guarda custa mais do que vale.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { lancamentoDaHoraExtra, descricaoDaHoraExtra, idDoLancamentoDaHoraExtra } from '@/features/mao-de-obra/utils/horaExtraFinanceiro'
import { lancamentoDaHoraExtra as lancamentoDaHoraExtraPlanilha, despesaDaHoraExtra } from '@/features/financeiro/utils/controleDeCaixaImport'
import type { FinanceiroEntry, HoraExtra } from '@/types'

const base: HoraExtra = {
  id: 'he-1',
  workerId: 'w-1',
  workerNome: 'ANDERSON DE ASSIS',
  cargo: 'ENCANADOR DE ÁGUA I',
  data: '2026-08-01',
  tipo: 'fim-de-semana',
  valor: 350,
  pago: true,
  pagoEm: '2026-08-05',
  pagoPor: 'Raquel',
  origem: 'manual',
  createdAt: '2026-08-01T00:00:00.000Z',
}

async function codigoDoStore(): Promise<string> {
  const bruto = await readFile(new URL('../../../store/maoDeObraStore.ts', import.meta.url), 'utf8')
  return bruto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/**
 * ⚠️ Os marcos precisam ser a assinatura da IMPLEMENTAÇÃO (`nome: (id) => {`), nunca só `nome:` —
 * a interface declara os mesmos nomes bem antes, e um marco de fim que casa com a interface
 * devolve um corte vazio, que passa como se tivesse conferido. Já aconteceu em
 * `financeiroTitulosStore.test.ts` com `addBoleto:`.
 */
function corpoDaAcao(codigo: string, de: string, ate: string): string {
  const inicio = codigo.indexOf(de)
  const fim = codigo.indexOf(ate)
  assert.ok(inicio >= 0, `não achei a implementação de ${de}`)
  assert.ok(fim > inicio, `o marco de fim (${ate}) casou antes do início — corte vazio`)
  return codigo.slice(inicio, fim)
}

test('lancamentoDaHoraExtra: vira SAÍDA em mão de obra, subcategoria horas_extras', () => {
  const e = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  assert.equal(e.tipo, 'saida')
  assert.equal(e.categoria, 'mao_de_obra')
  assert.equal(e.subcategoria, 'horas_extras')
  assert.equal(e.origem, 'horas-extras')
  assert.equal(e.valor, 350)
  assert.equal(e.funcionarioNome, 'ANDERSON DE ASSIS')
})

test('lancamentoDaHoraExtra: a data é a do PAGAMENTO, não a do trabalho', () => {
  const e = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  assert.equal(e.data, '2026-08-05', 'o dinheiro saiu no dia 05 — é esse mês que o caixa enxerga')
  // Sem data de pagamento, cai na data do trabalho: melhor a competência certa do que hoje.
  const semPagamento = lancamentoDaHoraExtra({ ...base, pagoEm: undefined }, 'org-1', { agora: '2026-09-30T12:00:00.000Z' })
  assert.equal(semPagamento.data, '2026-08-01')
})

test('lancamentoDaHoraExtra: o id é derivado — marcar duas vezes escreve a MESMA linha', () => {
  const a = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  const b = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-09-01T12:00:00.000Z' })
  assert.equal(a.id, b.id, 'id sorteado duplicaria a despesa a cada clique')
  assert.equal(a.id, idDoLancamentoDaHoraExtra('org-1', 'he-1'))
})

test('lancamentoDaHoraExtra: empresas diferentes nunca compartilham o id do lançamento', () => {
  assert.notEqual(idDoLancamentoDaHoraExtra('org-1', 'he-1'), idDoLancamentoDaHoraExtra('org-2', 'he-1'))
})

test('descricaoDaHoraExtra: o extrato diz quem e quando, sem abrir o sistema', () => {
  assert.equal(descricaoDaHoraExtra(base), 'Hora extra — ANDERSON DE ASSIS (01/08/2026)')
})

test('descricaoDaHoraExtra: ponto-saída usa os dias que a linha de fato cobre', () => {
  const agregada: HoraExtra = {
    ...base, tipo: 'ponto-saida', valor: 203.64,
    detalhe: { horasDescontadas: 8, horasExtras: 9, salario: 2000, fatorAdicional: 1.6, diasTexto: '13 e 20/08' },
  }
  assert.equal(descricaoDaHoraExtra(agregada), 'Ponto saída — devolução + HE — ANDERSON DE ASSIS (13 e 20/08)')
})

test('marcarHoraExtraPaga: a guarda é por entryId, NÃO por pago (ARMADILHA #5)', async () => {
  const s = await codigoDoStore()
  const corpo = corpoDaAcao(s, 'marcarHoraExtraPaga: (id, opcoes) => {', 'desmarcarHoraExtraPaga: (id) => {')
  assert.match(corpo, /if \(he\.entryId\) return/, 'guardar por entryId é o que torna o clique idempotente')
  assert.doesNotMatch(
    corpo, /if \(he\.pago\) return/,
    'guardar por `pago` travaria para sempre o registro que ficou pago-sem-lançamento — foi ' +
      'exatamente o bug do título "Recebido"',
  )
})

test('marcarHoraExtraPaga: gera a despesa; desmarcar a REMOVE', async () => {
  const s = await codigoDoStore()
  const marcar = corpoDaAcao(s, 'marcarHoraExtraPaga: (id, opcoes) => {', 'desmarcarHoraExtraPaga: (id) => {')
  assert.match(marcar, /lancamentoDaHoraExtra\(/)
  assert.match(marcar, /addEntry\(lancamento, \{ respectObra: true \}\)/,
    'sem respectObra a barra lateral carimbaria a obra ativa numa HE que não é de obra nenhuma')

  const desmarcar = corpoDaAcao(s, 'desmarcarHoraExtraPaga: (id) => {', 'addTimecard: (entry) => {')
  assert.match(desmarcar, /removeEntry\(entryId\)/, 'desmarcar tem que estornar — nunca sumir calado')
  assert.match(desmarcar, /entryId: undefined/, 'e limpar o vínculo, senão a remarcação não gera nada')
})

test('removeHoraExtra: apagar uma HE paga leva a despesa junto', async () => {
  const s = await codigoDoStore()
  const corpo = corpoDaAcao(s, 'removeHoraExtra: (id) => {', 'marcarHoraExtraPaga: (id, opcoes) => {')
  assert.match(corpo, /desmarcarHoraExtraPaga\(id\)/, 'senão fica lançamento no caixa sem origem nenhuma')
})

// ─── O pagamento em dobro ─────────────────────────────────────────────────────
//
// ⚠️ Este bloco existe por um defeito que eu mesmo introduzi na rodada anterior. Há DOIS caminhos
// até a mesma despesa de hora extra — importar a planilha com o "PG" marcado, e clicar "Pago" na
// grade de Mão de Obra — e cada um deriva o `id` do `FinanceiroEntry` de um jeito. Como `addEntry`
// é upsert POR ID, ids diferentes não colidem: o caixa ficava com duas despesas para o mesmo
// pagamento, sem erro nenhum na tela. Este cliente usa os dois caminhos.

test('os dois caminhos produzem ids DIFERENTES — é esta a causa do pagamento em dobro', () => {
  const daTela = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  const daPlanilha = lancamentoDaHoraExtraPlanilha(
    { nome: 'ANDERSON DE ASSIS', cargo: 'ENCANADOR DE ÁGUA I', dia: 1, data: '2026-08-01', valor: 350, pago: true, linha: 7, chave: 'he|anderson de assis|2026-08-01|350.00#1' },
    'org-1', { agora: '2026-08-05T12:00:00.000Z' },
  )
  assert.notEqual(daTela.id, daPlanilha.id,
    'se um dia passarem a ser iguais, ótimo — mas o conserto NÃO depende disso, e o teste abaixo é ' +
    'que garante o comportamento')
})

test('a chave natural é a MESMA nos dois caminhos — pessoa + dia trabalhado', () => {
  const daTela = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  const daPlanilha = lancamentoDaHoraExtraPlanilha(
    { nome: 'Anderson de Assis', dia: 1, data: '2026-08-01', valor: 350, pago: true, linha: 7, chave: 'x#1' },
    'org-1', { agora: '2026-08-05T12:00:00.000Z' },
  )
  assert.equal(daTela.chaveHoraExtra, daPlanilha.chaveHoraExtra,
    'grafia diferente do nome não pode gerar chaves diferentes')
})

test('a chave usa o dia TRABALHADO, não o do pagamento', () => {
  // `base` trabalhou em 01/08 e foi pago em 05/08. O lançamento vai para 05/08 (é quando o dinheiro
  // saiu), mas a chave tem de apontar para 01/08 — senão as duas origens nunca se encontram.
  const e = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  assert.equal(e.data, '2026-08-05')
  assert.equal(e.chaveHoraExtra, 'ANDERSON DE ASSIS|2026-08-01')
})

test('despesaDaHoraExtra acha a despesa da planilha quando a tela vai marcar Pago', () => {
  const daPlanilha = lancamentoDaHoraExtraPlanilha(
    { nome: 'ANDERSON DE ASSIS', dia: 1, data: '2026-08-01', valor: 350, pago: true, linha: 7, chave: 'x#1' },
    'org-1', { agora: '2026-08-05T12:00:00.000Z' },
  )
  const achada = despesaDaHoraExtra([daPlanilha], base.workerNome, base.data)
  assert.ok(achada, 'sem isto, marcar Pago criaria uma SEGUNDA despesa para o mesmo pagamento')
  assert.equal(achada.id, daPlanilha.id)
})

test('despesaDaHoraExtra acha a despesa da tela quando a planilha vai ser importada', () => {
  const daTela = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  const achada = despesaDaHoraExtra([daTela], 'anderson de assis', '2026-08-01')
  assert.ok(achada, 'o conserto tem de valer nos DOIS sentidos')
  assert.equal(achada.id, daTela.id)
})

test('despesaDaHoraExtra acha lançamento ANTIGO, anterior ao campo chaveHoraExtra', () => {
  // Quem já importou a planilha antes deste conserto tem despesas sem `chaveHoraExtra`. Elas
  // precisam continuar sendo encontradas, senão o conserto não vale para a base existente.
  const antigo = lancamentoDaHoraExtraPlanilha(
    { nome: 'ANDERSON DE ASSIS', dia: 1, data: '2026-08-01', valor: 350, pago: true, linha: 7, chave: 'x#1' },
    'org-1', { agora: '2026-08-05T12:00:00.000Z' },
  )
  delete (antigo as { chaveHoraExtra?: string }).chaveHoraExtra
  assert.ok(despesaDaHoraExtra([antigo], base.workerNome, base.data))
})

test('pessoa diferente ou dia diferente NÃO casa — o dedupe não pode comer pagamento legítimo', () => {
  const daTela = lancamentoDaHoraExtra(base, 'org-1', { agora: '2026-08-05T12:00:00.000Z' })
  assert.equal(despesaDaHoraExtra([daTela], 'OUTRA PESSOA', '2026-08-01'), undefined)
  assert.equal(despesaDaHoraExtra([daTela], base.workerNome, '2026-08-02'), undefined)
})

test('despesa que não é hora extra nunca é adotada', () => {
  const aluguel: FinanceiroEntry = {
    id: 'x', tipo: 'saida', descricao: 'Aluguel', valor: 350, data: '2026-08-01',
    categoria: 'mao_de_obra', origem: 'planilha', funcionarioNome: 'ANDERSON DE ASSIS',
    createdAt: '2026-08-01T00:00:00.000Z',
  }
  assert.equal(despesaDaHoraExtra([aluguel], 'ANDERSON DE ASSIS', '2026-08-01'), undefined)
})

test('marcarHoraExtraPaga procura a despesa existente ANTES de criar outra', async () => {
  const s = await codigoDoStore()
  const corpo = corpoDaAcao(s, 'marcarHoraExtraPaga: (id, opcoes) => {', 'desmarcarHoraExtraPaga: (id) => {')
  assert.match(corpo, /despesaDaHoraExtra\(fin\.entries, he\.workerNome, he\.data\)/)
  assert.match(corpo, /if \(!existente\) \{[\s\S]*?addEntry/,
    'addEntry só pode ser chamado quando a despesa NÃO existe — senão duplica')
})

test('desmarcarHoraExtraPaga NÃO solta o vínculo quando a despesa não foi removida', async () => {
  const s = await codigoDoStore()
  const corpo = corpoDaAcao(s, 'desmarcarHoraExtraPaga: (id) => {', 'addTimecard: (entry) => {')
  assert.match(corpo, /if \(!fin\.entries\.some\(\(e\) => e\.id === entryId\)\)/)
  assert.match(corpo, /syncError/,
    'não achar a despesa tem de AVISAR — sumir calado deixa despesa órfã no servidor')
  // A limpeza do vínculo precisa vir DEPOIS do removeEntry, nunca antes.
  assert.ok(corpo.indexOf('removeEntry(entryId)') < corpo.indexOf('entryId: undefined'),
    'limpar o entryId antes de remover a despesa é exatamente o defeito que estamos consertando')
})
