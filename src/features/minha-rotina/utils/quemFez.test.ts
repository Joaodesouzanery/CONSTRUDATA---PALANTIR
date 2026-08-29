import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nomesConhecidos } from './quemFez'
import type { Rotina, RotinaExecucao } from '@/store/rotinasStore'

const rot = (p: Partial<Rotina>): Rotina => ({
  id: 'r1', titulo: 't', frequencia: 'diaria', ordem: 0, ativa: true, ...p,
} as Rotina)

const exec = (p: Partial<RotinaExecucao>): RotinaExecucao => ({
  id: Math.random().toString(36).slice(2), rotinaId: 'r1', periodo: '2026-08-20',
  feita: true, marcadaEm: '2026-08-20T10:00:00Z', ...p,
})

test('junta responsáveis das rotinas e quem de fato marcou', () => {
  const n = nomesConhecidos([rot({ responsavel: 'Eduardo' })], [exec({ quemFez: 'Valim' })])
  assert.deepEqual([...n].sort(), ['Eduardo', 'Valim'])
})

test('deduplica ignorando caixa e espaço, mostrando a grafia mais recente', () => {
  const n = nomesConhecidos([rot({ responsavel: 'VALIM' })], [
    exec({ quemFez: ' valim ', marcadaEm: '2026-08-20T10:00:00Z' }),
  ])
  assert.equal(n.length, 1)
  assert.equal(n[0], 'valim', 'a grafia usada por último é a que a pessoa reconhece')
})

test('quem marcou por último vem primeiro — é o palpite mais provável', () => {
  const n = nomesConhecidos([], [
    exec({ quemFez: 'Antigo', marcadaEm: '2026-08-01T08:00:00Z' }),
    exec({ quemFez: 'Recente', marcadaEm: '2026-08-20T08:00:00Z' }),
  ])
  assert.deepEqual(n, ['Recente', 'Antigo'])
})

test('rotina inativa não empresta o responsável dela', () => {
  assert.deepEqual(nomesConhecidos([rot({ responsavel: 'Sumido', ativa: false })], []), [])
})

test('nome vazio ou só espaço nunca vira botão', () => {
  const n = nomesConhecidos([rot({ responsavel: '   ' })], [exec({ quemFez: '' })])
  assert.deepEqual(n, [])
})

test('respeita o limite', () => {
  const execs = Array.from({ length: 20 }, (_, i) =>
    exec({ quemFez: `P${i}`, marcadaEm: `2026-08-${String(i + 1).padStart(2, '0')}T08:00:00Z` }))
  assert.equal(nomesConhecidos([], execs, 5).length, 5)
})

// ── O store precisa levar e trazer o nome ─────────────────────────────────────

test('execucaoToRow manda `quem_fez` — senão a coluna nasce sempre nula', async () => {
  const { readFile } = await import('node:fs/promises')
  const store = await readFile(new URL('../../../store/rotinasStore.ts', import.meta.url), 'utf8')
  assert.match(store, /quem_fez:\s*e\.quemFez/, 'o mapeamento de ida sumiu')
})

test('o pull lê `quem_fez` de volta — senão o nome some no primeiro sync', async () => {
  // O defeito mais insidioso do local-first: funciona no aparelho de quem marcou, e o colega
  // nunca vê. Sem erro, sem aviso.
  const { readFile } = await import('node:fs/promises')
  const store = await readFile(new URL('../../../store/rotinasStore.ts', import.meta.url), 'utf8')
  assert.match(store, /quemFez:\s*\(e\.quem_fez/, 'o mapeamento de volta sumiu')
})

test('`ultimoQuemFez` mora no store persistido e é zerado ao trocar de empresa', async () => {
  // Fora do partialize, o nome escaparia do snapshot da Demonstração e sobreviveria para a
  // operação real. E sem zerar no tenant, o nome de um cliente pré-preencheria a tela do outro.
  const { readFile } = await import('node:fs/promises')
  const store = await readFile(new URL('../../../store/rotinasStore.ts', import.meta.url), 'utf8')
  const partialize = store.slice(store.indexOf('partialize'), store.indexOf('partialize') + 600)
  assert.match(partialize, /ultimoQuemFez/, 'ficaria fora do snapshot do Modo Demonstração')

  // Recorta até o fecho da função, e não por número de caracteres: o comentário ali é longo, e uma
  // janela fixa passaria a falhar só porque alguém explicou melhor a decisão.
  const inicio = store.indexOf('ensureTenantScope: (organizationId)')
  const tenant = store.slice(inicio, store.indexOf('\n      },', inicio))
  assert.match(tenant, /ultimoQuemFez:\s*null/, 'o nome de um cliente vazaria para o outro')
})

test('desmarcar limpa o nome — "quem fez" o que não foi feito é contradição', async () => {
  const { readFile } = await import('node:fs/promises')
  const store = await readFile(new URL('../../../store/rotinasStore.ts', import.meta.url), 'utf8')
  assert.match(store, /quemFez:\s*feita \? dados\?\.quemFez : undefined/)
})
