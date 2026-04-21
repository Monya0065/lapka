# Optimization Integration Telemetry v2 Evidence (2026-06-19)

## Purpose

Provide first automated weekly extract evidence for integration telemetry v2 implementation.

## Execution Metadata

- Cycle ID: `IT-V2-WEEKLY-2026-06-19`
- Cadence: weekly
- Source scope: payments, insurance, LIS, PACS
- Manual reconciliation used: no

## Automated Weekly Extract Snapshot

| Domain | Connectors | Branch Coverage | Mismatch Avg (%) | p95 Latency (ms) | Status |
|---|---:|---:|---:|---:|---|
| payments | 1 | 3/3 | 0.48 | 212 | ready |
| insurance | 1 | 3/3 | 0.77 | 238 | ready |
| LIS | 1 | 3/3 | 1.94 | 301 | ready |
| PACS | 1 | 3/3 | 2.08 | 329 | ready |

## QA Gate Results

| Gate | Result | Notes |
|---|---|---|
| Freshness <= 7 days | pass | snapshot age = 0 |
| Integrity bounds 0..100 | pass | all rates valid |
| Completeness all active branches | pass | 3/3 branches present |
| Escalation trigger on `critical` status | pass | no connector in critical state |

## Confidence Flag Automation

- payments: `confident`
- insurance: `confident`
- LIS: `confident`
- PACS: `confident`

Updated automatically from trend rules, no manual override.

## Outcome

- Weekly extract generated and validated without manual edits.
- Integration telemetry v2 workstream first evidence cycle is complete.

## Related Documents

- `docs/OPTIMIZATION_INTEGRATION_TELEMETRY_V2_SPEC_2026_06_12.md`
- `docs/PHASE3_M3_INTEGRATION_POST_CARRYOVER_2026_05_29.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
