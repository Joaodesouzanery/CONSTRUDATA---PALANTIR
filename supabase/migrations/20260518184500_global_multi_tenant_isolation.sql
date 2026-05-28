-- Global multi-tenant isolation hardening.
-- organization_id is the tenant boundary for every customer-domain row.

update public.organizations
   set slug = 'compizzo',
       updated_at = now()
 where id = '13ae7b65-c1a9-489e-9d6f-61d63f9aaeb6'
   and slug <> 'compizzo';

do $$
declare
  r record;
begin
  for r in
    select c.relname
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
  loop
    execute format('alter table public.%I enable row level security', r.relname);
    execute format('alter table public.%I force row level security', r.relname);
  end loop;
end $$;

drop policy if exists cpi_select on public.contract_price_items;
drop policy if exists cpi_insert on public.contract_price_items;
drop policy if exists cpi_update on public.contract_price_items;
drop policy if exists cpi_delete on public.contract_price_items;

create policy cpi_select
  on public.contract_price_items
  for select
  to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

create policy cpi_insert
  on public.contract_price_items
  for insert
  to authenticated
  with check (organization_id = public.user_org());

create policy cpi_update
  on public.contract_price_items
  for update
  to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

create policy cpi_delete
  on public.contract_price_items
  for delete
  to authenticated
  using (organization_id = public.user_org());

drop policy if exists mb_select on public.measurement_bulletins;
drop policy if exists mb_insert on public.measurement_bulletins;
drop policy if exists mb_update on public.measurement_bulletins;
drop policy if exists mb_delete on public.measurement_bulletins;

create policy mb_select
  on public.measurement_bulletins
  for select
  to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

create policy mb_insert
  on public.measurement_bulletins
  for insert
  to authenticated
  with check (organization_id = public.user_org());

create policy mb_update
  on public.measurement_bulletins
  for update
  to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

create policy mb_delete
  on public.measurement_bulletins
  for delete
  to authenticated
  using (organization_id = public.user_org());

drop policy if exists sc_select on public.supplier_closures;
drop policy if exists sc_insert on public.supplier_closures;
drop policy if exists sc_update on public.supplier_closures;
drop policy if exists sc_delete on public.supplier_closures;

create policy sc_select
  on public.supplier_closures
  for select
  to authenticated
  using (organization_id = public.user_org() and deleted_at is null);

create policy sc_insert
  on public.supplier_closures
  for insert
  to authenticated
  with check (organization_id = public.user_org());

create policy sc_update
  on public.supplier_closures
  for update
  to authenticated
  using (organization_id = public.user_org() and deleted_at is null)
  with check (organization_id = public.user_org());

create policy sc_delete
  on public.supplier_closures
  for delete
  to authenticated
  using (organization_id = public.user_org());

drop policy if exists user_routines_select_own on public.user_routines;
drop policy if exists user_routines_insert_own on public.user_routines;
drop policy if exists user_routines_update_own on public.user_routines;
drop policy if exists user_routines_delete_own on public.user_routines;

create policy user_routines_select_own
  on public.user_routines
  for select
  to authenticated
  using (user_id = auth.uid() and organization_id = public.user_org());

create policy user_routines_insert_own
  on public.user_routines
  for insert
  to authenticated
  with check (user_id = auth.uid() and organization_id = public.user_org());

create policy user_routines_update_own
  on public.user_routines
  for update
  to authenticated
  using (user_id = auth.uid() and organization_id = public.user_org())
  with check (user_id = auth.uid() and organization_id = public.user_org());

create policy user_routines_delete_own
  on public.user_routines
  for delete
  to authenticated
  using (user_id = auth.uid() and organization_id = public.user_org());

create or replace function public.enforce_same_organization_fk()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  parent_schema text := TG_ARGV[0];
  parent_table text := TG_ARGV[1];
  child_fk_col text := TG_ARGV[2];
  parent_pk_col text := TG_ARGV[3];
  child_fk_value text;
  parent_org_id uuid;
begin
  child_fk_value := to_jsonb(NEW)->>child_fk_col;

  if child_fk_value is null or child_fk_value = '' then
    return NEW;
  end if;

  execute format(
    'select organization_id from %I.%I where %I::text = $1',
    parent_schema,
    parent_table,
    parent_pk_col
  )
  into parent_org_id
  using child_fk_value;

  if parent_org_id is null then
    raise exception
      'Invalid tenant reference: %.% points to missing or inaccessible %.%',
      TG_TABLE_NAME,
      child_fk_col,
      parent_table,
      parent_pk_col
      using errcode = '23503';
  end if;

  if NEW.organization_id is distinct from parent_org_id then
    raise exception
      'Tenant mismatch: %.% belongs to organization %, but row organization_id is %',
      TG_TABLE_NAME,
      child_fk_col,
      parent_org_id,
      NEW.organization_id
      using errcode = '23514';
  end if;

  return NEW;
end;
$$;

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
  loop
    trigger_name := 'tenant_fk_' || substr(md5(r.child_table || '_' || r.conname), 1, 24);

    execute format(
      'drop trigger if exists %I on %I.%I',
      trigger_name,
      r.child_schema,
      r.child_table
    );

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
