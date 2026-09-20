-- ════════════════════════════════════════════════════════════════════════════════
-- PONTO ELETRÔNICO — dar a cada funcionário um login que só bate ponto
-- ════════════════════════════════════════════════════════════════════════════════
--
-- ⚠️ COLAR NO SQL EDITOR DO SUPABASE. Não é migração: a lista de pessoas muda a cada
-- contratação, e migração é código versionado, não cadastro.
--
-- ─── POR QUE ISTO É SQL E NÃO UMA TELA ──────────────────────────────────────────
-- Desde a migração 0049 o gatilho `handle_new_user` é NO-OP DE PROPÓSITO ("profiles and
-- memberships are created only by explicit onboarding flows"). Uma conta criada no painel do
-- Auth tem `auth.users` e NADA MAIS: faz login e recebe "profile missing".
-- E não há caminho pelo app — as RPCs `invite_org_member` / `change_member_role` foram
-- REVOGADAS de `authenticated` em 20260603120000 e nunca re-concedidas.
--
-- ⚠️ NÃO "conserte" o gatilho para provisionar sozinho: a versão antiga (0039) jogava qualquer
-- conta nova na PRIMEIRA organização do banco, como `visualizador`. Foi desligada por isso.
--
-- ─── O CAMINHO INTEIRO, EM 4 PASSOS ─────────────────────────────────────────────
--   1. (painel do Auth, à mão) criar a conta de cada funcionário: e-mail + senha.
--   2. (este arquivo, passo 2) dar-lhe membership `colaborador` na empresa certa.
--   3. (este arquivo, passo 3) conferir. Rode e LEIA o resultado.
--   4. (no app) Mão de Obra › Funcionários › "Contas do Ponto Eletrônico" — amarrar cada
--      conta ao cadastro do funcionário. Sem esse último passo a pessoa abre a tela do
--      ponto e vê "sua conta ainda não está ligada a um cadastro de funcionário".
--
-- ─── O QUE O PAPEL `colaborador` PODE ───────────────────────────────────────────
-- Inserir a PRÓPRIA batida (`ponto_insert` exige `auth_user_id = auth.uid()`) e ler as
-- próprias batidas. Ele não está em NENHUMA outra lista `ROLES_*_WRITE` do projeto — é a
-- única escrita dele no sistema inteiro. E a rota: só `/app/ponto`; qualquer outra URL
-- redireciona de volta.
--
-- ⚠️ PRÉ-REQUISITO: a migração `20260918140000_user_role_colaborador.sql` precisa ter sido
-- aplicada ANTES (ela acrescenta o valor ao enum `user_role`), e num comando separado — o
-- Postgres não deixa usar um valor de enum na mesma transação em que ele foi criado.
-- ════════════════════════════════════════════════════════════════════════════════


-- ─── PASSO 0 — confira que o papel existe ───────────────────────────────────────
-- Esperado: 1 linha, 'colaborador'. Se vier vazio, aplique a 20260918140000 primeiro.
select enumlabel
from pg_enum
where enumtypid = 'public.user_role'::regtype
  and enumlabel = 'colaborador';


-- ─── PASSO 1 — quem já tem conta no Auth, e quem ainda não tem ──────────────────
-- Troque a lista de e-mails pela dos seus funcionários. Rode e leia:
--   tem_conta = false  →  falta criar no painel do Auth (Authentication › Users › Add user).
with alvo(email) as (
  values
    ('funcionario1@wcrsaneamento.com.br'),
    ('funcionario2@wcrsaneamento.com.br')
    -- ... uma linha por pessoa
)
select
  a.email,
  (u.id is not null)                              as tem_conta,
  (m.id is not null)                              as ja_tem_membership,
  m.role                                          as papel_atual,
  m.status
from alvo a
left join auth.users u on lower(u.email) = lower(a.email)
left join public.organizations o on o.slug = 'wcr-saneamento' and o.deleted_at is null
left join public.memberships m on m.user_id = u.id and m.organization_id = o.id and m.deleted_at is null
order by a.email;


-- ─── PASSO 2 — dar o papel `colaborador` ────────────────────────────────────────
-- Idempotente: rodar duas vezes não muda nada. Quem não existe em `auth.users` é
-- simplesmente pulado (nenhuma conta é criada aqui).
--
-- ⚠️ Troque `wcr-saneamento` pelo slug da SUA organização se for outra empresa.
-- ⚠️ Mesma lista de e-mails do passo 1. Repetida de propósito: um `do $$ … $$` com `;`
--    dentro de string já travou uma migração inteira no editor do Supabase.

-- 2a. A membership — é ela que a RLS lê (`user_org()` / `has_role()`).
insert into public.memberships (organization_id, user_id, role, status, joined_at)
select o.id, u.id, 'colaborador'::public.user_role, 'active', now()
from public.organizations o
join auth.users u on lower(u.email) in (
  'funcionario1@wcrsaneamento.com.br',
  'funcionario2@wcrsaneamento.com.br'
)
where o.slug = 'wcr-saneamento'
  and o.deleted_at is null
on conflict (organization_id, user_id) where deleted_at is null
do update set
  role       = 'colaborador'::public.user_role,
  status     = 'active',
  blocked_at = null,
  blocked_by = null,
  updated_at = now();

-- 2b. O perfil — só para quem ainda não tem.
--     ⚠️ Quem já tem perfil em OUTRA empresa NÃO tem o `organization_id` trocado: a empresa
--     ativa é escolhida pela própria pessoa no app (`set_default_organization`). Mexer aqui
--     tiraria alguém de dentro da empresa onde estava trabalhando.
insert into public.profiles (id, organization_id, full_name, email, role, activated_at)
select
  u.id,
  o.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), split_part(u.email, '@', 1)),
  u.email::citext,
  'colaborador'::public.user_role,
  now()
from public.organizations o
join auth.users u on lower(u.email) in (
  'funcionario1@wcrsaneamento.com.br',
  'funcionario2@wcrsaneamento.com.br'
)
where o.slug = 'wcr-saneamento'
  and o.deleted_at is null
  and not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;


-- ─── PASSO 3 — conferência. Rode e LEIA. ────────────────────────────────────────
-- Esperado: uma linha por funcionário, papel `colaborador`, status `active`, tem_perfil = true.
select
  u.email,
  m.role                                as papel,
  m.status,
  (p.id is not null)                    as tem_perfil,
  coalesce(p.full_name, '(sem nome)')   as nome
from public.organizations o
join public.memberships m on m.organization_id = o.id and m.deleted_at is null
join auth.users u on u.id = m.user_id
left join public.profiles p on p.id = u.id and p.deleted_at is null
where o.slug = 'wcr-saneamento'
  and m.role = 'colaborador'
order by u.email;


-- ─── PASSO 4 — quem ainda falta vincular (depois de mexer no app) ───────────────
-- O vínculo em si (`Worker.authUserId`) viaja no `payload` jsonb da tabela `workers`, e quem
-- o grava é a tela. Esta consulta só mostra o retrato: quem está amarrado a quê.
--
-- ⚠️ `conta_repetida = true` é defeito grave: duas pessoas na mesma conta significa uma
-- batendo o ponto que aparece no espelho da outra. Desvincule todas menos uma, na tela.
select
  w.name                                        as funcionario,
  w.payload->>'registrationNumber'              as matricula,
  w.payload->>'authUserId'                      as conta_vinculada,
  u.email,
  (w.payload->>'authUserId' is null)            as sem_vinculo,
  count(*) over (partition by w.payload->>'authUserId') > 1
    and w.payload->>'authUserId' is not null    as conta_repetida
from public.workers w
join public.organizations o on o.id = w.organization_id
left join auth.users u on u.id::text = w.payload->>'authUserId'
where o.slug = 'wcr-saneamento'
  and w.deleted_at is null
  and coalesce(w.status, 'active') <> 'inactive'
order by sem_vinculo desc, w.name;


-- ─── DESFAZER (se precisar tirar alguém do ponto) ───────────────────────────────
-- Bloquear a conta é melhor que apagar: o histórico de batidas continua íntegro, e um
-- registro de jornada apagado é exatamente o que o art. 74 da CLT não admite.
--
-- update public.memberships m
--    set status = 'blocked', blocked_at = now(), updated_at = now()
--   from public.organizations o
--  where m.organization_id = o.id
--    and o.slug = 'wcr-saneamento'
--    and m.user_id = (select id from auth.users where lower(email) = 'funcionario1@wcrsaneamento.com.br');
