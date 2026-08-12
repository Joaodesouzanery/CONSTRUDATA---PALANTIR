/**
 * Injeta o HTML da landing (gerado por src/prerender.tsx) dentro de dist/index.html.
 * Roda depois do `vite build` + `vite build --ssr` (ver script "build" no package.json).
 *
 * Resultado: o servidor passa a entregar a landing escrita no HTML — Claude, prévias de link
 * e crawlers leem o conteúdo; o usuário vê o texto antes mesmo do JS carregar. O React hidrata
 * por cima (main.tsx usa hydrateRoot quando encontra conteúdo pré-renderizado).
 */
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const htmlPath = resolve(root, 'dist/index.html')
const ssrEntry = resolve(root, 'dist-ssr/prerender.js')

if (!existsSync(ssrEntry)) {
  console.error('[prerender] dist-ssr/prerender.js não encontrado — o build SSR rodou?')
  process.exit(1)
}

const { render } = await import(`file://${ssrEntry}`)
const appHtml = render()

if (!appHtml || appHtml.length < 1000) {
  console.error(`[prerender] HTML suspeito (${appHtml?.length ?? 0} chars) — abortando para não publicar página vazia.`)
  process.exit(1)
}

const html = readFileSync(htmlPath, 'utf8')
if (!html.includes('<div id="root"></div>')) {
  console.error('[prerender] marcador <div id="root"></div> não encontrado em dist/index.html.')
  process.exit(1)
}

/* O SPA fallback do Vercel manda toda rota desconhecida para um HTML. Se esse HTML fosse o
   index.html (agora com a landing dentro), abrir /app/... direto pintaria a LANDING por um
   instante antes do app assumir. Por isso guardamos a casca vazia em app.html e apontamos o
   fallback para ela (ver vercel.json); index.html fica só para a raiz, com a landing escrita. */
writeFileSync(resolve(root, 'dist/app.html'), html)

writeFileSync(
  htmlPath,
  html.replace('<div id="root"></div>', `<div id="root" data-prerendered="true">${appHtml}</div>`),
)

// O bundle SSR é só um artefato intermediário — não vai para o deploy.
rmSync(resolve(root, 'dist-ssr'), { recursive: true, force: true })

console.log(`[prerender] landing injetada em dist/index.html (${(appHtml.length / 1024).toFixed(0)} KB de HTML) · casca vazia em dist/app.html`)
