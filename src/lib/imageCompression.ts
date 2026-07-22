/**
 * imageCompression.ts — compressão de imagem no cliente (canvas → JPEG).
 *
 * Reduz uma foto de celular (~2-5 MB) para ~150-300 KB antes de guardar/enviar.
 * Extraído dos painéis de Qualidade (que já comprimiam) para ser usado também
 * pelo RDO — cujas fotos cruas em base64 estouravam o localStorage e travavam o
 * upload. Redimensiona para caber em `maxSize` (maior lado) e recodifica em JPEG.
 *
 * Retorna um data URL (`data:image/jpeg;base64,...`). Para obter um Blob (upload
 * ao Storage), use `compressImageToBlob`.
 */

/** Comprime `file` e devolve um data URL JPEG. */
export function compressImage(file: File, maxSize = 1400, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Erro ao ler imagem.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Erro ao carregar imagem.'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas indisponível para comprimir imagem.'))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

/** Comprime `file` e devolve um Blob JPEG (para upload ao Supabase Storage). */
export function compressImageToBlob(file: File, maxSize = 1400, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Erro ao ler imagem.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Erro ao carregar imagem.'))
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.width * scale))
        canvas.height = Math.max(1, Math.round(img.height * scale))
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas indisponível para comprimir imagem.'))
          return
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar JPEG.'))),
          'image/jpeg',
          quality,
        )
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}
