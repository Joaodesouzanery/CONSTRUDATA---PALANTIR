-- ConstruData Process Intelligence M1
-- Universal, versioned process definitions and append-only canonical events.
-- Browser clients receive tenant-scoped read access only. Ingestion is server-side.

create table if not exists public.process_definitions (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references public.organizations(id) on delete cascade,
  process_key       text        not null,
  version           integer     not null default 1,
  name              text        not null,
  description       text        not null default '',
  timezone          text        not null default 'UTC',
  case_object_type  text        not null,
  source_mappings   jsonb       not null default '{}'::jsonb,
  feature_mappings  jsonb       not null default '{}'::jsonb,
  process_model     jsonb       not null,
  objective         jsonb       not null default '{}'::jsonb,
  kpi_definitions   jsonb       not null default '{"schemaVersion":1,"definitions":[]}'::jsonb,
  sla_definitions   jsonb       not null default '{"schemaVersion":1,"definitions":[]}'::jsonb,
  created_by        uuid        references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),

  constraint process_definitions_process_key_not_blank check (btrim(process_key) <> ''),
  constraint process_definitions_version_positive check (version > 0),
  constraint process_definitions_timezone_not_blank check (btrim(timezone) <> ''),
  constraint process_definitions_source_mappings_object check (jsonb_typeof(source_mappings) = 'object'),
  constraint process_definitions_feature_mappings_object check (jsonb_typeof(feature_mappings) = 'object'),
  constraint process_definitions_process_model_v1 check (
    jsonb_typeof(process_model) = 'object'
    and process_model ->> 'schemaVersion' = '1'
    and jsonb_typeof(process_model -> 'allowedPaths') = 'array'
    and jsonb_typeof(process_model -> 'requiredStates') = 'array'
    and jsonb_typeof(process_model -> 'optionalStates') = 'array'
    and jsonb_typeof(process_model -> 'forbiddenTransitions') = 'array'
    and jsonb_typeof(process_model -> 'startStates') = 'array'
    and jsonb_typeof(process_model -> 'endStates') = 'array'
    and jsonb_typeof(process_model -> 'concurrencyGroups') = 'array'
  ),
  constraint process_definitions_kpis_v1 check (
    jsonb_typeof(kpi_definitions) = 'object'
    and kpi_definitions ->> 'schemaVersion' = '1'
    and jsonb_typeof(kpi_definitions -> 'definitions') = 'array'
  ),
  constraint process_definitions_slas_v1 check (
    jsonb_typeof(sla_definitions) = 'object'
    and sla_definitions ->> 'schemaVersion' = '1'
    and jsonb_typeof(sla_definitions -> 'definitions') = 'array'
  ),
  constraint process_definitions_org_key_version_unique unique (organization_id, process_key, version),
  constraint process_definitions_org_id_unique unique (organization_id, id)
);

create table if not exists public.process_events (
  event_id              uuid        primary key default gen_random_uuid(),
  event_schema_version  integer     not null default 1,
  organization_id       uuid        not null references public.organizations(id) on delete cascade,
  process_definition_id uuid        not null,
  case_id                text        not null,
  activity               text        not null,
  lifecycle              text,
  occurred_at            timestamptz not null,
  sequence_number        integer,
  actor_id               text,
  object_type            text,
  object_id              text,
  source_system          text        not null,
  source_event_id        text        not null,
  metadata               jsonb       not null,
  ingested_at            timestamptz not null default now(),

  constraint process_events_definition_org_fkey
    foreign key (organization_id, process_definition_id)
    references public.process_definitions(organization_id, id)
    on delete restrict,
  constraint process_events_schema_version_positive check (event_schema_version > 0),
  constraint process_events_case_id_not_blank check (btrim(case_id) <> ''),
  constraint process_events_activity_not_blank check (btrim(activity) <> ''),
  constraint process_events_lifecycle_valid check (
    lifecycle is null or lifecycle in ('started', 'completed', 'approved', 'cancelled', 'reopened')
  ),
  constraint process_events_sequence_nonnegative check (sequence_number is null or sequence_number >= 0),
  constraint process_events_object_pair check (
    (object_type is null and object_id is null)
    or (object_type is not null and object_id is not null)
  ),
  constraint process_events_source_system_not_blank check (btrim(source_system) <> ''),
  constraint process_events_source_event_id_not_blank check (btrim(source_event_id) <> ''),
  constraint process_events_metadata_v1 check (
    jsonb_typeof(metadata) = 'object'
    and jsonb_typeof(metadata -> 'schema_version') = 'number'
  ),
  constraint process_events_source_lineage_unique
    unique (organization_id, source_system, source_event_id)
);

-- Equality columns first; event time is the range/order column. sequence_number
-- remains nullable for sources that cannot provide an ordering hint.
create index if not exists idx_process_events_case_order
  on public.process_events (
    organization_id,
    process_definition_id,
    case_id,
    occurred_at asc,
    sequence_number asc nulls last,
    event_id asc
  );

create index if not exists idx_process_events_activity_time
  on public.process_events (organization_id, process_definition_id, activity, occurred_at);

create index if not exists idx_process_events_object
  on public.process_events (organization_id, object_type, object_id)
  where object_id is not null;

create index if not exists idx_process_events_definition_fk
  on public.process_events (organization_id, process_definition_id);

create index if not exists idx_process_definitions_created_by_fk
  on public.process_definitions (created_by)
  where created_by is not null;

alter table public.process_definitions enable row level security;
alter table public.process_definitions force row level security;
alter table public.process_events enable row level security;
alter table public.process_events force row level security;

drop policy if exists process_definitions_select_own_org on public.process_definitions;
create policy process_definitions_select_own_org
  on public.process_definitions
  for select
  to authenticated
  using (organization_id = (select public.user_org()));

drop policy if exists process_events_select_own_org on public.process_events;
create policy process_events_select_own_org
  on public.process_events
  for select
  to authenticated
  using (organization_id = (select public.user_org()));

-- Explicit grants are required because new public tables may not be exposed to
-- the Data API automatically. Browser users are deliberately read-only.
revoke all on table public.process_definitions from public, anon, authenticated;
revoke all on table public.process_events from public, anon, authenticated;

grant select on table public.process_definitions to authenticated;
grant select on table public.process_events to authenticated;

grant select, insert, update on table public.process_definitions to service_role;
grant select, insert on table public.process_events to service_role;

comment on table public.process_definitions is
  'Versioned, tenant-scoped configuration for universal operational processes.';
comment on column public.process_definitions.timezone is
  'IANA timezone for business calendars; event timestamps remain UTC.';
comment on table public.process_events is
  'Append-only canonical event log. Client roles have tenant-scoped SELECT only.';
comment on column public.process_events.case_id is
  'Stable identifier of one process instance.';
comment on column public.process_events.object_id is
  'Stable namespaced operational object identifier; may vary within one case.';
comment on column public.process_events.sequence_number is
  'Optional deterministic tie-breaker after occurred_at and before event_id.';
