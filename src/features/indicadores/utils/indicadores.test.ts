/**
 * Os quatro indicadores — e a regra que eles existem para impor.
 *
 * O teste que importa mais é o último bloco: **sem dado nunca é verde**. O produto acabou de sair
 * de uma auditoria em que o CPI mostrava 1,00 em verde por construção, sobre um campo que nem
 * existe no modelo. Se algum destes indicadores voltar a inventar um número quando não sabe, é
 * aqui que se descobre.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  dinheiroDoContrato, obrasReportando, execucaoContratada, rotinasEmDia, montarIndicadores,
} from './indicadores'
import type { ConstructionSite, ObraFaturamento, RDO, WorkWeekMode } from '@/types'
import type { Rotina, RotinaExecucao } from '@/store/rotinasStore'

const HOJE = '2026-08-20'          // quinta-feira
const JORNADA: WorkWeekMode = 'mon_fri'

const nota = (p: Partial<ObraFaturamento>): ObraFaturamento => ({
  id: Math.random().toString(36).slice(2), data: '2026-01-10', valor: 0, situacao: 'a_receber', ...p,
})

const obra = (p: Partial<ConstructionSite> = {}): ConstructionSite => ({
  id: 'o1', name: 'SUPERA', owner: '', company: '', status: 'active',
  startDate: '2026-01-01', risks: [], ...p,
} as unknown as ConstructionSite)

// ═══ 1 · Dinheiro do contrato ═══════════════════════════════════════════════

test('as vencidas são SUBCONJUNTO do a receber, nunca uma parcela à parte', () => {
  // Somar os dois dobraria o dinheiro. É por isso que o cartão diz "R$ X já venceram", com verbo.
  const d = dinheiroDoContrato([obra({ contrato: { services: [], valorServico: 100000, faturamentos: [
    nota({ valor: 10000, previsaoRecebimento: '2026-08-01' }),   // vencida
    nota({ valor: 20000, previsaoRecebimento: '2026-09-05' }),   // a vencer
  ] } })], HOJE)
  assert.equal(d.aReceberBRL, 30000)
  assert.equal(d.vencidoBRL, 10000)
  assert.ok(d.vencidoBRL <= d.aReceberBRL, 'vencido tem de caber dentro do a receber')
})

test('nota recebida não entra em nenhum dos dois', () => {
  const d = dinheiroDoContrato([obra({ contrato: { services: [], valorServico: 100000, faturamentos: [
    nota({ valor: 50000, situacao: 'recebido' }),
  ] } })], HOJE)
  assert.equal(d.aReceberBRL, 0)
  assert.equal(d.aReceberNotas, 0)
})

test('nota sem previsão de recebimento nunca conta como vencida', () => {
  const d = dinheiroDoContrato([obra({ contrato: { services: [], valorServico: 100000, faturamentos: [
    nota({ valor: 7000, previsaoRecebimento: undefined }),
  ] } })], HOJE)
  assert.equal(d.aReceberBRL, 7000)
  assert.equal(d.vencidoBRL, 0)
})

test('nota que vence HOJE ainda não está vencida — a comparação é <, não <=', () => {
  const d = dinheiroDoContrato([obra({ contrato: { services: [], valorServico: 100000, faturamentos: [
    nota({ valor: 5000, previsaoRecebimento: HOJE }),
  ] } })], HOJE)
  assert.equal(d.vencidoBRL, 0)
})

test('obra sem contrato fica FORA do total, e o nome é declarado', () => {
  const d = dinheiroDoContrato([
    obra({ id: 'o1', name: 'SUPERA', contrato: { services: [], valorServico: 100000, faturamentos: [nota({ valor: 1000 })] } }),
    obra({ id: 'o2', name: 'BRASAL' }),
  ], HOJE)
  assert.equal(d.aReceberBRL, 1000)
  assert.equal(d.obrasComContrato, 1)
  assert.deepEqual(d.obrasSemContrato, ['BRASAL'])
})

test('a nota citada é a que venceu HÁ MAIS TEMPO — é a que se cobra primeiro', () => {
  const d = dinheiroDoContrato([obra({ contrato: { services: [], valorServico: 100000, faturamentos: [
    nota({ valor: 1000, previsaoRecebimento: '2026-08-10' }),
    nota({ valor: 9000, previsaoRecebimento: '2026-07-01' }),
  ] } })], HOJE)
  assert.equal(d.maisAntiga?.venceuEm, '2026-07-01')
  assert.equal(d.maisAntiga?.brl, 9000)
})

// ═══ 3 · Executado do contrato ══════════════════════════════════════════════

test('⚠️ nota de MATERIAL não move o executado — a regressão do bb03a87', () => {
  // Na SUPERA o material (607.620) é quase do tamanho do serviço (592.324). Dividir o faturado
  // total pelo serviço levava a barra a 74% com 23% executado.
  const e = execucaoContratada([obra({ contrato: {
    services: [], valorServico: 592324.14, valorMaterial: 607620,
    faturamentos: [nota({ valor: 300000, categoria: 'material', situacao: 'recebido' })],
  } })], HOJE)
  assert.equal(e.obras[0].pctFaturado, 0)
})

test('sem valor de serviço, o percentual é null e a obra é declarada — não é 0%', () => {
  const e = execucaoContratada([obra({ name: 'BRASAL' })], HOJE)
  assert.equal(e.pctCarteira, null)
  assert.deepEqual(e.semContrato, ['BRASAL'])
  assert.equal(e.obras.length, 0)
})

test('pctCarteira é Σ÷Σ, NÃO a média dos percentuais', () => {
  const e = execucaoContratada([
    obra({ id: 'a', name: 'Grande', contrato: { services: [], valorServico: 1_000_000, faturamentos: [nota({ valor: 100_000, situacao: 'recebido' })] } }),
    obra({ id: 'b', name: 'Pequena', contrato: { services: [], valorServico: 10_000, faturamentos: [nota({ valor: 10_000, situacao: 'recebido' })] } }),
  ], HOJE)
  // 110.000 / 1.010.000 ≈ 10,9%. A média de (10% , 100%) daria 55% — cinco vezes maior.
  assert.ok(e.pctCarteira! > 10.8 && e.pctCarteira! < 11.0, `${e.pctCarteira} deveria ser ~10,9%`)
})

test('o percentual trava em 100 — aditivo faturado antes de atualizar o contrato acontece', () => {
  const e = execucaoContratada([obra({ contrato: {
    services: [], valorServico: 100, faturamentos: [nota({ valor: 250, situacao: 'recebido' })],
  } })], HOJE)
  assert.equal(e.obras[0].pctFaturado, 100)
})

// ═══ 2 · Obra reportando ════════════════════════════════════════════════════

const rdo = (p: Partial<RDO> = {}): RDO => ({
  id: Math.random().toString(36).slice(2), number: '1', date: HOJE, siteId: 'o1',
  status: 'finalizado', ...p,
} as unknown as RDO)

test('sem sincronizar a Torre, NÃO acusa obra nenhuma — a lista pode estar vazia por isso', () => {
  const r = obrasReportando({
    sites: [obra()], rdos: [], semProducao: new Map(), feriados: [], jornada: JORNADA,
    hoje: HOJE, torreSincronizada: false,
  })
  assert.equal(r.incerto, true)
  assert.deepEqual(r.semRdo, [])
})

test('RDO em rascunho NÃO resolve o dia', () => {
  const comRascunho = obrasReportando({
    sites: [obra()], rdos: [rdo({ status: 'rascunho' })], semProducao: new Map(),
    feriados: [], jornada: JORNADA, hoje: HOJE, torreSincronizada: true,
  })
  assert.ok(comRascunho.semRdo.length > 0, 'rascunho não alimenta nada, o dia segue em aberto')
})

test('RDO finalizado de hoje zera a lacuna', () => {
  const r = obrasReportando({
    sites: [obra()], rdos: [rdo({})], semProducao: new Map(),
    feriados: [], jornada: JORNADA, hoje: HOJE, torreSincronizada: true,
  })
  assert.deepEqual(r.semRdo, [])
  assert.equal(r.cobraveisHoje, 1)
})

test('dia justificado como "sem produção" resolve igual a um RDO', () => {
  const r = obrasReportando({
    sites: [obra()], rdos: [], semProducao: new Map([[`o1|${HOJE}`, 'chuva']]),
    feriados: [], jornada: JORNADA, hoje: HOJE, torreSincronizada: true,
  })
  assert.deepEqual(r.semRdo, [])
})

// ═══ 4 · Rotinas em dia ═════════════════════════════════════════════════════

const rot = (p: Partial<Rotina>): Rotina => ({
  id: 'r1', titulo: 'Finalizar RDO', frequencia: 'diaria', ordem: 0, ativa: true,
  criadaEm: '2026-01-01T00:00:00Z', ...p,
} as Rotina)

const exec = (rotinaId: string, periodo: string, feita = true): RotinaExecucao =>
  ({ id: `${rotinaId}-${periodo}`, rotinaId, periodo, feita, marcadaEm: '' })

const ctxRot = { feriados: new Set<string>(), jornada: JORNADA, hoje: HOJE }

test('feita no ciclo de hoje conta como feita e NÃO como atrasada', () => {
  // A rotina nasce hoje de propósito: fazer hoje NÃO perdoa os ciclos anteriores em aberto, e uma
  // rotina antiga sem histórico nenhum carregaria meses de atraso — que é o comportamento certo,
  // mas outra pergunta. Aqui o que se testa é o ciclo corrente.
  const r = rotinasEmDia({
    rotinas: [rot({ criadaEm: `${HOJE}T08:00:00Z` })],
    execucoes: [exec('r1', HOJE)],
    ...ctxRot,
  })
  assert.equal(r.feitasNoCiclo, 1)
  assert.equal(r.atrasadas, 0)
})

test('rotina antiga sem execução nenhuma ACUMULA atraso — e é isso que o gestor precisa ver', () => {
  const r = rotinasEmDia({ rotinas: [rot({ criadaEm: '2026-08-01T00:00:00Z' })], execucoes: [], ...ctxRot })
  assert.equal(r.atrasadas, 1)
  assert.ok((r.pior?.diasDeAtraso ?? 0) > 0, 'a pior precisa dizer há quantos dias')
})

test('execução com feita:false não conta — desmarcar grava linha, e contar linhas daria 100%', () => {
  const r = rotinasEmDia({ rotinas: [rot({})], execucoes: [exec('r1', HOJE, false)], ...ctxRot })
  assert.equal(r.feitasNoCiclo, 0)
})

test('rotina inativa sai dos dois números', () => {
  const r = rotinasEmDia({ rotinas: [rot({ ativa: false })], execucoes: [], ...ctxRot })
  assert.equal(r.ativas, 0)
  assert.equal(r.atrasadas, 0)
})

test('rotina criada hoje não nasce atrasada', () => {
  const r = rotinasEmDia({ rotinas: [rot({ criadaEm: `${HOJE}T08:00:00Z` })], execucoes: [], ...ctxRot })
  assert.equal(r.atrasadas, 0)
})

// ═══ A regra ════════════════════════════════════════════════════════════════

test('⚠️ SEM DADO NENHUM, nada é verde e nada inventa número', () => {
  // O oposto exato do `cpi = spent > 0 ? … : 1` que pintava 1,00 de verde.
  const d = dinheiroDoContrato([], HOJE)
  const e = execucaoContratada([], HOJE)
  const o = obrasReportando({ sites: [], rdos: [], semProducao: new Map(), feriados: [], jornada: JORNADA, hoje: HOJE, torreSincronizada: true })
  const rr = rotinasEmDia({ rotinas: [], execucoes: [], ...ctxRot })

  assert.equal(d.aReceberBRL, 0)
  assert.equal(d.obrasComContrato, 0)
  assert.equal(e.pctCarteira, null, 'carteira vazia é null, não 0% — 0% se lê como "não andou"')
  assert.equal(o.cobraveisHoje, 0)
  assert.equal(rr.ativas, 0)
  assert.equal(rr.pior, null)
})

// ═══ A extração não pode ser desfeita ═══════════════════════════════════════

test('o Radar 360 CHAMA estas funções, em vez de reimplementar as contas', async () => {
  // Duas implementações do mesmo fato divergem na primeira mudança, e aí o Radar e a tela de
  // abertura passam a discordar sobre quantas obras estão sem RDO — sem ninguém saber qual está
  // certa. Foi assim que a cascata do Modo Demonstração ficou quatro stores atrás da realidade.
  const { readFile } = await import('node:fs/promises')
  const sinais = await readFile(new URL('../../relatorio360/utils/sinais360.ts', import.meta.url), 'utf8')

  assert.match(sinais, /import \{[^}]*obrasReportando[^}]*\} from '@\/features\/indicadores\/utils\/indicadores'/s)
  assert.match(sinais, /import \{[^}]*rotinasEmDia[^}]*\} from '@\/features\/indicadores\/utils\/indicadores'/s)

  // E os laços que existiam antes não podem voltar: o do RDO acumulava `obrasComLacuna++` sobre
  // `lacunaDeRdo`, e o das rotinas filtrava `atrasoDaRotina` direto.
  const codigo = sinais.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.ok(!/obrasComLacuna\+\+/.test(codigo), 'o laço inline de obras sem RDO voltou')
  assert.ok(!/atrasoDaRotina\(/.test(codigo), 'a chamada direta a atrasoDaRotina voltou')
})

// ═══ Os cartões ═════════════════════════════════════════════════════════════

const vazio = {
  dinheiro: dinheiroDoContrato([], HOJE),
  reportando: obrasReportando({ sites: [], rdos: [], semProducao: new Map(), feriados: [], jornada: JORNADA, hoje: HOJE, torreSincronizada: true }),
  executado: execucaoContratada([], HOJE),
  rotinas: rotinasEmDia({ rotinas: [], execucoes: [], ...ctxRot }),
}

test('⚠️ com tudo vazio, os quatro cartões são "sem-dado" e mostram "—" — nunca verde', () => {
  // O oposto exato do CPI 1,00 em verde. Se este teste cair, a tela voltou a inventar.
  for (const i of montarIndicadores(vazio)) {
    assert.equal(i.tom, 'sem-dado', `${i.id} não deveria ter tom "${i.tom}"`)
    assert.equal(i.valor, '—', `${i.id} inventou o valor "${i.valor}"`)
  }
})

test('todo cartão explica o que é e de onde vem; sem dado, explica também o que falta', () => {
  for (const i of montarIndicadores(vazio)) {
    assert.ok(i.explicacao.oQueE.length > 40, `${i.id}: explicação curta demais`)
    assert.ok(i.explicacao.deOndeVem.length > 40, `${i.id}: origem não declarada`)
    assert.ok(i.explicacao.oQueFalta, `${i.id}: está sem dado e não diz o que preencher`)
    assert.ok(i.destino.startsWith('/app/'), `${i.id}: sem destino de clique`)
  }
})

test('nota vencida põe o cartão de dinheiro em GRAVE e cita a obra', () => {
  const com = {
    ...vazio,
    dinheiro: dinheiroDoContrato([obra({ name: 'BRASAL', contrato: { services: [], valorServico: 236949.07, faturamentos: [
      nota({ valor: 21450, previsaoRecebimento: '2026-08-01' }),
    ] } })], HOJE),
  }
  const c = montarIndicadores(com).find((i) => i.id === 'dinheiro')!
  assert.equal(c.tom, 'grave')
  assert.match(c.detalhe, /venceu/)
  assert.match(c.detalhe, /BRASAL/)
})

test('obra em dia deixa o cartão de RDO verde, e o denominador conta ela', () => {
  const com = {
    ...vazio,
    reportando: obrasReportando({
      sites: [obra()], rdos: [rdo()], semProducao: new Map(),
      feriados: [], jornada: JORNADA, hoje: HOJE, torreSincronizada: true,
    }),
  }
  const c = montarIndicadores(com).find((i) => i.id === 'reportando')!
  assert.equal(c.valor, '1 de 1')
  assert.equal(c.tom, 'ok')
})

test('sincronização em andamento é "sem-dado", não "tudo em aberto"', () => {
  const com = {
    ...vazio,
    reportando: obrasReportando({
      sites: [obra()], rdos: [], semProducao: new Map(),
      feriados: [], jornada: JORNADA, hoje: HOJE, torreSincronizada: false,
    }),
  }
  const c = montarIndicadores(com).find((i) => i.id === 'reportando')!
  assert.equal(c.tom, 'sem-dado')
  assert.equal(c.valor, '—')
  assert.match(c.explicacao.oQueFalta ?? '', /sincroniz/i)
})
