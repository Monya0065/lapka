# Optimization v6 Scope and Baseline (2026-08-28)

## Purpose

Define optimization v6 with focus on adaptive policy learning and budget anomaly forecasting.

## v6 Scope

### 1) Adaptive Policy Learning

- Learn policy threshold adjustments from validated incident outcomes.
- Prioritize low-risk adaptive updates with human approval gates.
- Track policy drift and rollback safety.

### 2) Budget Anomaly Forecasting

- Forecast weekly/monthly budget anomalies before breach.
- Classify anomalies by driver (connector, inference, fallback, outlier tenant).
- Auto-generate pre-emptive cost containment recommendations.

## Baseline Metrics

| Metric | Baseline | v6 Target |
|---|---:|---:|
| Adaptive policy recommendation acceptance | 54% | >= 68% |
| Policy rollback rate after deployment | 8% | <= 4% |
| Budget anomaly forecast precision | 63% | >= 74% |
| Budget anomaly forecast recall | 69% | >= 78% |
| Mean lead time before budget breach | 1.8 days | >= 3.5 days |

## Guardrails

1. No safety policy weakening without dual signoff.
2. Critical leakage must remain 0.
3. Readiness band must remain `Ready`.

## Related Documents

- `docs/OPTIMIZATION_V5_CERTIFICATION_PACKET_2026_08_21.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
