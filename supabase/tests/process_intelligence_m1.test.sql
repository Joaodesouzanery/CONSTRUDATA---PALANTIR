begin;

create extension if not exists pgtap with schema extensions;
select plan(35);

select has_table('public', 'process_definitions', 'process_definitions exists');
select has_table('public', 'process_events', 'process_events exists');
select has_column('public', 'process_events', 'sequence_number', 'sequence_number exists');
select has_column('public', 'process_definitions', 'timezone', 'timezone exists');
select col_type_is('public', 'process_events', 'occurred_at', 'timestamp with time zone', 'events use UTC-capable timestamptz');

select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.process_definitions'::regclass),
  'process_definitions enables and forces RLS'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.process_events'::regclass),
  'process_events enables and forces RLS'
);
select ok(not has_table_privilege('anon', 'public.process_definitions', 'select'), 'anon cannot read definitions');
select ok(not has_table_privilege('anon', 'public.process_events', 'select'), 'anon cannot read events');
select ok(has_table_privilege('authenticated', 'public.process_definitions', 'select'), 'authenticated can read definitions');
select ok(has_table_privilege('authenticated', 'public.process_events', 'select'), 'authenticated can read events');
select ok(not has_table_privilege('authenticated', 'public.process_definitions', 'insert'), 'authenticated cannot insert definitions');
select ok(not has_table_privilege('authenticated', 'public.process_events', 'insert'), 'authenticated cannot insert events');
select ok(not has_table_privilege('authenticated', 'public.process_events', 'update'), 'authenticated cannot update events');
select ok(has_table_privilege('service_role', 'public.process_definitions', 'select,insert,update'), 'service_role can manage versioned definitions');
select ok(not has_table_privilege('service_role', 'public.process_definitions', 'delete'), 'service_role cannot delete definitions');
select ok(not has_table_privilege('service_role', 'public.process_events', 'update'), 'service_role cannot update append-only events');
select ok(not has_table_privilege('service_role', 'public.process_events', 'delete'), 'service_role cannot delete append-only events');
select ok(not has_table_privilege('service_role', 'public.process_events', 'truncate'), 'service_role cannot truncate append-only events');
select has_index('public', 'process_events', 'idx_process_events_case_order', 'canonical case-order index exists');
select has_index('public', 'process_events', 'process_events_source_lineage_unique', 'source lineage is unique');
select has_fk('public', 'process_events', 'events have a tenant-safe definition FK');
select is_empty(
  'select event_id from public.process_events',
  'migrations do not load synthetic events automatically'
);

insert into auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'pi-a@example.com', crypt('test123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'pi-b@example.com', crypt('test123', gen_salt('bf')), now(), 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.organizations (id, name, slug, owner_id) values
  ('20000000-0000-4000-8000-000000000001', 'PI Org A', 'pi-test-a', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'PI Org B', 'pi-test-b', '10000000-0000-4000-8000-000000000002');

insert into public.profiles (id, organization_id, full_name, email, role, activated_at) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'PI User A', 'pi-a@example.com', 'owner', now()),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'PI User B', 'pi-b@example.com', 'owner', now());

insert into public.memberships (organization_id, user_id, role, status, joined_at) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner', 'active', now()),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'owner', 'active', now());

insert into public.process_definitions (
  id, organization_id, process_key, version, name, timezone, case_object_type,
  source_mappings, feature_mappings, process_model, kpi_definitions, sla_definitions
) values
  (
    '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
    'procurement', 1, 'Procurement A', 'America/Sao_Paulo', 'ProcurementCase',
    '{}', '{}',
    '{"schemaVersion":1,"allowedPaths":[],"requiredStates":[],"optionalStates":[],"forbiddenTransitions":[],"startStates":[],"endStates":[],"concurrencyGroups":[]}',
    '{"schemaVersion":1,"definitions":[]}', '{"schemaVersion":1,"definitions":[]}'
  ),
  (
    '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002',
    'procurement', 1, 'Procurement B', 'America/Sao_Paulo', 'ProcurementCase',
    '{}', '{}',
    '{"schemaVersion":1,"allowedPaths":[],"requiredStates":[],"optionalStates":[],"forbiddenTransitions":[],"startStates":[],"endStates":[],"concurrencyGroups":[]}',
    '{"schemaVersion":1,"definitions":[]}', '{"schemaVersion":1,"definitions":[]}'
  );

insert into public.process_events (
  event_id, organization_id, process_definition_id, case_id, activity, lifecycle,
  occurred_at, sequence_number, source_system, source_event_id, metadata
) values
  (
    '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001', 'case-a', 'Review', 'started',
    '2026-01-01T10:00:00Z', 1, 'test', 'event-a', '{"schema_version":1}'
  ),
  (
    '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000002', 'case-b', 'Review', 'started',
    '2026-01-01T10:00:00Z', 1, 'test', 'event-b', '{"schema_version":1}'
  );

select throws_ok(
  $$insert into public.process_events (organization_id, process_definition_id, case_id, activity, occurred_at, sequence_number, source_system, source_event_id, metadata)
    values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'negative-sequence', 'Review', now(), -1, 'test', 'negative-sequence', '{"schema_version":1}')$$,
  '23514', null, 'negative sequence numbers are rejected'
);
select throws_ok(
  $$insert into public.process_events (organization_id, process_definition_id, case_id, activity, lifecycle, occurred_at, source_system, source_event_id, metadata)
    values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'bad-lifecycle', 'Review', 'unknown', now(), 'test', 'bad-lifecycle', '{"schema_version":1}')$$,
  '23514', null, 'unknown lifecycle values are rejected'
);
select throws_ok(
  $$insert into public.process_events (organization_id, process_definition_id, case_id, activity, occurred_at, source_system, source_event_id, metadata)
    values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'duplicate', 'Review', now(), 'test', 'event-a', '{"schema_version":1}')$$,
  '23505', null, 'duplicate source lineage is rejected'
);
select throws_ok(
  $$insert into public.process_events (organization_id, process_definition_id, case_id, activity, occurred_at, source_system, source_event_id, metadata)
    values ('20000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'cross-org', 'Review', now(), 'test', 'cross-org', '{"schema_version":1}')$$,
  '23503', null, 'cross-organization definition references are rejected'
);

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select results_eq('select count(*) from public.process_definitions', array[1::bigint], 'user A sees one definition');
select results_eq('select count(*) from public.process_events', array[1::bigint], 'user A sees one event');
select throws_ok(
  $$insert into public.process_events (organization_id, process_definition_id, case_id, activity, occurred_at, source_system, source_event_id, metadata)
    values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'client-write', 'Review', now(), 'test', 'client-write', '{"schema_version":1}')$$,
  '42501', null, 'authenticated clients cannot insert events'
);
select throws_ok(
  $$update public.process_events
    set activity = 'Changed'
    where event_id = '40000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'authenticated clients cannot update events'
);
select throws_ok(
  $$delete from public.process_events
    where event_id = '40000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'authenticated clients cannot delete events'
);
reset role;

select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq('select count(*) from public.process_events', array[1::bigint], 'user B sees one event');
reset role;

set local role service_role;
select lives_ok(
  $$insert into public.process_events (
      event_id, organization_id, process_definition_id, case_id, activity,
      lifecycle, occurred_at, sequence_number, source_system, source_event_id,
      metadata
    ) values (
      '40000000-0000-4000-8000-000000000003',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      'server-ingestion', 'Review', 'completed', now(), 1,
      'test', 'server-ingestion', '{"schema_version":1}'
    )$$,
  'server-side ingestion succeeds'
);
reset role;

set local role anon;
select throws_ok(
  $$select count(*) from public.process_events$$,
  '42501', null, 'anon cannot query events'
);
reset role;

select * from finish();
rollback;
