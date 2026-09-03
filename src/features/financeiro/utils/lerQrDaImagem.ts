/**
 * Achar o QR Code da NFC-e numa foto de celular — e só isso.
 *
 * ─── POR QUE UMA ESCADA DE TENTATIVAS, E NÃO UMA CHAMADA SÓ ───────────────────
 * A foto real não é a foto do manual: o cupom está torto, amassado, com sombra da
 * própria mão, e o QR da NFC-e é pequeno e fica no rodapé de um papel comprido.
 * Uma leitura única falha com frequência alta o suficiente para a pessoa desistir
 * da funcionalidade. Cada degrau abaixo resolve um caso que aconteceu de verdade,
 * e o custo é baixo — o jsQR leva poucos milissegundos nessas dimensões.
 *
 * ⚠️ **O QR é lido da imagem ORIGINAL, nunca da comprimida.** O
 * `compressImage(file, 1400, 0.82)` existe para o ARMAZENAMENTO, e a 1400px num
 * cupom inteiro os módulos do QR já podem não fechar. A ordem correta é: ler o QR
 * da original → comprimir → subir. Inverter isso quebra em silêncio, e o sintoma
 * ("às vezes não lê") não aponta para a causa.
 *
 * ⚠️ **Não usamos o `BarcodeDetector` nativo como atalho.** Ele existe só no
 * Chromium — Safari/iOS e Firefox não têm — e um ramo que só dispara em metade
 * dos aparelhos é um ramo que nunca é testado. Pior: duas implementações podem
 * divergir, e a divergência aparece no iPhone de alguém, em produção. Um caminho
 * só, igual para todo mundo.
 *
 * ⚠️ **O `jsqr` só entra por `import()` dinâmico.** Import estático no topo o
 * colocaria no chunk do Financeiro, e quem nunca fotografa nota pagaria por ele.
 * Há teste que varre o `src/` e falha se alguém "consertar" isso.
 */
import { chavesNoTexto } from './chaveNfe'

/** Cada degrau da escada, para a tela poder dizer o que funcionou. */
export interface LeituraQr {
  /** O conteúdo cru do QR — URL da SEFAZ ou payload `chave|versao|...`. */
  payload: string
  /** As chaves de 44 dígitos com DV válido encontradas nele. */
  chaves: string[]
  /** Qual degrau resolveu. Vai para o log da tela, não para o dado. */
  tentativa: string
}

/** O que cada degrau precisa fazer: devolver os pixels de uma variação da foto. */
interface Degrau {
  nome: string
  desenhar: (img: HTMLImageElement, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => void
}

const LADO_MAXIMO = 1600

function ajustar(canvas: HTMLCanvasElement, largura: number, altura: number) {
  canvas.width = Math.max(1, Math.round(largura))
  canvas.height = Math.max(1, Math.round(altura))
}

/**
 * A escada, do mais barato e mais provável para o mais caro.
 *
 * O degrau do "terço inferior em 2×" merece nota: na NFC-e o QR fica **sempre**
 * no rodapé, e numa foto do cupom inteiro ele ocupa poucos pixels. Recortar e
 * ampliar essa faixa é o que faz a diferença entre ler e não ler no caso comum.
 */
const DEGRAUS: Degrau[] = [
  {
    nome: 'tamanho natural',
    desenhar: (img, ctx, canvas) => {
      ajustar(canvas, img.naturalWidth, img.naturalHeight)
      ctx.drawImage(img, 0, 0)
    },
  },
  {
    nome: 'reduzida para 1600px',
    desenhar: (img, ctx, canvas) => {
      const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight))
      ajustar(canvas, img.naturalWidth * escala, img.naturalHeight * escala)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    },
  },
  {
    nome: 'terço inferior ampliado',
    desenhar: (img, ctx, canvas) => {
      const alturaFatia = Math.round(img.naturalHeight / 3)
      const topo = img.naturalHeight - alturaFatia
      ajustar(canvas, img.naturalWidth * 2, alturaFatia * 2)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, topo, img.naturalWidth, alturaFatia, 0, 0, canvas.width, canvas.height)
    },
  },
  {
    nome: 'metade inferior ampliada',
    desenhar: (img, ctx, canvas) => {
      const alturaFatia = Math.round(img.naturalHeight / 2)
      const topo = img.naturalHeight - alturaFatia
      ajustar(canvas, img.naturalWidth * 2, alturaFatia * 2)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, topo, img.naturalWidth, alturaFatia, 0, 0, canvas.width, canvas.height)
    },
  },
  ...[90, 180, 270].map((graus) => ({
    nome: `girada ${graus}°`,
    desenhar: (img: HTMLImageElement, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight))
      const l = img.naturalWidth * escala
      const a = img.naturalHeight * escala
      const deitada = graus === 90 || graus === 270
      ajustar(canvas, deitada ? a : l, deitada ? l : a)
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((graus * Math.PI) / 180)
      ctx.drawImage(img, -l / 2, -a / 2, l, a)
    },
  })),
]

/** Carrega o arquivo como `HTMLImageElement`, respeitando o ciclo do object URL. */
function carregarImagem(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    // ⚠️ HEIC do iPhone cai aqui em alguns navegadores. A mensagem precisa dizer o
    // que fazer, senão vira "não funciona" sem saída — em Ajustes › Câmera ›
    // Formatos, "Mais Compatível" grava JPEG.
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não consegui abrir esta imagem. Se a foto veio de iPhone, mude a câmera para “Mais Compatível” (Ajustes › Câmera › Formatos) e tente de novo.'))
    }
    img.src = url
  })
}

/**
 * Lê o QR da foto, percorrendo a escada até achar uma chave que feche o DV.
 *
 * Devolve `null` quando nenhum degrau achou — que é um resultado legítimo e
 * frequente, não um erro. A tela oferece digitar a chave à mão nesse caso.
 */
export async function lerQrDaImagem(file: Blob): Promise<LeituraQr | null> {
  const { default: jsQR } = await import('jsqr')
  const img = await carregarImagem(file)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Este navegador não permitiu processar a imagem.')

  /** Guardado para o caso de achar um QR que não tem chave nenhuma dentro. */
  let semChave: LeituraQr | null = null

  for (const degrau of DEGRAUS) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.imageSmoothingEnabled = true
    degrau.desenhar(img, ctx, canvas)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)

    for (const inversao of ['dontInvert', 'attemptBoth'] as const) {
      const achado = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: inversao })
      if (!achado?.data) continue
      const chaves = chavesNoTexto(achado.data)
      if (chaves.length) return { payload: achado.data, chaves, tentativa: degrau.nome }
      // Um QR que não é de nota fiscal (Pix, cardápio, wi-fi do restaurante).
      // Guardamos para poder dizer isso em vez de "não achei QR nenhum".
      semChave ??= { payload: achado.data, chaves: [], tentativa: degrau.nome }
    }
  }

  return semChave
}
