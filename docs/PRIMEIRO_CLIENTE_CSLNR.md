# Primeiro cliente: Consórcio Se Liga Na Rede - Obra Santos

Este documento é o guia operacional para criar sua conta global, criar empresas/obras e vincular usuários pelo SQL Editor do Supabase.

## Conceito correto

Seu e-mail `joaodsouzanery@gmail.com` deve ser um **login global** da plataforma.

Isso significa:

- Você usa um único e-mail e uma única senha para entrar.
- Esse mesmo login pode ser vinculado a quantas empresas/obras você quiser.
- Cada empresa/obra fica isolada por `organization_id`.
- Cada empresa/obra tambem tem um ambiente explicito em `organizations.environment`: `production`, `homologation` ou `demo`.
- Você enxerga uma empresa por vez no app, escolhendo a empresa ativa no seletor lateral.
- Usuários dos clientes normalmente terão vínculo com apenas uma empresa e, por isso, não precisarão trocar de empresa.

Não existe uma senha separada por empresa para o mesmo e-mail. A senha é da identidade global. O acesso a cada empresa é definido por `memberships`.

## Por que não criar uma senha por empresa?

Não é o modelo mais inteligente para o seu caso. A senha pertence à identidade da pessoa; a empresa pertence ao vínculo dessa pessoa com uma `organization`.

O fluxo correto é:

1. Você entra uma vez com `joaodsouzanery@gmail.com` e sua senha global.
2. O sistema carrega todas as empresas nas quais seu usuário tem `membership` ativa.
3. Você escolhe a empresa ativa no seletor lateral.
4. A partir desse momento, todas as telas filtram dados por `organization_id`.
5. Para ver outra empresa, você troca a empresa ativa. Não precisa sair nem usar outra senha.

Isso é mais seguro porque:

- evita várias senhas para a mesma pessoa;
- mantém auditoria correta, sempre ligada ao mesmo usuário global;
- permite ver CSLNR, Empresa 2, Empresa 3 etc. sem misturar dados;
- permite bloquear seu acesso a uma empresa específica sem apagar seu usuário global;
- mantém cada cliente isolado por RLS e `organization_id`.

Se você criasse uma senha por empresa usando o mesmo e-mail, isso não funcionaria bem no Supabase Auth, porque o e-mail é a identidade única do usuário. Se criasse e-mails diferentes para cada empresa, a auditoria ficaria pior e você teria que alternar contas manualmente.

## Quando criar uma nova empresa/obra

Sempre que fechar uma nova empresa/obra:

1. Crie uma nova linha em `public.organizations`.
2. Vincule seu usuário global como `owner` em `public.memberships`.
3. Defina se essa empresa deve virar a empresa ativa em `public.profiles.organization_id`.
4. Convide os usuários da empresa com o papel correto.
5. Entre no app e selecione a empresa ativa no menu lateral.

## Empresa oficial x empresa de homologacao

Para testar com dados reais sem contaminar a obra oficial, use duas empresas separadas:

- **Oficial:** `Consorcio Se Liga Na Rede - Obra Santos`
- **Homologacao:** `Consorcio Se Liga Na Rede - Obra Santos - Homologacao`

As duas aparecem no seu controle global porque seu mesmo usuario global fica com `membership` ativa nas duas. A diferenca e operacional:

- Na empresa oficial ficam apenas dados validados para uso do cliente.
- Na empresa de homologacao ficam testes de RDO, Medicao, Qualidade, fotos, assinaturas, importacoes e ajustes.
- A coluna `organizations.environment = 'homologation'` deixa claro que os dados sao de teste, mesmo aparecendo no seu controle global.
- Usuarios do cliente normalmente entram apenas na empresa oficial, salvo quando voce quiser liberar alguem para homologacao.
- Indicadores, medicoes, RDOs e documentos nao se misturam porque cada linha tem `organization_id` diferente.

Use Homologacao para:

- testar foto de RDO automatico;
- testar leitura de campos, servicos, quantidades e assinaturas;
- validar se o RDO finalizado gera linhas em `measurement_sources`;
- testar fluxo de Qualidade e bloqueios/glosas;
- treinar usuarios antes de abrir a empresa oficial.

Quando um teste estiver bom, nao "mova" os dados para a empresa oficial. Refaça ou importe apenas os dados validados na organizacao oficial, mantendo auditoria limpa.

### Como visualizar X, Y e Z no mesmo login global

O seu login global pode ter `membership` em varias empresas. A separacao acontece assim:

1. Voce faz login uma vez.
2. O seletor de empresa mostra todas as `organizations` em que seu usuario tem `membership` ativa.
3. Ao escolher `Homologacao`, o app passa a ler e gravar dados com o `organization_id` da homologacao. Voce ve X.
4. Ao escolher `Consorcio Se Liga Na Rede - Obra Santos`, o app passa a usar o `organization_id` oficial. Voce ve Y.
5. Ao escolher uma terceira empresa, o app usa o terceiro `organization_id`. Voce ve Z.

O mesmo email e a mesma senha continuam valendo. O que muda e a empresa ativa. RLS, stores e consultas remotas filtram pelos vinculos da sua conta.

### SQL: criar empresa de homologacao e vincular seu admin global

Antes de rodar, confirme que o usuario ja existe em **Authentication > Users**.

```sql
with settings as (
  select
    'joaoneryflu@gmail.com'::text as admin_email,
    'Joao Souza Nery'::text as admin_name,
    'Consorcio Se Liga Na Rede - Obra Santos - Homologacao'::text as org_name,
    'consorcio-se-liga-na-rede-obra-santos-homologacao'::text as org_slug
), admin_user as (
  select u.id, u.email
  from auth.users u
  where lower(u.email) = lower((select admin_email from settings))
  limit 1
), update_org as (
  update public.organizations o
     set name = s.org_name,
         plan = 'pro'::public.org_plan,
         max_users = greatest(o.max_users, 20),
         max_projects = greatest(o.max_projects, 10),
         owner_id = (select id from admin_user),
         environment = 'homologation',
         settings = coalesce(o.settings, '{}'::jsonb) || jsonb_build_object(
           'client', 'Consorcio Se Liga Na Rede',
           'obra', 'Santos',
           'environment', 'homologation',
           'created_by', 'sql_editor_homologation_bootstrap'
         ),
         deleted_at = null,
         updated_at = now()
    from settings s
   where o.slug = s.org_slug
  returning o.id, o.name, o.slug
), insert_org as (
  insert into public.organizations (
    name,
    slug,
    plan,
    max_users,
    max_projects,
    owner_id,
    environment,
    settings
  )
  select
    s.org_name,
    s.org_slug,
    'pro'::public.org_plan,
    20,
    10,
    (select id from admin_user),
    'homologation',
    jsonb_build_object(
      'client', 'Consorcio Se Liga Na Rede',
      'obra', 'Santos',
      'environment', 'homologation',
      'created_by', 'sql_editor_homologation_bootstrap'
    )
  from settings s
  where exists (select 1 from admin_user)
    and not exists (select 1 from update_org)
  returning id, name, slug
), target_org as (
  select id, name, slug from update_org
  union all
  select id, name, slug from insert_org
), update_profile as (
  update public.profiles p
     set full_name = (select admin_name from settings),
         email = (select email from admin_user),
         role = 'owner'::public.user_role,
         deleted_at = null,
         updated_at = now()
   where p.id = (select id from admin_user)
  returning p.id
), insert_profile as (
  insert into public.profiles (
    id,
    organization_id,
    full_name,
    email,
    role,
    activated_at
  )
  select
    au.id,
    o.id,
    (select admin_name from settings),
    au.email,
    'owner'::public.user_role,
    now()
  from admin_user au
  cross join target_org o
  where not exists (select 1 from update_profile)
  returning id
), update_membership as (
  update public.memberships m
     set role = 'owner'::public.user_role,
         status = 'active',
         blocked_at = null,
         block_reason = null,
         joined_at = coalesce(m.joined_at, now()),
         updated_at = now()
    from target_org o, admin_user au
   where m.organization_id = o.id
     and m.user_id = au.id
     and m.deleted_at is null
  returning m.id
), insert_membership as (
  insert into public.memberships (
    organization_id,
    user_id,
    role,
    status,
    joined_at
  )
  select
    o.id,
    au.id,
    'owner'::public.user_role,
    'active',
    now()
  from target_org o
  cross join admin_user au
  where not exists (select 1 from update_membership)
  returning id
), audit as (
  insert into public.audit_log (
    organization_id,
    actor_id,
    action,
    table_name,
    record_id,
    after
  )
  select
    o.id,
    au.id,
    'create_homologation_company',
    'organizations',
    o.id::text,
    jsonb_build_object(
      'organization', o.name,
      'slug', o.slug,
      'global_admin', au.email,
      'environment', 'homologacao'
    )
  from target_org o
  cross join admin_user au
  returning id
)
select
  o.id as organization_id,
  o.name,
  o.slug,
  (select email from admin_user) as global_admin_email
from target_org o;
```

## Script completo: criar login global + Obra Santos

## Se aparecer `must be owner of table users`

Esse erro significa que o SQL Editor do Supabase não pode criar ou alterar diretamente `auth.users` no seu projeto. Nesse caso, o fluxo correto é:

1. Criar o login pelo painel do Supabase.
2. Rodar o SQL apenas para criar empresa, perfil e vínculo.

### Passo 1: criar o usuário no Supabase Auth

No Supabase:

1. Vá em **Authentication > Users**.
2. Clique em **Add user**.
3. E-mail: `joaodsouzanery@gmail.com`.
4. Defina uma senha forte.
5. Marque/garanta que o e-mail fique confirmado.
6. Salve.

Depois rode o script abaixo no **SQL Editor**.

> Importante: este script não mexe em `auth.users`. Ele só busca o usuário já criado e cria/atualiza `organizations`, `profiles`, `memberships` e `audit_log`.

```sql
with settings as (
  select
    'joaodsouzanery@gmail.com'::text as admin_email,
    'João Souza Nery'::text as admin_name,
    'Consórcio Se Liga Na Rede - Obra Santos'::text as org_name,
    'consorcio-se-liga-na-rede-obra-santos'::text as org_slug
), admin_user as (
  select u.id, u.email
  from auth.users u
  where lower(u.email) = lower((select admin_email from settings))
  limit 1
), guard as (
  select 1
  from admin_user
), update_org as (
  update public.organizations o
     set name = s.org_name,
         plan = 'pro'::public.org_plan,
         max_users = greatest(o.max_users, 80),
         max_projects = greatest(o.max_projects, 30),
         owner_id = (select id from admin_user),
         settings = coalesce(o.settings, '{}'::jsonb) || jsonb_build_object(
           'client', 'Consórcio Se Liga Na Rede',
           'obra', 'Santos',
           'created_by', 'sql_editor_public_bootstrap'
         ),
         deleted_at = null,
         updated_at = now()
    from settings s
   where o.slug = s.org_slug
  returning o.id, o.name, o.slug
), insert_org as (
  insert into public.organizations (
    name,
    slug,
    plan,
    max_users,
    max_projects,
    owner_id,
    settings
  )
  select
    s.org_name,
    s.org_slug,
    'pro'::public.org_plan,
    80,
    30,
    (select id from admin_user),
    jsonb_build_object(
      'client', 'Consórcio Se Liga Na Rede',
      'obra', 'Santos',
      'created_by', 'sql_editor_public_bootstrap'
    )
  from settings s
  cross join guard
  where not exists (select 1 from update_org)
    and not exists (
      select 1
      from public.organizations o
      where o.slug = s.org_slug
    )
  returning id, name, slug
), upsert_org as (
  select id, name, slug from update_org
  union all
  select id, name, slug from insert_org
), update_profile as (
  update public.profiles p
     set organization_id = o.id,
         full_name = (select admin_name from settings),
         email = a.email::citext,
         role = 'owner'::public.user_role,
         deleted_at = null,
         updated_at = now()
    from admin_user a
    cross join upsert_org o
   where p.id = a.id
  returning p.id
), insert_profile as (
  insert into public.profiles (
    id,
    organization_id,
    full_name,
    email,
    role,
    activated_at
  )
  select
    a.id,
    o.id,
    (select admin_name from settings),
    a.email::citext,
    'owner'::public.user_role,
    now()
  from admin_user a
  cross join upsert_org o
  where not exists (select 1 from update_profile)
    and not exists (
      select 1
      from public.profiles p
      where p.id = a.id
    )
  returning id
), upsert_profile as (
  select id from update_profile
  union all
  select id from insert_profile
), update_membership as (
  update public.memberships m
     set role = 'owner'::public.user_role,
         status = 'active',
         blocked_at = null,
         blocked_by = null,
         block_reason = null,
         joined_at = coalesce(m.joined_at, now()),
         updated_at = now()
    from upsert_org o
    cross join admin_user a
   where m.organization_id = o.id
     and m.user_id = a.id
     and m.deleted_at is null
  returning m.id
), insert_membership as (
  insert into public.memberships (
    organization_id,
    user_id,
    role,
    status,
    joined_at
  )
  select
    o.id,
    a.id,
    'owner'::public.user_role,
    'active',
    now()
  from upsert_org o
  cross join admin_user a
  where not exists (select 1 from update_membership)
    and not exists (
      select 1
      from public.memberships m
      where m.organization_id = o.id
        and m.user_id = a.id
        and m.deleted_at is null
    )
  returning id
), upsert_membership as (
  select id from update_membership
  union all
  select id from insert_membership
), audit as (
  insert into public.audit_log (
    organization_id,
    actor_id,
    action,
    table_name,
    record_id,
    after
  )
  select
    o.id,
    (select id from admin_user),
    'platform_bootstrap_global_admin_and_first_work',
    'organizations',
    o.id::text,
    jsonb_build_object(
      'organization', o.name,
      'slug', o.slug,
      'global_admin', (select email from admin_user),
      'membership_role', 'owner'
    )
  from upsert_org o
  returning id
)
select
  o.id as organization_id,
  o.name,
  o.slug,
  (select email from admin_user) as global_admin_email,
  (select count(*) from upsert_membership) as memberships_touched
from upsert_org o;
```

Se o usuário não existir no Auth, o script simplesmente não retorna linhas. Isso quer dizer: volte em **Authentication > Users**, crie `joaodsouzanery@gmail.com` e rode novamente.

## Script legado: criar login global + Obra Santos via SQL

Use este script no **Supabase Dashboard > SQL Editor** apenas se seu projeto permitir alterar `auth.users`. Ele é o bloco correto para criar/atualizar:

- seu login global `joaodsouzanery@gmail.com`;
- a senha global desse login;
- a empresa/obra `Consórcio Se Liga Na Rede - Obra Santos`;
- seu vínculo `owner` nessa empresa;
- a empresa ativa do seu perfil.

Se aparecer o erro `column "id" is of type uuid but expression is of type text`, significa que você colou uma versão antiga do bloco. Na parte `insert into auth.identities`, a coluna `id` deve receber `u.id`, sem `::text`. O trecho correto é:

```sql
select
  u.id,
  u.id,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  u.email,
  now(),
  now(),
  now()
from upsert_auth_user u
```

Depois disso, cole o script completo abaixo.

> Importante: esta versão não usa `ON CONFLICT`, porque o schema atual do banco não tem todas as constraints únicas que um upsert comum exigiria. Ela faz `update` + `insert where not exists`, que funciona mesmo sem essas constraints.

Antes de rodar, troque:

- `TROQUE_POR_UMA_SENHA_FORTE` por uma senha forte sua.
- Se quiser, ajuste `max_users` e `max_projects`.

> Observação de segurança: o script abaixo é um bootstrap manual. Ele é aceitável para provisionamento controlado pelo SQL Editor, mas o fluxo definitivo deve ser um painel/admin function protegida por `service_role` e secret.

```sql
-- Bootstrap manual: cria/atualiza o login global do operador
-- e cria a primeira empresa/obra.

with settings as (
  select
    'joaodsouzanery@gmail.com'::text as admin_email,
    'João Souza Nery'::text as admin_name,
    'TROQUE_POR_UMA_SENHA_FORTE'::text as admin_password,
    'Consórcio Se Liga Na Rede - Obra Santos'::text as org_name,
    'consorcio-se-liga-na-rede-obra-santos'::text as org_slug
), update_auth_user as (
  update auth.users u
     set encrypted_password = crypt(s.admin_password, gen_salt('bf')),
         email_confirmed_at = coalesce(u.email_confirmed_at, now()),
         raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
         raw_user_meta_data = jsonb_build_object('full_name', s.admin_name),
         updated_at = now()
    from settings s
   where lower(u.email) = lower(s.admin_email)
  returning u.id, u.email
), insert_auth_user as (
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_sent_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid,
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    lower(admin_email),
    crypt(admin_password, gen_salt('bf')),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', admin_name),
    false,
    now(),
    now()
  from settings
  where not exists (select 1 from update_auth_user)
    and not exists (
      select 1
      from auth.users u
      where lower(u.email) = lower((select admin_email from settings))
    )
  returning id, email
), upsert_auth_user as (
  select id, email from update_auth_user
  union all
  select id, email from insert_auth_user
), update_existing_identity as (
  update auth.identities i
     set user_id = u.id,
         identity_data = jsonb_build_object(
           'sub', u.id::text,
           'email', u.email,
           'email_verified', true,
           'phone_verified', false
         ),
         updated_at = now()
    from upsert_auth_user u
   where (i.provider = 'email' and i.provider_id = u.email)
      or i.user_id = u.id
      or i.id = u.id
  returning i.user_id
), insert_identity as (
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  select
    u.id,
    u.id,
    jsonb_build_object(
      'sub', u.id::text,
      'email', u.email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    u.email,
    now(),
    now(),
    now()
  from upsert_auth_user u
  where not exists (select 1 from update_existing_identity)
    and not exists (
      select 1
      from auth.identities i
      where (i.provider = 'email' and i.provider_id = u.email)
         or i.user_id = u.id
         or i.id = u.id
    )
  returning user_id
), upsert_identity as (
  select user_id from update_existing_identity
  union all
  select user_id from insert_identity
), update_org as (
  update public.organizations o
     set name = s.org_name,
         plan = 'pro'::public.org_plan,
         max_users = greatest(o.max_users, 80),
         max_projects = greatest(o.max_projects, 30),
         owner_id = (select id from upsert_auth_user),
         settings = coalesce(o.settings, '{}'::jsonb) || jsonb_build_object(
           'client', 'Consórcio Se Liga Na Rede',
           'obra', 'Santos',
           'created_by', 'sql_editor_bootstrap'
         ),
         deleted_at = null,
         updated_at = now()
    from settings s
   where o.slug = s.org_slug
  returning o.id, o.name, o.slug
), insert_org as (
  insert into public.organizations (
    name,
    slug,
    plan,
    max_users,
    max_projects,
    owner_id,
    settings
  )
  select
    org_name,
    org_slug,
    'pro'::public.org_plan,
    80,
    30,
    (select id from upsert_auth_user),
    jsonb_build_object(
      'client', 'Consórcio Se Liga Na Rede',
      'obra', 'Santos',
      'created_by', 'sql_editor_bootstrap'
    )
  from settings
  where not exists (select 1 from update_org)
    and not exists (
      select 1
      from public.organizations o
      where o.slug = (select org_slug from settings)
    )
  returning id, name, slug
), upsert_org as (
  select id, name, slug from update_org
  union all
  select id, name, slug from insert_org
), update_profile as (
  update public.profiles p
     set organization_id = o.id,
         full_name = (select admin_name from settings),
         email = u.email::citext,
         role = 'owner'::public.user_role,
         deleted_at = null,
         updated_at = now()
    from upsert_auth_user u
    cross join upsert_org o
   where p.id = u.id
  returning p.id
), insert_profile as (
  insert into public.profiles (
    id,
    organization_id,
    full_name,
    email,
    role,
    activated_at
  )
  select
    u.id,
    o.id,
    (select admin_name from settings),
    u.email::citext,
    'owner'::public.user_role,
    now()
  from upsert_auth_user u
  cross join upsert_org o
  where not exists (select 1 from update_profile)
    and not exists (
      select 1
      from public.profiles p
      where p.id = u.id
    )
  returning id
), upsert_profile as (
  select id from update_profile
  union all
  select id from insert_profile
), update_existing_membership as (
  update public.memberships m
     set role = 'owner'::public.user_role,
         status = 'active',
         blocked_at = null,
         blocked_by = null,
         block_reason = null,
         joined_at = coalesce(m.joined_at, now()),
         updated_at = now()
    from upsert_org o
    cross join upsert_auth_user u
   where m.organization_id = o.id
     and m.user_id = u.id
     and m.deleted_at is null
  returning m.id
), insert_membership as (
  insert into public.memberships (
    organization_id,
    user_id,
    role,
    status,
    joined_at
  )
  select
    o.id,
    u.id,
    'owner'::public.user_role,
    'active',
    now()
  from upsert_org o
  cross join upsert_auth_user u
  where not exists (select 1 from update_existing_membership)
    and not exists (
      select 1
      from public.memberships m
      where m.organization_id = o.id
        and m.user_id = u.id
        and m.deleted_at is null
    )
  returning id
), upsert_membership as (
  select id from update_existing_membership
  union all
  select id from insert_membership
), audit as (
  insert into public.audit_log (
    organization_id,
    actor_id,
    action,
    table_name,
    record_id,
    after
  )
  select
    o.id,
    (select id from upsert_auth_user),
    'platform_bootstrap_global_admin_and_first_work',
    'organizations',
    o.id::text,
    jsonb_build_object(
      'organization', o.name,
      'slug', o.slug,
      'global_admin', (select email from upsert_auth_user),
      'membership_role', 'owner'
    )
  from upsert_org o
  returning id
)
select
  o.id as organization_id,
  o.name,
  o.slug,
  (select email from upsert_auth_user) as global_admin_email,
  (select count(*) from upsert_membership) as memberships_touched
from upsert_org o;
```

Depois de rodar, acesse:

```text
https://www.construdata.software/login
```

Use:

```text
E-mail: joaodsouzanery@gmail.com
Senha: a senha que você colocou em TROQUE_POR_UMA_SENHA_FORTE
```

## Script para criar uma nova empresa/obra depois

Use este modelo para cada nova empresa/obra.

Troque:

- `NOME_DA_EMPRESA_OU_OBRA`
- `slug-da-empresa-ou-obra`

```sql
with settings as (
  select
    'joaodsouzanery@gmail.com'::text as admin_email,
    'NOME_DA_EMPRESA_OU_OBRA'::text as org_name,
    'slug-da-empresa-ou-obra'::text as org_slug
), admin_user as (
  select id, email
  from auth.users
  where email = lower((select admin_email from settings))
  limit 1
), update_org as (
  update public.organizations o
     set name = s.org_name,
         owner_id = (select id from admin_user),
         deleted_at = null,
         updated_at = now()
    from settings s
   where o.slug = s.org_slug
  returning o.id, o.name, o.slug
), insert_org as (
  insert into public.organizations (
    name,
    slug,
    plan,
    max_users,
    max_projects,
    owner_id,
    settings
  )
  select
    org_name,
    org_slug,
    'pro'::public.org_plan,
    80,
    30,
    (select id from admin_user),
    jsonb_build_object('created_by', 'sql_editor_admin')
  from settings
  where not exists (select 1 from update_org)
    and not exists (
      select 1
      from public.organizations o
      where o.slug = (select org_slug from settings)
    )
  returning id, name, slug
), upsert_org as (
  select id, name, slug from update_org
  union all
  select id, name, slug from insert_org
), update_existing_membership as (
  update public.memberships m
     set role = 'owner'::public.user_role,
         status = 'active',
         blocked_at = null,
         blocked_by = null,
         block_reason = null,
         joined_at = coalesce(m.joined_at, now()),
         updated_at = now()
    from upsert_org o
    cross join admin_user a
   where m.organization_id = o.id
     and m.user_id = a.id
     and m.deleted_at is null
  returning m.id
), insert_membership as (
  insert into public.memberships (
    organization_id,
    user_id,
    role,
    status,
    joined_at
  )
  select
    o.id,
    a.id,
    'owner'::public.user_role,
    'active',
    now()
  from upsert_org o
  cross join admin_user a
  where not exists (select 1 from update_existing_membership)
    and not exists (
      select 1
      from public.memberships m
      where m.organization_id = o.id
        and m.user_id = a.id
        and m.deleted_at is null
    )
  returning id
), upsert_membership as (
  select id from update_existing_membership
  union all
  select id from insert_membership
), set_active_profile as (
  update public.profiles p
  set organization_id = (select id from upsert_org),
      role = 'owner'::public.user_role,
      updated_at = now()
  where p.id = (select id from admin_user)
  returning id
), audit as (
  insert into public.audit_log (
    organization_id,
    actor_id,
    action,
    table_name,
    record_id,
    after
  )
  select
    o.id,
    (select id from admin_user),
    'platform_create_customer_work',
    'organizations',
    o.id::text,
    jsonb_build_object(
      'organization', o.name,
      'slug', o.slug,
      'global_admin', (select email from admin_user)
    )
  from upsert_org o
  returning id
)
select
  o.id as organization_id,
  o.name,
  o.slug,
  (select email from admin_user) as global_admin_email,
  (select count(*) from upsert_membership) as memberships_touched
from upsert_org o;
```

## Convidar usuários da empresa

Depois de criar a empresa/obra, convide os usuários pelo RPC:

```sql
select *
from public.invite_org_member('email@cliente.com', 'engenheiro'::public.user_role);
```

Papéis disponíveis:

- `owner`
- `diretor`
- `gerente`
- `engenheiro`
- `qualidade`
- `planejador`
- `comprador`
- `visualizador`

O link de aceite fica:

```text
https://www.construdata.software/aceitar-convite?token=TOKEN_RETORNADO
```

## Como você alterna entre empresas

Quando seu e-mail tiver membership ativa em mais de uma empresa:

1. Entre em `/login`.
2. Abra o menu lateral.
3. Use o seletor de empresa ativa.
4. O sistema chama `set_default_organization`.
5. A plataforma recarrega filtrando os dados pela nova `organization_id`.

O cliente comum, com uma única empresa, não terá esse fluxo de troca.

## Login salvo

A plataforma mantém sessão persistida no navegador. Além disso, a tela de login lembra seu e-mail neste dispositivo.

A senha deve ser salva pelo gerenciador de senhas do navegador. A plataforma não salva senha em texto puro.
