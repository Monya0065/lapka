# Phase 3 M3 Integration Extract (2026-05-15)

## Purpose

Provide third M3 integration extract with confidence flag for LIS/PACS mismatch trend.

## Snapshot Metadata

- Snapshot date: 2026-05-15
- Previous reference: `docs/PHASE3_M3_INTEGRATION_EXTRACT_2026_05_08.md`
- Chain scope: Pilot Chain A

## 1) Domain Readiness Delta

| Domain | 2026-05-08 | 2026-05-15 | Delta | Status |
|---|---|---|---|---|
| payments | ready | ready | stable | ready |
| insurance | ready | ready | stable | ready |
| LIS | partial | partial | stable | progressing |
| PACS | partial | partial | stable | progressing |

## 2) Connector Mismatch Trend Delta

| Connector | 2026-05-08 Mismatch % | 2026-05-15 Mismatch % | Delta | Trend |
|---|---:|---:|---:|---|
| payments connector | 0.7 | 0.6 | -0.1 pp | improving |
| insurance connector | 1.0 | 0.9 | -0.1 pp | improving |
| LIS connector | 2.6 | 2.3 | -0.3 pp | improving |
| PACS connector | 2.9 | 2.5 | -0.4 pp | improving |

## 3) LIS/PACS Trend Confidence

- Data points available: 2 (2026-05-08, 2026-05-15)
- Direction: decreasing mismatch in both LIS and PACS
- Confidence flag:
  - LIS: `initial_confident`
  - PACS: `initial_confident`
- Promotion rule:
  - move to `confident` after 4 stable weekly points.

## 4) Telemetry Schema Draft Status

- Draft v1 from previous cycle remains valid.
- Additional fields proposed for v1.1:
  - `retry_count`
  - `source_system_version`
  - `reconciliation_batch_id`

## 5) Remaining M3 Gaps

1. LIS/PACS domain readiness remains `partial` until recovery checks are fully completed.
2. Need two more weekly points to promote confidence from `initial_confident`.
3. Need mismatch alert routing runbook linkage.

## Immediate Actions

1. Run fourth M3 integration cycle and keep trend confidence checks.
2. Link mismatch alerts to escalation owners/runbook.
3. Prepare LIS/PACS readiness go/no-go checklist deltas.

## Related Documents

- `docs/PHASE3_M3_INTEGRATION_EXTRACT_2026_05_08.md`
- `docs/INTEGRATION_READINESS_CHECKLIST_PER_CHAIN.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
