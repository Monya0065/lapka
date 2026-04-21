# Clinic Chain Rollout Scorecard

## Purpose

Standardize implementation quality for each new clinic chain rollout and make go/no-go decisions reproducible.

## Scope

- Rollout unit: one clinic chain account (1..N branches)
- Scorecard owner: Customer Success Lead
- Review participants: Product, Engineering, GTM, Clinic executive sponsor
- Cadence: weekly during rollout, then monthly for 90 days

## Rollout Phases and Gates

1. Pre-kickoff
2. Technical readiness
3. Branch activation
4. Operational stabilization
5. Expansion readiness

Each phase must pass minimum score thresholds before moving forward.

## Scoring Model

- Scale per criterion: 0..3
  - `0` = not started / blocked
  - `1` = partial / unstable
  - `2` = acceptable baseline
  - `3` = strong and repeatable
- Weighted score = `sum(score * weight)`
- Rollout status:
  - `green` >= 80
  - `yellow` 60..79
  - `red` < 60

## Criteria Table

| Area | Criterion | Weight | Evidence |
|---|---|---:|---|
| Access and legal | Role setup complete (owner/vet/clinic_admin) | 8 | access audit + role mapping |
| Access and legal | Required legal acknowledgements complete | 8 | legal acceptance logs |
| Access and legal | Consent workflow validated for real patients | 8 | consent audit trail |
| Data and migration | Seed/import quality accepted | 8 | import report + validation checks |
| Data and migration | No critical data integrity incidents | 8 | incident log + reconciliation |
| Operations | Branch schedule and flowboard in active use | 10 | usage analytics + screenshots |
| Operations | No-show mitigation loop active | 10 | no-show dashboard deltas |
| Operations | SLA/system-task workflow adopted | 8 | dashboard SLA actions history |
| Clinical quality | Protocol/template usage baseline reached | 8 | template usage metrics |
| Clinical quality | Visit closure cycle time improved | 8 | visit lifecycle metrics |
| Business outcome | ROI evidence quality (strong/medium/weak) | 10 | ROI template for clinic |
| Business outcome | Expansion readiness for next branches | 6 | signed rollout plan |

Total weight: 100

## Mandatory Go/No-Go Conditions

Go is blocked if any condition is true:

- legal acceptance incomplete for required roles
- consent enforcement not validated in production workflow
- critical unresolved security or audit finding
- ROI evidence marked weak for two consecutive reviews without mitigation

## Weekly Review Format

For each clinic chain, record:

- Current weighted score and status (green/yellow/red)
- Top 3 blockers
- Top 3 improvements since previous review
- Next-week owner commitments (named owners and due dates)

## Evidence Links (required per review)

- ROI evidence: `docs/metrics/ROI_EVIDENCE_TEMPLATE_5_20_CLINICS.md`
- Revenue KPIs: `docs/metrics/REVENUE_ENGINE_KPI_SPEC.md`
- Retention KPIs: `docs/metrics/RETENTION_LOOP_SPEC.md`
- Outcome tree: `docs/metrics/OUTCOME_METRICS_TREE.md`
- GTM baseline: `docs/gtm/OPERATING_SYSTEM.md`
