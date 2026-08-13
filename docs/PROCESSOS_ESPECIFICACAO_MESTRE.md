# ConstruData — módulo Processos — Master Specification

## Objective

Build the native, configurable **Processos** module inside ConstruData, inspired
by the architectural principles of modern process-mining platforms.

The platform must ingest operational data from multiple sources, normalize it, create event logs, model operational objects and relationships, discover actual processes, identify bottlenecks and deviations, perform root-cause analysis, support simulation, and eventually execute operational actions through integrations.

This is not intended to clone Palantir or any proprietary implementation.

The module uses a reusable configurable engine, initially focused on
construction operations but architecturally capable of supporting other
industries. It is not a separate ConstruData product.

---

## Core Product Loop

CONNECT
→ NORMALIZE
→ MODEL
→ DISCOVER
→ ANALYZE
→ SIMULATE
→ ACT
→ AUTOMATE
→ MEASURE AGAIN

---

## Product Goals

The product must be able to evolve toward answering questions such as:

"Why is this process delayed?"

and provide responses such as:

"Purchase approvals above R$50,000 made by Department X, involving suppliers registered less than 90 days ago and material category Y, take on average 2.7 additional days."

The system must then allow the user to:

- inspect affected cases;
- identify responsible people or objects;
- simulate possible improvements;
- create rules;
- trigger actions;
- integrate back into source systems.

---

## Core Architecture

Data Sources:
- ERP
- CRM
- SAP
- PostgreSQL
- APIs
- Excel
- CSV
- PDFs
- documents
- operational systems

↓

Connector Layer

↓

Medallion Data Architecture

Bronze
- immutable raw data

Silver
- cleaned and normalized data

Canonical
- standardized operational data

↓

Two parallel semantic structures:

1. Event Model
2. Ontology Model

↓

Process Mining Engine

↓

Analytics Engine

↓

Simulation Engine

↓

Rules / Action Engine

↓

Integrations / n8n / APIs

---

## Technology Stack

Frontend:
- React 19 + Vite
- TypeScript
- Tailwind
- React Flow
- ELK.js

Database:
- Supabase / PostgreSQL

Storage:
- Supabase Storage

Document intelligence:
- pgvector where useful

Integration:
- n8n
- direct APIs

Analytics backend:
- Python
- FastAPI
- Polars
- PM4Py
- scikit-learn
- optional XGBoost
- optional SHAP
- SimPy for discrete-event simulation

---

## Event Model

The universal event table should support:

event_id
event_schema_version
organization_id
process_definition_id
case_id
activity
lifecycle
occurred_at
sequence_number
actor_id
object_type
object_id
source_system
source_event_id
metadata
ingested_at

`case_id` identifies one complete process instance. `object_id` identifies the
operational object associated with a specific event and may change during the
same case. Object identifiers must be stable and namespaced so the independently
versioned Event Model and Ontology Model can join without sharing a lifecycle.

All timestamps are persisted in UTC. Canonical deterministic ordering inside a
case is `occurred_at ASC, sequence_number ASC NULLS LAST, event_id ASC`.
This ordering is not proof of causality: the universal model must not assume
that processes are strictly sequential. Future discovery and conformance
engines must support concurrent and overlapping activities.

`lifecycle` is optional and initially supports `started`, `completed`,
`approved`, `cancelled`, and `reopened`. Started and terminal events allow the
engine to distinguish queue time from processing time.

Analytical metadata remains JSONB but follows a versioned canonical structure.
Process definitions map semantic features to JSONPath expressions, for example
`amount -> $.amount` and `department -> $.department_id`.

---

## Ontology Model

Create configurable semantic tables:

ontology_object_types
ontology_property_definitions
ontology_objects
ontology_link_types
ontology_links
ontology_action_types

Objects can include:

Project
WorkOrder
PurchaseOrder
Supplier
Employee
Department
Material
Contract
Equipment
RDO

Each object may contain:
- typed properties;
- source identifiers;
- relationships;
- operational actions.

The ontology should remain generic enough to support custom object types.

---

## Process Definition

The system must allow a process to be configured rather than hardcoded.

A ProcessDefinition should include:

id
organization_id
process_key
version
name
description
timezone
case_object_type
source_mappings
feature_mappings
process_model
objective
KPI definitions
SLA definitions

`timezone` is an IANA timezone used for future working-time calculations,
business calendars, and local-time metrics. It never changes the UTC storage
rule.

`process_model` is versioned and must support multiple allowed paths, required
and optional states, forbidden transitions, start and end states, and future
concurrency groups. Conformance must never be designed around one hardcoded
`ideal_path`.

KPI and SLA definitions are typed and versioned. Each definition supports a
key, label, metric type, from/to activity and lifecycle selectors, target,
warning threshold, critical threshold, and unit.

---

## Process Discovery

Given an event log, automatically calculate:

- discovered states;
- directly-following transitions;
- frequency of each transition;
- average duration;
- median duration;
- P75;
- P90;
- case volume;
- most common paths;
- loops;
- rework;
- unusual transitions.

Return the result as a graph structure:

nodes
edges
metrics

The frontend must render this graph dynamically.

---

## Visual Process Map

Primary visualization:

React Flow + ELK.js

The graph should support:

- automatic layout;
- weighted edges;
- edge thickness based on case volume;
- visual indication of bottlenecks;
- hover;
- click;
- zoom;
- filtering;
- drill-down;
- case inspection.

Alternative views should later include:

- Sankey
- case timeline
- ideal-vs-actual BPMN
- ontology graph

---

## Bottleneck Detection

Support multiple configurable methods:

1. Business SLA
2. Internal historical baseline
3. Statistical percentile/outlier detection
4. Downstream impact on total lead time

Do not define "slow" using one universal threshold.

---

## Conformance

Allow the user to define an ideal process.

Compare observed paths against the ideal model.

Return metrics such as:

conformance score
missing transitions
unexpected transitions
loops
rework
deviations

---

## Root Cause Analysis

The analytics layer must generate features using ontology relationships.

Example features:

order_value
supplier_age
department
material_category
employee
region
contract_type

Support progressively:

Phase 1:
- group comparisons
- correlation
- statistical differences

Phase 2:
- decision trees
- random forest
- gradient boosting

Phase 3:
- SHAP explainability

Always distinguish association from causation.

Use wording such as:

"Factors associated with delay"

rather than:

"Proven causes"

---

## Simulation

Phase 1:
simple deterministic what-if simulation

Phase 2:
Monte Carlo simulation

Phase 3:
discrete-event simulation using resources, capacities and queues.

Examples:

- decrease approval duration;
- add approvers;
- change capacity;
- remove process step;
- change SLA;
- change supplier lead time.

Return before/after metrics.

---

## Rule Engine

Allow rules such as:

WHEN
approval_duration > 48h

AND
amount > 50000

THEN
notify_manager

Rules should initially be manually configured.

Later allow AI-assisted rule generation.

---

## Action Engine

Actions may include:

- send email;
- send notification;
- create task;
- update status;
- call webhook;
- call API;
- trigger n8n workflow;
- write back into CRM/ERP.

Actions must be auditable.

---

## AI Layer

The LLM must NOT be the analytical engine.

It should operate as an interface over deterministic analytical tools.

Examples:

User:
"Why are purchases delayed?"

AI calls:
get_process_bottlenecks()
get_root_cause_analysis()
get_related_objects()

AI then explains results.

The AI may help configure:
- mappings;
- process definitions;
- rules;
- filters.

---

## Demo Product

Build a separate public demo experience.

The demo must use synthetic data and require no customer integrations.

Example scenario:

Purchase-to-Pay

12,483 cases
74% conformance
8.7 day lead time

Show:

- interactive process graph;
- bottleneck;
- root cause explanation;
- impacted cases;
- what-if simulation;
- rule creation concept;
- call-to-action.

Final CTA:

"Descubra onde sua operação perde tempo."

Button:

"Solicitar diagnóstico"

The demo should visually demonstrate the entire product vision even if some analytics are currently precomputed.

---

## Construction-specific Demo

Create a second synthetic dataset around construction procurement or RDO.

Example process:

Material Request
→ Review
→ Approval
→ Purchase
→ Delivery
→ Consumption

Or:

RDO Opened
→ Field Input
→ Review
→ Correction
→ Approval
→ Closed

Sample finding:

"RDO approval at Site B takes 11.4 hours longer than the company median and explains 62% of reports closed after the target time."

---

## M2 discovery contract

M2 consumes canonical events and emits a versioned `ResultadoDescoberta` with
`nodes`, `edges`, `paths`, `loops`, `rework`, `repeatedActivities`,
`forbiddenTransitions`, `incompleteLifecycles`, `ambiguousOrderings` and
`possibleConcurrency`. `metrics` remains an empty object and `bottlenecks` an
empty array until M3.

The categories have independent semantics:

- a loop returns to an activity previously observed in the case;
- rework is a repetition matched by an explicit configurable rule;
- a repeated activity does not imply rework;
- a forbidden transition violates the versioned process definition;
- an incomplete lifecycle preserves unpaired starts, terminals and missing
  lifecycle values;
- ambiguous ordering means timestamp and sequence cannot establish a reliable
  relationship, even though `event_id` still makes storage order deterministic;
- possible concurrency means strict temporal overlap only and does not prove
  structural parallelism, causality or formal fork/join semantics.

Events are always the source of truth. Snapshots and case summaries are derived,
discardable and rebuildable. Browser clients only read `ready` materializations;
all creation, failure handling and finalization happen server-side.

M2.5 integrates this contract at `/app/processos`. DEMO and real mode use the
same `ResultadoDescoberta`; the DEMO adapter never reads or writes Supabase.

## Development Principles

- modular architecture;
- multi-tenant from the start;
- no hardcoded client-specific tables;
- strict TypeScript types;
- SQL migrations committed;
- tests for analytical functions;
- deterministic outputs;
- clear audit trail;
- maintain compatibility with Supabase;
- document all important architectural choices.
- preserve queue time and processing time as separate analytical concepts;
- never assume a strictly sequential process model.

For synthetic datasets, planted patterns must be explicitly documented outside
the event metadata. The ground truth includes feature effects, interaction
effects, loops, rework rates, path deviations, and expected duration
distributions so later engines can be scientifically validated without reading
hidden labels from the event log.

---

## Initial Milestones

M0
Repository analysis and architecture proposal.

M1
Universal Event Model + deterministic synthetic ground truth.

M2
Discovery Engine + snapshots + case summaries.

M2.5
Native Processos UI + React Flow/ELK + local DEMO.

M3
Metrics and Bottleneck Engine.

M4
Advanced Interactive Process Visualization.

M5
Configurable ontology.

M6
Root Cause Analysis.

M7
What-if simulation.

M8
Public Commercial Demo.

M9
CSV/Excel Importer.

M10
PostgreSQL/API Connectors.

M11
Rules and Actions.

M12
AI Copilot.

Do not attempt all milestones at once.

Build and validate them sequentially.
