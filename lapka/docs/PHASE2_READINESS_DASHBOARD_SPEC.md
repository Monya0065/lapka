# Phase 2 Readiness Dashboard Spec

## Purpose

Define one dashboard specification that maps Phase 2 artifacts to operational indicators and go/no-go readiness signals.

## Dashboard Objective

Track repeatable growth readiness for clinic-chain rollouts by combining:

- rollout execution quality,
- KPI ownership health,
- enterprise proof status,
- integration readiness,
- support/SLA stability,
- AI safety/moat stability.

## Sections

### 1) Rollout Readiness

Sources:

- `docs/gtm/CLINIC_CHAIN_ROLLOUT_SCORECARD.md`
- `docs/runbooks/ENTERPRISE_ONBOARDING_RUNBOOK.md`

Widgets:

- rollout score by chain (`green/yellow/red`)
- phase gate completion count
- top blockers aging (days)

### 2) KPI Ownership Health

Sources:

- `docs/KPI_OWNERSHIP_MATRIX.md`
- revenue/retention/outcome specs

Widgets:

- KPI on-target/off-target split
- ownerless/escalated KPI count
- deputy takeover count (signal of owner load)

### 3) Enterprise Proof Status

Source:

- `docs/runbooks/ENTERPRISE_READINESS_PROOF_CHECKLIST.md`

Widgets:

- `done/partial/missing` counts by section
- critical missing items trend
- proof-pack freshness (days since update)

### 4) Integration Readiness

Sources:

- `docs/INTEGRATION_ROADMAP_LIS_PACS_PAYMENTS_INSURANCE.md`
- `docs/INTEGRATION_READINESS_CHECKLIST_PER_CHAIN.md`

Widgets:

- domain readiness (payments/insurance/LIS/PACS)
- blocked checklist items by chain
- connector health and reconciliation mismatch rate

### 5) Support and SLA Stability

Source:

- `docs/runbooks/SUPPORT_SLA_ESCALATION_MATRIX.md`

Widgets:

- MTTA/MTTR by severity and tier
- SLA breach rate trend
- repeated incident class count

### 6) AI Moat and Safety Readiness

Sources:

- `docs/ai/AI_MOAT_ASSET_INVENTORY.md`
- `docs/ai/AI_EVAL_GATES.md`
- `docs/ai/MOAT_QUARTERLY_REVIEW_PACK.md`

Widgets:

- asset coverage (dataset/prompt/eval/safety)
- critical eval pass rate
- policy leakage count
- moat improvement velocity

## Global Readiness Score

Suggested weighting:

- Rollout readiness: 25%
- KPI ownership health: 15%
- Enterprise proof status: 20%
- Integration readiness: 15%
- Support/SLA stability: 15%
- AI moat/safety: 10%

Status bands:

- `Ready` >= 80
- `Watch` 60..79
- `Blocked` < 60

## Alert Rules

- Any critical missing enterprise proof item -> force `Watch` or worse
- Any Sev-1 SLA breach unresolved over policy threshold -> force `Blocked`
- AI critical safety pass below threshold -> force `Blocked`

## Update Cadence

- Operational widgets: weekly
- Financial/retention widgets: monthly
- Moat governance widgets: quarterly (with monthly health snapshot)

## Ownership

- Dashboard owner: Product Lead
- Data owner: Engineering Analytics Lead
- Escalation owner: Program Manager

## Related Documents

- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
- `docs/EXECUTION_CALENDAR_RITUALS_AND_OWNERS.md`
- `docs/EXECUTIVE_QUARTERLY_NARRATIVE_TEMPLATE.md`
