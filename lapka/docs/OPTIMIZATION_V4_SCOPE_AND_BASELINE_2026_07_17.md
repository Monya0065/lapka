# Optimization v4 Scope and Baseline (2026-07-17)

## Purpose

Define optimization v4 scope focused on cost efficiency and predictive risk controls, and capture baseline metrics.

## v4 Scope

### 1) Cost Efficiency

- Optimize connector runtime cost per 1k operations.
- Optimize AI inference cost per 1k requests.
- Reduce avoidable fallback cost overhead.

### 2) Predictive Risk Controls

- Predict mismatch spikes before threshold breach.
- Predict tenant leakage hotspot risk one cycle ahead.
- Auto-create proactive watch actions before hard alerts.

## Baseline Metrics

| Metric | Baseline Value | Target (v4) |
|---|---:|---:|
| Connector cost per 1k operations | 4.80 units | <= 4.30 units |
| AI inference cost per 1k requests | 3.60 units | <= 3.20 units |
| Fallback cost overhead share | 11.5% | <= 9.0% |
| Predictive alert precision | N/A | >= 70% |
| Predictive alert recall | N/A | >= 75% |

## Guardrails

1. No degradation of safety-critical eval pass rates.
2. No increase in critical incidents.
3. Readiness band must remain `Ready`.

## Related Documents

- `docs/OPTIMIZATION_V3_CERTIFICATION_PACKET_2026_07_10.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
