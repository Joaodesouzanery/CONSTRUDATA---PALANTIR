-- Align production measurement_sources with the unified measurement workflow.
-- Keeps spreadsheet/RDO/manual sources auditable by operational key and import origin.

alter table public.measurement_sources
  drop constraint if exists measurement_sources_kind_check;

alter table public.measurement_sources
  add constraint measurement_sources_kind_check
  check (
    source_kind in (
      'rdo',
      'rdo_sabesp',
      'spreadsheet',
      'manual',
      'manual_entry',
      'engineering_adjustment',
      'financial_adjustment',
      'suprimentos',
      'quality_return'
    )
  );

alter table public.measurement_sources
  add column if not exists project_id uuid,
  add column if not exists contract_no text,
  add column if not exists local text,
  add column if not exists street text,
  add column if not exists service_order text,
  add column if not exists n_preco text,
  add column if not exists source_workbook_name text,
  add column if not exists source_sheet text,
  add column if not exists source_row integer,
  add column if not exists parse_confidence numeric,
  add column if not exists import_warnings text[] not null default array[]::text[],
  add column if not exists blocking_issues text[] not null default array[]::text[],
  add column if not exists period_id uuid,
  add column if not exists status text not null default 'pending_review',
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists manual_reason text,
  add column if not exists evidence_url text,
  add column if not exists unit_price numeric not null default 0,
  add column if not exists contract_item_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'measurement_sources_status_check'
      and conrelid = 'public.measurement_sources'::regclass
  ) then
    alter table public.measurement_sources
      add constraint measurement_sources_status_check
      check (status in ('draft', 'pending_review', 'approved', 'rejected', 'glossed', 'blocked'));
  end if;
end $$;

create table if not exists public.measurement_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid,
  created_by uuid not null references auth.users(id),
  period_label text not null,
  starts_on date,
  ends_on date,
  contract_no text,
  status text not null default 'draft',
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint measurement_periods_status_check check (status in ('draft', 'in_review', 'closed', 'canceled'))
);

create table if not exists public.measurement_contract_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid,
  period_id uuid references public.measurement_periods(id) on delete set null,
  created_by uuid not null references auth.users(id),
  item_code text,
  n_preco text,
  description text not null,
  unit text,
  contracted_quantity numeric not null default 0,
  previous_quantity numeric not null default 0,
  unit_price numeric not null default 0,
  retention_percent numeric not null default 0,
  retention_rule text,
  measurement_rule text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.measurement_memory_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid,
  period_id uuid references public.measurement_periods(id) on delete set null,
  source_id uuid references public.measurement_sources(id) on delete set null,
  created_by uuid not null references auth.users(id),
  rdo_id text,
  rdo_type text,
  contractor_id uuid references public.contractors(id) on delete set null,
  contract_item_id uuid references public.measurement_contract_items(id) on delete set null,
  n_preco text,
  service_description text not null,
  unit text,
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  nucleo text,
  location_text text,
  street text,
  number text,
  service_order text,
  croqui text,
  trecho_inicial text,
  trecho_final text,
  pv_pi_estaca_inicial text,
  pv_pi_estaca_final text,
  derivation_type text,
  intra_executada boolean,
  evidence_url text,
  manual_reason text,
  review_status text not null default 'pending_review',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint measurement_memory_lines_rdo_type_check check (rdo_type is null or rdo_type in ('regular', 'sabesp')),
  constraint measurement_memory_lines_review_status_check check (review_status in ('draft', 'pending_review', 'approved', 'rejected', 'blocked'))
);

create table if not exists public.measurement_financial_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid,
  period_id uuid references public.measurement_periods(id) on delete set null,
  source_id uuid references public.measurement_sources(id) on delete set null,
  contractor_id uuid references public.contractors(id) on delete set null,
  created_by uuid not null references auth.users(id),
  nucleo text,
  entry_type text not null,
  description text not null,
  amount numeric not null default 0,
  competence text,
  invoice_number text,
  status text not null default 'draft',
  manual_reason text,
  evidence_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint measurement_financial_entries_type_check check (
    entry_type in (
      'retention',
      'discount',
      'rh',
      'machine',
      'vehicle',
      'fuel',
      'material',
      'epi',
      'third_party_service',
      'invoice',
      'advance',
      'previous_closing',
      'other',
      'manual_adjustment'
    )
  ),
  constraint measurement_financial_entries_status_check check (status in ('draft', 'pending_review', 'approved', 'paid', 'glossed', 'blocked'))
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'measurement_sources_period_fk'
      and conrelid = 'public.measurement_sources'::regclass
  ) then
    alter table public.measurement_sources
      add constraint measurement_sources_period_fk
      foreign key (period_id) references public.measurement_periods(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'measurement_sources_contract_item_fk'
      and conrelid = 'public.measurement_sources'::regclass
  ) then
    alter table public.measurement_sources
      add constraint measurement_sources_contract_item_fk
      foreign key (contract_item_id) references public.measurement_contract_items(id) on delete set null;
  end if;
end $$;

create index if not exists idx_measurement_sources_org_operational_key
  on public.measurement_sources(organization_id, contract_no, nucleo, local, n_preco, source_date)
  where deleted_at is null;

create index if not exists idx_measurement_memory_lines_org_period
  on public.measurement_memory_lines(organization_id, period_id, contractor_id, nucleo)
  where deleted_at is null;

create index if not exists idx_measurement_financial_entries_org_period
  on public.measurement_financial_entries(organization_id, period_id, entry_type, contractor_id)
  where deleted_at is null;

alter table public.measurement_periods enable row level security;
alter table public.measurement_contract_items enable row level security;
alter table public.measurement_memory_lines enable row level security;
alter table public.measurement_financial_entries enable row level security;

alter table public.measurement_periods force row level security;
alter table public.measurement_contract_items force row level security;
alter table public.measurement_memory_lines force row level security;
alter table public.measurement_financial_entries force row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'measurement_periods',
    'measurement_contract_items',
    'measurement_memory_lines',
    'measurement_financial_entries'
  ]
  loop
    execute format('drop policy if exists %I_select_own_org on public.%I', table_name, table_name);
    execute format(
      'create policy %I_select_own_org on public.%I for select to authenticated using (organization_id = public.user_org() and deleted_at is null)',
      table_name,
      table_name
    );

    execute format('drop policy if exists %I_insert_with_role on public.%I', table_name, table_name);
    execute format(
      'create policy %I_insert_with_role on public.%I for insert to authenticated with check (organization_id = public.user_org() and created_by = auth.uid() and public.has_role(array[''engenheiro'',''qualidade'',''planejador'',''comprador'',''gerente'',''diretor'',''owner'']::public.user_role[]))',
      table_name,
      table_name
    );

    execute format('drop policy if exists %I_update_own_org on public.%I', table_name, table_name);
    execute format(
      'create policy %I_update_own_org on public.%I for update to authenticated using (organization_id = public.user_org() and deleted_at is null) with check (organization_id = public.user_org())',
      table_name,
      table_name
    );
  end loop;
end $$;

comment on column public.measurement_sources.contract_no is 'Contract identifier used in the operational key.';
comment on column public.measurement_sources.local is 'Street/location inside the nucleus; rua is local, not a separate nucleus.';
comment on column public.measurement_sources.n_preco is 'Contract price item used to connect RDO, measurement and planning.';
comment on column public.measurement_sources.blocking_issues is 'Human-readable blockers that prevent automatic closing.';
