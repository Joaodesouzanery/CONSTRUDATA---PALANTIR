import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

test('adapter do navegador é somente leitura e isola o modo DEMO', () => {
  const hook = source('./useDadosProcessos.ts')
  assert.doesNotMatch(hook, /\.insert\s*\(/)
  assert.doesNotMatch(hook, /\.upsert\s*\(/)
  assert.doesNotMatch(hook, /\.update\s*\(/)
  assert.doesNotMatch(hook, /\.delete\s*\(/)
  assert.match(hook, /if \(isDemoMode\)/)
  assert.match(hook, /DEMO_PROCESSOS\.result/)
  assert.match(hook, /organization_id.*organizationId/)
})

test('UI registra as sete categorias e onboarding vazio', () => {
  const page = source('./ProcessosPage.tsx')
  for (const category of [
    'loops',
    'rework',
    'repeatedActivities',
    'forbiddenTransitions',
    'incompleteLifecycles',
    'ambiguousOrderings',
    'possibleConcurrency',
  ]) assert.match(page, new RegExp(`key: '${category}'`))
  assert.match(page, /Processos está pronto para receber dados/)
  assert.match(page, /Timeline do log original/)
})

test('Processos está na rota lazy, Sidebar e Minha Rotina', () => {
  const app = source('../../App.tsx')
  const sidebar = source('../../components/shared/Sidebar.tsx')
  const registry = source('../minha-rotina/moduleRegistry.ts')
  assert.match(app, /path="processos"/)
  assert.match(app, /lazy\(\(\) => import\('@\/features\/processos\/index'\)/)
  assert.match(sidebar, /to: '\/app\/processos'/)
  assert.match(registry, /path: '\/app\/processos'/)
})
