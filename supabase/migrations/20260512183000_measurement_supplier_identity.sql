alter table public.measurement_sources
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

alter table public.measurement_memory_lines
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

alter table public.measurement_financial_entries
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists idx_measurement_sources_org_supplier
  on public.measurement_sources(organization_id, supplier_id)
  where deleted_at is null and supplier_id is not null;

create index if not exists idx_measurement_memory_lines_org_supplier
  on public.measurement_memory_lines(organization_id, supplier_id)
  where deleted_at is null and supplier_id is not null;

create index if not exists idx_measurement_financial_entries_org_supplier
  on public.measurement_financial_entries(organization_id, supplier_id)
  where deleted_at is null and supplier_id is not null;

comment on column public.measurement_sources.supplier_id is
  'Supplier identity for imported supplier measurements. contractor_id remains reserved for subcontractors.';

comment on column public.measurement_memory_lines.supplier_id is
  'Supplier identity propagated from supplier measurement sources.';

comment on column public.measurement_financial_entries.supplier_id is
  'Supplier identity for NFs, discounts, advances and other financial rows imported from supplier measurements.';
