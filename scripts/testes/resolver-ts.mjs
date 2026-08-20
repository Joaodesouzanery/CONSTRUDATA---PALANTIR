/**
 * resolver-ts.mjs — deixa os testes de mesa importarem o código do app rodando em Node puro.
 *
 * ─── POR QUE ISTO EXISTE ──────────────────────────────────────────────────────────────────────
 * O Node 24 tira os tipos do TypeScript sozinho (`--experimental-strip-types`), mas não sabe nada
 * do que o Vite resolve: o alias `@/`, imports sem extensão, `?url`/`?raw`, CSS, e o cliente do
 * Supabase que lê `import.meta.env`. Sem estes ganchos, importar qualquer módulo do `src/` quebra
 * na primeira linha.
 *
 * Os testes de `features/processos/` contornam isso lendo o arquivo como TEXTO e casando com
 * expressão regular. Funciona para verificar que uma chamada existe, mas não roda conta nenhuma —
 * e o que precisa de teste aqui é justamente a conta (o mapeamento de colunas, o cálculo de
 * atraso, a soma do contrato). Com este resolver, o teste importa a função de verdade e a executa.
 *
 * Uso: `node --import ./scripts/testes/resolver-ts.mjs --test 'src/**' + '/*.test.ts'`
 * (ver os scripts `test:*` do package.json).
 */
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'

/** Raiz do `src/`, deduzida deste arquivo — nada de caminho absoluto de máquina. */
const RAIZ = resolvePath(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src')

registerHooks({
  resolve(spec, ctx, next) {
    // Sufixos do Vite (?url, ?raw, ?worker), folhas de estilo, imagens e pdfjs não existem em Node.
    if (
      /\?(url|raw|worker)\b/.test(spec)
      || /\.(css|svg|png|jpg|jpeg|woff2?)$/.test(spec)
      || spec.startsWith('pdfjs-dist')
    ) {
      return { url: 'stub-vite:' + encodeURIComponent(spec), shortCircuit: true }
    }

    let alvo = null
    if (spec.startsWith('@/')) alvo = resolvePath(RAIZ, spec.slice(2))
    else if (spec.startsWith('.') && ctx.parentURL?.startsWith('file:')) {
      alvo = resolvePath(dirname(fileURLToPath(ctx.parentURL)), spec)
    }
    if (alvo) {
      for (const t of [alvo, `${alvo}.ts`, `${alvo}.tsx`, `${alvo}/index.ts`]) {
        if (existsSync(t) && !t.endsWith('/')) return { url: pathToFileURL(t).href, shortCircuit: true }
      }
    }
    return next(spec, ctx)
  },

  load(url, ctx, next) {
    if (url.startsWith('stub-vite:')) {
      const spec = decodeURIComponent(url.slice('stub-vite:'.length))
      const corpo = spec.startsWith('pdfjs-dist')
        ? 'export const GlobalWorkerOptions = {}\nexport function getDocument() { throw new Error("pdfjs indisponivel no teste") }\nexport default {}'
        : 'export default ""'
      return { format: 'module', shortCircuit: true, source: corpo }
    }

    // O cliente Supabase lê `import.meta.env`, que não existe em Node puro. O dublê explode se
    // alguém tentar usá-lo — um teste de mesa que chega na rede está errado por definição.
    if (url.endsWith('/src/lib/supabase.ts')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: `
          export const supabase = new Proxy({}, {
            get: () => () => { throw new Error('supabase nao esta disponivel no teste de mesa') },
          })
          export function getSessionUser() { return Promise.resolve(null) }
          export function authHeader() { return Promise.resolve({}) }
        `,
      }
    }
    return next(url, ctx)
  },
})

// ─── Ambiente mínimo de navegador ──────────────────────────────────────────────
// Os stores usam `zustand/persist` (que quer `window.localStorage`) e `storeSync` checa
// `navigator.onLine`. O Node 24 já tem um `navigator` global, mas SEM `onLine` — e `undefined` é
// falso, então sem isto todo `flush()` sairia achando que está offline e os testes de fila
// passariam por engano.
if (typeof globalThis.navigator === 'object' && globalThis.navigator && !('onLine' in globalThis.navigator)) {
  Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true })
}

if (!('window' in globalThis)) {
  const memoria = new Map()
  const localStorage = {
    getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
    setItem: (k, v) => void memoria.set(k, String(v)),
    removeItem: (k) => void memoria.delete(k),
    clear: () => void memoria.clear(),
  }
  globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} }
  globalThis.localStorage = localStorage
}
