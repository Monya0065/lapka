# Phase 2 Dashboard Rollout Plan (M1/M2/M3)

## Purpose

Define how Phase 2 readiness dashboard widgets are rolled out by milestone with explicit owner capacity and dates.

## Rollout Timeline

| Milestone | Window | Goal |
|---|---|---|
| M1 | Weeks 1-2 | operational baseline visibility |
| M2 | Weeks 3-5 | enterprise + SLA + proof maturity |
| M3 | Weeks 6-8 | integration + moat readiness coverage |

## Owner Capacity Plan

| Role | Capacity per week | Notes |
|---|---:|---|
| Product Lead | 30% | dashboard definitions and ritual integration |
| Analytics/Engineering Lead | 50% | data pipelines and widget contracts |
| Support Lead | 20% | SLA metric and incident taxonomy alignment |
| Platform Security Lead | 20% | enterprise proof and risk gates |
| AI Lead | 20% | moat and safety feed integration |
| Program Manager | 30% | delivery tracking and escalation |

## Milestone Scope

### M1 (Weeks 1-2): Baseline Operations

Widgets:

- rollout score by chain
- phase gate completion
- blocker aging
- KPI on/off target split
- ownerless/escalated KPI count

Exit criteria:

- weekly rollout review can run entirely from dashboard widgets.

### M2 (Weeks 3-5): Enterprise and SLA Layer

Widgets:

- enterprise done/partial/missing counts
- critical missing trend
- proof-pack freshness
- MTTA/MTTR by severity/tier
- SLA breach trend
- repeated incident class count

Exit criteria:

- enterprise proof review and SLA review run without manual consolidation.

Progress update (2026-04-17):

- recurring feed/freshness spec drafted:
  - `docs/PHASE2_M2_RECURRING_FEED_SPEC_V1.md`
- first M2 enterprise/SLA extract snapshot prepared:
  - `docs/PHASE2_M2_ENTERPRISE_SLA_WIDGET_EXTRACTS_2026_04_17.md`
- customer-ready pilot proof pack v1 prepared:
  - `docs/runbooks/ENTERPRISE_PROOF_PACK_PILOT_CHAIN_A_V1.md`

### M3 (Weeks 6-8): Integration and AI Moat Layer

Widgets:

- domain readiness (payments/insurance/LIS/PACS)
- blocked integration items by chain
- connector health + mismatch rate
- moat asset coverage
- critical eval pass rate
- policy leakage and improvement velocity

Exit criteria:

- quarterly executive narrative can be generated from dashboard + linked evidence.

## Dependencies and Blockers

- widget data contracts finalized:
  - `docs/PHASE2_WIDGET_DATA_CONTRACTS.md`
- task-level execution board:
  - `docs/SPRINT_TASK_BOARD_TEMPLATE.md`
- KPI ownership alignment:
  - `docs/KPI_OWNERSHIP_MATRIX.md`

## Escalation Policy

- milestone slip > 5 business days -> escalate to Program Manager and Product Lead.
- critical widget missing at milestone close -> status becomes `Watch`.
- critical widget data invalid/stale > 2 cycles -> status becomes `Blocked`.

## Reporting

- Weekly progress note:
  - completed widgets
  - blocked widgets
  - ETA shifts and owner actions
- End of milestone report:
  - pass/fail
  - carry-over scope
  - risk and mitigation updates

## Related Documents

- `docs/PHASE2_READINESS_DASHBOARD_SPEC.md`
- `docs/PHASE2_WIDGET_DATA_CONTRACTS.md`
- `docs/PHASE2_IMPLEMENTATION_BACKLOG.md`
