/**
 * predialAtivoStorage.ts — foto de plaqueta e documentos anexos do ativo (Inventário
 * Predial) no Supabase Storage (bucket `predial-ativos`). O ativo guarda só o caminho
 * (`fotoPlaquetaPath` / `anexos[].path`); exibição via signed URL. Espelha o pipeline de
 * `rdoPhotoStorage.ts`. Requer organização ativa (RLS: pasta raiz = organization_id).
 */
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { withTimeout } from '@/lib/withTimeout'

export const PREDIAL_ATIVOS_BUCKET = 'predial-ativos'

function orgIdOrThrow(): string {
  const orgId = useAuth.getState().profile?.organization_id
  if (!orgId) throw new Error('Sem organização ativa para enviar o arquivo.')
  return orgId
}

/** Sobe um blob de imagem (plaqueta) e devolve o caminho `<orgId>/<uuid>.jpg`. */
export async function uploadPredialAtivoImage(blob: Blob): Promise<string> {
  const path = `${orgIdOrThrow()}/${crypto.randomUUID()}.jpg`
  const { error } = await withTimeout(
    supabase.storage.from(PREDIAL_ATIVOS_BUCKET).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    }),
    30_000,
    'Tempo esgotado ao enviar a imagem da plaqueta.',
  )
  if (error) throw error
  return path
}

/** Sobe um documento anexo (manual/ART/nota, qualquer tipo) e devolve o caminho. */
export async function uploadPredialAtivoFile(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `${orgIdOrThrow()}/${crypto.randomUUID()}.${ext}`
  const { error } = await withTimeout(
    supabase.storage.from(PREDIAL_ATIVOS_BUCKET).upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
      upsert: true,
    }),
    60_000,
    'Tempo esgotado ao enviar o anexo.',
  )
  if (error) throw error
  return path
}

/** Gera uma URL assinada (1h) para exibir/baixar um caminho do bucket. */
export async function signedPredialAtivoUrl(path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from(PREDIAL_ATIVOS_BUCKET).createSignedUrl(path, 60 * 60)
    return data?.signedUrl ?? null
  } catch {
    return null
  }
}

/** Remove um arquivo do bucket (best-effort — um órfão não quebra nada). */
export async function removePredialAtivoFile(path: string): Promise<void> {
  try {
    await supabase.storage.from(PREDIAL_ATIVOS_BUCKET).remove([path])
  } catch {
    /* best-effort */
  }
}
