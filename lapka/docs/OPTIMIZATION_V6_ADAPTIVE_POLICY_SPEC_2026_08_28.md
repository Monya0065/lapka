# Optimization v6 Adaptive Policy and Forecasting Spec (2026-08-28)

## Purpose

Specify adaptive policy learning and budget anomaly forecasting controls for optimization v6.

## Adaptive Policy Loop

1. Collect candidate adjustments from incident and override history.
2. Score each candidate by safety risk, expected benefit, and confidence.
3. Apply only candidates above approval threshold with dual signoff.
4. Monitor post-deployment effects for 2 cycles.
5. Roll back automatically if guardrail breach occurs.

## Forecasting Loop

1. Build rolling budget anomaly features per domain/tenant.
2. Produce breach probability and expected lead time.
3. Trigger pre-emptive recommendations if breach probability >= 0.70.
4. Escalate if projected breach lead time < 2 days.

## Key Triggers

- `policy_adapt_candidate`: confidence >= 0.75 and safety risk <= medium
- `budget_anomaly_watch`: breach probability >= 0.70
- `budget_anomaly_high`: breach probability >= 0.85

## Validation

- Weekly precision/recall for anomaly forecast
- Weekly adaptive acceptance and rollback ratio
- Monthly governance review for model drift and guardrail adherence

## Related Documents

- `docs/OPTIMIZATION_V6_SCOPE_AND_BASELINE_2026_08_28.md`
- `docs/runbooks/SUPPORT_SLA_ESCALATION_MATRIX.md`
