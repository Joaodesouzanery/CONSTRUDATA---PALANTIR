begin;

create extension if not exists pgtap with schema extensions;
select plan(41);

select has_table('public', 'process_discovery_snapshots', 'snapshots table exists');
select has_table('public', 'process_case_summaries', 'case summaries table exists');
select has_column('public', 'process_discovery_snapshots', 'algorithm_key', 'algorithm key exists');
select has_column('public', 'process_discovery_snapshots', 'input_checksum', 'input checksum exists');
select has_column('public', 'process_discovery_snapshots', 'definition_version', 'definition version exists');
select has_column('public', 'process_discovery_snapshots', 'parameters', 'parameters exist');
select has_column('public', 'process_discovery_snapshots', 'started_at', 'started timestamp exists');
select has_column('public', 'process_discovery_snapshots', 'completed_at', 'completed timestamp exists');
select has_column('public', 'process_discovery_snapshots', 'generated_at', 'generated timestamp exists');
select has_column('public', 'process_discovery_snapshots', 'error_code', 'error code exists');
select has_column('public', 'process_discovery_snapshots', 'error_message', 'error message exists');
select has_column('public', 'process_case_summaries', 'has_possible_concurrency', 'possible concurrency flag exists');
select has_index('public', 'process_discovery_snapshots', 'process_discovery_snapshots_idempotency_unique', 'idempotency index exists');
select has_index('public', 'process_discovery_snapshots', 'idx_process_discovery_snapshots_ready', 'ready lookup index exists');
select has_index('public', 'process_case_summaries', 'idx_process_case_summaries_page', 'case pagination index exists');
select has_fk('public', 'process_discovery_snapshots', 'snapshots have tenant-safe definition FK');
select has_fk('public', 'process_case_summaries', 'summaries have tenant-safe FKs');
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.process_discovery_snapshots'::regclass),
  'snapshots enable and force RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.process_case_summaries'::regclass),
  'case summaries enable and force RLS'
);
select ok(not has_table_privilege('anon', 'public.process_discovery_snapshots', 'select'), 'anon cannot read snapshots');
select ok(not has_table_privilege('anon', 'public.process_case_summaries', 'select'), 'anon cannot read summaries');
select ok(has_table_privilege('authenticated', 'public.process_discovery_snapshots', 'select'), 'authenticated can read snapshots');
select ok(has_table_privilege('authenticated', 'public.process_case_summaries', 'select'), 'authenticated can read summaries');
select ok(not has_table_privilege('authenticated', 'public.process_discovery_snapshots', 'insert'), 'authenticated cannot insert snapshots');
select ok(not has_table_privilege('authenticated', 'public.process_discovery_snapshots', 'update'), 'authenticated cannot update snapshots');
select ok(not has_table_privilege('authenticated', 'public.process_case_summaries', 'delete'), 'authenticated cannot delete summaries');
select ok(has_table_privilege('service_role', 'public.process_discovery_snapshots', 'select,insert,update,delete'), 'service_role can rebuild snapshots');
select ok(not has_table_privilege('service_role', 'public.process_discovery_snapshots', 'truncate'), 'service_role cannot truncate snapshots');
select ok(has_table_privilege('service_role', 'public.process_case_summaries', 'select,insert,update,delete'), 'service_role can rebuild case summaries');
select ok(not has_table_privilege('service_role', 'public.process_case_summaries', 'truncate'), 'service_role cannot truncate case summaries');

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('11000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'm2-a@example.com', crypt('test123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{}', '{}', now(), now()),
  ('11000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'm2-b@example.com', crypt('test123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{}', '{}', now(), now());

insert into public.organizations (id, name, slug, owner_id) values
  ('21000000-0000-4000-8000-000000000001', 'Processos M2 A', 'processos-m2-a', '11000000-0000-4000-8000-000000000001'),
  ('21000000-0000-4000-8000-000000000002', 'Processos M2 B', 'processos-m2-b', '11000000-0000-4000-8000-000000000002');

insert into public.profiles (id, organization_id, full_name, email, role, activated_at) values
  ('11000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'M2 User A', 'm2-a@example.com', 'owner', now()),
  ('11000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'M2 User B', 'm2-b@example.com', 'owner', now());

insert into public.memberships (organization_id, user_id, role, status, joined_at) values
  ('21000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000001', 'owner', 'active', now()),
  ('21000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000002', 'owner', 'active', now());

insert into public.process_definitions (
  id, organization_id, process_key, version, name, timezone, case_object_type,
  source_mappings, feature_mappings, process_model, kpi_definitions, sla_definitions
) values
  ('31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'm2-a', 1, 'M2 A', 'America/Sao_Paulo', 'Case', '{}', '{}', '{"schemaVersion":1,"allowedPaths":[],"requiredStates":[],"optionalStates":[],"forbiddenTransitions":[],"startStates":[],"endStates":[],"concurrencyGroups":[]}', '{"schemaVersion":1,"definitions":[]}', '{"schemaVersion":1,"definitions":[]}'),
  ('31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'm2-b', 1, 'M2 B', 'America/Sao_Paulo', 'Case', '{}', '{}', '{"schemaVersion":1,"allowedPaths":[],"requiredStates":[],"optionalStates":[],"forbiddenTransitions":[],"startStates":[],"endStates":[],"concurrencyGroups":[]}', '{"schemaVersion":1,"definitions":[]}', '{"schemaVersion":1,"definitions":[]}');

insert into public.process_events (
  event_id, organization_id, process_definition_id, case_id, activity, lifecycle,
  occurred_at, sequence_number, source_system, source_event_id, metadata
) values (
  '41000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001', 'case-ready', 'Review', 'completed',
  '2026-01-01T01:00:00Z', 1, 'm2-test', 'm2-event-a', '{"schema_version":1}'
);

insert into public.process_discovery_snapshots (
  id, organization_id, process_definition_id, definition_version,
  algorithm_key, algorithm_version, input_checksum, parameters, parameters_checksum,
  status, result_schema_version, result, input_event_count, input_case_count,
  started_at, completed_at, generated_at
) values
  (
    '51000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001', 1, 'test.discovery', '2.0.0',
    'fnv1a64:0000000000000001', '{}', 'fnv1a64:0000000000000011', 'ready', 1,
    '{"schemaVersion":1,"input":{},"nodes":[],"edges":[],"paths":[],"loops":[],"rework":[],"repeatedActivities":[],"forbiddenTransitions":[],"incompleteLifecycles":[],"ambiguousOrderings":[],"possibleConcurrency":[],"metrics":{},"bottlenecks":[]}',
    1, 1, '2026-01-01T02:00:00Z', '2026-01-01T02:01:00Z', '2026-01-01T02:01:00Z'
  ),
  (
    '51000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001', 1, 'test.discovery', '2.0.0',
    'fnv1a64:0000000000000002', '{}', 'fnv1a64:0000000000000011', 'building', 1,
    null, 1, 1, '2026-01-01T02:00:00Z', null, null
  ),
  (
    '51000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000002', 1, 'test.discovery', '2.0.0',
    'fnv1a64:0000000000000003', '{}', 'fnv1a64:0000000000000011', 'ready', 1,
    '{"schemaVersion":1,"input":{},"nodes":[],"edges":[],"paths":[],"loops":[],"rework":[],"repeatedActivities":[],"forbiddenTransitions":[],"incompleteLifecycles":[],"ambiguousOrderings":[],"possibleConcurrency":[],"metrics":{},"bottlenecks":[]}',
    1, 1, '2026-01-01T02:00:00Z', '2026-01-01T02:01:00Z', '2026-01-01T02:01:00Z'
  );

insert into public.process_case_summaries (
  organization_id, process_definition_id, snapshot_id, case_id, started_at, ended_at,
  duration_ms, event_count, activity_count, variant_key, has_anomaly, metadata_summary
) values
  ('21000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'case-ready', '2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z', 3600000, 1, 1, 'variant:ready', false, '{}'),
  ('21000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000002', 'case-building', '2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z', 3600000, 1, 1, 'variant:building', false, '{}'),
  ('21000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000003', 'case-other-org', '2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z', 3600000, 1, 1, 'variant:other', false, '{}');

select throws_ok(
  $$update public.process_discovery_snapshots set input_event_count = 2 where id = '51000000-0000-4000-8000-000000000001'$$,
  '55000', 'ready process discovery snapshots are immutable', 'ready snapshots are immutable'
);
select throws_ok(
  $$insert into public.process_discovery_snapshots (organization_id, process_definition_id, definition_version, algorithm_key, algorithm_version, input_checksum, parameters_checksum, input_event_count, input_case_count)
    values ('21000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 1, 'test.discovery', '2.0.0', 'fnv1a64:0000000000000002', 'fnv1a64:0000000000000011', 1, 1)$$,
  '23505', null, 'identical snapshot identity is rejected'
);
select throws_ok(
  $$insert into public.process_discovery_snapshots (organization_id, process_definition_id, definition_version, algorithm_key, algorithm_version, input_checksum, parameters_checksum, input_event_count, input_case_count)
    values ('21000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 1, 'test.cross-tenant', '2.0.0', 'fnv1a64:0000000000000004', 'fnv1a64:0000000000000011', 1, 1)$$,
  '23503', null, 'cross-tenant snapshot definition is rejected'
);

select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"11000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select results_eq('select count(*) from public.process_discovery_snapshots', array[1::bigint], 'user A sees only ready own-org snapshot');
select results_eq('select count(*) from public.process_case_summaries', array[1::bigint], 'user A sees summaries only for ready own-org snapshot');
select throws_ok(
  $$insert into public.process_discovery_snapshots (organization_id, process_definition_id, definition_version, algorithm_key, algorithm_version, input_checksum, parameters_checksum, input_event_count, input_case_count)
    values ('21000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 1, 'client', '2.0.0', 'fnv1a64:0000000000000005', 'fnv1a64:0000000000000011', 1, 1)$$,
  '42501', null, 'authenticated cannot insert snapshots'
);
select throws_ok(
  $$delete from public.process_case_summaries where case_id = 'case-ready'$$,
  '42501', null, 'authenticated cannot delete summaries'
);
reset role;

set local role service_role;
select lives_ok(
  $$insert into public.process_discovery_snapshots (id, organization_id, process_definition_id, definition_version, algorithm_key, algorithm_version, input_checksum, parameters_checksum, input_event_count, input_case_count)
    values ('51000000-0000-4000-8000-000000000004', '21000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 1, 'service.discovery', '2.0.0', 'fnv1a64:0000000000000006', 'fnv1a64:0000000000000011', 1, 1)$$,
  'service_role can create a building snapshot'
);
reset role;

delete from public.process_discovery_snapshots where id = '51000000-0000-4000-8000-000000000002';
select results_eq(
  $$select count(*) from public.process_case_summaries where snapshot_id = '51000000-0000-4000-8000-000000000002'$$,
  array[0::bigint],
  'deleting a materialization cascades its summaries'
);
select results_eq(
  $$select count(*) from public.process_events where event_id = '41000000-0000-4000-8000-000000000001'$$,
  array[1::bigint],
  'deleting a materialization never deletes source events'
);

set local role anon;
select throws_ok(
  $$select count(*) from public.process_discovery_snapshots$$,
  '42501', null, 'anon cannot query snapshots'
);
reset role;

select * from finish();
rollback;
