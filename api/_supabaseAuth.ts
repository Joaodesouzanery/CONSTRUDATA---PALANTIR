/**
 * _supabaseAuth.ts — verificação de JWT Supabase para rotas serverless.
 *
 * As rotas /api/parse-* repassam ao gateway pago de IA usando a chave do
 * servidor. Sem auth, qualquer um poderia queimar o orçamento (DoS financeiro)
 * ou usar como proxy de IA grátis. Este helper exige um token de sessão válido.
 *
 * Arquivos iniciados por "_" NÃO viram rota no Vercel (são módulos auxiliares).
 *
 * Requer que `SUPABASE_URL`/`VITE_SUPABASE_URL` e
 * `SUPABASE_ANON_KEY`/`VITE_SUPABASE_ANON_KEY` estejam disponíveis às functions
 * (já estão nas envs do projeto). Fail-closed: sem config ou token → não autoriza.
 */
export async function isAuthenticated(authorizationHeader?: string): Promise<boolean> {
  const token = String(authorizationHeader ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return false

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anon) {
    console.warn('[api auth] SUPABASE_URL/ANON_KEY ausentes no ambiente serverless — negando por segurança')
    return false
  }

  try {
    const resp = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    })
    return resp.ok
  } catch {
    return false
  }
}
