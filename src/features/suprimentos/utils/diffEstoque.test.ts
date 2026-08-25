/**
 * O motor de comparação — "o que mudou desde a última planilha".
 *
 * É a pergunta central do cliente e a melhor parte do módulo: ele distingue material novo, saldo
 * alterado, custo alterado, só cadastro e inalterado; lista o que sumiu da planilha e os
 * duplicados; e gera movimentação de entrada/saída para a diferença. **E não tinha um único
 * teste** — a função mais importante do fluxo estava descoberta.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  compararComEstoque, chaveDoItem, normalizarChave, ultimaConferencia, retiradasComFicha,
  MARCA_CONFERENCIA,
} from './diffEstoque'
import type { ItemEstoque } from '@/types'

const existente = (p: Partial<ItemEstoque>): ItemEstoque => ({
  id: p.id ?? 'i1', descricao: 'Thinner 18L', unidade: 'un',
  qtdDisponivel: 10, qtdReservada: 0, qtdTransito: 0, estoqueMinimo: 0,
  custoUnitario: 0, siteId: null, depositoId: 'd1', ...p,
} as unknown as ItemEstoque)

const importado = (p: Record<string, unknown>) => ({ descricao: 'Thinner 18L', ...p } as never)

// ── Como um item da planilha encontra o que já existe ─────────────────────────

test('o código de referência manda; sem ele, a descrição', () => {
  assert.equal(chaveDoItem({ codigoReferencia: 'THN05L', descricao: 'Thinner 18L' }), 'cod:thn05l')
  assert.equal(chaveDoItem({ descricao: 'Thinner 18L' }), 'desc:thinner 18l')
})

test('acento e caixa não separam o mesmo produto', () => {
  assert.equal(normalizarChave('Máscaras PFF2'), normalizarChave('mascaras pff2'))
  assert.equal(chaveDoItem({ descricao: 'Calça (Uniforme)' }), chaveDoItem({ descricao: 'CALCA (UNIFORME)' }))
})

// ── Os cinco tipos de mudança ─────────────────────────────────────────────────

test('item que o sistema não tem é NOVO', () => {
  const r = compararComEstoque([importado({ descricao: 'Galochas', qtdDisponivel: 5 })], [])
  assert.equal(r.novos, 1)
  assert.equal(r.linhas[0].tipo, 'novo')
  assert.equal(r.linhas[0].qtdAntes, null, 'não havia antes')
  assert.equal(r.linhas[0].qtdDepois, 5)
})

test('saldo diferente é QUANTIDADE, com antes e depois', () => {
  const r = compararComEstoque(
    [importado({ codigoReferencia: 'THN05L', qtdDisponivel: 3 })],
    [existente({ codigoReferencia: 'THN05L', qtdDisponivel: 10, custoUnitario: 20 })],
  )
  const l = r.linhas[0]
  assert.equal(l.tipo, 'quantidade')
  assert.equal(l.qtdAntes, 10)
  assert.equal(l.qtdDepois, 3)
  assert.equal(l.deltaQtd, -7)
  assert.equal(l.impactoBRL, -140, '7 unidades × R$ 20 saíram do estoque')
  assert.equal(r.alterados, 1)
})

test('saldo igual é INALTERADO — e não vai para o servidor', () => {
  const r = compararComEstoque(
    [importado({ codigoReferencia: 'THN05L', qtdDisponivel: 10 })],
    [existente({ codigoReferencia: 'THN05L', qtdDisponivel: 10 })],
  )
  assert.equal(r.linhas[0].tipo, 'inalterado')
  assert.equal(r.inalterados, 1)
  assert.equal(r.alterados, 0)
})

test('⚠️ coluna de quantidade não informada NÃO zera o saldo', () => {
  // O caso da planilha do cliente: a linha sem produto, e qualquer célula em branco.
  const r = compararComEstoque(
    [importado({ codigoReferencia: 'THN05L', unidade: 'un' })],   // sem qtdDisponivel
    [existente({ codigoReferencia: 'THN05L', qtdDisponivel: 10 })],
  )
  assert.equal(r.linhas[0].qtdInformada, false)
  assert.equal(r.linhas[0].qtdDepois, 10, 'mantém o que o sistema tem')
  assert.equal(r.linhas[0].deltaQtd, 0)
})

test('só cadastro mudou é DADOS, não quantidade', () => {
  const r = compararComEstoque(
    [importado({ codigoReferencia: 'THN05L', qtdDisponivel: 10, unidade: 'L' })],
    [existente({ codigoReferencia: 'THN05L', qtdDisponivel: 10, unidade: 'un' })],
  )
  assert.equal(r.linhas[0].tipo, 'dados')
})

// ── O que a planilha não trouxe ───────────────────────────────────────────────

test('item que sumiu da planilha é listado, NUNCA apagado', () => {
  // A planilha pode ser parcial — um depósito só, uma categoria. Apagar por ausência destruiria
  // estoque real por causa de um recorte.
  const r = compararComEstoque(
    [importado({ codigoReferencia: 'THN05L', qtdDisponivel: 10 })],
    [
      existente({ id: 'i1', codigoReferencia: 'THN05L', qtdDisponivel: 10 }),
      existente({ id: 'i2', codigoReferencia: 'GLCH', descricao: 'Galochas', qtdDisponivel: 4 }),
    ],
  )
  assert.deepEqual(r.ausentesNaPlanilha.map((a) => a.descricao), ['Galochas'])
  assert.ok(!r.linhas.some((l) => l.descricao === 'Galochas'), 'não vira linha de mudança')
})

test('o sistema com o mesmo produto repetido é apontado', () => {
  const r = compararComEstoque(
    [importado({ codigoReferencia: 'THN05L', qtdDisponivel: 5 })],
    [
      existente({ id: 'i1', codigoReferencia: 'THN05L', qtdDisponivel: 10 }),
      existente({ id: 'i2', codigoReferencia: 'THN05L', qtdDisponivel: 7 }),
    ],
  )
  assert.equal(r.duplicadosNoSistema.length, 1)
  assert.equal(r.linhas.length, 1, 'casa com a primeira; a outra é só apontada')
})

test('a planilha com o mesmo produto duas vezes conta uma', () => {
  // Sem isto o impacto em R$ contava em dobro e a gravação escrevia duas vezes.
  const r = compararComEstoque(
    [importado({ codigoReferencia: 'THN05L', qtdDisponivel: 5 }),
     importado({ codigoReferencia: 'THN05L', qtdDisponivel: 8 })],
    [existente({ codigoReferencia: 'THN05L', qtdDisponivel: 10, custoUnitario: 20 })],
  )
  assert.equal(r.linhas.length, 1)
  assert.equal(r.linhas[0].qtdDepois, 5, 'vale a primeira')
  assert.equal(r.duplicadosNaPlanilha.length, 1)
  assert.equal(r.impactoTotalBRL, -100, 'não conta em dobro')
})

// ── Reimportar ────────────────────────────────────────────────────────────────

test('⚠️ importar a MESMA planilha duas vezes não duplica nem mexe em nada', () => {
  const planilha = [
    importado({ codigoReferencia: 'THN05L', qtdDisponivel: 3 }),
    importado({ codigoReferencia: 'GLCH', descricao: 'Galochas', qtdDisponivel: 4 }),
  ]
  const antes = [
    existente({ id: 'i1', codigoReferencia: 'THN05L', qtdDisponivel: 10 }),
    existente({ id: 'i2', codigoReferencia: 'GLCH', descricao: 'Galochas', qtdDisponivel: 4 }),
  ]
  const r1 = compararComEstoque(planilha, antes)
  assert.equal(r1.alterados, 1)   // só o Thinner mudou

  // Depois de gravar, o sistema tem o saldo da planilha. A segunda passada não vê mudança.
  const depois = [
    existente({ id: 'i1', codigoReferencia: 'THN05L', qtdDisponivel: 3 }),
    existente({ id: 'i2', codigoReferencia: 'GLCH', descricao: 'Galochas', qtdDisponivel: 4 }),
  ]
  const r2 = compararComEstoque(planilha, depois)
  assert.equal(r2.novos, 0, 'nada vira material novo de novo')
  assert.equal(r2.alterados, 0)
  assert.equal(r2.inalterados, 2)
})

test('⚠️ mudar o casamento de código para descrição NÃO duplica o item', () => {
  // O pior cenário do mojibake: uma importação casou por código, a seguinte por descrição.
  const r = compararComEstoque(
    [importado({ descricao: 'Thinner 18L', qtdDisponivel: 3 })],           // sem código
    [existente({ codigoReferencia: 'THN05L', descricao: 'Thinner 18L' })], // com código
  )
  // Hoje o casamento é por chave: sem código, cai na descrição — e a descrição bate.
  assert.equal(r.novos, 0, 'não pode virar material novo')
  assert.equal(r.linhas[0].itemId, 'i1')
})

// ── Alerta de mínimo ──────────────────────────────────────────────────────────

test('o alerta de mínimo só dispara com um mínimo definido', () => {
  const semMinimo = compararComEstoque(
    [importado({ codigoReferencia: 'A', qtdDisponivel: 1 })],
    [existente({ codigoReferencia: 'A', qtdDisponivel: 10, estoqueMinimo: 0 })],
  )
  assert.equal(semMinimo.abaixoDoMinimo.length, 0, 'mínimo 0 não é alerta — é ausência de regra')

  const comMinimo = compararComEstoque(
    [importado({ codigoReferencia: 'A', qtdDisponivel: 1 })],
    [existente({ codigoReferencia: 'A', qtdDisponivel: 10, estoqueMinimo: 5 })],
  )
  assert.equal(comMinimo.abaixoDoMinimo.length, 1)
})

// ── Cruzamento com a ficha de retirada ────────────────────────────────────────

test('saída sem ficha assinada é apontada', () => {
  const saidas = retiradasComFicha([
    { itemId: 'i1', tipo: 'saida', quantidade: 7, retiradoPor: 'João', dataMovimento: '2026-08-20' },
    { itemId: 'i2', tipo: 'saida', quantidade: 3, retiradoPor: '',     dataMovimento: '2026-08-20' },
  ], '2026-08-01')
  assert.equal(saidas.get('i1'), 7, 'com ficha')
  assert.ok(!saidas.get('i2'), 'sem ficha não conta')
})

test('a última conferência é a movimentação mais recente com a marca', () => {
  assert.equal(ultimaConferencia([
    { itemId: 'i1', tipo: 'entrada', quantidade: 1, dataMovimento: '2026-08-01', observacoes: MARCA_CONFERENCIA },
    { itemId: 'i1', tipo: 'entrada', quantidade: 1, dataMovimento: '2026-08-20', observacoes: `${MARCA_CONFERENCIA} — 34 itens` },
    { itemId: 'i1', tipo: 'saida',   quantidade: 1, dataMovimento: '2026-08-25', observacoes: 'saída normal' },
  ]), '2026-08-20')
  assert.equal(ultimaConferencia([]), null)
})

// ── Nada quebra no vazio ──────────────────────────────────────────────────────

test('planilha vazia e estoque vazio não quebram', () => {
  const r = compararComEstoque([], [])
  assert.deepEqual(r.linhas, [])
  assert.equal(r.novos, 0)
  assert.equal(r.impactoTotalBRL, 0)
  assert.deepEqual(r.ausentesNaPlanilha, [])
})


// ── O mínimo antes → depois ───────────────────────────────────────────────────

test('a conferência mostra o mínimo de antes, para o zeramento não passar em silêncio', () => {
  // Era o defeito destrutivo: a planilha manda mínimo 0, o item tinha 10, e nada na tela dizia
  // que o alerta de reposição estava sendo desligado.
  const d = compararComEstoque(
    [importado({ descricao: 'Máscaras PFF2', qtdDisponivel: 50, estoqueMinimo: 0 })],
    [existente({ descricao: 'Máscaras PFF2', qtdDisponivel: 50, estoqueMinimo: 10 })],
  )
  assert.equal(d.linhas[0].minimoAntes, 10)
  assert.equal(d.linhas[0].estoqueMinimo, 0)
  assert.equal(d.linhas[0].tipo, 'dados', 'mexer no mínimo é mudança de cadastro')
})

test('item novo não tem mínimo anterior — é null, não zero', () => {
  const d = compararComEstoque([importado({ descricao: 'Velcro Preto', qtdDisponivel: 0, estoqueMinimo: 5 })], [])
  assert.equal(d.linhas[0].minimoAntes, null)
  assert.equal(d.linhas[0].estoqueMinimo, 5)
})

test('planilha calada sobre o mínimo preserva o do sistema, e antes = depois', () => {
  const d = compararComEstoque(
    [importado({ descricao: 'Thinner 18L', qtdDisponivel: 0 })],
    [existente({ descricao: 'Thinner 18L', qtdDisponivel: 0, estoqueMinimo: 4 })],
  )
  assert.equal(d.linhas[0].minimoAntes, 4)
  assert.equal(d.linhas[0].estoqueMinimo, 4)
  assert.equal(d.linhas[0].tipo, 'inalterado')
})
