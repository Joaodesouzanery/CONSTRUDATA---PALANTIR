-- ============================================================================
-- 0038_supplier_closures.sql
-- Fechamento com Fornecedores / Empreiteiros — Phase 3 table.
-- ============================================================================

create table if not exists supplier_closures (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  bulletin_id            uuid not null references measurement_bulletins(id) on delete cascade,
  supplier_name          text not null default '',
  gross_value            numeric(14,4) not null default 0,
  discounts              jsonb not null default '[]',
  admin_tax_pct          numeric(5,2) not null default 0,
  advances               jsonb not null default '[]',
  previous_month_closure numeric(14,4) not null default 0,
  retention_pct          numeric(5,2) not null default 5,
  retention_released     numeric(14,4) not null default 0,
  notes                  text not null default '',
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  deleted_at             timestamptz
);

alter table supplier_closures enable row level security;

drop policy if exists "sc_select" on supplier_closures;
drop policy if exists "sc_insert" on supplier_closures;
drop policy if exists "sc_update" on supplier_closures;
drop policy if exists "sc_delete" on supplier_closures;

create policy "sc_select" on supplier_closures
  for select using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );
create policy "sc_insert" on supplier_closures
  for insert with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );
create policy "sc_update" on supplier_closures
  for update using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );
create policy "sc_delete" on supplier_closures
  for delete using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );

create index if not exists idx_sc_org on supplier_closures (organization_id);
create index if not exists idx_sc_bulletin on supplier_closures (bulletin_id);

drop trigger if exists set_updated_at_sc on supplier_closures;
create trigger set_updated_at_sc
  before update on supplier_closures
  for each row execute function trg_set_updated_at();
