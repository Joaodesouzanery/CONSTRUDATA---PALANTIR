/**
 * rdoPhotoStorage.ts — fotos do RDO no Supabase Storage (bucket `rdo-photos`).
 *
 * As fotos deixam de viajar em base64 dentro do payload jsonb (que estourava o
 * localStorage e inflava o banco) e passam a ser arquivos no Storage; o RDO
 * guarda só o caminho (`storagePath`). Render via signed URL; PDF via base64
 * resolvido sob demanda. Espelha o pipeline do RDO Sabesp.
 */
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { withTimeout } from '@/lib/withTimeout'
import type { RdoPhoto } from '@/types'

export const RDO_PHOTOS_BUCKET = 'rdo-photos'

/**
 * Sobe um blob de imagem e devolve o caminho `<orgId>/<uuid>.jpg` no bucket.
 * O primeiro segmento é o organization_id — exigido pela RLS do Storage
 * (`foldername(name)[1] = user_org()`). Lança se não houver org ativa (o
 * chamador cai no fallback base64). Não chame em modo demo.
 */
export async function uploadRdoPhoto(blob: Blob): Promise<string> {
  const orgId = useAuth.getState().profile?.organization_id
  if (!orgId) throw new Error('Sem organização ativa para enviar a foto.')
  const path = `${orgId}/${crypto.randomUUID()}.jpg`
  const { error } = await withTimeout(
    supabase.storage.from(RDO_PHOTOS_BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    }),
    30_000,
    'Tempo esgotado ao enviar a foto. Ela ficou salva no aparelho (como base64) até o próximo envio.',
  )
  if (error) throw error
  return path
}

/** Gera uma URL assinada (1h) para exibir um caminho do bucket. */
export async function signedRdoPhotoUrl(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from(RDO_PHOTOS_BUCKET).createSignedUrl(path, 60 * 60)
    return data?.signedUrl ?? null
  } catch {
    return null
  }
}

/** Remove um arquivo do bucket (ao excluir a foto/RDO). Best-effort. */
export async function removeRdoPhoto(path: string): Promise<void> {
  try {
    await supabase.storage.from(RDO_PHOTOS_BUCKET).remove([path])
  } catch {
    /* best-effort: um arquivo órfão não quebra nada */
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Erro ao ler imagem.'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}

/**
 * Resolve uma foto para um data URL base64 — usado no PDF, que precisa dos bytes
 * embutidos. Foto com base64 (offline/legado) retorna direto; com storagePath,
 * assina e baixa. Retorna null se não der.
 */
export async function resolveRdoPhotoDataUrl(photo: RdoPhoto): Promise<string | null> {
  if (photo.base64) return photo.base64
  if (photo.storagePath) {
    const url = await signedRdoPhotoUrl(photo.storagePath)
    if (!url) return null
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      return await blobToDataUrl(blob)
    } catch {
      return null
    }
  }
  return null
}

/**
 * Enriquece um array de fotos com base64 resolvido (para imprimir PDF de RDOs já
 * salvos, cujas fotos têm só storagePath). Fotos sem imagem resolvível são omitidas.
 */
export async function resolvePhotosForPdf(photos: RdoPhoto[]): Promise<RdoPhoto[]> {
  const out = await Promise.all(
    photos.map(async (p) => {
      const base64 = await resolveRdoPhotoDataUrl(p)
      return base64 ? { ...p, base64 } : null
    }),
  )
  return out.filter((p): p is NonNullable<typeof p> => p !== null)
}

/**
 * Para persistir: fotos já enviadas guardam só o caminho (sem base64, pra não
 * inflar localStorage/banco); as ainda pendentes (offline) mantêm o base64
 * comprimido como fallback até subirem.
 */
export function leanPhotosForPersist(photos: RdoPhoto[]): RdoPhoto[] {
  return photos.map((p) =>
    p.storagePath
      ? { id: p.id, label: p.label, uploadedAt: p.uploadedAt, storagePath: p.storagePath }
      : p,
  )
}
