/**
 * O motor da medição.
 *
 * O teste que dá sentido aos outros é o 🔴 do item barrado: se ele entrar na soma, todo o resto
 * do desenho (fila de exceção, "não pode fechar", conferência antes de faturar) vira decoração.
 * O arquivo real é coberto pelo `npm run qa:medicao-zn`.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CatalogoDoContrato } from '@/types'
import { calcularMedicao, cadeiaDeRepasse, porCategoria } from './motorDaMedicao'
import type { QuantidadeMedida } from './importarCatalogoZn'

const catalogo = (): CatalogoDoContrato => ({
  numeroContrato: 'CT-1',
  fatorPadrao: 0.6,
  regioes: [{ codigo: '01', nome: 'Alfa' }, { codigo: '02', nome: 'Beta' }],
  servicos: [
    { id: 'a', descricao: 'REDE', unidade: 'M', precoZn: 100, categoria: 'ÁGUA', qtdContratada: null,
      flag: 'ok', bloqueadoParaMedicao: false, porRegiao: { '01': { codigo: 'A1' }, '02': { codigo: 'A2' } } },
    { id: 'b', descricao: 'LIGACAO', unidade: 'UN', precoZn: 50, categoria: 'ÁGUA', qtdContratada: null,
      flag: 'ok', bloqueadoParaMedicao: false, porRegiao: { '01': { codigo: 'B1' }, '02': { codigo: 'B2' } } },
    { id: 'c', descricao: 'ITEM A CONFERIR', unidade: 'UN', precoZn: 1000, categoria: 'ESGOTO', qtdContratada: null,
      flag: 'bloco_deslocado_pdf', motivoFlag: 'preço veio deslocado no PDF', bloqueadoParaMedicao: true,
      porRegiao: { '01': { codigo: 'C1' }, '02': { codigo: 'C2' } } },
    { id: 'd', descricao: 'SO NA ALFA', unidade: 'UN', precoZn: 70, qtdContratada: null,
      flag: 'ok', bloqueadoParaMedicao: false, porRegiao: { '01': { codigo: 'D1' } } },
  ],
})

const q = (servicoCatalogoId: string, quantidade: number, obra = 'BOI'): QuantidadeMedida =>
  ({ servicoCatalogoId, obra, quantidade })

test('quantidade × preço com repasse, e a região manda no preço', () => {
  const r = calcularMedicao(catalogo(), 'BOI', '02', [q('a', 10), q('b', 4)])
  assert.equal(r.linhas.find((l) => l.servicoCatalogoId === 'a')!.precoComFator, 60, '100 × 0,6')
  assert.equal(r.total, 10 * 60 + 4 * 30)
  assert.equal(r.podeFechar, true)
})

test('🔴 O TESTE QUE IMPORTA: item barrado NÃO entra na soma — sai à parte, com o motivo', () => {
  const r = calcularMedicao(catalogo(), 'BOI', '02', [q('a', 10), q('c', 5)])
  assert.equal(r.total, 600, 'só a linha liberada')
  assert.equal(r.linhas.length, 1)
  assert.equal(r.pendentes.length, 1)
  const p = r.pendentes[0]
  assert.equal(p.pendencia, 'preco_a_conferir')
  assert.equal(p.valor, 3000, 'o valor que ele TERIA fica visível — é o tamanho da decisão')
  assert.ok(p.motivo && p.motivo.includes('deslocado'), 'o motivo vem do catálogo, não é um código')
  assert.equal(r.totalPendente, 3000)
  assert.equal(r.podeFechar, false)
})

test('quantidade de serviço que não existe na região vira pendência própria, não erro de conta', () => {
  const r = calcularMedicao(catalogo(), 'BOI', '02', [q('d', 3)])
  assert.equal(r.total, 0)
  assert.equal(r.pendentes[0].pendencia, 'servico_fora_da_regiao')
  assert.ok(r.pendentes[0].motivo!.includes('região 02'))
})

test('o mesmo serviço em duas linhas soma — a planilha pode repetir o item', () => {
  const r = calcularMedicao(catalogo(), 'BOI', '02', [q('a', 6), q('a', 4)])
  assert.equal(r.linhas.length, 1)
  assert.equal(r.linhas[0].quantidade, 10)
  assert.equal(r.total, 600)
})

test('cada obra soma só o que é dela', () => {
  const qs = [q('a', 10, 'BOI'), q('b', 4, 'SAKURA')]
  assert.equal(calcularMedicao(catalogo(), 'BOI', '02', qs).total, 600)
  assert.equal(calcularMedicao(catalogo(), 'SAKURA', '02', qs).total, 120)
})

test('quantidade de serviço fora do catálogo é ignorada aqui — quem reporta é o leitor', () => {
  const r = calcularMedicao(catalogo(), 'BOI', '02', [q('nao-existe', 99), q('a', 1)])
  assert.equal(r.linhas.length, 1)
  assert.equal(r.total, 60)
})

test('a cadeia de repasse: o bruto é o medido ÷ fator', () => {
  const c = cadeiaDeRepasse(600, 0.6)!
  assert.equal(c.brutoConsorcio, 1000)
  assert.equal(c.repasse, 600)
  assert.equal(c.retido, 400)
})

test('⚠️ fator zero não vira Infinity na tela', () => {
  assert.equal(cadeiaDeRepasse(600, 0), null)
  assert.equal(cadeiaDeRepasse(600, Number.NaN), null)
})

test('a quebra por categoria fecha com o total e ignora o que está barrado', () => {
  const r = calcularMedicao(catalogo(), 'BOI', '02', [q('a', 10), q('b', 4), q('c', 5)])
  const cats = porCategoria(r)
  assert.equal(cats.reduce((s, c) => s + c.valor, 0), r.total)
  assert.ok(!cats.some((c) => c.categoria === 'ESGOTO'), 'a categoria do item barrado não aparece')
})
