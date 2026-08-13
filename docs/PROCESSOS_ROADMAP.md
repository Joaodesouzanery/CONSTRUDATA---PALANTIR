# ConstruData — módulo Processos — Roadmap

## Status

| Milestone | Deliverable | Status |
| --- | --- | --- |
| M0 | Repository analysis and architecture | Complete |
| M1 | Universal Event Model + deterministic synthetic ground truth | Complete |
| M2 | Discovery Engine + snapshots + case summaries | Complete |
| M2.5 | Native Processos UI + React Flow/ELK + local DEMO | Complete |
| M3 | Metrics and Bottleneck Engine | Not started |
| M4 | Advanced Interactive Process Visualization | Not started |
| M5 | Configurable Ontology | Not started |
| M6 | Root Cause Analysis | Not started |
| M7 | What-if Simulation | Not started |
| M8 | Public Commercial Demo | Not started |
| M9 | CSV/Excel Importer | Not started |
| M10 | PostgreSQL/API Connectors | Not started |
| M11 | Rules and Actions | Not started |
| M12 | AI Copilot | Not started |

## M1 acceptance gates

- Versioned, multi-tenant definitions and append-only event schema.
- Explicit Data API grants and tenant-isolated RLS.
- Deterministic 12,483-case construction-procurement dataset.
- Reproducible lineage, checksum, planted effects, loops and deviations.
- Separate queue-time and processing-time ground truth.
- TypeScript and pgTAP coverage.
- Tests, lint, typecheck and build passing, or an external toolchain blocker
  recorded with evidence.

O contrato M1 foi validado local e remotamente e permaneceu congelado durante
M2. A migration M1 não foi renomeada nem alterada. A reconciliação do histórico
remoto continua como dívida operacional separada porque o SQL foi aplicado
manualmente; schema, RLS, ACLs e índices estão validados.

## M2–M4 engine/presentation boundary

M2 reconstrói casos e produz o envelope `ResultadoDescoberta` com nós, arestas,
variantes e sete categorias analíticas separadas. M2.5 consome esse mesmo
envelope em `/app/processos`. M3 adicionará durações, percentis, SLAs e gargalos:

```json
{
  "nodes": [],
  "edges": [],
  "paths": [],
  "metrics": {},
  "bottlenecks": []
}
```

M2.5 entrega o mapa funcional inicial com React Flow e ELK.js. M4 fica reservado
para visualização avançada; a apresentação nunca recalcula analytics.

## M2/M2.5 delivery record

Implementation date: 2026-08-13.

### Delivered

- Engine incremental e determinístico em `src/features/processos/core`.
- `ResultadoDescoberta` separando loops, retrabalho, repetições, desvios,
  lifecycle incompleto, ordem ambígua e possível concorrência observada.
- Migration `20260813182714_processos_discovery_m2.sql`, separada da M1.
- Snapshots idempotentes e resumos de casos tenant-safe e reconstruíveis.
- Materializador server-side dry-run por padrão, SQL de verificação e pgTAP M2.
- Rota lazy, Sidebar, Minha Rotina, quatro abas e mapa React Flow/ELK.
- DEMO local canônica com resultado agregado e dez casos representativos.

M1 e M2 foram aplicadas manualmente no projeto remoto e sua estrutura, RLS,
políticas e índices foram confirmados por inspeção read-only. O plano enviado
pelo responsável confirmou `idx_process_events_case_order` e execução de
0,031 ms. A migration posterior
`20260813192909_processos_service_role_least_privilege.sql` passou em dois
ciclos locais, foi aplicada manualmente e teve os ACLs conferidos por MCP:
eventos são append-only, definições não podem ser excluídas e nenhuma tabela
aceita `TRUNCATE` via `service_role`. M1, M2 e M2.5 estão `Complete`. M3
permanece explicitamente não iniciado.

## M1 delivery record

Implementation date: 2026-08-13.

### Delivered

- Specification, architecture, roadmap and synthetic ground-truth documents.
- Public TypeScript contracts for definitions, event lifecycle, process models,
  feature mappings, KPI/SLA definitions and synthetic datasets.
- Deterministic construction-procurement generator and guarded server-side seed.
- Migration `20260813034218_process_intelligence_m1.sql` with multi-tenant keys,
  constraints, indexes, minimum privileges, forced RLS and append-only events.
- TypeScript behavioral tests, a 35-assertion pgTAP database suite and a
  paginated persisted-data verifier.

The default seed produces exactly 12,483 cases and 153,290 events with checksum
`fnv1a64:0e385132416e749b`. It contains 1,498 reworked cases, split into 874
`Approval -> Review`, 374 `Purchase -> Approval` and 250
`Delivery -> Purchase` loops. It also contains 11,484 standard, 624 emergency,
125 cancelled and 250 forbidden-deviation cases. The documented analytical
cohorts contain 2,543 new suppliers, 3,762 high-value purchases, 3,111
Infrastructure cases, 3,101 hydraulic-material cases and 188 three-factor
interaction cases.

### Validation record

| Gate | Command | Result |
| --- | --- | --- |
| TypeScript tests | `npm run test:processos` | Passed: 9/9 |
| Scoped lint | `npx eslint src/features/processos scripts/semear-processos.ts scripts/verificar-processos.ts` | Passed |
| Typecheck | `npx tsc -b` | Passed |
| Production build | `npm run build` | Passed; existing chunk-size warning only |
| Patch hygiene | `git diff --check` | Passed |
| Migration static parse | `pglast` parser | Passed: 27 statements |
| Local replay, cycle 1 | `npx supabase@2.114.0 db reset --local` | Passed: complete chain through M1, M2 and least-privilege correction |
| Database tests, cycle 1 | `npx supabase@2.114.0 test db supabase/tests/process_intelligence_m1.test.sql supabase/tests/processos_m2.test.sql --local` | Passed: 76/76 |
| Local replay, cycle 2 | `npx supabase@2.114.0 db reset --local` | Passed: complete chain through M1, M2 and least-privilege correction |
| Database tests, cycle 2 | `npx supabase@2.114.0 test db supabase/tests/process_intelligence_m1.test.sql supabase/tests/processos_m2.test.sql --local` | Passed: 76/76 |
| Persisted seed verification | `npm run verify:processos` | Passed: 1 definition, 12,483 cases, 153,290 unique events/lineages and locked checksum |
| Case reconstruction plan | `EXPLAIN (ANALYZE, BUFFERS)` | Passed locally and remotely: `idx_process_events_case_order`, no sort; remote execution 0.036 ms |
| Logical seed rollback | Delete dedicated synthetic organization | Passed: definitions/events `1/153290 -> 0/0` by cascade |
| Supabase lint, both cycles | `npx supabase@2.114.0 db lint --local --schema public --level error --fail-on error` | Failed on five pre-existing functions unrelated to M1 |
| Remote MCP inspection | Official project-scoped Supabase MCP | Passed read-only: project ref `wtovivsmvenjbuhdemzv`, PostgreSQL 17.6 |
| Supabase Branch/staging | MCP `list_branches` | Zero branches; M1/M2 were applied manually by the project owner |
| Remote migration history | MCP `list_migrations` plus catalog inspection | Schema exists, but manually applied M1/M2 timestamps are absent from migration history; reconciliation remains separate |
| Remote Processos schema | Read-only catalog inspection | Tables, forced RLS, tenant policies and expected indexes confirmed; production tables remain empty |
| Remote least privilege | Catalog ACL inspection | Passed: exact least-privilege matrix confirmed after correction; no `TRUNCATE`, event log append-only |
| Repository-wide lint | `npm run lint` | Failed on pre-existing debt: 65 source errors and 20 warnings; after build, unignored `dist-ssr` raises the total to 254 errors and 20 warnings; M1 scope is clean |

The two local database cycles, executable RLS tests, persisted seed, query plan
and cleanup are green. Database lint is not green because it reports existing
errors in `approve_pending_action_service`, `reject_pending_action_service`,
`invite_org_member`, `accept_invitation` and `recompute_project_kpis`; Processos
adds no database functions. M1/M2 now exist remotely and their forced RLS,
tenant policies and indexes were confirmed. The separate least-privilege
correction was replayed locally twice, applied manually and verified remotely;
the event log remains append-only and no Processos table is truncatable through
`service_role`. Migration history still needs later reconciliation because
manual SQL execution does not register M1/M2 versions. This is recorded as an
operational limitation and does not change the validated schema. M1/M2/M2.5
are **Complete**. M3 remains explicitly **Not started**.
