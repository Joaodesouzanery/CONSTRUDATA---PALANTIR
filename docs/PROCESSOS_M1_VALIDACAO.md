# Processos M1 — Validation Record

Validation date: 2026-08-13. The canonical fixture uses seed `20260813`, UTC
storage and process timezone `America/Sao_Paulo`.

## Automated gates

This record contains only commands actually executed. Both local cycles,
persisted seed, RLS, remote ACL and query-plan checks pass. M1 is `Complete`.
Repository-wide database lint and migration-history reconciliation remain
separate pre-existing operational debt.

The local configuration explicitly sets `db.seed.enabled = false`. Synthetic
data is never loaded by migrations, reset, build or deploy.

| Gate | Cycle/result |
| --- | --- |
| Full migration replay | Passed twice through `20260813034218_process_intelligence_m1.sql` |
| pgTAP | Passed twice after M2.1, 35/35 M1 assertions within 76/76 total each cycle |
| RLS | `anon` denied; tenant A/B isolated; authenticated writes denied |
| Server ingestion | Passed with `service_role`; full seed also persisted through the server API |
| Persisted verifier | 1 definition, 12,483 cases, 153,290 unique events and lineages |
| Persisted checksum | `fnv1a64:0e385132416e749b` |
| Logical rollback | Dedicated organization deletion cascaded from `1/153290` to `0/0` definitions/events |
| TypeScript tests | Passed: 9/9 |
| M1-scoped ESLint | Passed for contracts, generator, seed and persisted verifier |
| Typecheck and build | Passed; build emits only the existing large-chunk warning |
| Patch hygiene | `git diff --check` passed |
| Database lint | Blocked by five pre-existing function errors outside M1 |
| Remote MCP | Authenticated against project `wtovivsmvenjbuhdemzv`; read-only inspection completed |
| Staging | No Supabase Branch exists; project owner applied the reviewed SQL manually |
| Migration history | Schema is validated, but manually pasted M1/M2 versions remain absent from remote history |

### Query-plan evidence

The canonical reconstruction query for case
`procurement-case:synthetic:000011` returned 12 rows and produced:

```text
Index Scan using idx_process_events_case_order on process_events
Index Cond: organization_id = ... AND process_definition_id = ... AND case_id = ...
Buffers: shared hit=5
Execution Time: 0.854 ms
```

No `Sort` or global sequential scan appeared. The equality-filter columns and
canonical event ordering are satisfied by the composite index.

### Known database-lint baseline

Two identical lint runs reported errors in historical functions:

- `approve_pending_action_service` and `reject_pending_action_service` refer to
  a missing `pending_actions.updated_at` column;
- `invite_org_member` and `accept_invitation` cannot resolve unqualified
  cryptographic functions;
- `recompute_project_kpis` compares `text` with `uuid`.

M1 creates no functions, so these are not regressions introduced by M1. They
remain blockers to declaring the repository-wide database lint green and must
be fixed in a separate reviewed migration.

The remote schema confirms the same underlying defects and that all five
functions predate M1:

| Function | Exact defect | Operational risk | Separate corrective migration proposal |
| --- | --- | --- | --- |
| `approve_pending_action_service(uuid)` | Updates nonexistent `pending_actions.updated_at` | Email/service approval fails at runtime, leaving the action pending | Replace `updated_at = now()` with the existing `approved_at = now()` and preserve service-role-only execution |
| `reject_pending_action_service(uuid,text)` | Updates nonexistent `pending_actions.updated_at` | Email/service rejection fails at runtime | Record processing through existing `approved_at = now()` plus `rejected_reason`; preserve service-role-only execution |
| `invite_org_member(text,user_role)` | Cannot resolve `gen_random_bytes(integer)` because the function fixes `search_path=public`, while `pgcrypto` is in `extensions` | Member invitation token generation fails | Recreate the function with `extensions.gen_random_bytes` and `extensions.digest`; retain a locked search path and existing role checks |
| `accept_invitation(text,text)` | Cannot resolve `digest(text,text)` for the same schema/search-path reason | Invitation acceptance fails before token lookup | Recreate with `extensions.digest`, retain authenticated-user/email validation, and review the unnecessary `anon` grant separately |
| `recompute_project_kpis(uuid)` | Compares `rdo.project_id` (`text`) with the UUID parameter | KPI recomputation fails when counting RDOs | Compare `rdo.project_id = p_project_id::text` and include `organization_id = v_org_id` so the existing tenant/index shape is usable |

No corrective migration was created or applied. The proposal must be reviewed
as an independent historical-maintenance change; it is not part of M1.

Repository-wide ESLint also remains a separate baseline: 65 source errors and
20 warnings predate M1. Running it after the production build additionally
scans the unignored `dist-ssr` artifact and reports 254 errors plus 20 warnings.
The complete M1 scope passes its explicit ESLint command.

## Human-readable deterministic sample

The following cases were selected from the canonical generated fixture. The
feature values are ordinary analytical metadata, not ground-truth flags.

### Standard — `procurement-case:synthetic:000011`

Features: `amount=11488`, `supplier_age_days=680`,
`department=DEP-PROJECTS`, `material=structural`.

```text
01 2026-01-01T15:18:50.499Z Material Request.started
02 2026-01-01T15:48:11.270Z Material Request.completed
03 2026-01-01T20:27:08.920Z Review.started
04 2026-01-01T22:49:11.279Z Review.completed
05 2026-01-02T07:50:50.017Z Approval.started
06 2026-01-02T09:30:30.465Z Approval.approved
07 2026-01-02T18:44:24.739Z Purchase.started
08 2026-01-02T22:30:16.028Z Purchase.completed
09 2026-01-06T03:19:48.201Z Delivery.started
10 2026-01-06T04:12:27.008Z Delivery.completed
11 2026-01-06T19:56:00.499Z Consumption.started
12 2026-01-06T20:33:19.935Z Consumption.completed
```

### New supplier — `procurement-case:synthetic:000010`

Features: `amount=29224`, `supplier_age_days=26`,
`department=DEP-PROJECTS`, `material=structural`.

```text
01 2026-01-01T13:38:36.183Z Material Request.started
02 2026-01-01T14:07:47.622Z Material Request.completed
03 2026-01-01T20:49:43.477Z Review.started
04 2026-01-02T00:20:31.538Z Review.completed
05 2026-01-03T11:16:58.816Z Approval.started
06 2026-01-03T12:21:55.482Z Approval.approved
07 2026-01-03T20:01:29.554Z Purchase.started
08 2026-01-04T00:01:32.496Z Purchase.completed
09 2026-01-06T08:13:02.043Z Delivery.started
10 2026-01-06T09:15:04.616Z Delivery.completed
11 2026-01-07T18:13:18.493Z Consumption.started
12 2026-01-07T18:28:16.414Z Consumption.completed
```

### High amount — `procurement-case:synthetic:000003`

Features: `amount=123730`, `supplier_age_days=1073`,
`department=DEP-ADMINISTRATION`, `material=structural`.

```text
01 2026-01-01T09:15:59.063Z Material Request.started
02 2026-01-01T09:49:17.210Z Material Request.completed
03 2026-01-01T16:15:06.048Z Review.started
04 2026-01-01T18:26:43.180Z Review.completed
05 2026-01-02T20:45:42.367Z Approval.started
06 2026-01-02T22:58:32.006Z Approval.approved
07 2026-01-03T03:12:10.164Z Purchase.started
08 2026-01-03T05:16:52.610Z Purchase.completed
09 2026-01-04T13:51:43.380Z Delivery.started
10 2026-01-04T15:09:24.972Z Delivery.completed
11 2026-01-05T11:51:54.462Z Consumption.started
12 2026-01-05T12:11:16.399Z Consumption.completed
```

### Triple interaction — `procurement-case:synthetic:000063`

Features: `amount=88251`, `supplier_age_days=27`,
`department=DEP-INFRASTRUCTURE`, `material=finishes`.

```text
01 2026-01-02T06:38:31.861Z Material Request.started
02 2026-01-02T07:15:48.369Z Material Request.completed
03 2026-01-02T21:38:42.569Z Review.started
04 2026-01-03T00:41:11.549Z Review.completed
05 2026-01-06T07:40:20.956Z Approval.started
06 2026-01-06T09:39:52.703Z Approval.approved
07 2026-01-06T15:59:57.481Z Purchase.started
08 2026-01-06T19:06:42.418Z Purchase.completed
09 2026-01-11T15:07:28.904Z Delivery.started
10 2026-01-11T16:42:15.074Z Delivery.completed
11 2026-01-12T02:10:13.487Z Consumption.started
12 2026-01-12T02:31:49.720Z Consumption.completed
```

### Emergency — `procurement-case:synthetic:000001`

```text
01 2026-01-01T08:58:29.420Z Material Request.started
02 2026-01-01T09:26:07.181Z Material Request.completed
03 2026-01-01T13:23:57.598Z Emergency Approval.started
04 2026-01-01T14:12:24.153Z Emergency Approval.approved
05 2026-01-01T19:38:51.101Z Purchase.started
06 2026-01-01T21:23:41.262Z Purchase.completed
07 2026-01-05T07:17:42.644Z Delivery.started
08 2026-01-05T08:19:32.092Z Delivery.completed
09 2026-01-06T21:00:07.100Z Consumption.started
10 2026-01-06T21:43:54.634Z Consumption.completed
```

### Cancelled — `procurement-case:synthetic:000181`

```text
01 2026-01-04T02:08:23.331Z Material Request.started
02 2026-01-04T02:32:33.966Z Material Request.completed
03 2026-01-04T18:43:47.669Z Review.started
04 2026-01-04T20:57:45.338Z Review.completed
05 2026-01-05T05:06:15.488Z Approval.started
06 2026-01-05T06:38:55.118Z Approval.cancelled
```

### Forbidden `Review -> Purchase` — `procurement-case:synthetic:000051`

```text
01 2026-01-02T03:09:10.084Z Material Request.started
02 2026-01-02T04:01:03.516Z Material Request.completed
03 2026-01-02T20:26:38.445Z Review.started
04 2026-01-02T22:47:19.672Z Review.completed
05 2026-01-03T02:25:34.535Z Purchase.started
06 2026-01-03T04:46:29.119Z Purchase.completed
07 2026-01-06T15:06:17.097Z Delivery.started
08 2026-01-06T16:18:59.963Z Delivery.completed
09 2026-01-07T06:31:55.888Z Consumption.started
10 2026-01-07T06:56:04.791Z Consumption.completed
```

### Loop `Approval -> Review` — `procurement-case:synthetic:000022`

```text
01 2026-01-01T17:56:37.389Z Material Request.started
02 2026-01-01T18:27:34.767Z Material Request.completed
03 2026-01-02T09:38:27.139Z Review.started
04 2026-01-02T11:57:58.995Z Review.completed
05 2026-01-03T18:13:02.668Z Approval.started
06 2026-01-03T20:29:52.733Z Approval.approved
07 2026-01-04T08:12:29.550Z Review.reopened
08 2026-01-04T11:03:17.907Z Review.completed
09 2026-01-05T18:38:47.840Z Approval.reopened
10 2026-01-05T19:47:06.434Z Approval.approved
11 2026-01-06T01:41:43.096Z Purchase.started
12 2026-01-06T03:32:54.711Z Purchase.completed
13 2026-01-08T22:42:57.048Z Delivery.started
14 2026-01-08T23:39:13.300Z Delivery.completed
15 2026-01-09T20:58:18.934Z Consumption.started
16 2026-01-09T21:31:59.024Z Consumption.completed
```

### Loop `Purchase -> Approval` — `procurement-case:synthetic:000006`

```text
01 2026-01-01T13:15:16.762Z Material Request.started
02 2026-01-01T13:40:16.670Z Material Request.completed
03 2026-01-01T19:06:20.791Z Review.started
04 2026-01-01T21:21:34.827Z Review.completed
05 2026-01-02T15:32:52.236Z Approval.started
06 2026-01-02T16:51:26.543Z Approval.approved
07 2026-01-03T01:31:08.502Z Purchase.started
08 2026-01-03T03:26:33.549Z Purchase.completed
09 2026-01-04T14:04:35.957Z Approval.reopened
10 2026-01-04T15:30:27.799Z Approval.approved
11 2026-01-04T19:53:30.271Z Purchase.reopened
12 2026-01-05T00:18:14.715Z Purchase.completed
13 2026-01-10T11:06:15.527Z Delivery.started
14 2026-01-10T12:08:16.445Z Delivery.completed
15 2026-01-11T14:38:09.495Z Consumption.started
16 2026-01-11T15:03:51.651Z Consumption.completed
```

### Loop `Delivery -> Purchase` — `procurement-case:synthetic:000007`

```text
01 2026-01-01T12:49:18.021Z Material Request.started
02 2026-01-01T13:17:49.255Z Material Request.completed
03 2026-01-01T19:08:24.922Z Review.started
04 2026-01-01T22:17:09.249Z Review.completed
05 2026-01-02T09:40:40.262Z Approval.started
06 2026-01-02T11:12:59.390Z Approval.approved
07 2026-01-02T21:43:23.647Z Purchase.started
08 2026-01-03T01:28:39.422Z Purchase.completed
09 2026-01-06T09:52:34.193Z Delivery.started
10 2026-01-06T10:49:08.582Z Delivery.completed
11 2026-01-06T22:05:00.801Z Purchase.reopened
12 2026-01-07T00:52:46.127Z Purchase.completed
13 2026-01-09T18:22:38.621Z Delivery.reopened
14 2026-01-09T19:50:38.402Z Delivery.completed
15 2026-01-10T09:48:22.231Z Consumption.started
16 2026-01-10T10:15:36.323Z Consumption.completed
```

All samples preserve the complete lifecycle sequence and exact timestamps from
the locked seed.

## Remote validation

Remote inspection was performed through the official, project-scoped Supabase
MCP server. SQL application was performed manually by the project owner; Codex
used only read-only inspection and did not seed, create branches or clean data.

### Project and staging evidence

- MCP project URL: `https://wtovivsmvenjbuhdemzv.supabase.co`.
- Confirmed project ref: `wtovivsmvenjbuhdemzv`.
- `list_branches`: zero branches.
- PostgreSQL version: `17.6`.
- `process_definitions`, `process_events`, `process_discovery_snapshots` and
  `process_case_summaries` exist remotely with forced RLS.
- Expected tenant policies and reconstruction/materialization indexes exist.
- Production remains free of synthetic data.
- The final reconstruction plan uses `idx_process_events_case_order` with
  execution time `0.031 ms`.
- The least-privilege correction was verified remotely: `process_events` has
  only `SELECT/INSERT` for `service_role`; definitions have no delete; derived
  materializations allow controlled DML; no Processos table allows `TRUNCATE`.

### Migration-history comparison

The MCP returned 62 remote migration-history entries. The versioned local
directory contains 112 real migration files after excluding the historical
`APPLY_*` bundles.

- 57 local versions are absent from remote history.
- Seven remote versions are absent locally but have the same migration names
  as seven local files with different timestamps.
- After matching those seven aliases by name, 50 local migration names remain
  unrepresented remotely; M1 is only the last of those 50.
- The last recorded remote migration is
  `20260519043006_levantamento_obra`; the local counterpart is
  `20260519120000_levantamento_obra`.
- The remote schema already contains tables introduced by later local work
  (including finance, maintenance and predial tables) despite the missing
  history entries. This proves schema/history drift and makes an automatic push
  unsafe.

Timestamp aliases requiring explicit reconciliation are:

| Remote version | Local version | Migration name |
| --- | --- | --- |
| `20260511023039` | `20260511120000` | `unified_measurement_schema_alignment` |
| `20260518143900` | `20260518133035` | `tenant_safe_almoxarifado_isolation` |
| `20260518144356` | `20260518144500` | `tenant_guard_function_permissions` |
| `20260518144451` | `20260518145000` | `almoxarifado_rpc_grants` |
| `20260518154219` | `20260518153640` | `tenant_safe_projects_torre_gestao` |
| `20260518175846` | `20260518184500` | `global_multi_tenant_isolation` |
| `20260519043006` | `20260519120000` | `levantamento_obra` |

M1/M2 were applied manually, so their timestamps still do not appear in remote
migration history even though the effective schema is present and validated.
Before any future `db push`, reconcile history in a controlled environment.
Use `migration repair` only after proving each corresponding schema change is
present in full; never use `--include-all` as an automatic reconciliation.

The local database gates, deterministic dataset, executable RLS tests, remote
schema/ACL inspection and query plan are green. The history drift and the five
historical lint failures are documented debt outside Processos. M1 is
`Complete`; M2 and M2.5 were subsequently validated and completed without
starting M3 automatically.
