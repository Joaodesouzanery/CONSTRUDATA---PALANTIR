/**
 * A trava do carregamento sob demanda.
 *
 * ─── POR QUE ESTE TESTE EXISTE ────────────────────────────────────────────────
 * O `jsqr` e o `tesseract.js` só valem a pena porque **não são baixados** por quem
 * nunca fotografa uma nota. Isso depende inteiramente de eles entrarem por
 * `import()` dinâmico: um `import jsQR from 'jsqr'` no topo de qualquer arquivo
 * alcançável pelo módulo Financeiro os traz para o chunk principal da rota, e o
 * app fica mais pesado para todo mundo — sem erro nenhum, sem aviso nenhum.
 *
 * É o tipo de regressão que uma revisão de código não pega (a linha parece certa)
 * e que só apareceria num gráfico de tamanho de bundle que ninguém olha. Daí o
 * teste, no molde do `cascataDemo.test.ts`: ele lê o código-fonte.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readdir, readFile } from 'node:fs/promises'

const raiz = new URL('../../../../', import.meta.url)

/** Os pacotes que só podem aparecer dentro de `await import(...)`. */
const SOB_DEMANDA = ['jsqr', 'tesseract.js']

async function arquivosDeCodigo(dir: URL): Promise<URL[]> {
  const saida: URL[] = []
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    const alvo = new URL(entrada.name + (entrada.isDirectory() ? '/' : ''), dir)
    if (entrada.isDirectory()) saida.push(...(await arquivosDeCodigo(alvo)))
    else if (/\.tsx?$/.test(entrada.name)) saida.push(alvo)
  }
  return saida
}

test('jsqr e tesseract.js nunca entram por import estático', async () => {
  const arquivos = await arquivosDeCodigo(new URL('src/', raiz))
  const infratores: string[] = []

  for (const arquivo of arquivos) {
    const codigo = await readFile(arquivo, 'utf8')
    for (const pacote of SOB_DEMANDA) {
      // `import ... from 'pacote'` ou `require('pacote')` — mas NÃO `import('pacote')`.
      const estatico = new RegExp(
        `(?:^|\\n)\\s*import[^\\n]*from\\s*['"]${pacote}['"]|require\\(\\s*['"]${pacote}['"]`,
      )
      if (estatico.test(codigo)) {
        infratores.push(`${arquivo.pathname.split('/src/')[1]} → ${pacote}`)
      }
    }
  }

  assert.deepEqual(
    infratores,
    [],
    'estes arquivos trariam o pacote para o chunk da rota; use `await import(...)` dentro da função',
  )
})

test('o leitor de QR de fato usa import dinâmico', async () => {
  const codigo = await readFile(new URL('src/features/financeiro/utils/lerQrDaImagem.ts', raiz), 'utf8')
  assert.match(codigo, /await import\('jsqr'\)/, 'o carregamento sob demanda sumiu do leitor de QR')
})
