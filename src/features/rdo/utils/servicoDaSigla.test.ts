/**
 * O de-para de siglas: resolver, conferir unidade e prever.
 *
 * O teste 🔴 é o da unidade. O cenário não é hipotético: "Poço de visita pré-moldado D=1000mm" a
 * R$ 3.250,00 **por unidade** é item real do catálogo deste cliente. Mapear `PRA` (rede de água,
 * medida em METRO) nele faz um dia de 120 m valer R$ 390.000 — e hoje nada no código impede nem
 * avisa, porque o `<select>` lista todos os itens sem filtro e `precoEfetivo × quantidade`
 * multiplica sem olhar unidade.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ObraContrato, ObraContratoServico, RDO } from '@/types'
import { servicoDaSigla, conferirDeParaSiglas, previaDoDePara } from './servicoDaSigla'

const svc = (p: Partial<ObraContratoServico> & { id: string }): ObraContratoServico => ({
  descricao: 'Serviço', unidade: 'un', qtdContrato: 100, valorUnitario: 10, ...p,
})

const REDE_M = svc({ id: 'rede', descricao: 'Rede de água PEAD 63mm', unidade: 'm', valorUnitario: 42.5 })
const POCO_UN = svc({ id: 'poco', descricao: 'Poço de visita pré-moldado D=1000mm', unidade: 'un', valorUnitario: 3250 })
const LIGACAO_UN = svc({ id: 'lig', descricao: 'Ligação de água', unidade: 'un', valorUnitario: 60.95 })
const MOBILIZA_VB = svc({ id: 'mob', descricao: 'Mobilização', unidade: 'vb', valorUnitario: 15000 })

const contrato = (deParaSiglas: Record<string, string>): Pick<ObraContrato, 'deParaSiglas' | 'services'> =>
  ({ deParaSiglas, services: [REDE_M, POCO_UN, LIGACAO_UN, MOBILIZA_VB] })

const rdoWcr = (producao: Array<{ sigla: string; quantidade: string; unidade: 'M' | 'UN' }>, p: Partial<RDO> = {}): RDO => ({
  id: crypto.randomUUID(), number: 1, date: '2026-09-09', responsible: 'Gilvan',
  weather: { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 0 },
  manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 },
  equipment: [], services: [], trechos: [], geolocation: null,
  observations: '', incidents: '', photos: [],
  createdAt: '', updatedAt: '',
  siteId: 'obra-1', template: 'wcr', status: 'finalizado',
  wcr: { imoveis: [], producao },
  ...p,
} as RDO)

test('resolve a sigla pelo mapa da obra; sem mapa devolve undefined', () => {
  const c = contrato({ PRA: 'rede', LA: 'lig' })
  assert.equal(servicoDaSigla('PRA', c)?.id, 'rede')
  assert.equal(servicoDaSigla('LA', c)?.id, 'lig')
  assert.equal(servicoDaSigla('PV', c), undefined, 'sigla não mapeada')
  assert.equal(servicoDaSigla('PRA', null), undefined, 'obra sem contrato')
})

test('id apontando para item que não existe mais devolve undefined, não estoura', () => {
  assert.equal(servicoDaSigla('PRA', contrato({ PRA: 'apagado' })), undefined)
})

test('🔴 O TESTE QUE IMPORTA: metro mapeado em item por unidade é reportado', () => {
  // PRA (rede, METRO) → "Poço de visita" (R$ 3.250 por UNIDADE). 120 m viram R$ 390.000.
  const d = conferirDeParaSiglas(contrato({ PRA: 'poco' }))
  assert.equal(d.length, 1)
  assert.equal(d[0].sigla, 'PRA')
  assert.equal(d[0].motivo, 'metro-em-unidade')
  assert.ok(d[0].explicacao.includes('METRO'), 'a explicação diz a consequência, não só o fato')
})

test('🔴 e o inverso também: contagem mapeada em item por metro', () => {
  const d = conferirDeParaSiglas(contrato({ LA: 'rede' }))
  assert.equal(d[0].motivo, 'unidade-em-metro')
})

test('item por VERBA nunca combina — verba não se mede por quantidade', () => {
  assert.equal(conferirDeParaSiglas(contrato({ PRA: 'mob' }))[0].motivo, 'item-em-verba')
  assert.equal(conferirDeParaSiglas(contrato({ LA: 'mob' }))[0].motivo, 'item-em-verba')
})

test('⚠️ unidade compatível NÃO vira ruído falso', () => {
  // Se o validador reclamasse do caso certo, a tela viraria um mar de avisos e ninguém leria o real.
  assert.deepEqual(conferirDeParaSiglas(contrato({ PRA: 'rede', LA: 'lig', PRE: 'rede', PV: 'poco' })), [])
})

test('sigla sem mapa não é divergência — é só falta de cadastro', () => {
  assert.deepEqual(conferirDeParaSiglas(contrato({})), [])
})

test('a prévia soma a produção lançada e valoriza pelo de-para', () => {
  const rdos = [
    rdoWcr([{ sigla: 'PRA', quantidade: '120', unidade: 'M' }, { sigla: 'LA', quantidade: '3', unidade: 'UN' }]),
    rdoWcr([{ sigla: 'PRA', quantidade: '80', unidade: 'M' }]),
  ]
  const p = previaDoDePara(rdos, 'obra-1', contrato({ PRA: 'rede', LA: 'lig' }))
  assert.equal(p.rdos, 2)
  const pra = p.linhas.find((l) => l.sigla === 'PRA')!
  assert.equal(pra.quantidade, 200, '120 + 80')
  assert.equal(pra.valor, 8500, '200 × 42,50')
  assert.equal(p.valorTotal, 8500 + 3 * 60.95)
})

test('⚠️ quantidade vazia é NÃO INFORMADO — não entra como zero nem como linha', () => {
  const p = previaDoDePara([rdoWcr([{ sigla: 'PV', quantidade: '', unidade: 'UN' }])], 'obra-1', contrato({ PV: 'poco' }))
  assert.equal(p.linhas.length, 0)
  assert.equal(p.valorTotal, 0)
})

test('🔴 sigla com unidade divergente NÃO vira dinheiro nem na prévia', () => {
  // Mostrar o número seria convidar a pessoa a confiar nele.
  const p = previaDoDePara([rdoWcr([{ sigla: 'PRA', quantidade: '120', unidade: 'M' }])], 'obra-1', contrato({ PRA: 'poco' }))
  const pra = p.linhas[0]
  assert.equal(pra.divergente, true)
  assert.equal(pra.quantidade, 120, 'a quantidade continua visível')
  assert.equal(pra.valor, 0, 'mas o valor não')
  assert.equal(p.valorTotal, 0)
})

test('sigla com produção e sem mapa aparece contada, com o que falta marcado', () => {
  const p = previaDoDePara([rdoWcr([{ sigla: 'PV', quantidade: '2', unidade: 'UN' }])], 'obra-1', contrato({}))
  assert.equal(p.siglasSemMapa, 1)
  assert.equal(p.linhas[0].valor, 0)
})

test('só a obra pedida, só RDO WCR, só finalizado', () => {
  const rdos = [
    rdoWcr([{ sigla: 'LA', quantidade: '1', unidade: 'UN' }]),
    rdoWcr([{ sigla: 'LA', quantidade: '9', unidade: 'UN' }], { siteId: 'outra' }),
    rdoWcr([{ sigla: 'LA', quantidade: '9', unidade: 'UN' }], { status: 'rascunho' }),
    rdoWcr([{ sigla: 'LA', quantidade: '9', unidade: 'UN' }], { template: 'compizzo', wcr: undefined }),
  ]
  const p = previaDoDePara(rdos, 'obra-1', contrato({ LA: 'lig' }))
  assert.equal(p.rdos, 1)
  assert.equal(p.linhas[0].quantidade, 1)
})

test('⚠️ lê só `wcr.producao` — o detalhe por equipe é a MESMA produção e contaria em dobro', () => {
  const r = rdoWcr([{ sigla: 'LA', quantidade: '5', unidade: 'UN' }])
  r.wcr!.apontamentos = [
    { imoveis: [], producao: [{ sigla: 'LA', quantidade: '3', unidade: 'UN' }] },
    { imoveis: [], producao: [{ sigla: 'LA', quantidade: '2', unidade: 'UN' }] },
  ]
  const p = previaDoDePara([r], 'obra-1', contrato({ LA: 'lig' }))
  assert.equal(p.linhas[0].quantidade, 5, 'a soma, não a soma + o detalhe')
})
