/**
 * withTimeout — corre uma promessa contra um timeout. Se o tempo estourar,
 * rejeita com `message` (a promessa original continua, mas quem espera é liberado).
 *
 * Usado no sync (`flushQueue`) para que uma requisição travada numa rede ruim de
 * canteiro não deixe o status preso em "sincronizando" para sempre, e no upload
 * de fotos ao Supabase Storage. Extraído do RDO Sabesp para uso compartilhado.
 */
export async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: number | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = (typeof window !== 'undefined' ? window.setTimeout : setTimeout)(
      () => reject(new Error(message)),
      timeoutMs,
    ) as unknown as number
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId !== undefined) {
      ;(typeof window !== 'undefined' ? window.clearTimeout : clearTimeout)(timeoutId)
    }
  }
}
