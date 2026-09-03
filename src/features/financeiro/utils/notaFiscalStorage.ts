/**
 * notaFiscalStorage.ts — fotos das notas fiscais (aba "Nota Fiscal" do Financeiro) no Supabase Storage
 * (bucket `notas-fiscais`). A nota guarda só o caminho (payload jsonb: `fotoPath`);
 * exibição via signed URL. Espelha `boletoStorage.ts`. Requer organização ativa
 * (RLS: pasta raiz = organization_id).
 */
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { withTimeout } from '@/lib/withTimeout'
import { isNonProductionDataMode } from '@/lib/runtimeMode'

export const NOTAS_BUCKET = 'notas-fiscais'

function orgIdOrThrow(): string {
  const orgId = useAuth.getState().profile?.organization_id
  if (!orgId) throw new Error('Sem organização ativa para enviar o arquivo.')
  return orgId
}

/** Sobe a foto de uma nota fiscal (imagem/PDF) e devolve o caminho `<orgId>/<uuid>.<ext>`. */
export async function uploadNotaFile(file: File): Promise<string> {
  // Modo demonstração: nunca grava no bucket real (dados de demo não se misturam com os reais).
  if (isNonProductionDataMode()) throw new Error('Saia do modo Demonstração para anexar fotos de notas fiscais reais.')
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  const path = `${orgIdOrThrow()}/${crypto.randomUUID()}.${ext}`
  const { error } = await withTimeout(
    supabase.storage.from(NOTAS_BUCKET).upload(path, file, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
      upsert: true,
    }),
    60_000,
    'Tempo esgotado ao enviar a foto da nota.',
  )
  if (error) throw error
  return path
}

/** Gera uma URL assinada (1h) para exibir/baixar um caminho do bucket. */
export async function signedNotaUrl(path: string): Promise<string | null> {
  if (isNonProductionDataMode()) return null   // demo: não busca arquivo real
  try {
    const { data } = await supabase.storage.from(NOTAS_BUCKET).createSignedUrl(path, 60 * 60)
    return data?.signedUrl ?? null
  } catch {
    return null
  }
}

/** Remove um arquivo do bucket (best-effort — um órfão não quebra nada). */
export async function removeNotaFile(path: string): Promise<void> {
  if (isNonProductionDataMode()) return   // demo: não toca o bucket real
  try {
    await supabase.storage.from(NOTAS_BUCKET).remove([path])
  } catch {
    /* best-effort */
  }
}
