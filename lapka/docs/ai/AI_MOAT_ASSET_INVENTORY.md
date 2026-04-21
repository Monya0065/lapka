# AI Moat Asset Inventory

## Purpose

Create a single source of truth for moat-grade AI assets:

- clinical datasets,
- prompt assets,
- evaluation suites and gates,
- governance controls,
- iteration speed signals.

This inventory is required to move from "provider routing" to defensible AI moat execution.

## Asset Domains

1. Data assets
2. Prompt assets
3. Eval assets
4. Safety and policy assets
5. Runtime and observability assets

## Inventory Table (fill per asset)

| Asset ID | Domain | Name | Owner | Source | Version | Coverage | Quality Gate | Last Validation | Risk |
|---|---|---|---|---|---|---|---|---|---|
| data.triage.owner.v1 | data | owner triage dataset | AI lead | prod anonymized + synthetic | v1 | owner triage intents | eval gate pass 100% critical |  | low/med/high |
| prompt.triage.owner.v1 | prompt | owner triage system prompt | clinical AI owner | prompt registry | v1 | owner triage | policy violation block enforced |  | low/med/high |
| eval.triage.owner.v1 | eval | owner triage eval suite | QA + AI | `tests/test_ai_eval_unit.py` + regression set | v1 | safety + schema | fail pipeline if critical < 1.0 |  | low/med/high |
| policy.owner.safety.v1 | safety | owner safety block patterns | safety owner | `ai_safe` rules | v1 | owner channels | no treatment/dose leak |  | low/med/high |
| obs.ai.runtime.v1 | runtime | AI runtime usage logs | platform owner | control plane logs | v1 | all AI routes | error + budget thresholds |  | low/med/high |

## Required Metadata per Domain

### Data assets

- anonymization status
- clinic/branch/role coverage
- drift signal and refresh cadence
- labeling protocol and reviewer role

### Prompt assets

- prompt objective and non-goals
- target role and route scope
- policy constraints embedded in prompt
- fallback behavior and safe failure mode

### Eval assets

- critical scenarios list (must-pass)
- non-critical scenarios list (target threshold)
- deterministic expected schema
- CI gate policy and artifact location

### Safety assets

- blocked intent families
- violation contract (`422 POLICY_VIOLATION`)
- escalation path for false positive/false negative

### Runtime assets

- provider/fallback chain by route
- budget/rate limits in force
- audit and usage log completeness
- incident linkage for AI-related failures

## Moat Health Metrics

- Coverage: percent of production AI routes backed by registered dataset + prompt + eval set.
- Safety reliability: critical-policy pass rate in CI and production audits.
- Improvement velocity: median days from issue detection to validated asset update.
- Reuse depth: percent of assets shared across multiple clinics/branches without safety regression.

## Governance Cadence

- Weekly: inventory delta review (new assets, changed assets, degraded assets).
- Monthly: moat health score review with Product/AI/Engineering leaders.
- Quarterly: externalized proof pack for enterprise/compliance conversations.

## Evidence Links

- Architecture baseline: `docs/ai/AI_ARCHITECTURE_BASELINE.md`
- Eval gates: `docs/ai/AI_EVAL_GATES.md`
- Execution plan: `docs/PHASE_NEXT_EXECUTION_PLAN.md`
