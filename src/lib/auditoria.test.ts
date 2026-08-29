/**
 * A tradução do `audit_log` para a tela.
 *
 * O que estes testes cercam é o "o que mudou": é ele que decide se a linha do histórico diz
 * "Efetivo: 12 → 14" ou apenas "Payload mudou", que é o mesmo que não dizer nada.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  camposAlterados, valorLegivel, rotuloDoModulo, rotuloDoRegistro, rotuloDaAcao, corDaAcao,
  rotuloDoCampo, modulosConhecidos, humanizar,
} from './auditoria'

// ─── Rótulos ──────────────────────────────────────────────────────────────────

test('a tabela vira nome de módulo, não nome de tabela', () => {
  assert.equal(rotuloDoModulo('labor_occurrences'), 'Mão de Obra')
  assert.equal(rotuloDoRegistro('labor_occurrences'), 'ocorrência')
  assert.equal(rotuloDoModulo('rdo'), 'RDO')
})

test('tabela que ainda não está no mapa NÃO some da tela — vira nome humanizado', () => {
  // O gatilho entra por varredura: uma tabela criada depois desta versão já aparece no log antes
  // de alguém escrever o rótulo dela. Some seria pior do que feio.
  assert.equal(rotuloDoModulo('fcp_premissas'), 'Fcp premissas')
  assert.equal(rotuloDoRegistro('fcp_premissas'), 'fcp premissas')
})

test('as quatro ações do gatilho têm verbo em português', () => {
  assert.equal(rotuloDaAcao('insert'),  'Criou')
  assert.equal(rotuloDaAcao('update'),  'Editou')
  assert.equal(rotuloDaAcao('delete'),  'Excluiu')
  assert.equal(rotuloDaAcao('restore'), 'Restaurou')
})

test('as ações que as RPCs antigas já gravavam continuam legíveis', () => {
  // O log não nasceu vazio: aprovação, exportação e cadastro já escreviam nele. Se estas caíssem
  // no fallback, a tela nova ficaria pior do que a antiga para o histórico que já existe.
  for (const acao of ['request_action', 'approve_action', 'export', 'signup', 'worker_absent']) {
    assert.notEqual(rotuloDaAcao(acao), humanizar(acao), `${acao} caiu no fallback`)
  }
})

test('ação desconhecida não quebra: vira texto humanizado e cor de edição', () => {
  assert.equal(rotuloDaAcao('algo_novo_do_n8n'), 'Algo novo do n8n')
  assert.equal(corDaAcao('algo_novo_do_n8n'), 'editar')
})

test('excluir e restaurar não usam a mesma cor', () => {
  assert.equal(corDaAcao('delete'), 'excluir')
  assert.equal(corDaAcao('restore'), 'restaurar')
  assert.notEqual(corDaAcao('delete'), corDaAcao('restore'))
})

test('o filtro de módulo não repete nome e sabe todas as tabelas de cada um', () => {
  const modulos = modulosConhecidos()
  const nomes = modulos.map((m) => m.modulo)
  assert.equal(new Set(nomes).size, nomes.length, 'módulo repetido na lista do filtro')

  const maoDeObra = modulos.find((m) => m.modulo === 'Mão de Obra')!
  assert.ok(maoDeObra.tabelas.includes('workers'))
  assert.ok(maoDeObra.tabelas.includes('timecards'))
  assert.ok(maoDeObra.tabelas.length >= 8, 'Mão de Obra tem várias tabelas e todas têm de entrar')
})

// ─── O que mudou ──────────────────────────────────────────────────────────────

test('desce dentro do payload — senão toda edição diria só "Payload mudou"', () => {
  // É o caso mais comum do projeto: quase todo registro mora dentro de `payload jsonb`.
  const m = camposAlterados(
    { id: 'x', payload: { efetivo: 12, clima: 'bom' } },
    { id: 'x', payload: { efetivo: 14, clima: 'bom' } },
  )
  assert.equal(m.length, 1)
  assert.equal(m[0].campo, 'payload.efetivo')
  assert.equal(m[0].rotulo, 'Efetivo')
  assert.equal(m[0].antes, 12)
  assert.equal(m[0].depois, 14)
})

test('os carimbos técnicos NÃO entram como campo alterado', () => {
  // `updated_at` e `updated_by` mudam em toda edição, e o cabeçalho da linha já diz quem e quando.
  // Se entrassem, cada edição pareceria ter mexido em três coisas.
  const m = camposAlterados(
    { id: 'x', name: 'a', updated_at: '2026-08-01T00:00:00Z', updated_by: 'u1', created_by: 'u0' },
    { id: 'x', name: 'b', updated_at: '2026-08-29T00:00:00Z', updated_by: 'u2', created_by: 'u0' },
  )
  assert.deepEqual(m.map((x) => x.campo), ['name'])
})

test('insert mostra os campos que nasceram preenchidos, e nada mais', () => {
  const m = camposAlterados(null, { id: 'x', name: 'José', status: 'ativo', organization_id: 'o1' })
  assert.deepEqual(m.map((x) => x.campo).sort(), ['name', 'status'])
  assert.equal(m.find((x) => x.campo === 'name')!.antes, undefined)
})

test('delete mostra o que havia — o registro não vira uma linha vazia', () => {
  const m = camposAlterados({ id: 'x', name: 'José' }, null)
  assert.deepEqual(m.map((x) => x.campo), ['name'])
  assert.equal(m[0].antes, 'José')
  assert.equal(m[0].depois, undefined)
})

test('campo que não mudou não aparece, mesmo dentro do payload', () => {
  const m = camposAlterados(
    { payload: { a: 1, b: 2, c: [1, 2, 3] } },
    { payload: { a: 1, b: 9, c: [1, 2, 3] } },
  )
  assert.deepEqual(m.map((x) => x.campo), ['payload.b'])
})

test('null e ausente são a mesma coisa — não viram "mudança"', () => {
  // O gatilho serializa o registro inteiro; um campo opcional oscila entre ausente e null sem que
  // ninguém tenha editado nada. Contar isso encheria o histórico de ruído.
  assert.deepEqual(camposAlterados({ a: null }, {}), [])
  assert.deepEqual(camposAlterados({}, { a: null }), [])
})

test('array e objeto são comparados pelo conteúdo, não pela referência', () => {
  assert.deepEqual(camposAlterados({ p: [1, 2] }, { p: [1, 2] }), [])
  assert.equal(camposAlterados({ p: [1, 2] }, { p: [1, 3] }).length, 1)
})

test('payload que não é objeto não quebra a leitura', () => {
  // Defensivo: se um dia chegar payload nulo ou texto, a tela precisa mostrar alguma coisa em vez
  // de estourar no meio do histórico.
  assert.doesNotThrow(() => camposAlterados({ payload: null }, { payload: 'texto' }))
  assert.doesNotThrow(() => camposAlterados({ payload: [1, 2] }, { payload: [3] }))
})

test('os dois lados vazios não produzem mudança nenhuma', () => {
  assert.deepEqual(camposAlterados(null, null), [])
  assert.deepEqual(camposAlterados({}, {}), [])
})

// ─── Valores na tela ──────────────────────────────────────────────────────────

test('data ISO vira data brasileira; texto comum passa direto', () => {
  assert.equal(valorLegivel('2026-08-29'), '29/08/2026')
  assert.equal(valorLegivel('2026-08-29T14:30:00Z'), '29/08/2026')
  assert.equal(valorLegivel('AJUDANTE GERAL I'), 'AJUDANTE GERAL I')
})

test('vazio, nulo e ausente viram travessão — nunca "undefined" na tela', () => {
  for (const v of [null, undefined, '']) assert.equal(valorLegivel(v), '—')
})

test('booleano vira sim/não, não true/false', () => {
  assert.equal(valorLegivel(true), 'sim')
  assert.equal(valorLegivel(false), 'não')
})

test('zero e false não viram travessão', () => {
  // O erro clássico do `||`: 0 é um valor, não uma ausência. Numa tela de auditoria financeira,
  // trocar "0" por "—" muda o que a pessoa entende.
  assert.equal(valorLegivel(0), '0')
  assert.equal(valorLegivel(false), 'não')
})

test('objeto não vira [object Object]; texto enorme é cortado', () => {
  assert.ok(!valorLegivel({ a: 1 }).includes('[object'))
  assert.ok(valorLegivel('x'.repeat(500)).length <= 120)
  assert.ok(valorLegivel('x'.repeat(500)).endsWith('…'))
})

test('lista vira a contagem, porque a lista inteira não cabe na linha', () => {
  assert.equal(valorLegivel([1, 2, 3]), '3 item(ns)')
  assert.equal(valorLegivel([]), '—')
})

test('o rótulo do campo tira o prefixo payload', () => {
  assert.equal(rotuloDoCampo('payload.valor'), 'Valor')
  assert.equal(rotuloDoCampo('payload.algum_campo_novo'), 'Algum campo novo')
})
