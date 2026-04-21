# Optimization Integration Telemetry v2 Evidence (2026-06-26)

## Purpose

Provide second automated weekly extract evidence and stability delta for integration telemetry v2.

## Execution Metadata

- Cycle ID: `IT-V2-WEEKLY-2026-06-26`
- Previous cycle: `IT-V2-WEEKLY-2026-06-19`
- Manual reconciliation used: no

## Stability Delta

| Domain | Mismatch Avg 06-19 | Mismatch Avg 06-26 | Delta | p95 Latency Delta | Status |
|---|---:|---:|---:|---:|---|
| payments | 0.48 | 0.45 | -0.03 | -6 ms | stable_improving |
| insurance | 0.77 | 0.73 | -0.04 | -7 ms | stable_improving |
| LIS | 1.94 | 1.88 | -0.06 | -9 ms | stable_improving |
| PACS | 2.08 | 2.00 | -0.08 | -10 ms | stable_improving |

## QA Gate Results

| Gate | Result | Notes |
|---|---|---|
| Freshness <= 7 days | pass | snapshot age = 0 |
| Integrity bounds | pass | values in range |
| Completeness active branches | pass | 3/3 branches |
| Escalation trigger checks | pass | no critical connector |

## Outcome

- Second automated weekly cycle complete.
- Two-cycle integration telemetry stability confirmed.

## Related Documents

- `docs/OPTIMIZATION_INTEGRATION_TELEMETRY_V2_EVIDENCE_2026_06_19.md`
- `docs/OPTIMIZATION_INTEGRATION_TELEMETRY_V2_SPEC_2026_06_12.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
