# Arquitetura Supabase, multi-tenant, permissões e recuperação

Este documento define a base recomendada para o ConstruData operar com múltiplas empresas, usuários, módulos contratados, permissões por hierarquia e aprovações críticas. A premissa é: Supabase como banco inicial, segurança por padrão, separação forte por empresa e trilha de auditoria desde a primeira versão.

## 1. Dá para conectar o Codex ao Supabase?

Sim. Eu consigo ajudar de três formas:

1. Via arquivos locais do projeto: migrations SQL, tipos TypeScript, stores e serviços de sincronização.
2. Via Supabase CLI: depois de você configurar o projeto localmente, eu posso gerar, revisar e aplicar migrations.
3. Via MCP/integração Supabase, se estiver disponível no ambiente: eu posso ler schema, criar SQL e conferir políticas.

Não coloque `service_role` no frontend nem em código público. Se for necessário usar a chave administrativa, ela deve ficar apenas em variáveis de ambiente locais/servidor/CI, nunca no navegador.

## 2. Modelo recomendado

Para começar com muitos clientes no mesmo produto, use um modelo multi-tenant compartilhado:

- Uma única aplicação.
- Um único projeto Supabase/Postgres para produção inicial.
- Todas as tabelas de negócio com `organization_id`.
- Opcionalmente `project_id` e `nucleus_id` para separar projeto/núcleo dentro da empresa.
- Row Level Security em todas as tabelas expostas.
- Permissões por membership, papel e módulo.

Esse modelo escala bem operacionalmente e evita duplicar banco para cada cliente. Para clientes enterprise que exigirem isolamento máximo, você pode evoluir para modelo híbrido: clientes normais no banco compartilhado, clientes críticos em projeto Supabase dedicado.

## 3. Como os dados ficam separados por empresa?

Cada empresa vira uma `organization`. Cada usuário entra em uma ou mais organizações pela tabela `organization_members`. Toda tabela de negócio carrega `organization_id`.

Exemplo:

```sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  job_title text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
```

A separação real não depende do frontend esconder dados. Ela acontece no Postgres, por RLS. Mesmo que alguém tente consultar via API, a policy impede leitura fora da organização.

## 4. RBAC: papéis, permissões e hierarquia

Use papéis como:

- `owner`: dono da conta/empresa.
- `director`: diretor.
- `manager`: gerente.
- `engineer`: engenharia/planejamento.
- `buyer`: suprimentos.
- `measurement_analyst`: medição.
- `field_lead`: campo/RDO.
- `viewer`: leitura.

Permissões devem ser granulares:

- `suprimentos.read`
- `suprimentos.write`
- `suprimentos.delete`
- `suprimentos.approve`
- `medicao.approve`
- `gestao360.read`
- `admin.users.manage`
- `admin.modules.manage`

Estrutura:

```sql
create table public.role_permissions (
  role text not null,
  permission text not null,
  primary key (role, permission)
);

create table public.user_permissions_override (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  effect text not null check (effect in ('allow', 'deny')),
  primary key (organization_id, user_id, permission)
);
```

No frontend, o menu usa essas permissões para mostrar/ocultar módulos. No banco, a decisão final sempre fica nas policies e funções SQL.

## 5. RLS: regra central

Todas as tabelas públicas com dados de cliente devem ter:

```sql
alter table public.nome_da_tabela enable row level security;
```

Funções auxiliares:

```sql
create schema if not exists private;

create or replace function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function private.has_permission(org_id uuid, requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    join public.role_permissions rp on rp.role = m.role
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and rp.permission = requested_permission
  )
  and not exists (
    select 1
    from public.user_permissions_override o
    where o.organization_id = org_id
      and o.user_id = auth.uid()
      and o.permission = requested_permission
      and o.effect = 'deny'
  );
$$;
```

Policy padrão por tabela:

```sql
create policy "org members can read"
on public.suprimentos_purchase_orders
for select
to authenticated
using (private.is_org_member(organization_id));

create policy "authorized users can write"
on public.suprimentos_purchase_orders
for insert
to authenticated
with check (
  private.has_permission(organization_id, 'suprimentos.write')
);
```

## 6. Aprovações críticas por Gerente/Diretor

Para editar, excluir ou confirmar informações importantes, não faça a ação diretamente. Gere uma solicitação de aprovação.

```sql
create table public.approval_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null,
  action_key text not null,
  min_role text not null,
  require_mfa boolean not null default true,
  active boolean not null default true
);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null,
  action_key text not null,
  target_table text not null,
  target_id uuid not null,
  payload jsonb not null,
  requested_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  status text not null check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
```

Fluxo:

1. Usuário pede alteração crítica.
2. Sistema cria `approval_requests`.
3. Gerente/Diretor recebe pendência.
4. Banco valida permissão e MFA.
5. Uma Edge Function ou RPC aplica a mudança com auditoria.

Para ações muito sensíveis, use MFA com AAL2 na policy:

```sql
and (auth.jwt()->>'aal') = 'aal2'
```

## 7. Módulos contratados por cliente

Sim, isso também deve ficar no Supabase.

```sql
create table public.modules (
  key text primary key,
  name text not null
);

create table public.organization_modules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null references public.modules(key),
  enabled boolean not null default true,
  plan text not null default 'standard',
  primary key (organization_id, module_key)
);
```

O frontend usa `organization_modules` para montar o menu. As policies também podem checar se o módulo está ativo, impedindo acesso por API a dados de módulos não contratados.

## 8. Estrutura por módulo

Toda tabela de módulo deve seguir o padrão:

- `id uuid`
- `organization_id uuid`
- `project_id uuid null`
- `nucleus_id uuid null`
- `created_by uuid`
- `updated_by uuid`
- `created_at timestamptz`
- `updated_at timestamptz`
- `deleted_at timestamptz null`, quando precisar soft delete

Exemplos de tabelas por módulo:

- Suprimentos: OCs, itens de OC, recebimentos, notas fiscais, exceções, fornecedores, estoque, movimentações.
- Medição: boletins, itens Sabesp, subempreiteiros, fornecedores, critérios, conferências, medições finais.
- Planejamento: contratos, núcleos, trechos, cronogramas, LPS/lookahead, restrições.
- Gestão 360: snapshots de custo, ledger de custo, aprovações, eventos cross-module.
- RDO: diários, equipes, equipamentos, clima, produção, fotos.
- Qualidade: FVS, NCs, planos de ação.
- Financeiro/EVM: orçamento, PV, EV, AC, medições financeiras, NFs, eventos de custo.

## 9. Local Storage e sincronização

Local Storage não deve ser fonte de verdade. Ele pode ser cache de conveniência.

Recomendação:

- Fonte de verdade: Supabase/Postgres.
- Cache local: IndexedDB ou Local Storage para rascunhos, preferencialmente com versão e `organization_id`.
- Fila offline: tabela/local store `pending_actions`.
- Sync: ao reconectar, envia ações pendentes para RPCs validadas.
- Conflito: usar `updated_at`, `version` ou `row_hash`.

Nunca use Local Storage para permissões, tokens administrativos ou dados sensíveis sem criptografia. Permissões podem ser cacheadas para UX, mas a autorização final precisa vir do banco.

## 10. Backup, sumiço de dados e recuperação

Camadas recomendadas:

1. Backups automáticos Supabase: diários, conforme plano.
2. PITR em produção: recuperação para um ponto no tempo em caso de erro grave.
3. Dumps lógicos regulares: `supabase db dump` ou `pg_dump`, guardados fora da Supabase.
4. Export por organização: rotinas que exportam dados por `organization_id` para auditoria/recuperação seletiva.
5. Audit log imutável: toda ação crítica registrada.
6. Soft delete em dados importantes: evita perda por exclusão acidental.

Se sumir tudo:

1. Congelar escritas, colocando app em modo manutenção.
2. Identificar horário do incidente por `audit_log`.
3. Restaurar PITR para novo projeto Supabase, não sobrescrever produção imediatamente.
4. Comparar dados por `organization_id`.
5. Recuperar seletivamente a empresa/tabelas afetadas.
6. Reabrir produção após validação.

Se sumir só de uma empresa:

1. Usar `organization_id` para isolar o escopo.
2. Restaurar backup em ambiente paralelo.
3. Exportar apenas as linhas daquela organização.
4. Reimportar com scripts controlados e auditados.

## 11. Auditoria

Tabela mínima:

```sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  actor_user_id uuid references auth.users(id),
  module_key text not null,
  action_key text not null,
  target_table text,
  target_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
```

Para informações críticas, o audit log deve ser append-only: ninguém edita, ninguém exclui pelo app.

## 12. Segurança desde a primeira linha

Checklist obrigatório:

- RLS habilitado em todas as tabelas expostas.
- `organization_id` obrigatório nos dados de cliente.
- Chave `service_role` apenas no servidor/CI.
- MFA obrigatório para administradores e aprovadores.
- Policies com `to authenticated`.
- Funções `security definer` fora de schemas expostos quando possível.
- Auditoria para insert/update/delete críticos.
- Soft delete para dados operacionais importantes.
- Backups/PITR configurados antes de produção real.
- Separar dev/staging/prod em projetos Supabase diferentes.
- Revisar índices em `organization_id`, `project_id`, `nucleus_id`, `created_at`.
- Testes de RLS: usuário A não vê empresa B.

## 13. Escala para 10.000 usuários simultâneos

Pontos principais:

- Índices compostos por `organization_id` + campos de filtro.
- Evitar policies com joins pesados; usar funções estáveis e tabelas bem indexadas.
- Paginação em tabelas grandes.
- Agregações materializadas para dashboards 360.
- Realtime apenas onde for necessário.
- Separar leituras pesadas em views/materialized views.
- Read replicas quando a carga justificar.
- Edge Functions para operações administrativas e aprovações.
- Observabilidade: logs, métricas, slow queries e alertas.

## 14. Plano de implementação por fases

Fase 1: Fundação

- Criar organizations, profiles, memberships, roles, permissions, modules.
- Ativar RLS.
- Criar helpers de autorização.
- Criar audit_log.

Fase 2: Migração dos módulos

- Adicionar `organization_id`, `project_id`, `nucleus_id` nos dados.
- Criar tabelas Supabase por módulo.
- Criar camada de sync entre stores atuais e Supabase.
- Manter cache local como fallback temporário.

Fase 3: Aprovações

- Criar approval_rules e approval_requests.
- Implementar inbox de aprovações.
- Bloquear delete/update crítico sem aprovação.
- MFA para aprovadores.

Fase 4: Backup e governança

- PITR em produção.
- Dump lógico agendado.
- Export por organização.
- Runbook de recuperação.

Fase 5: Licenciamento por módulo

- `organization_modules`.
- Menu dinâmico.
- Policies impedindo acesso a módulos não contratados.
- Billing/planos depois, se necessário.

## 15. Referências oficiais

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase RBAC/custom claims: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase backups e PITR: https://supabase.com/docs/guides/platform/backups
