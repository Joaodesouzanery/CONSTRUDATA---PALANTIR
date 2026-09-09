/**
 * O catálogo do contrato e a projeção para a obra.
 *
 * O teste que dá sentido aos outros é o 🔴 do de-para: ele prova que reimportar o catálogo NÃO
 * desmonta o vínculo sigla → serviço que o RDO WCR usa para valorar produção. Sem ele, o desenho
 * inteiro (catálogo manda, obra recebe) seria uma armadilha mensal silenciosa.
 *
 * Valores fictícios — nenhum preço real de contrato entra aqui.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CatalogoDoContrato, ObraContratoServico } from '@/types'
import {
  chaveDoCatalogo, idsDoCatalogo, idDoServicoDaObra, precoDoServico,
  projetarParaObra, mesclarProjecao, pendenciasDoCatalogo,
} from './catalogoContrato'

const ORG = '11111111-1111-1111-1111-111111111111'
const CT = '99.999/99-00'

const catalogo = (): CatalogoDoContrato => ({
  numeroContrato: CT,
  fatorPadrao: 0.6,
  regioes: [
    { codigo: '01', nome: 'Alfa' },
    { codigo: '02', nome: 'Beta' },
    { codigo: '09', nome: 'Ômega' },
  ],
  servicos: [
    {
      id: 'sv-rede', descricao: 'REDE EXEMPLO PVC 200', unidade: 'M', precoZn: 100,
      qtdContratada: null, flag: 'ok', bloqueadoParaMedicao: false,
      porRegiao: { '01': { codigo: '0101' }, '02': { codigo: '0201' }, '09': { codigo: '0901', precoOverride: 80 } },
    },
    {
      id: 'sv-ligacao', descricao: 'LIGACAO EXEMPLO', unidade: 'UN', precoZn: 50,
      qtdContratada: 120, flag: 'ok', bloqueadoParaMedicao: false,
      porRegiao: { '01': { codigo: '0102' } },   // só existe na região 01
    },
    {
      id: 'sv-deslocado', descricao: 'ITEM DESLOCADO NO PDF', unidade: 'UN', precoZn: 30,
      qtdContratada: null, flag: 'bloco_deslocado_pdf',
      motivoFlag: 'bloco da região veio deslocado — conferir com a fiscalização',
      bloqueadoParaMedicao: true,
      porRegiao: { '01': { codigo: '0103' }, '02': { codigo: '0203' } },
    },
  ],
})

test('a chave do documento é uma só por contrato, com a pontuação fora', () => {
  assert.equal(chaveDoCatalogo('13.546/25-00'), 'catalogo-contrato:135462500')
  assert.equal(chaveDoCatalogo('13546 25 00'), 'catalogo-contrato:135462500', 'mesma chave')
  assert.equal(chaveDoCatalogo(''), 'catalogo-contrato:sem-numero')
})

test('preço: a região vence o serviço, e o repasse é aplicado com 2 casas', () => {
  const c = catalogo()
  const rede = c.servicos[0]
  const em01 = precoDoServico(c, rede, '01')
  assert.equal(em01.precoCheio, 100)
  assert.equal(em01.precoComFator, 60, '100 × 0,6')
  assert.equal(em01.precoDaRegiao, false)

  const em09 = precoDoServico(c, rede, '09')
  assert.equal(em09.precoCheio, 80, 'Ômega tem preço próprio')
  assert.equal(em09.precoComFator, 48)
  assert.equal(em09.precoDaRegiao, true)
})

test('região com repasse próprio vence o fator do contrato', () => {
  const c = catalogo()
  c.regioes = c.regioes.map((r) => (r.codigo === '09' ? { ...r, fator: 0.5 } : r))
  const p = precoDoServico(c, c.servicos[0], '09')
  assert.equal(p.fator, 0.5)
  assert.equal(p.precoComFator, 40, '80 × 0,5')
})

test('serviço que não existe na região NÃO vira linha de preço zero', () => {
  const c = catalogo()
  assert.equal(precoDoServico(c, c.servicos[1], '02').disponivel, false)
  const projetado = projetarParaObra(c, '02', ORG)
  assert.deepEqual(projetado.map((s) => s.servicoCatalogoId), ['sv-rede', 'sv-deslocado'])
  assert.ok(projetado.every((s) => s.valorUnitario > 0), 'preço zero na tela lê-se como "de graça"')
})

test('a projeção leva o preço JÁ com o repasse, e o código da região', () => {
  const p = projetarParaObra(catalogo(), '09', ORG)
  const rede = p.find((s) => s.servicoCatalogoId === 'sv-rede')!
  assert.equal(rede.valorUnitario, 48)
  assert.equal(rede.codigoRegional, '0901')
  assert.equal(rede.nPreco, '0901')
})

test('descrição repetida (truncada pelo SAP) não colide — a ocorrência desempata', () => {
  const ids = idsDoCatalogo(ORG, CT, [
    { descricao: 'REPOSICAO CBUQ ATE 40MM', unidade: 'M2' },
    { descricao: 'REPOSICAO CBUQ ATE 40MM', unidade: 'M2' },   // mesmo texto, outro preço
    { descricao: 'REPOSICAO CBUQ ATE 40MM', unidade: 'M3' },   // outra unidade
  ])
  assert.equal(new Set(ids).size, 3, 'três ids distintos')
})

test('🔴 O TESTE QUE IMPORTA: reimportar o catálogo NÃO quebra o de-para de siglas', () => {
  // `deParaSiglas` mapeia sigla do RDO WCR → ObraContratoServico.id. Se a projeção usasse
  // `crypto.randomUUID()`, todo o de-para apontaria para ids inexistentes depois da segunda
  // importação — em silêncio, e a sigla voltaria a "não mapeada" todo mês.
  const primeira = projetarParaObra(catalogo(), '01', ORG)
  const deParaSiglas: Record<string, string> = {
    PRA: primeira.find((s) => s.servicoCatalogoId === 'sv-rede')!.id,
    LA:  primeira.find((s) => s.servicoCatalogoId === 'sv-ligacao')!.id,
  }

  const segunda = projetarParaObra(catalogo(), '01', ORG)   // o cliente joga a planilha de novo
  const idsDepois = new Set(segunda.map((s) => s.id))
  for (const [sigla, id] of Object.entries(deParaSiglas)) {
    assert.ok(idsDepois.has(id), `a sigla ${sigla} deixou de resolver depois da reimportação`)
  }
  assert.deepEqual(primeira.map((s) => s.id), segunda.map((s) => s.id))
})

test('o id muda com a REGIÃO — mesmo serviço em duas regiões são duas linhas', () => {
  const a = idDoServicoDaObra(ORG, CT, '01', 'sv-rede')
  const b = idDoServicoDaObra(ORG, CT, '02', 'sv-rede')
  assert.notEqual(a, b)
})

test('🔴 mesclar: o que foi MEDIDO na obra sobrevive à reimportação', () => {
  // O catálogo nunca viu `qtdAnterior`/`qtdMedidaOverride`/`pctAplicado` — é trabalho lançado na
  // obra. Sobrescrevê-los apagaria medição, que é a mesma lição do `camposNaoInformados`.
  const projetados = projetarParaObra(catalogo(), '01', ORG)
  const comMedicao: ObraContratoServico[] = projetados.map((s) =>
    s.servicoCatalogoId === 'sv-rede' ? { ...s, qtdAnterior: 300, qtdMedidaOverride: 55, pctAplicado: 80 } : s)

  const r = mesclarProjecao(comMedicao, projetarParaObra(catalogo(), '01', ORG))
  const rede = r.servicos.find((s) => s.servicoCatalogoId === 'sv-rede')!
  assert.equal(rede.qtdAnterior, 300)
  assert.equal(rede.qtdMedidaOverride, 55)
  assert.equal(rede.pctAplicado, 80)
  assert.equal(r.atualizadas, 3)
  assert.equal(r.novas, 0)
})

test('mesclar: linha cadastrada à mão passa intacta e não é contada como projeção', () => {
  const manual: ObraContratoServico = {
    id: 'feito-a-mao', descricao: 'SERVICO DIGITADO', unidade: 'VB',
    qtdContrato: 1, valorUnitario: 1234.56,
  }
  const r = mesclarProjecao([manual], projetarParaObra(catalogo(), '01', ORG))
  assert.equal(r.manuais, 1)
  assert.deepEqual(r.servicos[0], manual, 'byte a byte')
  assert.equal(r.servicos.length, 4)
})

test('mesclar: projeção que sumiu do catálogo é removida — e contada', () => {
  const antes = projetarParaObra(catalogo(), '01', ORG)
  const menor = catalogo()
  menor.servicos = menor.servicos.slice(0, 1)
  const r = mesclarProjecao(antes, projetarParaObra(menor, '01', ORG))
  assert.equal(r.removidas, 2)
  assert.equal(r.servicos.length, 1)
})

test('as pendências saem separadas por causa, para a tela dizer qual é', () => {
  const p = pendenciasDoCatalogo(catalogo())
  assert.equal(p.bloqueados.length, 1)
  assert.equal(p.bloqueados[0].id, 'sv-deslocado')
  assert.deepEqual(p.porFlag, { bloco_deslocado_pdf: 1 })
})
