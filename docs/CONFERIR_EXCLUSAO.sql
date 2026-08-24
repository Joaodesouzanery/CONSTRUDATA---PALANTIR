-- ═══════════════════════════════════════════════════════════════════════════════
-- POR QUE UMA EXCLUSÃO NÃO PEGA? — diagnóstico somente leitura
--
-- POR QUE ISTO EXISTE: quando você apaga algo e o registro volta, a causa pode estar em
-- três lugares diferentes, e só um deles é "permissão". Este script diz QUAL é, em vez de
-- deixar a gente adivinhar.
--
-- COMO USAR: cole tudo no Supabase SQL Editor (produção) e rode. Ele NÃO altera nada e
-- NÃO precisa ser editado — descobre os usuários sozinho. Copie o resultado e mande de volta.
--
-- O QUE OLHAR PRIMEIRO: o BLOCO 1. Se a sua linha vier "SEM VÍNCULO" ou "VÍNCULO INATIVO",
-- é essa a causa, e o conserto é uma linha no banco — não adianta mexer em papel nem no app.
--
-- COMO O SERVIDOR DECIDE (public.has_role, 20260525190000_global_admin_all_org_access.sql:53):
--   profiles p  JOIN  memberships m
--     ON m.organization_id = p.organization_id     ← as DUAS organizações têm de bater
--    AND m.user_id = p.id
--    AND m.status = 'active'                       ← convite aceito
--    AND m.deleted_at IS NULL
--   WHERE p.id = auth.uid() AND p.deleted_at IS NULL
--   AND m.role = ANY(papéis_exigidos)              ← o papel que vale é o de MEMBERSHIPS
--
-- Repare no último: o papel que manda é `memberships.role`, NÃO `profiles.role`. Os dois
-- podem divergir, e é uma causa clássica de "sou dono mas não consigo apagar".
-- ═══════════════════════════════════════════════════════════════════════════════


-- ── BLOCO 1 · O SEU VÍNCULO — é aqui que a resposta costuma estar ─────────────
select
  '1. VÍNCULO'                                   as bloco,
  p.email,
  coalesce(o.name, '(org sem nome)')             as organizacao,
  p.role::text                                   as papel_no_perfil,
  coalesce(m.role::text, '—')                    as papel_no_vinculo,
  coalesce(m.status, '—')                        as situacao_do_vinculo,
  case
    when p.deleted_at is not null              then '❌ PERFIL EXCLUÍDO — nada funciona'
    when m.id is null                          then '❌ SEM VÍNCULO — o servidor recusa TODA escrita, mesmo sendo dono'
    when m.deleted_at is not null              then '❌ VÍNCULO EXCLUÍDO — mesmo efeito de não ter vínculo'
    when m.status <> 'active'                  then '❌ VÍNCULO INATIVO (' || m.status || ') — convite não aceito?'
    when m.organization_id <> p.organization_id then '❌ ORGANIZAÇÕES DIFERENTES entre perfil e vínculo'
    when m.role <> p.role                      then '⚠️ PAPÉIS DIVERGENTES — o que vale é o do vínculo (' || m.role || ')'
    else                                            '✅ OK — o servidor reconhece você como ' || m.role
  end                                            as veredito
from public.profiles p
left join public.organizations o on o.id = p.organization_id
-- LEFT JOIN de propósito: o caso interessante é justamente NÃO haver linha em memberships.
left join public.memberships m
       on m.user_id = p.id
      and m.organization_id = p.organization_id
where p.deleted_at is null
order by (m.id is null) desc, p.email;


-- ── BLOCO 2 · QUAIS TABELAS EXIGEM PAPEL PARA APAGAR ──────────────────────────
-- Exclusão física é bloqueada em quase tudo (soft delete é o mecanismo), então quem decide
-- é a policy de UPDATE. Aqui listamos as tabelas do dia a dia e o papel que cada uma pede.
with alvo(tabela) as (
  values ('worker_absences'), ('workers'), ('timecards'), ('shifts'), ('worker_assessments'),
         ('rotinas'), ('rotina_execucoes'), ('rdo'), ('obra_dias_sem_producao'),
         ('construction_sites'), ('financeiro_titulos'), ('projects'),
         ('suprimentos_estoque_itens'), ('suprimentos_depositos'), ('master_baselines')
)
select
  '2. PAPEL EXIGIDO'                                          as bloco,
  a.tabela,
  case when to_regclass('public.' || a.tabela) is null then '— tabela não existe no banco'
       when pol.qual is null                          then '— sem policy de UPDATE'
       when pol.qual like '%has_role%'
         then coalesce(substring(pol.qual from 'has_role\(ARRAY\[([^]]*)\]'), '(não consegui ler)')
       when pol.qual like '%false%'                   then '🚫 UPDATE BLOQUEADO PARA TODOS'
       else 'qualquer papel da organização'
  end                                                         as papel_exigido,
  case when pol.qual like '%deleted_at IS NULL%' or pol.qual like '%deleted_at is null%'
       then 'sim' else '⚠️ NÃO' end                           as so_linha_viva
from alvo a
left join pg_policies pol
       on pol.schemaname = 'public' and pol.tablename = a.tabela and pol.cmd = 'UPDATE'
order by a.tabela;


-- ── BLOCO 3 · A ARMADILHA DO FALSO POSITIVO ───────────────────────────────────
-- O app confere se a exclusão pegou relendo a linha: se ela ainda aparece, ele conclui que
-- o servidor recusou. Isso SÓ funciona se a leitura filtrar `deleted_at IS NULL`. Onde não
-- filtra, toda exclusão "falha" para sempre, mesmo tendo funcionado.
select
  '3. ARMADILHA'                                              as bloco,
  pol.tablename                                               as tabela,
  '⚠️ a leitura NÃO esconde linha excluída — exclusão pode falhar em falso' as risco
from pg_policies pol
where pol.schemaname = 'public'
  and pol.cmd = 'SELECT'
  and pol.qual not like '%deleted_at%'
  and exists (
    select 1 from information_schema.columns c
     where c.table_schema = 'public' and c.table_name = pol.tablename
       and c.column_name = 'deleted_at'
  )
order by pol.tablename;


-- ── BLOCO 4 · PEDIDOS DE APROVAÇÃO PRESOS ─────────────────────────────────────
-- Se houver linhas aqui, são exclusões que você mandou fazer e que nunca aconteceram:
-- o pedido foi criado e ficou esperando alguém aprovar (e ninguém pode aprovar o próprio).
select
  '4. APROVAÇÕES PRESAS'                                      as bloco,
  pa.action_type,
  pa.target_table,
  pa.status,
  pa.created_at::date                                         as pedido_em,
  coalesce(p.email, '(usuário removido)')                     as pedido_por
from public.pending_actions pa
left join public.profiles p on p.id = pa.requested_by
where pa.status = 'pending'
order by pa.created_at desc
limit 50;
