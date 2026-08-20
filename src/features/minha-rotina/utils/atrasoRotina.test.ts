/**
 * "Fulano não fez X, atrasada há N dias."
 *
 * As bordas que decidem se o aviso é útil ou vira paisagem: o fim de semana numa rotina diária, a
 * rotina cadastrada ontem, o ciclo corrente que ainda não venceu, e o buraco antigo que não deve
 * ser somado quando o último ciclo foi feito.
 *
 * Calendário de referência:
 *   2026-08-17 seg · 18 ter · 19 qua · 20 qui · 21 sex · 22 sáb · 23 dom · 24 seg
 *   Semanas ISO: 17 a 23/08 = 2026-W34 · 10 a 16/08 = 2026-W33 · 03 a 09/08 = 2026-W32
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { atrasoDaRotina, frasePendencia, iniciaisDe, corDaPessoa } from './atrasoRotina'
import type { Rotina } from '@/store/rotinasStore'
import type { FrequenciaRotina } from './cicloRotina'

const rotina = (p: Partial<Rotina> = {}): Rotina => ({
  id: 'r1', titulo: 'Conferir estoque', frequencia: 'semanal', ordem: 10, ativa: true,
  responsavel: 'Valim', criadaEm: '2025-01-01T00:00:00Z', ...p,
})

const ctx = (feitas: string[] = [], extra: Partial<Parameters<typeof atrasoDaRotina>[1]> = {}) => ({
  feitas: new Set(feitas),
  feriados: new Set<string>(),
  jornada: 'mon_fri' as const,
  hoje: '2026-08-20',
  ...extra,
})

// ─── O básico ──────────────────────────────────────────────────────────────────

test('o ciclo CORRENTE não conta como atraso — ainda dá tempo', () => {
  // Nada foi feito nunca, mas a semana corrente (W34) não venceu. O atraso começa em W33.
  const a = atrasoDaRotina(rotina({ criadaEm: '2026-08-10T00:00:00Z' }), ctx())
  assert.equal(a?.cicloEmAberto, '2026-W33')
  assert.equal(a?.ciclosSeguidos, 1)
})

test('ciclo fechado feito zera o atraso', () => {
  const a = atrasoDaRotina(rotina(), ctx(['r1|2026-W33']))
  assert.equal(a, null, 'a semana passada foi feita — está em dia')
})

test('buraco antigo NÃO é somado quando o último ciclo fechado foi feito', () => {
  // W33 feita, W32 e W31 não. A sequência aberta para em W33 → nenhum atraso.
  const a = atrasoDaRotina(rotina(), ctx(['r1|2026-W33']))
  assert.equal(a, null, 'um contador que só cresce vira paisagem')
})

test('ciclos seguidos em aberto são contados', () => {
  // Nada feito, rotina antiga: W33, W32, W31… A W30 foi feita, então para ali.
  const a = atrasoDaRotina(rotina(), ctx(['r1|2026-W30']))
  assert.equal(a?.ciclosSeguidos, 3, 'W33, W32 e W31')
  assert.equal(a?.cicloEmAberto, '2026-W31')
})

test('atrasada há N dias conta do fechamento do ciclo mais antigo até hoje', () => {
  // W33 fecha no domingo 16/08. Hoje é 20/08 → 4 dias.
  const a = atrasoDaRotina(rotina(), ctx(['r1|2026-W32']))
  assert.equal(a?.fechouEm, '2026-08-16')
  assert.equal(a?.diasDeAtraso, 4)
})

// ─── O piso da criação ─────────────────────────────────────────────────────────

test('rotina criada hoje não aparece atrasada', () => {
  const a = atrasoDaRotina(rotina({ criadaEm: '2026-08-20T09:00:00Z' }), ctx())
  assert.equal(a, null, 'não existia quando os ciclos anteriores fecharam')
})

test('rotina criada esta semana não cobra a semana passada', () => {
  const a = atrasoDaRotina(rotina({ criadaEm: '2026-08-18T00:00:00Z' }), ctx())
  assert.equal(a, null, 'a W33 começou em 10/08, antes de a rotina existir')
})

test('rotina criada no meio do ciclo anterior não cobra aquele ciclo', () => {
  // Criada 12/08, dentro da W33 (10 a 16). O ciclo começou antes dela existir.
  const a = atrasoDaRotina(rotina({ criadaEm: '2026-08-12T00:00:00Z' }), ctx())
  assert.equal(a, null)
})

test('sem criadaEm, a varredura para no teto e sinaliza', () => {
  const a = atrasoDaRotina(rotina({ criadaEm: undefined }), ctx([], { maxCiclos: 4 }))
  assert.equal(a?.ciclosSeguidos, 4)
  assert.equal(a?.truncado, true, 'melhor dizer "4+" do que inventar um número')
})

// ─── A rotina diária e o fim de semana ─────────────────────────────────────────

test('rotina diária na segunda-feira não conta o fim de semana', () => {
  // Hoje é segunda 24/08. O ciclo anterior cobrável é a sexta 21/08 — não o domingo 23.
  const a = atrasoDaRotina(
    rotina({ frequencia: 'diaria', criadaEm: '2026-01-01T00:00:00Z' }),
    ctx(['r1|2026-08-20'], { hoje: '2026-08-24' }),
  )
  assert.equal(a?.cicloEmAberto, '2026-08-21', 'a sexta é o ciclo em aberto')
  assert.equal(a?.ciclosSeguidos, 1, 'sábado e domingo não entram')
})

test('rotina diária: sábado entra quando a jornada é 6x1', () => {
  const a = atrasoDaRotina(
    rotina({ frequencia: 'diaria', criadaEm: '2026-01-01T00:00:00Z' }),
    ctx(['r1|2026-08-20'], { hoje: '2026-08-24', jornada: 'mon_sat' }),
  )
  assert.equal(a?.ciclosSeguidos, 2, 'sexta e sábado')
  assert.equal(a?.cicloEmAberto, '2026-08-21')
})

test('rotina diária: o feriado é pulado, não conta como atraso', () => {
  const diaria = rotina({ frequencia: 'diaria', criadaEm: '2026-01-01T00:00:00Z' })

  // Quarta (19) é feriado e terça (18) foi feita → não sobra ciclo em aberto. A quinta é hoje, e
  // hoje nunca conta.
  assert.equal(
    atrasoDaRotina(diaria, ctx(['r1|2026-08-18'], { feriados: new Set(['2026-08-19']) })),
    null,
    'o feriado não pode virar um dia de atraso',
  )

  // Sem o feriado, a mesma situação acusa a quarta.
  const semFeriado = atrasoDaRotina(diaria, ctx(['r1|2026-08-18']))
  assert.equal(semFeriado?.cicloEmAberto, '2026-08-19')
  assert.equal(semFeriado?.ciclosSeguidos, 1)

  // E com a terça TAMBÉM em aberto, o feriado do meio não engorda a contagem.
  const comBuraco = atrasoDaRotina(diaria, ctx(['r1|2026-08-17'], { feriados: new Set(['2026-08-19']) }))
  assert.equal(comBuraco?.ciclosSeguidos, 1, 'só a terça — a quarta é feriado e a quinta é hoje')
  assert.equal(comBuraco?.cicloEmAberto, '2026-08-18')
})

test('rotina inativa nunca aparece atrasada', () => {
  assert.equal(atrasoDaRotina(rotina({ ativa: false }), ctx()), null)
})

// ─── As outras frequências ─────────────────────────────────────────────────────

test('quinzenal e mensal usam as próprias etiquetas', () => {
  const q = atrasoDaRotina(
    rotina({ frequencia: 'quinzenal', criadaEm: '2025-01-01T00:00:00Z' }),
    ctx(['r1|2026-07-Q2']),
  )
  assert.equal(q?.cicloEmAberto, '2026-08-Q1', 'a 1ª quinzena de agosto fechou em 15/08')
  assert.equal(q?.fechouEm, '2026-08-15')

  const m = atrasoDaRotina(
    rotina({ frequencia: 'mensal', criadaEm: '2025-01-01T00:00:00Z' }),
    ctx(['r1|2026-06']),
  )
  assert.equal(m?.cicloEmAberto, '2026-07')
  assert.equal(m?.fechouEm, '2026-07-31')
})

// ─── A frase ───────────────────────────────────────────────────────────────────

test('a frase nomeia quem é o responsável', () => {
  const a = atrasoDaRotina(rotina(), ctx(['r1|2026-W32']))!
  const frase = frasePendencia(rotina(), a)
  assert.match(frase, /^Valim não fez/)
  assert.match(frase, /atrasada há 4 dias/)
  assert.match(frase, /semana de 10\/08 a 16\/08/)
})

test('sem responsável, a frase não inventa um nome', () => {
  const semDono = rotina({ responsavel: undefined })
  const a = atrasoDaRotina(semDono, ctx(['r1|2026-W32']))!
  assert.match(frasePendencia(semDono, a), /^não foi feita/)
})

test('ciclos seguidos aparecem na frase, no plural certo', () => {
  const a = atrasoDaRotina(rotina(), ctx(['r1|2026-W30']))!
  assert.match(frasePendencia(rotina(), a), /3 semanas seguidas/)

  const mensal = rotina({ frequencia: 'mensal' as FrequenciaRotina })
  const am = atrasoDaRotina(mensal, ctx(['r1|2026-05']))!
  assert.match(frasePendencia(mensal, am), /meses seguidos/)
})

// ─── O selo da pessoa ──────────────────────────────────────────────────────────

test('iniciais', () => {
  assert.equal(iniciaisDe('Valim'), 'VA')
  assert.equal(iniciaisDe('Tony do Vale'), 'TV', '"do" não vira inicial')
  assert.equal(iniciaisDe('Vinicius Souza'), 'VS')
  assert.equal(iniciaisDe(''), '?')
  assert.equal(iniciaisDe('   '), '?')
})

test('a mesma pessoa tem sempre a mesma cor, e nomes diferentes tendem a diferir', () => {
  assert.equal(corDaPessoa('Valim'), corDaPessoa('Valim'))
  const cores = new Set(['Valim', 'Vinicius', 'Eduardo', 'Wanderson', 'Tony'].map(corDaPessoa))
  assert.equal(cores.size >= 3, true, `esperava variedade, veio ${cores.size}`)
})
