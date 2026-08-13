-- ConstruData Processos M2.1
-- Supabase projects may expose new public tables to service_role through
-- project-level default privileges. Revoke those inherited table privileges
-- before restoring the explicit least-privilege contract from M1/M2.

revoke all on table public.process_definitions from service_role;
revoke all on table public.process_events from service_role;
revoke all on table public.process_discovery_snapshots from service_role;
revoke all on table public.process_case_summaries from service_role;

-- Definitions are versioned configuration. Server-side ingestion may create
-- and update them, but cannot delete or truncate them through service_role.
grant select, insert, update
  on table public.process_definitions
  to service_role;

-- Canonical events are append-only, including for service_role.
grant select, insert
  on table public.process_events
  to service_role;

-- Derived materializations can be rebuilt and therefore support server-side
-- DML, but never TRUNCATE through the API credential.
grant select, insert, update, delete
  on table public.process_discovery_snapshots
  to service_role;

grant select, insert, update, delete
  on table public.process_case_summaries
  to service_role;
