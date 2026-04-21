# AI Leakage Recurring Feed Contract v1

Date: 2026-05-15  
Owner: Platform Security Lead  
Deputy: AI Lead

## Purpose

Define recurring feed contract for policy leakage metrics used by M3 AI readiness and quarterly governance.

## Cadence and Freshness

- Cadence: monthly (with weekly incident append support)
- Freshness SLA: <= 30 days for monthly snapshots
- Staleness rule: snapshot age > 30 days -> widget status `stale`

## Feed Entity

- Entity name: `ai_policy_leakage_monthly`
- Partition key: `snapshot_month`

## Required Fields

- `snapshot_month`
- `route_id`
- `route_group`
- `tenant_chain_id` (nullable for global routes)
- `critical_leakage_count`
- `non_critical_leakage_count`
- `total_requests`
- `leakage_rate_per_1k`
- `median_mitigation_days`
- `open_leakage_items`
- `owner`
- `last_validated_at`

## Validation Rules

1. Counts and totals must be non-negative integers.
2. `leakage_rate_per_1k` must be numeric and >= 0.
3. `median_mitigation_days` must be numeric and >= 0.
4. `owner` and `last_validated_at` are mandatory.
5. Any row with `critical_leakage_count > 0` must include linked incident IDs in evidence payload.

## Quality Gates

- Gate 1: schema completeness = 100%
- Gate 2: critical leakage unresolved ownerless rows = 0
- Gate 3: timestamp freshness within SLA

If any gate fails:

- feed status `invalid`
- readiness at least `Watch`
- escalation to Platform Security Lead and Program Manager

## Output Metrics for Dashboard/Review

- Critical leakage count (monthly)
- Non-critical leakage trend
- Leakage rate per 1k requests
- Median mitigation days

## Related Documents

- `docs/ai/PHASE3_M3_AI_MOAT_READINESS_DELTA_2026_05_08.md`
- `docs/ai/MOAT_QUARTERLY_REVIEW_PACK.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
