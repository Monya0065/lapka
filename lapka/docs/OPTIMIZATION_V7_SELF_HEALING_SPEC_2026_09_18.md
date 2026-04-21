# Optimization v7 Self-Healing and Budget Steering Spec (2026-09-18)

## Purpose

Specify self-healing action loop and autonomous budget steering controls for optimization v7.

## Self-Healing Loop

1. Detect anomaly cluster from integration/AI/SLA signals.
2. Classify action risk tier (`low`, `medium`, `high`).
3. Auto-apply only `low` risk actions; queue others for approval.
4. Observe impact window for 24-48h.
5. Keep action if stable; rollback automatically on guardrail breach.

## Budget Steering Loop

1. Forecast near-term budget pressure by domain/route.
2. Compute steering candidates (reweight, throttle, reroute).
3. Auto-apply candidates with highest expected savings and safe risk profile.
4. Log decision rationale and expected/actual savings delta.

## Trigger Thresholds

- `self_heal_candidate`: anomaly confidence >= 0.78
- `self_heal_high_risk`: risk tier >= medium
- `budget_steer_watch`: variance projection >= 5.0%
- `budget_steer_high`: variance projection >= 7.5%

## Validation

- Weekly self-heal success/rollback tracking
- Weekly steering accuracy and prevented-overrun tracking
- Monthly guardrail audit for auto-actions

## Related Documents

- `docs/OPTIMIZATION_V7_SCOPE_AND_BASELINE_2026_09_18.md`
- `docs/runbooks/SUPPORT_SLA_ESCALATION_MATRIX.md`
