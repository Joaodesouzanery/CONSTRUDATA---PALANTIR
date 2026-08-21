/**
 * A fila de sincronização não pode morrer.
 *
 * O defeito que originou estes testes: `flushQueue` tirava da rodada, ANTES de qualquer
 * requisição, toda op com `retries >= 5` — e nada no projeto jamais reduzia `retries`. Faltas de
 * Mão de Obra e uma execução de Rotina ficaram presas para sempre, inclusive depois de o conserto
 * que as destravaria já estar no código e a migração já estar aplicada. O botão "Tentar novamente"
 * caía no mesmo filtro e voltava sem enviar nada.
 *
 * O que se garante aqui: classificação correta da falha, espera que cresce mas sempre termina, e
 * nenhum caminho que descarte a op por contagem de tentativas.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  classificarErroSync, esperaBackoff, FALHAS_ATE_AVISAR,
  type ClasseErroSync,
} from './storeSync'

// ── Classificação ─────────────────────────────────────────────────────────────

test('falha de rede é transitória — não pode condenar dado bom', () => {
  const casos: unknown[] = [
    new TypeError('Failed to fetch'),
    new Error('NetworkError when attempting to fetch resource'),
    new Error('Tempo esgotado ao sincronizar. Salvo no aparelho — vamos reenviar.'),
    { message: 'The operation was aborted' },
    { code: '503' },
    { code: '08006', message: 'connection failure' },
  ]
  for (const c of casos) {
    assert.equal(classificarErroSync(c), 'transitorio', `deveria ser transitório: ${JSON.stringify(c)}`)
  }
})

test('tabela ou coluna faltando = migração pendente, não erro do usuário', () => {
  // É exatamente o caso da execução de Rotina: enfileirada antes de a migração ser aplicada.
  assert.equal(classificarErroSync({ code: 'PGRST205', message: "Could not find the table 'public.rotinas'" }), 'aguardando-servidor')
  assert.equal(classificarErroSync({ code: 'PGRST204' }), 'aguardando-servidor')
  assert.equal(classificarErroSync({ code: '42P01' }), 'aguardando-servidor')
  assert.equal(classificarErroSync({ code: '42703' }), 'aguardando-servidor')
})

test('conflito de chave única e FK são auto-curáveis', () => {
  assert.equal(classificarErroSync({ code: '23505', message: 'duplicate key value violates unique constraint "ux_rotina_execucoes_ciclo"' }), 'auto-curavel')
  assert.equal(classificarErroSync({ code: '23503' }), 'auto-curavel')
})

test('permissão é bloqueante — é o único caso que pode chegar ao usuário', () => {
  assert.equal(classificarErroSync({ code: '42501', message: 'new row violates row-level security policy' }), 'bloqueante')
  assert.equal(classificarErroSync(new Error(
    'A exclusão em worker_absences não foi aceita pelo servidor: o registro continua lá.',
  )), 'bloqueante')
})

test('erro desconhecido cai em bloqueante, não em transitório', () => {
  // Escolha conservadora: o que eu não sei classificar merece ser visto por alguém, não repetido
  // a cada cinco segundos contra um servidor que já disse não.
  assert.equal(classificarErroSync(new Error('alguma coisa estranha')), 'bloqueante')
  assert.equal(classificarErroSync(null), 'bloqueante')
})

// ── Backoff ───────────────────────────────────────────────────────────────────

test('a espera cresce com as falhas', () => {
  // Com jitter de ±20% duas faixas vizinhas não se sobrepõem (0,8×3 > 1,2×1), então dá para
  // comparar sem tornar o teste instável.
  const p = (n: number) => esperaBackoff(n, 'bloqueante')
  assert.ok(p(1) < p(2), 'a 2ª tentativa espera mais que a 1ª')
  assert.ok(p(2) < p(3), 'a 3ª espera mais que a 2ª')
  assert.ok(p(4) < p(6), 'a 6ª espera mais que a 4ª')
})

test('a espera tem teto — e o transitório tem teto próprio, menor', () => {
  for (const falhas of [1, 5, 10, 100, 10_000]) {
    assert.ok(esperaBackoff(falhas, 'bloqueante') <= 1_800_000 * 1.2, 'teto geral de 30min')
    assert.ok(esperaBackoff(falhas, 'transitorio') <= 60_000 * 1.2, 'teto de 1min para rede ruim')
  }
  // Quem está sem sinal não pode esperar meia hora depois que a rede volta.
  assert.ok(esperaBackoff(50, 'transitorio') < esperaBackoff(50, 'bloqueante'))
})

test('a espera nunca é zero nem infinita — sempre existe uma próxima tentativa', () => {
  const classes: ClasseErroSync[] = ['transitorio', 'aguardando-servidor', 'auto-curavel', 'bloqueante']
  for (const classe of classes) {
    for (const falhas of [0, 1, 3, 7, 40]) {
      const ms = esperaBackoff(falhas, classe)
      assert.ok(Number.isFinite(ms) && ms > 0, `${classe}/${falhas} devolveu ${ms}`)
    }
  }
})

test('avisar o usuário leva mais de uma hora de tentativas', () => {
  // O combinado com o cliente: "o sistema tenta sozinho e só avisa no fim". Este teste é o que
  // impede alguém de baixar o limite sem perceber o que está mudando.
  let total = 0
  for (let i = 1; i <= FALHAS_ATE_AVISAR; i++) total += esperaBackoff(i, 'bloqueante') / 1.2
  assert.ok(total > 3_600_000, `só ${Math.round(total / 60000)}min antes de avisar — pouco demais`)
})
