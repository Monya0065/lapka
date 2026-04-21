# Phase 3 M3 Integration Extract (2026-05-08)

## Purpose

Provide second M3 integration extract with mismatch trend delta and LIS/PACS telemetry schema draft.

## Snapshot Metadata

- Snapshot date: 2026-05-08
- Previous reference: `docs/PHASE3_M3_INTEGRATION_BASELINE_EXTRACT_2026_05_01.md`
- Chain scope: Pilot Chain A

## 1) Domain Readiness Delta

| Domain | 2026-05-01 | 2026-05-08 | Delta | Status |
|---|---|---|---|---|
| payments | ready | ready | stable | ready |
| insurance | ready | ready | stable | ready |
| LIS | not_started | partial | + onboarding initiated | progressing |
| PACS | not_started | partial | + onboarding initiated | progressing |

## 2) Connector Mismatch Trend

| Connector | 2026-05-01 Mismatch % | 2026-05-08 Mismatch % | Delta | Trend |
|---|---:|---:|---:|---|
| payments connector | 0.8 | 0.7 | -0.1 pp | improving |
| insurance connector | 1.2 | 1.0 | -0.2 pp | improving |
| LIS connector | N/A | 2.6 (pilot sample) | baseline established | provisional |
| PACS connector | N/A | 2.9 (pilot sample) | baseline established | provisional |

## 3) LIS/PACS Telemetry Minimum Schema (Draft v1)

Required fields per telemetry event:

- `event_id`
- `event_ts`
- `tenant_chain_id`
- `domain` (`LIS` or `PACS`)
- `connector_id`
- `operation_type` (`sync`, `query`, `ingest`, `reconcile`)
- `status` (`success`, `partial`, `error`)
- `payload_size_bytes`
- `latency_ms`
- `mismatch_count`
- `error_code` (nullable)
- `trace_id`

Validation rules:

1. `domain` must be `LIS` or `PACS`.
2. `latency_ms` and `payload_size_bytes` must be non-negative.
3. `mismatch_count` must be integer >= 0.
4. `status=error` requires non-empty `error_code`.

## 4) M3 Gaps (Current)

1. LIS/PACS telemetry is pilot-sample only, not full weekly feed yet.
2. Need one more point to move LIS/PACS mismatch trend from provisional to initial confidence.
3. Domain readiness remains `partial` until contract/recovery checks are complete.

## Immediate Actions

1. Promote LIS/PACS telemetry draft to recurring weekly extract.
2. Add alert thresholds for mismatch > 3.0% for LIS/PACS.
3. Publish next integration delta with confidence flag.

## Related Documents

- `docs/PHASE3_M3_INTEGRATION_BASELINE_EXTRACT_2026_05_01.md`
- `docs/PHASE3_M3_ENTRY_DECISION_LOG_2026_05_01.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
