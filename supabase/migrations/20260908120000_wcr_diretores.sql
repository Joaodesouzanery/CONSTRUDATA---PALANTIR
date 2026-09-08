-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor.
--
-- Vincula os quatro e-mails da WCR Saneamento à organização, todos como `diretor`.
--
-- ─── POR QUE ISTO É SQL E NÃO UMA TELA ──────────────────────────────────────
-- As contas foram criadas no painel do Auth. Desde a migração 0049 o gatilho `handle_new_user` é
-- NO-OP DE PROPÓSITO ("profiles and memberships are created only by explicit onboarding flows"):
-- uma conta nascida no painel tem usuário, mas nem `profiles` nem `memberships` — faz login e
-- recebe "profile missing". E não há caminho pelo app: a tela de membros é só do admin global, e as
-- RPCs `invite_org_member` / `change_member_role` / `block_member` foram REVOGADAS de
-- `authenticated` em 20260603120000 e nunca re-concedidas. Não "conserte" o gatilho para voltar a
-- provisionar sozinho: ele foi desligado porque colocava qualquer conta nova na PRIMEIRA org.
--
-- ─── O QUE ESTE ARQUIVO FAZ, POR E-MAIL ─────────────────────────────────────
-- 1. Acha o usuário em `auth.users`. Se não existir, avisa e pula — não cria conta.
-- 2. Cria a MEMBERSHIP ativa como `diretor` (ou atualiza papel/status se já houver uma).
-- 3. Cria o PROFILE só se não existir. Quem já tem perfil noutra empresa (o e-mail da sessão,
--    que também é desta org) NÃO tem o `organization_id` trocado: a empresa ativa é escolhida
--    pelo próprio usuário no app, via `set_default_organization`.
--
-- Idempotente: rodar duas vezes não muda nada. Sem `do $$ … $$` com `;` dentro de string — o
-- editor do Supabase já travou uma migração inteira por causa disso (ver migracoes-pendentes).

-- ─── 1. Memberships ──────────────────────────────────────────────────────────
insert into public.memberships (organization_id, user_id, role, status, joined_at)
select o.id, u.id, 'diretor'::public.user_role, 'active', now()
from public.organizations o
join auth.users u on lower(u.email) in (
  'felipe.nery2@gmail.com',
  'williansrezende@wcrsaneamento.com.br',
  'bruno.guimaraes@wcrsaneamento.com.br',
  'sergio@wcrsaneamento.com.br'
)
where o.slug = 'wcr-saneamento'
  and o.deleted_at is null
on conflict (organization_id, user_id) where deleted_at is null
do update set
  role       = 'diretor'::public.user_role,
  status     = 'active',
  blocked_at = null,
  blocked_by = null,
  updated_at = now();

-- ─── 2. Profiles — só para quem ainda não tem ────────────────────────────────
insert into public.profiles (id, organization_id, full_name, email, role, activated_at)
select
  u.id,
  o.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
  u.email::citext,
  'diretor'::public.user_role,
  now()
from public.organizations o
join auth.users u on lower(u.email) in (
  'felipe.nery2@gmail.com',
  'williansrezende@wcrsaneamento.com.br',
  'bruno.guimaraes@wcrsaneamento.com.br',
  'sergio@wcrsaneamento.com.br'
)
where o.slug = 'wcr-saneamento'
  and o.deleted_at is null
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- ─── 3. Conferência — rode e leia. Esperado: 4 linhas, todas `diretor` / `active`. ─────────────
-- Um e-mail ausente aqui = a conta não existe em auth.users (foi digitado diferente no painel?).
select
  u.email,
  m.role      as papel_na_wcr,
  m.status,
  p.organization_id = o.id as wcr_e_a_empresa_ativa,
  (p.id is not null)       as tem_perfil
from public.organizations o
join public.memberships m on m.organization_id = o.id and m.deleted_at is null
join auth.users u on u.id = m.user_id
left join public.profiles p on p.id = u.id and p.deleted_at is null
where o.slug = 'wcr-saneamento'
order by u.email;
