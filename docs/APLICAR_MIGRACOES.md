# Como aplicar migrações no Supabase (e não ter mais "não salvo · erro")

## O problema
Este projeto **não tem etapa de migração no CI**. O deploy do Vercel sobe só o
front-end; as migrações em `supabase/migrations/` **só chegam ao banco se alguém
colar no Supabase SQL Editor**. Quando uma migração fica pra trás, o app tenta
gravar numa tabela/coluna que não existe e o Supabase responde:

> `Could not find the table 'public.economy_baselines' in the schema cache`
> (PGRST205 = tabela faltando · PGRST204 = coluna faltando)

O indicador de sync mostra isso como **"não salvo · erro"**.

## A correção (rodar uma vez)
1. Abra o **Supabase → SQL Editor** (projeto de produção).
2. Cole o conteúdo de **`supabase/migrations/APPLY_PENDENTE_20260722.sql`** inteiro.
3. Rode. É **idempotente** (`CREATE TABLE/ADD COLUMN IF NOT EXISTS`, `CREATE OR
   REPLACE`, `DROP POLICY IF EXISTS`) — seguro mesmo no que já existe.
4. Recarregue o app. Os erros de schema (Economia, Plano de Execução, Serviços,
   `site_id`, etc.) somem.

## Para não repetir
- **Regra:** toda migração nova entra no bundle `APPLY_PENDENTE`. Antes de cada
  deploy que dependa de banco, rode o bundle no SQL Editor.
- **Melhor (recomendado):** adotar o **Supabase CLI** linkado ao projeto e rodar
  `supabase db push` no deploy (aplica as migrações pendentes automaticamente),
  eliminando o passo manual de vez.

## Como conferir o que está aplicado
Numa sessão interativa com o MCP do Supabase autorizado, `list_tables` /
`list_migrations` mostram o estado real do banco.
