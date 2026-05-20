-- TESTE GERAL + tenant-safe maintenance module.
-- Every customer-domain row remains scoped by organizations.id.

do $$
declare
  v_owner_id uuid;
  v_org_id uuid;
begin
  select o.owner_id
    into v_owner_id
  from public.organizations o
  where o.deleted_at is null
    and o.owner_id is not null
    and o.slug in ('compizzo', 'consorcio-se-liga-na-rede-obra-santos')
  order by case o.slug when 'compizzo' then 0 else 1 end
  limit 1;

  if v_owner_id is null then
    select p.id
      into v_owner_id
    from public.profiles p
    where p.deleted_at is null
      and p.role = 'owner'
    order by p.created_at
    limit 1;
  end if;

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
  values (
    'TESTE GERAL',
    'teste-geral',
    'pro',
    50,
    20,
    v_owner_id,
    'production',
    jsonb_build_object(
      'environment', 'production',
      'approval_matrix', jsonb_build_object(
        'delete_fvs', 'diretor',
        'update_fvs_closed', 'gerente',
        'delete_rdo', 'gerente',
        'update_rdo_closed', 'gerente',
        'approve_budget', 'diretor',
        'delete_project', 'owner',
        'delete_organization', 'owner',
        'delete_maintenance_plan', 'gerente',
        'delete_maintenance_work_order', 'gerente'
      ),
      'mfa_required_roles', jsonb_build_array('owner', 'diretor'),
      'soft_delete_days', 30
    )
  )
  on conflict (slug) do update
    set name = excluded.name,
        environment = 'production',
        owner_id = coalesce(public.organizations.owner_id, excluded.owner_id),
        updated_at = now()
  returning id into v_org_id;

  if v_owner_id is not null then
    insert into public.memberships (
      organization_id,
      user_id,
      role,
      status,
      joined_at
    )
    values (
      v_org_id,
      v_owner_id,
      'owner',
      'active',
      now()
    )
    on conflict (organization_id, user_id) where deleted_at is null do update
      set role = 'owner',
          status = 'active',
          joined_at = coalesce(public.memberships.joined_at, now()),
          updated_at = now(),
          deleted_at = null;
  end if;
end $$;

alter table public.equipamentos
  add column if not exists construction_site_id uuid references public.construction_sites(id) on delete set null,
  add column if not exists criticality text not null default 'media',
  add column if not exists responsible text,
  add column if not exists location text,
  add column if not exists qr_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipamentos_criticality_check'
  ) then
    alter table public.equipamentos
      add constraint equipamentos_criticality_check
      check (criticality in ('baixa', 'media', 'alta', 'critica'));
  end if;
end $$;

create table if not exists public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  construction_site_id uuid references public.construction_sites(id) on delete set null,
  code text,
  title text not null,
  description text,
  frequency text not null default 'mensal',
  priority text not null default 'media',
  estimated_duration_minutes integer not null default 60,
  checklist jsonb not null default '[]'::jsonb,
  next_due_date date,
  last_generated_at timestamptz,
  active boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint maintenance_plans_priority_check check (priority in ('baixa', 'media', 'alta', 'critica')),
  constraint maintenance_plans_frequency_check check (frequency in ('unica', 'diaria', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'))
);

create table if not exists public.maintenance_plan_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.maintenance_plans(id) on delete cascade,
  asset_id uuid not null references public.equipamentos(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists ux_maintenance_plan_assets_active
  on public.maintenance_plan_assets(organization_id, plan_id, asset_id)
  where deleted_at is null;

create table if not exists public.maintenance_work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  construction_site_id uuid references public.construction_sites(id) on delete set null,
  plan_id uuid references public.maintenance_plans(id) on delete set null,
  code text,
  title text not null,
  description text,
  status text not null default 'pendente',
  priority text not null default 'media',
  severity text not null default 'media',
  planned boolean not null default true,
  progress integer not null default 0,
  scheduled_date date,
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  assignee text,
  requester text,
  estimated_duration_minutes integer not null default 60,
  actual_duration_minutes integer,
  estimated_cost numeric(12,2) not null default 0,
  actual_cost numeric(12,2) not null default 0,
  checklist jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  pmbok jsonb not null default '{}'::jsonb,
  lean_lps jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint maintenance_work_orders_status_check check (status in ('pendente', 'em_processo', 'em_verificacao', 'concluida', 'cancelada')),
  constraint maintenance_work_orders_priority_check check (priority in ('baixa', 'media', 'alta', 'critica')),
  constraint maintenance_work_orders_severity_check check (severity in ('baixa', 'media', 'alta', 'critica')),
  constraint maintenance_work_orders_progress_check check (progress >= 0 and progress <= 100)
);

create table if not exists public.maintenance_work_order_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_order_id uuid not null references public.maintenance_work_orders(id) on delete cascade,
  asset_id uuid not null references public.equipamentos(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists ux_maintenance_work_order_assets_active
  on public.maintenance_work_order_assets(organization_id, work_order_id, asset_id)
  where deleted_at is null;

create table if not exists public.maintenance_monitoring_points (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  construction_site_id uuid references public.construction_sites(id) on delete set null,
  asset_id uuid references public.equipamentos(id) on delete set null,
  code text,
  location_part text,
  description text not null,
  device_state text,
  enabled boolean not null default true,
  serial_number text,
  is_counter boolean not null default false,
  unit text,
  last_reading_date date,
  last_reading_value text,
  min_value numeric(14,4),
  max_value numeric(14,4),
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_maintenance_monitoring_org_enabled
  on public.maintenance_monitoring_points(organization_id, enabled, last_reading_date desc)
  where deleted_at is null;

create index if not exists idx_maintenance_plans_org_active
  on public.maintenance_plans(organization_id, active, next_due_date)
  where deleted_at is null;

create index if not exists idx_maintenance_work_orders_org_status
  on public.maintenance_work_orders(organization_id, status, due_date)
  where deleted_at is null;

create or replace function public.set_maintenance_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_maintenance_plans_updated_at on public.maintenance_plans;
create trigger trg_maintenance_plans_updated_at
  before update on public.maintenance_plans
  for each row execute function public.set_maintenance_updated_at();

drop trigger if exists trg_maintenance_work_orders_updated_at on public.maintenance_work_orders;
create trigger trg_maintenance_work_orders_updated_at
  before update on public.maintenance_work_orders
  for each row execute function public.set_maintenance_updated_at();

drop trigger if exists trg_maintenance_monitoring_points_updated_at on public.maintenance_monitoring_points;
create trigger trg_maintenance_monitoring_points_updated_at
  before update on public.maintenance_monitoring_points
  for each row execute function public.set_maintenance_updated_at();

alter table public.maintenance_plans enable row level security;
alter table public.maintenance_plans force row level security;
alter table public.maintenance_plan_assets enable row level security;
alter table public.maintenance_plan_assets force row level security;
alter table public.maintenance_work_orders enable row level security;
alter table public.maintenance_work_orders force row level security;
alter table public.maintenance_work_order_assets enable row level security;
alter table public.maintenance_work_order_assets force row level security;
alter table public.maintenance_monitoring_points enable row level security;
alter table public.maintenance_monitoring_points force row level security;

drop policy if exists maintenance_plans_select on public.maintenance_plans;
create policy maintenance_plans_select on public.maintenance_plans
  for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

drop policy if exists maintenance_plans_insert on public.maintenance_plans;
create policy maintenance_plans_insert on public.maintenance_plans
  for insert to authenticated
  with check (organization_id = public.user_org());

drop policy if exists maintenance_plans_update on public.maintenance_plans;
create policy maintenance_plans_update on public.maintenance_plans
  for update to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

drop policy if exists maintenance_plans_delete on public.maintenance_plans;
create policy maintenance_plans_delete on public.maintenance_plans
  for delete to authenticated
  using (false);

drop policy if exists maintenance_plan_assets_select on public.maintenance_plan_assets;
create policy maintenance_plan_assets_select on public.maintenance_plan_assets
  for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

drop policy if exists maintenance_plan_assets_insert on public.maintenance_plan_assets;
create policy maintenance_plan_assets_insert on public.maintenance_plan_assets
  for insert to authenticated
  with check (organization_id = public.user_org());

drop policy if exists maintenance_plan_assets_update on public.maintenance_plan_assets;
create policy maintenance_plan_assets_update on public.maintenance_plan_assets
  for update to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

drop policy if exists maintenance_plan_assets_delete on public.maintenance_plan_assets;
create policy maintenance_plan_assets_delete on public.maintenance_plan_assets
  for delete to authenticated
  using (false);

drop policy if exists maintenance_work_orders_select on public.maintenance_work_orders;
create policy maintenance_work_orders_select on public.maintenance_work_orders
  for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

drop policy if exists maintenance_work_orders_insert on public.maintenance_work_orders;
create policy maintenance_work_orders_insert on public.maintenance_work_orders
  for insert to authenticated
  with check (organization_id = public.user_org());

drop policy if exists maintenance_work_orders_update on public.maintenance_work_orders;
create policy maintenance_work_orders_update on public.maintenance_work_orders
  for update to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

drop policy if exists maintenance_work_orders_delete on public.maintenance_work_orders;
create policy maintenance_work_orders_delete on public.maintenance_work_orders
  for delete to authenticated
  using (false);

drop policy if exists maintenance_work_order_assets_select on public.maintenance_work_order_assets;
create policy maintenance_work_order_assets_select on public.maintenance_work_order_assets
  for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

drop policy if exists maintenance_work_order_assets_insert on public.maintenance_work_order_assets;
create policy maintenance_work_order_assets_insert on public.maintenance_work_order_assets
  for insert to authenticated
  with check (organization_id = public.user_org());

drop policy if exists maintenance_work_order_assets_update on public.maintenance_work_order_assets;
create policy maintenance_work_order_assets_update on public.maintenance_work_order_assets
  for update to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

drop policy if exists maintenance_work_order_assets_delete on public.maintenance_work_order_assets;
create policy maintenance_work_order_assets_delete on public.maintenance_work_order_assets
  for delete to authenticated
  using (false);

drop policy if exists maintenance_monitoring_points_select on public.maintenance_monitoring_points;
create policy maintenance_monitoring_points_select on public.maintenance_monitoring_points
  for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

drop policy if exists maintenance_monitoring_points_insert on public.maintenance_monitoring_points;
create policy maintenance_monitoring_points_insert on public.maintenance_monitoring_points
  for insert to authenticated
  with check (organization_id = public.user_org());

drop policy if exists maintenance_monitoring_points_update on public.maintenance_monitoring_points;
create policy maintenance_monitoring_points_update on public.maintenance_monitoring_points
  for update to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

drop policy if exists maintenance_monitoring_points_delete on public.maintenance_monitoring_points;
create policy maintenance_monitoring_points_delete on public.maintenance_monitoring_points
  for delete to authenticated
  using (false);

grant select, insert, update, delete on public.maintenance_plans to authenticated;
grant select, insert, update, delete on public.maintenance_plan_assets to authenticated;
grant select, insert, update, delete on public.maintenance_work_orders to authenticated;
grant select, insert, update, delete on public.maintenance_work_order_assets to authenticated;
grant select, insert, update, delete on public.maintenance_monitoring_points to authenticated;

do $$
declare
  r record;
  trigger_name text;
begin
  for r in
    with org_tables as (
      select c.oid, n.nspname, c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and exists (
           select 1
             from pg_attribute a
            where a.attrelid = c.oid
              and a.attname = 'organization_id'
              and not a.attisdropped
         )
    )
    select con.conname,
           child.nspname as child_schema,
           child.relname as child_table,
           parent.nspname as parent_schema,
           parent.relname as parent_table,
           ca.attname as child_col,
           pa.attname as parent_col
      from pg_constraint con
      join org_tables child on child.oid = con.conrelid
      join org_tables parent on parent.oid = con.confrelid
      join lateral unnest(con.conkey, con.confkey) with ordinality as x(attnum, pattnum, ord) on true
      join pg_attribute ca on ca.attrelid = con.conrelid and ca.attnum = x.attnum
      join pg_attribute pa on pa.attrelid = con.confrelid and pa.attnum = x.pattnum
     where con.contype = 'f'
       and array_length(con.conkey, 1) = 1
       and array_length(con.confkey, 1) = 1
       and child.relname in (
         'equipamentos',
         'maintenance_plans',
         'maintenance_plan_assets',
         'maintenance_work_orders',
         'maintenance_work_order_assets',
         'maintenance_monitoring_points'
       )
  loop
    trigger_name := 'tenant_fk_' || substr(md5(r.child_table || '_' || r.conname), 1, 24);

    execute format('drop trigger if exists %I on %I.%I', trigger_name, r.child_schema, r.child_table);
    execute format(
      'create trigger %I before insert or update of organization_id, %I on %I.%I for each row execute function public.enforce_same_organization_fk(%L, %L, %L, %L)',
      trigger_name,
      r.child_col,
      r.child_schema,
      r.child_table,
      r.parent_schema,
      r.parent_table,
      r.child_col,
      r.parent_col
    );
  end loop;
end $$;
