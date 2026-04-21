# Phase 3 M3 Integration Baseline Extract (2026-05-01)

## Purpose

Start M3 integration layer with baseline values for domain readiness and connector mismatch widgets.

## Snapshot Metadata

- Snapshot date: 2026-05-01
- Chain scope: Pilot Chain A
- Source contracts:
  - `docs/PHASE2_WIDGET_DATA_CONTRACTS.md`
  - `docs/INTEGRATION_READINESS_CHECKLIST_PER_CHAIN.md`

## 1) Domain Readiness by Integration Domain

| Domain | Status | Done Checks | Partial Checks | Blocked Checks | Notes |
|---|---|---:|---:|---:|---|
| payments | ready | 3 | 0 | 0 | M2 closure confirmed |
| insurance | ready | 3 | 0 | 0 | IB-003 closure confirmed |
| LIS | not_started | 0 | 0 | 0 | M3 onboarding not started |
| PACS | not_started | 0 | 0 | 0 | M3 onboarding not started |

## 2) Connector Health + Mismatch Baseline

| Connector | Health | Mismatch Rate (%) | Error Rate (%) | Baseline Status |
|---|---|---:|---:|---|
| payments connector | healthy | 0.8 | 0.4 | ready |
| insurance connector | healthy | 1.2 | 0.7 | ready |
| LIS connector | unknown | N/A | N/A | gap |
| PACS connector | unknown | N/A | N/A | gap |

## 3) M3 Gaps

1. LIS/PACS connectors do not yet provide telemetry.
2. Mismatch trend has only one baseline point.
3. Domain readiness for LIS/PACS remains `not_started`.

## Immediate M3 Actions

1. Add weekly connector telemetry extract for payments/insurance.
2. Define LIS/PACS telemetry ingestion minimum schema.
3. Produce second baseline point for mismatch trend confidence.

## Related Documents

- `docs/PHASE2_M2_CLOSEOUT_AND_M3_CARRYOVER_PLAN_2026_05_01.md`
- `docs/PHASE2_M2_INTEGRATION_BLOCKER_DELTA_2026_05_01.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
