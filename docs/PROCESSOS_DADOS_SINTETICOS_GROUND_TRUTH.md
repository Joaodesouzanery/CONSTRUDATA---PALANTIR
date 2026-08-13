# Processos — Ground Truth sintético de compras

This document is the validation oracle for future discovery, bottleneck and
root-cause engines. The planted truth is intentionally absent from event
metadata; analytical code must recover it from observable features and timing.

## Reproducibility contract

- Generator: `gerarDatasetComprasConstrucao()`.
- Default seed: `20260813`.
- Cases: 12,483.
- Initial instant: `2026-01-01T08:00:00.000Z`.
- Process timezone: `America/Sao_Paulo`.
- Storage timezone: UTC.
- Canonical event order: `occurred_at`, `sequence_number NULLS LAST`,
  `event_id`.

The default fixture is locked by checksum. Any intentional generator change
must update both this document and the checksum assertion in the test suite.

## Observable features and planted effects

| Observable condition | Stage | Added queue time |
| --- | --- | ---: |
| `supplier_age_days < 90` | Approval | 18h |
| `amount > 50000` | Approval | 12h |
| `department_id = DEP-INFRASTRUCTURE` | Review | 8h |
| `material_category = hydraulic` | Delivery | 6h |
| New supplier + high amount + Infrastructure | Approval | additional 36h |

The interaction is additive to both individual Approval effects. Effects apply
per execution of a stage, including reopened executions.

## Route and rework cohorts

- Standard route: remaining cases after the explicit cohorts below.
- Valid emergency route: 5%.
- Valid cancellation route: 1%.
- Forbidden `Review -> Purchase` deviation: 2%.
- Total rework: 12%, split into disjoint cohorts:
  - `Approval -> Review`: 7%.
  - `Purchase -> Approval`: 3%.
  - `Delivery -> Purchase`: 2%.

Percentages use nearest-integer allocation against 12,483 cases and a seeded
shuffle. Rework is assigned only to eligible standard cases, so route semantics
remain well-defined.

## Queue time and processing time

For every stage execution:

- `queue_time` is the interval from the preceding terminal event to `started`
  or `reopened`.
- `processing_time` is the interval from `started`/`reopened` to the terminal
  lifecycle (`completed`, `approved` or `cancelled`).
- `total_stage_time = queue_time + processing_time`.

Base durations are lognormal. Medians below exclude planted feature effects;
processing time has no planted feature effect in M1.

| Activity | Queue median | Queue sigma | Processing median | Processing sigma |
| --- | ---: | ---: | ---: | ---: |
| Material Request | 0h | 0 | 0.5h | 0.25 |
| Review | 4h | 0.45 | 2h | 0.35 |
| Approval | 12h | 0.60 | 1.5h | 0.35 |
| Emergency Approval | 3h | 0.40 | 0.75h | 0.30 |
| Purchase | 6h | 0.45 | 3h | 0.35 |
| Delivery | 72h | 0.40 | 1h | 0.25 |
| Consumption | 24h | 0.50 | 0.5h | 0.25 |

For the default fixture, realized base medians must remain within 5% of the
configured median for stages with at least 500 executions and within 10% for
smaller cohorts. Route/rework counts must match the nearest-integer allocation
exactly.

## Concurrency

M1 does not plant parallel activities. The event model remains compatible with
overlapping lifecycle intervals, and later engines must not infer causality from
the deterministic tie-break ordering alone.

## Generated default fixture

- Event count: **153,290**.
- Checksum: **`fnv1a64:0e385132416e749b`**.
- Routes: 11,484 standard; 624 emergency; 125 cancelled; 250 forbidden
  Approval skips.
- Rework: 874 Approval→Review; 374 Purchase→Approval; 250 Delivery→Purchase.
- Features: 2,543 new-supplier cases; 3,762 high-value cases; 3,111
  Infrastructure cases; 3,101 hydraulic-material cases; 188 triple-interaction
  cases.

### Realized duration quantiles (hours)

| Activity | Executions | Base queue P50/P75/P90 | Observed queue P50/P75/P90 | Processing P50/P75/P90 |
| --- | ---: | ---: | ---: | ---: |
| Material Request | 12,483 | 0 / 0 / 0 | 0 / 0 / 0 | 0.501 / 0.594 / 0.691 |
| Review | 12,733 | 3.992 / 5.407 / 7.185 | 4.831 / 10.029 / 12.600 | 2.005 / 2.542 / 3.117 |
| Approval | 12,857 | 11.928 / 17.961 / 25.739 | 19.467 / 28.971 / 39.910 | 1.507 / 1.918 / 2.350 |
| Emergency Approval | 624 | 3.051 / 3.962 / 5.195 | 3.051 / 3.962 / 5.195 | 0.735 / 0.900 / 1.077 |
| Purchase | 12,982 | 5.984 / 8.061 / 10.579 | 5.984 / 8.061 / 10.579 | 2.999 / 3.800 / 4.658 |
| Delivery | 12,608 | 72.137 / 93.709 / 120.622 | 73.750 / 95.561 / 122.336 | 0.998 / 1.184 / 1.372 |
| Consumption | 12,358 | 23.800 / 33.648 / 45.688 | 23.800 / 33.648 / 45.688 | 0.499 / 0.591 / 0.686 |
