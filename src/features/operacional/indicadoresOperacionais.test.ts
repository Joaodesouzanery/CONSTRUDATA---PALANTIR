/**
 * Os indicadores do Operacional.
 *
 * ⚠️ A regra que mais importa aqui não é uma conta — é o `null`. Um indicador que devolve 0 quando
 * a coluna não existe afirma "não faturamos nada". É uma afirmação forte, e falsa. `null` faz a
 * tela dizer "coluna não encontrada", que é o que de fato aconteceu.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  campo, colunaExiste, numeroBR, contratosDoDado, ehDoContrato, aplicarRecorte,
  calcularIndicadores, indicadoresPorContrato, producaoPorEquipe, servicosPorStatus,
} from '@/features/operacional/indicadoresOperacionais'
import type { LinhaOperacional, SabespSheetId } from '@/features/operacional/sabespStore'

const linha = (aba: SabespSheetId, valores: Record<string, string>, ativa = true): LinhaOperacional =>
  ({ id: `${aba}-${JSON.stringify(valores).length}-${Math.abs(JSON.stringify(valores).split('').reduce((a, c) => a + c.charCodeAt(0), 0))}`, aba, chave: JSON.stringify(valores), valores, origem: 'planilha', ativa })

// ─── Leitura ──────────────────────────────────────────────────────────────────

test('campo casa sem depender de acento, caixa ou espaço duplicado', () => {
  const v = { 'SITUAÇÃO  DO PRAZO': 'ATRASADO' }
  assert.equal(campo(v, 'situacao do prazo'), 'ATRASADO')
  assert.equal(campo(v, 'NÃO EXISTE'), undefined)
})

test('🔴 numeroBR acerta o formato AMERICANO, que é o que o arquivo traz', () => {
  // Medido no arquivo real, lido como o importador lê (`raw:false`): vírgula de MILHAR e ponto
  // decimal. Um parser pt-BR leria R$ 230,98 — mil vezes menor, sem erro nenhum na tela.
  assert.equal(numeroBR('R$ 230,982.81'), 230982.81)
  assert.equal(numeroBR('R$ 13,000.00'), 13000)
  assert.equal(numeroBR('R$ 60.95'), 60.95)
})

test('e continua acertando o formato brasileiro', () => {
  assert.equal(numeroBR('R$ 1.234,56'), 1234.56)
  assert.equal(numeroBR('58,0%'), 58)
  assert.equal(numeroBR('0,125'), 0.125)
})

test('🔴 numeroBR devolve null para o que não é número — NaN contamina o total', () => {
  for (const v of ['', '—', '-', 'a combinar', undefined]) assert.equal(numeroBR(v), null)
})

// ─── Contrato ─────────────────────────────────────────────────────────────────

test('os contratos saem do DADO, não de uma lista fixa no código', () => {
  const ls = [
    linha('cadastro_servicos', { CONTRATO: 'SANTOS' }),
    linha('cadastro_servicos', { CONTRATO: 'BERTIOGA' }),
    linha('cadastro_servicos', { CONTRATO: 'BERTIOGA' }),
  ]
  assert.deepEqual(contratosDoDado(ls), ['BERTIOGA', 'SANTOS'])
})

test('🔴 o filtro casa por prefixo — "BERTIOGA" pega "BERTIOGA/GUARUJÁ"', () => {
  assert.equal(ehDoContrato('BERTIOGA/GUARUJÁ', 'BERTIOGA'), true,
    'igualdade exata deixava metade do dado fora de um filtro que o usuário achava completo')
  assert.equal(ehDoContrato('bertioga', 'BERTIOGA'), true)
  assert.equal(ehDoContrato('SANTOS', 'BERTIOGA'), false)
  assert.equal(ehDoContrato('SANTOS', ''), true, 'sem contrato escolhido, passa tudo')
})

test('linha arquivada não entra em indicador nenhum', () => {
  const ls = [linha('cadastro_servicos', { CONTRATO: 'BERTIOGA', STATUS: 'CONCLUÍDO' }, false)]
  assert.deepEqual(aplicarRecorte(ls, {}), [])
})

// ─── 🔴 Coluna ausente é null, não zero ───────────────────────────────────────

test('🔴 coluna ausente devolve null — nunca 0', () => {
  // Serviços sem a coluna STATUS: não dá para dizer quantos estão concluídos.
  const i = calcularIndicadores({ cadastro_servicos: [linha('cadastro_servicos', { CONTRATO: 'BERTIOGA' })] })
  assert.equal(i.concluidos, null, '0 concluídos seria uma afirmação; a verdade é "não sei"')
  assert.equal(i.atrasados, null)
  assert.equal(i.valorMedido, null)
  assert.equal(i.servicos, 1, 'a CONTAGEM de linhas não depende de coluna nenhuma')
})

test('coluna existente e vazia devolve 0 — aí sim é afirmação', () => {
  const i = calcularIndicadores({ medicao: [linha('medicao', { CONTRATO: 'BERTIOGA', VALOR: '' })] })
  assert.equal(i.valorMedido, 0)
})

test('colunaExiste separa "não veio" de "veio vazia"', () => {
  const ls = [linha('medicao', { VALOR: '' })]
  assert.equal(colunaExiste(ls, 'VALOR'), true)
  assert.equal(colunaExiste(ls, 'VALOR GLOSADO'), false)
})

// ─── As contas ────────────────────────────────────────────────────────────────

const SERVICOS = [
  linha('cadastro_servicos', { CONTRATO: 'BERTIOGA', STATUS: 'CONCLUÍDO', 'SITUAÇÃO DO PRAZO': 'NO PRAZO', 'EQUIPE DESIGNADA': 'EQUIPE 01' }),
  linha('cadastro_servicos', { CONTRATO: 'BERTIOGA', STATUS: 'EM ANDAMENTO', 'SITUAÇÃO DO PRAZO': 'ATRASADO', 'EQUIPE DESIGNADA': 'EQUIPE 01' }),
  linha('cadastro_servicos', { CONTRATO: 'SANTOS', STATUS: 'CONCLUÍDO', 'SITUAÇÃO DO PRAZO': 'NO PRAZO', 'EQUIPE DESIGNADA': 'EQUIPE 02' }),
]

test('os indicadores são recortados por contrato', () => {
  const ber = calcularIndicadores({ cadastro_servicos: SERVICOS }, 'BERTIOGA')
  assert.equal(ber.servicos, 2)
  assert.equal(ber.concluidos, 1)
  assert.equal(ber.atrasados, 1)
  assert.equal(ber.aderencia, 50)

  const san = calcularIndicadores({ cadastro_servicos: SERVICOS }, 'SANTOS')
  assert.equal(san.servicos, 1)
  assert.equal(san.aderencia, 100)
})

test('a margem é CALCULADA (resultado ÷ aprovado), não somada da planilha', () => {
  const i = calcularIndicadores({
    medicao: [linha('medicao', { CONTRATO: 'BERTIOGA', 'VALOR APROVADO': 'R$ 100.000,00' })],
    faturamento: [linha('faturamento', { CONTRATO: 'BERTIOGA', RESULTADO: 'R$ 20.000,00' })],
  }, 'BERTIOGA')
  assert.equal(i.margem, 20, 'somar a coluna MARGEM daria soma de percentuais, que não significa nada')
})

test('margem é null quando não há medição aprovada — nunca divide por zero', () => {
  const i = calcularIndicadores({ faturamento: [linha('faturamento', { CONTRATO: 'B', RESULTADO: '100' })] }, 'B')
  assert.equal(i.margem, null)
})

test('indicadoresPorContrato devolve um por contrato MAIS o consolidado', () => {
  const r = indicadoresPorContrato({ cadastro_servicos: SERVICOS })
  assert.deepEqual(r.map((x) => x.contrato), ['BERTIOGA', 'SANTOS', 'Todos os contratos'])
  assert.equal(r[2].servicos, 3)
})

test('ocorrência grave e aberta são contadas separadas', () => {
  const i = calcularIndicadores({
    ocorrencias: [
      linha('ocorrencias', { CONTRATO: 'B', STATUS: 'ABERTA', GRAVIDADE: 'GRAVE' }),
      linha('ocorrencias', { CONTRATO: 'B', STATUS: 'ENCERRADA', GRAVIDADE: 'GRAVE' }),
      linha('ocorrencias', { CONTRATO: 'B', STATUS: 'ABERTA', GRAVIDADE: 'LEVE' }),
    ],
  }, 'B')
  assert.equal(i.ocorrenciasAbertas, 2)
  assert.equal(i.ocorrenciasGraves, 2)
})

// ─── Os gráficos ──────────────────────────────────────────────────────────────

test('produção por equipe conta total e concluídos, da maior para a menor', () => {
  const r = producaoPorEquipe(SERVICOS)
  assert.deepEqual(r[0], { equipe: 'EQUIPE 01', concluidos: 1, total: 2 })
  assert.equal(r[1].equipe, 'EQUIPE 02')
})

test('serviço sem equipe não some do gráfico', () => {
  const r = producaoPorEquipe([linha('cadastro_servicos', { CONTRATO: 'B', STATUS: 'ABERTO' })])
  assert.equal(r[0].equipe, '(sem equipe)')
})

test('serviços por status, do mais frequente para o menos', () => {
  const r = servicosPorStatus(SERVICOS)
  assert.equal(r[0].status, 'CONCLUÍDO')
  assert.equal(r[0].n, 2)
})
