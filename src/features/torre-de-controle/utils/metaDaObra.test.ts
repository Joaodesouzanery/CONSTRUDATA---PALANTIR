/**
 * A meta da obra por fase — e as duas regras que impedem o número sem significado.
 *
 * ⚠️ Os testes 🔴 aqui defendem decisões que o cliente tomou por escrito em 20/09/2026: parcelas
 * separadas por unidade (nunca um total somado) e os dois modos de preço, com a tela dizendo qual
 * está valendo. Se um deles cair, o relatório que vai para o cliente passa a somar metro com metro
 * quadrado — que é o defeito que `lib/unidadesMedida.ts` existe para impedir.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  realizadoPorFaseNoPeriodo, receitaDaFase, resumoDaMeta, conferirCatalogo,
  diasDoPeriodo, ritmoDiarioDaFase, TEXTO_SEM_RECEITA, precoMedioDoContratoM2,
} from './metaDaObra'
import { FASES_PADRAO, FASE_POLIMENTO, TOTAL_DOS_PESOS } from '@/features/rdo/data/fasesPadrao'
import type { ConstructionSite, FaseDaObra, MetaDoPeriodo, RDO } from '@/types'

// ─── Montagem ─────────────────────────────────────────────────────────────────

const PISO: FaseDaObra = { id: 'f-piso', nome: 'Pintura', unidade: 'm²', ordem: 6, ativa: true, pesoPct: 100 }
const DEMARCACAO: FaseDaObra = { id: 'f-dem', nome: 'Demarcação', unidade: 'm', ordem: 7, ativa: true, pesoPct: 0 }
const SINALIZACAO: FaseDaObra = { id: 'f-sin', nome: 'Números', unidade: 'un', ordem: 8, ativa: true, pesoPct: 0 }

function rdo(over: Partial<RDO> & { producao?: Array<{ faseId?: string; quantidade: string }> } = {}): RDO {
  const { producao, ...resto } = over
  return {
    id: 'r1', number: 'RDO-1', date: '2026-09-15', responsible: 'Fulano',
    weather: 'sunny', manpower: { total: 0, present: 0, absent: 0 },
    equipment: [], services: [], trechos: [], geolocation: { lat: 0, lng: 0 },
    observations: '', incidents: '', photos: [],
    siteId: 'obra-1', status: 'finalizado', template: 'compizzo',
    createdAt: '', updatedAt: '',
    compizzo: { producao: (producao ?? []).map((p) => ({ servico: '', ...p })) } as RDO['compizzo'],
    ...resto,
  } as RDO
}

const META: MetaDoPeriodo = {
  id: 'm1', de: '2026-09-01', ate: '2026-09-30',
  porFase: { 'f-piso': 1000, 'f-dem': 400, 'f-sin': 18 },
}

// ─── Realizado ────────────────────────────────────────────────────────────────

test('soma a metragem por fase, dos RDO finalizados do período', () => {
  const r = realizadoPorFaseNoPeriodo([
    rdo({ id: 'a', date: '2026-09-10', producao: [{ faseId: 'f-piso', quantidade: '120' }] }),
    rdo({ id: 'b', date: '2026-09-11', producao: [{ faseId: 'f-piso', quantidade: '80' }, { faseId: 'f-dem', quantidade: '40' }] }),
  ], 'obra-1', '2026-09-01', '2026-09-30')
  assert.equal(r['f-piso'], 200)
  assert.equal(r['f-dem'], 40)
})

test('🔴 RDO em RASCUNHO não conta', () => {
  const r = realizadoPorFaseNoPeriodo([
    rdo({ id: 'a', status: 'rascunho', producao: [{ faseId: 'f-piso', quantidade: '500' }] }),
  ], 'obra-1', '2026-09-01', '2026-09-30')
  assert.equal(r['f-piso'], undefined,
    'rascunho ainda pode mudar — deixá-lo somar faria a meta oscilar enquanto alguém digita')
})

test('RDO de outra obra ou fora do período não conta', () => {
  const r = realizadoPorFaseNoPeriodo([
    rdo({ id: 'a', siteId: 'outra', producao: [{ faseId: 'f-piso', quantidade: '500' }] }),
    rdo({ id: 'b', date: '2026-08-31', producao: [{ faseId: 'f-piso', quantidade: '500' }] }),
    rdo({ id: 'c', date: '2026-10-01', producao: [{ faseId: 'f-piso', quantidade: '500' }] }),
  ], 'obra-1', '2026-09-01', '2026-09-30')
  assert.deepEqual(r, {})
})

test('linha sem fase vinculada é ignorada — e não quebra', () => {
  const r = realizadoPorFaseNoPeriodo([
    rdo({ producao: [{ quantidade: '120' }, { faseId: 'f-piso', quantidade: '80' }] }),
  ], 'obra-1', '2026-09-01', '2026-09-30')
  assert.equal(r['f-piso'], 80)
})

test('quantidade em formato brasileiro é lida certo', () => {
  const r = realizadoPorFaseNoPeriodo([
    rdo({ producao: [{ faseId: 'f-piso', quantidade: '1.234,50' }] }),
  ], 'obra-1', '2026-09-01', '2026-09-30')
  assert.equal(r['f-piso'], 1234.5)
})

// ─── 🔴 Nunca somar m com m² ──────────────────────────────────────────────────

test('🔴 o resumo devolve PARCELAS por unidade, nunca um total', () => {
  const resumo = resumoDaMeta([PISO, DEMARCACAO, SINALIZACAO], META,
    { 'f-piso': 1000, 'f-dem': 340, 'f-sin': 12 }, 'peso', 45)

  assert.equal(resumo.realizado.area, 1000)
  assert.equal(resumo.realizado.linear, 340)
  assert.equal(resumo.realizado.outra, 12)
  // Se algum dia alguém acrescentar um `total`, este teste é o que deve impedir.
  assert.ok(!('total' in resumo.realizado),
    '1.000 + 340 + 12 = 1.352 não é área, nem comprimento, nem contagem')
})

test('o previsto também vem em parcelas', () => {
  const resumo = resumoDaMeta([PISO, DEMARCACAO, SINALIZACAO], META, {}, 'peso', 45)
  assert.equal(resumo.previsto.area, 1000)
  assert.equal(resumo.previsto.linear, 400)
  assert.equal(resumo.previsto.outra, 18)
})

// ─── 🔴 Os dois modos de preço ────────────────────────────────────────────────

test('🔴 modo PESO: a fase vale a fatia dela do preço do piso', () => {
  const fase: FaseDaObra = { ...PISO, pesoPct: 15.5 }
  const { valor } = receitaDaFase(fase, 1000, 'peso', 45)
  assert.equal(valor, 1000 * 45 * 0.155, '1.000 m² × R$ 45,00 × 15,5% = R$ 6.975,00')
})

test('🔴 modo PESO recusa fase que não é de área — R$/m² não multiplica metro linear', () => {
  const r = receitaDaFase(DEMARCACAO, 340, 'peso', 45)
  assert.equal(r.valor, null, 'zero pareceria "não vale nada"; null diz "não sei precificar"')
  assert.equal(r.motivo, 'peso-em-unidade-nao-area')
})

test('🔴 modo PREÇO PRÓPRIO precifica qualquer unidade', () => {
  const r = receitaDaFase({ ...DEMARCACAO, precoUnitario: 8.75 }, 340, 'preco-proprio', undefined)
  assert.equal(r.valor, 340 * 8.75, 'R$ 8,75/m — o preço real de demarcação no contrato do cliente')
})

test('modo PREÇO PRÓPRIO sem preço na fase diz o que falta', () => {
  const r = receitaDaFase(DEMARCACAO, 340, 'preco-proprio', 45)
  assert.equal(r.valor, null)
  assert.equal(r.motivo, 'fase-sem-preco')
})

test('modo PESO sem precoM2 na obra diz o que falta', () => {
  const r = receitaDaFase({ ...PISO, pesoPct: 15.5 }, 1000, 'peso', undefined)
  assert.equal(r.valor, null)
  assert.equal(r.motivo, 'obra-sem-preco-m2')
})

test('o resumo conta quantas fases ficaram sem receita', () => {
  const resumo = resumoDaMeta([PISO, DEMARCACAO, SINALIZACAO], META,
    { 'f-piso': 1000, 'f-dem': 340, 'f-sin': 12 }, 'peso', 45)
  assert.equal(resumo.fasesSemReceita, 2, 'demarcação e sinalização não são m²')
  assert.equal(resumo.receita, 1000 * 45 * 1, 'só o piso, com peso 100%')
})

test('todo motivo de "sem receita" tem texto que diz o que fazer', () => {
  for (const texto of Object.values(TEXTO_SEM_RECEITA)) assert.ok(texto.length > 20)
})

// ─── Percentual e ritmo ───────────────────────────────────────────────────────

test('🔴 fase SEM meta tem percentual null, não 0%', () => {
  const meta: MetaDoPeriodo = { id: 'm', de: '2026-09-01', ate: '2026-09-30', porFase: {} }
  const resumo = resumoDaMeta([PISO], meta, { 'f-piso': 200 }, 'peso', 45)
  assert.equal(resumo.linhas[0].pct, null, '"0% de nada" leria como atraso; não há meta nenhuma')
  assert.equal(resumo.linhas[0].realizado, 200)
})

test('o percentual e o que falta batem', () => {
  const resumo = resumoDaMeta([PISO], META, { 'f-piso': 250 }, 'peso', 45)
  assert.equal(resumo.linhas[0].pct, 25)
  assert.equal(resumo.linhas[0].falta, 750)
})

test('passar da meta dá falta negativa, não zero', () => {
  const resumo = resumoDaMeta([PISO], META, { 'f-piso': 1200 }, 'peso', 45)
  assert.equal(resumo.linhas[0].falta, -200, 'esconder o excedente esconderia a meta mal dimensionada')
})

test('o ritmo diário sai do período, sem cadastro à parte', () => {
  assert.equal(diasDoPeriodo('2026-09-01', '2026-09-30'), 30)
  assert.equal(diasDoPeriodo('2026-08-21', '2026-09-20'), 31, 'a janela de medição 21 a 20')
  assert.equal(ritmoDiarioDaFase(1000, 30), 1000 / 30)
  assert.equal(ritmoDiarioDaFase(1000, 0), 0, 'período inválido não divide por zero')
})

test('fase DESATIVADA fica fora do resumo, sem apagar o dado', () => {
  const resumo = resumoDaMeta([PISO, { ...DEMARCACAO, ativa: false }], META, { 'f-dem': 340 }, 'peso', 45)
  assert.equal(resumo.linhas.length, 1)
  assert.equal(resumo.realizado.linear, 0)
})

// ─── 🔴 A conferência do catálogo ─────────────────────────────────────────────

test('🔴 pesos que não fecham 100% são ACUSADOS', () => {
  const fases: FaseDaObra[] = [
    { id: 'a', nome: 'A', unidade: 'm²', ordem: 1, ativa: true, pesoPct: 50 },
    { id: 'b', nome: 'B', unidade: 'm²', ordem: 2, ativa: true, pesoPct: 47 },
  ]
  const p = conferirCatalogo(fases, 'peso')
  const pesos = p.find((x) => x.tipo === 'pesos-nao-fecham')
  assert.ok(pesos, '97% faria a obra inteira valer menos que o contratado, e ninguém veria')
  assert.match(pesos!.texto, /97,0%|97\.0%/)
  assert.match(pesos!.texto, /Faltam 3/)
})

test('pesos que fecham não acusam nada', () => {
  const fases: FaseDaObra[] = [
    { id: 'a', nome: 'A', unidade: 'm²', ordem: 1, ativa: true, pesoPct: 60 },
    { id: 'b', nome: 'B', unidade: 'm²', ordem: 2, ativa: true, pesoPct: 40 },
  ]
  assert.equal(conferirCatalogo(fases, 'peso').filter((x) => x.tipo === 'pesos-nao-fecham').length, 0)
})

test('a tolerância do peso aceita ponto flutuante, não exige igualdade exata', () => {
  const fases: FaseDaObra[] = [15.5, 8, 10, 10, 10, 15.5, 15.5, 15.5].map((pesoPct, i) => ({
    id: `f${i}`, nome: `F${i}`, unidade: 'm²' as const, ordem: i, ativa: true, pesoPct,
  }))
  assert.equal(conferirCatalogo(fases, 'peso').filter((x) => x.tipo === 'pesos-nao-fecham').length, 0)
})

test('🔴 fase linear no modo PESO é apontada, com o que fazer', () => {
  const p = conferirCatalogo([{ ...PISO, pesoPct: 100 }, DEMARCACAO], 'peso')
  const aviso = p.find((x) => x.tipo === 'peso-em-unidade-nao-area')
  assert.ok(aviso)
  assert.match(aviso!.texto, /preço próprio/, 'apontar o problema sem dizer a saída não serve')
})

test('modo PREÇO PRÓPRIO acusa fase sem preço, e NÃO cobra peso', () => {
  const p = conferirCatalogo([PISO, DEMARCACAO], 'preco-proprio')
  assert.ok(p.some((x) => x.tipo === 'fase-sem-preco'))
  assert.equal(p.filter((x) => x.tipo === 'pesos-nao-fecham').length, 0,
    'no modo preço próprio o peso não é usado — cobrar soma 100 seria ruído')
})

test('catálogo sem fase ativa é o primeiro problema, e o único que importa', () => {
  const p = conferirCatalogo([{ ...PISO, ativa: false }], 'peso')
  assert.equal(p.length, 1)
  assert.equal(p[0].tipo, 'sem-fase-ativa')
})

// ─── As fases padrão ──────────────────────────────────────────────────────────

test('🔴 as fases padrão somam exatamente 100%', () => {
  const soma = FASES_PADRAO.reduce((s, f) => s + f.pesoPct, 0)
  assert.equal(soma, TOTAL_DOS_PESOS,
    'peso que não fecha faz o avanço financeiro mentir sem avisar')
})

test('as fases padrão são as 8 da lista do cliente, na ordem', () => {
  assert.equal(FASES_PADRAO.length, 8)
  assert.match(FASES_PADRAO[0].nome, /Lixamento/)
  assert.match(FASES_PADRAO[1].nome, /Juntas/)
  assert.match(FASES_PADRAO[7].nome, /Demarcações/)
})

test('🔴 as unidades das fases padrão não são todas iguais', () => {
  const unidades = new Set(FASES_PADRAO.map((f) => f.unidade))
  assert.ok(unidades.has('m²') && unidades.has('m') && unidades.has('un'),
    'piso é área, demarcação é comprimento, sinalização é contagem — é a razão das parcelas')
})

test('o Polimento existe à parte, fora do padrão', () => {
  assert.equal(FASE_POLIMENTO.nome, 'Polimento')
  assert.ok(!FASES_PADRAO.some((f) => f.nome === 'Polimento'))
})

// ─── 🔴 A receita da META × a receita do FEITO ────────────────────────────────

test('🔴 receitaPrevista sai do PREVISTO e receita sai do REALIZADO — não são o mesmo número', () => {
  const r = resumoDaMeta([PISO], { ...META, porFase: { 'f-piso': 1000 } }, { 'f-piso': 250 }, 'peso', 45)
  // 1.000 m² × R$ 45 × 100% = 45.000 previstos; 250 m² feitos = 11.250.
  assert.equal(r.receitaPrevista, 45_000)
  assert.equal(r.receita, 11_250)
  assert.equal(r.linhas[0].receitaPrevista, 45_000)
  assert.equal(r.linhas[0].receita, 11_250)
  // ⚠️ Se alguém trocar o argumento de uma das duas, os números ficam IGUAIS e ninguém percebe —
  // a tela mostraria a meta 100% faturada desde o primeiro dia do mês.
  assert.notEqual(r.receitaPrevista, r.receita)
})

test('🔴 fase em metro linear no modo peso não tem receita prevista, e é contada como sem preço', () => {
  const r = resumoDaMeta([DEMARCACAO], { ...META, porFase: { 'f-dem': 400 } }, { 'f-dem': 100 }, 'peso', 45)
  assert.equal(r.linhas[0].receitaPrevista, null, 'R$/m² não multiplica metro linear')
  assert.equal(r.linhas[0].receita, null)
  assert.equal(r.receitaPrevista, 0)
  assert.equal(r.fasesSemReceita, 1, 'o total incompleto tem de vir MARCADO, nunca parecer completo')
})

test('o modo preço próprio precifica a meta em metro linear — os R$ 8,75/m da demarcação', () => {
  const dem = { ...DEMARCACAO, precoUnitario: 8.75 }
  const r = resumoDaMeta([dem], { ...META, porFase: { 'f-dem': 400 } }, { 'f-dem': 100 }, 'preco-proprio', undefined)
  assert.equal(r.receitaPrevista, 3500)
  assert.equal(r.receita, 875)
  assert.equal(r.fasesSemReceita, 0)
})

// ─── 🔴 O preço que o contrato sugere ─────────────────────────────────────────

const obraCom = (services: Array<{ unidade: string; qtdContrato: number; valorUnitario: number }>) =>
  ({ contrato: { services } } as unknown as ConstructionSite)

test('🔴 o preço do contrato é média PONDERADA pela quantidade, nunca a aritmética', () => {
  // O caso real: um item grande e barato, outro pequeno e caro.
  const site = obraCom([
    { unidade: 'm²', qtdContrato: 18_000, valorUnitario: 28 },
    { unidade: 'm²', qtdContrato: 50, valorUnitario: 120 },
  ])
  const media = precoMedioDoContratoM2(site)!
  assert.ok(Math.abs(media - 28.2548) < 0.001, `esperava ~28,25, deu ${media}`)
  // ⚠️ A aritmética daria R$ 74/m² e multiplicaria a receita da meta por 2,6. E este número
  // agora alimenta um botão que GRAVA o preço da obra.
  assert.notEqual(Math.round(media), 74)
})

test('🔴 só serviço em m² entra — metro linear e unidade não formam um R$/m²', () => {
  const site = obraCom([
    { unidade: 'm²', qtdContrato: 100, valorUnitario: 30 },
    { unidade: 'm', qtdContrato: 1000, valorUnitario: 8.75 },
    { unidade: 'un', qtdContrato: 20, valorUnitario: 150 },
  ])
  assert.equal(precoMedioDoContratoM2(site), 30)
})

test('sem base, devolve null — não zero', () => {
  assert.equal(precoMedioDoContratoM2({} as ConstructionSite), null)
  assert.equal(precoMedioDoContratoM2(obraCom([])), null)
  assert.equal(precoMedioDoContratoM2(obraCom([{ unidade: 'm²', qtdContrato: 100, valorUnitario: 0 }])), null,
    'serviço sem preço não entra na média')
  assert.equal(precoMedioDoContratoM2(obraCom([{ unidade: 'm²', qtdContrato: 0, valorUnitario: 30 }])), null,
    'quantidade zero dividiria por zero')
})
