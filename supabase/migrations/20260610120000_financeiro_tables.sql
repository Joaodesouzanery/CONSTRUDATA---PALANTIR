-- Tenant-safe: Financeiro (lançamentos) + Distribuição de orçamento por obra.
-- Espelha o padrão dos demais módulos (organization_id + RLS por public.user_org()).

-- ─── financeiro_entries ──────────────────────────────────────────────────────
create table if not exists public.financeiro_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida')),
  descricao text not null default '',
  valor numeric not null default 0,
  data date,
  categoria text,
  referencia text,
  obra_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_financeiro_entries_org_updated
  on public.financeiro_entries (organization_id, updated_at desc)
  where deleted_at is null;
create index if not exists idx_financeiro_entries_org_obra
  on public.financeiro_entries (organization_id, obra_id)
  where deleted_at is null;

drop trigger if exists trg_financeiro_entries_updated_at on public.financeiro_entries;
create trigger trg_financeiro_entries_updated_at
  before update on public.financeiro_entries
  for each row execute function public.set_updated_at();

alter table public.financeiro_entries enable row level security;
alter table public.financeiro_entries force row level security;

drop policy if exists financeiro_entries_select on public.financeiro_entries;
drop policy if exists financeiro_entries_insert on public.financeiro_entries;
drop policy if exists financeiro_entries_update on public.financeiro_entries;
drop policy if exists financeiro_entries_delete on public.financeiro_entries;

create policy financeiro_entries_select on public.financeiro_entries
  for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);
create policy financeiro_entries_insert on public.financeiro_entries
  for insert to authenticated
  with check (organization_id = public.user_org());
create policy financeiro_entries_update on public.financeiro_entries
  for update to authenticated
  using (organization_id = public.user_org())
  with check (organization_id = public.user_org());
create policy financeiro_entries_delete on public.financeiro_entries
  for delete to authenticated
  using (organization_id = public.user_org());

grant select, insert, update, delete on public.financeiro_entries to authenticated;

-- ─── financeiro_distribuicoes ────────────────────────────────────────────────
create table if not exists public.financeiro_distribuicoes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obra_id uuid,
  titulo text not null default '',
  orcamento numeric not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_financeiro_distribuicoes_org_updated
  on public.financeiro_distribuicoes (organization_id, updated_at desc)
  where deleted_at is null;

drop trigger if exists trg_financeiro_distribuicoes_updated_at on public.financeiro_distribuicoes;
create trigger trg_financeiro_distribuicoes_updated_at
  before update on public.financeiro_distribuicoes
  for each row execute function public.set_updated_at();

alter table public.financeiro_distribuicoes enable row level security;
alter table public.financeiro_distribuicoes force row level security;

drop policy if exists financeiro_distribuicoes_select on public.financeiro_distribuicoes;
drop policy if exists financeiro_distribuicoes_insert on public.financeiro_distribuicoes;
drop policy if exists financeiro_distribuicoes_update on public.financeiro_distribuicoes;
drop policy if exists financeiro_distribuicoes_delete on public.financeiro_distribuicoes;

create policy financeiro_distribuicoes_select on public.financeiro_distribuicoes
  for select to authenticated
  using (organization_id = public.user_org() and deleted_at is null);
create policy financeiro_distribuicoes_insert on public.financeiro_distribuicoes
  for insert to authenticated
  with check (organization_id = public.user_org());
create policy financeiro_distribuicoes_update on public.financeiro_distribuicoes
  for update to authenticated
  using (organization_id = public.user_org())
  with check (organization_id = public.user_org());
create policy financeiro_distribuicoes_delete on public.financeiro_distribuicoes
  for delete to authenticated
  using (organization_id = public.user_org());

grant select, insert, update, delete on public.financeiro_distribuicoes to authenticated;
