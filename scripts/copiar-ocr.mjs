/**
 * Copia os arquivos do tesseract.js para `public/ocr/`, para serem servidos do
 * próprio domínio.
 *
 * ─── POR QUE ISTO PRECISA EXISTIR ─────────────────────────────────────────────
 * Por padrão o tesseract.js busca o worker, o núcleo WebAssembly e o arquivo de
 * idioma num CDN. A CSP deste projeto (`vercel.json`) limita `connect-src` a
 * `'self'` e ao Supabase — então **o download seria bloqueado em produção**, e o
 * sintoma na tela é um erro genérico de "não consegui carregar o leitor".
 *
 * Um script em vez de binários commitados: assim os arquivos servidos nunca
 * divergem da versão instalada no `package.json`.
 *
 * ⚠️ Duas edições no `vercel.json` acompanham este script, e sem elas ele não
 * adianta nada:
 *   1. `ocr/` no negative lookahead do rewrite de SPA — senão
 *      `/ocr/por.traineddata.gz` é reescrito para `/app.html` e o tesseract
 *      recebe HTML, reclamando de "arquivo corrompido";
 *   2. uma regra de cache `immutable` para `/ocr/` — senão o catch-all manda
 *      `no-store` e os ~4,8 MB são rebaixados a cada uso.
 *
 * Só o núcleo LSTM é copiado (`oem: 1`): ele é ~700 KB menor que o completo e é o
 * único que o motor moderno usa.
 */
import { cp, mkdir, readdir, stat } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const RAIZ = path.resolve(import.meta.dirname, '..')
const DESTINO = path.join(RAIZ, 'public', 'ocr')

/** O idioma. `por` no conjunto `fast` tem ~1,0 MB — menos que o inglês, curiosamente. */
const IDIOMA = 'por'
const URL_IDIOMA = `https://raw.githubusercontent.com/naptha/tessdata/gh-pages/4.0.0_fast/${IDIOMA}.traineddata.gz`

const ARQUIVOS = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // O navegador escolhe entre os dois conforme suportar SIMD.
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
]

const mb = (n) => (n / 1048576).toFixed(2) + ' MB'

async function baixarIdioma(destino) {
  if (existsSync(destino)) {
    console.log(`  · ${IDIOMA}.traineddata.gz já está lá (${mb((await stat(destino)).size)})`)
    return
  }
  const resposta = await fetch(URL_IDIOMA)
  if (!resposta.ok) throw new Error(`Não consegui baixar o idioma: HTTP ${resposta.status}`)
  await pipeline(resposta.body, createWriteStream(destino))
  console.log(`  · ${IDIOMA}.traineddata.gz baixado (${mb((await stat(destino)).size)})`)
}

async function main() {
  await mkdir(DESTINO, { recursive: true })
  console.log('Preparando o leitor de cupom em public/ocr/')

  for (const [origem, nome] of ARQUIVOS) {
    const de = path.join(RAIZ, 'node_modules', origem)
    if (!existsSync(de)) throw new Error(`Faltando ${origem} — rode "npm install".`)
    const para = path.join(DESTINO, nome)
    await cp(de, para)
    console.log(`  · ${nome} (${mb((await stat(para)).size)})`)
  }

  await baixarIdioma(path.join(DESTINO, `${IDIOMA}.traineddata.gz`))

  let total = 0
  for (const nome of await readdir(DESTINO)) {
    total += (await stat(path.join(DESTINO, nome))).size
  }
  console.log(`Pronto. ${mb(total)} em disco; o navegador baixa ~4,8 MB na primeira leitura e cacheia.`)
}

main().catch((e) => { console.error('FALHOU:', e.message); process.exit(1) })
