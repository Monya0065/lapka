# Optimization AI Leakage Analytics v2 Spec (2026-06-12)

## Purpose

Define v2 automation for AI leakage analytics with automatic tenant variance generation.

## Scope

- Source: `ai_policy_leakage_monthly`
- Output:
  - tenant-level leakage variance
  - route-level hotspot list
  - confidence flags for leakage trend

## v2 Automation Design

1. Monthly scheduled leakage snapshot generation.
2. Automatic tenant and route variance splits.
3. Trend confidence calculation from rolling cycles.
4. Direct feed into quarterly moat governance pack.

## v2 Metrics

- `critical_leakage_count`
- `non_critical_leakage_count`
- `leakage_rate_per_1k`
- `median_mitigation_days`
- `tenant_variance_index`
- `trend_confidence_flag`

## QA Gates

- Freshness <= 30 days
- Mandatory owner + validation timestamp
- No ownerless critical leakage records
- Tenant coverage completeness = 100% for active chains

## Success Criteria

1. Tenant variance report generated automatically each cycle.
2. Trend confidence updated without manual recalculation.
3. Quarterly moat pack consumes v2 metrics directly.

## Evidence Links

- `docs/ai/AI_LEAKAGE_RECURRING_FEED_CONTRACT_V1.md`
- `docs/ai/PHASE3_M3_AI_TENANT_LEAKAGE_VARIANCE_2026_05_29.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
