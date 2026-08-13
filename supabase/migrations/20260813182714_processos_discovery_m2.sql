-- ConstruData Processos M2
-- Derived discovery snapshots and per-case summaries.
-- process_events remains the source of truth; every row below is rebuildable.

alter table public.process_definitions
  add constraint process_definitions_org_id_version_unique
  unique (organization_id, id, version);

create table public.process_discovery_snapshots (
  id                     uuid        primary key default gen_random_uuid(),
  organization_id        uuid        not null references public.organizations(id) on delete cascade,
  process_definition_id  uuid        not null,
  definition_version     integer     not null,
  algorithm_key          text        not null,
  algorithm_version      text        not null,
  input_checksum         text        not null,
  parameters             jsonb       not null default '{}'::jsonb,
  parameters_checksum    text        not null,
  status                 text        not null default 'building',
  result_schema_version  integer     not null default 1,
  result                 jsonb,
  input_event_count      bigint      not null,
  input_case_count       bigint      not null,
  started_at             timestamptz not null default now(),
  completed_at           timestamptz,
  generated_at           timestamptz,
  error_code             text,
  error_message          text,

  constraint process_discovery_snapshots_definition_fkey
    foreign key (organization_id, process_definition_id, definition_version)
    references public.process_definitions(organization_id, id, version)
    on delete cascade,
  constraint process_discovery_snapshots_org_id_unique
    unique (organization_id, id),
  constraint process_discovery_snapshots_idempotency_unique
    unique (
      organization_id,
      process_definition_id,
      definition_version,
      algorithm_key,
      algorithm_version,
      input_checksum,
      parameters_checksum
    ),
  constraint process_discovery_snapshots_definition_version_positive
    check (definition_version > 0),
  constraint process_discovery_snapshots_algorithm_key_not_blank
    check (btrim(algorithm_key) <> ''),
  constraint process_discovery_snapshots_algorithm_version_not_blank
    check (btrim(algorithm_version) <> ''),
  constraint process_discovery_snapshots_input_checksum_valid
    check (input_checksum ~ '^fnv1a64:[0-9a-f]{16}$'),
  constraint process_discovery_snapshots_parameters_object
    check (jsonb_typeof(parameters) = 'object'),
  constraint process_discovery_snapshots_parameters_checksum_valid
    check (parameters_checksum ~ '^fnv1a64:[0-9a-f]{16}$'),
  constraint process_discovery_snapshots_status_valid
    check (status in ('building', 'ready', 'failed')),
  constraint process_discovery_snapshots_result_schema_version_positive
    check (result_schema_version > 0),
  constraint process_discovery_snapshots_input_counts_nonnegative
    check (input_event_count >= 0 and input_case_count >= 0),
  constraint process_discovery_snapshots_timestamps_valid
    check (
      (completed_at is null or completed_at >= started_at)
      and (generated_at is null or generated_at >= started_at)
    ),
  constraint process_discovery_snapshots_state_valid
    check (
      (
        status = 'building'
        and result is null
        and completed_at is null
        and generated_at is null
        and error_code is null
        and error_message is null
      )
      or (
        status = 'ready'
        and result is not null
        and completed_at is not null
        and generated_at is not null
        and error_code is null
        and error_message is null
      )
      or (
        status = 'failed'
        and result is null
        and completed_at is not null
        and generated_at is null
        and btrim(error_code) <> ''
        and btrim(error_message) <> ''
      )
    ),
  constraint process_discovery_snapshots_result_v1
    check (
      result is null
      or (
        jsonb_typeof(result) = 'object'
        and result ->> 'schemaVersion' = '1'
        and jsonb_typeof(result -> 'input') = 'object'
        and jsonb_typeof(result -> 'nodes') = 'array'
        and jsonb_typeof(result -> 'edges') = 'array'
        and jsonb_typeof(result -> 'paths') = 'array'
        and jsonb_typeof(result -> 'loops') = 'array'
        and jsonb_typeof(result -> 'rework') = 'array'
        and jsonb_typeof(result -> 'repeatedActivities') = 'array'
        and jsonb_typeof(result -> 'forbiddenTransitions') = 'array'
        and jsonb_typeof(result -> 'incompleteLifecycles') = 'array'
        and jsonb_typeof(result -> 'ambiguousOrderings') = 'array'
        and jsonb_typeof(result -> 'possibleConcurrency') = 'array'
        and jsonb_typeof(result -> 'metrics') = 'object'
        and jsonb_typeof(result -> 'bottlenecks') = 'array'
      )
    )
);

create table public.process_case_summaries (
  organization_id          uuid        not null,
  process_definition_id    uuid        not null,
  snapshot_id              uuid        not null,
  case_id                   text        not null,
  started_at                timestamptz not null,
  ended_at                  timestamptz,
  duration_ms               bigint,
  event_count               integer     not null,
  activity_count            integer     not null,
  variant_key               text        not null,
  has_loop                  boolean     not null default false,
  has_rework                boolean     not null default false,
  has_deviation             boolean     not null default false,
  has_anomaly               boolean     not null default false,
  has_possible_concurrency  boolean     not null default false,
  terminal_lifecycle        text,
  metadata_schema_version   integer     not null default 1,
  metadata_summary          jsonb       not null default '{}'::jsonb,

  constraint process_case_summaries_pkey primary key (snapshot_id, case_id),
  constraint process_case_summaries_snapshot_fkey
    foreign key (organization_id, snapshot_id)
    references public.process_discovery_snapshots(organization_id, id)
    on delete cascade,
  constraint process_case_summaries_definition_fkey
    foreign key (organization_id, process_definition_id)
    references public.process_definitions(organization_id, id)
    on delete cascade,
  constraint process_case_summaries_case_id_not_blank check (btrim(case_id) <> ''),
  constraint process_case_summaries_time_valid check (
    (ended_at is null and duration_ms is null)
    or (ended_at is not null and ended_at >= started_at and duration_ms >= 0)
  ),
  constraint process_case_summaries_counts_positive
    check (event_count > 0 and activity_count > 0),
  constraint process_case_summaries_variant_key_not_blank check (btrim(variant_key) <> ''),
  constraint process_case_summaries_terminal_lifecycle_valid check (
    terminal_lifecycle is null
    or terminal_lifecycle in ('started', 'completed', 'approved', 'cancelled', 'reopened')
  ),
  constraint process_case_summaries_metadata_version_positive check (metadata_schema_version > 0),
  constraint process_case_summaries_metadata_object check (jsonb_typeof(metadata_summary) = 'object')
);

create index idx_process_discovery_snapshots_ready
  on public.process_discovery_snapshots (
    organization_id,
    process_definition_id,
    generated_at desc,
    id
  )
  where status = 'ready';

create index idx_process_discovery_snapshots_definition_fk
  on public.process_discovery_snapshots (
    organization_id,
    process_definition_id,
    definition_version
  );

create index idx_process_case_summaries_page
  on public.process_case_summaries (organization_id, snapshot_id, started_at desc, case_id);

create index idx_process_case_summaries_variant
  on public.process_case_summaries (organization_id, snapshot_id, variant_key, case_id);

create index idx_process_case_summaries_flags
  on public.process_case_summaries (
    organization_id,
    snapshot_id,
    has_anomaly,
    has_loop,
    has_rework,
    has_deviation,
    case_id
  );

create index idx_process_case_summaries_definition_fk
  on public.process_case_summaries (organization_id, process_definition_id);

create schema if not exists private;

create or replace function private.guard_ready_process_discovery_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'ready' then
    raise exception 'ready process discovery snapshots are immutable'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_ready_process_discovery_snapshot() from public, anon, authenticated;

create trigger guard_ready_process_discovery_snapshot
  before update on public.process_discovery_snapshots
  for each row execute function private.guard_ready_process_discovery_snapshot();

alter table public.process_discovery_snapshots enable row level security;
alter table public.process_discovery_snapshots force row level security;
alter table public.process_case_summaries enable row level security;
alter table public.process_case_summaries force row level security;

create policy process_discovery_snapshots_select_ready_own_org
  on public.process_discovery_snapshots
  for select
  to authenticated
  using (
    status = 'ready'
    and organization_id = (select public.user_org())
  );

create policy process_case_summaries_select_ready_own_org
  on public.process_case_summaries
  for select
  to authenticated
  using (
    organization_id = (select public.user_org())
    and exists (
      select 1
      from public.process_discovery_snapshots snapshots
      where snapshots.organization_id = process_case_summaries.organization_id
        and snapshots.id = process_case_summaries.snapshot_id
        and snapshots.status = 'ready'
    )
  );

revoke all on table public.process_discovery_snapshots from public, anon, authenticated;
revoke all on table public.process_case_summaries from public, anon, authenticated;

grant select on table public.process_discovery_snapshots to authenticated;
grant select on table public.process_case_summaries to authenticated;

grant select, insert, update, delete on table public.process_discovery_snapshots to service_role;
grant select, insert, update, delete on table public.process_case_summaries to service_role;

comment on table public.process_discovery_snapshots is
  'Rebuildable Processos discovery results. process_events remains the source of truth.';
comment on column public.process_discovery_snapshots.result is
  'Versioned ResultadoDescoberta envelope. The browser can read ready snapshots only.';
comment on column public.process_discovery_snapshots.parameters_checksum is
  'FNV-1a checksum of normalized discovery parameters used in the idempotency key.';
comment on table public.process_case_summaries is
  'Rebuildable case-level materialization tied to one discovery snapshot.';
comment on column public.process_case_summaries.has_possible_concurrency is
  'Observed temporal overlap only; it does not prove structural parallelism or causality.';
