-- Predial / Compliance de Laudos: uma linha por obrigação legal recorrente do prédio
-- (AVCB/CBMDF, SPDA, limpeza de caixa d'água, dedetização, gás, pressurização de escada,
-- inspeção de elevadores, recarga de extintores). Multi-tenant por organization_id, escopo
-- opcional por obra; soft-delete. O documento anexo reusa o bucket `predial-ativos`.
-- ⚠️ APLICAR MANUALMENTE no Supabase SQL Editor (produção) ANTES de subir o código.

create table if not exists public.predial_laudos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  construction_site_id uuid references public.construction_sites(id) on delete set null,
  tipo text not null,
  titulo text,
  ultima_execucao date,
  validade date,
  periodicidade_meses integer,
  responsavel text,
  documento_path text,
  observacoes text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_predial_laudos_org
  on public.predial_laudos (organization_id) where deleted_at is null;
create index if not exists idx_predial_laudos_validade
  on public.predial_laudos (organization_id, validade) where deleted_at is null;

create or replace function public.set_predial_updated_at()
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

drop trigger if exists trg_predial_laudos_updated_at on public.predial_laudos;
create trigger trg_predial_laudos_updated_at
  before update on public.predial_laudos
  for each row execute function public.set_predial_updated_at();

alter table public.predial_laudos enable row level security;

drop policy if exists predial_laudos_select on public.predial_laudos;
drop policy if exists predial_laudos_insert on public.predial_laudos;
drop policy if exists predial_laudos_update on public.predial_laudos;
drop policy if exists predial_laudos_delete on public.predial_laudos;

create policy predial_laudos_select on public.predial_laudos
  for select to authenticated using (organization_id = public.user_org() and deleted_at is null);

create policy predial_laudos_insert on public.predial_laudos
  for insert to authenticated with check (organization_id = public.user_org());

create policy predial_laudos_update on public.predial_laudos
  for update to authenticated using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

-- Hard delete bloqueado: exclusão é sempre soft-delete (update de deleted_at), como nas
-- tabelas de manutenção.
create policy predial_laudos_delete on public.predial_laudos
  for delete to authenticated using (false);

grant select, insert, update, delete on public.predial_laudos to authenticated;

-- Isolamento de tenant nos FKs: project_id/construction_site_id têm de ser da MESMA org
-- (mesmo padrão das tabelas de manutenção). Bloqueia referência cruzada entre organizações.
drop trigger if exists tenant_fk_predial_laudos_project on public.predial_laudos;
create trigger tenant_fk_predial_laudos_project
  before insert or update of organization_id, project_id on public.predial_laudos
  for each row execute function public.enforce_same_organization_fk('public', 'projects', 'project_id', 'id');

drop trigger if exists tenant_fk_predial_laudos_site on public.predial_laudos;
create trigger tenant_fk_predial_laudos_site
  before insert or update of organization_id, construction_site_id on public.predial_laudos
  for each row execute function public.enforce_same_organization_fk('public', 'construction_sites', 'construction_site_id', 'id');
