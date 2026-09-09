-- ═══════════════════════════════════════════════════════════════════════════════
-- COLAR NO SUPABASE → SQL EDITOR, rodar, e me mandar o resultado.
--
-- (O conteúdo anterior deste arquivo — os quatro diretores da WCR — foi cumprido
--  em 08/09/2026 e está no histórico do git. Isto aqui é o próximo bloco.)
--
-- ⚠️ POR QUE: a tabela `app_state` tem migração no repositório desde 10/07/2026
-- (`20260710130000_app_state.sql`), mas ela NÃO está no bundle já aplicado
-- (`APPLY_PENDENTE_20260722.sql`) nem na lista de "confirmadas como aplicadas" do
-- `docs/APLICAR_MIGRACOES.md`. E até o deploy de hoje NENHUMA tela usava essa
-- tabela — `blobSync.ts` existia sem um único consumidor. Ou seja: ninguém nunca
-- descobriria que ela falta, porque nada a tocava.
--
-- A partir de hoje ela é usada pelos cards "Controle de Caixa — importado há X
-- dias por Fulano" da Visão Geral do Financeiro.
--
-- O QUE ACONTECE SE ELA NÃO EXISTIR: nada quebra e nada trava. `pushBlob` faz um
-- upsert direto (não passa pela fila de sincronização, então não há op preso
-- retentando para sempre); no erro ele só escreve um aviso no console e devolve
-- false. O efeito visível é UM só: você importa a planilha e o card continua
-- dizendo que nunca foi importada. Parece defeito, e é tabela faltando.
--
-- ⚠️ Idempotente: `CREATE TABLE IF NOT EXISTS` + `DROP POLICY IF EXISTS`. Se a
-- tabela já existir, este bloco não muda nada — serve de diagnóstico do mesmo
-- jeito. Rodar duas vezes não dói.
--
-- ⚠️ O SQL Editor mostra SÓ o resultado da ÚLTIMA consulta — por isso a
-- conferência no fim é uma consulta única, e tudo sai numa tabela só.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── BLOCO 1 · A tabela app_state (cópia fiel da migração 20260710130000) ─────
-- Um blob jsonb por (organização, store_key). Serve de guarda-chuva para dados
-- que hoje vivem só no navegador. Conflito: last-write-wins por updated_at.

CREATE TABLE IF NOT EXISTS public.app_state (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_key        text NOT NULL,
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid,
  UNIQUE (organization_id, store_key)
);

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_state FORCE ROW LEVEL SECURITY;

-- Isolamento por empresa, igual ao resto do schema: só enxerga e só grava na
-- própria organização. DELETE é bloqueado — blob se sobrescreve, não se apaga.
DROP POLICY IF EXISTS app_state_select_own_org ON public.app_state;
CREATE POLICY app_state_select_own_org ON public.app_state
  FOR SELECT TO authenticated
  USING (organization_id = public.user_org());

DROP POLICY IF EXISTS app_state_insert_own_org ON public.app_state;
CREATE POLICY app_state_insert_own_org ON public.app_state
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS app_state_update_own_org ON public.app_state;
CREATE POLICY app_state_update_own_org ON public.app_state
  FOR UPDATE TO authenticated
  USING (organization_id = public.user_org())
  WITH CHECK (organization_id = public.user_org());

DROP POLICY IF EXISTS app_state_delete_blocked ON public.app_state;
CREATE POLICY app_state_delete_blocked ON public.app_state
  FOR DELETE TO authenticated USING (false);


-- ─── BLOCO 2 · A conferência (consulta única — é o que aparece na tela) ───────
-- Lê e não escreve. Tudo que der "OK" está pronto; qualquer "FALTA" me mande.

select 1 as ordem, 'Tabela app_state existe' as item,
       case when to_regclass('public.app_state') is not null then 'OK' else 'FALTA' end as situacao

union all
select 2, 'RLS ligada (e forçada)',
       case when (select relrowsecurity and relforcerowsecurity
                  from pg_class where oid = 'public.app_state'::regclass)
            then 'OK' else 'FALTA' end

union all
select 3, 'As 4 policies (select/insert/update/delete-bloqueado)',
       case when (select count(*) from pg_policies
                  where schemaname = 'public' and tablename = 'app_state') = 4
            then 'OK' else 'FALTA — tem ' ||
                 (select count(*)::text from pg_policies
                  where schemaname = 'public' and tablename = 'app_state') end

union all
select 4, 'Chave única (organization_id, store_key)',
       case when exists (
              select 1 from pg_constraint
              where conrelid = 'public.app_state'::regclass and contype = 'u')
            then 'OK' else 'FALTA' end

-- Estas duas últimas são o estado do DADO, não do schema. Antes da primeira
-- importação feita com o código de hoje, "0 registro(s)" é o esperado.
union all
select 5, 'Registros de importação já gravados',
       coalesce((select count(*)::text from public.app_state
                 where store_key = 'financeiro-importacoes'), '0') || ' registro(s)'

union all
select 6, 'Última gravação em app_state (qualquer chave)',
       coalesce((select to_char(max(updated_at), 'DD/MM/YYYY HH24:MI')
                 from public.app_state), 'nenhuma ainda')

order by ordem;
