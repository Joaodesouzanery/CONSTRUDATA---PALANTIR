/**
 * Adesão às rotinas — a memória que faltava.
 *
 * O teste que mais importa é o primeiro: **zero de zero não é 0%**. Uma rotina mensal olhada numa
 * visão semanal não devia nada naquele período, e mostrá-la como "Valim: 0%" é a acusação mais
 * fácil de produzir por acidente e a mais difícil de desmentir depois.
 *
 * Calendário destes testes (agosto/2026, jornada seg–sex):
 *   W32  03/08 (seg) → 09/08 (dom)
 *   W33  10/08       → 16/08
 *   W34  17/08       → 23/08
 *   W35  24/08       → 30/08
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ciclosEsperados, adesaoDaRotina, adesaoNoPeriodo } from './adesaoRotina'
import { periodoLivre, mesDe } from '@/lib/periodo'
import type { Rotina } from '@/store/rotinasStore'
import type { WorkWeekMode } from '@/types'

const JORNADA: WorkWeekMode = 'mon_fri'
/** 20/08/2026 é quinta. O ciclo W34 ainda não fechou nesta data. */
const HOJE = '2026-08-20'

const rot = (p: Partial<Rotina> = {}): Rotina => ({
  id: 'r1', titulo: 'Conferir estoque', frequencia: 'semanal', ordem: 0, ativa: true,
  criadaEm: '2026-01-01T00:00:00Z', ...p,
} as Rotina)

const ctx = (feitas: string[] = [], extra: Partial<Parameters<typeof adesaoDaRotina>[2]> = {}) => ({
  feitas: new Set(feitas),
  feriados: new Set<string>(),
  jornada: JORNADA,
  hoje: HOJE,
  ...extra,
})

const AGOSTO = mesDe('2026-08-15')

// ── A armadilha principal ─────────────────────────────────────────────────────

test('⚠️ zero esperados devolve null, NUNCA 0% — mensal numa visão de semana', () => {
  const semana = periodoLivre('2026-08-10', '2026-08-16')
  const a = adesaoDaRotina(rot({ frequencia: 'mensal' }), semana, ctx())
  assert.equal(a.esperados, 0)
  assert.equal(a.percentual, null, '0/0 apresentado como 0% acusa quem não devia nada')
})

test('o resumo do período se declara vazio quando ninguém devia nada', () => {
  const semana = periodoLivre('2026-08-10', '2026-08-16')
  const r = adesaoNoPeriodo([rot({ frequencia: 'mensal' })], semana, ctx())
  assert.equal(r.vazio, true)
  assert.equal(r.total.percentual, null)
})

// ── As cinco regras ───────────────────────────────────────────────────────────

test('1. ciclo que só ENCOSTA no período não conta', () => {
  // Agosto/2026 vai de 01 a 31. W31 (27/07–02/08) e W36 (31/08–06/09) atravessam a borda.
  const { ciclos } = ciclosEsperados(rot(), AGOSTO, ctx())
  assert.ok(ciclos.every((c) => c.de >= '2026-08-01' && c.ate <= '2026-08-31'))
  assert.ok(!ciclos.some((c) => c.ciclo === '2026-W31'))
})

test('2. o ciclo CORRENTE não conta — ainda dá tempo de fazer', () => {
  // Em 20/08 a semana W34 (17–23/08) ainda está aberta.
  const { ciclos } = ciclosEsperados(rot(), AGOSTO, ctx())
  assert.ok(!ciclos.some((c) => c.ciclo === '2026-W34'), 'W34 fecha só no dia 23')
  assert.deepEqual(ciclos.map((c) => c.ciclo), ['2026-W32', '2026-W33'])
})

test('3. rotina criada no meio do período não deve os ciclos anteriores', () => {
  const { ciclos } = ciclosEsperados(rot({ criadaEm: '2026-08-10T09:00:00Z' }), AGOSTO, ctx())
  assert.deepEqual(ciclos.map((c) => c.ciclo), ['2026-W33'], 'W32 é anterior ao nascimento')
})

test('4. diária pula sábado, domingo e feriado', () => {
  const semana = periodoLivre('2026-08-03', '2026-08-09')   // seg a dom
  const semFeriado = ciclosEsperados(rot({ frequencia: 'diaria' }), semana, ctx())
  assert.equal(semFeriado.ciclos.length, 5, 'sábado e domingo fora')

  const comFeriado = ciclosEsperados(
    rot({ frequencia: 'diaria' }), semana,
    ctx([], { feriados: new Set(['2026-08-05']) }),
  )
  assert.equal(comFeriado.ciclos.length, 4)
})

test('4b. jornada mon_sat inclui o sábado', () => {
  const semana = periodoLivre('2026-08-03', '2026-08-09')
  const r = ciclosEsperados(rot({ frequencia: 'diaria' }), semana, ctx([], { jornada: 'mon_sat' }))
  assert.equal(r.ciclos.length, 6)
})

test('5. ⚠️ período longo NÃO faz a rotina diária sumir do relatório', () => {
  // A varredura andava para a FRENTE a partir do começo do período, e o teto de voltas cortava
  // justamente a parte relevante: num recorte de dois anos, a diária gastava as 400 voltas em
  // 2024 e devolvia `esperados: 0` — a rotina desaparecia do relatório inteiro, sem aviso.
  // Agora ela anda de trás para a frente, e o que se perde é o passado distante.
  const r = ciclosEsperados(
    rot({ frequencia: 'diaria', criadaEm: '2024-06-01T00:00:00Z' }),
    periodoLivre('2024-08-28', '2026-08-19'),
    ctx(),
  )
  // O teto de 400 voltas cobre ~14 meses de dias úteis. O que não pode acontecer é devolver zero.
  assert.ok(r.ciclos.length > 250, `só ${r.ciclos.length} ciclos — a varredura morreu no passado`)
  assert.equal(r.truncado, true, 'e quando corta, precisa dizer que cortou')
  // O que sobrou são os ciclos RECENTES — a parte que a reunião discute. Antes sobrava o começo
  // de 2024 e o ano corrente inteiro ficava de fora.
  assert.ok(r.ciclos[r.ciclos.length - 1].ate >= '2026-08-01', 'o fim do período tem de estar coberto')
  assert.ok(r.ciclos[0].de > '2024-09-01', 'o corte deve cair no passado distante, não no recente')
})

test('5b. a varredura para no nascimento da rotina, sem gastar voltas antes dela', () => {
  const r = ciclosEsperados(rot({ frequencia: 'diaria' }), periodoLivre('2015-01-01', '2026-08-19'), ctx())
  assert.equal(r.truncado, false, 'não precisa truncar: a rotina nasceu em 2026-01-01')
  assert.ok(r.ciclos.every((c) => c.de >= '2026-01-01'))
})

test('5c. os ciclos saem em ordem cronológica, mesmo varrendo de trás para a frente', () => {
  const { ciclos } = ciclosEsperados(rot(), AGOSTO, ctx())
  const ordenados = [...ciclos].sort((a, b) => a.de.localeCompare(b.de))
  assert.deepEqual(ciclos.map((c) => c.ciclo), ordenados.map((c) => c.ciclo))
})

test('o placar não parte a mesma pessoa em duas por causa da caixa do nome', () => {
  // 18 rotinas digitadas à mão com login compartilhado: "Valim" e "valim" acontecem.
  const r = adesaoNoPeriodo([
    rot({ id: 'a', responsavel: 'Valim' }),
    rot({ id: 'b', responsavel: 'valim' }),
  ], AGOSTO, ctx(['a|2026-W32', 'a|2026-W33']))
  assert.equal(r.porPessoa.length, 1, 'duas linhas para a mesma pessoa')
  assert.equal(r.porPessoa[0].esperados, 4)
  assert.equal(r.porPessoa[0].cumpridos, 2)
})

// ── Rotina inativa ────────────────────────────────────────────────────────────

test('rotina inativa não espera ciclo nenhum', () => {
  assert.equal(ciclosEsperados(rot({ ativa: false }), AGOSTO, ctx()).ciclos.length, 0)
})

// ── Execução ──────────────────────────────────────────────────────────────────

test('só conta cumprido o ciclo que tem execução marcada', () => {
  const a = adesaoDaRotina(rot(), AGOSTO, ctx(['r1|2026-W32']))
  assert.equal(a.esperados, 2)
  assert.equal(a.cumpridos, 1)
  assert.equal(a.percentual, 50)
  assert.deepEqual(a.emAberto.map((c) => c.ciclo), ['2026-W33'])
})

test('o que ficou em aberto vem do mais recente para o mais antigo', () => {
  const a = adesaoDaRotina(rot(), AGOSTO, ctx())
  assert.deepEqual(a.emAberto.map((c) => c.ciclo), ['2026-W33', '2026-W32'])
})

// ── Por pessoa ────────────────────────────────────────────────────────────────

test('⚠️ o placar soma numeradores e denominadores, NÃO a média dos percentuais', () => {
  // Valim: uma diária com muitos ciclos e uma mensal com um. A média daria peso igual às duas.
  const diaria = rot({ id: 'd', frequencia: 'diaria', responsavel: 'Valim', titulo: 'RDO' })
  const mensal = rot({ id: 'm', frequencia: 'mensal', responsavel: 'Valim', titulo: 'Fechamento' })
  const julho = mesDe('2026-07-15')

  const esperadosDiaria = ciclosEsperados(diaria, julho, ctx()).ciclos
  const feitas = esperadosDiaria.map((c) => `d|${c.ciclo}`)   // diária 100%, mensal 0%

  const r = adesaoNoPeriodo([diaria, mensal], julho, ctx(feitas))
  const valim = r.porPessoa.find((p) => p.nome === 'Valim')!
  assert.equal(valim.cumpridos, esperadosDiaria.length)
  assert.equal(valim.esperados, esperadosDiaria.length + 1)
  assert.ok(valim.percentual! > 90, `${valim.percentual}% — a média de (100%,0%) daria 50%`)
})

test('rotina sem responsável entra no total e fica fora do placar por pessoa', () => {
  const r = adesaoNoPeriodo([rot({ responsavel: undefined })], AGOSTO, ctx())
  assert.equal(r.total.esperados, 2)
  assert.deepEqual(r.porPessoa, [])
})

test('rotina não avaliada no período não puxa a pessoa para baixo', () => {
  // A mensal tem zero esperados nesta semana: entrar no placar com 0/0 viraria 0%.
  const semana = periodoLivre('2026-08-10', '2026-08-16')
  const r = adesaoNoPeriodo([
    rot({ id: 's', frequencia: 'semanal', responsavel: 'Ana' }),
    rot({ id: 'm', frequencia: 'mensal', responsavel: 'Ana' }),
  ], semana, ctx(['s|2026-W33']))
  const ana = r.porPessoa.find((p) => p.nome === 'Ana')!
  assert.equal(ana.rotinas, 1, 'só a semanal foi avaliada')
  assert.equal(ana.percentual, 100)
})

test('o placar vem com a pior adesão primeiro — é para isso que ele serve', () => {
  const r = adesaoNoPeriodo([
    rot({ id: 'a', responsavel: 'Bom' }),
    rot({ id: 'b', responsavel: 'Ruim' }),
  ], AGOSTO, ctx(['a|2026-W32', 'a|2026-W33']))
  assert.deepEqual(r.porPessoa.map((p) => p.nome), ['Ruim', 'Bom'])
})

// ── Bordas de calendário ──────────────────────────────────────────────────────

test('a varredura não duplica nem pula ciclo na virada do ano', () => {
  const dezembro = mesDe('2026-12-15')
  const { ciclos } = ciclosEsperados(rot(), dezembro, { ...ctx(), hoje: '2027-01-15' })
  const etiquetas = ciclos.map((c) => c.ciclo)
  assert.equal(new Set(etiquetas).size, etiquetas.length, 'etiqueta repetida na varredura')
})

test('quinzenal atravessa fevereiro bissexto sem pular nem duplicar', () => {
  const fev = mesDe('2028-02-10')
  const { ciclos } = ciclosEsperados(rot({ frequencia: 'quinzenal' }), fev, { ...ctx(), hoje: '2028-03-10' })
  const etiquetas = ciclos.map((c) => c.ciclo)
  assert.equal(new Set(etiquetas).size, etiquetas.length)
  assert.equal(ciclos.length, 2, 'fevereiro tem duas quinzenas, mesmo com 29 dias')
})

// ── Coerência com o atraso ────────────────────────────────────────────────────

test('a adesão e o atraso concordam sobre o mesmo dado', async () => {
  // Se as duas discordassem, o painel diria "em dia" e "50%" ao mesmo tempo.
  const { atrasoDaRotina } = await import('./atrasoRotina')
  const r = rot()
  const todosFeitos = ciclosEsperados(r, AGOSTO, ctx()).ciclos.map((c) => `r1|${c.ciclo}`)

  const a = adesaoDaRotina(r, AGOSTO, ctx(todosFeitos))
  assert.equal(a.percentual, 100)
  assert.equal(atrasoDaRotina(r, ctx(todosFeitos)), null, 'cumpriu tudo e ainda assim consta atrasada')
})

// ── O relatório em A4 ─────────────────────────────────────────────────────────

test('o documento sai com as três seções, e a de decidir vem em branco', async () => {
  const { buildRotinasReportHtml } = await import('./rotinasReportExport')
  const html = buildRotinasReportHtml({
    adesao: adesaoNoPeriodo([rot({ responsavel: 'Valim' })], AGOSTO, ctx(['r1|2026-W32'])),
    periodo: AGOSTO, empresa: 'Compizzo', hoje: HOJE, demo: false,
  })
  assert.match(html, /Como cada um foi/)
  assert.match(html, /O que falhou/)
  assert.match(html, /Para decidir/)
  assert.match(html, /Valim/)
  assert.match(html, /@page\{size:A4/)
  assert.match(html, /counter\(page\)/, 'sem numeração de página')
})

test('período sem ciclo fechado gera o documento EXPLICANDO, não uma tabela vazia', async () => {
  const { buildRotinasReportHtml } = await import('./rotinasReportExport')
  const semana = periodoLivre('2026-08-10', '2026-08-16')
  const html = buildRotinasReportHtml({
    adesao: adesaoNoPeriodo([rot({ frequencia: 'mensal', responsavel: 'Ana' })], semana, ctx()),
    periodo: semana, empresa: 'Compizzo', hoje: HOJE, demo: false,
  })
  assert.match(html, /Nenhum ciclo fechado caiu inteiro neste período/)
  assert.ok(!html.includes('Como cada um foi'), 'não faz sentido mostrar placar vazio')
})

test('⚠️ em Demonstração o papel carrega a marca d\'água', async () => {
  const { buildRotinasReportHtml } = await import('./rotinasReportExport')
  const base = { adesao: adesaoNoPeriodo([rot()], AGOSTO, ctx()), periodo: AGOSTO, empresa: 'X', hoje: HOJE }
  assert.match(buildRotinasReportHtml({ ...base, demo: true }), /DEMONSTRAÇÃO/)
  assert.ok(!/DEMONSTRAÇÃO/.test(buildRotinasReportHtml({ ...base, demo: false })))
})

test('rotina sem dono é declarada no papel — sem nome, não há de quem cobrar', async () => {
  const { buildRotinasReportHtml } = await import('./rotinasReportExport')
  const html = buildRotinasReportHtml({
    adesao: adesaoNoPeriodo([rot({ responsavel: undefined })], AGOSTO, ctx()),
    periodo: AGOSTO, empresa: 'X', hoje: HOJE, demo: false,
  })
  assert.match(html, /sem responsável entram no total/)
})

test('nome com HTML é escapado — o documento não pode ser injetável', async () => {
  const { buildRotinasReportHtml } = await import('./rotinasReportExport')
  const html = buildRotinasReportHtml({
    adesao: adesaoNoPeriodo([rot({ responsavel: '<script>alert(1)</script>' })], AGOSTO, ctx()),
    periodo: AGOSTO, empresa: 'X', hoje: HOJE, demo: false,
  })
  assert.ok(!html.includes('<script>alert(1)</script>'))
})
