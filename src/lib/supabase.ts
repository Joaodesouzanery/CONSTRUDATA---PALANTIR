/**
 * supabase.ts — Cliente Supabase singleton para o front-end.
 *
 * Lê URL e anon key de variáveis de ambiente Vite (`VITE_*`).
 * Lança erro em build se as variáveis estiverem ausentes — preferimos falhar
 * cedo a deixar o app rodar com cliente quebrado.
 *
 * Segurança:
 *  - Apenas a `anon key` é usada aqui. Toda proteção vem do RLS no Postgres.
 *  - A `service_role key` NUNCA pode ser importada por este arquivo (ou
 *    qualquer arquivo do `src/`), pois seria embutida no bundle do browser.
 *  - PKCE flow para auth — mais seguro que o implicit flow.
 *  - Sessão persistida em localStorage com auto-refresh do JWT.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url     = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    '[supabase] Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. ' +
    'Copie .env.example → .env.local e preencha com as credenciais do projeto Supabase.',
  )
}

// NOTA: cliente sem tipagem genérica até regenerarmos via:
//   npx supabase gen types typescript --project-id wtovivsmvenjbuhdemzv > src/types/database.ts
// O stub manual em src/types/database.ts existe só para documentação dos enums/roles.
export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: true,
    flowType:           'pkce',
    storage:            typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey:         'cdata-auth',
  },
  global: {
    headers: {
      'X-Client-Info': 'construdata-web@0.1.0',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 5, // throttle para 10k clientes simultâneos
    },
  },
})

/** Helper: retorna o usuário autenticado (ou null) da sessão atual em memória. */
export function getSessionUser() {
  return supabase.auth.getUser().then(({ data }) => data.user)
}
