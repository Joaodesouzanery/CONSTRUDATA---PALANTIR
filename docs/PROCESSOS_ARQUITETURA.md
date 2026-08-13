# ConstruData — módulo Processos — Architecture

## 1. Current repository architecture

ConstruData is a React 19 and TypeScript SPA built with Vite, Tailwind CSS v4,
React Router and Zustand. Product modules live in `src/features`, shared UI in
`src/components`, shared infrastructure in `src/lib`, and tenant-scoped state in
`src/store`. Vercel serves the public landing as pre-rendered HTML and rewrites
authenticated SPA routes to `app.html`.

Supabase provides PostgreSQL, Auth, Realtime and Storage. The browser uses only
the public key. Authentication resolves an active profile and organization;
database isolation is enforced with `organization_id`, RLS and
`public.user_org()`. O módulo Processos é nativo do ConstruData e usa uma fonte
analítica somente leitura no navegador, ingerida e materializada server-side.

## 2. Proposed architecture

The platform remains one repository and evolves in layers:

1. Source systems and future connectors.
2. Bronze immutable source payloads in Storage or private database schemas.
3. Silver normalized records.
4. Canonical `process_events` and versioned `process_definitions`.
5. Independently versioned Event Model and Ontology Model, joined through
   stable object identifiers.
6. Discovery, metrics, bottleneck, root-cause and simulation engines.
7. Native `src/features/processos` module in the existing React application.

M1 cria a camada 4 e seu fixture determinístico. M2 cria materializações
derivadas e M2.5 integra a experiência ao shell existente. Não existe produto,
aplicação ou rota pública paralela.

## 3. Reuse

- Existing organization, profile, membership and `public.user_org()` security
  model.
- Existing Supabase client and authenticated application shell for later reads.
- Existing TypeScript strictness, Vite aliases, Tailwind tokens and shared UI.
- Existing migration directory, SQL security conventions and pgTAP-compatible
  test location.
- Existing Vercel SPA deployment and public pre-rendering strategy.

## 4. New modules

- `src/features/processos/core`: contratos, gerador M1 e discovery engine puro.
- `src/features/processos/demo`: fixture local no mesmo contrato persistido.
- `src/features/processos/components`: apresentação React Flow/ELK.
- `scripts/semear-processos.ts`: seed M1 explícito e proibido em produção.
- `scripts/materializar-descoberta-processos.ts`: materialização M2 server-side.
- `process_discovery_snapshots` e `process_case_summaries`: projeções derivadas.

## 5. Database model

`process_definitions` is immutable-by-version and scoped by organization. It
stores source mappings, semantic feature mappings, a versioned process model,
and typed KPI/SLA definition collections.

`process_events` is an append-only canonical log. Its tenant-safe composite FK
prevents cross-organization definition references. Source lineage is unique by
organization, source system and source event. The case-order index follows:

```sql
occurred_at asc, sequence_number asc nulls last, event_id asc
```

`case_id` is the process instance. `object_id` is the stable namespaced object
involved in one event and can vary within a case. M5 will reuse the same object
identifier in the Ontology without coupling either model's version lifecycle.

All persisted timestamps are UTC. `ProcessDefinition.timezone` is an IANA name
used later for local calendars, business hours and working-time SLAs.

`process_discovery_snapshots` registra versões da definição e do algoritmo,
checksum, parâmetros normalizados, estado e o envelope `ResultadoDescoberta`.
Somente snapshots `ready` são visíveis ao navegador e, depois de prontos, são
imutáveis. `process_case_summaries` mantém uma linha tenant-safe por caso.

Eventos continuam sendo a fonte de verdade. As duas tabelas M2 são projeções
descartáveis e integralmente reconstruíveis; removê-las não afeta eventos.

## 6. Module boundaries

- Event contracts know nothing about React, Zustand or Supabase clients.
- Synthetic generation is pure and deterministic: no current clock, network,
  environment variables or database access.
- The seed adapter owns Supabase serialization and batching.
- Analytics engines consume canonical events and definitions but never synthetic
  ground-truth labels.
- Presentation consumes engine outputs and never recomputes process analytics.
- UI real e DEMO recebem exatamente `ResultadoDescoberta`; somente o adapter de
  carregamento muda.

The event model does not assume strict sequence. Lifecycle intervals may
overlap, and deterministic sorting must not be interpreted as causality.
`process_model.concurrencyGroups` fica reservado para fork/join explícito.
`possibleConcurrency` em M2 significa apenas sobreposição estrita de intervalos;
não prova paralelismo estrutural, causalidade nem fork/join formal.

## 7. API boundaries

M1 exposes only TypeScript generation contracts and direct read access through
RLS. Planned server boundaries are:

- M2: descoberta versionada, snapshots e resumos de caso.
- M3: metrics and bottlenecks, completing the engine response
  `{ nodes, edges, paths, metrics, bottlenecks }`.
- M6: associated-factor analysis over feature mappings.
- M7: deterministic what-if scenarios.
- M9/M10: authenticated ingestion jobs for files and connectors.
- M11: audited rules and actions.

## 8. Frontend route

`/app/processos` é lazy, autenticada e liberada a todos os usuários do tenant.
Está no grupo GESTÃO da Sidebar e no registro da Minha Rotina. Não existe rota
pública ou aplicação separada.

## 9. DEMO local boundary

O toggle DEMO existente carrega apenas `processos-demo.json`, sem consultas ou
gravações Supabase. A fixture contém o resultado agregado completo e dez casos
representativos e tem checksum validado contra o gerador M1.

## 10. Phased implementation

M1 entrega o event log. M2 entrega discovery e materializações. M2.5 entrega a
UI básica. M3 calcula métricas e gargalos; M4 avança a visualização. Ontologia,
RCA, simulação, demo comercial, conectores, ações e IA seguem em M5–M12.
