-- ============================================================================
-- 0037_medicao_tables.sql
-- Medição (Contract Measurement) module — Phase 1 tables.
-- ============================================================================

-- ─── Contract price catalog ────────────────────────────────────────────────
create table if not exists contract_price_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  code              text not null,
  description       text not null default '',
  unit              text not null default 'un',
  unit_price        numeric(14,4) not null default 0,
  contract_quantity numeric(14,4) not null default 0,
  "group"           text not null default '',
  subgroup          text not null default '',
  frente            text not null default '',
  measurement_rule  text not null default '',
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (organization_id, code)
);

-- ─── Measurement bulletins (one per month per organization) ────────────────
create table if not exists measurement_bulletins (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  reference_month   text not null,             -- 'YYYY-MM'
  status            text not null default 'draft' check (status in ('draft','submitted','approved')),
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  unique (organization_id, reference_month)
);

-- ─── Bulletin line items ───────────────────────────────────────────────────
create table if not exists measurement_bulletin_items (
  id                  uuid primary key default gen_random_uuid(),
  bulletin_id         uuid not null references measurement_bulletins(id) on delete cascade,
  price_item_id       uuid not null references contract_price_items(id) on delete cascade,
  measured_quantity   numeric(14,4) not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (bulletin_id, price_item_id)
);

-- ─── RLS ───────────────────────────────────────────────────────────────────
alter table contract_price_items     enable row level security;
alter table measurement_bulletins    enable row level security;
alter table measurement_bulletin_items enable row level security;

drop policy if exists "cpi_select" on contract_price_items;
drop policy if exists "cpi_insert" on contract_price_items;
drop policy if exists "cpi_update" on contract_price_items;
drop policy if exists "cpi_delete" on contract_price_items;
drop policy if exists "mb_select" on measurement_bulletins;
drop policy if exists "mb_insert" on measurement_bulletins;
drop policy if exists "mb_update" on measurement_bulletins;
drop policy if exists "mb_delete" on measurement_bulletins;
drop policy if exists "mbi_select" on measurement_bulletin_items;
drop policy if exists "mbi_insert" on measurement_bulletin_items;
drop policy if exists "mbi_update" on measurement_bulletin_items;
drop policy if exists "mbi_delete" on measurement_bulletin_items;

-- Contract price items: org-scoped CRUD
create policy "cpi_select" on contract_price_items
  for select using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );
create policy "cpi_insert" on contract_price_items
  for insert with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );
create policy "cpi_update" on contract_price_items
  for update using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );
create policy "cpi_delete" on contract_price_items
  for delete using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );

-- Bulletins: org-scoped CRUD
create policy "mb_select" on measurement_bulletins
  for select using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );
create policy "mb_insert" on measurement_bulletins
  for insert with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );
create policy "mb_update" on measurement_bulletins
  for update using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );
create policy "mb_delete" on measurement_bulletins
  for delete using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );

-- Bulletin items: accessible via bulletin → org chain
create policy "mbi_select" on measurement_bulletin_items
  for select using (
    bulletin_id in (
      select id from measurement_bulletins
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  );
create policy "mbi_insert" on measurement_bulletin_items
  for insert with check (
    bulletin_id in (
      select id from measurement_bulletins
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  );
create policy "mbi_update" on measurement_bulletin_items
  for update using (
    bulletin_id in (
      select id from measurement_bulletins
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  );
create policy "mbi_delete" on measurement_bulletin_items
  for delete using (
    bulletin_id in (
      select id from measurement_bulletins
      where organization_id = (select organization_id from profiles where id = auth.uid())
    )
  );

-- ─── Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_cpi_org on contract_price_items (organization_id);
create index if not exists idx_mb_org_month on measurement_bulletins (organization_id, reference_month);
create index if not exists idx_mbi_bulletin on measurement_bulletin_items (bulletin_id);

-- ─── updated_at triggers ───────────────────────────────────────────────────
create or replace function trg_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_cpi on contract_price_items;
create trigger set_updated_at_cpi
  before update on contract_price_items
  for each row execute function trg_set_updated_at();

drop trigger if exists set_updated_at_mb on measurement_bulletins;
create trigger set_updated_at_mb
  before update on measurement_bulletins
  for each row execute function trg_set_updated_at();

drop trigger if exists set_updated_at_mbi on measurement_bulletin_items;
create trigger set_updated_at_mbi
  before update on measurement_bulletin_items
  for each row execute function trg_set_updated_at();
