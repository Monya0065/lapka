# Optimization v4 Predictive Control Spec (2026-07-17)

## Purpose

Define predictive control layer for mismatch and leakage risk preemption.

## Predictive Signals

1. Connector mismatch acceleration (>0.25 pp week-over-week).
2. Tenant leakage acceleration (>0.02 per 1k week-over-week).
3. Combined risk score (integration + leakage + fallback pressure).

## Trigger Policy

- `watch_predicted`: risk score >= 0.65
- `high_risk_predicted`: risk score >= 0.80
- `critical_predicted`: risk score >= 0.90

## Actions by Trigger

- `watch_predicted`: create proactive watch item + owner notification
- `high_risk_predicted`: pre-escalate to Program Manager + domain owner
- `critical_predicted`: start containment checklist before threshold breach

## Validation

- Weekly precision/recall measurement
- False-positive review in weekly ops ritual
- Mandatory human signoff for `critical_predicted`

## Related Documents

- `docs/OPTIMIZATION_V4_SCOPE_AND_BASELINE_2026_07_17.md`
- `docs/ai/OPTIMIZATION_V3_TENANT_HOTSPOT_REMEDIATION_PLAYBOOK_2026_07_03.md`
