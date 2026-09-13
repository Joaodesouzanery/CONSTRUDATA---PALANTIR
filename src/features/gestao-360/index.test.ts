/**
 * A aba padrão da Gestão 360 (Dashboard de Obras) volta a rolar.
 *
 * ─── O QUE ESTAVA QUEBRADO ────────────────────────────────────────────────────
 * A raiz da página trava o scroll em `overflow-hidden` de propósito — cada aba é responsável por
 * decidir como o próprio conteúdo rola. As outras três abas (`gestao-a-vista`, `jobacosting` /
 * `daily-report` / `changeorders`) embrulham o conteúdo em `flex-1 overflow-y-auto`. A aba
 * `dashboard` — que é a ABA PADRÃO (`activeTab: 'dashboard'` em `gestao360Store.ts`) — renderizava
 * `<Gestao360MapDashboard />` direto, sem esse wrapper: sem nenhuma rota de scroll disponível, quem
 * abria a tela não conseguia descer a página.
 *
 * Este teste é textual de propósito: `Gestao360Page` depende de vários stores com persist/auth/sync
 * para montar — o mesmo motivo que `rdoObraNoEvento.test.ts` usa a mesma técnica.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'

async function codigoDaPagina(): Promise<string> {
  return readFile(new URL('./index.tsx', import.meta.url), 'utf8')
}

test('a aba "dashboard" tem o mesmo wrapper de scroll que as outras abas', async () => {
  const s = await codigoDaPagina()
  const trechoDashboard = s.slice(s.indexOf("activeTab === 'dashboard'"), s.indexOf("activeTab === 'gestao-a-vista'"))
  assert.match(
    trechoDashboard,
    /overflow-y-auto/,
    'a aba dashboard perdeu o wrapper flex-1 overflow-y-auto — sem ele a página não rola (raiz travada em overflow-hidden)',
  )
})
