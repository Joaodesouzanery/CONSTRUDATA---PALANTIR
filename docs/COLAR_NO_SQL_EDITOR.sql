-- ═══════════════════════════════════════════════════════════════════════════════
-- COLAR NO SUPABASE → SQL EDITOR, rodar, e me mandar o resultado das consultas.
--
-- Dois blocos. O BLOCO 1 grava (os quatro diretores da WCR). O BLOCO 2 só lê: é a
-- prova, do lado do servidor, de que WCR e Compizzo estão separadas e sem dado
-- perdido. Rode os dois de uma vez; o editor mostra o resultado de cada `select`.
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

-- 1.R · Resultado esperado: 4 linhas, papel `diretor`, status `active`, tem_perfil = true.
-- E-mail que faltar aqui = a conta não existe em auth.users (foi digitado diferente no painel).
select '1.R diretores da WCR' as consulta,
  u.email, m.role as papel, m.status,
  (p.id is not null) as tem_perfil,
  (p.organization_id = o.id) as wcr_e_a_empresa_ativa
from public.organizations o
join public.memberships m on m.organization_id = o.id and m.deleted_at is null
join auth.users u on u.id = m.user_id
left join public.profiles p on p.id = u.id and p.deleted_at is null
where o.slug = 'wcr-saneamento'
order by u.email;


-- ─── BLOCO 2 · Isolamento WCR × Compizzo (só leitura) ────────────────────────

-- 2.A · As empresas que existem. Preciso saber qual é a Compizzo REAL (a migração
-- semeia uma `compizzo-homologacao`, fictícia). Mande esta lista inteira.
select '2.A empresas' as consulta, slug, name, created_at::date as criada_em,
  (select count(*) from public.memberships m where m.organization_id = o.id and m.deleted_at is null and m.status = 'active') as membros_ativos
from public.organizations o
where deleted_at is null
order by created_at;

-- 2.B · Contagem por empresa nas tabelas que esta rodada tocou. Só contagens.
select '2.B contagens' as consulta, o.slug,
  (select count(*) from public.financeiro_entries x where x.organization_id = o.id and x.deleted_at is null) as lancamentos_caixa,
  (select count(*) from public.rdo x where x.organization_id = o.id and x.deleted_at is null)                as rdos,
  (select count(*) from public.fcp_planos x where x.organization_id = o.id and x.deleted_at is null)         as planos_fcp,
  (select count(*) from public.construction_sites x where x.organization_id = o.id and x.deleted_at is null) as obras,
  (select count(*) from public.workers x where x.organization_id = o.id and x.deleted_at is null)            as funcionarios,
  (select count(*) from public.audit_log x where x.organization_id = o.id)                                   as auditoria
from public.organizations o
where o.deleted_at is null
order by o.slug;

-- 2.C · Dado sem dono. Esperado: TODAS as contagens = 0.
select '2.C sem organization_id' as consulta, t.tabela, t.n from (
  select 'financeiro_entries' as tabela, count(*) as n from public.financeiro_entries where organization_id is null
  union all select 'rdo',                count(*) from public.rdo                where organization_id is null
  union all select 'fcp_planos',         count(*) from public.fcp_planos         where organization_id is null
  union all select 'construction_sites', count(*) from public.construction_sites where organization_id is null
  union all select 'workers',            count(*) from public.workers            where organization_id is null
) t order by t.tabela;

-- 2.D · Dado CRUZADO: um lançamento/RDO/plano apontando para uma obra de OUTRA
-- empresa. É o vazamento clássico. Esperado: 0 em todas.
select '2.D cruzado entre empresas' as consulta, t.tabela, t.n from (
  select 'financeiro_entries → obra de outra empresa' as tabela, count(*) as n
    from public.financeiro_entries f join public.construction_sites s on s.id = f.obra_id
    where f.organization_id <> s.organization_id
  union all
  select 'rdo → obra de outra empresa', count(*)
    from public.rdo r join public.construction_sites s on s.id = r.site_id
    where r.organization_id <> s.organization_id
  union all
  select 'fcp_planos → obra de outra empresa', count(*)
    from public.fcp_planos p join public.construction_sites s on s.id = p.obra_id
    where p.organization_id <> s.organization_id
  union all
  select 'profiles → empresa sem membership ativa', count(*)
    from public.profiles p
    where p.deleted_at is null and not exists (
      select 1 from public.memberships m
      where m.user_id = p.id and m.organization_id = p.organization_id and m.status = 'active' and m.deleted_at is null)
) t order by t.tabela;

-- 2.E · RLS ligada e com policy de SELECT nas tabelas de dado. Esperado: rls = true
-- e select_policies >= 1 em todas.
select '2.E RLS' as consulta, c.relname as tabela, c.relrowsecurity as rls,
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and p.cmd in ('SELECT', 'ALL')) as select_policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('financeiro_entries', 'rdo', 'fcp_planos', 'construction_sites', 'workers', 'obra_dias_sem_producao', 'audit_log', 'memberships', 'profiles')
order by c.relname;
