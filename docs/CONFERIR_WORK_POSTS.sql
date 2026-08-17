-- CONFERIR_WORK_POSTS.sql
--
-- Conferência da migration 20260817140000_work_posts_occurrences.sql, DEPOIS de aplicada.
-- Rode no SQL Editor do Supabase. Nada aqui escreve — é só leitura.
--
-- O que cada bloco responde:
--   1. a estrutura ficou como o cliente espera? (tabelas, RLS, as 4 policies, grants, funções)
--   2. o que já subiu, e o `payload->>'id'` bate com a coluna `id`? (divergir prende todo
--      update/delete futuro daquele registro — o app monta as entidades a partir do payload)
--   3. há duplicata semântica? (duas máquinas subindo a mesma lista geram uuids diferentes)
--   4. quais papéis, hoje, conseguem de fato gravar
--   5. algum autor de outra organização? (indício de vazamento entre empresas)
--
-- CONFERÊNCIA DA MIGRATION 20260817140000  (work_posts / labor_occurrences)
--
-- SOMENTE LEITURA: nenhum create, alter, insert, update ou delete.
-- O SQL Editor do Supabase mostra o resultado de UMA instrução por vez —
-- rode um BLOCO de cada vez, de cima para baixo.
--
-- Atenção: o SQL Editor roda como dono do banco e IGNORA a RLS. Isso é proposital
-- aqui: é uma visão de auditoria de todas as organizações.
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── BLOCO 1 ── estrutura, RLS, as 4 policies de cada, grants e dependências ─────
with alvo(tabela) as (values ('work_posts'), ('labor_occurrences')),
cls as (
  select a.tabela,
         c.oid,
         c.relrowsecurity      as rls_ligada,
         c.relforcerowsecurity as rls_forcada
  from alvo a
  left join pg_class c
    on  c.relnamespace = 'public'::regnamespace
    and c.relname      = a.tabela
    and c.relkind      = 'r'
),
cols as (
  select table_name as tabela,
         count(*) filter (
           where column_name in ('id','organization_id','payload','created_by',
                                 'created_at','updated_at','deleted_at')
         ) as esperadas,
         string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position) as lista
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('work_posts','labor_occurrences')
  group by table_name
),
pols as (
  select tablename as tabela, policyname, cmd, roles,
         coalesce(qual, '')       as usando,
         coalesce(with_check, '') as checando
  from pg_policies
  where schemaname = 'public'
    and tablename in ('work_posts','labor_occurrences')
)
select * from (

  -- 1. as duas tabelas existem?
  select 1 as ordem, 'tabela' as secao, tabela as item,
         case when oid is null then 'FALTA' else 'OK' end as situacao,
         case when oid is null then 'nao existe em public' else 'existe' end as detalhe
  from cls

  union all
  -- 2. RLS ligada E forcada (forcada = nem o dono da tabela escapa das policies)
  select 2, 'rls', tabela,
         case when rls_ligada and rls_forcada then 'OK' else 'PROBLEMA' end,
         'enable=' || coalesce(rls_ligada::text,'?') || '  force=' || coalesce(rls_forcada::text,'?')
  from cls

  union all
  -- 3. as 7 colunas do contrato (id, organization_id, payload, created_by, datas)
  select 3, 'colunas', tabela,
         case when esperadas = 7 then 'OK' else 'PROBLEMA' end,
         esperadas || '/7 · ' || lista
  from cols

  union all
  -- 4. exatamente 4 policies por tabela, uma de cada comando
  select 4, 'policies (contagem)', tabela,
         case when count(*) = 4
               and count(*) filter (where cmd = 'SELECT') = 1
               and count(*) filter (where cmd = 'INSERT') = 1
               and count(*) filter (where cmd = 'UPDATE') = 1
               and count(*) filter (where cmd = 'DELETE') = 1
              then 'OK' else 'PROBLEMA' end,
         count(*) || ' · ' || string_agg(policyname || ' [' || cmd || ']', ', ' order by cmd)
  from pols
  group by tabela

  union all
  -- 5. o CONTEUDO de cada policy bate com o combinado?
  --    SELECT: user_org + deleted_at | INSERT: user_org + auth.uid + has_role
  --    UPDATE: user_org + deleted_at + has_role no USING, user_org no WITH CHECK
  --    DELETE: bloqueada (false)
  select 5, 'policy ' || cmd, tabela || ' · ' || policyname,
         case
           when cmd = 'SELECT'
                and usando like '%user_org%' and usando like '%deleted_at%'
                then 'OK'
           when cmd = 'INSERT'
                and checando like '%user_org%' and checando like '%auth.uid%'
                and checando like '%has_role%'
                then 'OK'
           when cmd = 'UPDATE'
                and usando like '%user_org%' and usando like '%deleted_at%'
                and usando like '%has_role%' and checando like '%user_org%'
                then 'OK'
           when cmd = 'DELETE'
                and replace(lower(usando), ' ', '') in ('false','(false)')
                then 'OK (bloqueada)'
           else 'CONFERIR A MAO'
         end,
         'papeis=' || roles::text || '  USING=' || usando || '  WITH CHECK=' || checando
  from pols

  union all
  -- 6. grants: authenticated com select/insert/update e SEM delete; anon sem nada
  select 6, 'grants', tabela,
         case when     has_table_privilege('authenticated', 'public.' || tabela, 'SELECT')
                   and has_table_privilege('authenticated', 'public.' || tabela, 'INSERT')
                   and has_table_privilege('authenticated', 'public.' || tabela, 'UPDATE')
                   and not has_table_privilege('authenticated', 'public.' || tabela, 'DELETE')
                   and not has_table_privilege('anon',          'public.' || tabela, 'SELECT')
              then 'OK' else 'PROBLEMA' end,
         'authenticated: select=' || has_table_privilege('authenticated','public.'||tabela,'SELECT')::text
           || ' insert=' || has_table_privilege('authenticated','public.'||tabela,'INSERT')::text
           || ' update=' || has_table_privilege('authenticated','public.'||tabela,'UPDATE')::text
           || ' delete=' || has_table_privilege('authenticated','public.'||tabela,'DELETE')::text
           || '  |  anon: select=' || has_table_privilege('anon','public.'||tabela,'SELECT')::text
           || ' insert=' || has_table_privilege('anon','public.'||tabela,'INSERT')::text
  from cls
  where oid is not null

  union all
  -- 7. chaves estrangeiras (organization_id -> organizations, created_by -> auth.users)
  select 7, 'fk', c.relname || ' · ' || con.conname, 'INFO',
         pg_get_constraintdef(con.oid)
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  where con.contype = 'f'
    and c.relnamespace = 'public'::regnamespace
    and c.relname in ('work_posts','labor_occurrences')

  union all
  -- 8. as funcoes que as policies chamam existem com a assinatura usada?
  select 8, 'dependencia', f.nome,
         case when to_regprocedure(f.nome) is null then 'FALTA' else 'OK' end,
         coalesce(pg_get_function_identity_arguments(to_regprocedure(f.nome)), '—')
  from (values ('public.user_org()'), ('public.has_role(public.user_role[])')) as f(nome)

  union all
  -- 9. os 5 papeis citados nas policies existem no enum public.user_role?
  select 9, 'papeis', 'enum user_role',
         case when count(*) = 5 then 'OK' else 'PROBLEMA' end,
         'encontrados: ' || coalesce(string_agg(r, ', '), '(nenhum)')
  from unnest(array['planejador','engenheiro','gerente','diretor','owner']) as r
  where exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = r
  )

  union all
  -- 10. triggers (esperado: nenhum — updated_at nao e atualizado por trigger,
  --     igual a financeiro_titulos. Informativo, nao e falha.)
  select 10, 'triggers', c.relname, 'INFO',
         count(t.oid) || ' trigger(s) de usuario'
  from cls cl
  join pg_class c on c.oid = cl.oid
  left join pg_trigger t on t.tgrelid = c.oid and not t.tgisinternal
  group by c.relname

) r
order by ordem, item;


-- ── BLOCO 2 ── o que ja subiu, e integridade do payload ─────────────────────────
-- payload_id_divergente > 0 e GRAVE: o pull monta as entidades a partir do payload,
-- entao um id divergente prende todo update/delete futuro daquele registro.
select 'work_posts' as tabela,
       count(*)                                                         as linhas,
       count(*) filter (where deleted_at is null)                       as ativas,
       count(*) filter (where deleted_at is not null)                   as apagadas_soft,
       count(distinct organization_id)                                  as organizacoes,
       count(distinct created_by)                                       as autores,
       count(*) filter (where payload->>'id' is distinct from id::text)  as payload_id_divergente,
       count(*) filter (where payload = '{}'::jsonb)                    as payload_vazio,
       min(created_at)                                                  as primeiro,
       max(created_at)                                                  as ultimo
from public.work_posts
union all
select 'labor_occurrences',
       count(*),
       count(*) filter (where deleted_at is null),
       count(*) filter (where deleted_at is not null),
       count(distinct organization_id),
       count(distinct created_by),
       count(*) filter (where payload->>'id' is distinct from id::text),
       count(*) filter (where payload = '{}'::jsonb),
       min(created_at),
       max(created_at)
from public.labor_occurrences;


-- ── BLOCO 3 ── duplicata semantica (duas maquinas subindo a mesma lista) ────────
-- Zero linhas = nenhuma duplicata. Cada linha aqui e o mesmo posto/ocorrencia
-- gravado com uuids diferentes.
select 'work_posts' as tabela,
       organization_id,
       coalesce(payload->>'name', '(sem nome)') as chave,
       count(*)      as copias,
       array_agg(id) as ids
from public.work_posts
where deleted_at is null
group by 1, 2, 3
having count(*) > 1
union all
select 'labor_occurrences',
       organization_id,
       coalesce(payload->>'date', '?') || ' · ' || left(coalesce(payload->>'description', ''), 40),
       count(*),
       array_agg(id)
from public.labor_occurrences
where deleted_at is null
group by 1, 2, 3
having count(*) > 1
order by copias desc;


-- ── BLOCO 4 ── quem, hoje, consegue de fato gravar posto/ocorrencia ─────────────
-- Todo mundo na coluna "NAO passa na RLS" cria o registro no app, ve o registro
-- na tela, e a operacao fica presa na fila para sempre (nao ha gate no cliente).
select p.organization_id,
       p.role,
       count(*) as pessoas,
       case when p.role::text in ('planejador','engenheiro','gerente','diretor','owner')
            then 'pode gravar'
            else 'NAO passa na RLS — op fica presa na fila' end as efeito
from public.profiles p
group by p.organization_id, p.role
order by p.organization_id, efeito, p.role;


-- ── BLOCO 5 ── autor de outra organizacao (indicio de vazamento entre empresas) ─
-- Zero linhas = tudo certo.
select 'work_posts' as tabela, wp.id, wp.organization_id, wp.created_by,
       pr.organization_id as org_do_autor
from public.work_posts wp
left join public.profiles pr on pr.id = wp.created_by
where pr.id is null or pr.organization_id is distinct from wp.organization_id
union all
select 'labor_occurrences', lo.id, lo.organization_id, lo.created_by, pr.organization_id
from public.labor_occurrences lo
left join public.profiles pr on pr.id = lo.created_by
where pr.id is null or pr.organization_id is distinct from lo.organization_id;