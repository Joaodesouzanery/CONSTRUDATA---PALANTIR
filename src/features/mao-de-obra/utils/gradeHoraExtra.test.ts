/**
 * A grade de hora extra: quais dias entram, e quem aparece.
 *
 * Agosto/2026 é o mês do arquivo real do cliente — os mesmos dias 01, 02, 08, 09, … que aparecem
 * no cabeçalho da aba "HORAS EXTRAS AGOSTO".
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diasDePagamentoDoMes, montarGrade } from '@/features/mao-de-obra/utils/gradeHoraExtra'
import type { Cargo, HoraExtra, Worker } from '@/types'

const worker = (id: string, name: string, role?: string): Worker =>
  ({ id, name, role, status: 'active' } as unknown as Worker)

const he = (p: Partial<HoraExtra> & Pick<HoraExtra, 'id' | 'workerNome' | 'data' | 'valor'>): HoraExtra => ({
  tipo: 'fim-de-semana', pago: false, origem: 'manual', createdAt: '2026-08-01T00:00:00.000Z', ...p,
})

test('diasDePagamentoDoMes: agosto/2026 traz exatamente os sábados e domingos do mês', () => {
  const dias = diasDePagamentoDoMes(8, 2026)
  assert.deepEqual(dias.map((d) => d.dia), [1, 2, 8, 9, 15, 16, 22, 23, 29, 30])
  assert.equal(dias[0].tipo, 'sabado')
  assert.equal(dias[1].tipo, 'domingo')
})

test('diasDePagamentoDoMes: sábado não paga como domingo; domingo paga', () => {
  const dias = diasDePagamentoDoMes(8, 2026)
  assert.equal(dias.find((d) => d.dia === 1)?.pagaComoDomingo, false)
  assert.equal(dias.find((d) => d.dia === 2)?.pagaComoDomingo, true)
})

test('diasDePagamentoDoMes: feriado em dia de semana ENTRA na grade e paga como domingo', () => {
  // 07/09/2026 é uma segunda-feira.
  const dias = diasDePagamentoDoMes(9, 2026, [{ date: '2026-09-07', description: 'Independência' }])
  const sete = dias.find((d) => d.dia === 7)
  assert.ok(sete, 'o feriado de segunda-feira precisa aparecer — é dia pago')
  assert.equal(sete.tipo, 'feriado')
  assert.equal(sete.pagaComoDomingo, true)
  assert.equal(sete.descricao, 'Independência')
})

test('diasDePagamentoDoMes: feriado de outro mês não vaza para a grade', () => {
  const dias = diasDePagamentoDoMes(8, 2026, [{ date: '2026-09-07', description: 'Independência' }])
  assert.equal(dias.some((d) => d.tipo === 'feriado'), false)
})

test('diasDePagamentoDoMes: sábado que também é feriado não duplica a coluna', () => {
  // 05/09/2026 é um sábado.
  const dias = diasDePagamentoDoMes(9, 2026, [{ date: '2026-09-05', description: 'Feriado municipal' }])
  assert.equal(dias.filter((d) => d.dia === 5).length, 1)
  assert.equal(dias.find((d) => d.dia === 5)?.pagaComoDomingo, true, 'feriado é a régua mais alta')
})

test('montarGrade: a sugestão vem do cargo, e é diferente em sábado e domingo', () => {
  const cargos: Cargo[] = [{ id: 'c1', nome: 'AJUDANTE GERAL I', valorSabado: 250, valorDomingo: 200 }]
  const dias = diasDePagamentoDoMes(8, 2026)
  const [linha] = montarGrade([worker('w1', 'JOSE', 'Ajudante Geral I')], [], dias, cargos)
  assert.equal(linha.celulas[0].sugestao, 250, 'dia 01 é sábado')
  assert.equal(linha.celulas[1].sugestao, 200, 'dia 02 é domingo')
})

test('montarGrade: cargo sem valor cadastrado devolve null — nunca zero', () => {
  const dias = diasDePagamentoDoMes(8, 2026)
  const [linha] = montarGrade([worker('w1', 'JOSE', 'CARGO NOVO')], [], dias, [])
  assert.equal(linha.celulas[0].sugestao, null)
})

test('montarGrade: soma o total da pessoa e separa o que já foi pago', () => {
  const dias = diasDePagamentoDoMes(8, 2026)
  const lancamentos = [
    he({ id: 'h1', workerId: 'w1', workerNome: 'JOSE', data: '2026-08-01', valor: 350, pago: true }),
    he({ id: 'h2', workerId: 'w1', workerNome: 'JOSE', data: '2026-08-02', valor: 300 }),
  ]
  const [linha] = montarGrade([worker('w1', 'JOSE')], lancamentos, dias, [])
  assert.equal(linha.total, 650)
  assert.equal(linha.totalPago, 350)
})

test('montarGrade: lançamento de planilha sem workerId casa pelo nome com o funcionário', () => {
  const dias = diasDePagamentoDoMes(8, 2026)
  const lancamentos = [he({ id: 'h1', workerNome: 'jose', data: '2026-08-01', valor: 350 })]
  const linhas = montarGrade([worker('w1', 'JOSE')], lancamentos, dias, [])
  assert.equal(linhas.length, 1, 'não pode virar duas linhas para a mesma pessoa')
  assert.equal(linhas[0].total, 350)
})

test('montarGrade: pessoa fora do cadastro com lançamento no mês NÃO some da grade', () => {
  const dias = diasDePagamentoDoMes(8, 2026)
  const lancamentos = [he({ id: 'h1', workerNome: 'MORADOR', data: '2026-08-01', valor: 150 })]
  const linhas = montarGrade([], lancamentos, dias, [])
  assert.equal(linhas.length, 1, 'esconder a linha esconderia dinheiro já lançado')
  assert.equal(linhas[0].nome, 'MORADOR')
})

test('montarGrade: lançamento de ponto-saída não entra na grade de fim de semana', () => {
  const dias = diasDePagamentoDoMes(8, 2026)
  const lancamentos = [he({ id: 'h1', workerId: 'w1', workerNome: 'JOSE', data: '2026-08-01', valor: 203.64, tipo: 'ponto-saida' })]
  const [linha] = montarGrade([worker('w1', 'JOSE')], lancamentos, dias, [])
  assert.equal(linha.total, 0, 'são duas contas diferentes; misturar dobraria o valor na tela')
})
