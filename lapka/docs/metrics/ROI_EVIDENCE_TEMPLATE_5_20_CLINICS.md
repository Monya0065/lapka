# ROI Evidence Template (5-20 Clinics)

## Purpose

Use this template to prove PMF+ROI in pilot clinic cohorts (5-20 clinics) with comparable baseline and post-rollout windows.

## Cohort Definition

- Cohort size: 5-20 clinics
- Rollout model: same module set and onboarding playbook for all cohort clinics
- Baseline window: 28 days before rollout
- Post window: 28 days after stabilization
- Exclusion rules: holidays/outages/missing data days must be documented

## KPI Evidence Table

Fill one row per clinic and keep formulas unchanged.

| KPI | Formula | Baseline | Post | Delta | Target | Evidence Strength | Source |
|---|---|---:|---:|---:|---:|---|---|
| No-show rate | no_show_visits / scheduled_visits |  |  |  | <= -15% | strong/medium/weak | schedule + visit events |
| Time to close visit | avg(finalized_at - started_at) |  |  |  | <= -20% | strong/medium/weak | visit lifecycle |
| Branch utilization | completed_visits / available_slots |  |  |  | >= +10% | strong/medium/weak | schedule + appointments |
| Follow-up completion | follow_up_completed / follow_up_planned |  |  |  | >= +12% | strong/medium/weak | follow-up workflow |
| Protocol completeness | visits_with_complete_protocol / finalized_visits |  |  |  | >= +10% | strong/medium/weak | clinical templates/protocol checks |
| Operational error rate | policy_or_process_errors / finalized_visits |  |  |  | <= -20% | strong/medium/weak | audit + incident logs |
| Revenue per branch | total_revenue / active_branches |  |  |  | >= +8% | strong/medium/weak | billing data |
| Cost per completed visit | operating_cost / finalized_visits |  |  |  | <= -10% | strong/medium/weak | finance ops |

## Clinic-Level Narrative Block

For each clinic, add a short narrative:

- Context: clinic size, branch count, and initial bottleneck
- Intervention: modules/processes enabled during rollout
- Result: top 2 KPI gains and one lagging KPI
- Next action: explicit playbook step for next 14 days

## Confidence Rules

- `strong`: complete data in both windows, no major confounders
- `medium`: minor data gaps or one confounder with mitigation
- `weak`: major gaps/confounders; directional only, not investment-grade

## Gate to Exit PMF+ROI Phase

PMF+ROI phase can be considered passed when:

- at least 5 clinics show strong or medium evidence on no-show and time-to-close improvements
- at least 60% of cohort clinics hit 4+ KPI targets
- no critical safety/regulatory regressions are observed in the post window

## Reporting Cadence

- Weekly: clinic-level update using this template
- Monthly: aggregated cohort report with weighted medians and variance notes

## Links to Existing KPI Specs

- `docs/metrics/OUTCOME_METRICS_TREE.md`
- `docs/metrics/REVENUE_ENGINE_KPI_SPEC.md`
- `docs/metrics/RETENTION_LOOP_SPEC.md`
