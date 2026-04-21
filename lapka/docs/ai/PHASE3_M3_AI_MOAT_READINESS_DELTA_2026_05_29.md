# Phase 3 M3 AI Moat Readiness Delta (2026-05-29)

## Purpose

Publish post-carryover AI moat delta with coverage >=80% and second full leakage feed cycle.

## Snapshot Metadata

- Snapshot date: 2026-05-29
- Previous reference: `docs/ai/PHASE3_M3_AI_MOAT_READINESS_DELTA_2026_05_22.md`
- Leakage feed contract: `docs/ai/AI_LEAKAGE_RECURRING_FEED_CONTRACT_V1.md`

## 1) Asset Coverage Delta

| Coverage Metric | 2026-05-22 | 2026-05-29 | Delta | Status |
|---|---:|---:|---:|---|
| Routes with dataset+prompt+eval registered (%) | 79 | 81 | +2 pp | target_reached |
| Routes with explicit safety asset (%) | 84 | 86 | +2 pp | improving |
| Multi-clinic reusable assets (%) | 57 | 60 | +3 pp | improving |

## 2) Critical Eval Pass Rate Delta

| Eval Group | 2026-05-22 | 2026-05-29 | Threshold | Status |
|---|---:|---:|---:|---|
| owner triage critical safety | 1.00 | 1.00 | 1.00 | pass |
| document explain safety | 1.00 | 1.00 | 1.00 | pass |
| vet structuring schema | 0.99 | 0.99 | 0.98 | pass |
| connector-integrated scenarios | 0.99 | 0.99 | 0.97 | pass |

## 3) Leakage Feed Second Full Cycle

| Metric | 2026-05-22 | 2026-05-29 | Delta | Status |
|---|---:|---:|---:|---|
| critical leakage incidents | 0 | 0 | 0 | stable |
| non-critical leakage incidents | 1 | 0 | -1 | improving |
| leakage rate per 1k requests | 0.15 | 0.11 | -0.04 | improving |
| median mitigation days | 2 | 2 | 0 | stable |
| feed freshness age (days) | 0 | 0 | stable | pass |

Trend confidence flag: `confident`

## 4) Remaining Gaps

1. Need tenant-split leakage variance for multi-chain enterprise view.
2. Need quarterly pack finalization using full-cycle leakage trend.

## Immediate Actions

1. Add tenant-level leakage variance slice in next delta.
2. Finalize quarterly moat pack with post-carryover metrics.
3. Mark AI carry-over N1/N2 as closed in execution tracking.

## Related Documents

- `docs/ai/AI_LEAKAGE_RECURRING_FEED_CONTRACT_V1.md`
- `docs/ai/MOAT_QUARTERLY_REVIEW_PACK.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
