/**
 * storage.ts — Helper para Supabase Storage.
 *
 * Sprint 4 introduz armazenamento de arquivos (PDFs, anexos de projeto, fontes
 * BIM como .shp/.dxf) fora do banco. Buckets esperados (criar manualmente no
 * Supabase Dashboard antes do deploy):
 *
 *   - project-documents  (privado, RLS por path prefix {org_id}/...)
 *   - bim-uploads        (privado, RLS por path prefix {org_id}/...)
 *
 * Segurança:
 *   - Buckets PRIVADOS. URLs lidas via getSignedUrl com expiração curta.
 *   - Path inclui {org_id} no prefixo para facilitar policies de Storage.
 *   - O cliente nunca recebe service_role; quem aprova é a auth do JWT.
 */
import { supabase } from './supabase'
import { useAuth } from './auth'

export type StorageBucket = 'project-documents' | 'bim-uploads'

export interface UploadResult {
  path: string
  size: number
  mimeType: string
}

/**
 * Faz upload de um File para um bucket. Path final:
 *   {bucket}/{org_id}/{folder}/{uuid}.{ext}
 */
export async function uploadFile(
  bucket: StorageBucket,
  file: File,
  folder: string = '',
): Promise<UploadResult | null> {
  const { profile } = useAuth.getState()
  if (!profile) return null

  const orgId = profile.organization_id
  const ext   = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const id    = crypto.randomUUID()
  const path  = [orgId, folder, `${id}.${ext}`].filter(Boolean).join('/')

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert:       false,
    contentType:  file.type || 'application/octet-stream',
  })

  if (error) {
    console.warn(`[storage:${bucket}] upload failed`, error.message)
    return null
  }

  return { path, size: file.size, mimeType: file.type || 'application/octet-stream' }
}

/**
 * Gera uma URL assinada (com expiração) para download/visualização.
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresInSeconds: number = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds)
  if (error) {
    console.warn(`[storage:${bucket}] signed URL failed`, error.message)
    return null
  }
  return data?.signedUrl ?? null
}

/**
 * Remove um arquivo do bucket. Costuma ser chamado depois que o registro
 * correspondente no banco é soft-deleted.
 */
export async function removeFile(bucket: StorageBucket, path: string): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) {
    console.warn(`[storage:${bucket}] remove failed`, error.message)
    return false
  }
  return true
}
