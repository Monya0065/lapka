# Phase 2 M2 Recurring Feed Spec v1

Date: 2026-04-17
Owners: Analytics/Engineering Lead, Product Lead

## Purpose

Define recurring data feed model for M2 widgets so freshness and quality checks can run without manual consolidation.

## Scope (M2 Widgets)

1. Enterprise proof status:
   - done/partial/missing counts
   - critical missing trend
   - proof-pack freshness
2. Support and SLA stability:
   - MTTA/MTTR by severity/tier
   - SLA breach trend
   - repeated incident class count

## Feed Model

### Cadence

- Weekly operational feed: every Monday 09:00 local time
- Monthly enterprise feed: first business day of month 10:00 local time

### Source-to-Feed Mapping

| Widget Group | Source Artifact | Feed Entity | Owner | SLA |
|---|---|---|---|---|
| Enterprise status counts | `docs/runbooks/ENTERPRISE_READINESS_PROOF_CHECKLIST.md` | `enterprise_proof_status_snapshot` | Platform Security Lead | <= 30 days |
| Critical missing trend | checklist snapshots | `enterprise_critical_missing_timeseries` | Platform Security Lead | <= 30 days |
| Proof-pack freshness | customer proof-pack metadata | `enterprise_proof_pack_freshness` | CS Lead | <= 30 days |
| MTTA/MTTR | incident logs + escalation matrix | `support_sla_mtta_mttr_weekly` | Support Lead | <= 7 days |
| SLA breach trend | breach log by severity/tier | `support_sla_breach_trend_weekly` | Support Lead | <= 7 days |
| Repeated incident classes | `docs/INCIDENT_TAXONOMY_V1.md` + incidents | `support_incident_class_repeat_rolling_28d` | Engineering On-call Lead | <= 7 days |

## Minimum Feed Schemas

### `enterprise_proof_status_snapshot`

- `snapshot_date`
- `section_id`
- `done_count`
- `partial_count`
- `missing_count`
- `critical_missing_count`
- `evidence_completeness_pct`

### `enterprise_proof_pack_freshness`

- `tenant_chain_id`
- `proof_pack_version`
- `last_updated_at`
- `days_since_update`
- `freshness_status` (`fresh`/`stale`)

### `support_sla_mtta_mttr_weekly`

- `week_start`
- `severity`
- `support_tier`
- `incident_count`
- `mtta_minutes`
- `mttr_minutes`
- `sla_target_mtta_minutes`
- `sla_target_mttr_minutes`

### `support_sla_breach_trend_weekly`

- `week_start`
- `severity`
- `support_tier`
- `breach_count`
- `total_incidents`
- `breach_rate_pct`

### `support_incident_class_repeat_rolling_28d`

- `as_of_date`
- `class_id`
- `incident_count_28d`
- `sev1_count_28d`
- `status` (`ok`/`watch`/`critical`)

## Validation Rules

1. Freshness:
   - weekly feeds older than 7 days -> `stale`
   - monthly feeds older than 30 days -> `stale`
2. Data integrity:
   - counts cannot be negative
   - percentages bounded 0..100
   - class IDs must exist in `docs/INCIDENT_TAXONOMY_V1.md`
3. Completeness:
   - no missing owner fields
   - no empty snapshot date/week_start

## Fallback and Escalation

- Any `invalid` feed -> affected widget `invalid`, global status at least `Watch`.
- Two consecutive stale cycles on critical widget -> escalate to Program Manager and Product Lead.
- Three consecutive stale cycles on critical widget -> status `Blocked` until corrected.

## Delivery Plan (M2)

1. Week 3: publish recurring feed templates and manual-to-structured mapping.
2. Week 4: run first weekly and monthly feed cycle with QA checks.
3. Week 5: stabilize SLA checks and add to weekly readiness review.

## Related Documents

- `docs/PHASE2_WIDGET_DATA_CONTRACTS.md`
- `docs/PHASE2_WIDGET_FALLBACK_VALIDATION_2026_04_17.md`
- `docs/PHASE2_DASHBOARD_ROLLOUT_PLAN.md`
