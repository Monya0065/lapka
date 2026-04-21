# Phase 2 Widget Data Contracts: Initial Values and Data Gaps (2026-04-17)

## Purpose

Capture initial contract values for Phase 2 dashboard widgets and explicitly list data gaps blocking full automation.

## Contract Status Legend

- `ready`: source and checks available now
- `partial`: source exists, but quality/freshness coverage incomplete
- `gap`: source or validation path missing

## Initial Status by Section

### 1) Rollout Readiness

| Widget | Initial Status | Current Source | Data Gap | Owner |
|---|---|---|---|---|
| Rollout score by chain | partial | scorecard document snapshots | no normalized machine-readable store | CS Lead |
| Phase gate completion count | partial | phase-gate counter baseline snapshot | chain-level automated feed not yet implemented | Program Manager |
| Top blocker aging | partial | meeting notes/manual blockers | no canonical blocker log with timestamps | Program Manager |

### 2) KPI Ownership Health

| Widget | Initial Status | Current Source | Data Gap | Owner |
|---|---|---|---|---|
| On-target/off-target split | ready | KPI weekly status sheet sample | automation to recurring feed still pending M2 | Head of Growth |
| Ownerless/escalated KPI count | ready | KPI ownership matrix + completeness check | escalation events not yet structured | Product Lead |
| Deputy takeover count | gap | none | no takeover event model | Product Lead |

### 3) Enterprise Proof Status

| Widget | Initial Status | Current Source | Data Gap | Owner |
|---|---|---|---|---|
| done/partial/missing counts | ready | enterprise proof checklist | checklist snapshots not versioned yet | Platform Security Lead |
| Critical missing trend | partial | checklist current version | historical trend snapshots missing | Platform Security Lead |
| Proof-pack freshness | gap | manual review metadata | no standardized `last_updated` record | CS Lead |

### 4) Integration Readiness

| Widget | Initial Status | Current Source | Data Gap | Owner |
|---|---|---|---|---|
| Domain readiness | partial | per-chain integration checklist | not stored as structured status table | Integration Lead |
| Blocked checklist items | partial | checklist notes | blocked reasons not normalized | Integration Lead |
| Connector health + mismatch | gap | roadmap-level only | telemetry pipeline not implemented | Integration Lead |

### 5) Support and SLA Stability

| Widget | Initial Status | Current Source | Data Gap | Owner |
|---|---|---|---|---|
| MTTA/MTTR by severity | ready | recurring weekly feed cycle report | time-series depth limited to first cycle | Support Lead |
| SLA breach trend | partial | recurring weekly feed cycle report | requires additional weekly points for trend confidence | Support Lead |
| Repeated incident classes | ready | incident taxonomy v1 + weekly cycle report | classifier drift review process not yet formalized | Engineering On-call Lead |

### 6) AI Moat and Safety

| Widget | Initial Status | Current Source | Data Gap | Owner |
|---|---|---|---|---|
| Asset coverage | partial | AI moat inventory template | route-level asset population incomplete | AI Lead |
| Critical eval pass rate | partial | AI eval gates and tests | no periodic reporting aggregation | AI Lead |
| Policy leakage count | gap | policy controls defined | no explicit leakage incident counter feed | Platform Security Lead |
| Improvement velocity | gap | no active issue->validated tracker | missing cycle-time dataset | AI Lead |

## Top Priority Data Gaps (M1)

1. Rollout score + blockers need normalized machine-readable store.
2. Enterprise and SLA widgets need additional recurring cycles for stable trend confidence.
3. Enterprise proof checklist needs versioned monthly snapshots for trend tracking.

## Next Actions

- Implement M1 sprint tasks from:
  - `docs/M1_SPRINT_BOARD_2026_04_17.md`
- Re-assess contracts at M1 close and update this file with `status delta`.

## Related Documents

- `docs/PHASE2_WIDGET_DATA_CONTRACTS.md`
- `docs/PHASE2_DASHBOARD_ROLLOUT_PLAN.md`
- `docs/M1_SPRINT_BOARD_2026_04_17.md`
