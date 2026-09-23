/**
 * O pedido de correção de ponto — e a razão de ele NÃO morar em `ponto_registros`.
 *
 * ⚠️ O teste central deste arquivo é o primeiro: um pedido pendente não pode mudar uma jornada.
 * Nem `jornadasDoPeriodo` nem `jornadaAberta` filtram por `origem` — as duas montam a jornada **por
 * paridade** sobre todos os registros do trabalhador. Se o pedido fosse uma linha daquela tabela,
 * ele viraria mais uma marcação na cadeia e mudaria o intervalo, os minutos trabalhados e **o banco
 * de horas, antes de qualquer gestor aprovar**. Sem nenhum erro na tela.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import {
  montarSolicitacao, solicitacaoParaRow, podeSolicitar, MOTIVO_MINIMO,
  TEXTO_SEM_PEDIR, TEXTO_DA_ACAO, TEXTO_DA_SITUACAO,
  type SolicitacaoDePonto,
} from './solicitacao'
import { jornadasDoPeriodo } from './jornada'
import type { RegistroDePonto } from '@/types'

const batida = (over: Partial<RegistroDePonto>): RegistroDePonto => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  workerId: 'w-1', authUserId: 'u-1', siteId: null,
  tipo: 'entrada', data: '2026-09-15',
  momentoDispositivo: '2026-09-15T07:00:00.000Z',
  origem: 'app',
  ...over,
} as RegistroDePonto)

const pedido = (over: Partial<SolicitacaoDePonto> = {}): SolicitacaoDePonto => ({
  ...montarSolicitacao(
    {
      workerId: 'w-1', authUserId: 'u-1', data: '2026-09-15',
      acao: 'incluir', tipo: 'saida', horaPedida: '17:00', motivo: 'esqueci de bater a saída',
    },
    { id: 'p-1', agora: '2026-09-16T10:00:00.000Z' },
  ),
  ...over,
})

// ─── 🔴 O pedido não é uma batida ─────────────────────────────────────────────

test('🔴 um pedido pendente NÃO muda a jornada — é por isso que ele tem tabela própria', async () => {
  // Uma jornada normal de 4 batidas: 07:00 → 12:00, 13:00 → 17:00 = 9h de trabalho.
  const batidas = [
    batida({ id: 'b1', tipo: 'entrada',          momentoDispositivo: '2026-09-15T07:00:00.000Z' }),
    batida({ id: 'b2', tipo: 'inicio_intervalo', momentoDispositivo: '2026-09-15T12:00:00.000Z' }),
    batida({ id: 'b3', tipo: 'fim_intervalo',    momentoDispositivo: '2026-09-15T13:00:00.000Z' }),
    batida({ id: 'b4', tipo: 'saida',            momentoDispositivo: '2026-09-15T17:00:00.000Z' }),
  ]
  const antes = jornadasDoPeriodo(batidas, '2026-09-01', '2026-09-30')
  assert.equal(antes.length, 1)
  assert.equal(antes[0].minutosTrabalhados, 9 * 60)

  // O pedido existe, e o motor de jornada não o conhece — ele nem é do mesmo tipo.
  const p = pedido()
  assert.equal(p.situacao, 'pendente')
  const depois = jornadasDoPeriodo(batidas, '2026-09-01', '2026-09-30')
  assert.deepEqual(
    depois.map((j) => [j.data, j.minutosTrabalhados, j.intervaloMin, j.pendencias.length]),
    antes.map((j) => [j.data, j.minutosTrabalhados, j.intervaloMin, j.pendencias.length]),
    'o pedido não entra em `RegistroDePonto[]` — se um dia alguém o enfiar ali, esta conta muda '
    + 'e o banco de horas da pessoa muda junto, sem aprovação nenhuma',
  )
})

test('🔴 a linha gravada NÃO tem a forma de uma batida', () => {
  const row = solicitacaoParaRow(pedido(), 'org-1', 'u-1')
  // ⚠️ Nenhum destes existe aqui: são as colunas que o gatilho de NSR e o motor de jornada usam.
  for (const proibida of ['momento_dispositivo', 'nsr', 'origem', 'site_id']) {
    assert.ok(!(proibida in row), `${proibida} é de ponto_registros — um pedido não tem isso`)
  }
  assert.equal(row.situacao, 'pendente')
  assert.equal(row.ajuste_id, null)
})

test('🔴 a linha carrega `created_by` — sem ela a fila retenta para sempre em silêncio', () => {
  const row = solicitacaoParaRow(pedido(), 'org-1', 'u-99')
  assert.equal(row.created_by, 'u-99',
    'o fixOrg do storeSync injeta esta coluna em toda op; sem ela o servidor devolve PGRST204, '
    + 'que a fila classifica como "aguardando servidor" — retry infinito, sem nada na tela')
  assert.equal(row.deleted_at, null, 'pullTable filtra por deleted_at por padrão')
})

test('🔴 a identidade do pedido é a CONTA logada, não o cadastro', () => {
  const row = solicitacaoParaRow(pedido(), 'org-1', 'u-1')
  assert.equal(row.auth_user_id, 'u-1')
  assert.equal(row.worker_id, 'w-1')
  // As duas amarras juntas: `ponto_sol_insert` exige a conta E que o cadastro seja dela. Sem a
  // segunda, o pedido sairia com a conta certa e o FUNCIONÁRIO errado.
})

// ─── As regras do pedido ──────────────────────────────────────────────────────

test('motivo curto não passa', () => {
  assert.equal(
    podeSolicitar({ data: '2026-09-15', tipo: 'saida', motivo: 'esqueci' }, [], '2026-09-20'),
    'motivo-curto',
  )
  assert.ok('esqueci'.length < MOTIVO_MINIMO)
  assert.equal(
    podeSolicitar({ data: '2026-09-15', tipo: 'saida', motivo: 'esqueci de bater' }, [], '2026-09-20'),
    null,
  )
})

test('🔴 a janela é o mês atual e o anterior — depois disso a folha já fechou', () => {
  const ok = (d: string) => podeSolicitar({ data: d, tipo: 'saida', motivo: 'terminei mais tarde' }, [], '2026-09-20')
  assert.equal(ok('2026-09-15'), null, 'mês atual')
  assert.equal(ok('2026-08-31'), null, 'mês anterior')
  assert.equal(ok('2026-07-31'), 'fora-da-janela', 'dois meses atrás: a folha já fechou')
  assert.equal(ok('2026-09-25'), 'fora-da-janela', 'o futuro ainda não aconteceu')
})

test('🔴 pedido repetido para o mesmo dia e a mesma marcação é barrado', () => {
  const jaFeito = [pedido()]
  assert.equal(
    podeSolicitar({ data: '2026-09-15', tipo: 'saida', motivo: 'esqueci de bater a saída' }, jaFeito, '2026-09-20'),
    'duplicado',
    'o botão fica num celular: sem isto, três toques viram três pedidos idênticos na fila do gestor',
  )
  // Outra marcação do mesmo dia pode.
  assert.equal(
    podeSolicitar({ data: '2026-09-15', tipo: 'entrada', motivo: 'cheguei antes e esqueci' }, jaFeito, '2026-09-20'),
    null,
  )
  // E um pedido já respondido não bloqueia um novo.
  assert.equal(
    podeSolicitar({ data: '2026-09-15', tipo: 'saida', motivo: 'o horário aprovado saiu errado' },
      [pedido({ situacao: 'recusada' })], '2026-09-20'),
    null,
  )
})

test('todo texto de apoio existe em português', () => {
  for (const v of [...Object.values(TEXTO_SEM_PEDIR), ...Object.values(TEXTO_DA_ACAO), ...Object.values(TEXTO_DA_SITUACAO)]) {
    assert.ok(v.trim().length > 3, `texto vazio ou curto demais: "${v}"`)
  }
})

// ─── 🔴 O que o SQL precisa garantir ──────────────────────────────────────────

test('🔴 a migração tem as travas que a tabela exige', async () => {
  const sql = await readFile(
    new URL('../../../supabase/migrations/20260923130000_ponto_solicitacoes.sql', import.meta.url), 'utf8')

  assert.match(sql, /created_by\s+uuid not null/, 'contrato implícito do fixOrg')
  assert.match(sql, /deleted_at\s+timestamptz/, 'pullTable filtra por ela')

  // As duas amarras do insert, iguais às de `ponto_insert`.
  assert.match(sql, /auth_user_id = auth\.uid\(\)/)
  assert.match(sql, /w\.payload->>'authUserId' = auth\.uid\(\)::text/,
    'sem esta, o pedido sai com a conta certa e o funcionário errado')

  // ⚠️ A policy de UPDATE do autor existe só para o reenvio da fila (upsert). O gatilho é o que a
  // impede de virar uma porta para o funcionário aprovar o próprio pedido.
  assert.match(sql, /ponto_sol_update_autor/)
  assert.match(sql, /function public\.ponto_sol_congelar/)
  assert.match(sql, /new\.situacao := old\.situacao/,
    'sem congelar `situacao` para não-gestor, o reenvio do próprio pedido poderia aprová-lo')

  assert.match(sql, /for delete to authenticated using \(false\)/, 'pedido não se apaga')

  // ⚠️ A varredura de 20260918160000 é um retrato: tabela criada depois nasce LIBERADA.
  assert.match(sql, /colaborador_so_o_proprio_pedido/,
    'sem esta restritiva, o colaborador leria os pedidos de toda a empresa')
  assert.match(sql, /not public\.e_colaborador\(\) or auth_user_id = auth\.uid\(\)/)
})

test('🔴 o espelho do gestor NÃO enxerga pedido como batida', async () => {
  const semComentario = (t: string) => t
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

  const jornada = semComentario(await readFile(new URL('./jornada.ts', import.meta.url), 'utf8'))
  assert.doesNotMatch(jornada, /solicitac/i,
    'o motor de jornada não conhece pedido, e é essa ignorância que o mantém correto')

  const store = semComentario(await readFile(new URL('../../store/pontoStore.ts', import.meta.url), 'utf8'))
  // As duas coleções são separadas no store, e o `pull` de uma não mistura com a outra.
  assert.match(store, /mergePull\(pedidos, s\.solicitacoes, s\.pendingSync, 'ponto_solicitacoes'\)/)
  assert.match(store, /mergePull\(doServidor, s\.registros, s\.pendingSync, 'ponto_registros'\)/)
})
