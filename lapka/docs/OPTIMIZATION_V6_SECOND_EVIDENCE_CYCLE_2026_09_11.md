# Optimization v6 Second Evidence Cycle (2026-09-11)

## Purpose

Provide second v6 cycle evidence and certify adaptive policy and anomaly forecast targets.

## Cycle Metadata

- Cycle window: 2026-09-04 to 2026-09-11
- Previous cycle: `docs/OPTIMIZATION_V6_FIRST_EVIDENCE_CYCLE_2026_09_04.md`

## Adaptive Policy Metrics

| Metric | Cycle-1 | Cycle-2 | Target | Status |
|---|---:|---:|---:|---|
| Adaptive recommendation acceptance | 61% | 69% | >= 68% | pass |
| Policy rollback rate | 6% | 3.8% | <= 4% | pass |
| Safe deployment coverage | 79% | 86% | >= 85% | pass |

## Budget Forecast Metrics

| Metric | Cycle-1 | Cycle-2 | Target | Status |
|---|---:|---:|---:|---|
| Forecast precision | 69% | 75% | >= 74% | pass |
| Forecast recall | 74% | 79% | >= 78% | pass |
| Mean breach lead time | 2.9 days | 3.7 days | >= 3.5 days | pass |

## Guardrail Checks

- Critical leakage incidents: 0 (pass)
- Readiness band: `Ready` retained
- Safety policy weakening without dual signoff: none

## Outcome

- All v6 targets achieved in cycle-2.
- Ready for v6 validation and certification.

## Related Documents

- `docs/OPTIMIZATION_V6_SCOPE_AND_BASELINE_2026_08_28.md`
- `docs/OPTIMIZATION_V6_ADAPTIVE_POLICY_SPEC_2026_08_28.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
