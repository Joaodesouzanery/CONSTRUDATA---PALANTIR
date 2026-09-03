/**
 * A camada impura do OCR: prepara a imagem, chama o tesseract, devolve linhas.
 *
 * Toda a decisão de "qual número é o total" mora no `notaFiscalCupom.ts`, que é
 * puro e testado. Aqui só existe o que precisa de navegador.
 *
 * ─── AS TRÊS COISAS QUE FAZEM ISTO FUNCIONAR ──────────────────────────────────
 *
 * 1. **Auto-hospedagem, obrigatória.** O tesseract.js busca worker, núcleo e
 *    idioma num CDN por padrão, e a CSP deste projeto limita `connect-src` a
 *    `'self'` + Supabase — o download seria bloqueado em produção. Os arquivos
 *    vêm de `/ocr/`, colocados lá por `scripts/copiar-ocr.mjs` no `prebuild`.
 *
 * 2. **Carregamento sob demanda, de verdade.** `await import('tesseract.js')`
 *    dentro da função, e a função só é chamada por um botão explícito. Quem
 *    digita o valor à mão nunca baixa os ~4,8 MB. Há teste que varre o `src/` e
 *    falha se alguém trocar por import estático.
 *
 * 3. **Resolução maior que a do arquivo.** O `compressImage` reduz para 1400px
 *    porque é isso que serve para ARMAZENAR. Reconhecer texto a 1400px num cupom
 *    comprido destrói os dígitos pequenos — aqui a imagem vai a 2000px e passa
 *    por escala de cinza com contraste antes de entrar no motor.
 */
import {
  acharDataEmissao, acharItens, acharTributos, acharValorTotal, conferirSomaDosItens,
  type ItemLidoDoCupom, type ValorProposto,
} from './notaFiscalCupom'

export interface PropostaDaNota {
  valor: ValorProposto
  itens: ItemLidoDoCupom[]
  dataEmissao: string | null
  tributos: number | null
  /** As linhas cruas do OCR — para a tela poder mostrar o que a máquina viu. */
  linhas: string[]
}

/**
 * A interface do leitor.
 *
 * Ela existe desde já para que ligar um leitor no SERVIDOR depois (o repositório
 * já tem o molde em `api/parse-adaptacao-rapida.ts`) seja plugar uma
 * implementação, sem refazer a tela. O `dica.chave` está aqui desde o dia 1
 * porque um leitor que já sabe CNPJ e competência — conferidos pelo dígito
 * verificador — extrai muito melhor.
 */
export interface LeitorDeCupom {
  nome: string
  disponivel: () => Promise<boolean>
  ler: (imagem: Blob, dica?: { cnpj?: string; competencia?: string }) => Promise<PropostaDaNota>
}

const LADO_PARA_OCR = 2000

/**
 * Cinza + contraste. Papel térmico tem contraste baixo e fundo acinzentado; sem
 * este passo o motor gasta esforço decidindo o que é papel e o que é tinta.
 */
async function prepararImagem(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('Não consegui abrir esta imagem.'))
      i.src = url
    })
    const escala = Math.min(1, LADO_PARA_OCR / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * escala)
    canvas.height = Math.round(img.naturalHeight * escala)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Este navegador não permitiu processar a imagem.')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const dados = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const px = dados.data
    for (let i = 0; i < px.length; i += 4) {
      const cinza = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114
      // Contraste em torno do meio: empurra o papel para o branco e a tinta para o preto.
      const forte = Math.max(0, Math.min(255, (cinza - 128) * 1.6 + 128))
      px[i] = px[i + 1] = px[i + 2] = forte
    }
    ctx.putImageData(dados, 0, 0)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** `true` quando os arquivos de `/ocr/` estão no ar. */
export async function ocrDisponivel(): Promise<boolean> {
  try {
    const r = await fetch('/ocr/worker.min.js', { method: 'HEAD' })
    // ⚠️ Um 200 que devolve HTML é o sintoma do rewrite de SPA engolindo `/ocr/`.
    // Conferir o tipo evita o erro genérico de "arquivo corrompido" lá na frente.
    return r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')
  } catch {
    return false
  }
}

export const leitorLocal: LeitorDeCupom = {
  nome: 'leitor no aparelho',
  disponivel: ocrDisponivel,

  async ler(imagem) {
    const { createWorker } = await import('tesseract.js')
    const canvas = await prepararImagem(imagem)

    const worker = await createWorker('por', 1, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/',
      langPath: '/ocr/',
    })
    try {
      // Sem o DPI declarado o tesseract avisa e degrada em entrada de canvas.
      await worker.setParameters({ user_defined_dpi: '300' })
      const { data } = await worker.recognize(canvas)
      const linhas = (data.text ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

      const valor = acharValorTotal(linhas)
      const itens = acharItens(linhas)

      // A proposta é conferida contra ela mesma: soma dos itens = total.
      const soma = conferirSomaDosItens(valor.valor, itens)
      if (soma?.bate && valor.valor !== null) {
        valor.confianca = 'alta'
      } else if (soma && !soma.bate) {
        valor.avisos.push(`A soma dos itens dá ${soma.soma.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} e não bate com o total — confira.`)
      }

      return {
        valor,
        itens,
        dataEmissao: acharDataEmissao(linhas),
        tributos: acharTributos(linhas),
        linhas,
      }
    } finally {
      await worker.terminate()
    }
  },
}
