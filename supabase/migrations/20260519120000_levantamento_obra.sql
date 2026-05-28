-- Tenant-safe module: Levantamento de Obra / pre-orcamento.

create table if not exists public.obra_levantamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  obra text not null,
  contratante text,
  numero_orcamento text,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'levantamento_concluido', 'orcamento_pronto', 'aprovado')),
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_obra_levantamentos_org_updated
  on public.obra_levantamentos (organization_id, updated_at desc)
  where deleted_at is null;

create index if not exists idx_obra_levantamentos_org_orcamento
  on public.obra_levantamentos (organization_id, numero_orcamento)
  where deleted_at is null and numero_orcamento is not null;

drop trigger if exists trg_obra_levantamentos_updated_at on public.obra_levantamentos;
create trigger trg_obra_levantamentos_updated_at
  before update on public.obra_levantamentos
  for each row execute function public.set_updated_at();

alter table public.obra_levantamentos enable row level security;
alter table public.obra_levantamentos force row level security;

drop policy if exists obra_levantamentos_select on public.obra_levantamentos;
drop policy if exists obra_levantamentos_insert on public.obra_levantamentos;
drop policy if exists obra_levantamentos_update on public.obra_levantamentos;
drop policy if exists obra_levantamentos_delete on public.obra_levantamentos;

create policy obra_levantamentos_select
  on public.obra_levantamentos
  for select
  to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

create policy obra_levantamentos_insert
  on public.obra_levantamentos
  for insert
  to authenticated
  with check (organization_id = public.user_org());

create policy obra_levantamentos_update
  on public.obra_levantamentos
  for update
  to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

create policy obra_levantamentos_delete
  on public.obra_levantamentos
  for delete
  to authenticated
  using (organization_id = public.user_org());

grant select, insert, update, delete on public.obra_levantamentos to authenticated;

insert into storage.buckets (id, name, public)
values ('obra-levantamentos', 'obra-levantamentos', false)
on conflict (id) do nothing;

drop policy if exists "obra_levantamentos_storage_select" on storage.objects;
drop policy if exists "obra_levantamentos_storage_insert" on storage.objects;
drop policy if exists "obra_levantamentos_storage_update" on storage.objects;
drop policy if exists "obra_levantamentos_storage_delete" on storage.objects;

create policy "obra_levantamentos_storage_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'obra-levantamentos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "obra_levantamentos_storage_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'obra-levantamentos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "obra_levantamentos_storage_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'obra-levantamentos'
    and (storage.foldername(name))[1] = public.user_org()::text
  )
  with check (
    bucket_id = 'obra-levantamentos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );

create policy "obra_levantamentos_storage_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'obra-levantamentos'
    and (storage.foldername(name))[1] = public.user_org()::text
  );
