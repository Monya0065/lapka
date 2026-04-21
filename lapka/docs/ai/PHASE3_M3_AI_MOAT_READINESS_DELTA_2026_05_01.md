# Phase 3 M3 AI Moat Readiness Delta (2026-05-01)

## Purpose

Start M3 AI moat layer with initial readiness delta for asset coverage, eval pass, and leakage trend.

## Snapshot Metadata

- Snapshot date: 2026-05-01
- Sources:
  - `docs/ai/AI_MOAT_ASSET_INVENTORY.md`
  - `docs/ai/AI_EVAL_GATES.md`
  - `docs/ai/MOAT_QUARTERLY_REVIEW_PACK.md`

## 1) Asset Coverage

| Coverage Metric | Current | Previous | Delta | Status |
|---|---:|---:|---:|---|
| Routes with dataset+prompt+eval registered (%) | 68 | 55 | +13 pp | improving |
| Routes with explicit safety asset (%) | 74 | 61 | +13 pp | improving |
| Multi-clinic reusable assets (%) | 46 | 40 | +6 pp | improving |

## 2) Critical Eval Pass Rate

| Eval Group | Current Pass | Threshold | Status |
|---|---:|---:|---|
| owner triage critical safety | 1.00 | 1.00 | pass |
| document explain safety | 1.00 | 1.00 | pass |
| vet structuring schema | 0.99 | 0.98 | pass |

## 3) Policy Leakage Trend

| Metric | Current | Previous | Delta | Status |
|---|---:|---:|---:|---|
| leakage incidents (critical) | 0 | 0 | 0 | stable |
| leakage incidents (non-critical) | 2 | 3 | -1 | improving |
| median days to mitigation | 4 | 6 | -2 | improving |

## 4) M3 AI Gaps

1. Coverage remains below 80% target for full readiness.
2. Improvement velocity uses partial manual evidence for some routes.
3. Quarterly moat pack still needs connector-aware sections for integration-heavy routes.

## Immediate M3 AI Actions

1. Raise route asset coverage from 68% to 75% in next cycle.
2. Publish route-level leakage counter feed in recurring monthly format.
3. Add connector-integrated eval scenarios for LIS/PACS preparation.

## Related Documents

- `docs/ai/AI_MOAT_ASSET_INVENTORY.md`
- `docs/ai/AI_EVAL_GATES.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
