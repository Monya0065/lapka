# Phase 2 Widget Data Contracts

## Purpose

Define minimum data contracts for each Phase 2 readiness dashboard widget: source, freshness, and quality checks.

## Contract Fields

Each widget contract must include:

- `source_system`
- `source_entity`
- `refresh_cadence`
- `expected_freshness_sla`
- `quality_checks`
- `owner`
- `fallback_behavior`

## Contracts by Dashboard Section

### 1) Rollout Readiness

| Widget | Source | Cadence | Freshness SLA | Quality Checks | Owner |
|---|---|---|---|---|---|
| Rollout score by chain | rollout scorecard records | weekly | <= 7 days | score within 0..100; chain id present | CS Lead |
| Phase gate completion count | onboarding runbook phase tracker | weekly | <= 7 days | phase state in allowed enum | Program Manager |
| Top blocker aging | blocker log | weekly | <= 7 days | created_at exists; owner assigned | Program Manager |

### 2) KPI Ownership Health

| Widget | Source | Cadence | Freshness SLA | Quality Checks | Owner |
|---|---|---|---|---|---|
| On-target/off-target split | KPI status sheet | weekly | <= 7 days | KPI id unique; status valid | Head of Growth |
| Ownerless/escalated KPI count | KPI ownership matrix + escalation log | weekly | <= 7 days | owner/deputy non-empty | Product Lead |
| Deputy takeover count | escalation events | weekly | <= 7 days | event links to KPI id | Product Lead |

### 3) Enterprise Proof Status

| Widget | Source | Cadence | Freshness SLA | Quality Checks | Owner |
|---|---|---|---|---|---|
| done/partial/missing counts | enterprise proof checklist | monthly | <= 30 days | status in enum; evidence link format valid | Platform Security Lead |
| critical missing trend | checklist history snapshots | monthly | <= 30 days | section completeness | Platform Security Lead |
| proof-pack freshness | proof-pack metadata | monthly | <= 30 days | last_updated timestamp exists | CS Lead |

### 4) Integration Readiness

| Widget | Source | Cadence | Freshness SLA | Quality Checks | Owner |
|---|---|---|---|---|---|
| Domain readiness | per-chain integration checklist | weekly | <= 7 days | domain enum valid | Integration Lead |
| Blocked checklist items | integration checklist states | weekly | <= 7 days | blocked reason non-empty | Integration Lead |
| Connector health + mismatch | connector telemetry + reconciliation | weekly | <= 7 days | mismatch rate numeric and bounded | Integration Lead |

### 5) Support and SLA Stability

| Widget | Source | Cadence | Freshness SLA | Quality Checks | Owner |
|---|---|---|---|---|---|
| MTTA/MTTR by severity | incident records | weekly | <= 7 days | severity and timestamps valid | Support Lead |
| SLA breach trend | SLA breach log | weekly | <= 7 days | breach classification valid | Support Lead |
| Repeated incident classes | incident taxonomy | weekly | <= 7 days | class mapping exists | Engineering On-call Lead |

### 6) AI Moat and Safety

| Widget | Source | Cadence | Freshness SLA | Quality Checks | Owner |
|---|---|---|---|---|---|
| Asset coverage | moat inventory | monthly | <= 30 days | asset ids unique | AI Lead |
| Critical eval pass rate | eval gate outputs | weekly | <= 7 days | scenario set completeness | AI Lead |
| Policy leakage count | safety incident log | weekly | <= 7 days | incident severity and route present | Platform Security Lead |
| Improvement velocity | issue->fix tracker | monthly | <= 30 days | timestamps complete | AI Lead |

## Fallback Rules

- If freshness SLA is violated, widget status becomes `stale`.
- If quality check fails, widget status becomes `invalid`.
- `stale` or `invalid` in critical widgets must force readiness status to at least `Watch`.

## Related Documents

- `docs/PHASE2_READINESS_DASHBOARD_SPEC.md`
- `docs/PHASE2_IMPLEMENTATION_BACKLOG.md`
- `docs/KPI_OWNERSHIP_MATRIX.md`
