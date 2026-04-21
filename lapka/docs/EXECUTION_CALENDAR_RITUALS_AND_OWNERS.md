# Execution Calendar (Rituals and Owners)

## Purpose

Convert strategy artifacts into operating rituals with fixed cadence, clear owners, and expected outputs.

## Cadence Overview

| Cadence | Ritual | Primary Owner | Backup Owner | Core Output |
|---|---|---|---|---|
| Daily | Operational health standup | CS Ops Lead | Platform Ops Lead | incident/blocker log |
| Weekly | Pipeline + rollout health review | Head of Growth | CS Lead | rollout status + risk list |
| Weekly | Product/AI safety review | Product Lead | AI Lead | safety deltas + action items |
| Weekly | Support SLA review | Support Lead | Engineering On-call Lead | MTTA/MTTR trend and breaches |
| Monthly | ROI and retention review | Product Lead | Head of Growth | cohort KPI delta report |
| Monthly | Enterprise readiness review | Platform Security Lead | Engineering Lead | proof checklist status |
| Quarterly | Executive narrative review | Product Lead | CEO/GM delegate | quarter narrative + decisions |
| Quarterly | Moat governance review | AI Lead | Platform Security Lead | moat review pack + commitments |

## Weekly Ritual Set

### 1) Pipeline + Rollout Health (Monday)

- Inputs:
  - `docs/gtm/CLINIC_CHAIN_ROLLOUT_SCORECARD.md`
  - `docs/INTEGRATION_READINESS_CHECKLIST_PER_CHAIN.md`
- Output:
  - updated rollout score status (`green/yellow/red`) per chain
  - top blockers + named owners + due dates

### 2) Support SLA Review (Wednesday)

- Inputs:
  - `docs/runbooks/SUPPORT_SLA_ESCALATION_MATRIX.md`
  - incident logs and SLA breach counters
- Output:
  - weekly SLA breach digest
  - corrective action plan for repeated incident classes

### 3) Product + AI Safety Review (Friday)

- Inputs:
  - `docs/ai/AI_EVAL_GATES.md`
  - `docs/ai/AI_MOAT_ASSET_INVENTORY.md`
- Output:
  - eval/safety movement summary
  - moat asset updates and risk owner assignment

## Monthly Ritual Set

### 1) ROI + Retention Review

- Inputs:
  - `docs/metrics/ROI_EVIDENCE_TEMPLATE_5_20_CLINICS.md`
  - `docs/metrics/REVENUE_ENGINE_KPI_SPEC.md`
  - `docs/metrics/RETENTION_LOOP_SPEC.md`
- Output:
  - monthly cohort-level ROI memo
  - lagging KPI intervention plan

### 2) Enterprise Proof Review

- Inputs:
  - `docs/runbooks/ENTERPRISE_READINESS_PROOF_CHECKLIST.md`
  - `docs/runbooks/ENTERPRISE_ONBOARDING_RUNBOOK.md`
- Output:
  - updated status for `done/partial/missing`
  - customer-ready proof-pack update list

## Quarterly Ritual Set

### 1) Executive Quarterly Narrative

- Input template:
  - `docs/EXECUTIVE_QUARTERLY_NARRATIVE_TEMPLATE.md`
- Output:
  - final quarter narrative (ROI + moat + enterprise risk)
  - explicit leadership decisions and commitments

### 2) Moat Governance Review

- Input template:
  - `docs/ai/MOAT_QUARTERLY_REVIEW_PACK.md`
- Output:
  - moat pass/fail status
  - next-quarter moat commitments (owners + dates)

## Meeting Hygiene Rules

- Every ritual must end with:
  - owner per action
  - due date
  - measurable success criteria
- No ownerless blocker is allowed to remain open after the meeting.
- Repeated misses (>2 cycles) trigger escalation to executive review.

## Related Documents

- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
- `docs/EXECUTIVE_QUARTERLY_NARRATIVE_TEMPLATE.md`
