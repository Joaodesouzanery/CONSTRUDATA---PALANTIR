-- ═══════════════════════════════════════════════════════════════════════════════
-- COLAR NO SUPABASE → SQL EDITOR, rodar, e me mandar o resultado das consultas.
--
-- Dois blocos. O BLOCO 1 grava (os quatro diretores da WCR). O BLOCO 2 só lê: é a
-- prova, do lado do servidor, de que WCR e Compizzo estão separadas e sem dado
-- perdido. ⚠️ O SQL Editor mostra SÓ o resultado da última consulta — por isso o
-- Bloco 2 é uma consulta única, e tudo sai numa tabela só (consulta · item · valor).
-- Idempotente — rodar duas vezes não muda nada.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── BLOCO 1 · Os quatro diretores da WCR Saneamento ─────────────────────────
-- Conta criada no painel do Auth NÃO vira usuário do sistema (o gatilho é no-op
-- desde a migração 0049). Aqui: membership `diretor` ativa para os 4; perfil só
-- para quem ainda não tem — quem já tem perfil noutra empresa recebe só o vínculo
-- e troca de empresa pelo app.

insert into public.memberships (organization_id, user_id, role, status, joined_at)
select o.id, u.id, 'diretor'::public.user_role, 'active', now()
from public.organizations o
join auth.users u on lower(u.email) in (
  'felipe.nery2@gmail.com',
  'williansrezende@wcrsaneamento.com.br',
  'bruno.guimaraes@wcrsaneamento.com.br',
  'sergio@wcrsaneamento.com.br'
)
where o.slug = 'wcr-saneamento' and o.deleted_at is null
on conflict (organization_id, user_id) where deleted_at is null
do update set role = 'diretor'::public.user_role, status = 'active',
              blocked_at = null, blocked_by = null, updated_at = now();

insert into public.profiles (id, organization_id, full_name, email, role, activated_at)
select u.id, o.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
  u.email::citext, 'diretor'::public.user_role, now()
from public.organizations o
join auth.users u on lower(u.email) in (
  'felipe.nery2@gmail.com',
  'williansrezende@wcrsaneamento.com.br',
  'bruno.guimaraes@wcrsaneamento.com.br',
  'sergio@wcrsaneamento.com.br'
)
where o.slug = 'wcr-saneamento' and o.deleted_at is null
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════════
-- BLOCO 2 · A CONFERÊNCIA — UMA consulta só, porque o SQL Editor mostra apenas o
-- resultado da última. Tudo vem numa tabela: (consulta, item, valor). Só contagens.
-- ═══════════════════════════════════════════════════════════════════════════════
with emails(email) as (values
  ('felipe.nery2@gmail.com'), ('williansrezende@wcrsaneamento.com.br'),
  ('bruno.guimaraes@wcrsaneamento.com.br'), ('sergio@wcrsaneamento.com.br')),
wcr as (select id from public.organizations where slug = 'wcr-saneamento' and deleted_at is null)

-- 1.R · esperado: 4 linhas "diretor · active · perfil sim". E-mail ausente = não existe em auth.users.
select '1.R diretor WCR' as consulta, e.email as item,
  coalesce(m.role::text || ' · ' || m.status || ' · perfil ' || case when p.id is null then 'NÃO' else 'sim' end
           || ' · ativa na WCR ' || case when p.organization_id = (select id from wcr) then 'sim' else 'não' end,
           'SEM CONTA em auth.users') as valor
from emails e
left join auth.users u on lower(u.email) = e.email
left join public.memberships m on m.user_id = u.id and m.organization_id = (select id from wcr) and m.deleted_at is null
left join public.profiles p on p.id = u.id and p.deleted_at is null

union all
-- 2.A · quais empresas existem (preciso saber qual é a Compizzo real)
select '2.A empresa', o.slug, o.name || ' · criada ' || o.created_at::date || ' · ' ||
  (select count(*) from public.memberships m where m.organization_id = o.id and m.deleted_at is null and m.status = 'active') || ' membro(s) ativo(s)'
from public.organizations o where o.deleted_at is null

union all
-- 2.B · contagem por empresa (a foto de hoje)
select '2.B contagem', o.slug,
  'caixa ' || (select count(*) from public.financeiro_entries x where x.organization_id = o.id and x.deleted_at is null)
  || ' · rdo ' || (select count(*) from public.rdo x where x.organization_id = o.id and x.deleted_at is null)
  || ' · fcp ' || (select count(*) from public.fcp_planos x where x.organization_id = o.id and x.deleted_at is null)
  || ' · obras ' || (select count(*) from public.construction_sites x where x.organization_id = o.id and x.deleted_at is null)
  || ' · funcionários ' || (select count(*) from public.workers x where x.organization_id = o.id and x.deleted_at is null)
  || ' · auditoria ' || (select count(*) from public.audit_log x where x.organization_id = o.id)
from public.organizations o where o.deleted_at is null

union all
-- 2.C · dado sem dono — esperado 0 em todas
select '2.C sem organization_id', 'financeiro_entries', count(*)::text from public.financeiro_entries where organization_id is null
union all select '2.C sem organization_id', 'rdo',                count(*)::text from public.rdo where organization_id is null
union all select '2.C sem organization_id', 'fcp_planos',         count(*)::text from public.fcp_planos where organization_id is null
union all select '2.C sem organization_id', 'construction_sites', count(*)::text from public.construction_sites where organization_id is null
union all select '2.C sem organization_id', 'workers',            count(*)::text from public.workers where organization_id is null

union all
-- 2.D · dado apontando para obra de OUTRA empresa — esperado 0 em todas (é o vazamento clássico)
select '2.D cruzado', 'financeiro_entries → obra de outra empresa', count(*)::text
  from public.financeiro_entries f join public.construction_sites s on s.id = f.obra_id where f.organization_id <> s.organization_id
union all select '2.D cruzado', 'rdo → obra de outra empresa', count(*)::text
  from public.rdo r join public.construction_sites s on s.id = r.site_id where r.organization_id <> s.organization_id
union all select '2.D cruzado', 'fcp_planos → obra de outra empresa', count(*)::text
  from public.fcp_planos p join public.construction_sites s on s.id = p.obra_id where p.organization_id <> s.organization_id
union all select '2.D cruzado', 'profiles → empresa ativa sem membership', count(*)::text
  from public.profiles p where p.deleted_at is null and not exists (
    select 1 from public.memberships m where m.user_id = p.id and m.organization_id = p.organization_id and m.status = 'active' and m.deleted_at is null)

union all
-- 2.E · RLS ligada e com policy de SELECT — esperado "rls true · policies ≥ 1"
select '2.E RLS', c.relname,
  'rls ' || c.relrowsecurity || ' · policies ' ||
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and p.cmd in ('SELECT', 'ALL'))
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('financeiro_entries', 'rdo', 'fcp_planos', 'construction_sites', 'workers', 'obra_dias_sem_producao', 'audit_log', 'memberships', 'profiles')

order by 1, 2;
