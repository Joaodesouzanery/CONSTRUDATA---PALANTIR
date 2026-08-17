/**
 * encodar-video-landing.mjs — gera os arquivos do vídeo "A plataforma em operação".
 *
 * POR QUE ISTO EXISTE. Na primeira vez que o vídeo entrou, os parâmetros de encode ficaram
 * registrados só na mensagem do commit. Na segunda troca isso custou tempo: foi preciso ler o
 * histórico do git para descobrir com o que os arquivos tinham sido gerados. A receita agora
 * mora aqui.
 *
 * O QUE ELE PRODUZ, e por quê cada escolha:
 *  - Dois MP4 H.264 `yuv420p`. É o formato que toca em tudo, inclusive iOS antigo. Não geramos
 *    WebM/AV1: os dois arquivos já são enxutos, e um par extra pesaria mais no repositório do
 *    que economizaria em banda.
 *  - `+faststart` move o índice (`moov`) para antes dos dados. Sem isso o navegador precisa
 *    baixar o arquivo inteiro antes do primeiro quadro.
 *  - Sem faixa de áudio (`-an`): o material é mudo. Carregar uma faixa silenciosa seria peso
 *    morto, e a ausência de áudio é o que obriga o `<figcaption>` a descrever o vídeo em texto
 *    (WCAG 1.2.1).
 *  - CRF com teto de bitrate em vez de bitrate fixo: mantém qualidade constante nas partes
 *    difíceis e não desperdiça bytes nas fáceis (este material tem muito fundo escuro liso).
 *
 * NOME DOS ARQUIVOS — leia antes de trocar o corte. O `vercel.json` serve `/videos/` com
 * `max-age=604800`: sete dias de cache. Se você regravar por cima do mesmo nome, quem já
 * assistiu continua vendo o corte velho por uma semana e vai parecer que a troca não pegou.
 * **Trocou o corte, sobe o número da versão** aqui e em `VideoShowcase.tsx`.
 *
 * USO:
 *   node scripts/encodar-video-landing.mjs videos/source/<arquivo>.mp4
 *
 * O ffmpeg não é dependência do projeto (seriam ~80 MB em node_modules para uma tarefa que
 * roda duas vezes por ano). Instale onde preferir e aponte:
 *   mkdir /tmp/ff && cd /tmp/ff && npm i ffmpeg-static
 *   FFMPEG=/tmp/ff/node_modules/ffmpeg-static/ffmpeg node scripts/encodar-video-landing.mjs <master>
 */

import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

/** Sobe junto quando o corte muda — ver a nota sobre cache no cabeçalho. */
const VERSAO = 'v2'

/**
 * Segundo do vídeo usado como pôster.
 *
 * Escolha um quadro **parado**, com a animação já concluída. Este material tem títulos que
 * entram letra a letra e gráficos que se desenham: cair no meio de uma transição rende um
 * pôster com a frase cortada — foi o que aconteceu na primeira tentativa, em 121s
 * ("COM CONTEXTO DE", sem o resto). 119s é o painel executivo inteiro, que é também o que o
 * pôster deve prometer: o produto, não uma foto de canteiro.
 */
const SEGUNDO_DO_POSTER = 119

const SAIDAS = [
  { nome: `plataforma-1080-${VERSAO}.mp4`, largura: 1920, crf: 26, teto: '1000k', buffer: '2000k' },
  { nome: `plataforma-720-${VERSAO}.mp4`,  largura: 1280, crf: 27, teto: '450k',  buffer: '900k'  },
]

const ffmpeg = process.env.FFMPEG || 'ffmpeg'
const master = process.argv[2]

if (!master || !existsSync(master)) {
  console.error('✗ informe o master: node scripts/encodar-video-landing.mjs videos/source/<arquivo>.mp4')
  process.exit(1)
}
if (master.startsWith('public/')) {
  console.error('✗ o master não pode viver em public/ — tudo ali é copiado inteiro para o deploy.')
  console.error('  Mova para videos/source/, que o videos/.gitignore já ignora.')
  process.exit(1)
}

const mb = (caminho) => (statSync(caminho).size / 1024 / 1024).toFixed(1)
const rodar = (args) => execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] })

console.log(`master: ${master} (${mb(master)} MB)\n`)

for (const { nome, largura, crf, teto, buffer } of SAIDAS) {
  const destino = resolve('public/videos', nome)
  process.stdout.write(`→ ${nome} … `)
  rodar([
    '-y', '-i', master,
    '-an',                                   // sem áudio: o material é mudo
    '-vf', `scale=${largura}:-2`,            // -2 mantém a proporção em número par (exigência do H.264)
    '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0',
    '-preset', 'slow',                       // roda uma vez; vale o tempo extra por byte economizado
    '-crf', String(crf),
    '-maxrate', teto, '-bufsize', buffer,    // teto para não estourar em cenas de muito movimento
    '-pix_fmt', 'yuv420p',                   // compatibilidade máxima
    '-movflags', '+faststart',               // índice antes dos dados: toca sem baixar tudo
    destino,
  ])
  console.log(`${mb(destino)} MB`)
}

const poster = resolve('public/videos', `plataforma-poster-${VERSAO}.webp`)
process.stdout.write(`→ plataforma-poster-${VERSAO}.webp … `)
rodar([
  '-y', '-ss', String(SEGUNDO_DO_POSTER), '-i', master,
  '-frames:v', '1', '-vf', 'scale=1920:-2',
  '-c:v', 'libwebp', '-quality', '78',
  poster,
])
console.log(`${(statSync(poster).size / 1024).toFixed(0)} KB`)

console.log(`\nAgora atualize VideoShowcase.tsx: POSTER e FONTES apontam para "-${VERSAO}".`)
console.log('E confira o <figcaption> em LandingPage.tsx — ele descreve o vídeo para quem não pode vê-lo.')
