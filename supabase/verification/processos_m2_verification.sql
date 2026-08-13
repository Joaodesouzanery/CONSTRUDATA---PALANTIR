-- Read-only verification after manually applying Processos M2.
-- Run with a privileged connection in the intended validation environment.

select
  to_regclass('public.process_discovery_snapshots') is not null as snapshots_table_exists,
  to_regclass('public.process_case_summaries') is not null as summaries_table_exists,
  to_regclass('public.process_events') is not null as source_events_table_exists;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
where c.oid in (
  'public.process_discovery_snapshots'::regclass,
  'public.process_case_summaries'::regclass
)
order by c.relname;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
from pg_policies
where schemaname = 'public'
  and tablename in ('process_discovery_snapshots', 'process_case_summaries')
order by tablename, policyname;

-- Expected after 20260813192909_processos_service_role_least_privilege.sql:
-- definitions: SELECT/INSERT/UPDATE; events: SELECT/INSERT only;
-- snapshots and summaries: SELECT/INSERT/UPDATE/DELETE; no table: TRUNCATE.
select
  table_name,
  has_table_privilege('service_role', format('public.%I', table_name), 'SELECT') as can_select,
  has_table_privilege('service_role', format('public.%I', table_name), 'INSERT') as can_insert,
  has_table_privilege('service_role', format('public.%I', table_name), 'UPDATE') as can_update,
  has_table_privilege('service_role', format('public.%I', table_name), 'DELETE') as can_delete,
  has_table_privilege('service_role', format('public.%I', table_name), 'TRUNCATE') as can_truncate
from unnest(array[
  'process_definitions',
  'process_events',
  'process_discovery_snapshots',
  'process_case_summaries'
]) as tables(table_name)
order by table_name;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('process_discovery_snapshots', 'process_case_summaries')
order by tablename, indexname;

select
  status,
  count(*) as snapshots,
  sum(input_case_count) as input_cases,
  sum(input_event_count) as input_events
from public.process_discovery_snapshots
group by status
order by status;

select
  snapshots.id,
  snapshots.organization_id,
  snapshots.process_definition_id,
  snapshots.algorithm_key,
  snapshots.algorithm_version,
  snapshots.input_checksum,
  snapshots.parameters_checksum,
  snapshots.status,
  snapshots.input_case_count,
  snapshots.input_event_count,
  count(summaries.case_id) as persisted_case_summaries
from public.process_discovery_snapshots snapshots
left join public.process_case_summaries summaries
  on summaries.organization_id = snapshots.organization_id
 and summaries.snapshot_id = snapshots.id
group by snapshots.id
order by snapshots.started_at desc;

-- Replace placeholders before running EXPLAIN. Expected index:
-- idx_process_events_case_order.
explain (analyze, buffers)
select *
from public.process_events
where organization_id = '00000000-0000-4000-8000-000000000001'
  and process_definition_id = '00000000-0000-4000-8000-000000000001'
  and case_id = 'replace-with-a-real-case-id'
order by occurred_at asc, sequence_number asc nulls last, event_id asc;
